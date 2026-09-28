import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Card,
    Button,
    Dropdown,
    Empty,
    Flex,
    List,
    Input,
    message,
    Modal,
    Popconfirm,
    Tag,
    Select,
    Spin,
    Space,
    Table,
    Tabs,
    Typography,
    Timeline,
    Tooltip,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloudUploadOutlined,
    ExclamationCircleOutlined,
    FileDoneOutlined,
    FilePdfOutlined,
    FilePptOutlined,
    GithubOutlined,
    HistoryOutlined,
    MoreOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    StopOutlined,
    SwapOutlined,
    TeamOutlined,
    ThunderboltOutlined,
    WarningOutlined,
    YoutubeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import taskService from '../../services/taskService';
import archiveService from '../../services/archiveService';
import useAuthStore from '../../stores/authStore';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { STATUS_MAP } from '../../components/common/statusMap';

const { Text } = Typography;

const computeSemesterClosestToNow = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return null;

    const now = dayjs();
    const scored = list
        .map((semester) => {
            const start = semester.startDate ? dayjs(semester.startDate) : null;
            const end = semester.endDate ? dayjs(semester.endDate) : null;
            const defense = semester.defenseDate ? dayjs(semester.defenseDate) : null;

            let distanceToNow = Number.POSITIVE_INFINITY;
            let latestPoint = 0;

            [start, end, defense].forEach((point) => {
                if (point && point.isValid()) {
                    const diff = Math.abs(point.diff(now, 'day'));
                    if (diff < distanceToNow) distanceToNow = diff;
                    const val = point.valueOf();
                    if (val > latestPoint) latestPoint = val;
                }
            });

            return {
                semester,
                distanceToNow,
            };
        })
        .sort((a, b) => {
            if (a.distanceToNow !== b.distanceToNow) return a.distanceToNow - b.distanceToNow;
            return 0;
        });

    return scored[0]?.semester?.id || null;
};

function ProjectOversightPage() {
    const [loading, setLoading] = useState(true);
    const [topics, setTopics] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [semesterFilter, setSemesterFilter] = useState(null);
    const [projectNameFilter, setProjectNameFilter] = useState(null);

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTopic, setAuditTopic] = useState(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTopic, setTransferTopic] = useState(null);
    const [transferLecturerId, setTransferLecturerId] = useState(null);

    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [progressTopic, setProgressTopic] = useState(null);
    const [progressRegistrationId, setProgressRegistrationId] = useState(null);
    const [progressTasks, setProgressTasks] = useState([]);
    const [progressLoading, setProgressLoading] = useState(false);

    // Gói 2: Archive & Health Radar states
    const [activeMainTab, setActiveMainTab] = useState('TOPIC_OVERSIGHT');
    const [healthRadarStats, setHealthRadarStats] = useState(null);
    const [healthRadarLoading, setHealthRadarLoading] = useState(false);
    const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
    const [archivesList, setArchivesList] = useState([]);
    const [archivesLoading, setArchivesLoading] = useState(false);
    const [archiveStatusFilter, setArchiveStatusFilter] = useState('ALL');
    const [archiveSearchText, setArchiveSearchText] = useState('');
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certificateData, setCertificateData] = useState(null);
    const [certLoading, setCertLoading] = useState(false);

    // Bypass BM01/BM02 states
    const [isBypassModalOpen, setIsBypassModalOpen] = useState(false);
    const [bypassTarget, setBypassTarget] = useState(null);
    const [bypassReason, setBypassReason] = useState('Được miễn thẩm định theo quyết định của Viện / Khoa (Đề tài NCKH nghiệm thu)');
    const [bypassLoading, setBypassLoading] = useState(false);

    const handleConfirmBypass = async () => {
        if (!bypassTarget?.registration?.id) return;
        if (!bypassReason.trim()) {
            message.warning('Vui lòng nhập lý do miễn thẩm định.');
            return;
        }
        setBypassLoading(true);
        try {
            const res = await registrationService.bypassOutlineReview(bypassTarget.registration.id, bypassReason.trim());
            if (res.success) {
                message.success('Đã phê duyệt miễn thẩm định đề cương (Bypass BM01-BM02) thành công!');
                setIsBypassModalOpen(false);
                setBypassTarget(null);
                fetchData();
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi miễn thẩm định đề cương');
        } finally {
            setBypassLoading(false);
        }
    };

    const fetchHealthRadar = async (semId) => {
        try {
            setHealthRadarLoading(true);
            const res = await archiveService.getHealthRadarStats({ semesterId: semId || undefined });
            if (res.success) {
                setHealthRadarStats(res.data || null);
            }
        } catch {
            setHealthRadarStats(null);
        } finally {
            setHealthRadarLoading(false);
        }
    };

    const fetchArchives = async (semId, status) => {
        try {
            setArchivesLoading(true);
            const res = await archiveService.getAllArchives({
                semesterId: semId || undefined,
                status: status !== 'ALL' ? status : undefined,
                limit: 100,
            });
            if (res.success) {
                setArchivesList(res.data?.items || []);
            }
        } catch {
            setArchivesList([]);
        } finally {
            setArchivesLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [topicsRes, regRes, lecturerRes, semesterRes] = await Promise.all([
                topicService.getAll(),
                registrationService.getAllRegistrations(),
                userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 }),
                semesterService.getAll(),
            ]);

            if (topicsRes.success) setTopics(topicsRes.data || []);
            if (regRes.success) setRegistrations(regRes.data || []);
            if (lecturerRes.success) setLecturers(lecturerRes.data || []);
            if (semesterRes.success) setSemesters(semesterRes.data || []);

            fetchHealthRadar(semesterFilter);
            fetchArchives(semesterFilter, archiveStatusFilter);
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu giám sát');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCertificate = async (registrationId) => {
        try {
            setCertLoading(true);
            const res = await archiveService.getClearanceCertificate(registrationId);
            if (res.success) {
                setCertificateData(res.data);
                setCertModalOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Giấy xác nhận tốt nghiệp');
        } finally {
            setCertLoading(false);
        }
    };

    const handleQuickApproveArchive = async (registrationId) => {
        try {
            const res = await archiveService.reviewArchive(registrationId, {
                decision: 'APPROVED',
                reviewerNotes: 'Ban Quản trị / Khoa đã nghiệm thu lưu chiểu hoàn tất.',
            });
            if (res.success) {
                message.success('Đã nghiệm thu lưu chiểu thành công! Đề tài chuyển sang COMPLETED.');
                fetchArchives(semesterFilter, archiveStatusFilter);
                fetchData();
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi nghiệm thu lưu chiểu');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchHealthRadar(semesterFilter);
        fetchArchives(semesterFilter, archiveStatusFilter);
    }, [semesterFilter, archiveStatusFilter]);

    const currentSemesters = useMemo(() => {
        const now = dayjs();
        return semesters.filter((semester) => {
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const end = semester?.endDate ? dayjs(semester.endDate) : null;
            if (!start || !end || !start.isValid() || !end.isValid()) return false;
            return (now.isAfter(start) || now.isSame(start)) && (now.isBefore(end) || now.isSame(end));
        });
    }, [semesters]);

    useEffect(() => {
        if (!currentSemesters.length) {
            setSemesterFilter(null);
            return;
        }

        const stillExists = currentSemesters.some((semester) => semester.id === semesterFilter);
        if (semesterFilter && stillExists) return;

        const nearestLatestSemesterId = pickNearestLatestSemesterId(currentSemesters);
        setSemesterFilter(nearestLatestSemesterId);
    }, [currentSemesters, semesterFilter]);

    const registrationMap = useMemo(
        () =>
            registrations.reduce((acc, item) => {
                if (!acc[item.topic?.id]) acc[item.topic?.id] = [];
                acc[item.topic?.id].push(item);
                return acc;
            }, {}),
        [registrations]
    );

    const tableData = useMemo(
        () =>
            topics.map((topic) => {
                const topicRegistrations = registrationMap[topic.id] || [];
                return {
                    ...topic,
                    code: `DT-${String(topic.id).padStart(3, '0')}`,
                    students: topicRegistrations.filter((item) => item.student).map((item) => item.student.fullName),
                    registrationEvents: topicRegistrations,
                };
            }),
        [topics, registrationMap]
    );

    const filteredTopics = useMemo(() => {
        return tableData.filter((item) => {
            const keyword = searchText.trim().toLowerCase();
            const matchSearch =
                !keyword ||
                item.title?.toLowerCase().includes(keyword) ||
                item.code.toLowerCase().includes(keyword) ||
                item.mentor?.fullName?.toLowerCase().includes(keyword);
            const matchStatus = statusFilter ? item.status === statusFilter : true;
            const matchSemester = semesterFilter ? item.semesterId === semesterFilter : true;
            const matchProjectName = projectNameFilter
                ? (item.projectCatalog?.name || '') === projectNameFilter
                : true;
            return matchSearch && matchStatus && matchSemester && matchProjectName;
        });
    }, [tableData, searchText, statusFilter, semesterFilter, projectNameFilter]);

    const scopedRegistrations = useMemo(
        () => (semesterFilter ? registrations.filter((item) => item.semesterId === semesterFilter) : registrations),
        [registrations, semesterFilter]
    );

    const warningStats = useMemo(() => {
        const pendingRegistrations = scopedRegistrations.filter((item) => item.status === 'PENDING').length;
        const unassignedCouncil = scopedRegistrations.filter(
            (item) => !['PENDING', 'REJECTED'].includes(item.status) && !item.councilId
        ).length;
        const overdueTaskRegistrations = scopedRegistrations.filter((item) => item.hasOverdueTask).length;

        const now = dayjs();
        const closingSoonSemesters = semesters.filter((semester) => {
            if (!semester.registrationOpen || !semester.registrationDeadline) return false;
            const deadline = dayjs(semester.registrationDeadline);
            if (!deadline.isValid()) return false;
            const daysLeft = deadline.diff(now, 'day');
            return daysLeft >= 0 && daysLeft <= 7;
        });

        const registrationStillOpenButExpired = semesters.filter((semester) => {
            if (!semester.registrationOpen || !semester.registrationDeadline) return false;
            const deadline = dayjs(semester.registrationDeadline);
            return deadline.isValid() && deadline.isBefore(now);
        });

        return {
            pendingRegistrations,
            unassignedCouncil,
            overdueTaskRegistrations,
            closingSoonSemesters,
            registrationStillOpenButExpired,
        };
    }, [scopedRegistrations, semesters]);

    const handleReject = (record) => {
        Modal.confirm({
            title: 'Từ chối đề tài',
            icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
            content: `Bạn chắc chắn muốn từ chối đề tài "${record.title}"?`,
            okText: 'Từ chối',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    if (record.status === 'PENDING') {
                        await topicService.changeStatus(record.id, {
                            status: 'REJECTED',
                            rejectReason: 'Từ chối bởi quản trị viên qua màn hình giám sát',
                        });
                    } else {
                        await topicService.update(record.id, { status: 'REJECTED' });
                    }
                    message.success(`Đã từ chối đề tài ${record.code}`);
                    fetchData();
                } catch (error) {
                    message.error(error?.message || 'Không thể cập nhật trạng thái đề tài');
                }
            },
        });
    };

    const handleApprove = async (record) => {
        try {
            if (record.status === 'PENDING') {
                await topicService.changeStatus(record.id, { status: 'APPROVED' });
            } else {
                await topicService.update(record.id, { status: 'APPROVED' });
            }
            message.success(`Đã duyệt đề tài ${record.code}`);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Không thể duyệt đề tài');
        }
    };

    const openTransferModal = (record) => {
        setTransferTopic(record);
        setTransferLecturerId(record.mentorId || null);
        setIsTransferModalOpen(true);
    };

    const handleTransfer = async () => {
        if (!transferTopic || !transferLecturerId) {
            message.warning('Vui lòng chọn giảng viên hướng dẫn mới');
            return;
        }
        try {
            await topicService.update(transferTopic.id, { mentorId: transferLecturerId });
            message.success(`Đã điều chuyển đề tài ${transferTopic.code}`);
            setIsTransferModalOpen(false);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Không thể điều chuyển đề tài');
        }
    };

    const openProgressModal = (record) => {
        const registrationEvents = record.registrationEvents || [];
        const firstRegistrationId = registrationEvents[0]?.id || null;
        setProgressTopic(record);
        setProgressRegistrationId(firstRegistrationId);
        setProgressTasks([]);
        setIsProgressModalOpen(true);
    };

    const loadProgressTasks = async (registrationId) => {
        if (!registrationId) {
            setProgressTasks([]);
            return;
        }
        try {
            setProgressLoading(true);
            const res = await taskService.getTasksByRegistration(registrationId);
            setProgressTasks(res?.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải chi tiết tiến độ');
            setProgressTasks([]);
        } finally {
            setProgressLoading(false);
        }
    };

    useEffect(() => {
        if (!isProgressModalOpen) return;
        loadProgressTasks(progressRegistrationId);
    }, [isProgressModalOpen, progressRegistrationId]);

    const progressStats = useMemo(() => {
        const total = progressTasks.length;
        const submitted = progressTasks.filter((task) => task.status === 'SUBMITTED').length;
        const completed = progressTasks.filter((task) => task.status === 'COMPLETED').length;
        const overdue = progressTasks.filter((task) => {
            if (!task?.dueDate) return false;
            return new Date(task.dueDate).getTime() < Date.now() && !['COMPLETED', 'SUBMITTED'].includes(task.status);
        }).length;
        const progress = total ? Math.round(((submitted + completed) / (2 * total)) * 100) : 0;
        return { total, submitted, completed, overdue, progress };
    }, [progressTasks]);

    const progressTimelineItems = useMemo(() => {
        return progressTasks
            .flatMap((task) => {
                const submissions = task.submissions || [];
                const latest = submissions.length ? submissions[submissions.length - 1] : null;
                const base = [
                    {
                        color: 'blue',
                        time: task.createdAt || task.updatedAt,
                        children: (
                            <>
                                <Text className="text-xs text-slate-400">{dayjs(task.createdAt || task.updatedAt).format('DD/MM/YYYY HH:mm')}</Text>
                                <div className="text-sm font-medium text-slate-800">Giao nhiệm vụ: {task.title}</div>
                            </>
                        ),
                    },
                ];
                if (latest) {
                    base.push({
                        color: 'green',
                        time: latest.submittedAt || latest.createdAt,
                        children: (
                            <>
                                <Text className="text-xs text-slate-400">{dayjs(latest.submittedAt || latest.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                                <div className="text-sm font-medium text-emerald-700">Sinh viên nộp: {task.title}</div>
                            </>
                        ),
                    });
                }
                return base;
            })
            .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
            .map(({ children, color }) => ({ children, color }));
    }, [progressTasks]);

    // BM01 - BM04 Milestone helper
    const renderBmMilestones = (record) => {
        const reg = record.registrationEvents?.[0];
        if (!reg) {
            return <span className="text-xs text-slate-300 italic">Chưa có SV</span>;
        }

        // BM01: Đề cương
        let bm01Color = 'bg-slate-100 text-slate-400 border-slate-200';
        let bm01Tooltip = 'BM01: Chưa thẩm định đề cương';
        const isBypassed = reg.outlineFeedback?.includes('MIỄN THẨM ĐỊNH') || reg.outlineFeedback?.includes('BYPASS');
        if (reg.outlineReviewStatus === 'PASSED') {
            bm01Color = isBypassed ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300';
            bm01Tooltip = isBypassed ? `BM01: Đã miễn thẩm định đề cương (${reg.outlineFeedback})` : 'BM01: Đề cương ĐẠT thẩm định';
        } else if (reg.outlineReviewStatus === 'NEEDS_REVISION') {
            bm01Color = 'bg-amber-100 text-amber-800 border-amber-300';
            bm01Tooltip = 'BM01: Cần chỉnh sửa đề cương';
        } else if (reg.outlineReviewStatus === 'FAILED') {
            bm01Color = 'bg-rose-100 text-rose-800 border-rose-300';
            bm01Tooltip = 'BM01: Đề cương KHÔNG ĐẠT';
        } else if (reg.outlineReviewStatus === 'PENDING' || reg.outlineCouncilId) {
            bm01Color = 'bg-purple-100 text-purple-800 border-purple-300';
            bm01Tooltip = 'BM01: Đang trong hội đồng thẩm định';
        }

        // BM02: Giữa kỳ
        const hasPassedBm01 = reg.outlineReviewStatus === 'PASSED' || ['IN_PROGRESS', 'READY_FOR_DEFENSE', 'DEFENDED', 'COMPLETED'].includes(reg.status);
        const bm02Color = hasPassedBm01 ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-400 border-slate-200';
        const bm02Tooltip = hasPassedBm01 ? 'BM02: Đang thực hiện / Đã nộp tiến độ giữa kỳ' : 'BM02: Chưa đến mốc giữa kỳ';

        // BM03: Báo cáo cuối kỳ
        const isReadyForDefense = ['READY_FOR_DEFENSE', 'DEFENDED', 'COMPLETED'].includes(reg.status);
        const bm03Color = isReadyForDefense ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-400 border-slate-200';
        const bm03Tooltip = isReadyForDefense ? 'BM03: Đã hoàn tất báo cáo toàn văn' : 'BM03: Chưa hoàn thành báo cáo cuối kỳ';

        // BM04: Phiếu chấm bảo vệ
        const isDefended = ['DEFENDED', 'COMPLETED'].includes(reg.status) || Boolean(reg.defenseResult);
        const bm04Color = isDefended ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-400 border-slate-200';
        const bm04Tooltip = isDefended ? 'BM04: Đã có phiếu chấm bảo vệ khóa luận' : 'BM04: Chưa chấm bảo vệ';

        return (
            <div className="flex items-center gap-1">
                <Tooltip title={bm01Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm01Color} cursor-pointer`}>
                        BM01
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-300 font-bold">›</span>
                <Tooltip title={bm02Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm02Color} cursor-pointer`}>
                        BM02
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-300 font-bold">›</span>
                <Tooltip title={bm03Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm03Color} cursor-pointer`}>
                        BM03
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-300 font-bold">›</span>
                <Tooltip title={bm04Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm04Color} cursor-pointer`}>
                        BM04
                    </span>
                </Tooltip>
            </div>
        );
    };

    const columns = [
        {
            title: 'Mã & Đề tài',
            dataIndex: 'title',
            key: 'title',
            width: 380,
            render: (text, record) => {
                const isTopicBypassed = record.registrationEvents?.some((r) =>
                    r.outlineFeedback?.includes('MIỄN THẨM ĐỊNH') || r.outlineFeedback?.includes('BYPASS')
                );
                return (
                    <div className="space-y-1">
                        <Tooltip title={text}>
                            <div className="font-bold text-slate-900 leading-snug line-clamp-2 text-sm">{text}</div>
                        </Tooltip>
                        <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-[11px] font-mono bg-slate-100 text-primary font-bold px-1.5 py-0.5 rounded">
                                {record.code}
                            </code>
                            <span className="text-xs text-slate-500 font-medium">
                                {record.projectCatalog?.name || 'Đồ án'}
                            </span>
                            {isTopicBypassed && (
                                <Tag color="purple" className="text-[10px] leading-tight m-0 font-semibold">
                                    Miễn thẩm định
                                </Tag>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'GV hướng dẫn',
            key: 'lecturer',
            width: 200,
            render: (_, record) => {
                const initials = record.mentor?.fullName
                    ? record.mentor.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase()
                    : 'G';
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 leading-tight truncate">
                                {record.mentor?.fullName || 'Chưa gán'}
                            </div>
                            {record.mentor?.code && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                    {record.mentor.code}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Sinh viên thực hiện',
            dataIndex: 'students',
            key: 'students',
            width: 200,
            render: (students) =>
                students.length > 0 ? (
                    <div className="space-y-1">
                        {students.map((name, idx) => (
                            <div
                                key={`${name}-${idx}`}
                                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg w-fit"
                            >
                                {name}
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-slate-400 italic">Chưa có SV đăng ký</span>
                ),
        },
        {
            title: 'Tiến trình Biểu mẫu (BM)',
            key: 'milestones',
            width: 230,
            render: (_, record) => renderBmMilestones(record),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Đợt đồ án',
            key: 'semester',
            width: 170,
            render: (_, record) => (
                <span className="text-xs text-slate-600 font-medium">
                    {record.semester ? formatSemesterLabel(record.semester) : '—'}
                </span>
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 130,
            align: 'right',
            render: (_, record) => {
                const menuItems = [];

                if (record.status === 'PENDING') {
                    menuItems.push({
                        key: 'APPROVE',
                        icon: <CheckCircleOutlined className="text-emerald-600" />,
                        label: 'Duyệt đề tài',
                    });
                }

                if (record.status !== 'REJECTED') {
                    menuItems.push({
                        key: 'REJECT',
                        danger: true,
                        icon: <StopOutlined />,
                        label: 'Từ chối đề tài',
                    });
                }

                if (record.status === 'REJECTED') {
                    menuItems.push({
                        key: 'ACTIVATE',
                        icon: <CheckCircleOutlined className="text-emerald-600" />,
                        label: 'Mở lại đề tài',
                    });
                }

                menuItems.push({
                    key: 'TRANSFER',
                    icon: <SwapOutlined className="text-amber-500" />,
                    label: 'Đổi GV hướng dẫn',
                });

                const activeReg = (record.registrationEvents || []).find(
                    (r) => !['REJECTED', 'DROPPED', 'WITHDRAWN', 'COMPLETED'].includes(r.status)
                );
                if (activeReg && activeReg.outlineReviewStatus !== 'PASSED') {
                    menuItems.push({
                        key: 'BYPASS_OUTLINE',
                        icon: <ThunderboltOutlined className="text-amber-500" />,
                        label: 'Miễn thẩm định đề cương (Bypass)',
                    });
                }

                menuItems.push({ type: 'divider' });
                menuItems.push({
                    key: 'PROGRESS',
                    icon: <FileDoneOutlined className="text-purple-600" />,
                    label: 'Xem chi tiết tiến độ',
                });
                menuItems.push({
                    key: 'AUDIT',
                    icon: <HistoryOutlined className="text-blue-600" />,
                    label: 'Lịch sử thay đổi',
                });

                const onAction = ({ key }) => {
                    if (key === 'REJECT') handleReject(record);
                    if (key === 'APPROVE' || key === 'ACTIVATE') handleApprove(record);
                    if (key === 'TRANSFER') openTransferModal(record);
                    if (key === 'BYPASS_OUTLINE' && activeReg) {
                        setBypassTarget({ registration: activeReg, topic: record });
                        setBypassReason('Được miễn thẩm định theo quyết định của Viện / Khoa (Đề tài NCKH nghiệm thu)');
                        setIsBypassModalOpen(true);
                    }
                    if (key === 'PROGRESS') openProgressModal(record);
                    if (key === 'AUDIT') {
                        setAuditTopic(record);
                        setIsAuditModalOpen(true);
                    }
                };

                return (
                    <Dropdown menu={{ items: menuItems, onClick: onAction }} trigger={['click']} placement="bottomRight">
                        <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-primary">
                            Thao tác <MoreOutlined />
                        </Button>
                    </Dropdown>
                );
            },
        },
    ];

    const filteredArchives = useMemo(() => {
        return archivesList.filter((item) => {
            const keyword = archiveSearchText.trim().toLowerCase();
            if (!keyword) return true;
            const topicTitle = item.registration?.topic?.title?.toLowerCase() || '';
            const topicCode = `dt-${String(item.registration?.topic?.id || '').padStart(3, '0')}`;
            const studentName = item.registration?.student?.fullName?.toLowerCase() || '';
            const studentCode = item.registration?.student?.code?.toLowerCase() || '';
            const mentorName = item.registration?.topic?.mentor?.fullName?.toLowerCase() || '';
            return (
                topicTitle.includes(keyword) ||
                topicCode.includes(keyword) ||
                studentName.includes(keyword) ||
                studentCode.includes(keyword) ||
                mentorName.includes(keyword)
            );
        });
    }, [archivesList, archiveSearchText]);

    const archiveColumns = useMemo(
        () => [
            {
                title: 'Mã & Tên đề tài',
                key: 'topic',
                width: 280,
                render: (_, record) => {
                    const reg = record.registration;
                    const topic = reg?.topic;
                    const code = topic?.id ? `DT-${String(topic.id).padStart(3, '0')}` : '—';
                    return (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                                <Tag color="blue" className="font-mono text-xs">{code}</Tag>
                                {topic?.projectCatalog?.name && (
                                    <Tag className="text-[11px] text-slate-600">{topic.projectCatalog.name}</Tag>
                                )}
                            </div>
                            <div className="font-semibold text-slate-800 text-sm line-clamp-2" title={topic?.title}>
                                {topic?.title || 'Chưa cập nhật'}
                            </div>
                        </div>
                    );
                },
            },
            {
                title: 'Sinh viên thực hiện',
                key: 'student',
                width: 180,
                render: (_, record) => {
                    const student = record.registration?.student;
                    return (
                        <div>
                            <div className="font-medium text-slate-800 text-sm">{student?.fullName || '—'}</div>
                            <div className="text-xs text-slate-500 font-mono">{student?.code || '—'}</div>
                            <div className="text-[11px] text-slate-400">{student?.department || ''}</div>
                        </div>
                    );
                },
            },
            {
                title: 'GVHD',
                key: 'mentor',
                width: 170,
                render: (_, record) => {
                    const mentor = record.registration?.topic?.mentor;
                    return (
                        <div>
                            <div className="font-medium text-slate-700 text-sm">
                                {mentor?.academicTitle ? `${mentor.academicTitle} ` : ''}{mentor?.fullName || '—'}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{mentor?.code || ''}</div>
                        </div>
                    );
                },
            },
            {
                title: 'Điểm bảo vệ',
                key: 'score',
                width: 110,
                align: 'center',
                render: (_, record) => {
                    const score = record.registration?.defenseResult?.finalScore;
                    return score !== null && score !== undefined ? (
                        <Tag color="purple" className="font-bold text-xs px-2 py-0.5">
                            {Number(score).toFixed(1)} / 10
                        </Tag>
                    ) : (
                        <span className="text-slate-400 text-xs">Chưa có</span>
                    );
                },
            },
            {
                title: 'Hồ sơ tài liệu lưu trữ',
                key: 'files',
                width: 250,
                render: (_, record) => (
                    <div className="flex flex-wrap gap-1.5">
                        {record.reportFileUrl && (
                            <Tooltip title={`Báo cáo toàn văn: ${record.reportFileName || 'Tệp báo cáo'}`}>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<FilePdfOutlined className="text-rose-500" />}
                                    href={record.reportFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1"
                                >
                                    Báo cáo
                                </Button>
                            </Tooltip>
                        )}
                        {record.slideFileUrl && (
                            <Tooltip title={`Slide báo cáo: ${record.slideFileName || 'Tệp trình chiếu'}`}>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<FilePptOutlined className="text-amber-500" />}
                                    href={record.slideFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1"
                                >
                                    Slide
                                </Button>
                            </Tooltip>
                        )}
                        {record.demoVideoUrl && (
                            <Tooltip title={`Video demo: ${record.demoVideoUrl}`}>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<YoutubeOutlined className="text-red-600" />}
                                    href={record.demoVideoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1"
                                >
                                    Demo
                                </Button>
                            </Tooltip>
                        )}
                        {record.sourceCodeUrl && (
                            <Tooltip title={`Mã nguồn: ${record.sourceCodeUrl}`}>
                                <Button
                                    size="small"
                                    type="dashed"
                                    icon={<GithubOutlined className="text-slate-800" />}
                                    href={record.sourceCodeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1"
                                >
                                    Repo
                                </Button>
                            </Tooltip>
                        )}
                        {!record.reportFileUrl && !record.slideFileUrl && !record.demoVideoUrl && !record.sourceCodeUrl && (
                            <span className="text-xs text-slate-400 italic">Chưa đính kèm tài liệu</span>
                        )}
                    </div>
                ),
            },
            {
                title: 'Nghiệm thu',
                dataIndex: 'status',
                key: 'status',
                width: 140,
                render: (status) => {
                    if (status === 'APPROVED') {
                        return <Tag color="success" icon={<CheckCircleOutlined />}>Đã nghiệm thu</Tag>;
                    }
                    if (status === 'REVISION_REQUIRED') {
                        return <Tag color="error" icon={<ExclamationCircleOutlined />}>Cần sửa đổi</Tag>;
                    }
                    return <Tag color="processing" icon={<ClockCircleOutlined />}>Chờ duyệt</Tag>;
                },
            },
            {
                title: 'Thao tác',
                key: 'actions',
                width: 160,
                align: 'right',
                render: (_, record) => {
                    const isApproved = record.status === 'APPROVED';
                    return (
                        <Space size="small">
                            {!isApproved && (
                                <Popconfirm
                                    title="Xác nhận nghiệm thu"
                                    description="Hồ sơ sẽ được duyệt và chuyển đề tài sang hoàn tất (COMPLETED). Bạn chắc chắn chứ?"
                                    onConfirm={() => handleQuickApproveArchive(record.registrationId)}
                                    okText="Nghiệm thu"
                                    cancelText="Hủy"
                                >
                                    <Button size="small" type="primary" className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold">
                                        Nghiệm thu
                                    </Button>
                                </Popconfirm>
                            )}
                            {isApproved && (
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold"
                                    onClick={() => handleOpenCertificate(record.registrationId)}
                                >
                                    Giấy CN
                                </Button>
                            )}
                        </Space>
                    );
                },
            },
        ],
        []
    );

    const lecturerOptions = lecturers.map((lecturer) => ({
        value: lecturer.id,
        label: `${lecturer.fullName} (${lecturer.code})`,
    }));

    const semesterOptions = currentSemesters.map((semester) => ({
        value: semester.id,
        label: formatSemesterLabel(semester),
    }));

    const projectNameOptions = Array.from(new Set(tableData.map((item) => item.projectCatalog?.name).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map((name) => ({
            value: name,
            label: name,
        }));

    const auditItems = useMemo(() => {
        if (!auditTopic) return [];

        const items = [
            {
                color: 'gray',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(auditTopic.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-semibold text-slate-800">Khởi tạo đề tài</p>
                    </>
                ),
            },
            {
                color: 'blue',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(auditTopic.updatedAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-semibold text-slate-800">Cập nhật trạng thái: {auditTopic.status}</p>
                    </>
                ),
            },
        ];

        (auditTopic.registrationEvents || []).slice(0, 3).forEach((event) => {
            items.push({
                color: 'green',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(event.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-medium text-emerald-700">
                            {event.student?.fullName || 'Sinh viên'} đăng ký ({event.status})
                        </p>
                    </>
                ),
            });
        });

        return items;
    }, [auditTopic]);

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Đào tạo & Đề tài' },
                    { label: 'Giám sát tiến độ & BM' },
                ]}
                title="Giám sát Đề tài & Biểu mẫu"
                subtitle="Theo dõi vòng đời đề tài, tiến độ nộp biểu mẫu BM01-BM04 của sinh viên và điều phối xử lý ngoại lệ đào tạo."
                tags={[{ label: 'Giám sát toàn diện', color: 'blue' }]}
                actions={
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>
                        Làm mới
                    </Button>
                }
            />

            {/* Health Radar Cảnh Báo Sớm Widget */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                                Health Radar • Hệ Thống Cảnh Báo Sớm Toàn Khóa
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-0.5">
                            Giám Sát Rủi Ro Tiến Độ &amp; Hồ Sơ Lưu Chiểu Sau Bảo Vệ
                        </h3>
                        <p className="text-xs text-slate-300 max-w-xl">
                            Tự động quét và cảnh báo sinh viên gián đoạn gặp GVHD (&gt;21 ngày không có nhật ký BM03) hoặc chậm nộp lưu chiểu (&gt;14 ngày sau bảo vệ).
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-rose-400 text-2xl font-black">
                                {healthRadarStats?.overdueArchiveCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-rose-200">Chậm nộp lưu chiểu</div>
                                <div className="text-[11px] text-slate-400">&gt; 14 ngày sau bảo vệ</div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-amber-400 text-2xl font-black">
                                {healthRadarStats?.atRiskInactiveCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-amber-200">Gián đoạn GVHD</div>
                                <div className="text-[11px] text-slate-400">&gt; 21 ngày không có BM03</div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-sky-400 text-2xl font-black">
                                {healthRadarStats?.pendingArchiveReviewCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-sky-200">Chờ nghiệm thu</div>
                                <div className="text-[11px] text-slate-400">Hồ sơ đã nộp</div>
                            </div>
                        </div>

                        {((healthRadarStats?.overdueArchiveCount || 0) > 0 || (healthRadarStats?.atRiskInactiveCount || 0) > 0) && (
                            <Button
                                type="primary"
                                danger
                                size="small"
                                icon={<WarningOutlined />}
                                className="font-semibold rounded-lg shadow-xs"
                                onClick={() => setIsHealthModalOpen(true)}
                            >
                                Chi tiết rủi ro
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Tabs
                activeKey={activeMainTab}
                onChange={setActiveMainTab}
                type="card"
                className="oversight-tabs"
                items={[
                    {
                        key: 'TOPIC_OVERSIGHT',
                        label: (
                            <span className="flex items-center gap-2 font-semibold text-sm">
                                <FileDoneOutlined />
                                Giám Sát Đề Tài &amp; Biểu Mẫu ({tableData.length})
                            </span>
                        ),
                        children: (
                            <div className="space-y-5 pt-2">
                                {/* 4 StatCards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <StatCard
                                        icon="pending_actions"
                                        iconBg="bg-amber-50"
                                        iconColor="text-amber-600"
                                        label="Đăng ký chờ duyệt"
                                        value={warningStats.pendingRegistrations}
                                    />
                                    <StatCard
                                        icon="group_off"
                                        iconBg="bg-orange-50"
                                        iconColor="text-orange-600"
                                        label="Chưa phân hội đồng"
                                        value={warningStats.unassignedCouncil}
                                    />
                                    <StatCard
                                        icon="assignment_late"
                                        iconBg="bg-rose-50"
                                        iconColor="text-rose-600"
                                        label="SV có nhiệm vụ quá hạn"
                                        value={warningStats.overdueTaskRegistrations}
                                    />
                                    <StatCard
                                        icon="event_upcoming"
                                        iconBg="bg-blue-50"
                                        iconColor="text-blue-600"
                                        label="Kỳ sắp đóng đăng ký"
                                        value={warningStats.closingSoonSemesters.length}
                                    />
                                </div>

                                {/* Alerts if any warnings exist */}
                                {(warningStats.pendingRegistrations > 0 ||
                                    warningStats.unassignedCouncil > 0 ||
                                    warningStats.overdueTaskRegistrations > 0 ||
                                    warningStats.closingSoonSemesters.length > 0) && (
                                    <div className="space-y-2.5">
                                        {warningStats.pendingRegistrations > 0 && (
                                            <Alert
                                                showIcon
                                                type="warning"
                                                message={`Có ${warningStats.pendingRegistrations} hồ sơ đăng ký đang chờ xét duyệt`}
                                                description="Vui lòng xử lý phê duyệt sớm để sinh viên và GVHD có thể triển khai nộp đề cương BM01 kịp tiến độ."
                                                className="rounded-xl border border-amber-200"
                                            />
                                        )}
                                        {warningStats.unassignedCouncil > 0 && (
                                            <Alert
                                                showIcon
                                                type="warning"
                                                message={`Có ${warningStats.unassignedCouncil} sinh viên đủ điều kiện nhưng chưa được phân công hội đồng`}
                                                description="Vui lòng chuyển sang mục Phân công Hội đồng để gán nhóm bảo vệ hoặc hội đồng thẩm định."
                                                className="rounded-xl border border-amber-200"
                                            />
                                        )}
                                        {warningStats.overdueTaskRegistrations > 0 && (
                                            <Alert
                                                showIcon
                                                type="error"
                                                message={`Phát hiện ${warningStats.overdueTaskRegistrations} sinh viên có nhiệm vụ tiến độ quá hạn`}
                                                description="Khuyến nghị nhắc nhở GVHD phối hợp kiểm tra nguyên nhân trễ hạn nộp sản phẩm / biểu mẫu."
                                                className="rounded-xl border border-rose-200"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Filter Toolbar Card */}
                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                                        <div className="lg:col-span-4">
                                            <Input
                                                placeholder="Tìm mã, tên đề tài, giảng viên..."
                                                prefix={<SearchOutlined className="text-slate-400" />}
                                                className="w-full"
                                                value={searchText}
                                                onChange={(event) => setSearchText(event.target.value)}
                                                allowClear
                                            />
                                        </div>
                                        <div className="lg:col-span-3">
                                            <Select
                                                placeholder="Trạng thái đề tài"
                                                className="w-full"
                                                allowClear
                                                value={statusFilter}
                                                onChange={(value) => setStatusFilter(value || null)}
                                                options={['APPROVED', 'PENDING', 'REJECTED', 'DRAFT'].map((key) => ({
                                                    label: STATUS_MAP[key]?.label || key,
                                                    value: key,
                                                }))}
                                            />
                                        </div>
                                        <div className="lg:col-span-3">
                                            <Select
                                                placeholder="Đợt đồ án (Học kỳ)"
                                                className="w-full"
                                                allowClear
                                                value={semesterFilter}
                                                onChange={(value) => setSemesterFilter(value || null)}
                                                options={semesterOptions}
                                            />
                                        </div>
                                        <div className="lg:col-span-2">
                                            <Select
                                                placeholder="Tên loại đồ án"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                optionFilterProp="label"
                                                value={projectNameFilter}
                                                onChange={(value) => setProjectNameFilter(value || null)}
                                                options={projectNameOptions}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                        <div>
                                            Hiển thị: <b className="text-slate-800">{filteredTopics.length}</b> / {tableData.length} đề tài
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Đã hoàn tất
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Chờ xử lý / Cần sửa
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-slate-300"></span> Chưa đến hạn
                                            </span>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                        <Table
                                            loading={loading}
                                            dataSource={filteredTopics}
                                            rowKey="id"
                                            columns={columns}
                                            scroll={{ x: 1280 }}
                                            pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `Tổng số ${t} đề tài` }}
                                            size="middle"
                                        />
                                    </div>
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'ARCHIVE_REPOSITORY',
                        label: (
                            <span className="flex items-center gap-2 font-semibold text-sm">
                                <SafetyCertificateOutlined />
                                Kho Hồ Sơ Lưu Chiểu Toàn Khóa ({archivesList.length})
                            </span>
                        ),
                        children: (
                            <div className="space-y-5 pt-2">
                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                                        <div className="lg:col-span-5">
                                            <Input
                                                placeholder="Tìm theo tên đề tài, mã, sinh viên, GVHD..."
                                                prefix={<SearchOutlined className="text-slate-400" />}
                                                className="w-full"
                                                value={archiveSearchText}
                                                onChange={(e) => setArchiveSearchText(e.target.value)}
                                                allowClear
                                            />
                                        </div>
                                        <div className="lg:col-span-4">
                                            <Select
                                                placeholder="Trạng thái nghiệm thu"
                                                className="w-full"
                                                value={archiveStatusFilter}
                                                onChange={setArchiveStatusFilter}
                                                options={[
                                                    { value: 'ALL', label: 'Tất cả trạng thái nghiệm thu' },
                                                    { value: 'SUBMITTED', label: 'Chờ nghiệm thu (SUBMITTED)' },
                                                    { value: 'APPROVED', label: 'Đã nghiệm thu (APPROVED)' },
                                                    { value: 'REVISION_REQUIRED', label: 'Cần chỉnh sửa (REVISION_REQUIRED)' },
                                                ]}
                                            />
                                        </div>
                                        <div className="lg:col-span-3">
                                            <Select
                                                placeholder="Đợt đồ án (Học kỳ)"
                                                className="w-full"
                                                allowClear
                                                value={semesterFilter}
                                                onChange={(value) => setSemesterFilter(value || null)}
                                                options={semesterOptions}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                        <div>
                                            Hiển thị: <b className="text-slate-800">{filteredArchives.length}</b> / {archivesList.length} hồ sơ lưu chiểu
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Đã nghiệm thu
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-sky-500"></span> Chờ duyệt
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Cần chỉnh sửa
                                            </span>
                                        </div>
                                    </div>

                                    {/* Archive Table */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                        <Table
                                            loading={archivesLoading}
                                            dataSource={filteredArchives}
                                            rowKey="id"
                                            columns={archiveColumns}
                                            scroll={{ x: 1200 }}
                                            pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} hồ sơ lưu chiểu` }}
                                            size="middle"
                                        />
                                    </div>
                                </div>
                            </div>
                        ),
                    },
                ]}
            />

            {/* Transfer Lecturer Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SwapOutlined className="text-amber-500" />
                        Điều chuyển Giảng viên Hướng dẫn
                    </div>
                }
                open={isTransferModalOpen}
                onCancel={() => setIsTransferModalOpen(false)}
                onOk={handleTransfer}
                okText="Lưu điều chuyển"
                cancelText="Hủy"
                width={560}
                centered
            >
                {transferTopic && (
                    <div className="space-y-4 pt-2">
                        <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1">
                            <div className="font-bold text-amber-900 text-sm">{transferTopic.title}</div>
                            <div className="text-amber-800">
                                <b>Mã đề tài:</b> {transferTopic.code}
                            </div>
                            <div className="text-amber-800">
                                <b>GVHD đương nhiệm:</b> {transferTopic.mentor?.fullName || 'Chưa phân công'}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                Chọn Giảng viên hướng dẫn mới tiếp nhận đề tài: <span className="text-rose-500">*</span>
                            </label>
                            <Select
                                showSearch
                                placeholder="Tìm theo tên hoặc mã giảng viên..."
                                className="w-full"
                                value={transferLecturerId}
                                onChange={setTransferLecturerId}
                                options={lecturerOptions}
                                optionFilterProp="label"
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Audit History Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <HistoryOutlined className="text-primary" />
                        Lịch sử Thay đổi Đề tài: {auditTopic?.code || ''}
                    </div>
                }
                open={isAuditModalOpen}
                onCancel={() => setIsAuditModalOpen(false)}
                footer={null}
                width={540}
                centered
            >
                <div className="pt-3">
                    <Timeline items={auditItems} />
                </div>
            </Modal>

            {/* Detailed Progress Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <FileDoneOutlined className="text-purple-600" />
                        Chi tiết Tiến độ Sinh viên: {progressTopic?.code || ''}
                    </div>
                }
                open={isProgressModalOpen}
                onCancel={() => setIsProgressModalOpen(false)}
                footer={null}
                width={920}
                centered
            >
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Tên đề tài</div>
                            <div className="font-bold text-slate-900 text-sm leading-snug">{progressTopic?.title || 'N/A'}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Sinh viên thực hiện</div>
                            <div className="font-bold text-slate-900 text-sm">
                                {progressTopic?.registrationEvents?.[0]?.student?.fullName || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                                {progressTopic?.registrationEvents?.[0]?.student?.code || 'N/A'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Tag className="text-xs font-semibold py-0.5">Tổng task: {progressStats.total}</Tag>
                        <Tag color="blue" className="text-xs font-semibold py-0.5">Đã nộp: {progressStats.submitted}</Tag>
                        <Tag color="success" className="text-xs font-semibold py-0.5">Hoàn thành: {progressStats.completed}</Tag>
                        <Tag color={progressStats.overdue > 0 ? 'error' : 'default'} className="text-xs font-semibold py-0.5">
                            Quá hạn: {progressStats.overdue}
                        </Tag>
                        <Tag color="processing" className="text-xs font-semibold py-0.5">Tiến độ: {progressStats.progress}%</Tag>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2 border-slate-200 rounded-xl" size="small" title="Danh sách nhiệm vụ">
                            <Spin spinning={progressLoading}>
                                {!progressTasks.length ? (
                                    <Empty description="Chưa có nhiệm vụ nào được giao" />
                                ) : (
                                    <List
                                        dataSource={progressTasks}
                                        renderItem={(task) => {
                                            const submissions = task.submissions || [];
                                            const latest = submissions.length ? submissions[submissions.length - 1] : null;
                                            return (
                                                <List.Item>
                                                    <div className="w-full space-y-1">
                                                        <div className="font-semibold text-slate-900">{task.title}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                                            <ClockCircleOutlined />
                                                            Hạn nộp: {task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY HH:mm') : 'Không có hạn'}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Tag color={task.status === 'COMPLETED' ? 'green' : 'default'}>
                                                                {task.status}
                                                            </Tag>
                                                            {latest && (
                                                                <Tag color="blue">File: {latest.fileName || 'Bài nộp'}</Tag>
                                                            )}
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            );
                                        }}
                                    />
                                )}
                            </Spin>
                        </Card>
                        <Card size="small" className="border-slate-200 rounded-xl" title="Lịch sử tương tác">
                            {progressTimelineItems.length ? (
                                <Timeline items={progressTimelineItems} />
                            ) : (
                                <Empty description="Chưa có lịch sử" />
                            )}
                        </Card>
                    </div>
                </div>
            </Modal>

            {/* Health Radar Detail Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-rose-600">
                        <WarningOutlined />
                        Chi Tiết Cảnh Báo Sớm Toàn Khóa (Health Radar)
                    </div>
                }
                open={isHealthModalOpen}
                onCancel={() => setIsHealthModalOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setIsHealthModalOpen(false)}>
                        Đóng
                    </Button>,
                ]}
                width={840}
                centered
            >
                <div className="pt-2">
                    <Tabs
                        defaultActiveKey="OVERDUE_ARCHIVE"
                        items={[
                            {
                                key: 'OVERDUE_ARCHIVE',
                                label: (
                                    <span className="font-semibold text-rose-600">
                                        Chậm Nộp Lưu Chiểu ({healthRadarStats?.overdueArchiveCount ?? 0})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        dataSource={healthRadarStats?.overdueArchiveStudents || []}
                                        rowKey="registrationId"
                                        size="small"
                                        pagination={{ pageSize: 5 }}
                                        columns={[
                                            {
                                                title: 'Sinh viên',
                                                key: 'student',
                                                render: (_, r) => (
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{r.studentName}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{r.studentCode}</div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                title: 'Tên đề tài',
                                                dataIndex: 'topicTitle',
                                                key: 'topicTitle',
                                                render: (t) => <span className="font-medium text-slate-700">{t}</span>,
                                            },
                                            {
                                                title: 'GVHD',
                                                dataIndex: 'mentorName',
                                                key: 'mentorName',
                                                render: (m) => <span className="text-slate-600 text-xs">{m || '—'}</span>,
                                            },
                                            {
                                                title: 'Trạng thái',
                                                dataIndex: 'archiveStatus',
                                                key: 'archiveStatus',
                                                render: (st) => (
                                                    <Tag color={st === 'REVISION_REQUIRED' ? 'error' : 'warning'}>
                                                        {st === 'REVISION_REQUIRED' ? 'Cần sửa đổi' : 'Chưa nộp lưu chiểu'}
                                                    </Tag>
                                                ),
                                            },
                                        ]}
                                    />
                                ),
                            },
                            {
                                key: 'INACTIVE_BM03',
                                label: (
                                    <span className="font-semibold text-amber-600">
                                        Gián Đoạn Gặp GVHD ({healthRadarStats?.atRiskInactiveCount ?? 0})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        dataSource={healthRadarStats?.atRiskInactiveStudents || []}
                                        rowKey="registrationId"
                                        size="small"
                                        pagination={{ pageSize: 5 }}
                                        columns={[
                                            {
                                                title: 'Sinh viên',
                                                key: 'student',
                                                render: (_, r) => (
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{r.studentName}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{r.studentCode}</div>
                                                    </div>
                                                ),
                                            },
                                            {
                                                title: 'Tên đề tài',
                                                dataIndex: 'topicTitle',
                                                key: 'topicTitle',
                                                render: (t) => <span className="font-medium text-slate-700">{t}</span>,
                                            },
                                            {
                                                title: 'GVHD',
                                                dataIndex: 'mentorName',
                                                key: 'mentorName',
                                                render: (m) => <span className="text-slate-600 text-xs">{m || '—'}</span>,
                                            },
                                            {
                                                title: 'Lần gặp gần nhất (BM03)',
                                                dataIndex: 'lastMeetingDate',
                                                key: 'lastMeetingDate',
                                                render: (d) => (
                                                    <span className="text-xs text-rose-600 font-medium">
                                                        {d ? dayjs(d).format('DD/MM/YYYY') : 'Chưa từng ghi nhận'}
                                                    </span>
                                                ),
                                            },
                                        ]}
                                    />
                                ),
                            },
                        ]}
                    />
                </div>
            </Modal>

            {/* Clearance Certificate Modal */}
            <ClearanceCertificateModal
                open={certModalOpen}
                onCancel={() => setCertModalOpen(false)}
                certificateData={certificateData}
            />

            {/* Modal Miễn Thẩm Định Đề Cương (Bypass BM01-BM02) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                        <ThunderboltOutlined className="text-amber-500 text-lg" />
                        <span>Xác nhận Miễn Thẩm Định Đề Cương (Bypass BM01-BM02)</span>
                    </div>
                }
                open={isBypassModalOpen}
                onOk={handleConfirmBypass}
                confirmLoading={bypassLoading}
                okText="Xác nhận Miễn Thẩm Định"
                cancelText="Đóng"
                okButtonProps={{ className: 'bg-amber-600 hover:bg-amber-500 font-semibold' }}
                onCancel={() => {
                    setIsBypassModalOpen(false);
                    setBypassTarget(null);
                }}
            >
                <div className="space-y-4 py-2">
                    <Alert
                        type="info"
                        showIcon
                        message="Đặc quyền Quản trị viện / Viện Trưởng"
                        description="Hệ thống sẽ bỏ qua bước nộp và thẩm định BM01-BM02, chuyển thẳng đề tài sang trạng thái Đang thực hiện (IN_PROGRESS) và tự động khởi tạo các mốc BM03 Checkpoint."
                    />
                    {bypassTarget && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                            <div>
                                <span className="font-semibold text-slate-500">Tên đề tài:</span>{' '}
                                <span className="font-bold text-slate-800">{bypassTarget.topic?.title}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-slate-500">Sinh viên:</span>{' '}
                                <span className="font-medium text-slate-700">
                                    {bypassTarget.registration?.student?.fullName || 'N/A'} (
                                    {bypassTarget.registration?.student?.code || 'N/A'})
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold text-slate-500">GV hướng dẫn:</span>{' '}
                                <span className="font-medium text-slate-700">
                                    {bypassTarget.topic?.mentor?.fullName || 'N/A'}
                                </span>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Lý do miễn thẩm định đề cương (*):
                        </label>
                        <Input.TextArea
                            rows={3}
                            value={bypassReason}
                            onChange={(e) => setBypassReason(e.target.value)}
                            placeholder="Nhập lý do miễn thẩm định đề cương..."
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default ProjectOversightPage;
