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
    message,
    Modal,
    Progress,
    Segmented,
    Select,
    Table,
    Typography,
} from 'antd';
import {
    NotificationOutlined,
    PlusOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import registrationService from '../../services/registrationService';
import taskService from '../../services/taskService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import PageLoader from '../../components/common/PageLoader';
import StatCard from '../../components/common/StatCard';
import StudentProgressDetailPanel from './components/StudentProgressDetailPanel';
import { formatSemesterLabel } from '../../utils/semesterDisplay';

const { Text } = Typography;

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

    const openTaskReviewModal = (task, decision) => {
        if (decision === 'COMPLETED') {
            const studentName = selectedRegistration?.student?.fullName || 'Sinh viên';
            Modal.confirm({
                title: 'Xác nhận đánh giá đạt',
                content: `Bạn chắc chắn đánh giá task "${task.title}" của ${studentName} là ĐẠT? Sau khi xác nhận, task sẽ được đánh dấu hoàn thành.`,
                okText: 'Xác nhận',
                cancelText: 'Hủy',
                onOk: async () => {
                    await handleUpdateTaskStatus(task.id, { status: 'COMPLETED' });
                },
            });
            return;
        }

        setReviewTask(task);
        reviewForm.resetFields();
        setReviewModalOpen(true);
    };

    const handleSubmitTaskReview = async (values) => {
        if (!reviewTask) return;
        const payload = {
            status: 'REVISION',
            reviewComment: values.reviewComment,
            dueDate: values.newDueDate?.toISOString(),
        };
        await handleUpdateTaskStatus(reviewTask.id, payload);
        setReviewModalOpen(false);
        setReviewTask(null);
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
        <div>
            <PageHeader
                title="Theo dõi tiến độ"
                subtitle="Bấm vào sinh viên để mở chi tiết ngay trong trang"
                actions={(
                    <Flex gap={8} wrap="wrap">
                        <Button
                            icon={<NotificationOutlined />}
                            loading={remindLoading}
                            onClick={handleBulkRemind}
                            disabled={!selectedRegistration || remindableTaskIds.length === 0}
                        >
                            Nhắc nộp
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
                            Giao nhiệm vụ mới
                        </Button>
                    </Flex>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                <StatCard icon="task_alt" iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Đúng tiến độ" value={onTrack} />
                <StatCard icon="monitoring" iconBg="bg-amber-50" iconColor="text-amber-600" label="Cần theo dõi sát" value={atRisk} />
                <StatCard icon="warning" iconBg="bg-rose-50" iconColor="text-rose-600" label="Trễ tiến độ" value={delayed} />
                <StatCard icon="assignment_late" iconBg="bg-red-50" iconColor="text-red-600" label="Có nhiệm vụ quá hạn" value={overdueCount} />
            </div>

            <Card
                bordered={false}
                style={{ borderRadius: 14 }}
                title="Bảng theo dõi sinh viên"
                extra={(
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
                            style={{ width: 220 }}
                            options={currentSemesterOptions}
                        />
                        <Select
                            placeholder="Tên đồ án"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={projectNameFilter}
                            onChange={(value) => setProjectNameFilter(value || null)}
                            style={{ width: 220 }}
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
                            style={{ width: 300 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                    </Flex>
                )}
            >
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
                        },
                    })}
                    locale={{ emptyText: <Empty description="Không có dữ liệu phù hợp bộ lọc" /> }}
                />
            </Card>

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

            <Modal
                title="Đánh giá giai đoạn"
                open={reviewModalOpen}
                onCancel={() => setReviewModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <Form form={reviewForm} layout="vertical" onFinish={handleSubmitTaskReview} style={{ marginTop: 16 }}>
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message='Đánh giá hiện tại: "Không đạt". Sinh viên phải sửa và nộp lại theo hạn mới.'
                    />

                    <Form.Item name="reviewComment" label="Lý do và yêu cầu sửa (Bắt buộc)" rules={[{ required: true, message: 'Vui lòng nhập lý do/nhận xét' }]}>
                        <Input.TextArea rows={4} placeholder="Nhập chi tiết nhận xét và các điểm cần khắc phục..." />
                    </Form.Item>

                    <Form.Item name="newDueDate" label="Hạn nộp mới (Bắt buộc)" rules={[{ required: true, message: 'Vui lòng chọn hạn nộp mới' }]}>
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>

                    <Flex justify="flex-end" gap={12}>
                        <Button onClick={() => setReviewModalOpen(false)}>ủy</Button>
                        <Button type="primary" htmlType="submit" loading={!!updatingTaskId}>Gửi kết quả</Button>
                    </Flex>
                </Form>
            </Modal>
        </div>
    );
}

export default ProgressTrackingPage;
