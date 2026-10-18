import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Tag, Tooltip, message } from 'antd';
import {
    ArrowRightOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    LogoutOutlined,
    UploadOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import dashboardService from '../../services/dashboardService';
import registrationService from '../../services/registrationService';
import PageHeader from '../../components/common/PageHeader';
import PageLoader from '../../components/common/PageLoader';
import StatCard from '../../components/common/StatCard';

import TitleAdjustmentModal from '../../components/student/TitleAdjustmentModal';

const ACTIVE_FLOW_STATUSES = [
    'APPROVED',
    'BM01_SUBMITTED',
    'BM01_PASSED',
    'BM01_NEEDS_REVISION',
    'BM02_SUBMITTED',
    'DECISION_ISSUED',
    'IN_PROGRESS_BM03',
    'BM03_PASSED',
    'DEFENSE_READY',
    'DEFENDED',
    'COMPLETED',
    'TERMINATED_FAILED_PROGRESS',
];
const WITHDRAWABLE_STATUSES = ['APPROVED', 'BM01_SUBMITTED', 'BM01_PASSED', 'BM01_NEEDS_REVISION', 'BM02_SUBMITTED'];

const MILESTONES = [
    { key: 'REGISTRATION', label: '1. Đăng ký', sub: 'Duyệt đề tài' },
    { key: 'BM01', label: '2. BM01', sub: 'Đề cương' },
    { key: 'BM02', label: '3. BM02', sub: 'Quyết định Viện' },
    { key: 'BM03', label: '4. BM03', sub: '2 Checkpoint' },
    { key: 'BM04', label: '5. BM04', sub: 'Đánh giá GVHD' },
    { key: 'DEFENSE', label: '6. Bảo vệ', sub: 'Hội đồng chấm' },
];

function StudentDashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [titleModalOpen, setTitleModalOpen] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getStudentStats();
            if (res.success) {
                setData(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) {
        return <PageLoader />;
    }

    const { hasRegistration, registrationDetails, taskStatus, upcomingDeadlines } = data || {};
    const hasAnyRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const isActiveFlow = ACTIVE_FLOW_STATUSES.includes(currentRegistration?.status);
    const canWithdraw = hasAnyRegistration && WITHDRAWABLE_STATUSES.includes(currentRegistration?.status);
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    const total = taskStatus?.total || 0;
    const submitted = taskStatus?.submitted || 0;
    const completed = taskStatus?.completed || 0;
    const overdue = taskStatus?.overdue || 0;
    const progressPercent = taskStatus?.progressPercent || 0;

    const renderRegistrationStatusTag = () => {
        if (!hasAnyRegistration) {
            return <Tag color="error">Chưa đăng ký đề tài</Tag>;
        }
        const status = currentRegistration?.status;
        if (status === 'PENDING') return <Tag color="warning">Chờ duyệt đề tài</Tag>;
        if (status === 'REJECTED') return <Tag color="error">Bị từ chối</Tag>;
        if (status === 'DROPPED') return <Tag color="default">Đã hủy</Tag>;
        if (status === 'WITHDRAWN') return <Tag color="orange">Đã rút đề tài</Tag>;
        if (status === 'APPROVED') return <Tag color="processing">Đã nhận đề tài</Tag>;
        if (status === 'BM01_SUBMITTED') return <Tag color="blue">Chờ duyệt đề cương BM01</Tag>;
        if (status === 'BM01_PASSED') return <Tag color="success">Đề cương Đạt (Chuẩn bị BM02)</Tag>;
        if (status === 'BM01_NEEDS_REVISION') return <Tag color="error">BM01 Cần chỉnh sửa</Tag>;
        if (status === 'BM02_SUBMITTED') return <Tag color="cyan">Chờ Quyết định Viện</Tag>;
        if (status === 'DECISION_ISSUED') return <Tag color="purple">Đã có QĐ (Cửa sổ 7 ngày đổi tên)</Tag>;
        if (status === 'IN_PROGRESS_BM03') return <Tag color="processing">Đang thực hiện BM03</Tag>;
        if (status === 'BM03_PASSED') return <Tag color="geekblue">Đạt BM03 (Chờ BM04)</Tag>;
        if (status === 'DEFENSE_READY') return <Tag color="success">Đủ điều kiện bảo vệ</Tag>;
        if (status === 'DEFENDED') return <Tag color="gold">Đã bảo vệ</Tag>;
        if (status === 'COMPLETED') return <Tag color="success">Hoàn thành đồ án</Tag>;
        if (status === 'TERMINATED_FAILED_PROGRESS') return <Tag color="red">Dừng do trượt tiến độ</Tag>;
        return <Tag color="processing">Đang thực hiện</Tag>;
    };

    const handleWithdrawRegistration = async () => {
        if (!withdrawReason.trim()) {
            message.warning('Vui lòng nhập lý do rút đăng ký.');
            return;
        }
        if (!currentRegistration?.registrationId) {
            message.error('Không tìm thấy thông tin đăng ký.');
            return;
        }
        try {
            setWithdrawing(true);
            const res = await registrationService.withdrawRegistration(currentRegistration.registrationId, withdrawReason.trim());
            if (res.success) {
                message.success('Đã rút đăng ký thành công.');
                setWithdrawModalOpen(false);
                setWithdrawReason('');
                await fetchDashboardData();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể rút đăng ký lúc này.');
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Sinh viên' },
                    { label: 'Bàn làm việc' },
                ]}
                title="Bàn làm việc Sinh viên"
                subtitle="Theo dõi tiến độ thực hiện đề tài, cập nhật biểu mẫu BM01-BM04 và giám sát hạn nộp học vụ."
                tags={[
                    { label: user?.fullName || 'Sinh viên', color: 'blue' },
                    { label: user?.code ? `MSSV: ${user.code}` : '', color: 'default' },
                ]}
                actions={
                    hasAnyRegistration && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                onClick={() => navigate('/student/submissions')}
                            >
                                Nộp báo cáo
                            </Button>
                        </div>
                    )
                }
            />

            {/* Hero Roadmap Banner */}
            {hasAnyRegistration && currentRegistration?.topic ? (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="space-y-1.5 max-w-3xl">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                        ĐỀ TÀI ĐANG THỰC HIỆN
                                    </span>
                                    {renderRegistrationStatusTag()}
                                </div>
                                <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
                                    {currentRegistration.topic.title}
                                </h2>
                                <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                                    <span>Học phần: <b>{currentRegistration.topic.projectCatalogName || 'Đồ án tốt nghiệp'}</b></span>
                                    <span>•</span>
                                    <span>Học kỳ: <b>{currentRegistration.topic.semesterName || 'Học kỳ hiện tại'}</b></span>
                                </p>
                            </div>

                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs self-start lg:self-center">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <UserOutlined />
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">GVHD Phụ trách</p>
                                    <p className="text-sm font-bold text-slate-800 leading-tight">
                                        {currentRegistration.topic.mentorName || 'Chưa phân công'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Milestone Progress Journey */}
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                            <span>Lộ trình thực hiện khóa luận</span>
                            <span className="text-blue-600 font-bold">{progressPercent}% hoàn thành</span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                            {MILESTONES.map((step, idx) => {
                                const isPassed = progressPercent >= ((idx + 1) / 6) * 100;
                                const isCurrent = !isPassed && progressPercent >= (idx / 6) * 100;

                                return (
                                    <div
                                        key={step.key}
                                        className={`p-2.5 rounded-lg border text-center transition-all ${
                                            isPassed
                                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                                : isCurrent
                                                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs ring-1 ring-blue-400/30'
                                                    : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
                                        }`}
                                    >
                                        <div className="text-xs font-bold flex items-center justify-center gap-1">
                                            {isPassed && <CheckCircleOutlined className="text-emerald-600" />}
                                            {step.label}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{step.sub}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-10 text-center space-y-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                        <span className="material-symbols-outlined">menu_book</span>
                    </div>
                    <div className="max-w-md mx-auto">
                        <h3 className="text-lg font-bold text-slate-800">Bạn chưa đăng ký đề tài tốt nghiệp</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Vui lòng duyệt danh sách đề tài đang mở đăng ký hoặc đề xuất đề tài mới để bắt đầu thực hiện đồ án.
                        </p>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate('/student/topics')}
                        className="font-medium"
                    >
                        Xem danh sách đề tài ngay
                    </Button>
                </div>
            )}

            {/* Workflow Alerts */}
            {currentRegistration?.status === 'DECISION_ISSUED' && currentRegistration?.decisionDate && (
                (() => {
                    const expiry = dayjs(currentRegistration.decisionDate).add(7, 'day');
                    const isStillOpen = dayjs().isBefore(expiry);
                    const hoursLeft = Math.max(0, expiry.diff(dayjs(), 'hour'));
                    const daysLeft = Math.ceil(hoursLeft / 24);

                    return (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 font-bold text-lg">
                                    <ClockCircleOutlined />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-200/60 px-2 py-0.5 rounded">
                                            CỬA SỔ 7 NGÀY ĐỔI TÊN ĐỀ TÀI
                                        </span>
                                        {isStillOpen ? (
                                            <Tag color="purple" className="font-semibold text-xs">
                                                Còn {daysLeft} ngày ({hoursLeft} giờ)
                                            </Tag>
                                        ) : (
                                            <Tag color="default" className="text-xs">Đã hết hạn 7 ngày</Tag>
                                        )}
                                    </div>
                                    <p className="text-xs text-purple-900 mt-1">
                                        {currentRegistration.decisionNumber && <span>QĐ số: <b>{currentRegistration.decisionNumber}</b>. </span>}
                                        {currentRegistration.adjustedTitle ? (
                                            <span>Tên đề tài đã được cập nhật: <b>{currentRegistration.adjustedTitle}</b></span>
                                        ) : (
                                            <span>Trong vòng 7 ngày sau khi có Quyết định Viện, bạn được quyền nộp đơn xin điều chỉnh tên đề tài gửi GVHD duyệt trực tiếp.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {isStillOpen && (
                                <Button
                                    type="primary"
                                    onClick={() => setTitleModalOpen(true)}
                                    className="self-start sm:self-center !bg-purple-600 hover:!bg-purple-700"
                                >
                                    Đơn xin đổi tên đề tài
                                </Button>
                            )}
                        </div>
                    );
                })()
            )}

            {currentRegistration?.status === 'BM01_NEEDS_REVISION' && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold text-lg">
                            <ExclamationCircleOutlined />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">
                                Đề cương BM01 cần chỉnh sửa theo yêu cầu của Hội đồng xét duyệt
                            </p>
                            <p className="text-xs text-amber-800 mt-0.5">
                                Vui lòng chỉnh sửa nội dung/chức năng đề cương và nộp lại trên hệ thống để Giảng viên hướng dẫn thẩm định lại trước khi nộp BM02.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        onClick={() => navigate('/student/submissions')}
                        className="self-start sm:self-center !bg-amber-600 hover:!bg-amber-700"
                    >
                        Nộp lại đề cương BM01
                    </Button>
                </div>
            )}

            {currentRegistration?.status === 'DEFENSE_READY' && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-bold text-lg">
                            <CheckCircleOutlined />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-900">
                                ĐỦ ĐIỀU KIỆN RA HỘI ĐỒNG BẢO VỆ TỐT NGHIỆP
                            </p>
                            <p className="text-xs text-emerald-800 mt-0.5">
                                Giảng viên hướng dẫn đã đánh giá ĐỒNG Ý trong Phiếu nhận xét BM04. Đề tài của bạn đã sẵn sàng để Ban Quản Trị xếp lịch bảo vệ.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate('/student/submissions')}
                        className="self-start sm:self-center border-emerald-500 text-emerald-800 hover:bg-emerald-100"
                    >
                        Xem phiếu BM04
                    </Button>
                </div>
            )}

            {currentRegistration?.status === 'TERMINATED_FAILED_PROGRESS' && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 font-bold text-lg">
                            <ExclamationCircleOutlined />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-rose-900">
                                ĐỀ TÀI ĐÃ BỊ DỪNG THỰC HIỆN DO KHÔNG ĐẠT TIẾN ĐỘ
                            </p>
                            <p className="text-xs text-rose-800 mt-0.5">
                                Theo quy chế, kết quả đánh giá Checkpoint tiến độ BM03 không đạt yêu cầu. Đề tài bị dừng và sinh viên không đủ điều kiện ra bảo vệ trong đợt này.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts */}
            {isActiveFlow && overdue > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                            <ExclamationCircleOutlined className="text-lg" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-rose-900">
                                Bạn có {overdue} nhiệm vụ đã quá hạn nộp!
                            </p>
                            <p className="text-xs text-rose-700 mt-0.5">
                                Hãy hoàn thiện và nộp báo cáo sớm để giảng viên hướng dẫn kịp thời phê duyệt.
                            </p>
                        </div>
                    </div>
                    <Button
                        danger
                        type="primary"
                        onClick={() => navigate('/student/submissions')}
                        className="self-start sm:self-center"
                    >
                        Nộp báo cáo ngay
                    </Button>
                </div>
            )}

            {isActiveFlow && nearestDeadline && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                            <ClockCircleOutlined className="text-lg" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">Hạn nộp tiếp theo</p>
                            <p className="text-xs text-amber-800 mt-0.5">
                                <b>{nearestDeadline.title}</b> — Hạn chót: <b>{dayjs(nearestDeadline.date).format('DD/MM/YYYY HH:mm')}</b>
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate('/student/submissions')}
                        className="self-start sm:self-center border-amber-400 text-amber-900 hover:bg-amber-100"
                    >
                        Xem chi tiết
                    </Button>
                </div>
            )}

            {/* Key Stat Cards */}
            {hasAnyRegistration && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard
                        icon="assignment"
                        iconBg="bg-slate-100"
                        iconColor="text-slate-700"
                        label="Tổng nhiệm vụ được giao"
                        value={total}
                    />
                    <StatCard
                        icon="task"
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                        label="Báo cáo đã nộp"
                        value={submitted}
                    />
                    <StatCard
                        icon="check_circle"
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        label="Biểu mẫu đã duyệt"
                        value={completed}
                    />
                    <StatCard
                        icon="warning"
                        iconBg={overdue > 0 ? 'bg-rose-50' : 'bg-slate-50'}
                        iconColor={overdue > 0 ? 'text-rose-600' : 'text-slate-400'}
                        label="Nhiệm vụ quá hạn"
                        value={overdue}
                    />
                </div>
            )}

            {/* Split Content: Deadlines & Actions */}
            {hasAnyRegistration && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Cols: Deadlines */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600 text-base">event_upcoming</span>
                                Các mốc nộp sắp tới
                            </h3>
                            <Button
                                type="link"
                                onClick={() => navigate('/student/submissions')}
                                className="text-xs p-0"
                            >
                                Xem toàn bộ biểu mẫu &rarr;
                            </Button>
                        </div>

                        {upcomingDeadlines?.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {upcomingDeadlines.map((d) => (
                                    <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-800">{d.title}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <ClockCircleOutlined className="text-slate-400" />
                                                Hạn: {dayjs(d.date).format('DD/MM/YYYY HH:mm')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                                d.color === 'red'
                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    : d.color === '#fa8c16'
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                                            }`}>
                                                {d.color === 'red' ? 'Gấp' : d.color === '#fa8c16' ? 'Sắp đến hạn' : 'Tiêu chuẩn'}
                                            </span>
                                            <Button
                                                size="small"
                                                type="primary"
                                                onClick={() => navigate('/student/submissions')}
                                            >
                                                Nộp
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                Hiện không có hạn nộp nào đang chờ xử lý.
                            </div>
                        )}
                    </div>

                    {/* Right Col: Quick Actions & Profile */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-3">
                            <h3 className="text-sm font-bold text-slate-800">Thao tác nhanh</h3>
                            <Button
                                type="primary"
                                block
                                size="large"
                                icon={<UploadOutlined />}
                                onClick={() => navigate('/student/submissions')}
                                className="font-medium"
                            >
                                Nộp báo cáo BM
                            </Button>
                            <Button
                                block
                                size="large"
                                onClick={() => navigate('/student/grades')}
                                className="font-medium"
                            >
                                Xem điểm & Nhận xét HĐ
                            </Button>
                            {canWithdraw && (
                                <Button
                                    danger
                                    block
                                    icon={<LogoutOutlined />}
                                    onClick={() => setWithdrawModalOpen(true)}
                                    className="font-medium"
                                >
                                    Rút đăng ký đề tài
                                </Button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-3">
                            <h3 className="text-sm font-bold text-slate-800">Thông tin sinh viên</h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Họ và tên</span>
                                    <span className="font-semibold text-slate-800">{user?.fullName || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Mã số SV</span>
                                    <span className="font-mono font-semibold text-slate-800">{user?.code || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Email trường</span>
                                    <span className="font-medium text-slate-700">{user?.email || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-slate-500">Vai trò</span>
                                    <span className="font-semibold text-blue-600">Sinh viên thực hiện</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            <Modal
                title="Xác nhận rút đăng ký đề tài"
                open={withdrawModalOpen}
                onCancel={() => {
                    setWithdrawModalOpen(false);
                    setWithdrawReason('');
                }}
                onOk={handleWithdrawRegistration}
                confirmLoading={withdrawing}
                okText="Xác nhận rút"
                okButtonProps={{ danger: true }}
                cancelText="Hủy bỏ"
            >
                <div className="space-y-3 py-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Thao tác này sẽ hủy đăng ký đề tài hiện tại của bạn. Vui lòng nêu rõ lý do để Ban Chủ nhiệm khoa và Giảng viên hướng dẫn xem xét.
                    </p>
                    <Input.TextArea
                        rows={4}
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder="Ví dụ: Xin chuyển sang hướng nghiên cứu khác, lý do học tập cá nhân..."
                    />
                </div>
            </Modal>

            {/* Title Adjustment Modal (7-day window) */}
            <TitleAdjustmentModal
                visible={titleModalOpen}
                onClose={() => setTitleModalOpen(false)}
                registration={currentRegistration ? { ...currentRegistration, id: currentRegistration.registrationId } : null}
                onSuccess={() => {
                    fetchDashboardData();
                }}
            />
        </div>
    );
}

export default StudentDashboardPage;
