import React, { useState } from 'react';
import {
    Modal,
    Form,
    Input,
    Radio,
    Descriptions,
    Tag,
    Alert,
    Button,
    message,
    Space,
    Divider,
} from 'antd';
import {
    EditOutlined,
    ExclamationCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

export default function CorrectDefenseResultModal({
    open,
    registration,
    onClose,
    onSuccess,
}) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    if (!registration) return null;

    const id = registration.registrationId || registration.id;
    const currentStatus = registration.status;
    const isPassed = currentStatus === 'DEFENSE_PASSED';

    const handleFinish = async (values) => {
        try {
            setLoading(true);
            const payload = {
                outcome: values.outcome,
                reason: values.reason?.trim(),
                notes: values.notes?.trim() || undefined,
            };

            const res = await evaluationService.correctDefenseResult(id, payload);
            if (res.success) {
                message.success(res.message || 'Đã điều chỉnh kết quả bảo vệ thành công!');
                form.resetFields();
                onSuccess?.();
                onClose();
            }
        } catch (err) {
            message.error(err?.message || 'Không thể điều chỉnh kết quả bảo vệ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={680}
            destroyOnClose
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius)',
                            background: '#FFFBEB',
                            color: '#D97706',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 18,
                        }}
                    >
                        <EditOutlined />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                            Điều Chỉnh Kết Quả Phê Duyệt Bảo Vệ
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
                            Hồ sơ: <strong style={{ color: 'var(--fg)' }}>#{id}</strong> · Thẩm quyền: <Tag color="geekblue">DEFENSE_RESULT_APPROVE</Tag>
                        </div>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Mã Sinh viên">
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {registration.student?.code || '—'}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Họ tên Sinh viên">
                        <strong>{registration.student?.fullName || '—'}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tên Đề tài" span={2}>
                        {registration.topic?.title || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Điểm bảo vệ trung bình">
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--institutional)', fontSize: 14 }}>
                            {registration.finalScore !== null && registration.finalScore !== undefined ? Number(registration.finalScore).toFixed(2) : '—'}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Kết quả hiện tại">
                        {isPassed ? (
                            <Tag color="cyan" icon={<CheckCircleOutlined />}>
                                ĐẠT BẢO VỆ
                            </Tag>
                        ) : (
                            <Tag color="error" icon={<CloseCircleOutlined />}>
                                KHÔNG ĐẠT
                            </Tag>
                        )}
                    </Descriptions.Item>
                </Descriptions>

                <Alert
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message="Cơ chế lưu vết kiểm toán"
                    description="Thao tác điều chỉnh sẽ thay thế quyết định phê duyệt hiện hành và tạo quyết định mới có liên kết truy vết. Sau khi điều chỉnh, sinh viên sẽ thấy kết quả mới sau khi Viện ban hành đợt Công Bố Đính Chính."
                />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    initialValues={{
                        outcome: isPassed ? 'FAILED' : 'PASSED',
                    }}
                >
                    <Form.Item
                        name="outcome"
                        label="Kết luận phê duyệt mới"
                        rules={[{ required: true, message: 'Vui lòng chọn kết luận mới' }]}
                    >
                        <Radio.Group>
                            <Space orientation="horizontal" size={24}>
                                <Radio value="PASSED">
                                    <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>
                                        <CheckCircleOutlined style={{ marginRight: 4 }} />
                                        ĐẠT BẢO VỆ
                                    </Tag>
                                </Radio>
                                <Radio value="FAILED">
                                    <Tag color="error" style={{ fontSize: 13, padding: '4px 10px' }}>
                                        <CloseCircleOutlined style={{ marginRight: 4 }} />
                                        KHÔNG ĐẠT
                                    </Tag>
                                </Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="reason"
                        label="Căn cứ / Lý do điều chỉnh kết quả (Bắt buộc)"
                        rules={[
                            { required: true, message: 'Vui lòng nhập lý do/căn cứ pháp lý điều chỉnh' },
                            { max: 4000, message: 'Lý do không được vượt quá 4000 ký tự' },
                        ]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Ví dụ: Căn cứ Kết luận Hội đồng Phúc khảo số 15/KL-HĐ ngày... thống nhất công nhận kết quả đạt."
                        />
                    </Form.Item>

                    <Form.Item
                        name="notes"
                        label="Ghi chú thêm của Viện trưởng (Tùy chọn)"
                        rules={[{ max: 8000, message: 'Ghi chú không được vượt quá 8000 ký tự' }]}
                    >
                        <Input.TextArea
                            rows={2}
                            placeholder="Ghi chú lưu trữ nội bộ..."
                        />
                    </Form.Item>

                    <Divider style={{ margin: '16px 0 12px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Button onClick={onClose} disabled={loading}>
                            Hủy bỏ
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            style={{
                                background: '#D97706',
                                borderColor: '#D97706',
                                fontWeight: 600,
                            }}
                            icon={<SafetyCertificateOutlined />}
                        >
                            Xác Nhận Ký Điều Chỉnh
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
