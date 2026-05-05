import {
    Alert,
    Avatar,
    Button,
    Card,
    Empty,
    Flex,
    List,
    Progress,
    Segmented,
    Spin,
    Tag,
    Timeline,
    Tooltip,
    Typography,
} from 'antd';
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    DownloadOutlined,
    FileTextOutlined,
    NotificationOutlined,
    PlusOutlined,
    UserOutlined,
} from '@ant-design/icons';
import StatusBadge from '../../../components/common/StatusBadge';

const { Title, Text } = Typography;

const taskStatusOptions = [
    { value: 'OPEN', label: 'Mới giao' },
    { value: 'IN_PROGRESS', label: 'Đang làm' },
    { value: 'SUBMITTED', label: 'Đã nộp' },
    { value: 'REVISION', label: 'Yêu cầu sửa' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
];

const statusColorMap = {
    OPEN: 'default',
    IN_PROGRESS: 'processing',
    SUBMITTED: 'blue',
    REVISION: 'orange',
    COMPLETED: 'success',
};

function StudentProgressDetailPanel({
    selectedRegistration,
    taskOverview,
    taskLoading,
    weekScopeFilter,
    setWeekScopeFilter,
    taskViewerFilter,
    setTaskViewerFilter,
    remindLoading,
    remindableTaskIds,
    handleBulkRemind,
    visibleTasks,
    tasksByWeek,
    isOverdueTask,
    updatingTaskId,
    openTaskReviewModal,
    openTaskModal,
    timelineItems,
}) {
    if (!selectedRegistration) return null;

    return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 space-y-4">
                <Card bordered={false} style={{ borderRadius: 14 }}>
                    <Flex justify="space-between" align="start" wrap="wrap" gap={12}>
                        <Flex gap={12}>
                            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#e6f4ff', color: '#0958d9' }} />
                            <Flex vertical>
                                <Title level={4} style={{ margin: 0 }}>{selectedRegistration.student?.fullName || 'Sinh viên'}</Title>
                                <Text type="secondary">{selectedRegistration.student?.code || 'N/A'}</Text>
                                <Text>{selectedRegistration.topic?.title || 'Chưa đăng ký đề tài'}</Text>
                            </Flex>
                        </Flex>
                        <Flex vertical align="end" gap={8}>
                            <StatusBadge status={selectedRegistration.status} />
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal(selectedRegistration)}>Giao nhiệm vụ</Button>
                        </Flex>
                    </Flex>
                    <div className="mt-3">
                        <Progress percent={taskOverview.progress} strokeColor={taskOverview.progress < 40 ? '#ff4d4f' : taskOverview.progress < 70 ? '#faad14' : '#52c41a'} />
                        <Flex gap={8} wrap="wrap">
                            <Tag>Tổng task: {taskOverview.total}</Tag>
                            <Tag color="blue">Đã nộp: {taskOverview.submitted}</Tag>
                            <Tag color="success">Hoàn thành: {taskOverview.completed}</Tag>
                            <Tag color={taskOverview.overdue > 0 ? 'error' : 'default'}>Quá hạn: {taskOverview.overdue}</Tag>
                        </Flex>
                    </div>
                </Card>

                <Card bordered={false} style={{ borderRadius: 14 }} title="Nhiệm vụ của sinh viên">
                    <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 10 }}>
                        <Flex gap={8} wrap="wrap">
                            <Segmented
                                size="small"
                                value={weekScopeFilter}
                                onChange={setWeekScopeFilter}
                                options={[
                                    { label: 'Mọi tuần', value: 'ALL' },
                                    { label: 'Tuần này', value: 'THIS_WEEK' },
                                    { label: 'Tuần trước', value: 'LAST_WEEK' },
                                ]}
                            />
                            <Segmented
                                size="small"
                                value={taskViewerFilter}
                                onChange={setTaskViewerFilter}
                                options={[
                                    { label: 'Tất cả', value: 'ALL' },
                                    { label: 'Quá hạn', value: 'OVERDUE' },
                                    { label: 'Chưa nộp', value: 'NO_SUBMISSION' },
                                    { label: 'Mới giao', value: 'OPEN' },
                                    { label: 'Đang làm', value: 'IN_PROGRESS' },
                                    { label: 'Yêu cầu sửa', value: 'REVISION' },
                                ]}
                            />
                        </Flex>
                        <Button
                            icon={<NotificationOutlined />}
                            loading={remindLoading}
                            onClick={handleBulkRemind}
                            disabled={remindableTaskIds.length === 0}
                        >
                            Nhắc nộp ({remindableTaskIds.length})
                        </Button>
                    </Flex>

                    {taskOverview.overdue > 0 ? (
                        <Alert
                            type="warning"
                            showIcon
                            message={`Có ${taskOverview.overdue} nhiệm vụ quá hạn cần theo dõi`}
                            style={{ marginBottom: 12 }}
                        />
                    ) : null}

                    <Spin spinning={taskLoading}>
                        {!visibleTasks.length ? (
                            <Empty description="Không có nhiệm vụ phù hợp bộ lọc hiện tại" />
                        ) : (
                            Object.entries(tasksByWeek).map(([week, tasks]) => (
                                <Card key={week} size="small" style={{ marginBottom: 12 }}>
                                    <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                                        <CalendarOutlined style={{ color: '#1677ff' }} />
                                        <Text strong>{week}</Text>
                                    </Flex>
                                    <List
                                        dataSource={tasks}
                                        renderItem={(task) => {
                                            const submissions = task.submissions || [];
                                            const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;
                                            const overdue = isOverdueTask(task);
                                            const dueText = task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'Không có hạn';
                                            return (
                                                <List.Item>
                                                    <Card
                                                        size="small"
                                                        style={{ width: '100%', border: overdue ? '1px solid #ffa39e' : '1px solid #f0f0f0', background: overdue ? '#fff2f0' : '#fff' }}
                                                    >
                                                        <Flex justify="space-between" align="start" gap={8}>
                                                            <Flex vertical gap={6} style={{ flex: 1 }}>
                                                                <Flex align="center" gap={8} wrap="wrap">
                                                                    <Text strong>{task.title}</Text>
                                                                    <Tag color={statusColorMap[task.status] || 'default'}>
                                                                        {taskStatusOptions.find((opt) => opt.value === task.status)?.label || task.status}
                                                                    </Tag>
                                                                    {overdue ? <Tag color="error">Quá hạn</Tag> : null}
                                                                </Flex>
                                                                {task.content ? <Text type="secondary" style={{ fontSize: 13 }}>{task.content}</Text> : null}
                                                                <Text type="secondary" style={{ fontSize: 12 }}><ClockCircleOutlined /> Hạn nộp: {dueText}</Text>
                                                                {latestSubmission ? (
                                                                    <Flex vertical gap={4}>
                                                                        <Text style={{ fontSize: 12 }}><FileTextOutlined /> {latestSubmission.content || 'Đã có nội dung nộp'}</Text>
                                                                        <Flex gap={8} wrap="wrap" align="center">
                                                                            <Tag color="blue">{latestSubmission.fileName || 'Bài nộp'}</Tag>
                                                                            {latestSubmission.fileUrl ? (
                                                                                <Button type="link" icon={<DownloadOutlined />} href={latestSubmission.fileUrl} target="_blank" rel="noopener noreferrer" style={{ paddingInline: 0 }}>
                                                                                    Tải bài nộp
                                                                                </Button>
                                                                            ) : null}
                                                                        </Flex>
                                                                    </Flex>
                                                                ) : (
                                                                    <Tooltip title="Sinh viên chưa nộp bài">
                                                                        <Text type="secondary" style={{ fontSize: 12 }}><FileTextOutlined /> Chưa nộp</Text>
                                                                    </Tooltip>
                                                                )}
                                                            </Flex>
                                                            <Flex vertical gap={8} style={{ minWidth: 150 }}>
                                                                <Button
                                                                    type="primary"
                                                                    icon={<CheckCircleOutlined />}
                                                                    loading={updatingTaskId === task.id}
                                                                    onClick={() => openTaskReviewModal(task, 'COMPLETED')}
                                                                >
                                                                    Dat
                                                                </Button>
                                                                <Button
                                                                    danger
                                                                    icon={<CloseCircleOutlined />}
                                                                    loading={updatingTaskId === task.id}
                                                                    onClick={() => openTaskReviewModal(task, 'REVISION')}
                                                                >
                                                                    Khong dat
                                                                </Button>
                                                            </Flex>
                                                        </Flex>
                                                    </Card>
                                                </List.Item>
                                            );
                                        }}
                                    />
                                </Card>
                            ))
                        )}
                    </Spin>
                </Card>
            </div>

            <div className="lg:col-span-4">
                <Card bordered={false} style={{ borderRadius: 14 }} title="Lịch sử trao đổi">
                    {timelineItems.length ? <Timeline items={timelineItems} /> : <Empty description="Chưa có lịch sử" />}
                </Card>
            </div>
        </div>
    );
}

export default StudentProgressDetailPanel;
