import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table,
    Select,
    Input,
    Button,
    Tag,
    Modal,
    Drawer,
    DatePicker,
    Popconfirm,
    Space,
    Tooltip,
    Radio,
    Alert,
    message,
    Spin,
} from 'antd';
import {
    CalendarOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    EditOutlined,
    SaveOutlined,
    SendOutlined,
    RollbackOutlined,
    FileTextOutlined,
    LinkOutlined,
    UserOutlined,
    AuditOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import councilService from '../../../services/councilService';
import useAuthStore from '../../../stores/authStore';

const INITIAL_OUTCOME_OPTIONS = [
    { label: 'Đạt (PASS)', value: 'PASS' },
    { label: 'Yêu cầu chỉnh sửa (REVISION_REQUIRED)', value: 'REVISION_REQUIRED' },
    { label: 'Không đạt (FAIL)', value: 'FAIL' },
    { label: 'Vắng mặt (ABSENT)', value: 'ABSENT' },
];

const ATTENDANCE_OPTIONS = [
    { label: 'Có mặt (PRESENT)', value: 'PRESENT' },
    { label: 'Vắng mặt (ABSENT)', value: 'ABSENT' },
    { label: 'Có phép (EXCUSED)', value: 'EXCUSED' },
];

const BATCH_STATUS_CONFIG = {
    DRAFT: { label: 'Bản nháp (Đang ghi nhận)', color: 'orange' },
    PENDING_CHAIR: { label: 'Chờ Chủ tịch duyệt', color: 'blue' },
    PUBLISHED: { label: 'Đã công bố chính thức', color: 'green' },
    REOPENED: { label: 'Đã mở khóa (Chỉnh sửa)', color: 'gold' },
    SUPERSEDED: { label: 'Đã lưu trữ', color: 'default' },
};

const REVISION_STATUS_CONFIG = {
    NOT_REQUIRED: { label: 'Không yêu cầu nộp lại', color: 'default' },
    PENDING_REVIEW: { label: 'Chờ Chủ tịch thẩm định', color: 'processing' },
    APPROVED: { label: 'Đã thông qua v2', color: 'success' },
    REJECTED: { label: 'Từ chối v2 (Không đạt)', color: 'error' },
};

export default function OutlineCouncilGradingCard({ council, onRefreshParent }) {
    const user = useAuthStore((state) => state.user);
    const [loading, setLoading] = useState(false);
    const [councilDetail, setCouncilDetail] = useState(null);

    // Form evaluation state per registration ID
    const [evalMap, setEvalMap] = useState({});
    const [savingRowId, setSavingRowId] = useState(null);
    const [submittingAction, setSubmittingAction] = useState(false);

    // Modals & Drawer states
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        defenseDate: null,
        meetingMode: 'IN_PERSON',
        location: '',
        meetingUrl: '',
    });

    const [isDeadlineModalVisible, setIsDeadlineModalVisible] = useState(false);
    const [revisionDeadline, setRevisionDeadline] = useState(null);

    const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
    const [returnReason, setReturnReason] = useState('');

    const [isReviewDrawerVisible, setIsReviewDrawerVisible] = useState(false);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewDecision, setReviewDecision] = useState('APPROVE');
    const [reviewFeedback, setReviewFeedback] = useState('');

    const fetchDetail = useCallback(async () => {
        if (!council?.id) return;
        try {
            setLoading(true);
            const res = await councilService.getCouncilById(council.id);
            if (res.success && res.data) {
                const data = res.data;
                setCouncilDetail(data);

                // Initialize evaluation form state map
                const currentBatch = data.resultBatches?.[0] || null;
                const batchEvaluations = currentBatch?.evaluations || [];
                const registrations = data.registrations || [];

                const initialMap = {};
                registrations.forEach((reg) => {
                    const foundInBatch = batchEvaluations.find((e) => e.registrationId === reg.id);
                    const fallback = reg.bm01Evaluations?.[0] || {};
                    const effectiveEval = foundInBatch || fallback;

                    initialMap[reg.id] = {
                        initialOutcome: effectiveEval.initialOutcome || 'PASS',
                        attendanceStatus: effectiveEval.attendanceStatus || 'PRESENT',
                        comment: effectiveEval.comment || '',
                        revisionRequirements: effectiveEval.revisionRequirements || '',
                    };
                });
                setEvalMap(initialMap);

                // Set schedule form state
                setScheduleForm({
                    defenseDate: data.defenseDate ? dayjs(data.defenseDate) : null,
                    meetingMode: data.meetingMode || 'IN_PERSON',
                    location: data.location || '',
                    meetingUrl: data.meetingUrl || '',
                });

                if (data.revisionSubmissionDeadline) {
                    setRevisionDeadline(dayjs(data.revisionSubmissionDeadline));
                }
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải chi tiết hội đồng');
        } finally {
            setLoading(false);
        }
    }, [council?.id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    // Role identification
    const effectiveCouncil = councilDetail || council;
    const members = effectiveCouncil?.members || [];
    const myMember = members.find(
        (m) => m.lecturerId === user?.id || m.lecturer?.id === user?.id
    );
    const myRole = myMember?.roleInCouncil || myMember?.role || effectiveCouncil?.myRole || 'MEMBER';
    const isChairman = myRole === 'CHAIRMAN';
    const isSecretary = myRole === 'SECRETARY';
    const canGrade = isSecretary || isChairman;

    const chairmanName = members.find(
        (m) => m.roleInCouncil === 'CHAIRMAN' || m.role === 'CHAIRMAN'
    )?.lecturer?.fullName || 'Chưa phân công';
    const secretaryName = members.find(
        (m) => m.roleInCouncil === 'SECRETARY' || m.role === 'SECRETARY'
    )?.lecturer?.fullName || 'Chưa phân công';
    const reviewerName = members.find(
        (m) => m.roleInCouncil === 'REVIEWER' || m.role === 'REVIEWER'
    )?.lecturer?.fullName || 'Chưa phân công';

    const currentBatch = effectiveCouncil?.resultBatches?.[0] || null;
    const batchStatus = currentBatch?.status || 'DRAFT';
    const batchStatusInfo = BATCH_STATUS_CONFIG[batchStatus] || { label: batchStatus, color: 'default' };

    const candidates = effectiveCouncil?.registrations || [];

    // Handlers
    const handleEvalChange = (registrationId, field, value) => {
        setEvalMap((prev) => ({
            ...prev,
            [registrationId]: {
                ...(prev[registrationId] || {}),
                [field]: value,
            },
        }));
    };

    const handleSaveSingleDraft = async (registrationId) => {
        const payload = evalMap[registrationId];
        if (!payload) return;
        try {
            setSavingRowId(registrationId);
            await councilService.saveDraftResult(council.id, registrationId, payload);
            message.success('Đã lưu nháp đánh giá cho sinh viên.');
            fetchDetail();
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lưu nháp đánh giá');
        } finally {
            setSavingRowId(null);
        }
    };

    const handleSaveAllDrafts = async () => {
        try {
            setSubmittingAction(true);
            const promises = candidates.map((cand) => {
                const payload = evalMap[cand.id];
                if (!payload) return Promise.resolve();
                return councilService.saveDraftResult(council.id, cand.id, payload);
            });
            await Promise.all(promises);
            message.success('Đã lưu nháp kết quả cho toàn bộ hội đồng.');
            fetchDetail();
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lưu nháp hàng loạt');
        } finally {
            setSubmittingAction(false);
        }
    };

    const validateMatrixBeforeComplete = () => {
        const errors = [];
        candidates.forEach((cand, idx) => {
            const data = evalMap[cand.id];
            const sName = cand.student?.fullName || `SV #${idx + 1}`;
            if (!data?.initialOutcome) {
                errors.push(`Sinh viên ${sName}: Chưa chọn kết quả đánh giá.`);
            }
            if (data?.initialOutcome === 'REVISION_REQUIRED' && !data?.revisionRequirements?.trim()) {
                errors.push(`Sinh viên ${sName}: Bắt buộc nhập chi tiết Yêu cầu sửa đổi khi chọn 'Yêu cầu chỉnh sửa'.`);
            }
            if (data?.initialOutcome === 'FAIL' && !data?.comment?.trim()) {
                errors.push(`Sinh viên ${sName}: Bắt buộc nhập Nhận xét khi chọn 'Không đạt'.`);
            }
        });
        return errors;
    };

    const handleCompleteSecretary = async () => {
        const validationErrors = validateMatrixBeforeComplete();
        if (validationErrors.length > 0) {
            Modal.error({
                title: 'Không thể hoàn tất đánh giá',
                content: (
                    <ul className="list-disc pl-5 space-y-1 text-xs text-rose-700 mt-2">
                        {validationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                ),
            });
            return;
        }

        try {
            setSubmittingAction(true);
            // Save all drafts first to guarantee DB sync
            await handleSaveAllDrafts();
            const res = await councilService.completeSecretary(council.id);
            if (res.success) {
                message.success('Thư ký đã hoàn tất đánh giá hội đồng và chuyển Chủ tịch duyệt.');
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi hoàn tất đánh giá');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handlePublishSchedule = async () => {
        if (!scheduleForm.defenseDate) {
            message.warning('Vui lòng chọn ngày và giờ bảo vệ đề cương.');
            return;
        }
        try {
            setSubmittingAction(true);
            const payload = {
                defenseDate: scheduleForm.defenseDate.toISOString(),
                meetingMode: scheduleForm.meetingMode,
                location: scheduleForm.location,
                meetingUrl: scheduleForm.meetingUrl,
            };
            const res = await councilService.publishSchedule(council.id, payload);
            if (res.success) {
                message.success('Công bố lịch bảo vệ đề cương thành công.');
                setIsScheduleModalVisible(false);
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi công bố lịch bảo vệ');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleSetRevisionDeadline = async () => {
        if (!revisionDeadline) {
            message.warning('Vui lòng chọn hạn chót nộp lại đề cương.');
            return;
        }
        try {
            setSubmittingAction(true);
            const res = await councilService.setRevisionDeadline(council.id, revisionDeadline.toISOString());
            if (res.success) {
                message.success('Đã cập nhật hạn nộp lại đề cương.');
                setIsDeadlineModalVisible(false);
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi đặt hạn nộp lại');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleReturnToSecretary = async () => {
        if (!returnReason.trim()) {
            message.warning('Vui lòng nhập lý do trả lại cho Thư ký.');
            return;
        }
        try {
            setSubmittingAction(true);
            const res = await councilService.returnResults(council.id, returnReason.trim());
            if (res.success) {
                message.success('Đã trả lại kết quả cho Thư ký.');
                setIsReturnModalVisible(false);
                setReturnReason('');
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi trả lại kết quả');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handlePublishOfficialResults = async () => {
        try {
            setSubmittingAction(true);
            const res = await councilService.publishResults(council.id);
            if (res.success) {
                message.success('Công bố kết quả hội đồng đề cương chính thức thành công.');
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi công bố kết quả hội đồng');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleFinalizeOverdue = async () => {
        try {
            setSubmittingAction(true);
            const res = await councilService.finalizeOverdue(council.id);
            if (res.success) {
                message.success('Đã chốt danh sách quá hạn nộp lại đề cương.');
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi chốt danh sách quá hạn');
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleOpenReviewDrawer = (cand) => {
        setReviewTarget(cand);
        setReviewDecision('APPROVE');
        setReviewFeedback('');
        setIsReviewDrawerVisible(true);
    };

    const handleSubmitResubmissionReview = async () => {
        if (reviewDecision === 'REJECT' && !reviewFeedback.trim()) {
            message.warning('Bắt buộc nhập nhận xét/lý do từ chối bản nộp lại v2.');
            return;
        }
        try {
            setSubmittingAction(true);
            const res = await councilService.reviewResubmission(council.id, reviewTarget.id, {
                decision: reviewDecision,
                revisionFeedback: reviewFeedback.trim(),
            });
            if (res.success) {
                message.success('Đã thẩm định đề cương nộp lại thành công.');
                setIsReviewDrawerVisible(false);
                setReviewTarget(null);
                fetchDetail();
                onRefreshParent?.();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi thẩm định đề cương nộp lại');
        } finally {
            setSubmittingAction(false);
        }
    };

    return (
        <div className="card mb-6 border border-teal-200 rounded-xl overflow-hidden shadow-xs bg-white">
            {/* Header Toolbar */}
            <div className="p-4 bg-teal-50/70 border-b border-teal-100 flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-teal-900 font-display">
                            {effectiveCouncil?.name || 'Hội đồng Thẩm định Đề cương'}
                        </span>
                        <Tag color="purple" className="font-semibold">
                            Giai đoạn 2: Đề cương (BM01)
                        </Tag>
                        <Tag color={batchStatusInfo.color} className="font-semibold font-mono">
                            {batchStatusInfo.label}
                        </Tag>
                        {currentBatch?.versionNumber && (
                            <Tag className="font-mono text-xs">
                                Đợt {currentBatch.versionNumber}
                            </Tag>
                        )}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-4 flex-wrap">
                        <span>
                            Vai trò của bạn:{' '}
                            <strong className="text-teal-800">
                                {myRole === 'CHAIRMAN'
                                    ? 'Chủ tịch Hội đồng'
                                    : myRole === 'SECRETARY'
                                    ? 'Thư ký Hội đồng'
                                    : 'Ủy viên Hội đồng'}
                            </strong>
                        </span>
                        {effectiveCouncil?.schedulePublishedAt && (
                            <span className="text-emerald-700">
                                ✓ Đã công bố lịch lúc{' '}
                                {dayjs(effectiveCouncil.schedulePublishedAt).format('DD/MM/YYYY HH:mm')}
                            </span>
                        )}
                        {effectiveCouncil?.revisionSubmissionDeadline && (
                            <span className="text-amber-700">
                                ⏱ Hạn nộp lại đề cương:{' '}
                                {dayjs(effectiveCouncil.revisionSubmissionDeadline).format('DD/MM/YYYY HH:mm')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={fetchDetail}
                        loading={loading}
                    >
                        Tải lại
                    </Button>

                    {/* Chairman Actions */}
                    {isChairman && (
                        <>
                            <Button
                                size="small"
                                icon={<CalendarOutlined />}
                                onClick={() => setIsScheduleModalVisible(true)}
                            >
                                Lịch bảo vệ
                            </Button>
                            <Button
                                size="small"
                                icon={<ClockCircleOutlined />}
                                onClick={() => setIsDeadlineModalVisible(true)}
                            >
                                Hạn nộp lại
                            </Button>
                            {batchStatus === 'PENDING_CHAIR' && (
                                <>
                                    <Button
                                        size="small"
                                        icon={<RollbackOutlined />}
                                        onClick={() => setIsReturnModalVisible(true)}
                                        danger
                                    >
                                        Trả lại Thư ký
                                    </Button>
                                    <Popconfirm
                                        title="Công bố kết quả chính thức?"
                                        description="Kết quả sẽ có hiệu lực tức thời và gửi thông báo tới sinh viên."
                                        onConfirm={handlePublishOfficialResults}
                                        okText="Công bố ngay"
                                        cancelText="Hủy"
                                    >
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<SendOutlined />}
                                            style={{ backgroundColor: '#0F766E' }}
                                            loading={submittingAction}
                                        >
                                            Công bố kết quả
                                        </Button>
                                    </Popconfirm>
                                </>
                            )}
                            <Popconfirm
                                title="Chốt danh sách quá hạn?"
                                description="Các sinh viên chưa nộp lại đề cương đúng hạn sẽ tự động chuyển thành Không đạt (FAIL)."
                                onConfirm={handleFinalizeOverdue}
                                okText="Chốt ngay"
                                cancelText="Hủy"
                            >
                                <Button size="small" danger ghost loading={submittingAction}>
                                    Chốt quá hạn
                                </Button>
                            </Popconfirm>
                        </>
                    )}

                    {/* Secretary / Chairman Controls */}
                    {canGrade && (batchStatus === 'DRAFT' || batchStatus === 'REOPENED') && (
                        <>
                            <Button
                                size="small"
                                icon={<SaveOutlined />}
                                onClick={handleSaveAllDrafts}
                                loading={submittingAction}
                            >
                                Lưu nháp
                            </Button>
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={handleCompleteSecretary}
                                loading={submittingAction}
                                style={{ backgroundColor: '#0F766E' }}
                            >
                                Hoàn tất đánh giá
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Council Composition Banner */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between flex-wrap gap-2">
                <div>
                    <strong>Cơ cấu 3 thành viên:</strong> Chủ tịch: <strong>{chairmanName}</strong> · Thư ký:{' '}
                    <strong>{secretaryName}</strong> · UV Phản biện: <strong>{reviewerName}</strong>
                </div>
                <div>
                    {effectiveCouncil?.defenseDate ? (
                        <span>
                            Thời gian:{' '}
                            <strong>{dayjs(effectiveCouncil.defenseDate).format('DD/MM/YYYY HH:mm')}</strong> · Hình
                            thức: <strong>{effectiveCouncil.meetingMode === 'MICROSOFT_TEAMS' ? 'Trực tuyến (MS Teams)' : 'Trực tiếp'}</strong>
                            {effectiveCouncil.location && ` · Phòng: ${effectiveCouncil.location}`}
                            {effectiveCouncil.meetingUrl && (
                                <a
                                    href={effectiveCouncil.meetingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-2 text-teal-600 underline font-semibold"
                                >
                                    Vào Teams ↗
                                </a>
                            )}
                        </span>
                    ) : (
                        <span className="text-amber-700">Chưa công bố lịch bảo vệ đề cương</span>
                    )}
                </div>
            </div>

            {/* Candidates Grading Table */}
            <div className="p-4 overflow-x-auto">
                {loading ? (
                    <div className="py-12 text-center">
                        <Spin tip="Đang tải dữ liệu hội đồng..." />
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                        Hội đồng chưa được phân công sinh viên nào.
                    </div>
                ) : (
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-700 uppercase tracking-wider font-semibold bg-slate-50/50">
                                <th className="p-2.5 w-12 text-center">STT</th>
                                <th className="p-2.5 w-48">Sinh viên</th>
                                <th className="p-2.5 w-64">Đề tài & GVHD</th>
                                <th className="p-2.5 w-32 text-center">Đề cương v1</th>
                                <th className="p-2.5 w-36">Điểm danh</th>
                                <th className="p-2.5 w-48">Kết quả đánh giá</th>
                                <th className="p-2.5 min-w-[200px]">Nhận xét & Yêu cầu sửa đổi</th>
                                <th className="p-2.5 w-44 text-center">Bản nộp lại v2</th>
                                <th className="p-2.5 w-28 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {candidates.map((cand, idx) => {
                                const evalData = evalMap[cand.id] || {
                                    initialOutcome: 'PASS',
                                    attendanceStatus: 'PRESENT',
                                    comment: '',
                                    revisionRequirements: '',
                                };

                                const currentEval = currentBatch?.evaluations?.find(
                                    (e) => e.registrationId === cand.id
                                ) || cand.bm01Evaluations?.[0] || {};

                                const subV1 = currentEval?.submission || cand.bm01Evaluations?.[0]?.submission;
                                const subV2 = currentEval?.revisionSubmission || cand.bm01Evaluations?.[0]?.revisionSubmission;
                                const revisionStatus = currentEval?.revisionApprovalStatus || cand.bm01Evaluations?.[0]?.revisionApprovalStatus || 'NOT_REQUIRED';
                                const revisionStatusInfo = REVISION_STATUS_CONFIG[revisionStatus] || { label: revisionStatus, color: 'default' };

                                const isRevisionRequired = evalData.initialOutcome === 'REVISION_REQUIRED';
                                const isFail = evalData.initialOutcome === 'FAIL';

                                const isMissingRevisionReq = isRevisionRequired && !evalData.revisionRequirements?.trim();
                                const isMissingFailComment = isFail && !evalData.comment?.trim();

                                const isEditable = canGrade && (batchStatus === 'DRAFT' || batchStatus === 'REOPENED');

                                return (
                                    <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                                        <td className="p-2.5">
                                            <div className="font-bold text-slate-900">{cand.student?.fullName || 'Sinh viên'}</div>
                                            <div className="font-mono text-slate-500">{cand.student?.code || 'N/A'}</div>
                                            <div className="text-slate-400 text-[11px] truncate max-w-[160px]">{cand.student?.email}</div>
                                        </td>
                                        <td className="p-2.5">
                                            <div className="font-semibold text-slate-800 line-clamp-2">
                                                {cand.topic?.title || 'Chưa có tên đề tài'}
                                            </div>
                                            <div className="text-slate-500 mt-0.5">
                                                GVHD: <strong>{cand.topic?.mentor?.fullName || 'Chưa phân công'}</strong>
                                            </div>
                                        </td>
                                        <td className="p-2.5 text-center">
                                            {subV1?.fileUrl ? (
                                                <a
                                                    href={subV1.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                                                >
                                                    <FileTextOutlined /> Xem PDF
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 italic">Chưa nộp file</span>
                                            )}
                                        </td>
                                        <td className="p-2.5">
                                            {isEditable ? (
                                                <Select
                                                    size="small"
                                                    style={{ width: '100%' }}
                                                    value={evalData.attendanceStatus}
                                                    onChange={(val) => handleEvalChange(cand.id, 'attendanceStatus', val)}
                                                    options={ATTENDANCE_OPTIONS}
                                                />
                                            ) : (
                                                <Tag>{evalData.attendanceStatus}</Tag>
                                            )}
                                        </td>
                                        <td className="p-2.5">
                                            {isEditable ? (
                                                <Select
                                                    size="small"
                                                    style={{ width: '100%' }}
                                                    value={evalData.initialOutcome}
                                                    onChange={(val) => handleEvalChange(cand.id, 'initialOutcome', val)}
                                                    options={INITIAL_OUTCOME_OPTIONS}
                                                />
                                            ) : (
                                                <Tag
                                                    color={
                                                        evalData.initialOutcome === 'PASS'
                                                            ? 'green'
                                                            : evalData.initialOutcome === 'REVISION_REQUIRED'
                                                            ? 'orange'
                                                            : 'red'
                                                    }
                                                >
                                                    {evalData.initialOutcome}
                                                </Tag>
                                            )}
                                        </td>
                                        <td className="p-2.5 space-y-1.5">
                                            {isEditable ? (
                                                <>
                                                    <Input.TextArea
                                                        rows={1}
                                                        size="small"
                                                        placeholder="Nhận xét chung của hội đồng..."
                                                        value={evalData.comment}
                                                        onChange={(e) => handleEvalChange(cand.id, 'comment', e.target.value)}
                                                        className={isMissingFailComment ? 'border-rose-500' : ''}
                                                    />
                                                    {isMissingFailComment && (
                                                        <div className="text-[11px] text-rose-600 font-medium">
                                                            ⚠️ Bắt buộc nhận xét khi chọn Không đạt
                                                        </div>
                                                    )}

                                                    {isRevisionRequired && (
                                                        <>
                                                            <Input.TextArea
                                                                rows={2}
                                                                size="small"
                                                                placeholder="Yêu cầu sửa đổi chi tiết (Bắt buộc)..."
                                                                value={evalData.revisionRequirements}
                                                                onChange={(e) =>
                                                                    handleEvalChange(cand.id, 'revisionRequirements', e.target.value)
                                                                }
                                                                className={isMissingRevisionReq ? 'border-rose-500 bg-rose-50/30' : 'bg-amber-50/30'}
                                                            />
                                                            {isMissingRevisionReq && (
                                                                <div className="text-[11px] text-rose-600 font-medium">
                                                                    ⚠️ Bắt buộc nêu rõ yêu cầu sửa đổi
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="space-y-1">
                                                    {evalData.comment && (
                                                        <div className="text-slate-700">
                                                            <strong>Nhận xét:</strong> {evalData.comment}
                                                        </div>
                                                    )}
                                                    {evalData.revisionRequirements && (
                                                        <div className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                                                            <strong>Yêu cầu sửa:</strong> {evalData.revisionRequirements}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center space-y-1">
                                            {subV2?.fileUrl ? (
                                                <div className="space-y-1">
                                                    <a
                                                        href={subV2.fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-teal-700 font-semibold"
                                                    >
                                                        <FileTextOutlined /> File v2 ↗
                                                    </a>
                                                    <div>
                                                        <Tag color={revisionStatusInfo.color} className="text-[10px]">
                                                            {revisionStatusInfo.label}
                                                        </Tag>
                                                    </div>
                                                    {isChairman && (
                                                        <Button
                                                            size="small"
                                                            type="primary"
                                                            ghost
                                                            icon={<AuditOutlined />}
                                                            onClick={() => handleOpenReviewDrawer(cand)}
                                                            className="text-[11px] h-6 px-2 mt-1"
                                                        >
                                                            Thẩm định v2
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-[11px]">Chưa nộp v2</span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center">
                                            {isEditable && (
                                                <Button
                                                    size="small"
                                                    icon={<SaveOutlined />}
                                                    onClick={() => handleSaveSingleDraft(cand.id)}
                                                    loading={savingRowId === cand.id}
                                                    title="Lưu dòng này"
                                                >
                                                    Lưu
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Công bố / Cập nhật Lịch bảo vệ (Chủ tịch) */}
            <Modal
                title="Công bố / Cập nhật Lịch Bảo vệ Đề cương"
                open={isScheduleModalVisible}
                onCancel={() => setIsScheduleModalVisible(false)}
                onOk={handlePublishSchedule}
                okText="Công bố Lịch"
                confirmLoading={submittingAction}
                destroyOnClose
            >
                <div className="space-y-3 py-2 text-xs">
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Ngày & Giờ bảo vệ <span className="text-rose-500">*</span>
                        </label>
                        <DatePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            value={scheduleForm.defenseDate}
                            onChange={(date) => setScheduleForm((p) => ({ ...p, defenseDate: date }))}
                            style={{ width: '100%' }}
                            placeholder="Chọn ngày giờ"
                        />
                    </div>
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">Hình thức phiên họp</label>
                        <Select
                            value={scheduleForm.meetingMode}
                            onChange={(val) => setScheduleForm((p) => ({ ...p, meetingMode: val }))}
                            style={{ width: '100%' }}
                            options={[
                                { label: 'Trực tiếp tại phòng học (IN_PERSON)', value: 'IN_PERSON' },
                                { label: 'Trực tuyến Microsoft Teams (MICROSOFT_TEAMS)', value: 'MICROSOFT_TEAMS' },
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">Phòng học / Địa điểm</label>
                        <Input
                            placeholder="Ví dụ: Phòng 402, Tòa H1"
                            value={scheduleForm.location}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, location: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">Đường dẫn Microsoft Teams (nếu có)</label>
                        <Input
                            placeholder="https://teams.microsoft.com/l/meetup-join/..."
                            value={scheduleForm.meetingUrl}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, meetingUrl: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal Đặt Hạn nộp lại Đề cương (Chủ tịch) */}
            <Modal
                title="Đặt Hạn nộp lại Đề cương (v2)"
                open={isDeadlineModalVisible}
                onCancel={() => setIsDeadlineModalVisible(false)}
                onOk={handleSetRevisionDeadline}
                okText="Cập nhật Hạn nộp"
                confirmLoading={submittingAction}
                destroyOnClose
            >
                <div className="space-y-3 py-2 text-xs">
                    <p className="text-slate-600">
                        Hạn chót để các sinh viên thuộc diện <strong>Yêu cầu chỉnh sửa (REVISION_REQUIRED)</strong> nộp lại
                        bản đề cương hoàn thiện.
                    </p>
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Hạn chót nộp lại <span className="text-rose-500">*</span>
                        </label>
                        <DatePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            value={revisionDeadline}
                            onChange={setRevisionDeadline}
                            style={{ width: '100%' }}
                            placeholder="Chọn ngày giờ hết hạn"
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal Trả lại Thư ký kèm Lý do (Chủ tịch) */}
            <Modal
                title="Trả lại Kết quả cho Thư ký"
                open={isReturnModalVisible}
                onCancel={() => setIsReturnModalVisible(false)}
                onOk={handleReturnToSecretary}
                okText="Xác nhận Trả lại"
                okButtonProps={{ danger: true }}
                confirmLoading={submittingAction}
                destroyOnClose
            >
                <div className="space-y-3 py-2 text-xs">
                    <p className="text-slate-600">
                        Vui lòng nêu rõ lý do hoặc điểm cần điều chỉnh để Thư ký hội đồng tiếp tục cập nhật lại kết quả đánh giá.
                    </p>
                    <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                            Lý do trả lại <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do chi tiết..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            maxLength={500}
                            showCount
                        />
                    </div>
                </div>
            </Modal>

            {/* Drawer Thẩm định Đề cương Nộp lại v2 (Chủ tịch) */}
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <AuditOutlined className="text-teal-700" />
                        <span>Thẩm định Đề cương nộp lại v2</span>
                    </div>
                }
                open={isReviewDrawerVisible}
                onClose={() => setIsReviewDrawerVisible(false)}
                width={560}
                destroyOnClose
                footer={
                    <div className="flex justify-end gap-2">
                        <Button onClick={() => setIsReviewDrawerVisible(false)} disabled={submittingAction}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSubmitResubmissionReview}
                            loading={submittingAction}
                            style={{ backgroundColor: '#0F766E' }}
                        >
                            Lưu kết quả thẩm định
                        </Button>
                    </div>
                }
            >
                {reviewTarget && (
                    <div className="space-y-4 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <div>
                                Sinh viên: <strong>{reviewTarget.student?.fullName}</strong> ({reviewTarget.student?.code})
                            </div>
                            <div>
                                Đề tài: <strong>{reviewTarget.topic?.title}</strong>
                            </div>
                            <div>
                                GVHD: <strong>{reviewTarget.topic?.mentor?.fullName}</strong>
                            </div>
                        </div>

                        {/* Original revision requirements */}
                        {evalMap[reviewTarget.id]?.revisionRequirements && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="font-semibold text-amber-900 mb-1">
                                    Yêu cầu chỉnh sửa ban đầu của Hội đồng:
                                </div>
                                <div className="text-amber-800 whitespace-pre-wrap">
                                    {evalMap[reviewTarget.id].revisionRequirements}
                                </div>
                            </div>
                        )}

                        {/* Student Resubmission Files */}
                        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 space-y-2">
                            <div className="font-semibold text-teal-900">Bản đề cương đã sửa đổi nộp lại:</div>
                            {reviewTarget.bm01Evaluations?.[0]?.revisionSubmission?.fileUrl ? (
                                <div className="flex items-center gap-2">
                                    <FileTextOutlined className="text-teal-700 text-base" />
                                    <a
                                        href={reviewTarget.bm01Evaluations[0].revisionSubmission.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-bold text-teal-800 underline"
                                    >
                                        Tải file Đề cương v2 PDF ↗
                                    </a>
                                </div>
                            ) : (
                                <span className="text-slate-500 italic">Chưa có liên kết tải file.</span>
                            )}
                            {reviewTarget.bm01Evaluations?.[0]?.revisionSubmission?.content && (
                                <div className="text-slate-700 bg-white p-2 rounded border border-teal-100 whitespace-pre-wrap">
                                    <strong>Ghi chú sinh viên:</strong>{' '}
                                    {reviewTarget.bm01Evaluations[0].revisionSubmission.content}
                                </div>
                            )}
                        </div>

                        {/* Decision & Feedback */}
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Quyết định thẩm định <span className="text-rose-500">*</span>
                                </label>
                                <Radio.Group
                                    value={reviewDecision}
                                    onChange={(e) => setReviewDecision(e.target.value)}
                                >
                                    <Radio value="APPROVE">
                                        <Tag color="success">Thông qua (APPROVE)</Tag>
                                    </Radio>
                                    <Radio value="REJECT">
                                        <Tag color="error">Từ chối / Không đạt (REJECT)</Tag>
                                    </Radio>
                                </Radio.Group>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Nhận xét thẩm định {reviewDecision === 'REJECT' && <span className="text-rose-500">*</span>}
                                </label>
                                <Input.TextArea
                                    rows={4}
                                    placeholder={
                                        reviewDecision === 'REJECT'
                                            ? 'Bắt buộc nêu lý do từ chối bản đề cương v2...'
                                            : 'Nhận xét thêm (nếu có)...'
                                    }
                                    value={reviewFeedback}
                                    onChange={(e) => setReviewFeedback(e.target.value)}
                                    maxLength={500}
                                    showCount
                                />
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
}
