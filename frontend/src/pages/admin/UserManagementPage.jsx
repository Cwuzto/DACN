import { useState, useEffect, useCallback } from 'react';
import {
    Table, Card, Button, Input, Select, Tag, Space, Modal, Form,
    Avatar, Flex, Typography, Popconfirm, message, Tooltip, Badge,
    Row, Col, Spin,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
    LockOutlined, UnlockOutlined, ReloadOutlined, KeyOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';

const { Title, Text } = Typography;

const roleMap = {
    ADMIN: { label: 'Admin', color: 'red' },
    LECTURER: { label: 'Giảng viên', color: 'blue' },
    STUDENT: { label: 'Sinh viên', color: 'green' },
};

const statusMap = {
    true: { label: 'Hoạt động', badgeStatus: 'success' },
    false: { label: 'Bị khóa', badgeStatus: 'error' },
};

function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [roleFilter, setRoleFilter] = useState(null);
    const [statusFilter, setStatusFilter] = useState(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null); // null = create, object = edit
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    // Fetch users
    const fetchUsers = useCallback(async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (searchText) params.search = searchText;
            if (roleFilter) params.role = roleFilter;
            if (statusFilter) params.status = statusFilter;

            const res = await userService.getUsers(params);
            if (res.success) {
                setUsers(res.data);
                setPagination({
                    current: res.pagination.page,
                    pageSize: res.pagination.limit,
                    total: res.pagination.total,
                });
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    }, [searchText, roleFilter, statusFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Search with debounce effect
    const handleSearch = (value) => {
        setSearchText(value);
    };

    // Open create modal
    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    // Open edit modal
    const handleEdit = (record) => {
        setEditingUser(record);
        form.setFieldsValue({
            fullName: record.fullName,
            email: record.email,
            code: record.code,
            role: record.role,
            department: record.department,
            phone: record.phone,
        });
        setIsModalOpen(true);
    };

    // Submit form (create or update)
    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            if (editingUser) {
                // Update
                const res = await userService.updateUser(editingUser.id, values);
                if (res.success) {
                    message.success(res.message);
                    setIsModalOpen(false);
                    fetchUsers(pagination.current, pagination.pageSize);
                }
            } else {
                // Create
                const res = await userService.createUser(values);
                if (res.success) {
                    message.success(res.message);
                    setIsModalOpen(false);
                    fetchUsers(1, pagination.pageSize);
                }
            }
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Delete user
    const handleDelete = async (record) => {
        try {
            const res = await userService.deleteUser(record.id);
            if (res.success) {
                message.success(res.message);
                fetchUsers(pagination.current, pagination.pageSize);
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    // Toggle lock/unlock
    const handleToggleLock = async (record) => {
        try {
            const res = await userService.toggleActive(record.id);
            if (res.success) {
                message.success(res.message);
                fetchUsers(pagination.current, pagination.pageSize);
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    // Reset password
    const handleResetPassword = async (record) => {
        try {
            const res = await userService.resetPassword(record.id);
            if (res.success) {
                message.success(res.message);
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    // Table pagination change
    const handleTableChange = (pag) => {
        fetchUsers(pag.current, pag.pageSize);
    };

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            render: (_, __, idx) => (
                <Text type="secondary">
                    {(pagination.current - 1) * pagination.pageSize + idx + 1}
                </Text>
            ),
        },
        {
            title: 'Họ và tên',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (name, record) => (
                <Flex align="center" gap={12}>
                    <Avatar
                        size={36}
                        src={record.avatarUrl}
                        style={{
                            background:
                                record.role === 'ADMIN' ? '#ff4d4f'
                                    : record.role === 'LECTURER' ? '#1677FF'
                                        : '#52C41A',
                            flexShrink: 0,
                        }}
                    >
                        {name?.split(' ').pop()?.[0]?.toUpperCase()}
                    </Avatar>
                    <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>{name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{record.department || '—'}</Text>
                    </div>
                </Flex>
            ),
        },
        {
            title: 'Mã số',
            dataIndex: 'code',
            key: 'code',
            width: 130,
            render: (code) => <Text code>{code}</Text>,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            width: 120,
            render: (role) => {
                const r = roleMap[role] || { label: role, color: 'default' };
                return <Tag color={r.color}>{r.label}</Tag>;
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 120,
            render: (isActive) => {
                const s = statusMap[isActive];
                return <Badge status={s.badgeStatus} text={s.label} />;
            },
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 180,
            align: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            type="text" size="small"
                            icon={<EditOutlined />}
                            style={{ color: '#1677FF' }}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title={record.isActive ? 'Khóa tài khoản' : 'Mở khóa'}>
                        <Popconfirm
                            title={record.isActive ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
                            description={`${record.isActive ? 'Khóa' : 'Mở khóa'} tài khoản "${record.fullName}"?`}
                            okText="Đồng ý"
                            cancelText="Hủy"
                            onConfirm={() => handleToggleLock(record)}
                        >
                            <Button
                                type="text" size="small"
                                icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
                                style={{ color: '#FA8C16' }}
                            />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Reset mật khẩu">
                        <Popconfirm
                            title="Reset mật khẩu?"
                            description={`Mật khẩu sẽ được đặt lại về mã số: ${record.code}`}
                            okText="Reset"
                            cancelText="Hủy"
                            onConfirm={() => handleResetPassword(record)}
                        >
                            <Button type="text" size="small" icon={<KeyOutlined />} style={{ color: '#722ed1' }} />
                        </Popconfirm>
                    </Tooltip>
                    <Popconfirm
                        title="Xóa người dùng"
                        description={`Bạn có chắc muốn xóa "${record.fullName}"?`}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(record)}
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Page Header */}
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Quản lý Người dùng</Title>
            </Flex>

            {/* Action Bar */}
            <Card style={{ marginBottom: 16, borderRadius: 10 }} styles={{ body: { padding: '16px 20px' } }}>
                <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                    <Flex gap={12} align="center" wrap="wrap" flex={1}>
                        <Input
                            placeholder="Tìm theo tên, email, mã số..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(e) => handleSearch(e.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Vai trò: Tất cả"
                            style={{ minWidth: 160 }}
                            allowClear
                            value={roleFilter}
                            onChange={(val) => setRoleFilter(val || null)}
                            options={[
                                { label: 'Admin', value: 'ADMIN' },
                                { label: 'Giảng viên', value: 'LECTURER' },
                                { label: 'Sinh viên', value: 'STUDENT' },
                            ]}
                        />
                        <Select
                            placeholder="Trạng thái: Tất cả"
                            style={{ minWidth: 170 }}
                            allowClear
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val || null)}
                            options={[
                                { label: 'Hoạt động', value: 'active' },
                                { label: 'Bị khóa', value: 'locked' },
                            ]}
                        />
                    </Flex>

                    <Flex gap={8}>
                        <Tooltip title="Làm mới">
                            <Button icon={<ReloadOutlined />} onClick={() => fetchUsers(pagination.current, pagination.pageSize)} />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Thêm người dùng
                        </Button>
                    </Flex>
                </Flex>
            </Card>

            {/* Data Table */}
            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={users}
                    rowKey="id"
                    columns={columns}
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showTotal: (total, range) =>
                            `Hiển thị ${range[0]}-${range[1]} trong ${total} người dùng`,
                        showSizeChanger: true,
                    }}
                    onChange={handleTableChange}
                    size="middle"
                />
            </Card>

            {/* Create / Edit User Modal */}
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
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Họ và tên"
                                name="fullName"
                                rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
                            >
                                <Input placeholder="Nhập họ tên" />
                            </Form.Item>
                        </Col>
                        {editingUser && (
                            <Col span={12}>
                                <Form.Item
                                    label="Mã số"
                                    name="code"
                                    rules={[{ required: true, message: 'Vui lòng nhập mã số!' }]}
                                >
                                    <Input placeholder="VD: SV20201234" disabled />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email!' },
                            { type: 'email', message: 'Email không hợp lệ!' },
                        ]}
                    >
                        <Input placeholder="example@university.edu.vn" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Vai trò"
                                name="role"
                                rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
                            >
                                <Select placeholder="Chọn vai trò">
                                    <Select.Option value="STUDENT">Sinh viên</Select.Option>
                                    <Select.Option value="LECTURER">Giảng viên</Select.Option>
                                    <Select.Option value="ADMIN">Quản trị viên</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Bộ môn / Khoa" name="department">
                                <Select placeholder="Chọn Bộ môn / Khoa" allowClear>
                                    <Select.Option value="Viện Công nghệ Số">Viện Công nghệ Số</Select.Option>
                                    <Select.Option value="Bộ môn Công nghệ Phần mềm">Bộ môn Công nghệ Phần mềm</Select.Option>
                                    <Select.Option value="Bộ môn Hệ thống Thông tin">Bộ môn Hệ thống Thông tin</Select.Option>
                                    <Select.Option value="Bộ môn Mạng Máy tính">Bộ môn Mạng Máy tính</Select.Option>
                                    <Select.Option value="Bộ môn Khoa học Máy tính">Bộ môn Khoa học Máy tính</Select.Option>
                                    <Select.Option value="Bộ môn Toán - Lý">Bộ môn Toán - Lý</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Số điện thoại" name="phone">
                        <Input placeholder="Nhập số điện thoại" />
                    </Form.Item>

                    {!editingUser && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            💡 Mật khẩu mặc định sẽ là <Text code>mã số</Text> của người dùng.
                        </Text>
                    )}
                </Form>
            </Modal>
        </div>
    );
}

export default UserManagementPage;