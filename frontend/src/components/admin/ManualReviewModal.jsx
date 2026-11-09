import React, { useState } from 'react';
import { Modal, Form, Input, Select, Tag, Alert, Button, message, Space, Descriptions, Divider } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import manualReviewService from '../../services/manualReviewService';

const REASON_LABELS = {
    LEGACY_BYPASS_EVIDENCE: 'Hồ sơ có dấu hiệu bypass nhiệm vụ học vụ cũ',
    STATUS_REQUIRES_EVIDENCE_REVIEW: 'Trạng thái học vụ cần thẩm định minh chứng',
    MISSING_DECISION_EVIDENCE: 'Thiếu minh chứng Quyết định giao đề tài của Viện',
    INVALID_DEFENSE_SCORE_EVIDENCE: 'Chưa đủ 3 phiếu chấm độc lập của Hội đồng',
    ARCHIVE_EVIDENCE_CONFLICT: 'Mâu thuẫn trạng thái lưu chiểu số sau bảo vệ',
};

const ManualReviewModal = ({ open, caseItem, onClose, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    if (!caseItem) return null;

    const registration = caseItem.registration || {};
    const student = registration.student || {};
    const topic = registration.topic || {};
    const mentor = topic.mentor || {};
    const semester = registration.semester || {};
    const reasons = Array.isArray(caseItem.reasonCodes) ? caseItem.reasonCodes : [];

    const handleResolve = async (values) => {
        try {
            setLoading(true);
            await manualReviewService.resolveCase(caseItem.id, {
                resolution: values.resolution,
                targetStatus: values.targetStatus || undefined,
            });
            message.success('Đã giải quyết ca thẩm định và gán phiên bản chính sách thành công!');
            form.resetFields();
            onSuccess?.();
            onClose();
        } catch (error) {
            message.error(error.message || 'Không thể giải quyết hồ sơ thẩm định.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <SafetyCertificateOutlined style={{ color: '#0F766E' }} />
                    <span>Thẩm Định & Chuẩn Hóa Hồ Sơ Học Vụ (Mã hồ sơ: #{caseItem.id})</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={720}
            destroyOnClose
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Alert
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message="Hồ sơ được đưa vào hàng đợi kiểm toán tự động"
                    description="Dữ liệu chuyển đổi từ hệ thống cũ cần Quản trị viên xác nhận tính hợp lệ trước khi cấp phiên bản chính sách học vụ chuẩn."
                />

                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Mã SV">{student.code || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Họ tên SV">{student.fullName || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Tên đề tài" span={2}>{topic.title || '—'}</Descriptions.Item>
                    <Descriptions.Item label="GVHD">{mentor.fullName || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Học kỳ">{semester.name || semester.code || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái hiện tại">
                        <Tag color="cyan">{registration.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số Quyết định">{registration.decisionNumber || 'Chưa có'}</Descriptions.Item>
                </Descriptions>

                <div>
                    <span style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: 6 }}>
                        Các cảnh báo toàn vẹn phát hiện được:
                    </span>
                    <Space wrap orientation="horizontal">
                        {reasons.map((code) => (
                            <Tag color="volcano" key={code}>
                                {REASON_LABELS[code] || code}
                            </Tag>
                        ))}
                    </Space>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <Form form={form} layout="vertical" onFinish={handleResolve}>
                    <Form.Item
                        name="resolution"
                        label="Nội dung thẩm định & Kết luận xử lý"
                        rules={[{ required: true, message: 'Vui lòng nhập kết luận thẩm định' }]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Ví dụ: Đã đối chiếu biên bản bảo vệ giấy tại Viện, hồ sơ đủ điều kiện công nhận điểm và gán policy chuẩn..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="targetStatus"
                        label="Điều chỉnh trạng thái học vụ (Tùy chọn nếu cần cập nhật lại)"
                    >
                        <Select
                            allowClear
                            placeholder="Giữ nguyên trạng thái hiện hành nếu hợp lệ"
                            options={[
                                { label: 'Đang theo dõi tiến độ', value: 'IN_PROGRESS_BM03' },
                                { label: 'Đã đạt đánh giá tiến độ', value: 'BM03_PASSED' },
                                { label: 'Đủ điều kiện bảo vệ', value: 'DEFENSE_READY' },
                                { label: 'Đã bảo vệ xong', value: 'DEFENDED' },
                                { label: 'Đã hoàn thành tốt nghiệp', value: 'COMPLETED' },
                                { label: 'Dừng thực hiện đề tài', value: 'REJECTED' },
                            ]}
                        />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                        <Button onClick={onClose}>Hủy bỏ</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<CheckCircleOutlined />}
                            style={{ background: '#0F766E', borderColor: '#0F766E' }}
                        >
                            Xác Nhận Giải Quyết & Áp Dụng Chính Sách
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
};

export default ManualReviewModal;
