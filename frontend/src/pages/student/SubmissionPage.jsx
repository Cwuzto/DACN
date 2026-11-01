import { useState, useEffect, useMemo } from 'react';
import {
    Button,
    Empty,
    Modal,
    message,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    LockOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';
import evaluationService from '../../services/evaluationService';
import meetingLogService from '../../services/meetingLogService';
import HybridBMFormModal from '../../components/forms/HybridBMFormModal';
import BMSubmissionViewer from '../../components/forms/BMSubmissionViewer';
import CheckpointSignModal from '../../components/student/CheckpointSignModal';
import useAuthStore from '../../stores/authStore';

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
            message.error(error?.message || 'Không thể tải phiếu BM04.');
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

                const [taskRes, logRes, cpRes] = await Promise.all([
                    taskService.getTasksByRegistration(regData.id).catch(() => ({ success: false, data: [] })),
                    meetingLogService.getMeetingLogs(regData.id).catch(() => ({ success: false, data: [] })),
                    evaluationService.getCheckpointEvaluations(regData.id).catch(() => ({ success: false, data: [] })),
                ]);

                if (taskRes.success) setTasks(taskRes.data || []);
                if (logRes.success) setMeetingLogs(logRes.data || []);
                if (cpRes.success) setCheckpoints(cpRes.data || []);
            } else {
                setRegistration(null);
                setTasks([]);
                setMeetingLogs([]);
                setCheckpoints([]);
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

    const studentTasks = useMemo(() => {
        return tasks.filter((t) => t.taskType !== 'BM04');
    }, [tasks]);

    const bm01Revision = registration?.bm01Evaluations?.find((item) => item.outcome === 'NEEDS_REVISION');
    const bm02Current = registration?.currentBM02Submission;
    const revisionNotice = registration?.status === 'BM01_NEEDS_REVISION'
        ? {
            title: 'BM01 cần chỉnh sửa',
            version: 'Lần nộp lại 1/1',
            deadline: bm01Revision?.deadlineAt,
            issues: bm01Revision?.issues?.feedback ? [bm01Revision.issues.feedback] : [],
        }
        : registration?.status === 'BM02_NEEDS_REVISION'
            ? {
                title: 'BM02 cần chỉnh sửa',
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
                    <h1 className="h1" style={{ fontSize: 20 }}>Quy Trình Giao Nộp Biểu Mẫu & Báo Cáo Tiến Độ</h1>
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
                                    {isAppeal ? '⚠️ CẢNH BÁO: QUÁ HẠN KÝ BM03 CHECKPOINT - ĐANG MỞ CỬA SỔ KHIẾU NẠI' : '📝 YÊU CẦU KÝ XÁC NHẬN BIÊN BẢN BM03 CHECKPOINT'}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4, color: isAppeal ? '#7F1D1D' : '#1E3A8A' }}>
                                    {isAppeal ? (
                                        <span>
                                            Bạn đã quá hạn ký biên bản Checkpoint {pendingCp.checkpointNo}. Hệ thống đang mở cửa sổ khiếu nại (3 ngày).
                                            Vui lòng nộp đơn giải trình kèm minh chứng lý do khách quan để Ban chủ nhiệm xét duyệt!
                                        </span>
                                    ) : (
                                        <span>
                                            GVHD đã ký phát hành biên bản <strong>BM03 Checkpoint {pendingCp.checkpointNo}</strong>.
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
                                {isAppeal ? 'Nộp Đơn Khiếu Nại Ký BM03' : 'Xem & Ký Biên Bản BM03 Ngay'}
                            </button>
                        </div>
                    </div>
                );
            })()}

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
                                    <h4>{task.title}</h4>
                                    <p>{task.description || 'Thực hiện và nộp biểu mẫu theo đúng biểu mẫu chuẩn của Viện.'}</p>
                                    <div className="sub-meta-pill">
                                        {isCompleted ? (
                                            <span className="tag green">ĐÃ DUYỆT (PASS)</span>
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
                            <h4>BM04 - Phiếu Nhận Xét & Thẩm Định Khóa Luận Của GVHD</h4>
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
                        <Button onClick={handleViewBM04}>Xem phiếu BM04 đã ký</Button>
                    )}
                </div>
            </div>

            {/* Meeting Logs Section */}
            {meetingLogs.length > 0 && (
                <div className="card" style={{ marginTop: 24, padding: 20 }}>
                    <h3 className="h3" style={{ marginBottom: 14 }}>Nhật Ký Làm Việc & Trao Đổi Lab Với GVHD ({meetingLogs.length})</h3>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Buổi số</th>
                                    <th>Thời gian</th>
                                    <th>Hình thức / Địa điểm</th>
                                    <th>Nội dung trao đổi</th>
                                    <th>Kết quả & Kế hoạch tuần tới</th>
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
                title="Phiếu Nhận Xét BM04 Đã Ký"
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
