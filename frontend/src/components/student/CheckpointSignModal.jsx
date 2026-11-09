import { useState, useEffect } from 'react';
import { Modal, Form, Input, Alert, message, Divider, Tag } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';

const { TextArea } = Input;

export default function CheckpointSignModal({
    open,
    onClose,
    onSuccess,
    checkpointEvaluation,
    currentStudentName,
}) {
    const [form] = Form.useForm();
    const [appealForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [isAppealMode, setIsAppealMode] = useState(false);

    const deadline = checkpointEvaluation?.studentSignDeadlineAt ? dayjs(checkpointEvaluation.studentSignDeadlineAt) : null;
    const isExpired = deadline ? dayjs().isAfter(deadline) : false;

    useEffect(() => {
        if (open) {
            form.resetFields();
            appealForm.resetFields();
            form.setFieldsValue({
                studentSignature: currentStudentName || '',
            });
            setIsAppealMode(isExpired);
        }
    }, [open, currentStudentName, isExpired, form, appealForm]);

    const handleSign = async (values) => {
        try {
            setSubmitting(true);
            const res = await evaluationService.signCheckpoint({
                checkpointEvaluationId: checkpointEvaluation?.id,
                studentSignature: values.studentSignature.trim(),
            });

            if (res.success) {
                message.success('Đã ký xác nhận biên bản đánh giá tiến độ thành công!');
                form.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể ký biên bản.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi ký biên bản.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAppeal = async (values) => {
        try {
            setSubmitting(true);
            const res = await evaluationService.submitCheckpointAppeal({
                checkpointEvaluationId: checkpointEvaluation?.id,
                reason: values.reason.trim(),
                evidenceUrl: values.evidenceUrl?.trim() || null,
            });

            if (res.success) {
                message.success('Đã nộp đơn khiếu nại chữ ký biên bản thành công!');
                appealForm.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể nộp đơn khiếu nại.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi nộp đơn khiếu nại.');
        } finally {
            setSubmitting(false);
        }
    };

    const isPassed = checkpointEvaluation?.conclusion === 'ALLOWED_TO_CONTINUE';

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SafetyCertificateOutlined className="text-[#0F766E] text-lg" />
                    <span>Biên bản Đánh giá Tiến độ Đợt {checkpointEvaluation?.checkpointNo}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={640}
        >
            <div className="space-y-4 pt-2">
                {isExpired ? (
                    <Alert
                        type="error"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message="Hạn ký xác nhận đã kết thúc"
                        description="Thời hạn 3 ngày để ký xác nhận biên bản đã trôi qua. Theo quy chế, bạn có 3 ngày để nộp đơn giải trình / khiếu nại lý do chưa ký. Ban chủ nhiệm Khoa/Viện sẽ xem xét xử lý."
                    />
                ) : (
                    <Alert
                        type="info"
                        showIcon
                        icon={<ClockCircleOutlined />}
                        message="Ký xác nhận biên bản trong vòng 3 ngày"
                        description={`Vui lòng kiểm tra kỹ kết luận và nhận xét của GVHD trước khi ký. Hạn chót ký: ${deadline ? deadline.format('DD/MM/YYYY HH:mm') : '3 ngày'}.`}
                    />
                )}

                {/* Thông tin biên bản do GVHD phát hành */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Đợt đánh giá:</span>
                        <b className="text-slate-800">Đợt {checkpointEvaluation?.checkpointNo} (Tuần {checkpointEvaluation?.checkpointNo === 1 ? '6' : '11'})</b>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Kết luận của GVHD:</span>
                        {isPassed ? (
                            <Tag color="success" className="font-semibold m-0">✓ Đạt — Cho phép tiếp tục thực hiện</Tag>
                        ) : (
                            <Tag color="error" className="font-semibold m-0">✕ Chưa đạt — Tạm dừng đề tài</Tag>
                        )}
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Nhận xét của GVHD:</span>
                        <div className="mt-1 p-2 bg-white rounded border border-slate-200 text-slate-700 italic">
                            "{checkpointEvaluation?.comments || 'Không có ghi chú thêm.'}"
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">GVHD ký phát hành:</span>
                        <b className="text-[#0F766E]">{checkpointEvaluation?.mentorSignature} ({checkpointEvaluation?.mentorSignedAt ? dayjs(checkpointEvaluation.mentorSignedAt).format('DD/MM/YYYY HH:mm') : ''})</b>
                    </div>
                </div>

                {!isExpired ? (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSign}
                        requiredMark="optional"
                    >
                        <Form.Item
                            label={<span className="font-semibold text-slate-700">Chữ Ký Xác Nhận Của Sinh Viên</span>}
                            name="studentSignature"
                            rules={[{ required: true, message: 'Vui lòng ký tên xác nhận' }]}
                        >
                            <Input
                                placeholder="Nhập họ và tên đầy đủ của bạn để ký biên bản"
                                className="text-xs font-medium"
                            />
                        </Form.Item>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-md transition shadow-sm"
                            >
                                {submitting ? 'Đang xác nhận...' : 'Ký xác nhận biên bản'}
                            </button>
                        </div>
                    </Form>
                ) : (
                    <Form
                        form={appealForm}
                        layout="vertical"
                        onFinish={handleAppeal}
                        requiredMark="optional"
                    >
                        <Divider orientation="left" className="!my-2 text-xs text-rose-500 font-semibold">
                            ĐƠN KHIẾU NẠI / GIẢI TRÌNH CHỮ KÝ
                        </Divider>

                        <Form.Item
                            label={<span className="font-semibold text-slate-700">Lý Do Chưa Ký Biên Bản Đúng Hạn</span>}
                            name="reason"
                            rules={[{ required: true, message: 'Vui lòng nêu rõ lý do giải trình' }]}
                        >
                            <TextArea
                                rows={3}
                                placeholder="Nêu rõ lý do khách quan (ốm đau, sự cố kỹ thuật...) kèm giải trình chi tiết..."
                                className="text-xs"
                            />
                        </Form.Item>

                        <Form.Item
                            label={<span className="font-semibold text-slate-700">Liên Kết Minh Chứng Đính Kèm (Nếu có)</span>}
                            name="evidenceUrl"
                        >
                            <Input
                                placeholder="https://drive.google.com/... (giấy khám bệnh, minh chứng sự cố...)"
                                className="text-xs"
                            />
                        </Form.Item>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition shadow-sm"
                            >
                                {submitting ? 'Đang gửi...' : 'Gửi đơn khiếu nại'}
                            </button>
                        </div>
                    </Form>
                )}
            </div>
        </Modal>
    );
}
