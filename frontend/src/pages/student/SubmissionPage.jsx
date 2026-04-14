import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import uploadService from '../../services/uploadService';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';

const statusConfig = {
    OPEN: { label: 'Chưa nộp', colorClass: 'bg-amber-100 text-amber-700 border-amber-200', icon: <span className="material-symbols-outlined text-[16px]">schedule</span> },
    IN_PROGRESS: { label: 'Đang làm', colorClass: 'bg-blue-100 text-blue-700 border-blue-200', icon: <span className="material-symbols-outlined text-[16px]">pending_actions</span> },
    REVISION: { label: 'Cần sửa', colorClass: 'bg-orange-100 text-orange-700 border-orange-200', icon: <span className="material-symbols-outlined text-[16px]">edit_note</span> },
    SUBMITTED: { label: 'Đã nộp', colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <span className="material-symbols-outlined text-[16px]">task_alt</span> },
    COMPLETED: { label: 'Đã chấm', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <span className="material-symbols-outlined text-[16px]">verified</span> },
    OVERDUE: { label: 'Trễ hạn', colorClass: 'bg-red-100 text-red-700 border-red-200', icon: <span className="material-symbols-outlined text-[16px]">error</span> },
};

const ACTIVE_REG_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];
const getLateInfo = (dueDate, submittedAt) => {
    if (!dueDate || !submittedAt) return { isLate: false, daysLate: 0 };
    const due = new Date(dueDate);
    const submitted = new Date(submittedAt);
    const diffMs = submitted.getTime() - due.getTime();
    if (diffMs <= 0) return { isLate: false, daysLate: 0 };
    return { isLate: true, daysLate: Math.floor(diffMs / (1000 * 60 * 60 * 24)) };
};

function SubmissionPage() {
    const [subList, setSubList] = useState([]);
    const [registration, setRegistration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploadingObj, setUploadingObj] = useState({});
    const [submissionContent, setSubmissionContent] = useState({});
    const [taskFilter, setTaskFilter] = useState('ALL');

    const canSubmit = registration && ACTIVE_REG_STATUSES.includes(registration.status);

    useEffect(() => {
        fetchData();
    }, []);

    const effectiveTasks = useMemo(() => subList.map((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = dueDate && dueDate.getTime() < Date.now() && ['OPEN', 'IN_PROGRESS'].includes(task.status);
        return { ...task, _effectiveStatus: isOverdue ? 'OVERDUE' : task.status };
    }), [subList]);

    const visibleTasks = useMemo(() => {
        if (taskFilter === 'ALL') return effectiveTasks;
        return effectiveTasks.filter((task) => task._effectiveStatus === taskFilter);
    }, [effectiveTasks, taskFilter]);

    const totalTasks = effectiveTasks.length;
    const submittedTasks = effectiveTasks.filter((t) => ['SUBMITTED', 'COMPLETED'].includes(t._effectiveStatus)).length;
    const completedTasks = effectiveTasks.filter((t) => t._effectiveStatus === 'COMPLETED').length;
    const openTasks = effectiveTasks.filter((t) => ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(t._effectiveStatus)).length;
    const revisionTasks = effectiveTasks.filter((t) => t._effectiveStatus === 'REVISION').length;
    const overdueTasks = effectiveTasks.filter((t) => t._effectiveStatus === 'OVERDUE').length;
    const progressPercent = totalTasks > 0 ? Math.round((submittedTasks / totalTasks) * 100) : 0;

    const fetchData = async () => {
        try {
            setLoading(true);
            const regRes = await registrationService.getMyRegistration();
            if (regRes.success && regRes.data) {
                setRegistration(regRes.data);

                const taskRes = await taskService.getTasksByRegistration(regRes.data.id);
                if (taskRes.success) {
                    setSubList(taskRes.data || []);
                }
            } else {
                setRegistration(null);
                setSubList([]);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu nộp báo cáo.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e, taskId) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!canSubmit) {
            message.warning('Đăng ký của bạn chưa ở trạng thái cho phép nộp báo cáo.');
            return;
        }

        setUploadingObj((prev) => ({ ...prev, [taskId]: true }));
        try {
            const res = await uploadService.uploadFile(file, 'submissions');
            if (!res?.success || !res?.data?.url) {
                throw new Error(res?.message || 'Upload failed');
            }

            setSubList((prev) =>
                prev.map((task) => {
                    if (task.id === taskId) {
                        return {
                            ...task,
                            _tempFile: {
                                name: file.name,
                                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                                date: new Date().toLocaleDateString('vi-VN'),
                                url: res.data.url,
                            },
                        };
                    }
                    return task;
                })
            );

            message.success(`${file.name} tải lên thành công. Vui lòng bấm "Chốt nộp báo cáo".`);
        } catch (err) {
            message.error(err?.message || `${file.name} tải lên thất bại.`);
        } finally {
            setUploadingObj((prev) => ({ ...prev, [taskId]: false }));
            e.target.value = null;
        }
    };

    const handleSubmit = async (taskId) => {
        const task = subList.find((t) => t.id === taskId);
        if (!task) return;

        const content = (submissionContent[taskId] || '').trim();
        const fileUrl = task?._tempFile?.url || null;
        const fileName = task?._tempFile?.name || null;

        if (!content && !fileUrl) {
            message.warning('Vui lòng nhập nội dung hoặc tải tệp trước khi nộp.');
            return;
        }

        try {
            setUploadingObj((prev) => ({ ...prev, [`submit_${taskId}`]: true }));
            const response = await taskService.submitTask(taskId, {
                content: content || null,
                fileUrl,
                fileName,
            });

            if (response.success) {
                message.success('Nộp bài thành công!');
                setSubmissionContent((prev) => {
                    const next = { ...prev };
                    delete next[taskId];
                    return next;
                });
                fetchData();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi nộp bài');
        } finally {
            setUploadingObj((prev) => ({ ...prev, [`submit_${taskId}`]: false }));
        }
    };

    const removeTempFile = (taskId) => {
        setSubList((prev) =>
            prev.map((task) => {
                if (task.id === taskId) {
                    const newTask = { ...task };
                    delete newTask._tempFile;
                    return newTask;
                }
                return task;
            })
        );
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
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Nộp Báo Cáo</h1>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                    <div className="size-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-6">
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
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Quản lý Nộp Báo Cáo</h1>
                    <p className="mt-2 text-slate-600 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">menu_book</span>
                        Đề tài: <strong className="text-slate-900">{registration.topic?.title || 'Chưa rõ tên đề tài'}</strong>
                    </p>
                </div>
            </div>

            {!canSubmit && (
                <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium">
                    Đăng ký hiện tại của bạn là <strong>{registration.status}</strong>. Chỉ có thể nộp báo cáo khi đề tài đã được duyệt hoặc đang thực hiện.
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 lg:flex lg:items-center lg:justify-between lg:gap-12">
                <div className="flex-1 mb-6 lg:mb-0">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Tiến độ nộp báo cáo</span>
                        <span className="text-xl font-black text-primary">{progressPercent}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-slate-800 mb-1">{totalTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng cộng</span>
                    </div>
                    <div className="w-px h-12 bg-slate-200 self-center shrink-0"></div>
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-amber-500 mb-1">{openTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ nộp</span>
                    </div>
                    <div className="text-center px-4 shrink-0">
                        <span className="block text-3xl font-black text-red-500 mb-1">{overdueTasks}</span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quá hạn</span>
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

            <div className="mb-6 flex flex-wrap gap-2">
                {[
                    { key: 'ALL', label: `Tất cả (${totalTasks})` },
                    { key: 'OPEN', label: `Chưa nộp (${openTasks})` },
                    { key: 'REVISION', label: `Cần sửa (${revisionTasks})` },
                    { key: 'OVERDUE', label: `Quá hạn (${overdueTasks})` },
                    { key: 'SUBMITTED', label: `Đã nộp (${submittedTasks - completedTasks})` },
                    { key: 'COMPLETED', label: `Đã chấm (${completedTasks})` },
                ].map((item) => (
                    <button
                        key={item.key}
                        onClick={() => setTaskFilter(item.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${taskFilter === item.key
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="space-y-6">
                {visibleTasks.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-12 flex flex-col items-center justify-center text-center">
                        <div className="size-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 mb-4">
                            <span className="material-symbols-outlined text-3xl">assignment</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-700">Không có nhiệm vụ phù hợp bộ lọc</h3>
                        <p className="text-slate-500 text-sm max-w-xs">Bạn có thể đổi bộ lọc để xem các nhiệm vụ khác.</p>
                    </div>
                ) : visibleTasks.map((task) => {
                    const cfg = statusConfig[task._effectiveStatus] || { colorClass: 'bg-slate-100 text-slate-700', icon: <span className="material-symbols-outlined text-[16px]">info</span>, label: task._effectiveStatus };
                    const isUploading = uploadingObj[task.id];
                    const isSubmitting = uploadingObj[`submit_${task.id}`];
                    const submissions = task.submissions || [];
                    const lastSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;
                    const lateInfo = lastSubmission ? getLateInfo(task.dueDate, lastSubmission.submittedAt) : { isLate: false, daysLate: 0 };
                    const canResubmit = ['OPEN', 'IN_PROGRESS', 'REVISION', 'OVERDUE'].includes(task._effectiveStatus) && canSubmit;

                    return (
                        <div key={task.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row">
                            <div className="p-6 lg:p-8 lg:w-3/5 border-b lg:border-b-0 lg:border-r border-slate-200">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`mt-1 shrink-0 px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${cfg.colorClass}`}>
                                        {cfg.icon}
                                        {cfg.label}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{task.title}</h3>
                                        <p className="text-sm text-slate-600 mb-3">{task.content}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            Hạn nộp: <strong className="text-slate-700">{task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'Không có hạn'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {canResubmit && (
                                    <div className="mt-6 mb-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nội dung báo cáo</label>
                                        <textarea
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
                                            rows="3"
                                            placeholder="Mô tả ngắn nội dung bạn nộp (tùy chọn nếu đã có file)..."
                                            value={submissionContent[task.id] || ''}
                                            onChange={(event) => setSubmissionContent((prev) => ({ ...prev, [task.id]: event.target.value }))}
                                        />
                                    </div>
                                )}

                                {canResubmit && (
                                    <div className="mt-8">
                                        {!task._tempFile ? (
                                            <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors group">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                                                    {isUploading ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3"></div>
                                                            <p className="text-sm text-slate-500 font-semibold mb-1">Đang tải lên...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary transition-colors mb-3">cloud_upload</span>
                                                            <p className="text-sm text-slate-700 font-bold mb-1"><span className="text-primary">Click để tải lên</span> hoặc kéo thả file vào đây</p>
                                                            <p className="text-xs text-slate-500">Hỗ trợ PDF, DOCX, ZIP (tối đa 20MB)</p>
                                                        </>
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    disabled={isUploading}
                                                    onChange={(e) => handleFileChange(e, task.id)}
                                                    accept=".pdf,.doc,.docx,.zip,.rar"
                                                />
                                            </label>
                                        ) : (
                                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                                                <div className="flex items-center justify-between gap-4 mb-4">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="size-12 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-2xl text-primary">description</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-slate-900 truncate">{task._tempFile.name}</h4>
                                                            <p className="text-xs text-slate-500">{task._tempFile.size} • Sẵn sàng nộp</p>
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
                                                        <><span className="material-symbols-outlined text-[20px]">send</span> {lastSubmission ? 'Nộp lại báo cáo' : 'Chốt nộp báo cáo'}</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 lg:p-8 lg:w-2/5 bg-slate-50/50 flex flex-col">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                    Lịch sử & Phản hồi
                                </h3>

                                <div className="flex-1 space-y-4">
                                    {lastSubmission ? (
                                        <>
                                            <div className="text-xs text-slate-500">Tổng số lần nộp: <strong>{submissions.length}</strong></div>
                                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex gap-3 min-w-0">
                                                        <div className="size-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 truncate" title={lastSubmission.fileName || 'Tài liệu đã nộp'}>
                                                                {lastSubmission.fileName || 'Bài nộp không kèm tệp'}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-0.5">Nộp lúc: {new Date(lastSubmission.submittedAt).toLocaleString('vi-VN')}</p>
                                                        </div>
                                                    </div>
                                                    {lastSubmission.fileUrl && (
                                                        <a
                                                            href={lastSubmission.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-colors"
                                                            title="Tải xuống"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">download</span>
                                                        </a>
                                                    )}
                                                </div>
                                                    {lastSubmission.content && (
                                                        <div className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                                                            {lastSubmission.content}
                                                        </div>
                                                    )}
                                                    {lateInfo.isLate && (
                                                        <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-700">
                                                            <span className="material-symbols-outlined text-[14px]">warning</span>
                                                            Nộp trễ {lateInfo.daysLate} ngày
                                                        </div>
                                                    )}
                                                </div>

                                            {lastSubmission.feedback ? (
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4 relative">
                                                    <div className="absolute -top-3 left-6">
                                                        <span className="material-symbols-outlined text-indigo-400 bg-indigo-50 rounded-full">chat_bubble</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-xs font-bold text-indigo-800">Nhận xét từ Giảng viên</p>
                                                        <p className="text-[10px] text-indigo-600/70">{new Date(lastSubmission.feedbackAt || Date.now()).toLocaleDateString('vi-VN')}</p>
                                                    </div>
                                                    <p className="text-sm text-indigo-900 italic leading-relaxed">"{lastSubmission.feedback}"</p>
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
