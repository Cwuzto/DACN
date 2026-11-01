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
    // Props for Meeting Logs
    meetingLogs = [],
    openMeetingModal,
    handleDeleteMeetingLog,
    openBM04Modal,
    // Props for Archive & Certificate
    archiveData = null,
    openArchiveReviewModal,
    handleOpenCertificate,
    archiveLoading = false,
}) {
    if (!selectedRegistration) return null;

    const initials = selectedRegistration.student?.fullName
        ? selectedRegistration.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase()
        : 'S';

    const topicCode = selectedRegistration.topic?.code || `DT-${String(selectedRegistration.topic?.id || '').padStart(3, '0')}`;

    return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-4">
                {/* Student & Topic Summary Card matching OpenDesign Header */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-l-[#0F766E]">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-full bg-teal-100 text-[#0F766E] font-bold text-base flex items-center justify-center shrink-0 border border-teal-200">
                                {initials}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-900 m-0">
                                        {selectedRegistration.student?.fullName || 'Sinh viên'}
                                    </h3>
                                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                        MSSV: {selectedRegistration.student?.code || 'N/A'}
                                    </span>
                                    <StatusBadge status={selectedRegistration.status} />
                                </div>
                                <div className="text-sm font-semibold text-slate-800 mt-1">
                                    <span className="font-mono text-[#0F766E] mr-1">{topicCode}:</span>
                                    {selectedRegistration.topic?.title || 'Chưa đăng ký đề tài'}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                                    {selectedRegistration.semester?.name || 'Học kỳ hiện tại'}
                                </div>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap self-start">
                            {openMeetingModal && (
                                <Button
                                    size="small"
                                    icon={<TeamOutlined />}
                                    onClick={() => openMeetingModal(selectedRegistration)}
                                    className="font-medium text-xs border-slate-200 text-slate-700 hover:text-[#0F766E]"
                                >
                                    + Ghi nhận buổi gặp
                                </Button>
                            )}
                            {openBM04Modal && (
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={() => openBM04Modal(selectedRegistration)}
                                    className="!bg-[#0F766E] hover:!bg-[#115E59] font-medium text-xs"
                                >
                                    Đánh giá BM04
                                </Button>
                            )}
                            <Button
                                size="small"
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => openTaskModal(selectedRegistration)}
                                className="!bg-[#0F766E] hover:!bg-[#115E59] font-medium text-xs"
                            >
                                Giao việc
                            </Button>
                        </div>
                    </div>

                    {/* Progress Bar & Metric Pills */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-600">Tiến độ nhiệm vụ tổng thể:</span>
                            <span className="font-bold text-[#0F766E] font-mono">{taskOverview.progress}%</span>
                        </div>
                        <Progress
                            percent={taskOverview.progress}
                            strokeColor="#0F766E"
                            size="small"
                            showInfo={false}
                        />
                        <div className="flex gap-2 flex-wrap items-center mt-2.5 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Tổng task: {taskOverview.total}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Đã nộp: {taskOverview.submitted}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Hoàn thành: {taskOverview.completed}</span>
                            {taskOverview.overdue > 0 && (
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold">Quá hạn: {taskOverview.overdue}</span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-teal-50 text-[#0F766E] font-bold">
                                {meetingLogs.length} buổi gặp Lab
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Content Tabs: Nhiệm vụ vs Sổ Nhật Ký vs Hồ sơ lưu chiểu */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <Tabs
                        defaultActiveKey="tasks"
                        items={[
                            {
                                key: 'tasks',
                                label: <span className="font-bold text-xs">Nhiệm vụ & Báo cáo tuần ({taskOverview.total})</span>,
                                children: (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                            <div className="flex gap-2 flex-wrap">
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
                                            </div>
                                            <Button
                                                size="small"
                                                icon={<NotificationOutlined />}
                                                loading={remindLoading}
                                                onClick={handleBulkRemind}
                                                disabled={remindableTaskIds.length === 0}
                                                className="text-xs"
                                            >
                                                Nhắc nộp ({remindableTaskIds.length})
                                            </Button>
                                        </div>

                                        {taskOverview.overdue > 0 && (
                                            <Alert
                                                type="warning"
                                                showIcon
                                                message={`Có ${taskOverview.overdue} nhiệm vụ quá hạn cần theo dõi`}
                                                className="text-xs"
                                            />
                                        )}

                                        <Spin spinning={taskLoading}>
                                            {!visibleTasks.length ? (
                                                <Empty description="Không có nhiệm vụ phù hợp bộ lọc hiện tại" className="py-6" />
                                            ) : (
                                                Object.entries(tasksByWeek).map(([week, tasks]) => (
                                                    <div key={week} className="bg-slate-50/70 border border-slate-200 rounded-lg p-3.5 mb-3 space-y-2.5">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                            <CalendarOutlined className="text-[#0F766E]" />
                                                            <span>{week}</span>
                                                        </div>
                                                        <List
                                                            dataSource={tasks}
                                                            renderItem={(task) => {
                                                                const submissions = task.submissions || [];
                                                                const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;
                                                                const overdue = isOverdueTask(task);
                                                                const dueText = task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY HH:mm') : 'Không có hạn';

                                                                return (
                                                                    <div
                                                                        key={task.id}
                                                                        className={`p-3.5 rounded-lg border mb-2 text-xs space-y-2 ${
                                                                            overdue
                                                                                ? 'bg-rose-50/50 border-rose-200'
                                                                                : 'bg-white border-slate-200'
                                                                        }`}
                                                                    >
                                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                            <div className="space-y-1 flex-1">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <strong className="text-slate-900 text-xs">{task.title}</strong>
                                                                                    <Tag color={statusColorMap[task.status] || 'default'} className="text-[10px] m-0">
                                                                                        {taskStatusOptions.find((opt) => opt.value === task.status)?.label || task.status}
                                                                                    </Tag>
                                                                                    {task.taskType && (
                                                                                        <Tag color="cyan" className="text-[10px] m-0">{task.taskType}</Tag>
                                                                                    )}
                                                                                    {overdue && <Tag color="error" className="text-[10px] m-0">Quá hạn</Tag>}
                                                                                </div>
                                                                                {task.content && (
                                                                                    <p className="text-slate-500 text-xs">{task.content}</p>
                                                                                )}
                                                                                <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono font-medium">
                                                                                    <ClockCircleOutlined /> Hạn: {dueText}
                                                                                </div>
                                                                                {latestSubmission ? (
                                                                                    <div className="flex gap-2 flex-wrap items-center pt-1">
                                                                                        <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                                                                            Đã nộp: {dayjs(latestSubmission.submittedAt).format('DD/MM HH:mm')}
                                                                                        </span>
                                                                                        {latestSubmission.fileName && (
                                                                                            <span className="text-[11px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                                                                                {latestSubmission.fileName}
                                                                                            </span>
                                                                                        )}
                                                                                        {latestSubmission.fileUrl && (
                                                                                            <Button
                                                                                                type="link"
                                                                                                size="small"
                                                                                                icon={<DownloadOutlined />}
                                                                                                href={latestSubmission.fileUrl}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-xs p-0 text-[#0F766E]"
                                                                                            >
                                                                                                Tải file
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[11px] text-slate-500 italic font-medium">Chưa có bài nộp</span>
                                                                                )}
                                                                            </div>

                                                                            <Button
                                                                                size="small"
                                                                                type="primary"
                                                                                icon={<CheckCircleOutlined />}
                                                                                loading={updatingTaskId === task.id}
                                                                                onClick={() => openTaskReviewModal(task)}
                                                                                className="!bg-[#0F766E] hover:!bg-[#115E59] font-medium text-xs self-start"
                                                                            >
                                                                                Đánh giá
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                ))
                                            )}
                                        </Spin>
                                    </div>
                                ),
                            },
                            {
                                key: 'meetingLogs',
                                label: <span className="font-bold text-xs">Sổ Nhật Ký Buổi Gặp Lab ({meetingLogs.length})</span>,
                                children: (
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-xs">Lịch sử làm việc & gặp gỡ sinh viên</h4>
                                                <p className="text-[11px] text-slate-500">Minh chứng cho điều kiện thẩm định BM04 trước khi xét duyệt bảo vệ</p>
                                            </div>
                                            {openMeetingModal && (
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                    onClick={() => openMeetingModal(selectedRegistration)}
                                                    className="!bg-[#0F766E] hover:!bg-[#115E59] font-medium text-xs"
                                                >
                                                    Thêm buổi gặp
                                                </Button>
                                            )}
                                        </div>

                                        {meetingLogs.length === 0 ? (
                                            <Empty description="Chưa có buổi làm việc nào được ghi nhận" className="py-6" />
                                        ) : (
                                            <div className="space-y-3">
                                                {meetingLogs.map((log, idx) => (
                                                    <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarOutlined className="text-[#0F766E]" />
                                                                <strong className="text-slate-800">
                                                                    Buổi {meetingLogs.length - idx}: {dayjs(log.meetingDate).format('DD/MM/YYYY')}
                                                                </strong>
                                                                <Tag color={log.meetingType === 'LAB' ? 'green' : log.meetingType === 'ONLINE' ? 'blue' : 'orange'} className="text-[10px] m-0">
                                                                    {log.meetingType === 'LAB' ? 'Tại Lab' : log.meetingType === 'ONLINE' ? 'Online Meet' : 'Văn phòng'}
                                                                </Tag>
                                                            </div>
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
                                                        </div>

                                                        <div className="bg-white p-3 rounded border border-slate-100 text-xs space-y-1.5 text-slate-700">
                                                            <div><strong>Sinh viên đã báo cáo:</strong> {log.studentWorkSummary}</div>
                                                            {log.nextPlan && (
                                                                <div><strong>Kế hoạch tiếp theo:</strong> {log.nextPlan}</div>
                                                            )}
                                                            {log.supervisorNotes && (
                                                                <div className="text-teal-800 pt-1 border-t border-slate-100">
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
                                    <span className="font-bold text-xs">
                                        Hồ Sơ Lưu Chiểu {archiveData ? (
                                            archiveData.status === 'APPROVED' ? <Tag color="green" className="ml-1 text-[10px]">Đã duyệt</Tag> :
                                            archiveData.status === 'REVISION_REQUIRED' ? <Tag color="red" className="ml-1 text-[10px]">Cần sửa</Tag> :
                                            <Tag color="orange" className="ml-1 text-[10px]">Chờ duyệt</Tag>
                                        ) : ''}
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-xs">Hồ sơ lưu chiểu toàn khóa sau bảo vệ</h4>
                                                <p className="text-[11px] text-slate-500">Kiểm tra bản thuyết minh, slide, video demo và link mã nguồn</p>
                                            </div>
                                            {archiveData && openArchiveReviewModal && archiveData.status === 'SUBMITTED' && (
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<CheckOutlined />}
                                                    onClick={() => openArchiveReviewModal(archiveData)}
                                                    className="!bg-[#0F766E] hover:!bg-[#115E59] font-medium text-xs"
                                                >
                                                    Nghiệm thu lưu chiểu
                                                </Button>
                                            )}
                                            {archiveData && archiveData.status === 'APPROVED' && handleOpenCertificate && (
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<SafetyCertificateOutlined />}
                                                    onClick={handleOpenCertificate}
                                                    className="!bg-[#0F766E] hover:!bg-[#115E59] font-bold text-xs"
                                                >
                                                    Xem Giấy Xác Nhận
                                                </Button>
                                            )}
                                        </div>

                                        {!archiveData ? (
                                            <Alert
                                                type="info"
                                                showIcon
                                                message="Sinh viên chưa nộp hồ sơ lưu chiểu"
                                                description="Sinh viên sau khi bảo vệ trước Hội đồng cần nộp lưu chiểu trên hệ thống để được cấp Giấy xác nhận tốt nghiệp."
                                                className="text-xs"
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                                                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">Trạng thái: </span>
                                                            <Tag
                                                                color={
                                                                    archiveData.status === 'APPROVED' ? 'green' :
                                                                    archiveData.status === 'REVISION_REQUIRED' ? 'red' : 'orange'
                                                                }
                                                                className="font-bold text-[11px] ml-1"
                                                            >
                                                                {archiveData.status === 'APPROVED' ? '✓ ĐÃ NGHIỆM THU' :
                                                                 archiveData.status === 'REVISION_REQUIRED' ? '⚠ YÊU CẦU SỬA' :
                                                                 '⏳ CHỜ NGHIỆM THU'}
                                                            </Tag>
                                                        </div>
                                                        <div className="font-mono text-slate-500 text-[11px]">
                                                            {dayjs(archiveData.submittedAt).format('DD/MM/YYYY HH:mm')}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                        <div className="p-3 bg-white rounded border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-500 font-medium">Báo cáo Thuyết minh:</span>
                                                            {archiveData.reportFileUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <FilePdfOutlined className="text-rose-500" />
                                                                    <a href={archiveData.reportFileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        {archiveData.reportFileName || 'Xem tệp PDF'}
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-500 italic font-medium">Chưa tải lên</div>}
                                                        </div>

                                                        <div className="p-3 bg-white rounded border border-slate-200 text-xs space-y-1">
                                                            <span className="text-slate-600 font-medium">Kho Mã Nguồn:</span>
                                                            {archiveData.sourceCodeUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <GithubOutlined className="text-slate-800" />
                                                                    <a href={archiveData.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline truncate">
                                                                        Mở Repository
                                                                    </a>
                                                                </div>
                                                            ) : <div className="text-slate-500 italic font-medium">Chưa cung cấp</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

            {/* Right Column: Timeline / History */}
            <div className="lg:col-span-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                    <h4 className="font-bold font-display text-slate-900 text-xs tracking-wider uppercase">
                        Nhật Ký Tương Tác
                    </h4>
                    {timelineItems.length ? (
                        <Timeline items={timelineItems} className="text-xs" />
                    ) : (
                        <Empty description="Chưa có tương tác nào" className="py-6" />
                    )}
                </div>
            </div>
        </div>
    );
}

export default StudentProgressDetailPanel;
