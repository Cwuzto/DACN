import { useState, useEffect } from 'react';
import {
    Card, Button, Typography, Flex, Tag, Upload, Timeline, Space, Divider, Empty, Progress, theme, message,
} from 'antd';
import {
    CloudUploadOutlined, FilePdfOutlined, FileTextOutlined, CheckCircleOutlined,
    ClockCircleOutlined, InboxOutlined, DownloadOutlined, FileZipOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import uploadService from '../../services/uploadService';
import taskService from '../../services/taskService';
import groupService from '../../services/groupService';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const statusConfig = {
    OPEN: { label: 'Chưa nộp', color: 'warning', icon: <ClockCircleOutlined /> },
    IN_PROGRESS: { label: 'Đang làm', color: 'processing', icon: <ClockCircleOutlined /> },
    SUBMITTED: { label: 'Đã nộp', color: 'processing', icon: <CheckCircleOutlined /> },
    COMPLETED: { label: 'Đã chấm', color: 'success', icon: <CheckCircleOutlined /> },
    OVERDUE: { label: 'Trễ hạn', color: 'error', icon: <ClockCircleOutlined /> },
};

function SubmissionPage() {
    const [subList, setSubList] = useState([]);
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploadingObj, setUploadingObj] = useState({});

    // Dynamic Progress Calculations
    const totalTasks = subList.length;
    const submittedTasks = subList.filter(t => ['SUBMITTED', 'COMPLETED'].includes(t.status)).length;
    const completedTasks = subList.filter(t => t.status === 'COMPLETED').length;
    const openTasks = subList.filter(t => t.status === 'OPEN').length;
    const progressPercent = totalTasks > 0 ? Math.round((submittedTasks / totalTasks) * 100) : 0;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const groupRes = await groupService.getMyGroup();
            if (groupRes.success && groupRes.data) {
                setGroup(groupRes.data);
                const taskRes = await taskService.getTasksByGroup(groupRes.data.id);
                if (taskRes.success) {
                    setSubList(taskRes.data);
                }
            }
        } catch (error) {
            console.error('Error fetching submission data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (options, subKey) => {
        const { file, onSuccess, onError, onProgress } = options;
        setUploadingObj(prev => ({ ...prev, [subKey]: true }));
        try {
            // Simulated progress
            onProgress({ percent: 50 });
            const res = await uploadService.uploadFile(file, 'submissions');

            // Save the uploaded url to local state temporarily so UI updates instantly
            setSubList(prev => prev.map(task => {
                if (task.id === subKey) {
                    return {
                        ...task,
                        _tempFile: {
                            name: file.name,
                            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                            date: new Date().toLocaleDateString('vi-VN'),
                            url: res.data.url
                        }
                    };
                }
                return task;
            }));

            onSuccess("ok");
            message.success(`${file.name} tải lên thành công.`);
        } catch (err) {
            console.error(err);
            onError(err);
            message.error(`${file.name} tải lên thất bại.`);
        } finally {
            setUploadingObj(prev => ({ ...prev, [subKey]: false }));
        }
    };

    const handleSubmit = async (taskId) => {
        const task = subList.find(t => t.id === taskId);
        if (!task || !task._tempFile) return;

        try {
            await taskService.submitTask(taskId, {
                content: 'Báo cáo tiến độ',
                fileUrl: task._tempFile.url,
                fileName: task._tempFile.name
            });
            message.success('Nộp bài thành công!');
            fetchData(); // reload
        } catch (error) {
            message.error('Lỗi khi nộp bài');
        }
    };

    if (loading) return <div style={{ textAlign: 'center', marginTop: 100 }}>Đang tải...</div>;
    if (!group) return <Empty description="Bạn chưa có nhóm" style={{ marginTop: 100 }} />;

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Nộp Báo cáo / Tiến độ</Title>
                    <Text type="secondary">Nhóm: {group.groupName} • Đề tài: {group.topic?.title || 'Chưa đăng ký'}</Text>
                </div>
            </Flex>

            {/* Progress Overview */}
            <Card size="small" style={{ borderRadius: 10, marginBottom: 24 }}>
                <Flex align="center" gap={24} wrap="wrap">
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tiến độ nộp</Text>
                        <Progress percent={progressPercent} strokeColor="#13C2C2" />
                    </div>
                    <Flex gap={24}>
                        <div style={{ textAlign: 'center' }}>
                            <Text strong style={{ fontSize: 24, color: '#52c41a' }}>{submittedTasks}</Text>
                            <br /><Text type="secondary" style={{ fontSize: 12 }}>Đã nộp</Text>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <Text strong style={{ fontSize: 24, color: '#fa8c16' }}>{openTasks}</Text>
                            <br /><Text type="secondary" style={{ fontSize: 12 }}>Chờ nộp</Text>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <Text strong style={{ fontSize: 24, color: '#1677FF' }}>{completedTasks}</Text>
                            <br /><Text type="secondary" style={{ fontSize: 12 }}>Đã chấm</Text>
                        </div>
                    </Flex>
                </Flex>
            </Card>

            {/* Submission Cards */}
            <Flex vertical gap={16}>
                {subList.length === 0 ? (
                    <Empty description="Giảng viên chưa tạo task báo cáo nào" />
                ) : subList.map((task) => {
                    const cfg = statusConfig[task.status] || { color: 'default', icon: <InfoCircleOutlined />, label: task.status };
                    const isUploading = uploadingObj[task.id];
                    const submissions = task.submissions || [];
                    const lastSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

                    return (
                        <Card key={task.id} style={{ borderRadius: 10 }}>
                            <Flex justify="space-between" align="flex-start" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
                                <div>
                                    <Flex gap={8} align="center" style={{ marginBottom: 4 }}>
                                        <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
                                    </Flex>
                                    <Title level={5} style={{ margin: 0 }}>{task.title}</Title>
                                    <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>{task.content}</Text>
                                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>Hạn nộp: {task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'Không có hạn'}</Text>
                                </div>
                            </Flex>

                            {/* Upload area for pending */}
                            {task.status === 'OPEN' && !task._tempFile && !lastSubmission && (
                                <Dragger
                                    style={{ marginTop: 12 }}
                                    customRequest={(options) => handleUpload(options, task.id)}
                                    showUploadList={false}
                                    multiple={false}
                                >
                                    <p className="ant-upload-drag-icon">
                                        <InboxOutlined style={{ color: '#13C2C2' }} />
                                    </p>
                                    <p className="ant-upload-text">Kéo thả file hoặc click để tải lên</p>
                                    <p className="ant-upload-hint">Hỗ trợ PDF, DOCX, ZIP (tối đa 20MB)</p>
                                    {isUploading && <Progress percent={typeof isUploading === 'number' ? isUploading : 50} status="active" style={{ marginTop: 10, padding: '0 20px' }} />}
                                </Dragger>
                            )}

                            {/* Show Temp File (Chưa nhấn nút nộp) */}
                            {task.status === 'OPEN' && task._tempFile && !lastSubmission && (
                                <div style={{ marginTop: 12 }}>
                                    <Card size="small" style={{ background: '#fafafa', borderRadius: 8, borderColor: '#13C2C2' }} styles={{ body: { padding: '8px 12px' } }}>
                                        <Flex justify="space-between" align="center">
                                            <Flex align="center" gap={10}>
                                                <FileZipOutlined style={{ color: '#13C2C2', fontSize: 18 }} />
                                                <div>
                                                    <Text strong style={{ fontSize: 13 }}>{task._tempFile.name}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 11 }}>Sẵn sàng nộp</Text>
                                                </div>
                                            </Flex>
                                        </Flex>
                                    </Card>

                                    {/* Submit button */}
                                    <Flex justify="flex-end" style={{ marginTop: 12 }}>
                                        <Button
                                            type="primary"
                                            icon={<CloudUploadOutlined />}
                                            style={{ background: '#13C2C2', borderColor: '#13C2C2' }}
                                            onClick={() => handleSubmit(task.id)}
                                            loading={isUploading}
                                        >
                                            Chốt Nộp Báo Cáo
                                        </Button>
                                    </Flex>
                                </div>
                            )}

                            {/* Submitted files (Từ backend trả về) */}
                            {lastSubmission && (
                                <div style={{ marginTop: 12 }}>
                                    <Card size="small" style={{ background: '#fafafa', borderRadius: 8 }} styles={{ body: { padding: '8px 12px' } }}>
                                        <Flex justify="space-between" align="center">
                                            <Flex align="center" gap={10}>
                                                <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                                                <div>
                                                    <Text strong style={{ fontSize: 13 }}>{lastSubmission.fileName || 'Tài liệu đã nộp'}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 11 }}>Nộp lúc: {new Date(lastSubmission.submittedAt).toLocaleString('vi-VN')}</Text>
                                                </div>
                                            </Flex>
                                            <Button type="text" href={lastSubmission.fileUrl} target="_blank" rel="noopener noreferrer" size="small" icon={<DownloadOutlined />} />
                                        </Flex>
                                    </Card>
                                </div>
                            )}

                            {/* Feedback */}
                            {lastSubmission && lastSubmission.feedback && (
                                <Card
                                    size="small"
                                    style={{ marginTop: 12, background: '#f0f5ff', borderColor: '#adc6ff', borderRadius: 8 }}
                                    styles={{ body: { padding: '8px 12px' } }}
                                >
                                    <Text type="secondary" style={{ fontSize: 11 }}>Nhận xét GVHD ({new Date(lastSubmission.feedbackAt).toLocaleDateString('vi-VN')}):</Text>
                                    <br />
                                    <Text style={{ fontSize: 13 }}>{lastSubmission.feedback}</Text>
                                </Card>
                            )}

                        </Card>
                    );
                })}
            </Flex>
        </div>
    );
}

export default SubmissionPage;