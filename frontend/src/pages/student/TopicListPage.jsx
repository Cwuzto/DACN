import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Button,
    Empty,
    Flex,
    Form,
    Input,
    Modal,
    Segmented,
    Select,
    Tag,
    Tooltip,
    message,
} from 'antd';
import {
    ArrowRightOutlined,
    CheckCircleOutlined,
    HeartFilled,
    HeartOutlined,
    InfoCircleOutlined,
    PlusOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import PageHeader from '../../components/common/PageHeader';
import PageLoader from '../../components/common/PageLoader';

const ACTIVE_STATUSES = ['REGISTRATION', 'ONGOING', 'DEFENSE'];

function TopicListPage() {
    const navigate = useNavigate();
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('list');
    const [savedIds, setSavedIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('savedTopics')) || [];
        } catch {
            return [];
        }
    });

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [topicToRegister, setTopicToRegister] = useState(null);

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
                    semesters.find((semester) => semester.registrationOpen && ACTIVE_STATUSES.includes(semester.status)) ||
                    semesters.find((semester) => ACTIVE_STATUSES.includes(semester.status)) ||
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
        if (!currentSemesterId) {
            setTopics([]);
            setMyRegistration(null);
            setMyProjectEnrollments([]);
            setSelectedProjectCatalogId(null);
            setAccountRestricted(false);
            setAccountRestrictionReason('');
            return;
        }

        setLoading(true);
        try {
            const params = { semesterId: currentSemesterId };
            if (selectedProjectCatalogId) params.projectCatalogId = selectedProjectCatalogId;

            const [topicRes, regRes, enrollRes] = await Promise.all([
                topicService.getAll(params),
                registrationService.getMyRegistration({ semesterId: currentSemesterId }),
                registrationService.getMyProjectEnrollments({ semesterId: currentSemesterId }),
            ]);

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

    const normalizedSearch = useMemo(
        () => searchText.replace(/\s+/g, ' ').trim().toLowerCase(),
        [searchText],
    );

    const filteredTopics = useMemo(() => {
        if (!normalizedSearch) return topics;

        const tokens = normalizedSearch.split(' ').filter(Boolean);
        if (tokens.length === 0) return topics;

        return topics.filter((topic) => {
            const title = (topic.title || '').toLowerCase();
            const mentorName = (topic.mentor?.fullName || '').toLowerCase();
            return tokens.every((token) => title.includes(token) || mentorName.includes(token));
        });
    }, [topics, normalizedSearch]);

    const toggleSave = (id, event) => {
        if (event) event.stopPropagation();
        setSavedIds((previous) => {
            const next = previous.includes(id)
                ? previous.filter((item) => item !== id)
                : [...previous, id];
            localStorage.setItem('savedTopics', JSON.stringify(next));
            return next;
        });
    };

    const handleViewDetail = async (id) => {
        try {
            const response = await topicService.getById(id);
            setDetailTopic(response.data);
            setDetailModalOpen(true);
        } catch {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const hasExistingRegistration = Boolean(myRegistration && myRegistration.status !== 'REJECTED');
    const registrationWindow = getRegistrationWindowState();
    const isRegistrationBlocked = !registrationWindow.canRegister;
    const hasAnyEligibleProject = myProjectEnrollments.length > 0;
    const registrationBlockedByProjectEnrollment = !accountRestricted && (!hasAnyEligibleProject || !selectedProjectCatalogId);

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

        if (registrationBlockedByProjectEnrollment) {
            message.warning('Bạn chưa có môn đồ án hợp lệ trong đợt hiện tại.');
            return;
        }
        if (accountRestricted) {
            message.warning(accountRestrictionReason || 'Tài khoản đã hoàn thành đồ án, không thể đăng ký mới.');
            return;
        }

        if (topic.projectCatalogId !== selectedProjectCatalogId) {
            message.warning('Đề tài không thuộc tên đồ án bạn đã chọn.');
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

        if (!currentSemesterId) {
            message.warning('Chưa có đợt đồ án hoạt động để đề xuất đề tài.');
            return;
        }

        if (isRegistrationBlocked) {
            message.warning(registrationWindow.reason || 'Đăng ký đang tạm đóng.');
            return;
        }

        if (!proposeForm.title || !proposeForm.mentorId || !proposeForm.description) {
            message.warning('Vui lòng điền đầy đủ thông tin đề xuất.');
            return;
        }

        if (registrationBlockedByProjectEnrollment) {
            message.warning('Bạn chưa có môn đồ án hợp lệ trong đợt hiện tại.');
            return;
        }
        if (accountRestricted) {
            message.warning(accountRestrictionReason || 'Tài khoản đã hoàn thành đồ án, không thể đề xuất đề tài mới.');
            return;
        }

        try {
            setSubmittingPropose(true);
            const response = await topicService.create({
                title: proposeForm.title,
                description: proposeForm.description,
                mentorId: proposeForm.mentorId,
                semesterId: currentSemesterId,
                projectCatalogId: selectedProjectCatalogId,
            });

            if (response.success) {
                message.success('Đã gửi đề xuất đề tài thành công. Vui lòng chờ giảng viên xem xét.');
                setProposeForm({ title: '', mentorId: '', description: '' });
                setActiveTab('list');
                fetchTopicsAndRegistration();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi gửi đề xuất.');
        } finally {
            setSubmittingPropose(false);
        }
    };

    const renderRegistrationStatusLabel = (status) => {
        if (status === 'PENDING') return 'Chờ duyệt';
        if (status === 'REJECTED') return 'Từ chối';
        if (status === 'APPROVED') return 'Đã duyệt';
        if (status === 'IN_PROGRESS') return 'Đang thực hiện';
        if (status === 'SUBMITTED') return 'Đã nộp';
        if (status === 'DEFENDED') return 'Đã bảo vệ';
        if (status === 'COMPLETED') return 'Hoàn thành';
        return status;
    };

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Sinh viên' },
                    { label: 'Khóa luận & Đồ án' },
                    { label: 'Đăng ký đề tài' },
                ]}
                title="Đăng ký Đề tài Khóa luận"
                subtitle="Duyệt danh sách đề tài mở từ giảng viên hoặc gửi hồ sơ đề xuất hướng nghiên cứu mới."
                tags={[
                    { label: currentSemester?.name || 'Học kỳ', color: 'blue' },
                    {
                        label: isRegistrationBlocked ? 'Đang đóng đăng ký' : 'Đang mở đăng ký',
                        color: isRegistrationBlocked ? 'default' : 'green',
                    },
                ]}
            />

            {/* Registration Window Alerts */}
            {registrationBlockedByProjectEnrollment && (
                <Alert
                    type="error"
                    showIcon
                    message="Chưa có môn đồ án hợp lệ"
                    description="Bạn chưa được gán môn đồ án tốt nghiệp trong đợt học kỳ này, do đó chưa đủ điều kiện đăng ký đề tài."
                />
            )}
            {accountRestricted && (
                <Alert
                    type="warning"
                    showIcon
                    message="Tài khoản đã hoàn tất đồ án"
                    description={accountRestrictionReason || 'Bạn đã hoàn thành đồ án tốt nghiệp nên không thể thực hiện đăng ký mới.'}
                />
            )}
            {!registrationBlockedByProjectEnrollment && !accountRestricted && isRegistrationBlocked && (
                <Alert
                    type="info"
                    showIcon
                    message="Thông báo thời gian đăng ký"
                    description={registrationWindow.reason}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Area (8 Cols) */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Navigation Tab Segmented */}
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <Segmented
                            size="large"
                            value={activeTab}
                            onChange={setActiveTab}
                            options={[
                                { label: 'Chọn đề tài có sẵn', value: 'list' },
                                { label: 'Đề xuất đề tài mới', value: 'propose' },
                            ]}
                        />
                        <div className="text-xs text-slate-500">
                            Số lượng hiển thị: <b className="text-slate-800">{filteredTopics.length}</b> đề tài
                        </div>
                    </div>

                    {activeTab === 'list' && (
                        <>
                            {/* Search and Filter Toolbar */}
                            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
                                <Input
                                    placeholder="Tìm theo tên đề tài, giảng viên..."
                                    prefix={<SearchOutlined />}
                                    allowClear
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    className="w-full sm:flex-1"
                                    size="middle"
                                />
                                <Select
                                    placeholder="Tên môn đồ án"
                                    value={selectedProjectCatalogId}
                                    onChange={(val) => setSelectedProjectCatalogId(val)}
                                    className="w-full sm:w-64"
                                    options={myProjectEnrollments.map((row) => ({
                                        value: row.projectCatalogId,
                                        label: row.projectCatalog?.name || 'Đồ án',
                                    }))}
                                    notFoundContent="Chưa có môn đồ án"
                                />
                            </div>

                            {/* Topics Grid */}
                            {loading ? (
                                <PageLoader />
                            ) : filteredTopics.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-12 text-center">
                                    <Empty description="Không tìm thấy đề tài nào phù hợp với bộ lọc." />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredTopics.map((topic) => {
                                        const registrationsCount = topic._count?.registrations || 0;
                                        const maxStudents = 1;
                                        const isFull = registrationsCount >= maxStudents;
                                        const isSaved = savedIds.includes(topic.id);
                                        const isMyTopic = myRegistration?.topicId === topic.id && myRegistration?.status !== 'REJECTED';

                                        return (
                                            <div
                                                key={topic.id}
                                                className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-5 flex flex-col justify-between"
                                            >
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {isFull ? (
                                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                    Đã đủ sinh viên
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    Còn chỗ đăng ký
                                                                </span>
                                                            )}
                                                            <span className="text-xs font-mono text-slate-400">
                                                                DT-{String(topic.id).padStart(3, '0')}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={(e) => toggleSave(topic.id, e)}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                                            title={isSaved ? 'Bỏ lưu' : 'Lưu đề tài'}
                                                        >
                                                            {isSaved ? (
                                                                <HeartFilled className="text-rose-500 text-base" />
                                                            ) : (
                                                                <HeartOutlined className="text-base" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    <h3
                                                        onClick={() => handleViewDetail(topic.id)}
                                                        className="font-bold text-slate-900 text-sm leading-snug cursor-pointer hover:text-blue-600 transition-colors line-clamp-2 min-h-[2.5rem]"
                                                    >
                                                        {topic.title}
                                                    </h3>

                                                    {/* Mentor info */}
                                                    <div className="flex items-center gap-2.5 pt-1">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                            {topic.mentor?.fullName ? topic.mentor.fullName.charAt(0) : <UserOutlined />}
                                                        </div>
                                                        <div className="text-xs">
                                                            <p className="font-semibold text-slate-800 leading-tight">
                                                                {topic.mentor?.fullName || 'Chưa phân công'}
                                                            </p>
                                                            <p className="text-slate-400 font-mono">
                                                                {topic.mentor?.code || 'GVHD'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Student quota indicator */}
                                                    <div className="space-y-1.5 pt-1">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span className="text-slate-500">Chỉ tiêu sinh viên</span>
                                                            <span className={isFull ? 'text-rose-600 font-bold' : 'text-blue-600 font-bold'}>
                                                                {registrationsCount}/{maxStudents} SV
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${isFull ? 'bg-rose-500' : 'bg-blue-600'}`}
                                                                style={{ width: `${(registrationsCount / maxStudents) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
                                                    <Button
                                                        size="middle"
                                                        onClick={() => handleViewDetail(topic.id)}
                                                        className="flex-1"
                                                    >
                                                        Chi tiết
                                                    </Button>

                                                    {isMyTopic ? (
                                                        <Button
                                                            size="middle"
                                                            type="primary"
                                                            className="flex-1 !bg-emerald-600 !border-emerald-600"
                                                            icon={<CheckCircleOutlined />}
                                                        >
                                                            Đã chọn
                                                        </Button>
                                                    ) : isFull ? (
                                                        <Button
                                                            size="middle"
                                                            disabled
                                                            className="flex-1"
                                                        >
                                                            Đã đủ chỗ
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="middle"
                                                            type="primary"
                                                            onClick={() => confirmRegister(topic)}
                                                            disabled={hasExistingRegistration || isRegistrationBlocked || registrationBlockedByProjectEnrollment || accountRestricted}
                                                            className="flex-1 font-medium"
                                                        >
                                                            {hasExistingRegistration ? 'Đã có đề tài' : 'Đăng ký'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'propose' && (
                        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 lg:p-8 space-y-6">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Đề xuất Đề tài mới</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Điền thông tin ý tưởng nghiên cứu của bạn và gửi cho giảng viên mong muốn phê duyệt.
                                </p>
                            </div>

                            {hasExistingRegistration ? (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Bạn đã đăng ký đề tài"
                                    description="Hệ thống quy định mỗi sinh viên chỉ thực hiện 1 đề tài trong một học kỳ. Bạn không thể gửi thêm đề xuất mới."
                                />
                            ) : accountRestricted ? (
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="Tài khoản đã hoàn tất đồ án"
                                    description={accountRestrictionReason || 'Không thể đề xuất đề tài mới.'}
                                />
                            ) : isRegistrationBlocked ? (
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="Đợt đăng ký đang đóng"
                                    description={registrationWindow.reason}
                                />
                            ) : (
                                <form className="space-y-4" onSubmit={handleProposeSubmit}>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Tên đề tài đề xuất <span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            required
                                            size="large"
                                            placeholder="Ví dụ: Xây dựng hệ thống nhận diện điểm danh thông minh..."
                                            value={proposeForm.title}
                                            onChange={(e) => setProposeForm({ ...proposeForm, title: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Giảng viên hướng dẫn mong muốn <span className="text-rose-500">*</span>
                                        </label>
                                        <Select
                                            size="large"
                                            showSearch
                                            optionFilterProp="label"
                                            className="w-full"
                                            placeholder="Chọn giảng viên hướng dẫn..."
                                            value={proposeForm.mentorId || undefined}
                                            onChange={(val) => setProposeForm({ ...proposeForm, mentorId: val })}
                                            options={mentors.map((m) => ({
                                                value: m.id,
                                                label: `${m.fullName} (${m.code || 'GV'})`,
                                            }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Mô tả mục tiêu và nội dung nghiên cứu <span className="text-rose-500">*</span>
                                        </label>
                                        <Input.TextArea
                                            required
                                            rows={5}
                                            placeholder="Nêu rõ lý do chọn đề tài, mục tiêu cần đạt, phương pháp công nghệ áp dụng..."
                                            value={proposeForm.description}
                                            onChange={(e) => setProposeForm({ ...proposeForm, description: e.target.value })}
                                        />
                                    </div>

                                    <Button
                                        type="primary"
                                        size="large"
                                        htmlType="submit"
                                        loading={submittingPropose}
                                        block
                                        className="font-medium mt-2"
                                    >
                                        Gửi đề xuất cho Giảng viên
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column (4 Cols): Registration Status */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-blue-600 text-base">how_to_reg</span>
                                Hồ sơ Đăng ký của bạn
                            </h3>
                        </div>

                        <div className="p-5">
                            {myRegistration ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Trạng thái</span>
                                        <Tag color={
                                            ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(myRegistration.status)
                                                ? 'success'
                                                : myRegistration.status === 'REJECTED'
                                                    ? 'error'
                                                    : 'warning'
                                        }>
                                            {renderRegistrationStatusLabel(myRegistration.status)}
                                        </Tag>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-400">Đề tài</p>
                                        <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5">
                                            {myRegistration.topic?.title || 'Chưa rõ tên đề tài'}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-400">Giảng viên hướng dẫn</p>
                                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                                            {myRegistration.topic?.mentor?.fullName || 'Chưa phân công'}
                                        </p>
                                    </div>

                                    {myRegistration.status === 'REJECTED' && myRegistration.rejectReason && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                                            <p className="font-bold">Lý do từ chối:</p>
                                            <p className="mt-0.5">{myRegistration.rejectReason}</p>
                                        </div>
                                    )}

                                    {['APPROVED', 'IN_PROGRESS'].includes(myRegistration.status) && (
                                        <div className="pt-2">
                                            <Button
                                                type="primary"
                                                block
                                                icon={<ArrowRightOutlined />}
                                                onClick={() => navigate('/student/submissions')}
                                            >
                                                Nộp báo cáo BM
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 space-y-2 text-slate-400 text-xs">
                                    <span className="material-symbols-outlined text-3xl text-slate-300">drafts</span>
                                    <p>Bạn chưa đăng ký đề tài nào trong đợt này.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Topic Details Modal */}
            <Modal
                title={<span className="font-bold text-slate-900">Chi tiết đề tài khóa luận</span>}
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailModalOpen(false)}>
                        Đóng
                    </Button>,
                    !hasExistingRegistration && detailTopic && (
                        <Button
                            key="register"
                            type="primary"
                            onClick={() => {
                                setDetailModalOpen(false);
                                confirmRegister(detailTopic);
                            }}
                            disabled={isRegistrationBlocked || registrationBlockedByProjectEnrollment || accountRestricted}
                        >
                            Đăng ký đề tài này
                        </Button>
                    ),
                ]}
                width={640}
            >
                {detailTopic && (
                    <div className="space-y-4 py-3">
                        <div>
                            <span className="text-xs font-mono text-slate-400">DT-{String(detailTopic.id).padStart(3, '0')}</span>
                            <h2 className="text-lg font-bold text-slate-900 mt-1">{detailTopic.title}</h2>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 text-xs space-y-1">
                            <p><b>GVHD:</b> {detailTopic.mentor?.fullName} ({detailTopic.mentor?.email || 'N/A'})</p>
                            <p><b>Chuyên ngành:</b> {detailTopic.projectCatalog?.name || 'Đồ án tốt nghiệp'}</p>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase mb-1.5">Mô tả và Yêu cầu nghiên cứu:</h4>
                            <div className="text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 whitespace-pre-line leading-relaxed">
                                {detailTopic.description || 'Chưa có thông tin mô tả chi tiết cho đề tài này.'}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Registration Modal */}
            <Modal
                title={<span className="font-bold text-slate-900">Xác nhận đăng ký đề tài</span>}
                open={confirmModalOpen}
                onCancel={() => setConfirmModalOpen(false)}
                onOk={executeRegister}
                confirmLoading={registering}
                okText="Xác nhận đăng ký"
                cancelText="Hủy bỏ"
                width={500}
            >
                <div className="py-3 space-y-3">
                    <p className="text-xs text-slate-600">
                        Bạn có chắc chắn muốn đăng ký đề tài sau đây không?
                    </p>
                    <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 space-y-1 text-xs">
                        <p className="font-bold text-blue-900 text-sm">{topicToRegister?.title}</p>
                        <p className="text-slate-600">GVHD: <b>{topicToRegister?.mentor?.fullName}</b></p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default TopicListPage;
