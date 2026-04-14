import { useState, useEffect, useCallback } from 'react';
import {
    Card, Table, Tag, Button, Input, Select, Space,
    Tooltip, Modal, Form, message, Popconfirm,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import useAuthStore from '../../stores/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { TextArea } = Input;

function TopicManagementPage() {
    const user = useAuthStore((s) => s.user);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [semesterOptions, setSemesterOptions] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const fetchTopics = useCallback(async () => {
        setLoading(true);
        try {
            const params = { mentorId: user?.id };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchText) params.search = searchText;
            const res = await topicService.getAll(params);
            const ownTopics = (res.data || []).filter(
                (topic) => topic.proposedById === user?.id || topic.proposedBy?.id === user?.id,
            );
            setTopics(ownTopics.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
        } catch {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText, user]);

    useEffect(() => { fetchTopics(); }, [fetchTopics]);

    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const res = await semesterService.getAll();
                if (!res.success) return;
                const options = (res.data || []).map((semester) => ({
                    value: semester.id,
                    label: semester.name,
                }));
                setSemesterOptions(options);
            } catch {
                message.error('Không thể tải danh sách học kỳ.');
            }
        };

        fetchSemesters();
    }, []);

    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                description: topic.description,
                semesterId: topic.semesterId,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ semesterId: semesterOptions[0]?.value });
        }
        setFormModalOpen(true);
    };

    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp.');
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

    const handlePublishTopic = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'APPROVED' });
            } else {
                await topicService.create({ ...values, status: 'APPROVED' });
            }
            message.success('Đã phát hành đề tài.');
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendForApproval = async (id) => {
        try {
            await topicService.update(id, { status: 'APPROVED' });
            message.success('Đã phát hành đề tài.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Có lỗi xảy ra.');
        }
    };

    const handleDelete = async (id) => {
        try {
            await topicService.delete(id);
            message.success('Đã xóa bản nháp.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể xóa.');
        }
    };

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài', dataIndex: 'title', key: 'title',
            render: (text, record) => (
                <div>
                    <span className="text-sm font-bold text-slate-900">{text}</span>
                    <div><span className="text-xs text-slate-400">Mã: DT-{String(record.id).padStart(3, '0')}</span></div>
                </div>
            ),
        },
        {
            title: 'Sinh viên đăng ký', key: 'registrations', align: 'center', width: 140,
            render: (_, record) => <Tag>{record._count?.registrations || 0}/1</Tag>,
        },
        {
            title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Hành động', key: 'action', width: 180, align: 'center',
            render: (_, record) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button size="small" className="text-xs font-medium border-slate-200 text-slate-700 shadow-sm hover:text-primary hover:border-primary hover:bg-slate-50" icon={<EyeOutlined />}>Xem</Button>
                    {['DRAFT', 'REJECTED'].includes(record.status) && (
                        <>
                            <Button size="small" className="text-xs font-medium border-slate-200 text-slate-700 shadow-sm hover:text-primary hover:border-primary hover:bg-slate-50" icon={<EditOutlined />} onClick={() => openFormModal(record)}>Sửa</Button>
                            <Popconfirm title="Phát hành đề tài này?" onConfirm={() => handleSendForApproval(record.id)}>
                                <Button size="small" className="text-xs font-medium border-purple-200 text-purple-700 shadow-sm bg-purple-50/50 hover:text-purple-800 hover:border-purple-300 hover:bg-purple-100" icon={<SendOutlined />}>Gửi đi</Button>
                            </Popconfirm>
                        </>
                    )}
                    {record.status === 'DRAFT' && (
                        <Popconfirm title="Xóa bản nháp này?" onConfirm={() => handleDelete(record.id)}>
                            <Button size="small" className="text-xs font-medium border-red-200 text-red-600 shadow-sm bg-red-50/50 hover:text-red-700 hover:border-red-300 hover:bg-red-100" icon={<DeleteOutlined />}>Xóa</Button>
                        </Popconfirm>
                    )}
                </div>
            ),
        },
    ];

    if (statusFilter === 'REJECTED' || topics.some((t) => t.status === 'REJECTED')) {
        const rejectCol = {
            title: 'Lý do từ chối', dataIndex: 'rejectReason', key: 'rejectReason', width: 240,
            render: (text) => (text ? <span className="text-xs text-red-500">{text}</span> : '-'),
        };
        if (!columns.find((c) => c.key === 'rejectReason')) {
            columns.splice(columns.length - 1, 0, rejectCol);
        }
    }

    return (
        <div>
            <PageHeader
                title="Quản lý đề tài"
                subtitle="Danh sách đề tài do bạn đề xuất và quản lý"
                actions={
                    <button onClick={() => openFormModal()} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Đề xuất đề tài mới
                    </button>
                }
            />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 180 }}
                        options={[
                            { value: 'all', label: 'Tất cả trạng thái' },
                            { value: 'DRAFT', label: 'Bản nháp' },
                            { value: 'APPROVED', label: 'Đã duyệt' },
                            { value: 'REJECTED', label: 'Từ chối' },
                        ]}
                    />
                    <Input
                        placeholder="Tìm kiếm đề tài..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                        allowClear
                    />
                </div>
                <Table
                    dataSource={topics}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                />
            </div>

            <Modal
                title={editingTopic ? 'Chỉnh sửa đề tài' : 'Đề xuất đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={(
                    <div className="flex items-center justify-between">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu nháp</Button>
                            <Button
                                type="primary"
                                onClick={handlePublishTopic}
                                loading={submitting}
                                icon={<SendOutlined />}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Phát hành
                            </Button>
                        </Space>
                    </div>
                )}
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label="Tên đề tài" rules={[{ required: true, message: 'Vui lòng nhập tên đề tài' }]}>
                        <Input placeholder="Nhập tên đề tài" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả chi tiết">
                        <TextArea rows={4} placeholder="Mô tả nội dung, phạm vi, công nghệ sử dụng..." />
                    </Form.Item>
                    <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true }]}>
                        <Select placeholder="Chọn đợt" options={semesterOptions} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default TopicManagementPage;
