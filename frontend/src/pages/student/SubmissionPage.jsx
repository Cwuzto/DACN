import { useState, useEffect } from 'react';
import { message } from 'antd';
import uploadService from '../../services/uploadService';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';
import { CloudUploadOutlined, CheckCircleOutlined, ClockCircleOutlined, InboxOutlined, DownloadOutlined, FileZipOutlined, InfoCircleOutlined, FilePdfOutlined, LoadingOutlined } from '@ant-design/icons';

const statusConfig = {
    OPEN: { label: 'Chưa nộp', colorClass: 'bg-amber-100 text-amber-700 border-amber-200', icon: <span className="material-symbols-outlined text-[16px]">schedule</span> },
    IN_PROGRESS: { label: 'Đang làm', colorClass: 'bg-blue-100 text-blue-700 border-blue-200', icon: <span className="material-symbols-outlined text-[16px]">pending_actions</span> },
    SUBMITTED: { label: 'Đã nộp', colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <span className="material-symbols-outlined text-[16px]">task_alt</span> },
    COMPLETED: { label: 'Đã chấm', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <span className="material-symbols-outlined text-[16px]">verified</span> },
    OVERDUE: { label: 'Trễ hạn', colorClass: 'bg-red-100 text-red-700 border-red-200', icon: <span className="material-symbols-outlined text-[16px]">error</span> },
};

function SubmissionPage() {
    const [subList, setSubList] = useState([]);
    const [registration, setRegistration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploadingObj, setUploadingObj] = useState({});

    // Dynamic Progress Calculations
    const totalTasks = subList.length;
    const submittedTasks = subList.filter(t => ['SUBMITTED', 'COMPLETED'].includes(t.status)).length;
    const completedTasks = subList.filter(t => t.status === 'COMPLETED').length;
    const openTasks = subList.filter(t => t.status === 'OPEN').length;
    const progressPercent = totalTasks > 0 ? Math.round((submittedTasks / totalTasks) * 100) : 0;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const regRes = await registrationService.getMyRegistration();
            if (regRes.success && regRes.data) {
                setRegistration(regRes.data);
                const taskRes = await taskService.getTasksByRegistration(regRes.data.id);
                if (taskRes.success) {
                    setSubList(taskRes.data);
                }
            }
        } catch (error) {
            console.error('Error fetching submission data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e, subKey) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingObj(prev => ({ ...prev, [subKey]: true }));
        try {
            const res = await uploadService.uploadFile(file, 'submissions');

            // Save the uploaded url to local state temporarily so UI updates instantly
            setSubList(prev => prev.map(task => {
                if (task.id === subKey) {
                    return {
                        ...task,
                        _tempFile: {
                            name: file.name,
                            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                            date: new Date().toLocaleDateString('vi-VN'),
                            url: res.data.url
                        }
                    };
                }
                return task;
            }));

            message.success(`${file.name} tải lên thành công. Vui lòng bấm "Chốt nộp báo cáo".`);
        } catch (err) {
            console.error(err);
            message.error(`${file.name} tải lên thất bại.`);
        } finally {
            setUploadingObj(prev => ({ ...prev, [subKey]: false }));
            e.target.value = null; // reset input
        }
    };

    const handleSubmit = async (taskId) => {
        const task = subList.find(t => t.id === taskId);
        if (!task || !task._tempFile) return;

        try {
            setUploadingObj(prev => ({ ...prev, [`submit_${taskId}`]: true }));
            await taskService.submitTask(taskId, {
                content: 'Báo cáo tiến độ',
                fileUrl: task._tempFile.url,
                fileName: task._tempFile.name
            });
            message.success('Nộp bài thành công!');
            fetchData(); // reload
        } catch {
            message.error('Lỗi khi nộp bài');
        } finally {
            setUploadingObj(prev => ({ ...prev, [`submit_${taskId}`]: false }));
        }
    };

    const removeTempFile = (taskId) => {
        setSubList(prev => prev.map(task => {
            if (task.id === taskId) {
                const newTask = { ...task };
                delete newTask._tempFile;
                return newTask;
            }
            return task;
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!registration) {
        return (
            <div className="py-2">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Nộp Báo Cáo</h1>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                    <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-6">
                        <span className="material-symbols-outlined text-4xl">folder_off</span>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Chưa đăng ký đề tài</h2>
                    <p className="text-slate-500 max-w-md">Bạn cần đăng ký đề tài và đợi giảng viên duyệt trước khi có thể xem yêu cầu nộp báo cáo.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="py-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Quản lý Nộp Báo Cáo</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">menu_book</span>
                        Đề tài: <strong className="text-slate-900 dark:text-white">{registration.topic?.title || 'Chưa rõ tên đề tài'}</strong>
                    </p>
                </div>
            </div>

            {/* Progress Overview Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 lg:flex lg:items-center lg:justify-between lg:gap-12">
                <div className="flex-1 mb-6 lg:mb-0">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tiến độ nộp báo cáo</span>
                        <span className="text-xl font-black text-primary">{progressPercent}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
                
                <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-slate-800 dark:text-white mb-1">{totalTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng cộng</span>
                    </div>
                    <div className="w-px h-12 bg-slate-200 dark:bg-slate-800 self-center shrink-0"></div>
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-amber-500 mb-1">{openTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ nộp</span>
                    </div>
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-indigo-500 mb-1">{submittedTasks - completedTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã nộp</span>
                    </div>
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-emerald-500 mb-1">{completedTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã chấm</span>
                    </div>
                </div>
            </div>

            {/* Submissions List */}
            <div className="space-y-6">
                {subList.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 flex flex-col items-center justify-center text-center">
                        <div className="size-16 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 mb-4">
                            <span className="material-symbols-outlined text-3xl">assignment</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-700 dark:text-slate-300">Giảng viên chưa tạo yêu cầu báo cáo nào</h3>
                        <p className="text-slate-500 text-sm max-w-xs">Các yêu cầu nộp báo cáo hoặc tài liệu theo từng giai đoạn sẽ xuất hiện ở đây.</p>
                    </div>
                ) : subList.map((task) => {
                    const cfg = statusConfig[task.status] || { colorClass: 'bg-slate-100 text-slate-700', icon: <span className="material-symbols-outlined text-[16px]">info</span>, label: task.status };
                    const isUploading = uploadingObj[task.id];
                    const isSubmitting = uploadingObj[`submit_${task.id}`];
                    const submissions = task.submissions || [];
                    const lastSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

                    return (
                        <div key={task.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row">
                            {/* Left Column: Info & Upload */}
                            <div className="p-6 lg:p-8 lg:w-3/5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`mt-1 shrink-0 px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${cfg.colorClass}`}>
                                        {cfg.icon}
                                        {cfg.label}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">{task.title}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{task.content}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/50 w-fit px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            Hạn nộp: <strong className="text-slate-700 dark:text-slate-300">{task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'Không có hạn'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Upload Area */}
                                {task.status === 'OPEN' && !lastSubmission && (
                                    <div className="mt-8">
                                        {!task._tempFile ? (
                                            <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                                                    {isUploading ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3"></div>
                                                            <p className="text-sm text-slate-500 font-semibold mb-1">Đang tải lên...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary transition-colors mb-3">cloud_upload</span>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 font-bold mb-1"><span className="text-primary">Click để tải lên</span> hoặc kéo thả file vào đây</p>
                                                            <p className="text-xs text-slate-500">Hỗ trợ PDF, DOCX, ZIP (tối đa 20MB)</p>
                                                        </>
                                                    )}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    disabled={isUploading}
                                                    onChange={e => handleFileChange(e, task.id)} 
                                                    accept=".pdf,.doc,.docx,.zip,.rar"
                                                />
                                            </label>
                                        ) : (
                                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                                                <div className="flex items-center justify-between gap-4 mb-4">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="size-12 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-2xl text-primary">description</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{task._tempFile.name}</h4>
                                                            <p className="text-xs text-slate-500">{task._tempFile.size} &bull; Sẵn sàng nộp</p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => removeTempFile(task.id)}
                                                        className="size-8 rounded-full bg-white text-slate-400 hover:text-red-500 shadow-sm border border-slate-200 flex items-center justify-center shrink-0 transition-colors"
                                                        title="Hủy"
                                                        disabled={isSubmitting}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                                    </button>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => handleSubmit(task.id)}
                                                    disabled={isSubmitting}
                                                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
                                                >
                                                    {isSubmitting ? (
                                                        <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Đang xử lý...</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-[20px]">send</span> Chốt nộp báo cáo</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right Column: History & Feedback */}
                            <div className="p-6 lg:p-8 lg:w-2/5 bg-slate-50/50 dark:bg-slate-800/10 flex flex-col">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                    Lịch sử & Phản hồi
                                </h3>

                                <div className="flex-1 space-y-4">
                                    {lastSubmission ? (
                                        <>
                                            {/* File submitted */}
                                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex gap-3 min-w-0">
                                                        <div className="size-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={lastSubmission.fileName || 'Tài liệu đã nộp'}>
                                                                {lastSubmission.fileName || 'Tài liệu đã nộp'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-0.5">Nộp lúc: {new Date(lastSubmission.submittedAt).toLocaleString('vi-VN')}</p>
                                                        </div>
                                                    </div>
                                                    <a 
                                                        href={lastSubmission.fileUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-colors"
                                                        title="Tải xuống"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Feedback */}
                                            {lastSubmission.feedback ? (
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4 mt-4 relative">
                                                    <div className="absolute -top-3 left-6">
                                                        <span className="material-symbols-outlined text-indigo-400 bg-indigo-50 dark:bg-slate-900 rounded-full">chat_bubble</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Nhận xét từ Giảng viên</p>
                                                        <p className="text-[10px] text-indigo-600/70">{new Date(lastSubmission.feedbackAt || Date.now()).toLocaleDateString('vi-VN')}</p>
                                                    </div>
                                                    <p className="text-sm text-indigo-900 dark:text-indigo-100 italic leading-relaxed">
                                                        "{lastSubmission.feedback}"
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 mt-4">
                                                    <p className="text-sm text-slate-400">Chưa có nhận xét từ giảng viên.</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-8">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">hourglass_empty</span>
                                            <p className="text-sm text-slate-500">Chưa có tài liệu nào được nộp.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default SubmissionPage;
