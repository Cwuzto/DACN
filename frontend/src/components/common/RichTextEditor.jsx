import { Input, Typography } from 'antd';

const { TextArea } = Input;

export default function RichTextEditor({ value, onChange, disabled = false }) {
    return (
        <div>
            <TextArea
                aria-label="Nội dung thông báo định dạng HTML"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                rows={10}
                placeholder="Ví dụ: <p>Nội dung thông báo</p><ul><li>Một mục</li></ul>"
            />
            <Typography.Text type="secondary" className="text-xs">
                Chỉ dùng HTML ngữ nghĩa cơ bản; nội dung sẽ được máy chủ lọc lại trước khi lưu.
            </Typography.Text>
        </div>
    );
}
