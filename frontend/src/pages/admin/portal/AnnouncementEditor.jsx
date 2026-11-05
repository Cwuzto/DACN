import { Form, Input, Radio, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import RichTextEditor from '../../../components/common/RichTextEditor';

export default function AnnouncementEditor({ form, announcementType, onTypeChange, onUpload, uploading }) {
    return (
        <Form form={form} layout="vertical">
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề thông báo.' }]}><Input /></Form.Item>
            <Form.Item label="Loại thông báo" required>
                <Radio.Group value={announcementType} onChange={(event) => onTypeChange(event.target.value)}>
                    <Radio value="RICH_TEXT">Nội dung biên soạn</Radio>
                    <Radio value="PDF">Tệp PDF</Radio>
                </Radio.Group>
            </Form.Item>
            {announcementType === 'PDF' ? (
                <>
                    <Form.Item name="fileName" label="Tên tệp PDF" rules={[{ required: true, message: 'Chọn tệp PDF.' }]}><Input readOnly /></Form.Item>
                    <Form.Item name="fileUrl" hidden><Input /></Form.Item>
                    <Upload accept="application/pdf" showUploadList={false} customRequest={onUpload} disabled={uploading}>
                        <Button icon={<UploadOutlined />} loading={uploading}>Chọn và tải PDF</Button>
                    </Upload>
                </>
            ) : (
                <Form.Item name="richContentHtml" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung thông báo.' }]}>
                    <RichTextEditor />
                </Form.Item>
            )}
        </Form>
    );
}
