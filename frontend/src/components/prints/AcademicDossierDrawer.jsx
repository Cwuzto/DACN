import React, { useState, useMemo, useEffect } from 'react';
import { Drawer, Tabs, Button, Tag, Space, Alert, Tooltip } from 'antd';
import {
    PrinterOutlined,
    FileTextOutlined,
    FilePdfOutlined,
    BookOutlined,
    EditOutlined,
    ScheduleOutlined,
    SafetyCertificateOutlined,
    AuditOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrationTasks } from '../../queries/taskQueries';
import { useRegistrationMeetingLogs, useBM03Record } from '../../queries/meetingQueries';
import { useRegistrationCheckpoints } from '../../queries/checkpointQueries';
import { useBM04Record } from '../../queries/gradingQueries';
import { useRegistrationBm02aRequests } from '../../queries/bm02aQueries';
import { useMyOutline } from '../../queries/outlineQueries';
import { getAssetDownloadUrl } from '../../services/resumableUploadService';
import BM01PrintSheet from './BM01PrintSheet';
import BM02PrintSheet from './BM02PrintSheet';
import BM02APrintSheet from './BM02APrintSheet';
import BM03PrintSheet from './BM03PrintSheet';
import BM04PrintSheet from './BM04PrintSheet';
import BM05PrintSheet from './BM05PrintSheet';
import AcademicFormPrintModal from './AcademicFormPrintModal';
import { getStatusTagConfig } from '../common/statusMap';

export default function AcademicDossierDrawer({
    open,
    onClose,
    registration,
    initialTab = 'BM01',
}) {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const regId = registration?.id;

    // Active tab in drawer
    const [activeTabKey, setActiveTabKey] = useState(initialTab || 'BM01');

    useEffect(() => {
        if (open && initialTab) {
            setActiveTabKey(initialTab);
        }
    }, [open, initialTab]);

    // Print Modal State
    const [printModalConfig, setPrintModalConfig] = useState({
        open: false,
        title: '',
        documentCode: '',
        mode: 'single', // 'single' or 'all'
    });

    // Queries for dossier data
    const enabled = Boolean(open && regId);
    const isStudent = user?.role === 'STUDENT';
    const tasksQuery = useRegistrationTasks(scope, regId, enabled);
    const meetingLogsQuery = useRegistrationMeetingLogs(scope, regId, enabled);
    const checkpointsQuery = useRegistrationCheckpoints(scope, regId, enabled);
    const bm03Query = useBM03Record(scope, regId, enabled);
    const bm04Query = useBM04Record(scope, regId, enabled);
    const bm02aQuery = useRegistrationBm02aRequests(scope, regId, enabled);
    const outlineQuery = useMyOutline(scope, Boolean(enabled && isStudent));

    const tasks = tasksQuery.data || [];
    const meetingLogs = meetingLogsQuery.data || [];
    const checkpoints = checkpointsQuery.data || [];
    const bm03Record = bm03Query.data || null;
    const bm04Record = bm04Query.data || null;
    const bm02aRequests = bm02aQuery.data || [];
    const latestBm02a = bm02aRequests.length > 0 ? bm02aRequests[0] : null;
    const hasSubmittedBm02a = Boolean(latestBm02a && latestBm02a.status !== 'STUDENT_PREPARING');

    useEffect(() => {
        if (activeTabKey === 'BM02-A' && !hasSubmittedBm02a) {
            setActiveTabKey('BM01');
        }
    }, [activeTabKey, hasSubmittedBm02a]);

    const bm01Task = tasks.find(
        (t) => t.taskType === 'BM01' || t.taskType === 'BM01_INITIAL_SUBMISSION' || t.taskType === 'BM01_RESUBMISSION'
    );
    const bm01LastSub = bm01Task?.submissions?.[0] || null;
    const bm01AssetId = bm01LastSub?.assetId || outlineQuery.data?.assetId || null;
    const bm01PdfUrl = registration?.bm01PdfUrl || bm01LastSub?.fileUrl || outlineQuery.data?.fileUrl || null;
    const hasBm01Pdf = Boolean(bm01AssetId || bm01PdfUrl);

    const bm02Task = tasks.find((t) => t.taskType === 'BM02');
    const bm02Submission = registration?.currentBM02Submission || bm02Task?.submissions?.[0] || null;
    const bm02Verification = bm02Submission?.verification || registration?.bm02Verification || null;

    // Derived summary record for BM05
    const summaryRecord = useMemo(() => {
        if (!registration) return null;
        const defenseResult = registration.defenseResult || {};
        const council = registration.council || registration.defenseCouncil || {};
        const councilMembers = council.members || [];
        const chairMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
        const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');
        const isPublished = Boolean(
            defenseResult.isPublished ||
            defenseResult.publishedAt ||
            registration.resultPublishedAt ||
            registration.status === 'COMPLETED' ||
            registration.status === 'ARCHIVED'
        );

        return {
            topicTitle: registration.adjustedTitle || registration.topic?.title || registration.customTopicTitle,
            studentName: registration.student?.fullName,
            studentCode: registration.student?.code,
            mentorName: registration.mentor?.fullName || registration.topic?.mentor?.fullName,
            councilName: council.name,
            defenseDate: council.defenseDate,
            location: council.location,
            decisionCode: council.decisionCode,
            finalScore: defenseResult.finalScore ?? registration.finalScore ?? registration.roundedFinalScore,
            status: registration.status,
            memberScores: defenseResult.memberScores || registration.memberScores || [],
            comments: defenseResult.comments || registration.comments,
            secretaryName: secretaryMember?.lecturer?.fullName,
            chairmanName: chairMember?.lecturer?.fullName,
            secretarySignedAt: defenseResult.secretarySignedAt || null,
            chairmanSignedAt: defenseResult.chairmanSignedAt || null,
            isPublished,
        };
    }, [registration]);

    const printEligibility = useMemo(() => {
        const bm03Finalized = Boolean(
            bm03Record?.advisorSignedAt ||
            (bm03Record?.finalStageEvaluation && registration?.status === 'BM03_PASSED')
        );
        const bm04Finalized = Boolean(
            bm04Record &&
            (bm04Record.isLocked || bm04Record.status === 'OFFICIAL' || (bm04Record.signedAt && bm04Record.lecturerSignature))
        );
        const bm05Published = Boolean(summaryRecord?.isPublished);

        return {
            BM01: {
                eligible: false,
                reason: 'BM01 dùng tệp PDF riêng do sinh viên tải lên; vui lòng tải/in PDF BM01 riêng.',
            },
            BM02: bm02Submission
                ? { eligible: true, reason: '' }
                : { eligible: false, reason: 'Chưa có dữ liệu nộp BM02 để in.' },
            'BM02-A': hasSubmittedBm02a
                ? { eligible: true, reason: '' }
                : { eligible: false, reason: 'Chưa có phiếu điều chỉnh tên đề tài BM02-A.' },
            BM03: bm03Finalized
                ? { eligible: true, reason: '' }
                : { eligible: false, reason: 'BM03 chưa chốt cuối kỳ; chỉ xem nhật ký trên màn hình.' },
            BM04: bm04Finalized
                ? { eligible: true, reason: '' }
                : { eligible: false, reason: 'Phiếu nhận xét BM04 chưa được ký chính thức.' },
            BM05: bm05Published
                ? { eligible: true, reason: '' }
                : { eligible: false, reason: 'Kết quả BM05 chưa được công bố chính thức.' },
        };
    }, [bm02Submission, hasSubmittedBm02a, bm03Record, bm04Record, summaryRecord, registration?.status]);

    const eligibleBundleKeys = useMemo(
        () => ['BM02', 'BM02-A', 'BM03', 'BM04', 'BM05'].filter((key) => printEligibility[key]?.eligible),
        [printEligibility]
    );

    const currentEligibility = printEligibility[activeTabKey] || { eligible: false, reason: 'Không đủ điều kiện in.' };

    const formNames = {
        BM01: 'BM01 · Đề cương nghiên cứu chi tiết',
        BM02: 'BM02 · Giao nhiệm vụ khóa luận',
        'BM02-A': 'BM02-A · Điều chỉnh tên đề tài',
        BM03: 'BM03 · Sổ theo dõi tiến độ & hướng dẫn',
        BM04: 'BM04 · Phiếu nhận xét của người hướng dẫn',
        BM05: 'BM05 · Biên bản tổng hợp chấm bảo vệ',
    };

    const handleOpenBm01Pdf = async () => {
        if (!hasBm01Pdf || typeof window === 'undefined') return;
        let targetUrl = bm01PdfUrl;
        if (bm01AssetId) {
            try {
                const data = await getAssetDownloadUrl(bm01AssetId);
                targetUrl = data?.downloadUrl || data?.url || bm01PdfUrl;
            } catch {
                targetUrl = bm01PdfUrl;
            }
        }
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handlePrintCurrent = () => {
        if (!currentEligibility.eligible) return;
        setPrintModalConfig({
            open: true,
            title: formNames[activeTabKey] || `Biểu mẫu ${activeTabKey}`,
            documentCode: activeTabKey,
            mode: 'single',
        });
    };

    const handlePrintAll = () => {
        if (eligibleBundleKeys.length === 0) return;
        setPrintModalConfig({
            open: true,
            title: 'HỒ SƠ HỌC VỤ ĐỦ ĐIỀU KIỆN',
            documentCode: 'DOSSIER_FULL',
            mode: 'all',
        });
    };

    const tabItems = [
        {
            key: 'BM01',
            label: (
                <span>
                    <FileTextOutlined style={{ marginRight: 6 }} />
                    BM01 (Đề cương)
                </span>
            ),
            children: (
                <div style={{ padding: '8px 0' }}>
                    <Alert
                        type="info"
                        showIcon
                        className="mb-3"
                        title="BM01 là tệp PDF riêng do sinh viên tải lên"
                        description="Vui lòng tải hoặc in trực tiếp tệp PDF BM01 đã nộp; không ghép BM01 vào lệnh in HTML của trình duyệt."
                        action={
                            <Button
                                size="small"
                                type="primary"
                                icon={<FilePdfOutlined />}
                                disabled={!hasBm01Pdf}
                                onClick={handleOpenBm01Pdf}
                            >
                                Tải / In PDF BM01
                            </Button>
                        }
                    />
                </div>
            ),
        },
        {
            key: 'BM02',
            label: (
                <span>
                    <BookOutlined style={{ marginRight: 6 }} />
                    BM02 (Nhiệm vụ)
                </span>
            ),
            children: (
                <div style={{ padding: '8px 0' }}>
                    {!printEligibility.BM02.eligible && (
                        <Alert type="warning" showIcon className="mb-3" title={printEligibility.BM02.reason} />
                    )}
                    <BM02PrintSheet
                        submission={bm02Submission}
                        verification={bm02Verification}
                        registration={registration}
                    />
                </div>
            ),
        },
        ...(hasSubmittedBm02a
            ? [
                {
                    key: 'BM02-A',
                    label: (
                        <span>
                            <EditOutlined style={{ marginRight: 6 }} />
                            BM02-A (Đổi tên)
                        </span>
                    ),
                    children: (
                        <div style={{ padding: '8px 0' }}>
                            {!printEligibility['BM02-A'].eligible && (
                                <Alert type="warning" showIcon className="mb-3" title={printEligibility['BM02-A'].reason} />
                            )}
                            <BM02APrintSheet request={latestBm02a || {}} registration={registration} />
                        </div>
                    ),
                },
            ]
            : []),
        {
            key: 'BM03',
            label: (
                <span>
                    <ScheduleOutlined style={{ marginRight: 6 }} />
                    BM03 (Tiến độ)
                </span>
            ),
            children: (
                <div style={{ padding: '8px 0' }}>
                    {!printEligibility.BM03.eligible && (
                        <Alert type="info" showIcon className="mb-3" title={printEligibility.BM03.reason} />
                    )}
                    <BM03PrintSheet
                        meetingLogs={meetingLogs}
                        checkpoints={checkpoints}
                        registration={registration}
                        bm03Record={bm03Record}
                    />
                </div>
            ),
        },
        {
            key: 'BM04',
            label: (
                <span>
                    <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                    BM04 (Nhận xét GVHD)
                </span>
            ),
            children: (
                <div style={{ padding: '8px 0' }}>
                    {!printEligibility.BM04.eligible && (
                        <Alert type="warning" showIcon className="mb-3" title={printEligibility.BM04.reason} />
                    )}
                    <BM04PrintSheet evaluation={bm04Record || {}} registration={registration} />
                </div>
            ),
        },
        {
            key: 'BM05',
            label: (
                <span>
                    <AuditOutlined style={{ marginRight: 6 }} />
                    BM05 (Biên bản HĐ)
                </span>
            ),
            children: (
                <div style={{ padding: '8px 0' }}>
                    {!printEligibility.BM05.eligible && (
                        <Alert type="warning" showIcon className="mb-3" title={printEligibility.BM05.reason} />
                    )}
                    <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                </div>
            ),
        },
    ];

    const studentName = registration?.student?.fullName || 'Sinh viên';
    const studentCode = registration?.student?.code || '';
    const topicTitle = registration?.topic?.title || registration?.customTopicTitle || 'Khóa luận tốt nghiệp';
    const topicCode = registration?.topic?.code || `DT-${String(registration?.topic?.id || registration?.topicId || registration?.id || '2026').padStart(3, '0')}`;
    const mentorName = registration?.mentor?.fullName || registration?.topic?.mentor?.fullName || 'Chưa gán';

    return (
        <>
            <Drawer
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 24 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F766E' }}>
                                HỒ SƠ BIỂU MẪU HỌC VỤ TOÀN TRÌNH
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                {topicCode} · {topicTitle}
                            </div>
                        </div>
                        <Space>
                            <Button
                                icon={<FilePdfOutlined />}
                                disabled={!hasBm01Pdf}
                                onClick={handleOpenBm01Pdf}
                            >
                                Tải / In PDF BM01
                            </Button>
                            <Tooltip title={!currentEligibility.eligible ? currentEligibility.reason : ''}>
                                <Button
                                    icon={<PrinterOutlined />}
                                    disabled={!currentEligibility.eligible}
                                    onClick={handlePrintCurrent}
                                >
                                    In biểu mẫu này
                                </Button>
                            </Tooltip>
                            <Tooltip title={eligibleBundleKeys.length === 0 ? 'Chưa có biểu mẫu nào đủ điều kiện in.' : ''}>
                                <Button
                                    type="primary"
                                    icon={<PrinterOutlined />}
                                    disabled={eligibleBundleKeys.length === 0}
                                    onClick={handlePrintAll}
                                    className="!bg-[#0052a3]"
                                >
                                    In toàn bộ hồ sơ biểu mẫu
                                </Button>
                            </Tooltip>
                        </Space>
                    </div>
                }
                placement="right"
                size={1040}
                open={open}
                onClose={onClose}
                destroyOnHidden
            >
                {/* Dossier Header Info */}
                <div
                    style={{
                        padding: '12px 16px',
                        background: '#F8FAFC',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        marginBottom: 16,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        fontSize: 13,
                    }}
                >
                    <div>
                        <span style={{ color: 'var(--muted)' }}>Sinh viên thực hiện:</span>{' '}
                        <strong>{studentName}</strong> {studentCode && `(${studentCode})`}
                    </div>
                    <div>
                        <span style={{ color: 'var(--muted)' }}>Cán bộ hướng dẫn:</span>{' '}
                        <strong>{mentorName}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--muted)' }}>Trạng thái học vụ:</span>{' '}
                        {(() => {
                            const statusConfig = getStatusTagConfig(registration?.status);
                            return <Tag color={statusConfig.color}>{statusConfig.label}</Tag>;
                        })()}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs
                    activeKey={activeTabKey}
                    onChange={setActiveTabKey}
                    items={tabItems}
                />
            </Drawer>

            {/* Print Modal */}
            <AcademicFormPrintModal
                open={printModalConfig.open}
                onClose={() => setPrintModalConfig((prev) => ({ ...prev, open: false }))}
                onCancel={() => setPrintModalConfig((prev) => ({ ...prev, open: false }))}
                title={printModalConfig.title}
                documentCode={printModalConfig.documentCode}
            >
                {printModalConfig.mode === 'single' ? (
                    <>
                        {printModalConfig.documentCode === 'BM02' && (
                            <BM02PrintSheet
                                submission={bm02Submission}
                                verification={bm02Verification}
                                registration={registration}
                            />
                        )}
                        {printModalConfig.documentCode === 'BM02-A' && (
                            <BM02APrintSheet request={latestBm02a || {}} registration={registration} />
                        )}
                        {printModalConfig.documentCode === 'BM03' && (
                            <BM03PrintSheet
                                meetingLogs={meetingLogs}
                                checkpoints={checkpoints}
                                registration={registration}
                                bm03Record={bm03Record}
                            />
                        )}
                        {printModalConfig.documentCode === 'BM04' && (
                            <BM04PrintSheet evaluation={bm04Record || {}} registration={registration} />
                        )}
                        {printModalConfig.documentCode === 'BM05' && (
                            <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                        )}
                    </>
                ) : (
                    <div className="all-academic-forms-bundle">
                        {printEligibility.BM02.eligible && (
                            <BM02PrintSheet
                                submission={bm02Submission}
                                verification={bm02Verification}
                                registration={registration}
                            />
                        )}
                        {printEligibility['BM02-A'].eligible && (
                            <BM02APrintSheet request={latestBm02a || {}} registration={registration} />
                        )}
                        {printEligibility.BM03.eligible && (
                            <BM03PrintSheet
                                meetingLogs={meetingLogs}
                                checkpoints={checkpoints}
                                registration={registration}
                                bm03Record={bm03Record}
                            />
                        )}
                        {printEligibility.BM04.eligible && (
                            <BM04PrintSheet evaluation={bm04Record || {}} registration={registration} />
                        )}
                        {printEligibility.BM05.eligible && (
                            <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                        )}
                    </div>
                )}
            </AcademicFormPrintModal>
        </>
    );
}
