import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Divider,
    Drawer,
    Empty,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Popconfirm,
    Row,
    Space,
    Table,
    Tag,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    UnlockOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/common/PageHeader';
import rubricService from '../../services/rubricService';

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

export default function RubricManagementPage() {
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState([]);
    const [systemEditable, setSystemEditable] = useState(false);
    const [systemEditableReason, setSystemEditableReason] = useState('');

    // Modal / Drawer state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState('create'); // 'create', 'edit', 'view'
    const [editingRubric, setEditingRubric] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form state for Editor
    const [formVersion, setFormVersion] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategories, setFormCategories] = useState([]);

    // Clone Modal state
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [cloneSourceId, setCloneSourceId] = useState(null);
    const [cloneVersionName, setCloneVersionName] = useState('');
    const [cloneTitle, setCloneTitle] = useState('');
    const [cloning, setCloning] = useState(false);

    // Tải danh sách các phiên bản Rubric
    const fetchRubrics = async () => {
        try {
            setLoading(true);
            const res = await rubricService.getRubricVersions();
            if (res.success && res.data) {
                setVersions(res.data.versions || []);
                setSystemEditable(Boolean(res.data.systemEditable));
                setSystemEditableReason(res.data.systemEditableReason || '');
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải danh sách Rubric');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRubrics();
    }, []);

    // Mở editor tạo mới
    const handleOpenCreate = () => {
        setEditorMode('create');
        setEditingRubric(null);
        setFormVersion(`v${versions.length + 1}`);
        setFormTitle(`Barem đánh giá bảo vệ đồ án tốt nghiệp khóa mới`);
        setFormDescription('Barem đánh giá chuẩn hóa theo quy chế học vụ.');
        setFormCategories([
            {
                id: 'cat_new_1',
                code: 'CAT_REPORT_FORMAT',
                name: '1. Hình thức và kỹ năng trình bày báo cáo',
                description: 'Đánh giá cấu trúc, bố cục và hình thức trình bày',
                maxScore: 1.0,
                criteria: [
                    {
                        id: 'cri_1_1',
                        code: 'STRUCTURE',
                        label: 'Cấu trúc, bố cục đề tài',
                        description: 'Bố cục cân đối các chương mục, tuân thủ định dạng chuẩn.',
                        maxScore: 0.5,
                    },
                    {
                        id: 'cri_1_2',
                        code: 'CITATION_FORMAT',
                        label: 'Trích dẫn, hình thức trình bày',
                        description: 'Trích dẫn tài liệu đúng chuẩn, bảng biểu rõ ràng.',
                        maxScore: 0.5,
                    },
                ],
            },
            {
                id: 'cat_new_2',
                code: 'CAT_RESEARCH_CONTENT',
                name: '2. Nội dung và kết quả nghiên cứu',
                description: 'Đánh giá nội dung chuyên môn và sản phẩm thực nghiệm',
                maxScore: 5.0,
                criteria: [
                    {
                        id: 'cri_2_1',
                        code: 'RESEARCH_CONTENT',
                        label: 'Nội dung nghiên cứu và giải pháp',
                        description: 'Kiến trúc hệ thống hoàn chỉnh, đáp ứng đầy đủ yêu cầu.',
                        maxScore: 5.0,
                    },
                ],
            },
            {
                id: 'cat_new_3',
                code: 'CAT_DEFENSE_QA',
                name: '3. Thuyết trình và trả lời câu hỏi Hội đồng',
                description: 'Đánh giá kỹ năng báo cáo và phản biện',
                maxScore: 4.0,
                criteria: [
                    {
                        id: 'cri_3_1',
                        code: 'PRESENTATION_SKILL',
                        label: 'Kỹ năng thuyết trình và tác phong',
                        description: 'Tự tin, mạch lạc, làm chủ thời gian.',
                        maxScore: 2.0,
                    },
                    {
                        id: 'cri_3_2',
                        code: 'QA_RESPONSE',
                        label: 'Trả lời các câu hỏi phản biện',
                        description: 'Hiểu sâu vấn đề, lập luận thuyết phục.',
                        maxScore: 2.0,
                    },
                ],
            },
        ]);
        setEditorOpen(true);
    };

    // Mở editor xem chi tiết hoặc chỉnh sửa
    const handleOpenEditOrView = async (rubricId, mode = 'edit') => {
        try {
            setLoading(true);
            const res = await rubricService.getRubricById(rubricId);
            if (!res.success || !res.data) return;

            const r = res.data;
            setEditingRubric(r);
            setEditorMode(mode);
            setFormVersion(r.version);
            setFormTitle(r.title);
            setFormDescription(r.description || '');
            setFormCategories(
                (r.categories || []).map((cat) => ({
                    ...cat,
                    criteria: (cat.criteria || []).map((cri) => ({ ...cri })),
                }))
            );
            setEditorOpen(true);
        } catch (error) {
            message.error(error.message || 'Không thể tải chi tiết phiên bản Rubric');
        } finally {
            setLoading(false);
        }
    };

    // Mở modal nhân bản (Clone)
    const handleOpenClone = (rubric) => {
        setCloneSourceId(rubric.id);
        setCloneVersionName(`v${versions.length + 1}`);
        setCloneTitle(`Bản sao của ${rubric.title}`);
        setCloneModalOpen(true);
    };

    // Thực hiện nhân bản
    const handleCloneSubmit = async () => {
        if (!cloneVersionName.trim()) {
            message.warning('Vui lòng nhập mã phiên bản mới');
            return;
        }
        try {
            setCloning(true);
            const res = await rubricService.createRubric({
                version: cloneVersionName.trim().toLowerCase(),
                title: cloneTitle.trim(),
                cloneFromId: cloneSourceId,
            });

            if (res.success) {
                message.success('Đã nhân bản phiên bản mới thành công!');
                setCloneModalOpen(false);
                fetchRubrics();
                handleOpenEditOrView(res.data.id, 'edit');
            }
        } catch (error) {
            message.error(error.message || 'Nhân bản thất bại');
        } finally {
            setCloning(false);
        }
    };

    // Kích hoạt phiên bản
    const handleActivate = async (rubricId) => {
        try {
            setLoading(true);
            const res = await rubricService.activateRubric(rubricId);
            if (res.success) {
                message.success('Đã kích hoạt phiên bản làm Barem chính thức của hệ thống!');
                fetchRubrics();
            }
        } catch (error) {
            message.error(error.message || 'Kích hoạt thất bại');
        } finally {
            setLoading(false);
        }
    };

    // Xóa phiên bản nháp
    const handleDelete = async (rubricId) => {
        try {
            setLoading(true);
            const res = await rubricService.deleteRubric(rubricId);
            if (res.success) {
                message.success('Đã xóa phiên bản nháp thành công');
                fetchRubrics();
            }
        } catch (error) {
            message.error(error.message || 'Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // Real-time Score Calculations & Validations
    // ==========================================
    const totalScore = useMemo(() => {
        const sum = formCategories.reduce((acc, cat) => acc + (Number(cat.maxScore) || 0), 0);
        return round2(sum);
    }, [formCategories]);

    const isScoreValid = totalScore === 10.0;

    const isReadOnly = useMemo(() => {
        if (editorMode === 'view') return true;
        if (!systemEditable) return true;
        if (editingRubric?.isLockedByGrading) return true;
        return false;
    }, [editorMode, systemEditable, editingRubric]);

    // Thêm nhóm mục
    const handleAddCategory = () => {
        const nextIdx = formCategories.length + 1;
        setFormCategories((prev) => [
            ...prev,
            {
                id: `cat_new_${Date.now()}`,
                code: `CAT_${nextIdx}`,
                name: `${nextIdx}. Nhóm mục mới`,
                description: '',
                maxScore: 1.0,
                criteria: [
                    {
                        id: `cri_new_${Date.now()}`,
                        code: `CRI_${nextIdx}_1`,
                        label: 'Tiêu chí mới',
                        description: '',
                        maxScore: 1.0,
                    },
                ],
            },
        ]);
    };

    // Xóa nhóm mục
    const handleDeleteCategory = (catIndex) => {
        setFormCategories((prev) => prev.filter((_, idx) => idx !== catIndex));
    };

    // Cập nhật thông tin nhóm mục
    const handleUpdateCategory = (catIndex, field, value) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => (idx === catIndex ? { ...cat, [field]: value } : cat))
        );
    };

    // Thêm tiêu chí con trong mục
    const handleAddCriterion = (catIndex) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                const nextCriIdx = (cat.criteria || []).length + 1;
                return {
                    ...cat,
                    criteria: [
                        ...(cat.criteria || []),
                        {
                            id: `cri_new_${Date.now()}_${nextCriIdx}`,
                            code: `${cat.code || 'CAT'}_CRI_${nextCriIdx}`,
                            label: `Tiêu chí ${nextCriIdx}`,
                            description: '',
                            maxScore: 0.5,
                        },
                    ],
                };
            })
        );
    };

    // Xóa tiêu chí con
    const handleDeleteCriterion = (catIndex, criIndex) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                return {
                    ...cat,
                    criteria: cat.criteria.filter((_, cIdx) => cIdx !== criIndex),
                };
            })
        );
    };

    // Cập nhật tiêu chí con
    const handleUpdateCriterion = (catIndex, criIndex, field, value) => {
        setFormCategories((prev) =>
            prev.map((cat, idx) => {
                if (idx !== catIndex) return cat;
                return {
                    ...cat,
                    criteria: cat.criteria.map((cri, cIdx) =>
                        cIdx === criIndex ? { ...cri, [field]: value } : cri
                    ),
                };
            })
        );
    };

    // Lưu Rubric
    const handleSaveRubric = async () => {
        if (!isScoreValid) {
            message.warning(`Tổng điểm toàn barem hiện tại là ${totalScore}đ. Bắt buộc phải bằng chính xác 10.0đ.`);
            return;
        }

        // Kiểm tra khớp điểm từng mục
        for (const cat of formCategories) {
            const sumCri = round2(
                (cat.criteria || []).reduce((sum, cri) => sum + (Number(cri.maxScore) || 0), 0)
            );
            if (sumCri !== Number(cat.maxScore)) {
                message.warning(
                    `Tổng điểm tiêu chí trong mục "${cat.name}" là ${sumCri}đ, chưa khớp với điểm mục (${cat.maxScore}đ).`
                );
                return;
            }
        }

        try {
            setSaving(true);
            const payload = {
                title: formTitle.trim(),
                description: formDescription.trim(),
                categories: formCategories.map((cat, catIdx) => ({
                    code: cat.code.trim().toUpperCase(),
                    name: cat.name.trim(),
                    description: cat.description ? cat.description.trim() : null,
                    maxScore: Number(cat.maxScore),
                    orderIndex: catIdx + 1,
                    criteria: (cat.criteria || []).map((cri, criIdx) => ({
                        code: cri.code.trim().toUpperCase(),
                        label: cri.label.trim(),
                        description: cri.description ? cri.description.trim() : null,
                        maxScore: Number(cri.maxScore),
                        orderIndex: criIdx + 1,
                    })),
                })),
            };

            if (editorMode === 'create') {
                payload.version = formVersion.trim().toLowerCase();
                const res = await rubricService.createRubric(payload);
                if (res.success) {
                    message.success('Đã tạo phiên bản Rubric mới thành công!');
                    setEditorOpen(false);
                    fetchRubrics();
                }
            } else {
                const res = await rubricService.updateRubric(editingRubric.id, payload);
                if (res.success) {
                    message.success('Đã cập nhật phiên bản Rubric thành công!');
                    setEditorOpen(false);
                    fetchRubrics();
                }
            }
        } catch (error) {
            message.error(error.message || 'Lưu phiên bản Rubric thất bại');
        } finally {
            setSaving(false);
        }
    };

    // Columns cho bảng danh sách các phiên bản
    const columns = [
        {
            title: 'Phiên bản',
            dataIndex: 'version',
            key: 'version',
            width: 130,
            render: (version, record) => (
                <div className="flex flex-col gap-1 items-start">
                    <span className="font-bold text-slate-800 text-sm tracking-wide">{version.toUpperCase()}</span>
                    {record.isActive ? (
                        <Tag color="#059669" className="font-semibold text-[11px] m-0">
                            ĐANG ÁP DỤNG
                        </Tag>
                    ) : record.status === 'ARCHIVED' ? (
                        <Tag color="default" className="text-[11px] m-0">
                            LƯU TRỮ
                        </Tag>
                    ) : (
                        <Tag color="#D97706" className="font-semibold text-[11px] m-0">
                            BẢN THẢO
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: 'Tên Barem & Nội dung',
            dataIndex: 'title',
            key: 'title',
            render: (title, record) => (
                <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
                    {record.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{record.description}</p>
                    )}
                </div>
            ),
        },
        {
            title: 'Cơ cấu tiêu chí',
            key: 'structure',
            width: 170,
            render: (_, record) => (
                <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{record.categoriesCount || 0}</span> mục lớn /{' '}
                    <span className="font-semibold text-slate-800">{record.criteriaCount || 0}</span> tiêu chí con
                </div>
            ),
        },
        {
            title: 'Tổng điểm',
            dataIndex: 'totalMaxScore',
            key: 'totalMaxScore',
            width: 120,
            align: 'center',
            render: (score) => (
                <Tag color="blue" className="font-bold text-sm px-2.5 py-0.5">
                    {score?.toFixed(1) || '10.0'}đ
                </Tag>
            ),
        },
        {
            title: 'Cập nhật',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 150,
            render: (date) => (
                <div className="text-xs text-slate-500">
                    <div>{dayjs(date).format('DD/MM/YYYY')}</div>
                    <div className="text-[11px] text-slate-400">{dayjs(date).format('HH:mm')}</div>
                </div>
            ),
        },
        {
            title: 'Hành động',
            key: 'actions',
            width: 220,
            render: (_, record) => {
                const canEditDirectly = systemEditable && !record.isLockedByGrading && record.status !== 'ARCHIVED';

                return (
                    <Space size="small" wrap>
                        <Tooltip title={canEditDirectly ? 'Chỉnh sửa barem' : 'Xem chi tiết (Chế độ chỉ đọc)'}>
                            <Button
                                size="small"
                                icon={canEditDirectly ? <EditOutlined /> : <EyeOutlined />}
                                onClick={() => handleOpenEditOrView(record.id, canEditDirectly ? 'edit' : 'view')}
                            >
                                {canEditDirectly ? 'Sửa' : 'Xem'}
                            </Button>
                        </Tooltip>

                        <Tooltip title="Nhân bản sang phiên bản mới để tùy chỉnh">
                            <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => handleOpenClone(record)}
                            >
                                Nhân bản
                            </Button>
                        </Tooltip>

                        {!record.isActive && (
                            <Popconfirm
                                title="Kích hoạt phiên bản Rubric"
                                description="Bạn có chắc chắn muốn kích hoạt phiên bản này làm Barem chấm điểm chính thức của hệ thống?"
                                onConfirm={() => handleActivate(record.id)}
                                disabled={!systemEditable}
                                okText="Kích hoạt"
                                cancelText="Hủy"
                            >
                                <Tooltip title={!systemEditable ? 'Không thể kích hoạt khi đang trong đợt đồ án' : 'Kích hoạt barem chính thức'}>
                                    <Button
                                        size="small"
                                        type="primary"
                                        className="bg-[#0F766E] hover:bg-[#115E59]"
                                        icon={<CheckCircleOutlined />}
                                        disabled={!systemEditable}
                                    >
                                        Áp dụng
                                    </Button>
                                </Tooltip>
                            </Popconfirm>
                        )}

                        {record.status === 'DRAFT' && !record.isActive && (
                            <Popconfirm
                                title="Xóa bản thảo"
                                description="Bạn có chắc chắn muốn xóa phiên bản nháp này?"
                                onConfirm={() => handleDelete(record.id)}
                                okText="Xóa"
                                okButtonProps={{ danger: true }}
                                cancelText="Hủy"
                            >
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Quản Lý Tiêu Chí Chấm Điểm (Barem Rubric Bảo Vệ)"
                subtitle="Cấu hình danh mục tiêu chí đánh giá cho Hội đồng bảo vệ đồ án tốt nghiệp"
                actions={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={fetchRubrics} loading={loading}>
                            Làm mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            className="bg-[#0F766E] hover:bg-[#115E59]"
                            onClick={handleOpenCreate}
                            disabled={!systemEditable}
                        >
                            Tạo phiên bản mới
                        </Button>
                    </Space>
                }
            />

            {/* System Status Alert Banner */}
            {!systemEditable ? (
                <Alert
                    type="warning"
                    showIcon
                    icon={<LockOutlined className="text-amber-600 text-lg" />}
                    message={<span className="font-bold text-amber-900">Barem chấm điểm đang ở chế độ CHỈ ĐỌC (Read-only)</span>}
                    description={
                        <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                            {systemEditableReason || 'Hệ thống đang trong đợt đồ án hoặc học kỳ đã bắt đầu.'}{' '}
                            Nhằm đảm bảo tính công bằng và toàn vẹn dữ liệu cho sinh viên, barem chấm điểm bảo vệ bị khóa chỉnh sửa trực tiếp. Quản trị viên có thể sử dụng chức năng <strong>Nhân bản (Clone)</strong> để soạn thảo phiên bản mới chuẩn bị cho các đợt học vụ tiếp theo.
                        </div>
                    }
                    className="border border-amber-200 bg-amber-50 rounded-lg shadow-sm"
                />
            ) : (
                <Alert
                    type="info"
                    showIcon
                    icon={<UnlockOutlined className="text-teal-600 text-lg" />}
                    message={<span className="font-bold text-teal-900">Hệ thống chưa vào đợt đồ án — Barem sẵn sàng cấu hình</span>}
                    description={
                        <span className="text-xs text-teal-800">
                            Quản trị viên có toàn quyền thêm, sửa, phân bổ lại điểm số và kích hoạt phiên bản Rubric mới trước khi đợt đồ án chính thức bắt đầu.
                        </span>
                    }
                    className="border border-teal-200 bg-teal-50 rounded-lg shadow-sm"
                />
            )}

            {/* Version List Card */}
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden" bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={versions}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    className="nordic-table"
                />
            </Card>

            {/* ======================================================== */}
            {/* Modal Nhân Bản (Clone Rubric) */}
            {/* ======================================================== */}
            <Modal
                title={<span className="font-bold text-base text-slate-800">Nhân bản Barem Rubric mới</span>}
                open={cloneModalOpen}
                onCancel={() => setCloneModalOpen(false)}
                onOk={handleCloneSubmit}
                confirmLoading={cloning}
                okText="Tạo bản sao"
                cancelText="Hủy"
            >
                <div className="space-y-4 pt-2">
                    <p className="text-xs text-slate-600">
                        Hệ thống sẽ sao chép toàn bộ danh mục và tiêu chí con từ phiên bản gốc sang một bản thảo mới để bạn tùy ý điều chỉnh.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mã phiên bản mới (vd: v2, v3):</label>
                        <Input
                            placeholder="Nhập mã phiên bản (vd: v2)"
                            value={cloneVersionName}
                            onChange={(e) => setCloneVersionName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề Barem:</label>
                        <Input
                            placeholder="Nhập tiêu đề barem mới"
                            value={cloneTitle}
                            onChange={(e) => setCloneTitle(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            {/* ======================================================== */}
            {/* Drawer Trình Soạn Thảo Rubric (Rubric Editor) */}
            {/* ======================================================== */}
            <Drawer
                title={
                    <div className="flex items-center justify-between w-full pr-6">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-base">
                                {editorMode === 'create'
                                    ? 'Soạn thảo Barem Rubric mới'
                                    : editorMode === 'edit'
                                    ? `Chỉnh sửa Barem [${editingRubric?.version?.toUpperCase()}]`
                                    : `Chi tiết Barem [${editingRubric?.version?.toUpperCase()}] (Chỉ đọc)`}
                            </span>
                            {isReadOnly && (
                                <Tag color="orange" className="font-semibold text-xs">
                                    CHẾ ĐỘ CHỈ ĐỌC
                                </Tag>
                            )}
                        </div>

                        {/* Real-time score counter in Drawer Header */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Tổng điểm:</span>
                            <Tag
                                color={isScoreValid ? '#059669' : '#BE123C'}
                                className="font-bold text-sm px-3 py-1 flex items-center gap-1.5"
                            >
                                {isScoreValid ? <CheckCircleOutlined /> : <WarningOutlined />}
                                {totalScore} / 10.0đ
                            </Tag>
                        </div>
                    </div>
                }
                placement="right"
                width={880}
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                footer={
                    <div className="flex justify-between items-center py-2">
                        <div className="text-xs">
                            {isScoreValid ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircleOutlined /> Cấu trúc điểm hợp lệ (Đúng 10.0 điểm).
                                </span>
                            ) : (
                                <span className="text-rose-600 font-semibold flex items-center gap-1">
                                    <WarningOutlined /> Tổng điểm hiện là {totalScore}đ. Cần điều chỉnh để bằng 10.0đ.
                                </span>
                            )}
                        </div>
                        <Space>
                            <Button onClick={() => setEditorOpen(false)}>Đóng</Button>
                            {!isReadOnly && (
                                <Button
                                    type="primary"
                                    className="bg-[#0F766E] hover:bg-[#115E59]"
                                    loading={saving}
                                    onClick={handleSaveRubric}
                                    disabled={!isScoreValid}
                                >
                                    Lưu Barem
                                </Button>
                            )}
                        </Space>
                    </div>
                }
            >
                <div className="space-y-6 pb-6">
                    {/* Warning if Read-only */}
                    {isReadOnly && (
                        <Alert
                            type="info"
                            message="Bạn đang xem barem ở chế độ chỉ đọc. Để thay đổi tiêu chí, vui lòng sử dụng chức năng 'Nhân bản' ở danh sách phiên bản."
                            showIcon
                            className="text-xs border-blue-200 bg-blue-50"
                        />
                    )}

                    {/* Metadata Fields */}
                    <Card className="bg-slate-50 border border-slate-200 rounded-lg p-4" bodyStyle={{ padding: 0 }}>
                        <Row gutter={[16, 12]}>
                            <Col span={6}>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Mã phiên bản:</label>
                                <Input
                                    value={formVersion}
                                    onChange={(e) => setFormVersion(e.target.value)}
                                    disabled={editorMode !== 'create' || isReadOnly}
                                    placeholder="vd: v2"
                                    className="font-bold"
                                />
                            </Col>
                            <Col span={18}>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Barem đánh giá:</label>
                                <Input
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Tên barem hiển thị trên phiếu chấm"
                                />
                            </Col>
                            <Col span={24}>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả quy chế / Hướng dẫn chung:</label>
                                <Input.TextArea
                                    rows={2}
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Ghi chú thêm về quy chế đánh giá của Viện"
                                />
                            </Col>
                        </Row>
                    </Card>

                    {/* Categories & Criteria List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                                Danh Sách Nhóm Mục & Tiêu Chí Con ({formCategories.length} Mục)
                            </h3>
                            {!isReadOnly && (
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<PlusOutlined />}
                                    onClick={handleAddCategory}
                                    className="text-teal-700 border-teal-300 hover:text-teal-800"
                                >
                                    Thêm nhóm mục mới
                                </Button>
                            )}
                        </div>

                        {formCategories.map((cat, catIdx) => {
                            const sumCri = round2(
                                (cat.criteria || []).reduce((acc, c) => acc + (Number(c.maxScore) || 0), 0)
                            );
                            const catScoreMatches = sumCri === Number(cat.maxScore);

                            return (
                                <Card
                                    key={cat.id || catIdx}
                                    className="rounded-lg border border-slate-300 shadow-xs overflow-hidden"
                                    bodyStyle={{ padding: '16px' }}
                                >
                                    {/* Category Header */}
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-200">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 text-xs bg-slate-200 px-2 py-0.5 rounded">
                                                    MỤC {catIdx + 1}
                                                </span>
                                                <Input
                                                    value={cat.name}
                                                    onChange={(e) => handleUpdateCategory(catIdx, 'name', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Tên nhóm mục (vd: 1. Hình thức và kỹ năng báo cáo)"
                                                    className="font-bold text-sm text-slate-900 border-slate-300 max-w-md"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Input
                                                    value={cat.code}
                                                    onChange={(e) => handleUpdateCategory(catIdx, 'code', e.target.value.toUpperCase())}
                                                    disabled={isReadOnly}
                                                    placeholder="MÃ MỤC (vd: CAT_REPORT)"
                                                    className="text-xs uppercase font-mono w-48"
                                                />
                                                <Input
                                                    value={cat.description}
                                                    onChange={(e) => handleUpdateCategory(catIdx, 'description', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Mô tả phạm vi đánh giá của mục"
                                                    className="text-xs flex-1"
                                                />
                                            </div>
                                        </div>

                                        {/* Category Max Score & Counter */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <div className="text-[11px] text-slate-500 font-semibold">Điểm tối đa mục:</div>
                                                <div className="flex items-center gap-1">
                                                    <InputNumber
                                                        min={0.1}
                                                        max={10.0}
                                                        step={0.25}
                                                        value={cat.maxScore}
                                                        onChange={(val) => handleUpdateCategory(catIdx, 'maxScore', val)}
                                                        disabled={isReadOnly}
                                                        className="w-20 font-bold"
                                                    />
                                                    <span className="text-xs font-semibold text-slate-600">đ</span>
                                                </div>
                                            </div>

                                            <Tooltip title={`Tổng điểm các tiêu chí: ${sumCri}đ / Điểm mục: ${cat.maxScore}đ`}>
                                                <Tag
                                                    color={catScoreMatches ? 'green' : 'red'}
                                                    className="text-xs font-semibold m-0"
                                                >
                                                    {sumCri}đ / {cat.maxScore}đ
                                                </Tag>
                                            </Tooltip>

                                            {!isReadOnly && formCategories.length > 1 && (
                                                <Popconfirm
                                                    title="Xóa nhóm mục này?"
                                                    description="Tất cả các tiêu chí con trong mục cũng sẽ bị xóa."
                                                    onConfirm={() => handleDeleteCategory(catIdx)}
                                                    okText="Xóa"
                                                    cancelText="Hủy"
                                                >
                                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                                </Popconfirm>
                                            )}
                                        </div>
                                    </div>

                                    {/* Criteria in this category */}
                                    <div className="mt-3 space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                            <span>Tiêu chí con ({cat.criteria?.length || 0})</span>
                                            {!isReadOnly && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<PlusOutlined />}
                                                    onClick={() => handleAddCriterion(catIdx)}
                                                    className="p-0 text-teal-700 text-xs"
                                                >
                                                    Thêm tiêu chí
                                                </Button>
                                            )}
                                        </div>

                                        {(cat.criteria || []).map((cri, criIdx) => (
                                            <div
                                                key={cri.id || criIdx}
                                                className="bg-white p-2.5 rounded border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-slate-400 font-semibold w-6">
                                                        #{criIdx + 1}
                                                    </span>
                                                    <Input
                                                        value={cri.code}
                                                        onChange={(e) =>
                                                            handleUpdateCriterion(catIdx, criIdx, 'code', e.target.value.toUpperCase())
                                                        }
                                                        disabled={isReadOnly}
                                                        placeholder="MÃ TIÊU CHÍ"
                                                        className="text-xs font-mono uppercase w-40"
                                                    />
                                                    <Input
                                                        value={cri.label}
                                                        onChange={(e) =>
                                                            handleUpdateCriterion(catIdx, criIdx, 'label', e.target.value)
                                                        }
                                                        disabled={isReadOnly}
                                                        placeholder="Tên tiêu chí (vd: Cấu trúc báo cáo)"
                                                        className="text-xs font-medium flex-1"
                                                    />
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-[11px] text-slate-500">Tối đa:</span>
                                                        <InputNumber
                                                            min={0.05}
                                                            max={10.0}
                                                            step={0.05}
                                                            value={cri.maxScore}
                                                            onChange={(val) =>
                                                                handleUpdateCriterion(catIdx, criIdx, 'maxScore', val)
                                                            }
                                                            disabled={isReadOnly}
                                                            className="w-20 text-xs font-bold"
                                                        />
                                                        <span className="text-xs text-slate-500">đ</span>
                                                    </div>
                                                    {!isReadOnly && cat.criteria.length > 1 && (
                                                        <Button
                                                            size="small"
                                                            type="text"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => handleDeleteCriterion(catIdx, criIdx)}
                                                        />
                                                    )}
                                                </div>

                                                {/* Description / Rubric Descriptors */}
                                                <Input.TextArea
                                                    rows={1}
                                                    value={cri.description}
                                                    onChange={(e) =>
                                                        handleUpdateCriterion(catIdx, criIdx, 'description', e.target.value)
                                                    }
                                                    disabled={isReadOnly}
                                                    placeholder="Mô tả chi tiết / Tiêu chí đánh giá các mức Xuất sắc, Tốt, Khá, Trung bình, Yếu..."
                                                    className="text-xs text-slate-600 bg-slate-50/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </Drawer>
        </div>
    );
}
