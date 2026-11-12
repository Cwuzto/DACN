import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { message, Tag, Button, Modal, Input, Descriptions, Alert, Space, Divider } from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    FileDoneOutlined,
    CloseCircleOutlined,
    EditOutlined,
    SearchOutlined,
    AuditOutlined,
    ClockCircleOutlined,
    HistoryOutlined,
} from '@ant-design/icons';
import registrationService from '../../services/registrationService';
import bm02aService from '../../services/bm02aService';
import PageLoader from '../../components/common/PageLoader';
import OutlineReviewModal from '../../components/lecturer/OutlineReviewModal';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import useAuthStore from '../../stores/authStore';

const { TextArea } = Input;

/**
 * TopicApprovalPage
 * - Tab 1: Phê duyệt nguyện vọng sinh viên đăng ký đề tài (GVHD)
 * - Tab 2: Hội đồng thẩm định đề cương (BM01) lần đầu (Chủ tịch Hội đồng)
 * - Tab 3: Duyệt phiếu đổi tên BM02-A (GVHD & Phụ trách bộ môn)
 */
export default function TopicApprovalPage() {
    const { user: currentUser } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');

    const resolveTabKey = (tab) => {
        if (tab === 'bm01' || tab === 'outline') return 'outline';
        if (tab === 'bm02a') return 'bm02a';
        if (tab === 'mentor') return 'mentor';
        return null;
    };

    const [activeTab, setActiveTab] = useState(() => resolveTabKey(tabParam) || 'mentor');

    useEffect(() => {
        const resolved = resolveTabKey(tabParam);
        if (resolved && resolved !== activeTab) {
            setActiveTab(resolved);
        }
    }, [tabParam]);

    const handleTabChange = (key) => {
        setActiveTab(key);
        const nextParams = new URLSearchParams(searchParams);
        if (key === 'outline') {
            nextParams.set('tab', 'bm01');
        } else if (key === 'bm02a') {
            nextParams.set('tab', 'bm02a');
        } else {
            nextParams.set('tab', 'mentor');
        }
        setSearchParams(nextParams, { replace: true });
    };

    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [councilOutlineRegistrations, setCouncilOutlineRegistrations] = useState([]);
    const [bm02aRequests, setBm02aRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals for Mentor Approval
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Modal for Council Chairman Outline Review
    const [outlineModalOpen, setOutlineModalOpen] = useState(false);
    const [selectedOutlineRecord, setSelectedOutlineRecord] = useState(null);

    // Modal for BM02-A Return
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [returningRequest, setReturningRequest] = useState(null);
    const [returningRole, setReturningRole] = useState('ADVISOR');
    const [returnReason, setReturnReason] = useState('');
    const [submittingBm02a, setSubmittingBm02a] = useState(false);

    // Registration Timeline Drawer State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineRegistration, setTimelineRegistration] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [mentorRes, outlineRes, bm02aRes] = await Promise.all([
                registrationService.getAllRegistrations({ status: 'PENDING' }),
                registrationService.getAllRegistrations({ asCouncilChairman: 'true' }),
                bm02aService.getPendingQueue().catch(() => ({ success: false, data: [] })),
            ]);

            if (mentorRes.success) {
                setPendingRegistrations(mentorRes.data || []);
            }
            if (outlineRes.success) {
                setCouncilOutlineRegistrations(outlineRes.data || []);
            }
            if (bm02aRes.success && Array.isArray(bm02aRes.data)) {
                setBm02aRequests(bm02aRes.data);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách phê duyệt');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const pendingOutlineCount = useMemo(() => {
        return councilOutlineRegistrations.filter((r) => r.status === 'BM01_SUBMITTED').length;
    }, [councilOutlineRegistrations]);

    const pendingBm02aCount = useMemo(() => {
        return bm02aRequests.filter((r) => ['PENDING_ADVISOR', 'PENDING_DEPARTMENT_APPROVAL'].includes(r.status)).length;
    }, [bm02aRequests]);

    const handleApprove = async (record) => {
        try {
            setSubmitting(true);
            const res = await registrationService.handleRegistration(record.id, 'APPROVE');
            if (res.success) {
                message.success(`Đã chấp thuận hướng dẫn sinh viên ${record.student?.fullName || ''}!`);
                fetchData();
            }
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
            const res = await registrationService.handleRegistration(
                rejectingRecord.id,
                'REJECT',
                rejectReason.trim()
            );
            if (res.success) {
                message.success('Đã từ chối đơn đăng ký.');
                setRejectModalOpen(false);
                setRejectingRecord(null);
                setRejectReason('');
                fetchData();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi từ chối đăng ký');
        } finally {
            setSubmitting(false);
        }
    };

    // BM02-A Actions
    const handleAdvisorSign = async (request) => {
        try {
            setSubmittingBm02a(true);
            const currentVersion = request.versions?.find((v) => v.versionNumber === request.currentVersionNumber)
                || request.versions?.[0];
            const payloadHash = currentVersion?.payloadHash;

            const res = await bm02aService.advisorSign(request.id, {
                payloadHash,
                signatureImageId: null,
            });

            if (res.success) {
                message.success('GVHD đã ký duyệt xác nhận đơn điều chỉnh tên BM02-A thành công!');
                fetchData();
            } else {
                message.error(res.message || 'Không thể ký duyệt đơn BM02-A.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi GVHD ký duyệt đơn BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const handleDepartmentSign = async (request) => {
        try {
            setSubmittingBm02a(true);
            const currentVersion = request.versions?.find((v) => v.versionNumber === request.currentVersionNumber)
                || request.versions?.[0];
            const payloadHash = currentVersion?.payloadHash;

            const res = await bm02aService.departmentSign(request.id, {
                payloadHash,
                signatureImageId: null,
            });

            if (res.success) {
                message.success('Phụ trách bộ môn đã phê duyệt và ký số hoàn tất đơn BM02-A!');
                fetchData();
            } else {
                message.error(res.message || 'Không thể ký duyệt đơn BM02-A.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi Phụ trách bộ môn ký duyệt đơn BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const openReturnModal = (request, role) => {
        setReturningRequest(request);
        setReturningRole(role);
        setReturnReason('');
        setReturnModalOpen(true);
    };

    const handleReturnSubmit = async () => {
        if (!returningRequest) return;
        if (!returnReason.trim()) {
            message.warning('Vui lòng nhập lý do trả lại / từ chối.');
            return;
        }

        try {
            setSubmittingBm02a(true);
            const res = await bm02aService.returnRequest(returningRequest.id, {
                reason: returnReason.trim(),
                actorRole: returningRole,
            });

            if (res.success) {
                message.success('Đã trả lại yêu cầu điều chỉnh tên đề tài BM02-A.');
                setReturnModalOpen(false);
                setReturningRequest(null);
                setReturnReason('');
                fetchData();
            } else {
                message.error(res.message || 'Không thể trả lại yêu cầu.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi trả lại yêu cầu BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    if (loading) {
        return <PageLoader />;
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
                        Quản lý tiếp nhận hướng dẫn sinh viên, thẩm định đề cương và xét duyệt phiếu đổi tên đề tài BM02-A.
                    </p>
                </div>
                <span className="tag teal" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Quy chuẩn: 1 Sinh viên / 1 Đề tài · Tối đa 10 SV/đợt
                </span>
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
                <div
                    className={`seg-tab ${activeTab === 'bm02a' ? 'active' : ''}`}
                    onClick={() => handleTabChange('bm02a')}
                >
                    Duyệt phiếu đổi tên BM02-A ({pendingBm02aCount})
                </div>
            </div>

            {/* TAB 1: NGHIỆP VỤ GVHD TIẾP NHẬN HƯỚNG DẪN */}
            {activeTab === 'mentor' && (
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
            )}

            {/* TAB 2: HỘI ĐỒNG THẨM ĐỊNH ĐỀ CƯƠNG BM01 (CHỦ TỊCH HỘI ĐỒNG) */}
            {activeTab === 'outline' && (
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
                            const submissions = record.bm01Submissions || [];
                            const latestSub = submissions[0];
                            const isPendingReview = record.status === 'BM01_SUBMITTED';

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
                                                    {isPendingReview ? 'Chờ thẩm định' : record.status}
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
            )}

            {/* TAB 3: DUYỆT PHIẾU ĐỔI TÊN BM02-A (GVHD & PHỤ TRÁCH BỘ MÔN) */}
            {activeTab === 'bm02a' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ padding: '14px 18px', background: '#F0FDF4', borderRadius: 'var(--radius)', border: '1px solid #BBF7D0', fontSize: 13, color: '#166534' }}>
                        <strong>Quy trình ký duyệt BM02-A:</strong> Phiếu điều chỉnh tên đề tài BM02-A trải qua 3 chữ ký điện tử nội bộ. Sau khi sinh viên ký nộp, GVHD ký xác nhận, tiếp đó Phụ trách bộ môn phê duyệt và ký số để hoàn tất hồ sơ đưa vào Phụ lục điều chỉnh.
                    </div>

                    {bm02aRequests.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Không có phiếu đổi tên đề tài BM02-A nào cần xử lý
                            </h3>
                            <p style={{ fontSize: 13, marginTop: 4 }}>
                                Toàn bộ các yêu cầu đổi tên đã được xử lý hoặc chưa phát sinh trong đợt đồ án.
                            </p>
                        </div>
                    ) : (
                        bm02aRequests.map((req) => {
                            const reg = req.registration;
                            const student = reg?.student;
                            const topic = reg?.topic;
                            const currentVersion = req.versions?.find((v) => v.versionNumber === req.currentVersionNumber)
                                || req.versions?.[0];
                            const isPendingAdvisor = req.status === 'PENDING_ADVISOR';
                            const isPendingDept = req.status === 'PENDING_DEPARTMENT_APPROVAL';

                            return (
                                <div
                                    key={req.id}
                                    className="card"
                                    style={{
                                        borderLeft: isPendingAdvisor ? '4px solid #2563EB' : isPendingDept ? '4px solid #7C3AED' : '4px solid var(--border)',
                                        marginBottom: 0,
                                    }}
                                >
                                    <div style={{ padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }} className="flex-wrap gap-2">
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                                                    {student?.fullName || 'Sinh viên'}{' '}
                                                    <span className="mono" style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: 12 }}>
                                                        · MSSV: {student?.code || '-'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                                                    GVHD: <strong>{topic?.mentor?.fullName || 'Chưa phân công'}</strong>
                                                </div>
                                            </div>
                                            <Space>
                                                <Tag color={req.currentVersionNumber === 2 ? 'volcano' : 'blue'}>
                                                    Phiên bản v{req.currentVersionNumber || 1}
                                                </Tag>
                                                <Tag color={isPendingAdvisor ? 'processing' : isPendingDept ? 'purple' : 'default'}>
                                                    {req.status}
                                                </Tag>
                                            </Space>
                                        </div>

                                        <Descriptions size="small" bordered column={1} className="my-3 bg-slate-50/50">
                                            <Descriptions.Item label="Tên đề tài đã giao">
                                                <span className="text-slate-700">{currentVersion?.registeredTitleSnapshot || topic?.title}</span>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Tên đề tài mới xin đổi">
                                                <strong className="text-blue-700">{currentVersion?.proposedTitle}</strong>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Lý do điều chỉnh">
                                                <span className="text-slate-600 italic">{currentVersion?.reason}</span>
                                            </Descriptions.Item>
                                        </Descriptions>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                            {isPendingAdvisor && (
                                                <>
                                                    <Button
                                                        danger
                                                        icon={<CloseCircleOutlined />}
                                                        disabled={submittingBm02a}
                                                        onClick={() => openReturnModal(req, 'ADVISOR')}
                                                    >
                                                        Trả lại chỉnh sửa
                                                    </Button>
                                                    <Button
                                                        type="primary"
                                                        icon={<FileDoneOutlined />}
                                                        loading={submittingBm02a}
                                                        className="!bg-[#0052a3]"
                                                        onClick={() => handleAdvisorSign(req)}
                                                    >
                                                        GVHD ký duyệt BM02-A
                                                    </Button>
                                                </>
                                            )}

                                            {isPendingDept && (
                                                <>
                                                    <Button
                                                        danger
                                                        icon={<CloseCircleOutlined />}
                                                        disabled={submittingBm02a}
                                                        onClick={() => openReturnModal(req, 'DEPARTMENT_HEAD')}
                                                    >
                                                        Từ chối duyệt
                                                    </Button>
                                                    <Button
                                                        type="primary"
                                                        icon={<FileDoneOutlined />}
                                                        loading={submittingBm02a}
                                                        className="!bg-purple-600 hover:!bg-purple-700"
                                                        onClick={() => handleDepartmentSign(req)}
                                                    >
                                                        Phê duyệt và Ký số
                                                    </Button>
                                                </>
                                            )}

                                            {!isPendingAdvisor && !isPendingDept && req.finalPdfFileUrl && (
                                                <Button
                                                    icon={<SearchOutlined />}
                                                    href={req.finalPdfFileUrl}
                                                    target="_blank"
                                                >
                                                    Xem bản PDF đã duyệt
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
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

            {/* MODAL: TRẢ LẠI / TỪ CHỐI PHIẾU BM02-A */}
            <Modal
                title={returningRole === 'DEPARTMENT_HEAD' ? 'Từ chối phê duyệt phiếu BM02-A' : 'Trả lại yêu cầu chỉnh sửa BM02-A'}
                open={returnModalOpen}
                onCancel={() => setReturnModalOpen(false)}
                footer={[
                    <Button key="cancel" icon={<CloseOutlined />} onClick={() => setReturnModalOpen(false)}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger
                        loading={submittingBm02a}
                        icon={<CheckOutlined />}
                        onClick={handleReturnSubmit}
                    >
                        Xác nhận trả lại
                    </Button>,
                ]}
            >
                <div className="space-y-3 pt-2">
                    <Alert
                        type="warning"
                        showIcon
                        message="Lưu ý quy định trả lại BM02-A"
                        description={
                            returningRole === 'ADVISOR'
                                ? 'Nếu đây là phiên bản v1 và còn trong hạn 168 giờ, sinh viên sẽ được nộp lại bản sửa v2 duy nhất 01 lần.'
                                : 'Phụ trách bộ môn trả lại sẽ chuyển hồ sơ sang trạng thái từ chối hoặc yêu cầu sửa theo quy định.'
                        }
                    />
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Lý do trả lại / yêu cầu chỉnh sửa:
                        </label>
                        <TextArea
                            rows={3}
                            placeholder="Nêu rõ lý do và nội dung cần điều chỉnh..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
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
                    fetchData();
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
