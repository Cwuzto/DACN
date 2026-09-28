import {
    Alert,
    Avatar,
    Button,
    Card,
    Empty,
    Flex,
    List,
    Popconfirm,
    Progress,
    Segmented,
    Spin,
    Tabs,
    Tag,
    Timeline,
    Tooltip,
    Typography,
} from 'antd';
import {
    CalendarOutlined,
    CheckCircleOutlined,
    CheckOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    CloudUploadOutlined,
    DeleteOutlined,
    DownloadOutlined,
    FastForwardOutlined,
    FilePdfOutlined,
    FilePptOutlined,
    FileTextOutlined,
    GithubOutlined,
    NotificationOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    UserOutlined,
    YoutubeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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
    // New props for Gói 1
    meetingLogs = [],
    openMeetingModal,
    handleDeleteMeetingLog,
    handleBypassTask,
    openBM04Modal,
    bypassingTaskId,
    // New props for Gói 2: Archive & Certificate
    archiveData = null,
    openArchiveReviewModal,
    handleOpenCertificate,
    archiveLoading = false,
}) {
    if (!selectedRegistration) return null;

    return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 space-y-4">
                {/* Student & Topic Summary Card */}
                <Card bordered={false} style={{ borderRadius: 14 }}>
                    <Flex justify="space-between" align="start" wrap="wrap" gap={12}>
                        <Flex gap={12}>
                            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#e6f4ff', color: '#0958d9' }} />
                            <Flex vertical>
                                <Title level={4} style={{ margin: 0 }}>{selectedRegistration.student?.fullName || 'Sinh viên'}</Title>
                                <Text type="secondary">{selectedRegistration.student?.code || 'N/A'}</Text>
                                <Text strong className="text-slate-800">{selectedRegistration.topic?.title || 'Chưa đăng ký đề tài'}</Text>
                            </Flex>
                        </Flex>
                        <Flex vertical align="end" gap={8}>
                            <StatusBadge status={selectedRegistration.status} />
                            <Flex gap={8} wrap="wrap">
                                {openMeetingModal && (
                                    <Button
                                        icon={<TeamOutlined />}
                                        onClick={() => openMeetingModal(selectedRegistration)}
                                    >
                                        Ghi nhận buổi gặp
                                    </Button>
                                )}
                                {openBM04Modal && (
                                    <Button
                                        type="primary"
                                        icon={<SafetyCertificateOutlined />}
                                        onClick={() => openBM04Modal(selectedRegistration)}
                                        style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                    >
                                        Lập Phiếu BM04
                                    </Button>
                                )}
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => openTaskModal(selectedRegistration)}
                                >
                                    Giao nhiệm vụ
                                </Button>
                            </Flex>
                        </Flex>
                    </Flex>
                    <div className="mt-3">
                        <Progress
                            percent={taskOverview.progress}
                            strokeColor={taskOverview.progress < 40 ? '#ff4d4f' : taskOverview.progress < 70 ? '#faad14' : '#52c41a'}
                        />
                        <Flex gap={8} wrap="wrap" align="center" className="mt-2">
                            <Tag>Tổng task: {taskOverview.total}</Tag>
                            <Tag color="blue">Đã nộp: {taskOverview.submitted}</Tag>
                            <Tag color="success">Hoàn thành: {taskOverview.completed}</Tag>
                            <Tag color={taskOverview.overdue > 0 ? 'error' : 'default'}>Quá hạn: {taskOverview.overdue}</Tag>
                            <Tag color="purple">Buổi làm việc: {meetingLogs.length}</Tag>
                        </Flex>
                    </div>
                </Card>

                {/* Main Content Tabs: Nhiệm vụ vs Sổ Nhật Ký */}
                <Card bordered={false} style={{ borderRadius: 14 }}>
                    <Tabs
                        defaultActiveKey="tasks"
                        items={[
                            {
                                key: 'tasks',
                                label: <span className="font-bold">Nhiệm vụ & Biểu mẫu ({taskOverview.total})</span>,
                                children: (
                                    <div className="space-y-3">
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

                                        {taskOverview.overdue > 0 && (
                                            <Alert
                                                type="warning"
                                                showIcon
                                                message={`Có ${taskOverview.overdue} nhiệm vụ quá hạn cần theo dõi`}
                                                style={{ marginBottom: 12 }}
                                            />
                                        )}

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
                                                                const isBypassed = task.isBypassed;
                                                                const canBypass = ['BM01', 'BM02'].includes(task.taskType) && !isBypassed && task.status !== 'COMPLETED';

                                                                return (
                                                                    <List.Item>
                                                                        <Card
                                                                            size="small"
                                                                            style={{
                                                                                width: '100%',
                                                                                border: isBypassed ? '1px solid #d3adf7' : overdue ? '1px solid #ffa39e' : '1px solid #f0f0f0',
                                                                                background: isBypassed ? '#f9f0ff' : overdue ? '#fff2f0' : '#fff',
                                                                            }}
                                                                        >
                                                                            <Flex justify="space-between" align="start" gap={8}>
                                                                                <Flex vertical gap={6} style={{ flex: 1 }}>
                                                                                    <Flex align="center" gap={8} wrap="wrap">
                                                                                        <Text strong>{task.title}</Text>
                                                                                        {isBypassed ? (
                                                                                            <Tag color="purple" icon={<CheckCircleOutlined />}>Miễn thẩm định</Tag>
                                                                                        ) : (
                                                                                            <Tag color={statusColorMap[task.status] || 'default'}>
                                                                                                {taskStatusOptions.find((opt) => opt.value === task.status)?.label || task.status}
                                                                                            </Tag>
                                                                                        )}
                                                                                        {task.taskType && (
                                                                                            <Tag color="blue">{task.taskType}</Tag>
                                                                                        )}
                                                                                        {overdue && !isBypassed ? <Tag color="error">Quá hạn</Tag> : null}
                                                                                    </Flex>
                                                                                    {task.content && <Text type="secondary" style={{ fontSize: 13 }}>{task.content}</Text>}
                                                                                    {isBypassed && (
                                                                                        <Text type="secondary" style={{ fontSize: 12, color: '#722ed1' }}>
                                                                                            Lý do miễn: {task.bypassReason || 'Miễn thẩm định theo quy định'}
                                                                                        </Text>
                                                                                    )}
                                                                                    <Text type="secondary" style={{ fontSize: 12 }}><ClockCircleOutlined /> Hạn nộp: {dueText}</Text>
                                                                                    {latestSubmission ? (
                                                                                        <Flex vertical gap={4}>
                                                                                            <Flex gap={8} wrap="wrap" align="center">
                                                                                                <Tag color="cyan">Đã nộp lúc: {new Date(latestSubmission.submittedAt).toLocaleDateString('vi-VN')}</Tag>
                                                                                                {latestSubmission.fileName && (
                                                                                                    <Tag color="blue">{latestSubmission.fileName}</Tag>
                                                                                                )}
                                                                                                {latestSubmission.fileUrl && (
                                                                                                    <Button type="link" icon={<DownloadOutlined />} href={latestSubmission.fileUrl} target="_blank" rel="noopener noreferrer" style={{ paddingInline: 0 }}>
                                                                                                        Tải bài nộp
                                                                                                    </Button>
                                                                                                )}
                                                                                            </Flex>
                                                                                        </Flex>
                                                                                    ) : !isBypassed ? (
                                                                                        <Tooltip title="Sinh viên chưa nộp bài">
                                                                                            <Text type="secondary" style={{ fontSize: 12 }}><FileTextOutlined /> Chưa nộp</Text>
                                                                                        </Tooltip>
                                                                                    ) : null}
                                                                                </Flex>

                                                                                <Flex vertical gap={8} style={{ minWidth: 160 }} align="end">
                                                                                    <Button
                                                                                        type="primary"
                                                                                        icon={<CheckCircleOutlined />}
                                                                                        loading={updatingTaskId === task.id}
                                                                                        onClick={() => openTaskReviewModal(task)}
                                                                                        style={{ backgroundColor: '#0052a3' }}
                                                                                    >
                                                                                        Xem & Đánh giá
                                                                                    </Button>
                                                                                    {canBypass && (
                                                                                        <Button
                                                                                            icon={<FastForwardOutlined />}
                                                                                            size="small"
                                                                                            onClick={() => handleBypassTask && handleBypassTask(task)}
                                                                                            loading={bypassingTaskId === task.id}
                                                                                            className="text-purple-700 border-purple-300 hover:border-purple-500"
                                                                                        >
                                                                                            Miễn thẩm định
                                                                                        </Button>
                                                                                    )}
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
                                    </div>
                                ),
                            },
                            {
                                key: 'meetingLogs',
                                label: <span className="font-bold">Sổ Nhật Ký Buổi Gặp ({meetingLogs.length})</span>,
                                children: (
                                    <div className="space-y-4">
                                        <Flex justify="space-between" align="center">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">Lịch sử làm việc & gặp gỡ sinh viên</h4>
                                                <p className="text-xs text-slate-500">Ghi nhận trực tiếp tại Lab, Văn phòng hoặc Online phục vụ minh chứng BM04</p>
                                            </div>
                                            {openMeetingModal && (
                                                <Button
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                    onClick={() => openMeetingModal(selectedRegistration)}
                                                >
                                                    Thêm buổi gặp mới
                                                </Button>
                                            )}
                                        </Flex>

                                        {meetingLogs.length === 0 ? (
                                            <Empty description="Chưa có buổi làm việc nào được ghi nhận cho sinh viên này" />
                                        ) : (
                                            <div className="space-y-3">
                                                {meetingLogs.map((log, idx) => (
                                                    <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                                        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                            <Flex align="center" gap={8}>
                                                                <CalendarOutlined className="text-blue-600" />
                                                                <Text strong>
                                                                    Buổi {meetingLogs.length - idx}: {dayjs(log.meetingDate).format('DD/MM/YYYY')}
                                                                </Text>
                                                                <Tag color={log.meetingType === 'LAB' ? 'green' : log.meetingType === 'ONLINE' ? 'blue' : 'orange'}>
                                                                    {log.meetingType === 'LAB' ? 'Tại Lab' : log.meetingType === 'ONLINE' ? 'Online Meet' : 'Văn phòng'}
                                                                </Tag>
                                                            </Flex>
                                                            {handleDeleteMeetingLog && (
                                                                <Popconfirm
                                                                    title="Xóa buổi gặp này?"
                                                                    description="Hành động này sẽ xóa nhật ký buổi làm việc."
                                                                    onConfirm={() => handleDeleteMeetingLog(log.id)}
                                                                    okText="Xóa"
                                                                    cancelText="Hủy"
                                                                >
                                                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                                                </Popconfirm>
                                                            )}
                                                        </Flex>

                                                        <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs space-y-1 text-slate-700">
                                                            <div><strong>Sinh viên đã báo cáo:</strong> {log.studentWorkSummary}</div>
                                                            {log.nextPlan && (
                                                                <div><strong>Kế hoạch tiếp theo:</strong> {log.nextPlan}</div>
                                                            )}
                                                            {log.supervisorNotes && (
                                                                <div className="text-blue-700 pt-1 border-t border-slate-100">
                                                                    <strong>Góp ý & Dặn dò của GV:</strong> {log.supervisorNotes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'archive',
                                label: (
                                    <span className="font-bold">
                                        Hồ Sơ Lưu Chiểu {archiveData ? (
                                            archiveData.status === 'APPROVED' ? <Tag color="green" className="ml-1 text-[11px]">Đã duyệt</Tag> :
                                            archiveData.status === 'REVISION_REQUIRED' ? <Tag color="red" className="ml-1 text-[11px]">Cần sửa</Tag> :
                                            <Tag color="orange" className="ml-1 text-[11px]">Chờ duyệt</Tag>
                                        ) : ''}
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-4">
                                        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">Hồ sơ lưu chiểu toàn khóa sau bảo vệ</h4>
                                                <p className="text-xs text-slate-500">Kiểm tra bản thuyết minh, slide, video demo và link mã nguồn để hoàn tất thủ tục tốt nghiệp</p>
                                            </div>
                                            {archiveData && openArchiveReviewModal && archiveData.status === 'SUBMITTED' && (
                                                <Button
                                                    type="primary"
                                                    icon={<CheckOutlined />}
                                                    onClick={() => openArchiveReviewModal(archiveData)}
                                                    style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                                >
                                                    Nghiệm thu lưu chiểu
                                                </Button>
                                            )}
                                            {archiveData && archiveData.status === 'APPROVED' && handleOpenCertificate && (
                                                <Button
                                                    type="primary"
                                                    icon={<SafetyCertificateOutlined />}
                                                    onClick={handleOpenCertificate}
                                                    className="bg-emerald-600 hover:bg-emerald-500 font-bold"
                                                >
                                                    Xem Giấy Xác Nhận Tốt Nghiệp
                                                </Button>
                                            )}
                                        </Flex>

                                        {!archiveData ? (
                                            <Alert
                                                type="info"
                                                showIcon
                                                message="Sinh viên chưa nộp hồ sơ lưu chiểu"
                                                description="Sinh viên sau khi bảo vệ trước Hội đồng cần chỉnh sửa hoàn thiện báo cáo và nộp lưu chiểu trên hệ thống để được cấp Giấy xác nhận tốt nghiệp."
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                                    <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                        <div>
                                                            <span className="text-xs text-slate-500">Trạng thái hồ sơ:</span>
                                                            <div className="mt-0.5">
                                                                <Tag
                                                                    color={
                                                                        archiveData.status === 'APPROVED' ? 'green' :
                                                                        archiveData.status === 'REVISION_REQUIRED' ? 'red' : 'orange'
                                                                    }
                                                                    className="font-bold text-xs px-2.5 py-0.5"
                                                                >
                                                                    {archiveData.status === 'APPROVED' ? '✓ ĐÃ NGHIỆM THU CHÍNH THỨC' :
                                                                     archiveData.status === 'REVISION_REQUIRED' ? '⚠ YÊU CẦU CHỈNH SỬA' :
                                                                     '⏳ ĐANG CHỜ GVHD NGHIỆM THU'}
                                                                </Tag>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-slate-500">Thời gian nộp:</span>
                                                            <div className="font-semibold text-xs text-slate-800">
                                                                {dayjs(archiveData.submittedAt).format('DD/MM/YYYY HH:mm')}
                                                            </div>
                                                        </div>
                                                    </Flex>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-500 font-medium">Báo cáo Thuyết minh:</span>
                                                            {archiveData.reportFileUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <FilePdfOutlined className="text-rose-500 text-base" />
                                                                    <a href={archiveData.reportFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        {archiveData.reportFileName || 'Xem tệp Báo cáo PDF'}
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-400 italic">Chưa tải lên</div>}
                                                        </div>

                                                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-500 font-medium">Slide Thuyết trình:</span>
                                                            {archiveData.slideFileUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <FilePptOutlined className="text-amber-500 text-base" />
                                                                    <a href={archiveData.slideFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        {archiveData.slideFileName || 'Xem Slide PPTX'}
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-400 italic">Chưa tải lên</div>}
                                                        </div>

                                                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-500 font-medium">Video Demo Sản phẩm:</span>
                                                            {archiveData.demoVideoUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <YoutubeOutlined className="text-red-500 text-base" />
                                                                    <a href={archiveData.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        Xem Video Demo (Drive/YouTube)
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-400 italic">Chưa cung cấp</div>}
                                                        </div>

                                                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-500 font-medium">Kho Mã Nguồn (Repository):</span>
                                                            {archiveData.sourceCodeUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <GithubOutlined className="text-slate-800 text-base" />
                                                                    <a href={archiveData.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        Mở Kho Mã Nguồn
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-400 italic">Chưa cung cấp</div>}
                                                        </div>
                                                    </div>

                                                    {archiveData.summary && (
                                                        <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs">
                                                            <span className="font-bold text-slate-700">Tóm tắt kết quả: </span>
                                                            <span className="text-slate-600">{archiveData.summary}</span>
                                                        </div>
                                                    )}

                                                    {archiveData.reviewerNotes && (
                                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
                                                            <span className="font-bold text-amber-800">Nhận xét nghiệm thu: </span>
                                                            <span className="text-amber-700">{archiveData.reviewerNotes}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
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
