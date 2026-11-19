import React, { useState, useEffect, useMemo } from 'react';
import {
    Button,
    Modal,
    Alert,
    message,
    Tag,
    Input,
    Space,
    Divider,
    Tooltip,
    Descriptions,
} from 'antd';
import {
    UploadOutlined,
    CloudUploadOutlined,
    SafetyCertificateOutlined,
    EyeOutlined,
    DownloadOutlined,
    CloseOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FilePptOutlined,
    VideoCameraOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import archiveService from '../../../services/archiveService';
import ArchiveSubmissionModal from '../../forms/ArchiveSubmissionModal';
import ClearanceCertificateModal from '../../forms/ClearanceCertificateModal';
import { queryKeys } from '../../../query/queryKeys';
import { dashboardKeys } from '../../../queries/dashboardQueries';
import useAuthStore from '../../../stores/authStore';

/**
 * StudentArchiveActions
 *
 * Quản lý các tương tác lưu chiểu của sinh viên:
 * 1. Hồ sơ sơ bộ trước bảo vệ (Pre-Defense Archive Dossier):
 *    - Gọi archiveService.submitPreDefenseArchive.
 *    - Nộp bản thảo báo cáo, slide thuyết trình, mã nguồn, ghi chú.
 * 2. Bốn tệp nộp lưu chiểu sau bảo vệ (Final Archive Dossier):
 *    - Gọi archiveService.submitFinalArchive.
 *    - 4 tệp: Báo cáo hoàn chỉnh PDF, Source code zip/link, Slide thuyết trình, Video demo/tài liệu kèm theo.
 *    - Hỗ trợ mở ArchiveSubmissionModal để upload chuyên sâu từng slot.
 * 3. Tình trạng tiếp nhận & Giấy biên nhận điện tử / Giấy xác nhận hoàn thành đồ án:
 *    - Hiển thị phản hồi nghiệm thu của GVHD và Giáo vụ.
 *    - Mở ClearanceCertificateModal khi Viện đã ký xác nhận.
 *
 * Tuân thủ Rule 2.1 (TopicRegistration), Rule 2.4 (UTF-8 no BOM), Rule 2.6 (Icon component prop).
 */
export default function StudentArchiveActions({
    item,
    registration,
    sources = {},
    onCompleted,
}) {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const scope = queryKeys.scope(currentUser);

    const kind = item?.kind || item?.taskType || '';

    // Unpack sources
    const archiveData = sources.archive || sources.preDefenseArchive || null;
    const dossierData = sources.dossier || null;
    const certificateData = sources.certificate || null;

    // Modal states
    const [preDefenseModalOpen, setPreDefenseModalOpen] = useState(false);
    const [finalArchiveModalOpen, setFinalArchiveModalOpen] = useState(false);
    const [archiveDetailModalOpen, setArchiveDetailModalOpen] = useState(false);
    const [certificateModalOpen, setCertificateModalOpen] = useState(false);
    const [submissionModalOpen, setSubmissionModalOpen] = useState(false);

    // Pre-defense form state
    const [reportFileUrl, setReportFileUrl] = useState('');
    const [reportFileName, setReportFileName] = useState('');
    const [slideFileUrl, setSlideFileUrl] = useState('');
    const [slideFileName, setSlideFileName] = useState('');
    const [sourceCodeUrl, setSourceCodeUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [submittingPreDefense, setSubmittingPreDefense] = useState(false);

    // Final archive form state
    const [finalReportFileUrl, setFinalReportFileUrl] = useState('');
    const [finalReportFileName, setFinalReportFileName] = useState('');
    const [finalSlideFileUrl, setFinalSlideFileUrl] = useState('');
    const [finalSlideFileName, setFinalSlideFileName] = useState('');
    const [finalSourceCodeUrl, setFinalSourceCodeUrl] = useState('');
    const [finalDemoVideoUrl, setFinalDemoVideoUrl] = useState('');
    const [finalNotes, setFinalNotes] = useState('');
    const [submittingFinalArchive, setSubmittingFinalArchive] = useState(false);

    // Active records
    const [resolvedArchive, setResolvedArchive] = useState(archiveData);
    const [resolvedCertificate, setResolvedCertificate] = useState(certificateData);

    // Pre-fill form values when sources change
    useEffect(() => {
        const sourceArchive = archiveData || registration?.archive || null;
        if (sourceArchive) {
            setReportFileUrl(sourceArchive.reportFileUrl || '');
            setReportFileName(sourceArchive.reportFileName || '');
            setSlideFileUrl(sourceArchive.slideFileUrl || '');
            setSlideFileName(sourceArchive.slideFileName || '');
            setSourceCodeUrl(sourceArchive.sourceCodeUrl || '');
            setNotes(sourceArchive.summary || sourceArchive.notes || '');

            setFinalReportFileUrl(sourceArchive.reportFileUrl || '');
            setFinalReportFileName(sourceArchive.reportFileName || '');
            setFinalSlideFileUrl(sourceArchive.slideFileUrl || '');
            setFinalSlideFileName(sourceArchive.slideFileName || '');
            setFinalSourceCodeUrl(sourceArchive.sourceCodeUrl || '');
            setFinalDemoVideoUrl(sourceArchive.demoVideoUrl || '');
            setFinalNotes(sourceArchive.summary || sourceArchive.notes || '');
            setResolvedArchive(sourceArchive);
        }
    }, [archiveData, registration]);

    // Check pre-defense eligibility
    const isPreDefenseEligible =
        kind === 'PRE_DEFENSE_SUBMIT' ||
        kind === 'PRE_DEFENSE' ||
        ['BM03_PASSED', 'BM04_REVIEW', 'DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE'].includes(
            registration?.status
        );

    // Check final archive eligibility
    const isFinalArchiveEligible =
        kind === 'SUBMIT_ARCHIVE' ||
        kind === 'ARCHIVE' ||
        kind === 'ARCHIVE_VIEW' ||
        kind === 'ARCHIVE_SUBMISSION' ||
        ['DEFENDED', 'DEFENSE_PASSED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'PENDING_INSTITUTE_SIGNATURE', 'COMPLETED'].includes(
            registration?.status
        );

    // Check completion & clearance certificate
    const isCompletedOrHasCertificate =
        registration?.status === 'COMPLETED' ||
        resolvedArchive?.status === 'APPROVED' ||
        Boolean(resolvedCertificate) ||
        kind === 'VIEW_GRADES_CERTIFICATE';

    // Central cache invalidation helper
    const handleSuccessCallback = async () => {
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) }),
                queryClient.invalidateQueries({ queryKey: dashboardKeys.studentDashboard(scope) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.archives.all(scope) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.archives.dossier(scope, registration?.id) }),
            ]);
        } catch {
            // Non-critical cache cleanup failure
        }
        if (typeof onCompleted === 'function') {
            onCompleted();
        }
    };

    // Handler: Submit pre-defense archive dossier
    const handleSubmitPreDefense = async () => {
        if (!reportFileUrl && !slideFileUrl && !sourceCodeUrl) {
            message.warning('Vui lòng cung cấp ít nhất link bản thảo báo cáo, slide thuyết trình hoặc link mã nguồn.');
            return;
        }

        const regId = registration?.id;
        if (!regId) {
            message.error('Không tìm thấy thông tin đăng ký đề tài.');
            return;
        }

        try {
            setSubmittingPreDefense(true);
            const payload = {
                reportFileUrl: reportFileUrl.trim() || null,
                reportFileName: reportFileName.trim() || (reportFileUrl ? 'Bản thảo báo cáo khóa luận' : null),
                slideFileUrl: slideFileUrl.trim() || null,
                slideFileName: slideFileName.trim() || (slideFileUrl ? 'Slide thuyết trình bảo vệ' : null),
                sourceCodeUrl: sourceCodeUrl.trim() || null,
                notes: notes.trim() || null,
                summary: notes.trim() || null,
            };

            const res = await archiveService.submitPreDefenseArchive(regId, payload);
            if (res.success) {
                message.success('Nộp tài liệu sơ bộ trước bảo vệ thành công! GVHD đã có thể đánh giá và ký duyệt Phiếu nhận xét.');
                setPreDefenseModalOpen(false);
                setResolvedArchive(res.data?.archive || res.data || payload);
                await handleSuccessCallback();
            } else {
                message.error(res.message || 'Không thể nộp tài liệu lưu chiểu sơ bộ.');
            }
        } catch (error) {
            message.error(error?.message || 'Đã xảy ra lỗi khi nộp tài liệu trước bảo vệ.');
        } finally {
            setSubmittingPreDefense(false);
        }
    };

    // Handler: Submit 4 final archive files
    const handleSubmitFinalArchive = async () => {
        if (!finalReportFileUrl && !finalSourceCodeUrl) {
            message.warning('Báo cáo hoàn chỉnh và mã nguồn là bắt buộc để nộp lưu chiểu.');
            return;
        }

        const regId = registration?.id;
        if (!regId) {
            message.error('Không tìm thấy thông tin đăng ký đề tài.');
            return;
        }

        try {
            setSubmittingFinalArchive(true);
            const payload = {
                reportFileUrl: finalReportFileUrl.trim() || null,
                reportFileName: finalReportFileName.trim() || 'Báo cáo khóa luận tốt nghiệp hoàn chỉnh.pdf',
                slideFileUrl: finalSlideFileUrl.trim() || null,
                slideFileName: finalSlideFileName.trim() || (finalSlideFileUrl ? 'Slide thuyết trình bảo vệ.pptx' : null),
                sourceCodeUrl: finalSourceCodeUrl.trim() || null,
                demoVideoUrl: finalDemoVideoUrl.trim() || null,
                notes: finalNotes.trim() || null,
                summary: finalNotes.trim() || null,
            };

            const res = await archiveService.submitFinalArchive(regId, payload);
            if (res.success) {
                message.success('Nộp hồ sơ lưu chiểu thành công! Chờ GVHD và Giáo vụ nghiệm thu.');
                setFinalArchiveModalOpen(false);
                setResolvedArchive(res.data?.archive || res.data || payload);
                await handleSuccessCallback();
            } else {
                message.error(res.message || 'Không thể nộp hồ sơ lưu chiểu.');
            }
        } catch (error) {
            message.error(error?.message || 'Đã xảy ra lỗi khi nộp hồ sơ lưu chiểu.');
        } finally {
            setSubmittingFinalArchive(false);
        }
    };

    // Handler: Fetch & open Clearance Certificate modal
    const handleViewCertificate = async () => {
        try {
            let cert = resolvedCertificate;
            if (!cert && registration?.id) {
                const res = await archiveService.getClearanceCertificate(registration.id);
                if (res.success && res.data) {
                    cert = res.data;
                    setResolvedCertificate(cert);
                }
            }
            if (cert) {
                setCertificateModalOpen(true);
            } else {
                message.info('Giấy xác nhận hoàn thành đang được Viện xử lý.');
            }
        } catch (error) {
            message.error(error?.message || 'Không thể lấy thông tin Giấy xác nhận hoàn thành.');
        }
    };

    return (
        <div className="student-archive-actions py-2" data-testid="student-archive-actions">
            {/* Action Bar */}
            <Space orientation="horizontal" size="small" wrap>
                {/* Pre-Defense Archive Submission Button */}
                {isPreDefenseEligible && (
                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => setPreDefenseModalOpen(true)}
                        className="bg-teal-700 hover:bg-teal-800"
                    >
                        Nộp hồ sơ sơ bộ
                    </Button>
                )}

                {/* Final Archive Submission Buttons */}
                {isFinalArchiveEligible && (
                    <>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={() => setFinalArchiveModalOpen(true)}
                            className="bg-teal-700 hover:bg-teal-800"
                        >
                            Nộp hồ sơ lưu chiểu
                        </Button>
                        <Button
                            icon={<CloudUploadOutlined />}
                            onClick={() => setSubmissionModalOpen(true)}
                        >
                            Cổng nộp 4 tệp chi tiết
                        </Button>
                    </>
                )}

                {/* Status and Details View */}
                {resolvedArchive && (
                    <Button
                        icon={<EyeOutlined />}
                        onClick={() => setArchiveDetailModalOpen(true)}
                    >
                        Xem tình trạng lưu chiểu
                    </Button>
                )}

                {/* Clearance Certificate View Button */}
                {isCompletedOrHasCertificate && (
                    <Button
                        icon={<SafetyCertificateOutlined />}
                        onClick={handleViewCertificate}
                        className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    >
                        Xem giấy xác nhận hoàn thành
                    </Button>
                )}
            </Space>

            {/* Modal Nộp Hồ Sơ Sơ Bộ Trước Bảo Vệ */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                        <UploadOutlined className="text-teal-700" />
                        <span>Nộp Hồ Sơ Sơ Bộ Trước Bảo Vệ</span>
                    </div>
                }
                open={preDefenseModalOpen}
                onCancel={() => setPreDefenseModalOpen(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button icon={<CloseOutlined />} onClick={() => setPreDefenseModalOpen(false)}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            loading={submittingPreDefense}
                            onClick={handleSubmitPreDefense}
                            className="bg-teal-700 hover:bg-teal-800"
                        >
                            Gửi hồ sơ sơ bộ
                        </Button>
                    </div>
                }
                width={680}
                destroyOnClose
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Yêu cầu nộp tài liệu trước bảo vệ"
                        description="Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt Phiếu nhận xét (BM04)."
                    />

                    <div className="space-y-3">
                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                Link bản thảo báo cáo khóa luận (Word hoặc PDF):
                            </label>
                            <Input
                                placeholder="https://drive.google.com/... hoặc đường dẫn tài liệu"
                                value={reportFileUrl}
                                onChange={(e) => setReportFileUrl(e.target.value)}
                                prefix={<FileWordOutlined className="text-slate-400" />}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                Link slide thuyết trình bảo vệ (PowerPoint / PDF):
                            </label>
                            <Input
                                placeholder="https://drive.google.com/... hoặc slide thuyết trình"
                                value={slideFileUrl}
                                onChange={(e) => setSlideFileUrl(e.target.value)}
                                prefix={<FilePptOutlined className="text-slate-400" />}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                Link mã nguồn dự án (GitHub / GitLab / Drive):
                            </label>
                            <Input
                                placeholder="https://github.com/..."
                                value={sourceCodeUrl}
                                onChange={(e) => setSourceCodeUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                Ghi chú / Tóm tắt nội dung gửi GVHD:
                            </label>
                            <Input.TextArea
                                rows={3}
                                placeholder="Tóm tắt các điểm chính đã hoàn thiện..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Nộp 4 Tệp Lưu Chiểu Sau Bảo Vệ */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                        <CloudUploadOutlined className="text-teal-700" />
                        <span>Nộp Hồ Sơ Lưu Chiểu Đồ Án Tốt Nghiệp (4 Tệp Bắt Buộc)</span>
                    </div>
                }
                open={finalArchiveModalOpen}
                onCancel={() => setFinalArchiveModalOpen(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button icon={<CloseOutlined />} onClick={() => setFinalArchiveModalOpen(false)}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            loading={submittingFinalArchive}
                            onClick={handleSubmitFinalArchive}
                            className="bg-teal-700 hover:bg-teal-800"
                        >
                            Gửi hồ sơ lưu chiểu
                        </Button>
                    </div>
                }
                width={720}
                destroyOnClose
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type="warning"
                        showIcon
                        message="Lưu ý nộp lưu chiểu chính thức"
                        description="Hồ sơ lưu chiểu gồm 4 thành phần: Báo cáo toàn văn PDF, Slide thuyết trình, Mã nguồn hoàn chỉnh và Video demo sản phẩm. Sau khi nộp, hồ sơ sẽ được GVHD và Giáo vụ thẩm định trước khi cấp Giấy xác nhận hoàn thành."
                    />

                    <div className="space-y-3">
                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                1. Báo cáo toàn văn hoàn chỉnh (PDF / Word) (* bắt buộc):
                            </label>
                            <Input
                                placeholder="Link tệp báo cáo hoàn chỉnh (PDF/Word)"
                                value={finalReportFileUrl}
                                onChange={(e) => setFinalReportFileUrl(e.target.value)}
                                prefix={<FilePdfOutlined className="text-rose-500" />}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                2. Mã nguồn toàn bộ hệ thống (GitHub / Zip link) (* bắt buộc):
                            </label>
                            <Input
                                placeholder="Link kho mã nguồn hoặc tệp nén"
                                value={finalSourceCodeUrl}
                                onChange={(e) => setFinalSourceCodeUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                3. Slide báo cáo bảo vệ trước Hội đồng:
                            </label>
                            <Input
                                placeholder="Link slide thuyết trình (PPTX/PDF)"
                                value={finalSlideFileUrl}
                                onChange={(e) => setFinalSlideFileUrl(e.target.value)}
                                prefix={<FilePptOutlined className="text-amber-500" />}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                4. Video demo vận hành sản phẩm thực tế:
                            </label>
                            <Input
                                placeholder="Link video demo (YouTube / Drive / MP4)"
                                value={finalDemoVideoUrl}
                                onChange={(e) => setFinalDemoVideoUrl(e.target.value)}
                                prefix={<VideoCameraOutlined className="text-purple-500" />}
                            />
                        </div>

                        <div>
                            <label className="font-semibold block text-slate-800 mb-1">
                                Tóm tắt kết quả và ghi chú bổ sung:
                            </label>
                            <Input.TextArea
                                rows={2}
                                placeholder="Ghi chú thêm về hồ sơ nộp lưu chiểu..."
                                value={finalNotes}
                                onChange={(e) => setFinalNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Xem Tình Trạng Tiếp Nhận Lưu Chiểu */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                        <EyeOutlined className="text-teal-700" />
                        <span>Tình Trạng Tiếp Nhận Hồ Sơ Lưu Chiểu</span>
                    </div>
                }
                open={archiveDetailModalOpen}
                onCancel={() => setArchiveDetailModalOpen(false)}
                footer={
                    <div className="flex justify-between items-center w-full">
                        {isCompletedOrHasCertificate && (
                            <Button
                                icon={<SafetyCertificateOutlined />}
                                onClick={handleViewCertificate}
                                className="border-emerald-600 text-emerald-700"
                            >
                                Xem giấy xác nhận
                            </Button>
                        )}
                        <Button icon={<CloseOutlined />} onClick={() => setArchiveDetailModalOpen(false)}>
                            Đóng
                        </Button>
                    </div>
                }
                width={700}
                destroyOnClose
            >
                {resolvedArchive ? (
                    <div className="space-y-4 pt-2">
                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="Trạng thái hồ sơ">
                                <Tag
                                    color={
                                        resolvedArchive.status === 'APPROVED' || resolvedArchive.status === 'COMPLETED'
                                            ? 'success'
                                            : resolvedArchive.status === 'REVISION_REQUIRED' || resolvedArchive.status === 'ARCHIVE_REJECTED'
                                            ? 'error'
                                            : 'processing'
                                    }
                                    className="font-bold"
                                >
                                    {resolvedArchive.status || 'SUBMITTED'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Báo cáo toàn văn">
                                {resolvedArchive.reportFileUrl ? (
                                    <a href={resolvedArchive.reportFileUrl} target="_blank" rel="noopener noreferrer">
                                        {resolvedArchive.reportFileName || 'Xem tệp báo cáo'}
                                    </a>
                                ) : (
                                    'Chưa nộp'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Slide thuyết trình">
                                {resolvedArchive.slideFileUrl ? (
                                    <a href={resolvedArchive.slideFileUrl} target="_blank" rel="noopener noreferrer">
                                        {resolvedArchive.slideFileName || 'Xem slide'}
                                    </a>
                                ) : (
                                    'Chưa nộp'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mã nguồn đề tài">
                                {resolvedArchive.sourceCodeUrl ? (
                                    <a href={resolvedArchive.sourceCodeUrl} target="_blank" rel="noopener noreferrer">
                                        {resolvedArchive.sourceCodeUrl}
                                    </a>
                                ) : (
                                    'Chưa nộp'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Video demo">
                                {resolvedArchive.demoVideoUrl ? (
                                    <a href={resolvedArchive.demoVideoUrl} target="_blank" rel="noopener noreferrer">
                                        {resolvedArchive.demoVideoUrl}
                                    </a>
                                ) : (
                                    'Chưa nộp'
                                )}
                            </Descriptions.Item>
                            {resolvedArchive.advisorFeedback && (
                                <Descriptions.Item label="Nhận xét của GVHD">
                                    <span className="text-slate-800">{resolvedArchive.advisorFeedback}</span>
                                </Descriptions.Item>
                            )}
                            {resolvedArchive.academicAffairsFeedback && (
                                <Descriptions.Item label="Nhận xét của Giáo vụ">
                                    <span className="text-slate-800">{resolvedArchive.academicAffairsFeedback}</span>
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </div>
                ) : (
                    <Alert
                        type="info"
                        showIcon
                        message="Chưa có dữ liệu hồ sơ lưu chiểu"
                        description="Hồ sơ lưu chiểu sẽ hiển thị chi tiết sau khi sinh viên gửi các tệp báo cáo."
                    />
                )}
            </Modal>

            {/* Modal Nộp Chi Tiết Qua Cổng 4 Tệp (ArchiveSubmissionModal) */}
            <ArchiveSubmissionModal
                open={submissionModalOpen}
                onClose={() => setSubmissionModalOpen(false)}
                registration={registration}
                registrationId={registration?.id}
                onSuccess={() => {
                    setSubmissionModalOpen(false);
                    handleSuccessCallback();
                }}
            />

            {/* Modal Giấy Xác Nhận Hoàn Thành Đồ Án (ClearanceCertificateModal) */}
            {certificateModalOpen && (
                <ClearanceCertificateModal
                    open={certificateModalOpen}
                    onClose={() => setCertificateModalOpen(false)}
                    certificateData={resolvedCertificate}
                    certificate={resolvedCertificate}
                />
            )}
        </div>
    );
}
