import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Flex, Button, Tag, Progress, Timeline, Avatar, Spin, Empty, message } from 'antd';
import {
    BookOutlined, TeamOutlined, ClockCircleOutlined, CheckCircleOutlined,
    ArrowRightOutlined, CalendarOutlined, FilePdfOutlined, CloudUploadOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import dashboardService from '../../services/dashboardService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const colors = ['#13C2C2', '#1677FF', '#722ed1', '#fa8c16', '#eb2f96'];

function StudentDashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const res = await dashboardService.getStudentStats();
                if (res.success) {
                    setData(res.data);
                }
            } catch (error) {
                message.error(error.message || 'Lỗi tải dữ liệu dashboard.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    const { hasGroup, stats, groupDetails, taskStatus, upcomingDeadlines } = data || {};
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    return (
        <div>
            {/* Greeting */}
            <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Xin chào, {user?.fullName}</Title>
                    <Text type="secondary">MSSV: {user?.code}</Text>
                </div>
                <Button type="primary" icon={<CloudUploadOutlined />} style={{ background: '#13C2C2', borderColor: '#13C2C2' }} onClick={() => navigate('/student/submissions')}>
                    Nộp báo cáo
                </Button>
            </Flex>

            {/* Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10 }}>
                        <Statistic
                            title="Đề tài đang thực hiện"
                            value={stats?.hasTopic || 0}
                            prefix={<BookOutlined style={{ color: '#1677FF' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10 }}>
                        <Statistic
                            title="Nhóm của tôi"
                            value={hasGroup ? stats?.groupName : 'Chưa có nhóm'}
                            prefix={<TeamOutlined style={{ color: '#13C2C2' }} />}
                            valueStyle={{ fontSize: hasGroup ? 20 : 16 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card hoverable style={{ borderRadius: 10, borderColor: '#ffd591' }}>
                        <Statistic
                            title={<Text style={{ color: '#fa8c16' }}><ClockCircleOutlined /> Hạn sắp tới</Text>}
                            value={nearestDeadline ? dayjs(nearestDeadline.date).format('DD/MM/YYYY') : 'Không có'}
                            valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
                        />
                    </Card>
                </Col>
            </Row>

            {
                !hasGroup && (
                    <Card style={{ borderRadius: 10, textAlign: 'center', padding: '40px 0' }}>
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={<Text type="secondary">Bạn chưa tham gia nhóm nào. Hãy tạo hoặc tham gia một nhóm để bắt đầu đồ án.</Text>}
                        >
                            <Button type="primary" onClick={() => navigate('/student/group')}>Đến Quản lý Nhóm</Button>
                        </Empty>
                    </Card>
                )
            }

            {
                hasGroup && (
                    <Row gutter={[24, 24]}>
                        {/* Current Topic */}
                        <Col xs={24} lg={14}>
                            <Card style={{ borderRadius: 10, marginBottom: 16 }}>
                                {!groupDetails?.topic ? (
                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nhóm chưa đăng ký đề tài">
                                        <Button type="dashed" onClick={() => navigate('/student/topics')}>Đăng ký đề tài</Button>
                                    </Empty>
                                ) : (
                                    <>
                                        <Tag color="processing" style={{ marginBottom: 8 }}>Đang thực hiện</Tag>
                                        <Title level={5} style={{ margin: '4px 0' }}>
                                            {groupDetails.topic.title}
                                        </Title>
                                        <Text type="secondary">GVHD: {groupDetails.topic.mentorName} • Mã: {groupDetails.topic.topicCode}</Text>

                                        <div style={{ margin: '16px 0' }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Tiến độ tổng thể</Text>
                                            <Progress percent={taskStatus.progressPercent} strokeColor="#13C2C2" />
                                        </div>

                                        <Flex gap={16} wrap="wrap">
                                            <Card size="small" style={{ flex: 1, minWidth: 150, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                                                <Flex align="center" gap={8}>
                                                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                                                    <div>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>Đã nộp</Text>
                                                        <div><Text strong>{taskStatus.submitted}/{taskStatus.total}</Text> báo cáo</div>
                                                    </div>
                                                </Flex>
                                            </Card>
                                            <Card size="small" style={{ flex: 1, minWidth: 150, background: '#fff7e6', borderColor: '#ffd591' }}>
                                                <Flex align="center" gap={8}>
                                                    <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                                                    <div>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>Còn lại</Text>
                                                        <div><Text strong>{taskStatus.remaining}</Text> bài nộp</div>
                                                    </div>
                                                </Flex>
                                            </Card>
                                        </Flex>

                                        <Flex justify="flex-end" style={{ marginTop: 16 }}>
                                            <Button type="primary" onClick={() => navigate('/student/submissions')} style={{ background: '#13C2C2', borderColor: '#13C2C2' }}>
                                                Xem chi tiết <ArrowRightOutlined />
                                            </Button>
                                        </Flex>
                                    </>
                                )}
                            </Card>

                            {/* Team members */}
                            <Card title="Thành viên nhóm" style={{ borderRadius: 10 }}>
                                <Flex vertical gap={12}>
                                    {groupDetails?.members?.map((m, i) => (
                                        <Flex key={i} align="center" gap={12}>
                                            <Avatar style={{ background: colors[i % colors.length] }}>{m.fullName[0]}</Avatar>
                                            <div>
                                                <Text strong>{m.fullName} {m.id === user.id && '(Tôi)'}</Text>
                                                <br />
                                                <Tag size="small" color={m.role === 'Nhóm trưởng' ? 'green' : 'default'}>{m.role}</Tag>
                                                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{m.code}</Text>
                                            </div>
                                        </Flex>
                                    ))}
                                </Flex>
                            </Card>
                        </Col>

                        {/* Timeline */}
                        <Col xs={24} lg={10}>
                            <Title level={5} style={{ marginBottom: 16 }}>
                                <CalendarOutlined style={{ color: '#13C2C2', marginRight: 8 }} />
                                Hạn nộp sắp tới
                            </Title>
                            <Card style={{ borderRadius: 10 }}>
                                {upcomingDeadlines?.length > 0 ? (
                                    <Timeline
                                        items={upcomingDeadlines.map((d) => ({
                                            color: d.color,
                                            children: (
                                                <div>
                                                    <Text strong style={{
                                                        fontSize: 11, textTransform: 'uppercase',
                                                        color: d.color === 'red' ? '#ff4d4f' : d.color === 'gray' ? '#8c8c8c' : '#13C2C2',
                                                    }}>
                                                        {dayjs(d.date).format('DD/MM/YYYY - HH:mm')}
                                                    </Text>
                                                    <div><Text strong>{d.title}</Text></div>
                                                    <Text type="secondary" style={{ fontSize: 13 }}>{d.desc}</Text>
                                                </div>
                                            ),
                                        }))}
                                    />
                                ) : (
                                    <Empty description={<Text type="secondary">Không có hạn nộp nào sắp tới</Text>} />
                                )}
                            </Card>

                            {/* Quick Action */}
                            {nearestDeadline && (
                                <Card
                                    style={{
                                        marginTop: 16, borderRadius: 10,
                                        background: 'linear-gradient(135deg, #13C2C2, #006d75)',
                                        border: 'none',
                                    }}
                                >
                                    <FilePdfOutlined style={{ color: '#fff', fontSize: 28, marginBottom: 8 }} />
                                    <Title level={5} style={{ color: '#fff', margin: '4px 0' }}>Sắp đến hạn</Title>
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                                        <Text strong style={{ color: '#fff' }}>{nearestDeadline.title}</Text> sẽ cần nộp vào ngày {dayjs(nearestDeadline.date).format('DD/MM/YYYY')}.
                                    </Text>
                                    <div style={{ marginTop: 12 }}>
                                        <Button ghost size="small" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => navigate('/student/submissions')}>
                                            Nộp ngay →
                                        </Button>
                                    </div>
                                </Card>
                            )}
                        </Col>
                    </Row>
                )
            }
        </div >
    );
}

export default StudentDashboardPage;