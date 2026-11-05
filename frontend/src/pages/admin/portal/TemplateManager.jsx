import React, { useState } from 'react';
import { Form, Input, InputNumber, Upload, Card, Button, Space, Typography, Tag, Tooltip, message, Collapse } from 'antd';
import {
    InboxOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FileTextOutlined,
    DeleteOutlined,
    CloudUploadOutlined,
    LinkOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import portalContentService from '../../../services/portalContentService';

const { Text } = Typography;

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType = '', fileName = '') {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (mimeType.includes('pdf') || ext === 'pdf') {
        return <FilePdfOutlined className="text-3xl text-rose-500" />;
    }
    if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml') || ext === 'doc' || ext === 'docx') {
        return <FileWordOutlined className="text-3xl text-blue-600" />;
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheetml') || ext === 'xls' || ext === 'xlsx') {
        return <FileExcelOutlined className="text-3xl text-emerald-600" />;
    }
    return <FileTextOutlined className="text-3xl text-slate-500" />;
}

export default function TemplateManager({ form }) {
    const [uploading, setUploading] = useState(false);

    // Watch fields from form to update preview live
    const fileUrl = Form.useWatch('fileUrl', form);
    const fileName = Form.useWatch('fileName', form);
    const mimeType = Form.useWatch('mimeType', form);
    const fileSize = Form.useWatch('fileSize', form);

    const handleCustomUpload = async ({ file, onSuccess, onError }) => {
        // Validate size (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
            message.error('Kích thước tệp không được vượt quá 25MB.');
            onError(new Error('File quá lớn'));
            return;
        }

        setUploading(true);
        try {
            const res = await portalContentService.uploadDocument(file);
            const data = res?.data || {};

            // Auto-detect Code (BM01, BM02...) from filename if not yet filled
            const currentCode = form.getFieldValue('code');
            const matchBm = file.name.match(/\b(BM\s*\d{1,2}|BM-\d{1,2})\b/i);
            const detectedCode = matchBm ? matchBm[0].toUpperCase().replace(/\s+|-/g, '') : null;

            // Auto-detect Title from filename if not yet filled
            const currentTitle = form.getFieldValue('title');
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

            const updates = {
                fileUrl: data.url,
                fileName: data.fileName || file.name,
                mimeType: data.mimeType || file.type,
                fileSize: data.bytes || file.size,
            };

            if (!currentCode && detectedCode) {
                updates.code = detectedCode;
            }
            if (!currentTitle && cleanTitle) {
                updates.title = cleanTitle;
            }

            form.setFieldsValue(updates);
            onSuccess?.(data);
            message.success(`Đã tải lên tệp "${file.name}" thành công.`);
        } catch (error) {
            onError?.(error);
            message.error(error?.message || 'Tải tệp lên thất bại. Vui lòng thử lại.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = () => {
        form.setFieldsValue({
            fileUrl: '',
            fileName: '',
            mimeType: '',
            fileSize: null,
        });
        message.info('Đã gỡ tệp đính kèm.');
    };

    return (
        <Form form={form} layout="vertical">
            {/* Upload Area / Attached File Card */}
            <div className="mb-6">
                <Text strong className="block mb-2 text-slate-800 text-sm">
                    Tệp đính kèm biểu mẫu <span className="text-red-500">*</span>
                </Text>

                {fileUrl ? (
                    <Card
                        size="small"
                        className="border border-emerald-200 bg-emerald-50/40 rounded-xl shadow-xs transition-all hover:shadow-sm"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-xs flex-shrink-0">
                                    {getFileIcon(mimeType, fileName)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Text strong className="text-sm truncate text-slate-900 block max-w-[280px] sm:max-w-[420px]" title={fileName}>
                                            {fileName || 'Tệp biểu mẫu đã đính kèm'}
                                        </Text>
                                        <Tag color="success" icon={<CheckCircleOutlined />} className="text-xs">
                                            Đã tải lên
                                        </Tag>
                                    </div>
                                    <Space size="middle" className="text-xs text-slate-500 orientation-horizontal mt-0.5">
                                        {fileSize && <span>{formatBytes(fileSize)}</span>}
                                        {mimeType && <span className="font-mono text-[11px] text-slate-400">{mimeType}</span>}
                                    </Space>
                                </div>
                            </div>

                            <Space className="self-end sm:self-center flex-shrink-0">
                                <Button
                                    size="small"
                                    type="default"
                                    icon={<LinkOutlined />}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Tải về / Xem
                                </Button>
                                <Tooltip title="Gỡ tệp này để tải lên tệp mới">
                                    <Button
                                        size="small"
                                        danger
                                        type="text"
                                        icon={<DeleteOutlined />}
                                        onClick={handleRemoveFile}
                                    >
                                        Gỡ tệp
                                    </Button>
                                </Tooltip>
                            </Space>
                        </div>
                    </Card>
                ) : (
                    <Upload.Dragger
                        name="file"
                        multiple={false}
                        customRequest={handleCustomUpload}
                        showUploadList={false}
                        disabled={uploading}
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        className="bg-slate-50/70 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 transition-colors"
                    >
                        <p className="ant-upload-drag-icon mb-2">
                            {uploading ? (
                                <CloudUploadOutlined className="text-4xl text-blue-500 animate-bounce" />
                            ) : (
                                <InboxOutlined className="text-4xl text-blue-500" />
                            )}
                        </p>
                        <p className="ant-upload-text font-medium text-slate-800 text-sm">
                            {uploading ? 'Đang tải tệp lên máy chủ...' : 'Kéo thả tệp vào đây hoặc nhấp để tải lên'}
                        </p>
                        <p className="ant-upload-hint text-xs text-slate-500 mt-1">
                            Hỗ trợ tệp <b>DOCX, DOC, PDF, XLSX</b> (Dung lượng tối đa 25MB). Tên tệp và định dạng sẽ được tự động điền.
                        </p>
                    </Upload.Dragger>
                )}

                {/* Hidden form item to enforce validation on fileUrl */}
                <Form.Item
                    name="fileUrl"
                    rules={[{ required: true, message: 'Vui lòng tải lên hoặc cung cấp URL tệp biểu mẫu.' }]}
                    className="mb-0 h-0 overflow-hidden"
                >
                    <Input type="hidden" />
                </Form.Item>
                <Form.Item name="fileName" className="mb-0 h-0 overflow-hidden">
                    <Input type="hidden" />
                </Form.Item>
                <Form.Item name="mimeType" className="mb-0 h-0 overflow-hidden">
                    <Input type="hidden" />
                </Form.Item>
                <Form.Item name="fileSize" className="mb-0 h-0 overflow-hidden">
                    <Input type="hidden" />
                </Form.Item>
            </div>

            {/* Template Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <Form.Item
                    name="code"
                    label="Mã biểu mẫu"
                    rules={[
                        { required: true, message: 'Vui lòng nhập mã biểu mẫu (ví dụ: BM01).' },
                        { max: 20, message: 'Mã biểu mẫu không quá 20 ký tự.' },
                    ]}
                >
                    <Input placeholder="Ví dụ: BM01, BM02..." className="font-semibold" />
                </Form.Item>

                <Form.Item
                    name="title"
                    label="Tên biểu mẫu"
                    rules={[{ required: true, message: 'Vui lòng nhập tên biểu mẫu.' }]}
                >
                    <Input placeholder="Ví dụ: Đơn đăng ký đề tài tốt nghiệp" />
                </Form.Item>

                <Form.Item name="version" label="Phiên bản áp dụng" initialValue="1.0">
                    <Input placeholder="Ví dụ: 1.0 hoặc 2026" />
                </Form.Item>

                <Form.Item name="sortOrder" label="Thứ tự hiển thị" initialValue={0}>
                    <InputNumber min={0} max={999} className="w-full" />
                </Form.Item>
            </div>

            <Form.Item name="description" label="Mô tả / Hướng dẫn sử dụng biểu mẫu">
                <Input.TextArea
                    rows={3}
                    placeholder="Mô tả tóm tắt mục đích sử dụng biểu mẫu, thời hạn nộp hoặc đối tượng sinh viên áp dụng..."
                />
            </Form.Item>

            {/* Advanced URL/File override for special cases */}
            <Collapse
                ghost
                size="small"
                items={[
                    {
                        key: 'advanced',
                        label: <span className="text-xs text-slate-500 hover:text-slate-700">Tùy chọn kỹ thuật nâng cao (Chỉnh sửa URL/MIME thủ công)</span>,
                        children: (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <Form.Item name="fileUrl" label="Đường dẫn tệp (URL)" className="mb-2">
                                    <Input placeholder="https://..." />
                                </Form.Item>
                                <Form.Item name="fileName" label="Tên tệp hiển thị" className="mb-2">
                                    <Input placeholder="ten-bieu-mau.docx" />
                                </Form.Item>
                                <Form.Item name="mimeType" label="MIME Type" className="mb-0">
                                    <Input placeholder="application/pdf" />
                                </Form.Item>
                            </div>
                        ),
                    },
                ]}
            />
        </Form>
    );
}
