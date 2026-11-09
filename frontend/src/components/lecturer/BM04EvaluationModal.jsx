import { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Alert, Popconfirm, message, Divider } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { TextArea } = Input;

export default function BM04EvaluationModal({
    open,
    onClose,
    onSuccess,
    registration,
    currentLecturerName,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({
                lecturerSignature: currentLecturerName || '',
                conclusion: 'AGREED_FOR_DEFENSE',
            });
        }
    }, [open, currentLecturerName, form]);

    const handleSubmit = async (values) => {
        try {
            setSubmitting(true);
            const res = await evaluationService.submitBM04Evaluation({
                registrationId: registration?.id,
                thesisFormatScore: values.thesisFormatScore.trim(),
                researchContentScore: values.researchContentScore.trim(),
                applicabilityScore: values.applicabilityScore.trim(),
                attitudeScore: values.attitudeScore.trim(),
                conclusion: values.conclusion,
                generalNotes: values.generalNotes ? values.generalNotes.trim() : null,
                lecturerSignature: values.lecturerSignature.trim(),
            });

            if (res.success) {
                message.success('Đã lập và ký khóa phiếu nhận xét thành công!');
                form.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể nộp phiếu nhận xét.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi nộp phiếu nhận xét.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
                    <span>Lập Phiếu Nhận Xét & Đánh Giá Của Người Hướng Dẫn</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={720}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    type="warning"
                    showIcon
                    message="Tính bất biến & Trách nhiệm pháp lý của GVHD"
                    description="Phiếu nhận xét chỉ cần duy nhất chữ ký xác nhận của GVHD. Sau khi ký nộp, phiếu sẽ được KHÓA VĨNH VIỄN, không thể chỉnh sửa. Nếu kết luận ĐỒNG Ý, sinh viên sẽ tự động được chuyển sang trạng thái Sẵn sàng xếp Hội đồng bảo vệ."
                />

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                        <span className="text-slate-500 font-medium">Sinh viên thực hiện:</span>{' '}
                        <b className="text-slate-900">{registration?.student?.fullName} ({registration?.student?.code})</b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Học kỳ / Đợt đồ án:</span>{' '}
                        <b className="text-slate-900">{registration?.semester?.name || 'Đợt hiện tại'}</b>
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
                    <Divider orientation="left" className="text-xs text-slate-600 font-bold uppercase tracking-wider !my-2">
                        4 Tiêu Chí Đánh Giá Bắt Buộc
                    </Divider>

                    <Form.Item
                        name="thesisFormatScore"
                        label={<span className="font-semibold text-slate-700">1. Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về hình thức BCTN.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Nhận xét bố cục, chính tả, cách trình bày bảng biểu, tài liệu tham khảo..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="researchContentScore"
                        label={<span className="font-semibold text-slate-700">2. Nội dung nghiên cứu của đề tài</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về nội dung nghiên cứu.' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Đánh giá mức độ hoàn thành mục tiêu đề ra, phương pháp nghiên cứu, giải thuật, công nghệ áp dụng..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="applicabilityScore"
                        label={<span className="font-semibold text-slate-700">3. Tính ứng dụng và triển vọng phát triển</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về tính ứng dụng của đề tài.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Đánh giá khả năng áp dụng thực tế của sản phẩm hoặc đóng góp học thuật, hướng mở rộng..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="attitudeScore"
                        label={<span className="font-semibold text-slate-700">4. Đánh giá thái độ và ý thức làm việc của sinh viên</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về thái độ làm việc của sinh viên.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Nhận xét tính chủ động, chuyên cần trong các buổi họp định kỳ, sự tiếp thu góp ý của GVHD..."
                        />
                    </Form.Item>

                    <Divider orientation="left" className="text-xs text-slate-600 font-bold uppercase tracking-wider !my-2">
                        Kết Luận Thẩm Định Trước Bảo Vệ
                    </Divider>

                    <Form.Item
                        name="conclusion"
                        label={<span className="font-semibold text-slate-700">Ý kiến kết luận của GVHD</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn kết luận.' }]}
                    >
                        <Radio.Group className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-emerald-50/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                                    <Radio value="AGREED_FOR_DEFENSE" />
                                    <div>
                                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                                            <CheckCircleOutlined className="text-emerald-600" />
                                            ĐỒNG Ý cho ra bảo vệ
                                        </div>
                                        <div className="text-[11px] text-emerald-600 mt-0.5">
                                            Sinh viên đủ điều kiện ra bảo vệ trước Hội đồng chấm BCTN.
                                        </div>
                                    </div>
                                </label>

                                <label className="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-rose-50/50 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50">
                                    <Radio value="NOT_AGREED_FOR_DEFENSE" />
                                    <div>
                                        <div className="font-bold text-rose-800 flex items-center gap-1">
                                            <CloseCircleOutlined className="text-rose-600" />
                                            KHÔNG ĐỒNG Ý
                                        </div>
                                        <div className="text-[11px] text-rose-600 mt-0.5">
                                            Sinh viên chưa đạt chuẩn, không được phép xếp Hội đồng.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="generalNotes"
                        label={<span className="font-semibold text-slate-700">Ghi chú bổ sung (nếu có)</span>}
                    >
                        <TextArea rows={2} placeholder="Các lưu ý thêm cho Hội đồng chấm bảo vệ..." />
                    </Form.Item>

                    <Form.Item
                        name="lecturerSignature"
                        label={<span className="font-semibold text-slate-700">Họ và tên GVHD xác nhận ký số</span>}
                        rules={[{ required: true, message: 'Vui lòng xác nhận tên người ký.' }]}
                    >
                        <Input placeholder="Nhập đầy đủ học hàm/học vị và họ tên GVHD..." size="large" />
                    </Form.Item>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                            Hủy bỏ
                        </button>
                        <Popconfirm
                            title="Xác nhận nộp & Khóa vĩnh viễn phiếu nhận xét?"
                            description="Sau khi ký nộp, bạn sẽ KHÔNG THỂ thay đổi kết luận hay chỉnh sửa nhận xét. Bạn có chắc chắn muốn nộp?"
                            onConfirm={() => form.submit()}
                            okText="Đồng ý ký khóa"
                            cancelText="Xem lại"
                            okButtonProps={{ danger: false, type: 'primary' }}
                        >
                            <button
                                type="button"
                                disabled={submitting}
                                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                                {submitting ? 'Đang ký khóa...' : 'Ký Xác Nhận & Khóa Phiếu Nhận Xét'}
                            </button>
                        </Popconfirm>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
