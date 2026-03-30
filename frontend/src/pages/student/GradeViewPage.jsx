import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import evaluationService from '../../services/evaluationService';

function GradeViewPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);

    useEffect(() => {
        const fetchGrades = async () => {
            try {
                setLoading(true);
                const res = await evaluationService.getMyGrades();
                if (res.success) {
                    setRegistrations(res.data || []);
                }
            } catch (error) {
                message.error('Lỗi khi tải điểm: ' + (error?.message || 'Unknown error'));
            } finally {
                setLoading(false);
            }
        };

        fetchGrades();
    }, []);

    const latestRegistration = useMemo(() => {
        if (!registrations.length) return null;
        return registrations[0];
    }, [registrations]);

    const defenseResult = latestRegistration?.defenseResult || null;
    const finalScore = defenseResult?.finalScore ?? null;
    const hasScore = finalScore !== null && finalScore !== undefined;
    const gradeLabel = !hasScore ? 'N/A' : finalScore >= 8.5 ? 'A' : finalScore >= 7.0 ? 'B' : finalScore >= 5.5 ? 'C' : finalScore >= 4.0 ? 'D' : 'F';
    const isPassed = hasScore && finalScore >= 4.0;
    const statusText = !hasScore ? 'CHƯA CHẤM' : isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT';
    const statusColor = !hasScore
        ? 'bg-slate-50 text-slate-600 border-slate-200'
        : isPassed
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
            : 'bg-red-50 text-red-600 border-red-200';

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!latestRegistration) {
        return (
            <div className="py-2">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Kết quả Đánh giá Đồ án</h1>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                    <div className="size-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-6">
                        <span className="material-symbols-outlined text-5xl">inventory_2</span>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Chưa có dữ liệu đăng ký</h2>
                    <p className="text-slate-500 max-w-md">Bạn chưa có đăng ký đề tài trong hệ thống.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="py-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Kết quả Đánh giá Đồ án</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">Điểm bảo vệ và nhận xét cho đăng ký gần nhất của bạn</p>
                </div>
            </div>

            <div className="bg-gradient-to-br from-primary to-[#004b99] rounded-2xl p-1 shadow-lg mb-8 overflow-hidden relative">
                <div className="bg-white dark:bg-slate-900 rounded-xl m-[2px] p-6 lg:p-10 relative z-10 flex flex-col lg:flex-row gap-8 items-center lg:items-stretch lg:justify-between border border-white/20">
                    <div className="flex-1 text-center lg:text-left">
                        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-3 leading-tight">
                            {latestRegistration.topic?.title || 'Chưa có đề tài'}
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 sm:gap-6 justify-center lg:justify-start">
                            <div className="flex items-center gap-2">
                                <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <span className="material-symbols-outlined text-[16px]">person</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">GV Hướng Dẫn</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{latestRegistration.topic?.mentor?.fullName || 'Chưa có'}</p>
                                </div>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                            <div className="flex items-center gap-2">
                                <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <span className="material-symbols-outlined text-[16px]">verified</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trạng thái</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{latestRegistration.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:w-72 shrink-0 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-6 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl font-black text-slate-200/50 dark:text-slate-700/20 select-none z-0">
                            {gradeLabel}
                        </div>
                        <div className="relative z-10 w-full">
                            <div className={`mx-auto w-fit mb-3 px-4 py-1.5 rounded-full border text-sm font-black tracking-widest ${statusColor} shadow-sm`}>
                                {statusText}
                            </div>
                            <div className="flex items-baseline justify-center gap-1 mb-2">
                                <span className={`text-6xl font-black tracking-tighter ${isPassed ? 'text-primary' : 'text-red-500'}`}>
                                    {hasScore ? Number(finalScore).toFixed(1) : '--'}
                                </span>
                                <span className="text-2xl font-bold text-slate-400">/10</span>
                            </div>
                            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                Điểm Tổng Kết
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">feedback</span>
                    Nhận xét bảo vệ
                </h3>
                {defenseResult ? (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-500">
                            Người chấm: <span className="font-semibold text-slate-700 dark:text-slate-200">{defenseResult.evaluator?.fullName || 'Chưa rõ'}</span>
                        </p>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                                {defenseResult.comments || 'Chưa có nhận xét chi tiết.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-500">Hội đồng/GV chưa nhập điểm bảo vệ cho đăng ký này.</div>
                )}
            </div>
        </div>
    );
}

export default GradeViewPage;
