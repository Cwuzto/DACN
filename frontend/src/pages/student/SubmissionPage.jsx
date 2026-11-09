import { useState, useEffect, useMemo } from 'react';
import {
    Alert,
    Button,
    Empty,
    Input,
    Modal,
    Tag,
    message,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FolderOpenOutlined,
    GithubOutlined,
    LinkOutlined,
    LockOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';
import evaluationService from '../../services/evaluationService';
import archiveService from '../../services/archiveService';
import meetingLogService from '../../services/meetingLogService';
import HybridBMFormModal from '../../components/forms/HybridBMFormModal';
import BMSubmissionViewer from '../../components/forms/BMSubmissionViewer';
import CheckpointSignModal from '../../components/student/CheckpointSignModal';
import useAuthStore from '../../stores/authStore';

const formatTaskTitle = (title) => {
    if (!title) return '';
    return title
        .replace(/BM01\b/g, 'Đề cương nghiên cứu chi tiết')
        .replace(/BM02\b/g, 'Đơn đăng ký đề tài chính thức')
        .replace(/BM03\b/g, 'Nhật ký & Đánh giá tiến độ')
        .replace(/BM04\b/g, 'Phiếu nhận xét của người hướng dẫn');
};

export default function SubmissionPage() {
    const [registration, setRegistration] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [meetingLogs, setMeetingLogs] = useState([]);
    const [, setLoading] = useState(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTask, setActiveTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Viewer state
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerSubmission, setViewerSubmission] = useState(null);
    const [bm04ViewerOpen, setBm04ViewerOpen] = useState(false);
    const [bm04Evaluation, setBm04Evaluation] = useState(null);

    // Pre-defense archive state
    const [preDefenseArchive, setPreDefenseArchive] = useState(null);
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

    const handleViewBM04 = async () => {
        try {
            const res = await evaluationService.getBM04Evaluation(registration.id);
            if (res.success) {
                setBm04Evaluation(res.data);
                setBm04ViewerOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Phiếu nhận xét.');
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

                const [taskRes, logRes, cpRes, archiveRes] = await Promise.all([
                    taskService.getTasksByRegistration(regData.id).catch(() => ({ success: false, data: [] })),
                    meetingLogService.getMeetingLogs(regData.id).catch(() => ({ success: false, data: [] })),
                    evaluationService.getCheckpointEvaluations(regData.id).catch(() => ({ success: false, data: [] })),
                    archiveService.getArchiveByRegistration(regData.id).catch(() => ({ success: false })),
                ]);

                if (taskRes.success) setTasks(taskRes.data || []);
                if (logRes.success) setMeetingLogs(logRes.data || []);
                if (cpRes.success) setCheckpoints(cpRes.data || []);

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
        if (taskType === 'BM01') {
            return !['REGISTERED', 'APPROVED', 'BM01_NEEDS_REVISION'].includes(registration.status);
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
            if (activeTask.taskType === 'BM01') {
                res = registration.status === 'BM01_NEEDS_REVISION'
                    ? await evaluationService.resubmitBM01(registration.id, payload)
                    : await evaluationService.submitBM01(registration.id, payload);
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
            message.error(error?.message || 'Có lỗi xảy ra khi nộp bài.');
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
        return tasks.filter((t) => t.taskType !== 'BM04');
    }, [tasks]);

    const bm01Revision = registration?.bm01Evaluations?.find((item) => item.outcome === 'NEEDS_REVISION');
    const bm02Current = registration?.currentBM02Submission;
    const revisionNotice = registration?.status === 'BM01_NEEDS_REVISION'
        ? {
            title: 'Đề cương nghiên cứu chi tiết cần chỉnh sửa',
            version: 'Lần nộp lại 1/1',
            deadline: bm01Revision?.deadlineAt,
            issues: bm01Revision?.issues?.feedback ? [bm01Revision.issues.feedback] : [],
        }
        : registration?.status === 'BM02_NEEDS_REVISION'
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

            {revisionNotice && (
                <div className="card" style={{ marginBottom: 18, padding: '14px 16px', borderColor: '#F59E0B', background: '#FFFBEB' }}>
                    <div style={{ fontWeight: 700, color: '#92400E' }}>{revisionNotice.title}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: '#78350F' }}>
                        {revisionNotice.version}
                        {revisionNotice.deadline && ` · Hạn nộp: ${dayjs(revisionNotice.deadline).format('DD/MM/YYYY HH:mm')}`}
                    </div>
                    {revisionNotice.issues.length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#78350F' }}>
                            {revisionNotice.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
                        </ul>
                    )}
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

            {/* Submission Roadmap */}
            <div className="submission-roadmap">
                {studentTasks.map((task, idx) => {
                    const locked = isStepLocked(task.taskType);
                    const isCompleted = task.status === 'COMPLETED';
                    const isCurrent = !locked && !isCompleted;
                    const submissions = task.submissions || [];
                    const lastSubmission = submissions.length > 0 ? submissions[0] : null;
                    const canSubmit = !locked && ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(task.status);
                    const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'COMPLETED';

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
                                        {isCompleted ? (
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
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleOpenSubmitModal(task)}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span>{task.status === 'REVISION' ? 'Nộp lại bài' : 'Nộp bài ngay'}</span>
                                    </button>
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
                    {['DEFENSE_READY', 'TERMINATED_BM04', 'DEFENDED', 'COMPLETED'].includes(registration.status) && (
                        <Button onClick={handleViewBM04}>Xem Phiếu nhận xét đã ký</Button>
                    )}
                </div>
            </div>

            {/* Meeting Logs Section */}
            {meetingLogs.length > 0 && (
                <div className="card" style={{ marginTop: 24, padding: 20 }}>
                    <h3 className="h3" style={{ marginBottom: 14 }}>Nhật Ký Làm Việc &amp; Trao Đổi Lab Với GVHD ({meetingLogs.length})</h3>
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
                                            <span className="tag teal">{log.location || 'Văn phòng Lab'}</span>
                                        </td>
                                        <td style={{ maxWidth: 260 }}>{log.content}</td>
                                        <td style={{ maxWidth: 260 }}>{log.nextPlan || 'Tiếp tục triển khai theo kế hoạch'}</td>
                                        <td>
                                            <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                                {log.mentorNote || 'Đạt tiến độ'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Hybrid BM Form Modal */}
            <HybridBMFormModal
                open={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleSubmitForm}
                task={activeTask}
                loading={submitting}
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
        </div>
    );
}
