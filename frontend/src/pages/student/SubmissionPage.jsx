import { useState, useEffect, useMemo } from 'react';
import {
    Alert,
    Button,
    Empty,
    Input,
    Modal,
    Radio,
    Tag,
    message,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FileDoneOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
    GithubOutlined,
    LinkOutlined,
    LockOutlined,
    ReloadOutlined,
    AuditOutlined,
    CalendarOutlined,
    CloudUploadOutlined,
    RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';
import evaluationService from '../../services/evaluationService';
import archiveService from '../../services/archiveService';
import meetingLogService from '../../services/meetingLogService';
import outlineService from '../../services/outlineService';
import aiService from '../../services/aiService';
import HybridBMFormModal from '../../components/forms/HybridBMFormModal';
import BMSubmissionViewer from '../../components/forms/BMSubmissionViewer';
import BM01CopilotDrawer from '../../components/student/BM01CopilotDrawer';
import CheckpointSignModal from '../../components/student/CheckpointSignModal';
import TitleAdjustmentModal from '../../components/student/TitleAdjustmentModal';
import ArchiveSubmissionModal from '../../components/forms/ArchiveSubmissionModal';
import useAuthStore from '../../stores/authStore';

const formatTaskTitle = (title) => {
    if (!title) return '';
    return title
        .replace(/BM01_INITIAL_SUBMISSION\b/g, 'Đề cương nghiên cứu chi tiết (v1)')
        .replace(/BM01_RESUBMISSION\b/g, 'Nộp lại đề cương nghiên cứu (v2)')
        .replace(/BM01\b/g, 'Đề cương nghiên cứu chi tiết')
        .replace(/BM02\b/g, 'Đơn đăng ký đề tài chính thức')
        .replace(/BM03\b/g, 'Nhật ký & Đánh giá tiến độ')
        .replace(/BM04\b/g, 'Phiếu nhận xét của người hướng dẫn');
};

export default function SubmissionPage() {
    const [registration, setRegistration] = useState(null);
    const [outlineData, setOutlineData] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [meetingLogs, setMeetingLogs] = useState([]);
    const [, setLoading] = useState(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTask, setActiveTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [titleAdjustmentOpen, setTitleAdjustmentOpen] = useState(false);

    // Viewer state
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerSubmission, setViewerSubmission] = useState(null);
    const [bm04ViewerOpen, setBm04ViewerOpen] = useState(false);
    const [bm04Evaluation, setBm04Evaluation] = useState(null);
    const [bm03Record, setBm03Record] = useState(null);
    const [bm04Record, setBm04Record] = useState(null);

    // BM03 48h Student Acknowledgement state
    const [bm03AckModalOpen, setBm03AckModalOpen] = useState(false);
    const [bm03AckAction, setBm03AckAction] = useState('ACKNOWLEDGED');
    const [bm03AckComment, setBm03AckComment] = useState('');
    const [ackSubmitting, setAckSubmitting] = useState(false);

    // Pre-defense archive state
    const [preDefenseArchive, setPreDefenseArchive] = useState(null);
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const [preDefenseSubmitting, setPreDefenseSubmitting] = useState(false);
    const [reportFileUrl, setReportFileUrl] = useState('');
    const [reportFileName, setReportFileName] = useState('');
    const [slideFileUrl, setSlideFileUrl] = useState('');
    const [slideFileName, setSlideFileName] = useState('');
    const [sourceCodeUrl, setSourceCodeUrl] = useState('');
    const [notes, setNotes] = useState('');

    // Checkpoint state
    const [checkpoints, setCheckpoints] = useState([]);
    const [checkpointSignModalOpen, setCheckpointSignModalOpen] = useState(false);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
    const currentUser = useAuthStore((s) => s.user);

    // BM01 Copilot AI state
    const [copilotOpen, setCopilotOpen] = useState(false);
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [copilotData, setCopilotData] = useState(null);

    const handleOpenCopilot = async (task) => {
        setCopilotOpen(true);
        setCopilotLoading(true);
        try {
            let draftContent = {};
            const lastSub = task?.submissions?.[0];
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

    const handleViewBM04 = async () => {
        try {
            const res = await evaluationService.getBM04Record(registration.id);
            if (res.success) {
                setBm04Evaluation(res.data);
                setBm04Record(res.data);
                setBm04ViewerOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Phiếu nhận xét.');
        }
    };

    const handleStudentAckBM03 = async (actionToSubmit) => {
        const action = actionToSubmit || bm03AckAction;
        if (action === 'DECLINED_TO_ACKNOWLEDGE' && !bm03AckComment.trim()) {
            message.warning('Bắt buộc nhập lý do khi từ chối ký xác nhận.');
            return;
        }
        if (!bm03Record?.id) return;
        try {
            setAckSubmitting(true);
            const res = await evaluationService.studentAcknowledgeBM03(bm03Record.id, {
                action,
                comment: bm03AckComment.trim() || undefined,
            });
            if (res.success) {
                message.success('Đã gửi phản hồi xác nhận BM03 thành công!');
                setBm03AckModalOpen(false);
                setBm03AckComment('');
                fetchData();
            } else {
                message.error(res.message || 'Không thể gửi phản hồi.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gửi phản hồi.');
        } finally {
            setAckSubmitting(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const regRes = await registrationService.getMyRegistration();
            if (regRes.success && regRes.data) {
                const regData = regRes.data;
                setRegistration(regData);

                const [taskRes, logRes, cpRes, archiveRes, outlineRes, bm03Res, bm04Res] = await Promise.all([
                    taskService.getTasksByRegistration(regData.id).catch(() => ({ success: false, data: [] })),
                    meetingLogService.getMeetingLogs(regData.id).catch(() => ({ success: false, data: [] })),
                    evaluationService.getCheckpointEvaluations(regData.id).catch(() => ({ success: false, data: [] })),
                    archiveService.getArchiveByRegistration(regData.id).catch(() => ({ success: false })),
                    outlineService.getMyOutline().catch(() => ({ success: false, data: null })),
                    evaluationService.getBM03Record(regData.id).catch(() => ({ success: false, data: null })),
                    evaluationService.getBM04Record(regData.id).catch(() => ({ success: false, data: null })),
                ]);

                if (taskRes.success) setTasks(taskRes.data || []);
                if (logRes.success) setMeetingLogs(logRes.data || []);
                if (cpRes.success) setCheckpoints(cpRes.data || []);
                if (outlineRes?.success && outlineRes.data) setOutlineData(outlineRes.data);
                if (bm03Res?.success && bm03Res.data) setBm03Record(bm03Res.data);
                if (bm04Res?.success && bm04Res.data) {
                    setBm04Record(bm04Res.data);
                    setBm04Evaluation(bm04Res.data);
                }

                if (archiveRes?.success && archiveRes.data) {
                    const arch = archiveRes.data.archive || archiveRes.data;
                    setPreDefenseArchive(arch);
                    if (arch) {
                        setReportFileUrl(arch.reportFileUrl || '');
                        setReportFileName(arch.reportFileName || '');
                        setSlideFileUrl(arch.slideFileUrl || '');
                        setSlideFileName(arch.slideFileName || '');
                        setSourceCodeUrl(arch.sourceCodeUrl || '');
                        setNotes(arch.summary || arch.notes || '');
                    }
                }
            } else {
                setRegistration(null);
                setTasks([]);
                setMeetingLogs([]);
                setCheckpoints([]);
                setPreDefenseArchive(null);
                setBm03Record(null);
                setBm04Record(null);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu nộp biểu mẫu.');
        } finally {
            setLoading(false);
        }
    };

    const taskByType = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            map[t.taskType] = t;
        });
        return map;
    }, [tasks]);

    const isStepLocked = (taskType) => {
        if (!registration) return true;
        if (['TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM01', 'TERMINATED_BM02', 'DROPPED', 'WITHDRAWN'].includes(registration.status)) {
            return true;
        }
        if (taskType === 'BM01' || taskType === 'BM01_INITIAL_SUBMISSION') {
            if (registration.status === 'APPROVED') return false;
            if (registration.status === 'BM01_NEEDS_REVISION') {
                const hasResub = tasks.some((t) => t.taskType === 'BM01_RESUBMISSION');
                return hasResub;
            }
            return true;
        }
        if (taskType === 'BM01_RESUBMISSION') {
            return registration.status !== 'BM01_NEEDS_REVISION';
        }
        if (taskType === 'BM02') {
            return !['BM01_PASSED', 'BM02_NEEDS_REVISION'].includes(registration.status);
        }
        if (taskType === 'BM03_CHECKPOINT_1' || taskType === 'BM03_CHECKPOINT') {
            return !['DECISION_ISSUED', 'IN_PROGRESS_BM03', 'BM03_PASSED', 'DEFENSE_READY', 'DEFENDED', 'COMPLETED'].includes(registration.status);
        }
        if (taskType === 'BM03_CHECKPOINT_2') {
            const cp1 = taskByType.BM03_CHECKPOINT_1 || taskByType.BM03_CHECKPOINT;
            return !cp1 || cp1.status !== 'COMPLETED';
        }
        if (taskType === 'REPORT_DRAFT') {
            const cp2 = taskByType.BM03_CHECKPOINT_2;
            return !cp2 || cp2.status !== 'COMPLETED';
        }
        return false;
    };

    const handleOpenSubmitModal = (task) => {
        if (isStepLocked(task.taskType)) {
            message.warning('Vui lòng hoàn thành và chờ duyệt bước trước đó.');
            return;
        }
        setActiveTask(task);
        setModalVisible(true);
    };

    const handleOpenViewer = (submission) => {
        setViewerSubmission(submission);
        setViewerVisible(true);
    };

    const handleSubmitForm = async (payload) => {
        if (!activeTask) return;
        try {
            setSubmitting(true);
            let res;
            if (activeTask.taskType === 'BM01' || activeTask.taskType === 'BM01_INITIAL_SUBMISSION') {
                if (registration.status === 'BM01_NEEDS_REVISION') {
                    res = await outlineService.submitResubmission({
                        registrationId: registration.id,
                        fileData: {
                            fileUrl: payload.fileUrl,
                            fileName: payload.fileName || 'De_cuong_chinh_sua_v2.pdf',
                        },
                    });
                } else {
                    res = await outlineService.submitInitialOutline({
                        registrationId: registration.id,
                        fileData: {
                            fileUrl: payload.fileUrl,
                            fileName: payload.fileName || 'De_cuong_chi_tiet_v1.pdf',
                        },
                    });
                }
            } else if (activeTask.taskType === 'BM01_RESUBMISSION') {
                res = await outlineService.submitResubmission({
                    registrationId: registration.id,
                    fileData: {
                        fileUrl: payload.fileUrl,
                        fileName: payload.fileName || 'De_cuong_chinh_sua_v2.pdf',
                    },
                });
            } else if (activeTask.taskType === 'BM02') {
                res = await registrationService.submitBM02({ registrationId: registration.id, ...payload });
            } else {
                res = await taskService.submitTask(activeTask.id, payload);
            }
            if (res.success) {
                message.success('Nộp biểu mẫu thành công!');
                setModalVisible(false);
                fetchData();
            } else {
                message.error(res.message || 'Không thể nộp biểu mẫu.');
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

    const handleSubmitPreDefense = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!reportFileUrl && !slideFileUrl && !sourceCodeUrl) {
            message.warning('Vui lòng cung cấp ít nhất link bản thảo báo cáo, slide thuyết trình hoặc link mã nguồn.');
            return;
        }
        try {
            setPreDefenseSubmitting(true);
            const payload = {
                reportFileUrl: reportFileUrl.trim() || null,
                reportFileName: reportFileName.trim() || (reportFileUrl ? 'Bản thảo báo cáo khóa luận' : null),
                slideFileUrl: slideFileUrl.trim() || null,
                slideFileName: slideFileName.trim() || (slideFileUrl ? 'Slide thuyết trình bảo vệ' : null),
                sourceCodeUrl: sourceCodeUrl.trim() || null,
                notes: notes.trim() || null,
            };
            const res = await archiveService.submitPreDefenseArchive(registration.id, payload);
            if (res.success) {
                message.success('Nộp tài liệu sơ bộ trước bảo vệ thành công! GVHD đã có thể đánh giá và ký duyệt Phiếu nhận xét.');
                fetchData();
            } else {
                message.error(res.message || 'Không thể nộp tài liệu lưu chiểu sơ bộ.');
            }
        } catch (error) {
            message.error(error?.message || 'Đã xảy ra lỗi khi nộp tài liệu trước bảo vệ.');
        } finally {
            setPreDefenseSubmitting(false);
        }
    };

    const studentTasks = useMemo(() => {
        let list = tasks.filter((t) => t.taskType !== 'BM04');
        if (outlineData?.tasks && Array.isArray(outlineData.tasks)) {
            outlineData.tasks.forEach((ot) => {
                if (!list.some((t) => t.id === ot.id || t.taskType === ot.taskType)) {
                    list.push(ot);
                }
            });
        }
        return list;
    }, [tasks, outlineData]);

    const outlineCouncil = outlineData?.outlineCouncil || registration?.outlineCouncil;
    const latestBm01Eval = (outlineData?.bm01Evaluations || registration?.bm01Evaluations || [])[0];
    const bm02Current = registration?.currentBM02Submission;
    const bm02RevisionNotice = registration?.status === 'BM02_NEEDS_REVISION'
        ? {
            title: 'Đơn đăng ký đề tài chính thức cần chỉnh sửa',
            version: `Phiên bản ${bm02Current?.versionNo || 1} · Lần nộp lại 1/1`,
            deadline: bm02Current?.revisionDeadlineAt,
            issues: Array.isArray(bm02Current?.issues) ? bm02Current.issues : [],
        }
        : null;

    if (!registration) {
        return (
            <div style={{ padding: '24px 32px' }} className="sub-view">
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <Empty description="Bạn chưa đăng ký hoặc chưa được duyệt đề tài đồ án nào trong học kỳ này." />
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-submissions" className="sub-view">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="h1" style={{ fontSize: 20 }}>Quy Trình Giao Nộp Biểu Mẫu &amp; Báo Cáo Tiến Độ</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                        Tất cả biểu mẫu phải được GVHD ký duyệt điện tử và lưu trữ số trên hệ thống DACN.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData}>
                        <ReloadOutlined style={{ marginRight: 4 }} />
                        <span>Làm mới</span>
                    </button>
                    {studentTasks.some((t) => !isStepLocked(t.taskType) && ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(t.status)) && (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                                const nextTask = studentTasks.find((t) => !isStepLocked(t.taskType) && ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(t.status));
                                if (nextTask) handleOpenSubmitModal(nextTask);
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span>Nộp báo cáo tiếp theo</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Terminated alert if BM01 failed */}
            {registration.status === 'TERMINATED_BM01' && (
                <Alert
                    type="error"
                    showIcon
                    banner
                    message={<span style={{ fontWeight: 700, fontSize: 14 }}>Đề tài đã dừng thực hiện trong đợt này</span>}
                    description="Đề cương đồ án không đạt yêu cầu xét duyệt của Hội đồng hoặc quá hạn nộp lại đề cương v2 theo quy định học vụ của Viện."
                    style={{ marginBottom: 20, borderRadius: 8 }}
                />
            )}

            {/* BM03 Student 48-Hour Acknowledgement Banner */}
            {bm03Record?.advisorSignedAt && bm03Record?.studentAckStatus === 'PENDING_STUDENT_ACKNOWLEDGEMENT' && (
                <Alert
                    type="warning"
                    showIcon
                    message={<span style={{ fontWeight: 700, fontSize: 14 }}>Xác nhận đã biết Phiếu theo dõi tiến độ BM03 (Thời hạn 48 giờ)</span>}
                    description={
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1.5">
                            <div>
                                Giảng viên hướng dẫn đã hoàn tất và ký xác nhận toàn phiếu BM03. Vui lòng phản hồi xác nhận đã biết trong thời hạn quy định (Hạn chót: {bm03Record.studentAckDeadlineAt ? dayjs(bm03Record.studentAckDeadlineAt).format('DD/MM/YYYY HH:mm') : '48 giờ'}).
                            </div>
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                onClick={() => setBm03AckModalOpen(true)}
                            >
                                Phản hồi phiếu BM03
                            </Button>
                        </div>
                    }
                    style={{ marginBottom: 20, borderRadius: 8 }}
                />
            )}

            {/* Outline Council Defense Information Banner */}
            {outlineCouncil && (
                <div
                    className="card"
                    style={{
                        marginBottom: 20,
                        padding: '16px 20px',
                        borderLeft: '6px solid var(--primary)',
                        background: '#F0FDFA',
                        borderColor: '#99F6E4',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F766E', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>🏛️ Phiên Bảo Vệ &amp; Xét Duyệt Đề Cương: {outlineCouncil.name}</span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13, color: '#115E59', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                {outlineCouncil.defenseDate && (
                                    <span>
                                        ⏰ Thời gian bảo vệ: <strong>{dayjs(outlineCouncil.defenseDate).format('DD/MM/YYYY HH:mm')}</strong>
                                    </span>
                                )}
                                <span>
                                    Hình thức: <strong>{outlineCouncil.meetingMode === 'MICROSOFT_TEAMS' ? 'Microsoft Teams' : 'Trực tiếp'}</strong>
                                    {outlineCouncil.meetingMode === 'IN_PERSON' && outlineCouncil.location && (
                                        <span> — Địa điểm: <strong>{outlineCouncil.location}</strong></span>
                                    )}
                                </span>
                                {outlineCouncil.revisionSubmissionDeadline && (
                                    <span>
                                        Hạn nộp bản sửa: <strong>{dayjs(outlineCouncil.revisionSubmissionDeadline).format('DD/MM/YYYY HH:mm')}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {outlineCouncil.meetingMode === 'MICROSOFT_TEAMS' && outlineCouncil.meetingUrl && (
                                <a
                                    href={outlineCouncil.meetingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.5 7h-6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h6.5a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5zM3 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                                    </svg>
                                    <span>Tham gia Teams</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* BM01 Submitted State Banner */}
            {registration.status === 'BM01_SUBMITTED' && (
                <div
                    className="card"
                    style={{
                        marginBottom: 20,
                        padding: '14px 18px',
                        borderColor: '#93C5FD',
                        background: '#EFF6FF',
                        borderLeft: '6px solid #3B82F6',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span className="tag blue" style={{ fontWeight: 700 }}>
                            Đã nộp đề cương v1 (Đang chờ Hội đồng xét duyệt)
                        </span>
                        <span style={{ fontSize: 13, color: '#1E40AF' }}>
                            Bản nộp đầu tiên là bản chính thức và đã được ghi nhận. Cổng nộp đề cương v1 đã được khóa để Hội đồng tiến hành xét duyệt.
                        </span>
                    </div>
                </div>
            )}

            {/* BM01 Needs Revision Feedback Panel */}
            {registration.status === 'BM01_NEEDS_REVISION' && (
                <div
                    className="card"
                    style={{
                        marginBottom: 20,
                        padding: '16px 20px',
                        borderColor: '#F59E0B',
                        background: '#FFFBEB',
                        borderLeft: '6px solid #D97706',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ maxWidth: 840 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#92400E' }}>
                                    ⚠️ ĐỀ CƯƠNG CẦN CHỈNH SỬA &amp; NỘP LẠI (V2)
                                </span>
                                <span className="tag orange" style={{ fontWeight: 700 }}>
                                    Kết quả ban đầu: {
                                        latestBm01Eval?.initialOutcome === 'FAIL' ? 'Không đạt' :
                                        latestBm01Eval?.initialOutcome === 'ABSENT' ? 'Vắng mặt' :
                                        'Yêu cầu chỉnh sửa'
                                    }
                                </span>
                            </div>

                            {latestBm01Eval?.comment && (
                                <div style={{ marginTop: 8, fontSize: 13, color: '#78350F' }}>
                                    <strong>Ý kiến nhận xét của Hội đồng:</strong> {latestBm01Eval.comment}
                                </div>
                            )}

                            {latestBm01Eval?.revisionRequirements && (
                                <div style={{ marginTop: 6, fontSize: 13, color: '#78350F' }}>
                                    <strong>Yêu cầu chỉnh sửa cụ thể:</strong>
                                    <div style={{ background: '#FEF3C7', padding: '8px 12px', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-line' }}>
                                        {latestBm01Eval.revisionRequirements}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 8, fontSize: 13, color: '#B45309', fontWeight: 600 }}>
                                Hạn nộp lại của Hội đồng: {
                                    outlineCouncil?.revisionSubmissionDeadline
                                        ? dayjs(outlineCouncil.revisionSubmissionDeadline).format('DD/MM/YYYY HH:mm')
                                        : (latestBm01Eval?.deadlineAt ? dayjs(latestBm01Eval.deadlineAt).format('DD/MM/YYYY HH:mm') : 'Theo thông báo của Hội đồng')
                                }
                                {outlineData?.isOverdue && <span style={{ color: '#DC2626', marginLeft: 8 }}>(Đã quá hạn nộp lại)</span>}
                            </div>

                            <div style={{ marginTop: 6, fontSize: 12, color: '#92400E' }}>
                                <em>* Cảnh báo: Sinh viên chỉ được nộp lại duy nhất 01 lần (v2). Bản nộp lại là căn cứ duy nhất để Chủ tịch Hội đồng phê duyệt ĐẠT hoặc DỪNG ĐỀ TÀI.</em>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Button
                                icon={<RobotOutlined />}
                                onClick={() => {
                                    const resubTask = tasks.find((t) => t.taskType === 'BM01_RESUBMISSION') ||
                                        tasks.find((t) => t.taskType === 'BM01' || t.taskType === 'BM01_INITIAL_SUBMISSION') ||
                                        { id: 'bm01-resubmit', taskType: 'BM01_RESUBMISSION', title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01)' };
                                    handleOpenCopilot(resubTask);
                                }}
                                className="border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100"
                            >
                                AI Hướng dẫn hoàn thiện
                            </Button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    const resubTask = tasks.find((t) => t.taskType === 'BM01_RESUBMISSION') ||
                                        tasks.find((t) => t.taskType === 'BM01' || t.taskType === 'BM01_INITIAL_SUBMISSION') ||
                                        { id: 'bm01-resubmit', taskType: 'BM01_RESUBMISSION', title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01)' };
                                    handleOpenSubmitModal(resubTask);
                                }}
                            >
                                <UploadOutlined style={{ marginRight: 6 }} />
                                <span>Nộp lại đề cương v2 (Duy nhất 1 lần)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BM01 Resubmitted State Banner */}
            {registration.status === 'BM01_RESUBMITTED' && (
                <div
                    className="card"
                    style={{
                        marginBottom: 20,
                        padding: '14px 18px',
                        borderColor: '#A5F3FC',
                        background: '#ECFEFF',
                        borderLeft: '6px solid #06B6D4',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span className="tag cyan" style={{ fontWeight: 700 }}>
                            Đã nộp bản chỉnh sửa (Đang chờ Chủ tịch Hội đồng phê duyệt)
                        </span>
                        <span style={{ fontSize: 13, color: '#0E7490' }}>
                            Đề cương hiệu chỉnh (v2) đã được ghi nhận thành công. Nút nộp đã được khóa và hệ thống đang chờ Chủ tịch Hội đồng ra kết luận cuối cùng.
                        </span>
                    </div>
                </div>
            )}

            {bm02RevisionNotice && (
                <div className="card" style={{ marginBottom: 18, padding: '14px 16px', borderColor: '#F59E0B', background: '#FFFBEB' }}>
                    <div style={{ fontWeight: 700, color: '#92400E' }}>{bm02RevisionNotice.title}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: '#78350F' }}>
                        {bm02RevisionNotice.version}
                        {bm02RevisionNotice.deadline && ` · Hạn nộp: ${dayjs(bm02RevisionNotice.deadline).format('DD/MM/YYYY HH:mm')}`}
                    </div>
                    {bm02RevisionNotice.issues.length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#78350F' }}>
                            {bm02RevisionNotice.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
                        </ul>
                    )}
                </div>
            )}

            {/* Decision Published Banner */}
            {(registration?.decisionPublishedAt || registration?.status === 'DECISION_ISSUED') && (
                <div
                    className="card"
                    style={{
                        marginBottom: 18,
                        padding: '14px 18px',
                        borderColor: '#7C3AED',
                        background: '#F5F3FF',
                        borderLeftWidth: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 700, color: '#5B21B6', fontSize: 14 }}>
                            Quyết định giao đề tài tốt nghiệp chính thức
                        </div>
                        <div style={{ marginTop: 2, fontSize: 13, color: '#6D28D9' }}>
                            Số: <strong>{registration?.decisionNumber || '—'}</strong>
                            {registration?.decisionPublishedAt && (
                                <span> · Công bố lúc: {dayjs(registration.decisionPublishedAt).format('DD/MM/YYYY HH:mm')}</span>
                            )}
                            <span> · Cửa sổ nộp phiếu điều chỉnh tên BM02-A (168 giờ)</span>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        icon={<AuditOutlined />}
                        className="!bg-purple-600 hover:!bg-purple-700"
                        onClick={() => setTitleAdjustmentOpen(true)}
                    >
                        Đề nghị điều chỉnh tên đề tài (BM02-A)
                    </Button>
                </div>
            )}

            {/* Checkpoint Urgent Notification Banner */}
            {(() => {
                const pendingCp = checkpoints.find((cp) => !cp.studentSignature);
                if (!pendingCp) return null;

                const isAppeal = ['CHECKPOINT_SIGNATURE_APPEAL_OPEN', 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED', 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW'].includes(registration?.status);
                const isPendingSign = registration?.status === 'BM03_SIGNATURE_PENDING' || (!isAppeal && !pendingCp.studentSignature);

                if (!isAppeal && !isPendingSign) return null;

                const deadlineText = pendingCp.studentSignDeadlineAt
                    ? dayjs(pendingCp.studentSignDeadlineAt).format('DD/MM/YYYY HH:mm')
                    : '3 ngày kể từ khi GVHD phát hành';

                return (
                    <div
                        className="card"
                        style={{
                            marginBottom: 20,
                            padding: '16px 20px',
                            background: isAppeal ? '#FEF2F2' : '#EFF6FF',
                            borderColor: isAppeal ? '#F87171' : '#60A5FA',
                            borderLeftWidth: 6,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: isAppeal ? '#991B1B' : '#1E40AF' }}>
                                    {isAppeal ? '⚠️ CẢNH BÁO: QUÁ HẠN KÝ BIÊN BẢN TIẾN ĐỘ - ĐANG MỞ CỬA SỔ KHIẾU NẠI' : '📝 YÊU CẦU KÝ XÁC NHẬN BIÊN BẢN ĐÁNH GIÁ TIẾN ĐỘ'}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4, color: isAppeal ? '#7F1D1D' : '#1E3A8A' }}>
                                    {isAppeal ? (
                                        <span>
                                            Bạn đã quá hạn ký biên bản Checkpoint {pendingCp.checkpointNo}. Hệ thống đang mở cửa sổ khiếu nại (3 ngày).
                                            Vui lòng nộp đơn giải trình kèm minh chứng lý do khách quan để Ban chủ nhiệm xét duyệt!
                                        </span>
                                    ) : (
                                        <span>
                                            GVHD đã ký phát hành biên bản <strong>Đánh giá tiến độ đợt {pendingCp.checkpointNo}</strong>.
                                            Hạn chót ký điện tử: <strong>{deadlineText}</strong>. Quá hạn 3 ngày hệ thống sẽ tự động khóa và chuyển sang quy trình khiếu nại.
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`btn ${isAppeal ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => {
                                    setSelectedCheckpoint(pendingCp);
                                    setCheckpointSignModalOpen(true);
                                }}
                            >
                                {isAppeal ? 'Nộp Đơn Khiếu Nại Ký Biên Bản' : 'Xem & Ký Biên Bản Tiến Độ Ngay'}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Pre-Defense Archival Submission Section (Guard for BM04) */}
            {['BM03_PASSED', 'DEFENSE_READY', 'DEFENDED', 'COMPLETED'].includes(registration?.status) && (
                <div
                    className="card"
                    style={{
                        marginBottom: 24,
                        padding: '20px 24px',
                        background: '#F0FDF4',
                        borderColor: '#86EFAC',
                        borderLeftWidth: 6,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FolderOpenOutlined />
                                <span>HỒ SƠ LƯU CHIỂU SƠ BỘ TRƯỚC BẢO VỆ</span>
                                {preDefenseArchive?.status === 'SUBMITTED' ? (
                                    <Tag color="green">ĐÃ NỘP HỒ SƠ SƠ BỘ</Tag>
                                ) : (
                                    <Tag color="gold">CẦN NỘP TRƯỚC KHI KÝ PHIẾU NHẬN XÉT</Tag>
                                )}
                            </div>
                            <div style={{ fontSize: 13, marginTop: 6, color: '#15803D' }}>
                                <strong>Quy định bắt buộc:</strong> Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt Phiếu nhận xét cho phép bảo vệ.
                            </div>
                        </div>
                        {preDefenseArchive?.submittedAt && (
                            <div style={{ fontSize: 12, color: '#166534' }}>
                                Thời gian nộp: <b>{dayjs(preDefenseArchive.submittedAt).format('DD/MM/YYYY HH:mm')}</b>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 16, background: '#FFFFFF', padding: 16, borderRadius: 8, border: '1px solid #BBF7D0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                    1. Bản thảo báo cáo khóa luận (URL / Cloud file):
                                </label>
                                <Input
                                    placeholder="https://drive.google.com/... hoặc link PDF báo cáo"
                                    value={reportFileUrl}
                                    onChange={(e) => setReportFileUrl(e.target.value)}
                                    disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                />
                                <div style={{ marginTop: 6 }}>
                                    <Input
                                        placeholder="Tên tệp (VD: Bao_cao_khoa_luan_draft.pdf)"
                                        value={reportFileName}
                                        onChange={(e) => setReportFileName(e.target.value)}
                                        size="small"
                                        disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                    2. Slide thuyết trình bảo vệ (URL):
                                </label>
                                <Input
                                    placeholder="https://canva.com/... hoặc link Slide PDF / PPT"
                                    value={slideFileUrl}
                                    onChange={(e) => setSlideFileUrl(e.target.value)}
                                    disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                />
                                <div style={{ marginTop: 6 }}>
                                    <Input
                                        placeholder="Tên tệp slide (VD: Slide_thuyet_trinh_bao_ve.pptx)"
                                        value={slideFileName}
                                        onChange={(e) => setSlideFileName(e.target.value)}
                                        size="small"
                                        disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                    3. Kho lưu trữ mã nguồn (Git Repository URL):
                                </label>
                                <Input
                                    placeholder="https://github.com/username/repository"
                                    value={sourceCodeUrl}
                                    onChange={(e) => setSourceCodeUrl(e.target.value)}
                                    disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                    4. Ghi chú tóm tắt gửi GVHD:
                                </label>
                                <Input.TextArea
                                    rows={2}
                                    placeholder="Ghi chú về tiến độ hoàn thiện, link demo, hoặc hướng dẫn chạy sản phẩm..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={registration?.status !== 'BM03_PASSED' && preDefenseArchive?.status === 'SUBMITTED'}
                                />
                            </div>
                        </div>

                        {registration?.status === 'BM03_PASSED' && (
                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <Button
                                    type="primary"
                                    loading={preDefenseSubmitting}
                                    onClick={handleSubmitPreDefense}
                                >
                                    {preDefenseArchive?.status === 'SUBMITTED' ? 'Cập Nhật Hồ Sơ Sơ Bộ' : 'Nộp Hồ Sơ Sơ Bộ Trước Bảo Vệ'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Defense Schedule & Shift Card */}
            {(registration?.council || registration?.defenseCouncil || registration?.defenseShift) && (
                <div
                    className="card"
                    style={{
                        marginBottom: 24,
                        padding: '18px 24px',
                        background: '#EFF6FF',
                        borderColor: '#93C5FD',
                        borderLeftWidth: 6,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CalendarOutlined />
                                <span>LỊCH & ĐỊA ĐIỂM BẢO VỆ ĐỒ ÁN TỐT NGHIỆP</span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 4, color: '#1E3A8A' }}>
                                Hội đồng: <strong>{registration?.council?.name || registration?.defenseCouncil?.name || 'Hội đồng Bảo vệ'}</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Tag color={registration?.defenseShift === 'MORNING' ? 'orange' : 'blue'} style={{ fontSize: 13, padding: '4px 10px', fontWeight: 700 }}>
                                {registration?.defenseShift === 'MORNING' ? 'Ca Sáng (07:00 – 11:00)' : (registration?.defenseShift === 'AFTERNOON' ? 'Ca Chiều (13:00 – 17:00)' : 'Chưa xếp ca')}
                            </Tag>
                            {registration?.defenseOrder && (
                                <Tag color="purple" style={{ fontSize: 13, padding: '4px 10px', fontWeight: 700 }}>
                                    Số thứ tự trong ca: #{registration.defenseOrder}
                                </Tag>
                            )}
                        </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #DBEAFE', fontSize: 12.5 }}>
                        <div>
                            <span style={{ color: 'var(--muted)' }}>Ngày bảo vệ: </span>
                            <strong>
                                {registration?.council?.defenseDate
                                    ? dayjs(registration.council.defenseDate).format('DD/MM/YYYY')
                                    : (registration?.defenseCouncil?.defenseDate ? dayjs(registration.defenseCouncil.defenseDate).format('DD/MM/YYYY') : 'Chờ công bố')}
                            </strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--muted)' }}>Địa điểm / Phòng họp: </span>
                            <strong>{registration?.council?.location || registration?.defenseCouncil?.location || 'Phòng chuyên đề Viện VCS'}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Post-Defense 4-Slot Digital Archive Dossier Section */}
            {['DEFENSE_PASSED', 'DEFENDED', 'COMPLETED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'PENDING_INSTITUTE_SIGNATURE'].includes(registration?.status) && (
                <div
                    className="card"
                    style={{
                        marginBottom: 24,
                        padding: '20px 24px',
                        background: '#FAF5FF',
                        borderColor: '#D8B4FE',
                        borderLeftWidth: 6,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#6B21A8', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FolderOpenOutlined />
                                <span>HỒ SƠ LƯU CHIỂU SỐ SAU BẢO VỆ (4 TÀI LIỆU CHÍNH THỨC)</span>
                                <Tag color={preDefenseArchive?.status === 'COMPLETED' ? 'green' : 'purple'}>
                                    {preDefenseArchive?.status === 'COMPLETED' ? 'ĐÃ NGHIỆM THU LƯU CHIỂU' : 'CẦN HOÀN THIỆN LƯU CHIỂU'}
                                </Tag>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 6, color: '#581C87' }}>
                                Quy chế: Nộp đủ 4 file gồm Báo cáo Word (<code>REPORT_WORD</code>), Báo cáo PDF (<code>REPORT_PDF</code>), Video demo (<code>DEMO_VIDEO</code>) và Slide PPTX (<code>SLIDE_PPTX</code>). Biểu mẫu BM03 và BM04 được hệ thống tự động liên kết trích xuất từ dữ liệu ký số của GVHD.
                            </div>
                        </div>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={() => setArchiveModalOpen(true)}
                        >
                            Quản lý hồ sơ lưu chiểu 4 tài liệu
                        </Button>
                    </div>

                    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E9D5FF' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7E22CE' }}>1. Báo cáo Word (REPORT_WORD)</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                {preDefenseArchive?.dossierFiles?.find(f => f.docType === 'REPORT_WORD') ? 'Đã tải lên' : 'Chưa có tệp'}
                            </div>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E9D5FF' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7E22CE' }}>2. Báo cáo PDF (REPORT_PDF)</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                {preDefenseArchive?.dossierFiles?.find(f => f.docType === 'REPORT_PDF') ? 'Đã tải lên' : 'Chưa có tệp'}
                            </div>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E9D5FF' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7E22CE' }}>3. Video demo (DEMO_VIDEO)</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                {preDefenseArchive?.dossierFiles?.find(f => f.docType === 'DEMO_VIDEO') ? 'Đã tải lên' : 'Chưa có tệp'}
                            </div>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E9D5FF' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7E22CE' }}>4. Slide PPTX (SLIDE_PPTX)</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                {preDefenseArchive?.dossierFiles?.find(f => f.docType === 'SLIDE_PPTX') ? 'Đã tải lên' : 'Chưa có tệp'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Submission Roadmap */}
            <div className="submission-roadmap">
                {studentTasks.map((task, idx) => {
                    const locked = isStepLocked(task.taskType);
                    const isCompleted = task.status === 'COMPLETED';
                    const submissions = task.submissions || [];
                    const lastSubmission = submissions.length > 0 ? submissions[0] : null;
                    const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'COMPLETED';

                    const isBM01Initial = task.taskType === 'BM01' || task.taskType === 'BM01_INITIAL_SUBMISSION';
                    const isBM01Resub = task.taskType === 'BM01_RESUBMISSION';

                    let canSubmit = !locked && ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(task.status);
                    if (isBM01Initial) {
                        if (registration.status === 'APPROVED') {
                            canSubmit = true;
                        } else if (['BM01_SUBMITTED', 'BM01_RESUBMITTED', 'BM01_PASSED', 'TERMINATED_BM01'].includes(registration.status)) {
                            canSubmit = false;
                        }
                    }
                    if (isBM01Resub) {
                        if (registration.status === 'BM01_NEEDS_REVISION') {
                            canSubmit = true;
                        } else {
                            canSubmit = false;
                        }
                    }

                    const isCurrent = !locked && !isCompleted && canSubmit;

                    return (
                        <div
                            key={task.id}
                            className={`sub-card ${isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}`}
                            style={{ opacity: locked ? 0.65 : 1 }}
                        >
                            <div className="sub-left">
                                <div className="sub-step-num">{idx + 1}</div>
                                <div className="sub-info">
                                    <h4>{formatTaskTitle(task.title)}</h4>
                                    <p>{task.description || 'Thực hiện và nộp biểu mẫu theo đúng biểu mẫu chuẩn của Viện.'}</p>
                                    <div className="sub-meta-pill">
                                        {isBM01Initial && registration.status === 'BM01_SUBMITTED' ? (
                                            <span className="tag blue">Đã nộp đề cương v1 (Đang chờ Hội đồng xét duyệt)</span>
                                        ) : (isBM01Initial || isBM01Resub) && registration.status === 'BM01_RESUBMITTED' ? (
                                            <span className="tag cyan">Đã nộp bản chỉnh sửa (Đang chờ Chủ tịch Hội đồng phê duyệt)</span>
                                        ) : (isBM01Initial || isBM01Resub) && registration.status === 'TERMINATED_BM01' ? (
                                            <span className="tag red">Đã dừng thực hiện</span>
                                        ) : (isBM01Initial || isBM01Resub) && ['BM01_PASSED', 'BM02_SUBMITTED', 'DECISION_ISSUED', 'IN_PROGRESS_BM03', 'BM03_PASSED', 'DEFENSE_READY', 'DEFENDED', 'COMPLETED'].includes(registration.status) ? (
                                            <span className="tag green">ĐÃ DUYỆT ĐẠT</span>
                                        ) : isBM01Resub && registration.status === 'BM01_NEEDS_REVISION' ? (
                                            <span className="tag red">CẦN NỘP LẠI (V2 DUY NHẤT)</span>
                                        ) : isBM01Initial && registration.status === 'APPROVED' ? (
                                            <span className="tag teal">ĐANG MỞ NỘP (V1)</span>
                                        ) : isCompleted ? (
                                            <span className="tag green">ĐÃ DUYỆT ĐẠT</span>
                                        ) : task.status === 'REVISION' ? (
                                            <span className="tag red">YÊU CẦU CHỈNH SỬA</span>
                                        ) : task.status === 'SUBMITTED' ? (
                                            <span className="tag yellow">CHỜ GVHD PHÊ DUYỆT</span>
                                        ) : locked ? (
                                            <span className="tag gray">ĐANG KHÓA (CHỜ BƯỚC TRƯỚC)</span>
                                        ) : isOverdue ? (
                                            <span className="tag red">CẦN NỘP BÁO CÁO (QUÁ HẠN)</span>
                                        ) : (
                                            <span className="tag teal">ĐANG MỞ NỘP</span>
                                        )}
                                        {task.dueDate && (
                                            <span style={{ color: isOverdue ? '#DC2626' : 'var(--muted)' }}>
                                                · Hạn chót: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                                            </span>
                                        )}
                                        {lastSubmission?.feedback && (
                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                · Nhận xét GVHD: "{lastSubmission.feedback}"
                                            </span>
                                        )}
                                    </div>
                                    {isBM01Initial && registration.status === 'APPROVED' && (
                                        <div style={{ fontSize: 12, color: '#D97706', marginTop: 4 }}>
                                            ⚠️ Bản nộp đầu tiên là bản chính thức và không thể thay thế.
                                        </div>
                                    )}
                                    {isBM01Resub && registration.status === 'BM01_NEEDS_REVISION' && (
                                        <div style={{ fontSize: 12, color: '#D97706', marginTop: 4 }}>
                                            ⚠️ Sinh viên chỉ được nộp lại đúng 01 lần duy nhất.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {(isBM01Initial || isBM01Resub) && (
                                    <Button
                                        size="small"
                                        icon={<RobotOutlined />}
                                        onClick={() => handleOpenCopilot(task)}
                                        className="text-teal-700 border-teal-400 hover:border-teal-600"
                                    >
                                        AI Chấm đề cương
                                    </Button>
                                )}
                                {lastSubmission && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleOpenViewer(lastSubmission)}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                        <span>Xem bài nộp</span>
                                    </button>
                                )}
                                {canSubmit && (
                                    isBM01Initial && registration.status === 'APPROVED' ? (
                                        <Tooltip title="Bản nộp đầu tiên là bản chính thức và không thể thay thế">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleOpenSubmitModal(task)}
                                            >
                                                <UploadOutlined style={{ marginRight: 4 }} />
                                                <span>Nộp đề cương v1</span>
                                            </button>
                                        </Tooltip>
                                    ) : isBM01Resub || (isBM01Initial && registration.status === 'BM01_NEEDS_REVISION') ? (
                                        <Tooltip title="Chỉ được nộp lại đúng 01 lần duy nhất">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleOpenSubmitModal(task)}
                                            >
                                                <UploadOutlined style={{ marginRight: 4 }} />
                                                <span>Nộp lại đề cương v2</span>
                                            </button>
                                        </Tooltip>
                                    ) : (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleOpenSubmitModal(task)}
                                        >
                                            <UploadOutlined style={{ marginRight: 4 }} />
                                            <span>{task.status === 'REVISION' ? 'Nộp lại bài' : 'Nộp bài ngay'}</span>
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* BM04 Informational Card */}
                <div className="sub-card pending" style={{ background: '#F8FAFC' }}>
                    <div className="sub-left">
                        <div className="sub-step-num" style={{ background: '#CCFBF1', color: '#0F766E' }}>★</div>
                        <div className="sub-info">
                            <h4>Phiếu Nhận Xét &amp; Thẩm Định Khóa Luận Của Người Hướng Dẫn</h4>
                            <p>
                                Giảng viên hướng dẫn tổng hợp các mốc Checkpoint, đánh giá thái độ chuyên cần và ký quyết định ĐỒNG Ý / KHÔNG ĐỒNG Ý cho sinh viên ra Hội đồng bảo vệ.
                            </p>
                            <div className="sub-meta-pill">
                                {registration.status === 'DEFENSE_READY' ? (
                                    <span className="tag green">GVHD ĐÃ ĐỒNG Ý CHO BẢO VỆ</span>
                                ) : (
                                    <span className="tag teal">TỰ ĐỘNG CẬP NHẬT TỪ GVHD</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['DEFENSE_READY', 'TERMINATED_BM04', 'DEFENDED', 'COMPLETED', 'BM04_REVIEW'].includes(registration.status) && (
                            <Button icon={<FileDoneOutlined />} onClick={handleViewBM04}>Xem Phiếu nhận xét đã ký</Button>
                        )}
                        {(bm04Record?.finalPdfFileUrl || bm04Evaluation?.finalPdfFileUrl) && (
                            <Button
                                type="primary"
                                icon={<FilePdfOutlined />}
                                href={bm04Record?.finalPdfFileUrl || bm04Evaluation?.finalPdfFileUrl}
                                target="_blank"
                            >
                                Tải PDF BM04 đã ký
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Meeting Logs Section */}
            {meetingLogs.length > 0 && (
                <div className="card" style={{ marginTop: 24, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                        <h3 className="h3 m-0">Nhật Ký Làm Việc &amp; Trao Đổi Lab Với GVHD ({meetingLogs.length})</h3>
                        {bm03Record?.finalPdfFileUrl && (
                            <Button
                                icon={<FilePdfOutlined />}
                                href={bm03Record.finalPdfFileUrl}
                                target="_blank"
                            >
                                Tải PDF BM03 đã ký
                            </Button>
                        )}
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Buổi số</th>
                                    <th>Thời gian</th>
                                    <th>Hình thức / Địa điểm</th>
                                    <th>Nội dung trao đổi</th>
                                    <th>Kết quả &amp; Kế hoạch tuần tới</th>
                                    <th>Đánh giá của GVHD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {meetingLogs.map((log, idx) => (
                                    <tr key={log.id || idx}>
                                        <td className="num" style={{ fontWeight: 700, color: 'var(--primary)' }}>#{idx + 1}</td>
                                        <td>{dayjs(log.meetingDate).format('DD/MM/YYYY')}</td>
                                        <td>
                                            <span className="tag teal">{log.locationOrLink || log.location || 'Văn phòng Lab'}</span>
                                        </td>
                                        <td style={{ maxWidth: 260 }}>{log.discussionContent || log.content || 'Sinh viên báo cáo kết quả và thảo luận giải pháp.'}</td>
                                        <td style={{ maxWidth: 260 }}>{log.nextTasks || log.nextPlan || 'Tiếp tục triển khai theo kế hoạch'}</td>
                                        <td>
                                            <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                                {log.progressRating === 'ON_TRACK' ? 'Đúng tiến độ' :
                                                 log.progressRating === 'AT_RISK' ? 'Có rủi ro' :
                                                 log.progressRating === 'BEHIND' ? 'Chậm tiến độ' :
                                                 log.progressRating === 'NO_PROGRESS' ? 'Không có tiến độ' :
                                                 (log.mentorNote || 'Đạt tiến độ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Xác Nhận BM03 48 Giờ */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-semibold">
                        <FileDoneOutlined className="text-teal-600" />
                        <span>Xác Nhận Đã Biết Phiếu Theo Dõi Tiến Độ (BM03)</span>
                    </div>
                }
                open={bm03AckModalOpen}
                onCancel={() => setBm03AckModalOpen(false)}
                footer={null}
                width={640}
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Thời hạn phản hồi: 48 giờ"
                        description={`Biểu mẫu BM03 đã được GVHD hoàn tất và ký số lúc ${bm03Record?.advisorSignedAt ? dayjs(bm03Record.advisorSignedAt).format('DD/MM/YYYY HH:mm') : '---'}. Sinh viên đọc kỹ nội dung và chọn 1 trong 3 hình thức phản hồi dưới đây.`}
                    />

                    {bm03Record?.finalPdfFileUrl && (
                        <div>
                            <Button
                                type="link"
                                icon={<FilePdfOutlined />}
                                href={bm03Record.finalPdfFileUrl}
                                target="_blank"
                                className="p-0 text-teal-700"
                            >
                                Tải PDF BM03 để kiểm tra trước khi xác nhận
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="font-semibold block text-slate-800">Lựa chọn phản hồi của sinh viên (*):</label>
                        <Radio.Group
                            value={bm03AckAction}
                            onChange={(e) => setBm03AckAction(e.target.value)}
                            className="w-full space-y-2"
                        >
                            <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex items-start gap-2.5">
                                <Radio value="ACKNOWLEDGED" />
                                <div>
                                    <div className="font-bold text-slate-800">Ký xác nhận đã biết</div>
                                    <div className="text-xs text-slate-500">Đồng thuận và xác nhận đã biết đầy đủ kết quả theo dõi tiến độ BM03 của GVHD.</div>
                                </div>
                            </div>
                            <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex items-start gap-2.5">
                                <Radio value="ACKNOWLEDGED_WITH_COMMENT" />
                                <div>
                                    <div className="font-bold text-slate-800">Xác nhận kèm ý kiến</div>
                                    <div className="text-xs text-slate-500">Xác nhận đã biết và gửi thêm ý kiến phản hồi tới GVHD và Viện.</div>
                                </div>
                            </div>
                            <div className="p-3 border rounded-lg hover:bg-rose-50 border-rose-200 cursor-pointer flex items-start gap-2.5">
                                <Radio value="DECLINED_TO_ACKNOWLEDGE" />
                                <div>
                                    <div className="font-bold text-rose-700">Từ chối ký</div>
                                    <div className="text-xs text-rose-600">Từ chối ký xác nhận (bắt buộc nhập lý do cụ thể để Viện xem xét).</div>
                                </div>
                            </div>
                        </Radio.Group>
                    </div>

                    {(bm03AckAction === 'ACKNOWLEDGED_WITH_COMMENT' || bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE') && (
                        <div className="space-y-1">
                            <label className="font-semibold block text-slate-800">
                                {bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE' ? 'Lý do từ chối ký (* bắt buộc):' : 'Ý kiến phản hồi bổ sung:'}
                            </label>
                            <Input.TextArea
                                rows={3}
                                value={bm03AckComment}
                                onChange={(e) => setBm03AckComment(e.target.value)}
                                placeholder={bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE' ? 'Nêu rõ lý do từ chối ký xác nhận...' : 'Nhập ý kiến của bạn...'}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button onClick={() => setBm03AckModalOpen(false)}>
                            Đóng
                        </Button>
                        {bm03AckAction === 'ACKNOWLEDGED' && (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('ACKNOWLEDGED')}
                            >
                                Ký xác nhận đã biết
                            </Button>
                        )}
                        {bm03AckAction === 'ACKNOWLEDGED_WITH_COMMENT' && (
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('ACKNOWLEDGED_WITH_COMMENT')}
                            >
                                Xác nhận kèm ý kiến
                            </Button>
                        )}
                        {bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE' && (
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('DECLINED_TO_ACKNOWLEDGE')}
                            >
                                Từ chối ký
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Hybrid BM Form Modal */}
            <HybridBMFormModal
                open={modalVisible}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleSubmitForm}
                task={activeTask}
                registration={registration}
                loading={submitting}
                submitting={submitting}
            />

            {/* Title Adjustment BM02-A Modal */}
            <TitleAdjustmentModal
                open={titleAdjustmentOpen}
                onClose={() => setTitleAdjustmentOpen(false)}
                registration={registration}
                registrationId={registration?.id}
                currentTitle={registration?.adjustedTitle || registration?.topic?.title}
                decisionDate={registration?.decisionDate}
                decisionPublishedAt={registration?.decisionPublishedAt}
                onSuccess={fetchData}
            />

            {/* Submission Viewer Modal */}
            <BMSubmissionViewer
                open={viewerVisible}
                onClose={() => setViewerVisible(false)}
                submission={viewerSubmission}
            />

            <Modal
                title="Phiếu Nhận Xét Của Người Hướng Dẫn Đã Ký"
                open={bm04ViewerOpen}
                onCancel={() => setBm04ViewerOpen(false)}
                footer={<Button onClick={() => setBm04ViewerOpen(false)}>Đóng</Button>}
                width={720}
            >
                {bm04Evaluation && (
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div><strong>GVHD:</strong> {bm04Evaluation.lecturer?.fullName || '-'}</div>
                        <div><strong>1. Hình thức:</strong> {bm04Evaluation.thesisFormatScore}</div>
                        <div><strong>2. Nội dung nghiên cứu:</strong> {bm04Evaluation.researchContentScore}</div>
                        <div><strong>3. Tính ứng dụng:</strong> {bm04Evaluation.applicabilityScore}</div>
                        <div><strong>4. Thái độ:</strong> {bm04Evaluation.attitudeScore}</div>
                        <div>
                            <strong>Kết luận:</strong>{' '}
                            {bm04Evaluation.conclusion === 'AGREED_FOR_DEFENSE' ? 'Đồng ý cho bảo vệ' : 'Không đồng ý cho bảo vệ'}
                        </div>
                        <div><strong>Chữ ký:</strong> {bm04Evaluation.lecturerSignature}</div>
                        <div><strong>Ngày ký:</strong> {bm04Evaluation.signedAt ? dayjs(bm04Evaluation.signedAt).format('DD/MM/YYYY HH:mm') : '-'}</div>
                    </div>
                )}
            </Modal>

            {/* Checkpoint Sign / Appeal Modal */}
            {checkpointSignModalOpen && selectedCheckpoint && (
                <CheckpointSignModal
                    open={checkpointSignModalOpen}
                    onClose={() => setCheckpointSignModalOpen(false)}
                    checkpointEvaluation={selectedCheckpoint}
                    currentStudentName={currentUser?.fullName || currentUser?.name || ''}
                    onSuccess={() => {
                        setCheckpointSignModalOpen(false);
                        fetchData();
                    }}
                />
            )}

            {/* Post-Defense Archive Submission Modal */}
            <ArchiveSubmissionModal
                open={archiveModalOpen}
                onClose={() => setArchiveModalOpen(false)}
                registration={registration}
                registrationId={registration?.id}
                initialData={preDefenseArchive}
                onSuccess={fetchData}
            />

            {/* BM01 Copilot Drawer */}
            <BM01CopilotDrawer
                open={copilotOpen}
                onClose={() => setCopilotOpen(false)}
                data={copilotData}
                loading={copilotLoading}
            />
        </div>
    );
}
