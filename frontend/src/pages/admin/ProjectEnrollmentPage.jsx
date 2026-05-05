import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, message, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

import PageHeader from '../../components/common/PageHeader';
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

    const handleAssignByExcelPlaceholder = () => {
        message.info('Tính năng gán bằng Excel đang thực hiện');
    };

    const renderEnrollmentStatus = (status) => (
        status === 'ACTIVE' ? <Tag color="green">Đang hiệu lực</Tag> : <Tag color="default">Đã hủy</Tag>
    );

    const renderEnrollmentSource = (source) => {
        if (source === 'MANUAL') return <Tag color="blue">Thủ công</Tag>;
        if (source === 'EXCEL') return <Tag color="purple">Excel</Tag>;
        return <Tag>{source || 'Khác'}</Tag>;
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
            const enrolledWithoutTopicRegistration = activeEnrollments.filter(
                (row) => !registeredStudentIds.has(row.studentId),
            );

            const topicsMissingProjectCatalog = topics.filter((row) => !row.projectCatalogId);

            const enrollmentKeySet = new Set(
                activeEnrollments.map(
                    (row) => `${row.studentId}-${row.semesterId}-${row.projectCatalogId}`,
                ),
            );
            const registrationsRuleMismatch = activeRegistrations.map((row) => {
                const projectCatalogId = row.topic?.projectCatalogId;
                if (!projectCatalogId) {
                    return {
                        ...row,
                        mismatchReason: 'TOPIC_MISSING_PROJECT_CATALOG',
                    };
                }
                const key = `${row.studentId}-${row.semesterId}-${projectCatalogId}`;
                if (!enrollmentKeySet.has(key)) {
                    return {
                        ...row,
                        mismatchReason: 'MISSING_MATCHED_ENROLLMENT',
                    };
                }
                return null;
            }).filter(Boolean);

            setAudit({
                enrolledWithoutTopicRegistration,
                topicsMissingProjectCatalog,
                registrationsRuleMismatch,
            });
        } catch (error) {
            message.error(error?.message || 'Khong the doi soat du lieu');
        } finally {
            setAuditLoading(false);
        }
    }, [filterSemesterId]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    const semesterOptions = useMemo(
        () => semesters.map((s) => ({ value: s.id, label: formatSemesterLabel(s) })),
        [semesters],
    );
    const catalogOptions = useMemo(
        () => catalogs.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
        [catalogs],
    );
    const studentOptions = useMemo(
        () => students.map((s) => ({ value: s.id, label: `${s.fullName} - ${s.code}` })),
        [students],
    );

    const handleAssignSingle = async (values) => {
        try {
            setSaving(true);
            const payload = [{
                studentId: values.studentId,
                semesterId: values.semesterId,
                projectCatalogId: values.projectCatalogId,
                status: 'ACTIVE',
                source: 'MANUAL',
            }];
            const res = await projectEnrollmentService.bulkUpsert(payload);
            if (res.success) {
                message.success('Đã gán môn đồ án cho sinh viên');
                fetchRows();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể gán môn đồ án');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignBulk = async () => {
        const values = await form.validateFields(['semesterId', 'projectCatalogId']);
        if (!selectedStudentIds.length) {
            message.warning('Vui lòng chọn ít nhất 1 sinh viên');
            return;
        }
        try {
            setSaving(true);
            const items = selectedStudentIds.map((studentId) => ({
                studentId,
                semesterId: values.semesterId,
                projectCatalogId: values.projectCatalogId,
                status: 'ACTIVE',
                source: 'MANUAL',
            }));
            const res = await projectEnrollmentService.bulkUpsert(items);
            if (res.success) {
                message.success(`Đã cập nhật ${items.length} sinh viên`);
                setSelectedStudentIds([]);
                fetchRows();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể gán hàng loạt');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await projectEnrollmentService.deleteEnrollment(id);
            message.success('Đã xóa gán môn đồ án');
            fetchRows();
        } catch (error) {
            message.error(error?.message || 'Không thể xóa');
        }
    };

    const handleBackfillEnrollment = async (registration) => {
        const projectCatalogId = registration?.topic?.projectCatalogId;
        if (!projectCatalogId) {
            message.warning('Không thể backfill enrollment vì topic chưa có Tên đồ án.');
            return;
        }

        try {
            setFixing(true);
            const payload = [{
                studentId: registration.studentId,
                semesterId: registration.semesterId,
                projectCatalogId,
                status: 'ACTIVE',
                source: 'MANUAL',
            }];
            const res = await projectEnrollmentService.bulkUpsert(payload);
            if (res.success) {
                message.success('Đã backfill enrollment cho registration.');
                fetchRows();
                fetchAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể backfill enrollment');
        } finally {
            setFixing(false);
        }
    };

    const openTopicFixModal = (topic) => {
        setTopicToFix(topic);
        setTopicFixCatalogId(filterCatalogId || catalogs[0]?.id || null);
        setTopicFixModalOpen(true);
    };

    const handleFixTopicCatalog = async () => {
        if (!topicToFix?.id || !topicFixCatalogId) {
            message.warning('Vui lòng chọn Tên đồ án để cập nhật.');
            return;
        }
        try {
            setFixing(true);
            const res = await topicService.update(topicToFix.id, { projectCatalogId: topicFixCatalogId });
            if (res?.success !== false) {
                message.success('Đã cập nhật projectCatalog cho topic.');
                setTopicFixModalOpen(false);
                setTopicToFix(null);
                fetchRows();
                fetchAudit();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật projectCatalog cho topic');
        } finally {
            setFixing(false);
        }
    };

    const columns = [
        {
            title: 'Sinh viên',
            key: 'student',
            render: (_, row) => (
                <div>
                    <div className="font-semibold text-slate-900">{row.student?.fullName || 'Chưa có'}</div>
                    <div className="text-xs text-slate-500">{row.student?.code || 'Chưa có mã'}</div>
                </div>
            ),
        },
        {
            title: 'Đợt đồ án',
            key: 'semester',
            render: (_, row) => <span>{row.semester?.name || 'Chưa có'}</span>,
        },
        {
            title: 'Tên đồ án',
            key: 'catalog',
            render: (_, row) => <span>{row.projectCatalog?.name || 'Chưa có'}</span>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            align: 'center',
            render: renderEnrollmentStatus,
        },
        {
            title: 'Nguồn',
            dataIndex: 'source',
            key: 'source',
            width: 120,
            align: 'center',
            render: renderEnrollmentSource,
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 100,
            align: 'center',
            render: (_, row) => (
                <Popconfirm title="Xóa gán này?" onConfirm={() => handleDelete(row.id)}>
                    <Button danger size="small">Xóa</Button>
                </Popconfirm>
            ),
        },
    ];

    const auditColumnsByType = {
        enrolledWithoutTopicRegistration: [
            {
                title: 'Sinh viên',
                key: 'student',
                render: (_, row) => (
                    <div>
                    <div className="font-semibold text-slate-900">{row.student?.fullName || 'Chưa có'}</div>
                    <div className="text-xs text-slate-500">{row.student?.code || 'Chưa có mã'}</div>
                </div>
            ),
        },
            {
                title: 'Đợt đồ án',
                key: 'semester',
                render: (_, row) => <span>{row.semester?.name || 'Chưa có'}</span>,
            },
            {
                title: 'Tên đồ án',
                key: 'catalog',
                render: (_, row) => <span>{row.projectCatalog?.name || 'Chưa có'}</span>,
            },
        ],
        topicsMissingProjectCatalog: [
            { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
            { title: 'Đề tài', dataIndex: 'title', key: 'title' },
            {
                title: 'Đợt đồ án',
                key: 'semester',
                render: (_, row) => <span>{row.semester?.name || 'Chưa có'}</span>,
            },
            {
                title: 'Hành động',
                key: 'actions',
                width: 150,
                align: 'center',
                render: (_, row) => (
                    <Button size="small" type="primary" ghost onClick={() => openTopicFixModal(row)}>
                        Gán Tên đồ án
                    </Button>
                ),
            },
        ],
        registrationsRuleMismatch: [
            { title: 'Mã ĐK', dataIndex: 'id', key: 'id', width: 90 },
            {
                title: 'Sinh viên',
                key: 'student',
                render: (_, row) => (
                    <div>
                        <div className="font-semibold text-slate-900">{row.student?.fullName || 'Chưa có'}</div>
                        <div className="text-xs text-slate-500">{row.student?.code || 'Chưa có mã'}</div>
                    </div>
                ),
            },
            {
                title: 'Đề tài',
                key: 'topic',
                render: (_, row) => (
                    <div>
                        <div className="font-semibold text-slate-900">{row.topic?.title || 'Chưa có'}</div>
                        <div className="text-xs text-slate-500">
                            {row.topic?.projectCatalog?.name || 'Thiếu projectCatalog'}
                        </div>
                    </div>
                ),
            },
            { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130 },
            {
                title: 'Lý do lệch',
                key: 'mismatchReason',
                width: 220,
                render: (_, row) => {
                    if (row.mismatchReason === 'TOPIC_MISSING_PROJECT_CATALOG') {
                        return <Tag color="red">Topic thiếu Tên đồ án</Tag>;
                    }
                    if (row.mismatchReason === 'MISSING_MATCHED_ENROLLMENT') {
                        return <Tag color="orange">Thiếu enrollment khớp</Tag>;
                    }
                    return <Tag>Không xác định</Tag>;
                },
            },
            {
                title: 'Hành động',
                key: 'actions',
                width: 170,
                align: 'center',
                render: (_, row) => (
                    row.mismatchReason === 'MISSING_MATCHED_ENROLLMENT' ? (
                        <Button
                            size="small"
                            type="primary"
                            ghost
                            loading={fixing}
                            onClick={() => handleBackfillEnrollment(row)}
                        >
                            Bổ sung gán
                        </Button>
                    ) : (
                        <span className="text-xs text-slate-400">Cần sửa đề tài trước</span>
                    )
                ),
            },
        ],
    };

    return (
        <div className="py-2 space-y-4">
            <PageHeader
                title="Gán Môn Đồ Án"
                subtitle="Quản lý danh sách sinh viên đủ điều kiện đăng ký đề tài theo từng đợt và tên đồ án."
                actions={(
                    <Button icon={<UploadOutlined />} onClick={handleAssignByExcelPlaceholder}>
                        Gán bằng Excel
                    </Button>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Tổng gán hiện tại</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{rows.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-700">Đang hiệu lực</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{rows.filter((r) => r.status === 'ACTIVE').length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-600">Sinh viên đã chọn</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{selectedStudentIds.length}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <Form form={form} layout="vertical" onFinish={handleAssignSingle}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        <Form.Item name="studentId" label="Sinh viên (gán nhanh)">
                            <Select showSearch optionFilterProp="label" options={studentOptions} allowClear />
                        </Form.Item>
                        <div className="flex items-end gap-2 pb-1">
                            <Button type="primary" htmlType="submit" loading={saving}>Gán 1 sinh viên</Button>
                            <Button onClick={handleAssignBulk} loading={saving}>Gán ds đã chọn</Button>
                        </div>
                    </div>
                </Form>

                <div className="mt-3">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Chọn nhiều sinh viên</label>
                    <Select
                        mode="multiple"
                        className="w-full"
                        placeholder="Chọn sinh viên để gán hàng loạt"
                        options={studentOptions}
                        value={selectedStudentIds}
                        onChange={setSelectedStudentIds}
                        showSearch
                        optionFilterProp="label"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Đối soát dữ liệu theo quy tắc mới</h3>
                <p className="text-sm text-slate-600">
                    Kiểm tra nhanh các bản ghi có nguy cơ lệch với quy tắc đăng ký theo tên đồ án.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 font-semibold">SV đã có enrollment nhưng chưa đăng ký đề tài</div>
                        <div className="text-2xl font-black text-amber-800 mt-1">
                            {audit.enrolledWithoutTopicRegistration.length}
                        </div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-xs text-red-700 font-semibold">Đề tài thiếu tên đồ án</div>
                        <div className="text-2xl font-black text-red-800 mt-1">
                            {audit.topicsMissingProjectCatalog.length}
                        </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                        <div className="text-xs text-orange-700 font-semibold">Đăng ký lệch quy tắc mới</div>
                        <div className="text-2xl font-black text-orange-800 mt-1">
                            {audit.registrationsRuleMismatch.length}
                        </div>
                    </div>
                </div>

                <Space direction="vertical" className="w-full" size="middle">
                    <div>
                        <div className="font-semibold mb-2 text-slate-800">1) Gán đồ án chưa đăng ký đề tài</div>
                        <Table
                            rowKey="id"
                            loading={auditLoading}
                            columns={auditColumnsByType.enrolledWithoutTopicRegistration}
                            dataSource={audit.enrolledWithoutTopicRegistration}
                            pagination={{ pageSize: 5 }}
                        />
                    </div>
                    <div>
                        <div className="font-semibold mb-2 text-slate-800">2) Đề tài thiếu tên đồ án</div>
                        <Table
                            rowKey="id"
                            loading={auditLoading}
                            columns={auditColumnsByType.topicsMissingProjectCatalog}
                            dataSource={audit.topicsMissingProjectCatalog}
                            pagination={{ pageSize: 5 }}
                        />
                    </div>
                    <div>
                        <div className="font-semibold mb-2 text-slate-800">3) Đăng ký lệch quy tắc gán</div>
                        <Table
                            rowKey="id"
                            loading={auditLoading}
                            columns={auditColumnsByType.registrationsRuleMismatch}
                            dataSource={audit.registrationsRuleMismatch}
                            pagination={{ pageSize: 5 }}
                        />
                    </div>
                </Space>
            </div>

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
        </div>
    );
}

export default ProjectEnrollmentPage;
