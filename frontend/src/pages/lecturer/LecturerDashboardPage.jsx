import { Card, Row, Col, Statistic, Typography, Flex, Button, Tag, Avatar, Timeline, theme, Spin, Empty, message } from 'antd';
import {
    BookOutlined, TeamOutlined, WarningOutlined, PlusOutlined,
    ArrowRightOutlined, FilePdfOutlined, FileTextOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dashboardService from '../../services/dashboardService';
import useAuthStore from '../../stores/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function LecturerDashboardPage() {
    const { token } = theme.useToken();
    const user = useAuthStore((s) => s.user);

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        activeTopics: 0,
        studentGroups: 0,
        pendingFeedback: 0
    });
    const [recentSubmissions, setRecentSubmissions] = useState([]);
    const [timelineEvents, setTimelineEvents] = useState([]);

    const fetchDashboardInfo = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getLecturerStats();
            if (res.success) {
                setStats(res.data.stats);
                setRecentSubmissions(res.data.recentSubmissions || []);
                setTimelineEvents(res.data.timelineEvents || []);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi tải dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardInfo();
    }, []);

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    return (
        <div>
            {/* Greeting */}
            <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Xin chào, {user?.fullName || 'Giảng viên'}</Title>
                    <Text type="secondary">Năm học 2023-2024</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                    Tạo đề tài mới
                </Button>
            </Flex>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10 }}>
                        <Statistic
                            title="Đề tài đang hướng dẫn"
                            value={stats.activeTopics}
                            prefix={<BookOutlined style={{ color: '#1677FF' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10 }}>
                        <Statistic
                            title="Nhóm sinh viên"
                            value={stats.studentGroups}
                            prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10, borderColor: '#ffd591' }}>
                        <Statistic
                            title={<Text style={{ color: '#fa8c16' }}><WarningOutlined /> Chờ phản hồi</Text>}
                            value={stats.pendingFeedback}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Two Column */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={14}>
                    <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                        <Title level={5} style={{ margin: 0 }}>Nhóm cần phản hồi</Title>
                        <a>Xem tất cả</a>
                    </Flex>
                    <Flex vertical gap={16}>
                        {recentSubmissions.length === 0 ? (
                            <Empty description="Không có bài nộp nào đang chờ phản hồi" />
                        ) : (
                            recentSubmissions.map((item) => (
                                <Card key={item.id} hoverable style={{ borderRadius: 10 }}>
                                    <Flex justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
                                        <Flex gap={8}>
                                            <Tag color="blue">{item.groupName}</Tag>
                                            <Tag color="orange">Mới nộp</Tag>
                                        </Flex>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.submittedAt).format('DD/MM/YYYY HH:mm')}</Text>
                                    </Flex>
                                    <Title level={5} style={{ margin: '4px 0' }}>{item.taskTitle}</Title>
                                    <Text type="secondary" style={{ fontSize: 13 }}>SV: {item.studentName} • Đề tài: {item.topicTitle}</Text>
                                    <Card
                                        size="small"
                                        style={{ marginTop: 12, background: '#fafafa', borderRadius: 8 }}
                                        styles={{ body: { padding: '8px 12px' } }}
                                    >
                                        <Flex align="center" gap={12}>
                                            <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
                                            <div>
                                                <Text strong style={{ fontSize: 13 }}>{item.fileName || 'Không có file đính kèm'}</Text>
                                                {item.fileUrl && (
                                                    <div>
                                                        <a href={item.fileUrl} target="_blank" rel="noreferrer">Tải xuống</a>
                                                    </div>
                                                )}
                                            </div>
                                        </Flex>
                                    </Card>
                                    <Flex justify="flex-end" style={{ marginTop: 12 }}>
                                        <Button type="primary" style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                                            Xem & Nhận xét <ArrowRightOutlined />
                                        </Button>
                                    </Flex>
                                </Card>
                            ))
                        )}
                    </Flex>
                </Col>

                <Col xs={24} lg={10}>
                    <Title level={5} style={{ marginBottom: 16 }}>
                        <CalendarOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                        Lịch sắp tới
                    </Title>
                    <Card style={{ borderRadius: 10 }}>
                        {timelineEvents.length === 0 ? (
                            <Empty description="Không có mốc thời gian sắp tới" />
                        ) : (
                            <Timeline
                                items={timelineEvents.map((evt) => ({
                                    color: evt.color,
                                    children: (
                                        <div>
                                            <Text strong style={{ fontSize: 11, textTransform: 'uppercase', color: evt.color === 'red' ? '#ff4d4f' : evt.color === 'gray' ? '#8c8c8c' : '#722ed1' }}>
                                                {dayjs(evt.date).format('DD/MM/YYYY HH:mm')}
                                            </Text>
                                            <div><Text strong>{evt.title}</Text></div>
                                            <Text type="secondary" style={{ fontSize: 13 }}>{evt.desc}</Text>
                                        </div>
                                    ),
                                }))}
                            />
                        )}
                        <Button block type="default" style={{ marginTop: 8 }}>Xem lịch đầy đủ</Button>
                    </Card>

                    <Card
                        style={{
                            marginTop: 16, borderRadius: 10,
                            background: 'linear-gradient(135deg, #722ed1, #531dab)',
                            border: 'none',
                        }}
                    >
                        <Title level={5} style={{ color: '#fff', margin: 0 }}>Quy chế Đồ án mới</Title>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                            Cập nhật các quy định mới về chấm điểm và tổ chức hội đồng năm học 2023-2024.
                        </Text>
                        <div style={{ marginTop: 12 }}>
                            <a style={{ color: '#fff', fontWeight: 600 }}>Đọc ngay →</a>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default LecturerDashboardPage;