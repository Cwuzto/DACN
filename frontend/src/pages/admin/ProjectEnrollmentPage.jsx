import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, message, Modal, Popconfirm, Select, Space, Table, Tag, Tabs } from 'antd';
import {
    UploadOutlined,
    DownloadOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SearchOutlined,
    FilterOutlined,
    DeleteOutlined,
} from '@ant-design/icons';

import PageHeader from '../../components/common/PageHeader';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import projectEnrollmentService from '../../services/projectEnrollmentService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import { topicService } from '../../services/topicService';
import userService from '../../services/userService';
import { formatSemesterLabel } from '../../utils/semesterDisplay';

function ProjectEnrollmentPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [semesters, setSemesters] = useState([]);
    const [catalogs, setCatalogs] = useState([]);
    const [students, setStudents] = useState([]);
    const [rows, setRows] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [audit, setAudit] = useState({
        enrolledWithoutTopicRegistration: [],
        topicsMissingProjectCatalog: [],
        registrationsRuleMismatch: [],
    });

    const [filterSemesterId, setFilterSemesterId] = useState(null);
    const [filterCatalogId, setFilterCatalogId] = useState(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [fixing, setFixing] = useState(false);
    const [topicFixModalOpen, setTopicFixModalOpen] = useState(false);
    const [topicToFix, setTopicToFix] = useState(null);
    const [topicFixCatalogId, setTopicFixCatalogId] = useState(null);

    const [form] = Form.useForm();
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showAssignPanel, setShowAssignPanel] = useState(false);

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

    const renderEnrollmentStatus = (status) => (
        status === 'ACTIVE'
            ? <Tag color="green" className="font-semibold text-[11px] px-2.5 py-0.5 rounded-full">Đang hiệu lực</Tag>
            : <Tag color="default" className="text-[11px] px-2.5 py-0.5 rounded-full">Đã hủy</Tag>
    );

    const renderEnrollmentSource = (source) => {
        if (source === 'MANUAL') return <Tag color="blue" className="text-[11px] font-semibold">Thủ công</Tag>;
        if (source === 'EXCEL') return <Tag color="purple" className="text-[11px] font-semibold">Excel</Tag>;
        return <Tag className="text-[11px]">{source || 'Khác'}</Tag>;
    };

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
                    const preferred = list.find((s) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(s.status)) || list[0];
                    setFilterSemesterId(preferred?.id || null);
                    form.setFieldsValue({ semesterId: preferred?.id || null });
                }
            }
            if (catalogRes.success) {
                setCatalogs(catalogRes.data || []);
                if (!filterCatalogId && (catalogRes.data || []).length > 0) {
                    setFilterCatalogId(catalogRes.data[0].id);
                    form.setFieldsValue({ projectCatalogId: catalogRes.data[0].id });
                }
            }
            if (studentRes.success) {
                setStudents(studentRes.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu tham chiếu');
        }
    }, [filterCatalogId, filterSemesterId, form]);

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

            const activeEnrollments = enrollments.filter((row) => row.status === 'ACTIVE');
            const activeRegistrations = registrations.filter((row) => row.status !== 'REJECTED');

            const registeredStudentIds = new Set(activeRegistrations.map((row) => row.studentId));
            const enrolledWithoutTopic = activeEnrollments.filter((row) => !registeredStudentIds.has(row.studentId));

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
            message.error(error?.message || 'Không thể đối soát dữ liệu');
        } finally {
            setAuditLoading(false);
        }
    }, [filterSemesterId]);

    const runAudit = useCallback(() => {
        fetchAudit();
    }, [fetchAudit]);

    useEffect(() => {
        runAudit();
    }, [runAudit]);

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

    const handleAssignSingle = async (values) => {
        if (!values.studentId) {
            message.warning('Vui lòng chọn 1 sinh viên');
            return;
        }
        setSaving(true);
        try {
            const res = await projectEnrollmentService.createEnrollment({
                semesterId: values.semesterId,
                projectCatalogId: values.projectCatalogId,
                studentId: values.studentId,
            });
            if (res.success) {
                message.success('Gán môn đồ án thành công');
                form.setFieldsValue({ studentId: null });
                fetchRows();
                runAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gán môn đồ án');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignBulk = async () => {
        const semesterId = form.getFieldValue('semesterId') || filterSemesterId;
        const projectCatalogId = form.getFieldValue('projectCatalogId') || filterCatalogId;

        if (!semesterId || !projectCatalogId) {
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
                semesterId,
                projectCatalogId,
                studentIds: selectedStudentIds,
            });
            if (res.success) {
                message.success(`Đã gán ${res.data?.created || selectedStudentIds.length} sinh viên`);
                setSelectedStudentIds([]);
                fetchRows();
                runAudit();
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
                runAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi xóa gán');
        }
    };

    const openTopicFixModal = (topic) => {
        setTopicToFix(topic);
        setTopicFixCatalogId(null);
        setTopicFixModalOpen(true);
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
                runAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật đề tài');
        } finally {
            setFixing(false);
        }
    };

    const handleBackfillEnrollment = async (reg) => {
        if (!reg.semesterId || !reg.topic?.projectCatalogId || !reg.studentId) {
            message.warning('Thiếu dữ liệu để tạo gán khớp');
            return;
        }
        setFixing(true);
        try {
            const res = await projectEnrollmentService.createEnrollment({
                semesterId: reg.semesterId,
                projectCatalogId: reg.topic.projectCatalogId,
                studentId: reg.studentId,
            });
            if (res.success) {
                message.success('Đã bổ sung gán khớp cho sinh viên');
                fetchRows();
                runAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể bổ sung gán');
        } finally {
            setFixing(false);
        }
    };

    const columns = [
        {
            title: 'Sinh viên',
            key: 'student',
            render: (_, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center font-bold text-xs shrink-0">
                        {row.student?.fullName?.[0]?.toUpperCase() || 'S'}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                            {row.student?.fullName || 'Chưa có tên'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
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
            render: renderEnrollmentStatus,
        },
        {
            title: 'Nguồn gán',
            dataIndex: 'source',
            key: 'source',
            width: 110,
            align: 'center',
            render: renderEnrollmentSource,
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

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title="Gán Môn Đồ Án"
                subtitle="Quản lý danh sách sinh viên đủ điều kiện làm Khóa luận / Đồ án tốt nghiệp theo từng học kỳ"
                actions={
                    <div className="flex items-center gap-2.5">
                        <Button
                            type={showAssignPanel ? 'default' : 'dashed'}
                            icon={<UserAddOutlined />}
                            onClick={() => setShowAssignPanel((prev) => !prev)}
                        >
                            {showAssignPanel ? 'Ẩn form gán' : 'Gán thủ công'}
                        </Button>
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => setIsExcelModalOpen(true)}
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-semibold"
                        >
                            Gán bằng Excel
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            loading={exporting}
                            onClick={handleExport}
                        >
                            Xuất Excel
                        </Button>
                    </div>
                }
            />

            {/* 3 Metric Stat Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng sinh viên đã gán</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{rows.length}</p>
                </div>
                <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Đang có hiệu lực</p>
                    <p className="text-2xl font-black text-emerald-800 mt-1">
                        {rows.filter((r) => r.status === 'ACTIVE').length}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sinh viên đang chọn (hàng loạt)</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{selectedStudentIds.length}</p>
                </div>
            </div>

            {/* Manual Assignment Panel (Expandable) */}
            {showAssignPanel && (
                <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">person_add</span>
                            Gán Sinh viên Thủ công vào Đợt Đồ Án
                        </h4>
                        <span className="text-xs text-slate-400">Chọn 1 hoặc nhiều sinh viên</span>
                    </div>

                    <Form form={form} layout="vertical" onFinish={handleAssignSingle}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true }]}>
                                <Select
                                    options={semesterOptions}
                                    value={filterSemesterId}
                                    onChange={(value) => {
                                        setFilterSemesterId(value);
                                        form.setFieldsValue({ semesterId: value });
                                    }}
                                />
                            </Form.Item>
                            <Form.Item name="projectCatalogId" label="Tên đồ án" rules={[{ required: true }]}>
                                <Select
                                    options={catalogOptions}
                                    value={filterCatalogId}
                                    onChange={(value) => {
                                        setFilterCatalogId(value);
                                        form.setFieldsValue({ projectCatalogId: value });
                                    }}
                                />
                            </Form.Item>
                            <Form.Item name="studentId" label="Sinh viên (gán lẻ 1 bạn)">
                                <Select showSearch optionFilterProp="label" options={studentOptions} allowClear placeholder="Tìm tên hoặc MSSV..." />
                            </Form.Item>
                            <div className="flex items-end gap-2 pb-1">
                                <Button type="primary" htmlType="submit" loading={saving}>Gán 1 SV</Button>
                                <Button onClick={handleAssignBulk} loading={saving} disabled={selectedStudentIds.length === 0}>
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

            {/* Filter & Data Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Table Header Filter Toolbar */}
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
                    <div className="flex items-center gap-3 flex-wrap flex-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lọc theo:</span>
                        <Select
                            placeholder="Đợt đồ án"
                            style={{ minWidth: 230 }}
                            value={filterSemesterId}
                            onChange={setFilterSemesterId}
                            options={semesterOptions}
                        />
                        <Select
                            placeholder="Tên đồ án"
                            style={{ minWidth: 220 }}
                            value={filterCatalogId}
                            onChange={setFilterCatalogId}
                            options={catalogOptions}
                            allowClear
                        />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                        Hiển thị {rows.length} sinh viên
                    </span>
                </div>

                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    locale={{
                        emptyText: (
                            <div className="py-8 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 block">school</span>
                                Chưa có sinh viên nào được gán vào đợt đồ án này.
                            </div>
                        ),
                    }}
                />
            </div>

            {/* Audit Section Accordion */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Đối soát Tính Toàn Vẹn Quy Tắc Gán
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tự động phát hiện sinh viên chưa đăng ký đề tài hoặc lệch thông tin học kỳ
                        </p>
                    </div>
                    <Button size="small" onClick={runAudit} loading={auditLoading}>
                        Quét lại
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                        <div className="text-xs text-amber-800 font-bold">Đã gán nhưng chưa đăng ký đề tài</div>
                        <div className="text-2xl font-black text-amber-900 mt-1">
                            {audit.enrolledWithoutTopicRegistration.length}
                        </div>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                        <div className="text-xs text-rose-800 font-bold">Đề tài thiếu tên danh mục</div>
                        <div className="text-2xl font-black text-rose-900 mt-1">
                            {audit.topicsMissingProjectCatalog.length}
                        </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                        <div className="text-xs text-blue-800 font-bold">Lệch quy tắc gán đồ án</div>
                        <div className="text-2xl font-black text-blue-900 mt-1">
                            {audit.registrationsRuleMismatch.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Sửa Đề tài */}
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
                    runAudit();
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
