import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, message } from 'antd';
import {
    ArrowRightOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import dashboardService from '../../services/dashboardService';
import registrationService from '../../services/registrationService';
import TitleAdjustmentModal from '../../components/student/TitleAdjustmentModal';

const ACTIVE_FLOW_STATUSES = [
    'APPROVED',
    'BM01_SUBMITTED',
    'BM01_PASSED',
    'BM01_NEEDS_REVISION',
    'BM02_SUBMITTED',
    'DECISION_ISSUED',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENDED',
    'COMPLETED',
    'TERMINATED_FAILED_PROGRESS',
    'TERMINATED_BM04',
];
const WITHDRAWABLE_STATUSES = ['APPROVED', 'BM01_SUBMITTED', 'BM01_PASSED', 'BM01_NEEDS_REVISION', 'BM02_SUBMITTED'];

export default function StudentDashboardPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [allowedActions, setAllowedActions] = useState([]);
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [titleModalOpen, setTitleModalOpen] = useState(false);
    const [bm02ModalOpen, setBm02ModalOpen] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getStudentStats();
            if (res.success) {
                setData(res.data);
                const regId = res.data?.registrationDetails?.registrationId || res.data?.registrationDetails?.id;
                if (regId) {
                    try {
                        const actionRes = await registrationService.getAllowedActions(regId);
                        if (actionRes.success && Array.isArray(actionRes.data?.allowedActions)) {
                            setAllowedActions(actionRes.data.allowedActions);
                        } else {
                            setAllowedActions([]);
                        }
                    } catch {
                        setAllowedActions([]);
                    }
                } else {
                    setAllowedActions([]);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const { hasRegistration, registrationDetails, taskStatus, upcomingDeadlines } = data || {};
    const hasAnyRegistration = hasRegistration ?? false;
    const currentRegistration = registrationDetails ?? null;
    const canWithdraw = hasAnyRegistration && allowedActions.includes('CANCEL_REGISTRATION');
    const nearestDeadline = upcomingDeadlines && upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;
    const titleAdjustmentDeadline = currentRegistration?.decisionDate
        ? dayjs(currentRegistration.decisionDate).add(7, 'day')
        : null;
    const titleAdjustmentDaysRemaining = titleAdjustmentDeadline
        ? Math.max(0, Math.ceil(titleAdjustmentDeadline.diff(dayjs(), 'day', true)))
        : 0;
    const titleAdjustmentOpen = Boolean(titleAdjustmentDeadline && !dayjs().isAfter(titleAdjustmentDeadline));

    const totalTasks = taskStatus?.total || 6;
    const completedTasks = taskStatus?.completed || 0;
    const overdueTasks = taskStatus?.overdue || 0;
    const progressPercent = taskStatus?.progressPercent || (hasAnyRegistration ? 65 : 0);

    const renderRegistrationStatusTag = () => {
        if (!hasAnyRegistration) {
            return <span className="tag red">Chưa đăng ký đề tài</span>;
        }
        const status = currentRegistration?.status;
        if (status === 'PENDING') return <span className="tag yellow">Chờ duyệt đề tài</span>;
        if (status === 'REJECTED') return <span className="tag red">Bị từ chối</span>;
        if (status === 'APPROVED') return <span className="tag teal">Đã nhận đề tài</span>;
        if (status === 'BM01_SUBMITTED') return <span className="tag blue">Chờ duyệt đề cương chi tiết</span>;
        if (status === 'BM01_PASSED') return <span className="tag green">Đề cương đạt (Chờ Quyết định giao đề tài)</span>;
        if (status === 'BM01_NEEDS_REVISION') return <span className="tag red">Đề cương cần chỉnh sửa</span>;
        if (status === 'DECISION_ISSUED') return <span className="tag purple">Đã ban hành Quyết định giao đề tài</span>;
        if (status === 'IN_PROGRESS_BM03') return <span className="tag teal">Đang thực hiện đánh giá tiến độ</span>;
        if (status === 'BM03_SIGNATURE_PENDING') return <span className="tag yellow">Chờ ký biên bản tiến độ (3 ngày)</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') return <span className="tag red">Quá hạn ký biên bản (Mở khiếu nại)</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED') return <span className="tag blue">Đã nộp khiếu nại biên bản tiến độ</span>;
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW') return <span className="tag purple">Đang thẩm định khiếu nại</span>;
        if (status === 'SIGNATURE_APPEAL_RESOLVED') return <span className="tag green">Khiếu nại được giải quyết</span>;
        if (status === 'BM03_PASSED') return <span className="tag green">Đạt đánh giá tiến độ (Hoàn thành tiến độ)</span>;
        if (status === 'BM04_REVIEW') return <span className="tag teal">Đang thẩm định Phiếu nhận xét</span>;
        if (status === 'DEFENSE_READY') return <span className="tag green">Đủ điều kiện bảo vệ</span>;
        if (status === 'DEFENDED') return <span className="tag yellow">Đã bảo vệ</span>;
        if (status === 'COMPLETED') return <span className="tag green">Hoàn tất đồ án</span>;
        if (status === 'TERMINATED_FAILED_PROGRESS') return <span className="tag red">Dừng đề tài (Tiến độ không đạt)</span>;
        if (status === 'TERMINATED_BM04') return <span className="tag red">Dừng đề tài (Phiếu nhận xét chưa đạt)</span>;
        return <span className="tag green">Đang thực hiện · Học kỳ hiện tại</span>;
    };

    const handleWithdrawRegistration = async () => {
        if (!allowedActions.includes('CANCEL_REGISTRATION')) {
            message.warning('Trạng thái hiện tại của hồ sơ không cho phép rút đăng ký.');
            return;
        }
        if (!withdrawReason.trim()) {
            message.warning('Vui lòng nhập lý do rút đăng ký.');
            return;
        }
        if (!currentRegistration?.registrationId) {
            message.error('Không tìm thấy thông tin đăng ký.');
            return;
        }
        try {
            setWithdrawing(true);
            const res = await registrationService.withdrawRegistration(currentRegistration.registrationId, withdrawReason.trim());
            if (res.success) {
                message.success('Đã rút đăng ký thành công.');
                setWithdrawModalOpen(false);
                setWithdrawReason('');
                await fetchDashboardData();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể rút đăng ký lúc này.');
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-dashboard" className="sub-view">
            {/* Topic Hero Banner Card */}
            {hasAnyRegistration && currentRegistration?.topic ? (
                <div className="topic-hero-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ maxWidth: 860 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                <span className="topic-code-pill">
                                    MÃ ĐỀ TÀI: {currentRegistration.topic.code || 'DA-2026-KTPM-04'}
                                </span>
                                {renderRegistrationStatusTag()}
                            </div>
                            <h2 className="topic-hero-title">
                                {currentRegistration.adjustedTitle || currentRegistration.topic.title}
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                                Chuyên ngành: <strong>{currentRegistration.topic.projectCatalogName || 'Kỹ thuật Phần mềm'}</strong> · Học kỳ: <strong>{currentRegistration.topic.semesterName || 'Học kỳ 1 (2026 - 2027)'}</strong>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    const el = document.getElementById('mentor-contact-box');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>Trao đổi GVHD</span>
                            </button>
                            {currentRegistration.decisionNumber ? (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setBm02ModalOpen(true)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span>Quyết định giao đề tài</span>
                                </button>
                            ) : null}
                            {['BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'].includes(currentRegistration?.status) && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => navigate('/student/submissions')}
                                    style={{
                                        background: currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '#DC2626' : '#2563EB',
                                        borderColor: currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '#DC2626' : '#2563EB',
                                        fontWeight: 700,
                                    }}
                                >
                                    {currentRegistration?.status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' ? '⚠️ Khiếu nại biên bản tiến độ' : '✍️ Ký Biên Bản Tiến Độ Ngay'}
                                </button>
                            )}
                            {allowedActions.includes('REQUEST_TITLE_CHANGE') && (
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={!titleAdjustmentOpen}
                                    onClick={() => setTitleModalOpen(true)}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>{titleAdjustmentOpen ? `Đề xuất sửa tên (${titleAdjustmentDaysRemaining} ngày)` : 'Đã hết hạn sửa tên'}</span>
                                </button>
                            )}
                            {canWithdraw && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setWithdrawModalOpen(true)}
                                    style={{ color: '#D97706', borderColor: '#FDE68A' }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span>Xin hoãn/rút</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {allowedActions.includes('REQUEST_TITLE_CHANGE') && titleAdjustmentDeadline && (
                        <div
                            role="status"
                            style={{
                                marginTop: 16,
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: `1px solid ${titleAdjustmentOpen ? '#99F6E4' : '#FECACA'}`,
                                background: titleAdjustmentOpen ? '#F0FDFA' : '#FEF2F2',
                                color: titleAdjustmentOpen ? '#115E59' : '#991B1B',
                                fontSize: 13,
                                fontWeight: 600,
                            }}
                        >
                            {titleAdjustmentOpen
                                ? `Cửa sổ điều chỉnh tên đề tài còn ${titleAdjustmentDaysRemaining} ngày — hạn ${titleAdjustmentDeadline.format('DD/MM/YYYY HH:mm')}.`
                                : `Cửa sổ điều chỉnh tên đề tài đã đóng từ ${titleAdjustmentDeadline.format('DD/MM/YYYY HH:mm')}.`}
                        </div>
                    )}

                    <div className="topic-meta-grid" style={{ marginTop: 20 }}>
                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Giảng viên hướng dẫn</div>
                                <div className="topic-meta-val">
                                    {currentRegistration.topic.mentorName || 'PGS.TS Lê Quang Dũng'}
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Sinh viên thực hiện</div>
                                <div className="topic-meta-val">
                                    {user?.fullName || 'Sinh viên'} (1 SV / 1 đề tài)
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Hạn chót tiếp theo</div>
                                <div className="topic-meta-val" style={{ color: nearestDeadline ? '#DC2626' : 'var(--fg)' }}>
                                    {nearestDeadline ? `${dayjs(nearestDeadline.date).format('DD/MM/YYYY')} (${nearestDeadline.title})` : 'Đang đúng lộ trình'}
                                </div>
                            </div>
                        </div>

                        <div className="topic-meta-item">
                            <div className="topic-meta-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="8" r="7" />
                                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                                </svg>
                            </div>
                            <div>
                                <div className="topic-meta-label">Dự kiến bảo vệ</div>
                                <div className="topic-meta-val" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                    {currentRegistration.status === 'DEFENSE_READY' ? 'Đủ điều kiện ra Hội đồng' :
                                     currentRegistration.status === 'DEFENDED' ? 'Đã bảo vệ xong' :
                                     'Theo lịch Viện CNS'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                        📖
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>Bạn chưa đăng ký đề tài tốt nghiệp</h3>
                    <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.6 }}>
                        Vui lòng duyệt danh sách các đề tài của các Bộ môn đang mở tiếp nhận sinh viên để đăng ký ngay.
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/student/topics')}>
                        <span>Xem Danh Mục Đề Tài Ngay</span>
                        <ArrowRightOutlined style={{ marginLeft: 6 }} />
                    </button>
                </div>
            )}

            {/* 6-Stage Milestone Stepper Flow */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 14" />
                        </svg>
                        <span>Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)</span>
                    </div>
                    <span className="tag green" style={{ fontWeight: 700 }}>
                        {progressPercent}% Hoàn tất
                    </span>
                </div>
                <div className="card-body" style={{ padding: '24px 20px' }}>
                    <div className="milestone-stepper">
                        <div className="milestone-stepper-progress" style={{ width: `${progressPercent}%` }} />

                        <div className={`step-node ${progressPercent >= 16 ? 'completed' : 'active'}`} onClick={() => navigate('/student/topics')}>
                            <div className="step-circle">{progressPercent >= 16 ? '✓' : '1'}</div>
                            <div className="step-label">1. Đăng ký</div>
                            <div className="step-sub">{hasAnyRegistration ? 'Đã duyệt' : 'Chưa đăng ký'}</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 33 ? 'completed' : progressPercent >= 16 ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                            <div className="step-circle">{progressPercent >= 33 ? '✓' : '2'}</div>
                            <div className="step-label">2. Đề cương nghiên cứu chi tiết</div>
                            <div className="step-sub">Xét duyệt đạt</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 50 ? 'completed' : progressPercent >= 33 ? 'active' : ''}`} onClick={() => setBm02ModalOpen(true)}>
                            <div className="step-circle">{progressPercent >= 50 ? '✓' : '3'}</div>
                            <div className="step-label">3. Đơn đăng ký đề tài chính thức</div>
                            <div className="step-sub">{currentRegistration?.decisionNumber || 'Ban hành QĐ'}</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 66 ? 'completed' : progressPercent >= 50 ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                            <div className="step-circle">{progressPercent >= 66 ? '✓' : '4'}</div>
                            <div className="step-label">4. Nhật ký & Đánh giá tiến độ</div>
                            <div className="step-sub">2 Checkpoint</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 83 ? 'completed' : progressPercent >= 66 ? 'active' : ''}`} onClick={() => navigate('/student/submissions')}>
                            <div className="step-circle">{progressPercent >= 83 ? '✓' : '5'}</div>
                            <div className="step-label">5. Phiếu nhận xét của người hướng dẫn</div>
                            <div className="step-sub">Đánh giá GVHD</div>
                        </div>

                        <div className={`step-node ${progressPercent >= 100 ? 'completed' : ''}`} onClick={() => navigate('/student/grades')}>
                            <div className="step-circle">{progressPercent >= 100 ? '✓' : '6'}</div>
                            <div className="step-label">6. Hội đồng bảo vệ</div>
                            <div className="step-sub">Điểm tổng hợp</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4 Key Stat Cards */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon teal">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">{progressPercent}%</div>
                        <div className="stat-label">Tiến độ tổng thể</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">{completedTasks} / {totalTasks}</div>
                        <div className="stat-label">Biểu mẫu hoàn tất</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">18 / 20h</div>
                        <div className="stat-label">Giờ trao đổi GVHD</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </div>
                    <div>
                        <div className="stat-num">
                            {currentRegistration?.mentorScore ? `${Number(currentRegistration.mentorScore).toFixed(1)} / 10` : '8.8 / 10'}
                        </div>
                        <div className="stat-label">Điểm đánh giá GVHD</div>
                    </div>
                </div>
            </div>

            {/* Dashboard Split Grid */}
            <div className="dashboard-split">
                {/* Left Column: Tasks & Mentor */}
                <div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                </svg>
                                <span>Nhiệm vụ & Hạn nộp sắp tới</span>
                            </div>
                            {overdueTasks > 0 ? (
                                <span className="tag red">{overdueTasks} việc quá hạn</span>
                            ) : (
                                <span className="tag green">Tiến độ tốt</span>
                            )}
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            <div className="task-item" style={{ borderLeft: '3px solid #DC2626' }}>
                                <div className="task-left">
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="task-title">Đánh giá tiến độ đợt 2</span>
                                            <span className="task-badge-urgent">Hạn 22/10</span>
                                        </div>
                                        <div className="task-meta">Yêu cầu: Minh chứng mã nguồn Git + Báo cáo kết quả kiểm thử API + Kế hoạch tuần 11-14</div>
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/submissions')}>
                                    Nộp bài
                                </button>
                            </div>

                            <div className="task-item">
                                <div className="task-left">
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="task-title">Gặp GVHD định kỳ tuần 11</span>
                                            <span className="tag blue">Thứ 6, 24/10 · 09:30</span>
                                        </div>
                                        <div className="task-meta">Địa điểm: Văn phòng Bộ môn KTPM (Phòng 502) hoặc Google Meet</div>
                                    </div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/student/submissions')}>
                                    Chi tiết
                                </button>
                            </div>

                            <div className="task-item">
                                <div className="task-left">
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="task-title">Hoàn thiện dự thảo Báo cáo toàn văn & Kiểm tra đạo văn</span>
                                            <span className="tag gray">Hạn 15/11</span>
                                        </div>
                                        <div className="task-meta">Quy định: Tỉ lệ trùng lặp Turnitin &lt; 20% trước khi GVHD ký duyệt Phiếu nhận xét</div>
                                    </div>
                                </div>
                                <span className="tag gray">Chưa mở nộp</span>
                            </div>
                        </div>
                    </div>

                    {/* Team & Mentor Card */}
                    <div className="card" id="mentor-contact-box">
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                </svg>
                                <span>Cán bộ Hướng dẫn & Sinh viên thực hiện</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border-light)' }}>
                                <div className="student-avatar" style={{ width: 48, height: 48, fontSize: 14 }}>
                                    GVHD
                                </div>
                                <div>
                                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                                        {currentRegistration?.topic?.mentorName || 'PGS.TS Lê Quang Dũng'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        Khoa Kỹ thuật Phần mềm · Email: dung.lq@vcs.edu.vn
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                                        Lịch làm việc Lab: Sáng Thứ Ba & Sáng Thứ Sáu hàng tuần
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 14 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                                    Sinh viên phụ trách đề tài:
                                </div>
                                <div style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                                        {user?.fullName || 'Sinh viên'} <span className="tag teal" style={{ marginLeft: 6 }}>Chủ nhiệm đề tài</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                                        MSSV: <strong>{user?.code || '21120489'}</strong> · Email: <strong>{user?.email || 'sinhvien@university.edu.vn'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Academic Announcements & Forms Download */}
                <div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                                <span>Thông báo học vụ quan trọng</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ padding: '10px 12px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F766E' }}>Hạn nộp báo cáo tiến độ đợt 2</div>
                                <div style={{ fontSize: 11.5, color: '#115E59', marginTop: 2 }}>
                                    Hệ thống sẽ khóa cổng nộp tự động lúc 23:59 ngày 22/10/2026. Sinh viên kiểm tra đầy đủ liên kết repository.
                                </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--fg)' }}>Mẫu định dạng Báo cáo toàn văn Đồ án 2026</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                    Viện đã cập nhật mẫu LaTeX & Word chuẩn bìa cứng mới nhất trên Cổng thông tin học vụ.
                                </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--fg)' }}>Tập huấn kiểm tra liêm chính học thuật Turnitin</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                    Buổi chia sẻ trực tuyến vào Thứ Bảy, 25/10/2026 qua MS Teams dành cho toàn thể sinh viên làm KLTN/DACN.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Document Templates Download Card */}
                    <div className="card">
                        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Tài liệu & Biểu mẫu chuẩn</span>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '16px 18px' }}>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Đề cương nghiên cứu chi tiết (.docx)</span>
                                    <button className="btn btn-secondary btn-sm" onClick={() => message.success('Đang tải DeCuong_NghienCuu.docx...')}>Tải về</button>
                                </li>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Nhật ký &amp; Đánh giá tiến độ (.docx)</span>
                                    <button className="btn btn-secondary btn-sm" onClick={() => message.success('Đang tải NhatKy_DanhGiaTienDo.docx...')}>Tải về</button>
                                </li>
                                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                                    <span>Mẫu Slide báo cáo bảo vệ Hội đồng (.pptx)</span>
                                    <button className="btn btn-secondary btn-sm" onClick={() => message.success('Đang tải VCS_Defense_Slide.pptx...')}>Tải về</button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* BM02 Modal View */}
            <Modal
                title="Quyết định Giao Đề tài Tốt nghiệp"
                open={bm02ModalOpen}
                onCancel={() => setBm02ModalOpen(false)}
                footer={[
                    <button key="close" className="btn btn-secondary" onClick={() => setBm02ModalOpen(false)}>
                        Đóng
                    </button>,
                    <button
                        key="print"
                        className="btn btn-primary"
                        onClick={() => {
                            message.success('Đang chuẩn bị văn bản in quyết định số ' + (currentRegistration?.decisionNumber || '458/QĐ-VCS'));
                            setBm02ModalOpen(false);
                        }}
                    >
                        Tải Bản Ký Quyết Định (.pdf)
                    </button>,
                ]}
            >
                <div style={{ padding: '16px 20px', background: '#F8FAFC', borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT · VIỆN CÔNG NGHỆ SỐ</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--institutional)', marginTop: 6 }}>
                            QUYẾT ĐỊNH GIAO ĐỀ TÀI KHÓA LUẬN TỐT NGHIỆP
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            Số: <strong>{currentRegistration?.decisionNumber || '458/QĐ-VCS-ĐT'}</strong> · Ngày ký: {currentRegistration?.decisionDate ? dayjs(currentRegistration.decisionDate).format('DD/MM/YYYY') : '20/09/2026'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p>Tên đề tài: <strong>{currentRegistration?.topic?.title}</strong></p>
                        <p>Sinh viên thực hiện: <strong>{user?.fullName} — MSSV: {user?.code}</strong></p>
                        <p>Cán bộ hướng dẫn: <strong>{currentRegistration?.topic?.mentorName || 'PGS.TS Lê Quang Dũng'}</strong></p>
                        <p>Quy chuẩn đào tạo: Khóa 2023 · Học kỳ 1 (2026 - 2027)</p>
                    </div>
                </div>
            </Modal>

            {/* Title Adjustment Modal */}
            <TitleAdjustmentModal
                open={titleModalOpen}
                onClose={() => setTitleModalOpen(false)}
                registrationId={currentRegistration?.id}
                currentTitle={currentRegistration?.adjustedTitle || currentRegistration?.topic?.title}
                decisionDate={currentRegistration?.decisionDate}
                onSuccess={fetchDashboardData}
            />

            {/* Withdraw Modal */}
            <Modal
                title="Đơn Xin Hoãn / Rút Đề Tài Tốt Nghiệp"
                open={withdrawModalOpen}
                onCancel={() => setWithdrawModalOpen(false)}
                onOk={handleWithdrawRegistration}
                confirmLoading={withdrawing}
                okText="Xác nhận xin rút"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: '#475569' }}>
                        Lưu ý: Sau khi rút đề tài, bạn sẽ không thể phục hồi lại trạng thái đăng ký hiện tại. Vui lòng nêu rõ lý do chính đáng:
                    </p>
                    <Input.TextArea
                        rows={4}
                        placeholder="Nhập lý do xin hoãn hoặc rút đề tài..."
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
}
