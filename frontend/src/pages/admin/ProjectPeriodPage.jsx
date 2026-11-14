import { useSemesters } from '../../queries/semesterQueries';
import { usePeriodRegistrations, usePeriodTopics, usePublicLecturers, usePeriodMutation } from '../../queries/periodQueries';
import { useDelegations, useDelegationMutation } from '../../queries/delegationQueries';
import { useDecisionAppendices, useBm02aQueue, useBm02aMutation } from '../../queries/bm02aQueries';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Alert,
    Badge,
    Button,
    Col,
    ConfigProvider,
    DatePicker,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Popconfirm,
    Row,
    Select,
    Space,
    Spin,
    Steps,
    Switch,
    Tabs,
    Tooltip,
    Table,
    Tag,
} from 'antd';
import {
    ArrowRightOutlined,
    AuditOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    CloseOutlined,
    ClockCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    FileDoneOutlined,
    FilePdfOutlined,
    HistoryOutlined,
    PlusOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import useAuthStore from '../../stores/authStore';
import { PROJECT_NAME, buildSemesterName, buildSemesterCode, extractSemesterMeta, formatSemesterLabel } from '../../utils/semesterDisplay';
import BM02ReviewDrawer from '../../components/admin/BM02ReviewDrawer';

const EMPTY_LIST = [];

const GRANTABLE_CAPABILITIES = [
    { value: 'OUTLINE_REVIEW', label: 'Thẩm định đề cương chi tiết' },
    { value: 'BM02_REVIEW', label: 'Duyệt đơn đăng ký đề tài' },
    { value: 'DEFENSE_SCORE_SUBMIT', label: 'Chấm điểm bảo vệ đồ án' },
    { value: 'DEFENSE_RESULT_APPROVE', label: 'Phê duyệt kết quả bảo vệ' },
];

const statusConfig = {
    ONGOING: { label: 'Đang diễn ra', color: 'green', tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REGISTRATION: { label: 'Đang đăng ký', color: 'orange', tw: 'bg-amber-50 text-amber-700 border-amber-200' },
    UPCOMING: { label: 'Sắp tới', color: 'blue', tw: 'bg-blue-50 text-blue-700 border-blue-200' },
    DEFENSE: { label: 'Bảo vệ', color: 'purple', tw: 'bg-purple-50 text-purple-700 border-purple-200' },
    COMPLETED: { label: 'Hoàn thành', color: 'default', tw: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS = 14;

const getToggleWindowWarning = (period) => {
    const startDate = period?.rawData?.startDate;
    const registrationDeadline = period?.rawData?.registrationDeadline;

    if (!startDate || !registrationDeadline) {
        return 'Học kỳ chưa đủ mốc thời gian để đối chiếu cửa sổ khuyến nghị, hệ thống vẫn cho phép thay đổi.';
    }

    const start = dayjs(startDate);
    const deadline = dayjs(registrationDeadline);
    if (!start.isValid() || !deadline.isValid()) {
        return 'Dữ liệu ngày không hợp lệ, hệ thống vẫn cho phép thay đổi trạng thái đăng ký.';
    }

    const now = dayjs();
    const windowStart = start.subtract(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');
    const windowEnd = deadline.add(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');

    if (now.isBefore(windowStart) || now.isAfter(windowEnd)) {
        return `Bạn đang thay đổi ngoài khuyến nghị (${windowStart.format('DD/MM/YYYY')} - ${windowEnd.format('DD/MM/YYYY')}).`;
    }

    return null;
};

function PeriodTimeline({ milestones, status }) {
    let currentStep = -1;
    let stepStatus = 'process';

    if (status === 'REGISTRATION') currentStep = 1;
    if (status === 'ONGOING') currentStep = 2;
    if (status === 'DEFENSE') currentStep = 3;
    if (status === 'COMPLETED') {
        currentStep = 4;
        stepStatus = 'finish';
    }

    const colorHexMap = {
        green: '#10B981',
        orange: '#F59E0B',
        blue: '#0F766E',
        purple: '#7C3AED',
        default: '#64748B',
    };
    const activeHex = colorHexMap[statusConfig[status]?.color] || '#0F766E';

    return (
        <ConfigProvider theme={{ token: { colorPrimary: activeHex } }}>
            <Steps
                size="small"
                labelPlacement="vertical"
                current={currentStep}
                status={stepStatus}
                items={milestones.map((milestone) => ({
                    title: <span className="text-xs font-semibold text-slate-700">{milestone.title}</span>,
                    description: milestone.date ? (
                        <span className="text-[11px] text-slate-500 font-semibold">{milestone.date}</span>
                    ) : null,
                }))}
                style={{ width: '100%', maxWidth: 580, margin: '0 auto' }}
            />
        </ConfigProvider>
    );
}

function PeriodCard({ period, onEdit, onDelete, onClone, onIssueDecision, onViewDecisionList, onManageAppendices, isAdmin = true }) {
    const isCompleted = period.status === 'COMPLETED';
    const cfg = statusConfig[period.status] || statusConfig.UPCOMING;

    return (
        <div
            className={`bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition-all duration-150 ${
                isCompleted ? 'opacity-80 bg-slate-50/40' : ''
            }`}
        >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                {/* Period Identity */}
                <div className="w-full xl:w-64 shrink-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.tw}`}>
                            {cfg.label}
                        </span>
                        {period.registrationOpen && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Đang mở ĐK
                            </span>
                        )}
                    </div>
                    <h4 className="text-base font-black text-slate-900 leading-snug">{period.name}</h4>
                    <p className="text-xs text-slate-500 font-medium">Mã đợt: {period.code}</p>
                    {period.decisionPublishedAt && (
                        <div className="text-[11px] text-purple-700 font-medium flex items-center gap-1">
                            <ClockCircleOutlined />
                            <span>Công bố QĐ: {dayjs(period.decisionPublishedAt).format('DD/MM/YYYY HH:mm')}</span>
                        </div>
                    )}
                </div>

                {/* Progress Steps Timeline */}
                <div className="flex-1 w-full overflow-x-auto py-2">
                    <PeriodTimeline milestones={period.milestones} status={period.status} />
                </div>

                {/* Stats & Actions Strip */}
                <div className="w-full xl:w-64 shrink-0 flex xl:flex-col items-center xl:items-end justify-between xl:justify-center gap-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                    {period.status === 'UPCOMING' ? (
                        <p className="text-xs text-slate-500 italic font-medium">Chưa mở đợt</p>
                    ) : isCompleted ? (
                        <p className="text-xs text-slate-500 italic font-medium">Đã kết thúc & lưu trữ</p>
                    ) : (
                        <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-600">
                                <strong className="text-slate-900">{period.topics}</strong> đề tài
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600">
                                <strong className="text-blue-600">{period.students}</strong> SV
                            </span>
                        </div>
                    )}

                    <Space size="small" wrap>
                        {!isCompleted && onIssueDecision && (
                            <Tooltip title="Ban hành Quyết định giao đề tài">
                                <Button
                                    type="primary"
                                    icon={<FileDoneOutlined />}
                                    size="small"
                                    className="!bg-purple-600 hover:!bg-purple-700 font-medium"
                                    onClick={() => onIssueDecision(period)}
                                >
                                    Ban hành QĐ
                                </Button>
                            </Tooltip>
                        )}
                        {onViewDecisionList && (
                            <Tooltip title="Xem danh sách đề tài đã ban hành Quyết định">
                                <Button
                                    icon={<EyeOutlined />}
                                    size="small"
                                    className="!text-purple-700 hover:!text-purple-800 !border-purple-200 hover:!border-purple-400 bg-purple-50/50 font-medium"
                                    onClick={() => onViewDecisionList(period)}
                                >
                                    Danh sách QĐ
                                </Button>
                            </Tooltip>
                        )}
                        {onManageAppendices && (
                            <Tooltip title="Quản lý Phụ lục điều chỉnh tên đề tài (BM02-A)">
                                <Button
                                    icon={<AuditOutlined />}
                                    size="small"
                                    className="!text-teal-700 hover:!text-teal-800 !border-teal-200 hover:!border-teal-400 bg-teal-50/50 font-medium"
                                    onClick={() => onManageAppendices(period)}
                                >
                                    Phụ lục điều chỉnh
                                </Button>
                            </Tooltip>
                        )}
                        {isAdmin && (
                            <Tooltip title="Sao chép cấu hình">
                                <Button
                                    icon={<CopyOutlined />}
                                    size="small"
                                    onClick={() => onClone(period)}
                                />
                            </Tooltip>
                        )}
                        {!isCompleted && isAdmin && (
                            <Tooltip title="Chỉnh sửa đợt">
                                <Button
                                    icon={<EditOutlined />}
                                    size="small"
                                    onClick={() => onEdit(period)}
                                />
                            </Tooltip>
                        )}
                        {!isCompleted && isAdmin && (
                            <Tooltip title="Xóa đợt">
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    onClick={() => onDelete(period.id)}
                                />
                            </Tooltip>
                        )}
                    </Space>
                </div>
            </div>
        </div>
    );
}

function ProjectPeriodPage() {
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const isAdmin = user?.role === 'ADMIN';

    const userPermissions = useMemo(() => user?.permissions || [], [user?.permissions]);
    const canViewDelegations = useMemo(
        () => userPermissions.includes('VIEW_ACADEMIC_DELEGATIONS') || userPermissions.includes('PERMISSION_ASSIGN_ACADEMIC'),
        [userPermissions]
    );
    const canAssignAcademic = useMemo(
        () => userPermissions.includes('PERMISSION_ASSIGN_ACADEMIC'),
        [userPermissions]
    );

    const [defaultSemesterId, setDefaultSemesterId] = useState(null);
    const scope = queryKeys.scope(user);
    const semestersQuery = useSemesters(scope);
    const topicsQuery = usePeriodTopics(scope);
    const registrationsQuery = usePeriodRegistrations(scope, { asInstituteDirector: 'true' });
    const periodMutation = usePeriodMutation(scope);
    const delegationMutation = useDelegationMutation(scope);
    const loading = semestersQuery.isPending;
    const allRegistrations = registrationsQuery.data || EMPTY_LIST;
    const periods = useMemo(() => {
        const topicData = topicsQuery.data || EMPTY_LIST;
        const registrationData = registrationsQuery.data || EMPTY_LIST;
            const topicsBySemester = topicData.reduce((acc, topic) => {
                acc[topic.semesterId] = (acc[topic.semesterId] || 0) + 1;
                return acc;
            }, {});

            const studentsBySemester = registrationData.reduce((acc, registration) => {
                acc[registration.semesterId] = (acc[registration.semesterId] || 0) + 1;
                return acc;
            }, {});

            const mapped = (semestersQuery.data || []).map((semester) => ({
                ...extractSemesterMeta(semester),
                key: semester.id.toString(),
                id: semester.id,
                name: formatSemesterLabel(semester),
                code: semester.code || buildSemesterCode({
                    projectCode: 'DATN',
                    term: extractSemesterMeta(semester).term,
                    academicYear: extractSemesterMeta(semester).academicYear,
                }),
                status: semester.status,
                registrationOpen:
                    typeof semester.registrationOpen === 'boolean' ? semester.registrationOpen : true,
                topics: topicsQuery.data ? (topicsBySemester[semester.id] || 0) : '—',
                students: registrationsQuery.data ? (studentsBySemester[semester.id] || 0) : '—',
                milestones: [
                    {
                        title: 'Bắt đầu',
                        date: semester.startDate
                            ? new Date(semester.startDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Hạn đăng ký',
                        date: semester.registrationDeadline
                            ? new Date(semester.registrationDeadline).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Báo cáo giữa kỳ',
                        date: semester.midtermReportDate
                            ? new Date(semester.midtermReportDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Bảo vệ',
                        date: semester.defenseDate
                            ? new Date(semester.defenseDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Kết thúc',
                        date: semester.endDate
                            ? new Date(semester.endDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                ],
                rawData: semester,
            }));

        return mapped;
    }, [semestersQuery.data, topicsQuery.data, registrationsQuery.data]);
    const fetchSemesters = () => Promise.all([semestersQuery.refetch(), topicsQuery.refetch(), registrationsQuery.refetch()]);
    useEffect(() => {
        setDefaultSemesterId(current => periods.some(period => period.id === current) ? current : periods[0]?.id || null);
    }, [periods]);
    const [updatingToggle, setUpdatingToggle] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [form] = Form.useForm();

    const [decisionModalVisible, setDecisionModalVisible] = useState(false);
    const [decisionPeriod, setDecisionPeriod] = useState(null);
    const [decisionSubmitting, setDecisionSubmitting] = useState(false);
    const [decisionForm] = Form.useForm();

    // Appendix Manager State
    const [appendixModalVisible, setAppendixModalVisible] = useState(false);
    const [selectedAppendixPeriod, setSelectedAppendixPeriod] = useState(null);
    const [createAppendixModalVisible, setCreateAppendixModalVisible] = useState(false);
    const [appendixForm] = Form.useForm();
    const [selectedBm02aIds, setSelectedBm02aIds] = useState([]);
    const [appendixSubmitting, setAppendixSubmitting] = useState(false);

    const [decisionListModalVisible, setDecisionListModalVisible] = useState(false);
    const [selectedPeriodForDecisions, setSelectedPeriodForDecisions] = useState(null);
    const openedDecisionsFromQueryRef = useRef(false);

    const handleOpenDecisionList = useCallback((period) => {
        setSelectedPeriodForDecisions(period);
        setDecisionListModalVisible(true);
    }, []);

    // Navigation Tabs state
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const tabParam = searchParams.get('tab');
            if (tabParam === 'delegations') return 'delegations';
            if (tabParam === 'bm02') return 'bm02Queue';
            if (tabParam === 'decisions') return 'periods';
        } catch { /* Optional URL state. */ }
        return 'periods';
    });

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'delegations') {
            setActiveTab('delegations');
        } else if (tabParam === 'bm02') {
            setActiveTab('bm02Queue');
        } else if (tabParam === 'decisions') {
            setActiveTab('periods');
            if (periods.length > 0 && !openedDecisionsFromQueryRef.current) {
                openedDecisionsFromQueryRef.current = true;
                const active = periods.find((p) => p.status === 'ONGOING' || p.status === 'REGISTRATION') || periods[0];
                if (active) {
                    handleOpenDecisionList(active);
                }
            }
        } else {
            setActiveTab('periods');
        }
    }, [searchParams, periods, handleOpenDecisionList]);

    // Academic Delegation state
    const [delegationModalOpen, setDelegationModalOpen] = useState(false);
    const [delegationSubmitting, setDelegationSubmitting] = useState(false);
    const [delegationForm] = Form.useForm();

    const delegationsQuery = useDelegations(scope, canViewDelegations);
    const lecturersQuery = usePublicLecturers(scope, { department: user?.department || undefined }, canAssignAcademic);
    const delegations = delegationsQuery.data || EMPTY_LIST;
    const delegationsLoading = delegationsQuery.isFetching;
    const departmentLecturers = (lecturersQuery.data || []).filter(lec => lec.id !== user?.id);
    const fetchDelegations = () => delegationsQuery.refetch();
    const decisionId = selectedAppendixPeriod?.assignmentDecisions?.[0]?.id || selectedAppendixPeriod?.topicAssignmentDecisions?.[0]?.id || selectedAppendixPeriod?.id;
    const appendicesQuery = useDecisionAppendices(scope, decisionId, appendixModalVisible);
    const queueQuery = useBm02aQueue(scope, createAppendixModalVisible);
    const bm02aMutation = useBm02aMutation(scope, decisionId);
    const appendicesList = appendicesQuery.data || EMPTY_LIST;
    const eligibleBm02aRequests = (queueQuery.data || []).filter(r => ['APPROVED_PENDING_APPENDIX', 'ASSIGNED_TO_APPENDIX'].includes(r.status) || r.versions?.length > 0);

    const handleTabChange = (key) => {
        setActiveTab(key);
        if (key === 'delegations') {
            setSearchParams({ tab: 'delegations' });
        } else if (key === 'bm02Queue') {
            setSearchParams({ tab: 'bm02' });
        } else {
            setSearchParams({});
        }
    };

    const handleSubmitCreateDelegation = async (values) => {
        setDelegationSubmitting(true);
        try {
            const fromDate = values.dateRange[0]?.startOf ? values.dateRange[0].startOf('day') : values.dateRange[0];
            const toDate = values.dateRange[1]?.endOf ? values.dateRange[1].endOf('day') : values.dateRange[1];
            const payload = {
                delegateeId: values.delegateeId,
                capabilityCode: values.capabilityCode,
                semesterId: values.semesterId || undefined,
                effectiveFrom: fromDate.toISOString(),
                effectiveTo: toDate.toISOString(),
                reason: values.reason?.trim(),
            };
            const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `delegation-${Date.now()}`;
            const res = await delegationMutation.mutateAsync({ action: 'createDelegation', args: [payload, idempotencyKey] });
            if (res?.success) {
                message.success('Ủy quyền chuyên môn thành công');
                setDelegationModalOpen(false);
                delegationForm.resetFields();
            } else {
                message.error(res?.message || 'Không thể tạo ủy quyền chuyên môn');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tạo ủy quyền chuyên môn');
        } finally {
            setDelegationSubmitting(false);
        }
    };

    const handleRevokeDelegation = async (id) => {
        try {
            const res = await delegationMutation.mutateAsync({ action: 'revokeDelegation', args: [id] });
            if (res?.success) {
                message.success('Thu hồi ủy quyền thành công');
            } else {
                message.error(res?.message || 'Không thể thu hồi ủy quyền');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi thu hồi ủy quyền');
        }
    };

    const activeDelegationsCount = useMemo(() => {
        return delegations.filter((d) => d.status === 'ACTIVE').length;
    }, [delegations]);

    // BM02 Review Queue state
    const [bm02SemesterFilter, setBm02SemesterFilter] = useState('ALL');
    const [bm02StatusFilter, setBm02StatusFilter] = useState('PENDING');
    const [bm02DrawerOpen, setBm02DrawerOpen] = useState(false);
    const [selectedBm02Registration, setSelectedBm02Registration] = useState(null);

    // Decision Amendment state
    const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
    const [selectedDecisionRecord, setSelectedDecisionRecord] = useState(null);
    const [amendmentSubmitting, setAmendmentSubmitting] = useState(false);
    const [amendmentForm] = Form.useForm();

    const periodDecisionList = useMemo(() => {
        if (!selectedPeriodForDecisions) return [];
        return allRegistrations.filter(
            (reg) =>
                reg.semesterId === selectedPeriodForDecisions.id &&
                (reg.decisionNumber || reg.status === 'DECISION_ISSUED')
        );
    }, [allRegistrations, selectedPeriodForDecisions]);

    // Danh sách BM02 đang chờ duyệt
    const pendingBm02List = useMemo(() => {
        return allRegistrations.filter((reg) =>
            ['BM02_SUBMITTED', 'BM02_RESUBMITTED'].includes(reg.status)
        );
    }, [allRegistrations]);

    // Danh sách hiển thị trong hàng đợi BM02
    const bm02QueueList = useMemo(() => {
        return allRegistrations.filter((reg) => {
            if (bm02SemesterFilter !== 'ALL' && reg.semesterId !== Number(bm02SemesterFilter)) {
                return false;
            }
            if (bm02StatusFilter === 'PENDING') {
                return ['BM02_SUBMITTED', 'BM02_RESUBMITTED'].includes(reg.status);
            }
            if (bm02StatusFilter === 'REVISION') {
                return reg.status === 'BM02_NEEDS_REVISION';
            }
            if (bm02StatusFilter === 'APPROVED') {
                return ['APPROVED', 'DECISION_ISSUED'].includes(reg.status)
                    || reg.currentBM02Submission?.outcome === 'APPROVED';
            }
            // 'ALL'
            return [
                'BM02_SUBMITTED',
                'BM02_RESUBMITTED',
                'BM02_NEEDS_REVISION',
                'APPROVED',
                'DECISION_ISSUED',
            ].includes(reg.status) || Boolean(reg.currentBM02Submission);
        });
    }, [allRegistrations, bm02SemesterFilter, bm02StatusFilter]);

    const handleOpenBm02Review = (record) => {
        setSelectedBm02Registration(record);
        setBm02DrawerOpen(true);
    };

    const handleBm02ReviewSuccess = () => {
        fetchSemesters();
    };

    const handleOpenAmendmentModal = (record) => {
        setSelectedDecisionRecord(record);
        amendmentForm.resetFields();
        amendmentForm.setFieldsValue({
            amendmentNumber: `QĐ-ĐC-${record.decisionNumber || record.id}/${dayjs().year()}`,
            reason: '',
            adjustedTitle: record.adjustedTitle || record.topic?.title || '',
            note: '',
            effectiveAt: dayjs(),
        });
        setAmendmentModalOpen(true);
    };

    const handleSubmitDecisionAmendment = async (values) => {
        if (!selectedDecisionRecord) return;
        const decisionId = selectedDecisionRecord.assignmentDecisions?.[0]?.id
            || selectedDecisionRecord.assignmentDecisionId
            || selectedDecisionRecord.decisionId
            || selectedDecisionRecord.id;

        const changes = {};
        if (values.adjustedTitle?.trim()) {
            changes.topicTitle = values.adjustedTitle.trim();
            changes.adjustedTitle = values.adjustedTitle.trim();
        }
        if (values.note?.trim()) {
            changes.note = values.note.trim();
        }
        if (Object.keys(changes).length === 0) {
            changes.summary = 'Điều chỉnh thông tin quyết định giao đề tài';
        }

        try {
            setAmendmentSubmitting(true);
            const res = await periodMutation.mutateAsync({ action: 'createDecisionAmendment', args: [decisionId, {
                amendmentNumber: values.amendmentNumber.trim(),
                reason: values.reason.trim(),
                changes,
                effectiveAt: values.effectiveAt ? values.effectiveAt.toISOString() : new Date().toISOString(),
            }] });
            if (res.success || res.data) {
                message.success('Đã ban hành Quyết định Điều chỉnh thành công!');
                setAmendmentModalOpen(false);
            } else {
                message.error(res.message || 'Không thể tạo Quyết định Điều chỉnh');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tạo Quyết định Điều chỉnh');
        } finally {
            setAmendmentSubmitting(false);
        }
    };

    const handleOpenIssueDecision = (period) => {
        setDecisionPeriod(period);
        decisionForm.resetFields();
        decisionForm.setFieldsValue({
            decisionDate: dayjs(),
            decisionPublishedAt: dayjs(),
            decisionNumber: `QĐ-${period.id}/${dayjs().year()}/QĐ-VIEN`,
        });
        setDecisionModalVisible(true);
    };

    const handleSubmitIssueDecision = async (values) => {
        if (!decisionPeriod) return;
        try {
            setDecisionSubmitting(true);
            const pubDate = values.decisionPublishedAt ? values.decisionPublishedAt.toISOString() : new Date().toISOString();
            const res = await periodMutation.mutateAsync({ action: 'issuePeriodDecision', args: [decisionPeriod.id, {
                decisionNumber: values.decisionNumber.trim(),
                decisionDate: values.decisionDate.toISOString(),
                decisionPublishedAt: pubDate,
                decisionFileUrl: values.decisionFileUrl?.trim() || undefined,
            }] });
            if (res.success) {
                const decId = res.data?.id || res.id || decisionPeriod.assignmentDecisions?.[0]?.id;
                if (decId) {
                    await periodMutation.mutateAsync({ action: 'publishTopicDecision', args: [decId, { publishedAt: pubDate }] });
                }
                message.success(res.message || 'Ban hành và công bố Quyết định giao đề tài thành công!');
                setDecisionModalVisible(false);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể ban hành quyết định');
        } finally {
            setDecisionSubmitting(false);
        }
    };

    // Appendix Manager Handlers
    const handleOpenAppendixManager = async (period) => {
        setSelectedAppendixPeriod(period);
        setAppendixModalVisible(true);
    };

    const handleOpenCreateAppendix = async () => {
        appendixForm.resetFields();
        appendixForm.setFieldsValue({
            signedDate: dayjs(),
            appendixNumber: `PL-${dayjs().year()}-${Date.now().toString().slice(-4)}/PL-VIEN`,
        });
        setSelectedBm02aIds([]);
        setCreateAppendixModalVisible(true);
    };

    const handleCreateAppendixSubmit = async (values) => {
        try {
            setAppendixSubmitting(true);
            const selectedReq = eligibleBm02aRequests.find((r) => selectedBm02aIds.includes(r.id));
            const decId = selectedReq?.decisionId
                || selectedAppendixPeriod?.assignmentDecisions?.[0]?.id
                || selectedAppendixPeriod?.topicAssignmentDecisions?.[0]?.id
                || selectedAppendixPeriod?.id;
            const res = await bm02aMutation.mutateAsync({ action: 'createAppendix', args: [{
                decisionId: decId,
                appendixNumber: values.appendixNumber.trim(),
                signedDate: values.signedDate.toISOString(),
                bm02aRequestIds: selectedBm02aIds,
            }] });

            if (res.success) {
                message.success('Tạo dự thảo phụ lục điều chỉnh tên đề tài thành công!');
                setCreateAppendixModalVisible(false);
            } else {
                message.error(res.message || 'Không thể tạo phụ lục.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tạo phụ lục');
        } finally {
            setAppendixSubmitting(false);
        }
    };

    const handleIssueAppendixAction = async (appendixId) => {
        try {
            const res = await bm02aMutation.mutateAsync({ action: 'issueAppendix', args: [appendixId, {
                signedDate: new Date().toISOString(),
            }] });
            if (res.success) {
                message.success('Ban hành phụ lục điều chỉnh tên đề tài thành công! Tên mới đã có hiệu lực chính thức.');
            } else {
                message.error(res.message || 'Không thể ban hành phụ lục.');
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi ban hành phụ lục');
        }
    };

    const selectedPeriod = useMemo(
        () => periods.find((period) => period.id === defaultSemesterId) || null,
        [periods, defaultSemesterId]
    );

    const handleRegistrationToggle = async (checked) => {
        if (!selectedPeriod) {
            message.warning('Vui lòng chọn học kỳ trước khi thay đổi trạng thái đăng ký.');
            return;
        }

        const localWarning = getToggleWindowWarning(selectedPeriod);
        if (localWarning) {
            message.warning(localWarning, 4);
        }

        try {
            setUpdatingToggle(true);
            const response = await periodMutation.mutateAsync({ action: 'toggleRegistration', args: [selectedPeriod.id, checked] });
            if (response.success) {
                message.success(
                    checked ? 'Đã mở đăng ký đề tài cho học kỳ đã chọn.' : 'Đã đóng đăng ký đề tài cho học kỳ đã chọn.'
                );
                if (response.warning) {
                    message.warning(response.warning, 4);
                }
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật trạng thái đăng ký.');
        } finally {
            setUpdatingToggle(false);
        }
    };

    const handleAdd = () => {
        setModalMode('add');
        form.resetFields();
        const currentYear = dayjs().year();
        form.setFieldsValue({
            status: 'UPCOMING',
            registrationOpen: true,
            projectName: PROJECT_NAME,
            term: 1,
            academicStartYear: currentYear,
            code: buildSemesterCode({ projectCode: 'DATN', term: 1, academicYear: `${currentYear}-${currentYear + 1}` }),
        });
        setIsModalVisible(true);
    };

    const handleEdit = (period) => {
        setModalMode('edit');
        const meta = extractSemesterMeta(period.rawData);
        const startYear = Number.parseInt((meta.academicYear || '').split('-')[0], 10) || dayjs().year();
        form.setFieldsValue({
            id: period.id,
            code: period.code,
            projectName: PROJECT_NAME,
            term: meta.term,
            academicStartYear: startYear,
            status: period.rawData.status,
            registrationOpen: period.rawData.registrationOpen,
            startDate: dayjs(period.rawData.startDate),
            endDate: dayjs(period.rawData.endDate),
            registrationDeadline: period.rawData.registrationDeadline
                ? dayjs(period.rawData.registrationDeadline)
                : null,
            midtermReportDate: period.rawData.midtermReportDate
                ? dayjs(period.rawData.midtermReportDate)
                : null,
            defenseDate: period.rawData.defenseDate ? dayjs(period.rawData.defenseDate) : null,
        });
        setIsModalVisible(true);
    };

    const handleClone = (period) => {
        setModalMode('add');
        const meta = extractSemesterMeta(period.rawData);
        const cloneStartYear = Number.parseInt((meta.academicYear || '').split('-')[0], 10) + 1;
        const targetYear = Number.isInteger(cloneStartYear) ? cloneStartYear : dayjs().year() + 1;
        form.setFieldsValue({
            code: buildSemesterCode({ projectCode: 'DATN', term: meta.term, academicYear: `${targetYear}-${targetYear + 1}` }),
            projectName: PROJECT_NAME,
            term: meta.term,
            academicStartYear: targetYear,
            status: 'UPCOMING',
            registrationOpen: period.rawData.registrationOpen,
            startDate: dayjs(period.rawData.startDate).add(1, 'year'),
            endDate: dayjs(period.rawData.endDate).add(1, 'year'),
            registrationDeadline: period.rawData.registrationDeadline
                ? dayjs(period.rawData.registrationDeadline).add(1, 'year')
                : null,
            midtermReportDate: period.rawData.midtermReportDate
                ? dayjs(period.rawData.midtermReportDate).add(1, 'year')
                : null,
            defenseDate: period.rawData.defenseDate
                ? dayjs(period.rawData.defenseDate).add(1, 'year')
                : null,
        });
        message.info(`Đã sao chép cấu hình từ đợt ${period.name}`);
        setIsModalVisible(true);
    };

    const handleDelete = (id) => {
        Modal.confirm({
            title: 'Xác nhận xóa đợt đồ án',
            content: 'Hành động này chỉ xóa được nếu đợt chưa có sinh viên đăng ký đề tài hoặc phân công hội đồng.',
            okText: 'Xóa đợt',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const response = await periodMutation.mutateAsync({ action: 'delete', args: [id] });
                    if (response.success) {
                        message.success('Đã xóa đợt đồ án');
                            }
                } catch (error) {
                    message.error(error?.message || 'Có lỗi xảy ra khi xóa');
                }
            },
        });
    };

    const handleModalSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                name: buildSemesterName({
                    term: values.term,
                    academicYear: `${values.academicStartYear}-${values.academicStartYear + 1}`,
                }),
                code: values.code ? values.code.trim().toUpperCase() : buildSemesterCode({
                    projectCode: 'DATN',
                    term: values.term,
                    academicYear: `${values.academicStartYear}-${values.academicStartYear + 1}`,
                }),
                status: values.status,
                registrationOpen: !!values.registrationOpen,
                startDate: values.startDate.toISOString(),
                endDate: values.endDate.toISOString(),
                registrationDeadline: values.registrationDeadline.toISOString(),
                midtermReportDate: values.midtermReportDate
                    ? values.midtermReportDate.toISOString()
                    : null,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
            };

            const response =
                modalMode === 'add'
                    ? await periodMutation.mutateAsync({ action: 'create', args: [payload] })
                    : await periodMutation.mutateAsync({ action: 'update', args: [values.id, payload] });

            if (response.success) {
                message.success(modalMode === 'add' ? 'Khởi tạo đợt thành công' : 'Cập nhật đợt thành công');
                setIsModalVisible(false);
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra');
        }
    };

    const activeCount = useMemo(() => periods.filter((p) => ['ONGOING', 'REGISTRATION'].includes(p.status)).length, [periods]);

    return (
        <QueryPanel query={semestersQuery}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">ACADEMIC PERIODS & TIMELINE MANAGEMENT</p>
                    <h1 className="h1">{isAdmin ? 'Quản lý Đợt Đồ án & Học kỳ Học vụ' : 'Đợt Đồ án & Ban hành Quyết định'}</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button icon={<ReloadOutlined />} onClick={fetchSemesters}>
                        Làm mới
                    </Button>
                    {isAdmin && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Khởi tạo Đợt Đồ án mới
                        </Button>
                    )}
                </div>
            </div>

            {/* 4 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng số đợt đồ án</span>
                    <p className="h2 num" style={{ marginTop: 2 }}>{periods.length}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Toàn bộ các khóa học vụ</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Đợt đang hoạt động</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--accent)' }}>{activeCount}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--accent)' }}>Đang mở ĐK hoặc thực hiện</div>
                </div>
                <div className="card" style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => handleTabChange('bm02Queue')}>
                    <span className="meta">Đơn BM02 chờ thẩm định</span>
                    <p className="h2 num" style={{ marginTop: 2, color: pendingBm02List.length > 0 ? '#E11D48' : '#0F766E' }}>
                        {registrationsQuery.data ? pendingBm02List.length : '—'}
                    </p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        {registrationsQuery.data ? (pendingBm02List.length > 0 ? 'Cần Viện trưởng thẩm định' : 'Không có hồ sơ tồn đọng') : 'Chưa tải được hồ sơ'}
                    </div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Quy mô đợt hiện hành</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--institutional)' }}>
                        {selectedPeriod ? `${selectedPeriod.topics} đề tài · ${selectedPeriod.students} SV` : '0'}
                    </p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Sinh viên đã có đề tài</div>
                </div>
            </div>

            {/* Registration Quick Switch Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-md border border-amber-200 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]">edit_notifications</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Cho phép đăng ký đề tài</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Bật/tắt mở cổng đăng ký cho học kỳ đang chọn.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <Switch
                            checked={!!selectedPeriod?.registrationOpen}
                            onChange={handleRegistrationToggle}
                            loading={updatingToggle}
                            disabled={!selectedPeriod}
                        />
                        {selectedPeriod && (
                            <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                                    selectedPeriod.registrationOpen
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                            >
                                {selectedPeriod.registrationOpen ? 'Đang mở' : 'Đang đóng'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-teal-50 text-teal-700 rounded-md border border-teal-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]">dashboard_customize</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Học kỳ đang chọn</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cấu hình áp dụng cho đợt được chọn này.
                            </p>
                        </div>
                    </div>
                    <Select
                        value={defaultSemesterId}
                        onChange={setDefaultSemesterId}
                        style={{ width: 220 }}
                        options={periods.map((period) => ({ value: period.id, label: period.name }))}
                    />
                </div>
            </div>

            {/* Navigation Tabs: Quản lý Đợt đồ án & Hàng đợi Thẩm định BM02 */}
            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                type="card"
                className="project-period-tabs"
                items={[
                    {
                        key: 'periods',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-1">
                                <CalendarOutlined />
                                <span>Quản lý Đợt Đồ Án & Ban Hành QĐ</span>
                            </span>
                        ),
                        children: (
                            <div className="space-y-4 pt-1">
                                <div className="flex items-center justify-between pb-1">
                                    <h3 className="text-base font-bold text-slate-900">
                                        Danh sách Các Đợt Đồ Án
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">
                                        Tổng cộng: {periods.length} đợt
                                    </span>
                                </div>

                                <QueryPanel query={topicsQuery}><QueryPanel query={registrationsQuery}>
                                    <div className="space-y-4 min-h-[160px]">
                                        {periods.length === 0 && !loading ? (
                                            <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
                                                <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 block">
                                                    event_busy
                                                </span>
                                                <p className="text-sm text-slate-600 font-medium">Chưa có đợt đồ án nào được khởi tạo.</p>
                                                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} className="mt-4">
                                                    Tạo đợt đầu tiên
                                                </Button>
                                            </div>
                                        ) : (
                                            periods.map((period) => (
                                                <PeriodCard
                                                    key={period.key}
                                                    period={period}
                                                    onEdit={handleEdit}
                                                    onDelete={handleDelete}
                                                    onClone={handleClone}
                                                    onIssueDecision={handleOpenIssueDecision}
                                                    onViewDecisionList={handleOpenDecisionList}
                                                    onManageAppendices={handleOpenAppendixManager}
                                                    isAdmin={isAdmin}
                                                />
                                            ))
                                        )}
                                    </div>
                                </QueryPanel></QueryPanel>
                            </div>
                        ),
                    },
                    {
                        key: 'bm02Queue',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-1">
                                <CheckCircleOutlined />
                                <span>Hàng đợi Thẩm định Đơn đăng ký (BM02)</span>
                                {pendingBm02List.length > 0 && (
                                    <Badge count={registrationsQuery.data ? pendingBm02List.length : '—'} overflowCount={99} />
                                )}
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">
                                            Hàng đợi Thẩm định Đơn đăng ký (BM02)
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Thẩm định đơn đăng ký đề tài (BM02) của sinh viên theo quy chuẩn Viện. Hồ sơ được phê duyệt sẽ đủ điều kiện ban hành Quyết định giao đề tài.
                                        </p>
                                    </div>
                                    <Space wrap>
                                        <Select
                                            value={bm02SemesterFilter}
                                            onChange={setBm02SemesterFilter}
                                            style={{ width: 220 }}
                                            options={[
                                                { value: 'ALL', label: 'Tất cả các học kỳ' },
                                                ...periods.map((p) => ({ value: p.id, label: p.name })),
                                            ]}
                                        />
                                        <Select
                                            value={bm02StatusFilter}
                                            onChange={setBm02StatusFilter}
                                            style={{ width: 220 }}
                                            options={[
                                                { value: 'PENDING', label: 'Chờ thẩm định (Lần 1 & 2)' },
                                                { value: 'ALL', label: 'Tất cả trạng thái đơn BM02' },
                                                { value: 'REVISION', label: 'Cần chỉnh sửa bổ sung' },
                                                { value: 'APPROVED', label: 'Đã duyệt đơn BM02 / Cấp QĐ' },
                                            ]}
                                        />
                                    </Space>
                                </div>

                                <QueryPanel query={registrationsQuery}>
                                <Table
                                    dataSource={bm02QueueList}
                                    rowKey="id"
                                    size="middle"
                                    pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng: ${total} hồ sơ` }}
                                    columns={[
                                        {
                                            title: 'STT',
                                            key: 'stt',
                                            width: 55,
                                            align: 'center',
                                            render: (_, __, index) => index + 1,
                                        },
                                        {
                                            title: 'Sinh viên',
                                            key: 'student',
                                            width: 220,
                                            render: (_, record) => (
                                                <div>
                                                    <div className="font-bold text-slate-900">{record.student?.fullName || 'N/A'}</div>
                                                    <div className="text-[11px] text-slate-600 font-mono font-medium">MSSV: {record.student?.code || 'N/A'}</div>
                                                    {(record.student?.studentProfile?.className || record.student?.class) && (
                                                        <div className="text-[11px] text-slate-500">
                                                            Lớp: {record.student?.studentProfile?.className || record.student?.class}
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            title: 'Tên đề tài',
                                            key: 'topic',
                                            render: (_, record) => (
                                                <div>
                                                    <div className="font-semibold text-slate-800 leading-snug">
                                                        {record.adjustedTitle || record.topic?.title || 'Chưa có tên'}
                                                    </div>
                                                    {record.adjustedTitle && record.adjustedTitle !== record.topic?.title && (
                                                        <div className="text-[11px] text-emerald-600 mt-0.5">
                                                            (Đã điều chỉnh từ: <em>{record.topic?.title}</em>)
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            title: 'GVHD',
                                            key: 'mentor',
                                            width: 170,
                                            render: (_, record) => (
                                                <span className="text-xs text-slate-700 font-medium">
                                                    {record.topic?.mentor?.fullName || 'Chưa phân công'}
                                                </span>
                                            ),
                                        },
                                        {
                                            title: 'Lần nộp',
                                            key: 'attempt',
                                            width: 100,
                                            align: 'center',
                                            render: (_, record) => {
                                                const attemptNo = record.currentBM02Submission?.attemptNo || record.attemptNo || 1;
                                                return (
                                                    <Tag color={attemptNo > 1 ? 'volcano' : 'blue'}>
                                                        Lần {attemptNo}
                                                    </Tag>
                                                );
                                            },
                                        },
                                        {
                                            title: 'Trạng thái',
                                            dataIndex: 'status',
                                            key: 'status',
                                            width: 160,
                                            align: 'center',
                                            render: (status, record) => {
                                                const statusValue = typeof status === 'string' ? status : record?.status;
                                                const statusMap = {
                                                    BM02_SUBMITTED: { label: 'Chờ duyệt lần 1', color: 'blue' },
                                                    BM02_RESUBMITTED: { label: 'Chờ duyệt nộp lại', color: 'purple' },
                                                    BM02_NEEDS_REVISION: { label: 'Yêu cầu chỉnh sửa', color: 'orange' },
                                                    APPROVED: { label: 'Đã duyệt đơn BM02', color: 'green' },
                                                    DECISION_ISSUED: { label: 'Đã ban hành QĐ', color: 'cyan' },
                                                };
                                                const item = statusMap[statusValue] || { label: String(statusValue || 'N/A'), color: 'default' };
                                                return <Tag color={item.color}>{item.label}</Tag>;
                                            },
                                        },
                                        {
                                            title: 'Tệp đơn BM02',
                                            key: 'file',
                                            width: 110,
                                            align: 'center',
                                            render: (_, record) => {
                                                const fileUrl = record.currentBM02Submission?.fileUrl;
                                                if (!fileUrl) return <span className="text-slate-400 text-xs">—</span>;
                                                return (
                                                    <Tooltip title="Xem tệp đơn BM02">
                                                        <a
                                                            href={fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-teal-600 hover:text-teal-800 text-xs inline-flex items-center gap-1 font-medium bg-teal-50 px-2 py-1 rounded border border-teal-200"
                                                        >
                                                            <FilePdfOutlined />
                                                            <span>Xem PDF</span>
                                                        </a>
                                                    </Tooltip>
                                                );
                                            },
                                        },
                                        {
                                            title: 'Thao tác',
                                            key: 'actions',
                                            width: 150,
                                            align: 'center',
                                            render: (_, record) => (
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<CheckCircleOutlined />}
                                                    className="!bg-teal-600 hover:!bg-teal-700 font-medium text-xs"
                                                    onClick={() => handleOpenBm02Review(record)}
                                                >
                                                    Thẩm định đơn BM02
                                                </Button>
                                            ),
                                        },
                                    ]}
                                />
                                </QueryPanel>
                            </div>
                        ),
                    },
                    ...(canViewDelegations
                        ? [
                            {
                                key: 'delegations',
                                label: (
                                    <span className="flex items-center gap-2 font-medium px-1">
                                        <AuditOutlined />
                                        <span>Ủy quyền chuyên môn</span>
                                        {activeDelegationsCount > 0 && (
                                            <Badge count={activeDelegationsCount} overflowCount={99} />
                                        )}
                                    </span>
                                ),
                                children: (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">
                                                    Danh Sách Ủy Quyền Chuyên Môn Học Thuật
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Ủy quyền quyền thẩm định và chấm điểm đồ án cho giảng viên cùng khoa/viện theo chuẩn phân quyền hai tầng.
                                                </p>
                                            </div>
                                            <Space wrap>
                                                <Button
                                                    icon={<ReloadOutlined />}
                                                    onClick={() => fetchDelegations(true)}
                                                    loading={delegationsLoading}
                                                >
                                                    Làm mới
                                                </Button>
                                                {canAssignAcademic && (
                                                    <Button
                                                        type="primary"
                                                        icon={<PlusOutlined />}
                                                        className="!bg-teal-600 hover:!bg-teal-700 font-medium"
                                                        onClick={() => {
                                                            delegationForm.resetFields();
                                                            setDelegationModalOpen(true);
                                                        }}
                                                    >
                                                        Tạo ủy quyền mới
                                                    </Button>
                                                )}
                                            </Space>
                                        </div>

                                        <QueryPanel query={delegationsQuery}>
                                        <Table
                                            dataSource={delegations}
                                            rowKey="id"
                                            loading={delegationsLoading}
                                            pagination={{ pageSize: 10, showSizeChanger: false }}
                                            locale={{ emptyText: 'Chưa có bản ghi ủy quyền chuyên môn nào.' }}
                                            columns={[
                                                {
                                                    title: 'Người được ủy quyền',
                                                    key: 'delegatee',
                                                    width: 220,
                                                    render: (_, record) => (
                                                        <div>
                                                            <div className="font-semibold text-slate-900">
                                                                {record.delegatee?.fullName || '—'}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {record.delegatee?.code || record.delegatee?.email || ''}
                                                                {record.delegatee?.department ? ` • Khoa ${record.delegatee.department}` : ''}
                                                            </div>
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: 'Quyền ủy quyền',
                                                    dataIndex: 'capabilityCode',
                                                    key: 'capabilityCode',
                                                    width: 210,
                                                    render: (code) => {
                                                        const capConfig = {
                                                            OUTLINE_REVIEW: { label: 'Thẩm định đề cương', color: 'cyan' },
                                                            BM02_REVIEW: { label: 'Duyệt đơn đăng ký đề tài', color: 'blue' },
                                                            DEFENSE_SCORE_SUBMIT: { label: 'Chấm điểm bảo vệ', color: 'purple' },
                                                            DEFENSE_RESULT_APPROVE: { label: 'Duyệt kết quả bảo vệ', color: 'magenta' },
                                                        };
                                                        const conf = capConfig[code] || { label: code, color: 'default' };
                                                        return (
                                                            <div>
                                                                <Tag color={conf.color}>{conf.label}</Tag>
                                                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">{code}</div>
                                                            </div>
                                                        );
                                                    },
                                                },
                                                {
                                                    title: 'Phạm vi học kỳ',
                                                    key: 'semester',
                                                    width: 150,
                                                    render: (_, record) => record.semester?.name || <Tag>Toàn viện</Tag>,
                                                },
                                                {
                                                    title: 'Thời hạn hiệu lực',
                                                    key: 'period',
                                                    width: 190,
                                                    render: (_, record) => (
                                                        <div className="text-xs">
                                                            <div>Từ: {dayjs(record.effectiveFrom).format('DD/MM/YYYY')}</div>
                                                            <div>Đến: {dayjs(record.effectiveTo).format('DD/MM/YYYY')}</div>
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: 'Lý do ủy quyền',
                                                    dataIndex: 'reason',
                                                    key: 'reason',
                                                    render: (reason) => (
                                                        <span className="text-xs text-slate-700 italic">{reason || '—'}</span>
                                                    ),
                                                },
                                                {
                                                    title: 'Người ủy quyền',
                                                    key: 'delegator',
                                                    width: 160,
                                                    render: (_, record) => (
                                                        <div className="text-xs">
                                                            <div className="font-medium text-slate-800">{record.delegator?.fullName || '—'}</div>
                                                            <div className="text-slate-400">{record.delegator?.code || ''}</div>
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: 'Trạng thái',
                                                    dataIndex: 'status',
                                                    key: 'status',
                                                    width: 120,
                                                    align: 'center',
                                                    render: (status) => {
                                                        const statusMap = {
                                                            ACTIVE: { label: 'Đang hiệu lực', color: 'green' },
                                                            REVOKED: { label: 'Đã thu hồi', color: 'volcano' },
                                                            EXPIRED: { label: 'Hết hạn', color: 'default' },
                                                        };
                                                        const conf = statusMap[status] || { label: status, color: 'default' };
                                                        return <Tag color={conf.color}>{conf.label}</Tag>;
                                                    },
                                                },
                                                {
                                                    title: 'Thao tác',
                                                    key: 'action',
                                                    width: 110,
                                                    align: 'center',
                                                    render: (_, record) => {
                                                        if (record.status !== 'ACTIVE' || !canAssignAcademic) {
                                                            return <span className="text-slate-400 text-xs">—</span>;
                                                        }
                                                        return (
                                                            <Popconfirm
                                                                title="Thu hồi ủy quyền"
                                                                description="Bạn có chắc chắn muốn thu hồi ủy quyền này ngay lập tức?"
                                                                onConfirm={() => handleRevokeDelegation(record.id)}
                                                                okText="Thu hồi"
                                                                cancelText="Hủy"
                                                                okButtonProps={{ danger: true }}
                                                            >
                                                                <Button danger size="small" icon={<DeleteOutlined />}>
                                                                    Thu hồi
                                                                </Button>
                                                            </Popconfirm>
                                                        );
                                                    },
                                                },
                                            ]}
                                        />
                                        </QueryPanel>
                                    </div>
                                ),
                            },
                        ]
                        : []),
                ]}
            />

            {/* Modal Form Tạo/Sửa Đợt đồ án */}
            <Modal
                title={modalMode === 'add' ? 'Tạo đợt đồ án mới' : 'Cập nhật đợt đồ án'}
                open={isModalVisible}
                onOk={handleModalSubmit}
                onCancel={() => setIsModalVisible(false)}
                okText={modalMode === 'add' ? 'Lưu và khởi tạo' : 'Cập nhật'}
                cancelText="Hủy"
                width={700}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    name="project_period_form"
                    style={{ marginTop: 16 }}
                    onValuesChange={(changedValues, allValues) => {
                        if (modalMode === 'add' && (changedValues.term || changedValues.academicStartYear)) {
                            const term = allValues.term || 1;
                            const year = allValues.academicStartYear || dayjs().year();
                            form.setFieldValue(
                                'code',
                                buildSemesterCode({
                                    projectCode: 'DATN',
                                    term,
                                    academicYear: `${year}-${year + 1}`,
                                })
                            );
                        }
                    }}
                >
                    <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="code"
                                label="Mã đợt đồ án"
                                rules={[{ required: true, message: 'Nhập mã đợt đồ án (VD: DATN-HK2-2026-27)' }]}
                                tooltip="Quy chuẩn mã đợt đồ án: Tên-HK-Năm (VD: DATN-HK2-2026-27)"
                            >
                                <Input placeholder="VD: DATN-HK2-2026-27" style={{ textTransform: 'uppercase' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="projectName" label="Tên đồ án" initialValue={PROJECT_NAME}>
                                <Input disabled />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="term" label="Học kỳ" rules={[{ required: true, message: 'Chọn học kỳ' }]}>
                                <Select
                                    options={[
                                        { value: 1, label: 'Học kỳ 1' },
                                        { value: 2, label: 'Học kỳ 2' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="academicStartYear" label="Năm học bắt đầu" rules={[{ required: true, message: 'Nhập năm bắt đầu' }]}>
                                <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="status" label="Trạng thái học kỳ" rules={[{ required: true, message: 'Chọn trạng thái học kỳ' }]}>
                                <Select
                                    options={[
                                        { value: 'UPCOMING', label: 'Sắp tới' },
                                        { value: 'REGISTRATION', label: 'Đang đăng ký' },
                                        { value: 'ONGOING', label: 'Đang diễn ra' },
                                        { value: 'DEFENSE', label: 'Bảo vệ' },
                                        { value: 'COMPLETED', label: 'Hoàn thành' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="registrationOpen" label="Mở đăng ký đề tài" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="registrationDeadline" label="Ngày đóng đăng ký đề tài" rules={[{ required: true, message: 'Chọn ngày' }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="midtermReportDate" label="Ngày hạn nộp báo cáo giữa kỳ">
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="defenseDate" label="Ngày dự kiến bảo vệ">
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <hr className="my-3 border-slate-100" />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="startDate" label="Ngày khai mạc đợt" rules={[{ required: true, message: 'Chọn ngày' }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="endDate" label="Ngày kết thúc đợt" rules={[{ required: true, message: 'Chọn ngày' }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Modal Ban hành Quyết định giao đề tài */}
            <Modal
                title={(
                    <div className="flex items-center gap-2">
                        <FileDoneOutlined className="text-purple-600 text-lg" />
                        <span>Ban hành Quyết định giao đề tài ({decisionPeriod?.name})</span>
                    </div>
                )}
                open={decisionModalVisible}
                onCancel={() => {
                    setDecisionModalVisible(false);
                    setDecisionPeriod(null);
                }}
                footer={null}
                destroyOnClose
                width={560}
            >
                <div className="my-3 space-y-3">
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs text-purple-900 leading-relaxed">
                        <strong>Quy chuẩn học vụ:</strong> Quyết định giao đề tài được ký bởi Trưởng Viện / Ban Giám Hiệu kèm danh sách sinh viên đã hoàn thành nộp đề cương. Sau khi ban hành, hệ thống sẽ kích hoạt <strong>cửa sổ 7 ngày</strong> cho phép sinh viên nộp đơn xin điều chỉnh tên đề tài (GVHD duyệt trực tiếp).
                    </div>

                    <Form form={decisionForm} layout="vertical" onFinish={handleSubmitIssueDecision}>
                        <Form.Item
                            name="decisionNumber"
                            label="Số Quyết định ban hành"
                            rules={[{ required: true, message: 'Vui lòng nhập số quyết định' }]}
                        >
                            <Input placeholder="Ví dụ: 125/QĐ-ĐHBK" />
                        </Form.Item>

                        <Form.Item
                            name="decisionDate"
                            label="Ngày ký ban hành Quyết định"
                            rules={[{ required: true, message: 'Vui lòng chọn ngày ban hành' }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                            name="decisionPublishedAt"
                            label="Thời điểm công bố Quyết định (Kích hoạt cửa sổ 168h BM02-A)"
                            rules={[{ required: true, message: 'Vui lòng chọn thời điểm công bố' }]}
                        >
                            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                            name="decisionFileUrl"
                            label="Đường dẫn văn bản scan Quyết định (URL / Tùy chọn)"
                        >
                            <Input placeholder="https://drive.google.com/... hoặc link lưu trữ văn bản" />
                        </Form.Item>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <Button onClick={() => setDecisionModalVisible(false)} disabled={decisionSubmitting}>
                                Hủy bỏ
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={decisionSubmitting}
                                icon={<FileDoneOutlined />}
                                className="!bg-purple-600 hover:!bg-purple-700 font-medium"
                            >
                                Ký Ban Hành Quyết Định
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            {/* Modal Xem Danh sách Quyết định giao đề tài */}
            <Modal
                title={(
                    <div className="flex items-center justify-between pr-6">
                        <div className="flex items-center gap-2">
                            <FileDoneOutlined className="text-purple-600 text-lg" />
                            <span className="font-bold text-slate-800">
                                Danh sách Đề tài được Ban hành Quyết định — {selectedPeriodForDecisions?.name}
                            </span>
                        </div>
                        <Tag color="purple" className="font-semibold">
                            {periodDecisionList.length} đề tài đã cấp QĐ
                        </Tag>
                    </div>
                )}
                open={decisionListModalVisible}
                onCancel={() => {
                    setDecisionListModalVisible(false);
                    setSelectedPeriodForDecisions(null);
                }}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDecisionListModalVisible(false)}>
                        Đóng
                    </Button>
                ]}
                width={960}
                destroyOnClose
            >
                <QueryPanel query={registrationsQuery}>
                <div className="py-2 space-y-4">
                    {periodDecisionList.length > 0 ? (
                        <div className="bg-purple-50/60 p-3.5 rounded-lg border border-purple-200/80 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                                <p className="text-purple-900 font-semibold">
                                    Số Quyết định tiêu biểu: <span className="font-bold text-purple-700">{periodDecisionList[0]?.decisionNumber || 'Chưa cập nhật'}</span>
                                </p>
                                <p className="text-purple-700">
                                    Ngày ký ban hành: {periodDecisionList[0]?.decisionDate ? dayjs(periodDecisionList[0].decisionDate).format('DD/MM/YYYY') : 'Hôm nay'}
                                </p>
                            </div>
                            <Tag color="green">Kích hoạt cửa sổ 7 ngày đổi tên đề tài</Tag>
                        </div>
                    ) : (
                        <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-200/80 text-xs text-amber-800">
                            Chưa có đề tài nào được ban hành Quyết định trong học kỳ này. Bạn có thể nhấn nút <strong>"Ban hành QĐ"</strong> để cấp quyết định cho các sinh viên đã hoàn tất phê duyệt đề cương.
                        </div>
                    )}

                    <Table
                        dataSource={periodDecisionList}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 8, showTotal: (total) => `Tổng cộng: ${total} đề tài` }}
                        columns={[
                            {
                                title: 'STT',
                                key: 'stt',
                                width: 55,
                                align: 'center',
                                render: (_, __, index) => index + 1,
                            },
                            {
                                title: 'Sinh viên',
                                key: 'student',
                                width: 200,
                                render: (_, record) => (
                                    <div>
                                        <div className="font-bold text-slate-900">{record.student?.fullName || 'N/A'}</div>
                                        <div className="text-[11px] text-slate-600 font-mono font-medium">MSSV: {record.student?.code || 'N/A'}</div>
                                        {record.student?.email && (
                                            <div className="text-[11px] text-slate-500">{record.student.email}</div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                title: 'Tên đề tài',
                                key: 'topic',
                                render: (_, record) => (
                                    <div>
                                        <div className="font-semibold text-slate-800 leading-snug">
                                            {record.adjustedTitle || record.topic?.title || 'Chưa có tên'}
                                        </div>
                                        {record.adjustedTitle && record.adjustedTitle !== record.topic?.title && (
                                            <div className="text-[11px] text-emerald-600 mt-0.5">
                                                (Đã điều chỉnh từ: <em>{record.topic?.title}</em>)
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                title: 'GVHD',
                                key: 'mentor',
                                width: 160,
                                render: (_, record) => (
                                    <span className="text-xs text-slate-700 font-medium">
                                        {record.topic?.mentor?.fullName || 'Chưa phân công'}
                                    </span>
                                ),
                            },
                            {
                                title: 'Số QĐ & Ngày',
                                key: 'decisionInfo',
                                width: 160,
                                render: (_, record) => (
                                    <div>
                                        <div className="font-mono text-xs font-bold text-purple-700">
                                            {record.decisionNumber || '—'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium">
                                            {record.decisionDate ? dayjs(record.decisionDate).format('DD/MM/YYYY') : '—'}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                title: 'Trạng thái',
                                dataIndex: 'status',
                                key: 'status',
                                width: 130,
                                align: 'center',
                                render: (status, record) => {
                                    const statusValue = typeof status === 'string' ? status : record?.status;
                                    return (
                                        <Tag color={statusValue === 'DECISION_ISSUED' ? 'purple' : 'blue'}>
                                            {statusValue === 'DECISION_ISSUED' ? 'Đã ban hành QĐ' : String(statusValue || '')}
                                        </Tag>
                                    );
                                },
                            },
                            {
                                title: 'Hành động',
                                key: 'actions',
                                width: 150,
                                align: 'center',
                                render: (_, record) => (
                                    <Space direction="vertical" size={2} align="center">
                                        <Button
                                            type="primary"
                                            size="small"
                                            ghost
                                            icon={<EditOutlined />}
                                            className="!text-purple-700 !border-purple-300 hover:!border-purple-500 hover:!text-purple-900 text-xs font-medium"
                                            onClick={() => handleOpenAmendmentModal(record)}
                                        >
                                            Điều chỉnh QĐ
                                        </Button>
                                        {record.assignmentDecisions?.[0]?.amendments?.length > 0 && (
                                            <Tag color="geekblue" className="!mr-0 text-[10px]">
                                                Đã có {record.assignmentDecisions[0].amendments.length} lần ĐC
                                            </Tag>
                                        )}
                                    </Space>
                                ),
                            },
                        ]}
                    />
                </div>
            </QueryPanel>
            </Modal>

            {/* Modal Ban hành Quyết định Điều chỉnh */}
            <Modal
                title={(
                    <div className="flex items-center gap-2">
                        <EditOutlined className="text-purple-600 text-lg" />
                        <span className="font-bold text-slate-800">
                            Ban hành Quyết định Điều chỉnh
                        </span>
                    </div>
                )}
                open={amendmentModalOpen}
                onCancel={() => setAmendmentModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setAmendmentModalOpen(false)} disabled={amendmentSubmitting}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={amendmentSubmitting}
                        onClick={() => amendmentForm.submit()}
                        className="!bg-purple-600 hover:!bg-purple-700"
                    >
                        Ký Ban Hành QĐ Điều Chỉnh
                    </Button>,
                ]}
                width={680}
                destroyOnClose
            >
                <div className="py-2 space-y-4">
                    {selectedDecisionRecord && (
                        <div className="bg-purple-50/70 p-3.5 rounded-lg border border-purple-200 text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-purple-900 font-bold">
                                    Hồ sơ: {selectedDecisionRecord.student?.fullName} ({selectedDecisionRecord.student?.code})
                                </span>
                                <Tag color="purple">QĐ gốc: {selectedDecisionRecord.decisionNumber || '—'}</Tag>
                            </div>
                            <div className="text-purple-800">
                                <strong>Đề tài hiện tại:</strong> {selectedDecisionRecord.adjustedTitle || selectedDecisionRecord.topic?.title}
                            </div>
                            <div className="text-purple-700 text-[11px]">
                                <strong>GVHD:</strong> {selectedDecisionRecord.topic?.mentor?.fullName || 'Chưa phân công'}
                            </div>
                        </div>
                    )}

                    <Alert
                        message="Quy chuẩn Học vụ về Quyết định Điều chỉnh"
                        description="Quyết định gốc giữ nguyên tính toàn vẹn. Khi có thay đổi về tên đề tài, thông tin sinh viên hoặc người hướng dẫn, Viện trưởng ký ban hành Quyết định điều chỉnh bổ sung."
                        type="info"
                        showIcon
                        className="text-xs"
                    />

                    <Form
                        form={amendmentForm}
                        layout="vertical"
                        onFinish={handleSubmitDecisionAmendment}
                        style={{ marginTop: 12 }}
                    >
                        <Row gutter={16}>
                            <Col span={14}>
                                <Form.Item
                                    name="amendmentNumber"
                                    label="Số Quyết định điều chỉnh"
                                    rules={[{ required: true, message: 'Vui lòng nhập số quyết định điều chỉnh' }]}
                                >
                                    <Input placeholder="VD: QĐ-ĐC-01/2026/QĐ-VIEN" />
                                </Form.Item>
                            </Col>
                            <Col span={10}>
                                <Form.Item
                                    name="effectiveAt"
                                    label="Ngày ký / Ngày hiệu lực"
                                    rules={[{ required: true, message: 'Chọn ngày hiệu lực' }]}
                                >
                                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="reason"
                            label="Lý do điều chỉnh (Căn cứ theo văn bản / đề xuất)"
                            rules={[{ required: true, message: 'Vui lòng nhập lý do điều chỉnh quyết định' }]}
                        >
                            <Input.TextArea
                                rows={3}
                                placeholder="VD: Căn cứ đề nghị xin điều chỉnh tên đề tài tốt nghiệp của sinh viên đã được GVHD phê duyệt..."
                            />
                        </Form.Item>

                        <Form.Item
                            name="adjustedTitle"
                            label="Tên đề tài mới sau điều chỉnh (Nếu có thay đổi tên)"
                        >
                            <Input placeholder="Nhập tên đề tài mới..." />
                        </Form.Item>

                        <Form.Item
                            name="note"
                            label="Ghi chú nội dung thay đổi khác"
                        >
                            <Input.TextArea
                                rows={2}
                                placeholder="Ghi chú thêm về nội dung, phạm vi hoặc điều chỉnh khác..."
                            />
                        </Form.Item>
                    </Form>

                    {/* Lịch sử các lần điều chỉnh trước đó (nếu có) */}
                    {selectedDecisionRecord?.assignmentDecisions?.[0]?.amendments?.length > 0 && (
                        <div className="mt-4 border-t pt-3">
                            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">
                                Lịch sử Quyết định Điều chỉnh đã ban hành ({selectedDecisionRecord.assignmentDecisions[0].amendments.length})
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedDecisionRecord.assignmentDecisions[0].amendments.map((amend, idx) => (
                                    <div key={amend.id || idx} className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                                        <div className="flex justify-between items-center font-semibold text-slate-800">
                                            <span className="font-mono text-purple-700">{amend.amendmentNumber}</span>
                                            <span className="text-slate-500 font-normal">{dayjs(amend.effectiveAt).format('DD/MM/YYYY')}</span>
                                        </div>
                                        <p className="text-slate-600 mt-1 mb-0.5"><strong>Lý do:</strong> {amend.reason}</p>
                                        {amend.changes && (
                                            <p className="text-[11px] text-slate-500 m-0">
                                                <strong>Thay đổi:</strong> {typeof amend.changes === 'object' ? JSON.stringify(amend.changes) : amend.changes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal Tạo Ủy Quyền Chuyên Môn */}
            <Modal
                title="Tạo Ủy Quyền Chuyên Môn Học Thuật"
                open={delegationModalOpen}
                onCancel={() => setDelegationModalOpen(false)}
                footer={null}
                width={620}
                destroyOnClose
            >
                <QueryPanel query={lecturersQuery}>
                <div className="mb-4">
                    <Alert
                        type="info"
                        showIcon
                        message="Chính sách ủy quyền chuyên môn"
                        description="Việc ủy quyền chỉ áp dụng cho giảng viên thuộc cùng khoa/viện và có hiệu lực trong khoảng thời gian xác định. Mọi hành động được thực hiện qua ủy quyền sẽ ghi nhận đầy đủ Audit Log."
                    />
                </div>

                <Form
                    form={delegationForm}
                    layout="vertical"
                    onFinish={handleSubmitCreateDelegation}
                    initialValues={{
                        dateRange: [dayjs(), dayjs().add(30, 'day')],
                    }}
                >
                    <Form.Item
                        name="delegateeId"
                        label="Giảng viên nhận ủy quyền"
                        rules={[{ required: true, message: 'Vui lòng chọn giảng viên nhận ủy quyền' }]}
                    >
                        <Select
                            placeholder={`Chọn giảng viên cùng khoa ${user?.department ? `(${user.department})` : ''}`}
                            showSearch
                            optionFilterProp="label"
                            options={departmentLecturers.map((lec) => ({
                                value: lec.id,
                                label: `${lec.fullName} (${lec.code || lec.email})${lec.department ? ` - Khoa ${lec.department}` : ''}`,
                            }))}
                        />
                    </Form.Item>

                    <Form.Item
                        name="capabilityCode"
                        label="Quyền chuyên môn"
                        rules={[{ required: true, message: 'Vui lòng chọn quyền ủy quyền' }]}
                    >
                        <Select
                            placeholder="Chọn quyền chuyên môn ủy quyền"
                            options={GRANTABLE_CAPABILITIES}
                        />
                    </Form.Item>

                    <Form.Item
                        name="semesterId"
                        label="Phạm vi Đợt đồ án / Học kỳ (Tùy chọn)"
                    >
                        <Select
                            allowClear
                            placeholder="Tất cả đợt đồ án thuộc khoa/viện"
                            options={periods.map((p) => ({ value: p.id, label: p.name }))}
                        />
                    </Form.Item>

                    <Form.Item
                        name="dateRange"
                        label="Thời hạn hiệu lực ủy quyền"
                        rules={[{ required: true, message: 'Vui lòng chọn thời hạn ủy quyền' }]}
                    >
                        <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            placeholder={['Ngày bắt đầu', 'Ngày hết hạn']}
                        />
                    </Form.Item>

                    <Form.Item
                        name="reason"
                        label="Lý do ủy quyền"
                        rules={[{ required: true, message: 'Vui lòng nhập lý do ủy quyền' }]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do ủy quyền chuyên môn (VD: Đi công tác, phân công nhiệm vụ phụ trách đợt...)"
                        />
                    </Form.Item>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button onClick={() => setDelegationModalOpen(false)} disabled={delegationSubmitting}>
                            Hủy
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={delegationSubmitting}
                            className="!bg-teal-600 hover:!bg-teal-700"
                        >
                            Xác nhận ủy quyền
                        </Button>
                    </div>
                </Form>
            </QueryPanel>
            </Modal>

            {/* Modal Quản lý Phụ lục điều chỉnh tên đề tài */}
            <Modal
                title={(
                    <div className="flex items-center gap-2">
                        <AuditOutlined className="text-teal-600 text-lg" />
                        <span>Phụ lục điều chỉnh tên đề tài ({selectedAppendixPeriod?.name})</span>
                    </div>
                )}
                open={appendixModalVisible}
                onCancel={() => {
                    setAppendixModalVisible(false);
                    setSelectedAppendixPeriod(null);
                }}
                footer={[
                    <Button key="close" icon={<CloseOutlined />} onClick={() => setAppendixModalVisible(false)}>
                        Đóng
                    </Button>,
                    <Button
                        key="create"
                        type="primary"
                        icon={<PlusOutlined />}
                        className="!bg-teal-600 hover:!bg-teal-700"
                        onClick={handleOpenCreateAppendix}
                    >
                        Tạo dự thảo phụ lục
                    </Button>,
                ]}
                width={800}
                destroyOnClose
            >
                <div className="space-y-4 py-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Quản lý Phụ lục điều chỉnh tên đề tài theo đợt"
                        description="Các phiếu đổi tên BM02-A sau khi được Phụ trách bộ môn phê duyệt sẽ được gom thành các đợt Phụ lục điều chỉnh. Sau khi ban hành (ISSUED), tên đề tài mới sẽ chính thức có hiệu lực học vụ."
                    />

                    <QueryPanel query={appendicesQuery}>
                        {appendicesList.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
                                Chưa có phụ lục điều chỉnh tên đề tài nào cho đợt này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {appendicesList.map((app) => (
                                    <div key={app.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <strong className="text-slate-800">{app.appendixNumber}</strong>
                                                <Tag color={app.status === 'ISSUED' ? 'green' : 'gold'}>
                                                    {app.status === 'ISSUED' ? 'Đã ban hành' : 'Bản dự thảo'}
                                                </Tag>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">
                                                    Ngày ký: {dayjs(app.signedDate).format('DD/MM/YYYY')}
                                                </span>
                                                {app.status === 'DRAFT' && (
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        icon={<FileDoneOutlined />}
                                                        className="!bg-emerald-600 hover:!bg-emerald-700"
                                                        onClick={() => handleIssueAppendixAction(app.id)}
                                                    >
                                                        Ban hành phụ lục
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {app.items && app.items.length > 0 && (
                                            <div className="mt-2 text-xs border-t border-slate-100 pt-2 space-y-1">
                                                {app.items.map((item) => (
                                                    <div key={item.id} className="flex justify-between bg-slate-50 p-2 rounded">
                                                        <span>
                                                            <strong className="text-slate-700">{item.oldTitle}</strong>
                                                            <span className="text-slate-400 mx-2">thành</span>
                                                            <strong className="text-blue-700">{item.newTitle}</strong>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </QueryPanel>
                </div>
            </Modal>

            {/* Modal Lập dự thảo phụ lục mới */}
            <Modal
                title="Lập dự thảo phụ lục điều chỉnh tên đề tài"
                open={createAppendixModalVisible}
                onCancel={() => setCreateAppendixModalVisible(false)}
                footer={null}
                width={650}
                destroyOnClose
            >
                <QueryPanel query={queueQuery}>
                <Form form={appendixForm} layout="vertical" onFinish={handleCreateAppendixSubmit} className="pt-2">
                    <Form.Item
                        name="appendixNumber"
                        label="Số Phụ lục ban hành"
                        rules={[{ required: true, message: 'Vui lòng nhập số phụ lục.' }]}
                    >
                        <Input placeholder="Ví dụ: PL-2026-001/PL-VIEN" />
                    </Form.Item>

                    <Form.Item
                        name="signedDate"
                        label="Ngày ký phụ lục"
                        rules={[{ required: true, message: 'Vui lòng chọn ngày ký.' }]}
                    >
                        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>

                    <div className="mb-4">
                        <label className="text-xs font-semibold text-slate-700 block mb-2">
                            Chọn các hồ sơ BM02-A đưa vào phụ lục ({selectedBm02aIds.length} đã chọn):
                        </label>
                        {eligibleBm02aRequests.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">
                                Không có yêu cầu BM02-A nào đang chờ đưa vào phụ lục.
                            </p>
                        ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded p-2">
                                {eligibleBm02aRequests.map((req) => {
                                    const v = req.versions?.[0];
                                    const isSelected = selectedBm02aIds.includes(req.id);
                                    return (
                                        <div
                                            key={req.id}
                                            className={`p-2 rounded border text-xs cursor-pointer flex justify-between items-center ${
                                                isSelected ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
                                            }`}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedBm02aIds(selectedBm02aIds.filter((id) => id !== req.id));
                                                } else {
                                                    setSelectedBm02aIds([...selectedBm02aIds, req.id]);
                                                }
                                            }}
                                        >
                                            <div>
                                                <strong>{req.registration?.student?.fullName}</strong> ({req.registration?.student?.code})
                                                <div className="text-slate-600">Đổi thành: <em>"{v?.proposedTitle}"</em></div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                className="cursor-pointer"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button icon={<CloseOutlined />} onClick={() => setCreateAppendixModalVisible(false)}>
                            Hủy bỏ
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<PlusOutlined />}
                            loading={appendixSubmitting}
                            className="!bg-teal-600 hover:!bg-teal-700"
                        >
                            Lập dự thảo phụ lục
                        </Button>
                    </div>
                </Form>
            </QueryPanel>
            </Modal>

            {/* Drawer Thẩm định BM02 */}
            <BM02ReviewDrawer
                open={bm02DrawerOpen}
                onClose={() => {
                    setBm02DrawerOpen(false);
                    setSelectedBm02Registration(null);
                }}
                registration={selectedBm02Registration}
                onSuccess={handleBm02ReviewSuccess}
            />
        </div>
        </QueryPanel>
    );
}

export default ProjectPeriodPage;
