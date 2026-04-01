import { useState, useEffect, useCallback } from 'react';
import {
    Table, Button, Input, Select, Tabs, Badge, Tooltip, Modal, Form, Space,
    Popconfirm, message,
} from 'antd';
import {
    SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    CheckCircleOutlined, CloseCircleOutlined, SendOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';

const { TextArea } = Input;

const statusConfig = {
    DRAFT: { label: 'Bản nháp', color: 'default', tw: 'bg-slate-100 text-slate-600' },
    PENDING: { label: 'Chờ duyệt', color: 'warning', tw: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: 'Đã duyệt', color: 'success', tw: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Từ chối', color: 'error', tw: 'bg-red-100 text-red-700' },
};

function TopicManagementPage() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [semesters, setSemesters] = useState([]);
    const [activeSemesterId, setActiveSemesterId] = useState(null);
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
                const semesterOptions = (res.data || []).map((s) => ({ value: s.id, label: s.name }));
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
                maxStudents: topic.maxStudents,
                semesterId: topic.semesterId,
                mentorId: topic.mentorId || topic.mentor?.id,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ maxStudents: 1, semesterId: activeSemesterId || undefined });
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
            message.success('Đã duyệt đề tài.');
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

    const tabItems = [
        { key: 'all', label: 'Tất cả đề tài' },
        { key: 'pending', label: <Badge count={pendingCount} size="small" offset={[10, 0]}>Chờ phê duyệt</Badge> },
        { key: 'draft', label: 'Bản nháp' },
    ];

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div>
                    <a className="text-primary font-bold hover:underline cursor-pointer" onClick={() => handleViewDetail(record.id)}>{text}</a>
                    <p className="text-xs text-slate-400 mt-0.5">Mã: DT-{String(record.id).padStart(3, '0')} | Tối đa: {record.maxStudents} sinh viên</p>
                </div>
            ),
        },
        {
            title: 'GVHD',
            dataIndex: 'mentor',
            key: 'mentor',
            render: (mentor) => mentor ? (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">{mentor.fullName?.[0]}</div>
                    <span className="text-sm font-medium">{mentor.fullName}</span>
                </div>
            ) : <span className="text-slate-400">-</span>,
        },
        {
            title: 'Người đề xuất',
            dataIndex: 'proposedBy',
            key: 'proposedBy',
            render: (u) => <span className="text-sm">{u?.fullName || '-'}</span>,
        },
        {
            title: 'Đã ĐK',
            key: 'registered',
            width: 80,
            align: 'center',
            render: (_, record) => <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{record._count?.registrations || 0}/{record.maxStudents}</span>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status) => {
                const cfg = statusConfig[status];
                return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg?.tw || 'bg-slate-100 text-slate-600'}`}>{cfg?.label || status}</span>;
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 180,
            align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Xem chi tiết"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)} /></Tooltip>
                    {record.status === 'DRAFT' && <Tooltip title="Chỉnh sửa"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFormModal(record)} /></Tooltip>}
                    {record.status === 'PENDING' && (
                        <>
                            <Tooltip title="Duyệt"><Popconfirm title="Duyệt đề tài này?" onConfirm={() => handleApprove(record.id)}><Button type="text" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} /></Popconfirm></Tooltip>
                            <Tooltip title="Từ chối"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setRejectingTopicId(record.id); setRejectModalOpen(true); }} /></Tooltip>
                        </>
                    )}
                    {record.status === 'DRAFT' && <Tooltip title="Xóa"><Popconfirm title="Xóa bản nháp này?" onConfirm={() => handleDelete(record.id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Tooltip>}
                </Space>
            ),
        },
    ];

    return (
        <div className="py-2">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Quản lý đề tài</h2>
                    <p className="text-sm text-slate-500 mt-1">Duyệt, tạo và quản lý đề tài đồ án</p>
                </div>
                <button onClick={() => openFormModal()} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Thêm đề tài mới
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} style={{ padding: '0 24px' }} tabBarStyle={{ marginBottom: 0 }} />

                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <Select
                        value={statusFilter === 'all' && activeTab === 'all' ? 'all' : statusFilter}
                        onChange={(v) => { setStatusFilter(v); setActiveTab('all'); }}
                        style={{ width: 180 }}
                        options={[
                            { value: 'all', label: 'Tất cả trạng thái' },
                            { value: 'DRAFT', label: 'Bản nháp' },
                            { value: 'PENDING', label: 'Chờ duyệt' },
                            { value: 'APPROVED', label: 'Đã duyệt' },
                            { value: 'REJECTED', label: 'Từ chối' },
                        ]}
                    />
                    <Input
                        placeholder="Tìm đề tài..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 320 }}
                        allowClear
                    />
                </div>

                <Table
                    dataSource={topics}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10, showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} đề tài`, showSizeChanger: false }}
                    size="middle"
                />
            </div>

            <Modal
                title={editingTopic ? 'Chỉnh sửa bản nháp' : 'Thêm đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={<div className="flex justify-between"><Button onClick={() => setFormModalOpen(false)}>Hủy</Button><Space><Button onClick={handleSaveDraft} loading={submitting}>Lưu nháp</Button><Button type="primary" onClick={handleCreateApproved} loading={submitting} icon={editingTopic ? <SendOutlined /> : undefined}>{editingTopic ? 'Gửi duyệt' : 'Tạo đề tài'}</Button></Space></div>}
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label="Tên đề tài" rules={[{ required: true, message: 'Nhập tên đề tài' }]}><Input placeholder="Nhập tên đề tài" /></Form.Item>
                    <Form.Item name="description" label="Mô tả"><TextArea rows={4} placeholder="Mô tả chi tiết đề tài" /></Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true, message: 'Chọn đợt' }]}><Select placeholder="Chọn đợt" options={semesters} /></Form.Item>
                        <Form.Item name="mentorId" label="GVHD" rules={[{ required: true, message: 'Chọn giảng viên hướng dẫn' }]}>
                            <Select placeholder="Chọn GVHD" options={mentors} showSearch optionFilterProp="label" />
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="maxStudents" label="Số sinh viên tối đa"><Select options={[{ value: 1, label: '1 sinh viên' }, { value: 2, label: '2 sinh viên' }, { value: 3, label: '3 sinh viên' }]} /></Form.Item>
                    </div>
                </Form>
            </Modal>

            <Modal
                title="Từ chối đề tài"
                open={rejectModalOpen}
                onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
                onOk={handleReject}
                confirmLoading={submitting}
                okText="Từ chối"
                okButtonProps={{ danger: true }}
            >
                <p className="text-sm mb-3">Vui lòng nhập lý do từ chối đề tài:</p>
                <TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Nhập lý do..." />
            </Modal>

            <Modal title="Chi tiết đề tài" open={detailModalOpen} onCancel={() => setDetailModalOpen(false)} footer={null} width={700}>
                {detailTopic && (
                    <div className="mt-4">
                        <h3 className="text-lg font-bold text-slate-900">{detailTopic.title}</h3>
                        <p className="text-sm text-slate-500 mt-2">{detailTopic.description || 'Chưa có mô tả.'}</p>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div><span className="text-xs font-bold text-slate-500">Trạng thái: </span><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${statusConfig[detailTopic.status]?.tw}`}>{statusConfig[detailTopic.status]?.label}</span></div>
                            <div><span className="text-xs font-bold text-slate-500">Số sinh viên tối đa: </span><span className="text-sm">{detailTopic.maxStudents}</span></div>
                            <div><span className="text-xs font-bold text-slate-500">GVHD: </span><span className="text-sm">{detailTopic.mentor?.fullName}</span></div>
                            <div><span className="text-xs font-bold text-slate-500">Người đề xuất: </span><span className="text-sm">{detailTopic.proposedBy?.fullName}</span></div>
                            <div><span className="text-xs font-bold text-slate-500">Đợt đồ án: </span><span className="text-sm">{detailTopic.semester?.name}</span></div>
                        </div>
                        {detailTopic.rejectReason && (
                            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100"><span className="text-xs font-bold text-red-600">Lý do từ chối: </span><span className="text-sm text-red-700">{detailTopic.rejectReason}</span></div>
                        )}
                        {detailTopic.registrations?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-bold text-slate-700 mb-2">Sinh viên đã đăng ký ({detailTopic.registrations.length}):</p>
                                {detailTopic.registrations.map((registration) => (
                                    <div key={registration.id} className="bg-slate-50 rounded-lg p-3 mt-2 text-sm">
                                        <span className="font-bold">{registration.student?.fullName || 'Sinh viên'}</span>
                                        <span className="text-slate-500"> ({registration.student?.code || 'N/A'})</span>
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">{registration.status}</span>
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
