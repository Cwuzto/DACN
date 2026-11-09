import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    Switch,
    Radio,
    Segmented,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
    SaveOutlined,
    CheckOutlined,
    SearchOutlined,
    AppstoreOutlined,
    SlidersOutlined,
    ExclamationCircleOutlined,
    UndoOutlined,
    UnorderedListOutlined,
    BookOutlined,
    DownOutlined,
    RightOutlined,
    FilterOutlined,
    InfoCircleOutlined,
    CheckCircleFilled,
} from '@ant-design/icons';
import permissionService from '../../services/permissionService';
import useAuthStore from '../../stores/authStore';
import {
    ACADEMIC_PROTECTED_PERMISSIONS,
    TECHNICAL_PERMISSIONS,
    CANONICAL_ALIAS_MAP,
    REVERSE_ALIAS_MAP,
    MODULE_COLORS,
    MODULE_TITLES,
    isAcademicProtected,
    isTechnical,
    isViewPermission,
    isActionPermission,
    isAliasPermission,
    getCanonicalCode,
    getAliasCode,
} from '../../config/permissionsConfig';

function PermissionGroupPage() {
    const currentUser = useAuthStore((state) => state.user);
    const canAssignAcademic = Boolean(currentUser?.permissions?.includes('PERMISSION_ASSIGN_ACADEMIC'));

    // Tab state
    const [activeTab, setActiveTab] = useState('MATRIX');

    // Matrix states
    const [matrixData, setMatrixData] = useState({ roles: [], modules: [], role_permissions: {} });
    const [localMatrix, setLocalMatrix] = useState({});
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [savingMatrix, setSavingMatrix] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Filters for Matrix
    const [matrixSearchText, setMatrixSearchText] = useState('');
    const [matrixModuleFilter, setMatrixModuleFilter] = useState('ALL');
    const [permTypeFilter, setPermTypeFilter] = useState('ALL'); // ALL | ACTION | VIEW
    const [protectionFilter, setProtectionFilter] = useState('ALL'); // ALL | PROTECTED | TECHNICAL
    const [groupAliases, setGroupAliases] = useState(true); // Gộp mã alias (khuyến nghị)

    // Accordion state: set of open module names
    const [openModules, setOpenModules] = useState(new Set());

    // CRUD Groups states
    const [groups, setGroups] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 1. Tải dữ liệu ma trận phân quyền
    const fetchMatrix = useCallback(async () => {
        setMatrixLoading(true);
        try {
            const res = await permissionService.getPermissionMatrix();
            if (!isMountedRef.current) return;
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

                // Mặc định mở tất cả các module
                const allMods = new Set((data.modules || []).map((m) => m.module_name));
                setOpenModules(allMods);
            }
        } catch (error) {
            if (!isMountedRef.current) return;
            message.error(error.message || 'Lỗi khi tải ma trận phân quyền');
        } finally {
            if (isMountedRef.current) setMatrixLoading(false);
        }
    }, []);

    // 2. Tải dữ liệu nhóm quyền & danh mục quyền (Lazy load khi đổi tab)
    const fetchGroupsData = useCallback(async () => {
        setLoading(true);
        try {
            const [groupsRes, permsRes] = await Promise.all([
                permissionService.listGroups(),
                permissionService.listPermissions(),
            ]);
            if (!isMountedRef.current) return;
            if (groupsRes.success) setGroups(groupsRes.data || []);
            if (permsRes.success) setAllPermissions(permsRes.data || []);
        } catch (error) {
            if (!isMountedRef.current) return;
            message.error(error.message || 'Lỗi khi tải danh sách nhóm quyền');
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'MATRIX') {
            fetchMatrix();
        } else if (activeTab === 'GROUPS' || activeTab === 'AUDIT' || activeTab === 'CATALOG') {
            fetchGroupsData();
        }
    }, [activeTab, fetchMatrix, fetchGroupsData]);

    // Map mã quyền sang đối tượng permission và ID
    const permCodeToIdMap = useMemo(() => {
        const map = new Map();
        (matrixData.modules || []).forEach((m) => {
            (m.permissions || []).forEach((p) => {
                map.set(p.code, p.id);
            });
        });
        return map;
    }, [matrixData.modules]);

    // Thao tác bật/tắt ô Ma trận (Toggle Cell) có đồng bộ alias tự động
    const toggleCell = (roleId, perm) => {
        // Kiểm tra quyền hạn an toàn
        if (!canAssignAcademic && isAcademicProtected(perm.code)) {
            message.warning(`Bạn không có quyền PERMISSION_ASSIGN_ACADEMIC để thay đổi quyền học thuật "${perm.code}".`);
            return;
        }

        const permId = perm.id;
        const aliasCode = getAliasCode(perm.code);
        const aliasId = aliasCode ? permCodeToIdMap.get(aliasCode) : null;

        setLocalMatrix((prev) => {
            const next = { ...prev };
            const currentSet = new Set(next[roleId] || []);
            const isCurrentlyChecked = currentSet.has(permId);

            if (isCurrentlyChecked) {
                currentSet.delete(permId);
                // Đồng bộ gỡ alias tương ứng nếu có
                if (aliasId) currentSet.delete(aliasId);
            } else {
                currentSet.add(permId);
                // Đồng bộ thêm alias tương ứng nếu có
                if (aliasId) currentSet.add(aliasId);
            }
            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác bật/tắt toàn bộ quyền cho 1 Role trong 1 Module cụ thể
    const toggleRoleInModule = (roleId, modulePerms, checked) => {
        const actionablePerms = modulePerms.filter((p) => {
            if (!canAssignAcademic && isAcademicProtected(p.code)) return false;
            return true;
        });

        if (actionablePerms.length === 0) {
            message.warning('Tất cả các quyền trong phân hệ này đều được bảo vệ học thuật và bạn không thể chỉnh sửa.');
            return;
        }

        setLocalMatrix((prev) => {
            const next = { ...prev };
            const currentSet = new Set(next[roleId] || []);

            actionablePerms.forEach((p) => {
                const aliasCode = getAliasCode(p.code);
                const aliasId = aliasCode ? permCodeToIdMap.get(aliasCode) : null;

                if (checked) {
                    currentSet.add(p.id);
                    if (aliasId) currentSet.add(aliasId);
                } else {
                    currentSet.delete(p.id);
                    if (aliasId) currentSet.delete(aliasId);
                }
            });

            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác bật/tắt toàn bộ quyền cho 1 Role trên toàn ma trận (Toggle Column)
    const toggleRoleAll = (roleId, allPerms, checked) => {
        const actionablePerms = allPerms.filter((p) => {
            if (!canAssignAcademic && isAcademicProtected(p.code)) return false;
            return true;
        });

        setLocalMatrix((prev) => {
            const next = { ...prev };
            const currentSet = new Set(next[roleId] || []);

            actionablePerms.forEach((p) => {
                const aliasCode = getAliasCode(p.code);
                const aliasId = aliasCode ? permCodeToIdMap.get(aliasCode) : null;

                if (checked) {
                    currentSet.add(p.id);
                    if (aliasId) currentSet.add(aliasId);
                } else {
                    currentSet.delete(p.id);
                    if (aliasId) currentSet.delete(aliasId);
                }
            });

            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác áp dụng 1 quyền cho toàn bộ Role (Toggle Row)
    const togglePermAll = (perm, checked) => {
        if (!canAssignAcademic && isAcademicProtected(perm.code)) {
            message.warning(`Bạn không có quyền PERMISSION_ASSIGN_ACADEMIC để thay đổi quyền học thuật "${perm.code}".`);
            return;
        }

        const permId = perm.id;
        const aliasCode = getAliasCode(perm.code);
        const aliasId = aliasCode ? permCodeToIdMap.get(aliasCode) : null;

        setLocalMatrix((prev) => {
            const next = { ...prev };
            (matrixData.roles || []).forEach((r) => {
                const currentSet = new Set(next[r.id] || []);
                if (checked) {
                    currentSet.add(permId);
                    if (aliasId) currentSet.add(aliasId);
                } else {
                    currentSet.delete(permId);
                    if (aliasId) currentSet.delete(aliasId);
                }
                next[r.id] = currentSet;
            });
            return next;
        });
        setDirty(true);
    };

    // Accordion Toggle Handlers
    const toggleModule = (moduleName) => {
        setOpenModules((prev) => {
            const next = new Set(prev);
            if (next.has(moduleName)) {
                next.delete(moduleName);
            } else {
                next.add(moduleName);
            }
            return next;
        });
    };

    const expandAllModules = () => {
        const all = new Set((matrixData.modules || []).map((m) => m.module_name));
        setOpenModules(all);
    };

    const collapseAllModules = () => {
        setOpenModules(new Set());
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

    // Danh sách tất cả quyền dạng phẳng
    const allFlatPermissions = useMemo(() => {
        const perms = [];
        (matrixData.modules || []).forEach((m) => {
            (m.permissions || []).forEach((p) => perms.push(p));
        });
        return perms;
    }, [matrixData.modules]);

    // Lọc quyền theo search, module, type (ACTION/VIEW), protection, và gộp alias
    const filteredModules = useMemo(() => {
        const query = matrixSearchText.trim().toLowerCase();

        return (matrixData.modules || [])
            .filter((mod) => matrixModuleFilter === 'ALL' || mod.module_name === matrixModuleFilter)
            .map((mod) => {
                const perms = (mod.permissions || []).filter((p) => {
                    // Nếu đang gộp alias: ẩn các quyền là alias
                    if (groupAliases && isAliasPermission(p.code)) {
                        return false;
                    }

                    // Lọc theo loại quyền: ACTION vs VIEW
                    if (permTypeFilter === 'ACTION' && !isActionPermission(p.code)) return false;
                    if (permTypeFilter === 'VIEW' && !isViewPermission(p.code)) return false;

                    // Lọc theo mức bảo vệ: PROTECTED vs TECHNICAL
                    if (protectionFilter === 'PROTECTED' && !isAcademicProtected(p.code)) return false;
                    if (protectionFilter === 'TECHNICAL' && !isTechnical(p.code)) return false;

                    // Lọc theo từ khóa tìm kiếm
                    if (query) {
                        const matchLabel = p.label?.toLowerCase().includes(query);
                        const matchCode = p.code?.toLowerCase().includes(query);
                        const matchModule = p.module?.toLowerCase().includes(query);
                        const aliasCode = getAliasCode(p.code);
                        const matchAlias = aliasCode ? aliasCode.toLowerCase().includes(query) : false;
                        if (!matchLabel && !matchCode && !matchModule && !matchAlias) return false;
                    }

                    return true;
                });
                return { ...mod, permissions: perms };
            })
            .filter((mod) => mod.permissions.length > 0);
    }, [matrixData.modules, matrixSearchText, matrixModuleFilter, permTypeFilter, protectionFilter, groupAliases]);

    // Thống kê động tự động sinh từ Registry
    const matrixStats = useMemo(() => {
        const totalRoles = matrixData.roles?.length || 0;
        const totalPerms = allFlatPermissions.length;

        let actionPerms = 0;
        let viewPerms = 0;
        let protectedPerms = 0;
        let technicalPerms = 0;
        let aliasPerms = 0;

        allFlatPermissions.forEach((p) => {
            if (isViewPermission(p.code)) viewPerms += 1;
            else actionPerms += 1;

            if (isAcademicProtected(p.code)) protectedPerms += 1;
            if (isTechnical(p.code)) technicalPerms += 1;
            if (isAliasPermission(p.code)) aliasPerms += 1;
        });

        const canonicalPerms = totalPerms - aliasPerms;

        let activeAssignments = 0;
        Object.values(localMatrix).forEach((set) => {
            activeAssignments += set?.size || 0;
        });

        return {
            totalRoles,
            totalPerms,
            canonicalPerms,
            aliasPerms,
            actionPerms,
            viewPerms,
            protectedPerms,
            technicalPerms,
            totalModules: matrixData.modules?.length || 0,
            activeAssignments,
        };
    }, [matrixData, localMatrix, allFlatPermissions]);

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
                            const isProt = isAcademicProtected(code);
                            return (
                                <Tag
                                    key={code}
                                    color={isProt ? 'volcano' : MODULE_COLORS[mod] || 'default'}
                                    className="text-[10px] font-mono m-0"
                                >
                                    {isProt && <LockOutlined className="mr-1 text-[9px]" />}
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
                    <div className="flex items-center gap-2 mt-1">
                        <Tag color={canAssignAcademic ? 'green' : 'gold'} className="m-0 text-xs">
                            {canAssignAcademic ? '🛡️ Có thẩm quyền học thuật' : '⚙️ Quản trị viên kỹ thuật'}
                        </Tag>
                        <span className="text-xs text-slate-500">
                            {canAssignAcademic
                                ? 'Bạn có thể chỉnh sửa toàn bộ quyền học thuật và kỹ thuật.'
                                : 'Các quyền học thuật được bảo vệ được khóa tự động để tránh lỗi leo thang quyền.'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            if (activeTab === 'MATRIX') {
                                fetchMatrix();
                            } else {
                                fetchGroupsData();
                            }
                        }}
                    >
                        Làm mới
                    </Button>
                    {activeTab === 'MATRIX' && (
                        <>
                            <Button onClick={expandAllModules}>
                                Mở tất cả
                            </Button>
                            <Button onClick={collapseAllModules}>
                                Thu gọn tất cả
                            </Button>
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

            {/* 4 KPI Cards (Thống kê ma trận & quyền tự động sinh từ registry) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng số vai trò</span>
                    <p className="h2 num" style={{ marginTop: 2, color: '#0F766E' }}>{matrixStats.totalRoles}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        {matrixStats.totalModules} phân hệ nghiệp vụ
                    </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng quyền chuẩn hóa</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                        <p className="h2 num" style={{ color: '#0F172A' }}>{matrixStats.canonicalPerms}</p>
                        <span className="text-xs text-slate-500 font-mono">
                            (+{matrixStats.aliasPerms} alias)
                        </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        Tổng catalog: <b>{matrixStats.totalPerms}</b> mã kiểm soát
                    </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Phân loại năng lực quyền</span>
                    <div className="flex items-center gap-2 mt-1">
                        <Tag color="blue" className="text-xs font-semibold m-0">
                            ⚡ {matrixStats.actionPerms} Thao tác
                        </Tag>
                        <Tag color="cyan" className="text-xs font-semibold m-0">
                            👁️ {matrixStats.viewPerms} Xem trang
                        </Tag>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        Phân tách rạch ròi theo 2-Tier Architecture
                    </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Cơ chế Bảo vệ Chống Vượt quyền</span>
                    <div className="flex items-center gap-2 mt-1">
                        <Tag color="volcano" className="text-xs font-semibold m-0">
                            🛡️ {matrixStats.protectedPerms} Học thuật
                        </Tag>
                        <Tag color="default" className="text-xs font-semibold m-0">
                            ⚙️ {matrixStats.technicalPerms} Kỹ thuật
                        </Tag>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        {matrixStats.activeAssignments} ô tích phân quyền đang kích hoạt
                    </div>
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
                                <b>Bạn có thay đổi chưa lưu trên ma trận phân quyền!</b> Vui lòng bấm <b>"Lưu Ma Trận"</b> để cập nhật vào hệ thống.
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
                                {/* Toolbar Lọc Đa Chiều & Tìm kiếm */}
                                <div className="flex flex-col gap-3 pb-2 border-b border-slate-200">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Input
                                                placeholder="Tìm kiếm theo mã quyền, tên chức năng..."
                                                prefix={<SearchOutlined className="text-slate-400" />}
                                                style={{ width: 300 }}
                                                value={matrixSearchText}
                                                onChange={(e) => setMatrixSearchText(e.target.value)}
                                                allowClear
                                            />
                                            <Select
                                                value={matrixModuleFilter}
                                                onChange={setMatrixModuleFilter}
                                                style={{ width: 230 }}
                                                options={[
                                                    { label: 'Tất cả phân hệ chức năng', value: 'ALL' },
                                                    ...(matrixData.modules || []).map((m) => ({
                                                        label: `[${m.module_name}] ${MODULE_TITLES[m.module_name] || m.module_name}`,
                                                        value: m.module_name,
                                                    })),
                                                ]}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 font-medium">Gộp mã alias (khuyến nghị):</span>
                                            <Switch
                                                checked={groupAliases}
                                                onChange={setGroupAliases}
                                                checkedChildren="Gộp"
                                                unCheckedChildren="Tách"
                                            />
                                        </div>
                                    </div>

                                    {/* Hàng bộ lọc phân loại quyền & bảo vệ */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 font-medium">Loại quyền:</span>
                                                <Segmented
                                                    size="small"
                                                    value={permTypeFilter}
                                                    onChange={setPermTypeFilter}
                                                    options={[
                                                        { label: 'Tất cả', value: 'ALL' },
                                                        { label: `⚡ Thao tác (${matrixStats.actionPerms})`, value: 'ACTION' },
                                                        { label: `👁️ Xem trang (${groupAliases ? matrixStats.viewPerms - matrixStats.aliasPerms : matrixStats.viewPerms})`, value: 'VIEW' },
                                                    ]}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 font-medium">Cơ chế bảo vệ:</span>
                                                <Segmented
                                                    size="small"
                                                    value={protectionFilter}
                                                    onChange={setProtectionFilter}
                                                    options={[
                                                        { label: 'Tất cả', value: 'ALL' },
                                                        { label: `🛡️ Học thuật (${matrixStats.protectedPerms})`, value: 'PROTECTED' },
                                                        { label: `⚙️ Kỹ thuật (${matrixStats.technicalPerms})`, value: 'TECHNICAL' },
                                                    ]}
                                                />
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-500">
                                            Hiển thị <b>{filteredModules.reduce((sum, m) => sum + m.permissions.length, 0)}</b> quyền trong <b>{filteredModules.length}</b> phân hệ
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Modules List */}
                                <Spin spinning={matrixLoading}>
                                    <div className="flex flex-col gap-3">
                                        {filteredModules.map((mod) => {
                                            const isOpen = openModules.has(mod.module_name);
                                            const modPerms = mod.permissions || [];

                                            return (
                                                <div
                                                    key={mod.module_name}
                                                    className="border border-slate-200 rounded-lg overflow-hidden transition-all shadow-xs"
                                                >
                                                    {/* Header của Module Accordion */}
                                                    <div
                                                        className="flex items-center justify-between px-4 py-3 bg-slate-50/90 hover:bg-slate-100/90 cursor-pointer select-none border-b border-slate-200/80 transition-colors"
                                                        onClick={() => toggleModule(mod.module_name)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-400 text-xs">
                                                                {isOpen ? <DownOutlined /> : <RightOutlined />}
                                                            </span>
                                                            <Tag
                                                                color={MODULE_COLORS[mod.module_name] || 'default'}
                                                                className="m-0 font-mono font-semibold text-xs px-2 py-0.5"
                                                            >
                                                                {mod.module_name}
                                                            </Tag>
                                                            <span className="font-bold text-slate-800 text-sm">
                                                                {MODULE_TITLES[mod.module_name] || mod.module_name}
                                                            </span>
                                                            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                                                {modPerms.length} quyền
                                                            </span>
                                                        </div>

                                                        {/* Thống kê quyền theo từng Role trong Module này */}
                                                        <div
                                                            className="flex items-center gap-3"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="hidden md:flex items-center gap-2">
                                                                {(matrixData.roles || []).map((role) => {
                                                                    const rolePerms = localMatrix[role.id] || new Set();
                                                                    const countGranted = modPerms.filter((p) => rolePerms.has(p.id)).length;
                                                                    const isFull = modPerms.length > 0 && countGranted === modPerms.length;

                                                                    return (
                                                                        <Tooltip
                                                                            key={role.id}
                                                                            title={`${role.name}: Có ${countGranted}/${modPerms.length} quyền trong phân hệ này. Bấm để bật/tắt toàn bộ.`}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleRoleInModule(role.id, modPerms, !isFull)}
                                                                                className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-all ${
                                                                                    isFull
                                                                                        ? 'bg-teal-50 border-teal-500 text-teal-800 font-bold'
                                                                                        : countGranted > 0
                                                                                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                                                        : 'bg-white border-slate-200 text-slate-400'
                                                                                }`}
                                                                            >
                                                                                {role.code}: {countGranted}/{modPerms.length}
                                                                            </button>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Nội dung bảng phân quyền của Module khi Mở rộng */}
                                                    {isOpen && (
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                                <thead>
                                                                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                                        {/* Cột trái: Tên quyền & Mã */}
                                                                        <th
                                                                            style={{
                                                                                position: 'sticky',
                                                                                left: 0,
                                                                                zIndex: 20,
                                                                                background: '#F8FAFC',
                                                                                padding: '10px 16px',
                                                                                textAlign: 'left',
                                                                                width: 380,
                                                                                minWidth: 320,
                                                                                borderRight: '1px solid #E2E8F0',
                                                                            }}
                                                                        >
                                                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                                                                CHỨC NĂNG &amp; NĂNG LỰC
                                                                            </span>
                                                                        </th>

                                                                        {/* Các cột Role */}
                                                                        {(matrixData.roles || []).map((role) => (
                                                                            <th
                                                                                key={role.id}
                                                                                style={{
                                                                                    padding: '10px 12px',
                                                                                    textAlign: 'center',
                                                                                    minWidth: 130,
                                                                                    borderRight: '1px solid #E2E8F0',
                                                                                    fontSize: 12,
                                                                                    color: '#0F172A',
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            >
                                                                                <div className="flex flex-col items-center">
                                                                                    <span>{role.name}</span>
                                                                                    <code className="text-[10px] text-slate-500 font-mono">
                                                                                        {role.code}
                                                                                    </code>
                                                                                </div>
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>

                                                                <tbody>
                                                                    {modPerms.map((perm) => {
                                                                        const isProt = isAcademicProtected(perm.code);
                                                                        const isAct = isActionPermission(perm.code);
                                                                        const aliasCode = getAliasCode(perm.code);
                                                                        const isAliasRow = isAliasPermission(perm.code);

                                                                        const allRolesHave = (matrixData.roles || []).length > 0 &&
                                                                            (matrixData.roles || []).every((r) => localMatrix[r.id]?.has(perm.id));

                                                                        return (
                                                                            <tr
                                                                                key={perm.id}
                                                                                style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s' }}
                                                                                className="hover:bg-teal-50/40"
                                                                            >
                                                                                {/* Cột trái: Tên quyền & Mã code */}
                                                                                <td
                                                                                    style={{
                                                                                        position: 'sticky',
                                                                                        left: 0,
                                                                                        zIndex: 10,
                                                                                        background: '#FFFFFF',
                                                                                        padding: '9px 16px',
                                                                                        borderRight: '1px solid #E2E8F0',
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-start gap-2.5">
                                                                                        {/* Checkbox áp dụng cho tất cả nhóm */}
                                                                                        <Tooltip title="Áp dụng quyền này cho tất cả nhóm vai trò">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={allRolesHave}
                                                                                                onChange={(e) => togglePermAll(perm, e.target.checked)}
                                                                                                disabled={!canAssignAcademic && isProt}
                                                                                                style={{
                                                                                                    cursor: (!canAssignAcademic && isProt) ? 'not-allowed' : 'pointer',
                                                                                                    width: 15,
                                                                                                    height: 15,
                                                                                                    marginTop: 3,
                                                                                                }}
                                                                                            />
                                                                                        </Tooltip>

                                                                                        <div className="flex flex-col gap-1">
                                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                                <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 13 }}>
                                                                                                    {perm.label}
                                                                                                </span>
                                                                                                {isProt && (
                                                                                                    <Tooltip title="Quyền học thuật được bảo vệ chống leo thang đặc quyền. Quản trị viên kỹ thuật không thể sửa đổi nếu thiếu thẩm quyền.">
                                                                                                        <Tag color="volcano" className="text-[10px] m-0 font-medium px-1.5 py-0 flex items-center gap-1">
                                                                                                            <LockOutlined className="text-[9px]" />
                                                                                                            Học thuật bảo vệ
                                                                                                        </Tag>
                                                                                                    </Tooltip>
                                                                                                )}
                                                                                                {isAct ? (
                                                                                                    <Tag color="blue" className="text-[10px] m-0 px-1 py-0">
                                                                                                        ⚡ Action
                                                                                                    </Tag>
                                                                                                ) : (
                                                                                                    <Tag color="cyan" className="text-[10px] m-0 px-1 py-0">
                                                                                                        👁️ View
                                                                                                    </Tag>
                                                                                                )}
                                                                                            </div>

                                                                                            <div className="flex items-center gap-2">
                                                                                                <code style={{ fontSize: 11, color: '#334155', fontWeight: 600, background: '#F8FAFC', padding: '1px 5px', borderRadius: 4, border: '1px solid #CBD5E1' }}>
                                                                                                    {perm.code}
                                                                                                </code>
                                                                                                {aliasCode && (
                                                                                                    <Tooltip title="Mã alias tương thích ngược — hệ thống tự động đồng bộ khi bạn cấp quyền này">
                                                                                                        <span className="text-[10.5px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                                                                                            + alias: {aliasCode}
                                                                                                        </span>
                                                                                                    </Tooltip>
                                                                                                )}
                                                                                                {isAliasRow && (
                                                                                                    <span className="text-[10px] text-slate-400 italic">
                                                                                                        (Mã alias tương thích)
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>

                                                                                {/* Các ô Toggle tương tác của từng Role */}
                                                                                {(matrixData.roles || []).map((role) => {
                                                                                    const checked = localMatrix[role.id]?.has(perm.id) ?? false;
                                                                                    const isCellDisabled = !canAssignAcademic && isProt;

                                                                                    return (
                                                                                        <td
                                                                                            key={role.id}
                                                                                            style={{
                                                                                                padding: '7px 10px',
                                                                                                textAlign: 'center',
                                                                                                borderRight: '1px solid #F1F5F9',
                                                                                            }}
                                                                                        >
                                                                                            <Tooltip
                                                                                                title={
                                                                                                    isCellDisabled
                                                                                                        ? `Bị khóa: ${perm.code} là quyền học thuật được bảo vệ. Cần có quyền PERMISSION_ASSIGN_ACADEMIC.`
                                                                                                        : `${role.name}: ${perm.label} (${checked ? 'Đang cấp' : 'Chưa cấp'})`
                                                                                                }
                                                                                            >
                                                                                                <button
                                                                                                    type="button"
                                                                                                    disabled={isCellDisabled}
                                                                                                    onClick={() => toggleCell(role.id, perm)}
                                                                                                    style={{
                                                                                                        width: 32,
                                                                                                        height: 32,
                                                                                                        display: 'inline-flex',
                                                                                                        alignItems: 'center',
                                                                                                        justifyContent: 'center',
                                                                                                        borderRadius: 8,
                                                                                                        border: checked ? '1px solid #0F766E' : '1px solid #E2E8F0',
                                                                                                        background: checked ? '#0F766E' : isCellDisabled ? '#F1F5F9' : '#FFFFFF',
                                                                                                        color: checked ? '#FFFFFF' : '#94A3B8',
                                                                                                        cursor: isCellDisabled ? 'not-allowed' : 'pointer',
                                                                                                        opacity: isCellDisabled ? 0.75 : 1,
                                                                                                        transition: 'all 0.15s ease',
                                                                                                        boxShadow: checked ? '0 1px 2px rgba(15, 118, 110, 0.25)' : 'none',
                                                                                                    }}
                                                                                                >
                                                                                                    {checked ? (
                                                                                                        <CheckOutlined style={{ fontSize: 14 }} />
                                                                                                    ) : isCellDisabled ? (
                                                                                                        <LockOutlined style={{ fontSize: 11, color: '#94A3B8' }} />
                                                                                                    ) : (
                                                                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />
                                                                                                    )}
                                                                                                </button>
                                                                                            </Tooltip>
                                                                                        </td>
                                                                                    );
                                                                                })}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                                                {perms.map((p) => {
                                                    const isProt = isAcademicProtected(p.code);
                                                    const isAct = isActionPermission(p.code);
                                                    const alias = getAliasCode(p.code);

                                                    return (
                                                        <div key={p.code} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#1E293B' }}>{p.label}</span>
                                                                <div className="flex items-center gap-1">
                                                                    {isProt && (
                                                                        <Tag color="volcano" className="text-[9px] m-0 px-1 py-0">
                                                                            🛡️ Bảo vệ
                                                                        </Tag>
                                                                    )}
                                                                    {isAct ? (
                                                                        <Tag color="blue" className="text-[9px] m-0 px-1 py-0">
                                                                            ⚡ Action
                                                                        </Tag>
                                                                    ) : (
                                                                        <Tag color="cyan" className="text-[9px] m-0 px-1 py-0">
                                                                            👁️ View
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <code style={{ fontSize: 10.5, color: '#334155', fontWeight: 600, background: '#F8FAFC', padding: '1px 4px', borderRadius: 3, border: '1px solid #CBD5E1' }}>
                                                                    {p.code}
                                                                </code>
                                                                {alias && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        (alias: {alias})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
                            label="Mã nhóm quyền"
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
                                    {perms.map((p) => {
                                        const isProt = isAcademicProtected(p.code);
                                        const disabled = !canAssignAcademic && isProt;

                                        return (
                                            <Select.Option
                                                key={p.code}
                                                value={p.code}
                                                disabled={disabled}
                                                label={`${p.code} ${p.label}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Tag color={MODULE_COLORS[module] || 'default'} className="text-[10px] m-0">
                                                        {module}
                                                    </Tag>
                                                    <span className="font-mono text-xs font-semibold">{p.code}</span>
                                                    <span className="text-xs text-slate-500">— {p.label}</span>
                                                    {isProt && (
                                                        <Tag color="volcano" className="text-[9px] m-0 ml-auto">
                                                            🛡️ Bảo vệ
                                                        </Tag>
                                                    )}
                                                </div>
                                            </Select.Option>
                                        );
                                    })}
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
