import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Button,
    Form,
    Input,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Dropdown,
} from 'antd';
import {
    PlusOutlined,
    SearchOutlined,
    SendOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import useAuthStore from '../../stores/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

const { TextArea } = Input;

const STATUS_TABS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'APPROVED', label: 'Đã duyệt' },
    { key: 'PENDING', label: 'Chờ duyệt' },
    { key: 'DRAFT', label: 'Bản nháp' },
    { key: 'REJECTED', label: 'Bị từ chối' },
];

function TopicManagementPage() {
    const user = useAuthStore((s) => s.user);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [semesterOptions, setSemesterOptions] = useState([]);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const fetchTopics = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await topicService.getAll({ mentorId: user.id });
            const ownTopics = (res.data || []).filter(
                (topic) => topic.proposedById === user.id || topic.proposedBy?.id === user.id,
            );
            setTopics(ownTopics.map((topic, i) => ({ ...topic, key: topic.id, stt: i + 1 })));
        } catch {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const res = await semesterService.getAll();
                if (!res.success) return;
                const options = (res.data || []).map((semester) => ({
                    value: semester.id,
                    label: semester.name || formatSemesterLabel(semester),
                    startDate: semester.startDate,
                    endDate: semester.endDate,
                    registrationDeadline: semester.registrationDeadline,
                    status: semester.status,
                }));
                setSemesterOptions(options);
            } catch {
                message.error('Không thể tải danh sách học kỳ.');
            }
        };
        fetchSemesters();
    }, []);

    const maxQuota = useMemo(() => {
        if (user?.maxStudents) return Number(user.maxStudents);
        if (user?.academicTitle === 'PHO_GIAO_SU') return 20;
        if (user?.academicTitle === 'TIEN_SI') return 15;
        return 10;
    }, [user]);

    const normalizedSearch = useMemo(
        () => searchText.replace(/\s+/g, ' ').trim().toLowerCase(),
        [searchText],
    );

    const filteredTopics = useMemo(() => {
        return topics.filter((topic) => {
            if (statusFilter !== 'all' && topic.status !== statusFilter) return false;
            if (!normalizedSearch) return true;

            const title = (topic.title || '').toLowerCase();
            const student = (topic.registrations?.[0]?.student?.fullName || '').toLowerCase();
            const studentCode = (topic.registrations?.[0]?.student?.code || '').toLowerCase();
            const tokens = normalizedSearch.split(' ').filter(Boolean);
            return tokens.every((token) => (
                title.includes(token) || student.includes(token) || studentCode.includes(token)
            ));
        });
    }, [topics, normalizedSearch, statusFilter]);

    const sortedTopics = useMemo(() => {
        const list = [...filteredTopics];
        const hasStudent = (topic) => Number(Boolean(topic.registrations?.[0]?.student));
        switch (sortBy) {
        case 'title_asc':
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
            break;
        case 'title_desc':
            list.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'vi'));
            break;
        case 'student_desc':
            list.sort((a, b) => hasStudent(b) - hasStudent(a));
            break;
        case 'oldest':
            list.sort((a, b) => Number(a.id) - Number(b.id));
            break;
        case 'newest':
        default:
            list.sort((a, b) => Number(b.id) - Number(a.id));
            break;
        }
        return list.map((topic, index) => ({ ...topic, stt: index + 1 }));
    }, [filteredTopics, sortBy]);

    const stats = useMemo(() => {
        const total = topics.length;
        const approved = topics.filter((t) => t.status === 'APPROVED').length;
        const pending = topics.filter((t) => t.status === 'PENDING').length;
        const withStudent = topics.filter((t) => Boolean(t.registrations?.[0]?.student)).length;
        return { total, approved, pending, withStudent };
    }, [topics]);

    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                description: topic.description,
                semesterId: topic.semesterId,
            });
        } else {
            form.resetFields();
            if (semesterOptions.length > 0) {
                form.setFieldsValue({ semesterId: semesterOptions[0].value });
            }
        }
        setFormModalOpen(true);
    };

    const handleSaveTopic = async (statusTarget) => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: statusTarget });
                message.success(statusTarget === 'APPROVED' ? 'Đã cập nhật đề tài.' : 'Đã lưu bản nháp.');
            } else {
                await topicService.create({ ...values, status: statusTarget });
                message.success(statusTarget === 'APPROVED' ? 'Đã tạo và gửi duyệt đề tài.' : 'Đã lưu bản nháp đề tài.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: 'Mã & Tên đề tài',
            dataIndex: 'title',
            key: 'title',
            width: '42%',
            render: (text, record) => (
                <div className="space-y-1">
                    <Tooltip title={text}>
                        <div className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{text}</div>
                    </Tooltip>
                    <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-slate-100 text-primary font-bold px-1.5 py-0.2 rounded">
                            DT-{String(record.id).padStart(3, '0')}
                        </code>
                        <span className="text-xs text-slate-400 font-medium">
                            {record.semester?.name || 'Học kỳ'}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            title: 'Sinh viên thực hiện',
            key: 'registrations',
            width: '28%',
            render: (_, record) => {
                const student = record.registrations?.[0]?.student;
                if (!student) {
                    return <span className="text-xs text-slate-400 italic">Chưa có sinh viên</span>;
                }
                const initials = student.fullName ? student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'S';
                return (
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{student.fullName}</div>
                            <span className="text-[11px] font-mono text-slate-500">{student.code}</span>
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
            key: 'actions',
            width: 100,
            align: 'right',
            render: (_, record) => {
                const items = [
                    {
                        key: 'edit',
                        icon: <EditOutlined />,
                        label: 'Chỉnh sửa đề tài',
                        onClick: () => openFormModal(record),
                    },
                ];

                if (record.status === 'DRAFT') {
                    items.push({
                        key: 'publish',
                        icon: <SendOutlined />,
                        label: 'Gửi duyệt đề tài',
                        onClick: async () => {
                            try {
                                await topicService.update(record.id, { status: 'PENDING' });
                                message.success('Đã gửi đề tài lên ban chủ nhiệm.');
                                fetchTopics();
                            } catch (e) {
                                message.error(e?.message || 'Không thể gửi duyệt đề tài');
                            }
                        },
                    });
                }

                return (
                    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                        <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-primary">
                            Thao tác <MoreOutlined />
                        </Button>
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Giảng viên' },
                    { label: 'Hướng dẫn & Đề tài' },
                    { label: 'Đề tài của tôi' },
                ]}
                title="Quản lý Đề tài Hướng dẫn"
                subtitle="Đề xuất các đề tài đồ án mới, theo dõi trạng thái phê duyệt của Viện và giám sát sinh viên đã đăng ký."
                tags={[
                    { label: `Quota Hướng dẫn: ${stats.withStudent}/${maxQuota} SV`, color: stats.withStudent >= maxQuota ? 'red' : 'green' },
                ]}
                actions={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={fetchTopics}>
                            Làm mới
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openFormModal()}>
                            Đề xuất đề tài mới
                        </Button>
                    </Space>
                }
            />

            {/* 4 StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon="folder_open"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Tổng số đề tài"
                    value={stats.total}
                />
                <StatCard
                    icon="task_alt"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Đề tài đã duyệt"
                    value={stats.approved}
                />
                <StatCard
                    icon="hourglass_top"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Đang chờ duyệt"
                    value={stats.pending}
                />
                <StatCard
                    icon="person_check"
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    label="Sinh viên đã nhận"
                    value={`${stats.withStudent} / ${maxQuota}`}
                />
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                {/* Status Segmented Tabs */}
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
                    {STATUS_TABS.map((tab) => {
                        const isSelected = statusFilter === tab.key;
                        const count = tab.key === 'all'
                            ? topics.length
                            : topics.filter((t) => t.status === tab.key).length;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-[#1E3A5F] text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filter Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                        <Input
                            placeholder="Tìm kiếm theo tên đề tài hoặc sinh viên thực hiện..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            className="w-full"
                        />
                    </div>
                    <div className="sm:col-span-4">
                        <Select
                            className="w-full"
                            value={sortBy}
                            onChange={setSortBy}
                            options={[
                                { value: 'newest', label: 'Mới nhất trước' },
                                { value: 'oldest', label: 'Cũ nhất trước' },
                                { value: 'title_asc', label: 'Tên đề tài (A-Z)' },
                                { value: 'student_desc', label: 'Đã có sinh viên trước' },
                            ]}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <Table
                        dataSource={sortedTopics}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Tổng ${t} đề tài` }}
                        size="middle"
                        scroll={{ x: 900 }}
                    />
                </div>
            </div>

            {/* Modal Form Thêm/Sửa Đề tài */}
            <Modal
                title={
                    <div className="text-base font-bold text-slate-900">
                        {editingTopic ? 'Chỉnh sửa Đề tài' : 'Đề xuất Đề tài Mới'}
                    </div>
                }
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={
                    <Space className="pt-3">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Button loading={submitting} onClick={() => handleSaveTopic('DRAFT')}>
                            Lưu bản nháp
                        </Button>
                        <Button type="primary" loading={submitting} onClick={() => handleSaveTopic('APPROVED')}>
                            Lưu và công khai
                        </Button>
                    </Space>
                }
                width={650}
                centered
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="pt-2">
                    <Form.Item
                        name="semesterId"
                        label={<span className="text-xs font-bold text-slate-700">Đợt đồ án (Học kỳ)</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn học kỳ!' }]}
                    >
                        <Select placeholder="Chọn đợt đồ án" options={semesterOptions} />
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label={<span className="text-xs font-bold text-slate-700">Tên đề tài</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tên đề tài!' }]}
                    >
                        <Input placeholder="Nhập tên đề tài nghiên cứu hoặc ứng dụng..." maxLength={255} />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label={<span className="text-xs font-bold text-slate-700">Mục tiêu & Yêu cầu đầu ra</span>}
                    >
                        <TextArea
                            rows={5}
                            placeholder="Mô tả mục tiêu nghiên cứu, phạm vi sản phẩm và công nghệ dự kiến..."
                        />
                    </Form.Item>

                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        💡 Mỗi đề tài chỉ nhận tối đa <b>1 sinh viên</b>. Hạn mức hướng dẫn của bạn là <b>{maxQuota} sinh viên</b> trong học kỳ này.
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

export default TopicManagementPage;
