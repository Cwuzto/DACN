import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Modal,
    Button,
    Tabs,
    message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, AppstoreOutlined, BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useSemesters } from '../../queries/semesterQueries';
import { useTopics, useMentors, useTopicMutation, useProjectCatalogs } from '../../queries/topicQueries';
import { useStudentRegistration, useMyProjectEnrollments } from '../../queries/registrationQueries';
import { useStudentRegistrationMutation } from '../../queries/studentDashboardQueries';
import QueryPanel from '../../components/common/QueryPanel';

const ACTIVE_STATUSES = ['REGISTRATION', 'ONGOING', 'DEFENSE'];

const formatRegistrationStatus = (status) => {
    switch (status) {
        case 'PENDING': return 'Chờ duyệt';
        case 'APPROVED': return 'Đã được duyệt';
        case 'REJECTED': return 'Bị từ chối';
        case 'BM01_SUBMITTED': return 'Chờ duyệt đề cương';
        case 'BM01_PASSED': return 'Đề cương đạt';
        case 'BM01_NEEDS_REVISION': return 'Đề cương cần chỉnh sửa';
        case 'DECISION_ISSUED': return 'Đã ban hành quyết định';
        case 'IN_PROGRESS_BM03': return 'Đang thực hiện tiến độ';
        case 'BM03_PASSED': return 'Hoàn thành tiến độ';
        case 'BM04_REVIEW': return 'Đang thẩm định phiếu nhận xét';
        case 'DEFENSE_READY': return 'Đủ điều kiện bảo vệ';
        case 'DEFENDED': return 'Đã bảo vệ';
        case 'COMPLETED': return 'Hoàn tất';
        default: return status || 'Đang thực hiện';
    }
};

export default function TopicListPage() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const scope = queryKeys.scope(user);

    const [searchText, setSearchText] = useState('');
    const [filterMajor, setFilterMajor] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [activeTab, setActiveTab] = useState('available');

    const [savedIds, setSavedIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('savedTopics')) || [];
        } catch {
            return [];
        }
    });
    const [filterSavedOnly, setFilterSavedOnly] = useState(false);

    // Modals
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [topicToRegister, setTopicToRegister] = useState(null);
    const [proposeModalOpen, setProposeModalOpen] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [submittingPropose, setSubmittingPropose] = useState(false);
    const [proposeForm, setProposeForm] = useState({ title: '', mentorId: '', description: '' });

    // Semesters query
    const semestersQuery = useSemesters(scope);
    const semesters = semestersQuery.data || [];
    const currentSemester = useMemo(() => {
        return (
            semesters.find((s) => s.registrationOpen && ACTIVE_STATUSES.includes(s.status)) ||
            semesters.find((s) => ACTIVE_STATUSES.includes(s.status)) ||
            semesters?.[0] ||
            null
        );
    }, [semesters]);
    const currentSemesterId = currentSemester?.id || null;

    // Catalogs query
    const catalogsQuery = useProjectCatalogs(scope);
    const catalogs = catalogsQuery.data || [];

    // Enrollments query
    const enrollmentsQuery = useMyProjectEnrollments(scope, { semesterId: currentSemesterId }, Boolean(currentSemesterId));
    const enrollData = enrollmentsQuery.data?.data || [];
    const myProjectEnrollments = useMemo(() => {
        return enrollData.filter((row) => row.status === 'ACTIVE' && row.projectCatalog?.isActive);
    }, [enrollData]);
    const accountRestricted = Boolean(enrollmentsQuery.data?.meta?.accountRestricted);
    const accountRestrictionReason = enrollmentsQuery.data?.meta?.accountRestrictionReason || '';

    // Selected semester & catalog filters
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [selectedProjectCatalogId, setSelectedProjectCatalogId] = useState('ALL');

    const effectiveSemesterId = selectedSemesterId || currentSemesterId;
    const effectiveCatalogId = selectedProjectCatalogId !== 'ALL'
        ? Number(selectedProjectCatalogId)
        : (catalogs[0]?.id || null);

    // Topics query
    const topicParams = useMemo(() => {
        const p = {};
        if (effectiveSemesterId) p.semesterId = effectiveSemesterId;
        if (selectedProjectCatalogId !== 'ALL') p.projectCatalogId = Number(selectedProjectCatalogId);
        return p;
    }, [effectiveSemesterId, selectedProjectCatalogId]);

    const topicsQuery = useTopics(scope, topicParams, Boolean(effectiveSemesterId));
    const rawTopics = topicsQuery.data || [];
    const topics = useMemo(() => {
        return rawTopics.map((topic, index) => ({
            ...topic,
            key: topic.id,
            stt: index + 1,
        }));
    }, [rawTopics]);

    // Mentors query
    const mentorsQuery = useMentors(scope, {
        semesterId: effectiveSemesterId,
        ...(effectiveCatalogId ? { projectCatalogId: effectiveCatalogId } : {}),
    }, Boolean(effectiveSemesterId));
    const mentors = mentorsQuery.data || [];

    // Registration query
    const registrationQuery = useStudentRegistration(scope, { semesterId: effectiveSemesterId }, Boolean(effectiveSemesterId));
    const myRegistration = registrationQuery.data?.data || null;

    // Mutations
    const registrationMutation = useStudentRegistrationMutation(scope);
    const topicMutation = useTopicMutation(scope);

    const getRegistrationWindowState = useCallback(() => {
        if (!currentSemester) {
            return { canRegister: false, reason: 'Chưa có học kỳ hoạt động để đăng ký.' };
        }
        if (!currentSemester.registrationOpen) {
            return { canRegister: false, reason: 'Học kỳ này hiện đang đóng đăng ký đề tài.' };
        }
        const now = new Date();
        if (currentSemester.startDate && now < new Date(currentSemester.startDate)) {
            return { canRegister: false, reason: 'Chưa đến thời gian mở đợt đăng ký.' };
        }
        if (currentSemester.registrationDeadline && now > new Date(currentSemester.registrationDeadline)) {
            return { canRegister: false, reason: 'Đợt đăng ký đề tài đã kết thúc.' };
        }
        return { canRegister: true, reason: '' };
    }, [currentSemester]);

    // Filter logic
    const filteredTopics = useMemo(() => {
        let result = topics;

        if (filterSavedOnly) {
            result = result.filter((t) => savedIds.includes(t.id));
        }

        if (filterStatus === 'AVAILABLE') {
            result = result.filter((t) => t.status === 'APPROVED' && (t._count?.registrations || 0) < 1);
        } else if (filterStatus === 'FULL') {
            result = result.filter((t) => t.status === 'APPROVED' && (t._count?.registrations || 0) >= 1);
        }

        if (filterMajor !== 'ALL') {
            result = result.filter((t) => {
                const title = (t.title || '').toUpperCase();
                const catalog = (t.projectCatalog?.name || '').toUpperCase();
                return title.includes(filterMajor) || catalog.includes(filterMajor);
            });
        }

        if (searchText.trim()) {
            const query = searchText.trim().toLowerCase();
            result = result.filter((t) => {
                const title = (t.title || '').toLowerCase();
                const mentorName = (t.mentor?.fullName || '').toLowerCase();
                const code = (t.code || '').toLowerCase();
                return title.includes(query) || mentorName.includes(query) || code.includes(query);
            });
        }

        return result;
    }, [topics, searchText, filterMajor, filterStatus, filterSavedOnly, savedIds]);

    const availableTopics = useMemo(
        () => filteredTopics.filter((t) => t.proposedById !== user?.id && t.status === 'APPROVED'),
        [filteredTopics, user?.id]
    );

    const myProposedTopics = useMemo(
        () => filteredTopics.filter((t) => t.proposedById === user?.id),
        [filteredTopics, user?.id]
    );

    const toggleSave = (id, e) => {
        if (e) e.stopPropagation();
        setSavedIds((prev) => {
            const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
            localStorage.setItem('savedTopics', JSON.stringify(next));
            return next;
        });
    };

    const handleViewDetail = async (id) => {
        try {
            const res = await topicService.getById(id);
            setDetailTopic(res.data);
            setDetailModalOpen(true);
        } catch {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const hasExistingRegistration = Boolean(myRegistration && myRegistration.status !== 'REJECTED');
    const isRegistrationRejected = myRegistration?.status === 'REJECTED';
    const myPendingProposal = useMemo(() => {
        return topics.find((t) => t.proposedById === user?.id && t.status === 'PENDING');
    }, [topics, user?.id]);
    const registrationWindow = getRegistrationWindowState();
    const isRegistrationBlocked = !registrationWindow.canRegister;

    const handleCancelProposal = (proposalId) => {
        Modal.confirm({
            title: 'Hủy đề xuất đề tài?',
            content: 'Bạn có chắc chắn muốn hủy đề xuất đề tài này không? Sau khi hủy bạn có thể đăng ký đề tài khác hoặc tạo đề xuất mới.',
            okText: 'Xác nhận hủy',
            okType: 'danger',
            cancelText: 'Quay lại',
            onOk: async () => {
                try {
                    await topicMutation.mutateAsync({ action: 'delete', args: [proposalId] });
                    message.success('Đã hủy đề xuất đề tài thành công.');
                } catch (err) {
                    message.error(err?.message || 'Không thể hủy đề xuất đề tài.');
                }
            },
        });
    };

    const confirmRegister = (topic) => {
        if (!currentSemesterId) {
            message.warning('Chưa có đợt đồ án hoạt động để đăng ký.');
            return;
        }
        if (isRegistrationBlocked) {
            message.warning(registrationWindow.reason || 'Đăng ký đang tạm đóng.');
            return;
        }
        if (hasExistingRegistration) {
            message.warning('Bạn đã đăng ký đề tài rồi. Chỉ có thể đổi khi bị từ chối.');
            return;
        }
        setTopicToRegister(topic);
        setConfirmModalOpen(true);
    };

    const executeRegister = async () => {
        const targetSemesterId = effectiveSemesterId || currentSemesterId;
        if (!topicToRegister || !targetSemesterId) return;
        try {
            setRegistering(true);
            await registrationMutation.mutateAsync({ topicId: topicToRegister.id, semesterId: targetSemesterId });
            message.success('Đăng ký đề tài thành công.');
            setConfirmModalOpen(false);
        } catch (error) {
            message.error(error?.message || 'Lỗi khi đăng ký đề tài.');
        } finally {
            setRegistering(false);
        }
    };

    const handleProposeSubmit = async (e) => {
        e?.preventDefault();
        if (hasExistingRegistration) {
            message.warning('Bạn đã có đề tài chính thức trong học kỳ này, không thể đề xuất thêm.');
            return;
        }
        if (myPendingProposal) {
            message.warning('Bạn đã có một đề tài tự đề xuất đang chờ giảng viên duyệt.');
            return;
        }
        if (!proposeForm.title.trim()) {
            message.warning('Vui lòng nhập tên đề tài.');
            return;
        }
        if (!proposeForm.mentorId) {
            message.warning('Vui lòng chọn giảng viên hướng dẫn dự kiến.');
            return;
        }
        try {
            setSubmittingPropose(true);
            const targetCatalogId = proposeForm.projectCatalogId || effectiveCatalogId;
            const payload = {
                title: proposeForm.title.trim(),
                description: proposeForm.description.trim(),
                mentorId: proposeForm.mentorId,
                semesterId: effectiveSemesterId || currentSemesterId,
                projectCatalogId: targetCatalogId,
            };
            await topicMutation.mutateAsync({
                action: 'propose',
                args: [payload],
            });
            message.success('Đã gửi đề xuất đề tài thành công!');
            setProposeModalOpen(false);
            setProposeForm({ title: '', mentorId: '', description: '', projectCatalogId: undefined });
        } catch (err) {
            message.error(err?.message || 'Không thể đề xuất đề tài.');
        } finally {
            setSubmittingPropose(false);
        }
    };

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-topics" className="sub-view">
            {/* Registration Window Notice Banner */}
            <div
                style={{
                    background: isRegistrationRejected ? '#FEF2F2' : myPendingProposal ? '#FFFBEB' : '#F0FDFA',
                    border: `1px solid ${isRegistrationRejected ? '#FECACA' : myPendingProposal ? '#FDE68A' : '#CCFBF1'}`,
                    borderRadius: 'var(--radius)',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    flexWrap: 'wrap',
                    gap: 14,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: isRegistrationRejected ? '#FEE2E2' : myPendingProposal ? '#FEF3C7' : '#CCFBF1',
                            color: isRegistrationRejected ? '#DC2626' : myPendingProposal ? '#D97706' : '#0F766E',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            fontWeight: 700,
                        }}
                    >
                        {isRegistrationRejected ? '⚠️' : myPendingProposal ? '📝' : '⏱'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isRegistrationRejected ? '#DC2626' : myPendingProposal ? '#B45309' : '#0F766E' }}>
                            {hasExistingRegistration
                                ? (currentSemester?.name ? `Đợt Đăng Ký Đề Tài - ${currentSemester.name}` : 'Đợt Đăng Ký Đề Tài Đang Mở')
                                : isRegistrationRejected
                                ? 'Đơn Đăng Ký Đề Tài Bị Giảng Viên Từ Chối'
                                : myPendingProposal
                                ? 'Bạn Đang Có Đề Tài Tự Đề Xuất Chờ GVHD Duyệt'
                                : (currentSemester?.name ? `Đợt Đăng Ký Đề Tài - ${currentSemester.name}` : 'Đợt Đăng Ký Đề Tài Đang Mở')}
                        </div>
                        <div style={{ fontSize: 12, color: isRegistrationRejected ? '#991B1B' : myPendingProposal ? '#92400E' : '#115E59', marginTop: 2 }}>
                            {hasExistingRegistration ? (
                                <span>Bạn đã đăng ký đề tài: <strong>{myRegistration?.topic?.title}</strong> · Trạng thái: <strong>{formatRegistrationStatus(myRegistration?.status)}</strong></span>
                            ) : isRegistrationRejected ? (
                                <span>
                                    Đơn đăng ký đề tài <strong>"{myRegistration?.topic?.title}"</strong> đã bị giảng viên từ chối
                                    {myRegistration?.rejectReason ? <> (Lý do: <em>{myRegistration.rejectReason}</em>)</> : ''}. Bạn có thể chọn và đăng ký đề tài khác dưới đây.
                                </span>
                            ) : myPendingProposal ? (
                                <span>Đề tài: <strong>{myPendingProposal.title}</strong> · GVHD mong muốn: <strong>{myPendingProposal.mentor?.fullName || 'Chưa phân công'}</strong></span>
                            ) : (
                                <span>Thời gian đăng ký trực tuyến theo quy chế Viện. Mỗi sinh viên chỉ đăng ký 1 đề tài duy nhất.</span>
                            )}
                        </div>
                    </div>
                </div>
                {myPendingProposal ? (
                    <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleCancelProposal(myPendingProposal.id)}
                    >
                        Hủy đề xuất đề tài
                    </Button>
                ) : !hasExistingRegistration ? (
                    <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => setProposeModalOpen(true)}
                    >
                        Đề xuất đề tài tự do
                    </Button>
                ) : null}
            </div>

            {/* Catalog Toolbar & Filters */}
            <div className="catalog-bar">
                <div className="catalog-search-group">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Tìm kiếm tên đề tài, từ khóa, công nghệ, GVHD..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="form-control"
                        value={selectedSemesterId || currentSemesterId || ''}
                        onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
                        style={{ width: 175 }}
                        title="Đợt đồ án (Học kỳ)"
                    >
                        {semesters.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} {ACTIVE_STATUSES.includes(s.status) ? '(Hiện tại)' : ''}
                            </option>
                        ))}
                    </select>

                    <select
                        className="form-control"
                        value={selectedProjectCatalogId}
                        onChange={(e) => setSelectedProjectCatalogId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                        style={{ width: 185 }}
                        title="Loại đồ án"
                    >
                        <option value="ALL">Tất cả loại đồ án</option>
                        {catalogs.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.code} · {c.name}
                            </option>
                        ))}
                    </select>

                    <select
                        className="form-control"
                        value={filterMajor}
                        onChange={(e) => setFilterMajor(e.target.value)}
                        style={{ width: 170 }}
                    >
                        <option value="ALL">Tất cả chuyên ngành</option>
                        <option value="KTPM">Kỹ thuật Phần mềm</option>
                        <option value="AI">Trí tuệ Nhân tạo & DS</option>
                        <option value="HTTT">Hệ thống Thông tin</option>
                        <option value="ATTT">An toàn Thông tin</option>
                    </select>

                    <select
                        className="form-control"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ width: 150 }}
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="AVAILABLE">Còn nhận sinh viên</option>
                        <option value="FULL">Đã đủ số lượng</option>
                    </select>

                    <button
                        className={`btn btn-secondary btn-sm ${filterSavedOnly ? 'active' : ''}`}
                        onClick={() => setFilterSavedOnly(!filterSavedOnly)}
                        style={{ color: filterSavedOnly ? 'var(--primary)' : undefined }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={filterSavedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span>Đề tài đã lưu ({savedIds.length})</span>
                    </button>

                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={topicsQuery.isFetching}
                        onClick={() => {
                            topicsQuery.refetch();
                            regQuery.refetch();
                        }}
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Topics Tabs: Available vs Student Proposals */}
            <QueryPanel query={topicsQuery}>
                {(() => {
                    const renderTopicCard = (topic) => {
                        const isMine = myRegistration?.topicId === topic.id && myRegistration?.status !== 'REJECTED';
                        const isMyRejectedTopic = myRegistration?.topicId === topic.id && myRegistration?.status === 'REJECTED';
                        const isMyProposal = topic.proposedById === user?.id;
                        const isPendingProposal = isMyProposal && topic.status === 'PENDING';
                        const isMyRejectedProposal = isMyProposal && topic.status === 'REJECTED';
                        const isMyCancelledProposal = isMyProposal && topic.status === 'CANCELLED';
                        const isMyApprovedProposal = isMyProposal && topic.status === 'APPROVED';
                        const isSaved = savedIds.includes(topic.id);
                        const regCount = topic._count?.registrations || 0;
                        const isFull = regCount >= 1; // 1 SV / 1 đề tài
                        const canRegisterCard = topic.status === 'APPROVED' && !isMine && !isFull && !hasExistingRegistration && !isMyProposal;

                        return (
                            <div className="topic-card" key={topic.id}>
                                <div>
                                    <div className="topic-card-header">
                                        <span className={`tag ${topic.projectCatalog?.code === 'DATN' ? 'purple' : 'teal'}`}>
                                            {topic.projectCatalog
                                                ? `${topic.projectCatalog.code} · ${topic.projectCatalog.name}`
                                                : (topic.projectCatalog?.name || 'DATN · Đồ án tốt nghiệp')}
                                        </span>
                                        {isMine ? (
                                            <span className="tag green">Đề tài của bạn</span>
                                        ) : isMyRejectedProposal ? (
                                            <span className="tag red" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                                                Đề xuất bị từ chối
                                            </span>
                                        ) : isMyCancelledProposal ? (
                                            <span className="tag gray">
                                                Đã bị hủy
                                            </span>
                                        ) : isMyRejectedTopic ? (
                                            <span className="tag red" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                                                Đã bị từ chối
                                            </span>
                                        ) : isPendingProposal ? (
                                            <span className="tag orange" style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}>
                                                Đề xuất chờ GVHD duyệt
                                            </span>
                                        ) : isMyApprovedProposal ? (
                                            <span className="tag green">Đề xuất đã được duyệt</span>
                                        ) : isFull ? (
                                            <span className="tag gray">Đã đủ sinh viên</span>
                                        ) : (
                                            <span className="tag green">Còn nhận SV (0/1)</span>
                                        )}
                                    </div>
                                    <h3 className="topic-card-title">{topic.title}</h3>
                                    <p className="topic-card-desc">
                                        {topic.description || 'Chưa có mô tả chi tiết cho đề tài này.'}
                                    </p>
                                    {isMyRejectedProposal && topic.rejectReason && (
                                        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
                                            <strong>Lý do từ chối:</strong> {topic.rejectReason}
                                        </div>
                                    )}
                                </div>

                                <div className="topic-card-footer">
                                    <div className="mentor-chip">
                                        <div className="mentor-avatar">
                                            {topic.mentor?.fullName ? topic.mentor.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'GV'}
                                        </div>
                                        <div>
                                            <div className="mentor-name">{topic.mentor?.fullName || 'Chưa phân công'}</div>
                                            {!isMyProposal && (
                                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                    {isFull ? '1/1 SV (Đủ)' : '0/1 SV (Còn 1)'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetail(topic.id)}>
                                            Chi tiết
                                        </button>
                                        {isPendingProposal ? (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ borderColor: '#F87171', color: '#DC2626' }}
                                                onClick={() => handleCancelProposal(topic.id)}
                                            >
                                                Hủy đề xuất
                                            </button>
                                        ) : canRegisterCard && (
                                            <button className="btn btn-primary btn-sm" onClick={() => confirmRegister(topic)}>
                                                Đăng ký
                                            </button>
                                        )}
                                        <button
                                            className={`fav-btn ${isSaved ? 'active' : ''}`}
                                            onClick={(e) => toggleSave(topic.id, e)}
                                            title={isSaved ? 'Bỏ lưu' : 'Lưu đề tài'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? '#DC2626' : 'none'} stroke={isSaved ? '#DC2626' : 'currentColor'} strokeWidth="2">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={[
                                {
                                    key: 'available',
                                    label: (
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            <AppstoreOutlined />
                                            <span>Đề tài có sẵn ({availableTopics.length})</span>
                                        </span>
                                    ),
                                    children: (
                                        <div className="topic-grid">
                                            {availableTopics.length === 0 ? (
                                                <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
                                                    Không tìm thấy đề tài có sẵn nào phù hợp với bộ lọc hiện tại.
                                                </div>
                                            ) : (
                                                availableTopics.map(renderTopicCard)
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'my-proposals',
                                    label: (
                                        <span className="flex items-center gap-1.5 font-semibold">
                                            <BulbOutlined />
                                            <span>Đề tài tôi đề xuất ({myProposedTopics.length})</span>
                                        </span>
                                    ),
                                    children: (
                                        <div className="topic-grid">
                                            {myProposedTopics.length === 0 ? (
                                                <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
                                                    <div>Bạn chưa có đề tài tự đề xuất nào trong bộ lọc hiện tại.</div>
                                                </div>
                                            ) : (
                                                myProposedTopics.map(renderTopicCard)
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    );
                })()}
            </QueryPanel>

            {/* DETAIL MODAL */}
            <Modal
                title={detailTopic?.title || 'Chi Tiết Đề Tài Tốt Nghiệp'}
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={[
                    <button key="close" className="btn btn-secondary" onClick={() => setDetailModalOpen(false)}>
                        Đóng
                    </button>,
                    detailTopic?.proposedById === user?.id && detailTopic?.status === 'PENDING' && (
                        <button
                            key="cancelProposal"
                            className="btn btn-secondary"
                            style={{ borderColor: '#F87171', color: '#DC2626' }}
                            onClick={() => {
                                setDetailModalOpen(false);
                                handleCancelProposal(detailTopic.id);
                            }}
                        >
                            Hủy đề xuất đề tài
                        </button>
                    ),
                    !hasExistingRegistration && detailTopic && detailTopic.status === 'APPROVED' && detailTopic.proposedById !== user?.id && (detailTopic._count?.registrations || 0) < 1 && (
                        <button
                            key="register"
                            className="btn btn-primary"
                            onClick={() => {
                                setDetailModalOpen(false);
                                confirmRegister(detailTopic);
                            }}
                        >
                            Đăng Ký Đề Tài Này
                        </button>
                    ),
                ]}
                width={700}
            >
                {detailTopic && (
                    <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <span className="topic-code-pill">MÃ: {detailTopic.code || 'DA-KTPM'}</span>
                            <span className="tag teal" style={{ marginLeft: 8 }}>{detailTopic.projectCatalog?.name || 'Đồ án tốt nghiệp'}</span>
                            {detailTopic.proposedById === user?.id && (
                                <span
                                    className="tag orange"
                                    style={{
                                        marginLeft: 8,
                                        background: detailTopic.status === 'REJECTED'
                                            ? '#FEE2E2'
                                            : detailTopic.status === 'CANCELLED'
                                              ? '#F1F5F9'
                                              : detailTopic.status === 'APPROVED'
                                                ? '#DCFCE7'
                                                : '#FEF3C7',
                                        color: detailTopic.status === 'REJECTED'
                                            ? '#DC2626'
                                            : detailTopic.status === 'CANCELLED'
                                              ? '#475569'
                                              : detailTopic.status === 'APPROVED'
                                                ? '#15803D'
                                                : '#B45309',
                                        border: `1px solid ${
                                            detailTopic.status === 'REJECTED'
                                                ? '#FCA5A5'
                                                : detailTopic.status === 'CANCELLED'
                                                  ? '#CBD5E1'
                                                  : detailTopic.status === 'APPROVED'
                                                    ? '#86EFAC'
                                                    : '#FCD34D'
                                        }`,
                                    }}
                                >
                                    {detailTopic.status === 'PENDING'
                                        ? 'Đề xuất chờ GVHD duyệt'
                                        : detailTopic.status === 'APPROVED'
                                          ? 'Đề xuất đã được duyệt'
                                          : detailTopic.status === 'CANCELLED'
                                            ? 'Đề xuất đã bị hủy'
                                            : 'Đề xuất bị từ chối'}
                                </span>
                            )}
                        </div>
                        {detailTopic.proposedById === user?.id && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px 20px',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    background: '#F8FAFC',
                                    border: '1px solid var(--border)',
                                    fontSize: 12.5,
                                    color: 'var(--muted)',
                                }}
                            >
                                <span>
                                    Ngày giờ đề xuất:{' '}
                                    <strong style={{ color: 'var(--fg)' }}>
                                        {detailTopic.createdAt ? dayjs(detailTopic.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
                                    </strong>
                                </span>
                                {detailTopic.status === 'CANCELLED' && (
                                    <span>
                                        Ngày giờ hủy:{' '}
                                        <strong style={{ color: '#475569' }}>
                                            {detailTopic.updatedAt ? dayjs(detailTopic.updatedAt).format('DD/MM/YYYY HH:mm') : '—'}
                                        </strong>
                                    </span>
                                )}
                                {detailTopic.status === 'REJECTED' && (
                                    <span>
                                        Ngày giờ bị từ chối:{' '}
                                        <strong style={{ color: '#DC2626' }}>
                                            {detailTopic.updatedAt ? dayjs(detailTopic.updatedAt).format('DD/MM/YYYY HH:mm') : '—'}
                                        </strong>
                                    </span>
                                )}
                                {detailTopic.status === 'APPROVED' && (
                                    <span>
                                        Ngày giờ được duyệt:{' '}
                                        <strong style={{ color: '#15803D' }}>
                                            {detailTopic.updatedAt ? dayjs(detailTopic.updatedAt).format('DD/MM/YYYY HH:mm') : '—'}
                                        </strong>
                                    </span>
                                )}
                            </div>
                        )}
                        {detailTopic.status === 'REJECTED' && detailTopic.rejectReason && (
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13 }}>
                                <strong>Lý do từ chối:</strong> {detailTopic.rejectReason}
                            </div>
                        )}
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase' }}>Giảng viên hướng dẫn:</div>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>{detailTopic.mentor?.fullName || 'Chưa phân công'}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Email: {detailTopic.mentor?.email || '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase' }}>Mục tiêu & Nội dung nghiên cứu:</div>
                            <p style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.6, marginTop: 4 }}>
                                {detailTopic.description || 'Chưa có mô tả chi tiết.'}
                            </p>
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase' }}>Yêu cầu công nghệ &amp; Sản phẩm bàn giao:</div>
                            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                                {detailTopic.requirements?.trim() ? (
                                    <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, color: 'var(--fg)' }}>
                                        {detailTopic.requirements.trim()}
                                    </div>
                                ) : (
                                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <li>Mã nguồn hoàn chỉnh trên Git có tài liệu hướng dẫn cài đặt.</li>
                                        <li>Quyển báo cáo tốt nghiệp chuẩn định dạng Viện (ít nhất 60 trang).</li>
                                        <li>Sản phẩm ứng dụng chạy demo thực tế.</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CONFIRM REGISTER MODAL */}
            <Modal
                title="Xác nhận Đăng ký Đề tài"
                open={confirmModalOpen}
                onCancel={() => setConfirmModalOpen(false)}
                onOk={executeRegister}
                confirmLoading={registering}
                okText="Xác nhận đăng ký"
                cancelText="Hủy"
            >
                <div style={{ paddingTop: 10, fontSize: 13, lineHeight: 1.6 }}>
                    <p>Bạn đang đăng ký đề tài:</p>
                    <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                        {topicToRegister?.title}
                    </p>
                    <p style={{ color: 'var(--muted)' }}>
                        Cán bộ hướng dẫn: <strong>{topicToRegister?.mentor?.fullName}</strong>
                    </p>
                    {myPendingProposal && (
                        <p style={{ color: '#B45309', background: '#FFFBEB', padding: '8px 12px', borderRadius: 6, border: '1px solid #FCD34D', marginTop: 10 }}>
                            ⚠️ Lưu ý: Bạn đang có đề tài tự đề xuất <strong>"{myPendingProposal.title}"</strong>. Khi xác nhận đăng ký đề tài này, đề xuất cũ sẽ tự động được thu hồi.
                        </p>
                    )}
                    <p style={{ color: '#D97706', background: '#FFFBEB', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A', marginTop: 10 }}>
                        Lưu ý: Sau khi đăng ký thành công, thông tin sẽ được gửi trực tiếp đến Giảng viên hướng dẫn để xem xét và duyệt chính thức.
                    </p>
                </div>
            </Modal>

            {/* PROPOSE TOPIC MODAL */}
            <Modal
                title="Đề xuất Đề tài Tự do (Sinh viên chủ động)"
                open={proposeModalOpen}
                onCancel={() => setProposeModalOpen(false)}
                onOk={handleProposeSubmit}
                confirmLoading={submittingPropose}
                okText="Gửi đề xuất"
                cancelText="Hủy"
                width={650}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Tên đề tài đề xuất: <strong style={{ color: 'var(--danger)' }}>*</strong>
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Nhập tên đề tài nghiên cứu..."
                            value={proposeForm.title}
                            onChange={(e) => setProposeForm({ ...proposeForm, title: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Loại đồ án: <strong style={{ color: 'var(--danger)' }}>*</strong>
                        </label>
                        <select
                            className="form-control"
                            value={proposeForm.projectCatalogId || effectiveCatalogId || ''}
                            onChange={(e) => setProposeForm({ ...proposeForm, projectCatalogId: Number(e.target.value) })}
                            style={{ width: '100%' }}
                        >
                            {catalogs.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.code} · {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Giảng viên hướng dẫn mong muốn: <strong style={{ color: 'var(--danger)' }}>*</strong>
                        </label>
                        <select
                            className="form-control"
                            value={proposeForm.mentorId}
                            onChange={(e) => setProposeForm({ ...proposeForm, mentorId: e.target.value })}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Chọn Giảng viên hướng dẫn --</option>
                            {mentors.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.fullName} ({m.email})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Mô tả mục tiêu & Phạm vi dự kiến:
                        </label>
                        <textarea
                            className="input-field"
                            rows={4}
                            placeholder="Nêu tóm tắt mục tiêu nghiên cứu, công nghệ dự kiến và sản phẩm bàn giao..."
                            value={proposeForm.description}
                            onChange={(e) => setProposeForm({ ...proposeForm, description: e.target.value })}
                            style={{ width: '100%', resize: 'vertical' }}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
