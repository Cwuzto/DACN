import React, { useState, useMemo } from 'react';
import {
    Button,
    Modal,
    Drawer,
    Alert,
    message,
    Tag,
    Radio,
    Input,
    Space,
    Divider,
    Tooltip,
    Table,
} from 'antd';
import {
    FileDoneOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FilePdfOutlined,
    EyeOutlined,
    PrinterOutlined,
    SafetyCertificateOutlined,
    AuditOutlined,
    CloseOutlined,
    ClockCircleOutlined,
    InfoCircleOutlined,
    CalendarOutlined,
    UserOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import evaluationService from '../../../services/evaluationService';
import meetingLogService from '../../../services/meetingLogService';
import CheckpointSignModal from '../CheckpointSignModal';
import AcademicFormPrintModal from '../../prints/AcademicFormPrintModal';
import BM03PrintSheet from '../../prints/BM03PrintSheet';
import BM04PrintSheet from '../../prints/BM04PrintSheet';
import { queryKeys } from '../../../query/queryKeys';
import { meetingKeys } from '../../../queries/meetingQueries';
import { checkpointKeys } from '../../../queries/checkpointQueries';
import { dashboardKeys } from '../../../queries/dashboardQueries';
import useAuthStore from '../../../stores/authStore';

/**
 * StudentProgressActions
 *
 * Quản lý tương tác tiến độ của sinh viên (BM03, Checkpoints, BM04):
 * 1. Tương tác BM03:
 *    - Xem nhật ký các buổi gặp hướng dẫn (BM03 meeting logs).
 *    - Ký xác nhận trong 48h (studentAcknowledgeBM03: ACKNOWLEDGED, ACKNOWLEDGED_WITH_COMMENT, DECLINED_TO_ACKNOWLEDGE).
 *    - In biểu mẫu BM03 (BM03PrintSheet) khi có dữ liệu.
 * 2. Mốc Checkpoint:
 *    - Ký biên bản checkpoint hoặc gửi giải trình/khiếu nại (CheckpointSignModal).
 * 3. BM04:
 *    - Chỉ cho xem / in PDF khi giảng viên hướng dẫn đã ký / hoàn tất (signedAt hoặc status === 'COMPLETED').
 *    - Tuyệt đối KHÔNG hiển thị điểm số / kết quả bảo vệ khi chưa công bố (isPublished: false).
 *    - Chặn mount bản in trắng khi chưa có dữ liệu.
 *
 * Tuân thủ Rule 2.1 (TopicRegistration), Rule 2.4 (UTF-8 no BOM), Rule 2.6 (Icon component prop).
 */
export default function StudentProgressActions({
    item,
    registration,
    sources = {},
    onCompleted,
}) {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const scope = queryKeys.scope(currentUser);

    const kind = item?.kind || item?.taskType || '';

    // Unpack sources with fallbacks
    const bm03Record = sources.bm03Record || null;
    const bm04Record = sources.bm04Record || null;
    const meetingLogs = sources.meetingLogs || [];
    const checkpoints = sources.checkpoints || [];

    // State for BM03 48h Student Acknowledgement
    const [bm03AckModalOpen, setBm03AckModalOpen] = useState(false);
    const [bm03AckAction, setBm03AckAction] = useState('ACKNOWLEDGED');
    const [bm03AckComment, setBm03AckComment] = useState('');
    const [ackSubmitting, setAckSubmitting] = useState(false);

    // State for BM03 Diary / Meeting Entries Drawer
    const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false);

    // State for Checkpoint Signing / Appeal Modal
    const [checkpointSignModalOpen, setCheckpointSignModalOpen] = useState(false);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);

    // State for BM04 Evaluation Viewer
    const [bm04ViewerOpen, setBm04ViewerOpen] = useState(false);
    const [resolvedBm04, setResolvedBm04] = useState(bm04Record);
    const [bm04Loading, setBm04Loading] = useState(false);

    // Print state (A4)
    const [printConfig, setPrintConfig] = useState({
        open: false,
        type: null,
        title: '',
        documentCode: '',
    });

    // Helper: active meeting logs sorted chronologically
    const activeMeetingLogs = useMemo(() => {
        const meetings = bm03Record?.meetings || bm03Record?.meetingEntries || [];
        const raw = meetings.length > 0 ? meetings : meetingLogs;
        return (raw || [])
            .filter((entry) => !entry?.supersededBy && !entry?.isSuperseded)
            .sort((a, b) => {
                const dateDiff = new Date(a?.meetingDate || 0) - new Date(b?.meetingDate || 0);
                if (dateDiff !== 0) return dateDiff;
                return (a?.id || 0) - (b?.id || 0);
            });
    }, [bm03Record, meetingLogs]);

    // Check BM03 48h status
    const isBm03AdvisorSigned = Boolean(bm03Record?.advisorSignedAt);
    const isBm03AckProcessed = [
        'ACKNOWLEDGED',
        'ACKNOWLEDGED_WITH_COMMENT',
        'DECLINED_TO_ACKNOWLEDGE',
        'ACKNOWLEDGEMENT_TIMEOUT',
    ].includes(bm03Record?.studentAckStatus);

    const isBm03AckPending =
        (kind === 'BM03_ACK' || bm03Record?.studentAckStatus === 'PENDING') &&
        isBm03AdvisorSigned &&
        !isBm03AckProcessed;

    // Check BM04 Signing & Completion status (SECURITY GUARD)
    const activeBm04 = resolvedBm04 || bm04Record;
    const isBm04Signed = Boolean(activeBm04?.signedAt || activeBm04?.status === 'COMPLETED');

    // Defense results publication check (immutable security rule)
    const isDefensePublished = Boolean(
        registration?.isDefenseResultPublished ||
        registration?.defenseResultPublished ||
        activeBm04?.isPublished ||
        registration?.status === 'COMPLETED' ||
        registration?.status === 'DEFENSE_PASSED'
    );

    // Central cache invalidation helper
    const handleSuccessCallback = async () => {
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) }),
                queryClient.invalidateQueries({ queryKey: dashboardKeys.studentDashboard(scope) }),
                queryClient.invalidateQueries({ queryKey: meetingKeys.all(scope) }),
                queryClient.invalidateQueries({ queryKey: checkpointKeys.all(scope) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.grading.all(scope) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.archives.all(scope) }),
            ]);
        } catch {
            // Non-critical cache cleanup failure
        }
        if (typeof onCompleted === 'function') {
            onCompleted();
        }
    };

    // Handler: Student acknowledges BM03 within 48h
    const handleStudentAckBM03 = async (actionToSubmit) => {
        const action = actionToSubmit || bm03AckAction;
        if (action === 'DECLINED_TO_ACKNOWLEDGE' && !bm03AckComment.trim()) {
            message.warning('Bắt buộc nhập lý do khi từ chối ký xác nhận.');
            return;
        }

        const recordId = bm03Record?.id || item?.bm03RecordId || item?.sourceId || registration?.id;
        if (!recordId) {
            message.error('Không tìm thấy mã hồ sơ BM03 để xác nhận.');
            return;
        }

        try {
            setAckSubmitting(true);
            const payload = {
                action,
                comment: bm03AckComment.trim() || undefined,
                studentNote: bm03AckComment.trim() || undefined,
            };

            const res = await evaluationService.studentAcknowledgeBM03(recordId, payload);
            if (res.success) {
                message.success('Đã gửi phản hồi xác nhận BM03 thành công!');
                setBm03AckModalOpen(false);
                setBm03AckComment('');
                await handleSuccessCallback();
            } else {
                message.error(res.message || 'Không thể gửi phản hồi xác nhận BM03.');
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra khi gửi phản hồi xác nhận BM03.');
        } finally {
            setAckSubmitting(false);
        }
    };

    // Handler: Open BM04 viewer safely
    const handleViewBM04 = async () => {
        if (!isBm04Signed) {
            message.warning('Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất.');
            return;
        }

        try {
            setBm04Loading(true);
            if (!activeBm04?.thesisFormatScore && registration?.id) {
                const res = await evaluationService.getBM04Record(registration.id);
                if (res.success && res.data) {
                    setResolvedBm04(res.data);
                }
            }
            setBm04ViewerOpen(true);
        } catch (error) {
            message.error(error?.message || 'Không thể tải Phiếu nhận xét BM04.');
        } finally {
            setBm04Loading(false);
        }
    };

    // Handler: Open BM04 print sheet safely
    const handleOpenBM04Print = () => {
        if (!isBm04Signed) {
            message.warning('Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất.');
            return;
        }
        if (!activeBm04) {
            message.warning('Chưa có dữ liệu BM04 để in.');
            return;
        }
        setPrintConfig({
            open: true,
            type: 'BM04',
            title: 'PHIẾU NHẬN XÉT KHÓA LUẬN TỐT NGHIỆP CỦA NGƯỜI HƯỚNG DẪN',
            documentCode: 'BM04',
        });
    };

    // Handler: Open BM03 print sheet safely
    const handleOpenBM03Print = () => {
        if (activeMeetingLogs.length === 0 && !bm03Record) {
            message.warning('Chưa có dữ liệu nhật ký tiến độ BM03 để in.');
            return;
        }
        setPrintConfig({
            open: true,
            type: 'BM03',
            title: 'PHIẾU THEO DÕI TIẾN ĐỘ THỰC HIỆN KHÓA LUẬN TỐT NGHIỆP',
            documentCode: 'BM03',
        });
    };

    // Handler: Open Checkpoint sign/appeal
    const handleOpenCheckpoint = (checkpointItem) => {
        const target = checkpointItem || (checkpoints && checkpoints[0]) || null;
        setSelectedCheckpoint(target);
        setCheckpointSignModalOpen(true);
    };

    return (
        <div className="student-progress-actions py-2" data-testid="student-progress-actions">
            {/* Action Bar */}
            <Space orientation="horizontal" size="small" wrap>
                {/* BM03 48h Ack Button */}
                {isBm03AckPending && (
                    <Button
                        type="primary"
                        icon={<FileDoneOutlined />}
                        onClick={() => setBm03AckModalOpen(true)}
                        className="bg-teal-700 hover:bg-teal-800"
                    >
                        Ký xác nhận BM03
                    </Button>
                )}

                {/* BM03 Meeting Log & Print Buttons */}
                <Button
                    icon={<EyeOutlined />}
                    onClick={() => setMeetingDrawerOpen(true)}
                >
                    Xem nhật ký tiến độ
                </Button>

                <Button
                    icon={<PrinterOutlined />}
                    onClick={handleOpenBM03Print}
                    disabled={activeMeetingLogs.length === 0 && !bm03Record}
                >
                    In biểu mẫu BM03
                </Button>

                {/* Checkpoint Signing or Appeal Button */}
                {(kind === 'CHECKPOINT_SUBMIT' || kind === 'CHECKPOINT_VIEW' || kind === 'BM03_APPEAL' || (checkpoints && checkpoints.length > 0)) && (
                    <Button
                        icon={kind === 'BM03_APPEAL' ? <AuditOutlined /> : <SafetyCertificateOutlined />}
                        onClick={() => handleOpenCheckpoint()}
                    >
                        {kind === 'BM03_APPEAL' ? 'Gửi giải trình checkpoint' : 'Ký biên bản checkpoint'}
                    </Button>
                )}

                {/* BM04 View & Print Buttons */}
                <Tooltip
                    title={
                        !isBm04Signed
                            ? 'Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất.'
                            : undefined
                    }
                >
                    <Button
                        icon={<EyeOutlined />}
                        onClick={handleViewBM04}
                        disabled={!isBm04Signed}
                        loading={bm04Loading}
                    >
                        Xem nhận xét BM04
                    </Button>
                </Tooltip>

                <Tooltip
                    title={
                        !isBm04Signed
                            ? 'Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất.'
                            : undefined
                    }
                >
                    <Button
                        icon={<PrinterOutlined />}
                        onClick={handleOpenBM04Print}
                        disabled={!isBm04Signed}
                    >
                        In biểu mẫu BM04
                    </Button>
                </Tooltip>
            </Space>

            {/* Modal Xác Nhận BM03 48 Giờ */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <FileDoneOutlined className="text-teal-700" />
                        <span>Xác Nhận Đã Biết Phiếu Theo Dõi Tiến Độ (BM03)</span>
                    </div>
                }
                open={bm03AckModalOpen}
                onCancel={() => setBm03AckModalOpen(false)}
                footer={null}
                width={640}
                destroyOnClose
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Thời hạn phản hồi: 48 giờ"
                        description={`Biểu mẫu BM03 đã được GVHD hoàn tất và ký số lúc ${
                            bm03Record?.advisorSignedAt
                                ? dayjs(bm03Record.advisorSignedAt).format('DD/MM/YYYY HH:mm')
                                : '---'
                        }. Sinh viên vui lòng đọc kỹ nội dung và chọn hình thức phản hồi dưới đây.`}
                    />

                    {bm03Record?.finalPdfFileUrl && (
                        <div>
                            <Button
                                type="link"
                                icon={<FilePdfOutlined />}
                                href={bm03Record.finalPdfFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0 text-teal-700"
                            >
                                Tải PDF BM03 để kiểm tra trước khi xác nhận
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="font-semibold block text-slate-800">
                            Lựa chọn phản hồi của sinh viên:
                        </label>
                        <Radio.Group
                            value={bm03AckAction}
                            onChange={(e) => setBm03AckAction(e.target.value)}
                            className="w-full space-y-2"
                        >
                            <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex items-start gap-2.5">
                                <Radio value="ACKNOWLEDGED" />
                                <div>
                                    <div className="font-bold text-slate-800">Ký xác nhận đã biết</div>
                                    <div className="text-xs text-slate-500">
                                        Đồng thuận và xác nhận đã biết đầy đủ kết quả theo dõi tiến độ BM03 của GVHD.
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex items-start gap-2.5">
                                <Radio value="ACKNOWLEDGED_WITH_COMMENT" />
                                <div>
                                    <div className="font-bold text-slate-800">Xác nhận kèm ý kiến</div>
                                    <div className="text-xs text-slate-500">
                                        Xác nhận đã biết và gửi thêm ý kiến phản hồi tới GVHD và Viện.
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 border rounded-lg hover:bg-rose-50 border-rose-200 cursor-pointer flex items-start gap-2.5">
                                <Radio value="DECLINED_TO_ACKNOWLEDGE" />
                                <div>
                                    <div className="font-bold text-rose-700">Từ chối ký</div>
                                    <div className="text-xs text-rose-600">
                                        Từ chối ký xác nhận (bắt buộc nhập lý do cụ thể để Viện xem xét).
                                    </div>
                                </div>
                            </div>
                        </Radio.Group>
                    </div>

                    {(bm03AckAction === 'ACKNOWLEDGED_WITH_COMMENT' || bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE') && (
                        <div className="space-y-1">
                            <label className="font-semibold block text-slate-800">
                                {bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE'
                                    ? 'Lý do từ chối ký (* bắt buộc):'
                                    : 'Ý kiến phản hồi bổ sung:'}
                            </label>
                            <Input.TextArea
                                rows={3}
                                value={bm03AckComment}
                                onChange={(e) => setBm03AckComment(e.target.value)}
                                placeholder={
                                    bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE'
                                        ? 'Nêu rõ lý do từ chối ký xác nhận...'
                                        : 'Nhập ý kiến của bạn...'
                                }
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button icon={<CloseOutlined />} onClick={() => setBm03AckModalOpen(false)}>
                            Đóng
                        </Button>
                        {bm03AckAction === 'ACKNOWLEDGED' && (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('ACKNOWLEDGED')}
                                className="bg-teal-700 hover:bg-teal-800"
                            >
                                Ký xác nhận đã biết
                            </Button>
                        )}
                        {bm03AckAction === 'ACKNOWLEDGED_WITH_COMMENT' && (
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('ACKNOWLEDGED_WITH_COMMENT')}
                                className="bg-teal-700 hover:bg-teal-800"
                            >
                                Xác nhận kèm ý kiến
                            </Button>
                        )}
                        {bm03AckAction === 'DECLINED_TO_ACKNOWLEDGE' && (
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                loading={ackSubmitting}
                                onClick={() => handleStudentAckBM03('DECLINED_TO_ACKNOWLEDGE')}
                            >
                                Từ chối ký
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Drawer Xem Nhật Ký Các Buổi Gặp BM03 */}
            <Drawer
                title="Nhật Ký Các Buổi Gặp Hướng Dẫn (BM03)"
                open={meetingDrawerOpen}
                onClose={() => setMeetingDrawerOpen(false)}
                width={720}
                extra={
                    <Button
                        size="small"
                        icon={<PrinterOutlined />}
                        onClick={handleOpenBM03Print}
                        disabled={activeMeetingLogs.length === 0 && !bm03Record}
                    >
                        In biểu mẫu
                    </Button>
                }
            >
                {activeMeetingLogs.length === 0 ? (
                    <Alert
                        type="info"
                        showIcon
                        message="Chưa có nhật ký buổi gặp"
                        description="Giảng viên hướng dẫn sẽ ghi nhận nội dung các buổi làm việc tiến độ vào hệ thống."
                    />
                ) : (
                    <div className="space-y-4">
                        <Table
                            dataSource={activeMeetingLogs}
                            rowKey={(record, index) => record.id || `meeting-${index}`}
                            pagination={false}
                            size="small"
                            columns={[
                                {
                                    title: 'Buổi',
                                    key: 'sessionNumber',
                                    width: 70,
                                    render: (_, r, idx) => `Buổi ${r.sessionNumber || idx + 1}`,
                                },
                                {
                                    title: 'Thời gian',
                                    key: 'meetingDate',
                                    width: 120,
                                    render: (_, r) =>
                                        r.meetingDate ? dayjs(r.meetingDate).format('DD/MM/YYYY') : '---',
                                },
                                {
                                    title: 'Nội dung trao đổi',
                                    dataIndex: 'content',
                                    key: 'content',
                                    render: (text) => text || '---',
                                },
                                {
                                    title: 'Nhiệm vụ sinh viên',
                                    dataIndex: 'studentTasks',
                                    key: 'studentTasks',
                                    render: (text) => text || '---',
                                },
                                {
                                    title: 'Trạng thái',
                                    key: 'status',
                                    width: 100,
                                    render: (_, r) => (
                                        <Tag color={r.advisorSignedAt ? 'success' : 'warning'}>
                                            {r.advisorSignedAt ? 'Đã ký số' : 'Chưa ký'}
                                        </Tag>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </Drawer>

            {/* Checkpoint Sign / Appeal Modal */}
            {checkpointSignModalOpen && selectedCheckpoint && (
                <CheckpointSignModal
                    open={checkpointSignModalOpen}
                    onClose={() => setCheckpointSignModalOpen(false)}
                    checkpointEvaluation={selectedCheckpoint}
                    currentStudentName={currentUser?.fullName || currentUser?.name || ''}
                    onSuccess={() => {
                        setCheckpointSignModalOpen(false);
                        handleSuccessCallback();
                    }}
                />
            )}

            {/* Modal Xem Phiếu Nhận Xét BM04 (Chỉ đọc & Đảm bảo bảo mật) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                        <SafetyCertificateOutlined className="text-teal-700" />
                        <span>Phiếu Nhận Xét Của Người Hướng Dẫn (BM04)</span>
                    </div>
                }
                open={bm04ViewerOpen}
                onCancel={() => setBm04ViewerOpen(false)}
                footer={
                    <div className="flex justify-between items-center w-full">
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={handleOpenBM04Print}
                            disabled={!isBm04Signed}
                        >
                            In biểu mẫu BM04
                        </Button>
                        <Button icon={<CloseOutlined />} onClick={() => setBm04ViewerOpen(false)}>
                            Đóng
                        </Button>
                    </div>
                }
                width={720}
                destroyOnClose
            >
                {activeBm04 && isBm04Signed ? (
                    <div className="space-y-4 pt-2">
                        <Alert
                            type="success"
                            showIcon
                            message="Phiếu nhận xét đã được GVHD ký duyệt điện tử"
                            description={`Ký số bởi: ${
                                activeBm04.lecturer?.fullName ||
                                activeBm04.advisorSignedBy?.fullName ||
                                activeBm04.lecturerSignature ||
                                'Giảng viên hướng dẫn'
                            } vào ngày ${
                                activeBm04.signedAt
                                    ? dayjs(activeBm04.signedAt).format('DD/MM/YYYY HH:mm')
                                    : '---'
                            }`}
                        />

                        <div className="p-4 bg-slate-50 rounded-xl space-y-3 text-sm text-slate-800 border border-slate-200">
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold text-slate-600">1. Hình thức khóa luận:</span>
                                <span className="font-bold text-slate-900">
                                    {activeBm04.thesisFormatScore ?? 'Đạt'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold text-slate-600">2. Nội dung nghiên cứu:</span>
                                <span className="font-bold text-slate-900">
                                    {activeBm04.researchContentScore ?? 'Đạt'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold text-slate-600">3. Tính ứng dụng thực tiễn:</span>
                                <span className="font-bold text-slate-900">
                                    {activeBm04.applicabilityScore ?? 'Đạt'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-semibold text-slate-600">4. Thái độ làm việc:</span>
                                <span className="font-bold text-slate-900">
                                    {activeBm04.attitudeScore ?? 'Đạt'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-bold text-slate-700">Kết luận của người hướng dẫn:</span>
                                <Tag
                                    color={
                                        activeBm04.conclusion === 'AGREED_FOR_DEFENSE'
                                            ? 'success'
                                            : 'error'
                                    }
                                    className="font-bold text-xs"
                                >
                                    {activeBm04.conclusion === 'AGREED_FOR_DEFENSE'
                                        ? 'Đồng ý cho bảo vệ'
                                        : 'Không đồng ý cho bảo vệ'}
                                </Tag>
                            </div>
                        </div>

                        {/* TUYỆT ĐỐI KHÔNG HIỂN THỊ ĐIỂM BẢO VỆ NẾU CHƯA CÔNG BỐ */}
                        {!isDefensePublished && (
                            <p className="text-xs text-slate-500 italic">
                                * Điểm đánh giá chi tiết của hội đồng bảo vệ sẽ hiển thị sau khi Viện công bố kết quả chính thức.
                            </p>
                        )}
                    </div>
                ) : (
                    <Alert
                        type="warning"
                        showIcon
                        message="Chưa có dữ liệu BM04 đã ký"
                        description="Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất."
                    />
                )}
            </Modal>

            {/* Academic Form Print Modal (Chỉ mount khi có dữ liệu và đã ký) */}
            {printConfig.open && (
                <AcademicFormPrintModal
                    open={printConfig.open}
                    onClose={() =>
                        setPrintConfig({ open: false, type: null, title: '', documentCode: '' })
                    }
                    title={printConfig.title}
                    documentCode={printConfig.documentCode}
                >
                    {printConfig.type === 'BM03' && (activeMeetingLogs.length > 0 || bm03Record) && (
                        <BM03PrintSheet
                            meetingLogs={activeMeetingLogs}
                            checkpoints={checkpoints}
                            registration={registration}
                            bm03Record={bm03Record}
                        />
                    )}
                    {printConfig.type === 'BM04' && isBm04Signed && activeBm04 && (
                        <BM04PrintSheet
                            evaluation={activeBm04}
                            registration={registration}
                        />
                    )}
                </AcademicFormPrintModal>
            )}
        </div>
    );
}
