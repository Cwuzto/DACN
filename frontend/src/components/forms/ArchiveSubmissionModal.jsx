import React, { useState, useEffect } from 'react';
import {
    Modal,
    Form,
    Input,
    Button,
    Upload,
    Alert,
    Typography,
    Space,
    Flex,
    Tag,
    Divider,
    message,
    Spin,
} from 'antd';
import {
    CloudUploadOutlined,
    FilePdfOutlined,
    FilePptOutlined,
    GithubOutlined,
    LinkOutlined,
    PaperClipOutlined,
    VideoCameraOutlined,
    YoutubeOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import uploadService from '../../services/uploadService';
import archiveService from '../../services/archiveService';

const { Text, Title, Paragraph } = Typography;

export default function ArchiveSubmissionModal({
    visible,
    onClose,
    registration,
    initialArchive = null,
    onSuccess,
}) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [uploadingReport, setUploadingReport] = useState(false);
    const [uploadingSlide, setUploadingSlide] = useState(false);

    const [reportFile, setReportFile] = useState(null);
    const [slideFile, setSlideFile] = useState(null);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            if (initialArchive) {
                form.setFieldsValue({
                    sourceCodeUrl: initialArchive.sourceCodeUrl || '',
                    demoVideoUrl: initialArchive.demoVideoUrl || '',
                    summary: initialArchive.summary || '',
                });
                if (initialArchive.reportFileUrl) {
                    setReportFile({
                        url: initialArchive.reportFileUrl,
                        name: initialArchive.reportFileName || 'BaoCao_ThuyetMinh_HoanThien.pdf',
                    });
                } else {
                    setReportFile(null);
                }
                if (initialArchive.slideFileUrl) {
                    setSlideFile({
                        url: initialArchive.slideFileUrl,
                        name: initialArchive.slideFileName || 'Slide_BaoVe.pptx',
                    });
                } else {
                    setSlideFile(null);
                }
            } else {
                setReportFile(null);
                setSlideFile(null);
            }
        }
    }, [visible, initialArchive]);

    const handleUploadReport = async (file) => {
        try {
            setUploadingReport(true);
            const res = await uploadService.uploadFile(file, 'archives');
            const fileUrl = res?.data?.url || res?.url || '';
            setReportFile({
                url: fileUrl,
                name: file.name,
            });
            message.success(`Đã tải lên tệp báo cáo: ${file.name}`);
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tải tệp báo cáo lên');
        } finally {
            setUploadingReport(false);
        }
        return false;
    };

    const handleUploadSlide = async (file) => {
        try {
            setUploadingSlide(true);
            const res = await uploadService.uploadFile(file, 'archives');
            const fileUrl = res?.data?.url || res?.url || '';
            setSlideFile({
                url: fileUrl,
                name: file.name,
            });
            message.success(`Đã tải lên tệp slide: ${file.name}`);
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tải tệp slide lên');
        } finally {
            setUploadingSlide(false);
        }
        return false;
    };

    const handleSubmit = async (values) => {
        if (!registration?.id) return;

        if (!reportFile?.url && !values.sourceCodeUrl && !values.demoVideoUrl) {
            message.warning('Vui lòng cung cấp ít nhất tệp báo cáo, link mã nguồn hoặc link video demo.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                reportFileUrl: reportFile?.url || null,
                reportFileName: reportFile?.name || null,
                slideFileUrl: slideFile?.url || null,
                slideFileName: slideFile?.name || null,
                sourceCodeUrl: values.sourceCodeUrl?.trim() || null,
                demoVideoUrl: values.demoVideoUrl?.trim() || null,
                summary: values.summary?.trim() || null,
            };

            const res = await archiveService.submitArchive(registration.id, payload);
            if (res.success) {
                message.success('Đã nộp hồ sơ lưu chiểu thành công!');
                onSuccess && onSuccess(res.data);
                onClose && onClose();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể nộp hồ sơ lưu chiểu');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            width={720}
            title={(
                <Flex align="center" gap={10}>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CloudUploadOutlined className="text-lg" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 text-base">Nộp Hồ Sơ Lưu Chiểu Đồ Án Toàn Khóa</div>
                        <div className="text-xs text-slate-500 font-normal">Hồ sơ nghiệm thu chính thức sau khi bảo vệ đồ án tốt nghiệp</div>
                    </div>
                </Flex>
            )}
            footer={null}
            destroyOnClose
        >
            <div className="space-y-4 my-2">
                {/* Topic info box */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="font-semibold text-slate-700">Đề tài:</span>
                        <span className="font-bold text-slate-900">{registration?.topic?.title || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="text-slate-500">GVHD:</span>
                        <span className="font-medium text-slate-800">{registration?.topic?.mentor?.fullName || 'Chưa cập nhật'}</span>
                    </div>
                    {registration?.defenseResult?.finalScore && (
                        <div className="flex justify-between items-center flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500">Điểm bảo vệ chính thức:</span>
                            <Tag color="green" className="font-bold text-xs">
                                {Number(registration.defenseResult.finalScore).toFixed(2)}/10 (ĐẠT)
                            </Tag>
                        </div>
                    )}
                </div>

                <Alert
                    type="info"
                    showIcon
                    message="Quy định nộp lưu chiểu"
                    description="Vui lòng nộp bản Báo cáo toàn văn đã chỉnh sửa theo góp ý của Hội đồng, bản Slide trình bày, link Video demo (Google Drive hoặc YouTube) và link kho Mã nguồn để phục vụ công tác lưu trữ học vụ."
                />

                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {/* Row 1: File Báo cáo & File Slide */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                                    <FilePdfOutlined className="text-rose-500" />
                                    Báo cáo Thuyết minh (PDF/Word)
                                </span>
                                <span className="text-[11px] text-slate-400">Tối đa 50MB</span>
                            </div>
                            {reportFile ? (
                                <div className="flex items-center justify-between p-2 bg-rose-50/50 border border-rose-200 rounded-lg text-xs">
                                    <div className="truncate max-w-[200px] text-rose-700 font-medium">
                                        {reportFile.name}
                                    </div>
                                    <Button size="small" type="link" danger onClick={() => setReportFile(null)}>
                                        Đổi tệp
                                    </Button>
                                </div>
                            ) : (
                                <Upload
                                    beforeUpload={handleUploadReport}
                                    showUploadList={false}
                                    accept=".pdf,.doc,.docx"
                                >
                                    <Button
                                        icon={<PaperClipOutlined />}
                                        loading={uploadingReport}
                                        className="w-full text-xs"
                                    >
                                        Tải lên tệp báo cáo
                                    </Button>
                                </Upload>
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                                    <FilePptOutlined className="text-amber-500" />
                                    Slide Thuyết trình (PPTX/PDF)
                                </span>
                                <span className="text-[11px] text-slate-400">Tối đa 50MB</span>
                            </div>
                            {slideFile ? (
                                <div className="flex items-center justify-between p-2 bg-amber-50/50 border border-amber-200 rounded-lg text-xs">
                                    <div className="truncate max-w-[200px] text-amber-700 font-medium">
                                        {slideFile.name}
                                    </div>
                                    <Button size="small" type="link" danger onClick={() => setSlideFile(null)}>
                                        Đổi tệp
                                    </Button>
                                </div>
                            ) : (
                                <Upload
                                    beforeUpload={handleUploadSlide}
                                    showUploadList={false}
                                    accept=".pptx,.ppt,.pdf"
                                >
                                    <Button
                                        icon={<PaperClipOutlined />}
                                        loading={uploadingSlide}
                                        className="w-full text-xs"
                                    >
                                        Tải lên tệp slide
                                    </Button>
                                </Upload>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Link Video Demo & Link Source Code */}
                    <Form.Item
                        name="demoVideoUrl"
                        label={(
                            <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                                <YoutubeOutlined className="text-red-500 text-sm" />
                                Link Video Demo Sản phẩm (Google Drive hoặc YouTube)
                            </span>
                        )}
                        extra="Dán liên kết xem video demo sản phẩm (đảm bảo đã mở quyền xem công khai hoặc trong trường)."
                        rules={[
                            {
                                pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|drive\.google\.com|vimeo\.com)\/.+$/,
                                message: 'Vui lòng nhập đường link Google Drive, YouTube hoặc video hợp lệ.',
                            },
                        ]}
                    >
                        <Input
                            prefix={<VideoCameraOutlined className="text-slate-400" />}
                            placeholder="https://youtube.com/watch?v=... hoặc https://drive.google.com/file/d/..."
                        />
                    </Form.Item>

                    <Form.Item
                        name="sourceCodeUrl"
                        label={(
                            <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                                <GithubOutlined className="text-slate-700 text-sm" />
                                Link Kho Mã Nguồn & Hướng dẫn cài đặt (GitHub / GitLab / Drive)
                            </span>
                        )}
                        extra="Kho lưu trữ mã nguồn hoàn thiện của đề tài."
                    >
                        <Input
                            prefix={<LinkOutlined className="text-slate-400" />}
                            placeholder="https://github.com/username/repository hoặc link Google Drive"
                        />
                    </Form.Item>

                    <Form.Item
                        name="summary"
                        label="Tóm tắt kết quả đề tài & Đóng góp mới (Tùy chọn)"
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Tóm tắt ngắn gọn các công nghệ sử dụng, kiến trúc hệ thống, kết quả kiểm thử và đóng góp thực tiễn của đề tài..."
                        />
                    </Form.Item>

                    <Flex justify="flex-end" gap={12} style={{ marginTop: 16 }}>
                        <Button onClick={onClose}>Đóng</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={submitting}
                            icon={<CloudUploadOutlined />}
                            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                        >
                            Xác Nhận Nộp Hồ Sơ Lưu Chiểu
                        </Button>
                    </Flex>
                </Form>
            </div>
        </Modal>
    );
}
