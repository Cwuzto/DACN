import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    Tabs,
    Card,
    Alert,
    Spin,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
    SaveOutlined,
    CheckCircleFilled,
    CheckCircleOutlined,
    CheckOutlined,
    SearchOutlined,
    AppstoreOutlined,
    SlidersOutlined,
    ExclamationCircleOutlined,
    UndoOutlined,
    UnorderedListOutlined,
    BookOutlined,
} from '@ant-design/icons';
import permissionService from '../../services/permissionService';

const MODULE_COLORS = {
    PORTAL: 'cyan',
    ANNOUNCEMENT: 'blue',
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

const MODULE_TITLES = {
    PORTAL: 'Cổng thông tin & Biểu mẫu Portal',
    ANNOUNCEMENT: 'Bản tin & Quyết định học vụ',
    LECTURER: 'Danh bạ Giảng viên',
    MENTOR: 'Phân công hướng dẫn (GVHD)',
    TOPIC: 'Đề tài & Xét duyệt chuyên môn',
    OUTLINE: 'Đề cương BM01 & Hội đồng thẩm định',
    REGISTRATION: 'Đơn BM02 & Quyết định giao đề tài',
    PROGRESS: 'Tiến độ BM03, Checkpoint & BM04',
    DEFENSE: 'Hội đồng Chấm bảo vệ & Điểm số',
    REVISION: 'Lưu chiểu số & Sau bảo vệ',
    REPORT: 'Báo cáo & Thống kê học vụ',
    ADMIN: 'Quản trị hệ thống & Đào tạo',
};

function PermissionGroupPage() {
    // Tab state
    const [activeTab, setActiveTab] = useState('MATRIX');

    // Matrix states (phong cách AI-customer-analysis-system)
    const [matrixData, setMatrixData] = useState({ roles: [], modules: [], role_permissions: {} });
    const [localMatrix, setLocalMatrix] = useState({});
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [savingMatrix, setSavingMatrix] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [matrixSearchText, setMatrixSearchText] = useState('');
    const [matrixModuleFilter, setMatrixModuleFilter] = useState('ALL');

    // CRUD Groups states
    const [groups, setGroups] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    // 1. Tải dữ liệu ma trận phân quyền
    const fetchMatrix = useCallback(async () => {
        setMatrixLoading(true);
        try {
            const res = await permissionService.getPermissionMatrix();
            if (res.success && res.data) {
                const data = res.data;
                setMatrixData(data);

                // Khởi tạo localMatrix: { [roleId]: Set([permissionId, ...]) }
                const local = {};
                (data.roles || []).forEach((r) => {
                    const permIds = data.role_permissions?.[String(r.id)] || [];
                    local[r.id] = new Set(permIds);
                });
                setLocalMatrix(local);
                setDirty(false);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải ma trận phân quyền');
        } finally {
            setMatrixLoading(false);
        }
    }, []);

    // 2. Tải dữ liệu nhóm quyền & danh mục quyền
    const fetchGroupsData = useCallback(async () => {
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

    useEffect(() => {
        fetchMatrix();
        fetchGroupsData();
    }, [fetchMatrix, fetchGroupsData]);

    // Thao tác trên ô Ma trận (Toggle Cell)
    const toggleCell = (roleId, permId) => {
        setLocalMatrix((prev) => {
            const next = { ...prev };
            const currentSet = new Set(next[roleId] || []);
            if (currentSet.has(permId)) {
                currentSet.delete(permId);
            } else {
                currentSet.add(permId);
            }
            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác bật/tắt toàn bộ quyền cho 1 Role (Toggle Column)
    const toggleRoleAll = (roleId, allPermIds, checked) => {
        setLocalMatrix((prev) => {
            const next = { ...prev };
            const currentSet = new Set(next[roleId] || []);
            if (checked) {
                allPermIds.forEach((id) => currentSet.add(id));
            } else {
                allPermIds.forEach((id) => currentSet.delete(id));
            }
            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác áp dụng 1 quyền cho toàn bộ Role (Toggle Row)
    const togglePermAll = (permId, checked) => {
        setLocalMatrix((prev) => {
            const next = { ...prev };
            (matrixData.roles || []).forEach((r) => {
                const currentSet = new Set(next[r.id] || []);
                if (checked) {
                    currentSet.add(permId);
                } else {
                    currentSet.delete(permId);
                }
                next[r.id] = currentSet;
            });
            return next;
        });
        setDirty(true);
    };

    // Đặt lại ma trận về trạng thái ban đầu
    const handleResetMatrix = () => {
        const local = {};
        (matrixData.roles || []).forEach((r) => {
            const permIds = matrixData.role_permissions?.[String(r.id)] || [];
            local[r.id] = new Set(permIds);
        });
        setLocalMatrix(local);
        setDirty(false);
        message.info('Đã khôi phục ma trận về trạng thái lưu gần nhất.');
    };

    // Lưu hàng loạt ma trận phân quyền
    const handleSaveMatrix = async () => {
        try {
            setSavingMatrix(true);
            const payload = (matrixData.roles || []).map((role) => ({
                role_id: role.id,
                permission_ids: Array.from(localMatrix[role.id] || []),
            }));

            const res = await permissionService.bulkUpdatePermissionMatrix(payload);
            if (res.success) {
                message.success(res.message || 'Lưu ma trận phân quyền thành công!');
                setDirty(false);
                fetchMatrix();
                fetchGroupsData();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi lưu ma trận phân quyền');
        } finally {
            setSavingMatrix(false);
        }
    };

    // Lọc quyền theo search và module
    const filteredModules = useMemo(() => {
        const query = matrixSearchText.trim().toLowerCase();
        return (matrixData.modules || [])
            .filter((mod) => matrixModuleFilter === 'ALL' || mod.module_name === matrixModuleFilter)
            .map((mod) => {
                const perms = (mod.permissions || []).filter((p) => {
                    if (!query) return true;
                    return (
                        p.label?.toLowerCase().includes(query) ||
                        p.code?.toLowerCase().includes(query) ||
                        p.module?.toLowerCase().includes(query)
                    );
                });
                return { ...mod, permissions: perms };
            })
            .filter((mod) => mod.permissions.length > 0);
    }, [matrixData.modules, matrixSearchText, matrixModuleFilter]);

    // Thống kê tổng quan ma trận
    const matrixStats = useMemo(() => {
        const totalRoles = matrixData.roles?.length || 0;
        let totalPerms = 0;
        (matrixData.modules || []).forEach((m) => {
            totalPerms += m.permissions?.length || 0;
        });
        let activeAssignments = 0;
        Object.values(localMatrix).forEach((set) => {
            activeAssignments += set?.size || 0;
        });
        return {
            totalRoles,
            totalPerms,
            totalModules: matrixData.modules?.length || 0,
            activeAssignments,
        };
    }, [matrixData, localMatrix]);

    // Tất cả ID permission hiện có để tính toggle all column
    const allMatrixPermissionIds = useMemo(() => {
        const ids = [];
        (matrixData.modules || []).forEach((m) => {
            (m.permissions || []).forEach((p) => ids.push(p.id));
        });
        return ids;
    }, [matrixData.modules]);

    // Handlers cho CRUD Groups (Tab 2)
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
                fetchGroupsData();
                fetchMatrix();
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
                    fetchGroupsData();
                    fetchMatrix();
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
                    fetchGroupsData();
                    fetchMatrix();
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

    const groupColumns = [
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
                    style={{ backgroundColor: '#0F766E' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">ROLE-BASED ACCESS CONTROL • RBAC MATRIX</p>
                    <h1 className="h1">Phân Quyền &amp; Ma Trận Vai Trò Hệ Thống</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            fetchMatrix();
                            fetchGroupsData();
                        }}
                    >
                        Làm mới
                    </Button>
                    {activeTab === 'MATRIX' && (
                        <>
                            {dirty && (
                                <Button
                                    icon={<UndoOutlined />}
                                    onClick={handleResetMatrix}
                                >
                                    Khôi phục
                                </Button>
                            )}
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                loading={savingMatrix}
                                onClick={handleSaveMatrix}
                                style={{
                                    background: dirty ? '#0F766E' : undefined,
                                    borderColor: dirty ? '#0F766E' : undefined,
                                }}
                            >
                                {dirty ? 'Lưu Thay Đổi Ma Trận (*)' : 'Lưu Ma Trận'}
                            </Button>
                        </>
                    )}
                    {activeTab === 'GROUPS' && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                            style={{ background: '#0F766E', borderColor: '#0F766E' }}
                        >
                            Tạo nhóm quyền mới
                        </Button>
                    )}
                </div>
            </div>

            {/* 4 KPI Cards (Thống kê ma trận & quyền) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng số nhóm vai trò (Roles)</span>
                    <p className="h2 num" style={{ marginTop: 2, color: '#0F766E' }}>{matrixStats.totalRoles}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Cột quyền hạn trong ma trận</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng quyền nguyên tử (Permissions)</span>
                    <p className="h2 num" style={{ marginTop: 2 }}>{matrixStats.totalPerms}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Quyền hạn kiểm soát API backend</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Phân hệ chức năng (Modules)</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--institutional)' }}>
                        {matrixStats.totalModules}
                    </p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Nhóm nghiệp vụ độc lập</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Quyền đã kích hoạt cấp phát</span>
                    <p className="h2 num" style={{ marginTop: 2, color: '#2563EB' }}>{matrixStats.activeAssignments}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Ô tích chọn đang hoạt động</div>
                </div>
            </div>

            {/* Cảnh báo thay đổi chưa lưu trên ma trận */}
            {dirty && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span>
                                <b>Bạn có thay đổi chưa lưu trên ma trận phân quyền!</b> Vui lòng bấm <b>"Lưu Ma Trận"</b> để áp dụng xuống hệ thống.
                            </span>
                            <Space size="small">
                                <Button size="small" onClick={handleResetMatrix}>Hủy thay đổi</Button>
                                <Button
                                    size="small"
                                    type="primary"
                                    loading={savingMatrix}
                                    onClick={handleSaveMatrix}
                                    style={{ background: '#0F766E', borderColor: '#0F766E' }}
                                >
                                    Lưu ngay
                                </Button>
                            </Space>
                        </div>
                    }
                />
            )}

            {/* Tabs Điều Hướng */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                type="card"
                className="permission-tabs"
                items={[
                    {
                        key: 'MATRIX',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                <AppstoreOutlined />
                                Ma Trận Phân Quyền (RBAC Matrix)
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 lg:p-6 space-y-4">
                                {/* Toolbar Lọc & Tìm kiếm */}
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Input
                                            placeholder="Tìm kiếm quyền theo tên, mã code..."
                                            prefix={<SearchOutlined className="text-slate-400" />}
                                            style={{ width: 320 }}
                                            value={matrixSearchText}
                                            onChange={(e) => setMatrixSearchText(e.target.value)}
                                            allowClear
                                        />
                                        <Select
                                            value={matrixModuleFilter}
                                            onChange={setMatrixModuleFilter}
                                            style={{ width: 240 }}
                                            options={[
                                                { label: 'Tất cả phân hệ chức năng', value: 'ALL' },
                                                ...(matrixData.modules || []).map((m) => ({
                                                    label: `[${m.module_name}] ${MODULE_TITLES[m.module_name] || m.module_name}`,
                                                    value: m.module_name,
                                                })),
                                            ]}
                                        />
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Hiển thị <b>{filteredModules.reduce((sum, m) => sum + m.permissions.length, 0)}</b> / {matrixStats.totalPerms} quyền
                                    </div>
                                </div>

                                {/* Ma Trận Phân Quyền Table */}
                                <Spin spinning={matrixLoading}>
                                    <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                                                {/* Cột trái cố định: Quyền hạn */}
                                                <th
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 20,
                                                        background: '#F8FAFC',
                                                        padding: '14px 18px',
                                                        textAlign: 'left',
                                                        width: 380,
                                                        minWidth: 340,
                                                        borderRight: '1px solid #E2E8F0',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#334155', textTransform: 'uppercase' }}>
                                                            CHỨC NĂNG &amp; QUYỀN HẠN NGUYÊN TỬ
                                                        </span>
                                                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                                                            Phân nhóm theo phân hệ nghiệp vụ
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* Các cột Nhóm Quyền / Vai Trò */}
                                                {(matrixData.roles || []).map((role) => {
                                                    const rolePerms = localMatrix[role.id] || new Set();
                                                    const allChecked = allMatrixPermissionIds.length > 0 && allMatrixPermissionIds.every((id) => rolePerms.has(id));

                                                    return (
                                                        <th
                                                            key={role.id}
                                                            style={{
                                                                padding: '14px 12px',
                                                                textAlign: 'center',
                                                                minWidth: 140,
                                                                borderRight: '1px solid #E2E8F0',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 13.5 }}>
                                                                    {role.name}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <code style={{ fontSize: 10, background: '#E2E8F0', padding: '1px 6px', borderRadius: 4, color: '#334155' }}>
                                                                        {role.code}
                                                                    </code>
                                                                    {role.isSystem && (
                                                                        <Tooltip title="Nhóm hệ thống">
                                                                            <LockOutlined style={{ fontSize: 11, color: '#D97706' }} />
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                                <span style={{ fontSize: 11, color: '#0F766E', fontWeight: 600 }}>
                                                                    {rolePerms.size} / {allMatrixPermissionIds.length} quyền
                                                                </span>

                                                                {/* Checkbox Tất cả cho nhóm này */}
                                                                <label
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4,
                                                                        fontSize: 11,
                                                                        color: '#475569',
                                                                        cursor: 'pointer',
                                                                        marginTop: 2,
                                                                        background: '#FFFFFF',
                                                                        padding: '2px 8px',
                                                                        borderRadius: 6,
                                                                        border: '1px solid #CBD5E1',
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allChecked}
                                                                        onChange={(e) => toggleRoleAll(role.id, allMatrixPermissionIds, e.target.checked)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                    <span>Tất cả</span>
                                                                </label>
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filteredModules.map((mod) => (
                                                <React.Fragment key={mod.module_name}>
                                                    {/* Header phân cách từng Module */}
                                                    <tr style={{ background: '#F1F5F9', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                                                        <td
                                                            colSpan={(matrixData.roles?.length || 0) + 1}
                                                            style={{
                                                                position: 'sticky',
                                                                left: 0,
                                                                zIndex: 10,
                                                                background: '#F1F5F9',
                                                                padding: '10px 18px',
                                                                fontWeight: 700,
                                                                color: '#334155',
                                                                fontSize: 12,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.04em',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Tag color={MODULE_COLORS[mod.module_name] || 'default'} style={{ margin: 0 }}>
                                                                    {mod.module_name}
                                                                </Tag>
                                                                <span>{MODULE_TITLES[mod.module_name] || mod.module_name}</span>
                                                                <span style={{ fontSize: 11, background: '#FFFFFF', padding: '2px 8px', borderRadius: 999, border: '1px solid #CBD5E1', color: '#334155', fontWeight: 600 }}>
                                                                    {mod.permissions.length} quyền
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Danh sách từng quyền trong Module */}
                                                    {mod.permissions.map((perm) => {
                                                        const allRolesHave = (matrixData.roles || []).length > 0 &&
                                                            (matrixData.roles || []).every((r) => localMatrix[r.id]?.has(perm.id));

                                                        return (
                                                            <tr
                                                                key={perm.id}
                                                                style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s' }}
                                                                className="hover:bg-teal-50/40"
                                                            >
                                                                {/* Tên quyền & Mã code bên trái */}
                                                                <td
                                                                    style={{
                                                                        position: 'sticky',
                                                                        left: 0,
                                                                        zIndex: 10,
                                                                        background: '#FFFFFF',
                                                                        padding: '10px 18px',
                                                                        borderRight: '1px solid #E2E8F0',
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                        {/* Checkbox áp dụng cho tất cả nhóm */}
                                                                        <Tooltip title="Áp dụng quyền này cho tất cả nhóm vai trò">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={allRolesHave}
                                                                                onChange={(e) => togglePermAll(perm.id, e.target.checked)}
                                                                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                                                                            />
                                                                        </Tooltip>

                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                            <span style={{ fontWeight: 600, color: '#1E293B' }}>
                                                                                {perm.label}
                                                                            </span>
                                                                            <code style={{ fontSize: 11, color: '#334155', fontWeight: 600, background: '#F8FAFC', padding: '1px 5px', borderRadius: 4, border: '1px solid #CBD5E1', width: 'fit-content' }}>
                                                                                {perm.code}
                                                                            </code>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                {/* Các ô Toggle tương tác của từng nhóm */}
                                                                {(matrixData.roles || []).map((role) => {
                                                                    const checked = localMatrix[role.id]?.has(perm.id) ?? false;

                                                                    return (
                                                                        <td
                                                                            key={role.id}
                                                                            style={{
                                                                                padding: '8px 10px',
                                                                                textAlign: 'center',
                                                                                borderRight: '1px solid #F1F5F9',
                                                                            }}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleCell(role.id, perm.id)}
                                                                                title={`${role.name}: ${perm.label} (${checked ? 'Đang bật' : 'Đang tắt'})`}
                                                                                style={{
                                                                                    width: 32,
                                                                                    height: 32,
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    borderRadius: 8,
                                                                                    border: checked ? '1px solid #0F766E' : '1px solid #E2E8F0',
                                                                                    background: checked ? '#0F766E' : '#FFFFFF',
                                                                                    color: checked ? '#FFFFFF' : '#94A3B8',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.15s ease',
                                                                                    boxShadow: checked ? '0 1px 2px rgba(15, 118, 110, 0.25)' : 'none',
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    if (!checked) {
                                                                                        e.currentTarget.style.borderColor = '#0F766E';
                                                                                        e.currentTarget.style.color = '#0F766E';
                                                                                    }
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    if (!checked) {
                                                                                        e.currentTarget.style.borderColor = '#E2E8F0';
                                                                                        e.currentTarget.style.color = '#94A3B8';
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {checked ? (
                                                                                    <CheckOutlined style={{ fontSize: 14 }} />
                                                                                ) : (
                                                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />
                                                                                )}
                                                                            </button>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                </Spin>
                            </div>
                        ),
                    },
                    {
                        key: 'GROUPS',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                <UnorderedListOutlined />
                                Quản Lý Nhóm Quyền ({groups.length})
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 lg:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SafetyCertificateOutlined className="text-[#0F766E] text-lg" />
                                        <span className="text-sm font-semibold text-slate-800">
                                            Danh sách Nhóm quyền phân cấp
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        Tổng cộng: <b className="text-slate-800">{groups.length}</b> nhóm quyền
                                    </span>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                                    <Table
                                        dataSource={groups}
                                        rowKey="id"
                                        columns={groupColumns}
                                        loading={loading}
                                        pagination={false}
                                        size="middle"
                                        scroll={{ x: 1000 }}
                                    />
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'CATALOG',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                <BookOutlined />
                                Từ Điển Quyền Nguyên Tử ({allPermissions.length})
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 lg:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SlidersOutlined className="text-[#0F766E] text-lg" />
                                        <span className="text-sm font-semibold text-slate-800">
                                            Danh mục {allPermissions.length} Quyền nguyên tử được bảo vệ bởi RBAC Guards
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(permissionsByModule).map(([mod, perms]) => (
                                        <Card
                                            key={mod}
                                            size="small"
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Tag color={MODULE_COLORS[mod] || 'default'}>{mod}</Tag>
                                                    <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>{perms.length} quyền</span>
                                                </div>
                                            }
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {perms.map((p) => (
                                                    <div key={p.code} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1E293B' }}>{p.label}</div>
                                                        <code style={{ fontSize: 10.5, color: '#334155', fontWeight: 600, background: '#F8FAFC', padding: '1px 4px', borderRadius: 3, border: '1px solid #CBD5E1' }}>
                                                            {p.code}
                                                        </code>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ),
                    },
                ]}
            />

            {/* Modal Create/Edit Group */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SafetyCertificateOutlined className="text-teal-700" />
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
