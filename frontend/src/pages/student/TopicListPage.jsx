import { useState, useEffect, useCallback } from 'react';
import {
    Card, Table, Tag, Button, Input, Select, Typography, Flex, Space,
    Avatar, Tooltip, Modal, message, Popconfirm
} from 'antd';
import { SearchOutlined, HeartOutlined, HeartFilled, EyeOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import groupService from '../../services/groupService';
import useAuthStore from '../../stores/authStore';

const { Title, Text } = Typography;

function TopicListPage() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [savedIds, setSavedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('savedTopics')) || []; } catch { return []; }
    });
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [myGroup, setMyGroup] = useState(null);
    const [registering, setRegistering] = useState(false);
    const user = useAuthStore(state => state.user);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (searchText) params.search = searchText;

            const [topicRes, groupRes] = await Promise.all([
                topicService.getAll(params),
                groupService.getMyGroup()
            ]);

            if (topicRes.success) {
                setTopics(topicRes.data.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
            }
            if (groupRes.success) {
                setMyGroup(groupRes.data);
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải dữ liệu.');
        } finally {
            setLoading(false);
        }
    }, [searchText]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    const toggleSave = (id) => {
        setSavedIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            localStorage.setItem('savedTopics', JSON.stringify(next));
            return next;
        });
    };

    const handleViewDetail = async (id) => {
        try {
            const res = await topicService.getById(id);
            setDetailTopic(res.data);
            setDetailModalOpen(true);
        } catch {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const handleRegisterTopic = async (topicId) => {
        if (!myGroup) return message.warn('Bạn chưa có nhóm. Vui lòng tạo nhóm trước.');
        if (myGroup.leaderId !== user.id) return message.warn('Chỉ trưởng nhóm mới được phép đăng ký đề tài.');
        if (myGroup.topicId) return message.warn('Nhóm của bạn đã đăng ký đề tài rồi.');

        try {
            setRegistering(true);
            const res = await groupService.registerTopic(myGroup.id, topicId);
            if (res.success) {
                message.success('Đăng ký đề tài thành công!');
                fetchInitialData(); // Load lại data để cập nhật nút UI
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi đăng ký đề tài.');
        } finally {
            setRegistering(false);
        }
    };

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài', dataIndex: 'title', key: 'title',
            render: (text, record) => (
                <div>
                    <a style={{ fontWeight: 600 }} onClick={() => handleViewDetail(record.id)}>{text}</a>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>
                        Mã: DT-{String(record.id).padStart(3, '0')}
                    </Text></div>
                </div>
            ),
        },
        {
            title: 'GVHD', dataIndex: 'mentor', key: 'mentor',
            render: (mentor) => mentor ? (
                <Flex align="center" gap={8}>
                    <Avatar size={24} icon={<UserOutlined />} style={{ background: '#13C2C2' }} />
                    <Text style={{ fontSize: 13 }}>{mentor.fullName}</Text>
                </Flex>
            ) : '—',
        },
        {
            title: 'Đăng ký', key: 'slots', align: 'center', width: 100,
            render: (_, record) => {
                const groups = record._count?.groups || 0;
                const isFull = groups >= record.maxGroups;
                return <Tag color={isFull ? 'default' : 'success'}>{groups}/{record.maxGroups}</Tag>;
            },
        },
        {
            title: 'Trạng thái', key: 'availability', width: 120, align: 'center',
            render: (_, record) => {
                const groups = record._count?.groups || 0;
                return groups >= record.maxGroups
                    ? <Tag color="default">Đã đủ</Tag>
                    : <Tag color="success">Còn chỗ</Tag>;
            },
        },
        {
            title: '', key: 'action', width: 120, align: 'center',
            render: (_, record) => {
                const isFull = (record._count?.groups || 0) >= record.maxGroups;
                const canRegister = myGroup && myGroup.leaderId === user.id && !myGroup.topicId && !isFull && record.semesterId === myGroup.semesterId;
                const alreadyRegisteredThis = myGroup?.topicId === record.id;

                return (
                    <Space size="small">
                        <Tooltip title="Xem chi tiết">
                            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)} />
                        </Tooltip>

                        {alreadyRegisteredThis ? (
                            <Tooltip title="Đề tài nhóm bạn">
                                <Button type="primary" size="small" icon={<CheckCircleOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }} />
                            </Tooltip>
                        ) : canRegister ? (
                            <Popconfirm
                                title="Đăng ký đề tài"
                                description={`Bạn có chắc chắn muốn đăng ký đề tài "${record.title}" cho nhóm? (hành động này không thể hoàn tác)`}
                                onConfirm={() => handleRegisterTopic(record.id)}
                                okText="Đăng ký"
                                cancelText="Hủy"
                                okButtonProps={{ loading: registering }}
                            >
                                <Button type="primary" size="small" ghost>Đăng ký</Button>
                            </Popconfirm>
                        ) : (
                            <Tooltip title={savedIds.includes(record.id) ? 'Bỏ lưu' : 'Lưu'}>
                                <Button
                                    type="text"
                                    size="small"
                                    onClick={() => toggleSave(record.id)}
                                    icon={savedIds.includes(record.id) ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                                />
                            </Tooltip>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Danh sách Đề tài</Title>
                    <Text type="secondary">Tìm kiếm và đăng ký đề tài phù hợp</Text>
                </div>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Flex gap={12} wrap="wrap" style={{ padding: '16px 24px' }} justify="end">
                    <Input
                        placeholder="Tìm đề tài, giảng viên..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 320 }}
                        allowClear
                    />
                </Flex>
                <Table
                    dataSource={topics}
                    columns={columns}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} của ${total} đề tài`,
                    }}
                    size="middle"
                />
            </Card>

            {/* Modal chi tiết */}
            <Modal
                title="Chi tiết đề tài"
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={650}
            >
                {detailTopic && (
                    <div>
                        <Title level={4}>{detailTopic.title}</Title>
                        <Text type="secondary">{detailTopic.description || 'Chưa có mô tả.'}</Text>
                        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><Text strong>GVHD: </Text><Text>{detailTopic.mentor?.fullName}</Text></div>
                            <div><Text strong>Số nhóm tối đa: </Text><Text>{detailTopic.maxGroups}</Text></div>
                            <div><Text strong>Đợt đồ án: </Text><Text>{detailTopic.semester?.name}</Text></div>
                            <div><Text strong>Đã đăng ký: </Text><Text>{detailTopic.groups?.length || 0} nhóm</Text></div>
                        </div>
                        {detailTopic.groups?.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong>Nhóm đã đăng ký:</Text>
                                {detailTopic.groups.map(g => (
                                    <Card key={g.id} size="small" style={{ marginTop: 8 }}>
                                        <Text strong>{g.groupName}</Text> — Trưởng nhóm: {g.leader?.fullName}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default TopicListPage;