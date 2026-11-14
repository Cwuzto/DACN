import { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Select, Input, Alert, message, Divider } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import registrationService from '../../services/registrationService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useUsers } from '../../queries/userQueries';

const { TextArea } = Input;

export default function MentorTransferModal({
    open,
    onClose,
    onSuccess,
    registration,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const queryClient = useQueryClient();

    const lecturersQuery = useUsers(scope, { role: 'LECTURER', limit: 100 }, Boolean(open));
    const loadingLecturers = lecturersQuery.isPending && lecturersQuery.fetchStatus !== 'idle';

    const lecturers = useMemo(() => {
        const rawList = Array.isArray(lecturersQuery.data?.data)
            ? lecturersQuery.data.data
            : Array.isArray(lecturersQuery.data)
            ? lecturersQuery.data
            : [];
        const currentMentorId = registration?.topic?.mentorId;
        return rawList.filter((u) => u.id !== currentMentorId && u.isActive !== false);
    }, [lecturersQuery.data, registration?.topic?.mentorId]);

    useEffect(() => {
        if (open) {
            form.resetFields();
        }
    }, [open, form]);

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
                await queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) });
                onSuccess?.();
                onClose?.();
            } else {
                message.error(res.message || 'Không thể điều chuyển GVHD.');
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi gửi yêu cầu điều chuyển GVHD.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <SwapOutlined className="text-[#0F766E] text-lg" />
                    <span>Điều Chuyển Giảng Viên Hướng Dẫn</span>
                </div>
            }
            onCancel={() => {
                if (!submitting) {
                    form.resetFields();
                    onClose?.();
                }
            }}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            okText="Xác nhận điều chuyển"
            cancelText="Hủy"
            okButtonProps={{
                className: '!bg-[#0F766E] hover:!bg-[#0D655E] text-white font-medium border-0 shadow-sm',
            }}
            destroyOnClose
            width={560}
        >
            <div className="space-y-4 pt-2">
                <Alert
                    message="Cân nhắc kỹ trước khi thực hiện"
                    description="Hành động này sẽ thay đổi toàn bộ quyền phê duyệt biểu mẫu, đánh giá tiến độ và nhận xét bảo vệ của đề tài sang GVHD mới."
                    type="warning"
                    showIcon
                    className="rounded-lg text-xs"
                />

                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Đề tài:</span>
                        <span className="font-semibold text-slate-800 text-right max-w-[340px] truncate">
                            {registration?.effectiveTitleSnapshot || registration?.topic?.title || 'Chưa có tên'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Sinh viên thực hiện:</span>
                        <span className="font-medium text-slate-700">
                            {registration?.student?.fullName} ({registration?.student?.code})
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">GVHD Hiện tại:</span>
                        <span className="font-semibold text-amber-700">
                            {registration?.topic?.mentor?.user?.fullName || registration?.topic?.mentorName || 'Chưa gán'}
                        </span>
                    </div>
                </div>

                <Divider className="my-2" />

                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="newMentorId"
                        label={<span className="font-medium text-slate-700">Chọn Giảng viên Hướng dẫn mới</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn giảng viên mới' }]}
                    >
                        <Select
                            placeholder="Tìm kiếm và chọn giảng viên tiếp nhận..."
                            loading={loadingLecturers}
                            showSearch
                            optionFilterProp="label"
                            options={lecturers.map((lec) => ({
                                value: lec.id,
                                label: `${lec.fullName} (${lec.email || lec.code || 'GV'})`,
                            }))}
                            className="w-full"
                        />
                    </Form.Item>

                    <Form.Item
                        name="reason"
                        label={<span className="font-medium text-slate-700">Lý do điều chuyển</span>}
                        rules={[
                            { required: true, message: 'Vui lòng cung cấp lý do điều chuyển' },
                            { min: 10, message: 'Lý do phải chi tiết ít nhất 10 ký tự' },
                        ]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="Nhập lý do thay đổi (ví dụ: GVHD đi công tác dài hạn, nguyện vọng đề tài thay đổi...)"
                            maxLength={500}
                            showCount
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
}
