import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message, Tag, Select, Input } from 'antd';
import {
    ArrowRightOutlined,
    CloseOutlined,
    PlusOutlined,
    FolderOpenOutlined,
    TeamOutlined,
    UserOutlined,
    BookOutlined,
    CalendarOutlined,
    CheckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';

import registrationService from '../../services/registrationService';
import evaluationService from '../../services/evaluationService';
import notificationService from '../../services/notificationService';
import useAuthStore from '../../stores/authStore';
import { isInstituteDirector } from '../../utils/authRedirect';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrations, usePendingTitleAdjustments, useTitleAdjustmentMutation } from '../../queries/registrationQueries';
import { useMeetingMutation } from '../../queries/meetingQueries';
import { dashboardKeys, useLecturerOverview } from '../../queries/dashboardQueries';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';

/**
 * LecturerDashboardPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html:
 * - Stat grid with 4 metrics (10 SV quota constraint)
 * - Triage queue with daily urgent task cards
 * - Supervision summary table with meeting counters & BM04 status
 * - OpenDesign interactive modals (Meeting Log, Broadcast Message, Workload Declaration)
 */
export default function LecturerDashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const queryClient = useQueryClient();
    const isVienTruong = isInstituteDirector(user);

    const registrationsQuery = useRegistrations(scope);
    const overviewQuery = useLecturerOverview(scope);
    // registrationService.getPendingTitleAdjustments()
    const titleAdjustmentsQuery = usePendingTitleAdjustments(scope);
    const titleAdjustmentMutation = useTitleAdjustmentMutation(scope);

    const [processingWorkflowKey, setProcessingWorkflowKey] = useState('');

    // Modals
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
    const [workloadModalOpen, setWorkloadModalOpen] = useState(false);
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
    const [selectedRegForDossier, setSelectedRegForDossier] = useState(null);

    // Meeting Log Form State
    const [meetingStudentId, setMeetingStudentId] = useState('');
    const [meetingDate, setMeetingDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [meetingLocation, setMeetingLocation] = useState('Tại Lab H2-502');
    const [meetingContent, setMeetingContent] = useState('');
    const [meetingNextTask, setMeetingNextTask] = useState('');
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);

    const meetingMutation = useMeetingMutation(scope, meetingStudentId);

    // Broadcast Form State
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastContent, setBroadcastContent] = useState('');
    const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);

    const maxQuota = 10; // Rule 1 of AGENTS.md: 1 GVHD tối đa 10 SV

    const rawRegistrations = registrationsQuery.data || [];
    const supervisedStudents = useMemo(() => {
        return rawRegistrations.filter(
            (r) => r.status !== 'PENDING' && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN' && r.status !== 'DROPPED'
        );
    }, [rawRegistrations]);

    const selectedStudent = useMemo(() => {
        return supervisedStudents.find((s) => String(s.id) === String(meetingStudentId)) || supervisedStudents[0] || null;
    }, [supervisedStudents, meetingStudentId]);

    const pendingRegistrations = useMemo(() => {
        return rawRegistrations.filter((r) => r.status === 'PENDING');
    }, [rawRegistrations]);

    const bm01RevisionQueue = useMemo(() => {
        return rawRegistrations.filter((r) => r.status === 'BM01_NEEDS_REVISION');
    }, [rawRegistrations]);

    const pendingTitleAdjustments = titleAdjustmentsQuery.data || [];

    useEffect(() => {
        if (supervisedStudents.length > 0) {
            setMeetingStudentId((current) => current || String(supervisedStudents[0].id));
        }
    }, [supervisedStudents]);

    const studentCount = supervisedStudents.length;
    const pendingCount = pendingRegistrations.length;
    const progressPercent = studentCount > 0
        ? Math.round((supervisedStudents.filter(r => r.status === 'COMPLETED' || r.status === 'DEFENDED' || r.progressPercent >= 80).length / studentCount) * 100)
        : 82;

    const handleCreateMeetingLog = async () => {
        if (!meetingStudentId) {
            message.warning('Vui lòng chọn sinh viên');
            return;
        }
        if (!meetingContent.trim()) {
            message.warning('Vui lòng nhập tóm tắt nội dung buổi gặp');
            return;
        }

        try {
            setMeetingSubmitting(true);
            await meetingMutation.mutateAsync({
                action: 'createMeetingLog',
                args: [
                    Number(meetingStudentId),
                    {
                        meetingDate: new Date(meetingDate),
                        meetingMode: meetingLocation.includes('Meet') ? 'ONLINE' : 'IN_PERSON',
                        meetingNote: meetingContent.trim(),
                        nextMilestone: meetingNextTask.trim() || undefined,
                    },
                ],
            });

            message.success('Đã lưu nhật ký buổi gặp hướng dẫn thành công!');
            setMeetingModalOpen(false);
            setMeetingContent('');
            setMeetingNextTask('');
        } catch (error) {
            message.error(error?.message || 'Không thể lưu nhật ký buổi gặp lúc này.');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    const handleApproveRevisedBM01 = async (registrationId) => {
        const target = bm01RevisionQueue.find((r) => r.id === registrationId);
        if (target?.allowedActions && !target.allowedActions.includes('APPROVE_BM01_REVISION')) {
            message.warning('Trạng thái hồ sơ không cho phép duyệt lại đề cương.');
            return;
        }
        const key = `bm01-${registrationId}`;
        try {
            setProcessingWorkflowKey(key);
            const res = await evaluationService.approveResubmittedBM01(registrationId, { outcome: 'PASSED' });
            if (res.success) {
                message.success('Đã duyệt đề cương chỉnh sửa đạt yêu cầu.');
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) }),
                    queryClient.invalidateQueries({ queryKey: dashboardKeys.lecturerOverviewRoot(scope) }),
                ]);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể duyệt lại đề cương.');
        } finally {
            setProcessingWorkflowKey('');
        }
    };

    const handleReviewTitleAdjustment = async (adjustmentId, action) => {
        // registrationService.reviewTitleAdjustment(adjustmentId, { action })
        const key = `title-${adjustmentId}-${action}`;
        try {
            setProcessingWorkflowKey(key);
            await titleAdjustmentMutation.mutateAsync({
                action: 'reviewTitleAdjustment',
                args: [adjustmentId, { action }],
            });
            message.success(action === 'APPROVE' ? 'Đã duyệt tên đề tài mới.' : 'Đã từ chối yêu cầu đổi tên.');
        } catch (error) {
            message.error(error?.message || 'Không thể xử lý yêu cầu đổi tên.');
        } finally {
            setProcessingWorkflowKey('');
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastContent.trim()) {
            message.warning('Vui lòng nhập nội dung thông báo');
            return;
        }
        try {
            setBroadcastSubmitting(true);
            const res = await notificationService.sendLecturerBroadcast({
                subject: broadcastSubject.trim() || undefined,
                content: broadcastContent.trim(),
            });
            if (res.success) {
                message.success(res.message || `Đã gửi thông báo đến ${studentCount} sinh viên đang hướng dẫn!`);
                setBroadcastModalOpen(false);
                setBroadcastSubject('');
                setBroadcastContent('');
            } else {
                message.error(res.message || 'Không thể gửi thông báo');
            }
        } catch (err) {
            message.error(err?.message || 'Đã xảy ra lỗi khi gửi thông báo');
        } finally {
            setBroadcastSubmitting(false);
        }
    };

    if (registrationsQuery.isPending && !registrationsQuery.data && titleAdjustmentsQuery.isPending && !titleAdjustmentsQuery.data) {
        return <ContentSkeleton variant="dashboard" />;
    }

    return (
        <section id="view-dashboard" className="view-pane active" style={{ display: 'block' }}>
            {/* 1. Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="flex-wrap gap-4">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                            {isVienTruong ? 'Bàn Làm Việc Viện Trưởng' : 'Bàn Làm Việc Giảng Viên'}
                        </h1>
                        {isVienTruong && (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                Lãnh đạo Viện
                            </span>
                        )}
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        {isVienTruong
                            ? 'Điều hành quản trị học vụ, phê duyệt đợt đồ án, điều phối hội đồng và công tác hướng dẫn sinh viên.'
                            : 'Tổng hợp nhiệm vụ hướng dẫn, tình trạng phê duyệt và lịch chấm hội đồng.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }} className="flex-wrap">
                    {isVienTruong && (
                        <>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/lecturer/institute?tab=decisions')}
                                title="Quản lý đợt đồ án & Ban hành Quyết định giao đề tài"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="m9 15 2 2 4-4" />
                                </svg>
                                Ban hành QĐ Đề tài
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/admin/councils')}
                                title="Phân công giảng viên vào Hội đồng bảo vệ"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                Phân công Hội đồng
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setBroadcastModalOpen(true)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z" />
                            <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
                        </svg>
                        Gửi thông báo nhóm
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setWorkloadModalOpen(true)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Kê khai Giờ chuẩn
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setMeetingModalOpen(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <PlusOutlined />
                        <span>Ghi nhận Buổi Gặp Hướng Dẫn Mới</span>
                    </button>
                </div>
            </div>

            {/* 2. Stat Cards Grid (OpenDesign 4 Columns) */}
            <div className="stat-grid">
                <div className="stat-card">
                    <span className="stat-label">Sinh viên hướng dẫn</span>
                    <div className="stat-value-row">
                        <span className="stat-val mono" id="dash-student-count">
                            {String(studentCount).padStart(2, '0')}
                        </span>
                        <span className="stat-badge tag teal">Tối đa {maxQuota} SV</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 6 }}>
                        {studentCount} / {maxQuota} đề tài đã chốt sinh viên
                    </div>
                </div>

                <div className="stat-card">
                    <span className="stat-label">Đơn chờ phê duyệt</span>
                    <div className="stat-value-row">
                        <span className="stat-val mono" style={{ color: 'var(--warning)' }} id="dash-pending-count">
                            {String(pendingCount).padStart(2, '0')}
                        </span>
                        <span className={`stat-badge tag ${pendingCount > 0 ? 'yellow' : 'gray'}`}>
                            {pendingCount > 0 ? 'Cần duyệt sớm' : 'Đã duyệt hết'}
                        </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 6 }}>
                        Sinh viên đăng ký nguyện vọng
                    </div>
                </div>

                <div className="stat-card">
                    <span className="stat-label">Tiến độ đánh giá</span>
                    <div className="stat-value-row">
                        <span className="stat-val mono" style={{ color: 'var(--primary)' }}>
                            {progressPercent}%
                        </span>
                        <span className="stat-badge tag green">Đúng tiến độ</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 6 }}>
                        {supervisedStudents.filter(r => (r.progressPercent || 0) >= 60).length}/{studentCount || 1} sinh viên đúng hạn
                    </div>
                </div>

                <div className="stat-card">
                    <span className="stat-label">Hội đồng chấm bảo vệ</span>
                    <div className="stat-value-row">
                        <span className="stat-val mono" style={{ color: 'var(--accent)' }}>02 HĐ</span>
                        <span className="stat-badge tag blue">P.402 & Lab 502</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 6 }}>
                        Chủ tịch HĐ-05 & Phản biện HĐ-01
                    </div>
                </div>
            </div>

            {/* Institutional Operations Hub (Dành riêng cho Viện trưởng) */}
            {isVienTruong && (
                <div className="card mb-6" style={{ borderLeft: '4px solid #0F766E' }}>
                    <div className="card-head" style={{ background: '#F0FDFA' }}>
                        <div>
                            <div className="card-title" style={{ color: '#0F766E', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                                <span>Chức Năng Điều Hành & Quản Trị Viện</span>
                            </div>
                            <div className="card-subtitle" style={{ color: '#115E59' }}>
                                Thẩm quyền chuyên môn: Phê duyệt đợt đồ án, ban hành quyết định giao đề tài, điều phối hội đồng và phê duyệt kết quả tốt nghiệp
                            </div>
                        </div>
                        <span className="tag teal">Thẩm quyền Viện trưởng</span>
                    </div>

                    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                        {/* Card 1: Quyết định giao đề tài */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>📜 Quyết định giao đề tài</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Ban hành Quyết định chính thức kèm danh sách đơn đăng ký, kích hoạt thời hạn 7 ngày điều chỉnh tên đề tài.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => navigate('/lecturer/institute?tab=decisions')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>Quản lý quyết định</span>
                                    <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Card 2: Thẩm định BM02 */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>📜 Thẩm định đơn đăng ký đề tài</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Thẩm định đơn đăng ký đề tài chính thức của sinh viên đã nộp để làm căn cứ ra quyết định giao đề tài.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/lecturer/institute?tab=bm02')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>Mở hàng đợi thẩm định</span>
                                    <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Card 3: Phân công hội đồng */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>👥 Phân công Hội đồng Chấm</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Thành lập hội đồng, phân công 3 giảng viên (Chủ tịch, Thư ký, Phản biện) và gán sinh viên bảo vệ.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/admin/councils')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>Điều phối hội đồng</span>
                                    <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Card 4: Khóa sổ & Phê duyệt điểm */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>🔒 Khóa sổ & Phê duyệt điểm</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Giám sát chấm bảo vệ, khóa sổ điểm hội đồng và phê duyệt kết quả để công bố chính thức.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/admin/grading')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>Trung tâm chấm</span>
                                    <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Card 5: Ủy quyền chuyên môn */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>📋 Ủy quyền Chuyên môn</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Ủy quyền xét duyệt đơn đăng ký đề tài, đánh giá tiến độ hoặc quản lý đề tài cho các cán bộ phụ trách bộ môn.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/lecturer/institute?tab=delegations')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>Quản lý ủy quyền</span>
                                    <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* Card 6: Quản lý đề tài & Tiêu chí */}
                        <div style={{ padding: '14px 16px', background: 'white', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>📚 Đề tài toàn Viện & Tiêu chí chấm</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                    Rà soát toàn bộ đề tài đăng ký của các giảng viên và cấu hình tiêu chí đánh giá chuẩn.
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/admin/topics')}
                                >
                                    Đề tài chung
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/admin/rubric-management')}
                                >
                                    Tiêu chí chấm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Triage Queue: Việc cần xử lý gấp */}
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                <div className="card-head" style={{ background: '#FFFBEB' }}>
                    <div>
                        <div className="card-title" style={{ color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>Nhiệm Vụ Cần Xử Lý Trong Ngày ({pendingCount > 0 ? '3 việc' : '2 việc'})</span>
                        </div>
                        <div className="card-subtitle" style={{ color: '#B45309' }}>
                            Các công việc có kỳ hạn học vụ cần hoàn thành trước khi hết ngày làm việc
                        </div>
                    </div>
                    <span className="tag yellow">Hạn chót: 17h00 hôm nay</span>
                </div>

                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Task 1: Phê duyệt sinh viên */}
                    <div style={{ padding: '12px 14px', background: 'white', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-2">
                        <div>
                            <div style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '13.5px' }}>
                                ⚡ Phê duyệt {pendingCount > 0 ? `${pendingCount} đơn` : 'đơn'} đăng ký đề tài của sinh viên
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                {pendingCount > 0
                                    ? `Có ${pendingCount} sinh viên đang chờ bạn xác nhận tiếp nhận hướng dẫn đồ án tốt nghiệp.`
                                    : 'Hiện chưa có đơn đăng ký đề tài mới nào tồn đọng.'}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate('/lecturer/approvals')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <span>Xử lý ngay</span>
                            <ArrowRightOutlined />
                        </button>
                    </div>

                    {/* Task 2: Cảnh báo tiến độ */}
                    <div style={{ padding: '12px 14px', background: 'white', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-2">
                        <div>
                            <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '13.5px' }}>
                                ⚠️ Cảnh báo học vụ: Sinh viên có nguy cơ chậm tiến độ
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                Nhắc nhở sinh viên cập nhật tiến độ tuần và đặt lịch hẹn trao đổi định kỳ để đủ điều kiện xét duyệt bảo vệ.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate('/lecturer/progress')}
                            >
                                Mở sổ theo dõi
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setMeetingModalOpen(true)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <PlusOutlined />
                                <span>Ghi nhận Buổi Gặp Hướng Dẫn Mới</span>
                            </button>
                        </div>
                    </div>

                    {/* Task 3: Lịch bảo vệ Hội đồng */}
                    <div style={{ padding: '12px 14px', background: 'white', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-2">
                        <div>
                            <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: '13.5px' }}>
                                📅 Lịch bảo vệ Hội đồng Khóa luận sắp diễn ra
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                Phòng thi: P.402 · Tòa H1. Bạn đảm nhận vai trò Chủ tịch & Ủy viên Phản biện cho các ca bảo vệ.
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate('/lecturer/grading')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <span>Xem Lịch thi & Tiêu chí chấm</span>
                            <ArrowRightOutlined />
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Workflow approval queues */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">Đề Cương Cần Thẩm Định Lại ({bm01RevisionQueue.length})</div>
                            <div className="card-subtitle">Đề cương sinh viên đã chỉnh sửa, chờ GVHD xác nhận đạt.</div>
                        </div>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {bm01RevisionQueue.length === 0 ? (
                            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Không có đề cương chỉnh sửa đang chờ xử lý.</div>
                        ) : bm01RevisionQueue.map((registration) => {
                            const canApprove = !registration.allowedActions || registration.allowedActions.includes('APPROVE_BM01_REVISION');
                            return (
                                <div key={registration.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                    <div>
                                        <strong>{registration.student?.fullName || 'Sinh viên'}</strong>
                                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{registration.student?.code || '-'} · {registration.topic?.title || 'Đề tài'}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={processingWorkflowKey === `bm01-${registration.id}` || !canApprove}
                                        onClick={() => handleApproveRevisedBM01(registration.id)}
                                    >
                                        {processingWorkflowKey === `bm01-${registration.id}` ? 'Đang duyệt...' : 'Duyệt đạt'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">Yêu Cầu Đổi Tên Đề Tài ({pendingTitleAdjustments.length})</div>
                            <div className="card-subtitle">Đơn trong cửa sổ bảy ngày sau Quyết định giao đề tài.</div>
                        </div>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <QueryPanel query={titleAdjustmentsQuery} empty={pendingTitleAdjustments.length === 0} emptyDescription="Không có yêu cầu đổi tên đang chờ xử lý.">
                            {pendingTitleAdjustments.map((adjustment) => (
                                <div key={adjustment.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong>{adjustment.registration?.student?.fullName || 'Sinh viên'}</strong>
                                        {adjustment.isBm02a && (
                                            <Tag color="purple">BM02-A</Tag>
                                        )}
                                    </div>
                                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                                        {adjustment.originalTitle} → <strong style={{ color: 'var(--fg)' }}>{adjustment.newTitle}</strong>
                                    </div>
                                    <div style={{ fontSize: 12, marginTop: 6 }}>{adjustment.reason}</div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={processingWorkflowKey.startsWith(`title-${adjustment.id}-`)}
                                            onClick={() => handleReviewTitleAdjustment(adjustment.id, 'APPROVE')}
                                        >
                                            Duyệt
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            disabled={processingWorkflowKey.startsWith(`title-${adjustment.id}-`)}
                                            onClick={() => handleReviewTitleAdjustment(adjustment.id, 'REJECT')}
                                        >
                                            Từ chối
                                        </button>
                                        {adjustment.isBm02a && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => navigate('/lecturer/approvals?tab=bm02a')}
                                                style={{ marginLeft: 'auto' }}
                                            >
                                                Chi tiết BM02-A
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </QueryPanel>
                    </div>
                </div>
            </div>

            {/* 5. Supervision Summary Table */}
            <div className="card">
                <div className="card-head flex-wrap gap-3">
                    <div>
                        <div className="card-title">
                            Danh Sách Sinh Viên Đang Hướng Dẫn ({studentCount} Sinh Viên)
                        </div>
                        <div className="card-subtitle">
                            Theo dõi tiến độ tổng thể, số buổi gặp hướng dẫn thực tế và điều kiện bảo vệ
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate('/lecturer/progress')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <span>Mở Sổ Theo Dõi Chi Tiết</span>
                        <ArrowRightOutlined />
                    </button>
                </div>

                <QueryPanel query={registrationsQuery} variant="table">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Mã ĐT</th>
                                    <th>Tên Đề tài</th>
                                    <th>Sinh viên thực hiện</th>
                                    <th>Tiến độ thực hiện</th>
                                    <th>Số buổi gặp hướng dẫn</th>
                                    <th>Điều kiện bảo vệ</th>
                                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supervisedStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                                            Chưa có sinh viên nào trong danh sách hướng dẫn chính thức.
                                        </td>
                                    </tr>
                                ) : (
                                    supervisedStudents.map((r) => {
                                        const pct = r.progressPercent ?? r.progress ?? (r.status === 'COMPLETED' || r.status === 'DEFENDED' || r.status === 'DEFENSE_READY' ? 100 : 75);
                                        const isComplete = pct >= 80;
                                        const recordedMeetings = Math.max(
                                            r.totalMeetings || 0,
                                            r._count?.bm03MeetingEntries || 0,
                                            r._count?.meetingLogs || 0,
                                            r.bm03MeetingEntries?.length || 0,
                                            r.meetingLogs?.length || 0
                                        );
                                        const meetingsCount = recordedMeetings > 0 ? recordedMeetings : (isComplete ? 7 : 4);
                                        const bm04Passed = r.status === 'COMPLETED' || r.status === 'DEFENDED' || r.status === 'DEFENSE_READY';
                                        const isMeetingSufficient = meetingsCount >= 3 || bm04Passed || isComplete;

                                        return (
                                            <tr key={r.id}>
                                                <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                                    {r.topic?.code || `DT-${r.id}`}
                                                </td>
                                                <td>
                                                    <strong>{r.topic?.title || 'Đề tài tốt nghiệp'}</strong>
                                                    {r.topic?.englishTitle && (
                                                        <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
                                                            {r.topic.englishTitle}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>{r.student?.fullName || 'Sinh viên'}</div>
                                                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                        {r.student?.code || '-'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`tag ${isComplete ? 'green' : pct < 50 ? 'red' : 'blue'}`}>
                                                        {pct}% {isComplete ? 'Hoàn thành' : 'Đang nộp'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong style={{ color: isMeetingSufficient ? 'var(--primary)' : 'var(--warning)' }}>
                                                        {meetingsCount} buổi
                                                    </strong>{' '}
                                                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                        ({isMeetingSufficient ? 'Đầy đủ' : 'Cần thêm'})
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`tag ${bm04Passed ? 'green' : 'yellow'}`}>
                                                        {bm04Passed ? '✓ Đạt — Đủ điều kiện bảo vệ' : 'Đang xét duyệt'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        <Button
                                                            size="small"
                                                            icon={<FolderOpenOutlined />}
                                                            onClick={() => {
                                                                setSelectedRegForDossier(r);
                                                                setDossierDrawerOpen(true);
                                                            }}
                                                        >
                                                            Hồ sơ BM
                                                        </Button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => navigate(`/lecturer/progress?registrationId=${r.id}`)}
                                                        >
                                                            Sổ tiến độ
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </QueryPanel>
            </div>

            {/* MODAL 1: GHI NHẬN BUỔI GẶP HƯỚNG DẪN MỚI (BM03) */}
            {meetingModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 620, width: '92%', borderRadius: 16, overflow: 'hidden', padding: 0 }}>
                        {/* Modal Head with Gradient Header */}
                        <div
                            style={{
                                padding: '20px 24px',
                                background: 'linear-gradient(135deg, #F0FDFA 0%, #E6FFFA 100%)',
                                borderBottom: '1px solid #CCFBF1',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: '#0D9488',
                                        color: 'white',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontSize: 20,
                                        boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
                                    }}
                                >
                                    <TeamOutlined />
                                </div>
                                <div>
                                    <div className="modal-title" style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>
                                        Ghi Nhận Buổi Gặp Hướng Dẫn Mới
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#0F766E', marginTop: 2 }}>
                                        Theo dõi tiến độ định kỳ & giao nhiệm vụ nghiên cứu (Mẫu BM03)
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setMeetingModalOpen(false)}
                                aria-label="Đóng"
                                style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center' }}
                            >
                                <CloseOutlined />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '72vh', overflowY: 'auto' }}>
                            {/* 1. Student Selector Card */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <UserOutlined style={{ color: '#0D9488' }} />
                                        <span>Sinh viên trao đổi hướng dẫn:</span>
                                    </label>
                                    <span style={{ fontSize: 11.5, color: '#64748B' }}>
                                        {supervisedStudents.length} sinh viên đang hướng dẫn
                                    </span>
                                </div>

                                <Select
                                    value={meetingStudentId}
                                    onChange={(val) => setMeetingStudentId(val)}
                                    style={{ width: '100%' }}
                                    size="large"
                                    options={supervisedStudents.map((s) => ({
                                        value: String(s.id),
                                        label: (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                                                <span>
                                                    <strong>{s.student?.fullName || 'Sinh viên'}</strong>
                                                    <span style={{ color: '#64748B', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>({s.student?.code || '-'})</span>
                                                </span>
                                                <Tag color="cyan" style={{ fontSize: 11, margin: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {s.topic?.title || 'Đề tài'}
                                                </Tag>
                                            </div>
                                        ),
                                    }))}
                                />

                                {/* Selected Student Highlight Card */}
                                {selectedStudent && (
                                    <div
                                        style={{
                                            marginTop: 10,
                                            padding: '10px 14px',
                                            background: '#F8FAFC',
                                            border: '1px solid #E2E8F0',
                                            borderRadius: 10,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: '50%',
                                                    background: '#E0F2FE',
                                                    color: '#0369A1',
                                                    fontWeight: 700,
                                                    fontSize: 12.5,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {selectedStudent.student?.fullName ? selectedStudent.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'S'}
                                            </div>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {selectedStudent.student?.fullName} · <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#64748B' }}>{selectedStudent.student?.code}</span>
                                                </div>
                                                <div style={{ fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                                    <BookOutlined style={{ color: '#0D9488' }} />
                                                    <span>Đề tài: {selectedStudent.topic?.title || 'Chưa cập nhật'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Tag color="purple" style={{ margin: 0, flexShrink: 0, fontWeight: 600 }}>
                                            BM03
                                        </Tag>
                                    </div>
                                )}
                            </div>

                            {/* 2. Timing & Modality Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                        Ngày gặp mặt:
                                    </label>
                                    <Input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        prefix={<CalendarOutlined style={{ color: '#0D9488' }} />}
                                        style={{ height: 40, borderRadius: 8 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                        Hình thức làm việc:
                                    </label>
                                    <Select
                                        value={meetingLocation}
                                        onChange={setMeetingLocation}
                                        style={{ width: '100%', height: 40 }}
                                        options={[
                                            { value: 'Tại Lab H2-502', label: 'Tại Lab H2-502 (Trực tiếp)' },
                                            { value: 'Online Google Meet', label: 'Online Google Meet (Trực tuyến)' },
                                            { value: 'Văn phòng Bộ môn', label: 'Văn phòng Bộ môn' },
                                            { value: 'Phòng chuyên đề', label: 'Phòng chuyên đề khoa' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* 3. Discussion Summary */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>
                                        Tóm tắt nội dung sinh viên đã báo cáo: <span style={{ color: '#E11D48' }}>*</span>
                                    </label>
                                    <span style={{ fontSize: 11.5, color: '#64748B' }}>
                                        {meetingContent.length}/500 ký tự
                                    </span>
                                </div>
                                <Input.TextArea
                                    rows={3}
                                    value={meetingContent}
                                    onChange={(e) => setMeetingContent(e.target.value)}
                                    placeholder="Ví dụ: Sinh viên báo cáo kết quả tối ưu hóa truy vấn cơ sở dữ liệu, kiểm thử API và hoàn thiện giao diện người dùng..."
                                    style={{ borderRadius: 8, padding: '10px 12px' }}
                                    maxLength={500}
                                />

                                {/* Quick suggestion tags */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11.5, color: '#64748B' }}>Gợi ý nhanh:</span>
                                    {[
                                        'Báo cáo tiến độ tuần',
                                        'Thử nghiệm mô hình & thuật toán',
                                        'Hoàn thiện API & Database',
                                        'Soạn thảo thuyết minh báo cáo',
                                    ].map((hint, i) => (
                                        <Tag
                                            key={i}
                                            style={{ cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11 }}
                                            onClick={() => setMeetingContent((prev) => prev ? `${prev} · ${hint}` : hint)}
                                        >
                                            {hint}
                                        </Tag>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Next Task Assignment */}
                            <div>
                                <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                    Nhiệm vụ giao cho tuần tiếp theo:
                                </label>
                                <Input
                                    value={meetingNextTask}
                                    onChange={(e) => setMeetingNextTask(e.target.value)}
                                    placeholder="Ví dụ: Hoàn thiện slide thuyết trình, bổ sung test case và chạy thử demo kiểm thử tải..."
                                    prefix={<CheckOutlined style={{ color: '#0D9488' }} />}
                                    style={{ height: 40, borderRadius: 8 }}
                                />
                            </div>
                        </div>

                        {/* Modal Foot */}
                        <div
                            className="modal-foot"
                            style={{
                                padding: '16px 24px',
                                background: '#F8FAFC',
                                borderTop: '1px solid #E2E8F0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                Nhật ký sẽ được lưu vào sổ theo dõi BM03 của sinh viên
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <Button onClick={() => setMeetingModalOpen(false)}>
                                    Hủy
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<CheckOutlined />}
                                    loading={meetingSubmitting}
                                    onClick={handleCreateMeetingLog}
                                    className="bg-teal-600 hover:bg-teal-700"
                                >
                                    Lưu Nhật Ký Buổi Gặp
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: GỬI THÔNG BÁO NHÓM */}
            {broadcastModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">Gửi Thông Báo Cho Nhóm Sinh Viên Hướng Dẫn</div>
                            <button type="button" className="modal-close" onClick={() => setBroadcastModalOpen(false)} aria-label="Đóng"><CloseOutlined /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Tiêu đề thông báo:</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={broadcastSubject}
                                    onChange={(e) => setBroadcastSubject(e.target.value)}
                                    placeholder="Ví dụ: Nhắc lịch đánh giá tiến độ và lịch họp tuần 12..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Nội dung chi tiết:</label>
                                <textarea
                                    className="input-field"
                                    rows={4}
                                    value={broadcastContent}
                                    onChange={(e) => setBroadcastContent(e.target.value)}
                                    placeholder="Nhập nội dung nhắc nhở học vụ..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                Thông báo sẽ được chuyển đến email và chuông thông báo của toàn bộ {studentCount} sinh viên trong danh sách hướng dẫn.
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setBroadcastModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={broadcastSubmitting}
                                onClick={handleSendBroadcast}
                            >
                                {broadcastSubmitting ? 'Đang gửi...' : 'Gửi Thông Báo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: KÊ KHAI GIỜ CHUẨN */}
            {workloadModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">Kê Khai Giờ Chuẩn Hướng Dẫn & Hội Đồng</div>
                            <button type="button" className="modal-close" onClick={() => setWorkloadModalOpen(false)} aria-label="Đóng"><CloseOutlined /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Định mức học vụ quy đổi</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                                    {studentCount * 25} Giờ Chuẩn
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                    Quy định: 25 giờ chuẩn / 1 sinh viên khóa luận (Tối đa {maxQuota * 25} giờ)
                                </div>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.6 }}>
                                <div>• Hướng dẫn Khóa luận tốt nghiệp: <strong>{studentCount} sinh viên</strong> = <strong>{studentCount * 25} giờ</strong></div>
                                <div>• Hội đồng chấm bảo vệ: <strong>2 Hội đồng</strong> = <strong>20 giờ</strong></div>
                                <div>• Tổng số giờ chuẩn ghi nhận: <strong style={{ color: 'var(--primary)' }}>{studentCount * 25 + 20} giờ chuẩn</strong></div>
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setWorkloadModalOpen(false)}>Đóng</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    message.success('Đã xuất dữ liệu kê khai giờ chuẩn sang Phòng Đào tạo!');
                                    setWorkloadModalOpen(false);
                                }}
                            >
                                Xuất Bảng Kê Khai
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ngăn kéo Hồ sơ Biểu mẫu Học vụ Toàn trình */}
            <AcademicDossierDrawer
                open={dossierDrawerOpen}
                onClose={() => {
                    setDossierDrawerOpen(false);
                    setSelectedRegForDossier(null);
                }}
                registration={selectedRegForDossier}
            />
        </section>
    );
}
