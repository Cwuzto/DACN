import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Modal,
    message,
} from 'antd';
import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';

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
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterMajor, setFilterMajor] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

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

    const [myRegistration, setMyRegistration] = useState(null);
    const [registering, setRegistering] = useState(false);
    const [currentSemesterId, setCurrentSemesterId] = useState(null);
    const [currentSemester, setCurrentSemester] = useState(null);
    const [myProjectEnrollments, setMyProjectEnrollments] = useState([]);
    const [selectedProjectCatalogId, setSelectedProjectCatalogId] = useState(null);
    const [accountRestricted, setAccountRestricted] = useState(false);
    const [accountRestrictionReason, setAccountRestrictionReason] = useState('');
    const [mentors, setMentors] = useState([]);

    const [proposeForm, setProposeForm] = useState({ title: '', mentorId: '', description: '' });
    const [submittingPropose, setSubmittingPropose] = useState(false);

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

    const fetchContextData = useCallback(async () => {
        try {
            const [semesterRes, mentorRes] = await Promise.all([
                semesterService.getAll(),
                topicService.getMentors(),
            ]);

            if (semesterRes.success) {
                const semesters = semesterRes.data || [];
                const preferredSemester =
                    semesters.find((s) => s.registrationOpen && ACTIVE_STATUSES.includes(s.status)) ||
                    semesters.find((s) => ACTIVE_STATUSES.includes(s.status)) ||
                    semesters?.[0] ||
                    null;

                setCurrentSemester(preferredSemester);
                setCurrentSemesterId(preferredSemester?.id || null);
            }

            if (mentorRes.success) {
                setMentors(mentorRes.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu ngữ cảnh đăng ký.');
        }
    }, []);

    const fetchTopicsAndRegistration = useCallback(async () => {
        if (!currentSemesterId) return;

        setLoading(true);
        try {
            const params = { semesterId: currentSemesterId };
            if (selectedProjectCatalogId) params.projectCatalogId = selectedProjectCatalogId;

            const [topicRes, regRes, enrollRes, mentorRes] = await Promise.all([
                topicService.getAll(params),
                registrationService.getMyRegistration({ semesterId: currentSemesterId }),
                registrationService.getMyProjectEnrollments({ semesterId: currentSemesterId }),
                topicService.getMentors({
                    semesterId: currentSemesterId,
                    ...(selectedProjectCatalogId ? { projectCatalogId: selectedProjectCatalogId } : {}),
                }),
            ]);

            if (mentorRes.success && Array.isArray(mentorRes.data) && mentorRes.data.length > 0) {
                setMentors(mentorRes.data);
            }

            if (topicRes.success) {
                setTopics((topicRes.data || []).map((topic, index) => ({
                    ...topic,
                    key: topic.id,
                    stt: index + 1,
                })));
            }

            if (regRes.success) {
                setMyRegistration(regRes.data);
            }

            if (enrollRes.success) {
                const activeEnrollments = (enrollRes.data || []).filter(
                    (row) => row.status === 'ACTIVE' && row.projectCatalog?.isActive,
                );
                setMyProjectEnrollments(activeEnrollments);
                setAccountRestricted(Boolean(enrollRes.meta?.accountRestricted));
                setAccountRestrictionReason(enrollRes.meta?.accountRestrictionReason || '');

                const activeCatalogIds = activeEnrollments.map((row) => row.projectCatalogId);
                setSelectedProjectCatalogId((prev) => {
                    if (prev && activeCatalogIds.includes(prev)) return prev;
                    return activeCatalogIds[0] || null;
                });
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [currentSemesterId, selectedProjectCatalogId]);

    useEffect(() => {
        fetchContextData();
    }, [fetchContextData]);

    useEffect(() => {
        fetchTopicsAndRegistration();
    }, [fetchTopicsAndRegistration]);

    // Filter logic
    const filteredTopics = useMemo(() => {
        let result = topics;

        if (filterSavedOnly) {
            result = result.filter((t) => savedIds.includes(t.id));
        }

        if (filterStatus === 'AVAILABLE') {
            result = result.filter((t) => (t._count?.registrations || 0) < 1);
        } else if (filterStatus === 'FULL') {
            result = result.filter((t) => (t._count?.registrations || 0) >= 1);
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
    const registrationWindow = getRegistrationWindowState();
    const isRegistrationBlocked = !registrationWindow.canRegister;

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
        if (!topicToRegister || !currentSemesterId) return;
        try {
            setRegistering(true);
            const response = await registrationService.registerTopic(topicToRegister.id, currentSemesterId);
            if (response.success) {
                message.success('Đăng ký đề tài thành công.');
                setConfirmModalOpen(false);
                fetchTopicsAndRegistration();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi đăng ký đề tài.');
        } finally {
            setRegistering(false);
        }
    };

    const handleProposeSubmit = async (e) => {
        e?.preventDefault();
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
            const payload = {
                title: proposeForm.title.trim(),
                description: proposeForm.description.trim(),
                mentorId: proposeForm.mentorId,
                semesterId: currentSemesterId,
                projectCatalogId: selectedProjectCatalogId,
            };
            const res = await topicService.propose(payload);
            if (res.success) {
                message.success('Đã gửi đề xuất đề tài thành công!');
                setProposeModalOpen(false);
                setProposeForm({ title: '', mentorId: '', description: '' });
                fetchTopicsAndRegistration();
            }
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
                    background: '#F0FDFA',
                    border: '1px solid #CCFBF1',
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
                            background: '#CCFBF1',
                            color: '#0F766E',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            fontWeight: 700,
                        }}
                    >
                        ⏱
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F766E' }}>
                            Đợt Đăng Ký Đề Tài Học Kỳ 1 (2026-2027) Đang Mở
                        </div>
                        <div style={{ fontSize: 12, color: '#115E59', marginTop: 2 }}>
                            {hasExistingRegistration ? (
                                <span>Bạn đã đăng ký đề tài: <strong>{myRegistration?.topic?.title}</strong> · Trạng thái: <strong>{formatRegistrationStatus(myRegistration?.status)}</strong></span>
                            ) : (
                                <span>Thời gian đăng ký trực tuyến theo quy chế Viện. Mỗi sinh viên chỉ đăng ký 1 đề tài duy nhất.</span>
                            )}
                        </div>
                    </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setProposeModalOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Đề xuất đề tài tự do</span>
                </button>
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
                </div>
            </div>

            {/* Topics Grid */}
            <div className="topic-grid">
                {filteredTopics.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
                        Không tìm thấy đề tài nào phù hợp với bộ lọc hiện tại.
                    </div>
                ) : (
                    filteredTopics.map((topic) => {
                        const isMine = myRegistration?.topicId === topic.id;
                        const isSaved = savedIds.includes(topic.id);
                        const regCount = topic._count?.registrations || 0;
                        const isFull = regCount >= 1; // 1 SV / 1 đề tài

                        return (
                            <div className="topic-card" key={topic.id}>
                                <div>
                                    <div className="topic-card-header">
                                        <span className="tag teal">
                                            {topic.projectCatalog?.name || 'Kỹ thuật Phần mềm'}
                                        </span>
                                        {isMine ? (
                                            <span className="tag green">Đề tài của bạn</span>
                                        ) : isFull ? (
                                            <span className="tag gray">Đã đủ sinh viên</span>
                                        ) : (
                                            <span className="tag green">Còn nhận SV (0/1)</span>
                                        )}
                                    </div>
                                    <h3 className="topic-card-title">{topic.title}</h3>
                                    <p className="topic-card-desc">
                                        {topic.description || 'Nghiên cứu ứng dụng công nghệ hiện đại, xây dựng kiến trúc hệ thống phân tán và hiện thực giải pháp kiểm thử tự động.'}
                                    </p>
                                    <div className="topic-tech-tags">
                                        <span className="tech-tag">React / Next.js</span>
                                        <span className="tech-tag">Node.js / Go</span>
                                        <span className="tech-tag">PostgreSQL</span>
                                        <span className="tech-tag">Docker</span>
                                    </div>
                                </div>

                                <div className="topic-card-footer">
                                    <div className="mentor-chip">
                                        <div className="mentor-avatar">
                                            {topic.mentor?.fullName ? topic.mentor.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'GV'}
                                        </div>
                                        <div>
                                            <div className="mentor-name">{topic.mentor?.fullName || 'Chưa phân công'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                {isFull ? '1/1 SV (Đủ)' : '0/1 SV (Còn 1)'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetail(topic.id)}>
                                            Chi tiết
                                        </button>
                                        {!isMine && !isFull && !hasExistingRegistration && (
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
                    })
                )}
            </div>

            {/* DETAIL MODAL */}
            <Modal
                title={detailTopic?.title || 'Chi Tiết Đề Tài Tốt Nghiệp'}
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={[
                    <button key="close" className="btn btn-secondary" onClick={() => setDetailModalOpen(false)}>
                        Đóng
                    </button>,
                    !hasExistingRegistration && detailTopic && (detailTopic._count?.registrations || 0) < 1 && (
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
                        </div>
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
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase' }}>Yêu cầu công nghệ & Sản phẩm bàn giao:</div>
                            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }}>
                                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <li>Mã nguồn hoàn chỉnh trên Git có tài liệu hướng dẫn cài đặt.</li>
                                    <li>Quyển báo cáo tốt nghiệp chuẩn định dạng Viện (ít nhất 60 trang).</li>
                                    <li>Sản phẩm ứng dụng chạy demo thực tế.</li>
                                </ul>
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
