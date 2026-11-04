import { useState, useEffect } from 'react';
import {
    Drawer,
    Button,
    Form,
    Input,
    Radio,
    Descriptions,
    Tag,
    Space,
    Typography,
    Divider,
    message,
    Alert,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    FilePdfOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { reviewBM02 } from '../../services/registrationService';

const { TextArea } = Input;
const { Text } = Typography;

export default function BM02ReviewDrawer({
    open,
    onClose,
    registration,
    onSuccess,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [selectedAction, setSelectedAction] = useState('APPROVE');

    useEffect(() => {
        if (open && registration) {
            form.resetFields();
            form.setFieldsValue({
                action: 'APPROVE',
                issues: '',
                note: '',
            });
            setSelectedAction('APPROVE');
        }
    }, [open, registration, form]);

    const handleActionChange = (e) => {
        const val = e.target.value;
        setSelectedAction(val);
    };

    const handleSubmit = async (values) => {
        if (!registration?.id) return;

        const action = values.action;
        if (action !== 'APPROVE' && action !== 'RETURN_FOR_REVISION') {
            message.error('Hành động thẩm định không hợp lệ');
            return;
        }

        const issuesText = values.issues?.trim() || '';
        if (action === 'RETURN_FOR_REVISION' && !issuesText) {
            message.error('Vui lòng nhập lý do / nội dung yêu cầu chỉnh sửa!');
            form.setFields([
                {
                    name: 'issues',
                    errors: ['Nội dung yêu cầu chỉnh sửa là bắt buộc khi trả hồ sơ!'],
                },
            ]);
            return;
        }

        const payload = {
            action,
            issues: action === 'RETURN_FOR_REVISION'
                ? [issuesText]
                : (values.note?.trim() ? [values.note.trim()] : []),
        };

        try {
            setSubmitting(true);
            const res = await reviewBM02(registration.id, payload);
            if (res.success || res.submission) {
                message.success(
                    action === 'APPROVE'
                        ? 'Đã phê duyệt đề cương BM02 thành công!'
                        : 'Đã gửi yêu cầu chỉnh sửa đề cương BM02 cho sinh viên.'
                );
                if (onSuccess) onSuccess(res.data || res);
                if (onClose) onClose();
            } else {
                message.error(res.message || 'Không thể cập nhật kết quả thẩm định BM02');
            }
        } catch (error) {
            message.error(error?.message || 'Đã xảy ra lỗi khi thẩm định hồ sơ BM02');
        } finally {
            setSubmitting(false);
        }
    };

    const submission = registration?.currentBM02Submission;
    const attemptNo = submission?.attemptNo || registration?.attemptNo || 1;
    const fileUrl = submission?.fileUrl;

    return (
        <Drawer
            title={(
                <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-teal-600 text-lg" />
                    <span className="font-bold text-slate-800">Thẩm định Đơn Đề cương BM02</span>
                </div>
            )}
            open={open}
            onClose={onClose}
            width={580}
            destroyOnClose
            footer={(
                <div className="flex justify-end gap-2 py-1">
                    <Button onClick={onClose} disabled={submitting}>
                        Hủy
                    </Button>
                    <Button
                        type="primary"
                        loading={submitting}
                        onClick={() => form.submit()}
                        className={selectedAction === 'APPROVE' ? '!bg-teal-600 hover:!bg-teal-700' : '!bg-amber-600 hover:!bg-amber-700'}
                    >
                        {selectedAction === 'APPROVE' ? 'Xác nhận Phê duyệt BM02' : 'Xác nhận Yêu cầu Sửa đổi'}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-4">
                {/* Thông tin hồ sơ sinh viên & đề tài */}
                <Descriptions
                    size="small"
                    bordered
                    column={1}
                    className="bg-slate-50/60 rounded-lg overflow-hidden"
                >
                    <Descriptions.Item label={<Text strong>Sinh viên</Text>}>
                        <div>
                            <span className="font-bold text-slate-900">{registration?.student?.fullName || 'N/A'}</span>
                            <span className="text-xs text-slate-500 font-mono ml-2">({registration?.student?.code || 'N/A'})</span>
                            {registration?.student?.class && (
                                <span className="text-xs text-slate-600 ml-2">Lớp: {registration?.student?.class}</span>
                            )}
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text strong>Tên đề tài</Text>}>
                        <span className="font-medium text-slate-800">
                            {registration?.adjustedTitle || registration?.topic?.title || 'Chưa cập nhật'}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text strong>Giảng viên hướng dẫn</Text>}>
                        <span className="text-slate-700">
                            {registration?.topic?.mentor?.fullName || 'Chưa phân công'}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text strong>Lần nộp hồ sơ</Text>}>
                        <Tag color={attemptNo > 1 ? 'volcano' : 'blue'}>
                            Lần {attemptNo}
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text strong>Trạng thái hiện tại</Text>}>
                        <Tag color={registration?.status === 'BM02_RESUBMITTED' ? 'purple' : 'cyan'}>
                            {registration?.status}
                        </Tag>
                    </Descriptions.Item>
                    {fileUrl && (
                        <Descriptions.Item label={<Text strong>Tệp đề cương BM02</Text>}>
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-2.5 py-1 rounded border border-blue-200"
                            >
                                <FilePdfOutlined />
                                <span>Xem tài liệu đề cương đã nộp</span>
                            </a>
                        </Descriptions.Item>
                    )}
                    {submission?.content && (
                        <Descriptions.Item label={<Text strong>Ghi chú sinh viên</Text>}>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap m-0">
                                {submission.content}
                            </p>
                        </Descriptions.Item>
                    )}
                </Descriptions>

                <Alert
                    message="Quy chuẩn Thẩm định Viện"
                    description="Viện trưởng / Đại diện Viện thẩm định chỉ có 2 hành động hợp lệ: Phê duyệt (APPROVE) nếu đề cương đạt chuẩn, hoặc Yêu cầu chỉnh sửa (RETURN_FOR_REVISION) kèm lý do cụ thể. Sinh viên sẽ nhận được thông báo để chỉnh sửa trong thời hạn quy định."
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    className="text-xs"
                />

                <Divider orientation="left" className="!my-2 text-xs font-bold text-slate-500">
                    KẾT QUẢ THẨM ĐỊNH
                </Divider>

                {/* Form quyết định thẩm định */}
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ action: 'APPROVE', issues: '', note: '' }}
                >
                    <Form.Item
                        name="action"
                        label={<Text strong>Quyết định thẩm định</Text>}
                        rules={[{ required: true, message: 'Vui lòng chọn kết quả thẩm định!' }]}
                    >
                        <Radio.Group onChange={handleActionChange} className="w-full">
                            <Space orientation="vertical" className="w-full">
                                <Radio
                                    value="APPROVE"
                                    className="p-3 border rounded-lg border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 w-full"
                                >
                                    <div className="inline-block ml-1">
                                        <div className="font-semibold text-emerald-800">
                                            <CheckCircleOutlined className="mr-1.5 text-emerald-600" />
                                            Phê duyệt (APPROVE)
                                        </div>
                                        <div className="text-xs text-emerald-600">
                                            Đề cương đạt yêu cầu, sẵn sàng để ban hành Quyết định giao đề tài.
                                        </div>
                                    </div>
                                </Radio>
                                <Radio
                                    value="RETURN_FOR_REVISION"
                                    className="p-3 border rounded-lg border-amber-200 bg-amber-50/50 hover:bg-amber-50 w-full"
                                >
                                    <div className="inline-block ml-1">
                                        <div className="font-semibold text-amber-800">
                                            <CloseCircleOutlined className="mr-1.5 text-amber-600" />
                                            Yêu cầu chỉnh sửa (RETURN_FOR_REVISION)
                                        </div>
                                        <div className="text-xs text-amber-600">
                                            Yêu cầu sinh viên bổ sung, chỉnh sửa nội dung theo góp ý thẩm định.
                                        </div>
                                    </div>
                                </Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>

                    {selectedAction === 'RETURN_FOR_REVISION' && (
                        <Form.Item
                            name="issues"
                            label={<Text strong className="text-amber-800">Nội dung yêu cầu chỉnh sửa (Bắt buộc)</Text>}
                            rules={[
                                {
                                    required: true,
                                    message: 'Vui lòng nhập lý do / nội dung yêu cầu sinh viên chỉnh sửa!',
                                },
                                {
                                    validator: (_, val) => {
                                        if (!val || !val.trim()) {
                                            return Promise.reject(new Error('Nội dung yêu cầu chỉnh sửa không được để trống!'));
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <TextArea
                                rows={4}
                                placeholder="Ghi rõ các thiếu sót, nội dung chưa đạt hoặc chỉ dẫn cụ thể cho sinh viên..."
                                showCount
                                maxLength={1000}
                            />
                        </Form.Item>
                    )}

                    {selectedAction === 'APPROVE' && (
                        <Form.Item
                            name="note"
                            label={<Text strong className="text-slate-700">Ghi chú phê duyệt (Tùy chọn)</Text>}
                        >
                            <TextArea
                                rows={3}
                                placeholder="Ghi chú thêm nếu có (ví dụ: Lưu ý trong quá trình triển khai)..."
                                showCount
                                maxLength={500}
                            />
                        </Form.Item>
                    )}
                </Form>
            </div>
        </Drawer>
    );
}
