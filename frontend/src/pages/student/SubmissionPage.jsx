import { useState, useEffect, useMemo } from 'react';
import { Button, Card, Divider, Empty, Steps, Tag, Typography, message, Tooltip, Alert } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    LockOutlined,
    ReloadOutlined,
    UploadOutlined,
    UserOutlined,
    TeamOutlined,
    CalendarOutlined,
    SafetyCertificateOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import taskService from '../../services/taskService';
import registrationService from '../../services/registrationService';
import meetingLogService from '../../services/meetingLogService';
import PageHeader from '../../components/common/PageHeader';
import PageLoader from '../../components/common/PageLoader';
import HybridBMFormModal from '../../components/forms/HybridBMFormModal';
import BMSubmissionViewer from '../../components/forms/BMSubmissionViewer';

const { Title, Text, Paragraph } = Typography;

const BM_STEPS = [
    { key: 'REGISTRATION', title: '1. Đăng ký', shortTitle: 'Đăng ký', desc: 'Duyệt đề tài' },
    { key: 'BM01', title: '2. BM01', shortTitle: 'BM01', desc: 'Đề cương chi tiết' },
    { key: 'BM02', title: '3. BM02', shortTitle: 'BM02', desc: 'Giao nhiệm vụ' },
    { key: 'BM03', title: '4. BM03', shortTitle: 'BM03', desc: 'Tiến độ & Nhật ký' },
    { key: 'BM04', title: '5. Thẩm định', shortTitle: 'Đánh giá GVHD', desc: 'Cho ra bảo vệ' },
];

const statusBadgeConfig = {
    OPEN: { text: 'Chưa nộp', color: 'default', icon: <ClockCircleOutlined /> },
    IN_PROGRESS: { text: 'Đang thực hiện', color: 'processing', icon: <ClockCircleOutlined /> },
    SUBMITTED: { text: 'Chờ GV duyệt', color: 'warning', icon: <ClockCircleOutlined /> },
    REVISION: { text: 'Yêu cầu sửa', color: 'error', icon: <ExclamationCircleOutlined /> },
    COMPLETED: { text: 'Đã phê duyệt', color: 'success', icon: <CheckCircleOutlined /> },
    LOCKED: { text: 'Đang khóa', color: 'default', icon: <LockOutlined /> },
};

export default function SubmissionPage() {
    const [registration, setRegistration] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [meetingLogs, setMeetingLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTask, setActiveTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const regRes = await registrationService.getMyRegistration();
            if (regRes.success && regRes.data) {
                const regData = regRes.data;
                setRegistration(regData);

                // Load tasks
                const taskRes = await taskService.getTasksByRegistration(regData.id);
                if (taskRes.success) {
                    setTasks(taskRes.data || []);
                }

                // Load meeting logs
                const logRes = await meetingLogService.getMeetingLogs(regData.id);
                if (logRes.success) {
                    setMeetingLogs(logRes.data || []);
                }
            } else {
                setRegistration(null);
                setTasks([]);
                setMeetingLogs([]);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu nộp biểu mẫu.');
        } finally {
            setLoading(false);
        }
    };

    // Helper map of task by taskType
    const taskByType = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            map[t.taskType] = t;
        });
        return map;
    }, [tasks]);

    // Check sequential lock status with bypass support
    const isStepLocked = (taskType) => {
        if (!registration || !['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(registration.status)) {
            return true;
        }
        if (taskType === 'BM01') return false;
        if (taskType === 'BM02') {
            const bm01 = taskByType.BM01;
            return !bm01 || (!bm01.isBypassed && bm01.status !== 'COMPLETED');
        }
        if (taskType === 'BM03_CHECKPOINT_1' || taskType === 'BM03_CHECKPOINT') {
            const bm02 = taskByType.BM02;
            return !bm02 || (!bm02.isBypassed && bm02.status !== 'COMPLETED');
        }
        if (taskType === 'BM03_CHECKPOINT_2') {
            const cp1 = taskByType.BM03_CHECKPOINT_1 || taskByType.BM03_CHECKPOINT;
            return !cp1 || (!cp1.isBypassed && cp1.status !== 'COMPLETED');
        }
        if (taskType === 'REPORT_DRAFT') {
            const cp2 = taskByType.BM03_CHECKPOINT_2;
            return !cp2 || (!cp2.isBypassed && cp2.status !== 'COMPLETED');
        }
        return false;
    };

    // Calculate current active step index in the 5-step process
    const currentStepIndex = useMemo(() => {
        if (!registration) return 0;
        if (['SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(registration.status)) return 4;
        
        const report = taskByType.REPORT_DRAFT;
        const cp2 = taskByType.BM03_CHECKPOINT_2;
        const cp1 = taskByType.BM03_CHECKPOINT_1 || taskByType.BM03_CHECKPOINT;
        const bm02 = taskByType.BM02;
        const bm01 = taskByType.BM01;

        if (report?.status === 'COMPLETED' || report?.isBypassed) return 4;
        if (cp2?.status === 'COMPLETED' || cp2?.isBypassed || cp1?.status === 'COMPLETED') return 3;
        if (bm02?.status === 'COMPLETED' || bm02?.isBypassed) return 3;
        if (bm01?.status === 'COMPLETED' || bm01?.isBypassed) return 2;
        if (['APPROVED', 'IN_PROGRESS'].includes(registration.status)) return 1;
        return 0;
    }, [registration, taskByType]);

    const handleOpenSubmitModal = (task) => {
        if (task.isBypassed) {
            message.info('Nhiệm vụ này đã được miễn thẩm định (Bypass).');
            return;
        }
        if (isStepLocked(task.taskType)) {
            message.warning('Vui lòng hoàn thành và chờ duyệt biểu mẫu trước đó.');
            return;
        }
        setActiveTask(task);
        setModalVisible(true);
    };

    const handleSubmitForm = async (payload) => {
        if (!activeTask) return;
        try {
            setSubmitting(true);
            const res = await taskService.submitTask(activeTask.id, payload);
            if (res.success) {
                message.success('Nộp biểu mẫu thành công!');
                setModalVisible(false);
                fetchData();
            } else {
                message.error(res.message || 'Không thể nộp biểu mẫu.');
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra khi nộp bài.');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter out any legacy BM04 from student submit tasks
    const studentTasks = useMemo(() => {
        return tasks.filter((t) => t.taskType !== 'BM04');
    }, [tasks]);

    if (loading) return <PageLoader />;

    if (!registration) {
        return (
            <div className="py-6 space-y-6">
                <PageHeader
                    breadcrumb={[
                        { label: 'Cổng Sinh viên' },
                        { label: 'Học vụ & Biểu mẫu' },
                    ]}
                    title="Nộp Biểu Mẫu & Báo Cáo Tiến Độ"
                    subtitle="Theo dõi tiến độ, nộp biểu mẫu chuẩn hóa BM01 - BM03 và xem nhật ký làm việc với GVHD."
                />
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-12 text-center">
                    <Empty
                        description={
                            <div className="space-y-2">
                                <p className="text-slate-600 font-medium">Bạn chưa đăng ký hoặc chưa được duyệt đề tài đồ án nào trong học kỳ này.</p>
                                <p className="text-xs text-slate-400">Vui lòng vào mục "Danh sách đề tài" để chọn hoặc đề xuất đề tài trước.</p>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="py-4 space-y-6">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Sinh viên' },
                    { label: 'Học vụ & Biểu mẫu' },
                    { label: 'Tiến độ đồ án' },
                ]}
                title="Quy Trình Biểu Mẫu & Tiến Độ Thực Hiện"
                subtitle="Theo dõi lộ trình học vụ, nộp biểu mẫu tuần tự và kiểm tra biên bản làm việc định kỳ với GVHD."
                tags={[
                    { label: `Đề tài: ${registration.topic?.title}`, color: 'blue' },
                    { label: `GVHD: ${registration.topic?.mentor?.fullName || 'N/A'}`, color: 'cyan' },
                ]}
                actions={
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>
                        Làm mới
                    </Button>
                }
            />

            {/* Stepper Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            QUY TRÌNH HỌC VỤ BẮT BUỘC
                        </span>
                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                            {registration.topic?.title || 'Đề tài Đồ án tốt nghiệp'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Trạng thái hiện tại:</span>
                        <Tag color="processing" className="font-semibold">{registration.status}</Tag>
                    </div>
                </div>

                <div className="py-3 overflow-x-auto">
                    <Steps
                        current={currentStepIndex}
                        items={BM_STEPS.map((step, idx) => {
                            let status = 'wait';
                            if (idx < currentStepIndex) status = 'finish';
                            else if (idx === currentStepIndex) status = 'process';

                            return {
                                title: <span className="font-semibold text-xs md:text-sm">{step.shortTitle}</span>,
                                description: <span className="text-xs text-slate-400">{step.desc}</span>,
                                status,
                            };
                        })}
                    />
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Danh sách biểu mẫu nhiệm vụ</h3>
                        <p className="text-xs text-slate-500">Mô hình Hybrid: Điền thông tin cấu trúc + Tệp đính kèm bản scan/PDF</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        Tổng số: <b className="text-slate-700">{studentTasks.length}</b> nhiệm vụ
                    </span>
                </div>

                {studentTasks.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-8 text-center">
                        <Empty description="Chưa có biểu mẫu nào được khởi tạo cho đề tài này." />
                    </div>
                ) : (
                    studentTasks.map((task) => {
                        const isBypassed = task.isBypassed;
                        const locked = !isBypassed && isStepLocked(task.taskType);
                        const effectiveStatus = isBypassed ? 'COMPLETED' : locked ? 'LOCKED' : task.status;
                        const badge = isBypassed
                            ? { text: 'Miễn thẩm định', color: 'purple', icon: <CheckCircleOutlined /> }
                            : (statusBadgeConfig[effectiveStatus] || statusBadgeConfig.OPEN);
                        const submissions = task.submissions || [];
                        const lastSubmission = submissions.length > 0 ? submissions[0] : null;
                        const canSubmit = !locked && !isBypassed && ['OPEN', 'IN_PROGRESS', 'REVISION'].includes(task.status);
                        const isOverdue = !isBypassed && task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'COMPLETED';

                        return (
                            <div
                                key={task.id}
                                className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden shadow-sm ${
                                    isBypassed
                                        ? 'border-purple-200 bg-purple-50/20'
                                        : locked
                                            ? 'border-slate-200/60 bg-slate-50/40 opacity-75'
                                            : isOverdue
                                                ? 'border-rose-200 hover:border-rose-300'
                                                : 'border-slate-200/90 hover:border-blue-300'
                                }`}
                            >
                                <div className="p-5 md:p-6 flex flex-col lg:flex-row gap-5 justify-between">
                                    {/* Left: Task Info */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Tag color={badge.color} icon={badge.icon} className="font-semibold text-xs">
                                                {badge.text}
                                            </Tag>
                                            {task.taskType && (
                                                <Tag color="blue" className="font-mono text-xs">
                                                    {task.taskType}
                                                </Tag>
                                            )}
                                            {task.dueDate && !isBypassed && (
                                                <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                                    <ClockCircleOutlined />
                                                    Hạn nộp: {dayjs(task.dueDate).format('DD/MM/YYYY HH:mm')}
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-base font-bold text-slate-900 leading-snug">
                                            {task.title}
                                        </h4>

                                        {task.content && (
                                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                {task.content}
                                            </p>
                                        )}

                                        {isBypassed && (
                                            <div className="bg-purple-50 border border-purple-200/70 p-3 rounded-lg text-xs text-purple-800">
                                                <strong>Xác nhận miễn thẩm định (Bypass):</strong> {task.bypassReason || 'Được miễn theo phê duyệt của Ban Quản Trị / GVHD.'}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="pt-1 flex items-center gap-2 flex-wrap">
                                            {isBypassed ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-purple-700 bg-purple-100/70 px-3 py-1.5 rounded-lg font-medium">
                                                    <CheckCircleOutlined />
                                                    Đã được miễn làm bước này
                                                </span>
                                            ) : locked ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/70">
                                                    <LockOutlined />
                                                    Cần hoàn thành biểu mẫu trước để mở khóa
                                                </span>
                                            ) : canSubmit ? (
                                                <Button
                                                    type="primary"
                                                    icon={<UploadOutlined />}
                                                    onClick={() => handleOpenSubmitModal(task)}
                                                    className="font-medium"
                                                >
                                                    {task.status === 'REVISION' ? 'Nộp lại biểu mẫu' : 'Nộp biểu mẫu'}
                                                </Button>
                                            ) : task.status === 'SUBMITTED' ? (
                                                <Button
                                                    onClick={() => handleOpenSubmitModal(task)}
                                                    icon={<EditOutlined />}
                                                    className="text-xs font-medium"
                                                >
                                                    Cập nhật bài nộp
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Right: Submission & Feedback Preview */}
                                    <div className="lg:w-5/12 bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                <FileTextOutlined className="text-blue-600" />
                                                Bài nộp gần nhất & Đánh giá
                                            </div>
                                            <BMSubmissionViewer submission={lastSubmission} showFeedback={true} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Sổ Nhật Ký Buổi Gặp Gỡ GVHD */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <TeamOutlined className="text-blue-600 text-lg" />
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Sổ Nhật Ký Làm Việc & Gặp Gỡ GVHD</h3>
                            <p className="text-xs text-slate-500">Minh chứng quá trình làm việc định kỳ do Thầy/Cô trực tiếp ghi nhận</p>
                        </div>
                    </div>
                    <Tag color="blue" className="font-semibold text-xs px-2.5 py-1">
                        Tổng số buổi đã gặp: <strong>{meetingLogs.length}</strong>
                    </Tag>
                </div>

                {meetingLogs.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                        Chưa có nhật ký buổi gặp nào được ghi nhận. GVHD sẽ cập nhật sau các buổi trao đổi định kỳ tại Lab hoặc Online.
                    </div>
                ) : (
                    <div className="space-y-3 pt-2">
                        {meetingLogs.map((log, idx) => (
                            <div key={log.id} className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <CalendarOutlined className="text-slate-400" />
                                        <span className="font-bold text-slate-800 text-xs">
                                            Buổi {meetingLogs.length - idx}: {dayjs(log.meetingDate).format('DD/MM/YYYY')}
                                        </span>
                                        <Tag color={log.meetingType === 'LAB' ? 'green' : log.meetingType === 'ONLINE' ? 'blue' : 'orange'} className="text-[11px] font-semibold">
                                            {log.meetingType === 'LAB' ? 'Trực tiếp tại Lab' : log.meetingType === 'ONLINE' ? 'Họp Online (Meet/Zoom)' : 'Văn phòng bộ môn'}
                                        </Tag>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                        Ghi nhận bởi: {log.creator?.fullName || 'GVHD'}
                                    </span>
                                </div>

                                <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200/50 space-y-1">
                                    <div><strong>Nội dung đã báo cáo:</strong> {log.studentWorkSummary}</div>
                                    {log.nextPlan && (
                                        <div><strong>Kế hoạch tiếp theo:</strong> {log.nextPlan}</div>
                                    )}
                                    {log.supervisorNotes && (
                                        <div className="text-blue-700 pt-1 border-t border-slate-100">
                                            <strong>Dặn dò / Góp ý của Thầy/Cô:</strong> {log.supervisorNotes}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* BM04 Gatekeeping Status Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Phiếu Nhận Xét BM04 & Quyết Định Ra Bảo Vệ</h3>
                        <p className="text-xs text-slate-500">Quyết định chốt chặn thẩm định của Giảng viên hướng dẫn để được xếp vào Hội đồng bảo vệ</p>
                    </div>
                </div>

                {['SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(registration.status) ? (
                    <Alert
                        type="success"
                        showIcon
                        icon={<CheckCircleOutlined className="text-lg" />}
                        message={<span className="font-bold text-emerald-800 text-sm">GVHD ĐÃ DUYỆT ĐỒNG Ý CHO RA BẢO VỆ</span>}
                        description={
                            <div className="space-y-1 mt-1 text-xs text-emerald-700">
                                <p>Đề tài của bạn đã đủ điều kiện học vụ và được chuyển sang Ban Quản Trị Viện để phân công vào Hội đồng bảo vệ tốt nghiệp.</p>
                                {registration.outlineFeedback && (
                                    <div className="bg-white/80 p-2.5 rounded border border-emerald-200 mt-2 font-mono whitespace-pre-wrap text-slate-700">
                                        {registration.outlineFeedback}
                                    </div>
                                )}
                            </div>
                        }
                    />
                ) : registration.status === 'DROPPED' ? (
                    <Alert
                        type="error"
                        showIcon
                        icon={<CloseCircleOutlined className="text-lg" />}
                        message={<span className="font-bold text-rose-800 text-sm">GVHD ĐÁNH GIÁ KHÔNG ĐỒNG Ý CHO RA BẢO VỆ</span>}
                        description={
                            <div className="space-y-1 mt-1 text-xs text-rose-700">
                                <p>Tiến độ hoặc chất lượng đề tài chưa đạt yêu cầu để ra Hội đồng bảo vệ đợt này.</p>
                                {registration.outlineFeedback && (
                                    <div className="bg-white/80 p-2.5 rounded border border-rose-200 mt-2 whitespace-pre-wrap text-slate-700">
                                        {registration.outlineFeedback}
                                    </div>
                                )}
                            </div>
                        }
                    />
                ) : (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
                        <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <ClockCircleOutlined className="text-amber-500" />
                            Đang trong giai đoạn thực hiện đồ án
                        </div>
                        <p>
                            GVHD sẽ tổng hợp minh chứng các buổi gặp gỡ định kỳ ({meetingLogs.length} buổi đã ghi nhận) và kết quả các đợt kiểm tra tiến độ để lập Phiếu nhận xét BM04 chính thức trước ngày bảo vệ.
                        </p>
                    </div>
                )}
            </div>

            {/* Hybrid Form Modal */}
            <HybridBMFormModal
                visible={modalVisible}
                task={activeTask}
                registration={registration}
                onClose={() => setModalVisible(false)}
                onSubmit={handleSubmitForm}
                submitting={submitting}
            />
        </div>
    );
}