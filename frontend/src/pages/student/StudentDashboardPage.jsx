import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import dashboardService from '../../services/dashboardService';
import dayjs from 'dayjs';

const ACTIVE_FLOW_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];

function StudentDashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
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

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const { hasRegistration, registrationDetails, taskStatus, upcomingDeadlines } = data || {};
    const hasAnyRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const isActiveFlow = ACTIVE_FLOW_STATUSES.includes(currentRegistration?.status);
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    const total = taskStatus?.total || 0;
    const submitted = taskStatus?.submitted || 0;
    const completed = taskStatus?.completed || 0;
    const overdue = taskStatus?.overdue || 0;
    const progressPercent = taskStatus?.progressPercent || 0;

    const renderRegistrationBadge = () => {
        if (!hasAnyRegistration) {
            return <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-100">Chưa đăng ký</span>;
        }

        const status = currentRegistration?.status;
        if (status === 'PENDING') {
            return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-bold border border-amber-100">Chờ duyệt</span>;
        }
        if (status === 'REJECTED') {
            return <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-100">Từ chối</span>;
        }
        return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold border border-emerald-100">Đang thực hiện</span>;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Tên đề tài</span>
                    <p className="mt-2 text-slate-900 dark:text-white font-bold text-lg leading-snug line-clamp-2">
                        {hasAnyRegistration && currentRegistration?.topic ? currentRegistration.topic.title : 'Chưa đăng ký đề tài'}
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Giảng viên hướng dẫn</span>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-lg">
                            {hasAnyRegistration && currentRegistration?.topic ? currentRegistration.topic.mentorName : 'Chưa có'}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Tiến độ</span>
                    <p className="mt-2 text-slate-900 dark:text-white font-bold text-lg line-clamp-1">
                        {isActiveFlow ? `${progressPercent}% hoàn thành` : 'Chưa bắt đầu'}
                    </p>
                    {isActiveFlow && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Trạng thái đăng ký</span>
                    <div className="mt-2 flex items-center gap-2">{renderRegistrationBadge()}</div>
                </div>
            </div>

            {isActiveFlow && overdue > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 rounded-full p-2 text-red-600">
                            <span className="material-symbols-outlined">error</span>
                        </div>
                        <div>
                            <p className="text-red-900 font-bold text-sm md:text-base">Bạn có {overdue} nhiệm vụ quá hạn</p>
                            <p className="text-red-700 text-sm">Vào trang nộp báo cáo để cập nhật ngay nhằm tránh ảnh hưởng tiến độ.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/student/submissions')} className="hidden md:block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Xử lý ngay
                    </button>
                </div>
            )}

            {isActiveFlow && nearestDeadline && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 rounded-full p-2 text-amber-600">
                            <span className="material-symbols-outlined">warning</span>
                        </div>
                        <div>
                            <p className="text-amber-900 font-bold text-sm md:text-base">Hạn nộp sắp tới</p>
                            <p className="text-amber-700 text-sm">{nearestDeadline.title} - hạn {dayjs(nearestDeadline.date).format('DD/MM/YYYY HH:mm')}.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/student/submissions')} className="hidden md:block bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Nộp ngay
                    </button>
                </div>
            )}

            {!hasAnyRegistration && (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center">
                    <div className="size-16 bg-primary/10 text-primary rounded-full flex justify-center items-center mb-4">
                        <span className="material-symbols-outlined text-3xl">diversity_3</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Bạn chưa đăng ký đề tài</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">Hãy chọn và đăng ký một đề tài để bắt đầu thực hiện đồ án.</p>
                    <button onClick={() => navigate('/student/topics')} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors">
                        Đi đến danh sách đề tài
                    </button>
                </div>
            )}

            {hasAnyRegistration && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">analytics</span>
                                Tổng quan nhiệm vụ
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                                    <p className="text-xs text-slate-500 uppercase">Tổng task</p>
                                    <p className="text-2xl font-black text-slate-900">{total}</p>
                                </div>
                                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                                    <p className="text-xs text-indigo-600 uppercase">Đã nộp</p>
                                    <p className="text-2xl font-black text-indigo-700">{submitted}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
                                    <p className="text-xs text-emerald-600 uppercase">Đã chấm</p>
                                    <p className="text-2xl font-black text-emerald-700">{completed}</p>
                                </div>
                                <div className="rounded-lg bg-red-50 border border-red-100 p-4">
                                    <p className="text-xs text-red-600 uppercase">Quá hạn</p>
                                    <p className="text-2xl font-black text-red-700">{overdue}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">history</span>
                                    Các hạn nộp sắp tới
                                </h3>
                                <button onClick={() => navigate('/student/submissions')} className="text-primary hover:text-primary/80 text-sm font-semibold flex items-center gap-1 transition-colors">
                                    Chi tiết <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                {upcomingDeadlines?.length > 0 ? (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên sự kiện</th>
                                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Hạn nộp</th>
                                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Mức độ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {upcomingDeadlines.map((d) => (
                                                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{d.title}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{dayjs(d.date).format('DD/MM/YYYY HH:mm')}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.color === 'red' ? 'bg-red-50 text-red-700 border border-red-200' : d.color === '#fa8c16' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${d.color === 'red' ? 'bg-red-500' : d.color === '#fa8c16' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                                                            {d.color === 'red' ? 'Gấp' : d.color === '#fa8c16' ? 'Sắp hạn' : 'Bình thường'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-slate-500 text-sm">Chưa có hạn nộp sắp tới.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Thao tác nhanh</h3>
                            <div className="space-y-3">
                                <button onClick={() => navigate('/student/submissions')} className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20">
                                    <span className="material-symbols-outlined">upload</span>
                                    Nộp báo cáo
                                </button>
                                <button onClick={() => navigate('/student/grades')} className="w-full border shadow-sm border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-slate-700 dark:text-slate-300">
                                    <span className="material-symbols-outlined">visibility</span>
                                    Xem điểm đồ án
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Thông tin sinh viên</h3>
                            <div className="flex flex-col gap-3">
                                {currentRegistration?.members?.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                            {m.fullName[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
                                                {m.fullName} {m.id === user?.id && '(Tôi)'}
                                            </p>
                                            <div className="flex gap-2 items-center text-xs">
                                                <span className="px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">{m.role}</span>
                                                <span className="text-slate-500">{m.code}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StudentDashboardPage;
