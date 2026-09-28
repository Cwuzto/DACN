// src/pages/admin/AnnouncementManagementPage.jsx
import { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Switch,
    Space,
    Tag,
    message,
    Popconfirm,
    Tooltip,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    PushpinOutlined,
    SearchOutlined,
    ReloadOutlined,
    FileTextOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
} from '@ant-design/icons';
import { announcementService } from '../../services/announcementService';
import uploadService from '../../services/uploadService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

const { TextArea } = Input;

const CATEGORY_OPTIONS = [
    { value: 'ANNOUNCEMENT', label: 'Thông báo đào tạo' },
    { value: 'NEWS', label: 'Tin tức & Sự kiện' },
];

function AnnouncementManagementPage() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState(undefined);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const fetchData = useCallback(async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const params = { page, limit, all: 'true' };
            if (searchText) params.search = searchText;
            if (filterCategory) params.category = filterCategory;

            const res = await announcementService.getAnnouncements(params);
            if (res.success) {
                setAnnouncements(res.data || []);
                setPagination({
                    current: res.pagination?.page || page,
                    pageSize: res.pagination?.limit || limit,
                    total: res.pagination?.total || 0,
                });
            }
        } catch (err) {
            message.error(err?.message || 'Không thể tải danh sách thông báo.');
        } finally {
            setLoading(false);
        }
    }, [searchText, filterCategory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTableChange = (pag) => {
        fetchData(pag.current, pag.pageSize);
    };

    const handleSearch = () => {
        fetchData(1, pagination.pageSize);
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setUploadedFile(null);
        form.resetFields();
        form.setFieldsValue({
            category: 'ANNOUNCEMENT',
            isPinned: false,
            isPublished: true,
        });
        setModalVisible(true);
    };

    const openEditModal = (record) => {
        setEditingItem(record);
        setUploadedFile(record.fileUrl ? { url: record.fileUrl, name: record.fileName } : null);
        form.setFieldsValue({
            title: record.title,
            content: record.content || '',
            category: record.category || 'ANNOUNCEMENT',
            isPinned: record.isPinned,
            isPublished: record.isPublished,
        });
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const payload = {
                ...values,
                fileUrl: uploadedFile?.url || null,
                fileName: uploadedFile?.name || null,
            };

            if (editingItem) {
                await announcementService.updateAnnouncement(editingItem.id, payload);
                message.success('Cập nhật thông báo thành công!');
            } else {
                await announcementService.createAnnouncement(payload);
                message.success('Tạo thông báo thành công!');
            }

            setModalVisible(false);
            fetchData(pagination.current, pagination.pageSize);
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await announcementService.deleteAnnouncement(id);
            message.success('Xóa thông báo thành công!');
            fetchData(pagination.current, pagination.pageSize);
        } catch (err) {
            message.error(err?.message || 'Xóa thất bại.');
        }
    };

    const handleTogglePin = async (record) => {
        try {
            await announcementService.updateAnnouncement(record.id, { isPinned: !record.isPinned });
            message.success(record.isPinned ? 'Đã bỏ ghim thông báo.' : 'Đã ghim thông báo lên đầu trang!');
            fetchData(pagination.current, pagination.pageSize);
        } catch (err) {
            message.error(err?.message || 'Cập nhật thất bại.');
        }
    };

    const handleTogglePublish = async (record) => {
        try {
            await announcementService.updateAnnouncement(record.id, { isPublished: !record.isPublished });
            message.success(record.isPublished ? 'Đã ẩn thông báo về bản nháp.' : 'Đã công khai thông báo!');
            fetchData(pagination.current, pagination.pageSize);
        } catch (err) {
            message.error(err?.message || 'Cập nhật thất bại.');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await uploadService.uploadFile(file);
            if (res.success) {
                setUploadedFile({ url: res.data.url, name: file.name });
                message.success('Tải file thành công!');
            }
        } catch (err) {
            message.error(err?.message || 'Tải file thất bại.');
        } finally {
            setUploading(false);
        }
    };

    const pinnedCount = announcements.filter((a) => a.isPinned).length;
    const publishedCount = announcements.filter((a) => a.isPublished).length;

    const columns = [
        {
            title: 'Tiêu đề thông báo',
            dataIndex: 'title',
            key: 'title',
            width: '38%',
            render: (text, record) => (
                <div className="flex items-start gap-2">
                    {record.isPinned && (
                        <Tooltip title="Được ghim lên đầu">
                            <PushpinOutlined className="text-amber-500 mt-1 shrink-0 text-xs" />
                        </Tooltip>
                    )}
                    <div>
                        <div className="font-bold text-slate-900 leading-snug line-clamp-2 text-sm">{text}</div>
                        {record.fileName && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                <FileTextOutlined className="text-primary" />
                                <span className="truncate max-w-[220px]">{record.fileName}</span>
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Phân loại',
            dataIndex: 'category',
            key: 'category',
            width: 140,
            render: (cat) => (
                <Tag color={cat === 'NEWS' ? 'blue' : 'geekblue'} className="text-xs font-semibold m-0">
                    {cat === 'NEWS' ? 'Tin tức & Sự kiện' : 'Thông báo'}
                </Tag>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isPublished',
            key: 'isPublished',
            width: 130,
            render: (published) => (
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${published ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    <span className={`text-xs font-semibold ${published ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {published ? 'Công khai' : 'Bản nháp'}
                    </span>
                </div>
            ),
        },
        {
            title: 'File',
            dataIndex: 'fileUrl',
            key: 'fileUrl',
            width: 90,
            align: 'center',
            render: (url, record) =>
                url ? (
                    <Tooltip title={record.fileName || 'Xem file đính kèm'}>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                            <FileTextOutlined />
                        </a>
                    </Tooltip>
                ) : (
                    <span className="text-slate-300 font-bold">—</span>
                ),
        },
        {
            title: 'Người đăng',
            dataIndex: ['author', 'fullName'],
            key: 'author',
            width: 150,
            render: (name) => <span className="text-xs text-slate-600 font-medium">{name || 'Ban Quản trị'}</span>,
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 120,
            render: (date) => (
                <span className="text-xs text-slate-500 font-mono">
                    {new Date(date).toLocaleDateString('vi-VN')}
                </span>
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 160,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title={record.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}>
                        <Button
                            type="text"
                            size="small"
                            icon={<PushpinOutlined />}
                            className={record.isPinned ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-amber-500'}
                            onClick={() => handleTogglePin(record)}
                        />
                    </Tooltip>
                    <Tooltip title={record.isPublished ? 'Ẩn thông báo' : 'Công khai thông báo'}>
                        <Button
                            type="text"
                            size="small"
                            icon={record.isPublished ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                            className={record.isPublished ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-emerald-600'}
                            onClick={() => handleTogglePublish(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            className="text-slate-600 hover:text-primary"
                            onClick={() => openEditModal(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xác nhận xóa thông báo?"
                        description="Hành động này không thể hoàn tác."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa thông báo">
                            <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                danger
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Truyền thông & Thông báo' },
                    { label: 'Quản lý Thông báo' },
                ]}
                title="Quản lý Bản tin & Thông báo"
                subtitle="Tạo, chỉnh sửa và điều phối các thông báo đào tạo, lịch bảo vệ và tin tức công khai trên cổng sinh viên."
                tags={[{ label: 'Bản tin Cổng thông tin', color: 'blue' }]}
                actions={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => fetchData(pagination.current, pagination.pageSize)}
                        >
                            Làm mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={openCreateModal}
                        >
                            Tạo thông báo mới
                        </Button>
                    </Space>
                }
            />

            {/* 3 StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon="campaign"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Tổng số thông báo"
                    value={pagination.total || announcements.length}
                />
                <StatCard
                    icon="push_pin"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Thông báo được ghim"
                    value={pinnedCount}
                />
                <StatCard
                    icon="visibility"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Đang công khai"
                    value={publishedCount}
                />
            </div>

            {/* Content Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm kiếm theo tiêu đề thông báo..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={handleSearch}
                            allowClear
                            style={{ maxWidth: 360, minWidth: 240 }}
                        />
                        <Select
                            placeholder="Tất cả phân loại"
                            allowClear
                            value={filterCategory}
                            onChange={(val) => setFilterCategory(val)}
                            options={CATEGORY_OPTIONS}
                            style={{ minWidth: 180 }}
                        />
                    </div>
                    <span className="text-xs text-slate-500">
                        Hiển thị: <b className="text-slate-800">{announcements.length}</b> / {pagination.total} bản ghi
                    </span>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <Table
                        columns={columns}
                        dataSource={announcements}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            ...pagination,
                            showSizeChanger: true,
                            showTotal: (total) => `Tổng ${total} thông báo`,
                            pageSizeOptions: ['5', '10', '20'],
                        }}
                        onChange={handleTableChange}
                        scroll={{ x: 1000 }}
                        size="middle"
                    />
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                title={
                    <div className="text-base font-bold text-slate-900">
                        {editingItem ? 'Chỉnh sửa Thông báo' : 'Soạn Thông báo mới'}
                    </div>
                }
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                confirmLoading={submitting}
                okText={editingItem ? 'Lưu thay đổi' : 'Đăng thông báo'}
                cancelText="Hủy"
                width={680}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <Form.Item
                        name="title"
                        label="Tiêu đề thông báo"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề thông báo.' }]}
                    >
                        <Input placeholder="VD: Thông báo nộp đề cương và đăng ký bảo vệ khóa luận đợt 1" maxLength={255} showCount />
                    </Form.Item>

                    <Form.Item name="content" label="Nội dung chi tiết">
                        <TextArea
                            placeholder="Nhập nội dung thông báo chi tiết..."
                            rows={6}
                            maxLength={5000}
                            showCount
                        />
                    </Form.Item>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item name="category" label="Phân loại">
                            <Select options={CATEGORY_OPTIONS} />
                        </Form.Item>

                        <div className="flex gap-6 items-center pb-5">
                            <Form.Item name="isPinned" label="Ghim lên đầu" valuePropName="checked" className="mb-0">
                                <Switch checkedChildren="Có" unCheckedChildren="Không" />
                            </Form.Item>
                            <Form.Item name="isPublished" label="Công khai ngay" valuePropName="checked" className="mb-0">
                                <Switch checkedChildren="Có" unCheckedChildren="Không" />
                            </Form.Item>
                        </div>
                    </div>

                    {/* File Attachment */}
                    <Form.Item label="Tài liệu / File đính kèm">
                        <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors text-xs font-semibold border border-slate-200">
                                <FileTextOutlined />
                                <span>{uploading ? 'Đang tải lên...' : 'Chọn file tài liệu'}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                            </label>
                            {uploadedFile && (
                                <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                                    <FileTextOutlined className="text-primary" />
                                    <span className="max-w-[240px] truncate font-medium">{uploadedFile.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setUploadedFile(null)}
                                        className="text-slate-400 hover:text-rose-600 ml-1 font-bold"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default AnnouncementManagementPage;
