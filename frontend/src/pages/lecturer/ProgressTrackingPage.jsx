import { useMemo, useState, useEffect } from 'react';
import {
    Alert,
    Avatar,
    Button,
    Card,
    DatePicker,
    Empty,
    Flex,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Progress,
    Radio,
    Segmented,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    FastForwardOutlined,
    NotificationOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    TeamOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import registrationService from '../../services/registrationService';
import taskService from '../../services/taskService';
import meetingLogService from '../../services/meetingLogService';
import archiveService from '../../services/archiveService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PageLoader from '../../components/common/PageLoader';
import StatCard from '../../components/common/StatCard';
import StudentProgressDetailPanel from './components/StudentProgressDetailPanel';
import BMReviewDrawer from '../../components/forms/BMReviewDrawer';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
import { formatSemesterLabel } from '../../utils/semesterDisplay';

const { Text, Title, Paragraph } = Typography;

const isOverdueTask = (task) => {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate).getTime() < Date.now() && !['COMPLETED', 'SUBMITTED'].includes(task.status);
};

const getYearWeek = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const week = Math.ceil((((date - firstDay) / dayMs) + firstDay.getDay() + 1) / 7);
    return { year: date.getFullYear(), week };
};

const getWeekLabel = (dateInput) => {
    const yw = getYearWeek(dateInput);
    if (!yw) return 'Không có hạn nộp';
    return `Tuần ${yw.week} - ${yw.year}`;
};

const pickNearestLatestSemesterId = (semesterList = []) => {
    if (!Array.isArray(semesterList) || semesterList.length === 0) return null;
    const now = dayjs();
    const scored = semesterList
        .map((semester) => {
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const deadline = semester?.registrationDeadline ? dayjs(semester.registrationDeadline) : null;
            const latestPoint =
                (start && start.isValid() && start.valueOf())
                || (deadline && deadline.isValid() && deadline.valueOf())
                || 0;
            const distanceToNow = Math.abs((latestPoint || now.valueOf()) - now.valueOf());
            return { semester, latestPoint, distanceToNow };
        })
        .sort((a, b) => {
            if (a.distanceToNow !== b.distanceToNow) return a.distanceToNow - b.distanceToNow;
            return b.latestPoint - a.latestPoint;
        });
    return scored[0]?.semester?.id || null;
};

function ProgressTrackingPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [progressBandFilter, setProgressBandFilter] = useState('ALL');
    const [semesterFilter, setSemesterFilter] = useState(null);
    const [projectNameFilter, setProjectNameFilter] = useState(null);

    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [taskLoading, setTaskLoading] = useState(false);
    const [updatingTaskId, setUpdatingTaskId] = useState(null);
    const [taskViewerFilter, setTaskViewerFilter] = useState('ALL');
    const [weekScopeFilter, setWeekScopeFilter] = useState('ALL');

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskSubmitting, setTaskSubmitting] = useState(false);
    const [taskForm] = Form.useForm();
    const [remindLoading, setRemindLoading] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewTask, setReviewTask] = useState(null);
    const [reviewForm] = Form.useForm();

    // Meeting Logs state
    const [meetingLogs, setMeetingLogs] = useState([]);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);
    const [meetingForm] = Form.useForm();

    // BM04 Gatekeeping state
    const [bm04ModalOpen, setBm04ModalOpen] = useState(false);
    const [bm04Submitting, setBm04Submitting] = useState(false);
    const [bm04Form] = Form.useForm();

    // Task Bypass state
    const [bypassModalOpen, setBypassModalOpen] = useState(false);
    const [bypassTaskTarget, setBypassTaskTarget] = useState(null);
    const [bypassSubmitting, setBypassSubmitting] = useState(false);
    const [bypassForm] = Form.useForm();

    // Post-Defense Archive states
    const [archiveData, setArchiveData] = useState(null);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveReviewModalOpen, setArchiveReviewModalOpen] = useState(false);
    const [archiveReviewSubmitting, setArchiveReviewSubmitting] = useState(false);
    const [archiveReviewForm] = Form.useForm();
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certificateData, setCertificateData] = useState(null);
    const [certLoading, setCertLoading] = useState(false);

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const res = await registrationService.getAllRegistrations();
            if (res.success) {
                setRegistrations((res.data || []).filter((registration) => registration.status !== 'PENDING'));
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tải danh sách sinh viên đăng ký');
        } finally {
            setLoading(false);
        }
    };

    const fetchTasksForRegistration = async (registration) => {
        setTaskLoading(true);
        try {
            const res = await taskService.getTasksByRegistration(registration.id);
            if (res.success) {
                setSelectedTasks(res.data || []);
            }
        } catch {
            message.error('Lỗi khi tải danh sách nhiệm vụ');
        } finally {
            setTaskLoading(false);
        }
    };

    const fetchMeetingLogsForRegistration = async (registrationId) => {
        try {
            const res = await meetingLogService.getMeetingLogs(registrationId);
            if (res.success) {
                setMeetingLogs(res.data || []);
            }
        } catch {
            message.error('Lỗi khi tải nhật ký buổi gặp');
        }
    };

    const fetchArchiveForRegistration = async (registrationId) => {
        try {
            setArchiveLoading(true);
            const res = await archiveService.getArchiveByRegistration(registrationId);
            if (res.success) {
                setArchiveData(res.data?.archive || null);
            }
        } catch {
            setArchiveData(null);
        } finally {
            setArchiveLoading(false);
        }
    };

    const filteredRegistrations = useMemo(() => registrations.filter((registration) => {
        if (semesterFilter) {
            const semesterId = registration.topic?.semester?.id || registration.semesterId || null;
            if (semesterId !== semesterFilter) return false;
        }
        if (projectNameFilter) {
            if ((registration.topic?.projectCatalog?.name || '') !== projectNameFilter) return false;
        }
        if (statusFilter !== 'all' && registration.status !== statusFilter) return false;
        const progress = registration.progress || 0;
        if (progressBandFilter === 'ON_TRACK' && progress < 70) return false;
        if (progressBandFilter === 'AT_RISK' && (progress < 30 || progress >= 70)) return false;
        if (progressBandFilter === 'DELAYED' && progress >= 30) return false;
        if (progressBandFilter === 'OVERDUE' && !registration.hasOverdueTask) return false;

        if (!searchText.trim()) return true;
        const search = searchText.toLowerCase();
        const studentName = registration.student?.fullName?.toLowerCase() || '';
        const studentCode = registration.student?.code?.toLowerCase() || '';
        const topicTitle = registration.topic?.title?.toLowerCase() || '';
        return studentName.includes(search) || studentCode.includes(search) || topicTitle.includes(search);
    }), [registrations, searchText, statusFilter, progressBandFilter, semesterFilter, projectNameFilter]);

    const currentSemesterOptions = useMemo(() => {
        const now = dayjs();
        const map = new Map();
        registrations.forEach((registration) => {
            const semester = registration.topic?.semester;
            if (!semester?.id) return;
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const end = semester?.endDate ? dayjs(semester.endDate) : null;
            if (!start || !end || !start.isValid() || !end.isValid()) return;
            const isCurrent = (now.isAfter(start) || now.isSame(start)) && (now.isBefore(end) || now.isSame(end));
            if (!isCurrent) return;
            if (!map.has(semester.id)) map.set(semester.id, semester);
        });
        return [...map.values()].map((semester) => ({
            value: semester.id,
            label: formatSemesterLabel(semester),
            raw: semester,
        }));
    }, [registrations]);

    const projectNameOptions = useMemo(
        () => Array.from(new Set(
            registrations
                .filter((registration) => !semesterFilter || (registration.topic?.semester?.id || registration.semesterId) === semesterFilter)
                .map((registration) => registration.topic?.projectCatalog?.name)
                .filter(Boolean),
        ))
            .sort((a, b) => a.localeCompare(b, 'vi'))
            .map((name) => ({ value: name, label: name })),
        [registrations, semesterFilter],
    );

    useEffect(() => {
        if (!currentSemesterOptions.length) {
            setSemesterFilter(null);
            return;
        }
        const stillExists = currentSemesterOptions.some((option) => option.value === semesterFilter);
        if (semesterFilter && stillExists) return;
        const nearestSemesterId = pickNearestLatestSemesterId(currentSemesterOptions.map((option) => option.raw));
        setSemesterFilter(nearestSemesterId);
    }, [currentSemesterOptions, semesterFilter]);

    const assignableRegistrations = useMemo(
        () => registrations.filter((registration) => ['APPROVED', 'IN_PROGRESS'].includes(registration.status)),
        [registrations],
    );

    const openTaskModal = (registration = null) => {
        if (registration && !['APPROVED', 'IN_PROGRESS'].includes(registration.status)) {
            message.warning('Chỉ giao nhiệm vụ cho sinh viên đã duyệt hoặc đang thực hiện.');
            return;
        }
        taskForm.resetFields();
        if (registration) taskForm.setFieldsValue({ registrationId: registration.id });
        setTaskModalOpen(true);
    };

    const handleCreateTask = async (values) => {
        try {
            setTaskSubmitting(true);
            const payload = {
                registrationId: values.registrationId,
                title: values.title,
                content: values.content,
                dueDate: values.dueDate ? values.dueDate.toISOString() : null,
            };
            const res = await taskService.createTask(payload);
            if (res.success) {
                message.success('Đã giao nhiệm vụ');
                setTaskModalOpen(false);
                fetchRegistrations();
                if (selectedRegistration?.id === values.registrationId) fetchTasksForRegistration(selectedRegistration);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi giao nhiệm vụ');
        } finally {
            setTaskSubmitting(false);
        }
    };

    const handleUpdateTaskStatus = async (taskId, payload) => {
        try {
            setUpdatingTaskId(taskId);
            const res = await taskService.updateTaskStatus(taskId, payload);
            if (res.success) {
                const nextStatus = typeof payload === 'string' ? payload : payload.status;
                const nextDueDate = typeof payload === 'object' ? payload.dueDate : null;
                setSelectedTasks((prev) => prev.map((task) => (
                    task.id === taskId
                        ? { ...task, status: nextStatus, dueDate: nextDueDate || task.dueDate }
                        : task
                )));
                message.success('Đã cập nhật trạng thái nhiệm vụ');
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật trạng thái nhiệm vụ');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const onTrack = filteredRegistrations.filter((r) => (r.progress || 0) >= 70).length;
    const atRisk = filteredRegistrations.filter((r) => (r.progress || 0) >= 30 && (r.progress || 0) < 70).length;
    const delayed = filteredRegistrations.filter((r) => (r.progress || 0) < 30).length;
    const overdueCount = filteredRegistrations.filter((r) => r.hasOverdueTask).length;

    const nowWeek = getYearWeek(new Date());
    const prevWeek = nowWeek ? (nowWeek.week > 1 ? { year: nowWeek.year, week: nowWeek.week - 1 } : { year: nowWeek.year - 1, week: 52 }) : null;

    const visibleTasks = useMemo(() => {
        let working = [...selectedTasks];
        if (weekScopeFilter !== 'ALL') {
            working = working.filter((task) => {
                const yw = getYearWeek(task.dueDate);
                if (!yw) return false;
                if (weekScopeFilter === 'THIS_WEEK' && nowWeek) return yw.week === nowWeek.week && yw.year === nowWeek.year;
                if (weekScopeFilter === 'LAST_WEEK' && prevWeek) return yw.week === prevWeek.week && yw.year === prevWeek.year;
                return true;
            });
        }
        if (taskViewerFilter === 'ALL') return working;
        if (taskViewerFilter === 'OVERDUE') return working.filter(isOverdueTask);
        if (taskViewerFilter === 'NO_SUBMISSION') return working.filter((task) => !(task.submissions || []).length);
        return working.filter((task) => task.status === taskViewerFilter);
    }, [selectedTasks, taskViewerFilter, weekScopeFilter, nowWeek, prevWeek]);

    const tasksByWeek = useMemo(() => visibleTasks.reduce((acc, task) => {
        const key = getWeekLabel(task.dueDate);
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
    }, {}), [visibleTasks]);

    const taskOverview = useMemo(() => {
        const total = selectedTasks.length;
        const completed = selectedTasks.filter((task) => task.status === 'COMPLETED').length;
        const submitted = selectedTasks.filter((task) => task.status === 'SUBMITTED').length;
        const overdue = selectedTasks.filter(isOverdueTask).length;
        const progress = total > 0 ? Math.round(((completed + submitted) / total) * 100) : 0;
        return { total, completed, submitted, overdue, progress };
    }, [selectedTasks]);

    const remindableTaskIds = useMemo(
        () => visibleTasks.filter((task) => isOverdueTask(task) || !(task.submissions || []).length).map((task) => task.id),
        [visibleTasks],
    );

    const handleBulkRemind = async () => {
        if (remindableTaskIds.length === 0) {
            message.info('Hãy chọn sinh viên để nhắc nộp.');
            return;
        }
        try {
            setRemindLoading(true);
            const res = await taskService.remindTasks({ taskIds: remindableTaskIds });
            if (res.success) {
                message.success(`Đã gửi nhắc nộp cho ${res.data?.sent ?? remindableTaskIds.length} nhiệm vụ.`);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể gửi nhắc nộp hàng loạt');
        } finally {
            setRemindLoading(false);
        }
    };

    const openTaskReviewModal = (task) => {
        setReviewTask(task);
        setReviewModalOpen(true);
    };

    // Meeting log handlers
    const openMeetingModal = (registration = null) => {
        const target = registration || selectedRegistration;
        if (!target) {
            message.warning('Vui lòng chọn sinh viên trước khi ghi nhận buổi gặp');
            return;
        }
        meetingForm.resetFields();
        meetingForm.setFieldsValue({
            meetingDate: dayjs(),
            meetingType: 'OFFLINE_LAB',
        });
        setMeetingModalOpen(true);
    };

    const handleCreateMeetingLog = async (values) => {
        if (!selectedRegistration) return;
        try {
            setMeetingSubmitting(true);
            const payload = {
                meetingDate: values.meetingDate ? values.meetingDate.toISOString() : new Date().toISOString(),
                meetingType: values.meetingType,
                content: values.content,
                feedback: values.feedback,
                note: values.note,
            };
            const res = await meetingLogService.createMeetingLog(selectedRegistration.id, payload);
            if (res.success) {
                message.success('Đã ghi nhận buổi gặp thành công');
                setMeetingModalOpen(false);
                fetchMeetingLogsForRegistration(selectedRegistration.id);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi ghi nhận buổi gặp');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    const handleDeleteMeetingLog = async (logId) => {
        try {
            const res = await meetingLogService.deleteMeetingLog(logId);
            if (res.success) {
                message.success('Đã xóa nhật ký buổi gặp');
                setMeetingLogs((prev) => prev.filter((log) => log.id !== logId));
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi xóa nhật ký buổi gặp');
        }
    };

    // Task Bypass handlers
    const handleBypassTask = (task) => {
        setBypassTaskTarget(task);
        bypassForm.resetFields();
        bypassForm.setFieldsValue({
            reason: 'Đã hoàn thành nội dung tương đương / Thẩm định thông qua bảo vệ đề cương',
        });
        setBypassModalOpen(true);
    };

    const handleSubmitBypass = async (values) => {
        if (!bypassTaskTarget) return;
        try {
            setBypassSubmitting(true);
            const res = await taskService.bypassTask(bypassTaskTarget.id, { reason: values.reason });
            if (res.success) {
                message.success(`Đã miễn thẩm định cho ${bypassTaskTarget.title}`);
                setBypassModalOpen(false);
                setBypassTaskTarget(null);
                if (selectedRegistration) {
                    fetchTasksForRegistration(selectedRegistration);
                }
                fetchRegistrations();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi thực hiện miễn thẩm định');
        } finally {
            setBypassSubmitting(false);
        }
    };

    // BM04 Gatekeeping handlers
    const openBM04Modal = (registration = null) => {
        const target = registration || selectedRegistration;
        if (!target) {
            message.warning('Vui lòng chọn sinh viên');
            return;
        }
        bm04Form.resetFields();
        bm04Form.setFieldsValue({
            decision: 'AGREED',
            reviewContent: 'Sinh viên hoàn thành đầy đủ các giai đoạn nghiên cứu, thực hiện tốt các chỉ dẫn của GVHD, đáp ứng tiêu chuẩn đồ án tốt nghiệp.',
            defenseGrade: 8.5,
        });
        setBm04ModalOpen(true);
    };

    const handleSubmitBM04Review = async (values) => {
        if (!selectedRegistration) return;
        try {
            setBm04Submitting(true);
            const res = await registrationService.reviewBM04(selectedRegistration.id, {
                decision: values.decision,
                reviewContent: values.reviewContent,
                defenseGrade: values.defenseGrade,
                feedback: values.feedback,
            });
            if (res.success) {
                message.success(
                    values.decision === 'AGREED'
                        ? 'Đã lập Phiếu BM04 và ĐỒNG Ý cho sinh viên ra bảo vệ!'
                        : 'Đã lập Phiếu BM04 và KHÔNG ĐỒNG Ý cho bảo vệ (Hủy đề tài).'
                );
                setBm04ModalOpen(false);
                fetchRegistrations();
                if (selectedRegistration) {
                    fetchTasksForRegistration(selectedRegistration);
                }
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lập phiếu đánh giá BM04');
        } finally {
            setBm04Submitting(false);
        }
    };

    // Post-Defense Archive review handlers
    const openArchiveReviewModal = (archive) => {
        archiveReviewForm.resetFields();
        archiveReviewForm.setFieldsValue({
            decision: 'APPROVED',
            reviewerNotes: 'Hồ sơ lưu chiểu đầy đủ, đúng quy cách.',
        });
        setArchiveReviewModalOpen(true);
    };

    const handleSubmitArchiveReview = async (values) => {
        if (!selectedRegistration?.id) return;
        try {
            setArchiveReviewSubmitting(true);
            const res = await archiveService.reviewArchive(selectedRegistration.id, {
                decision: values.decision,
                reviewerNotes: values.reviewerNotes,
            });
            if (res.success) {
                message.success(
                    values.decision === 'APPROVED'
                        ? 'Đã nghiệm thu hồ sơ lưu chiểu thành công! Đề tài chuyển sang HOÀN TẤT (COMPLETED).'
                        : 'Đã gửi yêu cầu chỉnh sửa hồ sơ lưu chiểu cho sinh viên.'
                );
                setArchiveReviewModalOpen(false);
                fetchArchiveForRegistration(selectedRegistration.id);
                fetchRegistrations();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi nghiệm thu hồ sơ lưu chiểu');
        } finally {
            setArchiveReviewSubmitting(false);
        }
    };

    const handleOpenCertificate = async () => {
        if (!selectedRegistration?.id) return;
        try {
            setCertLoading(true);
            const res = await archiveService.getClearanceCertificate(selectedRegistration.id);
            if (res.success) {
                setCertificateData(res.data);
                setCertModalOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Giấy xác nhận tốt nghiệp');
        } finally {
            setCertLoading(false);
        }
    };

    const timelineItems = useMemo(() => selectedTasks
        .flatMap((task) => {
            const submissions = task.submissions || [];
            const latest = submissions.length ? submissions[submissions.length - 1] : null;
            const createdEvent = {
                time: task.createdAt || task.updatedAt,
                color: 'blue',
                title: `Giao nhiệm vụ: ${task.title}`,
                desc: task.content || 'Giảng viên đã giao nhiệm vụ mới.',
            };
            const submitEvent = latest ? {
                time: latest.submittedAt,
                color: 'green',
                title: `Sinh viên đã nộp: ${task.title}`,
                desc: latest.content || latest.fileName || 'Đã nộp file báo cáo.',
            } : null;
            return submitEvent ? [createdEvent, submitEvent] : [createdEvent];
        })
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8)
        .map((event) => ({
            color: event.color,
            children: (
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{new Date(event.time).toLocaleString('vi-VN')}</Text>
                    <div><Text strong>{event.title}</Text></div>
                    <Text style={{ fontSize: 12 }}>{event.desc}</Text>
                </div>
            ),
        })), [selectedTasks]);

    const columns = [
        {
            title: 'Sinh viên',
            dataIndex: 'student',
            key: 'student',
            width: '24%',
            render: (student) => (
                <Flex gap={10} align="center">
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#e6f4ff', color: '#0958d9' }} />
                    <Flex vertical gap={0}>
                        <Text strong>{student?.fullName || 'Sinh viên'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{student?.code || 'N/A'}</Text>
                    </Flex>
                </Flex>
            ),
        },
        {
            title: 'Đề tài',
            dataIndex: ['topic', 'title'],
            key: 'topic',
            width: '32%',
            render: (text, record) => (
                <Flex vertical gap={4}>
                    <Text style={{ fontSize: 13 }}>{text || 'Chưa đăng ký'}</Text>
                    {record.hasOverdueTask ? <Text type="danger">Quá hạn {record.overdueTaskCount || 0} nhiệm vụ</Text> : <Text type="success">Không quá hạn</Text>}
                </Flex>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: '14%',
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Tiến độ',
            dataIndex: 'progress',
            key: 'progress',
            width: '20%',
            render: (value) => (
                <Flex vertical gap={4}>
                    <Progress percent={value || 0} size={{ height: 8 }} showInfo={false} />
                    <Text style={{ fontSize: 12, fontWeight: 600 }}>{value || 0}%</Text>
                </Flex>
            ),
        },
        {
            title: 'Cập nhật',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: '10%',
            render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(text).toLocaleDateString('vi-VN')}</Text>,
        },
    ];

    if (loading) return <PageLoader />;

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Giảng viên' },
                    { label: 'Hướng dẫn & Đề tài' },
                    { label: 'Theo dõi tiến độ' },
                ]}
                title="Theo dõi Tiến độ Sinh viên"
                subtitle="Giám sát tiến độ hoàn thành nhiệm vụ, kiểm duyệt biểu mẫu BM01-BM04 và gửi nhắc nhở học vụ."
                tags={[
                    { label: `Đang theo dõi: ${filteredRegistrations.length} sinh viên`, color: 'blue' },
                ]}
                actions={(
                    <Space>
                        <Button
                            icon={<NotificationOutlined />}
                            loading={remindLoading}
                            onClick={handleBulkRemind}
                            disabled={!selectedRegistration || remindableTaskIds.length === 0}
                        >
                            Nhắc nộp ({remindableTaskIds.length})
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
                            Giao nhiệm vụ mới
                        </Button>
                    </Space>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon="task_alt" iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Đúng tiến độ" value={onTrack} />
                <StatCard icon="monitoring" iconBg="bg-amber-50" iconColor="text-amber-600" label="Cần theo dõi sát" value={atRisk} />
                <StatCard icon="warning" iconBg="bg-rose-50" iconColor="text-rose-600" label="Trễ tiến độ" value={delayed} />
                <StatCard icon="assignment_late" iconBg="bg-red-50" iconColor="text-red-600" label="Có nhiệm vụ quá hạn" value={overdueCount} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">
                            Bảng theo dõi sinh viên (Chọn một dòng để xem chi tiết)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tổng số: <b className="text-slate-800">{filteredRegistrations.length}</b> sinh viên
                        </p>
                    </div>
                    <Flex gap={8} wrap="wrap" justify="end">
                        <Segmented
                            value={progressBandFilter}
                            onChange={setProgressBandFilter}
                            options={[
                                { label: 'Tất cả', value: 'ALL' },
                                { label: 'Đúng tiến độ', value: 'ON_TRACK' },
                                { label: 'Rủi ro', value: 'AT_RISK' },
                                { label: 'Trễ', value: 'DELAYED' },
                                { label: 'Quá hạn', value: 'OVERDUE' },
                            ]}
                        />
                        <Select
                            placeholder="Học kỳ hiện tại"
                            allowClear
                            value={semesterFilter}
                            onChange={(value) => setSemesterFilter(value || null)}
                            style={{ width: 200 }}
                            options={currentSemesterOptions}
                        />
                        <Select
                            placeholder="Tên đồ án"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={projectNameFilter}
                            onChange={(value) => setProjectNameFilter(value || null)}
                            style={{ width: 200 }}
                            options={projectNameOptions}
                        />
                        <Select
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 160 }}
                            options={[
                                { value: 'all', label: 'Tất cả trạng thái' },
                                { value: 'APPROVED', label: 'Đã duyệt' },
                                { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
                                { value: 'SUBMITTED', label: 'Đã nộp' },
                                { value: 'DEFENDED', label: 'Đã bảo vệ' },
                                { value: 'COMPLETED', label: 'Hoàn thành' },
                                { value: 'REJECTED', label: 'Từ chối' },
                            ]}
                        />
                        <Input
                            placeholder="Tìm sinh viên, mã SV, đề tài..."
                            prefix={<SearchOutlined />}
                            style={{ width: 260 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                    </Flex>
                </div>
                <Table
                    dataSource={filteredRegistrations}
                    rowKey="id"
                    columns={columns}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    size="middle"
                    tableLayout="fixed"
                    rowClassName={(record) => (record.id === selectedRegistration?.id ? 'bg-blue-50/50 cursor-pointer' : 'cursor-pointer')}
                    onRow={(record) => ({
                        onClick: () => {
                            setSelectedRegistration(record);
                            setTaskViewerFilter('ALL');
                            setWeekScopeFilter('ALL');
                            fetchTasksForRegistration(record);
                            fetchMeetingLogsForRegistration(record.id);
                            fetchArchiveForRegistration(record.id);
                        },
                    })}
                    locale={{ emptyText: <Empty description="Không có dữ liệu phù hợp bộ lọc" /> }}
                />
            </div>

            <StudentProgressDetailPanel
                selectedRegistration={selectedRegistration}
                taskOverview={taskOverview}
                taskLoading={taskLoading}
                weekScopeFilter={weekScopeFilter}
                setWeekScopeFilter={setWeekScopeFilter}
                taskViewerFilter={taskViewerFilter}
                setTaskViewerFilter={setTaskViewerFilter}
                remindLoading={remindLoading}
                remindableTaskIds={remindableTaskIds}
                handleBulkRemind={handleBulkRemind}
                visibleTasks={visibleTasks}
                tasksByWeek={tasksByWeek}
                isOverdueTask={isOverdueTask}
                updatingTaskId={updatingTaskId}
                openTaskReviewModal={openTaskReviewModal}
                openTaskModal={openTaskModal}
                timelineItems={timelineItems}
                // Props for Gói 1
                meetingLogs={meetingLogs}
                openMeetingModal={openMeetingModal}
                handleDeleteMeetingLog={handleDeleteMeetingLog}
                handleBypassTask={handleBypassTask}
                openBM04Modal={openBM04Modal}
                bypassingTaskId={bypassSubmitting ? bypassTaskTarget?.id : null}
                // Props for Gói 2: Archive & Certificate
                archiveData={archiveData}
                openArchiveReviewModal={openArchiveReviewModal}
                handleOpenCertificate={handleOpenCertificate}
                archiveLoading={archiveLoading}
            />

            <Modal title="Giao nhiệm vụ cho sinh viên" open={taskModalOpen} onCancel={() => setTaskModalOpen(false)} footer={null} destroyOnClose>
                <Form form={taskForm} layout="vertical" onFinish={handleCreateTask} style={{ marginTop: 16 }}>
                    <Form.Item name="registrationId" label="Sinh viên thực hiện" rules={[{ required: true, message: 'Vui lòng chọn sinh viên' }]}>
                        <Select
                            placeholder="Chọn sinh viên"
                            options={assignableRegistrations.map((registration) => ({
                                value: registration.id,
                                label: `${registration.student?.fullName || 'Sinh viên'} (${registration.student?.code || 'N/A'}) - ${registration.topic?.title || 'Chưa đăng ký'}`,
                            }))}
                            showSearch
                            optionFilterProp="label"
                        />
                    </Form.Item>
                    <Form.Item name="title" label="Tiêu đề nhiệm vụ" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
                        <Input placeholder="Ví dụ: Nộp báo cáo tuần 3" />
                    </Form.Item>
                    <Form.Item name="content" label="Nội dung chi tiết (tùy chọn)">
                        <Input.TextArea rows={4} placeholder="Mô tả rõ mục tiêu, đầu ra mong muốn, tài liệu cần nộp..." />
                    </Form.Item>
                    <Form.Item name="dueDate" label="Hạn nộp (tùy chọn)">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Chọn hạn nộp" />
                    </Form.Item>
                    <Flex justify="flex-end" gap={12}>
                        <Button onClick={() => setTaskModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={taskSubmitting}>Giao nhiệm vụ</Button>
                    </Flex>
                </Form>
            </Modal>

            {/* Modal Ghi nhận Nhật ký Buổi gặp (Meeting Log - Chuẩn BM03) */}
            <Modal
                title={(
                    <Flex align="center" gap={8}>
                        <TeamOutlined className="text-blue-600" />
                        <span>Ghi nhận Nhật ký Buổi gặp (Chuẩn BM03)</span>
                    </Flex>
                )}
                open={meetingModalOpen}
                onCancel={() => setMeetingModalOpen(false)}
                footer={null}
                destroyOnClose
                width={560}
            >
                <Alert
                    type="info"
                    showIcon
                    message="Sổ tay điện tử GVHD"
                    description="Chỉ Giảng viên hướng dẫn có quyền lập và chỉnh sửa sổ nhật ký gặp gỡ. Sinh viên chỉ có quyền xem minh chứng để bảo đảm tính minh bạch."
                    style={{ marginBottom: 16, marginTop: 8 }}
                />
                <Form form={meetingForm} layout="vertical" onFinish={handleCreateMeetingLog}>
                    <Flex gap={16}>
                        <Form.Item
                            name="meetingDate"
                            label="Ngày giờ làm việc"
                            rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
                            style={{ flex: 1 }}
                        >
                            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="meetingType"
                            label="Hình thức gặp"
                            rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
                            style={{ flex: 1 }}
                        >
                            <Select
                                options={[
                                    { value: 'OFFLINE_LAB', label: '🏫 Trực tiếp tại Lab' },
                                    { value: 'OFFLINE_OFFICE', label: '🏢 Văn phòng bộ môn' },
                                    { value: 'ONLINE', label: '💻 Trực tuyến (Meet/Zoom)' },
                                ]}
                            />
                        </Form.Item>
                    </Flex>
                    <Form.Item
                        name="content"
                        label="Nội dung sinh viên báo cáo / kết quả làm việc"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung trao đổi' }]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Ví dụ: Sinh viên báo cáo tiến độ module Authentication, đã demo được luồng JWT trên Swagger..."
                        />
                    </Form.Item>
                    <Form.Item
                        name="feedback"
                        label="Nhận xét & Hướng dẫn của GVHD (Dặn dò tuần sau)"
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Ví dụ: Cần bổ sung validate request ở middleware, hoàn thành viết unit tests..."
                        />
                    </Form.Item>
                    <Form.Item
                        name="note"
                        label="Ghi chú thêm (Tùy chọn)"
                    >
                        <Input placeholder="Ghi chú cá nhân hoặc lưu ý bổ sung..." />
                    </Form.Item>
                    <Flex justify="flex-end" gap={12} style={{ marginTop: 12 }}>
                        <Button onClick={() => setMeetingModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={meetingSubmitting} icon={<TeamOutlined />}>
                            Lưu Nhật ký
                        </Button>
                    </Flex>
                </Form>
            </Modal>

            {/* Modal Miễn thẩm định (Bypass Task BM01/BM02) */}
            <Modal
                title={(
                    <Flex align="center" gap={8}>
                        <FastForwardOutlined className="text-amber-500" />
                        <span>Xác nhận Miễn thẩm định (Bypass)</span>
                    </Flex>
                )}
                open={bypassModalOpen}
                onCancel={() => {
                    setBypassModalOpen(false);
                    setBypassTaskTarget(null);
                }}
                footer={null}
                destroyOnClose
                width={520}
            >
                <Alert
                    type="warning"
                    showIcon
                    message="Cơ chế Bypass linh hoạt"
                    description={`Bạn đang thực hiện miễn thẩm định cho cột mốc "${bypassTaskTarget?.title || ''}". Thao tác này sẽ đánh dấu nhiệm vụ là HOÀN THÀNH (BYPASSED) và ghi nhận vào hồ sơ minh chứng mà không bắt buộc sinh viên phải nộp lại biểu mẫu.`}
                    style={{ marginBottom: 16, marginTop: 8 }}
                />
                <Form form={bypassForm} layout="vertical" onFinish={handleSubmitBypass}>
                    <Form.Item
                        name="reason"
                        label="Lý do miễn thẩm định"
                        rules={[{ required: true, message: 'Vui lòng nhập lý do giải trình' }]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Ví dụ: Đã thẩm định thông qua bảo vệ đề cương tại Bộ môn / Có chứng chỉ công nhận tương đương..."
                        />
                    </Form.Item>
                    <Flex justify="flex-end" gap={12}>
                        <Button onClick={() => setBypassModalOpen(false)}>Hủy</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={bypassSubmitting}
                            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
                            icon={<FastForwardOutlined />}
                        >
                            Xác nhận Miễn Thẩm Định
                        </Button>
                    </Flex>
                </Form>
            </Modal>

            {/* Modal Lập Phiếu BM04 & Quyết định cho ra bảo vệ (Gatekeeping) */}
            <Modal
                title={(
                    <Flex align="center" gap={8}>
                        <SafetyCertificateOutlined className="text-emerald-600" />
                        <span>Lập Phiếu Đánh Giá BM04 & Quyết Định Bảo Vệ</span>
                    </Flex>
                )}
                open={bm04ModalOpen}
                onCancel={() => setBm04ModalOpen(false)}
                footer={null}
                destroyOnClose
                width={680}
            >
                <div className="space-y-4 my-2">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Sinh viên:</Text>
                                <div><Text strong>{selectedRegistration?.student?.fullName}</Text> ({selectedRegistration?.student?.code})</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Tổng số buổi gặp BM03:</Text>
                                <div>
                                    <Tag color={meetingLogs.length >= 8 ? 'success' : 'warning'} className="font-semibold text-sm">
                                        {meetingLogs.length} buổi gặp
                                    </Tag>
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Tiến độ tổng hợp:</Text>
                                <div><Text strong className="text-blue-600">{taskOverview.progress}%</Text></div>
                            </div>
                        </Flex>
                    </div>

                    <Alert
                        type="info"
                        showIcon
                        message="Cổng kiểm soát chất lượng (Gatekeeping)"
                        description="Phiếu BM04 là quyết định chính thức của GVHD. Nếu 'Đồng ý', trạng thái đề tài sẽ chuyển sang ĐÃ NỘP (SUBMITTED) để Khoa sắp xếp Hội đồng. Nếu 'Không đồng ý', đề tài sẽ bị dừng (DROPPED)."
                    />

                    <Form form={bm04Form} layout="vertical" onFinish={handleSubmitBM04Review}>
                        <Form.Item
                            name="decision"
                            label="Quyết định của GVHD về việc cho ra bảo vệ"
                            rules={[{ required: true, message: 'Vui lòng chọn quyết định' }]}
                        >
                            <Radio.Group className="w-full">
                                <Space direction="vertical" className="w-full orientation-vertical">
                                    <Radio value="AGREED" className="p-3 border border-emerald-200 rounded-lg hover:bg-emerald-50/50 w-full block">
                                        <Flex gap={8} align="center">
                                            <CheckCircleOutlined className="text-emerald-600 text-lg" />
                                            <div>
                                                <Text strong className="text-emerald-700">ĐỒNG Ý cho ra bảo vệ trước Hội đồng</Text>
                                                <div className="text-xs text-slate-500">Đề tài đạt yêu cầu về khối lượng, chất lượng và thời gian làm việc.</div>
                                            </div>
                                        </Flex>
                                    </Radio>
                                    <Radio value="DISAGREED" className="p-3 border border-rose-200 rounded-lg hover:bg-rose-50/50 w-full block">
                                        <Flex gap={8} align="center">
                                            <CloseCircleOutlined className="text-rose-600 text-lg" />
                                            <div>
                                                <Text strong className="text-rose-700">KHÔNG ĐỒNG Ý cho ra bảo vệ (Dừng đề tài)</Text>
                                                <div className="text-xs text-slate-500">Đề tài chưa hoàn thiện, không đảm bảo tiến độ hoặc vi phạm quy định.</div>
                                            </div>
                                        </Flex>
                                    </Radio>
                                </Space>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item
                            name="defenseGrade"
                            label="Điểm đánh giá của GVHD (Thang điểm 10)"
                            rules={[{ required: true, message: 'Vui lòng nhập điểm đánh giá' }]}
                        >
                            <InputNumber
                                min={0}
                                max={10}
                                step={0.1}
                                precision={2}
                                style={{ width: 180 }}
                                placeholder="Ví dụ: 8.5"
                            />
                        </Form.Item>

                        <Form.Item
                            name="reviewContent"
                            label="Nhận xét chi tiết của GVHD (Nội dung biểu mẫu BM04)"
                            rules={[{ required: true, message: 'Vui lòng nhập nhận xét chi tiết' }]}
                        >
                            <Input.TextArea
                                rows={4}
                                placeholder="Nhận xét về tinh thần thái độ, năng lực thực hiện, kết quả đạt được, đóng góp mới của đề tài..."
                            />
                        </Form.Item>

                        <Form.Item
                            name="feedback"
                            label="Dặn dò / Khuyến nghị thêm cho sinh viên trước buổi bảo vệ (Tùy chọn)"
                        >
                            <Input.TextArea
                                rows={2}
                                placeholder="Ví dụ: Cần chuẩn bị kỹ slide phần demo kiến trúc hệ thống và mang theo video backup..."
                            />
                        </Form.Item>

                        <Flex justify="flex-end" gap={12} style={{ marginTop: 16 }}>
                            <Button onClick={() => setBm04ModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={bm04Submitting}
                                icon={<SafetyCertificateOutlined />}
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                            >
                                Xác Nhận & Ký Phiếu BM04
                            </Button>
                        </Flex>
                    </Form>
                </div>
            </Modal>

            {/* BM Review Drawer */}
            <BMReviewDrawer
                visible={reviewModalOpen}
                task={reviewTask}
                registration={selectedRegistration}
                onClose={() => {
                    setReviewModalOpen(false);
                    setReviewTask(null);
                }}
                onSuccess={() => {
                    if (selectedRegistration) {
                        fetchTasksForRegistration(selectedRegistration);
                    }
                    fetchRegistrations();
                }}
            />

            {/* Modal Nghiệm Thu Lưu Chiểu (Post-Defense Archive Review) */}
            <Modal
                title={(
                    <Flex align="center" gap={8}>
                        <SafetyCertificateOutlined className="text-emerald-600" />
                        <span>Nghiệm Thu Hồ Sơ Lưu Chiểu Đồ Án</span>
                    </Flex>
                )}
                open={archiveReviewModalOpen}
                onCancel={() => setArchiveReviewModalOpen(false)}
                footer={null}
                destroyOnClose
                width={560}
            >
                <div className="space-y-4 my-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Xác nhận hoàn tất đồ án tốt nghiệp"
                        description="Sau khi GVHD xác nhận 'Nghiệm thu đạt yêu cầu', đề tài sẽ chính thức chuyển sang trạng thái HOÀN TẤT (COMPLETED). Sinh viên sẽ được cấp Giấy Xác Nhận Hoàn Thành Đồ Án Tốt Nghiệp."
                    />

                    <Form form={archiveReviewForm} layout="vertical" onFinish={handleSubmitArchiveReview}>
                        <Form.Item
                            name="decision"
                            label="Quyết định nghiệm thu"
                            rules={[{ required: true, message: 'Vui lòng chọn quyết định' }]}
                        >
                            <Radio.Group className="w-full">
                                <Space direction="vertical" className="w-full">
                                    <Radio value="APPROVED" className="p-3 border border-emerald-200 rounded-lg hover:bg-emerald-50/50 w-full block">
                                        <Flex gap={8} align="center">
                                            <CheckCircleOutlined className="text-emerald-600 text-lg" />
                                            <div>
                                                <Text strong className="text-emerald-700">NGHIỆM THU ĐẠT YÊU CẦU (HOÀN TẤT ĐỒ ÁN)</Text>
                                                <div className="text-xs text-slate-500">Báo cáo, slide, video demo và mã nguồn hợp lệ, đúng quy chuẩn.</div>
                                            </div>
                                        </Flex>
                                    </Radio>
                                    <Radio value="REVISION_REQUIRED" className="p-3 border border-amber-200 rounded-lg hover:bg-amber-50/50 w-full block">
                                        <Flex gap={8} align="center">
                                            <ExclamationCircleOutlined className="text-amber-500 text-lg" />
                                            <div>
                                                <Text strong className="text-amber-700">YÊU CẦU CHỈNH SỬA / BỔ SUNG TÀI LIỆU</Text>
                                                <div className="text-xs text-slate-500">Tài liệu còn thiếu sót hoặc chưa đáp ứng góp ý của Hội đồng.</div>
                                            </div>
                                        </Flex>
                                    </Radio>
                                </Space>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item
                            name="reviewerNotes"
                            label="Ý kiến nhận xét nghiệm thu (Dặn dò cho sinh viên)"
                            rules={[{ required: true, message: 'Vui lòng nhập nhận xét nghiệm thu' }]}
                        >
                            <Input.TextArea
                                rows={3}
                                placeholder="Nhập ý kiến đánh giá về hồ sơ lưu chiểu hoặc các điểm cần sửa..."
                            />
                        </Form.Item>

                        <Flex justify="flex-end" gap={12} style={{ marginTop: 16 }}>
                            <Button onClick={() => setArchiveReviewModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={archiveReviewSubmitting}
                                icon={<SafetyCertificateOutlined />}
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                            >
                                Lưu Quyết Định Nghiệm Thu
                            </Button>
                        </Flex>
                    </Form>
                </div>
            </Modal>

            {/* Modal Giấy Xác Nhận Tốt Nghiệp */}
            <ClearanceCertificateModal
                visible={certModalOpen}
                onClose={() => setCertModalOpen(false)}
                certificateData={certificateData}
            />
        </div>
    );
}

export default ProgressTrackingPage;
