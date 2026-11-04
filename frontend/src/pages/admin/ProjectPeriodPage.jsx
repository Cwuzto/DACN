import { useCallback, useEffect, useMemo, useState } from 'react';
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

import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import { topicService } from '../../services/topicService';
import useAuthStore from '../../stores/authStore';
import { PROJECT_NAME, buildSemesterName, extractSemesterMeta, formatSemesterLabel } from '../../utils/semesterDisplay';
import BM02ReviewDrawer from '../../components/admin/BM02ReviewDrawer';

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

function PeriodCard({ period, onEdit, onDelete, onClone, onIssueDecision, onViewDecisionList, isAdmin = true }) {
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
                            <Tooltip title="Ban hành Quyết định giao đề tài (kèm danh sách BM02)">
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
    const isAdmin = user?.role === 'ADMIN';

    const [defaultSemesterId, setDefaultSemesterId] = useState(null);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingToggle, setUpdatingToggle] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [form] = Form.useForm();

    const [decisionModalVisible, setDecisionModalVisible] = useState(false);
    const [decisionPeriod, setDecisionPeriod] = useState(null);
    const [decisionSubmitting, setDecisionSubmitting] = useState(false);
    const [decisionForm] = Form.useForm();

    const [allRegistrations, setAllRegistrations] = useState([]);
    const [decisionListModalVisible, setDecisionListModalVisible] = useState(false);
    const [selectedPeriodForDecisions, setSelectedPeriodForDecisions] = useState(null);

    // BM02 Review Queue state
    const [activeTab, setActiveTab] = useState('periods');
    const [bm02SemesterFilter, setBm02SemesterFilter] = useState('ALL');
    const [bm02StatusFilter, setBm02StatusFilter] = useState('PENDING');
    const [bm02DrawerOpen, setBm02DrawerOpen] = useState(false);
    const [selectedBm02Registration, setSelectedBm02Registration] = useState(null);

    // Decision Amendment state
    const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
    const [selectedDecisionRecord, setSelectedDecisionRecord] = useState(null);
    const [amendmentSubmitting, setAmendmentSubmitting] = useState(false);
    const [amendmentForm] = Form.useForm();

    const handleOpenDecisionList = (period) => {
        setSelectedPeriodForDecisions(period);
        setDecisionListModalVisible(true);
    };

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
            const res = await semesterService.createDecisionAmendment(decisionId, {
                amendmentNumber: values.amendmentNumber.trim(),
                reason: values.reason.trim(),
                changes,
                effectiveAt: values.effectiveAt ? values.effectiveAt.toISOString() : new Date().toISOString(),
            });
            if (res.success || res.data) {
                message.success('Đã ban hành Quyết định Điều chỉnh thành công!');
                setAmendmentModalOpen(false);
                fetchSemesters();
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
            decisionNumber: `QĐ-${period.id}/${dayjs().year()}/QĐ-VIEN`,
        });
        setDecisionModalVisible(true);
    };

    const handleSubmitIssueDecision = async (values) => {
        if (!decisionPeriod) return;
        try {
            setDecisionSubmitting(true);
            const res = await semesterService.issuePeriodDecision(decisionPeriod.id, {
                decisionNumber: values.decisionNumber.trim(),
                decisionDate: values.decisionDate.toISOString(),
                decisionFileUrl: values.decisionFileUrl?.trim() || undefined,
            });
            if (res.success) {
                message.success(res.message || 'Ban hành Quyết định giao đề tài thành công!');
                setDecisionModalVisible(false);
                fetchSemesters();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể ban hành quyết định');
        } finally {
            setDecisionSubmitting(false);
        }
    };

    const fetchSemesters = useCallback(async () => {
        try {
            setLoading(true);
            const [semesterRes, topicRes, registrationRes] = await Promise.all([
                semesterService.getAll(),
                topicService.getAll(),
                registrationService.getAllRegistrations(),
            ]);

            if (!semesterRes.success) return;

            setAllRegistrations(registrationRes?.data || []);

            const topicsBySemester = (topicRes?.data || []).reduce((acc, topic) => {
                acc[topic.semesterId] = (acc[topic.semesterId] || 0) + 1;
                return acc;
            }, {});

            const studentsBySemester = (registrationRes?.data || []).reduce((acc, registration) => {
                acc[registration.semesterId] = (acc[registration.semesterId] || 0) + 1;
                return acc;
            }, {});

            const mapped = semesterRes.data.map((semester) => ({
                ...extractSemesterMeta(semester),
                key: semester.id.toString(),
                id: semester.id,
                name: formatSemesterLabel(semester),
                code: `HK-${semester.id}`,
                status: semester.status,
                registrationOpen:
                    typeof semester.registrationOpen === 'boolean' ? semester.registrationOpen : true,
                topics: topicsBySemester[semester.id] || 0,
                students: studentsBySemester[semester.id] || 0,
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

            setPeriods(mapped);
            if (mapped.length > 0) {
                setDefaultSemesterId((current) =>
                    current && mapped.some((period) => period.id === current) ? current : mapped[0].id
                );
            } else {
                setDefaultSemesterId(null);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi tải danh sách đợt đồ án');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSemesters();
    }, [fetchSemesters]);

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
            const response = await semesterService.toggleRegistration(selectedPeriod.id, checked);
            if (response.success) {
                message.success(
                    checked ? 'Đã mở đăng ký đề tài cho học kỳ đã chọn.' : 'Đã đóng đăng ký đề tài cho học kỳ đã chọn.'
                );
                setPeriods((current) =>
                    current.map((period) =>
                        period.id === selectedPeriod.id
                            ? { ...period, registrationOpen: checked, rawData: { ...period.rawData, registrationOpen: checked } }
                            : period
                    )
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
        form.setFieldsValue({
            status: 'UPCOMING',
            registrationOpen: true,
            projectName: PROJECT_NAME,
            term: 1,
            academicStartYear: dayjs().year(),
        });
        setIsModalVisible(true);
    };

    const handleEdit = (period) => {
        setModalMode('edit');
        const meta = extractSemesterMeta(period.rawData);
        const startYear = Number.parseInt((meta.academicYear || '').split('-')[0], 10) || dayjs().year();
        form.setFieldsValue({
            id: period.id,
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
        form.setFieldsValue({
            projectName: PROJECT_NAME,
            term: meta.term,
            academicStartYear: Number.isInteger(cloneStartYear) ? cloneStartYear : dayjs().year() + 1,
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
                    const response = await semesterService.delete(id);
                    if (response.success) {
                        message.success('Đã xóa đợt đồ án');
                        fetchSemesters();
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
                    ? await semesterService.create(payload)
                    : await semesterService.update(values.id, payload);

            if (response.success) {
                message.success(modalMode === 'add' ? 'Khởi tạo đợt thành công' : 'Cập nhật đợt thành công');
                setIsModalVisible(false);
                fetchSemesters();
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra');
        }
    };

    const activeCount = useMemo(() => periods.filter((p) => ['ONGOING', 'REGISTRATION'].includes(p.status)).length, [periods]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">ACADEMIC PERIODS & TIMELINE MANAGEMENT</p>
                    <h1 className="h1">{isAdmin ? 'Quản lý Đợt Đồ án & Học kỳ Học vụ' : 'Đợt Đồ án & Ban hành Quyết định'}</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={fetchSemesters}>
                        <ReloadOutlined />
                        <span>Làm mới</span>
                    </button>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={handleAdd}>
                            <PlusOutlined />
                            <span>Khởi tạo Đợt Đồ án mới</span>
                        </button>
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
                <div className="card" style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => setActiveTab('bm02Queue')}>
                    <span className="meta">Đơn BM02 chờ thẩm định</span>
                    <p className="h2 num" style={{ marginTop: 2, color: pendingBm02List.length > 0 ? '#E11D48' : '#0F766E' }}>
                        {pendingBm02List.length}
                    </p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>
                        {pendingBm02List.length > 0 ? 'Cần Viện trưởng thẩm định' : 'Không có hồ sơ tồn đọng'}
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
                onChange={setActiveTab}
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

                                <Spin spinning={loading}>
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
                                                    isAdmin={isAdmin}
                                                />
                                            ))
                                        )}
                                    </div>
                                </Spin>
                            </div>
                        ),
                    },
                    {
                        key: 'bm02Queue',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-1">
                                <CheckCircleOutlined />
                                <span>Hàng đợi Thẩm định BM02</span>
                                {pendingBm02List.length > 0 && (
                                    <Badge count={pendingBm02List.length} overflowCount={99} />
                                )}
                            </span>
                        ),
                        children: (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">
                                            Hàng Đợi Thẩm Định Đơn Đề Cương BM02
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Thẩm định đơn BM02 của sinh viên theo quy chuẩn Viện. Hồ sơ được phê duyệt sẽ đủ điều kiện ban hành Quyết định giao đề tài.
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
                                                { value: 'ALL', label: 'Tất cả trạng thái BM02' },
                                                { value: 'REVISION', label: 'Cần chỉnh sửa (BM02)' },
                                                { value: 'APPROVED', label: 'Đã duyệt BM02 / Cấp QĐ' },
                                            ]}
                                        />
                                    </Space>
                                </div>

                                <Table
                                    dataSource={bm02QueueList}
                                    rowKey="id"
                                    size="middle"
                                    pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng: ${total} hồ sơ BM02` }}
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
                                                    {record.student?.class && (
                                                        <div className="text-[11px] text-slate-500">Lớp: {record.student.class}</div>
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
                                            key: 'status',
                                            width: 160,
                                            align: 'center',
                                            render: (status) => {
                                                const statusMap = {
                                                    BM02_SUBMITTED: { label: 'Chờ duyệt lần 1', color: 'blue' },
                                                    BM02_RESUBMITTED: { label: 'Chờ duyệt nộp lại', color: 'purple' },
                                                    BM02_NEEDS_REVISION: { label: 'Yêu cầu chỉnh sửa', color: 'orange' },
                                                    APPROVED: { label: 'Đã duyệt BM02', color: 'green' },
                                                    DECISION_ISSUED: { label: 'Đã ban hành QĐ', color: 'cyan' },
                                                };
                                                const item = statusMap[status] || { label: status, color: 'default' };
                                                return <Tag color={item.color}>{item.label}</Tag>;
                                            },
                                        },
                                        {
                                            title: 'Tệp BM02',
                                            key: 'file',
                                            width: 110,
                                            align: 'center',
                                            render: (_, record) => {
                                                const fileUrl = record.currentBM02Submission?.fileUrl;
                                                if (!fileUrl) return <span className="text-slate-400 text-xs">—</span>;
                                                return (
                                                    <Tooltip title="Xem tệp đề cương BM02">
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
                                                    Thẩm định BM02
                                                </Button>
                                            ),
                                        },
                                    ]}
                                />
                            </div>
                        ),
                    },
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
                <Form form={form} layout="vertical" name="project_period_form" style={{ marginTop: 16 }}>
                    <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="projectName" label="Tên đồ án" initialValue={PROJECT_NAME}>
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="term" label="Học kỳ" rules={[{ required: true, message: 'Chọn học kỳ' }]}>
                                <Select
                                    options={[
                                        { value: 1, label: 'Học kỳ 1' },
                                        { value: 2, label: 'Học kỳ 2' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
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
                        <strong>Quy chuẩn học vụ:</strong> Quyết định giao đề tài được ký bởi Trưởng Viện / Ban Giám Hiệu kèm danh sách sinh viên đã nộp BM02. Sau khi ban hành, hệ thống sẽ kích hoạt <strong>cửa sổ 7 ngày</strong> cho phép sinh viên nộp đơn xin điều chỉnh tên đề tài (GVHD duyệt trực tiếp).
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
                            Chưa có đề tài nào được ban hành Quyết định trong học kỳ này. Bạn có thể nhấn nút <strong>"Ban hành QĐ"</strong> để cấp quyết định cho các sinh viên đã hoàn tất BM02.
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
                                key: 'status',
                                width: 130,
                                align: 'center',
                                render: (status) => (
                                    <Tag color={status === 'DECISION_ISSUED' ? 'purple' : 'blue'}>
                                        {status === 'DECISION_ISSUED' ? 'Đã ban hành QĐ' : status}
                                    </Tag>
                                ),
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
    );
}

export default ProjectPeriodPage;
