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
    CloseCircleOutlined,
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
    WarningOutlined,
    YoutubeOutlined,
    ScanOutlined,
    FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import taskService from '../../services/taskService';
import archiveService from '../../services/archiveService';
import aiService from '../../services/aiService';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';
import manualReviewService from '../../services/manualReviewService';
import useAuthStore from '../../stores/authStore';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
import ManualReviewModal from '../../components/admin/ManualReviewModal';
import ArchivalCrossCheckModal from '../../components/admin/ArchivalCrossCheckModal';
import CheckpointAppealReviewModal from '../../components/admin/CheckpointAppealReviewModal';
import evaluationService from '../../services/evaluationService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { STATUS_MAP } from '../../components/common/statusMap';
import { queryKeys } from '../../query/queryKeys';
import { useTopics } from '../../queries/topicQueries';
import { useSemesters } from '../../queries/semesterQueries';
import { useUsers } from '../../queries/userQueries';
import { usePeriodRegistrations } from '../../queries/periodQueries';
import {
    useHealthRadarStats,
    useArchives,
    useArchiveMutation,
} from '../../queries/oversightQueries';
import {
    useManualReviewCases,
    useCheckpointAppeals,
    useBm03StopReviews,
    useBm04DefenseReviews,
    useManualReviewMutation,
} from '../../queries/manualReviewQueries';
import { useRegistrationTasks } from '../../queries/taskQueries';
import QueryPanel from '../../components/common/QueryPanel';
import QueryErrorState from '../../components/common/QueryErrorState';
import ContentSkeleton from '../../components/common/ContentSkeleton';

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
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const canReviewArchive = (user?.permissions || []).includes('FINAL_DOCUMENT_REVIEW');

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [semesterFilter, setSemesterFilter] = useState(null);
    const [projectNameFilter, setProjectNameFilter] = useState(null);

    // Queries: Overview
    const topicsQuery = useTopics(scope);
    const registrationsQuery = usePeriodRegistrations(scope, { limit: 5000 });
    const lecturersQuery = useUsers(scope, { role: 'LECTURER', status: 'active', limit: 1000 });
    const semestersQuery = useSemesters(scope);

    const topics = topicsQuery.data || [];
    const registrations = registrationsQuery.data || [];
    const lecturers = lecturersQuery.data?.data?.users || lecturersQuery.data?.data || lecturersQuery.data || [];
    const semesters = semestersQuery.data || [];
    const loading = topicsQuery.isPending || registrationsQuery.isPending || semestersQuery.isPending;

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTopic, setAuditTopic] = useState(null);
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
    const [selectedRegForDossier, setSelectedRegForDossier] = useState(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTopic, setTransferTopic] = useState(null);
    const [transferLecturerId, setTransferLecturerId] = useState(null);

    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [progressTopic, setProgressTopic] = useState(null);
    const [progressRegistrationId, setProgressRegistrationId] = useState(null);
    const progressTasksQuery = useRegistrationTasks(scope, progressRegistrationId, Boolean(isProgressModalOpen && progressRegistrationId));
    const progressTasks = progressTasksQuery.data || [];
    const progressLoading = progressTasksQuery.isPending && progressTasksQuery.fetchStatus !== 'idle';

    // Gói 2: Archive & Health Radar queries
    const [activeMainTab, setActiveMainTab] = useState('TOPIC_OVERSIGHT');
    const [archiveStatusFilter, setArchiveStatusFilter] = useState('ALL');
    const [archiveSearchText, setArchiveSearchText] = useState('');
    const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certificateData, setCertificateData] = useState(null);
    const [certLoading, setCertLoading] = useState(false);

    const healthRadarQuery = useHealthRadarStats(scope, semesterFilter, canReviewArchive);
    const archivesQuery = useArchives(scope, {
        semesterId: semesterFilter || undefined,
        status: archiveStatusFilter !== 'ALL' ? archiveStatusFilter : undefined,
        limit: 100,
    }, canReviewArchive);
    const archiveMutation = useArchiveMutation(scope);

    const healthRadarStats = healthRadarQuery.data || null;
    const archivesList = archivesQuery.data?.items || (Array.isArray(archivesQuery.data) ? archivesQuery.data : []);
    const archivesLoading = archivesQuery.isPending;

    // AI Archival Cross-Check state
    const [crossCheckModalOpen, setCrossCheckModalOpen] = useState(false);
    const [crossCheckLoading, setCrossCheckLoading] = useState(false);
    const [crossCheckData, setCrossCheckData] = useState(null);

    const handleOpenCrossCheck = async (regId) => {
        if (!regId) {
            message.warning('Không tìm thấy thông tin đăng ký để đối soát.');
            return;
        }
        setCrossCheckModalOpen(true);
        setCrossCheckLoading(true);
        try {
            const res = await aiService.crossCheckArchive(regId);
            if (res.success) {
                setCrossCheckData(res.data);
            } else {
                message.error(res.message || 'Không thể đối soát hồ sơ lưu chiểu');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gọi AI đối soát hồ sơ lưu chiểu');
        } finally {
            setCrossCheckLoading(false);
        }
    };

    // Gói 3: Manual Review & Appeals queries
    const [manualReviewStatusFilter, setManualReviewStatusFilter] = useState('OPEN');
    const [selectedCaseForReview, setSelectedCaseForReview] = useState(null);
    const [isManualReviewModalOpen, setIsManualReviewModalOpen] = useState(false);
    const [appealStatusFilter, setAppealStatusFilter] = useState('ALL');
    const [isAppealReviewModalOpen, setIsAppealReviewModalOpen] = useState(false);
    const [selectedAppealForReview, setSelectedAppealForReview] = useState(null);

    const manualReviewQuery = useManualReviewCases(scope, {
        status: manualReviewStatusFilter !== 'ALL' ? manualReviewStatusFilter : undefined,
        semesterId: semesterFilter || undefined,
        limit: 100,
    });
    const appealsQuery = useCheckpointAppeals(scope, {
        status: appealStatusFilter !== 'ALL' ? appealStatusFilter : undefined,
        semesterId: semesterFilter || undefined,
    });
    const bm03StopQuery = useBm03StopReviews(scope);
    const bm04DefenseQuery = useBm04DefenseReviews(scope);
    const manualReviewMutation = useManualReviewMutation(scope);

    const manualReviewCases = manualReviewQuery.data?.cases || (Array.isArray(manualReviewQuery.data) ? manualReviewQuery.data : []);
    const manualReviewTotal = manualReviewQuery.data?.pagination?.total || manualReviewCases.length;
    const manualReviewLoading = manualReviewQuery.isPending;

    const checkpointAppeals = appealsQuery.data || [];
    const checkpointSignatureAppeals = checkpointAppeals;
    const appealsLoading = appealsQuery.isPending;

    const bm03StopLoading = bm03StopQuery.isPending;
    const rawBm03 = bm03StopQuery.data;
    const bm03StopReviews = useMemo(() => {
        if (Array.isArray(rawBm03) && rawBm03.length > 0) return rawBm03;
        return registrations
            .filter((r) => r.status === 'STOP_REVIEW_PENDING')
            .map((r) => ({
                id: r.id,
                registrationId: r.id,
                stage: 'MIDTERM',
                status: 'STOP_REVIEW_PENDING',
                stopProposalSubmittedAt: r.updatedAt || r.createdAt,
                stopReviewDeadline: r.updatedAt ? dayjs(r.updatedAt).add(168, 'hour').toISOString() : dayjs().add(168, 'hour').toISOString(),
                extensionCount: 0,
                registration: r,
                stageEvaluation: {
                    stopProposalReason: 'Đề nghị dừng từ Giảng viên hướng dẫn',
                },
            }));
    }, [rawBm03, registrations]);

    const bm04DefenseLoading = bm04DefenseQuery.isPending;
    const rawBm04 = bm04DefenseQuery.data;
    const bm04DefenseReviews = useMemo(() => {
        if (Array.isArray(rawBm04) && rawBm04.length > 0) return rawBm04;
        return registrations
            .filter(
                (r) =>
                    r.status === 'PENDING_INSTITUTE_REVIEW' ||
                    r.status === 'BM04_REVIEW' ||
                    r.bm04Evaluation?.defenseRecommendation === 'NOT_APPROVE_FOR_DEFENSE'
            )
            .map((r) => ({
                id: r.bm04Evaluation?.id || r.id,
                registrationId: r.id,
                status: 'PENDING_INSTITUTE_REVIEW',
                submittedAt: r.bm04Evaluation?.updatedAt || r.updatedAt || r.createdAt,
                reviewDeadlineAt: r.updatedAt ? dayjs(r.updatedAt).add(168, 'hour').toISOString() : dayjs().add(168, 'hour').toISOString(),
                extensionCount: 0,
                registration: r,
                bm04Evaluation: r.bm04Evaluation,
            }));
    }, [rawBm04, registrations]);

    // Modal states cho BM03 Dừng đề tài
    const [isBm03MoreInfoModalOpen, setIsBm03MoreInfoModalOpen] = useState(false);
    const [selectedBm03StopReview, setSelectedBm03StopReview] = useState(null);
    const [bm03MoreInfoNote, setBm03MoreInfoNote] = useState('');

    const [isBm03DecisionModalOpen, setIsBm03DecisionModalOpen] = useState(false);
    const [bm03DecisionType, setBm03DecisionType] = useState('APPROVE_STOP');
    const [bm03DecisionReason, setBm03DecisionReason] = useState('');

    // Modal states cho BM04 Không cho bảo vệ
    const [isBm04MoreInfoModalOpen, setIsBm04MoreInfoModalOpen] = useState(false);
    const [selectedBm04DefenseReview, setSelectedBm04DefenseReview] = useState(null);
    const [bm04MoreInfoNote, setBm04MoreInfoNote] = useState('');

    const [isBm04DecisionModalOpen, setIsBm04DecisionModalOpen] = useState(false);
    const [bm04DecisionType, setBm04DecisionType] = useState('APPROVE_NOT_ELIGIBLE');
    const [bm04DecisionReason, setBm04DecisionReason] = useState('');

    const renderSlaCountdown = (deadlineAt) => {
        if (!deadlineAt) return <Tag>Chưa có SLA</Tag>;
        const now = dayjs();
        const deadline = dayjs(deadlineAt);
        const hoursLeft = deadline.diff(now, 'hour');

        if (hoursLeft <= 0) {
            return (
                <Tag color="error" icon={<ClockCircleOutlined />}>
                    Quá hạn SLA 168h
                </Tag>
            );
        }
        if (hoursLeft <= 24) {
            return (
                <Tag color="warning" icon={<ClockCircleOutlined />}>
                    SLA 168h: Còn {hoursLeft}h
                </Tag>
            );
        }
        return (
            <Tag color="processing" icon={<ClockCircleOutlined />}>
                SLA 168h: Còn {hoursLeft}h
            </Tag>
        );
    };

    const handleRequestMoreInfoBM03 = async () => {
        if (!selectedBm03StopReview) return;
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action: 'requestMoreInfoForStopReview',
                args: [selectedBm03StopReview.id, { note: bm03MoreInfoNote }],
            });
            message.success('Đã gửi yêu cầu bổ sung thông tin (+72h SLA)');
            setIsBm03MoreInfoModalOpen(false);
            setBm03MoreInfoNote('');
        } catch (error) {
            message.error(error?.message || 'Không thể gửi yêu cầu bổ sung');
        }
    };

    const handleDecideBM03Stop = async () => {
        if (!selectedBm03StopReview) return;
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action: 'decideStopReview',
                args: [selectedBm03StopReview.id, { decision: bm03DecisionType, reason: bm03DecisionReason }],
            });
            message.success(
                bm03DecisionType === 'APPROVE_STOP'
                    ? 'Chấp thuận dừng: Đã cập nhật kết luận dừng đề tài'
                    : 'Bác bỏ đề xuất: Đã cho phép tiếp tục thực hiện đề tài'
            );
            setIsBm03DecisionModalOpen(false);
            setBm03DecisionReason('');
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật thẩm định dừng đề tài');
        }
    };

    const handleRequestMoreInfoBM04 = async () => {
        if (!selectedBm04DefenseReview) return;
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action: 'requestMoreInfoForDefenseReview',
                args: [selectedBm04DefenseReview.id, { note: bm04MoreInfoNote }],
            });
            message.success('Đã gửi yêu cầu bổ sung thông tin (+72h SLA)');
            setIsBm04MoreInfoModalOpen(false);
            setBm04MoreInfoNote('');
        } catch (error) {
            message.error(error?.message || 'Không thể gửi yêu cầu bổ sung');
        }
    };

    const handleDecideBM04Defense = async () => {
        if (!selectedBm04DefenseReview) return;
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action: 'decideDefenseReview',
                args: [selectedBm04DefenseReview.id, { decision: bm04DecisionType, reason: bm04DecisionReason }],
            });
            message.success(
                bm04DecisionType === 'APPROVE_NOT_ELIGIBLE'
                    ? 'Đồng ý không cho bảo vệ: Đã chốt kết quả không đủ điều kiện'
                    : 'Cho phép ra bảo vệ: Đã chuyển trạng thái sẵn sàng bảo vệ'
            );
            setIsBm04DecisionModalOpen(false);
            setBm04DecisionReason('');
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật thẩm định BM04');
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
            await archiveMutation.mutateAsync({
                action: 'reviewArchive',
                args: [registrationId, {
                    decision: 'APPROVED',
                    reviewerNotes: 'Ban Quản trị / Khoa đã nghiệm thu lưu chiểu hoàn tất.',
                }],
            });
            message.success('Đã nghiệm thu lưu chiểu thành công! Đề tài chuyển sang COMPLETED.');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi nghiệm thu lưu chiểu');
        }
    };

    const handleAcademicAffairsReview = async (archiveId, status, notes = '') => {
        try {
            await archiveMutation.mutateAsync({
                action: 'reviewArchiveByAcademicAffairs',
                args: [archiveId, { status, notes: notes || undefined }],
            });
            message.success('Đã hoàn tất thẩm định thủ tục lưu chiểu (Giáo vụ)!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi thẩm định lưu chiểu Giáo vụ');
        }
    };

    const handleSignClearanceCertificate = async (archiveId) => {
        try {
            await archiveMutation.mutateAsync({
                action: 'signClearanceCertificate',
                args: [archiveId],
            });
            message.success('Viện trưởng đã ký số Giấy xác nhận hoàn thành thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi ký số Giấy xác nhận');
        }
    };

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
        if (!semesters.length) {
            setSemesterFilter(null);
            return;
        }

        const listToPick = currentSemesters.length > 0 ? currentSemesters : semesters;
        const stillExists = listToPick.some((semester) => semester.id === semesterFilter);
        if (semesterFilter && stillExists) return;

        const nearestLatestSemesterId = computeSemesterClosestToNow(listToPick);
        setSemesterFilter(nearestLatestSemesterId);
    }, [currentSemesters, semesters, semesterFilter]);

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
        setIsProgressModalOpen(true);
    };

    const loadProgressTasks = () => {
        if (progressRegistrationId) progressTasksQuery.refetch();
    };

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
                                <Text className="text-xs text-slate-500 font-mono font-medium">{dayjs(task.createdAt || task.updatedAt).format('DD/MM/YYYY HH:mm')}</Text>
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
                                <Text className="text-xs text-slate-500 font-mono font-medium">{dayjs(latest.submittedAt || latest.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
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
            return <span className="text-xs text-slate-500 italic font-medium">Chưa có SV</span>;
        }

        // BM01: Đề cương
        let bm01Color = 'bg-slate-100 text-slate-600 border-slate-300';
        let bm01Tooltip = 'Đề cương: Chưa thẩm định';
        if (reg.outlineReviewStatus === 'PASSED') {
            bm01Color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            bm01Tooltip = 'Đề cương: ĐẠT thẩm định';
        } else if (reg.outlineReviewStatus === 'NEEDS_REVISION') {
            bm01Color = 'bg-amber-100 text-amber-800 border-amber-300';
            bm01Tooltip = 'Đề cương: Cần chỉnh sửa';
        } else if (reg.outlineReviewStatus === 'FAILED') {
            bm01Color = 'bg-rose-100 text-rose-800 border-rose-300';
            bm01Tooltip = 'Đề cương: KHÔNG ĐẠT';
        } else if (reg.outlineReviewStatus === 'PENDING' || reg.outlineCouncilId) {
            bm01Color = 'bg-purple-100 text-purple-800 border-purple-300';
            bm01Tooltip = 'Đề cương: Đang trong hội đồng thẩm định';
        }

        // BM02: Giao đề tài
        const hasPassedBm01 = reg.outlineReviewStatus === 'PASSED' || ['IN_PROGRESS', 'READY_FOR_DEFENSE', 'DEFENDED', 'COMPLETED'].includes(reg.status);
        const bm02Color = hasPassedBm01 ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-600 border-slate-300';
        const bm02Tooltip = hasPassedBm01 ? 'Quyết định giao đề tài: Đã ban hành' : 'Quyết định giao đề tài: Chưa ban hành';

        // BM03: Tiến độ
        const isReadyForDefense = ['READY_FOR_DEFENSE', 'DEFENDED', 'COMPLETED'].includes(reg.status);
        const bm03Color = isReadyForDefense ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300';
        const bm03Tooltip = isReadyForDefense ? 'Đánh giá tiến độ: Đạt điều kiện' : 'Đánh giá tiến độ: Đang theo dõi';

        // BM04: Nhận xét hướng dẫn
        const isDefended = ['DEFENDED', 'COMPLETED'].includes(reg.status) || Boolean(reg.defenseResult);
        const bm04Color = isDefended ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300';
        const bm04Tooltip = isDefended ? 'Nhận xét hướng dẫn: Đã hoàn tất' : 'Nhận xét hướng dẫn: Chưa đánh giá';

        return (
            <div className="flex items-center gap-1">
                <Tooltip title={bm01Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm01Color} cursor-pointer`}>
                        Đề cương
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-500 font-bold">›</span>
                <Tooltip title={bm02Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm02Color} cursor-pointer`}>
                        Giao đề tài
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-500 font-bold">›</span>
                <Tooltip title={bm03Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm03Color} cursor-pointer`}>
                        Tiến độ
                    </span>
                </Tooltip>
                <span className="text-[10px] text-slate-500 font-bold">›</span>
                <Tooltip title={bm04Tooltip}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${bm04Color} cursor-pointer`}>
                        Bảo vệ
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
                                <span className="text-[11px] text-slate-600 font-mono font-medium">
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
                    <span className="text-xs text-slate-500 italic font-medium">Chưa có SV đăng ký</span>
                ),
        },
        {
            title: 'Tiến trình mốc học vụ',
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
                    if (key === 'PROGRESS') openProgressModal(record);
                    if (key === 'AUDIT') {
                        setAuditTopic(record);
                        setIsAuditModalOpen(true);
                    }
                };

                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            size="small"
                            icon={<FolderOpenOutlined />}
                            onClick={() => {
                                const reg = record.registrationEvents?.[0] || record;
                                setSelectedRegForDossier(reg);
                                setDossierDrawerOpen(true);
                            }}
                        >
                            Hồ sơ BM
                        </Button>
                        <Dropdown menu={{ items: menuItems, onClick: onAction }} trigger={['click']} placement="bottomRight">
                            <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-primary">
                                Thao tác <MoreOutlined />
                            </Button>
                        </Dropdown>
                    </div>
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
                            <div className="font-semibold text-slate-800 text-sm">{student?.fullName || '—'}</div>
                            <div className="text-xs text-slate-600 font-mono font-medium">{student?.code || '—'}</div>
                            <div className="text-[11px] text-slate-500">{student?.department || ''}</div>
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
                            <div className="font-semibold text-slate-800 text-sm">
                                {mentor?.academicTitle ? `${mentor.academicTitle} ` : ''}{mentor?.fullName || '—'}
                            </div>
                            <div className="text-xs text-slate-600 font-mono font-medium">{mentor?.code || ''}</div>
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
                        <span className="text-slate-500 text-xs italic font-medium">Chưa có</span>
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
                            <span className="text-xs text-slate-500 italic font-medium">Chưa đính kèm tài liệu</span>
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
                    if (status === 'APPROVED' || status === 'COMPLETED') {
                        return <Tag color="success" icon={<CheckCircleOutlined />}>{status === 'COMPLETED' ? 'Đã hoàn tất' : 'Đã nghiệm thu'}</Tag>;
                    }
                    if (status === 'PENDING_INSTITUTE_SIGNATURE') {
                        return <Tag color="purple" icon={<ClockCircleOutlined />}>Chờ Viện trưởng ký</Tag>;
                    }
                    if (status === 'REVISION_REQUIRED') {
                        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Cần sửa đổi</Tag>;
                    }
                    if (status === 'ARCHIVE_INCOMPLETE') {
                        return <Tag color="error" icon={<CloseCircleOutlined />}>Quá hạn nộp</Tag>;
                    }
                    if (status === 'ARCHIVE_REJECTED') {
                        return <Tag color="error" icon={<CloseCircleOutlined />}>Bị từ chối</Tag>;
                    }
                    return <Tag color="processing" icon={<ClockCircleOutlined />}>Chờ duyệt</Tag>;
                },
            },
            {
                title: 'Thao tác',
                key: 'actions',
                width: 220,
                align: 'right',
                render: (_, record) => {
                    const isApproved = record.status === 'APPROVED' || record.status === 'COMPLETED';
                    const canSign = record.status === 'PENDING_INSTITUTE_SIGNATURE' || record.academicReviewStatus === 'APPROVED';
                    return (
                        <Space size="small" wrap>
                            <Button
                                size="small"
                                icon={<ScanOutlined />}
                                onClick={() => handleOpenCrossCheck(record.registrationId)}
                                className="text-teal-700 border-teal-500 hover:border-teal-700"
                            >
                                AI Đối soát
                            </Button>
                            {canReviewArchive && !isApproved && (
                                <>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        onClick={() => handleAcademicAffairsReview(record.id, 'APPROVED')}
                                    >
                                        Duyệt thủ tục
                                    </Button>
                                    <Button
                                        size="small"
                                        danger
                                        icon={<CloseCircleOutlined />}
                                        onClick={() => handleAcademicAffairsReview(record.id, 'REVISION_REQUIRED')}
                                    >
                                        Yêu cầu nộp lại
                                    </Button>
                                </>
                            )}
                            {canSign && (
                                <Popconfirm
                                    title="Ký số Giấy xác nhận"
                                    description="Viện trưởng ký số cấp Giấy xác nhận hoàn thành khóa luận cho sinh viên."
                                    onConfirm={() => handleSignClearanceCertificate(record.id)}
                                    okText="Ký số"
                                    cancelText="Hủy"
                                >
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<SafetyCertificateOutlined />}
                                    >
                                        Viện trưởng ký
                                    </Button>
                                </Popconfirm>
                            )}
                            {isApproved && (
                                <Button
                                    size="small"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={() => handleOpenCertificate(record.registrationId)}
                                >
                                    Xem Giấy xác nhận
                                </Button>
                            )}
                        </Space>
                    );
                },
            },
        ],
        [canReviewArchive]
    );

    const manualReviewColumns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 70,
            render: (id) => <span className="font-mono text-xs text-slate-500">#{id}</span>,
        },
        {
            title: 'Sinh viên',
            key: 'student',
            width: 200,
            render: (_, record) => {
                const stu = record.registration?.student;
                return (
                    <div>
                        <div className="font-semibold text-slate-900 text-xs">{stu?.fullName || '—'}</div>
                        <div className="text-[11px] font-mono text-slate-500">{stu?.code || '—'}</div>
                    </div>
                );
            },
        },
        {
            title: 'Đề tài & GVHD',
            key: 'topic',
            ellipsis: true,
            render: (_, record) => {
                const top = record.registration?.topic;
                return (
                    <div>
                        <div className="font-medium text-slate-800 text-xs truncate" title={top?.title}>{top?.title || '—'}</div>
                        <div className="text-[11px] text-teal-700">GVHD: {top?.mentor?.fullName || 'Chưa phân công'}</div>
                    </div>
                );
            },
        },
        {
            title: 'Học kỳ',
            key: 'semester',
            width: 140,
            render: (_, record) => (
                <span className="text-xs text-slate-600">
                    {record.registration?.semester?.name || record.registration?.semester?.code || '—'}
                </span>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'currentStatus',
            width: 150,
            render: (_, record) => (
                <Tag color="cyan" className="text-xs font-mono">
                    {record.registration?.status || '—'}
                </Tag>
            ),
        },
        {
            title: 'Cảnh báo toàn vẹn phát hiện',
            key: 'reasons',
            width: 280,
            render: (_, record) => {
                const reasons = Array.isArray(record.reasonCodes) ? record.reasonCodes : [];
                return (
                    <div className="flex flex-wrap gap-1">
                        {reasons.map((r) => (
                            <Tag color="volcano" key={r} className="text-[10px] m-0">
                                {r}
                            </Tag>
                        ))}
                    </div>
                );
            },
        },
        {
            title: 'Thẩm định',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status) => (
                status === 'RESOLVED' ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Đã giải quyết</Tag>
                ) : (
                    <Tag color="warning" icon={<ClockCircleOutlined />}>Chờ xử lý</Tag>
                )
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 140,
            align: 'right',
            render: (_, record) => (
                <Button
                    size="small"
                    type="primary"
                    style={{ background: '#0F766E', borderColor: '#0F766E' }}
                    className="text-xs font-semibold"
                    onClick={() => {
                        setSelectedCaseForReview(record);
                        setIsManualReviewModalOpen(true);
                    }}
                >
                    {record.status === 'RESOLVED' ? 'Xem kết luận' : 'Thẩm định & Gán'}
                </Button>
            ),
        },
    ];

    const checkpointAppealColumns = [
        {
            title: 'Mã & Tên Sinh Viên',
            key: 'student',
            width: 200,
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{record.student?.fullName || '—'}</div>
                    <div className="text-xs text-slate-500">{record.student?.code || '—'}</div>
                </div>
            ),
        },
        {
            title: 'Đề Tài Đồ Án',
            key: 'topic',
            ellipsis: true,
            render: (_, record) => (
                <div>
                    <div className="font-medium text-slate-800">{record.registration?.topic?.title || '—'}</div>
                    <div className="text-xs text-slate-500">
                        GVHD: {record.registration?.topic?.mentor?.fullName || '—'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Mốc Checkpoint',
            key: 'checkpoint',
            width: 150,
            render: (_, record) => (
                <Tag color="cyan">
                    Checkpoint {record.checkpointEvaluation?.checkpointNo || 1} (Lần {record.checkpointEvaluation?.attemptNo || 1})
                </Tag>
            ),
        },
        {
            title: 'Lý Do Khiếu Nại',
            dataIndex: 'reason',
            key: 'reason',
            width: 250,
            ellipsis: true,
            render: (text, record) => (
                <div>
                    <Tooltip title={text}>
                        <span className="text-slate-700">{text || '—'}</span>
                    </Tooltip>
                    {record.evidenceUrl && (
                        <div className="mt-1">
                            <a
                                href={record.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 underline flex items-center gap-1"
                            >
                                <FilePdfOutlined />
                                <span>{record.evidenceName || 'Minh chứng'}</span>
                            </a>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Bối Cảnh Hạn Chót',
            key: 'deadlines',
            width: 180,
            render: (_, record) => (
                <div className="text-xs space-y-0.5">
                    <div>
                        <span className="text-slate-500">Hạn ký gốc: </span>
                        <b>{record.checkpointEvaluation?.studentSignDeadlineAt ? dayjs(record.checkpointEvaluation.studentSignDeadlineAt).format('DD/MM/YYYY') : '—'}</b>
                    </div>
                    <div>
                        <span className="text-slate-500">Hạn nộp đơn: </span>
                        <b>{record.appealDeadlineAt ? dayjs(record.appealDeadlineAt).format('DD/MM/YYYY') : '—'}</b>
                    </div>
                </div>
            ),
        },
        {
            title: 'Trạng Thái',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (status) => {
                if (status === 'APPROVED') return <Tag color="green">ĐÃ GIA HẠN</Tag>;
                if (status === 'REJECTED') return <Tag color="red">ĐÃ TỪ CHỐI</Tag>;
                if (status === 'SUBMITTED') return <Tag color="gold">CHỜ THẨM ĐỊNH</Tag>;
                return <Tag color="blue">{status}</Tag>;
            },
        },
        {
            title: 'Thao Tác',
            key: 'actions',
            width: 160,
            align: 'right',
            render: (_, record) => (
                <Button
                    size="small"
                    type={record.status === 'SUBMITTED' ? 'primary' : 'default'}
                    onClick={() => {
                        setSelectedAppealForReview(record);
                        setIsAppealReviewModalOpen(true);
                    }}
                >
                    {record.status === 'SUBMITTED' ? 'Thẩm định khiếu nại' : 'Xem chi tiết'}
                </Button>
            ),
        },
    ];

    const bm03StopReviewColumns = [
        {
            title: 'Sinh viên',
            key: 'student',
            width: 180,
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800">
                        {record.registration?.student?.fullName || record.student?.fullName || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                        {record.registration?.student?.code || record.student?.code || '—'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Đề tài',
            key: 'topic',
            ellipsis: true,
            render: (_, record) => (
                <div>
                    <div className="font-medium text-slate-800">
                        {record.registration?.topic?.title || record.topic?.title || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                        GVHD: {record.registration?.topic?.mentor?.fullName || record.mentor?.fullName || '—'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Giai đoạn',
            key: 'stage',
            width: 110,
            render: (_, record) => (
                <Tag color={record.stage === 'MIDTERM' ? 'blue' : 'purple'}>
                    {record.stage === 'MIDTERM' ? 'Giữa kỳ' : 'Cuối kỳ'}
                </Tag>
            ),
        },
        {
            title: 'Lý do đề xuất dừng',
            key: 'reason',
            ellipsis: true,
            render: (_, record) => {
                const reasonText = record.stageEvaluation?.stopProposalReason || record.reviewReason || 'Đề nghị dừng từ GVHD';
                return (
                    <Tooltip title={reasonText}>
                        <span className="text-rose-600 font-medium">{reasonText}</span>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Thời hạn SLA (168h)',
            key: 'sla',
            width: 180,
            render: (_, record) => renderSlaCountdown(record.stopReviewDeadline),
        },
        {
            title: 'Gia hạn (+72h)',
            key: 'extension',
            width: 130,
            render: (_, record) =>
                record.extensionCount > 0 ? (
                    <Tag color="purple">Đã gia hạn (+72h)</Tag>
                ) : (
                    <Tag color="default">Chưa gia hạn</Tag>
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 320,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        icon={<ClockCircleOutlined />}
                        disabled={record.extensionCount > 0}
                        onClick={() => {
                            setSelectedBm03StopReview(record);
                            setBm03MoreInfoNote('');
                            setIsBm03MoreInfoModalOpen(true);
                        }}
                    >
                        Yêu cầu bổ sung
                    </Button>
                    <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        onClick={() => {
                            setSelectedBm03StopReview(record);
                            setBm03DecisionType('APPROVE_STOP');
                            setBm03DecisionReason('');
                            setIsBm03DecisionModalOpen(true);
                        }}
                    >
                        Chấp thuận dừng
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => {
                            setSelectedBm03StopReview(record);
                            setBm03DecisionType('REJECT_STOP');
                            setBm03DecisionReason('');
                            setIsBm03DecisionModalOpen(true);
                        }}
                    >
                        Bác bỏ đề xuất
                    </Button>
                </Space>
            ),
        },
    ];

    const bm04DefenseReviewColumns = [
        {
            title: 'Sinh viên',
            key: 'student',
            width: 180,
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800">
                        {record.registration?.student?.fullName || record.student?.fullName || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                        {record.registration?.student?.code || record.student?.code || '—'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Đề tài',
            key: 'topic',
            ellipsis: true,
            render: (_, record) => (
                <div>
                    <div className="font-medium text-slate-800">
                        {record.registration?.topic?.title || record.topic?.title || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                        GVHD: {record.registration?.topic?.mentor?.fullName || record.mentor?.fullName || '—'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Chuẩn đầu ra & Điểm',
            key: 'outcomes',
            width: 200,
            render: (_, record) => {
                const evalData = record.bm04Evaluation;
                return (
                    <div className="text-xs space-y-1">
                        <div>
                            {evalData?.programOutcome === 'MEETS_PROGRAM_OUTCOMES' ? (
                                <Tag color="green">Đạt chuẩn đầu ra</Tag>
                            ) : (
                                <Tag color="red">Không đạt chuẩn</Tag>
                            )}
                        </div>
                        {evalData && (
                            <div className="text-slate-500">
                                Hình thức: {evalData.thesisFormatScore ?? '—'} | Nội dung: {evalData.researchContentScore ?? '—'}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Lý do từ chối bảo vệ',
            key: 'reason',
            ellipsis: true,
            render: (_, record) => {
                const reasonText = record.bm04Evaluation?.mismatchReason || record.reviewReason || 'Không cho bảo vệ';
                return (
                    <Tooltip title={reasonText}>
                        <span className="text-rose-600 font-medium">{reasonText}</span>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Thời hạn SLA (168h)',
            key: 'sla',
            width: 180,
            render: (_, record) => renderSlaCountdown(record.reviewDeadlineAt),
        },
        {
            title: 'Gia hạn (+72h)',
            key: 'extension',
            width: 130,
            render: (_, record) =>
                record.extensionCount > 0 ? (
                    <Tag color="purple">Đã gia hạn (+72h)</Tag>
                ) : (
                    <Tag color="default">Chưa gia hạn</Tag>
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 340,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        icon={<ClockCircleOutlined />}
                        disabled={record.extensionCount > 0}
                        onClick={() => {
                            setSelectedBm04DefenseReview(record);
                            setBm04MoreInfoNote('');
                            setIsBm04MoreInfoModalOpen(true);
                        }}
                    >
                        Yêu cầu bổ sung
                    </Button>
                    <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        onClick={() => {
                            setSelectedBm04DefenseReview(record);
                            setBm04DecisionType('APPROVE_NOT_ELIGIBLE');
                            setBm04DecisionReason('');
                            setIsBm04DecisionModalOpen(true);
                        }}
                    >
                        Đồng ý không cho bảo vệ
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => {
                            setSelectedBm04DefenseReview(record);
                            setBm04DecisionType('OVERRIDE_ELIGIBLE');
                            setBm04DecisionReason('');
                            setIsBm04DecisionModalOpen(true);
                        }}
                    >
                        Cho phép ra bảo vệ
                    </Button>
                </Space>
            ),
        },
    ];

    const lecturerOptions = lecturers.map((lecturer) => ({
        value: lecturer.id,
        label: `${lecturer.fullName} (${lecturer.code})`,
    }));

    const semesterOptions = (currentSemesters.length > 0 ? currentSemesters : semesters).map((semester) => ({
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
                        <p className="text-xs text-slate-500 font-mono font-medium">{dayjs(auditTopic.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-semibold text-slate-800">Khởi tạo đề tài</p>
                    </>
                ),
            },
            {
                color: 'blue',
                children: (
                    <>
                        <p className="text-xs text-slate-500 font-mono font-medium">{dayjs(auditTopic.updatedAt).format('DD/MM/YYYY HH:mm')}</p>
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
                        <p className="text-xs text-slate-500 font-mono font-medium">{dayjs(event.createdAt).format('DD/MM/YYYY HH:mm')}</p>
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
                title="Giám sát Đề tài & Tiến độ Học vụ"
                subtitle="Theo dõi vòng đời đề tài, tiến độ các mốc học vụ của sinh viên và điều phối xử lý ngoại lệ đào tạo."
                tags={[{ label: 'Giám sát toàn diện', color: 'blue' }]}
                actions={
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            topicsQuery.refetch();
                            registrationsQuery.refetch();
                            lecturersQuery.refetch();
                            semestersQuery.refetch();
                            healthRadarQuery.refetch();
                            archivesQuery.refetch();
                            manualReviewQuery.refetch();
                            appealsQuery.refetch();
                            bm03StopQuery.refetch();
                            bm04DefenseQuery.refetch();
                        }}
                    >
                        Làm mới
                    </Button>
                }
            />

            {healthRadarQuery.isError && (
                <div className="mb-4">
                    <QueryErrorState
                        error={healthRadarQuery.error}
                        onRetry={() => healthRadarQuery.refetch()}
                        retrying={healthRadarQuery.isFetching}
                    />
                </div>
            )}

            {/* Health Radar Cảnh Báo Sớm Widget */}
            <div className="bg-[#0A2540] border border-teal-900/40 rounded-lg p-5 text-white shadow-xs relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                                Health Radar • Hệ Thống Cảnh Báo Sớm Toàn Khóa
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-0.5">
                            Giám Sát Rủi Ro Tiến Độ &amp; Hồ Sơ Lưu Chiểu Sau Bảo Vệ
                        </h3>
                        <p className="text-xs text-slate-300 max-w-xl">
                            Tự động quét và cảnh báo sinh viên gián đoạn gặp GVHD (&gt;21 ngày không có nhật ký tiến độ) hoặc chậm nộp lưu chiểu (&gt;14 ngày sau bảo vệ).
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-rose-400 text-2xl font-black">
                                {healthRadarStats?.overdueArchiveCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-rose-200">Chậm nộp lưu chiểu</div>
                                <div className="text-[11px] text-slate-300 font-medium">&gt; 14 ngày sau bảo vệ</div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-amber-400 text-2xl font-black">
                                {healthRadarStats?.atRiskInactiveCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-amber-200">Gián đoạn GVHD</div>
                                <div className="text-[11px] text-slate-300 font-medium">&gt; 21 ngày không cập nhật tiến độ</div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
                            <div className="text-sky-400 text-2xl font-black">
                                {healthRadarStats?.pendingArchiveReviewCount ?? 0}
                            </div>
                            <div className="text-xs">
                                <div className="font-semibold text-sky-200">Chờ nghiệm thu</div>
                                <div className="text-[11px] text-slate-300 font-medium">Hồ sơ đã nộp</div>
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
                                                description="Vui lòng xử lý phê duyệt sớm để sinh viên và GVHD có thể triển khai nộp đề cương chi tiết kịp tiến độ."
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
                                                options={[
                                                    'APPROVED', 'PENDING', 'REJECTED', 'DRAFT',
                                                    'DEFENSE_PASSED', 'DEFENSE_FAILED',
                                                    'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED',
                                                    'PENDING_INSTITUTE_SIGNATURE', 'COMPLETED',
                                                ].map((key) => ({
                                                    label: STATUS_MAP[key]?.label || STATUS_MAP[key]?.text || key,
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
                                        <QueryPanel query={topicsQuery} variant="table">
                                            <Table
                                                dataSource={filteredTopics}
                                                rowKey="id"
                                                columns={columns}
                                                scroll={{ x: 1280 }}
                                                pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `Tổng số ${t} đề tài` }}
                                                size="middle"
                                            />
                                        </QueryPanel>
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
                                                    { value: 'SUBMITTED', label: 'Chờ nghiệm thu' },
                                                    { value: 'APPROVED', label: 'Đã nghiệm thu' },
                                                    { value: 'REVISION_REQUIRED', label: 'Cần chỉnh sửa' },
                                                    { value: 'DEFENSE_PASSED', label: 'Đã bảo vệ đạt' },
                                                    { value: 'DEFENSE_FAILED', label: 'Bảo vệ không đạt' },
                                                    { value: 'ARCHIVE_INCOMPLETE', label: 'Chưa hoàn tất lưu chiểu' },
                                                    { value: 'ARCHIVE_REJECTED', label: 'Lưu chiểu bị từ chối' },
                                                    { value: 'PENDING_INSTITUTE_SIGNATURE', label: 'Chờ Viện trưởng ký' },
                                                    { value: 'COMPLETED', label: 'Hoàn thành chương trình' },
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
                                        <QueryPanel query={archivesQuery} variant="table">
                                            <Table
                                                dataSource={filteredArchives}
                                                rowKey="id"
                                                columns={archiveColumns}
                                                scroll={{ x: 1200 }}
                                                pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} hồ sơ lưu chiểu` }}
                                                size="middle"
                                            />
                                        </QueryPanel>
                                    </div>
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'MANUAL_REVIEW_QUEUE',
                        label: (
                            <span className="flex items-center gap-2 font-semibold text-sm">
                                <SafetyCertificateOutlined />
                                Hàng Đợi Thẩm Định ({manualReviewTotal + checkpointSignatureAppeals.length + bm03StopReviews.length + bm04DefenseReviews.length})
                            </span>
                        ),
                        children: (
                            <div className="space-y-5 pt-2">
                                <Tabs
                                    defaultActiveKey="CHECKPOINT_SIGNATURE_APPEAL_QUEUE"
                                    type="card"
                                    items={[
                                        {
                                            key: 'CHECKPOINT_SIGNATURE_APPEAL_QUEUE',
                                            label: (
                                                <span className="font-semibold text-sm">
                                                    Khiếu Nại Chữ Ký Tiến Độ ({checkpointSignatureAppeals.length})
                                                </span>
                                            ),
                                            children: (
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <Select
                                                                value={appealStatusFilter}
                                                                onChange={(val) => setAppealStatusFilter(val)}
                                                                style={{ width: 220 }}
                                                                options={[
                                                                    { label: 'Tất cả trạng thái', value: 'ALL' },
                                                                    { label: 'Chờ thẩm định', value: 'SUBMITTED' },
                                                                    { label: 'Đã chấp thuận', value: 'APPROVED' },
                                                                    { label: 'Đã từ chối', value: 'REJECTED' },
                                                                ]}
                                                            />
                                                            <Button
                                                                icon={<ReloadOutlined />}
                                                                onClick={() => appealsQuery.refetch()}
                                                            >
                                                                Làm mới
                                                            </Button>
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Danh sách đơn giải trình quá hạn ký xác nhận tiến độ cần Ban chủ nhiệm / Viện trưởng thẩm định gia hạn.
                                                        </div>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                                        <QueryPanel query={appealsQuery} variant="table">
                                                            <Table
                                                                dataSource={checkpointSignatureAppeals}
                                                                rowKey="id"
                                                                columns={checkpointAppealColumns}
                                                                scroll={{ x: 1100 }}
                                                                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} đơn khiếu nại` }}
                                                                size="middle"
                                                            />
                                                        </QueryPanel>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'BM03_STOP_REVIEW_QUEUE',
                                            label: (
                                                <span className="font-semibold text-sm">
                                                    Đề nghị dừng BM03 ({bm03StopReviews.length})
                                                </span>
                                            ),
                                            children: (
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <Button
                                                                icon={<ReloadOutlined />}
                                                                onClick={() => bm03StopQuery.refetch()}
                                                            >
                                                                Làm mới
                                                            </Button>
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Danh sách đề xuất dừng đề tài BM03 chờ Viện thẩm định (SLA 168h, gia hạn tối đa 1 lần +72h).
                                                        </div>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                                        <QueryPanel query={bm03StopQuery} variant="table">
                                                            <Table
                                                                dataSource={bm03StopReviews}
                                                                rowKey="id"
                                                                columns={bm03StopReviewColumns}
                                                                scroll={{ x: 1200 }}
                                                                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} hồ sơ đề nghị dừng BM03` }}
                                                                size="middle"
                                                            />
                                                        </QueryPanel>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'BM04_DEFENSE_REVIEW_QUEUE',
                                            label: (
                                                <span className="font-semibold text-sm">
                                                    Đề nghị không cho bảo vệ BM04 ({bm04DefenseReviews.length})
                                                </span>
                                            ),
                                            children: (
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <Button
                                                                icon={<ReloadOutlined />}
                                                                onClick={() => bm04DefenseQuery.refetch()}
                                                            >
                                                                Làm mới
                                                            </Button>
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Danh sách đề xuất không cho bảo vệ BM04 chờ Viện thẩm định (SLA 168h, gia hạn tối đa 1 lần +72h).
                                                        </div>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                                        <QueryPanel query={bm04DefenseQuery} variant="table">
                                                            <Table
                                                                dataSource={bm04DefenseReviews}
                                                                rowKey="id"
                                                                columns={bm04DefenseReviewColumns}
                                                                scroll={{ x: 1250 }}
                                                                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} hồ sơ từ chối bảo vệ BM04` }}
                                                                size="middle"
                                                            />
                                                        </QueryPanel>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'LEGACY_CASES',
                                            label: (
                                                <span className="font-semibold text-sm">
                                                    Hồ Sơ Cần Thẩm Định Chuyển Đổi ({manualReviewTotal})
                                                </span>
                                            ),
                                            children: (
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <Select
                                                                value={manualReviewStatusFilter}
                                                                onChange={(val) => setManualReviewStatusFilter(val)}
                                                                style={{ width: 220 }}
                                                                options={[
                                                                    { label: 'Chờ thẩm định', value: 'OPEN' },
                                                                    { label: 'Đã giải quyết', value: 'RESOLVED' },
                                                                    { label: 'Tất cả trạng thái', value: 'ALL' },
                                                                ]}
                                                            />
                                                            <Button
                                                                icon={<ReloadOutlined />}
                                                                onClick={() => manualReviewQuery.refetch()}
                                                            >
                                                                Làm mới
                                                            </Button>
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Danh sách <b>{manualReviewTotal}</b> hồ sơ cần xác nhận minh chứng và cấp phiên bản chính sách học vụ chuẩn.
                                                        </div>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                                        <QueryPanel query={manualReviewQuery} variant="table">
                                                            <Table
                                                                dataSource={manualReviewCases}
                                                                rowKey="id"
                                                                columns={manualReviewColumns}
                                                                scroll={{ x: 1200 }}
                                                                pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `Tổng cộng ${t} hồ sơ thẩm định` }}
                                                                size="middle"
                                                            />
                                                        </QueryPanel>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
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
                        Chi Tiết Cảnh Báo Sớm Toàn Khóa
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
                                                title: 'Lần gặp gần nhất',
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

            {/* Manual Review Modal */}
            <CheckpointAppealReviewModal
                open={isAppealReviewModalOpen}
                onClose={() => setIsAppealReviewModalOpen(false)}
                appeal={selectedAppealForReview}
                onSuccess={() => {
                    fetchCheckpointAppeals(appealStatusFilter, semesterFilter);
                    fetchData();
                }}
            />

            <ManualReviewModal
                open={isManualReviewModalOpen}
                caseItem={selectedCaseForReview}
                onClose={() => {
                    setIsManualReviewModalOpen(false);
                    setSelectedCaseForReview(null);
                }}
                onSuccess={() => fetchManualReviewCases(manualReviewStatusFilter, semesterFilter)}
            />

            {/* BM03 Stop Review: Yêu cầu bổ sung (+72h) Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <ClockCircleOutlined className="text-amber-500" />
                        Yêu cầu bổ sung thông tin đề nghị dừng BM03
                    </div>
                }
                open={isBm03MoreInfoModalOpen}
                onCancel={() => {
                    setIsBm03MoreInfoModalOpen(false);
                    setBm03MoreInfoNote('');
                }}
                footer={[
                    <Button
                        key="cancel"
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                            setIsBm03MoreInfoModalOpen(false);
                            setBm03MoreInfoNote('');
                        }}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleRequestMoreInfoBM03}
                    >
                        Gửi yêu cầu bổ sung
                    </Button>,
                ]}
                width={560}
                centered
            >
                <div className="space-y-4 pt-2">
                    <p className="text-xs text-slate-500">
                        Gia hạn thời gian thẩm định thêm 72 giờ và yêu cầu Giảng viên hướng dẫn giải trình hoặc cung cấp thêm thông tin minh chứng.
                    </p>
                    <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Nội dung yêu cầu bổ sung:</div>
                        <Input.TextArea
                            rows={4}
                            value={bm03MoreInfoNote}
                            onChange={(e) => setBm03MoreInfoNote(e.target.value)}
                            placeholder="Nhập nội dung cần giảng viên làm rõ hoặc bổ sung..."
                        />
                    </div>
                </div>
            </Modal>

            {/* BM03 Stop Review: Thẩm định dừng Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        {bm03DecisionType === 'APPROVE_STOP' ? (
                            <StopOutlined className="text-rose-500" />
                        ) : (
                            <CheckCircleOutlined className="text-emerald-500" />
                        )}
                        Thẩm định dừng BM03: {bm03DecisionType === 'APPROVE_STOP' ? 'Chấp thuận dừng' : 'Bác bỏ đề xuất'}
                    </div>
                }
                open={isBm03DecisionModalOpen}
                onCancel={() => {
                    setIsBm03DecisionModalOpen(false);
                    setBm03DecisionReason('');
                }}
                footer={[
                    <Button
                        key="cancel"
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                            setIsBm03DecisionModalOpen(false);
                            setBm03DecisionReason('');
                        }}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger={bm03DecisionType === 'APPROVE_STOP'}
                        icon={<CheckCircleOutlined />}
                        onClick={handleDecideBM03Stop}
                    >
                        {bm03DecisionType === 'APPROVE_STOP' ? 'Chấp thuận dừng' : 'Bác bỏ đề xuất'}
                    </Button>,
                ]}
                width={560}
                centered
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type={bm03DecisionType === 'APPROVE_STOP' ? 'error' : 'info'}
                        showIcon
                        message={
                            bm03DecisionType === 'APPROVE_STOP'
                                ? 'Học vụ sẽ chốt dừng đề tài và sinh viên không thể tiếp tục đồ án kỳ này.'
                                : 'Học vụ bác bỏ đề xuất dừng và sinh viên tiếp tục thực hiện đề tài bình thường.'
                        }
                    />
                    <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Lý do thẩm định / Kết luận Viện:</div>
                        <Input.TextArea
                            rows={4}
                            value={bm03DecisionReason}
                            onChange={(e) => setBm03DecisionReason(e.target.value)}
                            placeholder="Nhập căn cứ, lý do hoặc kết luận thẩm định..."
                        />
                    </div>
                </div>
            </Modal>

            {/* BM04 Defense Review: Yêu cầu bổ sung (+72h) Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <ClockCircleOutlined className="text-amber-500" />
                        Yêu cầu bổ sung thông tin thẩm định BM04
                    </div>
                }
                open={isBm04MoreInfoModalOpen}
                onCancel={() => {
                    setIsBm04MoreInfoModalOpen(false);
                    setBm04MoreInfoNote('');
                }}
                footer={[
                    <Button
                        key="cancel"
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                            setIsBm04MoreInfoModalOpen(false);
                            setBm04MoreInfoNote('');
                        }}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleRequestMoreInfoBM04}
                    >
                        Gửi yêu cầu bổ sung
                    </Button>,
                ]}
                width={560}
                centered
            >
                <div className="space-y-4 pt-2">
                    <p className="text-xs text-slate-500">
                        Gia hạn thời gian thẩm định thêm 72 giờ và yêu cầu Giảng viên hướng dẫn bổ sung minh chứng về việc từ chối bảo vệ.
                    </p>
                    <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Nội dung yêu cầu bổ sung:</div>
                        <Input.TextArea
                            rows={4}
                            value={bm04MoreInfoNote}
                            onChange={(e) => setBm04MoreInfoNote(e.target.value)}
                            placeholder="Nhập nội dung cần giảng viên làm rõ hoặc bổ sung minh chứng..."
                        />
                    </div>
                </div>
            </Modal>

            {/* BM04 Defense Review: Thẩm định không cho bảo vệ Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        {bm04DecisionType === 'APPROVE_NOT_ELIGIBLE' ? (
                            <StopOutlined className="text-rose-500" />
                        ) : (
                            <CheckCircleOutlined className="text-emerald-500" />
                        )}
                        Thẩm định không cho bảo vệ BM04: {bm04DecisionType === 'APPROVE_NOT_ELIGIBLE' ? 'Đồng ý không cho bảo vệ' : 'Cho phép ra bảo vệ'}
                    </div>
                }
                open={isBm04DecisionModalOpen}
                onCancel={() => {
                    setIsBm04DecisionModalOpen(false);
                    setBm04DecisionReason('');
                }}
                footer={[
                    <Button
                        key="cancel"
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                            setIsBm04DecisionModalOpen(false);
                            setBm04DecisionReason('');
                        }}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger={bm04DecisionType === 'APPROVE_NOT_ELIGIBLE'}
                        icon={<CheckCircleOutlined />}
                        onClick={handleDecideBM04Defense}
                    >
                        {bm04DecisionType === 'APPROVE_NOT_ELIGIBLE' ? 'Đồng ý không cho bảo vệ' : 'Cho phép ra bảo vệ'}
                    </Button>,
                ]}
                width={560}
                centered
            >
                <div className="space-y-4 pt-2">
                    <Alert
                        type={bm04DecisionType === 'APPROVE_NOT_ELIGIBLE' ? 'error' : 'success'}
                        showIcon
                        message={
                            bm04DecisionType === 'APPROVE_NOT_ELIGIBLE'
                                ? 'Đồng ý không cho bảo vệ: Sinh viên không đủ điều kiện ra bảo vệ trước hội đồng.'
                                : 'Cho phép ra bảo vệ: Sinh viên đủ điều kiện ra bảo vệ và phân công hội đồng.'
                        }
                    />
                    <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Căn cứ / Kết luận thẩm định:</div>
                        <Input.TextArea
                            rows={4}
                            value={bm04DecisionReason}
                            onChange={(e) => setBm04DecisionReason(e.target.value)}
                            placeholder="Nhập căn cứ, lý do hoặc kết luận thẩm định..."
                        />
                    </div>
                </div>
            </Modal>

            {/* AI Archival Cross-Check Modal */}
            <ArchivalCrossCheckModal
                open={crossCheckModalOpen}
                onClose={() => setCrossCheckModalOpen(false)}
                data={crossCheckData}
                loading={crossCheckLoading}
            />

            {/* Ngăn kéo Hồ sơ Biểu mẫu Học vụ Toàn trình */}
            <AcademicDossierDrawer
                open={dossierDrawerOpen}
                onClose={() => {
                    setDossierDrawerOpen(false);
                    setSelectedRegForDossier(null);
                }}
                registration={selectedRegForDossier}
            />
        </div>
    );
}

export default ProjectOversightPage;
