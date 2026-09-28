import { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Input,
    Select,
    Modal,
    Form,
    message,
    Tooltip,
    Dropdown,
    Space,
    Tag,
} from 'antd';
import {
    PlusOutlined,
    SearchOutlined,
    EditOutlined,
    DeleteOutlined,
    LockOutlined,
    UnlockOutlined,
    ReloadOutlined,
    KeyOutlined,
    DownOutlined,
    UploadOutlined,
    DownloadOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';
import permissionService from '../../services/permissionService';
import PageHeader from '../../components/common/PageHeader';
import ExcelImportModal from '../../components/common/ExcelImportModal';

const roleMap = {
    ADMIN: { label: 'Quản trị viên', color: 'error', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' },
    LECTURER: { label: 'Giảng viên', color: 'blue', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
    STUDENT: { label: 'Sinh viên', color: 'green', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const roleSections = [
    { role: 'LECTURER', label: 'Giảng viên', icon: 'school', color: 'text-blue-600', bg: 'bg-blue-50' },
    { role: 'ADMIN', label: 'Quản trị viên', icon: 'admin_panel_settings', color: 'text-rose-600', bg: 'bg-rose-50' },
    { role: 'STUDENT', label: 'Sinh viên', icon: 'groups', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [activeRole, setActiveRole] = useState('LECTURER');
    const [statusFilter, setStatusFilter] = useState(null);
    const [accountRestrictedFilter, setAccountRestrictedFilter] = useState(null);
    const [roleCounts, setRoleCounts] = useState({ ADMIN: 0, LECTURER: 0, STUDENT: 0 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [form] = Form.useForm();
    const selectedRole = Form.useWatch('role', form);

    // Permission group modal
    const [permModal, setPermModal] = useState({ open: false, user: null });
    const [allGroups, setAllGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [permSubmitting, setPermSubmitting] = useState(false);

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

    const fetchGroups = useCallback(async () => {
        try {
            const res = await permissionService.listGroups();
            if (res.success) setAllGroups(res.data);
        } catch {
            // silent
        }
    }, []);

    const fetchUsers = useCallback(async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const params = { page, limit, role: activeRole };
            if (searchText) params.search = searchText;
            if (statusFilter) params.status = statusFilter;
            if (activeRole === 'STUDENT' && accountRestrictedFilter !== null) {
                params.accountRestricted = accountRestrictedFilter;
            }

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
    }, [searchText, activeRole, statusFilter, accountRestrictedFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchRoleCounts(); }, [fetchRoleCounts]);
    useEffect(() => { fetchGroups(); }, [fetchGroups]);
    useEffect(() => {
        if (activeRole !== 'STUDENT') {
            setAccountRestrictedFilter(null);
        }
    }, [activeRole]);

    const handleSearch = (value) => setSearchText(value);

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        form.setFieldsValue({ role: activeRole });
        setIsModalOpen(true);
    };

    const handleOpenPermModal = async (record) => {
        try {
            const res = await userService.getUserPermissions(record.id);
            const currentGroupIds = res.success
                ? (res.data.groups || []).map((g) => g.id)
                : [];
            setSelectedGroupIds(currentGroupIds);
        } catch {
            setSelectedGroupIds([]);
        }
        setPermModal({ open: true, user: record });
    };

    const handlePermModalOk = async () => {
        if (!permModal.user) return;
        setPermSubmitting(true);
        try {
            const res = await userService.updateUserPermissionGroups(permModal.user.id, selectedGroupIds);
            if (res.success) {
                message.success(res.message || 'Cập nhật nhóm quyền thành công');
                setPermModal({ open: false, user: null });
                fetchUsers(pagination.current, pagination.pageSize);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi cập nhật nhóm quyền');
        } finally {
            setPermSubmitting(false);
        }
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
            maxStudents: record.maxStudents,
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

    const handleExport = async () => {
        try {
            setExporting(true);
            message.loading({ content: 'Đang xuất dữ liệu người dùng ra Excel...', key: 'export-user' });
            await userService.exportUsersExcel({
                role: activeRole,
                status: statusFilter,
                search: searchText || undefined,
            });
            message.success({ content: 'Xuất file Excel thành công!', key: 'export-user' });
        } catch (error) {
            message.error({ content: error?.message || 'Lỗi khi xuất file Excel', key: 'export-user' });
        } finally {
            setExporting(false);
        }
    };

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => (
                <span className="text-slate-400 font-mono text-xs">
                    {(pagination.current - 1) * pagination.pageSize + index + 1}
                </span>
            ),
        },
        {
            title: 'Họ và tên',
            dataIndex: 'fullName',
            key: 'fullName',
            width: 250,
            render: (name, record) => {
                const initials = name ? name.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'U';
                return (
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                record.role === 'ADMIN'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : record.role === 'LECTURER'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                        >
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-snug truncate">{name}</p>
                            <p className="text-xs text-slate-500 truncate">{record.department || 'Chưa cập nhật khoa'}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Mã số',
            dataIndex: 'code',
            key: 'code',
            width: 130,
            render: (code) => (
                <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {code}
                </code>
            ),
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            width: 220,
            render: (email) => <span className="text-xs font-medium text-slate-600">{email}</span>,
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            width: 140,
            render: (role) => {
                const currentRole = roleMap[role];
                return (
                    <Tag color={currentRole?.color || 'default'} className="font-semibold text-xs m-0">
                        {currentRole?.label || role}
                    </Tag>
                );
            },
        },
        {
            title: 'Nhóm quyền',
            key: 'permissionGroups',
            width: 180,
            render: (_, record) =>
                record.permissionGroups?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {record.permissionGroups.map((group) => (
                            <span
                                key={group.code || group}
                                className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                                {group.name || group}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-300">—</span>
                ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 120,
            render: (isActive) => (
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <span className={`text-xs font-semibold ${isActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {isActive ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                </div>
            ),
        },
        {
            title: 'Giới hạn đồ án',
            key: 'accountRestricted',
            width: 150,
            render: (_, record) => {
                if (record.role !== 'STUDENT') return <span className="text-slate-300">—</span>;
                if (record.accountRestricted) {
                    return (
                        <Tag color="orange" className="text-xs m-0">
                            Đã hoàn thành
                        </Tag>
                    );
                }
                return (
                    <Tag color="success" className="text-xs m-0">
                        Bình thường
                    </Tag>
                );
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 130,
            align: 'right',
            render: (_, record) => {
                const items = [
                    { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa thông tin' },
                    { key: 'perm', icon: <SafetyCertificateOutlined />, label: 'Phân quyền nhóm (RBAC)' },
                    {
                        key: 'toggle',
                        icon: record.isActive ? <LockOutlined /> : <UnlockOutlined />,
                        label: record.isActive ? 'Khóa tài khoản' : 'Mở khóa',
                        danger: record.isActive,
                    },
                    { key: 'reset', icon: <KeyOutlined />, label: 'Reset mật khẩu mặc định' },
                    { type: 'divider' },
                    { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa tài khoản', danger: true },
                ];

                const onMenuClick = ({ key }) => {
                    if (key === 'edit') handleEdit(record);
                    if (key === 'perm') handleOpenPermModal(record);
                    if (key === 'toggle') {
                        Modal.confirm({
                            title: record.isActive ? 'Khóa tài khoản?' : 'Xác nhận Mở khóa?',
                            content: `Bạn có chắc muốn ${record.isActive ? 'khóa' : 'mở khóa'} tài khoản "${record.fullName}"?`,
                            okText: 'Đồng ý',
                            cancelText: 'Hủy',
                            onOk: () => handleToggleLock(record),
                        });
                    }
                    if (key === 'reset') {
                        Modal.confirm({
                            title: 'Reset mật khẩu?',
                            content: `Mật khẩu mới sẽ quay về mã số người dùng: ${record.code}`,
                            okText: 'Reset',
                            cancelText: 'Hủy',
                            onOk: () => handleResetPassword(record),
                        });
                    }
                    if (key === 'delete') {
                        Modal.confirm({
                            title: 'Cảnh báo xóa tài khoản',
                            content: `Bạn sắp xóa vĩnh viễn tài khoản "${record.fullName}". Hành động này không thể hoàn tác.`,
                            okText: 'Xóa ngay',
                            cancelText: 'Hủy',
                            okButtonProps: { danger: true },
                            onOk: () => handleDelete(record),
                        });
                    }
                };

                return (
                    <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} placement="bottomRight">
                        <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-primary">
                            Thao tác <DownOutlined className="text-[9px]" />
                        </Button>
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Người dùng & Phân quyền' },
                    { label: 'Quản lý Người dùng' },
                ]}
                title="Quản lý Người dùng"
                subtitle="Quản lý tài khoản Giảng viên, Sinh viên và Quản trị viên, phân quyền RBAC và tích hợp nhập xuất Excel."
                tags={[{ label: 'Tài khoản & RBAC', color: 'blue' }]}
                actions={
                    <Space>
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => setIsExcelModalOpen(true)}
                        >
                            Import Excel
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            loading={exporting}
                            onClick={handleExport}
                        >
                            Xuất Excel
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                        >
                            Thêm người dùng
                        </Button>
                    </Space>
                }
            />

            {/* 3 Large Role Interactive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {roleSections.map((section) => {
                    const isSelected = activeRole === section.role;
                    return (
                        <div
                            key={section.role}
                            onClick={() => setActiveRole(section.role)}
                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 flex items-center justify-between ${
                                isSelected
                                    ? 'bg-white border-primary shadow-sm ring-2 ring-primary/10'
                                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                            }`}
                        >
                            <div className="flex items-center gap-3.5">
                                <div className={`w-12 h-12 rounded-xl ${section.bg} ${section.color} flex items-center justify-center shrink-0`}>
                                    <span className="material-symbols-outlined text-[24px]">{section.icon}</span>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500">{section.label}</p>
                                    <p className="text-2xl font-black text-slate-900 mt-0.5">
                                        {roleCounts[section.role] || 0}
                                    </p>
                                </div>
                            </div>
                            {isSelected && (
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                                    Đang xem
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Filter Toolbar & Data Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm theo tên, email, mã số..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(event) => handleSearch(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Trạng thái tài khoản"
                            style={{ minWidth: 160 }}
                            allowClear
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value || null)}
                            options={[
                                { label: 'Tất cả trạng thái', value: null },
                                { label: 'Hoạt động', value: 'active' },
                                { label: 'Bị khóa', value: 'locked' },
                            ]}
                        />
                        {activeRole === 'STUDENT' && (
                            <Select
                                placeholder="Trạng thái đồ án"
                                style={{ minWidth: 220 }}
                                allowClear
                                value={accountRestrictedFilter}
                                onChange={(value) => setAccountRestrictedFilter(value ?? null)}
                                options={[
                                    { label: 'SV đã hoàn thành đồ án', value: 'true' },
                                    { label: 'SV bình thường', value: 'false' },
                                ]}
                            />
                        )}
                    </div>
                    <Tooltip title="Làm mới">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchUsers(pagination.current, pagination.pageSize);
                                fetchRoleCounts();
                            }}
                        />
                    </Tooltip>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Danh sách {roleMap[activeRole]?.label}
                        </span>
                        <span className="text-xs text-slate-500">
                            Tổng số: <b className="text-slate-800">{pagination.total}</b> tài khoản
                        </span>
                    </div>
                    <Table
                        dataSource={users}
                        rowKey="id"
                        columns={columns}
                        loading={loading}
                        pagination={{
                            ...pagination,
                            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} tài khoản`,
                            showSizeChanger: true,
                        }}
                        onChange={handleTableChange}
                        size="middle"
                        scroll={{ x: 1200 }}
                    />
                </div>
            </div>

            {/* Modal Create/Edit User */}
            <Modal
                title={
                    <div className="text-base font-bold text-slate-900">
                        {editingUser ? `Chỉnh sửa: ${editingUser.fullName}` : 'Thêm người dùng mới'}
                    </div>
                }
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText={editingUser ? 'Lưu thay đổi' : 'Tạo mới'}
                cancelText="Hủy"
                confirmLoading={submitting}
                width={620}
                centered
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item
                            label="Họ và tên"
                            name="fullName"
                            rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
                        >
                            <Input placeholder="Nhập họ và tên đầy đủ" />
                        </Form.Item>
                        <Form.Item
                            label="Mã số người dùng"
                            name="code"
                            rules={[{ required: true, message: 'Nhập mã số!' }]}
                        >
                            <Input placeholder="VD: GV00123 / SV20201234" disabled={Boolean(editingUser)} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Email trường"
                        name="email"
                        rules={[
                            { required: true, message: 'Nhập email!' },
                            { type: 'email', message: 'Email không hợp lệ!' },
                        ]}
                    >
                        <Input placeholder="example@tdmu.edu.vn" />
                    </Form.Item>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item label="Vai trò chính" name="role" rules={[{ required: true, message: 'Chọn vai trò!' }]}>
                            <Select placeholder="Chọn vai trò">
                                <Select.Option value="STUDENT">Sinh viên</Select.Option>
                                <Select.Option value="LECTURER">Giảng viên</Select.Option>
                                <Select.Option value="ADMIN">Quản trị viên</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item label="Khoa / Bộ môn" name="department">
                            <Select placeholder="Chọn Khoa / Bộ môn" allowClear>
                                <Select.Option value="Viện Công nghệ Số">Viện Công nghệ Số</Select.Option>
                                <Select.Option value="Bộ môn Công nghệ Phần mềm">Bộ môn Công nghệ Phần mềm</Select.Option>
                                <Select.Option value="Bộ môn Hệ thống Thông tin">Bộ môn Hệ thống Thông tin</Select.Option>
                                <Select.Option value="Bộ môn Mạng Máy tính">Bộ môn Mạng Máy tính</Select.Option>
                                <Select.Option value="Bộ môn Khoa học Máy tính">Bộ môn Khoa học Máy tính</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item label="Số điện thoại" name="phone">
                            <Input placeholder="Nhập số điện thoại liên hệ" />
                        </Form.Item>
                        {selectedRole === 'LECTURER' && (
                            <Form.Item
                                label="Học vị"
                                name="academicTitle"
                                rules={[{ required: true, message: 'Chọn học vị!' }]}
                            >
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
                        <Form.Item
                            label="Quota SV tối đa (Hạn mức hướng dẫn)"
                            name="maxStudents"
                            tooltip="Mặc định: ThS 10 SV, TS 15 SV, PGS 20 SV."
                        >
                            <Input type="number" placeholder="VD: 10" />
                        </Form.Item>
                    )}

                    {!editingUser && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            💡 Mật khẩu mặc định khi tạo mới là <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">mã số</code> của tài khoản.
                        </div>
                    )}
                </Form>
            </Modal>

            {/* Modal phân quyền RBAC */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SafetyCertificateOutlined className="text-indigo-600" />
                        <span>Phân nhóm quyền: <strong>{permModal.user?.fullName}</strong></span>
                    </div>
                }
                open={permModal.open}
                onOk={handlePermModalOk}
                onCancel={() => setPermModal({ open: false, user: null })}
                okText="Lưu nhóm quyền"
                cancelText="Hủy"
                confirmLoading={permSubmitting}
                width={560}
                centered
                destroyOnHidden
            >
                {permModal.user && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    permModal.user.role === 'ADMIN'
                                        ? 'bg-rose-100 text-rose-700'
                                        : permModal.user.role === 'LECTURER'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}
                            >
                                {permModal.user.fullName?.split(' ').pop()?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-900 leading-snug">{permModal.user.fullName}</p>
                                <p className="text-xs text-slate-500">
                                    {permModal.user.email} • {roleMap[permModal.user.role]?.label}
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500">
                            Tích chọn nhóm quyền cần cấp cho người dùng này. Các quyền hạn sẽ có hiệu lực ngay lập tức.
                        </p>

                        <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {allGroups
                                .filter((g) => {
                                    if (permModal.user.role === 'STUDENT') return false;
                                    if (permModal.user.role === 'ADMIN') return g.code === 'QUAN_TRI_VIEN';
                                    if (permModal.user.role === 'LECTURER') return g.code === 'GVHD' || g.code === 'VIEN_TRUONG';
                                    return true;
                                })
                                .map((group) => {
                                    const checked = selectedGroupIds.includes(group.id);
                                    return (
                                        <label
                                            key={group.id}
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                checked
                                                    ? 'border-indigo-300 bg-indigo-50/70 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-indigo-600"
                                                checked={checked}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedGroupIds((prev) => [...prev, group.id]);
                                                    } else {
                                                        setSelectedGroupIds((prev) => prev.filter((id) => id !== group.id));
                                                    }
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">
                                                        {group.code}
                                                    </code>
                                                    <span className="text-sm font-semibold text-slate-900">{group.name}</span>
                                                    {group.isSystem && (
                                                        <Tag color="gold" className="text-[10px] m-0">
                                                            Hệ thống
                                                        </Tag>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {group.description || `${group.permissions?.length || 0} quyền hạn chi tiết`}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Import Excel */}
            <ExcelImportModal
                open={isExcelModalOpen}
                onCancel={() => setIsExcelModalOpen(false)}
                onSuccess={() => {
                    fetchUsers(1, pagination.pageSize);
                    fetchRoleCounts();
                }}
                type={activeRole === 'LECTURER' ? 'LECTURER' : 'STUDENT'}
                onDownloadTemplate={() => userService.downloadTemplate(activeRole === 'LECTURER' ? 'LECTURER' : 'STUDENT')}
                onExecuteImport={(payload) => userService.importUsersExcel(payload)}
            />
        </div>
    );
}

export default UserManagementPage;