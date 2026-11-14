// src/pages/admin/AnnouncementManagementPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Alert,
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
    CloseOutlined,
} from '@ant-design/icons';
import { announcementService } from '../../services/announcementService';
import uploadService from '../../services/uploadService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useAnnouncements, useAnnouncementMutation } from '../../queries/announcementQueries';
import QueryPanel from '../../components/common/QueryPanel';

const { TextArea } = Input;

const CATEGORY_OPTIONS = [
    { value: 'ANNOUNCEMENT', label: 'Thông báo đào tạo' },
    { value: 'NEWS', label: 'Tin tức & Sự kiện' },
];

function AnnouncementManagementPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState(undefined);

    const announcementsQuery = useAnnouncements(scope, {
        page: pagination.current,
        limit: pagination.pageSize,
        all: 'true',
        ...(searchText ? { search: searchText } : {}),
        ...(filterCategory ? { category: filterCategory } : {}),
    });
    const announcementMutation = useAnnouncementMutation(scope);

    const announcements = announcementsQuery.data?.data || [];
    const total = announcementsQuery.data?.pagination?.total || 0;

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    // File upload state
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleTableChange = (pag) => {
        setPagination({ current: pag.current, pageSize: pag.pageSize });
    };

    const handleSearch = () => {
        setPagination((prev) => ({ ...prev, current: 1 }));
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
                await announcementMutation.mutateAsync({ action: 'updateAnnouncement', args: [editingItem.id, payload] });
                message.success('Cập nhật thông báo thành công!');
            } else {
                await announcementMutation.mutateAsync({ action: 'createAnnouncement', args: [payload] });
                message.success('Tạo thông báo thành công!');
            }

            setModalVisible(false);
        } catch (err) {
            if (err?.errorFields) return;
            message.error(err?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await announcementMutation.mutateAsync({ action: 'deleteAnnouncement', args: [id] });
            message.success('Xóa thông báo thành công!');
        } catch (err) {
            message.error(err?.message || 'Xóa thất bại.');
        }
    };

    const handleTogglePin = async (record) => {
        try {
            await announcementMutation.mutateAsync({ action: 'updateAnnouncement', args: [record.id, { isPinned: !record.isPinned }] });
            message.success(record.isPinned ? 'Đã bỏ ghim thông báo.' : 'Đã ghim thông báo lên đầu trang!');
        } catch (err) {
            message.error(err?.message || 'Cập nhật thất bại.');
        }
    };

    const handleTogglePublish = async (record) => {
        try {
            await announcementMutation.mutateAsync({ action: 'updateAnnouncement', args: [record.id, { isPublished: !record.isPublished }] });
            message.success(record.isPublished ? 'Đã ẩn thông báo về bản nháp.' : 'Đã công khai thông báo!');
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">PUBLIC PORTAL BROADCAST • TRANG CHỦ CỔNG THÔNG TIN</p>
                    <h1 className="h1">Bản Tin &amp; Quyết Định Học Vụ Portal</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => announcementsQuery.refetch()}
                    >
                        <ReloadOutlined />
                        <span>Làm mới</span>
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={openCreateModal}
                    >
                        <PlusOutlined />
                        <span>Soạn bản tin Portal</span>
                    </button>
                </div>
            </div>

            {/* Quick Navigation Banner to BM01-BM05 Templates */}
            <Alert
                type="info"
                showIcon
                className="rounded-xl border-blue-200 bg-blue-50/80"
                message={
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs sm:text-sm text-slate-700">
                            <b>Đang ở: Quản lý Bản tin &amp; Quyết định Portal.</b> Nếu bạn cần tạo, tải lên file Word/PDF hoặc công bố <b>Biểu mẫu BM01–BM05</b> để sinh viên tải về ở chân trang, hãy chuyển sang khu vực Biểu mẫu Portal.
                        </div>
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => navigate('/admin/portal?tab=TEMPLATE')}
                            className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold shrink-0"
                        >
                            Quản lý Biểu mẫu BM01–BM05
                        </Button>
                    </div>
                }
            />

            {/* 3 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng số bản tin / quyết định</span>
                    <p className="h2 num" style={{ marginTop: 2 }}>{pagination.total || announcements.length}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Tất cả các chuyên mục</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Bản tin được ghim</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--warning)' }}>{pinnedCount}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--warning)' }}>Ưu tiên hiển thị đầu trang Portal</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Đang công khai</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--success)' }}>{publishedCount}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--success)' }}>Hiển thị trực tiếp trên trang chủ Portal</div>
                </div>
            </div>

            {/* Content Table Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 lg:p-6 space-y-4">
                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm kiếm theo tiêu đề thông báo..."
                            prefix={<SearchOutlined className="text-slate-500" />}
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
                        Hiển thị: <b className="text-slate-800">{announcements.length}</b> / {total} bản ghi
                    </span>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <QueryPanel query={announcementsQuery} variant="table">
                        <Table
                            columns={columns}
                            dataSource={announcements}
                            rowKey="id"
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total,
                                showSizeChanger: true,
                                showTotal: (tot) => `Tổng ${tot} thông báo`,
                                pageSizeOptions: ['5', '10', '20'],
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 1000 }}
                            size="middle"
                        />
                    </QueryPanel>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                title={
                    <div className="text-base font-bold text-slate-900">
                        {editingItem ? 'Chỉnh sửa Bản tin / Quyết định Portal' : 'Soạn Bản tin / Quyết định Portal mới'}
                    </div>
                }
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={handleSubmit}
                confirmLoading={submitting}
                okText={editingItem ? 'Lưu thay đổi' : 'Đăng lên Portal'}
                cancelText="Hủy"
                width={680}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <Form.Item
                        name="title"
                        label="Tiêu đề bài đăng Portal"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề bài đăng.' }]}
                    >
                        <Input placeholder="VD: Thông báo gia hạn nộp đơn đề cương nghiên cứu BM01 đợt 1" maxLength={255} showCount />
                    </Form.Item>

                    <Form.Item name="content" label="Nội dung bài viết chi tiết">
                        <TextArea
                            placeholder="Nhập nội dung bài viết, quyết định hoặc hướng dẫn học vụ công khai..."
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
                            <Form.Item name="isPublished" label="Hiển thị ngay trên Portal" valuePropName="checked" className="mb-0">
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
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<CloseOutlined />}
                                        onClick={() => setUploadedFile(null)}
                                        className="text-slate-500 hover:text-rose-600 ml-1"
                                    />
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
