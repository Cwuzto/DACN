import { useState } from 'react';
import { Modal, Form, Input, Alert, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import registrationService from '../../services/registrationService';

const { TextArea } = Input;

export default function TitleAdjustmentModal({
    open,
    onClose,
    onSuccess,
    registrationId,
    currentTitle,
    decisionDate,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (values) => {
        try {
            setSubmitting(true);
            const res = await registrationService.requestTitleAdjustment({
                registrationId,
                newTitle: values.newTitle.trim(),
                reason: values.reason.trim(),
            });

            if (res.success) {
                message.success('Đã gửi đơn xin điều chỉnh tên đề tài thành công. Vui lòng chờ GVHD duyệt.');
                form.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể gửi đơn điều chỉnh.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi gửi đơn.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <EditOutlined className="text-blue-600" />
                    <span>Xin Điều Chỉnh Tên Đề Tài Tốt Nghiệp</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            okText="Gửi đơn xét duyệt"
            cancelText="Hủy bỏ"
            destroyOnClose
            width={600}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    type="info"
                    showIcon
                    message="Quy định điều chỉnh tên đề tài (Cửa sổ 7 ngày)"
                    description="Theo quy chế học vụ, sinh viên chỉ được phép gửi đơn xin điều chỉnh tên đề tài trong vòng 7 ngày kể từ ngày ban hành Quyết định giao đề tài của Viện. Đơn sẽ được chuyển tới GVHD phê duyệt trực tiếp."
                />

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs uppercase font-semibold text-slate-500">Tên đề tài hiện tại (Theo Quyết định):</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{currentTitle || 'Chưa xác định'}</div>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    requiredMark="optional"
                >
                    <Form.Item
                        name="newTitle"
                        label={<span className="font-semibold text-slate-700">Tên đề tài mới xin điều chỉnh</span>}
                        rules={[
                            { required: true, message: 'Vui lòng nhập tên đề tài mới.' },
                            { min: 10, message: 'Tên đề tài phải có ít nhất 10 ký tự.' },
                        ]}
                    >
                        <Input
                            placeholder="Nhập tên đề tài mới chính xác và đầy đủ..."
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        name="reason"
                        label={<span className="font-semibold text-slate-700">Lý do điều chỉnh tên đề tài</span>}
                        rules={[
                            { required: true, message: 'Vui lòng nêu rõ lý do xin điều chỉnh.' },
                            { min: 15, message: 'Lý do giải trình cần chi tiết hơn (ít nhất 15 ký tự).' },
                        ]}
                    >
                        <TextArea
                            rows={4}
                            placeholder="Giải trình cụ thể lý do thay đổi (ví dụ: thu hẹp phạm vi nghiên cứu, cập nhật công nghệ mới theo chỉ đạo của GVHD)..."
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
}
