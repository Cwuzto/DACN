import { useState, useEffect, useCallback } from 'react';
import {
    Table, Button, Input, Select, Modal, Form,
    Popconfirm, message, Tooltip,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
    LockOutlined, UnlockOutlined, ReloadOutlined, KeyOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';

const roleMap = {
    ADMIN: { label: 'Quản trị viên', tw: 'bg-red-100 text-red-700' },
    LECTURER: { label: 'Giảng viên', tw: 'bg-blue-100 text-blue-700' },
    STUDENT: { label: 'Sinh viên', tw: 'bg-green-100 text-green-700' },
};

const roleSections = [
    { role: 'LECTURER', label: 'Giảng viên' },
    { role: 'ADMIN', label: 'Quản trị viên' },
    { role: 'STUDENT', label: 'Sinh viên' },
];

function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [activeRole, setActiveRole] = useState('LECTURER');
    const [statusFilter, setStatusFilter] = useState(null);
    const [roleCounts, setRoleCounts] = useState({ ADMIN: 0, LECTURER: 0, STUDENT: 0 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();
    const selectedRole = Form.useWatch('role', form);

    const fetchRoleCounts = useCallback(async () => {
        try {
            const responses = await Promise.all(
                roleSections.map((section) => userService.getUsers({ role: section.role, page: 1, limit: 1 }))
            );
            const nextCounts = { ADMIN: 0, LECTURER: 0, STUDENT: 0 };
            responses.forEach((response, index) => {
                const role = roleSections[index].role;
                nextCounts[role] = response?.pagination?.total || 0;
            });
            setRoleCounts(nextCounts);
        } catch {
            // Keep UI usable if counting requests fail
        }
    }, []);

    const fetchUsers = useCallback(async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const params = { page, limit, role: activeRole };
            if (searchText) params.search = searchText;
            if (statusFilter) params.status = statusFilter;

            const response = await userService.getUsers(params);
            if (response.success) {
                setUsers(response.data);
                setPagination({
                    current: response.pagination.page,
                    pageSize: response.pagination.limit,
                    total: response.pagination.total,
                });
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    }, [searchText, activeRole, statusFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchRoleCounts(); }, [fetchRoleCounts]);

    const handleSearch = (value) => setSearchText(value);

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setEditingUser(record);
        form.setFieldsValue({
            fullName: record.fullName,
            email: record.email,
            code: record.code,
            role: record.role,
            department: record.department,
            phone: record.phone,
            academicTitle: record.academicTitle,
        });
        setIsModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingUser) {
                const response = await userService.updateUser(editingUser.id, values);
                if (response.success) {
                    message.success(response.message);
                    setIsModalOpen(false);
                    fetchUsers(pagination.current, pagination.pageSize);
                    fetchRoleCounts();
                }
            } else {
                const response = await userService.createUser(values);
                if (response.success) {
                    message.success(response.message);
                    setIsModalOpen(false);
                    fetchUsers(1, pagination.pageSize);
                    fetchRoleCounts();
                }
            }
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (record) => {
        try {
            const response = await userService.deleteUser(record.id);
            if (response.success) {
                message.success(response.message);
                fetchUsers(pagination.current, pagination.pageSize);
                fetchRoleCounts();
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleToggleLock = async (record) => {
        try {
            const response = await userService.toggleActive(record.id);
            if (response.success) {
                message.success(response.message);
                fetchUsers(pagination.current, pagination.pageSize);
                fetchRoleCounts();
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleResetPassword = async (record) => {
        try {
            const response = await userService.resetPassword(record.id);
            if (response.success) message.success(response.message);
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleTableChange = (nextPagination) => fetchUsers(nextPagination.current, nextPagination.pageSize);

    const columns = [
        {
            title: 'STT', key: 'index', width: 60,
            render: (_, __, index) => <span className="text-slate-400 text-sm">{(pagination.current - 1) * pagination.pageSize + index + 1}</span>,
        },
        {
            title: 'Họ và tên', dataIndex: 'fullName', key: 'fullName',
            render: (name, record) => (
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${record.role === 'ADMIN' ? 'bg-red-500' : record.role === 'LECTURER' ? 'bg-primary' : 'bg-green-500'}`}>
                        {name?.split(' ').pop()?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{name}</p>
                        <p className="text-xs text-slate-400">{record.department || '—'}</p>
                    </div>
                </div>
            ),
        },
        { title: 'Mã số', dataIndex: 'code', key: 'code', width: 130, render: (code) => <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{code}</code> },
        { title: 'Email', dataIndex: 'email', key: 'email', render: (email) => <span className="text-sm text-slate-600">{email}</span> },
        {
            title: 'Vai trò', dataIndex: 'role', key: 'role', width: 130,
            render: (role) => {
                const currentRole = roleMap[role];
                return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${currentRole?.tw || 'bg-slate-100 text-slate-600'}`}>{currentRole?.label || role}</span>;
            },
        },
        {
            title: 'Trạng thái', dataIndex: 'isActive', key: 'isActive', width: 120,
            render: (isActive) => (
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-red-500'}`}>{isActive ? 'Hoạt động' : 'Bị khóa'}</span>
                </div>
            ),
        },
        {
            title: 'Hành động', key: 'actions', width: 180, align: 'right',
            render: (_, record) => (
                <div className="flex items-center justify-end gap-1">
                    <Tooltip title="Chỉnh sửa"><Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#003366' }} onClick={() => handleEdit(record)} /></Tooltip>
                    <Tooltip title={record.isActive ? 'Khóa tài khoản' : 'Mở khóa'}>
                        <Popconfirm title={record.isActive ? 'Khóa tài khoản?' : 'Mở khóa?'} description={`${record.isActive ? 'Khóa' : 'Mở khóa'} "${record.fullName}"?`} okText="Đồng ý" cancelText="Hủy" onConfirm={() => handleToggleLock(record)}>
                            <Button type="text" size="small" icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />} style={{ color: '#FA8C16' }} />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Reset mật khẩu">
                        <Popconfirm title="Reset mật khẩu?" description={`Mật khẩu gán lại: ${record.code}`} okText="Reset" cancelText="Hủy" onConfirm={() => handleResetPassword(record)}>
                            <Button type="text" size="small" icon={<KeyOutlined />} style={{ color: '#722ed1' }} />
                        </Popconfirm>
                    </Tooltip>
                    <Popconfirm title="Xóa người dùng" description={`Xóa "${record.fullName}"?`} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(record)}>
                        <Tooltip title="Xóa"><Button type="text" size="small" icon={<DeleteOutlined />} danger /></Tooltip>
                    </Popconfirm>
                </div>
            ),
        },
    ];

    return (
        <div className="py-2">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Quản lý Người dùng</h2>
                    <p className="text-sm text-slate-500 mt-1">Tách theo từng nhóm vai trò và quản lý danh sách chi tiết</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button icon={<span className="material-symbols-outlined text-[16px]">upload_file</span>}>Import Excel</Button>
                    <Button icon={<span className="material-symbols-outlined text-[16px]">download</span>}>Export</Button>
                    <button onClick={handleAdd} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Thêm người dùng
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {roleSections.map((section) => (
                        <button
                            key={section.role}
                            onClick={() => setActiveRole(section.role)}
                            className={`text-left border rounded-xl px-4 py-3 transition-all ${
                                activeRole === section.role
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <p className="text-xs text-slate-500 font-medium mb-1">{section.label}</p>
                            <p className="text-2xl font-black text-slate-900">{roleCounts[section.role] || 0}</p>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm theo tên, email, mã số..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(event) => handleSearch(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Trạng thái"
                            style={{ minWidth: 150 }}
                            allowClear
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value || null)}
                            options={[{ label: 'Hoạt động', value: 'active' }, { label: 'Bị khóa', value: 'locked' }]}
                        />
                    </div>
                    <Tooltip title="Làm mới">
                        <Button icon={<ReloadOutlined />} onClick={() => { fetchUsers(pagination.current, pagination.pageSize); fetchRoleCounts(); }} />
                    </Tooltip>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
                    Danh sách: {roleMap[activeRole]?.label}
                </div>
                <Table
                    dataSource={users}
                    rowKey="id"
                    columns={columns}
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} người dùng`,
                        showSizeChanger: true,
                    }}
                    onChange={handleTableChange}
                    size="middle"
                />
            </div>

            <Modal
                title={editingUser ? `Chỉnh sửa: ${editingUser.fullName}` : 'Thêm người dùng mới'}
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText={editingUser ? 'Lưu thay đổi' : 'Tạo mới'}
                cancelText="Hủy"
                confirmLoading={submitting}
                width={600}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}>
                            <Input placeholder="Nhập họ tên" />
                        </Form.Item>
                        {editingUser && (
                            <Form.Item label="Mã số" name="code" rules={[{ required: true, message: 'Nhập mã số!' }]}>
                                <Input placeholder="VD: SV20201234" disabled />
                            </Form.Item>
                        )}
                    </div>
                    <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Nhập email!' }, { type: 'email', message: 'Email không hợp lệ!' }]}>
                        <Input placeholder="example@university.edu.vn" />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Vai trò" name="role" rules={[{ required: true, message: 'Chọn vai trò!' }]}>
                            <Select placeholder="Chọn vai trò">
                                <Select.Option value="STUDENT">Sinh viên</Select.Option>
                                <Select.Option value="LECTURER">Giảng viên</Select.Option>
                                <Select.Option value="ADMIN">Quản trị viên</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item label="Bộ môn / Khoa" name="department">
                            <Select placeholder="Chọn Bộ môn / Khoa" allowClear>
                                <Select.Option value="Viện Công nghệ Số">Viện Công nghệ Số</Select.Option>
                                <Select.Option value="Bộ môn Công nghệ Phần mềm">Bộ môn CNPM</Select.Option>
                                <Select.Option value="Bộ môn Hệ thống Thông tin">Bộ môn HTTT</Select.Option>
                                <Select.Option value="Bộ môn Mạng Máy tính">Bộ môn MMT</Select.Option>
                                <Select.Option value="Bộ môn Khoa học Máy tính">Bộ môn KHMT</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Số điện thoại" name="phone">
                            <Input placeholder="Nhập số điện thoại" />
                        </Form.Item>
                        {selectedRole === 'LECTURER' && (
                            <Form.Item label="Học vị" name="academicTitle" rules={[{ required: true, message: 'Chọn học vị!' }]}>
                                <Select
                                    placeholder="Chọn học vị"
                                    allowClear
                                    onChange={(value) => {
                                        let maxStudents = 10;
                                        if (value === 'TIEN_SI') maxStudents = 15;
                                        if (value === 'PHO_GIAO_SU') maxStudents = 20;
                                        form.setFieldValue('maxStudents', maxStudents);
                                    }}
                                >
                                    <Select.Option value="THAC_SI">Thạc sĩ</Select.Option>
                                    <Select.Option value="TIEN_SI">Tiến sĩ</Select.Option>
                                    <Select.Option value="PHO_GIAO_SU">Phó Giáo sư</Select.Option>
                                </Select>
                            </Form.Item>
                        )}
                    </div>
                    {selectedRole === 'LECTURER' && (
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item label="SV Tối đa (Quota)" name="maxStudents" tooltip="Mặc định theo học vị: ThS 10, TS 15, PGS 20.">
                                <Input type="number" placeholder="VD: 10" />
                            </Form.Item>
                            <Form.Item label="Avatar (Chỉ Admin mới có quyền cập nhật)" name="avatar">
                                <Button icon={<PlusOutlined />} className="w-full">Tải ảnh lên</Button>
                            </Form.Item>
                        </div>
                    )}
                    {!editingUser && (
                        <p className="text-xs text-slate-500 mt-2">💡 Mật khẩu mặc định sẽ là <code className="bg-slate-100 px-1 rounded">mã số</code> của người dùng.</p>
                    )}
                </Form>
            </Modal>
        </div>
    );
}

export default UserManagementPage;
