import { useState, useEffect } from 'react';
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
    Drawer,
    Progress,
    Descriptions,
    DatePicker,
} from 'antd';
import dayjs from 'dayjs';
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
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    BankOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';
import { useUsers, useUserRoleCounts, useUserPermissions, useUserMutation } from '../../queries/userQueries';
import { usePermissionGroups } from '../../queries/permissionQueries';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import ExcelImportModal from '../../components/common/ExcelImportModal';

const roleMap = {
    ADMIN: { label: 'Quản trị viên', color: 'error', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' },
    LECTURER: { label: 'Giảng viên', color: 'teal', badgeBg: 'bg-teal-50 text-teal-700 border-teal-200' },
    STUDENT: { label: 'Sinh viên', color: 'green', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function UserManagementPage() {
    const user = useAuthStore(state => state.user);
    const scope = queryKeys.scope(user);
    const userMutation = useUserMutation(scope);
    const [pageState, setPageState] = useState({ current: 1, pageSize: 10 });
    const [searchText, setSearchText] = useState('');
    const [activeRole, setActiveRole] = useState('LECTURER');
    const [departmentFilter, setDepartmentFilter] = useState(null);
    const [statusFilter, setStatusFilter] = useState(null);
    const [accountRestrictedFilter, setAccountRestrictedFilter] = useState(null);


    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [form] = Form.useForm();
    const selectedRole = Form.useWatch('role', form);

    // Profile context drawer
    const [drawerUser, setDrawerUser] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Permission group modal
    const [permModal, setPermModal] = useState({ open: false, user: null });
    const groupsQuery = usePermissionGroups(scope, permModal.open);
    const allGroups = groupsQuery.data || [];
    const permissionsQuery = useUserPermissions(scope, permModal.open ? permModal.user?.id : null);
    const [draftUserId, setDraftUserId] = useState(null);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [permSubmitting, setPermSubmitting] = useState(false);

    const usersQuery = useUsers(scope, {
        page: pageState.current, limit: pageState.pageSize, role: activeRole,
        ...(searchText ? { search: searchText } : {}),
        ...(departmentFilter ? { department: departmentFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(activeRole === 'STUDENT' && accountRestrictedFilter !== null ? { accountRestricted: accountRestrictedFilter } : {}),
    });
    const countsQuery = useUserRoleCounts(scope);
    const users = usersQuery.data?.data || [];
    const roleCounts = countsQuery.data || {};
    const pagination = { ...pageState, total: usersQuery.data?.pagination?.total || 0 };
    const resetPage = () => setPageState(prev => ({ ...prev, current: 1 }));
    const fetchUsers = (page = pageState.current, limit = pageState.pageSize) => {
        if (page !== pageState.current || limit !== pageState.pageSize) setPageState({ current: page, pageSize: limit });
        else usersQuery.refetch();
    };
    const fetchRoleCounts = () => countsQuery.refetch();

    useEffect(() => {
        if (!permModal.open || !permissionsQuery.data || draftUserId === permModal.user?.id) return;
        setSelectedGroupIds((permissionsQuery.data.groups || []).map(group => group.id));
        setDraftUserId(permModal.user.id);
    }, [permModal, permissionsQuery.data, draftUserId]);

    useEffect(() => {
        if (activeRole !== 'STUDENT') {
            setAccountRestrictedFilter(null);
        }
    }, [activeRole]);

    const handleSearch = (value) => { resetPage(); setSearchText(value); };

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        form.setFieldsValue({ role: activeRole });
        setIsModalOpen(true);
    };

    const handleOpenPermModal = (record) => {
        setDraftUserId(null);
        setSelectedGroupIds([]);
        setPermModal({ open: true, user: record });
    };

    const handlePermModalOk = async () => {
        if (!permModal.user) return;
        setPermSubmitting(true);
        try {
            const res = await userMutation.mutateAsync({ action: 'permissionGroups', id: permModal.user.id, data: selectedGroupIds });
            if (res.success) {
                message.success(res.message || 'Cập nhật nhóm quyền thành công');
                setPermModal({ open: false, user: null });
                if (drawerUser?.id === permModal.user.id) {
                    setIsDrawerOpen(false);
                }
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi cập nhật nhóm quyền');
        } finally {
            setPermSubmitting(false);
        }
    };

    const handleEdit = (record) => {
        setEditingUser(record);
        let parsedDob = null;
        if (record.studentProfile?.dateOfBirth) {
            const parsed = dayjs(record.studentProfile.dateOfBirth);
            if (parsed.isValid()) parsedDob = parsed;
        }

        let genderVal = undefined;
        if (record.studentProfile?.gender) {
            const g = record.studentProfile.gender;
            if (g === 'MALE' || g === 'Nam') genderVal = 'Nam';
            else if (g === 'FEMALE' || g === 'Nữ') genderVal = 'Nữ';
            else if (g === 'OTHER' || g === 'Khác') genderVal = 'Khác';
            else genderVal = g;
        }

        form.setFieldsValue({
            fullName: record.fullName,
            email: record.email,
            code: record.code,
            role: record.role,
            department: record.department,
            phone: record.phone,
            academicTitle: record.academicTitle,
            maxStudents: record.maxStudents,
            gender: genderVal,
            dateOfBirth: parsedDob,
            className: record.studentProfile?.className || '',
            major: record.studentProfile?.major || '',
        });
        setIsModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            const rawValues = await form.validateFields();
            setSubmitting(true);
            const values = { ...rawValues };
            if (values.role === 'STUDENT' && values.dateOfBirth) {
                values.dateOfBirth = dayjs.isDayjs(values.dateOfBirth)
                    ? values.dateOfBirth.format('DD/MM/YYYY')
                    : values.dateOfBirth;
            }

            if (editingUser) {
                const response = await userMutation.mutateAsync({ action: 'update', id: editingUser.id, data: values });
                if (response.success) {
                    message.success(response.message);
                    setIsModalOpen(false);
                    if (drawerUser?.id === editingUser.id) {
                        setDrawerUser((prev) => ({
                            ...prev,
                            ...values,
                            studentProfile: {
                                ...(prev.studentProfile || {}),
                                gender: values.gender,
                                dateOfBirth: values.dateOfBirth,
                                className: values.className,
                                major: values.major,
                            },
                        }));
                    }
                }
            } else {
                const response = await userMutation.mutateAsync({ action: 'create', data: values });
                if (response.success) {
                    message.success(response.message);
                    setIsModalOpen(false);
                    resetPage();
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
            const response = await userMutation.mutateAsync({ action: 'delete', id: record.id });
            if (response.success) {
                message.success(response.message);
                if (drawerUser?.id === record.id) setIsDrawerOpen(false);
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleToggleLock = async (record) => {
        try {
            const response = await userMutation.mutateAsync({ action: 'toggleActive', id: record.id });
            if (response.success) {
                message.success(response.message);
                if (drawerUser?.id === record.id) {
                    setDrawerUser((prev) => ({ ...prev, isActive: !prev.isActive }));
                }
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleResetPassword = async (record) => {
        try {
            const response = await userMutation.mutateAsync({ action: 'resetPassword', id: record.id });
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

    const totalAllAccounts = (roleCounts.ADMIN || 0) + (roleCounts.LECTURER || 0) + (roleCounts.STUDENT || 0);

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => (
                <span className="text-slate-600 font-mono text-xs font-semibold">
                    {(pagination.current - 1) * pagination.pageSize + index + 1}
                </span>
            ),
        },
        {
            title: 'Họ và tên & Đơn vị',
            dataIndex: 'fullName',
            key: 'fullName',
            width: 250,
            render: (name, record) => {
                const initials = name ? name.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'U';
                return (
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => {
                            setDrawerUser(record);
                            setIsDrawerOpen(true);
                        }}
                    >
                        <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                record.role === 'ADMIN'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : record.role === 'LECTURER'
                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                        >
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-snug group-hover:text-teal-700 transition-colors truncate">
                                {name}
                            </p>
                            <p className="text-xs text-slate-500 font-medium truncate">{record.department || 'Chưa cập nhật khoa'}</p>
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
                <code className="text-xs font-mono bg-slate-100 text-teal-900 px-2 py-0.5 rounded border border-slate-200 font-bold">
                    {code}
                </code>
            ),
        },
        {
            title: 'Email trường',
            dataIndex: 'email',
            key: 'email',
            width: 210,
            render: (email) => <span className="text-xs text-slate-600 font-medium">{email}</span>,
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            width: 130,
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
            title: activeRole === 'LECTURER' ? 'Chỉ tiêu hướng dẫn' : 'Nhóm quyền',
            key: 'quotaOrPerm',
            width: 170,
            render: (_, record) => {
                if (record.role === 'LECTURER') {
                    const max = record.maxStudents || 10;
                    return (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-slate-500 font-medium">Tối đa:</span>
                                <span className="font-bold text-teal-800">{max} SV</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-teal-600 h-full rounded-full" style={{ width: '40%' }}></div>
                            </div>
                        </div>
                    );
                }
                return record.permissionGroups?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {record.permissionGroups.map((group) => (
                            <span
                                key={group.code || group}
                                className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                            >
                                {group.name || group}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-400 font-bold">—</span>
                );
            },
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
            title: 'Thao tác',
            key: 'actions',
            width: 130,
            align: 'right',
            render: (_, record) => {
                const items = [
                    {
                        key: 'detail',
                        icon: <UserOutlined />,
                        label: 'Xem hồ sơ chi tiết',
                    },
                    { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa thông tin' },
                    { key: 'perm', icon: <SafetyCertificateOutlined />, label: 'Phân quyền nhóm' },
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
                    if (key === 'detail') {
                        setDrawerUser(record);
                        setIsDrawerOpen(true);
                    }
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
                        <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-teal-700">
                            Thao tác <DownOutlined className="text-[9px]" />
                        </Button>
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Người dùng & Phân quyền' },
                    { label: 'Quản trị Người dùng' },
                ]}
                title="Quản trị Người dùng & Phân quyền Kiêm nhiệm"
                subtitle="Quản lý tài khoản Giảng viên, Sinh viên, Quản trị viên, phân quyền RBAC và hạn mức hướng dẫn đồ án"
                actions={
                    <Space>
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => setIsExcelModalOpen(true)}
                        >
                            Nhập từ Excel
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
                            Thêm Người Dùng
                        </Button>
                    </Space>
                }
            />

            <QueryPanel query={countsQuery}>
            {/* 4 Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng Tài khoản</span>
                        <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalAllAccounts}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                        Đang hoạt động
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cán bộ & Giảng viên</span>
                        <p className="text-2xl font-black text-teal-700 mt-1 font-mono">{roleCounts.LECTURER || 0}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        ThS · TS · PGS
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sinh viên Làm đồ án</span>
                        <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">{roleCounts.STUDENT || 0}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        1 SV / 1 Đề tài
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quản trị & Giáo vụ</span>
                        <p className="text-2xl font-black text-rose-700 mt-1 font-mono">{roleCounts.ADMIN || 0}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        Toàn quyền
                    </span>
                </div>
            </div>

            </QueryPanel>
            {/* Faceted Filter Toolbar & Data Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 lg:p-5 space-y-4">
                {/* Segmented Role Tabs with Counters */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 flex-wrap">
                    <button
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                            activeRole === 'LECTURER'
                                ? 'bg-teal-50 text-teal-800 border border-teal-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => { resetPage(); setActiveRole('LECTURER'); }}
                    >
                        <span>Giảng viên</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 font-mono text-[11px]">
                            {roleCounts.LECTURER || 0}
                        </span>
                    </button>
                    <button
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                            activeRole === 'STUDENT'
                                ? 'bg-teal-50 text-teal-800 border border-teal-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => { resetPage(); setActiveRole('STUDENT'); }}
                    >
                        <span>Sinh viên</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[11px]">
                            {roleCounts.STUDENT || 0}
                        </span>
                    </button>
                    <button
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                            activeRole === 'ADMIN'
                                ? 'bg-teal-50 text-teal-800 border border-teal-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => { resetPage(); setActiveRole('ADMIN'); }}
                    >
                        <span>Quản trị & Giáo vụ</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono text-[11px]">
                            {roleCounts.ADMIN || 0}
                        </span>
                    </button>
                </div>

                {/* Filter Inputs Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm theo Mã số, Họ tên, Email trường, SĐT..."
                            prefix={<SearchOutlined className="text-slate-500" />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(event) => handleSearch(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Khoa / Bộ môn"
                            style={{ minWidth: 200 }}
                            allowClear
                            value={departmentFilter}
                            onChange={(value) => { resetPage(); setDepartmentFilter(value || null); }}
                            options={[
                                { label: 'Tất cả Bộ môn', value: null },
                                { label: 'Viện Công nghệ Số', value: 'Viện Công nghệ Số' },
                                { label: 'Bộ môn Kỹ thuật Phần mềm', value: 'Bộ môn Công nghệ Phần mềm' },
                                { label: 'Bộ môn Hệ thống Thông tin', value: 'Bộ môn Hệ thống Thông tin' },
                                { label: 'Bộ môn Mạng Máy tính', value: 'Bộ môn Mạng Máy tính' },
                                { label: 'Bộ môn Khoa học Máy tính', value: 'Bộ môn Khoa học Máy tính' },
                            ]}
                        />
                        <Select
                            placeholder="Trạng thái tài khoản"
                            style={{ minWidth: 160 }}
                            allowClear
                            value={statusFilter}
                            onChange={(value) => { resetPage(); setStatusFilter(value || null); }}
                            options={[
                                { label: 'Tất cả trạng thái', value: null },
                                { label: 'Hoạt động', value: 'active' },
                                { label: 'Bị khóa', value: 'locked' },
                            ]}
                        />
                        {activeRole === 'STUDENT' && (
                            <Select
                                placeholder="Trạng thái đồ án"
                                style={{ minWidth: 200 }}
                                allowClear
                                value={accountRestrictedFilter}
                                onChange={(value) => { resetPage(); setAccountRestrictedFilter(value ?? null); }}
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

                <QueryPanel query={usersQuery} variant="table">
                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <Table
                        dataSource={users}
                        rowKey="id"
                        columns={columns}
                        locale={{ emptyText: <EmptyState /> }}
                        loading={false}
                        pagination={{
                            ...pagination,
                            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} tài khoản`,
                            showSizeChanger: true,
                        }}
                        onChange={handleTableChange}
                        size="middle"
                        scroll={{ x: 1100 }}
                    />
                </div>
                </QueryPanel>
            </div>

            {/* USER PROFILE CONTEXT DRAWER */}
            <Drawer
                title={
                    drawerUser && (
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    drawerUser.role === 'ADMIN'
                                        ? 'bg-rose-100 text-rose-700'
                                        : drawerUser.role === 'LECTURER'
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}
                            >
                                {drawerUser.fullName?.split(' ').pop()?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 leading-snug">{drawerUser.fullName}</h3>
                                <p className="text-xs text-slate-500 font-mono font-medium">
                                    {drawerUser.code} · {roleMap[drawerUser.role]?.label}
                                </p>
                            </div>
                        </div>
                    )
                }
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                width={520}
                destroyOnClose
            >
                {drawerUser && (
                    <div className="space-y-6">
                        {/* Status Card */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái Tài khoản</span>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                    drawerUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                    {drawerUser.isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                    {drawerUser.isActive ? 'Đang hoạt động' : 'Tài khoản bị khóa'}
                                </span>
                            </div>
                            <div className="text-xs text-slate-700 font-medium space-y-1">
                                <p className="flex items-center gap-2">
                                    <MailOutlined className="text-slate-500" />
                                    <span>{drawerUser.email}</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <PhoneOutlined className="text-slate-500" />
                                    <span>{drawerUser.phone || 'Chưa cập nhật SĐT'}</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <BankOutlined className="text-slate-500" />
                                    <span>{drawerUser.department || (drawerUser.role === 'STUDENT' ? (drawerUser.studentProfile?.major || 'Sinh viên') : 'Chưa phân Khoa/Bộ môn')}</span>
                                </p>
                            </div>
                        </div>

                        {/* Student Details if Student */}
                        {drawerUser.role === 'STUDENT' && (
                            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Thông tin Sinh viên</span>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                                    <div><span className="text-slate-500 font-medium">Lớp:</span> <strong>{drawerUser.studentProfile?.className || '—'}</strong></div>
                                    <div><span className="text-slate-500 font-medium">Ngành:</span> <strong>{drawerUser.studentProfile?.major || '—'}</strong></div>
                                    <div><span className="text-slate-500 font-medium">Giới tính:</span> <strong>{drawerUser.studentProfile?.gender === 'MALE' ? 'Nam' : drawerUser.studentProfile?.gender === 'FEMALE' ? 'Nữ' : drawerUser.studentProfile?.gender === 'OTHER' ? 'Khác' : (drawerUser.studentProfile?.gender || '—')}</strong></div>
                                    <div><span className="text-slate-500 font-medium">Ngày sinh:</span> <strong>{drawerUser.studentProfile?.dateOfBirth ? (dayjs(drawerUser.studentProfile.dateOfBirth).isValid() ? dayjs(drawerUser.studentProfile.dateOfBirth).format('DD/MM/YYYY') : String(drawerUser.studentProfile.dateOfBirth)) : '—'}</strong></div>
                                </div>
                            </div>
                        )}

                        {/* Lecturer Quota Meter if Lecturer */}
                        {drawerUser.role === 'LECTURER' && (
                            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Hạn mức Hướng dẫn Đồ án</span>
                                    <span className="text-xs font-mono font-bold text-teal-900">
                                        Tối đa {drawerUser.maxStudents || 10} SV
                                    </span>
                                </div>
                                <div className="w-full bg-teal-200/50 rounded-full h-2 overflow-hidden">
                                    <div className="bg-teal-700 h-full rounded-full" style={{ width: '40%' }}></div>
                                </div>
                                <p className="text-[11px] text-teal-700">
                                    Học vị: <strong>{drawerUser.academicTitle || 'Thạc sĩ'}</strong> · Tối đa 1 SV / 1 Đề tài
                                </p>
                            </div>
                        )}

                        {/* Permission Groups */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhóm quyền RBAC</h4>
                            {drawerUser.permissionGroups?.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {drawerUser.permissionGroups.map((g) => (
                                        <span
                                            key={g.code || g}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200"
                                        >
                                            {g.name || g}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic font-medium">Chưa được gán nhóm quyền kiêm nhiệm nào.</p>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-2 pt-4 border-t border-slate-200">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thao tác nhanh</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={() => handleEdit(drawerUser)}
                                    className="text-xs"
                                >
                                    Sửa thông tin
                                </Button>
                                <Button
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={() => handleOpenPermModal(drawerUser)}
                                    className="text-xs"
                                >
                                    Phân quyền RBAC
                                </Button>
                                <Button
                                    icon={<KeyOutlined />}
                                    onClick={() => {
                                        Modal.confirm({
                                            title: 'Reset mật khẩu?',
                                            content: `Mật khẩu mới sẽ quay về mã số người dùng: ${drawerUser.code}`,
                                            okText: 'Reset',
                                            cancelText: 'Hủy',
                                            onOk: () => handleResetPassword(drawerUser),
                                        });
                                    }}
                                    className="text-xs"
                                >
                                    Reset mật khẩu
                                </Button>
                                <Button
                                    danger={drawerUser.isActive}
                                    icon={drawerUser.isActive ? <LockOutlined /> : <UnlockOutlined />}
                                    onClick={() => {
                                        Modal.confirm({
                                            title: drawerUser.isActive ? 'Khóa tài khoản?' : 'Mở khóa?',
                                            content: `Xác nhận ${drawerUser.isActive ? 'khóa' : 'mở khóa'} tài khoản "${drawerUser.fullName}"?`,
                                            okText: 'Đồng ý',
                                            cancelText: 'Hủy',
                                            onOk: () => handleToggleLock(drawerUser),
                                        });
                                    }}
                                    className="text-xs"
                                >
                                    {drawerUser.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>

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
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item
                            label={selectedRole === 'STUDENT' ? 'Họ và tên sinh viên (*)' : 'Họ và tên'}
                            name="fullName"
                            rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
                        >
                            <Input placeholder="Nhập họ và tên đầy đủ" />
                        </Form.Item>
                        <Form.Item
                            label={selectedRole === 'STUDENT' ? 'Mã số sinh viên (*)' : 'Mã số người dùng'}
                            name="code"
                            rules={[{ required: true, message: 'Nhập mã số!' }]}
                        >
                            <Input placeholder={selectedRole === 'STUDENT' ? 'VD: SV20260001' : 'VD: GV00123 / US001'} disabled={Boolean(editingUser)} />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item
                            label={selectedRole === 'STUDENT' ? 'Email sinh viên (*)' : 'Email trường'}
                            name="email"
                            rules={[
                                { required: true, message: 'Nhập email!' },
                                { type: 'email', message: 'Email không hợp lệ!' },
                            ]}
                        >
                            <Input placeholder="example@tdmu.edu.vn" />
                        </Form.Item>

                        <Form.Item label="Vai trò chính" name="role" rules={[{ required: true, message: 'Chọn vai trò!' }]}>
                            <Select placeholder="Chọn vai trò">
                                <Select.Option value="STUDENT">Sinh viên</Select.Option>
                                <Select.Option value="LECTURER">Giảng viên</Select.Option>
                                <Select.Option value="ADMIN">Quản trị viên</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>

                    {selectedRole === 'STUDENT' ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Form.Item
                                    label="Giới tính (*)"
                                    name="gender"
                                    rules={[{ required: true, message: 'Chọn giới tính!' }]}
                                >
                                    <Select placeholder="Chọn giới tính">
                                        <Select.Option value="Nam">Nam</Select.Option>
                                        <Select.Option value="Nữ">Nữ</Select.Option>
                                        <Select.Option value="Khác">Khác</Select.Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    label="Ngày sinh (*)"
                                    name="dateOfBirth"
                                    rules={[{ required: true, message: 'Chọn ngày sinh!' }]}
                                >
                                    <DatePicker
                                        format="DD/MM/YYYY"
                                        placeholder="Chọn ngày sinh"
                                        className="w-full"
                                        disabledDate={(current) => current && current > dayjs().endOf('day')}
                                    />
                                </Form.Item>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Form.Item
                                    label="Số điện thoại (*)"
                                    name="phone"
                                    rules={[{ required: true, message: 'Nhập số điện thoại!' }]}
                                >
                                    <Input placeholder="Nhập số điện thoại sinh viên" />
                                </Form.Item>

                                <Form.Item
                                    label="Lớp (*)"
                                    name="className"
                                    rules={[{ required: true, message: 'Nhập lớp học!' }]}
                                >
                                    <Input placeholder="VD: D20CNTT01" />
                                </Form.Item>
                            </div>

                            <Form.Item
                                label="Ngành học (*)"
                                name="major"
                                rules={[{ required: true, message: 'Nhập ngành học!' }]}
                            >
                                <Input placeholder="VD: Kỹ thuật Phần mềm" />
                            </Form.Item>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Form.Item label="Khoa / Bộ môn" name="department">
                                    <Select placeholder="Chọn Khoa / Bộ môn" allowClear>
                                        <Select.Option value="Viện Công nghệ Số">Viện Công nghệ Số</Select.Option>
                                        <Select.Option value="Bộ môn Công nghệ Phần mềm">Bộ môn Công nghệ Phần mềm</Select.Option>
                                        <Select.Option value="Bộ môn Hệ thống Thông tin">Bộ môn Hệ thống Thông tin</Select.Option>
                                        <Select.Option value="Bộ môn Mạng Máy tính">Bộ môn Mạng Máy tính</Select.Option>
                                        <Select.Option value="Bộ môn Khoa học Máy tính">Bộ môn Khoa học Máy tính</Select.Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item label="Số điện thoại" name="phone">
                                    <Input placeholder="Nhập số điện thoại liên hệ" />
                                </Form.Item>
                            </div>

                            {selectedRole === 'LECTURER' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                                    <Form.Item
                                        label="Chỉ tiêu hướng dẫn tối đa"
                                        name="maxStudents"
                                        tooltip="Mặc định: ThS 10 SV, TS 15 SV, PGS 20 SV."
                                    >
                                        <Input type="number" placeholder="VD: 10" />
                                    </Form.Item>
                                </div>
                            )}
                        </>
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
                        <SafetyCertificateOutlined className="text-teal-700" />
                        <span>Phân nhóm quyền: <strong>{permModal.user?.fullName}</strong></span>
                    </div>
                }
                open={permModal.open}
                onOk={handlePermModalOk}
                onCancel={() => setPermModal({ open: false, user: null })}
                okText="Lưu nhóm quyền"
                cancelText="Hủy"
                confirmLoading={permSubmitting}
                okButtonProps={{ disabled: !groupsQuery.isSuccess || !permissionsQuery.isSuccess || draftUserId !== permModal.user?.id }}
                width={560}
                centered
                destroyOnClose
            >
                {permModal.user && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    permModal.user.role === 'ADMIN'
                                        ? 'bg-rose-100 text-rose-700'
                                        : permModal.user.role === 'LECTURER'
                                        ? 'bg-teal-100 text-teal-800'
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

                        <QueryPanel query={permissionsQuery} />
                        <QueryPanel query={groupsQuery} empty={allGroups.length === 0 && permissionsQuery.data !== undefined}>
                        {permissionsQuery.data !== undefined && (
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
                                                    ? 'border-teal-300 bg-teal-50/70 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-teal-600"
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
                                                    <code className="text-xs bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono font-bold">
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
                        )}
                        </QueryPanel>
                    </div>
                )}
            </Modal>

            {/* Modal Import Excel */}
            <ExcelImportModal
                open={isExcelModalOpen}
                onCancel={() => setIsExcelModalOpen(false)}
                onSuccess={() => {
                    resetPage();
                }}
                type={activeRole === 'LECTURER' ? 'LECTURER' : 'STUDENT'}
                onDownloadTemplate={(targetRole) => userService.downloadTemplate(targetRole || (activeRole === 'LECTURER' ? 'LECTURER' : 'STUDENT'))}
                onExecuteImport={(payload) => userMutation.mutateAsync({ action: 'import', data: payload })}
            />
        </div>
    );
}

export default UserManagementPage;
