import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Alert, Radio, message, Empty, Tooltip } from 'antd';
import {
    ArrowRightOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    UploadOutlined,
    FileDoneOutlined,
    DownloadOutlined,
    CloseOutlined,
    FilePdfOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileTextOutlined,
    HistoryOutlined,
    CloudUploadOutlined,
    LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import dashboardService from '../../services/dashboardService';
import registrationService from '../../services/registrationService';
import outlineService from '../../services/outlineService';
import evaluationService from '../../services/evaluationService';
import archiveService from '../../services/archiveService';
import {
    useStudentStats,
    useAllowedActions,
    useBM04Record,
    useStudentAckBM03Mutation,
    useWithdrawRegistrationMutation,
} from '../../queries/studentDashboardQueries';
import { useMyOutline } from '../../queries/outlineQueries';
import { useBM03Record } from '../../queries/meetingQueries';
import { useDefenseDossier } from '../../queries/archiveQueries';
import QueryErrorState from '../../components/common/QueryErrorState';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import TitleAdjustmentModal from '../../components/student/TitleAdjustmentModal';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';

const ACTIVE_FLOW_STATUSES = [
    'APPROVED',
    'BM01_SUBMITTED',
    'BM01_PASSED',
    'BM01_NEEDS_REVISION',
    'BM01_RESUBMITTED',
    'BM02_SUBMITTED',
    'DECISION_ISSUED',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'PENDING_INSTITUTE_SIGNATURE',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'DEFENDED',
    'COMPLETED',
    'TERMINATED_FAILED_PROGRESS',
    'TERMINATED_BM04',
];
const WITHDRAWABLE_STATUSES = ['APPROVED', 'BM01_SUBMITTED', 'BM01_PASSED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED', 'BM02_SUBMITTED'];

const getProgressPercentByStatus = (status) => {
    switch (status) {
        case 'APPROVED':
        case 'BM01_SUBMITTED':
        case 'BM01_NEEDS_REVISION':
        case 'BM01_RESUBMITTED':
            return 16;
        case 'BM01_PASSED':
            return 33;
        case 'BM02_SUBMITTED':
        case 'DECISION_ISSUED':
        case 'IN_PROGRESS_BM03':
        case 'BM03_SIGNATURE_PENDING':
        case 'CHECKPOINT_SIGNATURE_APPEAL_OPEN':
        case 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED':
        case 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW':
        case 'SIGNATURE_APPEAL_RESOLVED':
            return 50;
        case 'BM03_PASSED':
        case 'BM04_REVIEW':
            return 66;
        case 'DEFENSE_READY':
            return 83;
        case 'DEFENDED':
        case 'COMPLETED':
            return 100;
        default:
            return 0;
    }
};

export default function StudentDashboardPage() {
    const { user } = useAuthStore();
    const scope = queryKeys.scope(user);
    const navigate = useNavigate();

    const statsQuery = useStudentStats(scope);
    const outlineQuery = useMyOutline(scope);
    // outlineService.getMyOutline via useMyOutline

    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [titleModalOpen, setTitleModalOpen] = useState(false);
    const [bm02ModalOpen, setBm02ModalOpen] = useState(false);
    const [bm03AckModalOpen, setBm03AckModalOpen] = useState(false);
    const [bm03AckAction, setBm03AckAction] = useState('ACKNOWLEDGED');
    const [bm03AckComment, setBm03AckComment] = useState('');
    const [ackSubmitting, setAckSubmitting] = useState(false);
    const [timelineOpen, setTimelineOpen] = useState(false);

    const dashboardData = statsQuery.data;
    const { hasRegistration, registrationDetails, taskStatus, upcomingDeadlines } = dashboardData || {};
    const hasAnyRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const regId = currentRegistration?.registrationId || currentRegistration?.id;

    const allowedActionsQuery = useAllowedActions(scope, regId);
    const allowedActions = allowedActionsQuery.data || [];
    const bm03Query = useBM03Record(scope, regId);
    const bm03Record = bm03Query.data || null;
    const bm04Query = useBM04Record(scope, regId);
    const bm04Record = bm04Query.data || null;
    const dossierQuery = useDefenseDossier(scope, regId);
    const defenseDossier = dossierQuery.data?.data || null;

    const studentAckBM03Mutation = useStudentAckBM03Mutation(scope, regId);
    const withdrawMutation = useWithdrawRegistrationMutation(scope, regId);

    const outlineData = outlineQuery.data;
    const outlineCouncil = outlineData?.outlineCouncil || currentRegistration?.outlineCouncil;
    const canWithdraw = hasAnyRegistration && allowedActions.includes('CANCEL_REGISTRATION');
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;
    const titleAdjustmentDeadline = currentRegistration?.decisionDate
        ? dayjs(currentRegistration.decisionDate).add(7, 'day')
        : null;
    const titleAdjustmentDaysRemaining = titleAdjustmentDeadline
        ? Math.max(0, Math.ceil(titleAdjustmentDeadline.diff(dayjs(), 'day', true)))
        : 0;
    const titleAdjustmentOpen = Boolean(titleAdjustmentDeadline && !dayjs().isAfter(titleAdjustmentDeadline));

    const totalTasks = taskStatus?.total ?? (dashboardData?.tasks?.length || 0);
    const completedTasks = taskStatus?.completed || 0;
    const overdueTasks = taskStatus?.overdue || 0;
    const progressPercent = typeof taskStatus?.progressPercent === 'number' && taskStatus.progressPercent > 0
        ? taskStatus.progressPercent
        : getProgressPercentByStatus(currentRegistration?.status);
    const mentorDisplayName = dashboardData?.mentorFullName || currentRegistration?.topic?.mentor?.user?.fullName || currentRegistration?.topic?.mentorName || 'Chưa phân công';

    const handleDownloadCertificate = async () => {
        if (!regId) return;
        try {
            message.loading({ content: 'Đang tải Giấy xác nhận hoàn thành...', key: 'cert-dl' });
            const res = await archiveService.getClearanceCertificate(regId);
            if (res.success && res.data?.pdfUrl) {
                window.open(res.data.pdfUrl, '_blank');
                message.success({ content: 'Đã mở Giấy xác nhận hoàn thành', key: 'cert-dl' });
            } else {
                message.info({ content: res.message || 'Chưa có file Giấy xác nhận', key: 'cert-dl' });
            }
        } catch (err) {
            message.error({ content: err?.message || 'Không thể tải Giấy xác nhận', key: 'cert-dl' });
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
            await studentAckBM03Mutation.mutateAsync({
                bm03RecordId: bm03Record.id,
                data: {
                    action,
                    comment: bm03AckComment.trim() || undefined,
                },
            });
            message.success('Đã gửi phản hồi xác nhận BM03 thành công!');
            setBm03AckModalOpen(false);
            setBm03AckComment('');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gửi phản hồi.');
        } finally {
            setAckSubmitting(false);
        }
    };

    const handleWithdrawRegistration = async () => {
        if (!allowedActions.includes('CANCEL_REGISTRATION')) {
            message.warning('Trạng thái hiện tại của hồ sơ không cho phép rút đăng ký.');
            return;
        }
        if (!withdrawReason.trim()) {
            message.warning('Vui lòng nhập lý do rút đăng ký.');
            return;
        }
        if (!regId) {
            message.error('Không tìm thấy thông tin đăng ký.');
            return;
        }
        try {
            setWithdrawing(true);
            await withdrawMutation.mutateAsync(withdrawReason.trim());
            message.success('Đã rút đăng ký thành công.');
            setWithdrawModalOpen(false);
            setWithdrawReason('');
        } catch (error) {
            message.error(error?.message || 'Không thể rút đăng ký lúc này.');
        } finally {
            setWithdrawing(false);
        }
    };

    const handleDownloadDecision = () => {
        message.success(`Đang chuẩn bị văn bản in quyết định số ${currentRegistration?.decisionNumber || '458/QĐ-VCS'}`);
        setBm02ModalOpen(false);
    };

    if (statsQuery.isPending) {
        return (
            <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
                <ContentSkeleton rows={6} />
            </div>
        );
    }

    if (statsQuery.isError) {
        return (
            <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
                <QueryErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
            </div>
        );
    }

    const renderRegistrationStatusTag = () => {
        if (!hasAnyRegistration) {
            return <span className="tag red">Chưa đăng ký đề tài</span>;
        }
        const status = currentRegistration?.status;
        if (status === 'PENDING') return <span className="tag yellow">Chờ duyệt đề tài</span>;
        if (status === 'REJECTED') return <span className="tag red">Bị từ chối</span>;
        if (status === 'APPROVED') return <span className="tag teal">Đã nhận đề tài</span>;
        if (status === 'BM01_SUBMITTED') return <span className="tag blue">Chờ duyệt đề cương chi tiết</span>;
        if (status === 'BM01_PASSED') return <span className="tag green">Đề cương đạt (Chờ Quyết định giao đề tài)</span>;
        if (status === 'BM01_NEEDS_REVISION') return <span className="tag red">Đề cương cần chỉnh sửa</span>;
        if (status === 'BM01_RESUBMITTED') return <span className="tag cyan">Đã nộp bản sửa (Chờ Chủ tịch duyệt)</span>;
        if (status === 'DECISION_ISSUED') return <span className="tag purple">Đã ban hành Quyết định giao đề tài</span>;
        if (status === 'IN_PROGRESS_BM03') return <span className="tag teal">Đang thực hiện đánh giá tiến độ</span>;
        if (status === 'BM03_SIGNATURE_PENDING') return <span className="tag yellow">Chờ ký biên bản tiến độ (3 ngày)</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') return <span className="tag red">Quá hạn ký biên bản (Mở khiếu nại)</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED') return <span className="tag blue">Đã nộp khiếu nại biên bản tiến độ</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW') return <span className="tag purple">Đang thẩm định khiếu nại</span>;
        if (status === 'SIGNATURE_APPEAL_RESOLVED') return <span className="tag green">Khiếu nại được giải quyết</span>;
        if (status === 'BM03_PASSED') return <span className="tag green">Đạt đánh giá tiến độ (Hoàn thành tiến độ)</span>;
        if (status === 'BM04_REVIEW') return <span className="tag teal">Đang thẩm định Phiếu nhận xét</span>;
        if (status === 'DEFENSE_READY') return <span className="tag green">Đủ điều kiện bảo vệ</span>;
        if (status === 'DEFENDED') return <span className="tag yellow">Đã bảo vệ</span>;
        if (status === 'DEFENSE_PASSED') return <span className="tag green">Bảo vệ đạt · Cần nộp lưu chiểu</span>;
        if (status === 'DEFENSE_FAILED') return <span className="tag red">Bảo vệ chưa đạt (Kết thúc hồ sơ)</span>;
        if (status === 'PENDING_INSTITUTE_SIGNATURE') return <span className="tag purple">Chờ Viện trưởng ký Giấy chứng nhận</span>;
        if (status === 'ARCHIVE_INCOMPLETE') return <span className="tag red">Chưa hoàn tất lưu chiểu (Quá hạn)</span>;
        if (status === 'ARCHIVE_REJECTED') return <span className="tag red">Lưu chiểu bị từ chối</span>;
        if (status === 'COMPLETED') return <span className="tag green">Hoàn tất đồ án</span>;
        if (status === 'TERMINATED_BM01') return <span className="tag red">Dừng đề tài (Đề cương không đạt)</span>;
        if (status === 'TERMINATED_FAILED_PROGRESS') return <span className="tag red">Dừng đề tài (Tiến độ không đạt)</span>;
        if (status === 'TERMINATED_BM04') return <span className="tag red">Dừng đề tài (Phiếu nhận xét chưa đạt)</span>;
        return <span className="tag green">Đang thực hiện · Học kỳ hiện tại</span>;
    };

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
            {/* BM03 48h Acknowledgement Banner */}
            {bm03Record?.advisorSignedAt && bm03Record?.studentAckStatus === 'PENDING_STUDENT_ACKNOWLEDGEMENT' && (
                <Alert
                    type="warning"
                    showIcon
                    message={<span style={{ fontWeight: 700, fontSize: 14 }}>Xác nhận đã biết Phiếu theo dõi tiến độ BM03 (Thời hạn 48 giờ)</span>}
                    description={
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1.5">
                            <div>
                                GVHD đã ký xác nhận toàn phiếu BM03. Bạn có 48 giờ để xác nhận đã biết (Hạn chót: {bm03Record.studentAckDeadlineAt ? dayjs(bm03Record.studentAckDeadlineAt).format('DD/MM/YYYY HH:mm') : '48 giờ'}).
                            </div>
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                onClick={() => setBm03AckModalOpen(true)}
                            >
                                Ký xác nhận đã biết BM03
                            </Button>
                        </div>
                    }
                    style={{ marginBottom: 20, borderRadius: 8 }}
                />
            )}

            {/* Topic Hero Banner Card */}
            {hasAnyRegistration && currentRegistration?.topic ? (
                <div className="topic-hero-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ maxWidth: 860 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                <span className="topic-code-pill">
                                    MÃ ĐỀ TÀI: {currentRegistration.topic.code || 'DA-2026-KTPM-04'}
                                </span>
                                {renderRegistrationStatusTag()}
                            </div>
                            <h2 className="topic-hero-title">
                                {currentRegistration.adjustedTitle || currentRegistration.topic.title}
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                                Chuyên ngành: <strong>{currentRegistration.topic.projectCatalogName || 'Công nghệ Thông tin'}</strong> · Học kỳ: <strong>{currentRegistration.topic.semesterName || currentRegistration.semester?.name || 'Đồ án tốt nghiệp — HK1 2026–2027'}</strong>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Button
                                icon={<HistoryOutlined />}
                                onClick={() => setTimelineOpen(true)}
                            >
                                Lịch sử tiến trình
                            </Button>
                            {bm03Record?.finalPdfFileUrl && (
                                <Button
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    href={bm03Record.finalPdfFileUrl}
                                    target="_blank"
                                >
                                    Tải PDF BM03
                                </Button>
                            )}
                            {bm04Record?.finalPdfFileUrl && (
                                <Button
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    href={bm04Record.finalPdfFileUrl}
                                    target="_blank"
                                >
                                    Tải PDF BM04
                                </Button>
                            )}
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    const el = document.getElementById('mentor-contact-box');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>Trao đổi GVHD</span>
                            </button>
                            {currentRegistration.decisionNumber ? (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setBm02ModalOpen(true)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span>Quyết định giao đề tài</span>
                                </button>
                            ) : null}
                            {['BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'].includes(currentRegistration?.status) && (
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? <ExclamationCircleOutlined /> : <FileDoneOutlined />}
                                    onClick={() => navigate('/student/submissions')}
                                    style={{
                                        background: currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '#DC2626' : '#2563EB',
                                        borderColor: currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '#DC2626' : '#2563EB',
                                        fontWeight: 700,
                                    }}
                                >
                                    {currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? 'Khiếu nại biên bản tiến độ' : 'Ký biên bản tiến độ ngay'}
                                </Button>
                            )}
                            {allowedActions.includes('REQUEST_TITLE_CHANGE') && (
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={!titleAdjustmentOpen}
                                    onClick={() => setTitleModalOpen(true)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>{titleAdjustmentOpen ? `Đề xuất sửa tên (${titleAdjustmentDaysRemaining} ngày)` : 'Đã hết hạn sửa tên'}</span>
                                </button>
                            )}
                            {canWithdraw && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setWithdrawModalOpen(true)}
                                    style={{ color: '#D97706', borderColor: '#FDE68A' }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span>Xin hoãn/rút</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {allowedActions.includes('REQUEST_TITLE_CHANGE') && titleAdjustmentDeadline && (
                        <div
                            role="status"
                            style={{
                                marginTop: 16,
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: `1px solid ${titleAdjustmentOpen ? '#99F6E4' : '#FECACA'}`,
                                background: titleAdjustmentOpen ? '#F0FDFA' : '#FEF2F2',
                                color: titleAdjustmentOpen ? '#115E59' : '#991B1B',
                                fontSize: 13,
                                fontWeight: 600,
                            }}
                        >
                            {titleAdjustmentOpen
                                ? `Cửa sổ điều chỉnh tên đề tài còn ${titleAdjustmentDaysRemaining} ngày — hạn ${titleAdjustmentDeadline.format('DD/MM/YYYY HH:mm')}.`
                                : `Cửa sổ điều chỉnh tên đề tài đã đóng từ ${titleAdjustmentDeadline.format('DD/MM/YYYY HH:mm')}.`}
                        </div>
                    )}

                    <div className="topic-meta-grid" style={{ marginTop: 20 }}>
                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Giảng viên hướng dẫn</div>
                                <div className="topic-meta-val">
                                    {mentorDisplayName}
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Sinh viên thực hiện</div>
                                <div className="topic-meta-val">
                                    {user?.fullName || 'Sinh viên'} (1 SV / 1 đề tài)
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Hạn chót tiếp theo</div>
                                <div className="topic-meta-val" style={{ color: nearestDeadline ? '#DC2626' : 'var(--fg)' }}>
                                    {nearestDeadline ? `${dayjs(nearestDeadline.date).format('DD/MM/YYYY')} (${nearestDeadline.title})` : 'Đang đúng lộ trình'}
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="8" r="7" />
                                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Dự kiến bảo vệ</div>
                                <div className="topic-meta-val" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                    {currentRegistration.status === 'DEFENSE_READY' ? 'Đủ điều kiện ra Hội đồng' :
                                     currentRegistration.status === 'DEFENDED' ? 'Đã bảo vệ xong' :
                                     'Theo lịch Viện CNS'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                        📖
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>Bạn chưa đăng ký đề tài tốt nghiệp</h3>
                    <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.6 }}>
                        Vui lòng duyệt danh sách các đề tài của các Bộ môn đang mở tiếp nhận sinh viên để đăng ký ngay.
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/student/topics')}>
                        <span>Xem Danh Mục Đề Tài Ngay</span>
                        <ArrowRightOutlined style={{ marginLeft: 6 }} />
                    </button>
                </div>
            )}

            {/* Outline Defense Council Session Banner */}
            {outlineQuery.isError && (
                <div style={{ marginBottom: 24 }}>
                    <QueryErrorState error={outlineQuery.error} onRetry={() => outlineQuery.refetch()} />
                </div>
            )}
            {outlineCouncil && (
                <div
                    className="card"
                    style={{
                        marginBottom: 24,
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
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/student/submissions')}
                            >
                                Chi tiết đề cương
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Post-Defense Archival & Defense Council Session Banner */}
            {['DEFENSE_READY', 'DEFENSE_PASSED', 'PENDING_INSTITUTE_SIGNATURE', 'COMPLETED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(currentRegistration?.status) && (
                <div
                    className="card"
                    style={{
                        marginBottom: 24,
                        padding: '16px 20px',
                        borderLeft: '6px solid',
                        borderLeftColor: currentRegistration?.status === 'COMPLETED' ? '#10B981' : currentRegistration?.status === 'ARCHIVE_INCOMPLETE' || currentRegistration?.status === 'ARCHIVE_REJECTED' ? '#EF4444' : '#0F766E',
                        background: currentRegistration?.status === 'COMPLETED' ? '#F0FDF4' : currentRegistration?.status === 'ARCHIVE_INCOMPLETE' || currentRegistration?.status === 'ARCHIVE_REJECTED' ? '#FEF2F2' : '#F0FDFA',
                        borderColor: currentRegistration?.status === 'COMPLETED' ? '#BBF7D0' : currentRegistration?.status === 'ARCHIVE_INCOMPLETE' || currentRegistration?.status === 'ARCHIVE_REJECTED' ? '#FECACA' : '#99F6E4',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: currentRegistration?.status === 'COMPLETED' ? '#166534' : currentRegistration?.status === 'ARCHIVE_INCOMPLETE' || currentRegistration?.status === 'ARCHIVE_REJECTED' ? '#991B1B' : '#0F766E', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {currentRegistration?.status === 'COMPLETED' && (
                                    <span>Đồ Án Tốt Nghiệp Đã Hoàn Tất — Giấy Xác Nhận Đã Được Ký</span>
                                )}
                                {currentRegistration?.status === 'DEFENSE_READY' && (
                                    <span>Chuẩn Bị Bảo Vệ Khóa Luận Trước Hội Đồng</span>
                                )}
                                {['DEFENSE_PASSED', 'PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(currentRegistration?.status) && (
                                    <span>Cửa Sổ Nộp &amp; Hoàn Thiện Hồ Sơ Lưu Chiểu (14 Ngày Sau Bảo Vệ)</span>
                                )}
                            </div>

                            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--fg)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                {defenseDossier?.windows?.defenseDateYmd && (
                                    <span>
                                        Ngày bảo vệ: <strong>{dayjs(defenseDossier.windows.defenseDateYmd).format('DD/MM/YYYY')}</strong>
                                    </span>
                                )}
                                {currentRegistration?.status === 'DEFENSE_READY' && defenseDossier?.windows?.softPreparationDeadlineAt && (
                                    <span style={{ color: defenseDossier.windows.isSoftDeadlinePassed ? '#DC2626' : '#D97706' }}>
                                        Hạn mềm nộp 4 tài liệu: <strong>{dayjs(defenseDossier.windows.softPreparationDeadlineAt).format('DD/MM/YYYY HH:mm')}</strong>
                                        {defenseDossier.windows.isSoftDeadlinePassed && ' (Đã quá hạn mềm)'}
                                    </span>
                                )}
                                {['DEFENSE_PASSED', 'PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(currentRegistration?.status) && defenseDossier?.windows?.windowClosesAt && (
                                    <span>
                                        {defenseDossier.windows.isWindowClosed ? (
                                            <span style={{ color: '#DC2626', fontWeight: 600 }}>
                                                Cổng lưu chiểu đã đóng lúc: <strong>{dayjs(defenseDossier.windows.windowClosesAt).format('DD/MM/YYYY HH:mm')}</strong>
                                            </span>
                                        ) : (
                                            <span style={{ color: '#0F766E' }}>
                                                Hạn chót đóng cổng lưu chiểu: <strong>{dayjs(defenseDossier.windows.windowClosesAt).format('DD/MM/YYYY HH:mm')}</strong>
                                                {' '}— Còn <strong>{Math.max(0, Math.ceil(dayjs(defenseDossier.windows.windowClosesAt).diff(dayjs(), 'day', true)))} ngày</strong>
                                            </span>
                                        )}
                                    </span>
                                )}
                                {currentRegistration?.status === 'PENDING_INSTITUTE_SIGNATURE' && (
                                    <span style={{ color: '#7C3AED', fontWeight: 600 }}>
                                        GVHD và Giáo vụ đã thẩm định xong — Đang chờ Viện trưởng ký số
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {currentRegistration?.status === 'COMPLETED' ? (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleDownloadCertificate}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                                >
                                    <DownloadOutlined />
                                    <span>Tải Giấy Xác Nhận (PDF)</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => navigate('/student/submissions')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                                >
                                    <CloudUploadOutlined />
                                    <span>Vào Kho Lưu Chiểu 4 Tài Liệu</span>
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/student/grades')}
                            >
                                Xem Điểm Bảo Vệ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6-Stage Milestone Stepper Flow */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 14" />
                        </svg>
                        <span>Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)</span>
                    </div>
                    <span className="tag green" style={{ fontWeight: 700 }}>
                        {progressPercent}% Hoàn tất
                    </span>
                </div>
                <div className="card-body" style={{ padding: '24px 20px' }}>
                    <div className="milestone-stepper">
                        <div className="milestone-stepper-progress" style={{ width: `${progressPercent}%` }} />

                        <div className={`step-node ${progressPercent >= 16 ? 'completed' : 'active'}`} onClick={() => navigate('/student/topics')}>
                            <div className="step-circle">{progressPercent >= 16 ? '✓' : '1'}</div>
                            <div className="step-label">1. Đăng ký</div>
                            <div className="step-sub">{hasAnyRegistration ? 'Đã duyệt' : 'Chưa đăng ký'}</div>
                        </div>

                        {/* Step 2: Đề cương nghiên cứu chi tiết */}
                        {(() => {
                            const status = currentRegistration?.status;
                            const isStep2Completed = ['BM01_PASSED', 'BM02_SUBMITTED', 'DECISION_ISSUED', 'IN_PROGRESS_BM03', 'BM03_PASSED', 'BM04_REVIEW', 'DEFENSE_READY', 'DEFENDED', 'COMPLETED'].includes(status) || progressPercent >= 33;
                            const isStep2Active = !isStep2Completed && ['APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED'].includes(status);
                            let subText = 'Xét duyệt đạt';
                            if (status === 'BM01_SUBMITTED') subText = 'Chờ duyệt đề cương';
                            else if (status === 'BM01_NEEDS_REVISION') subText = 'Cần chỉnh sửa';
                            else if (status === 'BM01_RESUBMITTED') subText = 'Đã nộp bản sửa';
                            else if (status === 'TERMINATED_BM01') subText = 'Dừng thực hiện';
                            else if (status === 'APPROVED') subText = 'Chờ nộp đề cương';
                            else if (!isStep2Completed) subText = 'Chưa nộp';

                            return (
                                <div className={`step-node ${isStep2Completed ? 'completed' : isStep2Active ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                                    <div className="step-circle">{isStep2Completed ? '✓' : '2'}</div>
                                    <div className="step-label">2. Đề cương nghiên cứu chi tiết</div>
                                    <div className="step-sub">{subText}</div>
                                </div>
                            );
                        })()}

                        <div className={`step-node ${progressPercent >= 50 ? 'completed' : progressPercent >= 33 ? 'active' : ''}`} onClick={() => setBm02ModalOpen(true)}>
                            <div className="step-circle">{progressPercent >= 50 ? '✓' : '3'}</div>
                            <div className="step-label">3. Đơn đăng ký đề tài chính thức</div>
                            <div className="step-sub">{currentRegistration?.decisionNumber || 'Ban hành QĐ'}</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 66 ? 'completed' : progressPercent >= 50 ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                            <div className="step-circle">{progressPercent >= 66 ? '✓' : '4'}</div>
                            <div className="step-label">4. Nhật ký & Đánh giá tiến độ</div>
                            <div className="step-sub">2 Checkpoint</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 83 ? 'completed' : progressPercent >= 66 ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                            <div className="step-circle">{progressPercent >= 83 ? '✓' : '5'}</div>
                            <div className="step-label">5. Phiếu nhận xét của người hướng dẫn</div>
                            <div className="step-sub">Đánh giá GVHD</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 100 ? 'completed' : ''}`} onClick={() => navigate('/student/grades')}>
                            <div className="step-circle">{progressPercent >= 100 ? '✓' : '6'}</div>
                            <div className="step-label">6. Hội đồng bảo vệ</div>
                            <div className="step-sub">Điểm tổng hợp</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4 Key Stat Cards */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon teal">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">{progressPercent}%</div>
                        <div className="stat-label">Tiến độ tổng thể</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">{completedTasks} / {totalTasks}</div>
                        <div className="stat-label">Biểu mẫu hoàn tất</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">{dashboardData?.meetingLogsCount ?? 0} buổi</div>
                        <div className="stat-label">Số buổi trao đổi GVHD</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">
                            {dashboardData?.mentorScore != null ? `${Number(dashboardData.mentorScore).toFixed(1)} / 10` : 'Chưa đánh giá'}
                        </div>
                        <div className="stat-label">Điểm đánh giá GVHD</div>
                    </div>
                </div>
            </div>

            {/* Dashboard Split Grid */}
            <div className="dashboard-split">
                {/* Left Column: Tasks & Mentor */}
                <div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                </svg>
                                <span>Nhiệm vụ & Hạn nộp sắp tới</span>
                            </div>
                            {overdueTasks > 0 ? (
                                <span className="tag red">{overdueTasks} việc quá hạn</span>
                            ) : (
                                <span className="tag green">Tiến độ tốt</span>
                            )}
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            {dashboardData?.tasks && dashboardData.tasks.length > 0 ? (
                                dashboardData.tasks.map((task) => {
                                    const taskDueDate = task.dueDate || task.deadline;
                                    const isOverdue = taskDueDate && dayjs(taskDueDate).isBefore(dayjs()) && !['SUBMITTED', 'COMPLETED'].includes(task.status);
                                    const isSubmitted = ['SUBMITTED', 'COMPLETED'].includes(task.status);
                                    return (
                                        <div
                                            key={task.id}
                                            className="task-item"
                                            style={isOverdue ? { borderLeft: '3px solid #DC2626' } : undefined}
                                        >
                                            <div className="task-left">
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span className="task-title">{task.title}</span>
                                                        {taskDueDate && (
                                                            isOverdue ? (
                                                                <span className="task-badge-urgent">
                                                                    Quá hạn: {dayjs(taskDueDate).format('DD/MM/YYYY')}
                                                                </span>
                                                            ) : (
                                                                <span className="tag blue">
                                                                    Hạn: {dayjs(taskDueDate).format('DD/MM/YYYY')}
                                                                </span>
                                                            )
                                                        )}
                                                        {isSubmitted && <span className="tag green">Đã nộp</span>}
                                                    </div>
                                                    {(task.description || task.content) && (
                                                        <div className="task-meta">{task.description || task.content}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type={isSubmitted ? 'default' : 'primary'}
                                                size="small"
                                                onClick={() => navigate('/student/submissions')}
                                            >
                                                {isSubmitted ? 'Xem bài nộp' : 'Nộp bài'}
                                            </Button>
                                        </div>
                                    );
                                })
                            ) : (
                                <Empty
                                    description="Chưa có nhiệm vụ cần nộp trong đợt này"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            )}
                        </div>
                    </div>

                    {/* Team & Mentor Card */}
                    <div className="card" id="mentor-contact-box">
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                </svg>
                                <span>Cán bộ Hướng dẫn & Sinh viên thực hiện</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border-light)' }}>
                                <div className="student-avatar" style={{ width: 48, height: 48, fontSize: 14 }}>
                                    GVHD
                                </div>
                                <div>
                                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                                        {mentorDisplayName}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        Khoa Kỹ thuật Phần mềm · Email: dung.lq@vcs.edu.vn
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                                        Lịch làm việc Lab: Sáng Thứ Ba & Sáng Thứ Sáu hàng tuần
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 14 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                                    Sinh viên phụ trách đề tài:
                                </div>
                                <div style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                                        {user?.fullName || 'Sinh viên'} <span className="tag teal" style={{ marginLeft: 6 }}>Chủ nhiệm đề tài</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                                        MSSV: <strong>{user?.code || '21120489'}</strong> · Email: <strong>{user?.email || 'sinhvien@university.edu.vn'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Academic Announcements & Forms Download */}
                <div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                                <span>Thông báo học vụ quan trọng</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ padding: '10px 12px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F766E' }}>Hạn nộp báo cáo tiến độ đợt 2</div>
                                <div style={{ fontSize: 11.5, color: '#115E59', marginTop: 2 }}>
                                    Hệ thống sẽ khóa cổng nộp tự động lúc 23:59 ngày 22/10/2026. Sinh viên kiểm tra đầy đủ liên kết repository.
                                </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--fg)' }}>Mẫu định dạng Báo cáo toàn văn Đồ án 2026</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                    Viện đã cập nhật mẫu LaTeX & Word chuẩn bìa cứng mới nhất trên Cổng thông tin học vụ.
                                </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--fg)' }}>Tập huấn kiểm tra liêm chính học thuật Turnitin</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                    Buổi chia sẻ trực tuyến vào Thứ Bảy, 25/10/2026 qua MS Teams dành cho toàn thể sinh viên làm KLTN/DACN.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Document Templates Download Card */}
                    <div className="card">
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Tài liệu & Biểu mẫu chuẩn</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Đề cương nghiên cứu chi tiết (.docx)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </li>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Nhật ký &amp; Đánh giá tiến độ (.docx)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </li>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Mẫu Slide báo cáo bảo vệ Hội đồng (.pptx)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* BM02 Modal View */}
            <Modal
                title="Quyết định Giao Đề tài Tốt nghiệp"
                open={bm02ModalOpen}
                onCancel={() => setBm02ModalOpen(false)}
                footer={[
                    <Button key="close" icon={<CloseOutlined />} onClick={() => setBm02ModalOpen(false)}>
                        Đóng
                    </Button>,
                    <Button
                        key="print"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadDecision}
                    >
                        Tải bản ký quyết định
                    </Button>,
                ]}
            >
                <div style={{ padding: '16px 20px', background: '#F8FAFC', borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT · VIỆN CÔNG NGHỆ SỐ</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--institutional)', marginTop: 6 }}>
                            QUYẾT ĐỊNH GIAO ĐỀ TÀI KHÓA LUẬN TỐT NGHIỆP
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            Số: <strong>{currentRegistration?.decisionNumber || '458/QĐ-VCS-ĐT'}</strong> · Ngày ký: {currentRegistration?.decisionDate ? dayjs(currentRegistration.decisionDate).format('DD/MM/YYYY') : '20/09/2026'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p>Tên đề tài: <strong>{currentRegistration?.topic?.title}</strong></p>
                        <p>Sinh viên thực hiện: <strong>{user?.fullName} — MSSV: {user?.code}</strong></p>
                        <p>Cán bộ hướng dẫn: <strong>{mentorDisplayName}</strong></p>
                        <p>Quy chuẩn đào tạo: Khóa {user?.studentProfile?.academicYear || '2022 - 2026'} · {currentRegistration?.semester?.name || currentRegistration?.topic?.semesterName || 'Đồ án tốt nghiệp — HK1 2026–2027'}</p>
                    </div>
                </div>
            </Modal>

            {/* Title Adjustment Modal */}
            <TitleAdjustmentModal
                open={titleModalOpen}
                onClose={() => setTitleModalOpen(false)}
                registrationId={currentRegistration?.id}
                currentTitle={currentRegistration?.adjustedTitle || currentRegistration?.topic?.title}
                decisionDate={currentRegistration?.decisionDate}
                onSuccess={() => statsQuery.refetch()}
            />

            {/* Withdraw Modal */}
            <Modal
                title="Đơn Xin Hoãn / Rút Đề Tài Tốt Nghiệp"
                open={withdrawModalOpen}
                onCancel={() => setWithdrawModalOpen(false)}
                onOk={handleWithdrawRegistration}
                confirmLoading={withdrawing}
                okText="Xác nhận xin rút"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: '#475569' }}>
                        Lưu ý: Sau khi rút đề tài, bạn sẽ không thể phục hồi lại trạng thái đăng ký hiện tại. Vui lòng nêu rõ lý do chính đáng:
                    </p>
                    <Input.TextArea
                        rows={4}
                        placeholder="Nhập lý do xin hoãn hoặc rút đề tài..."
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                    />
                </div>
            </Modal>

            {/* BM03 Acknowledgement Modal */}
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
                        description={`Biểu mẫu BM03 đã được GVHD hoàn tất và ký số lúc ${bm03Record?.advisorSignedAt ? dayjs(bm03Record.advisorSignedAt).format('DD/MM/YYYY HH:mm') : '---'}. Sinh viên vui lòng đọc kỹ nội dung và chọn 1 trong 3 hình thức phản hồi.`}
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

            <RegistrationTimelineDrawer
                open={timelineOpen}
                onClose={() => setTimelineOpen(false)}
                registrationId={currentRegistration?.registrationId || currentRegistration?.id}
                topicTitle={currentRegistration?.adjustedTitle || currentRegistration?.topic?.title}
                studentName={user?.fullName}
                studentCode={user?.studentCode || user?.code || user?.username}
            />
        </div>
    );
}
