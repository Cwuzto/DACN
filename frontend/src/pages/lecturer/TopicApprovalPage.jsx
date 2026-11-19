import React, { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { message, Button, Modal, Input, Space } from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    EditOutlined,
    SearchOutlined,
    HistoryOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import OutlineReviewModal from '../../components/lecturer/OutlineReviewModal';
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
 * - Tab 1: Phê duyệt nguyện vọng sinh viên đăng ký đề tài (GVHD)
 * - Tab 2: Hội đồng thẩm định đề cương (BM01) lần đầu (Chủ tịch Hội đồng)
 */
export default function TopicApprovalPage() {
    const { user: currentUser } = useAuthStore();
    const scope = queryKeys.scope(currentUser);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');

    const resolveTabKey = (tab) => {
        if (tab === 'bm01' || tab === 'outline') return 'outline';
        if (tab === 'mentor') return 'mentor';
        return null;
    };

    const activeTab = resolveTabKey(tabParam) || 'mentor';

    const handleTabChange = (key) => {
        const nextParams = new URLSearchParams(searchParams);
        if (key === 'outline') {
            nextParams.set('tab', 'bm01');
        } else {
            nextParams.set('tab', 'mentor');
        }
        setSearchParams(nextParams);
    };

    const mentorRegistrationsQuery = useRegistrations(scope, { status: 'PENDING' });
    const councilOutlineQuery = useRegistrations(scope, { asCouncilChairman: 'true' });

    const registrationMutation = useRegistrationMutation(scope);

    const pendingRegistrations = mentorRegistrationsQuery.data || [];
    const councilOutlineRegistrations = councilOutlineQuery.data || [];

    // Modals for Mentor Approval
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Modal for Council Chairman Outline Review
    const [outlineModalOpen, setOutlineModalOpen] = useState(false);
    const [selectedOutlineRecord, setSelectedOutlineRecord] = useState(null);

    // Registration Timeline Drawer State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineRegistration, setTimelineRegistration] = useState(null);

    const pendingOutlineCount = useMemo(() => {
        return councilOutlineRegistrations.filter((r) => r.status === 'BM01_SUBMITTED' || r.status === 'BM01_RESUBMITTED').length;
    }, [councilOutlineRegistrations]);

    if (tabParam === 'bm02a') {
        const targetParams = new URLSearchParams();
        const requestId = searchParams.get('requestId');
        if (requestId) {
            targetParams.set('requestId', requestId);
        }
        const targetSearch = targetParams.toString();
        return <Navigate to={`/lecturer/title-adjustments${targetSearch ? `?${targetSearch}` : ''}`} replace />;
    }

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

    const isInitialPending = mentorRegistrationsQuery.isPending && !mentorRegistrationsQuery.data &&
        councilOutlineQuery.isPending && !councilOutlineQuery.data;

    if (isInitialPending) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-approvals" className="view-pane active" style={{ display: 'block' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="flex-wrap gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Phê Duyệt Nghiệp Vụ Giảng Viên
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Quản lý tiếp nhận hướng dẫn sinh viên và thẩm định đề cương nghiên cứu chi tiết.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag teal" style={{ padding: '6px 12px', fontSize: 12 }}>
                        Quy chuẩn: 1 Sinh viên / 1 Đề tài · Tối đa 10 SV/đợt
                    </span>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={mentorRegistrationsQuery.isFetching || councilOutlineQuery.isFetching}
                        onClick={() => {
                            mentorRegistrationsQuery.refetch();
                            councilOutlineQuery.refetch();
                        }}
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="segmented-tabs" style={{ marginBottom: 20 }}>
                <div
                    className={`seg-tab ${activeTab === 'mentor' ? 'active' : ''}`}
                    onClick={() => handleTabChange('mentor')}
                >
                    Nguyện Vọng Đăng Ký Hướng Dẫn ({pendingRegistrations.length})
                </div>
                <div
                    className={`seg-tab ${activeTab === 'outline' ? 'active' : ''}`}
                    onClick={() => handleTabChange('outline')}
                >
                    Hội Đồng Thẩm Định Đề Cương Chi Tiết ({pendingOutlineCount})
                </div>
            </div>

            {/* TAB 1: NGHIỆP VỤ GVHD TIẾP NHẬN HƯỚNG DẪN */}
            {activeTab === 'mentor' && (
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

                            return (
                                <div
                                    key={record.id}
                                    className="card"
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
                                                <span className="tag yellow">Đang chờ bạn duyệt</span>
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
            )}

            {/* TAB 2: HỘI ĐỒNG THẨM ĐỊNH ĐỀ CƯƠNG BM01 (CHỦ TỊCH HỘI ĐỒNG) */}
            {activeTab === 'outline' && (
                <QueryPanel query={councilOutlineQuery}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ padding: '14px 18px', background: '#EFF6FF', borderRadius: 'var(--radius)', border: '1px solid #BFDBFE', fontSize: 13, color: '#1E40AF' }}>
                        <strong>Quyền hạn Chủ tịch Hội đồng:</strong> Bạn đang xem danh sách đề cương nghiên cứu chi tiết được phân công cho Hội đồng mà bạn là Chủ tịch. Quyết định thẩm định của Chủ tịch sẽ chốt trạng thái đề cương: Đạt hoặc Yêu cầu chỉnh sửa.
                    </div>

                    {councilOutlineRegistrations.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Chưa có đề cương nào cần thẩm định
                            </h3>
                            <p style={{ fontSize: 13, marginTop: 4 }}>
                                Hiện không có đề cương nào được nộp hoặc phân công cho Hội đồng của bạn.
                            </p>
                        </div>
                    ) : (
                        councilOutlineRegistrations.map((record) => {
                            const student = record.student;
                            const topic = record.topic;
                            const submissions = record.bm01Submissions || record.submissions || [];
                            const latestSub = submissions[0];
                            const isPendingReview = record.status === 'BM01_SUBMITTED' || record.status === 'BM01_RESUBMITTED';

                            return (
                                <div
                                    key={record.id}
                                    className="card"
                                    style={{
                                        borderLeft: isPendingReview ? '4px solid var(--primary)' : '4px solid var(--border)',
                                        marginBottom: 0,
                                    }}
                                >
                                    <div style={{ padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }} className="flex-wrap gap-2">
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                                                    {student?.fullName || 'Sinh viên'}{' '}
                                                    <span className="mono" style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: 12 }}>
                                                        · MSSV: {student?.code || '-'} · Lớp: {student?.studentProfile?.className || '-'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                                                    Đề tài: <strong>"{topic?.title}"</strong>
                                                </div>
                                            </div>
                                            <div>
                                                <span className={`tag ${isPendingReview ? 'blue' : 'green'}`}>
                                                    {isPendingReview ? 'Chờ thẩm định' : getStatusTagConfig(record.status).label}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, gap: 8 }}>
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
                                                type={isPendingReview ? 'primary' : 'default'}
                                                icon={isPendingReview ? <EditOutlined /> : <SearchOutlined />}
                                                onClick={() => {
                                                    setSelectedOutlineRecord(record);
                                                    setOutlineModalOpen(true);
                                                }}
                                            >
                                                {isPendingReview ? 'Thẩm định đề cương' : 'Xem và cập nhật đánh giá'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    </div>
                </QueryPanel>
            )}

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

            {/* MODAL: THẨM ĐỊNH ĐỀ CƯƠNG BM01 */}
            <OutlineReviewModal
                open={outlineModalOpen}
                onClose={() => {
                    setOutlineModalOpen(false);
                    setSelectedOutlineRecord(null);
                }}
                onSuccess={() => {
                    councilOutlineQuery.refetch();
                }}
                registration={selectedOutlineRecord}
            />

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
