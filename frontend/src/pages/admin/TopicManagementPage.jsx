import { useState, useEffect, useCallback } from 'react';
import {
    Table, Button, Input, Select, Tabs, Badge, Tooltip, Modal, Form, Space,
    Popconfirm, message, Tag,
} from 'antd';
import {
    SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    CheckCircleOutlined, CloseCircleOutlined, SendOutlined, PlusOutlined,
    UserOutlined, BookOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

const { TextArea } = Input;

function TopicManagementPage() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [semesters, setSemesters] = useState([]);
    const [activeSemesterId, setActiveSemesterId] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [mentors, setMentors] = useState([]);

    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingTopicId, setRejectingTopicId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [form] = Form.useForm();

    const fetchTopics = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchText) params.search = searchText;
            const res = await topicService.getAll(params);
            setTopics((res.data || []).map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
        } catch {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText]);

    const fetchSemesters = useCallback(async () => {
        try {
            const res = await semesterService.getAll();
            if (res.success) {
                const semesterOptions = (res.data || []).map((s) => ({ value: s.id, label: formatSemesterLabel(s) }));
                setSemesters(semesterOptions);

                const activeSemester = (res.data || []).find((s) =>
                    ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(s.status)
                );
                setActiveSemesterId(activeSemester?.id || (res.data?.[0]?.id ?? null));
            }
        } catch {
            // ignore
        }
    }, []);

    const fetchMentors = useCallback(async () => {
        try {
            const res = await userService.getUsers({ role: 'LECTURER', status: 'active', page: 1, limit: 200 });
            if (res.success) {
                setMentors((res.data || []).map((u) => ({
                    value: u.id,
                    label: `${u.fullName} (${u.code})`,
                })));
            }
        } catch {
            message.error('Không thể tải danh sách giảng viên hướng dẫn.');
        }
    }, []);

    useEffect(() => {
        fetchTopics();
        fetchSemesters();
        fetchMentors();
    }, [fetchTopics, fetchSemesters, fetchMentors]);

    const handleTabChange = (key) => {
        setActiveTab(key);
        if (key === 'all') setStatusFilter('all');
        else if (key === 'pending') setStatusFilter('PENDING');
        else if (key === 'draft') setStatusFilter('DRAFT');
    };

    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                description: topic.description,
                semesterId: topic.semesterId,
                mentorId: topic.mentorId || topic.mentor?.id,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ semesterId: activeSemesterId || undefined });
        }
        setFormModalOpen(true);
    };

    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'DRAFT' });
                message.success('Đã cập nhật bản nháp.');
            } else {
                await topicService.create({ ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp đề tài.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateApproved = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'PENDING' });
                message.success('Đã gửi đề tài đi phê duyệt.');
            } else {
                await topicService.create({ ...values, status: 'APPROVED' });
                message.success('Tạo đề tài thành công.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            await topicService.changeStatus(id, { status: 'APPROVED' });
            message.success('Đã duyệt đề tài thành công.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể duyệt đề tài.');
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            message.warning('Vui lòng nhập lý do từ chối.');
            return;
        }
        try {
            setSubmitting(true);
            await topicService.changeStatus(rejectingTopicId, { status: 'REJECTED', rejectReason });
            message.success('Đã từ chối đề tài.');
            setRejectModalOpen(false);
            setRejectReason('');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể từ chối đề tài.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await topicService.delete(id);
            message.success('Xóa đề tài thành công.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể xóa đề tài.');
        }
    };

    const handleViewDetail = async (id) => {
        try {
            const res = await topicService.getById(id);
            setDetailTopic(res.data);
            setDetailModalOpen(true);
        } catch {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const pendingCount = topics.filter((t) => t.status === 'PENDING').length;
    const projectOptions = [{ value: PROJECT_NAME, label: PROJECT_NAME }];
    const filteredTopics = topics.filter((topic) => (
        semesterFilter === 'all' ? true : topic.semesterId === semesterFilter
    ));

    const tabItems = [
        { key: 'all', label: `Tất cả đề tài (${topics.length})` },
        {
            key: 'pending',
            label: (
                <div className="flex items-center gap-1.5">
                    <span>Chờ phê duyệt</span>
                    {pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {pendingCount}
                        </span>
                    )}
                </div>
            ),
        },
        { key: 'draft', label: 'Bản nháp' },
    ];

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div className="space-y-0.5">
                    <a
                        className="text-[#1E3A5F] font-bold hover:underline cursor-pointer text-sm leading-snug block"
                        onClick={() => handleViewDetail(record.id)}
                    >
                        {text}
                    </a>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Mã: <strong>DT-{String(record.id).padStart(3, '0')}</strong></span>
                        <span>•</span>
                        <span>Quy mô: 1 sinh viên</span>
                    </div>
                </div>
            ),
        },
        {
            title: 'GVHD',
            dataIndex: 'mentor',
            key: 'mentor',
            width: 200,
            render: (mentor) => mentor ? (
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {mentor.fullName?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">{mentor.fullName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{mentor.code || ''}</span>
                    </div>
                </div>
            ) : <span className="text-slate-400 text-xs italic">Chưa phân GVHD</span>,
        },
        {
            title: 'Đợt đồ án',
            key: 'semester',
            width: 200,
            render: (_, record) => (
                <span className="text-xs font-medium text-slate-700">
                    {record.semester ? formatSemesterLabel(record.semester) : '—'}
                </span>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 190,
            align: 'center',
            render: (_, record) => (
                <div className="flex items-center justify-end gap-1.5">
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record.id)}
                    >
                        Xem
                    </Button>
                    {record.status === 'DRAFT' && (
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openFormModal(record)}
                        >
                            Sửa
                        </Button>
                    )}
                    {record.status === 'PENDING' && (
                        <>
                            <Popconfirm
                                title="Phê duyệt đề tài này?"
                                onConfirm={() => handleApprove(record.id)}
                                okText="Duyệt"
                                cancelText="Hủy"
                            >
                                <Button size="small" type="primary" icon={<CheckCircleOutlined />} className="bg-emerald-600 hover:bg-emerald-700 border-0">
                                    Duyệt
                                </Button>
                            </Popconfirm>
                            <Button
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => { setRejectingTopicId(record.id); setRejectModalOpen(true); }}
                            >
                                Từ chối
                            </Button>
                        </>
                    )}
                    {record.status === 'DRAFT' && (
                        <Popconfirm
                            title="Xóa bản nháp này?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title="Quản lý Đề tài"
                subtitle="Phê duyệt, chỉnh sửa và quản lý danh mục đề tài đồ án tốt nghiệp"
                actions={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openFormModal()}
                    >
                        Thêm đề tài mới
                    </Button>
                }
            />

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={tabItems}
                    style={{ padding: '0 20px' }}
                    tabBarStyle={{ marginBottom: 0 }}
                />

                {/* Filter Toolbar */}
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 180 }}
                            options={projectOptions}
                        />
                        <Select
                            value={statusFilter === 'all' && activeTab === 'all' ? 'all' : statusFilter}
                            onChange={(v) => { setStatusFilter(v); setActiveTab('all'); }}
                            style={{ width: 170 }}
                            options={[
                                { value: 'all', label: 'Tất cả trạng thái' },
                                { value: 'DRAFT', label: 'Bản nháp' },
                                { value: 'PENDING', label: 'Chờ duyệt' },
                                { value: 'APPROVED', label: 'Đã duyệt' },
                                { value: 'REJECTED', label: 'Từ chối' },
                            ]}
                        />
                        <Select
                            value={semesterFilter}
                            onChange={setSemesterFilter}
                            style={{ width: 230 }}
                            options={[
                                { value: 'all', label: 'Tất cả đợt đồ án' },
                                ...semesters,
                            ]}
                        />
                    </div>
                    <Input
                        placeholder="Tìm kiếm đề tài..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: '100%', maxWidth: 320 }}
                        allowClear
                    />
                </div>

                <Table
                    dataSource={filteredTopics}
                    columns={columns}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} đề tài`,
                        showSizeChanger: true,
                    }}
                    size="middle"
                    locale={{
                        emptyText: (
                            <div className="py-12 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 block">description</span>
                                Không có đề tài nào phù hợp với bộ lọc hiện tại.
                            </div>
                        ),
                    }}
                />
            </div>

            {/* Form Modal */}
            <Modal
                title={editingTopic ? 'Chỉnh sửa bản nháp đề tài' : 'Thêm đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={
                    <div className="flex justify-between items-center">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu bản nháp</Button>
                            <Button type="primary" onClick={handleCreateApproved} loading={submitting} icon={editingTopic ? <SendOutlined /> : undefined}>
                                {editingTopic ? 'Gửi duyệt' : 'Khởi tạo đề tài'}
                            </Button>
                        </Space>
                    </div>
                }
                width={650}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label="Tên đề tài" rules={[{ required: true, message: 'Vui lòng nhập tên đề tài' }]}>
                        <Input placeholder="Nhập tên đề tài đầy đủ..." />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả mục tiêu & phạm vi">
                        <TextArea rows={4} placeholder="Mô tả chi tiết nội dung, mục tiêu nghiên cứu..." />
                    </Form.Item>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Form.Item label="Tên đồ án">
                            <Input value={PROJECT_NAME} disabled />
                        </Form.Item>
                        <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true, message: 'Chọn đợt' }]}>
                            <Select placeholder="Chọn đợt" options={semesters} />
                        </Form.Item>
                        <Form.Item name="mentorId" label="GVHD" rules={[{ required: true, message: 'Chọn giảng viên' }]}>
                            <Select placeholder="Chọn GVHD" options={mentors} showSearch optionFilterProp="label" />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Modal Từ Chối */}
            <Modal
                title="Từ chối đề tài"
                open={rejectModalOpen}
                onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
                onOk={handleReject}
                confirmLoading={submitting}
                okText="Xác nhận từ chối"
                okButtonProps={{ danger: true }}
            >
                <p className="text-xs text-slate-500 mb-2">Vui lòng nhập lý do từ chối để gửi thông báo cho người đề xuất:</p>
                <TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Nhập lý do cụ thể..." />
            </Modal>

            {/* Modal Chi Tiết */}
            <Modal
                title="Chi tiết đề tài"
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={700}
                destroyOnClose
            >
                {detailTopic && (
                    <div className="space-y-4 pt-2">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tên đề tài</span>
                            <h3 className="text-base font-black text-slate-900 mt-1">{detailTopic.title}</h3>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mô tả</span>
                            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1 leading-relaxed">
                                {detailTopic.description || 'Chưa có mô tả chi tiết.'}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-[11px] text-slate-400 block font-semibold">Trạng thái</span>
                                <div className="mt-1"><StatusBadge status={detailTopic.status} /></div>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-[11px] text-slate-400 block font-semibold">GVHD</span>
                                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                                    {detailTopic.mentor?.fullName || 'Chưa có'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-[11px] text-slate-400 block font-semibold">Đợt đồ án</span>
                                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                                    {detailTopic.semester?.name || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {detailTopic.rejectReason && (
                            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                                <span className="text-xs font-bold text-rose-700 block">Lý do từ chối:</span>
                                <span className="text-xs text-rose-800 mt-0.5 block">{detailTopic.rejectReason}</span>
                            </div>
                        )}

                        {detailTopic.registrations?.length > 0 && (
                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-700 block mb-2">
                                    Sinh viên đã đăng ký ({detailTopic.registrations.length}):
                                </span>
                                {detailTopic.registrations.map((registration) => (
                                    <div key={registration.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between text-xs border border-slate-100">
                                        <div>
                                            <span className="font-bold text-slate-900">{registration.student?.fullName || 'Sinh viên'}</span>
                                            <span className="text-slate-400 ml-1.5 font-mono">({registration.student?.code || 'N/A'})</span>
                                        </div>
                                        <Tag color="blue">{registration.status}</Tag>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default TopicManagementPage;
