import React, { useState, useEffect, useMemo } from 'react';
import { message, Tag } from 'antd';
import registrationService from '../../services/registrationService';
import PageLoader from '../../components/common/PageLoader';
import OutlineReviewModal from '../../components/lecturer/OutlineReviewModal';

/**
 * TopicApprovalPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html (view-approvals):
 * - Tab 1: Phê duyệt nguyện vọng sinh viên đăng ký đề tài (GVHD)
 * - Tab 2: Hội đồng thẩm định đề cương (BM01) lần đầu (Chủ tịch Hội đồng)
 */
export default function TopicApprovalPage() {
    const [activeTab, setActiveTab] = useState('mentor'); // 'mentor' | 'outline'
    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [councilOutlineRegistrations, setCouncilOutlineRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals for Mentor Approval
    const [cvModalOpen, setCvModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Modal for Council Chairman Outline Review
    const [outlineModalOpen, setOutlineModalOpen] = useState(false);
    const [selectedOutlineRecord, setSelectedOutlineRecord] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [mentorRes, outlineRes] = await Promise.all([
                registrationService.getAllRegistrations({ status: 'PENDING' }),
                registrationService.getAllRegistrations({ asCouncilChairman: 'true' }),
            ]);

            if (mentorRes.success) {
                setPendingRegistrations(mentorRes.data || []);
            }
            if (outlineRes.success) {
                setCouncilOutlineRegistrations(outlineRes.data || []);
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
        return councilOutlineRegistrations.filter((r) =>
            ['BM01_SUBMITTED', 'BM01_RESUBMITTED'].includes(r.status)
        ).length;
    }, [councilOutlineRegistrations]);

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
                        Quản lý tiếp nhận hướng dẫn sinh viên và thẩm định đề cương chi tiết BM01 với tư cách Chủ tịch Hội đồng.
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
                    onClick={() => setActiveTab('mentor')}
                >
                    Nguyện Vọng Đăng Ký Hướng Dẫn ({pendingRegistrations.length})
                </div>
                <div
                    className={`seg-tab ${activeTab === 'outline' ? 'active' : ''}`}
                    onClick={() => setActiveTab('outline')}
                >
                    Hội Đồng Thẩm Định Đề Cương (BM01) ({pendingOutlineCount})
                </div>
            </div>

            {/* TAB 1: NGHIỆP VỤ GVHD TIẾP NHẬN HƯỚNG DẪN */}
            {activeTab === 'mentor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pendingRegistrations.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
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
                            const gpa = record.gpa || student?.gpa || '3.45';
                            const credits = record.completedCredits || '132/140';

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
                                                        (MSSV: {student?.code || '-'} · Lớp {student?.class || 'KTPM2021'})
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 4 }}>
                                                    Điểm GPA: <strong style={{ color: 'var(--accent)' }}>{gpa} / 4.0</strong> · Tín chỉ tích lũy: <strong style={{ color: 'var(--success)' }}>{credits}</strong> · Email: <span className="mono">{student?.email || 'Chưa cập nhật'}</span>
                                                </div>
                                            </div>
                                            <span className="tag yellow">Đang chờ bạn duyệt</span>
                                        </div>

                                        <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid var(--border)' }}>
                                            <strong>Nguyện vọng đề tài:</strong> {topic?.code || 'DT-2026'}: <em>"{topic?.title}"</em>
                                            <br />
                                            <div style={{ color: '#475569', marginTop: 6 }}>
                                                <strong>Lời nhắn sinh viên:</strong> "{record.studentNote || record.message || 'Em rất mong muốn được Thầy hướng dẫn nghiên cứu đề tài này để áp dụng kiến thức chuyên ngành vào thực tiễn đồ án tốt nghiệp.'}"
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-3">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => {
                                                    setSelectedStudent({ student, topic, gpa, credits });
                                                    setCvModalOpen(true);
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                Xem Bảng điểm & CV Đính Kèm
                                            </button>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm"
                                                    disabled={submitting}
                                                    onClick={() => {
                                                        setRejectingRecord(record);
                                                        setRejectModalOpen(true);
                                                    }}
                                                >
                                                    ✕ Từ chối
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-success btn-sm"
                                                    disabled={submitting}
                                                    onClick={() => handleApprove(record)}
                                                >
                                                    ✓ Chấp thuận Hướng dẫn
                                                </button>
                                            </div>
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
                        <strong>Quyền hạn Chủ tịch Hội đồng:</strong> Bạn đang xem danh sách các đề cương chi tiết BM01 được phân công cho Hội đồng mà bạn là Chủ tịch. Quyết định thẩm định của Chủ tịch sẽ chốt trạng thái đề cương (ĐẠT hoặc CẦN CHỈNH SỬA).
                    </div>

                    {councilOutlineRegistrations.length === 0 ? (
                        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Chưa có đề cương nào cần thẩm định
                            </h3>
                            <p style={{ fontSize: 13, marginTop: 4 }}>
                                Hiện tại không có đề tài nào được phân công cho Hội đồng của bạn đang chờ thẩm định đề cương.
                            </p>
                        </div>
                    ) : (
                        councilOutlineRegistrations.map((record) => {
                            const student = record.student;
                            const topic = record.topic;
                            const latestSub = record.submissions?.[0];
                            const isPendingReview = ['BM01_SUBMITTED', 'BM01_RESUBMITTED'].includes(record.status);
                            const isPassed = record.status === 'BM01_PASSED';
                            const isNeedsRevision = record.status === 'BM01_NEEDS_REVISION';

                            const borderColor = isPendingReview
                                ? 'var(--primary)'
                                : isPassed
                                ? 'var(--success)'
                                : 'var(--warning)';

                            return (
                                <div
                                    key={record.id}
                                    className="card"
                                    style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: 0 }}
                                >
                                    <div style={{ padding: '18px 20px' }}>
                                        {/* Header Card */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }} className="flex-wrap gap-2">
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                                                    {student?.fullName || 'Sinh viên'}{' '}
                                                    <span className="mono" style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: 12 }}>
                                                        (MSSV: {student?.code || '-'} · Lớp {student?.class || '-'})
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 4 }}>
                                                    Hội đồng: <strong style={{ color: 'var(--primary)' }}>{record.outlineCouncil?.name || 'Hội đồng thẩm định BM01'}</strong> · Vai trò của bạn: <strong style={{ color: '#0F766E' }}>Chủ tịch Hội đồng</strong>
                                                </div>
                                            </div>

                                            <div>
                                                {record.status === 'BM01_SUBMITTED' && (
                                                    <span className="tag blue">Chờ thẩm định lần đầu</span>
                                                )}
                                                {record.status === 'BM01_RESUBMITTED' && (
                                                    <span className="tag purple">Đã nộp lại đề cương</span>
                                                )}
                                                {isPassed && (
                                                    <span className="tag green">✓ Đã duyệt ĐẠT (BM01_PASSED)</span>
                                                )}
                                                {isNeedsRevision && (
                                                    <span className="tag yellow">⚠ Yêu cầu chỉnh sửa</span>
                                                )}
                                                {!['BM01_SUBMITTED', 'BM01_RESUBMITTED', 'BM01_PASSED', 'BM01_NEEDS_REVISION'].includes(record.status) && (
                                                    <span className="tag gray">{record.status}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Topic & Submission Details */}
                                        <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14, border: '1px solid var(--border)' }}>
                                            <div>
                                                <strong>Đề tài:</strong> <em>"{topic?.title || 'Chưa cập nhật'}"</em>
                                            </div>
                                            <div style={{ color: '#475569', marginTop: 4 }}>
                                                <strong>GVHD:</strong> {topic?.mentor?.fullName || 'Chưa phân công'} ({topic?.mentor?.email || ''})
                                            </div>
                                            {latestSub && (
                                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-2">
                                                    <div style={{ fontSize: 12, color: '#334155' }}>
                                                        <strong>Hồ sơ nộp:</strong> {latestSub.fileName || 'de_cuong_bm01.pdf'}
                                                        {latestSub.content && (
                                                            <div style={{ fontStyle: 'italic', marginTop: 2, color: '#64748B' }}>
                                                                "{latestSub.content}"
                                                            </div>
                                                        )}
                                                    </div>
                                                    {latestSub.fileUrl && (
                                                        <a
                                                            href={latestSub.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ fontSize: 12 }}
                                                        >
                                                            ⬇ Tải Đề Cương
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {record.outlineFeedback && (
                                                <div style={{ marginTop: 8, padding: '8px 10px', background: '#FEF3C7', borderRadius: 4, fontSize: 12, color: '#92400E' }}>
                                                    <strong>Nhận xét đã gửi:</strong> {record.outlineFeedback}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-3">
                                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                {latestSub?.submittedAt ? (
                                                    <span>Nộp lúc: {new Date(latestSub.submittedAt).toLocaleString('vi-VN')}</span>
                                                ) : (
                                                    <span>Hồ sơ đang trong tiến trình thẩm định BM01</span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                className={`btn btn-sm ${isPendingReview ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => {
                                                    setSelectedOutlineRecord(record);
                                                    setOutlineModalOpen(true);
                                                }}
                                            >
                                                {isPendingReview ? '✍ Thẩm Định Đề Cương' : '🔍 Xem / Cập Nhật Đánh Giá'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* MODAL 1: XEM CV / BẢNG ĐIỂM (CHO GVHD) */}
            {cvModalOpen && selectedStudent && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">Hồ Sơ Năng Lực & Bảng Điểm Sinh Viên</div>
                            <button type="button" className="modal-close" onClick={() => setCvModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                                    {selectedStudent.student?.fullName?.[0] || 'S'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedStudent.student?.fullName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }} className="mono">
                                        MSSV: {selectedStudent.student?.code} · {selectedStudent.student?.email}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Điểm GPA Tích Lũy</span>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                                        {selectedStudent.gpa} / 4.0
                                    </div>
                                </div>
                                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Tín Chỉ Hoàn Thành</span>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
                                        {selectedStudent.credits}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Kỹ năng chuyên môn khai báo:</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    <span className="tag teal">React / Next.js</span>
                                    <span className="tag blue">Node.js / Express</span>
                                    <span className="tag gray">PostgreSQL / Supabase</span>
                                    <span className="tag green">Docker / Git</span>
                                </div>
                            </div>

                            <div style={{ padding: 12, background: '#F0FDFA', borderRadius: 'var(--radius-sm)', border: '1px solid #CCFBF1', fontSize: 12.5, color: '#0F766E' }}>
                                Sinh viên đủ điều kiện học vụ để làm Khóa luận tốt nghiệp theo quy định của Viện Công nghệ Số.
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setCvModalOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: TỪ CHỐI ĐĂNG KÝ (CHO GVHD) */}
            {rejectModalOpen && rejectingRecord && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 480 }}>
                        <div className="modal-head">
                            <div className="modal-title">Từ Chối Tiếp Nhận Hướng Dẫn</div>
                            <button type="button" className="modal-close" onClick={() => setRejectModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ fontSize: 13, color: 'var(--fg)' }}>
                                Bạn đang từ chối sinh viên <strong>{rejectingRecord.student?.fullName}</strong> cho đề tài:
                                <div style={{ fontStyle: 'italic', color: 'var(--muted)', marginTop: 2 }}>
                                    "{rejectingRecord.topic?.title}"
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                                    Lý do từ chối (sinh viên sẽ nhận được thông báo này):
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    placeholder="Ví dụ: Đã đủ chỉ tiêu hướng dẫn, hoặc đề tài yêu cầu kỹ năng chuyên biệt mà sinh viên chưa đáp ứng..."
                                    style={{ width: '100%' }}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setRejectModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                disabled={submitting}
                                onClick={handleReject}
                            >
                                {submitting ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: THẨM ĐỊNH ĐỀ CƯƠNG BM01 (CHỦ TỊCH HỘI ĐỒNG) */}
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
        </section>
    );
}
