import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, message, Modal, Table } from 'antd';
import { CopyOutlined, PlusOutlined, AuditOutlined, CloseOutlined } from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import aiService from '../../services/aiService';
import TopicSimilarityModal from '../../components/topics/TopicSimilarityModal';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useSemesters } from '../../queries/semesterQueries';
import { useTopics, useTopicMutation } from '../../queries/topicQueries';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';

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
    const scope = queryKeys.scope(user);
    const navigate = useNavigate();

    const semestersQuery = useSemesters(scope);
    const semesters = semestersQuery.data || [];
    const topicsQuery = useTopics(scope, { mentorId: user?.id });
    const topicMutation = useTopicMutation(scope);

    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'approved' | 'open' | 'pending'

    // Modals
    const [newTopicModalOpen, setNewTopicModalOpen] = useState(false);
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [cloneableTopics, setCloneableTopics] = useState([]);
    const [loadingCloneable, setLoadingCloneable] = useState(false);
    const [selectedTopicIds, setSelectedTopicIds] = useState([]);
    const [cloning, setCloning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedPendingTopic, setSelectedPendingTopic] = useState(null);
    const [reviewRejectReason, setReviewRejectReason] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // AI Similarity Checker state
    const [similarityModalOpen, setSimilarityModalOpen] = useState(false);
    const [similarityLoading, setSimilarityLoading] = useState(false);
    const [similarityData, setSimilarityData] = useState(null);

    const handleCheckSimilarity = async () => {
        if (!title.trim()) {
            message.warning('Vui lòng nhập tên đề tài trước khi kiểm tra tính mới với AI.');
            return;
        }
        setSimilarityModalOpen(true);
        setSimilarityLoading(true);
        try {
            const res = await aiService.checkTopicSimilarity({
                title: title.trim(),
                summary: description.trim(),
                semesterId: selectedSemesterId || null,
            });
            if (res.success) {
                setSimilarityData(res.data);
            } else {
                message.error(res.message || 'Không thể kiểm tra tính mới đề tài');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gọi AI kiểm tra tính mới');
        } finally {
            setSimilarityLoading(false);
        }
    };

    const handleSelectSuggestedTitle = (newTitle) => {
        setTitle(newTitle);
        setSimilarityModalOpen(false);
        message.success('Đã áp dụng tên đề tài gợi ý!');
    };

    // Semesters State
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);

    // New Topic Form State
    const [title, setTitle] = useState('');
    const [englishTitle, setEnglishTitle] = useState('');
    const [targetMajor, setTargetMajor] = useState('Kỹ thuật Phần mềm');
    const [tags, setTags] = useState('');
    const [description, setDescription] = useState('');
    const [requirements, setRequirements] = useState('');

    useEffect(() => {
        if (semesters.length > 0 && !selectedSemesterId) {
            const active = semesters.find((s) => s.isActive || s.status === 'ACTIVE');
            const chosen = active || semesters[0];
            if (chosen) {
                setSelectedSemesterId(chosen.id);
            }
        }
    }, [semesters, selectedSemesterId]);

    const rawTopics = topicsQuery.data || [];
    const topics = useMemo(() => {
        return rawTopics.filter(
            (topic) => topic.proposedById === user?.id || topic.proposedBy?.id === user?.id || topic.mentorId === user?.id || topic.mentor?.id === user?.id,
        );
    }, [rawTopics, user?.id]);

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
            await topicMutation.mutateAsync({
                action: 'create',
                args: [{
                    title: title.trim(),
                    englishTitle: englishTitle.trim() || undefined,
                    targetMajor,
                    description: description.trim() || undefined,
                    requirements: requirements.trim() || undefined,
                    semesterId: selectedSemesterId,
                    maxStudents: 1, // Rule 1: 1 SV / 1 đề tài
                }],
            });

            message.success('Đã gửi đề xuất đề tài mới thành công!');
            setNewTopicModalOpen(false);
            setTitle('');
            setEnglishTitle('');
            setDescription('');
            setRequirements('');
        } catch (error) {
            message.error(error?.message || 'Không thể tạo đề tài mới');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproveTopic = async (topicId) => {
        try {
            setReviewSubmitting(true);
            await topicMutation.mutateAsync({
                action: 'changeStatus',
                args: [topicId, { status: 'APPROVED' }],
            });
            message.success('Đã chấp thuận hướng dẫn đề tài của sinh viên!');
            setReviewModalOpen(false);
            setSelectedPendingTopic(null);
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
            await topicMutation.mutateAsync({
                action: 'changeStatus',
                args: [topicId, {
                    status: 'REJECTED',
                    rejectReason: reviewRejectReason.trim(),
                }],
            });
            message.success('Đã từ chối đề xuất đề tài.');
            setReviewModalOpen(false);
            setSelectedPendingTopic(null);
            setReviewRejectReason('');
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đề tài.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    // Auto-fetch cloneable topics from previous semesters upon modal open
    useEffect(() => {
        if (cloneModalOpen) {
            setSelectedTopicIds([]);
            setLoadingCloneable(true);
            topicService
                .getCloneableTopics()
                .then((res) => {
                    if (res?.success && Array.isArray(res.data)) {
                        setCloneableTopics(res.data);
                    } else if (Array.isArray(res?.data)) {
                        setCloneableTopics(res.data);
                    } else if (Array.isArray(res)) {
                        setCloneableTopics(res);
                    } else {
                        setCloneableTopics([]);
                    }
                })
                .catch((err) => {
                    message.error(err?.message || 'Không thể tải danh sách đề tài từ các học kỳ trước.');
                    setCloneableTopics([]);
                })
                .finally(() => {
                    setLoadingCloneable(false);
                });
        }
    }, [cloneModalOpen]);

    const handleCloneTopics = async () => {
        if (!selectedTopicIds.length) {
            message.warning('Vui lòng chọn ít nhất một đề tài để sao chép.');
            return;
        }
        try {
            setCloning(true);
            const res = await topicMutation.mutateAsync({
                action: 'cloneTopics',
                args: [{ topicIds: selectedTopicIds }],
            });
            message.success(res?.message || 'Đã sao chép đề tài thành công!');
            setCloneModalOpen(false);
            setSelectedTopicIds([]);
        } catch (error) {
            message.error(error?.message || 'Không thể sao chép đề tài.');
        } finally {
            setCloning(false);
        }
    };

    const cloneColumns = [
        {
            title: 'Mã / Tên Đề tài',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{text}</div>
                    {record.code && (
                        <div style={{ fontSize: 12, color: '#64748B' }}>Mã: {record.code}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Học kỳ cũ',
            dataIndex: 'semester',
            key: 'semester',
            width: 140,
            render: (sem) => sem?.name || 'Học kỳ trước',
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (desc) => desc || '—',
        },
    ];

    const cloneRowSelection = {
        selectedRowKeys: selectedTopicIds,
        onChange: (selectedRowKeys) => {
            setSelectedTopicIds(selectedRowKeys);
        },
    };

    if (topicsQuery.isPending && !topicsQuery.data) {
        return <ContentSkeleton variant="table" />;
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
                    <Button
                        icon={<CopyOutlined />}
                        onClick={() => setCloneModalOpen(true)}
                    >
                        Sao chép từ kỳ trước
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setNewTopicModalOpen(true)}
                    >
                        Đề xuất Đề tài mới
                    </Button>
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

                <QueryPanel query={topicsQuery} variant="table">
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
                                                {hasStudent ? (
                                                    <span className="tag green">Đã tiếp nhận sinh viên</span>
                                                ) : isApproved ? (
                                                    <span className="tag teal">Sẵn sàng tuyển SV</span>
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
                </QueryPanel>
            </div>

            {/* MODAL 1: ĐỀ XUẤT ĐỀ TÀI MỚI */}
            {newTopicModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 600 }}>
                        <div className="modal-head">
                            <div className="modal-title">Đề Xuất Đề Tài Nghiên Cứu Mới</div>
                            <button type="button" className="modal-close" onClick={() => setNewTopicModalOpen(false)} aria-label="Đóng"><CloseOutlined /></button>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <label style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                                        Tên đề tài tiếng Việt (*):
                                    </label>
                                    <Button
                                        size="small"
                                        type="dashed"
                                        icon={<AuditOutlined />}
                                        onClick={handleCheckSimilarity}
                                        loading={similarityLoading}
                                        className="text-teal-700 border-teal-500 hover:border-teal-700"
                                    >
                                        Kiểm tra tính mới AI
                                    </Button>
                                </div>
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
            <Modal
                open={cloneModalOpen}
                onCancel={() => {
                    setCloneModalOpen(false);
                    setSelectedTopicIds([]);
                }}
                title="Sao Chép Đề Tài Từ Học Kỳ Trước"
                width={720}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            setCloneModalOpen(false);
                            setSelectedTopicIds([]);
                        }}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<CopyOutlined />}
                        loading={cloning}
                        disabled={selectedTopicIds.length === 0}
                        onClick={handleCloneTopics}
                    >
                        Sao chép sang kỳ này
                    </Button>,
                ]}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Chọn các đề tài đã thực hiện tốt trong học kỳ trước để sao chép sang đợt mới. Hệ thống sẽ tự động gán trạng thái <strong>Bản nháp</strong> (DRAFT) với chỉ tiêu 1 SV / đề tài để bạn chỉnh sửa trước khi gửi duyệt.
                    </div>
                    {cloneableTopics.length === 0 && !loadingCloneable ? (
                        <Empty description="Không có đề tài từ các học kỳ trước để sao chép" />
                    ) : (
                        <Table
                            rowKey="id"
                            rowSelection={cloneRowSelection}
                            columns={cloneColumns}
                            dataSource={cloneableTopics}
                            loading={loadingCloneable}
                            pagination={{ pageSize: 5 }}
                            size="small"
                        />
                    )}
                </div>
            </Modal>

            {/* MODAL 3: XEM XÉT ĐỀ XUẤT ĐỀ TÀI CỦA SINH VIÊN */}
            {reviewModalOpen && selectedPendingTopic && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 620 }}>
                        <div className="modal-head">
                            <div className="modal-title">Xem Xét Đề Xuất Đề Tài Của Sinh Viên</div>
                            <button type="button" className="modal-close" onClick={() => setReviewModalOpen(false)} aria-label="Đóng"><CloseOutlined /></button>
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
            {/* AI Topic Similarity Modal */}
            <TopicSimilarityModal
                open={similarityModalOpen}
                onClose={() => setSimilarityModalOpen(false)}
                data={similarityData}
                loading={similarityLoading}
                onSelectTitle={handleSelectSuggestedTitle}
            />
        </section>
    );
}
