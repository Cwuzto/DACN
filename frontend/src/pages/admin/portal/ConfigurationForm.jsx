import { Form, Input } from 'antd';

export default function ConfigurationForm({ form }) {
    return (
        <Form form={form} layout="vertical">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <Form.Item name="siteTitle" label="Tên Portal" rules={[{ required: true, message: 'Nhập tên Portal.' }]}><Input /></Form.Item>
                <Form.Item name="institutionName" label="Tên đơn vị"><Input /></Form.Item>
                <Form.Item name="logoUrl" label="URL logo"><Input type="url" /></Form.Item>
                <Form.Item name="email" label="Email liên hệ"><Input type="email" /></Form.Item>
                <Form.Item name="phone" label="Số điện thoại"><Input /></Form.Item>
                <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
            </div>
            <Form.Item name="heroTitle" label="Tiêu đề Hero"><Input /></Form.Item>
            <Form.Item name="heroSlogan" label="Slogan"><Input /></Form.Item>
            <Form.Item name="heroDescription" label="Mô tả Hero"><Input.TextArea rows={3} /></Form.Item>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <Form.Item name="primaryCtaLabel" label="Nhãn CTA chính"><Input /></Form.Item>
                <Form.Item name="primaryCtaHref" label="Liên kết CTA chính"><Input /></Form.Item>
                <Form.Item name="secondaryCtaLabel" label="Nhãn CTA phụ"><Input /></Form.Item>
                <Form.Item name="secondaryCtaHref" label="Liên kết CTA phụ"><Input /></Form.Item>
            </div>
            <Form.Item name="copyrightText" label="Bản quyền footer"><Input /></Form.Item>
        </Form>
    );
}
