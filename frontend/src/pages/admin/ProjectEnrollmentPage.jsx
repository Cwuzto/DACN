import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@ant-design/icons';

import ExcelImportModal from '../../components/common/ExcelImportModal';
import projectEnrollmentService from '../../services/projectEnrollmentService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import { topicService } from '../../services/topicService';
import userService from '../../services/userService';
import useAuthStore from '../../stores/authStore';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
import CoordinationOverviewTab from '../../components/coordination/CoordinationOverviewTab';
import LecturerAssignmentTab from '../../components/coordination/LecturerAssignmentTab';

export function ProjectEnrollmentPage() {
    const { roundId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);

    // Tab-level RBAC
    const canAccessLecturers = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        const permissions = user.permissions || [];
        return (
            permissions.includes('PERMISSION_ASSIGN_ACADEMIC') ||
            permissions.includes('MENTOR_ASSIGN') ||
            permissions.includes('ENROLLMENT_MANAGE')
        );
    }, [user]);

    const canAccessOverview = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        const permissions = user.permissions || [];
        return (
            permissions.includes('VIEW_PROJECT_ENROLLMENTS') ||
            permissions.includes('PERMISSION_ASSIGN_ACADEMIC') ||
            permissions.includes('MENTOR_ASSIGN')
        );
    }, [user]);

    const canAccessStudents = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        const permissions = user.permissions || [];
        return (
            permissions.includes('VIEW_PROJECT_ENROLLMENTS') ||
            permissions.includes('ENROLLMENT_MANAGE') ||
            permissions.includes('PROJECT_CATALOG_MANAGE')
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

    const [semesters, setSemesters] = useState([]);
    const [catalogs, setCatalogs] = useState([]);
    const [students, setStudents] = useState([]);

    // Student tab state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [showAssignPanel, setShowAssignPanel] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Audit state
    const [auditLoading, setAuditLoading] = useState(false);
    const [audit, setAudit] = useState({
        enrolledWithoutTopicRegistration: [],
        topicsMissingProjectCatalog: [],
        registrationsRuleMismatch: [],
    });
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

    // Fetch Reference Meta (Semesters, Catalogs, Students)
    const fetchMeta = useCallback(async () => {
        try {
            const [semesterRes, catalogRes, studentRes] = await Promise.all([
                semesterService.getAll(),
                projectEnrollmentService.getCatalogs(),
                userService.getUsers({ role: 'STUDENT', status: 'active', limit: 2000 }),
            ]);

            if (semesterRes.success) {
                const list = semesterRes.data || [];
                setSemesters(list);
                if (!filterSemesterId) {
                    const matched = roundId
                        ? list.find((s) => s.id === Number(roundId))
                        : (list.find((s) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(s.status)) || list[0]);
                    const selectedId = matched?.id || list[0]?.id || null;
                    if (selectedId) {
                        setFilterSemesterId(selectedId);
                        form.setFieldsValue({ semesterId: selectedId });
                    }
                }
            }
            if (catalogRes.success) {
                setCatalogs(catalogRes.data || []);
            }
            if (studentRes.success) {
                setStudents(studentRes.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu tham chiếu');
        }
    }, [filterSemesterId, form, roundId]);

    // Fetch Students Rows
    const fetchRows = useCallback(async () => {
        if (!filterSemesterId) {
            setRows([]);
            return;
        }
        setLoading(true);
        try {
            const params = { semesterId: filterSemesterId };
            if (filterCatalogId) params.projectCatalogId = filterCatalogId;
            const res = await projectEnrollmentService.getEnrollments(params);
            if (res.success) setRows(res.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách gán môn đồ án');
        } finally {
            setLoading(false);
        }
    }, [filterCatalogId, filterSemesterId]);

    useEffect(() => {
        fetchMeta();
    }, [fetchMeta]);

    useEffect(() => {
        fetchRows();
    }, [fetchRows]);

    // Fetch Audit Integrity
    const fetchAudit = useCallback(async () => {
        if (!filterSemesterId) {
            setAudit({
                enrolledWithoutTopicRegistration: [],
                topicsMissingProjectCatalog: [],
                registrationsRuleMismatch: [],
            });
            return;
        }

        setAuditLoading(true);
        try {
            const [enrollRes, regRes, topicRes] = await Promise.all([
                projectEnrollmentService.getEnrollments({ semesterId: filterSemesterId }),
                registrationService.getAllRegistrations({ semesterId: filterSemesterId, limit: 5000 }),
                topicService.getAll({ semesterId: filterSemesterId, limit: 5000 }),
            ]);

            const enrollments = enrollRes?.success ? (enrollRes.data || []) : [];
            const registrations = regRes?.success ? (regRes.data || []) : [];
            const topics = topicRes?.success ? (topicRes.data || []) : [];

            const activeEnrollments = enrollments.filter((r) => r.status === 'ACTIVE');
            const activeRegistrations = registrations.filter((r) => r.status !== 'REJECTED');

            const registeredStudentIds = new Set(activeRegistrations.map((r) => r.studentId));
            const enrolledWithoutTopic = activeEnrollments.filter((r) => !registeredStudentIds.has(r.studentId));

            const topicsMissingCatalog = topics.filter((t) => !t.projectCatalogId);

            const studentCatalogMap = new Map();
            activeEnrollments.forEach((row) => {
                studentCatalogMap.set(row.studentId, row.projectCatalogId);
            });

            const ruleMismatch = [];
            activeRegistrations.forEach((reg) => {
                const topicCatalogId = reg.topic?.projectCatalogId;
                const studentEnrollmentCatalogId = studentCatalogMap.get(reg.studentId);

                if (!topicCatalogId) {
                    ruleMismatch.push({ ...reg, mismatchReason: 'TOPIC_MISSING_PROJECT_CATALOG' });
                } else if (!studentEnrollmentCatalogId || studentEnrollmentCatalogId !== topicCatalogId) {
                    ruleMismatch.push({ ...reg, mismatchReason: 'MISSING_MATCHED_ENROLLMENT' });
                }
            });

            setAudit({
                enrolledWithoutTopicRegistration: enrolledWithoutTopic,
                topicsMissingProjectCatalog: topicsMissingCatalog,
                registrationsRuleMismatch: ruleMismatch,
            });
        } catch (error) {
            // Silently absorb or log audit warning
        } finally {
            setAuditLoading(false);
        }
    }, [filterSemesterId]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

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
            const res = await projectEnrollmentService.createEnrollment({
                semesterId: values.semesterId || filterSemesterId,
                projectCatalogId: values.projectCatalogId || filterCatalogId,
                studentId: values.studentId,
            });
            if (res.success) {
                message.success('Gán môn đồ án thành công');
                form.setFieldsValue({ studentId: null });
                fetchRows();
                fetchAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gán môn đồ án');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignBulk = async () => {
        const targetSemesterId = form.getFieldValue('semesterId') || filterSemesterId;
        const targetCatalogId = form.getFieldValue('projectCatalogId') || filterCatalogId;

        if (!targetSemesterId || !targetCatalogId) {
            message.warning('Vui lòng chọn đợt đồ án và tên đồ án');
            return;
        }

        if (!selectedStudentIds.length) {
            message.warning('Vui lòng chọn ít nhất 1 sinh viên để gán');
            return;
        }

        setSaving(true);
        try {
            const res = await projectEnrollmentService.bulkAssign({
                semesterId: targetSemesterId,
                projectCatalogId: targetCatalogId,
                studentIds: selectedStudentIds,
            });
            if (res.success) {
                message.success(`Đã gán ${res.data?.created || selectedStudentIds.length} sinh viên`);
                setSelectedStudentIds([]);
                fetchRows();
                fetchAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gán hàng loạt');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await projectEnrollmentService.deleteEnrollment(id);
            if (res.success) {
                message.success('Đã xóa gán môn đồ án');
                fetchRows();
                fetchAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi xóa gán');
        }
    };

    const handleFixTopicCatalog = async () => {
        if (!topicToFix?.id || !topicFixCatalogId) {
            message.warning('Vui lòng chọn Tên đồ án cần gán');
            return;
        }
        setFixing(true);
        try {
            const res = await topicService.update(topicToFix.id, { projectCatalogId: topicFixCatalogId });
            if (res.success) {
                message.success('Đã cập nhật Tên đồ án cho đề tài');
                setTopicFixModalOpen(false);
                setTopicToFix(null);
                setTopicFixCatalogId(null);
                fetchAudit();
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

    const studentOptions = useMemo(
        () => students.map((s) => ({
            value: s.id,
            label: `${s.fullName} (${s.code || 'Chưa có mã'})`,
        })),
        [students]
    );

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
            title: 'Tên đồ án',
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
        {
            title: 'Nguồn gán',
            dataIndex: 'source',
            key: 'source',
            width: 110,
            align: 'center',
            render: (source) => {
                if (source === 'MANUAL') return <Tag color="blue" className="text-[11px] font-semibold">Thủ công</Tag>;
                if (source === 'EXCEL') return <Tag color="purple" className="text-[11px] font-semibold">Excel</Tag>;
                return <Tag className="text-[11px]">{source || 'Khác'}</Tag>;
            },
        },
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
                    <TeamOutlined /> Sinh viên ({rows.length})
                </span>
            ),
            children: (
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
                                type={showAssignPanel ? 'primary' : 'default'}
                                icon={<UserAddOutlined />}
                                onClick={() => setShowAssignPanel((prev) => !prev)}
                            >
                                {showAssignPanel ? 'Ẩn form gán' : 'Gán thủ công'}
                            </Button>
                            <Button
                                icon={<UploadOutlined />}
                                onClick={() => setIsExcelModalOpen(true)}
                            >
                                Gán bằng Excel
                            </Button>
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
                        <div className="bg-white rounded-lg border border-teal-200 bg-teal-50/20 p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <UserAddOutlined className="text-teal-700" />
                                    Gán Sinh viên Thủ công vào Đợt Đồ Án
                                </h4>
                                <span className="text-xs text-slate-600 font-medium">Chọn 1 hoặc nhiều sinh viên</span>
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
                                    <Form.Item name="projectCatalogId" label="Tên đồ án" rules={[{ required: true }]}>
                                        <Select
                                            options={catalogOptions}
                                            value={filterCatalogId}
                                            onChange={updateFilterCatalog}
                                        />
                                    </Form.Item>
                                    <Form.Item name="studentId" label="Sinh viên (gán lẻ 1 bạn)">
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            options={studentOptions}
                                            allowClear
                                            placeholder="Tìm tên hoặc MSSV..."
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
                                    placeholder="Gõ mã số hoặc tên để chọn thêm sinh viên vào danh sách gán..."
                                    options={studentOptions}
                                    value={selectedStudentIds}
                                    onChange={setSelectedStudentIds}
                                    showSearch
                                    optionFilterProp="label"
                                />
                            </div>
                        </div>
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
                                <div className="text-xs text-amber-800 font-bold">Đã gán nhưng chưa đăng ký đề tài</div>
                                <div className="text-2xl font-black text-amber-900 mt-1">
                                    {audit?.enrolledWithoutTopicRegistration?.length || 0}
                                </div>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                                <div className="text-xs text-rose-800 font-bold">Đề tài thiếu tên danh mục</div>
                                <div className="text-2xl font-black text-rose-900 mt-1">
                                    {audit?.topicsMissingProjectCatalog?.length || 0}
                                </div>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                                <div className="text-xs text-blue-800 font-bold">Lệch quy tắc gán đồ án</div>
                                <div className="text-2xl font-black text-blue-900 mt-1">
                                    {audit?.registrationsRuleMismatch?.length || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        canAccessLecturers && {
            key: 'lecturers',
            label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                    <UserOutlined /> Giảng viên hướng dẫn
                </span>
            ),
            children: (
                <LecturerAssignmentTab
                    semesterId={filterSemesterId}
                    projectCatalogId={filterCatalogId}
                    semesters={semesters}
                    catalogs={catalogs}
                    user={user}
                    onRefreshOverview={fetchRows}
                />
            ),
        },
    ].filter(Boolean);

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="eyebrow text-teal-700 font-bold tracking-wider">PROJECT COORDINATION HUB</p>
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
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên đồ án:</span>
                        <Select
                            placeholder="Tất cả tên đồ án"
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
                title="Gán tên đồ án cho đề tài"
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
                        placeholder="Chọn Tên đồ án"
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
                onSuccess={() => {
                    fetchRows();
                    fetchAudit();
                }}
                type="PROJECT_ENROLLMENT"
                semesters={semesters}
                catalogs={catalogs}
                onDownloadTemplate={() => projectEnrollmentService.downloadTemplate()}
                onExecuteImport={(payload) => projectEnrollmentService.importEnrollmentsExcel(payload)}
            />
        </div>
    );
}

export default ProjectEnrollmentPage;
