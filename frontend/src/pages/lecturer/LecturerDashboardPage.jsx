import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import dashboardService from '../../services/dashboardService';
import useAuthStore from '../../stores/authStore';
import dayjs from 'dayjs';

function LecturerDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        activeTopics: 0,
        studentGroups: 0,
        completedRegistrations: 0,
        pendingFeedback: 0
    });
    const [recentSubmissions, setRecentSubmissions] = useState([]);
    const [timelineEvents, setTimelineEvents] = useState([]);

    const fetchDashboardInfo = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getLecturerStats();
            if (res.success) {
                setStats(res.data.stats);
                setRecentSubmissions(res.data.recentSubmissions || []);
                setTimelineEvents(res.data.timelineEvents || []);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi tải dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardInfo();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const completionPercent = stats.studentGroups > 0
        ? Math.round((stats.completedRegistrations / stats.studentGroups) * 100)
        : 0;

    const feedbackHandledPercent = stats.studentGroups > 0
        ? Math.max(0, Math.min(100, Math.round(((stats.studentGroups - stats.pendingFeedback) / stats.studentGroups) * 100)))
        : 0;

    const upcomingDeadlinePercent = stats.studentGroups > 0
        ? Math.max(0, Math.min(100, Math.round((timelineEvents.length / stats.studentGroups) * 100)))
        : 0;

    const statCards = [
        { label: 'Đang hướng dẫn', value: stats.activeTopics, icon: 'group', bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
        { label: 'Sinh viên đang hướng dẫn', value: stats.studentGroups, icon: 'person_add', bgColor: 'bg-green-50', iconColor: 'text-green-600', valueColor: 'text-green-600' },
        { label: 'Đồ án hoàn thành', value: stats.completedRegistrations, icon: 'verified', bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
        { label: 'Phản hồi chờ xử lý', value: stats.pendingFeedback, icon: 'chat_bubble', bgColor: 'bg-orange-50', iconColor: 'text-orange-600', valueColor: 'text-orange-600' },
    ];

    return (
        <div className="py-2">
            {/* Title & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bảng điều khiển Giảng viên</h2>
                    <p className="text-slate-500 text-sm mt-1">Xin chào, {user?.fullName || 'Giảng viên'}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/lecturer/topics')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span>Tạo đồ án mới</span>
                    </button>
                    <button
                        onClick={() => navigate('/lecturer/approvals')}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-all relative"
                    >
                        <span>Phê duyệt đăng ký</span>
                        {stats.pendingFeedback > 0 && (
                            <span className="flex items-center justify-center bg-red-500 text-white text-[10px] w-5 h-5 rounded-full absolute -top-2 -right-2 border-2 border-white">
                                {stats.pendingFeedback}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((card, index) => (
                    <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
                            <p className={`text-3xl font-black ${card.valueColor || 'text-slate-900'}`}>
                                {String(card.value).padStart(2, '0')}
                            </p>
                        </div>
                        <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center ${card.iconColor}`}>
                            <span className="material-symbols-outlined text-[28px]">{card.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                {/* Table Section (70%) */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Bài nộp cần phản hồi gần đây</h3>
                        <button className="text-primary text-xs font-bold hover:underline" onClick={() => navigate('/lecturer/progress')}>
                            Xem tất cả
                        </button>
                    </div>

                    {recentSubmissions.length === 0 ? (
                        <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-4 block">inbox</span>
                            <p className="text-slate-500 font-medium">Không có bài nộp nào đang chờ phản hồi</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Sinh viên</th>
                                        <th className="px-6 py-4">Đề tài đồ án</th>
                                        <th className="px-6 py-4 text-center">Giai đoạn</th>
                                        <th className="px-6 py-4">Trạng thái</th>
                                        <th className="px-6 py-4 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recentSubmissions.map((item, index) => {
                                        const colors = ['bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-emerald-100 text-emerald-700'];
                                        const initials = (item.studentName || 'SV').split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();
                                        return (
                                            <tr key={item.id || index} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full ${colors[index % colors.length]} flex items-center justify-center font-bold text-xs`}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold">{item.studentName}</p>
                                                            <p className="text-[11px] text-slate-500">Mã SV: {item.groupName}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-slate-700 max-w-xs truncate">{item.topicTitle}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded">{item.taskTitle || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                                                        Mới nộp
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                                                        onClick={() => navigate('/lecturer/progress')}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px] text-slate-400">edit</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right Sidebar Section (30%) */}
                <div className="lg:col-span-3 space-y-8">
                    {/* Deadlines */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">notification_important</span>
                                Sắp tới hạn
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {timelineEvents.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-4">Không có mốc thời gian sắp tới</p>
                            ) : (
                                timelineEvents.slice(0, 3).map((evt, index) => {
                                    const isUrgent = evt.color === 'red';
                                    const borderColor = isUrgent ? 'border-red-500' : 'border-orange-500';
                                    const bgColor = isUrgent ? 'bg-red-50' : 'bg-orange-50';
                                    const textColor = isUrgent ? 'text-red-700' : 'text-orange-700';
                                    const labelColor = isUrgent ? 'text-red-600' : 'text-orange-600';
                                    const labelBg = isUrgent ? 'border-red-100' : 'border-orange-100';

                                    return (
                                        <div key={index} className={`p-3 ${bgColor} border-l-4 ${borderColor} rounded-r-lg`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <p className={`text-xs font-bold ${textColor} uppercase`}>{evt.title}</p>
                                                <span className={`text-[10px] ${labelColor} font-bold bg-white px-1.5 py-0.5 rounded border ${labelBg}`}>
                                                    {dayjs(evt.date).format('DD/MM')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 italic">{evt.desc}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Stats/Progress */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
                        <h3 className="font-bold text-slate-900 mb-6">Thống kê hướng dẫn</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500 font-medium">Tỷ lệ hoàn thành đồ án</span>
                                    <span className="text-primary font-bold">{completionPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full" style={{ width: `${completionPercent}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500 font-medium">Tỷ lệ đã phản hồi bài nộp</span>
                                    <span className="text-green-600 font-bold">{feedbackHandledPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-green-500 h-full rounded-full" style={{ width: `${feedbackHandledPercent}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500 font-medium">Mức độ deadline sắp tới</span>
                                    <span className="text-purple-600 font-bold">{upcomingDeadlinePercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${upcomingDeadlinePercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LecturerDashboardPage;
