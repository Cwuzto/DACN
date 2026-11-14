import React, { useState, useMemo } from 'react';
import { Drawer, Tabs, Button, Tag, Space, Alert, Spin } from 'antd';
import {
    PrinterOutlined,
    FileTextOutlined,
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
import BM01PrintSheet from './BM01PrintSheet';
import BM02PrintSheet from './BM02PrintSheet';
import BM02APrintSheet from './BM02APrintSheet';
import BM03PrintSheet from './BM03PrintSheet';
import BM04PrintSheet from './BM04PrintSheet';
import BM05PrintSheet from './BM05PrintSheet';
import AcademicFormPrintModal from './AcademicFormPrintModal';

export default function AcademicDossierDrawer({
    open,
    onClose,
    registration,
}) {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const regId = registration?.id;

    // Active tab in drawer
    const [activeTabKey, setActiveTabKey] = useState('BM01');

    // Print Modal State
    const [printModalConfig, setPrintModalConfig] = useState({
        open: false,
        title: '',
        documentCode: '',
        mode: 'single', // 'single' or 'all'
    });

    // Queries for dossier data
    const enabled = Boolean(open && regId);
    const tasksQuery = useRegistrationTasks(scope, regId, enabled);
    const meetingLogsQuery = useRegistrationMeetingLogs(scope, regId, enabled);
    const checkpointsQuery = useRegistrationCheckpoints(scope, regId, enabled);
    const bm03Query = useBM03Record(scope, regId, enabled);
    const bm04Query = useBM04Record(scope, regId, enabled);
    const bm02aQuery = useRegistrationBm02aRequests(scope, regId, enabled);
    const outlineQuery = useMyOutline(scope, enabled);

    const tasks = tasksQuery.data || [];
    const meetingLogs = meetingLogsQuery.data || [];
    const checkpoints = checkpointsQuery.data || [];
    const bm03Record = bm03Query.data || null;
    const bm04Record = bm04Query.data || null;
    const bm02aRequests = bm02aQuery.data || [];
    const latestBm02a = bm02aRequests.length > 0 ? bm02aRequests[0] : null;

    // Derived outline content
    const outlineData = outlineQuery.data || (() => {
        const bm01Task = tasks.find(
            (t) => t.taskType === 'BM01' || t.taskType === 'BM01_INITIAL_SUBMISSION' || t.taskType === 'BM01_RESUBMISSION'
        );
        const lastSub = bm01Task?.submissions?.[0];
        if (lastSub?.content) {
            try {
                const parsed = JSON.parse(lastSub.content);
                return parsed.fields || parsed;
            } catch {
                return { summary: lastSub.content };
            }
        }
        return null;
    })();

    const bm02Task = tasks.find((t) => t.taskType === 'BM02') || {
        title: registration?.topic?.title || registration?.customTopicTitle,
    };

    // Derived summary record for BM05
    const summaryRecord = useMemo(() => {
        if (!registration) return null;
        return {
            topicTitle: registration.topic?.title || registration.customTopicTitle,
            studentName: registration.student?.fullName,
            studentCode: registration.student?.code,
            mentorName: registration.mentor?.fullName || registration.topic?.mentor?.fullName,
            councilName: registration.council?.name || registration.defenseCouncil?.name,
            defenseDate: registration.council?.defenseDate || registration.defenseCouncil?.defenseDate,
            location: registration.council?.location || registration.defenseCouncil?.location,
            finalScore: registration.finalScore ?? registration.roundedFinalScore,
            status: registration.status,
            memberScores: registration.memberScores || [],
        };
    }, [registration]);

    const formNames = {
        BM01: 'BM01 · Đề cương nghiên cứu chi tiết',
        BM02: 'BM02 · Giao nhiệm vụ khóa luận',
        'BM02-A': 'BM02-A · Điều chỉnh tên đề tài',
        BM03: 'BM03 · Sổ theo dõi tiến độ & hướng dẫn',
        BM04: 'BM04 · Phiếu nhận xét của người hướng dẫn',
        BM05: 'BM05 · Biên bản tổng hợp chấm bảo vệ',
    };

    const handlePrintCurrent = () => {
        setPrintModalConfig({
            open: true,
            title: formNames[activeTabKey] || `Biểu mẫu ${activeTabKey}`,
            documentCode: activeTabKey,
            mode: 'single',
        });
    };

    const handlePrintAll = () => {
        setPrintModalConfig({
            open: true,
            title: 'TOÀN BỘ HỒ SƠ HỌC VỤ KHÓA LUẬN TỐT NGHIỆP',
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
                    <BM01PrintSheet outline={outlineData} registration={registration} />
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
                    <BM02PrintSheet task={bm02Task} registration={registration} />
                </div>
            ),
        },
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
                    <BM02APrintSheet adjustment={latestBm02a} registration={registration} />
                </div>
            ),
        },
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
                    <BM04PrintSheet evaluation={bm04Record} registration={registration} />
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
                    <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                </div>
            ),
        },
    ];

    const studentName = registration?.student?.fullName || 'Sinh viên';
    const studentCode = registration?.student?.code || '';
    const topicTitle = registration?.topic?.title || registration?.customTopicTitle || 'Khóa luận tốt nghiệp';
    const topicCode = registration?.topic?.code || `DT-${registration?.id?.slice(0, 8) || '2026'}`;
    const mentorName = registration?.mentor?.fullName || registration?.topic?.mentor?.fullName || 'Chưa gán';

    return (
        <>
            <Drawer
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 24 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F766E' }}>
                                HỒ SƠ BIỂU MẪU HỌC VỤ TOÀN TRÌNH (BM01 - BM05)
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                {topicCode} · {topicTitle}
                            </div>
                        </div>
                        <Space>
                            <Button icon={<PrinterOutlined />} onClick={handlePrintCurrent}>
                                In biểu mẫu này
                            </Button>
                            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintAll} className="!bg-[#0052a3]">
                                In toàn bộ hồ sơ
                            </Button>
                        </Space>
                    </div>
                }
                placement="right"
                width={1040}
                open={open}
                onClose={onClose}
                destroyOnClose
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
                        <Tag color="cyan">{registration?.status || 'ĐANG THỰC HIỆN'}</Tag>
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
                onCancel={() => setPrintModalConfig((prev) => ({ ...prev, open: false }))}
                title={printModalConfig.title}
                documentCode={printModalConfig.documentCode}
            >
                {printModalConfig.mode === 'single' ? (
                    <>
                        {printModalConfig.documentCode === 'BM01' && (
                            <BM01PrintSheet outline={outlineData} registration={registration} />
                        )}
                        {printModalConfig.documentCode === 'BM02' && (
                            <BM02PrintSheet task={bm02Task} registration={registration} />
                        )}
                        {printModalConfig.documentCode === 'BM02-A' && (
                            <BM02APrintSheet adjustment={latestBm02a} registration={registration} />
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
                            <BM04PrintSheet evaluation={bm04Record} registration={registration} />
                        )}
                        {printModalConfig.documentCode === 'BM05' && (
                            <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                        )}
                    </>
                ) : (
                    <div className="all-academic-forms-bundle">
                        <BM01PrintSheet outline={outlineData} registration={registration} />
                        <BM02PrintSheet task={bm02Task} registration={registration} />
                        <BM02APrintSheet adjustment={latestBm02a} registration={registration} />
                        <BM03PrintSheet
                            meetingLogs={meetingLogs}
                            checkpoints={checkpoints}
                            registration={registration}
                            bm03Record={bm03Record}
                        />
                        <BM04PrintSheet evaluation={bm04Record} registration={registration} />
                        <BM05PrintSheet summaryRecord={summaryRecord} registration={registration} />
                    </div>
                )}
            </AcademicFormPrintModal>
        </>
    );
}
