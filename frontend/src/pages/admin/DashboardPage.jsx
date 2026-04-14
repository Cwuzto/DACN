import { useEffect, useMemo, useState } from 'react';
import { Alert, Progress, Select, Spin, Tag, message } from 'antd';
import dayjs from 'dayjs';

import dashboardService from '../../services/dashboardService';
import { semesterService } from '../../services/semesterService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [semesterChart, setSemesterChart] = useState([]);
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [activities, setActivities] = useState([]);
    const [semesters, setSemesters] = useState([]);

    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
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
                icon: 'person',
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
            },
            {
                label: 'Đề tài đã duyệt',
                value: stats?.ongoingTopics ?? 0,
                icon: 'menu_book',
                iconBg: 'bg-indigo-50',
                iconColor: 'text-indigo-600',
            },
            {
                label: 'Chưa gắn hội đồng',
                value: stats?.unassignedRegistrations ?? 0,
                icon: 'groups',
                iconBg: 'bg-orange-50',
                iconColor: 'text-orange-600',
            },
            {
                label: 'Hội đồng sắp bảo vệ',
                value: stats?.upcomingDefenses ?? 0,
                icon: 'verified_user',
                iconBg: 'bg-teal-50',
                iconColor: 'text-teal-600',
            },
        ],
        [stats]
    );

    const alerts = useMemo(() => {
        const result = [];
        if ((stats?.unassignedRegistrations || 0) > 0) {
            result.push({
                id: 'unassigned',
                type: 'warning',
                message: `${stats.unassignedRegistrations} sinh viên chưa được phân hội đồng`,
                description: 'Nên ưu tiên phân công hội đồng để tránh sát hạn bảo vệ.',
            });
        }
        if ((stats?.upcomingDefenses || 0) === 0) {
            result.push({
                id: 'defense',
                type: 'info',
                message: 'Chưa có hội đồng nào sắp tới lịch bảo vệ',
                description: 'Kiểm tra lại lịch bảo vệ trong các đợt đang diễn ra.',
            });
        }
        return result;
    }, [stats]);

    const currentPeriod = useMemo(() => {
        if (!semesters.length) return null;
        return (
            semesters.find((item) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(item.status)) ||
            semesters[0]
        );
    }, [semesters]);

    const progressPercent = useMemo(() => {
        if (!currentPeriod?.startDate || !currentPeriod?.endDate) return 0;
        const start = dayjs(currentPeriod.startDate);
        const end = dayjs(currentPeriod.endDate);
        const totalDays = Math.max(end.diff(start, 'day'), 1);
        const passedDays = dayjs().diff(start, 'day');
        return Math.max(0, Math.min(100, Math.round((passedDays / totalDays) * 100)));
    }, [currentPeriod]);

    const semesterSummary = useMemo(() => {
        if (!semesterChart.length) {
            return [
                { label: 'Đăng ký', value: 0, color: 'text-blue-500' },
                { label: 'Hoàn thành', value: 0, color: 'text-green-500' },
            ];
        }

        const totalRegistered = semesterChart.reduce((sum, item) => sum + (item.registered || 0), 0);
        const totalCompleted = semesterChart.reduce((sum, item) => sum + (item.completed || 0), 0);
        return [
            { label: 'Đăng ký', value: totalRegistered, color: 'text-blue-500' },
            { label: 'Hoàn thành', value: totalCompleted, color: 'text-green-500' },
        ];
    }, [semesterChart]);

    const scores = scoreDistribution.length
        ? scoreDistribution
        : [
            { label: 'Xuất sắc', percent: 0, color: '#1677FF' },
            { label: 'Giỏi', percent: 0, color: '#13C2C2' },
            { label: 'Khá', percent: 0, color: '#52C41A' },
            { label: 'Trung bình', percent: 0, color: '#FAAD14' },
        ];

    return (
        <div className="py-2 space-y-6">
            <PageHeader title="Dashboard" subtitle="Tổng quan tình hình hệ thống" />

            {loading && (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <Spin />
                </div>
            )}

            {!loading && alerts.length > 0 && (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <Alert
                            key={alert.id}
                            type={alert.type}
                            showIcon
                            message={<span className="font-bold">{alert.message}</span>}
                            description={alert.description}
                            className="rounded-lg shadow-sm border"
                        />
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => (
                    <StatCard key={idx} {...stat} />
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">Tổng quan vận hành theo học kỳ</h3>
                    <Select
                        value={selectedSemesterId}
                        onChange={setSelectedSemesterId}
                        style={{ width: 280 }}
                        options={semesters.map((semester) => ({ value: semester.id, label: semester.name }))}
                        placeholder="Chọn học kỳ"
                    />
                </div>

                <Spin spinning={overviewLoading}>
                    {semesterOverview ? (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <Tag color={semesterOverview.semester.registrationOpen ? 'green' : 'red'}>
                                    {semesterOverview.semester.registrationOpen ? 'Đang mở đăng ký' : 'Đang đóng đăng ký'}
                                </Tag>
                                <Tag>{semesterOverview.semester.status}</Tag>
                                <span className="text-xs text-slate-500">
                                    Hạn đăng ký: {semesterOverview.semester.registrationDeadline ? dayjs(semesterOverview.semester.registrationDeadline).format('DD/MM/YYYY') : 'Chưa đặt'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="rounded-lg border border-slate-100 p-3 bg-slate-50">
                                    <p className="text-xs text-slate-500">Đề tài</p>
                                    <p className="text-xl font-black text-slate-900">{semesterOverview.topics.total}</p>
                                </div>
                                <div className="rounded-lg border border-slate-100 p-3 bg-slate-50">
                                    <p className="text-xs text-slate-500">Đăng ký</p>
                                    <p className="text-xl font-black text-slate-900">{semesterOverview.registrations.total}</p>
                                </div>
                                <div className="rounded-lg border border-slate-100 p-3 bg-slate-50">
                                    <p className="text-xs text-slate-500">Chờ duyệt</p>
                                    <p className="text-xl font-black text-amber-600">{semesterOverview.registrations.pending}</p>
                                </div>
                                <div className="rounded-lg border border-slate-100 p-3 bg-slate-50">
                                    <p className="text-xs text-slate-500">Đã hoàn thành</p>
                                    <p className="text-xl font-black text-emerald-600">{semesterOverview.registrations.completed}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">Tỷ lệ duyệt đăng ký</span>
                                        <span className="font-bold text-slate-900">{semesterOverview.registrations.approvalRate}%</span>
                                    </div>
                                    <Progress percent={semesterOverview.registrations.approvalRate} strokeColor="#1677ff" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">Tỷ lệ hoàn thành</span>
                                        <span className="font-bold text-slate-900">{semesterOverview.registrations.completionRate}%</span>
                                    </div>
                                    <Progress percent={semesterOverview.registrations.completionRate} strokeColor="#52c41a" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">Chưa có dữ liệu học kỳ.</p>
                    )}
                </Spin>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4">Thống kê học kỳ</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {semesterSummary.map((item, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-lg text-center border">
                                <p className="text-xs font-medium text-slate-500 mb-1">{item.label}</p>
                                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-center">
                    <h3 className="font-bold text-slate-900 mb-2">
                        Tiến độ đợt hiện tại: {currentPeriod?.name || 'Chưa có dữ liệu'}
                    </h3>
                    {currentPeriod && (
                        <div className="flex justify-between text-xs text-slate-500 mb-2 mt-4">
                            <span>Bắt đầu: {dayjs(currentPeriod.startDate).format('DD/MM/YYYY')}</span>
                            <span>Kết thúc: {dayjs(currentPeriod.endDate).format('DD/MM/YYYY')}</span>
                        </div>
                    )}
                    <Progress
                        percent={progressPercent}
                        status="active"
                        strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                        strokeWidth={14}
                    />
                    <p className="text-center text-sm text-slate-600 mt-4">
                        Đã trôi qua <span className="font-bold">{progressPercent}%</span> thời gian của đợt đồ án.
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6">Phân bố điểm bảo vệ</h3>
                <div className="space-y-6">
                    {scores.map((item, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">{item.label}</span>
                                <span className="font-bold text-slate-900">{item.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div
                                    className="h-2.5 rounded-full"
                                    style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Hoạt động gần đây</h3>
                <div className="space-y-3">
                    {(activities || []).slice(0, 5).map((item) => (
                        <div key={item.id} className="border border-slate-100 rounded-lg p-3">
                            <p className="text-sm font-bold text-slate-800">{item.action}</p>
                            <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                            <p className="text-xs text-slate-400 mt-1">
                                {item.user} - {dayjs(item.time).format('HH:mm DD/MM/YYYY')}
                            </p>
                        </div>
                    ))}
                    {!activities?.length && <p className="text-sm text-slate-400">Chưa có hoạt động nào.</p>}
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
