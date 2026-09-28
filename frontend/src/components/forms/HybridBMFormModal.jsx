import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Radio, Upload, Button, message, Alert, Typography, Divider, Space } from 'antd';
import { UploadOutlined, FilePdfOutlined, CheckCircleOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import uploadService from '../../services/uploadService';

const { TextArea } = Input;
const { Text, Title } = Typography;

const FORM_CONFIGS = {
    BM01: {
        code: 'BM01',
        title: 'BM01 - Đề cương chi tiết Đồ án',
        subtitle: 'Khai báo thông tin đề cương chi tiết và đính kèm bản ký xác nhận',
        fields: [
            { name: 'topicTitle', label: 'Tên đề tài', type: 'input', required: true, placeholder: 'Nhập tên đề tài chính xác' },
            { name: 'objectives', label: 'Mục tiêu & Phạm vi nghiên cứu', type: 'textarea', required: true, rows: 3, placeholder: 'Nêu rõ mục tiêu đề tài, giới hạn phạm vi nghiên cứu và ứng dụng' },
            { name: 'technologies', label: 'Công nghệ & Phương pháp thực hiện', type: 'input', required: true, placeholder: 'VD: React, Node.js, PostgreSQL, Docker...' },
            { name: 'deliverables', label: 'Sản phẩm dự kiến & Kế hoạch', type: 'textarea', required: true, rows: 3, placeholder: 'Sản phẩm phần mềm, báo cáo, tài liệu hướng dẫn...' },
        ],
        fileRequired: true,
        fileHint: 'Đính kèm file PDF/Word đề cương chi tiết (tối đa 20MB)',
    },
    BM02: {
        code: 'BM02',
        title: 'BM02 - Phiếu giao nhiệm vụ Đồ án',
        subtitle: 'Xác nhận các mốc nhiệm vụ trọng tâm và nội dung thực hiện',
        fields: [
            { name: 'mainTasks', label: 'Tóm tắt các nhiệm vụ chính', type: 'textarea', required: true, rows: 3, placeholder: 'Liệt kê các nhiệm vụ nghiên cứu và phát triển cốt lõi' },
            { name: 'timelineMilestones', label: 'Các mốc thời gian & tiến độ', type: 'textarea', required: true, rows: 2, placeholder: 'Giai đoạn 1: Thiết kế, Giai đoạn 2: Lập trình, Giai đoạn 3: Đánh giá...' },
            { name: 'specialRequirements', label: 'Yêu cầu kỹ thuật đặc thù', type: 'textarea', required: false, rows: 2, placeholder: 'Yêu cầu về kiểm thử, bảo mật, tài liệu kỹ thuật...' },
        ],
        fileRequired: true,
        fileHint: 'Đính kèm bản scan Phiếu giao nhiệm vụ có chữ ký (PDF/DOCX)',
    },
    BM03_CHECKPOINT_1: {
        code: 'BM03',
        title: 'BM03 - Báo cáo Tiến độ Đợt 1 (Tuần 6)',
        subtitle: 'Báo cáo khối lượng công việc hoàn thành đợt 1 (Mục tiêu tối thiểu >= 40%)',
        fields: [
            { name: 'progressPercent', label: 'Khối lượng hoàn thành (%)', type: 'number', min: 0, max: 100, required: true, placeholder: 'Nhập % (0 - 100)' },
            { name: 'completedWork', label: 'Công việc & Module đã hoàn thành', type: 'textarea', required: true, rows: 3, placeholder: 'Liệt kê các tính năng, tài liệu, kết quả đã hoàn thành' },
            { name: 'issues', label: 'Khó khăn & Vướng mắc kỹ thuật', type: 'textarea', required: false, rows: 2, placeholder: 'Nêu các khó khăn về công nghệ, thuật toán, dữ liệu cần GVHD hướng dẫn' },
            { name: 'nextStepPlan', label: 'Kế hoạch giai đoạn tiếp theo', type: 'textarea', required: true, rows: 2, placeholder: 'Mục tiêu hoàn thành trong các tuần tới' },
        ],
        fileRequired: false,
        fileHint: 'Đính kèm slide báo cáo / tài liệu tiến độ / video demo (nếu có)',
    },
    BM03_CHECKPOINT_2: {
        code: 'BM03',
        title: 'BM03 - Báo cáo Tiến độ Đợt 2 (Tuần 10)',
        subtitle: 'Báo cáo hoàn thiện sản phẩm và chuẩn bị bản thảo báo cáo (Mục tiêu >= 80%)',
        fields: [
            { name: 'progressPercent', label: 'Khối lượng hoàn thành (%)', type: 'number', min: 0, max: 100, required: true, placeholder: 'Nhập % (0 - 100)' },
            { name: 'completedWork', label: 'Toàn bộ các module đã hoàn thiện', type: 'textarea', required: true, rows: 3, placeholder: 'Chi tiết các chức năng đã xây dựng và kiểm thử' },
            { name: 'testingAndResults', label: 'Kết quả kiểm thử & Nghiệm thu thử', type: 'textarea', required: false, rows: 2, placeholder: 'Kết quả test case, độ ổn định, hiệu năng hệ thống' },
            { name: 'nextStepPlan', label: 'Kế hoạch hoàn tất và chuẩn bị bảo vệ', type: 'textarea', required: true, rows: 2, placeholder: 'Kế hoạch hoàn thiện quyển báo cáo và slide' },
        ],
        fileRequired: false,
        fileHint: 'Đính kèm slide báo cáo / tài liệu tiến độ / link demo (nếu có)',
    },
    BM03_CHECKPOINT: {
        code: 'BM03',
        title: 'BM03 - Báo cáo tiến độ thực hiện',
        subtitle: 'Báo cáo khối lượng công việc hoàn thành và kế hoạch giai đoạn kế tiếp',
        fields: [
            { name: 'progressPercent', label: 'Khối lượng hoàn thành (%)', type: 'number', min: 0, max: 100, required: true, placeholder: 'Nhập % (0 - 100)' },
            { name: 'completedWork', label: 'Công việc đã hoàn thành', type: 'textarea', required: true, rows: 3, placeholder: 'Chi tiết những nội dung, tính năng, tài liệu đã làm xong' },
            { name: 'inProgressAndIssues', label: 'Công việc đang làm & Khó khăn/vướng mắc', type: 'textarea', required: false, rows: 2, placeholder: 'Nêu các khó khăn về kỹ thuật, dữ liệu cần GVHD định hướng' },
            { name: 'nextStepPlan', label: 'Kế hoạch giai đoạn tiếp theo', type: 'textarea', required: true, rows: 2, placeholder: 'Mục tiêu hoàn thành trong 1-2 tuần tới' },
        ],
        fileRequired: false,
        fileHint: 'Đính kèm slide báo cáo / tài liệu tiến độ / link demo (nếu có)',
    },
    REPORT_DRAFT: {
        code: 'BẢN THẢO',
        title: 'Báo cáo toàn văn bản thảo (Thuyết minh đồ án)',
        subtitle: 'Nộp toàn văn báo cáo đồ án và link mã nguồn phục vụ GVHD thẩm định trước bảo vệ',
        fields: [
            { name: 'summaryResult', label: 'Tóm tắt kết quả chính của đồ án', type: 'textarea', required: true, rows: 3, placeholder: 'Tóm tắt các sản phẩm chính và mức độ hoàn thành so với mục tiêu ban đầu' },
            { name: 'repoLink', label: 'Liên kết mã nguồn (GitHub / GitLab / Bitbucket)', type: 'input', required: false, placeholder: 'https://github.com/...' },
            { name: 'demoLink', label: 'Liên kết Demo / Video giới thiệu (Google Drive, YouTube)', type: 'input', required: false, placeholder: 'https://youtube.com/watch?... hoặc link Google Drive' },
        ],
        fileRequired: true,
        fileHint: 'Đính kèm tệp PDF toàn văn Báo cáo thuyết minh đồ án (tối đa 30MB)',
    },
    GENERIC: {
        code: 'GENERIC',
        title: 'Nộp báo cáo nhiệm vụ',
        subtitle: 'Nhập nội dung báo cáo và tải tệp đính kèm',
        fields: [
            { name: 'summary', label: 'Nội dung báo cáo', type: 'textarea', required: true, rows: 4, placeholder: 'Mô tả chi tiết kết quả thực hiện nhiệm vụ...' },
        ],
        fileRequired: false,
        fileHint: 'Tải lên tệp đính kèm (PDF, DOCX, ZIP tối đa 20MB)',
    },
};

export default function HybridBMFormModal({
    visible,
    task,
    registration,
    onClose,
    onSubmit,
    submitting,
}) {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const taskType = task?.taskType || 'GENERIC';
    const config = FORM_CONFIGS[taskType] || FORM_CONFIGS.GENERIC;

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setFileList([]);
            setUploadedFile(null);

            // Prepopulate initial values
            const initialValues = {};
            if (taskType === 'BM01') {
                initialValues.topicTitle = registration?.topic?.title || '';
            } else if (taskType === 'BM03_CHECKPOINT') {
                initialValues.progressPercent = 50;
            }

            // If task already has recent submission, prefill content
            if (task?.submissions?.length > 0) {
                const lastSub = task.submissions[0];
                if (lastSub.content) {
                    try {
                        const parsed = JSON.parse(lastSub.content);
                        if (parsed && typeof parsed === 'object' && parsed.fields) {
                            Object.assign(initialValues, parsed.fields);
                        } else {
                            initialValues.summary = lastSub.content;
                        }
                    } catch {
                        initialValues.summary = lastSub.content;
                    }
                }
                if (lastSub.fileUrl) {
                    setUploadedFile({
                        url: lastSub.fileUrl,
                        name: lastSub.fileName || 'Tài liệu đã nộp trước đó',
                    });
                }
            }

            form.setFieldsValue(initialValues);
        }
    }, [visible, task, registration]);

    const handleCustomUpload = async ({ file, onSuccess, onError }) => {
        try {
            setUploading(true);
            const res = await uploadService.uploadFile(file, 'submissions', { taskId: task?.id });
            if (res.success && res.data?.url) {
                setUploadedFile({
                    url: res.data.url,
                    name: file.name,
                });
                onSuccess(res.data);
                message.success(`Đã tải lên tệp: ${file.name}`);
            } else {
                throw new Error(res.message || 'Upload thất bại');
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải tệp lên');
            onError(error);
        } finally {
            setUploading(false);
        }
    };

    const handleFinish = async (values) => {
        if (config.fileRequired && !uploadedFile) {
            message.error('Vui lòng tải lên tệp đính kèm bắt buộc cho biểu mẫu này.');
            return;
        }

        // Package hybrid data
        const structuredData = {
            taskType,
            formCode: config.code,
            submittedAt: new Date().toISOString(),
            fields: values,
        };

        const payload = {
            content: JSON.stringify(structuredData),
            fileUrl: uploadedFile?.url || null,
            fileName: uploadedFile?.name || null,
        };

        onSubmit(payload);
    };

    return (
        <Modal
            open={visible}
            title={null}
            footer={null}
            onCancel={onClose}
            width={720}
            destroyOnClose
            className="hybrid-bm-modal"
            centered
        >
            <div className="py-2 px-1">
                {/* Header */}
                <div className="border-b border-slate-100 pb-4 mb-5">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        {config.code} - BIỂU MẪU ĐỒ ÁN
                    </div>
                    <Title level={4} className="!mb-1 !text-slate-800">
                        {config.title}
                    </Title>
                    <Text type="secondary" className="text-sm">
                        {config.subtitle}
                    </Text>
                </div>

                {/* Notice banner if revision */}
                {task?.status === 'REVISION' && (
                    <Alert
                        type="warning"
                        showIcon
                        className="mb-4 rounded-lg border-amber-200 bg-amber-50/70"
                        message="Yêu cầu chỉnh sửa từ GVHD"
                        description={task.submissions?.[0]?.feedback || 'Vui lòng hoàn thiện lại các mục chưa đạt và nộp lại bản mới.'}
                    />
                )}

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    requiredMark="optional"
                >
                    {/* Render dynamic fields */}
                    {config.fields.map((f) => (
                        <Form.Item
                            key={f.name}
                            name={f.name}
                            label={
                                <span className="font-medium text-slate-700">
                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                </span>
                            }
                            rules={[{ required: f.required, message: `Vui lòng nhập ${f.label.toLowerCase()}` }]}
                            className="mb-4"
                        >
                            {f.type === 'textarea' ? (
                                <TextArea
                                    rows={f.rows || 3}
                                    placeholder={f.placeholder}
                                    className="rounded-lg text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500"
                                />
                            ) : f.type === 'number' ? (
                                <InputNumber
                                    min={f.min ?? 0}
                                    max={f.max ?? 100}
                                    addonAfter="%"
                                    placeholder={f.placeholder}
                                    className="w-full rounded-lg text-sm"
                                />
                            ) : (
                                <Input
                                    placeholder={f.placeholder}
                                    className="rounded-lg text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 h-10"
                                />
                            )}
                        </Form.Item>
                    ))}

                    <Divider className="my-5 border-slate-100" />

                    {/* File Attachment Upload */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-700">
                                Tệp đính kèm minh chứng {config.fileRequired && <span className="text-red-500">*</span>}
                            </span>
                            <span className="text-xs text-slate-400">Định dạng: PDF, DOCX, ZIP</span>
                        </div>

                        {uploadedFile ? (
                            <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                        <FilePdfOutlined className="text-xl" />
                                    </div>
                                    <div className="truncate">
                                        <div className="text-sm font-medium text-slate-800 truncate">{uploadedFile.name}</div>
                                        <a href={uploadedFile.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                            Xem tệp đã tải lên
                                        </a>
                                    </div>
                                </div>
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => setUploadedFile(null)}
                                    size="small"
                                >
                                    Xóa
                                </Button>
                            </div>
                        ) : (
                            <Upload.Dragger
                                name="file"
                                customRequest={handleCustomUpload}
                                showUploadList={false}
                                disabled={uploading}
                                className="!bg-slate-50/70 !border-dashed !border-slate-300 hover:!border-blue-400 rounded-xl p-4"
                            >
                                <p className="ant-upload-drag-icon text-blue-600 text-3xl mb-1">
                                    <UploadOutlined />
                                </p>
                                <p className="text-sm font-medium text-slate-700">
                                    {uploading ? 'Đang tải tệp lên...' : 'Nhấp hoặc kéo thả tệp vào đây để tải lên'}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">{config.fileHint}</p>
                            </Upload.Dragger>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <Button onClick={onClose} disabled={submitting} className="rounded-lg">
                            Hủy bỏ
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={submitting || uploading}
                            className="bg-[#0052a3] hover:bg-[#004080] rounded-lg px-6 font-medium shadow-sm"
                        >
                            Nộp biểu mẫu
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
