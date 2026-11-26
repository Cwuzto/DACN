import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tooltip, Modal, Alert, message, Tag } from 'antd';
import {
    UploadOutlined,
    PrinterOutlined,
    RobotOutlined,
    EyeOutlined,
    FilePdfOutlined,
    CloseOutlined,
    AuditOutlined,
    InfoCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import outlineService from '../../../services/outlineService';
import registrationService from '../../../services/registrationService';
import taskService from '../../../services/taskService';
import aiService from '../../../services/aiService';
import HybridBMFormModal from '../../forms/HybridBMFormModal';
import BMSubmissionViewer from '../../forms/BMSubmissionViewer';
import BM01CopilotDrawer from '../BM01CopilotDrawer';
import TitleAdjustmentModal from '../TitleAdjustmentModal';
import AcademicFormPrintModal from '../../prints/AcademicFormPrintModal';
import BM01PrintSheet from '../../prints/BM01PrintSheet';
import BM02PrintSheet from '../../prints/BM02PrintSheet';
import { queryKeys } from '../../../query/queryKeys';
import { dashboardKeys } from '../../../queries/dashboardQueries';
import useAuthStore from '../../../stores/authStore';

export default function StudentSubmissionActions({ item, registration, sources = {}, onCompleted }) {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const scope = queryKeys.scope(currentUser);

    // Unpack sources
    const tasks = sources.tasks || [];
    const outlineData = sources.outlineData || null;

    // Resolve kind
    const kind = item?.kind || item?.taskType || '';

    // Modal & Drawer states
    const [submitModalOpen, setSubmitModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerSubmission, setViewerSubmission] = useState(null);
    const [viewerSubmissions, setViewerSubmissions] = useState([]);
    const [copilotOpen, setCopilotOpen] = useState(false);
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [copilotData, setCopilotData] = useState(null);
    const [titleAdjustmentOpen, setTitleAdjustmentOpen] = useState(false);

    // Print state
    const [printConfig, setPrintConfig] = useState({
        open: false,
        type: null,
        title: '',
        documentCode: '',
    });
    const [bm02VerificationData, setBm02VerificationData] = useState(null);

    // Determine relevant task and submissions
    const bm01Task = useMemo(() => {
        return (
            tasks.find((t) => t.taskType === 'BM01' || t.taskType === 'BM01_INITIAL_SUBMISSION') ||
            item?.task ||
            null
        );
    }, [tasks, item]);

    const bm01ResubTask = useMemo(() => {
        return tasks.find((t) => t.taskType === 'BM01_RESUBMISSION') || null;
    }, [tasks]);

    const bm02Task = useMemo(() => {
        return tasks.find((t) => t.taskType === 'BM02') || item?.task || null;
    }, [tasks, item]);

    // Submissions
    const activeBm01Submission = useMemo(() => {
        if (outlineData?.submissions?.length) return outlineData.submissions[0];
        if (bm01ResubTask?.submissions?.length) return bm01ResubTask.submissions[0];
        if (bm01Task?.submissions?.length) return bm01Task.submissions[0];
        return null;
    }, [outlineData, bm01ResubTask, bm01Task]);

    const activeBm02Submission = useMemo(() => {
        return registration?.currentBM02Submission || bm02Task?.submissions?.[0] || null;
    }, [registration, bm02Task]);

    // 7-day decision window for BM02-A
    const publishedAt = registration?.decisionPublishedAt || registration?.decisionDate;
    const adjustmentDeadline = useMemo(() => {
        if (!publishedAt) return null;
        return dayjs(publishedAt).add(168, 'hour');
    }, [publishedAt]);
    const isAdjustmentExpired = adjustmentDeadline ? dayjs().isAfter(adjustmentDeadline) : false;

    // Helper: trigger refetch / invalidate
    const handleSuccessCallback = () => {
        if (queryClient) {
            queryClient.invalidateQueries({ queryKey: dashboardKeys.studentDashboard(scope) });
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.current(scope) });
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) });
            queryClient.invalidateQueries({ queryKey: ['workItems'] });
            queryClient.invalidateQueries({ queryKey: ['outline'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['bm02a'] });
        }
        if (typeof onCompleted === 'function') {
            onCompleted();
        }
    };

    // Form submission handler
    const handleSubmitForm = async (payload) => {
        if (!registration?.id) return;
        try {
            setSubmitting(true);
            let res;
            const buildBm01FileData = (defaultFileName) => ({
                assetId: payload.assetId || null,
                fileUrl: payload.fileUrl || null,
                fileName: payload.fileName || defaultFileName,
                mimeType: payload.mimeType || 'application/pdf',
                ...(payload.fileSize != null ? { fileSize: payload.fileSize } : {}),
            });

            const isBM01ResubmissionKind =
                kind === 'BM01_RESUBMISSION' ||
                kind === 'RESUBMIT_BM01' ||
                kind === 'BM01_REVISION' ||
                registration.status === 'BM01_NEEDS_REVISION';

            const isBM01Kind =
                kind.startsWith('BM01') ||
                kind === 'SUBMIT_BM01' ||
                kind === 'RESUBMIT_BM01';

            const isBM02Kind =
                kind.startsWith('BM02') ||
                kind === 'SUBMIT_BM02';

            if (isBM01Kind) {
                if (isBM01ResubmissionKind) {
                    res = await outlineService.submitResubmission({
                        registrationId: registration.id,
                        fileData: buildBm01FileData('De_cuong_chinh_sua_v2.pdf'),
                        content: payload.content,
                    });
                } else {
                    res = await outlineService.submitInitialOutline({
                        registrationId: registration.id,
                        fileData: buildBm01FileData('De_cuong_chi_tiet_v1.pdf'),
                        content: payload.content,
                    });
                }
            } else if (isBM02Kind) {
                res = await registrationService.submitBM02({
                    registrationId: registration.id,
                    ...payload,
                });
            } else if (item?.task?.id) {
                res = await taskService.submitTask(item.task.id, payload);
            }

            if (res?.success) {
                message.success('Nộp biểu mẫu thành công!');
                setSubmitModalOpen(false);
                handleSuccessCallback();
            } else {
                message.error(res?.message || 'Không thể nộp biểu mẫu.');
            }
        } catch (error) {
            const errStr = error?.error || error?.message || '';
            if (errStr.includes('INITIAL_SUBMISSION_ALREADY_USED')) {
                message.error('Bạn đã nộp đề cương v1 trước đó. Hệ thống chỉ cho phép nộp một lần duy nhất.');
            } else if (errStr.includes('RESUBMISSION_ALREADY_USED')) {
                message.error('Bạn đã nộp lại đề cương v2 trước đó. Hệ thống không cho phép nộp lại lần thứ hai.');
            } else {
                message.error(error?.message || 'Có lỗi xảy ra khi nộp bài.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // AI Copilot trigger
    const handleOpenCopilot = async (targetTask) => {
        setCopilotOpen(true);
        setCopilotLoading(true);
        try {
            let draftContent = {};
            const lastSub = targetTask?.submissions?.[0] || activeBm01Submission;
            if (lastSub?.content) {
                try {
                    const parsed = JSON.parse(lastSub.content);
                    if (parsed && typeof parsed === 'object') {
                        draftContent = parsed.fields || parsed;
                    }
                } catch {
                    draftContent = { summary: lastSub.content };
                }
            }

            const payload = {
                registrationId: registration?.id || null,
                outlineContent: {
                    topicTitle: draftContent.topicTitle || registration?.topic?.title || registration?.customTopicTitle || '',
                    objectives: draftContent.objectives || registration?.topic?.description || '',
                    technologies: draftContent.technologies || '',
                    deliverables: draftContent.deliverables || '',
                    revisionSummary: draftContent.revisionSummary || '',
                },
            };

            const res = await aiService.analyzeBM01(payload);
            if (res?.success) {
                setCopilotData(res.data);
            } else {
                message.error(res?.message || 'Không thể đánh giá đề cương với AI');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gọi AI đánh giá đề cương');
        } finally {
            setCopilotLoading(false);
        }
    };

    // Viewer trigger
    const handleOpenViewer = (sub, allSubs = []) => {
        setViewerSubmission(sub);
        setViewerSubmissions(Array.isArray(allSubs) && allSubs.length > 0 ? allSubs : (sub ? [sub] : []));
        setViewerOpen(true);
    };

    // Print trigger - fetches BM02 verification on click if needed
    const handleOpenPrint = async (type) => {
        if (type === 'BM01') {
            setPrintConfig({
                open: true,
                type: 'BM01',
                title: 'ĐỀ CƯƠNG CHI TIẾT KHÓA LUẬN TỐT NGHIỆP',
                documentCode: 'BM01',
            });
        } else if (type === 'BM02') {
            if (activeBm02Submission?.id) {
                try {
                    const res = await registrationService.getBM02Verification(activeBm02Submission.id);
                    setBm02VerificationData(res?.data ?? res ?? null);
                } catch {
                    setBm02VerificationData(null);
                }
            }
            setPrintConfig({
                open: true,
                type: 'BM02',
                title: 'NHIỆM VỤ KHÓA LUẬN TỐT NGHIỆP',
                documentCode: 'BM02',
            });
        }
    };

    // Determine kinds
    const isBM01Initial =
        kind === 'BM01_INITIAL' ||
        kind === 'SUBMIT_BM01' ||
        kind === 'BM01' ||
        kind === 'BM01_INITIAL_SUBMISSION';

    const isBM01Resub =
        kind === 'BM01_RESUBMISSION' ||
        kind === 'RESUBMIT_BM01' ||
        kind === 'BM01_REVISION' ||
        (kind.startsWith('BM01') && registration?.status === 'BM01_NEEDS_REVISION');

    const isBM02 =
        kind === 'BM02' ||
        kind === 'SUBMIT_BM02' ||
        kind === 'BM02_SUBMISSION' ||
        kind === 'BM02_REVISION';

    const isBM02A =
        kind === 'BM02_A' ||
        kind === 'BM02A' ||
        kind === 'TITLE_ADJUSTMENT' ||
        kind === 'REQUEST_TITLE_ADJUSTMENT' ||
        kind === 'DECISION_ISSUED';

    // BM01 Council review details for resubmission
    const latestBm01Eval = (outlineData?.bm01Evaluations || registration?.bm01Evaluations || [])[0];
    const outlineCouncil = outlineData?.outlineCouncil || registration?.outlineCouncil;

    // BM02 Revision details
    const bm02Current = registration?.currentBM02Submission;
    const bm02RevisionNotice = registration?.status === 'BM02_NEEDS_REVISION'
        ? {
            title: 'Đơn đăng ký đề tài chính thức cần chỉnh sửa',
            version: `Phiên bản ${bm02Current?.versionNo || 1} · Lần nộp lại 1/1`,
            deadline: bm02Current?.revisionDeadlineAt,
            issues: Array.isArray(bm02Current?.issues) ? bm02Current.issues : [],
        }
        : null;

    // Resolve printable BM01 data
    const resolvedOutlineData = useMemo(() => {
        if (outlineData) return outlineData;
        if (activeBm01Submission?.content) {
            try {
                const parsed = JSON.parse(activeBm01Submission.content);
                return parsed.fields || parsed;
            } catch {
                return { summary: activeBm01Submission.content };
            }
        }
        return null;
    }, [outlineData, activeBm01Submission]);

    // Active task to pass to HybridBMFormModal
    const activeFormTask = useMemo(() => {
        if (isBM01Resub) {
            return (
                bm01ResubTask || {
                    id: 'bm01-resubmission',
                    taskType: 'BM01_RESUBMISSION',
                    title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01)',
                }
            );
        }
        if (isBM01Initial) {
            return (
                bm01Task || {
                    id: 'bm01-initial',
                    taskType: 'BM01_INITIAL_SUBMISSION',
                    title: 'Đề cương nghiên cứu chi tiết (v1)',
                }
            );
        }
        if (isBM02) {
            return (
                bm02Task || {
                    id: 'bm02-task',
                    taskType: 'BM02',
                    title: 'Đơn đăng ký đề tài chính thức (BM02)',
                }
            );
        }
        return item?.task || null;
    }, [isBM01Resub, isBM01Initial, isBM02, bm01ResubTask, bm01Task, bm02Task, item]);

    return (
        <div className="student-submission-actions space-y-3">
            {/* Contextual Notices */}
            {isBM01Initial && registration?.status === 'APPROVED' && (
                <div className="text-xs text-amber-700 font-medium">
                    Bản nộp đầu tiên là bản chính thức và không thể thay thế.
                </div>
            )}

            {isBM01Resub && registration?.status === 'BM01_NEEDS_REVISION' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-1.5">
                    <div className="font-semibold text-amber-800">
                        Đề cương cần chỉnh sửa và nộp lại (v2 duy nhất)
                    </div>
                    {latestBm01Eval?.comment && (
                        <div>
                            <strong>Ý kiến Hội đồng:</strong> {latestBm01Eval.comment}
                        </div>
                    )}
                    {latestBm01Eval?.revisionRequirements && (
                        <div className="bg-amber-100/70 p-2 rounded text-xs whitespace-pre-line">
                            <strong>Yêu cầu chỉnh sửa:</strong> {latestBm01Eval.revisionRequirements}
                        </div>
                    )}
                    <div className="text-xs text-amber-800 italic">
                        Chỉ được nộp lại đúng 01 lần duy nhất. Bản nộp lại là căn cứ để Chủ tịch Hội đồng phê duyệt ĐẠT hoặc dừng đề tài.
                    </div>
                </div>
            )}

            {isBM02 && bm02RevisionNotice && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-1">
                    <div className="font-semibold text-amber-800">{bm02RevisionNotice.title}</div>
                    <div className="text-xs text-amber-700">
                        {bm02RevisionNotice.version}
                        {bm02RevisionNotice.deadline && ` · Hạn nộp: ${dayjs(bm02RevisionNotice.deadline).format('DD/MM/YYYY HH:mm')}`}
                    </div>
                    {bm02RevisionNotice.issues.length > 0 && (
                        <ul className="list-disc pl-5 text-xs text-amber-800 m-0">
                            {bm02RevisionNotice.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {isBM02A && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-900 space-y-1">
                    <div className="font-semibold text-purple-800">
                        Quyết định giao đề tài: Số {registration?.decisionNumber || '—'}
                    </div>
                    <div className="text-xs text-purple-700">
                        {publishedAt && `Công bố lúc: ${dayjs(publishedAt).format('DD/MM/YYYY HH:mm')} · `}
                        Cửa sổ nộp đơn điều chỉnh tên BM02-A trong vòng 7 ngày (168 giờ).
                        {isAdjustmentExpired ? (
                            <span className="text-rose-600 font-semibold ml-1">(Đã hết thời hạn 7 ngày)</span>
                        ) : adjustmentDeadline ? (
                            <span className="text-emerald-700 font-semibold ml-1">
                                (Hạn chót: {dayjs(adjustmentDeadline).format('DD/MM/YYYY HH:mm')})
                            </span>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* BM01 Actions */}
                {(isBM01Initial || isBM01Resub) && (
                    <>
                        {/* Submit v1 button */}
                        {isBM01Initial && registration?.status === 'APPROVED' && (
                            <Tooltip title="Bản nộp đầu tiên là bản chính thức và không thể thay thế">
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    onClick={() => setSubmitModalOpen(true)}
                                >
                                    Nộp đề cương v1
                                </Button>
                            </Tooltip>
                        )}

                        {/* Submit v2 button */}
                        {isBM01Resub && registration?.status === 'BM01_NEEDS_REVISION' && (
                            <Tooltip title="Chỉ được nộp lại đúng 01 lần duy nhất">
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    onClick={() => setSubmitModalOpen(true)}
                                >
                                    Nộp lại đề cương v2
                                </Button>
                            </Tooltip>
                        )}

                        {/* AI Copilot Button */}
                        <Button
                            icon={<RobotOutlined />}
                            onClick={() => handleOpenCopilot(activeFormTask)}
                        >
                            {isBM01Resub ? 'AI Hướng dẫn hoàn thiện' : 'Đánh giá đề cương với AI'}
                        </Button>

                        {/* Print BM01 Button */}
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={() => handleOpenPrint('BM01')}
                        >
                            In đề cương BM01
                        </Button>

                        {/* View BM01 submission */}
                        {activeBm01Submission && (
                            <Button
                                icon={<EyeOutlined />}
                                onClick={() =>
                                    handleOpenViewer(
                                        activeBm01Submission,
                                        outlineData?.submissions?.length
                                            ? outlineData.submissions
                                            : [activeBm01Submission]
                                    )
                                }
                            >
                                Xem bài nộp
                            </Button>
                        )}

                        {/* PDF download if available */}
                        {activeBm01Submission?.fileUrl && (
                            <Button
                                icon={<FilePdfOutlined />}
                                href={activeBm01Submission.fileUrl}
                                target="_blank"
                            >
                                Tải PDF đề cương
                            </Button>
                        )}
                    </>
                )}

                {/* BM02 Actions */}
                {isBM02 && (
                    <>
                        {['BM01_PASSED', 'BM02_NEEDS_REVISION'].includes(registration?.status) && (
                            <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                onClick={() => setSubmitModalOpen(true)}
                            >
                                {registration?.status === 'BM02_NEEDS_REVISION' ? 'Nộp lại đơn BM02' : 'Nộp đơn BM02'}
                            </Button>
                        )}

                        {activeBm02Submission && (
                            <Button
                                icon={<EyeOutlined />}
                                onClick={() => handleOpenViewer(activeBm02Submission, [activeBm02Submission])}
                            >
                                Xem đơn BM02
                            </Button>
                        )}

                        <Button
                            icon={<PrinterOutlined />}
                            onClick={() => handleOpenPrint('BM02')}
                        >
                            In nhiệm vụ BM02
                        </Button>

                        {activeBm02Submission?.fileUrl && (
                            <Button
                                icon={<FilePdfOutlined />}
                                href={activeBm02Submission.fileUrl}
                                target="_blank"
                            >
                                Tải PDF BM02
                            </Button>
                        )}
                    </>
                )}

                {/* BM02-A Actions */}
                {isBM02A && (
                    <>
                        <Button
                            type="primary"
                            icon={<AuditOutlined />}
                            onClick={() => setTitleAdjustmentOpen(true)}
                        >
                            Đề nghị điều chỉnh tên đề tài (BM02-A)
                        </Button>
                    </>
                )}
            </div>

            {/* Conditionally Mounted Modals: Only mounted when requested to prevent blank render */}
            {submitModalOpen && (
                <HybridBMFormModal
                    open={submitModalOpen}
                    visible={submitModalOpen}
                    onClose={() => setSubmitModalOpen(false)}
                    onSubmit={handleSubmitForm}
                    task={activeFormTask}
                    registration={registration}
                    loading={submitting}
                    submitting={submitting}
                />
            )}

            {viewerOpen && (
                <Modal
                    title={viewerSubmission?.task?.title || 'Chi tiết bài nộp biểu mẫu'}
                    open={viewerOpen}
                    onCancel={() => setViewerOpen(false)}
                    footer={
                        <Button icon={<CloseOutlined />} onClick={() => setViewerOpen(false)}>
                            Đóng
                        </Button>
                    }
                    width={760}
                    destroyOnHidden
                >
                    <BMSubmissionViewer
                        submission={viewerSubmission}
                        submissions={viewerSubmissions}
                    />
                </Modal>
            )}

            {copilotOpen && (
                <BM01CopilotDrawer
                    open={copilotOpen}
                    onClose={() => setCopilotOpen(false)}
                    data={copilotData}
                    loading={copilotLoading}
                />
            )}

            {titleAdjustmentOpen && (
                <TitleAdjustmentModal
                    open={titleAdjustmentOpen}
                    onClose={() => setTitleAdjustmentOpen(false)}
                    registration={registration}
                    registrationId={registration?.id}
                    currentTitle={registration?.adjustedTitle || registration?.topic?.title}
                    decisionDate={registration?.decisionDate}
                    decisionPublishedAt={registration?.decisionPublishedAt}
                    onSuccess={() => {
                        setTitleAdjustmentOpen(false);
                        handleSuccessCallback();
                    }}
                />
            )}

            {printConfig.open && (() => {
                let canPrint = true;
                let printBlockedReason = '';
                if (printConfig.type === 'BM02' && !activeBm02Submission) {
                    canPrint = false;
                    printBlockedReason = 'Chưa có dữ liệu nộp BM02 để in.';
                } else if (printConfig.type === 'BM01' && !resolvedOutlineData && !activeBm01Submission) {
                    canPrint = false;
                    printBlockedReason = 'Chưa có dữ liệu đề cương BM01 để in.';
                }

                return (
                    <AcademicFormPrintModal
                        open={printConfig.open}
                        onClose={() => setPrintConfig((prev) => ({ ...prev, open: false }))}
                        onCancel={() => setPrintConfig((prev) => ({ ...prev, open: false }))}
                        title={printConfig.title}
                        documentCode={printConfig.documentCode}
                        canPrint={canPrint}
                        printBlockedReason={printBlockedReason}
                    >
                        {printConfig.type === 'BM01' && (
                            <BM01PrintSheet
                                outlineData={resolvedOutlineData}
                                outline={outlineData}
                                registration={registration}
                            />
                        )}
                        {printConfig.type === 'BM02' && (
                            <BM02PrintSheet
                                submission={activeBm02Submission}
                                verification={bm02VerificationData || activeBm02Submission?.verification || registration?.bm02Verification || null}
                                registration={registration}
                            />
                        )}
                    </AcademicFormPrintModal>
                );
            })()}
        </div>
    );
}
