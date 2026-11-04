import { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    Input,
    Alert,
    Descriptions,
    Tag,
    Space,
    Typography,
    Divider,
    message,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    LinkOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import useAuthStore from '../../stores/authStore';

const { TextArea } = Input;
const { Text } = Typography;

export default function CheckpointAppealReviewModal({
    open,
    onClose,
    appeal,
    onSuccess,
    currentUserId: propCurrentUserId,
}) {
    const authUser = useAuthStore((state) => state.user);
    const currentUserId = propCurrentUserId || authUser?.id;

    const [reviewNotes, setReviewNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && appeal) {
            setReviewNotes(appeal.reviewNotes || '');
        } else {
            setReviewNotes('');
        }
    }, [open, appeal]);

    // Kiem tra xung dot loi ich: GVHD khong duoc tu tham dinh don khieu nai cua sinh vien minh huong dan
    const mentorId = appeal?.registration?.topic?.mentorId || appeal?.topic?.mentorId || appeal?.mentorId;
    const isMentorConflict = Boolean(currentUserId && mentorId && Number(currentUserId) === Number(mentorId));

    const isProcessed = appeal?.status === 'APPROVED' || appeal?.status === 'REJECTED';

    const handleDecision = async (decision) => {
        if (!appeal?.id) return;

        if (isMentorConflict) {
            message.error('Xung đột lợi ích: Giảng viên hướng dẫn không được thẩm định khiếu nại của sinh viên mình hướng dẫn.');
            return;
        }

        try {
            setSubmitting(true);
            const res = await evaluationService.reviewCheckpointAppeal({
                appealId: appeal.id,
                decision,
                reviewNotes: reviewNotes.trim() || undefined,
            });

            if (res.success) {
                message.success(
                    decision === 'APPROVED'
                        ? 'Đã chấp thuận gia hạn thời gian ký BM03 Checkpoint cho sinh viên.'
                        : 'Đã bác đơn khiếu nại chữ ký. Đề tài chuyển sang dừng thực hiện.'
                );
                if (onSuccess) onSuccess(res.data);
                if (onClose) onClose();
            } else {
                message.error(res.message || 'Không thể thẩm định khiếu nại.');
            }
        } catch (error) {
            message.error(error?.message || 'Đã xảy ra lỗi khi thẩm định khiếu nại.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!appeal) return null;

    const studentName = appeal.student?.fullName || appeal.studentName || '—';
    const studentCode = appeal.student?.code || appeal.studentCode || '—';
    const studentEmail = appeal.student?.email || '';
    const topicTitle = appeal.registration?.topic?.title || appeal.topicTitle || '—';
    const checkpointNo = appeal.checkpointEvaluation?.checkpointNo || appeal.checkpointNo || 1;
    const attemptNo = appeal.checkpointEvaluation?.attemptNo || appeal.attemptNo || 1;

    const initialDeadline = appeal.checkpointEvaluation?.studentSignDeadlineAt;
    const appealDeadline = appeal.appealDeadlineAt;
    const submittedTime = appeal.submittedAt || appeal.createdAt;

    const statusBadge = () => {
        switch (appeal.status) {
            case 'APPROVED':
                return <Tag color="green" icon={<CheckCircleOutlined />}>ĐÃ CHẤP THUẬN GIA HẠN</Tag>;
            case 'REJECTED':
                return <Tag color="red" icon={<CloseCircleOutlined />}>ĐÃ BÁC ĐƠN</Tag>;
            case 'SUBMITTED':
                return <Tag color="gold" icon={<ExclamationCircleOutlined />}>CHỜ THẨM ĐỊNH</Tag>;
            case 'PENDING':
                return <Tag color="blue" icon={<WarningOutlined />}>ĐANG MỞ ĐƠN</Tag>;
            default:
                return <Tag>{appeal.status}</Tag>;
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <ExclamationCircleOutlined className="text-amber-500" />
                    <span>Thẩm Định Khiếu Nại Chữ Ký BM03 Checkpoint</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={720}
            footer={
                <div className="flex items-center justify-between">
                    <div>
                        {isProcessed && (
                            <Text type="secondary" className="text-xs">
                                Đơn khiếu nại này đã được xử lý (trạng thái: {appeal.status}).
                            </Text>
                        )}
                    </div>
                    <Space>
                        <Button onClick={onClose} disabled={submitting}>
                            Đóng
                        </Button>
                        <Button
                            danger
                            onClick={() => handleDecision('REJECTED')}
                            loading={submitting}
                            disabled={isMentorConflict || isProcessed}
                            icon={<CloseCircleOutlined />}
                        >
                            Bác đơn (REJECTED)
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => handleDecision('APPROVED')}
                            loading={submitting}
                            disabled={isMentorConflict || isProcessed}
                            icon={<CheckCircleOutlined />}
                        >
                            Chấp thuận gia hạn (APPROVED)
                        </Button>
                    </Space>
                </div>
            }
        >
            <div className="space-y-4 pt-2">
                {/* Canh bao xung dot loi ich */}
                {isMentorConflict && (
                    <Alert
                        type="error"
                        showIcon
                        message="Xung đột lợi ích: Giảng viên hướng dẫn không được thẩm định khiếu nại của sinh viên mình hướng dẫn."
                        description="Theo quy chế học vụ, đơn khiếu nại chữ ký Checkpoint của sinh viên bắt buộc phải do Ban chủ nhiệm khoa / Viện trưởng hoặc hội đồng độc lập thẩm định để đảm bảo tính khách quan và công bằng."
                    />
                )}

                {/* Thong tin chi tiet don khieu nai */}
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Mã sinh viên" span={1}>
                        <span className="font-semibold text-slate-800">{studentCode}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Họ tên sinh viên" span={1}>
                        <span className="font-semibold text-slate-800">{studentName}</span>
                        {studentEmail && <div className="text-xs text-slate-500">{studentEmail}</div>}
                    </Descriptions.Item>

                    <Descriptions.Item label="Đề tài đồ án" span={2}>
                        <span className="font-medium text-slate-800">{topicTitle}</span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Mốc Checkpoint" span={1}>
                        <Tag color="cyan" className="font-semibold">
                            Checkpoint {checkpointNo} (Lần {attemptNo})
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái đơn" span={1}>
                        {statusBadge()}
                    </Descriptions.Item>

                    <Descriptions.Item label="Hạn ký ban đầu" span={1}>
                        {initialDeadline ? dayjs(initialDeadline).format('DD/MM/YYYY HH:mm') : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Hạn nộp khiếu nại" span={1}>
                        {appealDeadline ? dayjs(appealDeadline).format('DD/MM/YYYY HH:mm') : '—'}
                    </Descriptions.Item>

                    <Descriptions.Item label="Thời gian nộp đơn" span={2}>
                        {submittedTime ? dayjs(submittedTime).format('DD/MM/YYYY HH:mm') : '—'}
                    </Descriptions.Item>
                </Descriptions>

                {/* Ly do khieu nai */}
                <div className="rounded-lg bg-amber-50/60 border border-amber-200/80 p-3.5 space-y-1.5">
                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Lý do khiếu nại / giải trình của sinh viên:
                    </div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {appeal.reason || 'Sinh viên không nhập nội dung giải trình.'}
                    </div>

                    {appeal.evidenceUrl && (
                        <div className="pt-2 border-t border-amber-200/60 flex items-center gap-2">
                            <LinkOutlined className="text-blue-600" />
                            <a
                                href={appeal.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 underline font-medium hover:text-blue-800"
                            >
                                Xem minh chứng đính kèm ({appeal.evidenceName || 'Tệp minh chứng'})
                            </a>
                        </div>
                    )}
                </div>

                <Divider className="my-2" />

                {/* Y kien tham dinh */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Ý kiến thẩm định &amp; căn cứ xử lý của Ban chủ nhiệm / Viện:
                    </label>
                    <TextArea
                        rows={3}
                        placeholder="Nhập ghi chú thẩm định, lý do chấp thuận gia hạn hoặc căn cứ bác đơn..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        disabled={isMentorConflict || isProcessed || submitting}
                    />
                    <div className="text-xs text-slate-500 mt-1">
                        • <b>Chấp thuận gia hạn:</b> Hồ sơ mở lại cửa sổ ký BM03 Checkpoint theo số ngày gia hạn cấu hình trong chính sách đợt.<br />
                        • <b>Bác đơn:</b> Đề tài dừng thực hiện (TERMINATED_FAILED_PROGRESS) do vi phạm quy chế tiến độ học thuật.
                    </div>
                </div>
            </div>
        </Modal>
    );
}
