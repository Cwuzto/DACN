import { useMemo } from 'react';
import {
    Tag,
    Steps,
    Button,
    Card,
    Avatar,
    Alert,
    Tooltip,
} from 'antd';
import {
    BookOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    ScheduleOutlined,
    CloudUploadOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FileProtectOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useStudentRegistration } from '../../queries/registrationQueries';

function getStepCurrent(status) {
    switch (status) {
        case 'REGISTERED':
        case 'PENDING':
        case 'APPROVED':
            return { current: 0, status: 'process' };
        case 'BM01_SUBMITTED':
        case 'BM01_NEEDS_REVISION':
        case 'BM01_RESUBMITTED':
            return { current: 0, status: 'process' };
        case 'BM01_PASSED':
        case 'BM02_OPEN':
        case 'BM02_SUBMITTED':
        case 'BM02_NEEDS_REVISION':
        case 'BM02_RESUBMITTED':
        case 'BM02_APPROVED':
            return { current: 1, status: 'process' };
        case 'DECISION_ISSUED':
        case 'IN_PROGRESS':
        case 'IN_PROGRESS_BM03':
            return { current: 2, status: 'process' };
        case 'STOP_REVIEW_PENDING':
        case 'AUTO_NOT_ELIGIBLE':
        case 'TERMINATED_FAILED_PROGRESS':
            return { current: 2, status: 'error' };
        case 'BM03_PASSED':
        case 'BM04_REVIEW':
        case 'DEFENSE_READY':
        case 'DEFENSE_ELIGIBLE':
            return { current: 3, status: 'process' };
        case 'AWAITING_SCORES':
        case 'AWAITING_FINAL_APPROVAL':
        case 'DEFENSE_PASSED':
        case 'DEFENSE_FAILED':
        case 'COMPLETED':
        case 'DEFENDED':
            return { current: 4, status: 'finish' };
        default:
            return { current: 0, status: 'wait' };
    }
}

function StudentThesisProgressCard({ user, scope }) {
    const navigate = useNavigate();
    const registrationQuery = useStudentRegistration(scope, {}, Boolean(user?.id));
    const registration = registrationQuery.data?.data || registrationQuery.data;

    const topic = registration?.topic;
    const mentor = topic?.mentor;
    const semester = registration?.semester;

    const stepState = useMemo(() => {
        return getStepCurrent(registration?.status);
    }, [registration?.status]);

    const isStopped =
        registration?.status === 'STOP_REVIEW_PENDING' ||
        registration?.status === 'AUTO_NOT_ELIGIBLE' ||
        registration?.status === 'TERMINATED_FAILED_PROGRESS';

    if (registrationQuery.isLoading) {
        return <div className="p-8 text-center text-slate-400">Đang tải thông tin đồ án tốt nghiệp...</div>;
    }

    if (!registration) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
                <BookOutlined className="text-4xl text-slate-300" />
                <h4 className="text-base font-bold text-slate-800 m-0">
                    Chưa đăng ký đề tài trong đợt hiện tại
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto m-0">
                    Bạn hiện chưa có hồ sơ đăng ký đề tài tốt nghiệp trong học kỳ này hoặc đợt đăng ký chưa mở.
                </p>
                <div className="pt-2">
                    <Button
                        type="primary"
                        icon={<BookOutlined />}
                        onClick={() => navigate('/topics')}
                        className="rounded-lg font-medium"
                    >
                        Khám phá danh sách đề tài
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Warning Alert if Student was proposed to stop */}
            {isStopped && (
                <Alert
                    type="error"
                    showIcon
                    message="Cảnh báo tiến độ: Đề xuất dừng thực hiện đề tài"
                    description="Hồ sơ của bạn đang được Viện xem xét do tiến độ đánh giá giữa kỳ không đạt hoặc vắng các buổi gặp hướng dẫn. Vui lòng liên hệ ngay với Giảng viên hướng dẫn để được hỗ trợ."
                    className="rounded-xl border-red-200"
                />
            )}

            {/* 1. Main Active Thesis Hero Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-5 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <Tag color="cyan" className="font-semibold text-xs m-0">
                                {topic?.projectCatalog?.code || 'DATN'}
                            </Tag>
                            <span className="text-xs text-blue-100 font-medium">
                                {semester?.name || 'Đợt đồ án tốt nghiệp'}
                            </span>
                        </div>
                        {registration.decisionNumber && (
                            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded text-white font-mono">
                                Số QĐ: {registration.decisionNumber}
                            </span>
                        )}
                    </div>

                    <h3 className="text-lg md:text-xl font-bold text-white leading-snug m-0">
                        {topic?.title || 'Chưa cập nhật tên đề tài'}
                    </h3>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-6">
                    {/* Mentor Contact Box */}
                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <Avatar
                                size={52}
                                icon={<UserOutlined />}
                                src={mentor?.avatarUrl}
                                className="bg-blue-600 text-white flex-shrink-0 text-xl ring-2 ring-blue-100"
                            />
                            <div className="space-y-0.5">
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Giảng viên hướng dẫn (GVHD)
                                </div>
                                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <span>{mentor?.fullName || 'Chưa phân công'}</span>
                                    {mentor?.academicTitle && (
                                        <Tag color="blue" className="text-[10px] m-0 font-semibold">
                                            {mentor.academicTitle}
                                        </Tag>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {mentor?.department || 'Viện Công nghệ số'}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {mentor?.email && (
                                <Tooltip title="Gửi thư đến GVHD">
                                    <a
                                        href={`mailto:${mentor.email}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 font-mono transition-all"
                                    >
                                        <MailOutlined className="text-blue-600" />
                                        <span>{mentor.email}</span>
                                    </a>
                                </Tooltip>
                            )}
                            {mentor?.phone && (
                                <Tooltip title="Gọi điện liên hệ">
                                    <a
                                        href={`tel:${mentor.phone}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-300 font-mono transition-all"
                                    >
                                        <PhoneOutlined className="text-emerald-600" />
                                        <span>{mentor.phone}</span>
                                    </a>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Stepper Timeline (5 Stages) */}
                    <div className="pt-2">
                        <div className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                            <ClockCircleOutlined className="text-blue-600" />
                            Tiến trình thực hiện đồ án tốt nghiệp
                        </div>

                        <div className="px-2 overflow-x-auto">
                            <Steps
                                current={stepState.current}
                                status={stepState.status}
                                size="small"
                                items={[
                                    {
                                        title: '1. Đề cương BM01',
                                        description: 'Xét duyệt đề cương',
                                    },
                                    {
                                        title: '2. Giao đề tài BM02',
                                        description: 'QĐ Viện trưởng',
                                    },
                                    {
                                        title: '3. Tiến độ BM03',
                                        description: 'Họp & Checkpoint',
                                    },
                                    {
                                        title: '4. Đánh giá BM04',
                                        description: 'Phiếu nhận xét GVHD',
                                    },
                                    {
                                        title: '5. Bảo vệ & Lưu chiểu',
                                        description: 'Hội đồng chấm điểm',
                                    },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Quick Action Navigation Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                            Trạng thái hiện tại:{' '}
                            <Tag color="blue" className="font-semibold text-xs m-0">
                                {registration.status}
                            </Tag>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                icon={<ScheduleOutlined />}
                                onClick={() => navigate('/student/progress')}
                                className="rounded-lg text-xs font-medium"
                            >
                                Sổ tiến độ BM03
                            </Button>

                            <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                onClick={() => navigate('/student/submission')}
                                className="rounded-lg text-xs font-medium shadow-sm"
                            >
                                Nộp báo cáo học vụ
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StudentThesisProgressCard;
