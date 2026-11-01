import { useState } from 'react';
import { Modal, Form, Input, Alert, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
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
    const adjustmentDeadline = decisionDate ? dayjs(decisionDate).add(7, 'day') : null;
    const isExpired = adjustmentDeadline ? dayjs().isAfter(adjustmentDeadline) : false;
    const remainingDays = adjustmentDeadline
        ? Math.max(0, Math.ceil(adjustmentDeadline.diff(dayjs(), 'day', true)))
        : null;

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
                    <EditOutlined className="text-teal-700" />
                    <span>Xin Điều Chỉnh Tên Đề Tài Tốt Nghiệp</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            okButtonProps={{ disabled: isExpired || !registrationId }}
            okText="Gửi đơn xét duyệt"
            cancelText="Hủy bỏ"
            destroyOnClose
            width={600}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    showIcon
                    type={isExpired ? 'error' : 'info'}
                    message={isExpired ? 'Đã hết hạn điều chỉnh tên đề tài' : `Cửa sổ điều chỉnh tên: còn ${remainingDays ?? 7} ngày`}
                    description={adjustmentDeadline
                        ? `Hạn chót: ${adjustmentDeadline.format('DD/MM/YYYY HH:mm')}. Đơn sẽ được chuyển tới GVHD phê duyệt trực tiếp.`
                        : 'Chưa xác định được ngày ban hành Quyết định. Vui lòng tải lại dữ liệu trước khi gửi đơn.'}
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
