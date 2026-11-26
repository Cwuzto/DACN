import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from '@ant-design/icons';
import { usePermissionMatrix, usePermissionGroups, usePermissionCatalog, usePermissionMutation } from '../../queries/permissionQueries';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import EmptyState from '../../components/common/EmptyState';
import AuthorizedAction from '../../components/common/AuthorizedAction';
import PageHeader from '../../components/common/PageHeader';
import { canPerformFeatureAction } from '../../auth/policyEvaluator';
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
    isStudentPermission,
} from '../../config/permissionsConfig';

function PermissionGroupPage() {
    const currentUser = useAuthStore((state) => state.user);
    const canAssignAcademic = Boolean(currentUser?.permissions?.includes('PERMISSION_ASSIGN_ACADEMIC'));

    // Tab state
    const [activeTab, setActiveTab] = useState('MATRIX');

    // Matrix states
    const scope = queryKeys.scope(currentUser);
    const matrixQuery = usePermissionMatrix(scope, activeTab === 'MATRIX');
    const matrixData = useMemo(() => {
        const raw = matrixQuery.data || { roles: [], modules: [], role_permissions: {} };
        const filteredRoles = (raw.roles || []).filter(
            (r) => r.code !== 'SYSTEM_STUDENT_BASE' && r.code !== 'STUDENT'
        );
        const filteredModules = (raw.modules || [])
            .filter((m) => m.module_name !== 'STUDENT')
            .map((m) => ({
                ...m,
                permissions: (m.permissions || []).filter((p) => !isStudentPermission(p.code)),
            }))
            .filter((m) => m.permissions.length > 0);

        return {
            ...raw,
            roles: filteredRoles,
            modules: filteredModules,
        };
    }, [matrixQuery.data]);
    const permissionMutation = usePermissionMutation(scope);
    const [localMatrix, setLocalMatrix] = useState({});
    const [savingMatrix, setSavingMatrix] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Filters for Matrix
    const [matrixSearchText, setMatrixSearchText] = useState('');
    const [matrixModuleFilter, setMatrixModuleFilter] = useState('ALL');
    const [permTypeFilter, setPermTypeFilter] = useState('ALL'); // ALL | ACTION | VIEW
    const [protectionFilter, setProtectionFilter] = useState('ALL'); // ALL | PROTECTED | TECHNICAL
    const [groupAliases] = useState(true); // Gộp mã tương thích ngầm định

    // Accordion state: set of open module names
    const [openModules, setOpenModules] = useState(new Set());

    // CRUD Groups states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const groupsQuery = usePermissionGroups(scope, activeTab === 'GROUPS' || activeTab === 'AUDIT');
    const catalogQuery = usePermissionCatalog(scope, activeTab === 'CATALOG' || activeTab === 'AUDIT' || isModalOpen);
    const groups = useMemo(() => {
        return (groupsQuery.data || []).filter(
            (g) => g.code !== 'SYSTEM_STUDENT_BASE' && g.code !== 'STUDENT'
        );
    }, [groupsQuery.data]);
    const allPermissions = useMemo(() => {
        return (catalogQuery.data || []).filter(
            (p) => p.module !== 'STUDENT' && !isStudentPermission(p.code)
        );
    }, [catalogQuery.data]);
    const appliedMatrixRef = useRef(null);
    const openedModulesRef = useRef(false);

    useEffect(() => {
        const data = matrixQuery.data;
        if (!data || dirty || appliedMatrixRef.current === data) return;
        const local = {};
        (data.roles || []).forEach(role => {
            local[role.id] = new Set(data.role_permissions?.[String(role.id)] || []);
        });
        setLocalMatrix(local);
        appliedMatrixRef.current = data;
        if (!openedModulesRef.current) {
            setOpenModules(new Set((data.modules || []).map(module => module.module_name)));
            openedModulesRef.current = true;
        }
    }, [matrixQuery.data, dirty]);

    const fetchMatrix = () => matrixQuery.refetch();
    const fetchGroupsData = () => {
        if (activeTab === 'GROUPS' || activeTab === 'AUDIT') groupsQuery.refetch();
        if (activeTab === 'CATALOG' || activeTab === 'AUDIT') catalogQuery.refetch();
    };

    const permCodeToIdMap = useMemo(() => {
        const map = new Map();
        (matrixData.modules || []).forEach((m) => {
            (m.permissions || []).forEach((p) => {
                map.set(p.code, p.id);
            });
        });
        return map;
    }, [matrixData.modules]);

    // Thao tác bật/tắt ô phân quyền (Toggle Cell) có đồng bộ mã tương thích tự động
    const toggleCell = (roleId, perm) => {
        // Kiểm tra thẩm quyền điều chỉnh chức năng học vụ
        if (!canAssignAcademic && isAcademicProtected(perm.code)) {
            message.warning(`Chức năng "${perm.label}" thuộc quy chế chuyên môn học vụ. Bạn cần thẩm quyền quản lý học vụ để điều chỉnh.`);
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
                if (aliasId) currentSet.delete(aliasId);
            } else {
                currentSet.add(permId);
                if (aliasId) currentSet.add(aliasId);
            }
            next[roleId] = currentSet;
            return next;
        });
        setDirty(true);
    };

    // Thao tác bật/tắt toàn bộ quyền cho 1 Role trong 1 Lĩnh vực cụ thể
    const toggleRoleInModule = (roleId, modulePerms, checked) => {
        const actionablePerms = modulePerms.filter((p) => {
            if (!canAssignAcademic && isAcademicProtected(p.code)) return false;
            return true;
        });

        if (actionablePerms.length === 0) {
            message.warning('Tất cả các chức năng trong lĩnh vực này thuộc quy chế học vụ bảo vệ nên bạn chưa thể điều chỉnh.');
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

    // Thao tác áp dụng 1 quyền cho toàn bộ Role (Toggle Row)
    const togglePermAll = (perm, checked) => {
        if (!canAssignAcademic && isAcademicProtected(perm.code)) {
            message.warning(`Chức năng "${perm.label}" thuộc quy chế chuyên môn học vụ. Bạn cần thẩm quyền quản lý học vụ để điều chỉnh.`);
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
        message.info('Đã khôi phục bảng phân quyền về trạng thái lưu gần nhất.');
    };

    // Lưu hàng loạt ma trận phân quyền
    const handleSaveMatrix = async () => {
        if (!matrixQuery.data) return;
        try {
            setSavingMatrix(true);
            const payload = (matrixData.roles || []).map((role) => ({
                role_id: role.id,
                permission_ids: Array.from(localMatrix[role.id] || []),
            }));

            const res = await permissionMutation.mutateAsync({ action: 'matrix', data: payload });
            if (res.success) {
                message.success(res.message || 'Lưu bảng phân quyền thành công!');
                setDirty(false);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi lưu bảng phân quyền');
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

    // Lọc quyền theo search, module, loại chức năng và phân loại quy chế
    const filteredModules = useMemo(() => {
        const query = matrixSearchText.trim().toLowerCase();

        return (matrixData.modules || [])
            .filter((mod) => matrixModuleFilter === 'ALL' || mod.module_name === matrixModuleFilter)
            .map((mod) => {
                const perms = (mod.permissions || []).filter((p) => {
                    if (groupAliases && isAliasPermission(p.code)) {
                        return false;
                    }

                    if (permTypeFilter === 'ACTION' && !isActionPermission(p.code)) return false;
                    if (permTypeFilter === 'VIEW' && !isViewPermission(p.code)) return false;

                    if (protectionFilter === 'PROTECTED' && !isAcademicProtected(p.code)) return false;
                    if (protectionFilter === 'TECHNICAL' && !isTechnical(p.code)) return false;

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

    // Thống kê phân bổ chức năng và vai trò
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
            const res = await permissionMutation.mutateAsync({ action: 'delete', id: record.id });
            if (res.success) {
                message.success(res.message || 'Đã xóa nhóm vai trò thành công');
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi xóa nhóm vai trò');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingGroup) {
                const res = await permissionMutation.mutateAsync({ action: 'update', id: editingGroup.id, data: {
                    name: values.name,
                    description: values.description,
                    permissionCodes: values.permissionCodes || [],
                } });
                if (res.success) {
                    message.success(res.message || 'Cập nhật nhóm vai trò thành công');
                    setIsModalOpen(false);
                }
            } else {
                const res = await permissionMutation.mutateAsync({ action: 'create', data: {
                    code: values.code,
                    name: values.name,
                    description: values.description,
                    permissionCodes: values.permissionCodes || [],
                } });
                if (res.success) {
                    message.success(res.message || 'Tạo nhóm vai trò thành công');
                    setIsModalOpen(false);
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
            title: 'Tên nhóm vai trò',
            dataIndex: 'name',
            key: 'name',
            width: 250,
            render: (name, record) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        {record.isSystem && (
                            <Tooltip title="Vai trò mặc định của hệ thống — Không thể xóa">
                                <LockOutlined className="text-amber-600 text-xs" />
                            </Tooltip>
                        )}
                        <span className="font-bold text-slate-900 text-sm">{name}</span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 w-fit">
                        {record.code}
                    </span>
                </div>
            ),
        },
        {
            title: 'Phạm vi công tác & Trách nhiệm',
            dataIndex: 'description',
            key: 'description',
            width: 280,
            render: (desc) => <span className="text-xs text-slate-700 font-medium">{desc || 'Chưa thiết lập mô tả'}</span>,
        },
        {
            title: 'Số chức năng',
            key: 'permCount',
            width: 120,
            align: 'center',
            render: (_, record) => (
                <Badge
                    count={record.permissions?.length || 0}
                    style={{ backgroundColor: '#0F766E', fontWeight: 700 }}
                    showZero
                />
            ),
        },
        {
            title: 'Nhân sự đảm nhiệm',
            key: 'userCount',
            width: 150,
            align: 'center',
            render: (_, record) => (
                <span className="text-xs font-bold text-slate-800 bg-slate-200/90 border border-slate-300 px-2.5 py-1 rounded-full">
                    {record._count?.users ?? 0} cán bộ
                </span>
            ),
        },
        {
            title: 'Chức năng tiêu biểu',
            key: 'permissions',
            render: (_, record) => {
                const perms = record.permissions || [];
                const visible = perms.slice(0, 3);
                const remaining = perms.length - visible.length;
                return (
                    <div className="flex flex-wrap gap-1">
                        {visible.map((p) => {
                            const label = p.permission?.label || p.label || p.permission?.code || p.code;
                            const code = p.permission?.code || p.code;
                            const isProt = isAcademicProtected(code);
                            return (
                                <Tag
                                    key={code}
                                    color={isProt ? 'volcano' : 'default'}
                                    className={`text-[11px] m-0 font-medium border ${isProt ? 'border-red-300' : 'border-slate-300 text-slate-800'}`}
                                >
                                    {isProt && <LockOutlined className="mr-1 text-[9px]" />}
                                    {label}
                                </Tag>
                            );
                        })}
                        {remaining > 0 && (
                            <Tooltip
                                title={perms.slice(3).map((p) => p.permission?.label || p.label || p.permission?.code || p.code).join(', ')}
                            >
                                <Tag className="text-[11px] m-0 cursor-pointer bg-slate-200 text-slate-800 border border-slate-300 font-bold">
                                    +{remaining} chức năng khác
                                </Tag>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        ...(canPerformFeatureAction(currentUser, 'permissions', 'manageGroups')
            ? [
                {
                    title: 'Thao tác',
                    key: 'actions',
                    width: 100,
                    align: 'right',
                    render: (_, record) => (
                        <Space size="small">
                            <Tooltip title="Chỉnh sửa nhóm vai trò">
                                <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEdit(record)}
                                />
                            </Tooltip>
                            {!record.isSystem && (
                                <Popconfirm
                                    title="Xác nhận xóa nhóm vai trò?"
                                    description={`Nhóm "${record.name}" sẽ bị gỡ bỏ khỏi hệ thống.`}
                                    okText="Xóa nhóm"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => handleDelete(record)}
                                >
                                    <Tooltip title="Xóa nhóm vai trò">
                                        <Button size="small" icon={<DeleteOutlined />} danger />
                                    </Tooltip>
                                </Popconfirm>
                            )}
                        </Space>
                    ),
                },
            ]
            : []),
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={<SafetyCertificateOutlined />}
                accent="rose"
                title="Phân quyền & Vai trò Người dùng"
                subtitle={
                    canAssignAcademic
                        ? 'Bạn có thẩm quyền phân bổ đầy đủ chức năng chuyên môn học thuật và vận hành hệ thống.'
                        : 'Các chức năng chuyên môn học vụ được bảo vệ bởi quy chế đào tạo để đảm bảo an toàn học thuật.'
                }
                badge={
                    canAssignAcademic ? (
                        <Tag color="success" icon={<SafetyCertificateOutlined />} className="m-0 text-xs font-semibold">
                            Được ủy quyền điều chỉnh chức năng học vụ
                        </Tag>
                    ) : (
                        <Tag color="warning" icon={<LockOutlined />} className="m-0 text-xs font-semibold">
                            Phân quyền quản trị vận hành
                        </Tag>
                    )
                }
                actions={
                    <>
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
                                {dirty && (
                                    <Button
                                        icon={<UndoOutlined />}
                                        onClick={handleResetMatrix}
                                    >
                                        Khôi phục
                                    </Button>
                                )}
                                <AuthorizedAction feature="permissions" action="manageGroups">
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        loading={savingMatrix}
                                        disabled={!matrixQuery.data}
                                        onClick={handleSaveMatrix}
                                    >
                                        {dirty ? 'Lưu thay đổi (*)' : 'Lưu thay đổi'}
                                    </Button>
                                </AuthorizedAction>
                            </>
                        )}
                        {activeTab === 'GROUPS' && (
                            <AuthorizedAction feature="permissions" action="manageGroups">
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleAdd}
                                >
                                    Tạo nhóm vai trò mới
                                </Button>
                            </AuthorizedAction>
                        )}
                    </>
                }
            />

            {/* Thẻ thống kê tổng quan phân quyền */}
            {matrixQuery.data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-teal-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vị trí &amp; Nhóm vai trò</div>
                    <div className="text-2xl font-extrabold text-teal-700 mt-1 tabular-nums">{matrixStats.totalRoles}</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                        Phân bổ trên <b className="text-slate-800 font-semibold">{matrixStats.totalModules}</b> lĩnh vực nghiệp vụ
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-indigo-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chức năng học vụ chuyên môn</div>
                    <div className="text-2xl font-extrabold text-indigo-700 mt-1 tabular-nums">{matrixStats.protectedPerms}</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                        Đề tài, xét duyệt đề cương, tiến độ BM03, chấm bảo vệ
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-sky-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chức năng quản trị vận hành</div>
                    <div className="text-2xl font-extrabold text-sky-700 mt-1 tabular-nums">{matrixStats.technicalPerms}</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                        Đợt đồ án, tài khoản cán bộ, thông báo và báo cáo
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quyền đang áp dụng</div>
                    <div className="text-2xl font-extrabold text-rose-700 mt-1 tabular-nums">{matrixStats.activeAssignments}</div>
                    <div className="text-xs text-slate-500 mt-1.5">
                        Lượt phân quyền đang kích hoạt cho các vị trí công tác
                    </div>
                </div>
            </div>
            )}

            {/* Cảnh báo thay đổi chưa lưu trên bảng phân quyền */}
            {dirty && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined className="text-amber-600 text-lg" />}
                    className="border-amber-400 bg-amber-50"
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span className="text-slate-900 font-medium">
                                <b className="text-amber-900 font-bold">Bạn có thay đổi chưa lưu trên bảng phân quyền!</b> Vui lòng bấm <b>"Lưu thay đổi"</b> để cập nhật vào hệ thống.
                            </span>
                            <Space size="small">
                                <Button size="small" onClick={handleResetMatrix}>Hủy thay đổi</Button>
                                <AuthorizedAction feature="permissions" action="manageGroups">
                                    <Button
                                        size="small"
                                        type="primary"
                                        loading={savingMatrix}
                                        onClick={handleSaveMatrix}
                                        style={{ background: '#0F766E', borderColor: '#0F766E', fontWeight: 700 }}
                                    >
                                        Lưu thay đổi
                                    </Button>
                                </AuthorizedAction>
                            </Space>
                        </div>
                    }
                />
            )}

            {/* Các thẻ nội dung phân quyền */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                type="card"
                className="permission-tabs"
                items={[
                    {
                        key: 'MATRIX',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <AppstoreOutlined />
                                Bảng Phân Quyền Theo Vai Trò
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 lg:p-6 space-y-4">
                                {/* Thanh công cụ tìm kiếm và lọc chức năng */}
                                <div className="flex flex-col gap-3 pb-3 border-b border-slate-300">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Input
                                                placeholder="Tìm kiếm theo tên chức năng, nhiệm vụ..."
                                                prefix={<SearchOutlined className="text-slate-500" />}
                                                style={{ width: 320 }}
                                                value={matrixSearchText}
                                                onChange={(e) => setMatrixSearchText(e.target.value)}
                                                allowClear
                                            />
                                            <Select
                                                value={matrixModuleFilter}
                                                onChange={setMatrixModuleFilter}
                                                style={{ width: 290 }}
                                                options={[
                                                    { label: 'Tất cả lĩnh vực công tác', value: 'ALL' },
                                                    ...(matrixData.modules || []).map((m) => ({
                                                        label: `${MODULE_TITLES[m.module_name] || m.module_name} (${m.permissions.length} chức năng)`,
                                                        value: m.module_name,
                                                    })),
                                                ]}
                                            />
                                        </div>

                                        <div className="text-xs text-slate-700 font-medium">
                                            Hiển thị <b className="text-slate-900 font-bold">{filteredModules.reduce((sum, m) => sum + m.permissions.length, 0)}</b> chức năng trong <b className="text-slate-900 font-bold">{filteredModules.length}</b> lĩnh vực nghiệp vụ
                                        </div>
                                    </div>

                                    {/* Bộ lọc phân loại tính chất chức năng */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-800 font-bold">Loại chức năng:</span>
                                                <Segmented
                                                    size="small"
                                                    value={permTypeFilter}
                                                    onChange={setPermTypeFilter}
                                                    options={[
                                                        { label: 'Tất cả', value: 'ALL' },
                                                        { label: `Thực hiện tác vụ (${matrixStats.actionPerms})`, value: 'ACTION' },
                                                        { label: `Xem dữ liệu & Báo cáo (${groupAliases ? matrixStats.viewPerms - matrixStats.aliasPerms : matrixStats.viewPerms})`, value: 'VIEW' },
                                                    ]}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-800 font-bold">Tính chất phân quyền:</span>
                                                <Segmented
                                                    size="small"
                                                    value={protectionFilter}
                                                    onChange={setProtectionFilter}
                                                    options={[
                                                        { label: 'Tất cả', value: 'ALL' },
                                                        { label: `Chuyên môn học vụ (${matrixStats.protectedPerms})`, value: 'PROTECTED' },
                                                        { label: `Vận hành hệ thống (${matrixStats.technicalPerms})`, value: 'TECHNICAL' },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Danh sách lĩnh vực công tác dạng Accordion */}
                                <QueryPanel query={matrixQuery} empty={filteredModules.length === 0}>
                                    <div className="flex flex-col gap-3">
                                        {filteredModules.map((mod) => {
                                            const isOpen = openModules.has(mod.module_name);
                                            const modPerms = mod.permissions || [];

                                            return (
                                                <div
                                                    key={mod.module_name}
                                                    className="border border-slate-300 rounded-lg overflow-hidden transition-all shadow-xs"
                                                >
                                                    {/* Tiêu đề nhóm lĩnh vực */}
                                                    <div
                                                        className="flex items-center justify-between px-4 py-3 bg-slate-100/90 hover:bg-slate-200/90 cursor-pointer select-none border-b border-slate-300 transition-colors"
                                                        onClick={() => toggleModule(mod.module_name)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-700 font-bold text-xs">
                                                                {isOpen ? <DownOutlined /> : <RightOutlined />}
                                                            </span>
                                                            <Tag
                                                                color={MODULE_COLORS[mod.module_name] || 'default'}
                                                                className="m-0 font-bold text-xs px-2.5 py-0.5 border border-slate-300"
                                                            >
                                                                {MODULE_TITLES[mod.module_name] || mod.module_name}
                                                            </Tag>
                                                            <span className="text-xs font-bold text-slate-700 bg-white border border-slate-300 px-2.5 py-0.5 rounded-full">
                                                                {modPerms.length} chức năng
                                                            </span>
                                                        </div>

                                                        {/* Thống kê chức năng theo từng nhóm vai trò */}
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
                                                                            title={`${role.name}: Đang cấp ${countGranted}/${modPerms.length} chức năng trong lĩnh vực này. Bấm để bật/tắt toàn bộ.`}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleRoleInModule(role.id, modPerms, !isFull)}
                                                                                className={`text-[11px] px-2.5 py-0.5 rounded border transition-all ${
                                                                                    isFull
                                                                                        ? 'bg-teal-100 border-teal-600 text-teal-900 font-bold shadow-xs'
                                                                                        : countGranted > 0
                                                                                        ? 'bg-blue-100 border-blue-400 text-blue-900 font-semibold'
                                                                                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-medium'
                                                                                }`}
                                                                            >
                                                                                {role.name}: {countGranted}/{modPerms.length}
                                                                            </button>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bảng phân quyền chi tiết khi mở rộng */}
                                                    {isOpen && (
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                                <thead>
                                                                    <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1' }}>
                                                                        {/* Cột trái: Tên chức năng */}
                                                                        <th
                                                                            style={{
                                                                                position: 'sticky',
                                                                                left: 0,
                                                                                zIndex: 20,
                                                                                background: '#F1F5F9',
                                                                                padding: '11px 16px',
                                                                                textAlign: 'left',
                                                                                width: 400,
                                                                                minWidth: 320,
                                                                                borderRight: '2px solid #CBD5E1',
                                                                            }}
                                                                        >
                                                                            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                                CHỨC NĂNG &amp; NHIỆM VỤ
                                                                            </span>
                                                                        </th>

                                                                        {/* Các cột Vai trò */}
                                                                        {(matrixData.roles || []).map((role) => (
                                                                            <th
                                                                                key={role.id}
                                                                                style={{
                                                                                    padding: '10px 12px',
                                                                                    textAlign: 'center',
                                                                                    minWidth: 140,
                                                                                    borderRight: '1px solid #CBD5E1',
                                                                                    fontSize: 12,
                                                                                    color: '#0F172A',
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            >
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{role.name}</span>
                                                                                    <span className="text-[11px] text-slate-600 font-mono font-semibold mt-0.5">
                                                                                        {role.code}
                                                                                    </span>
                                                                                </div>
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>

                                                                <tbody>
                                                                    {modPerms.map((perm) => {
                                                                        const isProt = isAcademicProtected(perm.code);
                                                                        const isAct = isActionPermission(perm.code);

                                                                        const allRolesHave = (matrixData.roles || []).length > 0 &&
                                                                            (matrixData.roles || []).every((r) => localMatrix[r.id]?.has(perm.id));

                                                                        return (
                                                                            <tr
                                                                                key={perm.id}
                                                                                style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 0.15s' }}
                                                                                className="hover:bg-teal-50/70 transition-colors"
                                                                            >
                                                                                {/* Cột trái: Tên chức năng và mô tả ngắn gọn */}
                                                                                <td
                                                                                    style={{
                                                                                        position: 'sticky',
                                                                                        left: 0,
                                                                                        zIndex: 10,
                                                                                        background: '#FFFFFF',
                                                                                        padding: '10px 16px',
                                                                                        borderRight: '2px solid #CBD5E1',
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-start gap-2.5">
                                                                                        {/* Cấp chức năng cho tất cả nhóm vai trò */}
                                                                                        <Tooltip title="Cấp chức năng này cho tất cả nhóm vai trò">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={allRolesHave}
                                                                                                onChange={(e) => togglePermAll(perm, e.target.checked)}
                                                                                                disabled={!canAssignAcademic && isProt}
                                                                                                style={{
                                                                                                    cursor: (!canAssignAcademic && isProt) ? 'not-allowed' : 'pointer',
                                                                                                    width: 16,
                                                                                                    height: 16,
                                                                                                    marginTop: 2,
                                                                                                    accentColor: '#0F766E',
                                                                                                }}
                                                                                            />
                                                                                        </Tooltip>

                                                                                        <div className="flex flex-col gap-1">
                                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                                <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 13.5 }}>
                                                                                                    {perm.label}
                                                                                                </span>
                                                                                                {isProt && (
                                                                                                    <Tooltip title="Chức năng chuyên môn học vụ được bảo vệ theo quy chế đào tạo.">
                                                                                                        <Tag color="volcano" className="text-[10px] m-0 font-bold px-1.5 py-0 border border-red-300 flex items-center gap-1">
                                                                                                            <LockOutlined className="text-[9px]" />
                                                                                                            Quy chế bảo vệ
                                                                                                        </Tag>
                                                                                                    </Tooltip>
                                                                                                )}
                                                                                                {isAct ? (
                                                                                                    <Tag color="blue" className="text-[10px] m-0 font-semibold px-1.5 py-0 border border-blue-300">
                                                                                                        Thực hiện tác vụ
                                                                                                    </Tag>
                                                                                                ) : (
                                                                                                    <Tag color="geekblue" className="text-[10px] m-0 font-semibold px-1.5 py-0 border border-indigo-300">
                                                                                                        Xem dữ liệu
                                                                                                    </Tag>
                                                                                                )}
                                                                                            </div>

                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-[11px] text-slate-700 font-mono font-semibold bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded">
                                                                                                    Mã hệ thống: {perm.code}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>

                                                                                {/* Các ô Phân quyền của từng Vai trò */}
                                                                                {(matrixData.roles || []).map((role) => {
                                                                                    const checked = localMatrix[role.id]?.has(perm.id) ?? false;
                                                                                    const isCellDisabled = !canAssignAcademic && isProt;

                                                                                    return (
                                                                                        <td
                                                                                            key={role.id}
                                                                                            style={{
                                                                                                padding: '8px 10px',
                                                                                                textAlign: 'center',
                                                                                                borderRight: '1px solid #E2E8F0',
                                                                                            }}
                                                                                        >
                                                                                            <Tooltip
                                                                                                title={
                                                                                                    isCellDisabled
                                                                                                        ? `Bị khóa: Chức năng "${perm.label}" thuộc quy chế chuyên môn học vụ, chỉ người có thẩm quyền mới được điều chỉnh.`
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
                                                                                                        border: checked ? '1.5px solid #0D5D56' : isCellDisabled ? '1.5px solid #CBD5E1' : '1.5px solid #CBD5E1',
                                                                                                        background: checked ? '#0F766E' : isCellDisabled ? '#F1F5F9' : '#FFFFFF',
                                                                                                        color: checked ? '#FFFFFF' : '#475569',
                                                                                                        cursor: isCellDisabled ? 'not-allowed' : 'pointer',
                                                                                                        opacity: isCellDisabled ? 0.75 : 1,
                                                                                                        transition: 'all 0.15s ease',
                                                                                                        boxShadow: checked ? '0 1px 3px rgba(15, 118, 110, 0.35)' : '0 1px 2px rgba(0,0,0,0.04)',
                                                                                                    }}
                                                                                                >
                                                                                                    {checked ? (
                                                                                                        <CheckOutlined style={{ fontSize: 14, strokeWidth: 3 }} />
                                                                                                    ) : isCellDisabled ? (
                                                                                                        <LockOutlined style={{ fontSize: 12, color: '#475569' }} />
                                                                                                    ) : (
                                                                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748B' }} />
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
                                </QueryPanel>
                            </div>
                        ),
                    },
                    {
                        key: 'GROUPS',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <UnorderedListOutlined />
                                Nhóm Vai Trò &amp; Phân Cấp ({groups.length})
                            </span>
                        ),
                        children: (
                            <QueryPanel query={groupsQuery} variant="table">
                            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 lg:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SafetyCertificateOutlined className="text-[#0F766E] text-lg" />
                                        <span className="text-sm font-bold text-slate-900">
                                            Danh sách Nhóm vai trò và Phân cấp chức năng
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-700 font-medium">
                                        Tổng cộng: <b className="text-slate-900 font-bold">{groups.length}</b> nhóm vai trò
                                    </span>
                                </div>

                                <div className="border border-slate-300 rounded-lg overflow-hidden shadow-xs">
                                    <Table
                                        dataSource={groups}
                                        rowKey="id"
                                        columns={groupColumns}
                                        locale={{ emptyText: <EmptyState /> }}
                                        loading={false}
                                        pagination={false}
                                        size="middle"
                                        scroll={{ x: 1000 }}
                                    />
                                </div>
                            </div>
                            </QueryPanel>
                        ),
                    },
                    {
                        key: 'CATALOG',
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <BookOutlined />
                                Danh Mục Chức Năng Hệ Thống ({allPermissions.length})
                            </span>
                        ),
                        children: (
                            <QueryPanel query={catalogQuery} empty={allPermissions.length === 0}>
                            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 lg:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SlidersOutlined className="text-[#0F766E] text-lg" />
                                        <span className="text-sm font-bold text-slate-900">
                                            Danh mục {allPermissions.length} chức năng nghiệp vụ được quản lý
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(permissionsByModule).map(([mod, perms]) => (
                                        <Card
                                            key={mod}
                                            size="small"
                                            className="border border-slate-300 shadow-xs"
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Tag color={MODULE_COLORS[mod] || 'default'} className="font-bold border border-slate-300">{MODULE_TITLES[mod] || mod}</Tag>
                                                    <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 700 }}>{perms.length} chức năng</span>
                                                </div>
                                            }
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {perms.map((p) => {
                                                    const isProt = isAcademicProtected(p.code);
                                                    const isAct = isActionPermission(p.code);

                                                    return (
                                                        <div key={p.code} style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{p.label}</span>
                                                                <div className="flex items-center gap-1">
                                                                    {isProt && (
                                                                        <Tag color="volcano" className="text-[10px] m-0 font-bold px-1.5 py-0 border border-red-300">
                                                                            Quy chế bảo vệ
                                                                        </Tag>
                                                                    )}
                                                                    {isAct ? (
                                                                        <Tag color="blue" className="text-[10px] m-0 font-semibold px-1.5 py-0 border border-blue-300">
                                                                            Thực hiện tác vụ
                                                                        </Tag>
                                                                    ) : (
                                                                        <Tag color="geekblue" className="text-[10px] m-0 font-semibold px-1.5 py-0 border border-indigo-300">
                                                                            Xem dữ liệu
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[11px] text-slate-700 font-mono font-semibold bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded">
                                                                    Mã hệ thống: {p.code}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                            </QueryPanel>
                        ),
                    },
                ]}
            />

            {/* Cửa sổ Thêm / Chỉnh sửa Nhóm vai trò */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SafetyCertificateOutlined className="text-teal-700" />
                        {editingGroup ? `Chỉnh sửa nhóm vai trò: ${editingGroup.name}` : 'Tạo nhóm vai trò mới'}
                    </div>
                }
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText={editingGroup ? 'Lưu thay đổi' : 'Tạo nhóm vai trò'}
                cancelText="Hủy"
                confirmLoading={submitting}
                okButtonProps={{ disabled: !catalogQuery.isSuccess }}
                width={680}
                centered
                destroyOnHidden
            >
                <QueryPanel query={catalogQuery}>
                <Form form={form} layout="vertical" className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item
                            label="Mã định danh hệ thống"
                            name="code"
                            rules={[
                                { required: true, message: 'Vui lòng nhập mã định danh!' },
                                { pattern: /^[A-Z0-9_]+$/, message: 'Chỉ được dùng chữ in hoa không dấu, số và dấu gạch dưới' },
                            ]}
                        >
                            <Input
                                placeholder="VD: TRUONG_BO_MON"
                                disabled={Boolean(editingGroup)}
                                className="font-mono font-bold"
                            />
                        </Form.Item>
                        <Form.Item
                            label="Tên nhóm vai trò"
                            name="name"
                            rules={[{ required: true, message: 'Vui lòng nhập tên nhóm vai trò!' }]}
                        >
                            <Input placeholder="VD: Trưởng Bộ Môn" />
                        </Form.Item>
                    </div>

                    <Form.Item label="Mô tả phạm vi công tác & trách nhiệm" name="description">
                        <Input.TextArea rows={2} placeholder="Mô tả nhiệm vụ, trách nhiệm và phạm vi hoạt động của vị trí công tác này..." />
                    </Form.Item>

                    <Form.Item label="Chức năng được phép sử dụng" name="permissionCodes">
                        <Select
                            mode="multiple"
                            placeholder="Chọn các chức năng nghiệp vụ cho vị trí công tác này..."
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            maxTagCount="responsive"
                            className="w-full"
                        >
                            {Object.entries(permissionsByModule).map(([module, perms]) => (
                                <Select.OptGroup key={module} label={`[Lĩnh vực: ${MODULE_TITLES[module] || module}]`}>
                                    {perms.map((p) => {
                                        const isProt = isAcademicProtected(p.code);
                                        const disabled = !canAssignAcademic && isProt;

                                        return (
                                            <Select.Option
                                                key={p.code}
                                                value={p.code}
                                                disabled={disabled}
                                                label={`${p.label} ${p.code}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-900">{p.label}</span>
                                                    <span className="text-[11px] text-slate-600 font-mono font-medium">({p.code})</span>
                                                    {isProt && (
                                                        <Tag color="volcano" className="text-[9px] m-0 ml-auto font-bold border border-red-300">
                                                            Quy chế bảo vệ
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
                        <div className="text-xs text-slate-700 bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                            Mã định danh hệ thống dùng để liên kết vị trí công tác với chức năng nghiệp vụ và không thể thay đổi sau khi tạo (Ví dụ: <code className="bg-slate-200 text-slate-900 px-1 py-0.5 rounded font-mono font-bold">HOI_DONG_KHOA_HOC</code>).
                        </div>
                    )}
                </Form>
                </QueryPanel>
            </Modal>
        </div>
    );
}

export default PermissionGroupPage;
