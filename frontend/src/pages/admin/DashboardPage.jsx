import { useEffect, useMemo, useState } from 'react';
import { Alert, Progress, Spin, message } from 'antd';
import {
    ReadOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import dashboardService from '../../services/dashboardService';
import { semesterService } from '../../services/semesterService';

function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [semesterChart, setSemesterChart] = useState([]);
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [activities, setActivities] = useState([]);
    const [semesters, setSemesters] = useState([]);

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
                if (allSemesterRes.success) setSemesters(allSemesterRes.data || []);
            } catch (error) {
                message.error(error?.message || 'Không thể tải dữ liệu dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const statCards = useMemo(
        () => [
            {
                title: 'Sinh viên hoạt động',
                value: stats?.totalStudents ?? 0,
                icon: <UserOutlined />,
                color: 'bg-blue-100 text-blue-600',
            },
            {
                title: 'Đề tài đã duyệt',
                value: stats?.ongoingTopics ?? 0,
                icon: <ReadOutlined />,
                color: 'bg-indigo-100 text-indigo-600',
            },
            {
                title: 'Chưa gắn hội đồng',
                value: stats?.unassignedRegistrations ?? 0,
                icon: <TeamOutlined />,
                color: 'bg-orange-100 text-orange-600',
            },
            {
                title: 'Hội đồng sắp bảo vệ',
                value: stats?.upcomingDefenses ?? 0,
                icon: <SafetyCertificateOutlined />,
                color: 'bg-teal-100 text-teal-600',
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-1">Tổng quan tình hình hệ thống</p>
                </div>
            </div>

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
                    <div
                        key={idx}
                        className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition"
                    >
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.title}</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${stat.color}`}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
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
                <h3 className="font-bold text-slate-900 mb-6">Phân bổ điểm bảo vệ</h3>
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


