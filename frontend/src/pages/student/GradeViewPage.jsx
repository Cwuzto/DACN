import { useState, useEffect } from 'react';
import { Card, Typography, Flex, Tag, Row, Col, Table, Spin, Empty, message } from 'antd';
import {
    TrophyOutlined, CheckCircleOutlined, StarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { Title, Text } = Typography;

const weightMap = {
    'MENTOR_SCORE': { label: 'GVHD', weight: 40 },
    'REVIEWER_SCORE': { label: 'GV Phản biện', weight: 30 },
    'COUNCIL_SCORE': { label: 'Hội đồng', weight: 30 }
};

const columns = [
    { title: 'Thành phần', dataIndex: 'category', key: 'category', render: (text) => <Text strong>{text}</Text> },
    { title: 'Người chấm', dataIndex: 'lecturer', key: 'lecturer' },
    { title: 'Trọng số', dataIndex: 'weight', key: 'weight', align: 'center' },
    {
        title: 'Điểm', dataIndex: 'score', key: 'score', align: 'center',
        render: (val) => (
            <Text strong style={{ fontSize: 16, color: val >= 8 ? '#52c41a' : val >= 6.5 ? '#fa8c16' : '#ff4d4f' }}>
                {val}
            </Text>
        ),
    },
    { title: 'Nhận xét', dataIndex: 'note', key: 'note', ellipsis: true },
];

function GradeViewPage() {
    const [loading, setLoading] = useState(true);
    const [groupInfo, setGroupInfo] = useState(null);
    const [grades, setGrades] = useState([]);
    const [totalScore, setTotalScore] = useState(0);

    useEffect(() => {
        const fetchGrades = async () => {
            try {
                setLoading(true);
                const res = await evaluationService.getMyGrades();
                if (res.success && res.data) {
                    setGroupInfo(res.data.group);

                    if (res.data.grades) {
                        // Transform map raw evaluations into table breakdown
                        let computedTotal = 0;
                        const formattedGrades = res.data.grades.map((g, index) => {
                            const config = weightMap[g.evaluationType] || { label: 'Khác', weight: 0 };
                            const computedScore = g.score || 0;
                            computedTotal += computedScore * (config.weight / 100);

                            return {
                                key: index,
                                category: config.label,
                                lecturer: g.evaluatorName,
                                weight: `${config.weight}%`,
                                score: computedScore,
                                note: g.comments
                            };
                        });

                        setGrades(formattedGrades);
                        setTotalScore(computedTotal);
                    }
                }
            } catch (error) {
                message.error('Lỗi khi tải điểm: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchGrades();
    }, []);

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    if (!groupInfo) {
        return <Empty description="Bạn chưa tham gia nhóm đồ án nào." style={{ marginTop: 60 }} />;
    }

    const gradeLabel = totalScore >= 8.5 ? 'A' : totalScore >= 7.0 ? 'B' : totalScore >= 5.5 ? 'C' : totalScore >= 4.0 ? 'D' : 'F';
    const gradeColor = totalScore >= 8.5 ? '#52c41a' : totalScore >= 7.0 ? '#1677FF' : totalScore >= 5.5 ? '#fa8c16' : '#ff4d4f';
    const isPassed = totalScore >= 4.0;

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Xem Điểm</Title>
                    <Text type="secondary">Kết quả đánh giá đồ án của bạn</Text>
                </div>
            </Flex>

            {/* Topic Info */}
            <Card style={{ borderRadius: 10, marginBottom: 24 }}>
                <Flex justify="space-between" wrap="wrap" gap={16}>
                    <div>
                        <Tag color="processing">
                            <FileTextOutlined /> Đồ án Chuyên ngành
                        </Tag>
                        <Title level={5} style={{ margin: '8px 0 4px' }}>
                            {groupInfo.topicTitle}
                        </Title>
                        <Text type="secondary">GVHD: {groupInfo.mentorName} • Nhóm: {groupInfo.groupName}</Text>
                    </div>
                </Flex>
            </Card>

            {/* Score Summary */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                    <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                        <TrophyOutlined style={{ fontSize: 32, color: gradeColor, marginBottom: 8 }} />
                        <Title level={2} style={{ margin: 0, color: gradeColor }}>{totalScore.toFixed(1)}</Title>
                        <Text type="secondary">Điểm tổng kết</Text>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                        <StarOutlined style={{ fontSize: 32, color: gradeColor, marginBottom: 8 }} />
                        <Title level={2} style={{ margin: 0, color: gradeColor }}>{gradeLabel}</Title>
                        <Text type="secondary">Xếp loại</Text>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                        <CheckCircleOutlined style={{ fontSize: 32, color: isPassed ? '#52c41a' : '#ff4d4f', marginBottom: 8 }} />
                        <Title level={2} style={{ margin: 0, color: isPassed ? '#52c41a' : '#ff4d4f' }}>
                            {isPassed ? 'Đạt' : 'Không Đạt'}
                        </Title>
                        <Text type="secondary">Kết quả</Text>
                    </Card>
                </Col>
            </Row>

            {/* Grade Breakdown */}
            <Card
                title="Chi tiết Điểm số"
                style={{ borderRadius: 10 }}
                styles={{ body: { padding: 0 } }}
            >
                {grades.length > 0 ? (
                    <Table
                        dataSource={grades}
                        columns={columns}
                        pagination={false}
                        size="middle"
                    />
                ) : (
                    <Empty description="Giảng viên chưa chấm điểm thành phần nào." style={{ padding: '24px 0' }} />
                )}
            </Card>
        </div>
    );
}

export default GradeViewPage;