import { useState, useEffect } from 'react';
import { Card, Button, Typography, Flex, Tag, Input, InputNumber, Avatar, Row, Col, Space, Divider, message, Spin, Empty } from 'antd';
import {
    DownloadOutlined, FilterOutlined, CheckCircleOutlined,
    TeamOutlined, CalendarOutlined, SafetyCertificateOutlined, SaveOutlined
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Removed mockGradingGroups

function GradingCard({ group, onRefresh }) {
    const [students, setStudents] = useState(group.students || []);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setStudents(group.students || []);
    }, [group.students]);

    const handleScoreChange = (index, value) => {
        const newStudents = [...students];
        newStudents[index] = { ...newStudents[index], score: value };
        setStudents(newStudents);
    };

    const handleCommentChange = (index, value) => {
        const newStudents = [...students];
        newStudents[index] = { ...newStudents[index], comment: value };
        setStudents(newStudents);
    };

    const handleSave = async (isDraft = false) => {
        try {
            setSaving(true);
            const evaluationsParams = students.map(s => ({
                studentId: s.id,
                score: s.score,
                comments: s.comment
            }));

            const res = await evaluationService.submitEvaluations(group.id, 'MENTOR_SCORE', evaluationsParams);
            if (res.success) {
                message.success(isDraft ? 'Đã lưu nháp thành công!' : 'Đã xác nhận điểm thành công!');
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi lưu điểm');
        } finally {
            setSaving(false);
        }
    };

    const allScored = students.length > 0 && students.every(s => s.score !== null && s.score !== undefined && s.score !== '');

    return (
        <Card style={{ borderRadius: 10, marginBottom: 16 }}>
            {/* Header */}
            <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 16 }}>
                <div>
                    <Flex gap={8} style={{ marginBottom: 4 }}>
                        <Tag color="blue">{group.groupName}</Tag>
                        <Tag color={group.roleColor}>{group.roleTag}</Tag>
                    </Flex>
                    <Title level={5} style={{ margin: 0 }}>{group.topic}</Title>
                </div>
                <Tag color={group.statusColor}>{group.status}</Tag>
            </Flex>

            <Divider style={{ margin: '12px 0' }} />

            {/* Student Grading */}
            {students.map((student, index) => (
                <div key={student.id} style={{ marginBottom: index < students.length - 1 ? 16 : 0 }}>
                    <Flex gap={16} wrap="wrap" align="flex-start">
                        <Flex align="center" gap={12} style={{ minWidth: 200 }}>
                            <Avatar style={{ background: '#1677FF' }}>{student.name ? student.name[0] : 'S'}</Avatar>
                            <div>
                                <Text strong>{student.name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{student.code}</Text>
                            </div>
                        </Flex>
                        <InputNumber
                            min={0}
                            max={10}
                            step={0.1}
                            value={student.score}
                            onChange={(val) => handleScoreChange(index, val)}
                            placeholder="0.0"
                            style={{ width: 100 }}
                            size="large"
                        />
                        <TextArea
                            rows={2}
                            value={student.comment}
                            onChange={(e) => handleCommentChange(index, e.target.value)}
                            placeholder="Nhập nhận xét về thái độ, đóng góp..."
                            style={{ flex: 1, minWidth: 250 }}
                        />
                    </Flex>
                    {index < students.length - 1 && <Divider dashed style={{ margin: '12px 0' }} />}
                </div>
            ))}

            <Divider style={{ margin: '16px 0 12px' }} />

            {/* Footer */}
            <Flex justify="flex-end" gap={12}>
                <Button icon={<SaveOutlined />} onClick={() => handleSave(true)} loading={saving}>
                    Lưu nháp
                </Button>
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={!allScored}
                    loading={saving}
                    onClick={() => handleSave(false)}
                    style={allScored ? { background: '#722ed1', borderColor: '#722ed1' } : {}}
                >
                    Xác nhận điểm
                </Button>
            </Flex>
        </Card>
    );
}

function GradingPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGradingGroups = async () => {
        try {
            setLoading(true);
            const res = await evaluationService.getGradingGroups();
            if (res.success) {
                setGroups(res.data);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách nhóm chấm điểm');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGradingGroups();
    }, []);

    return (
        <div>
            {/* Header */}
            <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} style={{ marginBottom: 24 }}>
                <div>
                    <Text type="secondary">Học kỳ 2023-2024 / Đánh giá</Text>
                    <Title level={3} style={{ margin: 0 }}>Chấm điểm Đồ án Tốt nghiệp</Title>
                </div>
                <Space>
                    <Button icon={<FilterOutlined />}>Lọc</Button>
                    <Button type="primary" icon={<DownloadOutlined />}>Xuất Excel</Button>
                </Space>
            </Flex>

            {/* Info Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                    <Card size="small">
                        <Flex align="center" gap={12}>
                            <TeamOutlined style={{ fontSize: 20, color: '#1677FF' }} />
                            <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>HỘI ĐỒNG</Text>
                                <div><Text strong>K17 - CNTT - Đợt 1</Text></div>
                            </div>
                        </Flex>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card size="small">
                        <Flex align="center" gap={12}>
                            <SafetyCertificateOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
                            <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>VAI TRÒ CHẤM</Text>
                                <div><Tag color="orange">Giảng viên Hướng dẫn</Tag></div>
                            </div>
                        </Flex>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card size="small">
                        <Flex align="center" gap={12}>
                            <CalendarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                            <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>NGÀY BẢO VỆ</Text>
                                <div><Text strong>15/06/2024</Text></div>
                            </div>
                        </Flex>
                    </Card>
                </Col>
            </Row>

            {/* Grading Cards */}
            <Spin spinning={loading}>
                {groups.length === 0 && !loading ? (
                    <Empty description="Không có nhóm nào cần chấm điểm" style={{ marginTop: 40 }} />
                ) : (
                    groups.map((group) => (
                        <GradingCard key={group.id} group={group} onRefresh={fetchGradingGroups} />
                    ))
                )}
            </Spin>
        </div>
    );
}

export default GradingPage;