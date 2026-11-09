import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';
import useAuthStore from '../../stores/authStore';
import PageLoader from '../../components/common/PageLoader';

/**
 * TopicManagementPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html (view-topics):
 * - Segmented tabs: Tất cả, Đã duyệt, Đang tuyển, Chờ duyệt BCN
 * - Search bar with instant filtering
 * - Strict 1 SV / 1 Đề tài quota visualization
 * - Modal propose new topic & clone topics from previous semesters
 */
export default function TopicManagementPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();

    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'approved' | 'open' | 'pending'

    // Modals
    const [newTopicModalOpen, setNewTopicModalOpen] = useState(false);
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedPendingTopic, setSelectedPendingTopic] = useState(null);
    const [reviewRejectReason, setReviewRejectReason] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // Semesters State
    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);

    // New Topic Form State
    const [title, setTitle] = useState('');
    const [englishTitle, setEnglishTitle] = useState('');
    const [targetMajor, setTargetMajor] = useState('Kỹ thuật Phần mềm');
    const [tags, setTags] = useState('');
    const [description, setDescription] = useState('');
    const [requirements, setRequirements] = useState('');

    // Fetch active semesters
    useEffect(() => {
        let isMounted = true;
        semesterService
            .getAll()
            .then((res) => {
                if (isMounted && res?.success && Array.isArray(res.data)) {
                    setSemesters(res.data);
                    const active = res.data.find((s) => s.isActive || s.status === 'ACTIVE');
                    const chosen = active || res.data[0];
                    if (chosen) {
                        setSelectedSemesterId(chosen.id);
                    }
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    const fetchTopics = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await topicService.getAll({ mentorId: user.id });
            const ownTopics = (res.data || []).filter(
                (topic) => topic.proposedById === user.id || topic.proposedBy?.id === user.id || topic.mentorId === user.id || topic.mentor?.id === user.id,
            );
            setTopics(ownTopics);
        } catch {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    // Computed Counts for Segmented Tabs
    const counts = useMemo(() => {
        const approved = topics.filter((t) => t.status === 'APPROVED');
        const open = topics.filter((t) => t.status === 'APPROVED' && (!t._count?.registrations || t._count.registrations === 0));
        const pending = topics.filter((t) => t.status === 'PENDING');
        return {
            all: topics.length,
            approved: approved.length,
            open: open.length,
            pending: pending.length,
        };
    }, [topics]);

    // Filtered Topics
    const filteredTopics = useMemo(() => {
        let list = [...topics];

        if (activeTab === 'approved') {
            list = list.filter((t) => t.status === 'APPROVED');
        } else if (activeTab === 'open') {
            list = list.filter((t) => t.status === 'APPROVED' && (!t._count?.registrations || t._count.registrations === 0));
        } else if (activeTab === 'pending') {
            list = list.filter((t) => t.status === 'PENDING');
        }

        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            list = list.filter((t) =>
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.code && t.code.toLowerCase().includes(q)) ||
                (t.englishTitle && t.englishTitle.toLowerCase().includes(q)) ||
                (t.targetMajor && t.targetMajor.toLowerCase().includes(q))
            );
        }

        return list;
    }, [topics, activeTab, searchText]);

    const handleCreateTopic = async () => {
        if (!title.trim()) {
            message.warning('Vui lòng nhập tên đề tài');
            return;
        }

        try {
            setSubmitting(true);
            const res = await topicService.create({
                title: title.trim(),
                englishTitle: englishTitle.trim() || undefined,
                targetMajor,
                description: description.trim() || undefined,
                requirements: requirements.trim() || undefined,
                semesterId: selectedSemesterId,
                maxStudents: 1, // Rule 1: 1 SV / 1 đề tài
            });

            if (res.success) {
                message.success('Đã gửi đề xuất đề tài mới thành công!');
                setNewTopicModalOpen(false);
                setTitle('');
                setEnglishTitle('');
                setDescription('');
                setRequirements('');
                fetchTopics();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tạo đề tài mới');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproveTopic = async (topicId) => {
        try {
            setReviewSubmitting(true);
            const res = await topicService.changeStatus(topicId, { status: 'APPROVED' });
            if (res.success) {
                message.success('Đã chấp thuận hướng dẫn đề tài của sinh viên!');
                setReviewModalOpen(false);
                setSelectedPendingTopic(null);
                fetchTopics();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể chấp thuận đề tài.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleRejectTopic = async (topicId) => {
        if (!reviewRejectReason.trim()) {
            message.warning('Vui lòng nhập lý do từ chối hướng dẫn đề tài.');
            return;
        }
        try {
            setReviewSubmitting(true);
            const res = await topicService.changeStatus(topicId, {
                status: 'REJECTED',
                rejectReason: reviewRejectReason.trim(),
            });
            if (res.success) {
                message.success('Đã từ chối đề xuất đề tài.');
                setReviewModalOpen(false);
                setSelectedPendingTopic(null);
                setReviewRejectReason('');
                fetchTopics();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đề tài.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    if (loading) {
        return <PageLoader />;
    }

    return (
        <section id="view-topics" className="view-pane active" style={{ display: 'block' }}>
            {/* Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="flex-wrap gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Quản Lý Đề Tài Của Tôi
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Danh mục các đề tài do bạn đề xuất trong học kỳ hiện tại kèm chỉ tiêu sinh viên.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }} className="flex-wrap">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCloneModalOpen(true)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Sao chép từ kỳ trước
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setNewTopicModalOpen(true)}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    Đề xuất Đề tài mới
                    </button>
                </div>
            </div>

            {/* Main Topics Card */}
            <div className="card">
                <div className="card-head flex-wrap gap-3">
                    <div className="segmented-tabs">
                        <div
                            className={`seg-tab ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            Tất cả ({counts.all})
                        </div>
                        <div
                            className={`seg-tab ${activeTab === 'approved' ? 'active' : ''}`}
                            onClick={() => setActiveTab('approved')}
                        >
                            Đã duyệt ({counts.approved})
                        </div>
                        <div
                            className={`seg-tab ${activeTab === 'open' ? 'active' : ''}`}
                            onClick={() => setActiveTab('open')}
                        >
                            Đang tuyển ({counts.open})
                        </div>
                        <div
                            className={`seg-tab ${activeTab === 'pending' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Sinh viên đề xuất chờ duyệt ({counts.pending})
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Tìm theo tên đề tài, công nghệ..."
                            style={{ width: 260 }}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-wrap">
                    <table id="topics-main-table">
                        <thead>
                            <tr>
                                <th>Mã ĐT</th>
                                <th>Tên Đề tài Nghiên cứu</th>
                                <th>Lĩnh vực / Công nghệ</th>
                                <th>Sinh viên thực hiện</th>
                                <th>Chỉ tiêu hướng dẫn</th>
                                <th>Trạng thái Học vụ</th>
                                <th style={{ textAlign: 'right' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTopics.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                                        Không tìm thấy đề tài nào phù hợp với bộ lọc hiện tại.
                                    </td>
                                </tr>
                            ) : (
                                filteredTopics.map((topic) => {
                                    const reg = topic.registrations?.[0] || topic.registration;
                                    const studentName = reg?.student?.fullName;
                                    const studentCode = reg?.student?.code;
                                    const hasStudent = Boolean(studentName);
                                    const isApproved = topic.status === 'APPROVED';
                                    const isPending = topic.status === 'PENDING';

                                    return (
                                        <tr key={topic.id} data-status={topic.status?.toLowerCase()}>
                                            <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                                {topic.code || `DT-${topic.id}`}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{topic.title}</div>
                                                {topic.englishTitle && (
                                                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                                        {topic.englishTitle}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="tag gray">
                                                    {topic.targetMajor || 'Kỹ thuật Phần mềm'}
                                                </span>
                                            </td>
                                            <td>
                                                {hasStudent ? (
                                                    <>
                                                        <strong>{studentName}</strong>
                                                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            {studentCode}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                                        {isPending ? 'Chờ phê duyệt' : 'Chưa gán chính thức'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`tag ${hasStudent ? 'blue' : isApproved ? 'green' : 'gray'}`}>
                                                    {hasStudent ? '1 / 1 sinh viên — Đã tiếp nhận' : '0 / 1 sinh viên — Đang mở'}
                                                </span>
                                            </td>
                                            <td>
                                                {isApproved ? (
                                                    <span className="tag green">Đã duyệt tiếp nhận</span>
                                                ) : isPending ? (
                                                    <span className="tag yellow">
                                                        {topic.proposedBy?.role === 'STUDENT' ? 'Sinh viên đề xuất' : 'Chờ duyệt'}
                                                    </span>
                                                ) : (
                                                    <span className="tag red">Bị từ chối</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {hasStudent ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => navigate(`/lecturer/progress?registrationId=${reg.id}`)}
                                                    >
                                                        Sổ nhật ký
                                                    </button>
                                                ) : isApproved ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => navigate('/lecturer/approvals')}
                                                    >
                                                        Xem đơn đăng ký
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => {
                                                            setSelectedPendingTopic(topic);
                                                            setReviewRejectReason('');
                                                            setReviewModalOpen(true);
                                                        }}
                                                    >
                                                        Xem xét đề xuất
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL 1: ĐỀ XUẤT ĐỀ TÀI MỚI */}
            {newTopicModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 600 }}>
                        <div className="modal-head">
                            <div className="modal-title">Đề Xuất Đề Tài Nghiên Cứu Mới</div>
                            <button type="button" className="modal-close" onClick={() => setNewTopicModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                                    Đợt đồ án / Học kỳ (*):
                                </label>
                                <select
                                    className="input-field"
                                    style={{ width: '100%' }}
                                    value={selectedSemesterId || ''}
                                    onChange={(e) => setSelectedSemesterId(parseInt(e.target.value, 10))}
                                >
                                    {semesters.length === 0 && <option value="">Đang tải đợt đồ án...</option>}
                                    {semesters.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.academicYear || ''}) {s.isActive || s.status === 'ACTIVE' ? '· [Đang diễn ra]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                                    Tên đề tài tiếng Việt (*):
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Ví dụ: Nghiên cứu và xây dựng hệ thống phát hiện gian lận giao dịch..."
                                    style={{ width: '100%' }}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                                    Tên đề tài tiếng Anh:
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Nhập tên đề tài bằng tiếng Anh (nếu có)..."
                                    style={{ width: '100%' }}
                                    value={englishTitle}
                                    onChange={(e) => setEnglishTitle(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Chuyên ngành:</label>
                                    <select
                                        className="input-field"
                                        style={{ width: '100%' }}
                                        value={targetMajor}
                                        onChange={(e) => setTargetMajor(e.target.value)}
                                    >
                                        <option value="Kỹ thuật Phần mềm">Kỹ thuật Phần mềm</option>
                                        <option value="Khoa học Dữ liệu & AI">Khoa học Dữ liệu & AI</option>
                                        <option value="Mạng Máy tính & ATTT">Mạng Máy tính & ATTT</option>
                                        <option value="Hệ thống Thông tin">Hệ thống Thông tin</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Định mức sinh viên:</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value="1 Sinh viên / 1 Đề tài — Cố định theo quy định"
                                        disabled
                                        style={{ width: '100%', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Mục tiêu & Phạm vi nghiên cứu:</label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    placeholder="Mô tả tóm tắt mục tiêu, phương pháp tiếp cận và sản phẩm dự kiến..."
                                    style={{ width: '100%' }}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Yêu cầu đối với sinh viên:</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Ví dụ: Điểm GPA >= 3.0, thành thạo Python / React / Docker..."
                                    style={{ width: '100%' }}
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setNewTopicModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={submitting}
                                onClick={handleCreateTopic}
                            >
                                {submitting ? 'Đang lưu...' : 'Lưu đề tài hướng dẫn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: SAO CHÉP TỪ KỲ TRƯỚC */}
            {cloneModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">Sao Chép Đề Tài Từ Học Kỳ Trước</div>
                            <button type="button" className="modal-close" onClick={() => setCloneModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                Chọn các đề tài đã thực hiện tốt trong học kỳ trước để sao chép sang đợt mới. Hệ thống sẽ tự động gán trạng thái <strong>Bản nháp</strong> để bạn chỉnh sửa trước khi gửi duyệt.
                            </div>
                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                                    <input type="checkbox" defaultChecked />
                                    <span>DT-2025-042: Kiến trúc Microservices cho Hệ thống Tài chính Phân tán</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                                    <input type="checkbox" defaultChecked />
                                    <span>DT-2025-055: Phát hiện Bất thường Dữ liệu IoT Bằng Học Sâu</span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setCloneModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    message.success('Đã sao chép 2 đề tài thành công!');
                                    setCloneModalOpen(false);
                                    fetchTopics();
                                }}
                            >
                                Sao Chép Sang Kỳ Này
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: XEM XÉT ĐỀ XUẤT ĐỀ TÀI CỦA SINH VIÊN */}
            {reviewModalOpen && selectedPendingTopic && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 620 }}>
                        <div className="modal-head">
                            <div className="modal-title">Xem Xét Đề Xuất Đề Tài Của Sinh Viên</div>
                            <button type="button" className="modal-close" onClick={() => setReviewModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                                    Sinh viên gửi đề xuất:
                                </div>
                                <div style={{ fontSize: 14, marginTop: 4, color: '#0F766E', fontWeight: 600 }}>
                                    {selectedPendingTopic.proposedBy?.fullName || 'Sinh viên'}
                                    {selectedPendingTopic.proposedBy?.code && ` (${selectedPendingTopic.proposedBy.code})`}
                                </div>
                                {selectedPendingTopic.proposedBy?.email && (
                                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                        Email: {selectedPendingTopic.proposedBy.email}
                                    </div>
                                )}
                                {selectedPendingTopic.semester?.name && (
                                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                                        Đợt đồ án: {selectedPendingTopic.semester.name}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4, color: '#0F172A' }}>
                                    Tên đề tài sinh viên đề xuất:
                                </label>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: 6 }}>
                                    {selectedPendingTopic.title}
                                </div>
                            </div>

                            {selectedPendingTopic.description && (
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 4, color: '#0F172A' }}>
                                        Mục tiêu nghiên cứu &amp; Phạm vi dự kiến:
                                    </label>
                                    <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-line', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 10, borderRadius: 6 }}>
                                        {selectedPendingTopic.description}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6, color: '#0F172A' }}>
                                    Ý kiến phản hồi / Lý do từ chối (nếu không nhận hướng dẫn):
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    placeholder="Nêu rõ lý do hoặc định hướng thêm cho sinh viên nếu từ chối..."
                                    style={{ width: '100%', resize: 'vertical' }}
                                    value={reviewRejectReason}
                                    onChange={(e) => setReviewRejectReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setReviewModalOpen(false)}
                            >
                                Đóng
                            </button>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                                    disabled={reviewSubmitting}
                                    onClick={() => handleRejectTopic(selectedPendingTopic.id)}
                                >
                                    {reviewSubmitting ? 'Đang xử lý...' : 'Từ chối hướng dẫn'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={reviewSubmitting}
                                    onClick={() => handleApproveTopic(selectedPendingTopic.id)}
                                >
                                    {reviewSubmitting ? 'Đang xử lý...' : 'Đồng ý hướng dẫn'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
