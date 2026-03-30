import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import dashboardService from '../../services/dashboardService';
import dayjs from 'dayjs';

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
    const hasActiveRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    return (
        <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Tên đề tài</span>
                    <p className="mt-2 text-slate-900 dark:text-white font-bold text-lg leading-snug line-clamp-2">
                        {hasActiveRegistration && currentRegistration?.topic ? currentRegistration.topic.title : 'Chưa đăng ký đề tài'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Giảng viên hướng dẫn</span>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-lg">
                            {hasActiveRegistration && currentRegistration?.topic ? currentRegistration.topic.mentorName : 'Chưa có'}
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Tiến độ thực hiện</span>
                    <p className="mt-2 text-slate-900 dark:text-white font-bold text-lg line-clamp-1">
                        {hasActiveRegistration ? `${taskStatus?.progressPercent || 0}% Hoàn thành` : '0%'}
                    </p>
                    {hasActiveRegistration && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${taskStatus?.progressPercent || 0}%` }}></div>
                        </div>
                    )}
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Trạng thái đăng ký</span>
                    <div className="mt-2 flex items-center gap-2">
                        {hasActiveRegistration ? (
                            <>
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-800">Đã đăng ký</span>
                            </>
                        ) : (
                            <>
                                <span className="relative flex h-3 w-3">
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-red-100 dark:border-red-800">Chưa đăng ký</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Emergency Banner (if deadline is near) */}
            {nearestDeadline && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-800 rounded-full p-2 text-amber-600 dark:text-amber-400">
                            <span className="material-symbols-outlined">warning</span>
                        </div>
                        <div>
                            <p className="text-amber-900 dark:text-amber-100 font-bold text-sm md:text-base">Hạn nộp sắp tới</p>
                            <p className="text-amber-700 dark:text-amber-300 text-sm">{nearestDeadline.title} - Phải nộp vào lúc {dayjs(nearestDeadline.date).format('DD/MM/YYYY - HH:mm')}.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/student/submissions')} className="hidden md:block bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Nộp ngay
                    </button>
                </div>
            )}

            {
                !hasActiveRegistration && (
                     <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center">
                        <div className="size-16 bg-primary/10 text-primary rounded-full flex justify-center items-center mb-4">
                            <span className="material-symbols-outlined text-3xl">diversity_3</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Bạn chưa đăng ký đề tài</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-6">Hãy chọn và đăng ký một đề tài để bắt đầu thực hiện đồ án môn học.</p>
                        <button onClick={() => navigate('/student/topics')} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors">
                            Đi đến Danh sách đề tài
                        </button>
                    </div>
                )
            }

            {
                hasActiveRegistration && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Current Topic & Timeline (combined) */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Progress Timeline Block */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">analytics</span>
                                    Lộ trình thực hiện
                                </h3>
                                <div className="relative">
                                    <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800"></div>
                                    <div className="absolute top-5 left-0 h-1 bg-primary border-r-4 border-white transition-all duration-500" style={{ width: `${taskStatus?.progressPercent || 0}%` }}></div>
                                    
                                    <div className="relative z-10 flex justify-between items-start text-center">
                                        <div className="flex flex-col items-center group">
                                            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center border-4 border-white dark:border-slate-900 mb-3 transition-transform hover:scale-110">
                                                <span className="material-symbols-outlined text-[20px]">check</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Đăng ký</span>
                                            <span className="text-[10px] text-emerald-600 font-semibold uppercase mt-1">Hoàn thành</span>
                                        </div>
                                        
                                        <div className="flex flex-col items-center group">
                                            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center border-4 border-white dark:border-slate-900 bg-primary/20 active-dot mb-3 transition-transform hover:scale-110">
                                                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                            </div>
                                            <span className="text-sm font-bold text-primary">Thực hiện</span>
                                            <span className="text-[10px] bg-primary text-white px-2 rounded-full font-semibold uppercase mt-1">Hiện tại</span>
                                        </div>

                                        <div className="flex flex-col items-center group">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 flex items-center justify-center border-4 border-white dark:border-slate-900 mb-3 transition-transform hover:scale-110">
                                                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                            </div>
                                            <span className="text-sm font-medium text-slate-500">Nộp sản phẩm</span>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1">Sắp tới</span>
                                        </div>

                                        <div className="flex flex-col items-center group">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 flex items-center justify-center border-4 border-white dark:border-slate-900 mb-3 transition-transform hover:scale-110">
                                                <span className="material-symbols-outlined text-[20px]">school</span>
                                            </div>
                                            <span className="text-sm font-medium text-slate-500">Bảo vệ</span>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1">Kết thúc</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Submission List Table view (simplified for Dashboard) */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">history</span>
                                        Sự kiện nộp bài & báo cáo
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
                                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {upcomingDeadlines.slice(0, 4).map((d, index) => (
                                                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4 flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-slate-400 text-[18px]">description</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{d.title}</span>
                                                            </div>
                                                            <span className="text-xs text-slate-500 ml-6">{d.desc}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{dayjs(d.date).format('DD/MM/YYYY')}</td>
                                                        <td className="px-6 py-4">
                                                            {d.color === 'red' ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Tới hạn nộp
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Chưa bắt đầu
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-6 text-center text-slate-500 text-sm">Chưa có thông tin sự kiện</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions Sidebar */}
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Thao tác nhanh</h3>
                                <div className="space-y-3">
                                    <button onClick={() => navigate('/student/submissions')} className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20">
                                        <span className="material-symbols-outlined">upload</span>
                                        Nộp báo cáo giai đoạn
                                    </button>
                                    <button onClick={() => navigate('/student/grades')} className="w-full border shadow-sm border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-slate-700 dark:text-slate-300">
                                        <span className="material-symbols-outlined">visibility</span>
                                        Xem điểm đồ án
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Thông tin sinh viên ({currentRegistration?.members?.length || 0})</h3>
                                <div className="flex flex-col gap-3">
                                    {currentRegistration?.members?.map((m, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                {m.fullName[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
                                                    {m.fullName} {m.id === user.id && '(Tôi)'}
                                                </p>
                                                <div className="flex gap-2 items-center text-xs">
                                                    <span className={`px-1.5 py-0.5 rounded font-medium ${m.role === 'Nhóm trưởng' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{m.role}</span>
                                                    <span className="text-slate-500">{m.code}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-primary/5 p-6 rounded-xl border border-primary/20">
                                <h4 className="text-primary font-bold mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px]">support_agent</span>
                                    Hỗ trợ kỹ thuật
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">Nếu gặp trục trặc trong hệ thống nộp bài, hãy gửi email báo cho IT.</p>
                                <a className="inline-flex items-center justify-center w-full gap-2 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-lg text-primary font-bold text-sm shadow-sm border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors" href="mailto:support@itc.edu.vn">
                                    <span className="material-symbols-outlined text-[18px]">mail</span>
                                    support@itc.edu.vn
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

export default StudentDashboardPage;
