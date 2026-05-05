import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Alert,
    Button,
    Card,
    Form,
    Input,
    message,
    Modal,
    Segmented,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import { PlusOutlined, SearchOutlined, SendOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import useAuthStore from '../../stores/authStore';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

const { Text } = Typography;
const { TextArea } = Input;

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
        case 'status':
            list.sort((a, b) => (a.status || '').localeCompare(b.status || '', 'vi'));
            break;
        case 'student_desc':
            list.sort((a, b) => hasStudent(b) - hasStudent(a));
            break;
        case 'student_asc':
            list.sort((a, b) => hasStudent(a) - hasStudent(b));
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

    const upcomingSemesterOptions = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        return semesterOptions
            .filter((semester) => {
                if (!semester.registrationDeadline) return false;
                const deadlineTime = new Date(semester.registrationDeadline).getTime();
                return Number.isFinite(deadlineTime) && deadlineTime >= today;
            })
            .sort((a, b) => new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime());
    }, [semesterOptions]);

    const stats = useMemo(() => {
        const total = topics.length;
        const approved = topics.filter((t) => t.status === 'APPROVED').length;
        const withStudent = topics.filter((t) => Boolean(t.registrations?.[0]?.student)).length;
        return { total, approved, withStudent };
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
            form.setFieldsValue({ semesterId: upcomingSemesterOptions[0]?.value });
        }
        setFormModalOpen(true);
    };

    const hasUpcomingSemester = upcomingSemesterOptions.length > 0;

    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp.');
            } else {
                await topicService.create({ ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp đề tài.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublishTopic = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'APPROVED' });
            } else {
                await topicService.create({ ...values, status: 'APPROVED' });
            }
            message.success('Đã phát hành đề tài.');
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 72, align: 'center' },
        {
            title: 'Tên đề tài',
            dataIndex: 'title',
            key: 'title',
            width: '46%',
            render: (text, record) => (
                <div>
                    <div className="text-sm font-semibold text-slate-900">{text}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Mã: DT-{String(record.id).padStart(3, '0')}</Text>
                </div>
            ),
        },
        {
            title: 'Sinh viên đăng ký',
            key: 'registrations',
            width: '34%',
            render: (_, record) => {
                const student = record.registrations?.[0]?.student;
                if (!student) return <Tag color="default">Chưa có</Tag>;
                return (
                    <div>
                        <div className="text-sm font-medium text-slate-800">{student.fullName}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{student.code}</Text>
                    </div>
                );
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: '20%',
            render: (status) => <StatusBadge status={status} />,
        },
    ];

    return (
        <div>
            <PageHeader
                title="Quản lý đề tài"
                subtitle="Theo dõi vòng đời đề tài của bạn: nháp, phát hành, bị từ chối và trạng thái đăng ký"
                actions={(
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openFormModal()}>
                        Đề xuất đề tài mới
                    </Button>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard icon="list_alt" iconBg="bg-slate-100" iconColor="text-slate-700" label="Tổng đề tài" value={stats.total} />
                <StatCard icon="task_alt" iconBg="bg-emerald-50" iconColor="text-emerald-700" label="Đã duyệt" value={stats.approved} />
                <StatCard icon="person_check" iconBg="bg-blue-50" iconColor="text-blue-700" label="Có sinh viên đăng ký" value={stats.withStudent} />
            </div>

            <Card
                bordered={false}
                style={{ borderRadius: 12 }}
                title="Danh sách đề tài"
                extra={(
                    <Space wrap>
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 180 }}
                            options={[{ value: PROJECT_NAME, label: PROJECT_NAME }]}
                        />
                        <Segmented
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { label: 'Tất cả', value: 'all' },
                                { label: 'Nháp', value: 'DRAFT' },
                                { label: 'Đã duyệt', value: 'APPROVED' },
                                { label: 'Từ chối', value: 'REJECTED' },
                            ]}
                        />
                        <Input
                            placeholder="Tìm đề tài / sinh viên đăng ký..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 280 }}
                            allowClear
                        />
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            style={{ width: 220 }}
                            prefix={<SortAscendingOutlined />}
                            options={[
                                { value: 'newest', label: 'Mới nhất' },
                                { value: 'oldest', label: 'Cũ nhất' },
                                { value: 'title_asc', label: 'Tên đề tài A → Z' },
                                { value: 'title_desc', label: 'Tên đề tài Z → A' },
                                { value: 'status', label: 'Theo trạng thái' },
                                { value: 'student_desc', label: 'Có SV đăng ký trước' },
                                { value: 'student_asc', label: 'Chưa có SV đăng ký trước' },
                            ]}
                        />
                    </Space>
                )}
            >
                <Table
                    dataSource={sortedTopics}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    size="middle"
                    tableLayout="fixed"
                    rowKey="id"
                    locale={{ emptyText: 'Chưa có đề tài phù hợp bộ lọc hiện tại.' }}
                />
            </Card>

            <Modal
                title={editingTopic ? 'Chỉnh sửa đề tài' : 'Đề xuất đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                width={640}
                footer={(
                    <div className="flex items-center justify-between">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu nháp</Button>
                            <Button
                                type="primary"
                                onClick={handlePublishTopic}
                                loading={submitting}
                                icon={<SendOutlined />}
                                disabled={!hasUpcomingSemester}
                            >
                                Phát hành
                            </Button>
                        </Space>
                    </div>
                )}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    {!hasUpcomingSemester && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Hiện không có học kỳ còn hạn đăng ký để đề xuất đề tài."
                            description="Bạn vẫn có thể lưu nháp, nhưng chỉ có thể phát hành khi học kỳ chưa tới hạn đăng ký."
                            style={{ marginBottom: 16 }}
                        />
                    )}
                    <Form.Item
                        name="title"
                        label="Tên đề tài"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đề tài' }]}
                    >
                        <Input placeholder="Nhập tên đề tài" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả chi tiết">
                        <TextArea rows={4} placeholder="Mô tả nội dung, phạm vi, công nghệ sử dụng..." />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item label="Tên đồ án">
                            <Input value={PROJECT_NAME} disabled />
                        </Form.Item>
                        <Form.Item
                            name="semesterId"
                            label="Học kỳ"
                            rules={[{ required: true, message: 'Vui lòng chọn học kỳ' }]}
                        >
                            <Select
                                placeholder="Chọn học kỳ còn hạn đăng ký"
                                options={upcomingSemesterOptions}
                                notFoundContent="Không có học kỳ còn hạn đăng ký"
                            />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}

export default TopicManagementPage;
