import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Alert, Popconfirm, message, Tag, Button, Divider } from 'antd';
import {
    FileTextOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    DownloadOutlined,
    UserOutlined,
    TeamOutlined,
    BookOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import registrationService from '../../services/registrationService';

const { TextArea } = Input;

export default function OutlineReviewModal({
    open,
    onClose,
    onSuccess,
    registration,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [selectedDecision, setSelectedDecision] = useState('PASSED');

    const latestSubmission = registration?.submissions?.[0] || null;
    const fileUrl = latestSubmission?.fileUrl || registration?.outlineFileUrl || null;
    const fileName = latestSubmission?.fileName || registration?.outlineFileName || (fileUrl ? 'de_cuong_chi_tiet_bm01.pdf' : null);
    const studentNote = latestSubmission?.content || registration?.studentNote || null;

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({
                decision: 'PASSED',
                feedback: '',
            });
            setSelectedDecision('PASSED');
        }
    }, [open, form]);

    const handleSubmit = async (values) => {
        if (!registration?.id) return;

        const decision = values.decision;
        const feedback = values.feedback ? values.feedback.trim() : '';

        if (decision === 'REVISION_REQUIRED' && !feedback) {
            message.warning('Vui lòng nhập ý kiến góp ý cụ thể để sinh viên biết nội dung cần chỉnh sửa.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                status: decision,
                decision: decision,
                feedback: feedback,
                reviewComment: feedback,
            };

            const res = await registrationService.reviewOutlineTopic(registration.id, payload);

            if (res.success) {
                message.success(
                    decision === 'PASSED'
                        ? 'Đã duyệt ĐẠT đề cương BM01! Sinh viên có thể tiến hành nộp BM02.'
                        : 'Đã gửi yêu cầu chỉnh sửa đề cương tới sinh viên.'
                );
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể cập nhật kết quả thẩm định.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi cập nhật kết quả thẩm định đề cương.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <FileTextOutlined className="text-blue-600 text-lg" />
                    <span>Hội Đồng Thẩm Định Đề Cương BM01 — Kết Luận Của Chủ Tịch</span>
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
                    type="info"
                    showIcon
                    message="Thẩm quyền Chủ tịch Hội đồng Thẩm định Đề cương"
                    description="Với vai trò Chủ tịch Hội đồng, quyết định của bạn sẽ trực tiếp chốt kết quả đề cương BM01. Nếu ĐẠT, sinh viên sẽ chuyển sang trạng thái BM01_PASSED và được phép nộp BM02. Nếu CẦN CHỈNH SỬA, sinh viên sẽ được thông báo để chỉnh sửa và nộp lại cho GVHD."
                />

                {/* THÔNG TIN ĐỀ TÀI & HỘI ĐỒNG */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                    <div>
                        <span className="text-slate-500 font-medium">Sinh viên thực hiện:</span>{' '}
                        <b className="text-slate-900">
                            {registration?.student?.fullName} ({registration?.student?.code || '-'})
                        </b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Lớp sinh viên:</span>{' '}
                        <b className="text-slate-900">{registration?.student?.class || '-'}</b>
                    </div>
                    <div className="md:col-span-2">
                        <span className="text-slate-500 font-medium">Tên đề tài:</span>{' '}
                        <b className="text-slate-900">{registration?.topic?.title || '-'}</b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">GVHD:</span>{' '}
                        <b className="text-slate-900">{registration?.topic?.mentor?.fullName || '-'}</b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Hội đồng thẩm định:</span>{' '}
                        <Tag color="blue">{registration?.outlineCouncil?.name || 'Hội đồng đề cương BM01'}</Tag>
                    </div>
                </div>

                {/* TÀI LIỆU ĐỀ CƯƠNG ĐÍNH KÈM */}
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOutlined className="text-blue-600" />
                            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                                Hồ sơ đề cương sinh viên nộp
                            </span>
                        </div>
                        {fileUrl ? (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                                <DownloadOutlined />
                                <span>Tải file đề cương ({fileName})</span>
                            </a>
                        ) : (
                            <span className="text-xs text-amber-600 italic">
                                Sinh viên nộp bản thảo trực tiếp (không đính kèm file rời)
                            </span>
                        )}
                    </div>

                    {studentNote && (
                        <div className="text-xs text-slate-700 bg-white p-2.5 rounded border border-blue-100">
                            <span className="font-semibold text-slate-900">Ghi chú từ sinh viên:</span> {studentNote}
                        </div>
                    )}
                </div>

                {/* FORM ĐÁNH GIÁ CỦA CHỦ TỊCH */}
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ decision: 'PASSED' }}
                >
                    <Divider orientation="left" className="text-xs text-slate-600 font-bold uppercase tracking-wider !my-2">
                        Kết Luận Thẩm Định
                    </Divider>

                    <Form.Item
                        name="decision"
                        label="Kết luận của Hội đồng"
                        rules={[{ required: true, message: 'Vui lòng chọn kết luận thẩm định' }]}
                    >
                        <Radio.Group
                            onChange={(e) => setSelectedDecision(e.target.value)}
                            className="w-full flex flex-col gap-2.5"
                        >
                            <Radio
                                value="PASSED"
                                className="p-3 rounded-lg border border-slate-200 hover:border-emerald-400 bg-emerald-50/20"
                            >
                                <div className="ml-1">
                                    <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
                                        <CheckCircleOutlined /> ĐẠT — Thông qua Đề Cương (BM01_PASSED)
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        Đề cương đáp ứng đầy đủ yêu cầu khoa học và mục tiêu đồ án. Cho phép sinh viên nộp BM02.
                                    </div>
                                </div>
                            </Radio>

                            <Radio
                                value="REVISION_REQUIRED"
                                className="p-3 rounded-lg border border-slate-200 hover:border-amber-400 bg-amber-50/20"
                            >
                                <div className="ml-1">
                                    <div className="font-semibold text-amber-700 flex items-center gap-1.5">
                                        <ExclamationCircleOutlined /> CẦN CHỈNH SỬA — Yêu Cầu Chỉnh Sửa Đề Cương (BM01_NEEDS_REVISION)
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        Đề cương cần bổ sung, chỉnh sửa nội dung theo góp ý chuyên môn của Hội đồng.
                                    </div>
                                </div>
                            </Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="feedback"
                        label={
                            <span className="text-xs font-semibold text-slate-700">
                                Ý kiến nhận xét & Hướng dẫn chỉnh sửa của Hội đồng:
                                {selectedDecision === 'REVISION_REQUIRED' && (
                                    <span className="text-rose-600 ml-1">(*) Bắt buộc</span>
                                )}
                            </span>
                        }
                        rules={[
                            {
                                required: selectedDecision === 'REVISION_REQUIRED',
                                message: 'Vui lòng nhập ý kiến góp ý chỉnh sửa cho sinh viên.',
                            },
                        ]}
                    >
                        <TextArea
                            rows={4}
                            placeholder={
                                selectedDecision === 'PASSED'
                                    ? 'Nhập nhận xét tích cực hoặc dặn dò thêm cho sinh viên khi triển khai đồ án (tùy chọn)...'
                                    : 'Nêu rõ các nội dung cần sửa đổi (phương pháp nghiên cứu, công nghệ áp dụng, kế hoạch tiến độ, tài liệu tham khảo)...'
                            }
                            className="text-xs"
                        />
                    </Form.Item>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                        <Button onClick={onClose} disabled={submitting}>
                            Đóng
                        </Button>
                        <Popconfirm
                            title="Xác nhận kết luận thẩm định đề cương"
                            description={`Bạn chắc chắn muốn kết luận ${selectedDecision === 'PASSED' ? 'ĐẠT' : 'YÊU CẦU CHỈNH SỬA'} cho đề tài này?`}
                            onConfirm={() => form.submit()}
                            okText="Đồng ý"
                            cancelText="Hủy"
                        >
                            <Button
                                type="primary"
                                loading={submitting}
                                className={
                                    selectedDecision === 'PASSED'
                                        ? '!bg-emerald-600 hover:!bg-emerald-500'
                                        : '!bg-amber-600 hover:!bg-amber-500'
                                }
                            >
                                {selectedDecision === 'PASSED' ? '✓ Xác Nhận Duyệt ĐẠT' : '⚠ Gửi Yêu Cầu Chỉnh Sửa'}
                            </Button>
                        </Popconfirm>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
