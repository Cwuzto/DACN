import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Alert, message, Divider } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import registrationService from '../../services/registrationService';
import userService from '../../services/userService';

const { TextArea } = Input;

export default function MentorTransferModal({
    open,
    onClose,
    onSuccess,
    registration,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [lecturers, setLecturers] = useState([]);
    const [loadingLecturers, setLoadingLecturers] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            fetchLecturers();
        }
    }, [open, form]);

    const fetchLecturers = async () => {
        try {
            setLoadingLecturers(true);
            const res = await userService.getAllUsers({ role: 'LECTURER', limit: 100 });
            if (res.success && Array.isArray(res.data)) {
                // Lọc bỏ GVHD hiện tại
                const currentMentorId = registration?.topic?.mentorId;
                const available = res.data.filter((u) => u.id !== currentMentorId && u.isActive !== false);
                setLecturers(available);
            }
        } catch (error) {
            message.error('Không thể tải danh sách giảng viên.');
        } finally {
            setLoadingLecturers(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            setSubmitting(true);
            const res = await registrationService.transferTopicMentor(registration?.id, {
                newMentorId: Number(values.newMentorId),
                reason: values.reason.trim(),
            });

            if (res.success) {
                message.success('Đã điều chuyển GVHD thành công!');
                form.resetFields();
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể điều chuyển GVHD.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi điều chuyển GVHD.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SwapOutlined className="text-[#0F766E] text-lg" />
                    <span>Điều Chuyển Giảng Viên Hướng Dẫn</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={600}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    type="warning"
                    showIcon
                    message="Nguyên tắc điều chuyển GVHD"
                    description="GVHD mới sẽ kế thừa quyền hướng dẫn và đánh giá các mốc học vụ tiếp theo. Mọi biên bản và nhật ký đã xác nhận trước thời điểm này sẽ được bảo toàn nguyên vẹn. Hệ thống tự động kiểm soát định mức tối đa 10 SV/GVHD."
                />

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                        <span className="text-slate-500 font-medium">Sinh viên:</span>{' '}
                        <b className="text-slate-800">{registration?.student?.fullName} ({registration?.student?.code})</b>
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">GVHD hiện tại:</span>{' '}
                        <b className="text-rose-600">{registration?.topic?.mentor?.fullName || registration?.topic?.mentor?.name || 'Chưa gán'}</b>
                    </div>
                    <div className="md:col-span-2">
                        <span className="text-slate-500 font-medium">Đề tài:</span>{' '}
                        <b className="text-slate-800">{registration?.topic?.title}</b>
                    </div>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    requiredMark="optional"
                >
                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Chọn GVHD Mới</span>}
                        name="newMentorId"
                        rules={[{ required: true, message: 'Vui lòng chọn GVHD tiếp nhận' }]}
                    >
                        <Select
                            placeholder="Chọn giảng viên hướng dẫn thay thế..."
                            loading={loadingLecturers}
                            showSearch
                            optionFilterProp="label"
                            options={lecturers.map((l) => ({
                                value: l.id,
                                label: `${l.fullName} (${l.code}) - ${l.department || 'Bộ môn'}`,
                            }))}
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span className="font-semibold text-slate-700">Lý Do Điều Chuyển</span>}
                        name="reason"
                        rules={[{ required: true, message: 'Vui lòng nêu rõ lý do điều chuyển' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Ví dụ: GVHD cũ đi công tác dài hạn theo quyết định của Viện..."
                            className="text-xs"
                        />
                    </Form.Item>

                    <Divider className="!my-3" />

                    <div className="flex justify-end gap-2 pt-1">
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
                            {submitting ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển'}
                        </button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
