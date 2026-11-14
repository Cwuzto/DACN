import { useLecturerAssignments, useAvailableLecturers, useLecturerAssignmentMutation } from '../../queries/lecturerAssignmentQueries';
import { useUsers } from '../../queries/userQueries';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../common/QueryPanel';
import { useMemo, useState } from 'react';
import {
    Table,
    Button,
    Input,
    Select,
    Tag,
    Modal,
    Form,
    InputNumber,
    Popconfirm,
    message,
    Tooltip,
    Space,
    Upload,
} from 'antd';
import {
    PlusOutlined,
    UploadOutlined,
    CopyOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SearchOutlined,
    DownloadOutlined,
    WarningOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const EMPTY_LIST = [];

export function LecturerAssignmentTab({
    semesterId,
    projectCatalogId,
    semesters = [],
    catalogs = [],
    user,
}) {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);

    // Permissions
    const canManage = useMemo(() => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        const permissions = user.permissions || EMPTY_LIST;
        return (
            permissions.includes('PERMISSION_ASSIGN_ACADEMIC') ||
            permissions.includes('MENTOR_ASSIGN') ||
            permissions.includes('ENROLLMENT_MANAGE')
        );
    }, [user]);

    // Modals
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm] = Form.useForm();

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [editForm] = Form.useForm();

    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [sourceSemesterId, setSourceSemesterId] = useState(null);

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importPreviewRows, setImportPreviewRows] = useState([]);

    const scope = queryKeys.scope(user);
    const assignmentsQuery = useLecturerAssignments(scope, { semesterId, projectCatalogId: projectCatalogId || undefined });
    const assignments = assignmentsQuery.data || EMPTY_LIST;
    const loading = assignmentsQuery.isFetching;
    const lecturersQuery = useUsers(scope, { role: 'LECTURER', status: 'active', limit: 1000 });
    const lecturers = lecturersQuery.data?.data || EMPTY_LIST;
    const [availableFilters, setAvailableFilters] = useState({ semesterId, projectCatalogId: projectCatalogId || undefined });
    const availableQuery = useAvailableLecturers(scope, availableFilters, createModalOpen);
    const availableLecturers = availableQuery.data || EMPTY_LIST;
    const loadingAvailable = availableQuery.isFetching;
    const fetchAvailableLecturers = (semId, catId) => setAvailableFilters({ semesterId: semId, projectCatalogId: catId || undefined });
    const sourceQuery = useLecturerAssignments(scope, { semesterId: sourceSemesterId }, copyModalOpen && Boolean(sourceSemesterId));
    const assignmentMutation = useLecturerAssignmentMutation(scope, semesterId);
    const fetchAssignments = () => assignmentsQuery.refetch();

    // Filter assignments by keyword & status
    const filteredAssignments = useMemo(() => {
        return assignments.filter((item) => {
            const lecturer = item.lecturer || {};
            const matchesSearch =
                !searchKeyword ||
                (lecturer.fullName && lecturer.fullName.toLowerCase().includes(searchKeyword.toLowerCase())) ||
                (lecturer.code && lecturer.code.toLowerCase().includes(searchKeyword.toLowerCase())) ||
                (lecturer.department && lecturer.department.toLowerCase().includes(searchKeyword.toLowerCase()));

            const matchesStatus = !statusFilter || item.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [assignments, searchKeyword, statusFilter]);

    // Create assignment handler
    const handleCreateAssignment = async (values) => {
        setCreating(true);
        try {
            const payload = {
                lecturerId: values.lecturerId,
                semesterId: values.semesterId || semesterId,
                projectCatalogId: values.projectCatalogId || projectCatalogId,
                plannedQuota: values.plannedQuota || 10,
                status: values.status || 'ACTIVE',
            };
            const res = await assignmentMutation.mutateAsync({ action: 'create', args: [payload] });
            if (res?.success) {
                message.success('Phân công giảng viên thành công');
                setCreateModalOpen(false);
                createForm.resetFields();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi phân công giảng viên');
        } finally {
            setCreating(false);
        }
    };

    // Open Edit modal
    const openEditModal = (item) => {
        setEditingItem(item);
        editForm.setFieldsValue({
            plannedQuota: item.plannedQuota,
            status: item.status,
        });
        setEditModalOpen(true);
    };

    // Update assignment handler
    const handleUpdateAssignment = async (values) => {
        if (!editingItem) return;
        setUpdating(true);
        try {
            const res = await assignmentMutation.mutateAsync({ action: 'update', args: [editingItem.id, {
                plannedQuota: values.plannedQuota,
                status: values.status,
            }] });
            if (res?.success) {
                message.success('Cập nhật chỉ tiêu thành công');
                setEditModalOpen(false);
                setEditingItem(null);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi cập nhật chỉ tiêu');
        } finally {
            setUpdating(false);
        }
    };

    // Delete / Close assignment handler
    const handleDeleteAssignment = async (item) => {
        try {
            const res = await assignmentMutation.mutateAsync({ action: 'deleteAssignment', args: [item.id, {
                closeIfActive: true,
            }] });
            if (res?.success) {
                message.success(res.message || 'Đã xử lý phân công giảng viên');
            }
        } catch (error) {
            message.error(error?.message || 'Không thể xóa phân công giảng viên');
        }
    };

    // Clone assignments from another semester
    const handleCopyAssignments = async () => {
        if (!sourceSemesterId) {
            message.warning('Vui lòng chọn đợt đồ án nguồn để sao chép');
            return;
        }
        setCopying(true);
        try {
            const sourceList = sourceQuery.data ?? (await sourceQuery.refetch({ throwOnError: true })).data ?? EMPTY_LIST;
            if (sourceList.length === 0) {
                message.info('Đợt đồ án nguồn không có phân công giảng viên nào');
                setCopying(false);
                return;
            }

            const items = sourceList.map((a) => ({
                lecturerId: a.lecturerId,
                semesterId: Number(semesterId),
                projectCatalogId: a.projectCatalogId,
                plannedQuota: a.plannedQuota || 10,
                status: 'ACTIVE',
            }));

            const res = await assignmentMutation.mutateAsync({ action: 'bulkUpsert', args: [items] });
            if (res?.success) {
                message.success(
                    `Đã sao chép ${res.data?.created || 0} mới, cập nhật ${res.data?.updated || 0} phân công`
                );
                setCopyModalOpen(false);
                setSourceSemesterId(null);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi sao chép phân công');
        } finally {
            setCopying(false);
        }
    };

    // Download Excel Template for Lecturer Assignment
    const handleDownloadTemplate = () => {
        const headers = ['Mã Giảng Viên', 'Họ Và Tên (Tham khảo)', 'Mã Tên Đồ Án', 'Chỉ Tiêu Hướng Dẫn (1-10)'];
        const sampleRows = [
            ['GV001', 'Nguyễn Văn A', catalogs[0]?.code || 'DATN', 10],
            ['GV002', 'Trần Thị B', catalogs[0]?.code || 'DATN', 8],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mau_Phan_Cong_GV');
        XLSX.writeFile(wb, 'Mau_Phan_Cong_Giang_Vien.xlsx');
    };

    // Parse Excel File
    const handleFileUpload = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonRows.length < 2) {
                    message.error('File Excel không có dữ liệu');
                    return;
                }

                // Map header
                const rows = jsonRows.slice(1).filter((r) => r.length > 0 && r[0]);
                const parsed = rows.map((r, idx) => {
                    const lecturerCode = String(r[0] || '').trim();
                    const lecturerName = String(r[1] || '').trim();
                    const catalogCode = String(r[2] || '').trim();
                    const plannedQuota = Number(r[3]) || 10;

                    const matchedLecturer = lecturers.find(
                        (l) => l.code?.toLowerCase() === lecturerCode.toLowerCase()
                    );
                    const matchedCatalog = catalogs.find(
                        (c) => c.code?.toLowerCase() === catalogCode.toLowerCase()
                    ) || catalogs[0];

                    return {
                        key: idx,
                        lecturerCode,
                        lecturerName: matchedLecturer?.fullName || lecturerName,
                        lecturerId: matchedLecturer?.id,
                        projectCatalogId: matchedCatalog?.id,
                        catalogName: matchedCatalog?.name || catalogCode,
                        plannedQuota,
                        isValid: !!matchedLecturer && !!matchedCatalog,
                    };
                });

                setImportPreviewRows(parsed);
                setImportModalOpen(true);
            } catch {
                message.error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng.');
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    // Execute bulk upsert from Excel
    const handleExecuteImport = async () => {
        const validRows = importPreviewRows.filter((r) => r.isValid && r.lecturerId && r.projectCatalogId);
        if (validRows.length === 0) {
            message.warning('Không có dòng hợp lệ để phân công');
            return;
        }

        setImporting(true);
        try {
            const items = validRows.map((r) => ({
                lecturerId: r.lecturerId,
                semesterId: Number(semesterId),
                projectCatalogId: r.projectCatalogId,
                plannedQuota: r.plannedQuota,
                status: 'ACTIVE',
            }));

            const res = await assignmentMutation.mutateAsync({ action: 'bulkUpsert', args: [items] });
            if (res?.success) {
                message.success(
                    `Phân công thành công: Tạo mới ${res.data?.created || 0}, cập nhật ${res.data?.updated || 0}`
                );
                setImportModalOpen(false);
                setImportPreviewRows([]);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi nhập phân công từ Excel');
        } finally {
            setImporting(false);
        }
    };

    // Table columns definition
    const columns = [
        {
            title: 'Mã GV',
            key: 'code',
            width: 100,
            render: (_, row) => (
                <span className="font-mono text-xs font-bold text-slate-700">
                    {row.lecturer?.code || '—'}
                </span>
            ),
        },
        {
            title: 'Họ và tên',
            key: 'lecturer',
            render: (_, row) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-100">
                        {row.lecturer?.fullName?.[0]?.toUpperCase() || 'G'}
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-sm">
                            {row.lecturer?.fullName || 'Chưa cập nhật'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                            {row.lecturer?.email}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Bộ môn',
            key: 'department',
            width: 140,
            render: (_, row) => (
                <span className="text-xs text-slate-700">
                    {row.lecturer?.department || '—'}
                </span>
            ),
        },
        {
            title: 'Học vị',
            key: 'academicTitle',
            width: 110,
            render: (_, row) => (
                <Tag color="cyan" className="text-xs font-semibold">
                    {row.lecturer?.academicTitle || 'Giảng viên'}
                </Tag>
            ),
        },
        {
            title: 'Chỉ tiêu hướng dẫn',
            key: 'plannedQuota',
            width: 110,
            align: 'center',
            render: (_, row) => (
                <span className="font-black text-slate-900 text-sm">
                    {row.plannedQuota || 10}
                </span>
            ),
        },
        {
            title: 'Tải trong đợt',
            key: 'currentRoundLoad',
            width: 120,
            align: 'center',
            render: (_, row) => {
                const current = row.currentRoundLoad || 0;
                const quota = row.plannedQuota || 10;
                const isFull = current >= quota;
                return (
                    <div className="text-xs font-semibold">
                        <span className={isFull ? 'text-amber-600 font-bold' : 'text-slate-800'}>
                            {current}
                        </span>
                        <span className="text-slate-400"> / {quota}</span>
                    </div>
                );
            },
        },
        {
            title: 'Tải hôm nay',
            key: 'activeTodayLoad',
            width: 110,
            align: 'center',
            render: (_, row) => (
                <span className="text-xs font-semibold text-slate-700">
                    {row.activeTodayLoad || 0} / 10
                </span>
            ),
        },
        {
            title: 'Tải đỉnh đồng thời',
            key: 'peakConcurrentLoad',
            width: 150,
            align: 'center',
            render: (_, row) => {
                const peak = row.peakConcurrentLoad || 0;
                let color = 'green';
                let label = 'An toàn';
                if (peak >= 10) {
                    color = 'red';
                    label = 'Trần 10/10';
                } else if (peak >= 8) {
                    color = 'gold';
                    label = 'Cận tải';
                }
                return (
                    <Tag color={color} className="font-bold text-xs">
                        {peak} / 10 ({label})
                    </Tag>
                );
            },
        },
        {
            title: 'Khoảng đạt đỉnh',
            key: 'peakInterval',
            width: 140,
            align: 'center',
            render: (_, row) => {
                if (!row.peakInterval || !row.peakInterval.start) {
                    return <span className="text-slate-400 text-xs">—</span>;
                }
                const startStr = dayjs(row.peakInterval.start).format('DD/MM');
                const endStr = dayjs(row.peakInterval.end).format('DD/MM/YYYY');
                return (
                    <Tooltip title={`Thời điểm giao thoa đạt tải đỉnh: ${startStr} đến ${endStr}`}>
                        <span className="text-[11px] text-slate-600 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {startStr} - {endStr}
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 110,
            align: 'center',
            render: (_, row) => {
                if (row.status === 'ACTIVE') {
                    return <Tag color="green" className="font-semibold text-xs">Hiệu lực</Tag>;
                }
                if (row.status === 'DRAFT') {
                    return <Tag color="blue" className="text-xs">Bản nháp</Tag>;
                }
                return <Tag color="default" className="text-xs">Đã đóng</Tag>;
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 100,
            align: 'center',
            render: (_, row) => (
                <Space size="small">
                    <Tooltip title={canManage ? 'Sửa chỉ tiêu' : 'Chỉ có quyền xem'}>
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            disabled={!canManage}
                            onClick={() => openEditModal(row)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa hoặc đóng phân công?"
                        description="Nếu GV đang có SV làm đề tài, phân công sẽ được chuyển sang Đã đóng."
                        onConfirm={() => handleDeleteAssignment(row)}
                        okText="Đồng ý"
                        cancelText="Hủy"
                        disabled={!canManage}
                    >
                        <Tooltip title={canManage ? 'Xóa/Đóng phân công' : 'Chỉ có quyền xem'}>
                            <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                disabled={!canManage}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <QueryPanel query={assignmentsQuery}>
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm giảng viên theo tên, mã số, bộ môn..."
                        style={{ maxWidth: 300 }}
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        allowClear
                    />
                    <Select
                        placeholder="Trạng thái"
                        style={{ width: 140 }}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        allowClear
                        options={[
                            { value: 'ACTIVE', label: 'Hiệu lực' },
                            { value: 'DRAFT', label: 'Bản nháp' },
                            { value: 'CLOSED', label: 'Đã đóng' },
                        ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchAssignments} loading={loading}>
                        Làm mới
                    </Button>
                </div>

                {canManage && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                const targetCatId = projectCatalogId ? Number(projectCatalogId) : catalogs[0]?.id;
                                createForm.resetFields();
                                createForm.setFieldsValue({
                                    semesterId: Number(semesterId),
                                    projectCatalogId: targetCatId,
                                    plannedQuota: 10,
                                    status: 'ACTIVE',
                                });
                                fetchAvailableLecturers(semesterId, targetCatId);
                                setCreateModalOpen(true);
                            }}
                        >
                            Phân công Giảng viên
                        </Button>
                        <Upload
                            beforeUpload={handleFileUpload}
                            showUploadList={false}
                            accept=".xlsx, .xls"
                        >
                            <Button icon={<UploadOutlined />}>Import Excel GVHD</Button>
                        </Upload>
                        <Button
                            icon={<CopyOutlined />}
                            onClick={() => {
                                setSourceSemesterId(null);
                                setCopyModalOpen(true);
                            }}
                        >
                            Sao chép phân công
                        </Button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredAssignments}
                    loading={loading}
                    pagination={{ pageSize: 15, showSizeChanger: true }}
                    locale={{
                        emptyText: (
                            <div className="py-8 text-center text-slate-500 font-medium">
                                Chưa có giảng viên nào được phân công trong đợt này.
                            </div>
                        ),
                    }}
                />
            </div>

            {/* Modal 1: Phân công Giảng viên mới */}
            <Modal
                title="Phân công Giảng viên vào Đợt Đồ án"
                open={createModalOpen}
                onCancel={() => setCreateModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <QueryPanel query={availableQuery}>
                <Form
                    form={createForm}
                    layout="vertical"
                    onFinish={handleCreateAssignment}
                    className="pt-2"
                >
                    <Form.Item
                        name="lecturerId"
                        label="Giảng viên"
                        rules={[{ required: true, message: 'Vui lòng chọn giảng viên' }]}
                        extra={
                            <span className="text-[11px] text-slate-500">
                                Chỉ hiển thị các giảng viên khả dụng chưa được phân công và còn chỉ tiêu trong đợt này.
                            </span>
                        }
                    >
                        <Select
                            showSearch
                            loading={loadingAvailable}
                            placeholder="Tìm theo tên hoặc mã GV khả dụng..."
                            optionFilterProp="label"
                            options={availableLecturers.map((l) => ({
                                value: l.id,
                                label: `${l.fullName} (${l.code || 'Chưa có mã'}) - ${l.department || 'Bộ môn'}${l.availableQuota !== undefined ? ` (Tối đa ${l.availableQuota} chỉ tiêu)` : ''}`,
                            }))}
                            notFoundContent={
                                <div className="py-2 text-center text-xs text-slate-500">
                                    Không có giảng viên khả dụng (đã được phân công hoặc đã hết chỉ tiêu trong đợt này)
                                </div>
                            }
                            onChange={(selectedLecturerId) => {
                                const selected = availableLecturers.find((l) => l.id === selectedLecturerId);
                                if (selected && selected.availableQuota) {
                                    const currentQuota = createForm.getFieldValue('plannedQuota') || 10;
                                    createForm.setFieldsValue({
                                        plannedQuota: Math.min(currentQuota, selected.availableQuota),
                                    });
                                }
                            }}
                        />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item
                            name="semesterId"
                            label="Đợt đồ án"
                            rules={[{ required: true, message: 'Vui lòng chọn đợt' }]}
                        >
                            <Select
                                disabled
                                options={semesters.map((s) => ({ value: s.id, label: s.name }))}
                            />
                        </Form.Item>
                        <Form.Item
                            name="projectCatalogId"
                            label="Tên đồ án"
                            rules={[{ required: true, message: 'Vui lòng chọn loại đồ án' }]}
                        >
                            <Select
                                options={catalogs.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                                onChange={(newCatId) => {
                                    createForm.setFieldsValue({ lecturerId: undefined });
                                    fetchAvailableLecturers(semesterId, newCatId);
                                }}
                            />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item
                            name="plannedQuota"
                            label="Chỉ tiêu hướng dẫn"
                            rules={[{ required: true, message: 'Nhập chỉ tiêu từ 1 đến 10' }]}
                            tooltip="Giới hạn tối đa 10 sinh viên cho một giảng viên tại bất kỳ thời điểm nào"
                        >
                            <InputNumber min={1} max={10} className="w-full" />
                        </Form.Item>
                        <Form.Item name="status" label="Trạng thái ban đầu">
                            <Select
                                options={[
                                    { value: 'ACTIVE', label: 'Hiệu lực' },
                                    { value: 'DRAFT', label: 'Bản nháp' },
                                ]}
                            />
                        </Form.Item>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={creating}>
                            Lưu phân công
                        </Button>
                    </div>
                </Form>
            </QueryPanel>
            </Modal>

            {/* Modal 2: Sửa chỉ tiêu */}
            <Modal
                title="Chỉnh sửa Chỉ tiêu Hướng dẫn"
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <div className="py-2 space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Giảng viên:</p>
                    <p className="font-bold text-slate-800">
                        {editingItem?.lecturer?.fullName} ({editingItem?.lecturer?.code})
                    </p>
                </div>
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleUpdateAssignment}
                    className="pt-2"
                >
                    <Form.Item
                        name="plannedQuota"
                        label="Chỉ tiêu hướng dẫn (1-10)"
                        rules={[{ required: true, message: 'Chỉ tiêu từ 1 đến 10' }]}
                    >
                        <InputNumber min={1} max={10} className="w-full" />
                    </Form.Item>
                    <Form.Item name="status" label="Trạng thái">
                        <Select
                            options={[
                                { value: 'ACTIVE', label: 'Hiệu lực' },
                                { value: 'DRAFT', label: 'Bản nháp' },
                                { value: 'CLOSED', label: 'Đã đóng' },
                            ]}
                        />
                    </Form.Item>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button onClick={() => setEditModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={updating}>
                            Cập nhật
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Modal 3: Sao chép phân công */}
            <Modal
                title="Sao chép Phân công Giảng viên từ Đợt khác"
                open={copyModalOpen}
                onCancel={() => setCopyModalOpen(false)}
                onOk={handleCopyAssignments}
                confirmLoading={copying}
                okText="Bắt đầu sao chép"
                cancelText="Hủy"
            >
                <QueryPanel query={sourceQuery} />
                <div className="space-y-3 py-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Hệ thống sẽ lấy toàn bộ danh sách phân công và chỉ tiêu giảng viên từ đợt nguồn được chọn để thiết lập cho đợt hiện tại. Các phân công trùng lặp sẽ được cập nhật lại chỉ tiêu.
                    </p>
                    <Select
                        className="w-full"
                        placeholder="Chọn đợt đồ án nguồn..."
                        value={sourceSemesterId}
                        onChange={setSourceSemesterId}
                        options={semesters
                            .filter((s) => s.id !== Number(semesterId))
                            .map((s) => ({ value: s.id, label: s.name }))}
                    />
                </div>

            </Modal>

            {/* Modal 4: Import Excel Preview */}
            <Modal
                title="Xem trước Import Phân công Giảng viên từ Excel"
                open={importModalOpen}
                onCancel={() => {
                    setImportModalOpen(false);
                    setImportPreviewRows([]);
                }}
                onOk={handleExecuteImport}
                confirmLoading={importing}
                okText={`Xác nhận Import (${importPreviewRows.filter((r) => r.isValid).length} hợp lệ)`}
                cancelText="Hủy"
                width={720}
            >
                <QueryPanel query={lecturersQuery}>
                <div className="space-y-3 py-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium">
                            Tìm thấy {importPreviewRows.length} dòng ({importPreviewRows.filter((r) => r.isValid).length} hợp lệ, {importPreviewRows.filter((r) => !r.isValid).length} không hợp lệ)
                        </span>
                        <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={handleDownloadTemplate}
                        >
                            Tải file mẫu
                        </Button>
                    </div>

                    <Table
                        size="small"
                        rowKey="key"
                        pagination={{ pageSize: 5 }}
                        dataSource={importPreviewRows}
                        columns={[
                            { title: 'Mã GV', dataIndex: 'lecturerCode', key: 'lecturerCode' },
                            { title: 'Tên GV', dataIndex: 'lecturerName', key: 'lecturerName' },
                            { title: 'Tên Đồ án', dataIndex: 'catalogName', key: 'catalogName' },
                            { title: 'Chỉ tiêu hướng dẫn', dataIndex: 'plannedQuota', key: 'plannedQuota' },
                            {
                                title: 'Trạng thái dòng',
                                key: 'status',
                                render: (_, r) =>
                                    r.isValid ? (
                                        <Tag color="green">Hợp lệ</Tag>
                                    ) : (
                                        <Tag color="red">Mã GV/Môn không khớp</Tag>
                                    ),
                            },
                        ]}
                    />
                </div>
            </QueryPanel>
            </Modal>
        </div>
        </QueryPanel>
    );
}

export default LecturerAssignmentTab;
