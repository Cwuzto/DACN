import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { message, Button, Modal, Input, Space } from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    HistoryOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import { getStatusTagConfig } from '../../components/common/statusMap';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrations, useRegistrationMutation } from '../../queries/registrationQueries';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';

const { TextArea } = Input;

/**
 * TopicApprovalPage
 * Không gian làm việc thuần túy của Giảng viên hướng dẫn:
 * - Tiếp nhận và phê duyệt nguyện vọng sinh viên đăng ký đề tài (1 SV / 1 Đề tài, tối đa 10 SV/đợt)
 * - Tương thích ngược: Chuyển hướng các liên kết cũ ?tab=bm01 / ?tab=outline sang /lecturer/outline-evaluations
 *   và ?tab=bm02a sang /lecturer/title-adjustments
 */
export default function TopicApprovalPage() {
    const { user: currentUser } = useAuthStore();
    const scope = queryKeys.scope(currentUser);
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const targetRegistrationId = searchParams.get('registrationId');

    // Chuyển hướng tương thích ngược cho các liên kết cũ
    if (tabParam === 'bm01' || tabParam === 'outline') {
        const targetParams = new URLSearchParams();
        if (targetRegistrationId) targetParams.set('registrationId', targetRegistrationId);
        const targetSearch = targetParams.toString();
        return <Navigate to={`/lecturer/outline-evaluations${targetSearch ? `?${targetSearch}` : ''}`} replace />;
    }

    if (tabParam === 'bm02a') {
        const targetParams = new URLSearchParams();
        const requestId = searchParams.get('requestId');
        if (requestId) {
            targetParams.set('requestId', requestId);
        }
        const targetSearch = targetParams.toString();
        return <Navigate to={`/lecturer/title-adjustments${targetSearch ? `?${targetSearch}` : ''}`} replace />;
    }

    const mentorRegistrationsQuery = useRegistrations(scope, { status: 'PENDING' });
    const registrationMutation = useRegistrationMutation(scope);
    const pendingRegistrations = mentorRegistrationsQuery.data || [];

    // Modals for Mentor Approval
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Registration Timeline Drawer State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineRegistration, setTimelineRegistration] = useState(null);

    const handleApprove = async (record) => {
        try {
            setSubmitting(true);
            await registrationMutation.mutateAsync({
                action: 'handleRegistration',
                args: [record.id, 'APPROVE'],
            });
            message.success(`Đã chấp thuận hướng dẫn sinh viên ${record.student?.fullName || ''}!`);
        } catch (error) {
            message.error(error?.message || 'Lỗi khi chấp thuận hướng dẫn');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectingRecord) return;
        if (!rejectReason.trim()) {
            message.warning('Vui lòng nhập lý do từ chối');
            return;
        }

        try {
            setSubmitting(true);
            await registrationMutation.mutateAsync({
                action: 'handleRegistration',
                args: [
                    rejectingRecord.id,
                    'REJECT',
                    rejectReason.trim(),
                ],
            });
            message.success('Đã từ chối đơn đăng ký.');
            setRejectModalOpen(false);
            setRejectingRecord(null);
            setRejectReason('');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi từ chối đăng ký');
        } finally {
            setSubmitting(false);
        }
    };

    const isInitialPending = mentorRegistrationsQuery.isPending && !mentorRegistrationsQuery.data;

    if (isInitialPending) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-approvals" className="view-pane active" style={{ display: 'block' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="flex-wrap gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Phê Duyệt Nguyện Vọng Hướng Dẫn
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Quản lý và tiếp nhận sinh viên đăng ký đề tài của giảng viên hướng dẫn.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag teal" style={{ padding: '6px 12px', fontSize: 12 }}>
                        Quy chuẩn: 1 Sinh viên / 1 Đề tài · Tối đa 10 SV/đợt
                    </span>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={mentorRegistrationsQuery.isFetching}
                        onClick={() => mentorRegistrationsQuery.refetch()}
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Danh sách nguyện vọng đăng ký hướng dẫn */}
            <QueryPanel query={mentorRegistrationsQuery}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pendingRegistrations.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Tất cả đơn đăng ký hướng dẫn đã được xử lý
                            </h3>
                            <p style={{ fontSize: 13, marginTop: 4 }}>
                                Hiện không có sinh viên nào đang chờ phê duyệt nguyện vọng hướng dẫn.
                            </p>
                        </div>
                    ) : (
                        pendingRegistrations.map((record) => {
                            const student = record.student;
                            const topic = record.topic;
                            const className = student?.studentProfile?.className || student?.department || 'Chưa cập nhật';
                            const major = student?.studentProfile?.major || topic?.projectCatalog?.name || 'Công nghệ Thông tin';
                            const topicCode = topic?.code || `DT-${topic?.id || record.topicId}`;
                            const registrationTime = record.createdAt ? new Date(record.createdAt).toLocaleString('vi-VN') : '—';

                            const isTargetRegistration = Boolean(
                                targetRegistrationId && String(record.id) === String(targetRegistrationId)
                            );

                            return (
                                <div
                                    key={record.id}
                                    className={`card ${isTargetRegistration ? 'ring-2 ring-teal-500' : ''}`}
                                    style={{ borderLeft: '4px solid var(--warning)', marginBottom: 0 }}
                                >
                                    <div style={{ padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }} className="flex-wrap gap-2">
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                                                    {student?.fullName || 'Sinh viên'}{' '}
                                                    <span className="mono" style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: 12 }}>
                                                        · MSSV: {student?.code || '-'} · Lớp: <strong>{className}</strong>
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 4 }}>
                                                    Ngành: <strong style={{ color: 'var(--fg)' }}>{major}</strong> · Email: <span className="mono">{student?.email || 'Chưa cập nhật'}</span>
                                                    {student?.phone && (
                                                        <> · SĐT: <span className="mono">{student.phone}</span></>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="tag yellow">
                                                    {getStatusTagConfig(record.status).label || 'Đang chờ bạn duyệt'}
                                                </span>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                                    Gửi lúc: {registrationTime}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid var(--border)' }}>
                                            <div>
                                                <strong>Nguyện vọng đề tài:</strong> <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{topicCode}</span>: <em>"{topic?.title}"</em>
                                                {topic?.projectCatalog?.name && (
                                                    <span className="tag teal" style={{ marginLeft: 8, fontSize: 11 }}>
                                                        {topic.projectCatalog.name}
                                                    </span>
                                                )}
                                            </div>
                                            {topic?.description && (
                                                <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6 }}>
                                                    <strong>Mô tả đề tài:</strong> {topic.description}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }} className="flex-wrap gap-3">
                                            <Space>
                                                <Button
                                                    icon={<HistoryOutlined />}
                                                    onClick={() => {
                                                        setTimelineRegistration(record);
                                                        setTimelineOpen(true);
                                                    }}
                                                >
                                                    Lịch sử tiến trình
                                                </Button>
                                                <Button
                                                    danger
                                                    icon={<CloseOutlined />}
                                                    disabled={submitting}
                                                    onClick={() => {
                                                        setRejectingRecord(record);
                                                        setRejectModalOpen(true);
                                                    }}
                                                >
                                                    Từ chối
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    icon={<CheckOutlined />}
                                                    disabled={submitting}
                                                    className="!bg-emerald-600 hover:!bg-emerald-700"
                                                    onClick={() => handleApprove(record)}
                                                >
                                                    Chấp thuận hướng dẫn
                                                </Button>
                                            </Space>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </QueryPanel>

            {/* MODAL: TỪ CHỐI ĐĂNG KÝ HƯỚNG DẪN */}
            <Modal
                title="Từ chối tiếp nhận hướng dẫn"
                open={rejectModalOpen}
                onCancel={() => setRejectModalOpen(false)}
                footer={[
                    <Button key="cancel" icon={<CloseOutlined />} onClick={() => setRejectModalOpen(false)}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger
                        loading={submitting}
                        icon={<CheckOutlined />}
                        onClick={handleReject}
                    >
                        Xác nhận từ chối
                    </Button>,
                ]}
            >
                <div className="space-y-3 pt-2">
                    <p className="text-sm text-slate-700">
                        Bạn đang từ chối sinh viên <strong>{rejectingRecord?.student?.fullName}</strong> cho đề tài{' '}
                        <em>"{rejectingRecord?.topic?.title}"</em>.
                    </p>
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Lý do từ chối (sinh viên sẽ nhận được thông báo này):
                        </label>
                        <TextArea
                            rows={3}
                            placeholder="Nhập lý do từ chối cụ thể..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            <RegistrationTimelineDrawer
                open={timelineOpen}
                onClose={() => {
                    setTimelineOpen(false);
                    setTimelineRegistration(null);
                }}
                registrationId={timelineRegistration?.id}
                topicTitle={timelineRegistration?.topic?.title}
                studentName={timelineRegistration?.student?.fullName}
                studentCode={timelineRegistration?.student?.code}
            />
        </section>
    );
}
