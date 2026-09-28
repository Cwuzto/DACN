import { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Tag,
    message,
    Tooltip,
    Popconfirm,
    Badge,
    Space,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import permissionService from '../../services/permissionService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

const MODULE_COLORS = {
    ANNOUNCEMENT: 'blue',
    ELIGIBILITY: 'cyan',
    LECTURER: 'geekblue',
    MENTOR: 'purple',
    TOPIC: 'magenta',
    OUTLINE: 'volcano',
    REGISTRATION: 'orange',
    PROGRESS: 'gold',
    DEFENSE: 'red',
    REVISION: 'lime',
    REPORT: 'green',
    ADMIN: 'default',
};

function PermissionGroupPage() {
    const [groups, setGroups] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [groupsRes, permsRes] = await Promise.all([
                permissionService.listGroups(),
                permissionService.listPermissions(),
            ]);
            if (groupsRes.success) setGroups(groupsRes.data || []);
            if (permsRes.success) setAllPermissions(permsRes.data || []);
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách nhóm quyền');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAdd = () => {
        setEditingGroup(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setEditingGroup(record);
        form.setFieldsValue({
            code: record.code,
            name: record.name,
            description: record.description,
            permissionCodes: record.permissions?.map((p) => p.permission?.code || p.code) || [],
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (record) => {
        try {
            const res = await permissionService.deleteGroup(record.id);
            if (res.success) {
                message.success(res.message || 'Đã xóa nhóm quyền');
                fetchData();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi xóa nhóm quyền');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingGroup) {
                const res = await permissionService.updateGroup(editingGroup.id, {
                    name: values.name,
                    description: values.description,
                    permissionCodes: values.permissionCodes || [],
                });
                if (res.success) {
                    message.success(res.message || 'Cập nhật nhóm quyền thành công');
                    setIsModalOpen(false);
                    fetchData();
                }
            } else {
                const res = await permissionService.createGroup({
                    code: values.code,
                    name: values.name,
                    description: values.description,
                    permissionCodes: values.permissionCodes || [],
                });
                if (res.success) {
                    message.success(res.message || 'Tạo nhóm quyền thành công');
                    setIsModalOpen(false);
                    fetchData();
                }
            }
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const permissionsByModule = allPermissions.reduce((acc, p) => {
        const mod = p.module || 'OTHER';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(p);
        return acc;
    }, {});

    const columns = [
        {
            title: 'Mã nhóm',
            dataIndex: 'code',
            key: 'code',
            width: 190,
            render: (code, record) => (
                <div className="flex items-center gap-2">
                    {record.isSystem && (
                        <Tooltip title="Nhóm hệ thống — Không thể xóa">
                            <LockOutlined className="text-amber-500 text-xs" />
                        </Tooltip>
                    )}
                    <code className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                        {code}
                    </code>
                </div>
            ),
        },
        {
            title: 'Tên nhóm quyền',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (name) => <span className="font-bold text-slate-900 text-sm">{name}</span>,
        },
        {
            title: 'Mô tả vai trò',
            dataIndex: 'description',
            key: 'description',
            width: 260,
            render: (desc) => <span className="text-xs text-slate-500">{desc || '—'}</span>,
        },
        {
            title: 'Số quyền',
            key: 'permCount',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Badge
                    count={record.permissions?.length || 0}
                    style={{ backgroundColor: '#4f46e5' }}
                    showZero
                />
            ),
        },
        {
            title: 'Người dùng',
            key: 'userCount',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                    {record._count?.users ?? '0'} users
                </span>
            ),
        },
        {
            title: 'Quyền hạn chi tiết',
            key: 'permissions',
            render: (_, record) => {
                const perms = record.permissions || [];
                const visible = perms.slice(0, 4);
                const remaining = perms.length - visible.length;
                return (
                    <div className="flex flex-wrap gap-1">
                        {visible.map((p) => {
                            const code = p.permission?.code || p.code;
                            const mod = p.permission?.module || p.module;
                            return (
                                <Tag
                                    key={code}
                                    color={MODULE_COLORS[mod] || 'default'}
                                    className="text-[10px] font-mono m-0"
                                >
                                    {code}
                                </Tag>
                            );
                        })}
                        {remaining > 0 && (
                            <Tooltip
                                title={perms.slice(4).map((p) => p.permission?.code || p.code).join(', ')}
                            >
                                <Tag className="text-[10px] m-0 cursor-pointer bg-slate-100 text-slate-600 font-semibold">
                                    +{remaining} quyền
                                </Tag>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 110,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    {!record.isSystem ? (
                        <Popconfirm
                            title="Xác nhận xóa nhóm quyền?"
                            description={`Nhóm "${record.name}" sẽ bị xóa vĩnh viễn khỏi hệ thống.`}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDelete(record)}
                        >
                            <Tooltip title="Xóa nhóm">
                                <Button size="small" icon={<DeleteOutlined />} danger />
                            </Tooltip>
                        </Popconfirm>
                    ) : (
                        <Tooltip title="Nhóm hệ thống — không thể xóa">
                            <Button size="small" icon={<DeleteOutlined />} disabled />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Người dùng & Phân quyền' },
                    { label: 'Quản lý phân quyền' },
                ]}
                title="Quản lý phân quyền"
                subtitle="Định nghĩa các nhóm vai trò và gán các permission nguyên tử cho từng phân hệ nghiệp vụ."
                tags={[{ label: 'Kiểm soát truy cập', color: 'purple' }]}
                actions={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={fetchData}>
                            Làm mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                        >
                            Tạo nhóm quyền
                        </Button>
                    </Space>
                }
            />

            {/* 4 StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    icon="shield_person"
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    label="Tổng nhóm quyền"
                    value={groups.length}
                />
                <StatCard
                    icon="lock"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Nhóm hệ thống"
                    value={groups.filter((g) => g.isSystem).length}
                />
                <StatCard
                    icon="key"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Tổng permission"
                    value={allPermissions.length}
                />
                <StatCard
                    icon="hub"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Module nghiệp vụ"
                    value={new Set(allPermissions.map((p) => p.module)).size}
                />
            </div>

            {/* Data Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <SafetyCertificateOutlined className="text-indigo-600 text-lg" />
                        <span className="text-sm font-bold text-slate-800">
                            Danh sách Nhóm quyền phân cấp
                        </span>
                    </div>
                    <span className="text-xs text-slate-500">
                        Tổng cộng: <b className="text-slate-800">{groups.length}</b> nhóm quyền
                    </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <Table
                        dataSource={groups}
                        rowKey="id"
                        columns={columns}
                        loading={loading}
                        pagination={false}
                        size="middle"
                        scroll={{ x: 1000 }}
                    />
                </div>
            </div>

            {/* Modal Create/Edit */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SafetyCertificateOutlined className="text-indigo-600" />
                        {editingGroup ? `Chỉnh sửa: ${editingGroup.name}` : 'Tạo nhóm quyền mới'}
                    </div>
                }
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText={editingGroup ? 'Lưu thay đổi' : 'Tạo nhóm'}
                cancelText="Hủy"
                confirmLoading={submitting}
                width={680}
                centered
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item
                            label="Mã nhóm quyền (code)"
                            name="code"
                            rules={[
                                { required: true, message: 'Nhập mã nhóm!' },
                                { pattern: /^[A-Z0-9_]+$/, message: 'Chỉ được dùng chữ hoa, số và dấu gạch dưới' },
                            ]}
                        >
                            <Input
                                placeholder="VD: TRUONG_BO_MON"
                                disabled={Boolean(editingGroup)}
                                className="font-mono"
                            />
                        </Form.Item>
                        <Form.Item
                            label="Tên hiển thị nhóm"
                            name="name"
                            rules={[{ required: true, message: 'Nhập tên nhóm!' }]}
                        >
                            <Input placeholder="VD: Trưởng Bộ môn" />
                        </Form.Item>
                    </div>

                    <Form.Item label="Mô tả phạm vi quyền hạn" name="description">
                        <Input.TextArea rows={2} placeholder="Mô tả vai trò, trách nhiệm và phạm vi hoạt động của nhóm quyền này..." />
                    </Form.Item>

                    <Form.Item label="Danh sách quyền hạn nguyên tử" name="permissionCodes">
                        <Select
                            mode="multiple"
                            placeholder="Chọn các quyền hạn chi tiết cho nhóm này..."
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            maxTagCount="responsive"
                            className="w-full"
                        >
                            {Object.entries(permissionsByModule).map(([module, perms]) => (
                                <Select.OptGroup key={module} label={`[Phân hệ: ${module}]`}>
                                    {perms.map((p) => (
                                        <Select.Option key={p.code} value={p.code} label={`${p.code} ${p.label}`}>
                                            <div className="flex items-center gap-2">
                                                <Tag color={MODULE_COLORS[module] || 'default'} className="text-[10px] m-0">
                                                    {module}
                                                </Tag>
                                                <span className="font-mono text-xs font-semibold">{p.code}</span>
                                                <span className="text-xs text-slate-500">— {p.label}</span>
                                            </div>
                                        </Select.Option>
                                    ))}
                                </Select.OptGroup>
                            ))}
                        </Select>
                    </Form.Item>

                    {!editingGroup && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            💡 Mã nhóm là định danh duy nhất trong hệ thống và không thể thay đổi sau khi tạo (VD: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">HOI_DONG_KHOA_HOC</code>).
                        </div>
                    )}
                </Form>
            </Modal>
        </div>
    );
}

export default PermissionGroupPage;
