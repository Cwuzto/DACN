import { useSemesters } from '../../queries/semesterQueries';
import { useProjectCatalogs, useEnrollments, useEnrollmentAudit, useEnrollmentMutation, useAvailableStudents } from '../../queries/enrollmentQueries';
import { useLecturerAssignments } from '../../queries/lecturerAssignmentQueries';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Form, message, Modal, Popconfirm, Select, Table, Tag, Tabs } from 'antd';
import {
    UploadOutlined,
    DownloadOutlined,
    UserAddOutlined,
    DeleteOutlined,
    DashboardOutlined,
    TeamOutlined,
    UserOutlined,
    FilterOutlined,
    ReloadOutlined,
} from '@ant-design/icons';

import ExcelImportModal from '../../components/common/ExcelImportModal';
import AuthorizedAction from '../../components/common/AuthorizedAction';
import { getEffectivePermissions, canPerformFeatureAction } from '../../auth/policyEvaluator';
import projectEnrollmentService from '../../services/projectEnrollmentService';

import useAuthStore from '../../stores/authStore';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
import CoordinationOverviewTab from '../../components/coordination/CoordinationOverviewTab';
import LecturerAssignmentTab from '../../components/coordination/LecturerAssignmentTab';

const EMPTY_LIST = [];

export function ProjectEnrollmentPage() {
    const { roundId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);

    // Tab-level RBAC
    const canAccessLecturers = useMemo(() => {
        if (!user) return false;
        const perms = getEffectivePermissions(user);
        return (
            perms.has('PERMISSION_ASSIGN_ACADEMIC') ||
            perms.has('MENTOR_ASSIGN') ||
            perms.has('ENROLLMENT_MANAGE')
        );
    }, [user]);

    const canAccessOverview = useMemo(() => {
        if (!user) return false;
        const perms = getEffectivePermissions(user);
        return (
            perms.has('VIEW_PROJECT_ENROLLMENTS') ||
            perms.has('PERMISSION_ASSIGN_ACADEMIC') ||
            perms.has('MENTOR_ASSIGN')
        );
    }, [user]);

    const canAccessStudents = useMemo(() => {
        if (!user) return false;
        const perms = getEffectivePermissions(user);
        return (
            perms.has('VIEW_PROJECT_ENROLLMENTS') ||
            perms.has('ENROLLMENT_MANAGE') ||
            perms.has('PROJECT_CATALOG_MANAGE')
        );
    }, [user]);

    // Active tab state from URL or permissions
    const rawTab = searchParams.get('tab');
    const defaultTab = canAccessOverview ? 'overview' : (canAccessStudents ? 'students' : 'lecturers');
    const activeTab = (rawTab && ['overview', 'students', 'lecturers'].includes(rawTab)) ? rawTab : defaultTab;

    const handleTabChange = (newTab) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', newTab);
        setSearchParams(next, { replace: true });
    };

    // Filters (Semester & Catalog)
    const [filterSemesterId, setFilterSemesterId] = useState(() => {
        if (roundId) return Number(roundId);
        const qSem = searchParams.get('semesterId');
        return qSem ? Number(qSem) : null;
    });

    const [filterCatalogId, setFilterCatalogId] = useState(() => {
        const qCat = searchParams.get('projectCatalogId');
        return qCat ? Number(qCat) : null;
    });

    // Student tab state
    const [saving, setSaving] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [showAssignPanel, setShowAssignPanel] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Audit state
    const [fixing, setFixing] = useState(false);
    const [topicFixModalOpen, setTopicFixModalOpen] = useState(false);
    const [topicToFix, setTopicToFix] = useState(null);
    const [topicFixCatalogId, setTopicFixCatalogId] = useState(null);

    const [form] = Form.useForm();

    // Sync state with URL params
    const updateFilterSemester = (id) => {
        setFilterSemesterId(id);
        form.setFieldsValue({ semesterId: id });
        const next = new URLSearchParams(searchParams);
        if (id && !roundId) next.set('semesterId', id);
        else next.delete('semesterId');
        setSearchParams(next, { replace: true });
    };

    const updateFilterCatalog = (id) => {
        setFilterCatalogId(id);
        form.setFieldsValue({ projectCatalogId: id });
        const next = new URLSearchParams(searchParams);
        if (id) next.set('projectCatalogId', id);
        else next.delete('projectCatalogId');
        setSearchParams(next, { replace: true });
    };

    const scope = queryKeys.scope(user);
    const semestersQuery = useSemesters(scope);
    const catalogsQuery = useProjectCatalogs(scope);
    const availableStudentsQuery = useAvailableStudents(
        scope,
        { semesterId: filterSemesterId, projectCatalogId: filterCatalogId || undefined },
        canAccessStudents && showAssignPanel && Boolean(filterSemesterId)
    );
    const availableStudents = availableStudentsQuery.data || EMPTY_LIST;
    const loadingAvailableStudents = availableStudentsQuery.isFetching;
    const semesters = semestersQuery.data || EMPTY_LIST;
    const catalogs = catalogsQuery.data || EMPTY_LIST;
    const enrollmentFilters = { semesterId: filterSemesterId };
    if (filterCatalogId) enrollmentFilters.projectCatalogId = filterCatalogId;
    const rowsQuery = useEnrollments(scope, enrollmentFilters, canAccessStudents);
    const rows = rowsQuery.data || EMPTY_LIST;
    const loading = rowsQuery.isFetching;
    const auditQuery = useEnrollmentAudit(scope, filterSemesterId, canAccessStudents);
    const audit = auditQuery.data || { enrolledWithoutTopicRegistration: [], topicsMissingProjectCatalog: [], registrationsRuleMismatch: [] };
    const auditLoading = auditQuery.isFetching;
    const fetchAudit = () => auditQuery.refetch();
    const enrollmentMutation = useEnrollmentMutation(scope, filterSemesterId);
    const lecturerAssignmentsQuery = useLecturerAssignments(
        scope,
        { semesterId: filterSemesterId, projectCatalogId: filterCatalogId || undefined },
        canAccessLecturers && Boolean(filterSemesterId)
    );
    const assignedLecturersCount = lecturerAssignmentsQuery.data?.length ?? 0;
    useEffect(() => {
        if (filterSemesterId || !semesters.length) return;
        const matched = roundId ? semesters.find(s => s.id === Number(roundId)) : semesters.find(s => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(s.status));
        const selectedId = matched?.id || semesters[0]?.id;
        setFilterSemesterId(selectedId);
        form.setFieldsValue({ semesterId: selectedId });
    }, [filterSemesterId, semesters, roundId, form]);

    useEffect(() => {
        if (!catalogs.length) return;
        const defaultCatId = filterCatalogId || catalogs[0]?.id;
        if (catalogs.length === 1 && !filterCatalogId) {
            setFilterCatalogId(defaultCatId);
        }
        if (defaultCatId && !form.getFieldValue('projectCatalogId')) {
            form.setFieldsValue({ projectCatalogId: defaultCatId });
        }
    }, [catalogs, filterCatalogId, form]);

    useEffect(() => {
        if (showAssignPanel) {
            const semId = form.getFieldValue('semesterId') || filterSemesterId || semesters[0]?.id;
            const catId = form.getFieldValue('projectCatalogId') || filterCatalogId || catalogs[0]?.id;
            form.setFieldsValue({
                semesterId: semId,
                projectCatalogId: catId,
            });
        }
    }, [showAssignPanel, filterSemesterId, filterCatalogId, semesters, catalogs, form]);

    // Student Operations
    const handleExport = async () => {
        try {
            setExporting(true);
            message.loading({ content: 'Đang chuẩn bị file Excel...', key: 'export-enrollment' });
            await projectEnrollmentService.exportEnrollmentsExcel({
                semesterId: filterSemesterId || undefined,
                projectCatalogId: filterCatalogId || undefined,
            });
            message.success({ content: 'Xuất danh sách gán đồ án thành công!', key: 'export-enrollment' });
        } catch (error) {
            message.error({ content: error?.message || 'Lỗi khi xuất file Excel', key: 'export-enrollment' });
        } finally {
            setExporting(false);
        }
    };

    const handleAssignSingle = async (values) => {
        if (!values.studentId) {
            message.warning('Vui lòng chọn 1 sinh viên');
            return;
        }
        setSaving(true);
        try {
            const res = await enrollmentMutation.mutateAsync({ action: 'createEnrollment', args: [{
                semesterId: values.semesterId || filterSemesterId,
                projectCatalogId: values.projectCatalogId || filterCatalogId || catalogs[0]?.id,
                studentId: values.studentId,
            }] });
            if (res.success) {
                message.success('Gán môn đồ án thành công');
                form.setFieldsValue({ studentId: null });
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gán môn đồ án');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignBulk = async () => {
        const targetSemesterId = form.getFieldValue('semesterId') || filterSemesterId;
        const targetCatalogId = form.getFieldValue('projectCatalogId') || filterCatalogId || catalogs[0]?.id;

        if (!targetSemesterId || !targetCatalogId) {
            message.warning('Vui lòng chọn đợt đồ án và loại đồ án');
            return;
        }

        if (!selectedStudentIds.length) {
            message.warning('Vui lòng chọn ít nhất 1 sinh viên để gán');
            return;
        }

        setSaving(true);
        try {
            const res = await enrollmentMutation.mutateAsync({ action: 'bulkAssign', args: [{
                semesterId: targetSemesterId,
                projectCatalogId: targetCatalogId,
                studentIds: selectedStudentIds,
            }] });
            if (res.success) {
                message.success(`Đã gán ${res.data?.created || selectedStudentIds.length} sinh viên`);
                setSelectedStudentIds([]);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gán hàng loạt');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await enrollmentMutation.mutateAsync({ action: 'deleteEnrollment', args: [id] });
            if (res.success) {
                message.success('Đã xóa gán môn đồ án');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi xóa gán');
        }
    };

    const handleFixTopicCatalog = async () => {
        if (!topicToFix?.id || !topicFixCatalogId) {
            message.warning('Vui lòng chọn Loại đồ án cần gán');
            return;
        }
        setFixing(true);
        try {
            const res = await enrollmentMutation.mutateAsync({ action: 'updateTopic', args: [topicToFix.id, { projectCatalogId: topicFixCatalogId }] });
            if (res.success) {
                message.success('Đã cập nhật Loại đồ án cho đề tài');
                setTopicFixModalOpen(false);
                setTopicToFix(null);
                setTopicFixCatalogId(null);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật đề tài');
        } finally {
            setFixing(false);
        }
    };

    const semesterOptions = useMemo(
        () => semesters.map((s) => ({ value: s.id, label: formatSemesterLabel(s) })),
        [semesters]
    );

    const catalogOptions = useMemo(
        () => catalogs.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
        [catalogs]
    );

    const studentOptions = useMemo(() => {
        const existingStudentIds = new Set(rows.map((r) => r.studentId));
        return availableStudents
            .filter((s) => !s.accountRestricted && (!filterCatalogId || !existingStudentIds.has(s.id)))
            .map((s) => ({
                value: s.id,
                label: `${s.fullName} (${s.code || 'Chưa có mã'})${s.major ? ` - ${s.major}` : ''}`,
            }));
    }, [availableStudents, rows, filterCatalogId]);

    const studentColumns = [
        {
            title: 'Sinh viên',
            key: 'student',
            render: (_, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-100">
                        {row.student?.fullName?.[0]?.toUpperCase() || 'S'}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                            {row.student?.fullName || 'Chưa có tên'}
                        </div>
                        <div className="text-xs text-slate-600 font-mono font-medium">
                            {row.student?.code || 'Chưa có mã'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Đợt đồ án',
            key: 'semester',
            render: (_, row) => <span className="text-xs font-semibold text-slate-700">{row.semester?.name || 'N/A'}</span>,
        },
        {
            title: 'Loại đồ án',
            key: 'projectCatalog',
            render: (_, row) => (
                <Tag color="blue" className="font-semibold text-xs">
                    {row.projectCatalog?.name || 'N/A'}
                </Tag>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            align: 'center',
            render: (status) => (
                status === 'ACTIVE'
                    ? <Tag color="green" className="font-semibold text-[11px] px-2.5 py-0.5 rounded-full">Đang hiệu lực</Tag>
                    : <Tag color="default" className="text-[11px] px-2.5 py-0.5 rounded-full">Đã hủy</Tag>
            ),
        },
        ...(canPerformFeatureAction(user, 'project-enrollments', 'manageEnrollment')
            ? [
                {
                    title: 'Hành động',
                    key: 'actions',
                    width: 90,
                    align: 'center',
                    render: (_, row) => (
                        <Popconfirm
                            title="Gỡ sinh viên này khỏi đợt đồ án?"
                            description="Sinh viên sẽ không còn trong danh sách đủ điều kiện đăng ký đợt này."
                            onConfirm={() => handleDelete(row.id)}
                            okText="Gỡ"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                    ),
                },
            ]
            : []),
    ];

    // Tab Items definition with RBAC Guards
    const tabItems = [
        canAccessOverview && {
            key: 'overview',
            label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                    <DashboardOutlined /> Tổng quan đợt
                </span>
            ),
            children: (
                <CoordinationOverviewTab
                    semesterId={filterSemesterId}
                    projectCatalogId={filterCatalogId}
                    semesters={semesters}
                    catalogs={catalogs}
                    onNavigateTab={handleTabChange}
                />
            ),
        },
        canAccessStudents && {
            key: 'students',
            label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                    <TeamOutlined /> Sinh viên ({rowsQuery.data ? rows.length : '—'})
                </span>
            ),
            children: (
                <QueryPanel query={rowsQuery}>
                <div className="space-y-4">
                    {/* Student Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Danh sách ({rows.length} sinh viên)
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                icon={<ReloadOutlined />}
                                loading={rowsQuery.isFetching}
                                onClick={() => {
                                    rowsQuery.refetch();
                                    auditQuery.refetch();
                                }}
                            >
                                Làm mới
                            </Button>
                            <AuthorizedAction feature="project-enrollments" action="manageEnrollment">
                                <Button
                                    type={showAssignPanel ? 'primary' : 'default'}
                                    icon={<UserAddOutlined />}
                                    onClick={() => setShowAssignPanel((prev) => !prev)}
                                >
                                    {showAssignPanel ? 'Ẩn form gán' : 'Gán thủ công'}
                                </Button>
                            </AuthorizedAction>
                            <AuthorizedAction feature="project-enrollments" action="manageEnrollment">
                                <Button
                                    icon={<UploadOutlined />}
                                    onClick={() => setIsExcelModalOpen(true)}
                                >
                                    Gán bằng Excel
                                </Button>
                            </AuthorizedAction>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExport}
                                loading={exporting}
                            >
                                Xuất Excel
                            </Button>
                        </div>
                    </div>

                    {/* Manual Assign Panel (Expandable) */}
                    {showAssignPanel && (
                        <QueryPanel query={availableStudentsQuery}>
                        <div className="bg-white rounded-lg border border-teal-200 bg-teal-50/20 p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <UserAddOutlined className="text-teal-700" />
                                    Gán Sinh viên Thủ công vào Đợt Đồ Án
                                </h4>
                                <span className="text-xs text-slate-600 font-medium">Hiện có {availableStudents.length} sinh viên khả dụng</span>
                            </div>

                            <Form form={form} layout="vertical" onFinish={handleAssignSingle}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true }]}>
                                        <Select
                                            options={semesterOptions}
                                            value={filterSemesterId}
                                            onChange={updateFilterSemester}
                                        />
                                    </Form.Item>
                                    <Form.Item name="projectCatalogId" label="Loại đồ án" rules={[{ required: true, message: 'Vui lòng chọn loại đồ án' }]}>
                                        <Select
                                            options={catalogOptions}
                                            value={form.getFieldValue('projectCatalogId') || filterCatalogId || catalogs[0]?.id}
                                            onChange={updateFilterCatalog}
                                            disabled={catalogOptions.length <= 1}
                                            placeholder="Chọn loại đồ án"
                                        />
                                    </Form.Item>
                                    <Form.Item name="studentId" label="Sinh viên (gán lẻ 1 bạn)">
                                        <Select
                                            showSearch
                                            loading={loadingAvailableStudents}
                                            optionFilterProp="label"
                                            options={studentOptions}
                                            allowClear
                                            placeholder="Chọn sinh viên khả dụng (MSSV hoặc tên)..."
                                            notFoundContent={
                                                <div className="py-2 text-center text-xs text-slate-500">
                                                    Không có sinh viên khả dụng (đã được gán vào đợt hoặc đã hoàn thành đồ án)
                                                </div>
                                            }
                                        />
                                    </Form.Item>
                                    <div className="flex items-end gap-2 pb-1">
                                        <Button type="primary" htmlType="submit" loading={saving}>
                                            Gán 1 SV
                                        </Button>
                                        <Button
                                            onClick={handleAssignBulk}
                                            loading={saving}
                                            disabled={selectedStudentIds.length === 0}
                                        >
                                            Gán hàng loạt ({selectedStudentIds.length})
                                        </Button>
                                    </div>
                                </div>
                            </Form>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Chọn nhiều sinh viên cùng lúc
                                </label>
                                <Select
                                    mode="multiple"
                                    className="w-full"
                                    loading={loadingAvailableStudents}
                                    placeholder="Chọn sinh viên khả dụng (MSSV hoặc tên)..."
                                    options={studentOptions}
                                    value={selectedStudentIds}
                                    onChange={setSelectedStudentIds}
                                    showSearch
                                    optionFilterProp="label"
                                    notFoundContent={
                                        <div className="py-2 text-center text-xs text-slate-500">
                                            Không có sinh viên khả dụng (đã được gán vào đợt hoặc đã hoàn thành đồ án)
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                        </QueryPanel>
                    )}

                    {/* Students Data Table Card */}
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                        <Table
                            rowKey="id"
                            loading={loading}
                            columns={studentColumns}
                            dataSource={rows}
                            pagination={{ pageSize: 10, showSizeChanger: true }}
                            locale={{
                                emptyText: (
                                    <div className="py-8 text-center text-slate-500 font-medium">
                                        Chưa có sinh viên nào được gán vào đợt đồ án này.
                                    </div>
                                ),
                            }}
                        />
                    </div>

                    <QueryPanel query={auditQuery}>
                    {/* Audit Integrity Section */}
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Đối soát Tính Toàn Vẹn Quy Tắc Gán
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tự động phát hiện sinh viên chưa đăng ký đề tài hoặc lệch thông tin học kỳ
                                </p>
                            </div>
                            <Button size="small" onClick={fetchAudit} loading={auditLoading}>
                                Quét lại
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Đã gán nhưng chưa đăng ký đề tài</div>
                                <div className="text-2xl font-bold text-amber-900 mt-1 tabular-nums">
                                    {audit?.enrolledWithoutTopicRegistration?.length || 0}
                                </div>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-rose-800">Đề tài thiếu tên danh mục</div>
                                <div className="text-2xl font-bold text-rose-900 mt-1 tabular-nums">
                                    {audit?.topicsMissingProjectCatalog?.length || 0}
                                </div>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">Lệch quy tắc gán đồ án</div>
                                <div className="text-2xl font-bold text-blue-900 mt-1 tabular-nums">
                                    {audit?.registrationsRuleMismatch?.length || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                    </QueryPanel>
                </div>
                </QueryPanel>
            ),
        },
        canAccessLecturers && {
            key: 'lecturers',
            label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                    <UserOutlined /> Giảng viên hướng dẫn ({lecturerAssignmentsQuery.data ? assignedLecturersCount : '—'})
                </span>
            ),
            children: (
                <LecturerAssignmentTab
                    semesterId={filterSemesterId}
                    projectCatalogId={filterCatalogId}
                    semesters={semesters}
                    catalogs={catalogs}
                    user={user}

                />
            ),
        },
    ].filter(Boolean);

    return (
        <QueryPanel query={semestersQuery}><QueryPanel query={catalogsQuery}>
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="eyebrow text-teal-700 font-bold tracking-wider">TRUNG TÂM ĐIỀU PHỐI ĐỢT ĐỒ ÁN</p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Điều Phối Đợt Đồ Án & Phân Công
                    </h1>
                </div>

                {/* Global Filters on Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đợt đồ án:</span>
                        <Select
                            placeholder="Chọn đợt đồ án"
                            style={{ minWidth: 220 }}
                            value={filterSemesterId}
                            onChange={updateFilterSemester}
                            options={semesterOptions}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loại đồ án:</span>
                        <Select
                            placeholder="Tất cả loại đồ án"
                            style={{ minWidth: 200 }}
                            value={filterCatalogId}
                            onChange={updateFilterCatalog}
                            options={catalogOptions}
                            allowClear
                        />
                    </div>
                </div>
            </div>

            {/* 3-Tab Coordination Hub */}
            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={tabItems}
                type="card"
                className="coordination-tabs bg-transparent"
            />

            {/* Modal Sửa Đề tài thiếu catalog */}
            <Modal
                title="Gán loại đồ án cho đề tài"
                open={topicFixModalOpen}
                onCancel={() => setTopicFixModalOpen(false)}
                onOk={handleFixTopicCatalog}
                okText="Lưu cập nhật"
                cancelText="Hủy"
                confirmLoading={fixing}
                destroyOnClose
            >
                <div className="space-y-3">
                    <div className="text-sm text-slate-600">
                        Đề tài: <span className="font-semibold text-slate-900">{topicToFix?.title || 'Chưa có'}</span>
                    </div>
                    <Select
                        className="w-full"
                        placeholder="Chọn Loại đồ án"
                        value={topicFixCatalogId}
                        onChange={setTopicFixCatalogId}
                        options={catalogOptions}
                    />
                </div>
            </Modal>

            {/* Modal Gán Bằng Excel */}
            <ExcelImportModal
                open={isExcelModalOpen}
                onCancel={() => setIsExcelModalOpen(false)}
                type="PROJECT_ENROLLMENT"
                semesters={semesters}
                catalogs={catalogs}
                onDownloadTemplate={() => projectEnrollmentService.downloadTemplate()}
                onExecuteImport={(payload) => enrollmentMutation.mutateAsync({ action: 'importEnrollmentsExcel', args: [payload] })}
            />
        </div>
        </QueryPanel></QueryPanel>
    );
}

export default ProjectEnrollmentPage;
