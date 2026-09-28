import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Progress, Select, Spin, Tag, message } from 'antd';
import {
    TeamOutlined,
    BookOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    ArrowRightOutlined,
    CalendarOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

import dashboardService from '../../services/dashboardService';
import { semesterService } from '../../services/semesterService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

function DashboardPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [semesterChart, setSemesterChart] = useState([]);
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [activities, setActivities] = useState([]);
    const [semesters, setSemesters] = useState([]);

    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [semesterOverview, setSemesterOverview] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const [statsRes, semesterRes, scoreRes, activityRes, allSemesterRes] = await Promise.all([
                    dashboardService.getStats(),
                    dashboardService.getSemesterStats(),
                    dashboardService.getScores(),
                    dashboardService.getActivities(),
                    semesterService.getAll(),
                ]);

                if (statsRes.success) setStats(statsRes.data);
                if (semesterRes.success) setSemesterChart(semesterRes.data || []);
                if (scoreRes.success) setScoreDistribution(scoreRes.data || []);
                if (activityRes.success) setActivities(activityRes.data || []);
                if (allSemesterRes.success) {
                    const list = allSemesterRes.data || [];
                    setSemesters(list);
                    if (list.length > 0) {
                        const preferred = list.find((item) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(item.status));
                        setSelectedSemesterId(preferred?.id || list[0].id);
                    }
                }
            } catch (error) {
                message.error(error?.message || 'Không thể tải dữ liệu dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                setOverviewLoading(true);
                const res = await dashboardService.getSemesterOverview(
                    selectedSemesterId ? { semesterId: selectedSemesterId } : {}
                );
                if (res.success) {
                    setSemesterOverview(res.data || null);
                }
            } catch (error) {
                message.error(error?.message || 'Không thể tải tổng quan học kỳ');
            } finally {
                setOverviewLoading(false);
            }
        };

        fetchOverview();
    }, [selectedSemesterId]);

    const statCards = useMemo(
        () => [
            {
                label: 'Sinh viên hoạt động',
                value: stats?.totalStudents ?? 0,
                icon: 'group',
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
                description: 'Tổng số sinh viên đủ điều kiện làm đồ án',
                onClick: () => navigate('/admin/users'),
            },
            {
                label: 'Đề tài đã duyệt',
                value: stats?.ongoingTopics ?? 0,
                icon: 'description',
                iconBg: 'bg-emerald-50',
                iconColor: 'text-emerald-600',
                description: 'Đề tài đạt chuẩn đang được thực hiện',
                onClick: () => navigate('/admin/topics'),
            },
            {
                label: 'Chưa gắn hội đồng',
                value: stats?.unassignedRegistrations ?? 0,
                icon: 'groups_2',
                iconBg: (stats?.unassignedRegistrations || 0) > 0 ? 'bg-amber-50' : 'bg-slate-50',
                iconColor: (stats?.unassignedRegistrations || 0) > 0 ? 'text-amber-600' : 'text-slate-400',
                description: (stats?.unassignedRegistrations || 0) > 0 ? 'Cần xếp hội đồng bảo vệ' : 'Tất cả đã có hội đồng',
                onClick: () => navigate('/admin/councils'),
            },
            {
                label: 'Hội đồng sắp bảo vệ',
                value: stats?.upcomingDefenses ?? 0,
                icon: 'verified_user',
                iconBg: 'bg-purple-50',
                iconColor: 'text-purple-600',
                description: 'Hội đồng dự kiến diễn ra sắp tới',
                onClick: () => navigate('/admin/grading'),
            },
        ],
        [stats, navigate]
    );

    const activeSemester = useMemo(() => {
        if (!semesters.length) return null;
        return semesters.find((s) => s.id === selectedSemesterId) || semesters[0];
    }, [semesters, selectedSemesterId]);

    const progressPercent = useMemo(() => {
        if (!activeSemester?.startDate || !activeSemester?.endDate) return 0;
        const start = dayjs(activeSemester.startDate);
        const end = dayjs(activeSemester.endDate);
        const totalDays = Math.max(end.diff(start, 'day'), 1);
        const passedDays = dayjs().diff(start, 'day');
        return Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));
    }, [activeSemester]);

    const scores = useMemo(() => {
        if (scoreDistribution && scoreDistribution.length > 0) return scoreDistribution;
        return [
            { label: 'Xuất sắc (A)', percent: 25, color: '#10B981' },
            { label: 'Giỏi (B)', percent: 45, color: '#2563EB' },
            { label: 'Khá (C)', percent: 20, color: '#F59E0B' },
            { label: 'Trung bình (D/F)', percent: 10, color: '#EF4444' },
        ];
    }, [scoreDistribution]);

    const projectOptions = useMemo(() => [{ value: PROJECT_NAME, label: PROJECT_NAME }], []);

    const getActionBadge = (action = '') => {
        if (action.includes('CREATE') || action.includes('Tạo')) {
            return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'add_circle' };
        }
        if (action.includes('DELETE') || action.includes('Xóa')) {
            return { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'delete' };
        }
        if (action.includes('ASSIGN') || action.includes('Phân công')) {
            return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'link' };
        }
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'edit' };
    };

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title="Tổng quan Hệ thống"
                subtitle="Trung tâm điều hành và giám sát vòng đời đồ án sinh viên"
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            icon={<span className="material-symbols-outlined text-[16px]">groups</span>}
                            onClick={() => navigate('/admin/councils')}
                        >
                            Phân công HĐ
                        </Button>
                        <Button
                            type="primary"
                            icon={<span className="material-symbols-outlined text-[16px]">calendar_month</span>}
                            onClick={() => navigate('/admin/project-periods')}
                        >
                            Quản lý Đợt đồ án
                        </Button>
                    </div>
                }
            />

            {/* Smart Actionable Alerts */}
            {(stats?.unassignedRegistrations || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <ExclamationCircleOutlined className="text-xl" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">
                                Có {stats.unassignedRegistrations} sinh viên chưa được xếp Hội đồng
                            </h4>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Các sinh viên này đang trong giai đoạn bảo vệ nhưng chưa có hội đồng chấm điểm chính thức.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/admin/councils')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shrink-0 shadow-sm"
                    >
                        <span>Phân công ngay</span>
                        <ArrowRightOutlined />
                    </button>
                </div>
            )}

            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {statCards.map((stat, idx) => (
                    <StatCard key={idx} {...stat} />
                ))}
            </div>

            {/* Hero Active Semester Operational Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Đợt Đồ Án Trọng Tâm
                            </span>
                            <Tag color={activeSemester?.status === 'ONGOING' ? 'green' : activeSemester?.status === 'DEFENSE' ? 'purple' : 'blue'}>
                                {activeSemester?.status || 'N/A'}
                            </Tag>
                            <Tag color={activeSemester?.registrationOpen ? 'success' : 'default'}>
                                {activeSemester?.registrationOpen ? 'Đang mở đăng ký' : 'Đóng đăng ký'}
                            </Tag>
                        </div>
                        <h2 className="text-lg lg:text-xl font-black text-slate-900 leading-snug">
                            {activeSemester?.name || 'Chưa chọn học kỳ'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 190 }}
                            options={projectOptions}
                        />
                        <Select
                            value={selectedSemesterId}
                            onChange={setSelectedSemesterId}
                            style={{ width: 240 }}
                            options={semesters.map((s) => ({ value: s.id, label: formatSemesterLabel(s) }))}
                            placeholder="Chọn đợt đồ án"
                        />
                    </div>
                </div>

                <Spin spinning={overviewLoading}>
                    {semesterOverview ? (
                        <div className="pt-6 space-y-6">
                            {/* 4 Metric Chips */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Tổng đề tài</p>
                                    <p className="text-2xl font-black text-slate-900 leading-none">
                                        {semesterOverview.topics.total}
                                    </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Đã đăng ký</p>
                                    <p className="text-2xl font-black text-blue-600 leading-none">
                                        {semesterOverview.registrations.total}
                                    </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Chờ xét duyệt</p>
                                    <p className="text-2xl font-black text-amber-600 leading-none">
                                        {semesterOverview.registrations.pending}
                                    </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Đã hoàn thành</p>
                                    <p className="text-2xl font-black text-emerald-600 leading-none">
                                        {semesterOverview.registrations.completed}
                                    </p>
                                </div>
                            </div>

                            {/* Dual Progress Gauges */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-600">
                                        <span>Tỷ lệ duyệt đề tài</span>
                                        <span className="text-blue-600">{semesterOverview.registrations.approvalRate}%</span>
                                    </div>
                                    <Progress
                                        percent={semesterOverview.registrations.approvalRate}
                                        strokeColor="#2563EB"
                                        trailColor="#E2E8F0"
                                        strokeWidth={10}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-600">
                                        <span>Tỷ lệ hoàn thành bảo vệ</span>
                                        <span className="text-emerald-600">{semesterOverview.registrations.completionRate}%</span>
                                    </div>
                                    <Progress
                                        percent={semesterOverview.registrations.completionRate}
                                        strokeColor="#10B981"
                                        trailColor="#E2E8F0"
                                        strokeWidth={10}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 py-6 text-center">Chưa có dữ liệu thống kê đợt học này.</p>
                    )}
                </Spin>
            </div>

            {/* Two-Column Analytics & Live Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score Distribution Chart Card */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                            Phân bố Điểm Bảo vệ
                        </h3>
                        <span className="text-xs text-slate-400">Khóa luận tốt nghiệp</span>
                    </div>

                    <div className="space-y-4 pt-2">
                        {scores.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium text-slate-700">
                                    <span>{item.label}</span>
                                    <span className="font-bold text-slate-900">{item.percent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <Button
                            type="dashed"
                            block
                            icon={<span className="material-symbols-outlined text-[16px]">rate_review</span>}
                            onClick={() => navigate('/admin/grading')}
                        >
                            Xem chi tiết bảng điểm
                        </Button>
                    </div>
                </div>

                {/* Audit Trail & Live Activity Feed (2 Cols) */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                Lịch sử Thao tác Gần đây
                            </h3>
                        </div>
                        <span className="text-xs text-slate-400">Nhật ký hệ thống (Audit Logs)</span>
                    </div>

                    <div className="space-y-3 pt-1">
                        {(activities || []).slice(0, 5).map((item) => {
                            const badge = getActionBadge(item.action);
                            return (
                                <div
                                    key={item.id}
                                    className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start gap-3"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${badge.color}`}>
                                        <span className="material-symbols-outlined text-[16px]">{badge.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-slate-900 truncate">{item.action}</p>
                                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                                {dayjs(item.time).fromNow()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-0.5 break-words">{item.detail}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Thực hiện bởi: <strong className="text-slate-600">{item.user}</strong>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {(!activities || activities.length === 0) && (
                            <div className="text-center py-8 text-slate-400 text-xs">
                                Chưa ghi nhận hoạt động nào gần đây.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
