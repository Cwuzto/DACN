import { useState, useEffect } from 'react';
import {
    Card, Button, Typography, Flex, Tag, Avatar, Input, Space,
    Tooltip, Empty, Modal, message, Spin, Select, Popconfirm, Alert
} from 'antd';
import {
    TeamOutlined, UserAddOutlined, UserDeleteOutlined, CrownOutlined,
    CopyOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, LogoutOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import groupService from '../../services/groupService';
import { semesterService } from '../../services/semesterService';

const { Title, Text } = Typography;

const colors = ['#13C2C2', '#1677FF', '#722ed1', '#fa8c16', '#eb2f96'];

function GroupManagementPage() {
    const { user } = useAuthStore();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [handlingInvite, setHandlingInvite] = useState(false);

    // Create new group state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [semesters, setSemesters] = useState([]);

    useEffect(() => {
        fetchMyGroup();
        fetchSemesters();
    }, []);

    const fetchSemesters = async () => {
        try {
            const res = await semesterService.getAll();
            if (res.success && res.data.length > 0) {
                setSemesters(res.data);
                setSelectedSemesterId(res.data[0].id); // Mặc định chọn kỳ đầu tiên
            }
        } catch {
            // Không break app nếu lỗi
        }
    };

    const fetchMyGroup = async () => {
        try {
            setLoading(true);
            const res = await groupService.getMyGroup();
            if (res.success && res.data) {
                setGroup(res.data);
            } else {
                setGroup(null);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải thông tin nhóm');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName) return message.warning('Vui lòng nhập tên nhóm');
        try {
            setLoading(true);
            const res = await groupService.createGroup({ groupName: newGroupName, semesterId: selectedSemesterId });
            if (res.success) {
                message.success('Tạo nhóm thành công!');
                setShowCreateForm(false);
                fetchMyGroup();
            }
        } catch (error) {
            message.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail) return message.warning('Vui lòng nhập email');
        setIsInviting(true);
        try {
            const res = await groupService.inviteMember(group.id, inviteEmail);
            if (res.success) {
                message.success('Đã gửi lời mời thành công');
                setInviteModalOpen(false);
                setInviteEmail('');
                fetchMyGroup(); // Refresh members list
            }
        } catch (error) {
            message.error(error.message);
        } finally {
            setIsInviting(false);
        }
    };

    const handleAcceptReject = async (action) => {
        setHandlingInvite(true);
        try {
            const res = await groupService.handleInvitation(group.id, action);
            if (res.success) {
                message.success(res.message);
                fetchMyGroup();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi xử lý lời mời');
        } finally {
            setHandlingInvite(false);
        }
    };

    const handleRemoveOrLeave = async (studentId) => {
        try {
            setLoading(true);
            const res = await groupService.removeMember(group.id, studentId);
            if (res.success) {
                message.success(res.message);
                // Nếu mình tự rời nhóm, nhóm sẽ null
                fetchMyGroup();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi rời/xóa thành viên.');
            setLoading(false);
        }
    };

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    if (!group) {
        return (
            <div>
                <Title level={3} style={{ marginBottom: 24 }}>Quản lý Nhóm</Title>
                <Card style={{ borderRadius: 10, textAlign: 'center', padding: '40px 0' }}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text type="secondary">Bạn chưa tham gia nhóm nào trong học kỳ này</Text>}
                    >
                        {showCreateForm ? (
                            <Flex vertical gap={12} style={{ maxWidth: 300, margin: '16px auto 0' }}>
                                <Select
                                    placeholder="Chọn học kỳ"
                                    value={selectedSemesterId}
                                    onChange={setSelectedSemesterId}
                                    options={semesters.map(s => ({ label: s.name, value: s.id }))}
                                />
                                <Input
                                    placeholder="Nhập tên nhóm mới"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                                <Space>
                                    <Button onClick={() => setShowCreateForm(false)}>Hủy</Button>
                                    <Button type="primary" onClick={handleCreateGroup}>Xác nhận Tạo</Button>
                                </Space>
                            </Flex>
                        ) : (
                            <Button type="primary" onClick={() => setShowCreateForm(true)} style={{ marginTop: 16 }}>
                                Tạo Nhóm Mới
                            </Button>
                        )}
                    </Empty>
                </Card>
            </div>
        );
    }

    const isLeader = group.leaderId === user?.id;
    const myMembership = group.members?.find(m => m.studentId === user?.id);
    const isPendingInvite = myMembership?.status === 'INVITED';

    return (
        <div>
            {isPendingInvite && (
                <Alert
                    message="Lời mời tham gia nhóm"
                    description={`Bạn được mời tham gia nhóm "${group.groupName}". Bạn có muốn tham gia không?`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 24, borderRadius: 10 }}
                    action={
                        <Space>
                            <Button size="small" danger onClick={() => handleAcceptReject('REJECT')} loading={handlingInvite}>Từ chối</Button>
                            <Button size="small" type="primary" style={{ background: '#13C2C2' }} onClick={() => handleAcceptReject('ACCEPT')} loading={handlingInvite}>
                                Chấp nhận
                            </Button>
                        </Space>
                    }
                />
            )}

            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Quản lý Nhóm: {group.groupName}</Title>
                    <Text type="secondary">Nhóm ID: {group.id} • Học kỳ {group.semesterId}</Text>
                </div>
                {isLeader && !isPendingInvite && (
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setInviteModalOpen(true)}
                        style={{ background: '#13C2C2', borderColor: '#13C2C2' }}
                    >
                        Mời thành viên
                    </Button>
                )}
            </Flex>

            {/* Group Info */}
            <Card style={{ borderRadius: 10, marginBottom: 24 }}>
                <Flex justify="space-between" wrap="wrap" gap={24}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>ĐỀ TÀI ĐĂNG KÝ</Text>
                        {group.topic ? (
                            <>
                                <Title level={5} style={{ margin: '4px 0' }}>{group.topic.title}</Title>
                                <Text type="secondary">GVHD: {group.topic.mentor?.fullName} • Mã: T-{group.topic.id}</Text>
                            </>
                        ) : (
                            <div>
                                <Text type="warning" style={{ display: 'block', marginTop: 4 }}>
                                    <InfoCircleOutlined /> Nhóm chưa đăng ký đề tài
                                </Text>
                                <Button size="small" type="dashed" style={{ marginTop: 8 }}>Đăng ký ngay</Button>
                            </div>
                        )}
                    </div>
                    <Flex gap={16}>
                        <Card size="small" style={{ background: '#e6fffb', borderColor: '#87e8de', minWidth: 100, textAlign: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Thành viên</Text>
                            <div><Text strong style={{ fontSize: 24 }}>{group.members?.filter(m => m.status === 'ACCEPTED').length || 0}</Text><Text type="secondary">/5</Text></div>
                        </Card>
                        <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f', minWidth: 100, textAlign: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Trạng thái</Text>
                            <div><Tag color="success">Hoạt động</Tag></div>
                        </Card>
                    </Flex>
                </Flex>
            </Card>

            {/* Invite Code */}
            <Card size="small" style={{ borderRadius: 10, marginBottom: 24, background: '#fafafa' }}>
                <Flex align="center" gap={12} justify="space-between">
                    <Flex align="center" gap={8}>
                        <CopyOutlined style={{ color: '#13C2C2' }} />
                        <Text>Mã mời nhóm:</Text>
                        <Text code strong style={{ fontSize: 16, letterSpacing: 2 }}>GRP-04-XK9M</Text>
                    </Flex>
                    <Tooltip title="Sao chép mã">
                        <Button size="small" icon={<CopyOutlined />}>Sao chép</Button>
                    </Tooltip>
                </Flex>
            </Card>

            {/* Members List */}
            <Card title={<><TeamOutlined /> Danh sách thành viên</>} style={{ borderRadius: 10 }}>
                <Flex vertical gap={12}>
                    {group.members?.map((member, index) => {
                        const isMemberLeader = member.studentId === group.leaderId;
                        return (
                            <Card
                                key={member.id}
                                size="small"
                                style={{ borderRadius: 8, opacity: member.status === 'INVITED' ? 0.6 : 1 }}
                                styles={{ body: { padding: '12px 16px' } }}
                            >
                                <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                                    <Flex align="center" gap={12}>
                                        <Avatar style={{ background: colors[index % colors.length] }}>
                                            {member.student?.fullName ? member.student.fullName[0].toUpperCase() : '?'}
                                        </Avatar>
                                        <div>
                                            <Flex align="center" gap={8}>
                                                <Text strong>{member.student?.fullName}</Text>
                                                {isMemberLeader && <Tag color="gold" icon={<CrownOutlined />}>Nhóm trưởng</Tag>}
                                                {member.status === 'INVITED' && <Tag color="default">Đang chờ xác nhận</Tag>}
                                            </Flex>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                MSSV: {member.student?.code} • {member.student?.email}
                                            </Text>
                                        </div>
                                    </Flex>
                                    {!isPendingInvite && (
                                        <Space>
                                            {/* Trưởng nhóm xóa thành viên khác */}
                                            {isLeader && !isMemberLeader && (
                                                <Popconfirm
                                                    title="Xóa thành viên"
                                                    description="Bạn có chắc chắn muốn kick thành viên này khỏi nhóm?"
                                                    onConfirm={() => handleRemoveOrLeave(member.studentId)}
                                                    okText="Xóa"
                                                    okButtonProps={{ danger: true }}
                                                    cancelText="Hủy"
                                                >
                                                    <Tooltip title="Xóa khỏi nhóm">
                                                        <Button type="text" size="small" danger icon={<UserDeleteOutlined />} />
                                                    </Tooltip>
                                                </Popconfirm>
                                            )}
                                            {/* Thành viên tự rời nhóm (bao gồm trưởng nhóm nếu chỉ còn 1 mình) */}
                                            {member.studentId === user.id && (!isLeader || group.members.length === 1) && (
                                                <Popconfirm
                                                    title={isLeader ? "Giải tán nhóm" : "Rời nhóm"}
                                                    description={isLeader ? "Bạn là thành viên duy nhất. Nhóm sẽ bị giải tán. Tiếp tục?" : "Bạn có chắc chắn muốn rời khỏi nhóm này?"}
                                                    onConfirm={() => handleRemoveOrLeave(user.id)}
                                                    okText="Xác nhận"
                                                    okButtonProps={{ danger: true }}
                                                    cancelText="Hủy"
                                                >
                                                    <Tooltip title={isLeader ? "Giải tán nhóm" : "Rời nhóm"}>
                                                        <Button type="text" size="small" danger icon={<LogoutOutlined />} />
                                                    </Tooltip>
                                                </Popconfirm>
                                            )}
                                        </Space>
                                    )}
                                </Flex>
                            </Card>
                        );
                    })}
                </Flex>
            </Card>

            {/* Invite Modal */}
            <Modal
                title="Mời thành viên"
                open={inviteModalOpen}
                onCancel={() => setInviteModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setInviteModalOpen(false)}>Hủy</Button>,
                    <Button key="invite" type="primary" loading={isInviting} onClick={handleInvite} style={{ background: '#13C2C2', borderColor: '#13C2C2' }}>Gửi lời mời</Button>,
                ]}
            >
                <Input
                    placeholder="Nhập email sinh viên (vd: sv002@university.edu.vn)"
                    style={{ marginBottom: 12 }}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Sinh viên sẽ nhận được thông báo mời tham gia nhóm trên hệ thống.
                </Text>
            </Modal>
        </div>
    );
}

export default GroupManagementPage;