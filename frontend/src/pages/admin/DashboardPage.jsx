import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Flex, theme, message, Spin } from 'antd';
import {
    UserOutlined,
    FileTextOutlined,
    WarningOutlined,
    ClockCircleOutlined,
    ArrowUpOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dashboardService from '../../services/dashboardService';

const { Title, Text } = Typography;

const statusMap = {
    new: { label: 'Mới', color: 'blue' },
    submitted: { label: 'Đã nộp', color: 'green' },
    done: { label: 'Hoàn tất', color: 'purple' },
    updated: { label: 'Cập nhật', color: 'default' },
};

const columns = [
    {
        title: 'Thời gian',
        dataIndex: 'time',
        key: 'time',
        width: 160,
        render: (time) => dayjs(time).format('HH:mm DD/MM/YYYY')
    },
    {
        title: 'Người dùng',
        dataIndex: 'user',
        key: 'user',
        render: (text) => <Text strong>{text}</Text>,
    },
    {
        title: 'Hành động',
        dataIndex: 'action',
        key: 'action',
    },
    {
        title: 'Chi tiết',
        dataIndex: 'detail',
        key: 'detail',
        ellipsis: true,
    },
    {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status) => {
            const s = statusMap[status] || statusMap['updated'];
            return <Tag color={s.color}>{s.label}</Tag>;
        },
    },
];

function DashboardPage() {
    const { token } = theme.useToken();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        ongoingTopics: 0,
        unassignedGroups: 0,
        upcomingDefenses: 0
    });
    const [chartData, setChartData] = useState([]);
    const [scoreDistribution, setScoreDistribution] = useState([
        { label: 'Xuất sắc', percent: 0, color: '#1677FF' },
        { label: 'Giỏi', percent: 0, color: '#13C2C2' },
        { label: 'Khá', percent: 0, color: '#52C41A' },
        { label: 'Trung bình', percent: 0, color: '#FAAD14' }
    ]);
    const [scoreTotal, setScoreTotal] = useState(0);
    const [recentActivities, setRecentActivities] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const [statsRes, semestersRes, scoresRes, activitiesRes] = await Promise.all([
                    dashboardService.getStats(),
                    dashboardService.getSemesterStats(),
                    dashboardService.getScores(),
                    dashboardService.getActivities()
                ]);

                if (statsRes.success) setStats(statsRes.data);
                if (semestersRes.success) setChartData(semestersRes.data);
                if (scoresRes.success) {
                    setScoreDistribution(scoresRes.data);
                    setScoreTotal(scoresRes.total);
                }
                if (activitiesRes.success) setRecentActivities(activitiesRes.data);

            } catch (error) {
                message.error('Lỗi khi tải dữ liệu trang tổng quan.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const statCards = [
        {
            title: 'Tổng Sinh viên',
            value: stats.totalStudents,
            icon: <UserOutlined style={{ fontSize: 24, color: '#1677FF' }} />,
            bgColor: '#E6F4FF',
            suffix: (
                <Text style={{ fontSize: 12, color: '#52C41A' }}>
                    Trên toàn hệ thống
                </Text>
            ),
        },
        {
            title: 'Đề tài đang thực hiện',
            value: stats.ongoingTopics,
            icon: <FileTextOutlined style={{ fontSize: 24, color: '#13C2C2' }} />,
            bgColor: '#E6FFFB',
            suffix: <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Đã được duyệt</Text>,
        },
        {
            title: 'Nhóm chưa phân HD',
            value: stats.unassignedGroups,
            icon: <WarningOutlined style={{ fontSize: 24, color: '#FA8C16' }} />,
            bgColor: '#FFF7E6',
            suffix: (
                <Text style={{ fontSize: 12, color: stats.unassignedGroups > 0 ? '#FF4D4F' : '#52C41A' }}>
                    {stats.unassignedGroups > 0 ? <><ExclamationCircleOutlined /> Cần xử lý sớm</> : 'Đã phân công hết'}
                </Text>
            ),
        },
        {
            title: 'Hội đồng sắp bảo vệ',
            value: stats.upcomingDefenses,
            icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#FF4D4F' }} />,
            bgColor: '#FFF1F0',
            suffix: <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Tính từ hôm nay</Text>,
        },
    ];

    if (loading) {
        return (
            <Flex justify="center" align="center" style={{ minHeight: '60vh' }}>
                <Spin size="large" tip="Đang tải dữ liệu..." />
            </Flex>
        );
    }

    return (
        <div>
            {/* ===== Statistic Cards ===== */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {statCards.map((card, idx) => (
                    <Col xs={24} sm={12} lg={6} key={idx}>
                        <Card
                            hoverable
                            styles={{ body: { padding: 20 } }}
                            style={{ borderRadius: 10 }}
                        >
                            <Flex justify="space-between" align="flex-start">
                                <Statistic title={card.title} value={card.value} />
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '50%',
                                        background: card.bgColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {card.icon}
                                </div>
                            </Flex>
                            <div style={{ marginTop: 8 }}>{card.suffix}</div>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* ===== Charts Row ===== */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {/* Bar Chart */}
                <Col xs={24} lg={14}>
                    <Card
                        title="Thống kê Đồ án theo Học kỳ"
                        extra={
                            <Flex gap={12}>
                                <Flex align="center" gap={6}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1677FF' }} />
                                    <Text style={{ fontSize: 12 }}>Đăng ký</Text>
                                </Flex>
                                <Flex align="center" gap={6}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#52C41A' }} />
                                    <Text style={{ fontSize: 12 }}>Đã chấm điểm</Text>
                                </Flex>
                            </Flex>
                        }
                        style={{ borderRadius: 10, height: '100%' }}
                    >
                        {chartData.length > 0 ? (
                            <Flex align="flex-end" justify="space-around" gap={16} style={{ height: 220, padding: '0 8px' }}>
                                {chartData.map((item, idx) => {
                                    // Tìm mức tối đa để scale chiều cao phần trăm
                                    const maxVal = Math.max(...chartData.map(d => d.registered), 10);
                                    const regHeight = Math.max((item.registered / maxVal) * 100, 2);
                                    const compHeight = Math.max((item.completed / maxVal) * 100, 2);

                                    return (
                                        <Flex key={idx} vertical align="center" gap={8} style={{ flex: 1 }}>
                                            <Flex align="flex-end" gap={3} style={{ height: 180 }}>
                                                <div
                                                    style={{
                                                        width: 18,
                                                        height: `${regHeight}%`,
                                                        background: '#1677FF',
                                                        borderRadius: '3px 3px 0 0',
                                                        transition: 'height 0.3s',
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        width: 18,
                                                        height: `${compHeight}%`,
                                                        background: item.completed > 0 ? '#52C41A' : '#f0f0f0',
                                                        borderRadius: '3px 3px 0 0',
                                                        transition: 'height 0.3s',
                                                    }}
                                                />
                                            </Flex>
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: idx === chartData.length - 1 ? 600 : 400,
                                                    color: idx === chartData.length - 1 ? '#1677FF' : '#8c8c8c',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {item.label}
                                            </Text>
                                        </Flex>
                                    );
                                })}
                            </Flex>
                        ) : (
                            <Flex justify="center" align="center" style={{ height: 220 }}>
                                <Text type="secondary">Chưa có dữ liệu học kỳ</Text>
                            </Flex>
                        )}
                    </Card>
                </Col>

                {/* Donut Chart */}
                <Col xs={24} lg={10}>
                    <Card title="Phân bổ Đánh giá Hội đồng" style={{ borderRadius: 10, height: '100%' }}>
                        <Flex vertical align="center" gap={20}>
                            {/* CSS Donut */}
                            {scoreTotal > 0 ? (
                                <div
                                    style={{
                                        width: 180,
                                        height: 180,
                                        borderRadius: '50%',
                                        background: `conic-gradient(
                        ${scoreDistribution[0].color} 0% ${scoreDistribution[0].percent}%,
                        ${scoreDistribution[1].color} ${scoreDistribution[0].percent}% ${scoreDistribution[0].percent + scoreDistribution[1].percent}%,
                        ${scoreDistribution[2].color} ${scoreDistribution[0].percent + scoreDistribution[1].percent}% ${scoreDistribution[0].percent + scoreDistribution[1].percent + scoreDistribution[2].percent}%,
                        ${scoreDistribution[3].color} ${scoreDistribution[0].percent + scoreDistribution[1].percent + scoreDistribution[2].percent}% 100%
                      )`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 120,
                                            height: 120,
                                            borderRadius: '50%',
                                            background: '#fff',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Text type="secondary" style={{ fontSize: 13 }}>Tổng số</Text>
                                        <Text strong style={{ fontSize: 26 }}>{scoreTotal}</Text>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: '50%' }}>
                                    <div style={{ width: 120, height: 120, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text type="secondary">0</Text>
                                    </div>
                                </div>
                            )}

                            {/* Legend */}
                            <Row gutter={[16, 8]} style={{ width: '100%' }}>
                                {scoreDistribution.map((item, idx) => (
                                    <Col span={12} key={idx}>
                                        <Flex align="center" gap={8}>
                                            <div
                                                style={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    background: item.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Text style={{ fontSize: 13 }}>
                                                {item.label} ({item.percent}%)
                                            </Text>
                                        </Flex>
                                    </Col>
                                ))}
                            </Row>
                        </Flex>
                    </Card>
                </Col>
            </Row>

            {/* ===== Recent Activity Table ===== */}
            <Card
                title="Hoạt động gần đây"
                style={{ borderRadius: 10 }}
                styles={{ body: { padding: 0 } }}
            >
                <Table
                    dataSource={recentActivities}
                    columns={columns}
                    pagination={false}
                    size="middle"
                    rowKey="id"
                    locale={{ emptyText: 'Chưa có hoạt động nào trong hệ thống' }}
                />
            </Card>
        </div>
    );
}

export default DashboardPage;