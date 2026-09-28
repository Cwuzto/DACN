import { useState, useEffect, useMemo } from 'react';
import { message, Table, Tag, Tooltip, Progress, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    PlusOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    NotificationOutlined,
    RightOutlined,
    ArrowRightOutlined,
    EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import dashboardService from '../../services/dashboardService';
import useAuthStore from '../../stores/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PageLoader from '../../components/common/PageLoader';

function LecturerDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        activeTopics: 0,
        studentGroups: 0,
        completedRegistrations: 0,
        pendingFeedback: 0,
    });
    const [recentSubmissions, setRecentSubmissions] = useState([]);
    const [timelineEvents, setTimelineEvents] = useState([]);

    const fetchDashboardInfo = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getLecturerStats();
            if (res.success) {
                setStats(res.data.stats || {});
                setRecentSubmissions(res.data.recentSubmissions || []);
                setTimelineEvents(res.data.timelineEvents || []);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi tải dashboard giảng viên');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardInfo();
    }, []);

    const maxQuota = useMemo(() => {
        if (user?.maxStudents) return Number(user.maxStudents);
        if (user?.academicTitle === 'PHO_GIAO_SU') return 20;
        if (user?.academicTitle === 'TIEN_SI') return 15;
        return 10;
    }, [user]);

    if (loading) {
        return <PageLoader />;
    }

    const completionPercent = stats.studentGroups > 0
        ? Math.round((stats.completedRegistrations / stats.studentGroups) * 100)
        : 0;

    const feedbackHandledPercent = stats.studentGroups > 0
        ? Math.max(0, Math.min(100, Math.round(((stats.studentGroups - stats.pendingFeedback) / stats.studentGroups) * 100)))
        : 100;

    const academicTitleLabel = {
        THAC_SI: 'Thạc sĩ',
        TIEN_SI: 'Tiến sĩ',
        PHO_GIAO_SU: 'Phó Giáo sư',
    }[user?.academicTitle] || 'Giảng viên';

    const recentColumns = [
        {
            title: 'Sinh viên',
            key: 'student',
            width: 220,
            render: (_, item) => {
                const initials = (item.studentName || 'SV').trim().split(' ').slice(-1)[0][0]?.toUpperCase();
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-snug truncate">{item.studentName}</p>
                            <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                {item.studentCode || item.groupName || 'SV'}
                            </code>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Đề tài đồ án',
            dataIndex: 'topicTitle',
            key: 'topicTitle',
            ellipsis: true,
            render: (title) => (
                <Tooltip title={title}>
                    <span className="text-sm font-semibold text-slate-800 line-clamp-2">{title}</span>
                </Tooltip>
            ),
        },
        {
            title: 'Giai đoạn / Nhiệm vụ',
            dataIndex: 'taskTitle',
            key: 'taskTitle',
            width: 170,
            render: (taskTitle) => (
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200 inline-block">
                    {taskTitle || 'Báo cáo tiến độ'}
                </span>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 120,
            align: 'center',
            render: () => (
                <span className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Mới nộp
                </span>
            ),
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 100,
            align: 'right',
            render: () => (
                <Button
                    size="small"
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => navigate('/lecturer/progress')}
                    className="font-bold text-xs"
                >
                    Đánh giá
                </Button>
            ),
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Giảng viên' },
                    { label: 'Bảng điều khiển' },
                ]}
                title={`Xin chào, ${academicTitleLabel} ${user?.fullName || ''}`}
                subtitle="Theo dõi tiến độ hướng dẫn đồ án, tiếp nhận bài nộp của sinh viên và quản lý hạn mức quota đào tạo."
                tags={[
                    { label: `Học vị: ${academicTitleLabel}`, color: 'blue' },
                    { label: `Quota: ${stats.studentGroups}/${maxQuota} SV`, color: stats.studentGroups >= maxQuota ? 'red' : 'green' },
                ]}
                actions={
                    <Space>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => navigate('/lecturer/topics')}
                        >
                            Tạo đề tài mới
                        </Button>
                        <Button
                            icon={<CheckCircleOutlined />}
                            onClick={() => navigate('/lecturer/approvals')}
                            className="relative"
                        >
                            Duyệt sinh viên
                            {stats.pendingFeedback > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                                    {stats.pendingFeedback}
                                </span>
                            )}
                        </Button>
                    </Space>
                }
            />

            {/* 4 StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon="folder_open"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Đề tài đang mở"
                    value={stats.activeTopics}
                />
                <StatCard
                    icon="group"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Sinh viên đang hướng dẫn"
                    value={`${stats.studentGroups} / ${maxQuota}`}
                />
                <StatCard
                    icon="verified"
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    label="Đồ án hoàn thành"
                    value={stats.completedRegistrations}
                />
                <StatCard
                    icon="chat_bubble"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Bài nộp chờ phản hồi"
                    value={stats.pendingFeedback}
                />
            </div>

            {/* Main Content Grid (7/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">
                {/* Left 7 Cols: Recent Submissions */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="font-bold text-slate-900 text-base">Bài nộp cần phản hồi gần đây</h3>
                            <p className="text-xs text-slate-500">Các nhiệm vụ và biểu mẫu sinh viên vừa nộp cần giảng viên kiểm duyệt</p>
                        </div>
                        <Button
                            type="link"
                            onClick={() => navigate('/lecturer/progress')}
                            className="font-bold text-xs p-0 flex items-center gap-1"
                        >
                            Xem tất cả <RightOutlined className="text-[10px]" />
                        </Button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <Table
                            dataSource={recentSubmissions}
                            columns={recentColumns}
                            rowKey={(r, idx) => r.id || idx}
                            pagination={false}
                            size="middle"
                            locale={{
                                emptyText: (
                                    <div className="py-8 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2 block">task_alt</span>
                                        <p className="text-sm font-medium">Hiện không có bài nộp nào đang chờ phản hồi</p>
                                    </div>
                                ),
                            }}
                        />
                    </div>
                </div>

                {/* Right 3 Cols: Deadlines & Overall Stats */}
                <div className="lg:col-span-3 space-y-5">
                    {/* Upcoming Deadlines */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="material-symbols-outlined text-rose-500 text-[20px]">notification_important</span>
                            <h3 className="font-bold text-slate-900 text-sm">Mốc thời gian sắp tới</h3>
                        </div>

                        {timelineEvents.length === 0 ? (
                            <p className="text-slate-400 text-xs text-center py-4">Không có mốc sự kiện nào sắp tới</p>
                        ) : (
                            <div className="space-y-2.5">
                                {timelineEvents.slice(0, 3).map((evt, idx) => {
                                    const isUrgent = evt.color === 'red';
                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                                                isUrgent
                                                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between font-bold">
                                                <span className="truncate pr-2">{evt.title}</span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-current shrink-0">
                                                    {dayjs(evt.date).format('DD/MM')}
                                                </span>
                                            </div>
                                            <p className="text-[11px] opacity-80 leading-relaxed line-clamp-2">{evt.desc}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Mentorship Stats Progress */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="material-symbols-outlined text-indigo-600 text-[20px]">donut_large</span>
                            <h3 className="font-bold text-slate-900 text-sm">Tiến độ hướng dẫn</h3>
                        </div>

                        <div className="space-y-3.5">
                            <div>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="text-slate-600">Hoàn thành đồ án</span>
                                    <span className="font-bold text-blue-600">{completionPercent}%</span>
                                </div>
                                <Progress percent={completionPercent} strokeColor="#1E3A5F" showInfo={false} size="small" />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="text-slate-600">Đã phản hồi bài nộp</span>
                                    <span className="font-bold text-emerald-600">{feedbackHandledPercent}%</span>
                                </div>
                                <Progress percent={feedbackHandledPercent} strokeColor="#10B981" showInfo={false} size="small" />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="text-slate-600">Hạn mức sinh viên đã nhận</span>
                                    <span className="font-bold text-purple-600">
                                        {Math.round((stats.studentGroups / maxQuota) * 100)}%
                                    </span>
                                </div>
                                <Progress
                                    percent={Math.round((stats.studentGroups / maxQuota) * 100)}
                                    strokeColor="#7C3AED"
                                    showInfo={false}
                                    size="small"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LecturerDashboardPage;
