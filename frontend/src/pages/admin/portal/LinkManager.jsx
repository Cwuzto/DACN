import { Form, Input, InputNumber, Select, Alert, Typography } from 'antd';
import {
    LinkOutlined,
    ShareAltOutlined,
    SafetyCertificateOutlined,
    CompassOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const GROUP_OPTIONS = [
    {
        value: 'QUICK_LINK',
        label: (
            <div className="flex items-center gap-2">
                <CompassOutlined className="text-blue-500" />
                <span>Liên kết nhanh (Quick Links)</span>
            </div>
        ),
        description: 'Hiển thị dạng danh sách liên kết truy cập nhanh ở Footer trang chủ.',
    },
    {
        value: 'SOCIAL',
        label: (
            <div className="flex items-center gap-2">
                <ShareAltOutlined className="text-emerald-500" />
                <span>Mạng xã hội & Truyền thông (Social)</span>
            </div>
        ),
        description: 'Hiển thị ở góc chân trang cạnh thông tin bản quyền (Facebook, YouTube, Cổng Đào tạo...).',
    },
    {
        value: 'LEGAL',
        label: (
            <div className="flex items-center gap-2">
                <SafetyCertificateOutlined className="text-amber-500" />
                <span>Pháp lý & Quy chế (Legal)</span>
            </div>
        ),
        description: 'Quy chế đào tạo, chuẩn liêm chính học thuật, điều khoản sử dụng.',
    },
];

export default function LinkManager({ form }) {
    const selectedGroup = Form.useWatch('group', form) || 'QUICK_LINK';
    const currentGroupMeta = GROUP_OPTIONS.find((g) => g.value === selectedGroup);

    return (
        <Form form={form} layout="vertical">
            <Alert
                type="info"
                showIcon
                icon={<LinkOutlined />}
                message={<span className="text-xs font-semibold">Cấu hình liên kết ngoài hoặc điều hướng chân trang (Footer)</span>}
                description={
                    <span className="text-xs text-slate-600">
                        {currentGroupMeta?.description || 'Liên kết sẽ tự động đồng bộ xuống khu vực Footer của Cổng thông tin công khai.'}
                    </span>
                }
                className="mb-4 bg-slate-50 border-slate-200 rounded-lg text-xs"
            />

            <Form.Item
                name="label"
                label="Nhãn hiển thị"
                rules={[
                    { required: true, message: 'Vui lòng nhập tên nhãn liên kết.' },
                    { max: 100, message: 'Tên nhãn tối đa 100 ký tự.' },
                ]}
            >
                <Input placeholder="Ví dụ: Cổng Đào tạo Đại học, Fanpage Viện, Quy chế Khóa luận..." />
            </Form.Item>

            <Form.Item
                name="href"
                label="Đường dẫn đích (URL)"
                rules={[
                    { required: true, message: 'Vui lòng nhập URL.' },
                    {
                        pattern: /^(https?:\/\/|\/|#|mailto:|tel:)/i,
                        message: 'URL hợp lệ phải bắt đầu bằng http://, https://, /, # hoặc mailto:',
                    },
                ]}
            >
                <Input placeholder="Ví dụ: https://tdmu.edu.vn hoặc #downloads" />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <Form.Item
                    name="group"
                    label="Nhóm liên kết"
                    initialValue="QUICK_LINK"
                    rules={[{ required: true, message: 'Chọn nhóm liên kết.' }]}
                >
                    <Select options={GROUP_OPTIONS} />
                </Form.Item>

                <Form.Item
                    name="sortOrder"
                    label="Thứ tự hiển thị"
                    initialValue={0}
                >
                    <InputNumber min={0} max={999} className="w-full" placeholder="0" />
                </Form.Item>
            </div>
        </Form>
    );
}
