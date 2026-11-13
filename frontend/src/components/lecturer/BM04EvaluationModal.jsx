import { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Alert, Popconfirm, message, Divider, Button } from 'antd';
import {
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SaveOutlined,
    FileDoneOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import evaluationService from '../../services/evaluationService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useBM04Record } from '../../queries/gradingQueries';

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
    const [savingDraft, setSavingDraft] = useState(false);
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const queryClient = useQueryClient();

    const bm04Query = useBM04Record(scope, registration?.id, Boolean(open && registration?.id));
    const loadingRecord = bm04Query.isPending && bm04Query.fetchStatus !== 'idle';

    const programOutcome = Form.useWatch('programOutcome', form);
    const defenseRecommendation = Form.useWatch('defenseRecommendation', form);

    const effectiveTitle = registration?.effectiveTitleSnapshot
        || registration?.effectiveTitle
        || registration?.topic?.title
        || 'Chưa có tên đề tài';

    // Auto-force NOT_APPROVE_FOR_DEFENSE if DOES_NOT_MEET_PROGRAM_OUTCOMES
    useEffect(() => {
        if (programOutcome === 'DOES_NOT_MEET_PROGRAM_OUTCOMES') {
            form.setFieldsValue({
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
            });
        }
    }, [programOutcome, form]);

    useEffect(() => {
        if (!open || !registration?.id) return;

        form.resetFields();
        form.setFieldsValue({
            lecturerSignature: currentLecturerName || '',
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: 'APPROVE_FOR_DEFENSE',
        });

        if (bm04Query.data) {
            const d = bm04Query.data;
            form.setFieldsValue({
                thesisFormatScore: d.thesisFormatScore || '',
                researchContentScore: d.researchContentScore || '',
                applicabilityScore: d.applicabilityScore || '',
                attitudeScore: d.attitudeScore || '',
                programOutcome: d.programOutcome || 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: d.defenseRecommendation || 'APPROVE_FOR_DEFENSE',
                mismatchReason: d.mismatchReason || '',
                generalNotes: d.generalNotes || '',
                lecturerSignature: d.lecturerSignature || currentLecturerName || '',
            });
        }
    }, [open, registration?.id, currentLecturerName, form, bm04Query.data]);

    const handleSaveDraft = async () => {
        try {
            const values = form.getFieldsValue();
            setSavingDraft(true);
            const res = await evaluationService.saveBM04Draft(registration?.id, {
                thesisFormatScore: values.thesisFormatScore ? String(values.thesisFormatScore).trim() : null,
                researchContentScore: values.researchContentScore ? String(values.researchContentScore).trim() : null,
                applicabilityScore: values.applicabilityScore ? String(values.applicabilityScore).trim() : null,
                attitudeScore: values.attitudeScore ? String(values.attitudeScore).trim() : null,
                programOutcome: values.programOutcome || null,
                defenseRecommendation: values.defenseRecommendation || null,
                mismatchReason: values.mismatchReason ? String(values.mismatchReason).trim() : null,
                generalNotes: values.generalNotes ? String(values.generalNotes).trim() : null,
            });

            if (res.success) {
                message.success('Đã lưu nháp phiếu nhận xét BM04 thành công!');
                await queryClient.invalidateQueries({ queryKey: queryKeys.grading.all(scope) });
                await queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) });
                onSuccess?.();
            } else {
                message.error(res.message || 'Không thể lưu nháp phiếu nhận xét.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi lưu nháp.');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSignAndSubmit = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            const res = await evaluationService.signAndSubmitBM04(registration?.id, {
                thesisFormatScore: values.thesisFormatScore.trim(),
                researchContentScore: values.researchContentScore.trim(),
                applicabilityScore: values.applicabilityScore.trim(),
                attitudeScore: values.attitudeScore.trim(),
                programOutcome: values.programOutcome,
                defenseRecommendation: values.defenseRecommendation,
                mismatchReason: values.mismatchReason ? values.mismatchReason.trim() : null,
                generalNotes: values.generalNotes ? values.generalNotes.trim() : null,
                lecturerSignature: values.lecturerSignature.trim(),
            });

            if (res.success) {
                message.success('Đã ký và nộp phiếu nhận xét BM04 thành công!');
                form.resetFields();
                await queryClient.invalidateQueries({ queryKey: queryKeys.grading.all(scope) });
                await queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) });
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể nộp phiếu nhận xét.');
            }
        } catch (error) {
            if (error?.errorFields) {
                message.warning('Vui lòng kiểm tra lại các trường thông tin bắt buộc.');
            } else {
                message.error(error.message || 'Đã có lỗi xảy ra khi nộp phiếu nhận xét.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const isMismatch = programOutcome === 'MEETS_PROGRAM_OUTCOMES' && defenseRecommendation === 'NOT_APPROVE_FOR_DEFENSE';

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SafetyCertificateOutlined className="text-emerald-600 text-lg" />
                    <span>Lập Phiếu Nhận Xét & Đánh Giá Của Người Hướng Dẫn (BM04)</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={760}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    type="warning"
                    showIcon
                    message="Tính bất biến & Trách nhiệm pháp lý của GVHD"
                    description="Phiếu nhận xét yêu cầu chữ ký điện tử của GVHD. Khi ký và nộp, biểu mẫu sẽ được khóa vĩnh viễn và xuất PDF có mã băm bảo mật. Nếu kết luận ĐỒNG Ý cho ra bảo vệ, sinh viên sẽ đủ điều kiện xếp hội đồng bảo vệ."
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
                        <span className="text-slate-500 font-medium">Tên đề tài hiệu lực:</span>{' '}
                        <b className="text-slate-900">{effectiveTitle}</b>
                    </div>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                    disabled={loadingRecord}
                >
                    <Divider orientation="left" className="text-xs text-slate-600 font-bold uppercase tracking-wider !my-2">
                        4 Tiêu Chí Đánh Giá Bắt Buộc
                    </Divider>

                    <Form.Item
                        name="thesisFormatScore"
                        label={<span className="font-semibold text-slate-700">1. Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về hình thức BCTN.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Nhận xét bố cục, chính tả, cách trình bày bảng biểu, tài liệu tham khảo..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="researchContentScore"
                        label={<span className="font-semibold text-slate-700">2. Nội dung nghiên cứu của đề tài (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về nội dung nghiên cứu.' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Đánh giá mức độ hoàn thành mục tiêu đề ra, phương pháp nghiên cứu, giải thuật, công nghệ áp dụng..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="applicabilityScore"
                        label={<span className="font-semibold text-slate-700">3. Tính ứng dụng và triển vọng phát triển (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về tính ứng dụng của đề tài.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Đánh giá khả năng áp dụng thực tế của sản phẩm hoặc đóng góp học thuật, hướng mở rộng..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="attitudeScore"
                        label={<span className="font-semibold text-slate-700">4. Đánh giá thái độ và ý thức làm việc của sinh viên (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng nhận xét về thái độ làm việc của sinh viên.' }]}
                    >
                        <TextArea
                            rows={2}
                            placeholder="Nhận xét tính chủ động, chuyên cần trong các buổi họp định kỳ, sự tiếp thu góp ý của GVHD..."
                        />
                    </Form.Item>

                    <Divider orientation="left" className="text-xs text-slate-600 font-bold uppercase tracking-wider !my-2">
                        2 Kết Luận Thẩm Định Trước Bảo Vệ
                    </Divider>

                    {/* Kết luận 1: Chuẩn đầu ra */}
                    <Form.Item
                        name="programOutcome"
                        label={<span className="font-semibold text-slate-700">1. Đánh giá chuẩn đầu ra chương trình đào tạo (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn kết luận chuẩn đầu ra.' }]}
                    >
                        <Radio.Group className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-emerald-50/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                                    <Radio value="MEETS_PROGRAM_OUTCOMES" />
                                    <div>
                                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                                            <CheckCircleOutlined className="text-emerald-600" />
                                            ĐẠT chuẩn đầu ra
                                        </div>
                                        <div className="text-[11px] text-emerald-600 mt-0.5">
                                            Đáp ứng chuẩn đầu ra đồ án tốt nghiệp.
                                        </div>
                                    </div>
                                </label>

                                <label className="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-rose-50/50 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50">
                                    <Radio value="DOES_NOT_MEET_PROGRAM_OUTCOMES" />
                                    <div>
                                        <div className="font-bold text-rose-800 flex items-center gap-1">
                                            <CloseCircleOutlined className="text-rose-600" />
                                            KHÔNG ĐẠT chuẩn đầu ra
                                        </div>
                                        <div className="text-[11px] text-rose-600 mt-0.5">
                                            Chưa đáp ứng chuẩn đầu ra (Bắt buộc không cho bảo vệ).
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </Radio.Group>
                    </Form.Item>

                    {/* Kết luận 2: Cho phép ra bảo vệ */}
                    <Form.Item
                        name="defenseRecommendation"
                        label={<span className="font-semibold text-slate-700">2. Ý kiến cho phép ra bảo vệ trước Hội đồng (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn ý kiến cho phép ra bảo vệ.' }]}
                    >
                        <Radio.Group className="w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className={`p-3 border rounded-lg flex items-center gap-3 ${
                                    programOutcome === 'DOES_NOT_MEET_PROGRAM_OUTCOMES'
                                        ? 'opacity-50 cursor-not-allowed bg-slate-100'
                                        : 'cursor-pointer hover:bg-emerald-50/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50'
                                }`}>
                                    <Radio
                                        value="APPROVE_FOR_DEFENSE"
                                        disabled={programOutcome === 'DOES_NOT_MEET_PROGRAM_OUTCOMES'}
                                    />
                                    <div>
                                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                                            <CheckCircleOutlined className="text-emerald-600" />
                                            ĐỒNG Ý cho ra bảo vệ
                                        </div>
                                        <div className="text-[11px] text-emerald-600 mt-0.5">
                                            Sinh viên đủ điều kiện ra bảo vệ trước Hội đồng.
                                        </div>
                                    </div>
                                </label>

                                <label className="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-rose-50/50 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50">
                                    <Radio value="NOT_APPROVE_FOR_DEFENSE" />
                                    {/* Legacy contract alias */}
                                    <span style={{ display: 'none' }}>
                                        <Radio value="NOT_AGREED_FOR_DEFENSE" />
                                    </span>
                                    <div>
                                        <div className="font-bold text-rose-800 flex items-center gap-1">
                                            <CloseCircleOutlined className="text-rose-600" />
                                            KHÔNG ĐỒNG Ý cho ra bảo vệ
                                        </div>
                                        <div className="text-[11px] text-rose-600 mt-0.5">
                                            Hồ sơ chuyển Viện thẩm định (SLA 168 giờ).
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </Radio.Group>
                    </Form.Item>

                    {/* Trường mismatchReason bắt buộc khi MEETS_PROGRAM_OUTCOMES + NOT_APPROVE_FOR_DEFENSE */}
                    {isMismatch && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                <InfoCircleOutlined className="text-amber-600" />
                                <span>Giải trình lý do không cho bảo vệ dù đạt chuẩn đầu ra (bắt buộc)</span>
                            </div>
                            <Form.Item
                                name="mismatchReason"
                                rules={[{ required: true, message: 'Bắt buộc nhập lý do không cho bảo vệ khi sinh viên đã đạt chuẩn đầu ra.' }]}
                                className="!mb-0"
                            >
                                <TextArea
                                    rows={2}
                                    placeholder="Nêu rõ lý do cụ thể (ví dụ: vi phạm đạo đức học thuật, chưa hoàn tất thủ tục liên quan, v.v.)..."
                                />
                            </Form.Item>
                        </div>
                    )}

                    <Form.Item
                        name="generalNotes"
                        label={<span className="font-semibold text-slate-700">Ghi chú bổ sung (nếu có)</span>}
                    >
                        <TextArea rows={2} placeholder="Các lưu ý thêm cho Hội đồng chấm bảo vệ..." />
                    </Form.Item>

                    <Form.Item
                        name="lecturerSignature"
                        label={<span className="font-semibold text-slate-700">Họ và tên GVHD xác nhận ký số (*)</span>}
                        rules={[{ required: true, message: 'Vui lòng xác nhận tên người ký.' }]}
                    >
                        <Input placeholder="Nhập đầy đủ học hàm/học vị và họ tên GVHD..." size="large" />
                    </Form.Item>

                    <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-100">
                        <Button onClick={onClose}>
                            Hủy bỏ
                        </Button>
                        <Button
                            icon={<SaveOutlined />}
                            loading={savingDraft}
                            onClick={handleSaveDraft}
                        >
                            Lưu nháp
                        </Button>
                        <Popconfirm
                            title="Xác nhận nộp & Khóa vĩnh viễn phiếu nhận xét?"
                            description="Sau khi ký nộp, biểu mẫu sẽ được khóa và xuất bản PDF chính thức. Bạn có chắc chắn muốn nộp?"
                            onConfirm={handleSignAndSubmit}
                            okText="Đồng ý ký nộp"
                            cancelText="Xem lại"
                            okButtonProps={{ danger: false, type: 'primary' }}
                        >
                            <Button
                                type="primary"
                                icon={<SafetyCertificateOutlined />}
                                loading={submitting}
                                className="!bg-[#0F766E] hover:!bg-[#115E59]"
                            >
                                Ký và nộp
                            </Button>
                        </Popconfirm>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
