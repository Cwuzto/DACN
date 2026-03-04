import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Card, Table, Tag, Button, Typography, Flex, Space, Avatar, Tooltip, Row, Col, Statistic, Select, theme,
    Modal, Form, Input, DatePicker, message, Popconfirm, List
} from 'antd';
import {
    PlusOutlined, TeamOutlined, CalendarOutlined, CheckCircleOutlined,
    ClockCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    LinkOutlined, DisconnectOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import councilService from '../../services/councilService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import groupService from '../../services/groupService';

const { Title, Text } = Typography;

function CouncilAssignmentPage() {
    const { token } = theme.useToken();

    // Data states
    const [councils, setCouncils] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [unassignedGroups, setUnassignedGroups] = useState([]);

    // Filters
    const [selectedSemester, setSelectedSemester] = useState(null);

    // UI states
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    // Modals
    const [isCouncilModalVisible, setIsCouncilModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [editingCouncil, setEditingCouncil] = useState(null);
    const [assigningCouncil, setAssigningCouncil] = useState(null);
    const [selectedGroupsToAssign, setSelectedGroupsToAssign] = useState([]);

    const [form] = Form.useForm();

    // Data Fetching
    const fetchSemesters = async () => {
        try {
            const res = await semesterService.getAll();
            if (res.success && res.data.length > 0) {
                setSemesters(res.data);
                if (!selectedSemester) {
                    setSelectedSemester(res.data[0].id);
                }
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách học kỳ');
        }
    };

    const fetchLecturers = async () => {
        try {
            const res = await userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 });
            if (res.success) setLecturers(res.data);
        } catch (error) {
            message.error('Lỗi khi tải danh sách giảng viên');
        }
    };

    const fetchCouncils = useCallback(async () => {
        if (!selectedSemester) return;
        setLoading(true);
        try {
            const res = await councilService.getCouncils({ semesterId: selectedSemester });
            if (res.success) setCouncils(res.data);
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách hội đồng');
        } finally {
            setLoading(false);
        }
    }, [selectedSemester]);

    useEffect(() => {
        fetchSemesters();
        fetchLecturers();
    }, []);

    useEffect(() => {
        fetchCouncils();
    }, [fetchCouncils]);

    // Handlers: Council Modal
    const showCreateModal = () => {
        setEditingCouncil(null);
        form.resetFields();
        form.setFieldsValue({ semesterId: selectedSemester });
        setIsCouncilModalVisible(true);
    };

    const showEditModal = (council) => {
        setEditingCouncil(council);

        // Map members to initial values
        const chairman = council.members.find(m => m.roleInCouncil === 'CHAIRMAN')?.lecturerId;
        const secretary = council.members.find(m => m.roleInCouncil === 'SECRETARY')?.lecturerId;
        const reviewers = council.members.filter(m => m.roleInCouncil === 'REVIEWER').map(m => m.lecturerId);
        const members = council.members.filter(m => m.roleInCouncil === 'MEMBER').map(m => m.lecturerId);

        form.setFieldsValue({
            name: council.name,
            location: council.location,
            defenseDate: council.defenseDate ? dayjs(council.defenseDate) : null,
            chairman,
            secretary,
            reviewers,
            members,
        });
        setIsCouncilModalVisible(true);
    };

    const handleSaveCouncil = async () => {
        try {
            const values = await form.validateFields();
            setSubmitLoading(true);

            // Construct members array
            const builtMembers = [];
            if (values.chairman) builtMembers.push({ lecturerId: values.chairman, roleInCouncil: 'CHAIRMAN' });
            if (values.secretary) builtMembers.push({ lecturerId: values.secretary, roleInCouncil: 'SECRETARY' });
            if (values.reviewers?.length) {
                values.reviewers.forEach(id => builtMembers.push({ lecturerId: id, roleInCouncil: 'REVIEWER' }));
            }
            if (values.members?.length) {
                values.members.forEach(id => builtMembers.push({ lecturerId: id, roleInCouncil: 'MEMBER' }));
            }

            const payload = {
                semesterId: selectedSemester,
                name: values.name,
                location: values.location,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
                members: builtMembers
            };

            if (editingCouncil) {
                await councilService.updateCouncil(editingCouncil.id, payload);
                message.success('Cập nhật hội đồng thành công');
            } else {
                await councilService.createCouncil(payload);
                message.success('Tạo hội đồng thành công');
            }
            setIsCouncilModalVisible(false);
            fetchCouncils();
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDeleteCouncil = async (id) => {
        try {
            const res = await councilService.deleteCouncil(id);
            if (res.success) {
                message.success('Xóa hội đồng thành công');
                fetchCouncils();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi xóa hội đồng');
        }
    };

    // Handlers: Assign Groups Modal
    const showAssignModal = async (council) => {
        setAssigningCouncil(council);
        setSelectedGroupsToAssign([]);
        try {
            setLoading(true);
            const res = await groupService.getGroups({ semesterId: selectedSemester, unassignedOnly: true });
            if (res.success) {
                setUnassignedGroups(res.data);
            }
            setIsAssignModalVisible(true);
        } catch (error) {
            message.error('Lỗi khi tải danh sách nhóm chưa phân công');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignGroups = async () => {
        if (!selectedGroupsToAssign || selectedGroupsToAssign.length === 0) {
            return message.warning('Vui lòng chọn ít nhất 1 nhóm để phân công');
        }

        try {
            setSubmitLoading(true);
            await councilService.assignGroups(assigningCouncil.id, selectedGroupsToAssign);
            message.success('Phân công nhóm thành công');
            setIsAssignModalVisible(false);
            fetchCouncils();
        } catch (error) {
            message.error(error.message || 'Lỗi khi phân công nhóm');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Helper to get lecturer select options
    const lecturerOptions = useMemo(() => {
        return lecturers.map(l => ({ label: `${l.fullName} (${l.code})`, value: l.id }));
    }, [lecturers]);

    // Table Columns
    const columns = [
        {
            title: 'Hội đồng', dataIndex: 'name', key: 'name',
            render: (text, record) => (
                <div>
                    <Text strong>{text}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{record.location || 'Chưa xếp phòng'}</Text></div>
                </div>
            ),
        },
        {
            title: 'Chủ tịch HĐ', key: 'chairman',
            render: (_, record) => {
                const chairman = record.members?.find(m => m.roleInCouncil === 'CHAIRMAN')?.lecturer;
                if (!chairman) return <Text type="secondary">Chưa chọn</Text>;
                return (
                    <Flex align="center" gap={8}>
                        <Avatar size={24} src={chairman.avatarUrl} style={{ background: '#722ed1' }}>
                            {chairman.fullName[0]}
                        </Avatar>
                        <Text>{chairman.fullName}</Text>
                    </Flex>
                );
            },
        },
        {
            title: 'Ngày bảo vệ', dataIndex: 'defenseDate', key: 'defenseDate',
            render: (text) => (
                <Flex align="center" gap={4}>
                    <CalendarOutlined style={{ color: '#8c8c8c' }} />
                    <Text>{text ? dayjs(text).format('DD/MM/YYYY') : 'Chưa xếp'}</Text>
                </Flex>
            ),
        },
        {
            title: 'Tổng T/viên', key: 'memberCount', align: 'center',
            render: (_, record) => <Tag color="blue" icon={<TeamOutlined />}>{record.members?.length || 0} người</Tag>,
        },
        {
            title: 'Số nhóm', key: 'groupCount', align: 'center',
            render: (_, record) => <Text strong>{record._count?.groups || 0}</Text>,
        },
        {
            title: 'Phân nhóm', key: 'assign', align: 'center',
            render: (_, record) => (
                <Tooltip title="Gán nhóm bảo vệ vào Hội đồng này">
                    <Button
                        type="dashed" size="small"
                        icon={<LinkOutlined />}
                        onClick={() => showAssignModal(record)}
                    >
                        Phân công
                    </Button>
                </Tooltip>
            ),
        },
        {
            title: 'Hành động', key: 'action', width: 120, align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Chỉnh sửa">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)} style={{ color: '#1677FF' }} />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa hội đồng"
                        description="Bạn có chắc muốn xóa hội đồng này không?"
                        onConfirm={() => handleDeleteCouncil(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={record._count?.groups > 0} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Phân công Hội đồng</Title>
                    <Text type="secondary">Quản lý và phân công hội đồng bảo vệ đồ án</Text>
                </div>
                <Space>
                    <Select
                        value={selectedSemester}
                        onChange={setSelectedSemester}
                        style={{ width: 200 }}
                        options={semesters.map(s => ({ value: s.id, label: s.name }))}
                        loading={semesters.length === 0}
                        placeholder="Chọn học kỳ"
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal} disabled={!selectedSemester}>
                        Tạo hội đồng
                    </Button>
                </Space>
            </Flex>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} md={8}>
                    <Card>
                        <Statistic
                            title="Tổng Hội đồng (Học kỳ này)"
                            value={councils.length}
                            prefix={<TeamOutlined style={{ color: '#1677FF' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} md={8}>
                    <Card>
                        <Statistic
                            title="Tổng số thành viên HĐ"
                            value={councils.reduce((sum, c) => sum + (c.members?.length || 0), 0)}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} md={8}>
                    <Card>
                        <Statistic
                            title="Tổng nhóm được phân công"
                            value={councils.reduce((sum, c) => sum + (c._count?.groups || 0), 0)}
                            prefix={<CalendarOutlined style={{ color: '#722ed1' }} />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={councils}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    rowKey="id"
                    loading={loading}
                    size="middle"
                />
            </Card>

            {/* Modal: Tạo / Sửa Hội đồng */}
            <Modal
                title={editingCouncil ? 'Chỉnh sửa Hội đồng' : 'Tạo Hội đồng mới'}
                open={isCouncilModalVisible}
                onOk={handleSaveCouncil}
                onCancel={() => setIsCouncilModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="name" label="Tên hội đồng" rules={[{ required: true, message: 'Nhập tên hội đồng' }]}>
                                <Input placeholder="VD: Hội đồng CNTT - 01" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="location" label="Phòng bảo vệ">
                                <Input placeholder="VD: P. 301" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="defenseDate" label="Ngày bảo vệ">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="chairman" label="Chủ tịch Hội đồng" rules={[{ required: true, message: 'Chọn chủ tịch' }]}>
                                <Select
                                    showSearch
                                    placeholder="Chọn giảng viên"
                                    optionFilterProp="label"
                                    options={lecturerOptions}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="secretary" label="Thư ký Hội đồng">
                                <Select
                                    showSearch
                                    placeholder="Chọn giảng viên"
                                    optionFilterProp="label"
                                    options={lecturerOptions}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="reviewers" label="Ủy viên / Phản biện">
                        <Select
                            mode="multiple"
                            showSearch
                            placeholder="Chọn các giảng viên phản biện"
                            optionFilterProp="label"
                            options={lecturerOptions}
                        />
                    </Form.Item>

                    <Form.Item name="members" label="Ủy viên khác">
                        <Select
                            mode="multiple"
                            showSearch
                            placeholder="Chọn các giảng viên ủy viên"
                            optionFilterProp="label"
                            options={lecturerOptions}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal: Phân công Nhóm */}
            <Modal
                title={`Phân công Nhóm vào "${assigningCouncil?.name}"`}
                open={isAssignModalVisible}
                onOk={handleAssignGroups}
                onCancel={() => setIsAssignModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Chọn các nhóm trong học kỳ hiện tại đã có đề tài nhưng chưa được phân công hội đồng.</Text>
                </div>

                <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Chọn các nhóm để phân công"
                    value={selectedGroupsToAssign}
                    onChange={setSelectedGroupsToAssign}
                    optionLabelProp="label"
                    loading={loading}
                    options={unassignedGroups.map(g => ({
                        value: g.id,
                        label: `${g.groupName} - ${g.topic?.title.substring(0, 30)}...`,
                        desc: <div><Text strong>{g.groupName}</Text> (Nhóm trưởng: {g.leader?.fullName})<br /><Text type="secondary">{g.topic?.title}</Text></div>
                    }))}
                    optionRender={(option) => option.data.desc}
                />
            </Modal>
        </div>
    );
}

export default CouncilAssignmentPage;