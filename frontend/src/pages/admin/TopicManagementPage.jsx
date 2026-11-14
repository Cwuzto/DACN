import { useState, useMemo } from 'react';
import {
    Table, Button, Input, Select, Drawer, Tooltip, Modal, Form, Space,
    Popconfirm, message, Tag, Avatar,
} from 'antd';
import {
    SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    CheckCircleOutlined, CloseCircleOutlined, SendOutlined, PlusOutlined,
    UserOutlined, BookOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
    AuditOutlined,
} from '@ant-design/icons';
import aiService from '../../services/aiService';
import StatusBadge from '../../components/common/StatusBadge';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';
import MentorTransferModal from '../../components/admin/MentorTransferModal';
import TopicSimilarityModal from '../../components/topics/TopicSimilarityModal';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useTopics, useTopicMutation } from '../../queries/topicQueries';
import { useSemesters } from '../../queries/semesterQueries';
import { useUsers } from '../../queries/userQueries';
import QueryPanel from '../../components/common/QueryPanel';

const { TextArea } = Input;

const STATUS_TABS = [
    { key: 'all', label: 'Tất cả đề tài' },
    { key: 'PENDING', label: 'Chờ phê duyệt' },
    { key: 'APPROVED', label: 'Đã phê duyệt' },
    { key: 'DRAFT', label: 'Bản nháp' },
    { key: 'REJECTED', label: 'Bị từ chối' },
];

function TopicManagementPage() {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [semesterFilter, setSemesterFilter] = useState('all');

    const topicsQuery = useTopics(scope, {
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(searchText ? { search: searchText } : {}),
    });
    const topicMutation = useTopicMutation(scope);
    const semestersQuery = useSemesters(scope);
    const mentorsQuery = useUsers(scope, { role: 'LECTURER', status: 'active', page: 1, limit: 200 });

    const rawTopics = topicsQuery.data || [];
    const topics = useMemo(() => rawTopics.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })), [rawTopics]);

    const semesters = useMemo(() => {
        const data = semestersQuery.data || [];
        return data.map((s) => ({ value: s.id, label: formatSemesterLabel(s) }));
    }, [semestersQuery.data]);

    const activeSemesterId = useMemo(() => {
        const data = semestersQuery.data || [];
        const active = data.find((s) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(s.status));
        return active?.id || (data[0]?.id ?? null);
    }, [semestersQuery.data]);

    const mentors = useMemo(() => {
        const users = mentorsQuery.data?.data?.users || mentorsQuery.data?.data || mentorsQuery.data || [];
        return (Array.isArray(users) ? users : []).map((u) => ({
            value: u.id,
            label: `${u.fullName} (${u.code})`,
        }));
    }, [mentorsQuery.data]);

    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);

    // Side Drawer for Topic Appraisal
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTopic, setDrawerTopic] = useState(null);
    const [drawerRejectReason, setDrawerRejectReason] = useState('');
    const [drawerSubmitting, setDrawerSubmitting] = useState(false);

    // Mentor Transfer Modal State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferRegistration, setTransferRegistration] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    // AI Similarity Checker state
    const [similarityModalOpen, setSimilarityModalOpen] = useState(false);
    const [similarityLoading, setSimilarityLoading] = useState(false);
    const [similarityData, setSimilarityData] = useState(null);

    const handleCheckSimilarity = async () => {
        const titleVal = form.getFieldValue('title') || drawerTopic?.title || '';
        const descVal = form.getFieldValue('description') || drawerTopic?.description || '';
        if (!titleVal.trim()) {
            message.warning('Vui lòng nhập tên đề tài trước khi kiểm tra tính mới với AI.');
            return;
        }
        setSimilarityModalOpen(true);
        setSimilarityLoading(true);
        try {
            const res = await aiService.checkTopicSimilarity({
                title: titleVal.trim(),
                summary: descVal.trim(),
                semesterId: form.getFieldValue('semesterId') || (semesterFilter !== 'all' ? semesterFilter : null),
            });
            if (res.success) {
                setSimilarityData(res.data);
            } else {
                message.error(res.message || 'Không thể kiểm tra tính mới đề tài');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gọi AI kiểm tra tính mới');
        } finally {
            setSimilarityLoading(false);
        }
    };

    const handleSelectSuggestedTitle = (newTitle) => {
        form.setFieldsValue({ title: newTitle });
        setSimilarityModalOpen(false);
        message.success('Đã áp dụng tên đề tài gợi ý!');
    };

    const [form] = Form.useForm();

    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                description: topic.description,
                semesterId: topic.semesterId,
                mentorId: topic.mentorId || topic.mentor?.id,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ semesterId: activeSemesterId || undefined });
        }
        setFormModalOpen(true);
    };

    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicMutation.mutateAsync({ action: 'update', args: [editingTopic.id, { ...values, status: 'DRAFT' }] });
                message.success('Đã cập nhật bản nháp.');
            } else {
                await topicMutation.mutateAsync({ action: 'create', args: [{ ...values, status: 'DRAFT' }] });
                message.success('Đã lưu bản nháp đề tài.');
            }
            setFormModalOpen(false);
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateApproved = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicMutation.mutateAsync({ action: 'update', args: [editingTopic.id, { ...values, status: 'PENDING' }] });
                message.success('Đã gửi đề tài đi phê duyệt.');
            } else {
                await topicMutation.mutateAsync({ action: 'create', args: [{ ...values, status: 'APPROVED' }] });
                message.success('Tạo đề tài thành công.');
            }
            setFormModalOpen(false);
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            setDrawerSubmitting(true);
            await topicMutation.mutateAsync({ action: 'changeStatus', args: [id, { status: 'APPROVED' }] });
            message.success('Đã duyệt đề tài thành công.');
            setDrawerOpen(false);
        } catch (err) {
            message.error(err?.message || 'Không thể duyệt đề tài.');
        } finally {
            setDrawerSubmitting(false);
        }
    };

    const handleReject = async (id) => {
        if (!drawerRejectReason.trim()) {
            message.warning('Vui lòng nhập lý do từ chối để phản hồi cho giảng viên.');
            return;
        }
        try {
            setDrawerSubmitting(true);
            await topicMutation.mutateAsync({ action: 'changeStatus', args: [id, { status: 'REJECTED', rejectReason: drawerRejectReason.trim() }] });
            message.success('Đã từ chối đề tài.');
            setDrawerOpen(false);
            setDrawerRejectReason('');
        } catch (err) {
            message.error(err?.message || 'Không thể từ chối đề tài.');
        } finally {
            setDrawerSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await topicMutation.mutateAsync({ action: 'delete', args: [id] });
            message.success('Xóa đề tài thành công.');
        } catch (err) {
            message.error(err?.message || 'Không thể xóa đề tài.');
        }
    };

    const handleOpenDrawer = (record) => {
        setDrawerTopic(record);
        setDrawerRejectReason(record.rejectReason || '');
        setDrawerOpen(true);
    };

    const pendingCount = topics.filter((t) => t.status === 'PENDING').length;
    const approvedCount = topics.filter((t) => t.status === 'APPROVED').length;
    const draftCount = topics.filter((t) => t.status === 'DRAFT').length;

    const filteredTopics = useMemo(() => {
        return topics.filter((topic) => {
            if (statusFilter !== 'all' && topic.status !== statusFilter) return false;
            if (semesterFilter !== 'all' && topic.semesterId !== semesterFilter) return false;
            return true;
        });
    }, [topics, statusFilter, semesterFilter]);

    const columns = [
        {
            title: 'Mã ĐT',
            key: 'code',
            width: 110,
            render: (_, record) => (
                <span className="font-mono font-semibold text-[#0F766E] text-xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    DT-{String(record.id).padStart(3, '0')}
                </span>
            ),
        },
        {
            title: 'Tên đề tài nghiên cứu',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div
                    className="cursor-pointer space-y-0.5 group"
                    onClick={() => handleOpenDrawer(record)}
                >
                    <div className="text-sm font-bold text-slate-900 group-hover:text-[#0F766E] transition-colors line-clamp-2">
                        {text}
                    </div>
                    {record.description && (
                        <div className="text-xs text-slate-500 line-clamp-1">{record.description}</div>
                    )}
                    <span className="text-[11px] text-slate-500 font-medium">
                        {record.semester?.name || 'Đợt đồ án'}
                    </span>
                </div>
            ),
        },
        {
            title: 'Giảng viên hướng dẫn',
            dataIndex: 'mentor',
            key: 'mentor',
            width: 220,
            render: (mentor) => mentor ? (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-100 text-[#0F766E] flex items-center justify-center text-xs font-bold shrink-0 border border-teal-200">
                        {mentor.fullName?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">{mentor.fullName}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">{mentor.code || ''}</span>
                    </div>
                </div>
            ) : <span className="text-slate-500 text-xs italic font-medium">Chưa phân GVHD</span>,
        },
        {
            title: 'Sinh viên thực hiện',
            key: 'student',
            width: 200,
            render: (_, record) => {
                const reg = record.registrations?.[0];
                if (!reg?.student) {
                    return <span className="text-xs text-slate-500 italic font-medium">Chưa có sinh viên</span>;
                }
                const sName = reg.student.fullName || 'SV';
                const initial = sName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() || 'S';
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200">
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 block truncate">{sName}</span>
                            <span className="text-[10px] text-slate-500 font-mono font-medium">{reg.student.code || ''}</span>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 130,
            align: 'right',
            render: (_, record) => (
                <div className="flex items-center justify-end gap-1.5">
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleOpenDrawer(record)}
                        className="text-xs font-medium border-slate-200"
                    >
                        Thẩm định
                    </Button>
                    {record.status === 'DRAFT' && (
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openFormModal(record)}
                            className="text-xs"
                        />
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* Header matching OpenDesign view-topics */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <div className="text-[11px] font-bold font-mono tracking-widest text-[#0F766E] uppercase">
                        TOPIC MANAGEMENT & APPRAISAL
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight mt-0.5">
                        Ngân Hàng Đề Tài & Thẩm Định Học Vụ
                    </h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button icon={<ReloadOutlined />} onClick={() => topicsQuery.refetch()} className="font-medium text-xs">
                        Làm mới
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openFormModal()}
                        className="font-semibold text-xs !bg-[#0F766E] hover:!bg-[#115E59]"
                    >
                        Thêm đề tài mới
                    </Button>
                </div>
            </div>

            {/* Faceted Filter Strip */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                {/* Segmented Status Tabs */}
                <div className="inline-flex bg-slate-100 p-1 rounded-lg gap-1 flex-wrap">
                    {STATUS_TABS.map((tab) => {
                        const isSelected = statusFilter === tab.key;
                        let count = topics.length;
                        if (tab.key === 'PENDING') count = pendingCount;
                        else if (tab.key === 'APPROVED') count = approvedCount;
                        else if (tab.key === 'DRAFT') count = draftCount;
                        else if (tab.key === 'REJECTED') count = topics.filter((t) => t.status === 'REJECTED').length;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-white text-[#0F766E] shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    isSelected ? 'bg-teal-50 text-[#0F766E] border border-teal-200' : 'bg-slate-200/80 text-slate-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1">
                        <Input
                            placeholder="Tìm kiếm mã đề tài, tên đề tài, GVHD..."
                            prefix={<SearchOutlined className="text-slate-500" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            className="w-full sm:w-80"
                        />
                        <Select
                            value={semesterFilter}
                            onChange={setSemesterFilter}
                            style={{ width: 220 }}
                            options={[
                                { value: 'all', label: 'Tất cả đợt đồ án' },
                                ...semesters,
                            ]}
                        />
                    </div>
                    <span className="text-xs text-slate-600 font-medium">
                        Hiển thị: <strong className="text-slate-900">{filteredTopics.length}</strong> đề tài
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <QueryPanel query={topicsQuery} variant="table">
                    <Table
                        dataSource={filteredTopics}
                        columns={columns}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} đề tài`,
                            showSizeChanger: true,
                            size: 'small',
                        }}
                        size="middle"
                        locale={{
                            emptyText: (
                                <div className="py-12 text-center text-slate-500 font-medium">
                                    <BookOutlined className="text-4xl mb-2 text-slate-400 block" />
                                    <p className="text-sm font-medium">Không tìm thấy đề tài nào phù hợp với bộ lọc hiện tại.</p>
                                </div>
                            ),
                        }}
                    />
                </QueryPanel>
            </div>

            {/* Side Drawer: Thẩm định & Chi tiết đề tài */}
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[#0F766E] font-bold text-xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            DT-{String(drawerTopic?.id || '').padStart(3, '0')}
                        </span>
                        <span className="font-bold text-sm text-slate-900 truncate">Thẩm định & Chi tiết Đề tài</span>
                    </div>
                }
                placement="right"
                width={560}
                onClose={() => setDrawerOpen(false)}
                open={drawerOpen}
            >
                {drawerTopic && (
                    <div className="space-y-5 text-xs">
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tên đề tài</span>
                            <h3 className="text-base font-bold text-slate-900 mt-0.5">{drawerTopic.title}</h3>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Mục tiêu & Phạm vi công nghệ</span>
                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                                {drawerTopic.description || 'Chưa có thông tin mô tả chi tiết.'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-slate-600 font-medium block text-[11px]">Trạng thái học vụ</span>
                                <div className="mt-1"><StatusBadge status={drawerTopic.status} /></div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-slate-600 font-medium block text-[11px]">Đợt đồ án</span>
                                <span className="font-bold text-slate-800 block mt-1">
                                    {drawerTopic.semester?.name || 'Học kỳ hiện tại'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                            <span className="text-slate-600 font-medium block text-[11px]">Giảng viên hướng dẫn</span>
                            <div className="font-bold text-slate-900 text-xs">
                                {drawerTopic.mentor?.fullName} ({drawerTopic.mentor?.code})
                            </div>
                            <div className="text-slate-500 text-[11px]">
                                Email: {drawerTopic.mentor?.email || 'N/A'}
                            </div>
                        </div>

                        {drawerTopic.registrations?.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    Sinh viên đã phân công (Quy chuẩn 1 SV / đề tài)
                                </span>
                                {drawerTopic.registrations.map((r) => {
                                    const canTransfer = !['TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM01', 'TERMINATED_BM02', 'TERMINATED_BM04', 'COMPLETED', 'DROPPED', 'WITHDRAWN'].includes(r.status);
                                    return (
                                        <div key={r.id} className="bg-teal-50/60 border border-teal-200 rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
                                            <div>
                                                <div className="font-bold text-slate-900">{r.student?.fullName}</div>
                                                <div className="font-mono text-slate-500 text-[11px]">MSSV: {r.student?.code}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag color="cyan">{r.status}</Tag>
                                                {canTransfer && (
                                                    <Button
                                                        size="small"
                                                        className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                                        onClick={() => {
                                                            setTransferRegistration({ ...r, topic: drawerTopic });
                                                            setTransferModalOpen(true);
                                                        }}
                                                    >
                                                        Điều chuyển GVHD
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Thẩm định & Quyết định Admin */}
                        {drawerTopic.status === 'PENDING' && (
                            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 pt-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                                        <CheckCircleOutlined /> Thẩm định chuyên môn đề tài:
                                    </div>
                                    <Button
                                        size="small"
                                        type="dashed"
                                        icon={<AuditOutlined />}
                                        onClick={handleCheckSimilarity}
                                        loading={similarityLoading}
                                        className="text-teal-700 border-teal-500 hover:border-teal-700 text-xs"
                                    >
                                        Kiểm tra tính mới AI
                                    </Button>
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                                        Ý kiến phản hồi / Lý do từ chối (nếu có):
                                    </label>
                                    <TextArea
                                        rows={3}
                                        value={drawerRejectReason}
                                        onChange={(e) => setDrawerRejectReason(e.target.value)}
                                        placeholder="Nhập góp ý chỉnh sửa hoặc lý do từ chối..."
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/80">
                                    <Button
                                        danger
                                        loading={drawerSubmitting}
                                        onClick={() => handleReject(drawerTopic.id)}
                                        className="text-xs"
                                    >
                                        Từ chối đề tài
                                    </Button>
                                    <Button
                                        type="primary"
                                        loading={drawerSubmitting}
                                        className="!bg-[#0F766E] hover:!bg-[#115E59] text-xs font-semibold"
                                        onClick={() => handleApprove(drawerTopic.id)}
                                    >
                                        Phê duyệt đề tài
                                    </Button>
                                </div>
                            </div>
                        )}

                        {drawerTopic.rejectReason && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg">
                                <span className="font-bold text-rose-700 block text-[11px]">Lý do từ chối trước đó:</span>
                                <span className="text-rose-900 mt-1 block">{drawerTopic.rejectReason}</span>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>

            {/* Form Modal Thêm / Sửa đề tài */}
            <Modal
                title={editingTopic ? 'Chỉnh sửa đề tài' : 'Thêm đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu bản nháp</Button>
                            <Button
                                type="primary"
                                onClick={handleCreateApproved}
                                loading={submitting}
                                className="!bg-[#0F766E] hover:!bg-[#115E59]"
                            >
                                {editingTopic ? 'Gửi duyệt' : 'Khởi tạo đề tài'}
                            </Button>
                        </Space>
                    </div>
                }
                width={650}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="title"
                        label={(
                            <div className="flex items-center justify-between w-full">
                                <span>Tên đề tài tiếng Việt</span>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<AuditOutlined />}
                                    onClick={handleCheckSimilarity}
                                    loading={similarityLoading}
                                    className="text-teal-700 border-teal-500 hover:border-teal-700"
                                >
                                    Kiểm tra tính mới AI
                                </Button>
                            </div>
                        )}
                        rules={[{ required: true, message: 'Vui lòng nhập tên đề tài' }]}
                    >
                        <Input placeholder="Nhập tên đề tài đầy đủ..." />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả mục tiêu nghiên cứu & phạm vi công nghệ">
                        <TextArea rows={4} placeholder="Mô tả chi tiết nội dung, mục tiêu nghiên cứu, công nghệ yêu cầu..." />
                    </Form.Item>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item name="semesterId" label="Đợt đồ án" rules={[{ required: true, message: 'Chọn đợt' }]}>
                            <Select placeholder="Chọn đợt" options={semesters} />
                        </Form.Item>
                        <Form.Item name="mentorId" label="Giảng viên hướng dẫn" rules={[{ required: true, message: 'Chọn giảng viên' }]}>
                            <Select placeholder="Chọn GVHD" options={mentors} showSearch optionFilterProp="label" />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Mentor Transfer Modal */}
            {transferModalOpen && transferRegistration && (
                <MentorTransferModal
                    open={transferModalOpen}
                    onClose={() => setTransferModalOpen(false)}
                    registration={transferRegistration}
                    onSuccess={() => {
                        setTransferModalOpen(false);
                        setDrawerOpen(false);
                        topicsQuery.refetch();
                    }}
                />
            )}
            {/* AI Topic Similarity Modal */}
            <TopicSimilarityModal
                open={similarityModalOpen}
                onClose={() => setSimilarityModalOpen(false)}
                data={similarityData}
                loading={similarityLoading}
                onSelectTitle={handleSelectSuggestedTitle}
            />
        </div>
    );
}

export default TopicManagementPage;
