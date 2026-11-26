import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Alert, Radio, message, Tooltip } from 'antd';
import {
    ArrowRightOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FileDoneOutlined,
    DownloadOutlined,
    CloseOutlined,
    FilePdfOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileTextOutlined,
    HistoryOutlined,
    CloudUploadOutlined,
    CheckOutlined,
    CalendarOutlined,
    FormOutlined,
    AuditOutlined,
    ScheduleOutlined,
    CommentOutlined,
    TrophyOutlined,
    UserOutlined,
    TeamOutlined,
    MessageOutlined,
    EditOutlined,
    BellOutlined,
    BookOutlined,
    BankOutlined,
    StarOutlined,
    SafetyCertificateOutlined,
    WarningOutlined,
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
    useAllowedActions,
    useBM04Record,
    useStudentAckBM03Mutation,
    useWithdrawRegistrationMutation,
} from '../../queries/studentDashboardQueries';
import { useStudentDashboard } from '../../queries/dashboardQueries';
import { useMyOutline } from '../../queries/outlineQueries';
import { useBM03Record } from '../../queries/meetingQueries';
import { useDefenseDossier } from '../../queries/archiveQueries';
import QueryErrorState from '../../components/common/QueryErrorState';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import TitleAdjustmentModal from '../../components/student/TitleAdjustmentModal';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import AcademicRoadmapStepper from '../../components/common/AcademicRoadmapStepper';
import ArchiveDeadlineBanner from '../../components/forms/ArchiveDeadlineBanner';

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

const NEXT_ACTION_CTA_LABELS = {
    REGISTER_TOPIC: 'Đăng ký đề tài',
    SUBMIT_BM01: 'Nộp BM01',
    REVISE_BM01: 'Sửa & nộp lại BM01',
    SUBMIT_BM02: 'Nộp hồ sơ BM02',
    SIGN_BM03: 'Ký biên bản BM03',
    APPEAL_BM03: 'Gửi giải trình BM03',
    SUBMIT_PROGRESS_BM03: 'Cập nhật tiến độ BM03',
    PREPARE_DEFENSE: 'Chuẩn bị bảo vệ',
    SUBMIT_ARCHIVE: 'Nộp lưu chiểu',
    VIEW_GRADES_CERTIFICATE: 'Xem kết quả',
};

const isValidInternalTarget = (target) => (
    typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
);

const getNextActionCtaLabel = (kind) => NEXT_ACTION_CTA_LABELS[kind] || 'Thực hiện ngay';

const formatNextActionDueAt = (dueAt) => {
    if (!dueAt) return null;
    const parsed = dayjs(dueAt);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : null;
};

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

    const studentDashboardQuery = useStudentDashboard(scope);
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

    const dashboardData = studentDashboardQuery.data;
    const { hasRegistration, registrationDetails, taskStatus, upcomingDeadlines } = dashboardData || {};
    const nextAction = dashboardData?.nextAction ?? null;
    const nextActionDueText = formatNextActionDueAt(nextAction?.dueAt);
    const canNavigateNextAction = Boolean(nextAction?.canAct && isValidInternalTarget(nextAction?.target));
    const hasAnyRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const regId = currentRegistration?.registrationId || currentRegistration?.id;

    // Contract: registrationService.getAllowedActions queried via useAllowedActions
    const allowedActionsQuery = useAllowedActions(scope, regId);
    const allowedActions = allowedActionsQuery.data || [];
    const bm03Query = useBM03Record(scope, regId);
    const bm03Record = bm03Query.data || null;
    const bm04Query = useBM04Record(scope, regId);
    const bm04Record = bm04Query.data || null;
    // archiveService.getDefenseDossier queried via useDefenseDossier
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

    const progressPercent = typeof taskStatus?.progressPercent === 'number' && taskStatus.progressPercent > 0
        ? taskStatus.progressPercent
        : getProgressPercentByStatus(currentRegistration?.status);
    const mentorDisplayName = dashboardData?.mentorFullName || currentRegistration?.topic?.mentor?.user?.fullName || currentRegistration?.topic?.mentorName || 'Chưa phân công';
    const mentorEmail = dashboardData?.registration?.topic?.mentor?.email || currentRegistration?.topic?.mentor?.email || 'Chưa cập nhật';
    const mentorDepartment = dashboardData?.registration?.topic?.mentor?.department || currentRegistration?.topic?.mentor?.department || 'Chưa cập nhật';
    const activeSemester = dashboardData?.activeSemester || currentRegistration?.semester || null;

    const milestones = useMemo(() => {
        const status = currentRegistration?.status;
        const fmt = (dateValue, prefix) => {
            if (!dateValue) return null;
            const parsed = dayjs(dateValue);
            return parsed.isValid() ? `${prefix ? `${prefix}: ` : ''}${parsed.format('DD/MM/YYYY')}` : null;
        };

        const isStep2Completed = ['BM01_PASSED', 'BM02_SUBMITTED', 'DECISION_ISSUED', 'IN_PROGRESS_BM03', 'BM03_PASSED', 'BM04_REVIEW', 'DEFENSE_READY', 'DEFENDED', 'DEFENSE_PASSED', 'PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'COMPLETED'].includes(status) || progressPercent >= 33;
        const isStep2Active = !isStep2Completed && ['APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED'].includes(status);
        let step2Sub = 'Xét duyệt đạt';
        if (status === 'BM01_SUBMITTED') step2Sub = 'Chờ duyệt đề cương';
        else if (status === 'BM01_NEEDS_REVISION') step2Sub = 'Cần chỉnh sửa';
        else if (status === 'BM01_RESUBMITTED') step2Sub = 'Đã nộp bản sửa';
        else if (status === 'TERMINATED_BM01') step2Sub = 'Dừng thực hiện';
        else if (status === 'APPROVED') step2Sub = 'Chờ nộp đề cương';
        else if (!isStep2Completed) step2Sub = 'Chưa nộp';

        const step1State = progressPercent >= 16 ? 'completed' : 'active';
        const step2State = isStep2Completed ? 'completed' : isStep2Active ? 'active' : 'pending';
        const step3State = progressPercent >= 50 ? 'completed' : progressPercent >= 33 ? 'active' : 'pending';
        const step4State = progressPercent >= 66 ? 'completed' : progressPercent >= 50 ? 'active' : 'pending';
        const step5State = progressPercent >= 83 ? 'completed' : progressPercent >= 66 ? 'active' : 'pending';
        const step6State = progressPercent >= 100 ? 'completed' : progressPercent >= 83 ? 'active' : 'pending';

        return [
            {
                key: 'step-1',
                stepNumber: 1,
                title: '1. Đăng ký đề tài',
                subText: hasAnyRegistration ? 'Đã duyệt' : 'Chưa đăng ký',
                dateText:
                    fmt(currentRegistration?.registeredAt, 'Đã ĐK') ||
                    fmt(activeSemester?.registrationDeadline, 'Hạn ĐK') ||
                    fmt(activeSemester?.startDate, 'Bắt đầu') ||
                    'Theo lịch đợt',
                state: step1State,
                icon: <FormOutlined />,
                onClick: () => navigate('/student/topics'),
                styleVars: {
                    '--step-color': '#0F766E',
                    '--step-soft': '#F0FDFA',
                    '--step-border': '#99F6E4',
                    '--step-glow': 'rgba(15, 118, 110, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #0F766E, #14B8A6)',
                },
            },
            {
                key: 'step-2',
                stepNumber: 2,
                title: '2. Đề cương chi tiết',
                subText: step2Sub,
                dateText:
                    fmt(outlineCouncil?.defenseDate, 'HĐ') ||
                    fmt(activeSemester?.outlineSubmissionDeadline, 'Hạn nộp') ||
                    fmt(activeSemester?.outlineSubmissionOpenAt, 'Mở nộp') ||
                    'Theo lịch Viện',
                state: step2State,
                icon: <FileTextOutlined />,
                onClick: () => navigate('/student/submissions?work=BM01_INITIAL'),
                styleVars: {
                    '--step-color': '#0284C7',
                    '--step-soft': '#F0F9FF',
                    '--step-border': '#BAE6FD',
                    '--step-glow': 'rgba(2, 132, 199, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #0284C7, #38BDF8)',
                },
            },
            {
                key: 'step-3',
                stepNumber: 3,
                title: '3. Đơn ĐK chính thức',
                subText: currentRegistration?.decisionNumber || 'Ban hành QĐ',
                dateText:
                    fmt(currentRegistration?.decisionDate, 'QĐ') ||
                    fmt(activeSemester?.outlineSubmissionDeadline, 'Sau BM01') ||
                    'Chờ ban hành',
                state: step3State,
                icon: <AuditOutlined />,
                onClick: () => setBm02ModalOpen(true),
                styleVars: {
                    '--step-color': '#4F46E5',
                    '--step-soft': '#EEF2FF',
                    '--step-border': '#C7D2FE',
                    '--step-glow': 'rgba(79, 70, 229, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #4F46E5, #818CF8)',
                },
            },
            {
                key: 'step-4',
                stepNumber: 4,
                title: '4. Nhật ký tiến độ',
                subText: '2 Checkpoint',
                dateText:
                    fmt(bm03Record?.advisorSignedAt, 'Ký') ||
                    fmt(activeSemester?.bm03MidtermEvaluationOpenAt, 'Giữa kỳ') ||
                    fmt(activeSemester?.midtermReportDate, 'Mốc') ||
                    'Trong học kỳ',
                state: step4State,
                icon: <ScheduleOutlined />,
                onClick: () => navigate(
                    currentRegistration?.status === 'BM03_SIGNATURE_PENDING' || bm03Record?.studentAckStatus === 'PENDING'
                        ? '/student/submissions?work=BM03_ACK'
                        : '/student/submissions?work=BM03'
                ),
                styleVars: {
                    '--step-color': '#7C3AED',
                    '--step-soft': '#F5F3FF',
                    '--step-border': '#DDD6FE',
                    '--step-glow': 'rgba(124, 58, 237, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #7C3AED, #A78BFA)',
                },
            },
            {
                key: 'step-5',
                stepNumber: 5,
                title: '5. Nhận xét GVHD',
                subText: 'Đánh giá BM04',
                dateText:
                    fmt(currentRegistration?.bm04SignedAt || bm04Record?.signedAt || bm04Record?.createdAt, 'Ký') ||
                    fmt(activeSemester?.bm03FinalizationOpenAt, 'Mở từ') ||
                    'Trước bảo vệ',
                state: step5State,
                icon: <CommentOutlined />,
                onClick: () => navigate('/student/submissions?work=BM04'),
                styleVars: {
                    '--step-color': '#D97706',
                    '--step-soft': '#FFFBEB',
                    '--step-border': '#FDE68A',
                    '--step-glow': 'rgba(217, 119, 6, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #D97706, #F59E0B)',
                },
            },
            {
                key: 'step-6',
                stepNumber: 6,
                title: '6. Hội đồng bảo vệ',
                subText: 'Điểm tổng hợp',
                dateText:
                    fmt(defenseDossier?.timeWindows?.defenseDateYmd || defenseDossier?.timeWindows?.defenseSnapshotAt, 'BV') ||
                    fmt(activeSemester?.defenseDate, 'Dự kiến') ||
                    fmt(activeSemester?.endDate, 'Kết thúc') ||
                    'Theo lịch Viện',
                state: step6State,
                icon: <TrophyOutlined />,
                onClick: () => navigate('/student/grades'),
                styleVars: {
                    '--step-color': '#059669',
                    '--step-soft': '#ECFDF5',
                    '--step-border': '#A7F3D0',
                    '--step-glow': 'rgba(5, 150, 105, 0.35)',
                    '--step-gradient': 'linear-gradient(135deg, #059669, #10B981)',
                },
            },
        ];
    }, [
        activeSemester,
        bm03Record,
        bm04Record,
        currentRegistration,
        defenseDossier,
        hasAnyRegistration,
        navigate,
        outlineCouncil,
        progressPercent,
    ]);

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
        if (!currentRegistration?.decisionNumber) {
            message.info('Chưa có số quyết định để tải.');
            return;
        }
        message.success(`Đang chuẩn bị văn bản in quyết định số ${currentRegistration.decisionNumber}`);
        setBm02ModalOpen(false);
    };

    if (studentDashboardQuery.isPending) {
        return (
            <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
                <ContentSkeleton rows={6} />
            </div>
        );
    }

    if (studentDashboardQuery.isError) {
        return (
            <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
                <QueryErrorState error={studentDashboardQuery.error} onRetry={() => studentDashboardQuery.refetch()} />
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
        <div data-od-id="view-dashboard" className="sub-view sd-page">
            {/* BM03 48h Acknowledgement Banner */}
            {bm03Record?.advisorSignedAt && bm03Record?.studentAckStatus === 'PENDING_STUDENT_ACKNOWLEDGEMENT' && (
                <Alert
                    type="warning"
                    showIcon
                    className="sd-animate-in"
                    style={{ '--sd-delay': 0, marginBottom: 20, borderRadius: 12 }}
                    title={<span style={{ fontWeight: 700, fontSize: 14 }}>Xác nhận đã biết Phiếu theo dõi tiến độ BM03 (Thời hạn 48 giờ)</span>}
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
                />
            )}

            {/* Prominent Next Academic Action Card */}
            <section
                aria-labelledby="student-next-action-heading"
                className="sd-panel sd-animate-in"
                style={{
                    '--sd-delay': 0,
                    marginBottom: 20,
                    padding: '18px 20px',
                    borderLeft: canNavigateNextAction ? '6px solid #0F766E' : '6px solid #64748B',
                    background: canNavigateNextAction
                        ? 'linear-gradient(90deg, #F0FDFA 0%, #FFFFFF 100%)'
                        : '#FFFFFF',
                }}
            >
                {nextAction ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span
                                    id="student-next-action-heading"
                                    className="text-xs font-bold uppercase tracking-wide text-slate-600"
                                >
                                    Bước tiếp theo
                                </span>
                                {canNavigateNextAction ? (
                                    <span className="tag teal inline-flex items-center gap-1">
                                        <CheckCircleOutlined />
                                        <span>Cần thực hiện</span>
                                    </span>
                                ) : (
                                    <span className="tag yellow inline-flex items-center gap-1">
                                        <ClockCircleOutlined />
                                        <span>Đang chờ xử lý</span>
                                    </span>
                                )}
                                {nextActionDueText && (
                                    <span className="tag blue inline-flex items-center gap-1">
                                        <CalendarOutlined />
                                        <span>Hạn: {nextActionDueText}</span>
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 m-0">
                                {nextAction.title}
                            </h2>
                            {nextAction.description && (
                                <p className="text-sm text-slate-600 mt-1 mb-0 leading-relaxed">
                                    {nextAction.description}
                                </p>
                            )}
                        </div>
                        {canNavigateNextAction && (
                            <div className="shrink-0">
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<ArrowRightOutlined />}
                                    onClick={() => navigate(nextAction.target)}
                                >
                                    {getNextActionCtaLabel(nextAction.kind)}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2
                                id="student-next-action-heading"
                                className="text-base font-bold text-slate-800 m-0"
                            >
                                Hiện chưa có bước tiếp theo cần thực hiện
                            </h2>
                            <p className="text-sm text-slate-500 mt-1 mb-0">
                                {hasAnyRegistration
                                    ? 'Theo dõi thông tin đề tài, lộ trình và thông báo học vụ bên dưới.'
                                    : 'Bạn chưa có đăng ký đề tài trong đợt hiện tại.'}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* Topic Hero Banner Card */}
            {hasAnyRegistration && currentRegistration?.topic ? (
                <div className="sd-hero-card sd-animate-in" style={{ '--sd-delay': 0 }}>
                    <div className="sd-hero-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                            <div style={{ maxWidth: 820 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span className="sd-code-badge">
                                        <span className="sd-code-dot" aria-hidden="true" />
                                        <span>
                                            MÃ ĐỀ TÀI: {currentRegistration.topic?.topicCode || currentRegistration.topic?.code || (currentRegistration.topic?.id ? `DT-${String(currentRegistration.topic.id).padStart(3, '0')}` : 'Chưa cập nhật')}
                                        </span>
                                    </span>
                                    {renderRegistrationStatusTag()}
                                </div>
                                <h2 className="sd-hero-title">
                                    {currentRegistration.adjustedTitle || currentRegistration.topic.title}
                                </h2>
                                <div className="sd-hero-sub">
                                    <span>
                                        Chuyên ngành: <strong>{currentRegistration.topic.projectCatalogName || 'Đồ án tốt nghiệp'}</strong>
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                        Học kỳ: <strong>{currentRegistration.topic.semesterName || activeSemester?.name || 'Chưa cập nhật'}</strong>
                                    </span>
                                </div>
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
                                <Button
                                    size="small"
                                    icon={<MessageOutlined />}
                                    onClick={() => {
                                        const el = document.getElementById('mentor-contact-box');
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    Trao đổi GVHD
                                </Button>
                                {currentRegistration.decisionNumber ? (
                                    <Button
                                        size="small"
                                        icon={<FileTextOutlined />}
                                        onClick={() => setBm02ModalOpen(true)}
                                    >
                                        Quyết định giao đề tài
                                    </Button>
                                ) : null}
                                {['BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'].includes(currentRegistration?.status) && (
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? <ExclamationCircleOutlined /> : <FileDoneOutlined />}
                                        onClick={() => navigate(currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '/student/submissions?work=BM03_APPEAL' : '/student/submissions?work=BM03_ACK')}
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
                                    <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        disabled={!titleAdjustmentOpen}
                                        onClick={() => setTitleModalOpen(true)}
                                    >
                                        {titleAdjustmentOpen ? `Đề xuất sửa tên (${titleAdjustmentDaysRemaining} ngày)` : 'Đã hết hạn sửa tên'}
                                    </Button>
                                )}
                                {canWithdraw && (
                                    <Button
                                        size="small"
                                        danger
                                        icon={<WarningOutlined />}
                                        onClick={() => setWithdrawModalOpen(true)}
                                    >
                                        Xin hoãn/rút
                                    </Button>
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
                                    background: titleAdjustmentOpen ? 'rgba(240, 253, 250, 0.9)' : '#FEF2F2',
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

                        <div className="sd-meta-grid">
                            <div className="sd-meta-item">
                                <div className="sd-meta-icon">
                                    <UserOutlined />
                                </div>
                                <div>
                                    <div className="topic-meta-label">Giảng viên hướng dẫn</div>
                                    <div className="topic-meta-val">{mentorDisplayName}</div>
                                </div>
                            </div>

                            <div className="sd-meta-item">
                                <div className="sd-meta-icon">
                                    <TeamOutlined />
                                </div>
                                <div>
                                    <div className="topic-meta-label">Sinh viên thực hiện</div>
                                    <div className="topic-meta-val">{user?.fullName || 'Sinh viên'} (1 SV / 1 đề tài)</div>
                                </div>
                            </div>

                            <div className="sd-meta-item">
                                <div className="sd-meta-icon" style={nearestDeadline ? { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' } : undefined}>
                                    <CalendarOutlined />
                                </div>
                                <div>
                                    <div className="topic-meta-label">Hạn chót tiếp theo</div>
                                    <div className="topic-meta-val" style={{ color: nearestDeadline ? '#DC2626' : '#0F172A' }}>
                                        {nearestDeadline ? `${dayjs(nearestDeadline.date).format('DD/MM/YYYY')} (${nearestDeadline.title})` : 'Đang đúng lộ trình'}
                                    </div>
                                </div>
                            </div>

                            <div className="sd-meta-item">
                                <div className="sd-meta-icon">
                                    <SafetyCertificateOutlined />
                                </div>
                                <div>
                                    <div className="topic-meta-label">Dự kiến bảo vệ</div>
                                    <div className="topic-meta-val" style={{ color: '#0F766E', fontWeight: 700 }}>
                                        {currentRegistration.status === 'DEFENSE_READY'
                                            ? 'Đủ điều kiện ra Hội đồng'
                                            : currentRegistration.status === 'DEFENDED'
                                              ? 'Đã bảo vệ xong'
                                              : activeSemester?.defenseDate
                                                ? dayjs(activeSemester.defenseDate).format('DD/MM/YYYY')
                                                : 'Chưa cập nhật'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="sd-hero-card sd-animate-in" style={{ '--sd-delay': 0, textAlign: 'center', padding: '40px 24px' }}>
                    <div className="sd-hero-content">
                        <div
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 16,
                                background: 'linear-gradient(135deg, #0F766E, #2563EB)',
                                color: '#FFFFFF',
                                display: 'grid',
                                placeItems: 'center',
                                margin: '0 auto 16px',
                                fontSize: 26,
                                boxShadow: '0 10px 20px -8px rgba(15, 118, 110, 0.45)',
                            }}
                        >
                            <BookOutlined />
                        </div>
                        <h3 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                            Bạn chưa đăng ký đề tài tốt nghiệp
                        </h3>
                        <p style={{ fontSize: 13.5, color: '#475569', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
                            Vui lòng duyệt danh sách các đề tài của các Bộ môn đang mở tiếp nhận sinh viên để đăng ký ngay.
                        </p>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ArrowRightOutlined />}
                            onClick={() => navigate('/student/topics')}
                        >
                            Xem Danh Mục Đề Tài Ngay
                        </Button>
                    </div>
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
                    className="sd-panel sd-animate-in"
                    style={{
                        '--sd-delay': 1,
                        marginBottom: 24,
                        padding: '16px 20px',
                        borderLeft: '6px solid #0F766E',
                        background: 'linear-gradient(90deg, #F0FDFA 0%, #FFFFFF 100%)',
                        borderColor: '#99F6E4',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F766E', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BankOutlined />
                                <span>Phiên Bảo Vệ &amp; Xét Duyệt Đề Cương: {outlineCouncil.name}</span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13, color: '#115E59', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                {outlineCouncil.defenseDate && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        <ClockCircleOutlined />
                                        <span>Thời gian bảo vệ: <strong>{dayjs(outlineCouncil.defenseDate).format('DD/MM/YYYY HH:mm')}</strong></span>
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
                                <Button
                                    type="primary"
                                    size="small"
                                    href={outlineCouncil.meetingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Tham gia Teams
                                </Button>
                            )}
                            <Button
                                size="small"
                                onClick={() => navigate('/student/submissions?work=BM01_INITIAL')}
                            >
                                Chi tiết đề cương
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pre-Defense & Post-Defense Archive Deadline & Missing Documents Banner */}
            {[
                'BM03_PASSED',
                'BM04_REVIEW',
                'DEFENSE_READY',
                'DEFENSE_ELIGIBLE',
                'ELIGIBLE_BY_INSTITUTE',
                'DEFENSE_PASSED',
                'DEFENDED',
                'PENDING_INSTITUTE_SIGNATURE',
                'ARCHIVE_INCOMPLETE',
                'ARCHIVE_REJECTED',
                'COMPLETED',
            ].includes(currentRegistration?.status) && (
                <div className="sd-animate-in space-y-3" style={{ '--sd-delay': 1, marginBottom: 24 }}>
                    <ArchiveDeadlineBanner
                        dossier={defenseDossier}
                        archiveSummary={dashboardData?.archiveSummary}
                        registrationStatus={currentRegistration?.status}
                        variant="prominent"
                        onAction={() => navigate('/student/grades')}
                        actionLabel="Vào kho lưu chiểu"
                        showAction={currentRegistration?.status !== 'COMPLETED'}
                    />
                    {currentRegistration?.status === 'COMPLETED' && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleDownloadCertificate}
                            >
                                Tải Giấy Xác Nhận (PDF)
                            </Button>
                            <Button
                                icon={<TrophyOutlined />}
                                onClick={() => navigate('/student/grades')}
                            >
                                Xem điểm bảo vệ
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* 6-Stage Interactive Milestone Stepper Flow */}
            <AcademicRoadmapStepper
                role="STUDENT"
                title="Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)"
                subtitle="Theo dõi trạng thái từng giai đoạn và mốc thời gian quan trọng của học kỳ"
                badgeLabel={`${progressPercent}% Hoàn tất`}
                progressPercent={progressPercent}
                milestones={milestones}
                className="sd-animate-in"
            />

            {/* 4 Key Stat Cards */}
            <div className="sd-kpi-grid sd-animate-in" style={{ '--sd-delay': 2 }}>
                <div className="sd-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #0F766E, #14B8A6)' }}>
                    <div className="sd-kpi-icon" style={{ background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1' }}>
                        <CheckCircleOutlined />
                    </div>
                    <div>
                        <div className="sd-kpi-label">Tiến độ tổng thể</div>
                        <div className="sd-kpi-value">{progressPercent}%</div>
                        <div className="sd-kpi-hint">Theo quy trình 6 mốc</div>
                    </div>
                </div>

                <div className="sd-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #2563EB, #38BDF8)' }}>
                    <div className="sd-kpi-icon" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                        <FileTextOutlined />
                    </div>
                    <div>
                        <div className="sd-kpi-label">Mốc quy trình hoàn thành</div>
                        <div className="sd-kpi-value">{milestones.filter((m) => m.state === 'completed').length} / 6</div>
                        <div className="sd-kpi-hint">Theo chuẩn quy trình 6 mốc</div>
                    </div>
                </div>

                <div className="sd-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #D97706, #FBBF24)' }}>
                    <div className="sd-kpi-icon" style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                        <ClockCircleOutlined />
                    </div>
                    <div>
                        <div className="sd-kpi-label">Số buổi trao đổi GVHD</div>
                        <div className="sd-kpi-value">{dashboardData?.meetingLogsCount ?? 0} buổi</div>
                        <div className="sd-kpi-hint">Nhật ký hướng dẫn BM03</div>
                    </div>
                </div>

                <div className="sd-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #7C3AED, #A78BFA)' }}>
                    <div className="sd-kpi-icon" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                        <StarOutlined />
                    </div>
                    <div>
                        <div className="sd-kpi-label">Điểm đánh giá GVHD</div>
                        {(() => {
                            const rawMentorScore = dashboardData?.mentorScore;
                            const hasNumericScore = rawMentorScore !== null
                                && rawMentorScore !== undefined
                                && rawMentorScore !== ''
                                && Number.isFinite(Number(rawMentorScore));
                            const rawConclusion = dashboardData?.mentorConclusion || bm04Record?.conclusion || bm04Record?.decision || null;
                            const conclusionLabelMap = {
                                ELIGIBLE: 'Đủ điều kiện BV',
                                DEFENSE_ELIGIBLE: 'Đủ điều kiện BV',
                                APPROVED: 'Đủ điều kiện BV',
                                ALLOW_DEFENSE: 'Đủ điều kiện BV',
                                NOT_ELIGIBLE: 'Chưa đủ điều kiện',
                                REJECTED: 'Chưa đủ điều kiện',
                            };
                            const displayConclusion = rawConclusion
                                ? (conclusionLabelMap[rawConclusion] || String(rawConclusion))
                                : (bm04Record?.status === 'SIGNED_APPROVED' || bm04Record?.status === 'COMPLETED' ? 'Đã nhận xét' : 'Chưa có');
                            return (
                                <div className="sd-kpi-value" style={{ fontSize: hasNumericScore ? 22 : 16 }}>
                                    {hasNumericScore ? `${Number(rawMentorScore).toFixed(1)} / 10` : displayConclusion}
                                </div>
                            );
                        })()}
                        <div className="sd-kpi-hint">Phiếu nhận xét BM04</div>
                    </div>
                </div>
            </div>

            {/* Dashboard Split Grid */}
            <div className="dashboard-split sd-animate-in" style={{ '--sd-delay': 3 }}>
                {/* Left Column: Mentor & Student Profile with Academic Exchange info */}
                <div>
                    {/* Team & Mentor Card */}
                    <div className="sd-panel" id="mentor-contact-box">
                        <div className="sd-panel-header">
                            <div className="sd-panel-title">
                                <TeamOutlined style={{ color: '#2563EB', fontSize: 16 }} />
                                <span>Cán bộ Hướng dẫn &amp; Sinh viên thực hiện</span>
                            </div>
                            <span className="tag teal">1 SV / 1 đề tài</span>
                        </div>
                        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
                                <div className="student-avatar" style={{ width: 52, height: 52, fontSize: 15, fontWeight: 700 }}>
                                    GVHD
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                                        {mentorDisplayName}
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                                        {mentorDepartment} · Email: <strong>{mentorEmail}</strong>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#0F766E', marginTop: 4, fontWeight: 600 }}>
                                        Cán bộ phụ trách hướng dẫn chính
                                    </div>
                                </div>
                            </div>

                            {/* Kênh trao đổi học vụ định kỳ qua Sổ theo dõi tiến độ BM03 */}
                            <div style={{ padding: '14px 16px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ScheduleOutlined style={{ color: '#0F766E', fontSize: 16 }} />
                                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0F766E' }}>
                                            Kênh trao đổi học vụ định kỳ (BM03)
                                        </span>
                                    </div>
                                    <span className="tag teal">{dashboardData?.meetingLogsCount ?? 0} buổi đã ghi nhận</span>
                                </div>
                                <p style={{ fontSize: 12, color: '#115E59', marginTop: 6, marginBottom: 10, lineHeight: 1.5 }}>
                                    Tiến độ đồ án được theo dõi trực tiếp thông qua Sổ theo dõi tiến độ BM03. Sinh viên làm việc định kỳ với GVHD để cập nhật nhật ký trao đổi, khối lượng thực hiện và đánh giá các mốc Checkpoint.
                                </p>
                                <Button
                                    size="small"
                                    icon={<FileDoneOutlined />}
                                    onClick={() => navigate(
                                        currentRegistration?.status === 'BM03_SIGNATURE_PENDING' || bm03Record?.studentAckStatus === 'PENDING'
                                            ? '/student/submissions?work=BM03_ACK'
                                            : '/student/submissions?work=BM03'
                                    )}
                                >
                                    Xem sổ theo dõi tiến độ BM03
                                </Button>
                            </div>

                            <div>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                                    Sinh viên phụ trách đề tài:
                                </div>
                                <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                                            {user?.fullName || 'Sinh viên'}
                                        </span>
                                        <span className="tag teal">Chủ nhiệm đề tài</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                        MSSV: <strong>{user?.code || '---'}</strong> · Lớp/Khóa: <strong>{user?.studentProfile?.academicYear || 'Chưa cập nhật'}</strong> · Email: <strong>{user?.email || '---'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Academic Announcements & Forms Download */}
                <div>
                    <div className="sd-panel" style={{ marginBottom: 24 }}>
                        <div className="sd-panel-header">
                            <div className="sd-panel-title">
                                <BellOutlined style={{ color: '#D97706', fontSize: 16 }} />
                                <span>Thông báo học vụ quan trọng</span>
                            </div>
                        </div>
                        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="sd-notice-item is-highlight">
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F766E' }}>
                                    Lưu ý mốc thời gian nộp biểu mẫu BM01–BM04
                                </div>
                                <div style={{ fontSize: 11.5, color: '#115E59', marginTop: 3 }}>
                                    Theo dõi sát ngày đến hạn ngay bên dưới từng mốc trên thanh Lộ trình để nộp hồ sơ đúng quy định.
                                </div>
                            </div>

                            <div className="sd-notice-item">
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A' }}>
                                    Mẫu định dạng Báo cáo toàn văn Đồ án
                                </div>
                                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 3 }}>
                                    Viện Công nghệ Số cập nhật mẫu quyển báo cáo &amp; biểu mẫu chuẩn tại Cổng thông tin học vụ.
                                </div>
                            </div>

                            <div className="sd-notice-item">
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A' }}>
                                    Kiểm tra liêm chính học thuật &amp; nộp lưu chiểu
                                </div>
                                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 3 }}>
                                    Sinh viên chuẩn bị đầy đủ file mềm, mã nguồn và báo cáo để hoàn tất hồ sơ lưu chiểu sau bảo vệ.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Document Templates Download Card */}
                    <div className="sd-panel">
                        <div className="sd-panel-header">
                            <div className="sd-panel-title">
                                <DownloadOutlined style={{ color: '#0F766E', fontSize: 16 }} />
                                <span>Tài liệu &amp; Biểu mẫu chuẩn</span>
                            </div>
                        </div>
                        <div style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div className="sd-template-item">
                                    <span>Đề cương nghiên cứu chi tiết (BM01)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </div>
                                <div className="sd-template-item">
                                    <span>Nhật ký &amp; Đánh giá tiến độ (BM03)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </div>
                                <div className="sd-template-item">
                                    <span>Mẫu Slide báo cáo bảo vệ Hội đồng (.pptx)</span>
                                    <Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">
                                        <Button size="small" disabled icon={<DownloadOutlined />}>Tải về</Button>
                                    </Tooltip>
                                </div>
                            </div>
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
                            Số: <strong>{currentRegistration?.decisionNumber || 'Chưa cập nhật'}</strong> · Ngày ký: {currentRegistration?.decisionDate ? dayjs(currentRegistration.decisionDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p>Tên đề tài: <strong>{currentRegistration?.topic?.title}</strong></p>
                        <p>Sinh viên thực hiện: <strong>{user?.fullName} — MSSV: {user?.code}</strong></p>
                        <p>Cán bộ hướng dẫn: <strong>{mentorDisplayName}</strong></p>
                        <p>Quy chuẩn đào tạo: Khóa {user?.studentProfile?.academicYear || 'Chưa cập nhật'} · {currentRegistration?.semester?.name || currentRegistration?.topic?.semesterName || activeSemester?.name || 'Chưa cập nhật'}</p>
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
                onSuccess={() => studentDashboardQuery.refetch()}
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
                        title="Thời hạn phản hồi: 48 giờ"
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
