import { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Alert, message, Divider } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { TextArea } = Input;

export default function CheckpointIssueModal({
    open,
    onClose,
    onSuccess,
    registration,
    currentLecturerName,
    defaultCheckpointNo = 1,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({
                checkpointNo: defaultCheckpointNo,
                conclusion: 'ALLOWED_TO_CONTINUE',
                mentorSignature: currentLecturerName || '',
            });
        }
    }, [open, currentLecturerName, defaultCheckpointNo, form]);

    const handleSubmit = async (values) => {
        try {
            setSubmitting(true);
            const res = await evaluationService.issueCheckpoint({
                registrationId: registration?.id,
                checkpointNo: Number(values.checkpointNo),
                conclusion: values.conclusion,
                comments: values.comments?.trim(),
                evidenceUrl: values.evidenceUrl?.trim() || null,
                evidenceName: values.evidenceName?.trim() || null,
                mentorSignature: values.mentorSignature.trim(),
            });

            if (res.success) {
                message.success(`Đã phát hành biên bản đánh giá tiến độ đợt ${values.checkpointNo} thành công!`);
                form.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể phát hành biên bản đánh giá tiến độ.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi phát hành biên bản đánh giá tiến độ.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SafetyCertificateOutlined className="text-[#0F766E] text-lg" />
                    <span>Phát Hành Biên Bản Đánh Giá Tiến Độ</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={680}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    type="info"
                    showIcon
                    message="Quy trình ký xác nhận song phương đánh giá tiến độ"
                    description="Sau khi GVHD ký phát hành, sinh viên sẽ nhận được thông báo và có 3 ngày để xem và ký xác nhận biên bản. Nếu sinh viên không đạt, đề tài sẽ dừng thực hiện theo quy chế đào tạo."
                />

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                        <span className="text-slate-500 font-medium">Sinh viên thực hiện:</span>{' '}
                        <b className="text-slate-900">{registration?.student?.fullName} ({registration?.student?.code})</b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Trạng thái hiện tại:</span>{' '}
                        <b className="text-[#0F766E] font-mono">{registration?.status}</b>
                    </div>
                    <div className="md:col-span-2">
                        <span className="text-slate-500 font-medium">Tên đề tài:</span>{' '}
                        <b className="text-slate-900">{registration?.topic?.title}</b>
                    </div>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    requiredMark="optional"
                >
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Đợt đánh giá tiến độ</span>}
                        name="checkpointNo"
                        rules={[{ required: true, message: 'Vui lòng chọn đợt đánh giá tiến độ' }]}
                    >
                        <Radio.Group className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Radio.Button
                                    value={1}
                                    className="!h-auto !py-2.5 !px-3 !rounded-lg border border-slate-200 text-left hover:border-[#0F766E]"
                                >
                                    <div className="font-semibold text-slate-800">Đợt 1 (Tuần 6)</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Yêu cầu hoàn thành tối thiểu 50% khối lượng đề tài</div>
                                </Radio.Button>
                                <Radio.Button
                                    value={2}
                                    className="!h-auto !py-2.5 !px-3 !rounded-lg border border-slate-200 text-left hover:border-[#0F766E]"
                                >
                                    <div className="font-semibold text-slate-800">Đợt 2 (Tuần 11)</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Yêu cầu hoàn thành tối thiểu 85% khối lượng đề tài</div>
                                </Radio.Button>
                            </div>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Kết Luận Thẩm Tra Tiến Độ</span>}
                        name="conclusion"
                        rules={[{ required: true, message: 'Vui lòng chọn kết luận' }]}
                    >
                        <Radio.Group className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Radio.Button
                                    value="ALLOWED_TO_CONTINUE"
                                    className="!h-auto !py-2.5 !px-3 !rounded-lg border border-emerald-200 bg-emerald-50/30 text-left hover:border-emerald-500"
                                >
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                                        <CheckCircleOutlined className="text-emerald-600" />
                                        <span>ĐẠT YÊU CẦU</span>
                                    </div>
                                    <div className="text-xs text-emerald-700 mt-0.5">Cho phép sinh viên tiếp tục thực hiện đề tài</div>
                                </Radio.Button>
                                <Radio.Button
                                    value="NOT_ALLOWED_TO_CONTINUE"
                                    className="!h-auto !py-2.5 !px-3 !rounded-lg border border-rose-200 bg-rose-50/30 text-left hover:border-rose-500"
                                >
                                    <div className="flex items-center gap-1.5 font-bold text-rose-800">
                                        <CloseCircleOutlined className="text-rose-600" />
                                        <span>KHÔNG ĐẠT — DỪNG ĐỀ TÀI</span>
                                    </div>
                                    <div className="text-xs text-rose-700 mt-0.5">Tiến độ không đạt, đề xuất dừng học phần</div>
                                </Radio.Button>
                            </div>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Nhận Xét Cụ Thể Của GVHD</span>}
                        name="comments"
                        rules={[{ required: true, message: 'Vui lòng nhập nhận xét đánh giá khối lượng công việc' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Nhập nhận xét chi tiết về khối lượng hoàn thành, sản phẩm đạt được và thái độ làm việc..."
                            className="text-xs"
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Liên kết minh chứng hoặc báo cáo (Tùy chọn)</span>}
                        name="evidenceUrl"
                    >
                        <Input
                            placeholder="https://drive.google.com/... hoặc liên kết kho lưu trữ"
                            className="text-xs"
                        />
                    </Form.Item>

                    <Divider className="!my-3" />

                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Chữ Ký Xác Nhận Của GVHD</span>}
                        name="mentorSignature"
                        rules={[{ required: true, message: 'Vui lòng ký tên xác nhận' }]}
                    >
                        <Input
                            placeholder="Nhập họ và tên đầy đủ của GVHD để ký xác nhận"
                            className="text-xs font-medium"
                        />
                    </Form.Item>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-md transition shadow-sm"
                        >
                            {submitting ? 'Đang phát hành...' : 'Ký & Phát hành biên bản'}
                        </button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
