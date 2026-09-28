import React, { useState, useEffect } from 'react';
import { Drawer, Form, Input, DatePicker, Button, Typography, Space, Tag, Divider, Alert, message, Radio } from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileTextOutlined,
    UserOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import BMSubmissionViewer from './BMSubmissionViewer';
import taskService from '../../services/taskService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function BMReviewDrawer({
    visible,
    task,
    registration,
    onClose,
    onSuccess,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [decision, setDecision] = useState('COMPLETED');

    const submissions = task?.submissions || [];
    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setDecision('COMPLETED');
            if (latestSubmission?.feedback) {
                form.setFieldsValue({
                    feedback: latestSubmission.feedback,
                });
            }
        }
    }, [visible, task, latestSubmission]);

    const handleFinish = async (values) => {
        if (!task) return;
        try {
            setSubmitting(true);
            const feedbackText = values.feedback?.trim() || '';

            if (latestSubmission?.id) {
                // Call gradeSubmission API
                const res = await taskService.gradeSubmission(latestSubmission.id, {
                    feedback: feedbackText || (decision === 'COMPLETED' ? 'Đã duyệt đạt yêu cầu.' : 'Cần chỉnh sửa theo hướng dẫn.'),
                    decision,
                });

                if (res.success) {
                    message.success(decision === 'COMPLETED' ? 'Đã phê duyệt biểu mẫu thành công!' : 'Đã gửi yêu cầu chỉnh sửa cho sinh viên.');
                    onSuccess && onSuccess();
                    onClose && onClose();
                }
            } else {
                // Fallback: update task status directly if no submission object exists yet
                const payload = {
                    status: decision,
                    reviewComment: feedbackText,
                    dueDate: values.newDueDate ? values.newDueDate.toISOString() : undefined,
                };
                const res = await taskService.updateTaskStatus(task.id, payload);
                if (res.success) {
                    message.success('Đã cập nhật trạng thái nhiệm vụ!');
                    onSuccess && onSuccess();
                    onClose && onClose();
                }
            }
        } catch (error) {
            message.error(error?.message || 'Không thể lưu đánh giá');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            open={visible}
            onClose={onClose}
            width={680}
            title={
                <div className="flex items-center justify-between gap-3 pr-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-xl">fact_check</span>
                        <span className="font-bold text-slate-800 text-base">Xét duyệt Biểu mẫu & Báo cáo</span>
                    </div>
                    {task?.taskType && (
                        <Tag color="blue" className="font-semibold text-xs px-2.5 py-0.5 rounded-full">
                            {task.taskType}
                        </Tag>
                    )}
                </div>
            }
            destroyOnClose
            className="bm-review-drawer"
        >
            <div className="space-y-6 pb-6">
                {/* Student & Topic Info Card */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                                Sinh viên thực hiện
                            </div>
                            <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <UserOutlined className="text-slate-400" />
                                {registration?.student?.fullName || 'Sinh viên'}
                                <span className="text-xs text-slate-500 font-normal">
                                    ({registration?.student?.code || 'N/A'})
                                </span>
                            </div>
                            <div className="text-sm text-slate-600 mt-1">
                                Đề tài: <strong>{registration?.topic?.title || 'Chưa rõ tên đề tài'}</strong>
                            </div>
                        </div>

                        <div className="text-right shrink-0">
                            <Tag color={task?.status === 'COMPLETED' ? 'success' : task?.status === 'REVISION' ? 'error' : 'processing'} className="font-semibold text-xs">
                                {task?.status === 'COMPLETED' ? 'Đã duyệt' : task?.status === 'REVISION' ? 'Cần sửa' : task?.status === 'SUBMITTED' ? 'Chờ duyệt' : task?.status || 'OPEN'}
                            </Tag>
                        </div>
                    </div>
                </div>

                {/* Task Details */}
                <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{task?.title}</h4>
                    <p className="text-xs text-slate-500">{task?.content}</p>
                </div>

                <Divider className="my-3 border-slate-100" />

                {/* Submission Content Viewer */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <FileTextOutlined className="text-blue-600" /> Nội dung sinh viên đã nộp
                        </span>
                        {submissions.length > 1 && (
                            <span className="text-xs text-slate-400">
                                Lần nộp thứ {submissions.length}
                            </span>
                        )}
                    </div>

                    <BMSubmissionViewer submission={latestSubmission} showFeedback={false} />
                </div>

                <Divider className="my-3 border-slate-100" />

                {/* Lecturer Evaluation & Feedback Form */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-blue-600 text-[18px]">rate_review</span>
                        Đánh giá & Nhận xét của Giảng viên hướng dẫn
                    </div>

                    <Form form={form} layout="vertical" onFinish={handleFinish}>
                        <Form.Item label={<span className="font-semibold text-slate-700">Kết quả đánh giá</span>} required>
                            <Radio.Group
                                value={decision}
                                onChange={(e) => setDecision(e.target.value)}
                                className="w-full grid grid-cols-2 gap-3"
                            >
                                <Radio.Button
                                    value="COMPLETED"
                                    className={`!h-11 !flex !items-center !justify-center !rounded-xl !border ${
                                        decision === 'COMPLETED' ? '!bg-emerald-50 !border-emerald-500 !text-emerald-700 font-bold' : '!border-slate-200'
                                    }`}
                                >
                                    <CheckCircleOutlined className="mr-1.5 text-emerald-600" /> Phê duyệt (Đạt)
                                </Radio.Button>

                                <Radio.Button
                                    value="REVISION"
                                    className={`!h-11 !flex !items-center !justify-center !rounded-xl !border ${
                                        decision === 'REVISION' ? '!bg-amber-50 !border-amber-500 !text-amber-700 font-bold' : '!border-slate-200'
                                    }`}
                                >
                                    <CloseCircleOutlined className="mr-1.5 text-amber-600" /> Yêu cầu sửa lại
                                </Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item
                            name="feedback"
                            label={<span className="font-semibold text-slate-700">Nhận xét / Góp ý chi tiết</span>}
                            rules={[{ required: decision === 'REVISION', message: 'Vui lòng nhập nhận xét khi yêu cầu sửa' }]}
                        >
                            <TextArea
                                rows={4}
                                placeholder={
                                    decision === 'COMPLETED'
                                        ? 'Nhập lời khen hoặc dặn dò cho bước tiếp theo (tùy chọn)...'
                                        : 'Chỉ rõ các điểm sinh viên cần bổ sung, chỉnh sửa hoặc làm lại...'
                                }
                                className="rounded-lg text-sm"
                            />
                        </Form.Item>

                        {decision === 'REVISION' && (
                            <Form.Item
                                name="newDueDate"
                                label={<span className="font-semibold text-slate-700">Gia hạn nộp lại (mới)</span>}
                                rules={[{ required: true, message: 'Vui lòng chọn hạn nộp mới khi yêu cầu sửa' }]}
                            >
                                <DatePicker
                                    showTime
                                    format="HH:mm DD/MM/YYYY"
                                    placeholder="Chọn hạn nộp mới"
                                    className="w-full rounded-lg h-10"
                                />
                            </Form.Item>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-3">
                            <Button onClick={onClose} disabled={submitting} className="rounded-lg">
                                Đóng
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                className={`rounded-lg px-6 font-semibold shadow-sm ${
                                    decision === 'COMPLETED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                            >
                                {decision === 'COMPLETED' ? 'Xác nhận Duyệt Đạt' : 'Gửi Yêu cầu Sửa'}
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </Drawer>
    );
}
