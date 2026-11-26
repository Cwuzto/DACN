import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Button,
    Checkbox,
    Empty,
    Input,
    message,
    Modal,
    Popconfirm,
    Select,
    Spin,
    Table,
    Tag,
    Tooltip,
} from 'antd';
import {
    BellOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    CloseOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    FilterOutlined,
    FolderOpenOutlined,
    HistoryOutlined,
    LockOutlined,
    PrinterOutlined,
    ReloadOutlined,
    RollbackOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    TrophyOutlined,
    UnlockOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import { queryKeys } from '../../query/queryKeys';
import { useApproveDefenseResult, useDefenseResults, useGradingSemesters, useResultApprovals, useScoreBookReturnLogs } from '../../queries/gradingQueries';
import { useProjectCatalogs } from '../../queries/topicQueries';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import QueryErrorState from '../../components/common/QueryErrorState';
import ContentRefreshIndicator from '../../components/common/ContentRefreshIndicator';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
import useAuthStore from '../../stores/authStore';
import DefenseResultPublicationModal from '../../components/admin/DefenseResultPublicationModal';
import PublicationHistoryModal from '../../components/admin/PublicationHistoryModal';
import DefenseSummaryRecordModal from '../../components/admin/DefenseSummaryRecordModal';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';
import RubricQuickScore from '../../components/grading/RubricQuickScore';
import {
    DEFAULT_RUBRIC_LEVEL_POLICY,
    isScoredValue,
    roundScore2,
} from '../../utils/rubricLevelPolicy';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const isCouncilMemberActiveScorer = (member, council) => {
    if (!member) return false;
    if (member.isActive === false) return false;
    if (member.isScoringMember === false) return false;
    if (member.roleInCouncil === 'MEMBER') {
        if (council?.allowFourthScoringMember === false) return false;
        return member.isScoringMember === true;
    }
    if (['CHAIRMAN', 'SECRETARY', 'REVIEWER'].includes(member.roleInCouncil)) {
        return member.isScoringMember !== false;
    }
    return member.isScoringMember !== false;
};

const getRowScorerSummary = (row) => {
    const council = row?.council || row?.defenseCouncil || null;
    const councilMembers = Array.isArray(council?.members) ? council.members : [];
    const inactiveOrNonScoringLecturerIds = new Set(
        councilMembers
            .filter((m) => !isCouncilMemberActiveScorer(m, council))
            .map((m) => m.lecturerId)
            .filter((id) => id !== undefined && id !== null)
    );
    const activeCouncilMembers = councilMembers.filter((m) => isCouncilMemberActiveScorer(m, council));

    const rawMemberScores = Array.isArray(row?.memberScores) ? row.memberScores : [];
    const effectiveMemberScores = rawMemberScores.filter((m) => {
        if (!m) return false;
        if (m.isEffective === false || m.isActive === false || m.isScoringMember === false) return false;
        if (m.evaluatorId !== undefined && m.evaluatorId !== null && inactiveOrNonScoringLecturerIds.has(m.evaluatorId)) {
            return false;
        }
        return true;
    });

    const explicitTotal = row?.activeScorerCount ?? row?.totalScorers;
    const totalScorers = (explicitTotal !== null && explicitTotal !== undefined && Number.isFinite(Number(explicitTotal)) && Number(explicitTotal) > 0)
        ? Number(explicitTotal)
        : (activeCouncilMembers.length > 0
            ? activeCouncilMembers.length
            : (effectiveMemberScores.length > 0 ? Math.max(3, effectiveMemberScores.length) : 3));

    const explicitLocked = row?.lockedScorerCount ?? row?.lockedScoreCount;
    const lockedCount = (explicitLocked !== null && explicitLocked !== undefined && Number.isFinite(Number(explicitLocked)) && Number(explicitLocked) >= 0)
        ? Number(explicitLocked)
        : effectiveMemberScores.filter((m) => m.scoreLocked).length;

    const allLocked = totalScorers > 0 && lockedCount >= totalScorers;

    return {
        effectiveMemberScores,
        lockedCount,
        totalScorers,
        allLocked,
    };
};

const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
};

const getGradeClassification = (score) => {
    if (score === null || score === undefined || isNaN(score)) {
        return { code: '—', label: 'Chưa có điểm', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    const num = Number(score);
    if (num >= 8.5) return { code: 'A', label: 'Loại A · Giỏi', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (num >= 7.0) return { code: 'B', label: 'Loại B · Khá', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' };
    if (num >= 5.5) return { code: 'C', label: 'Loại C · Trung bình', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { code: 'F', label: 'Loại F · Không đạt', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
};

export default function GradingDefensePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const permissionSet = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
    const canSubmitScore = permissionSet.has('DEFENSE_SCORE_SUBMIT');
    const canLockResult = permissionSet.has('RESULT_LOCK');
    const canApproveResult = permissionSet.has('DEFENSE_RESULT_APPROVE');
    const canPublishResult = permissionSet.has('RESULT_PUBLICATION_PUBLISH');
    const canViewPublications = canPublishResult || permissionSet.has('VIEW_RESULT_PUBLICATIONS');
    const canReadLedger = ['DEFENSE_SCORE_VIEW', 'VIEW_DEFENSE_LOCK_LEDGER', 'VIEW_RESULT_LOCKS', 'VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL', 'DEFENSE_RESULT_APPROVE'].some((permission) => permissionSet.has(permission));
    const canRemindGrading = permissionSet.has('DEFENSE_SCORE_VIEW');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'COMPLETED', 'AWAITING_GRADING', 'discrepancy'

    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState(() => {
        const raw = searchParams.get('semesterId');
        const parsed = raw ? Number(raw) : undefined;
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    });
    const [selectedProjectCatalogId, setSelectedProjectCatalogId] = useState(() => {
        const raw = searchParams.get('projectCatalogId');
        const parsed = raw ? Number(raw) : undefined;
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    });
    const [selectedCouncilId, setSelectedCouncilId] = useState(undefined);
    const [selectedGradeFilter, setSelectedGradeFilter] = useState(undefined);
    const [onlyDiscrepancy, setOnlyDiscrepancy] = useState(false);

    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [lockingId, setLockingId] = useState(null);
    const [approvingId, setApprovingId] = useState(null);
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const isPublicationModalOpen = publishModalOpen;
    const setIsPublicationModalOpen = setPublishModalOpen;
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [selectedRegForReturn, setSelectedRegForReturn] = useState(null);
    const [reopenMemberIds, setReopenMemberIds] = useState([]);
    const [returnReason, setReturnReason] = useState('');
    const [returnLoading, setReturnLoading] = useState(false);

    // ScoreBook return logs state
    const [returnHistoryModalVisible, setReturnHistoryModalVisible] = useState(false);
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [selectedRegForSummary, setSelectedRegForSummary] = useState(null);
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
    const [selectedRegForDossier, setSelectedRegForDossier] = useState(null);
    // Rubric Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [drawerError, setDrawerError] = useState(null);
    const [scoreSaving, setScoreSaving] = useState(false);
    const [memberLocking, setMemberLocking] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [scoreSheetRegistration, setScoreSheetRegistration] = useState(null);
    const [rubricCategories, setRubricCategories] = useState([]);
    const [rubricInfo, setRubricInfo] = useState({
        version: 'v1',
        title: 'Barem đánh giá bảo vệ đồ án',
        totalMaxScore: 10.0,
        scoreLevelPolicy: DEFAULT_RUBRIC_LEVEL_POLICY,
    });
    const [scoresMap, setScoresMap] = useState({});
    const [commentsMap, setCommentsMap] = useState({});
    const [generalComment, setGeneralComment] = useState('');
    const [scoreLocked, setScoreLocked] = useState(false);
    const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(null);
    const [activeJuryIndex, setActiveJuryIndex] = useState(0);
    const [memberScoresList, setMemberScoresList] = useState([]);
    const [scoreSheetCounts, setScoreSheetCounts] = useState({
        activeScorerCount: null,
        lockedScorerCount: null,
    });

    const scope = queryKeys.scope(user);
    const semesterQuery = useGradingSemesters(scope);
    const semesters = semesterQuery.data?.data || [];
    const projectCatalogsQuery = useProjectCatalogs(scope);
    const projectCatalogs = projectCatalogsQuery.data || [];
    const filters = useMemo(() => ({
        ...(activeTab === 'COMPLETED' || activeTab === 'AWAITING_GRADING' ? { tab: activeTab } : {}),
        ...(selectedSemesterId ? { semesterId: selectedSemesterId } : {}),
        ...(selectedProjectCatalogId ? { projectCatalogId: selectedProjectCatalogId } : {}),
        ...(selectedCouncilId ? { councilId: selectedCouncilId } : {}),
        ...(debouncedSearchText.trim() ? { search: debouncedSearchText.trim() } : {}),
    }), [activeTab, selectedSemesterId, selectedProjectCatalogId, selectedCouncilId, debouncedSearchText]);
    const ledgerEnabled = canReadLedger && Boolean(semesterQuery.data) && (Boolean(selectedSemesterId) || semesters.length === 0);
    const resultsQuery = useDefenseResults(scope, filters, { enabled: ledgerEnabled });
    const approvalsQuery = useResultApprovals(scope, filters, { enabled: ledgerEnabled && searchParams.get('tab') === 'approvals' });
    const approveMutation = useApproveDefenseResult(scope, selectedSemesterId);
    const data = resultsQuery.data?.data || [];
    const meta = resultsQuery.data?.meta || { counts: {}, targetSemester: null, total: 0 };
    const loading = canReadLedger && !semesterQuery.isError && !resultsQuery.data && (semesterQuery.isPending || resultsQuery.isPending);
    const fetchData = resultsQuery.refetch;
    // The ledger already supplies council identities; result viewers must never
    // request the council-management endpoint just to populate an optional filter.
    const councils = useMemo(() => Array.from(new Map(data.filter((row) => row.council?.id)
        .map((row) => [row.council.id, row.council])).values()), [data]);

    const selectedSemesterObj = useMemo(
        () => semesters.find((s) => s.id === selectedSemesterId) || null,
        [semesters, selectedSemesterId]
    );
    const selectedSemesterName = selectedSemesterObj ? formatSemesterLabel(selectedSemesterObj) : undefined;

    const handleSemesterChange = useCallback((nextSemesterId) => {
        setSelectedSemesterId(nextSemesterId);
        setSelectedCouncilId(undefined);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (nextSemesterId) {
                next.set('semesterId', String(nextSemesterId));
            } else {
                next.delete('semesterId');
            }
            return next;
        });
    }, [setSearchParams]);

    const handleOpenPublicationModal = useCallback(() => {
        if (!selectedSemesterId) {
            message.warning('Vui lòng chọn học kỳ trước khi công bố kết quả.');
            return;
        }
        setIsPublicationModalOpen(true);
    }, [selectedSemesterId]);

    const handleClosePublicationModal = useCallback(() => {
        setIsPublicationModalOpen(false);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (next.get('tab') === 'publish') {
                next.delete('tab');
            }
            return next;
        });
    }, [setSearchParams]);

    const handleTabChange = useCallback((targetTab) => {
        if (targetTab === 'approvals') {
            setActiveTab('all');
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', 'approvals');
                return next;
            });
        } else if (targetTab === 'all') {
            setActiveTab('all');
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('tab');
                return next;
            });
        } else {
            setActiveTab(targetTab);
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', targetTab);
                return next;
            });
        }
    }, [setSearchParams]);

    // Semester lookup is shared and retryable rather than a mount-only effect.
    useEffect(() => {
        const list = semesterQuery.data?.data || [];
        const preferred = list.find((item) => ['DEFENSE', 'ONGOING', 'REGISTRATION'].includes(item.status));
        const targetId = preferred?.id || list[0]?.id || resultsQuery.data?.meta?.targetSemester?.id;
        if (targetId) setSelectedSemesterId((previous) => previous || targetId);
    }, [semesterQuery.data, resultsQuery.data]);

    // Synchronize tab with URL search parameters (do not auto-open modal on ?tab=publish)
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'approvals' || tab === 'publish') {
            setActiveTab('all');
        } else if (tab === 'COMPLETED' || tab === 'AWAITING_GRADING' || tab === 'discrepancy') {
            setActiveTab(tab);
        } else if (!tab) {
            setActiveTab((prev) => (prev === 'all' ? prev : 'all'));
        }
    }, [searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchText(searchText), 350);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        setSelectedRowKeys([]);
    }, [filters]);

    // evaluationService.getScoreBookReturnLogs(councilId)
    const returnLogsQuery = useScoreBookReturnLogs(scope, selectedCouncilId, Boolean(selectedCouncilId && canLockResult));
    const returnLogs = returnLogsQuery.data || [];
    const loadingReturnLogs = returnLogsQuery.isPending && returnLogsQuery.fetchStatus !== 'idle';
    const fetchReturnLogs = useCallback(async (councilId) => {
        if (!councilId) return;
        await returnLogsQuery.refetch();
    }, [returnLogsQuery]);

    const returnHistoryColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 50,
            align: 'center',
            render: (_t, _r, index) => <span className="text-slate-600 font-medium">{index + 1}</span>,
        },
        {
            title: 'Sinh viên',
            key: 'student',
            width: 180,
            render: (_text, item) => {
                const sName = item.registration?.student?.fullName || 'N/A';
                const sCode = item.registration?.student?.studentCode || item.registration?.student?.code || 'N/A';
                return (
                    <div>
                        <div className="font-bold text-slate-800">{sName}</div>
                        <div className="text-xs text-slate-500 font-mono">{sCode}</div>
                    </div>
                );
            },
        },
        {
            title: 'Đề tài',
            key: 'topic',
            render: (_text, item) => (
                <span className="text-slate-700 text-xs font-medium">
                    {item.registration?.topic?.title || 'Không có đề tài'}
                </span>
            ),
        },
        {
            title: 'Phiên bản sổ',
            key: 'version',
            width: 130,
            align: 'center',
            render: (_text, item) => (
                <Tag color="volcano" className="font-mono font-bold">
                    {`v${item.fromLedgerVersion} → v${item.toLedgerVersion}`}
                </Tag>
            ),
        },
        {
            title: 'Lý do hoàn trả',
            dataIndex: 'reason',
            key: 'reason',
            render: (reason) => <span className="text-slate-700 text-xs">{reason || '—'}</span>,
        },
        {
            title: 'Người thực hiện',
            key: 'returnedByAdmin',
            width: 160,
            render: (_text, item) => (
                <div>
                    <div className="font-semibold text-slate-800 text-xs">
                        {item.returnedByAdmin?.fullName || '—'}
                    </div>
                    {item.returnedByAdmin?.email && (
                        <div className="text-[11px] text-slate-500">{item.returnedByAdmin.email}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Thời gian',
            dataIndex: 'returnedAt',
            key: 'returnedAt',
            width: 140,
            render: (returnedAt) => (
                <span className="text-slate-500 text-xs">
                    {returnedAt ? dayjs(returnedAt).format('DD/MM/YYYY HH:mm') : '—'}
                </span>
            ),
        },
    ];

    // KPI Metrics
    const metrics = useMemo(() => {
        let total = data.length;
        let gradedCount = 0;
        let lockedCount = 0;
        let sumScore = 0;
        let validScores = 0;
        let excellentCount = 0;
        let discrepancyCount = 0;
        let awaitingApprovalCount = 0;
        let approvedOrPublishedCount = 0;

        data.forEach((r) => {
            if (r.status === 'AWAITING_FINAL_APPROVAL') {
                awaitingApprovalCount++;
            }
            if (r.scoreLocked) {
                lockedCount++;
            }
            if (
                r.isPublished
                || r.resultPublishedAt
                || r.defenseResult?.isPublished
                || r.defenseResult?.publishedAt
                || r.status === 'COMPLETED'
                || r.status === 'ARCHIVED'
                || r.status === 'DEFENSE_PASSED'
                || r.status === 'APPROVED_FOR_GRADUATION'
                || r.defenseResult?.approvalStatus === 'APPROVED'
            ) {
                approvedOrPublishedCount++;
            }
            if (r.gradingStatus === 'GRADED' || r.finalScore !== null) {
                gradedCount++;
            }
            if (r.finalScore !== null && !isNaN(r.finalScore)) {
                const s = Number(r.finalScore);
                sumScore += s;
                validScores++;
                if (s >= 8.5) excellentCount++;
            }

            const memberScores = r.memberScores || [];
            const scores = memberScores.map((m) => Number(m.finalScore)).filter((n) => Number.isFinite(n));
            if (scores.length >= 2) {
                const delta = Math.max(...scores) - Math.min(...scores);
                if (delta >= 1.5) discrepancyCount++;
            }
        });

        const avgScore = validScores > 0 ? (sumScore / validScores).toFixed(2) : '—';
        return {
            total,
            gradedCount,
            lockedCount,
            avgScore,
            excellentCount,
            discrepancyCount,
            awaitingApprovalCount,
            approvedOrPublishedCount,
        };
    }, [data]);

    // Filtered Rows
    const filteredData = useMemo(() => {
        const rows = searchParams.get('tab') === 'approvals' ? (approvalsQuery.data?.data || []) : data;
        return rows.filter((r) => {
            // Tab or checkbox filter for discrepancy
            if (activeTab === 'discrepancy' || onlyDiscrepancy) {
                const memberScores = r.memberScores || [];
                const scores = memberScores.map((m) => Number(m.finalScore)).filter((n) => Number.isFinite(n));
                const delta = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
                if (delta < 1.5) return false;
            }

            // Grade filter
            if (selectedGradeFilter) {
                const score = Number(r.finalScore);
                if (isNaN(score)) return false;
                if (selectedGradeFilter === 'A' && score < 8.5) return false;
                if (selectedGradeFilter === 'B' && (score < 7.0 || score >= 8.5)) return false;
                if (selectedGradeFilter === 'C' && score >= 7.0) return false;
            }

            return true;
        });
    }, [data, approvalsQuery.data, activeTab, onlyDiscrepancy, selectedGradeFilter, searchParams]);

    // Batch Remind
    const handleRemindGrading = async () => {
        if (!selectedRowKeys.length) {
            message.warning('Vui lòng chọn ít nhất 1 đề tài');
            return;
        }
        try {
            const res = await evaluationService.remindDefenseGrading(selectedRowKeys);
            if (res.success) {
                message.success(res.message || `Đã gửi nhắc chấm điểm cho ${selectedRowKeys.length} đề tài`);
                setSelectedRowKeys([]);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể gửi nhắc chấm điểm');
        }
    };

    // Lock/Unlock single registration score
    const handleScoreLock = async (registrationId, action) => {
        try {
            setLockingId(registrationId);
            const res = await evaluationService.setDefenseScoreLock(registrationId, action);
            if (res.success) {
                message.success(res.message || (action === 'LOCK' ? 'Đã khóa điểm bảo vệ' : 'Đã mở khóa điểm bảo vệ'));
                fetchData();
            }
        } catch (err) {
            message.error(err?.message || 'Thao tác thất bại');
        } finally {
            setLockingId(null);
        }
    };

    const handleApproveResult = (registrationId, outcome) => {
        if (!canApproveResult) return;
        Modal.confirm({
            title: outcome === 'PASSED' ? 'Phê duyệt kết quả đạt' : 'Phê duyệt kết quả không đạt',
            content: 'Quyết định này tạo bản ghi audit bất biến cho hồ sơ. Kết quả chỉ hiển thị cho sinh viên sau khi được công bố theo học kỳ.',
            okText: 'Xác nhận phê duyệt',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    setApprovingId(registrationId);
                    const result = await approveMutation.mutateAsync({ registrationId, outcome });
                    message.success(result.message || 'Đã phê duyệt kết quả.');
                } catch (err) {
                    message.error(err?.message || 'Không thể phê duyệt kết quả.');
                } finally {
                    setApprovingId(null);
                }
            },
        });
    };

    const handlePublishResults = () => {
        if (!selectedSemesterId) {
            message.warning('Vui lòng chọn học kỳ trước khi công bố kết quả.');
            return;
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'publish');
            return next;
        });
        handleOpenPublicationModal();
    };

    const handleOpenPublicationHistory = () => {
        if (!selectedSemesterId) {
            message.warning('Vui lòng chọn học kỳ trước khi xem lịch sử công bố.');
            return;
        }
        setHistoryModalOpen(true);
    };

    const handleOpenReturnModal = (registration) => {
        setSelectedRegForReturn(registration);
        setReopenMemberIds(
            (registration?.memberScores || [])
                .map((m) => m?.id)
                .filter((id) => Number.isInteger(id) && id > 0)
        );
        setReturnReason('');
        setReturnModalOpen(true);
    };

    const handleConfirmReturnScoreBook = async () => {
        if (!selectedRegForReturn) return;
        const regId = selectedRegForReturn.registrationId || selectedRegForReturn.id;
        if (!regId) {
            message.error('Không tìm thấy mã hồ sơ đăng ký hợp lệ.');
            return;
        }
        if (!returnReason.trim()) {
            message.warning('Bắt buộc nhập lý do trả sổ điểm.');
            return;
        }
        const validReopenIds = reopenMemberIds.filter((id) => Number.isInteger(id) && id > 0);
        if (!validReopenIds.length) {
            message.warning('Vui lòng chọn ít nhất 1 phiếu thành viên cần mở lại.');
            return;
        }
        try {
            setReturnLoading(true);
            const res = await evaluationService.returnScoreBook(regId, {
                reason: returnReason.trim(),
                reopenMemberScoreIds: validReopenIds,
            });
            if (res.success) {
                message.success('Đã trả sổ điểm về Hội đồng thành công!');
                setReturnModalOpen(false);
                setSelectedRegForReturn(null);
                fetchData();
                if (selectedCouncilId) {
                    fetchReturnLogs(selectedCouncilId);
                }
            } else {
                message.error(res.message || 'Không thể trả sổ điểm.');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi trả sổ điểm');
        } finally {
            setReturnLoading(false);
        }
    };

    // Load score sheet into drawer
    const loadScoreSheet = useCallback(async (registrationId, evaluatorId = undefined) => {
        try {
            setDrawerLoading(true);
            setDrawerError(null);
            const params = evaluatorId ? { evaluatorId } : {};
            const res = await evaluationService.getScoreSheet(registrationId, params);
            if (!res?.success) {
                throw new Error(res?.message || 'Không thể tải bảng điểm chi tiết');
            }

            const payload = res.data || {};
            const rubric = payload.rubric || {};
            let rawCategories = rubric.categories || [];
            if (!rawCategories.length && rubric.criteria?.length) {
                rawCategories = [
                    {
                        code: 'DEFAULT_CAT',
                        name: 'Tiêu chuẩn đánh giá',
                        maxScore: rubric.totalMaxScore || 10.0,
                        criteria: rubric.criteria,
                    },
                ];
            }

            const normalizedCategories = rawCategories.map((cat) => ({
                ...cat,
                criteria: (cat.criteria || []).map((cri) => ({
                    ...cri,
                    label: cri.label || cri.name || cri.code,
                    name: cri.name || cri.label || cri.code,
                    cloCode: cri.cloCode || null,
                })),
            }));

            const nextScoresMap = {};
            const nextCommentsMap = {};
            (payload.scores || []).forEach((item) => {
                if (item?.criterionCode) {
                    nextScoresMap[item.criterionCode] = isScoredValue(item.score) ? Number(item.score) : null;
                    nextCommentsMap[item.criterionCode] = item.comment || '';
                }
            });

            const members = payload.memberScores || [];
            const targetEvalId = evaluatorId || payload.currentEvaluator?.id || members[0]?.evaluatorId || null;
            const summaryForMembers = getRowScorerSummary({
                registrationId,
                council: payload.registration?.council || payload.registration?.defenseCouncil,
                memberScores: members,
                activeScorerCount: payload.activeScorerCount,
                lockedScorerCount: payload.lockedScorerCount,
            });
            const matchedIdx = summaryForMembers.effectiveMemberScores.findIndex((m) => m.evaluatorId === targetEvalId);

            setScoreSheetRegistration((prev) => {
                const incoming = payload.registration || null;
                if (!incoming) return prev;
                const prevId = prev?.registrationId || prev?.id;
                const incomingId = incoming.registrationId || incoming.id;
                if (prev && prevId && incomingId && String(prevId) === String(incomingId)) {
                    return {
                        ...prev,
                        ...incoming,
                        student: incoming.student || prev.student,
                        topic: incoming.topic || prev.topic,
                        mentor: incoming.mentor || prev.mentor,
                        council: incoming.council || prev.council,
                    };
                }
                return incoming;
            });
            setRubricInfo({
                version: rubric.version || 'v1',
                title: rubric.title || 'Barem đánh giá bảo vệ đồ án',
                totalMaxScore: rubric.totalMaxScore || 10.0,
                scoreLevelPolicy: rubric.scoreLevelPolicy || DEFAULT_RUBRIC_LEVEL_POLICY,
            });
            setRubricCategories(normalizedCategories);
            setScoresMap(nextScoresMap);
            setCommentsMap(nextCommentsMap);
            setGeneralComment(payload.defenseResult?.comments || '');
            setScoreLocked(Boolean(payload.scoreLocked));
            setMemberScoresList(members);
            setScoreSheetCounts({
                activeScorerCount: payload.activeScorerCount ?? null,
                lockedScorerCount: payload.lockedScorerCount ?? null,
            });
            setSelectedEvaluatorId(targetEvalId);
            setActiveJuryIndex(matchedIdx >= 0 ? matchedIdx : 0);
        } catch (err) {
            const errMsg = err?.message || 'Không thể tải bảng điểm chi tiết';
            setDrawerError(errMsg);
            message.error(errMsg);
        } finally {
            setDrawerLoading(false);
        }
    }, []);

    const openRubricDrawer = (registration) => {
        setScoreSheetRegistration(registration);
        setRubricCategories([]);
        setScoresMap({});
        setCommentsMap({});
        setGeneralComment('');
        setScoreLocked(false);
        setDrawerError(null);
        setScoreSheetCounts({
            activeScorerCount: registration.activeScorerCount ?? registration.totalScorers ?? null,
            lockedScorerCount: registration.lockedScorerCount ?? registration.lockedScoreCount ?? null,
        });
        setDrawerOpen(true);
        loadScoreSheet(registration.registrationId || registration.id);
    };

    const closeRubricDrawer = () => {
        setDrawerOpen(false);
        setScoreSheetRegistration(null);
        setDrawerError(null);
    };

    const allCriteria = useMemo(
        () => rubricCategories.flatMap((cat) => cat.criteria || []),
        [rubricCategories]
    );

    const activeScoredCount = useMemo(
        () => allCriteria.filter((cri) => isScoredValue(scoresMap[cri.code])).length,
        [allCriteria, scoresMap]
    );

    // Calculated Drawer Total Score for Active Evaluator
    const activeEvaluatorScore = useMemo(() => {
        const sum = allCriteria.reduce((acc, cri) => {
            const val = scoresMap[cri.code];
            return acc + (isScoredValue(val) ? Number(val) : 0);
        }, 0);
        return roundScore2(sum);
    }, [allCriteria, scoresMap]);

    const isSheetCompleted = useMemo(() => {
        if (!allCriteria.length) return false;
        return allCriteria.every((cri) => isScoredValue(scoresMap[cri.code]));
    }, [allCriteria, scoresMap]);

    const drawerScorerSummary = useMemo(() => {
        return getRowScorerSummary({
            ...(scoreSheetRegistration || {}),
            memberScores: memberScoresList,
            activeScorerCount: scoreSheetCounts.activeScorerCount ?? scoreSheetRegistration?.activeScorerCount,
            lockedScorerCount: scoreSheetCounts.lockedScorerCount ?? scoreSheetRegistration?.lockedScorerCount,
        });
    }, [scoreSheetRegistration, memberScoresList, scoreSheetCounts]);

    // Check discrepancy in drawer
    const drawerDiscrepancy = useMemo(() => {
        const scores = drawerScorerSummary.effectiveMemberScores
            .map((m) => Number(m.finalScore))
            .filter((n) => Number.isFinite(n));
        if (scores.length < 2) return 0;
        return round2(Math.max(...scores) - Math.min(...scores));
    }, [drawerScorerSummary.effectiveMemberScores]);

    // Calculated Final Composite Score: Trung bình cộng các điểm của thành viên Hội đồng hợp lệ
    const finalCompositeScore = useMemo(() => {
        const scores = drawerScorerSummary.effectiveMemberScores
            .map((m) => Number(m.finalScore))
            .filter((n) => Number.isFinite(n));
        if (scores.length > 0) {
            return round2(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }
        if (activeScoredCount > 0) return activeEvaluatorScore;
        return scoreSheetRegistration?.finalScore !== null && scoreSheetRegistration?.finalScore !== undefined
            ? Number(scoreSheetRegistration.finalScore)
            : 0;
    }, [drawerScorerSummary.effectiveMemberScores, activeScoredCount, activeEvaluatorScore, scoreSheetRegistration]);

    // Save score sheet (supports empty/partial draft without fabricating zeroes)
    const handleSaveScoreSheet = async () => {
        if (!scoreSheetRegistration || scoreLocked) return;
        try {
            setScoreSaving(true);
            const scoredCriteria = allCriteria.filter((cri) => isScoredValue(scoresMap[cri.code]));
            const payload = {
                scores: scoredCriteria.map((cri) => ({
                    criterionCode: cri.code,
                    score: Number(scoresMap[cri.code]),
                    comment: commentsMap[cri.code] || undefined,
                })),
                generalComment: generalComment ? generalComment.trim() : '',
                evaluatorId: selectedEvaluatorId || undefined,
            };
            const regId = scoreSheetRegistration.registrationId || scoreSheetRegistration.id;
            const res = await evaluationService.saveScoreSheet(regId, payload);
            if (res.success) {
                if (scoredCriteria.length === allCriteria.length && allCriteria.length > 0) {
                    message.success('Đã lưu phiếu điểm số thành công!');
                } else {
                    message.success(`Đã lưu nháp ${scoredCriteria.length}/${allCriteria.length} tiêu chí thành công!`);
                }
                setMemberScoresList((prev) => prev.map((m) => (
                    m.evaluatorId === selectedEvaluatorId
                        ? { ...m, finalScore: scoredCriteria.length > 0 ? activeEvaluatorScore : null }
                        : m
                )));
                fetchData();
            }
        } catch (err) {
            message.error(err?.message || 'Không thể lưu bảng điểm');
        } finally {
            setScoreSaving(false);
        }
    };

    const handleLockMemberScoreSheet = async () => {
        if (!scoreSheetRegistration || scoreLocked) return;
        if (!isSheetCompleted) {
            message.warning('Vui lòng nhập đầy đủ điểm cho tất cả các tiêu chí trước khi khóa phiếu.');
            return;
        }
        const regId = scoreSheetRegistration.registrationId || scoreSheetRegistration.id;
        try {
            setMemberLocking(true);
            const payload = {
                registrationId: Number(regId),
                evaluatorId: selectedEvaluatorId || undefined,
                scores: allCriteria.map((cri) => ({
                    criterionCode: cri.code,
                    score: Number(scoresMap[cri.code]),
                    comment: commentsMap[cri.code] || undefined,
                })),
                generalComment: generalComment ? generalComment.trim() : '',
                targetRubricVersion: rubricInfo?.version || 'v1',
            };
            const res = await evaluationService.lockMemberScoreSheet(payload);
            if (res?.success) {
                setScoreLocked(true);
                const wasAlreadyLocked = memberScoresList.some(
                    (m) => m.evaluatorId === selectedEvaluatorId && m.scoreLocked
                );
                setMemberScoresList((prev) => prev.map((m) => (
                    m.evaluatorId === selectedEvaluatorId
                        ? { ...m, finalScore: activeEvaluatorScore, scoreLocked: true }
                        : m
                )));
                if (!wasAlreadyLocked && scoreSheetCounts.lockedScorerCount !== null && scoreSheetCounts.lockedScorerCount !== undefined) {
                    setScoreSheetCounts((prev) => ({
                        ...prev,
                        lockedScorerCount: Number(prev.lockedScorerCount) + 1,
                    }));
                }
                message.success('Đã nộp và khóa phiếu chấm thành công!');
                fetchData();
            }
        } catch (err) {
            message.error(err?.message || 'Không thể khóa phiếu chấm');
        } finally {
            setMemberLocking(false);
        }
    };

    const handleExportBM05Pdf = async () => {
        if (!scoreSheetRegistration) return;
        const regId = scoreSheetRegistration.registrationId || scoreSheetRegistration.id;
        try {
            setIsExportingPdf(true);
            const res = await evaluationService.exportScoreSheetPdf(regId, {
                evaluatorId: selectedEvaluatorId,
            });
            const fileUrl = res?.data?.pdfUrl || res?.data?.fileUrl || res?.pdfUrl || res?.fileUrl;
            if (fileUrl) {
                window.open(fileUrl, '_blank');
                message.success('Đã xuất Biên bản bảo vệ BM05 PDF thành công!');
            } else {
                message.error(res?.message || 'Không tìm thấy đường dẫn file PDF xuất ra');
            }
        } catch (err) {
            message.error(err?.message || 'Không thể xuất Biên bản bảo vệ BM05 PDF');
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Select row handling
    const toggleSelectRow = (id) => {
        setSelectedRowKeys((prev) =>
            prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRowKeys.length === filteredData.length) {
            setSelectedRowKeys([]);
        } else {
            setSelectedRowKeys(filteredData.map((r) => r.registrationId || r.id));
        }
    };

    const isApprovalsTab = searchParams.get('tab') === 'approvals';

    const handleResetFilters = () => {
        setSearchText('');
        setSelectedProjectCatalogId(undefined);
        setSelectedCouncilId(undefined);
        setSelectedGradeFilter(undefined);
        setOnlyDiscrepancy(false);
        handleTabChange('all');
    };

    return (
        <div className="space-y-5 pb-6" data-od-id="view-grading">
            {/* Header Card */}
            <header className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div
                            className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200/80 text-[#0F766E] flex items-center justify-center text-xl shrink-0 mt-0.5"
                            aria-hidden="true"
                        >
                            <TrophyOutlined />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight m-0 leading-snug">
                                    Sổ điểm bảo vệ &amp; Công bố kết quả
                                </h1>
                                {selectedSemesterName && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-[#0F766E] border border-teal-200/80">
                                        {selectedSemesterName}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 m-0 leading-relaxed">
                                Quản lý sổ điểm hội đồng, kiểm soát lệch điểm giám khảo, phê duyệt kết quả và ban hành công bố học kỳ.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2.5 shrink-0">
                        {canReadLedger && (
                            <Button
                                icon={<ReloadOutlined aria-hidden="true" />}
                                onClick={() => fetchData()}
                                loading={resultsQuery.isFetching}
                                disabled={!ledgerEnabled}
                                className="font-medium"
                            >
                                Làm mới
                            </Button>
                        )}
                        {canViewPublications && (
                            <Button
                                icon={<HistoryOutlined aria-hidden="true" />}
                                onClick={handleOpenPublicationHistory}
                                className="font-medium"
                            >
                                Lịch sử công bố
                            </Button>
                        )}
                        {canViewPublications && (
                            <Button
                                type="primary"
                                icon={<SafetyCertificateOutlined aria-hidden="true" />}
                                onClick={handlePublishResults}
                                className="!bg-[#0F766E] hover:!bg-[#115E59] font-semibold shadow-xs"
                            >
                                {canPublishResult ? 'Công bố kết quả học kỳ' : 'Xem trước công bố kết quả'}
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {semesterQuery.isError && <QueryErrorState error={semesterQuery.error} onRetry={() => semesterQuery.refetch()} retrying={semesterQuery.isFetching} />}
            {canReadLedger && <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" data-od-id="grading-kpi-grid">
                <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Tổng hồ sơ
                        </div>
                        <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                            {metrics.total}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            <span className="font-mono tabular-nums font-semibold text-slate-700">{metrics.gradedCount}</span> hồ sơ đã có điểm
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center shrink-0 text-sky-700 text-lg">
                        <FileTextOutlined />
                    </div>
                </div>

                <div className="rounded-2xl bg-white border border-teal-200/80 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Đã khóa sổ
                        </div>
                        <div className="text-2xl font-bold text-[#0F766E] mt-1 font-mono tabular-nums">
                            {metrics.lockedCount}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            <span className="font-mono tabular-nums font-semibold text-[#0F766E]">
                                {metrics.total > 0 ? Math.round((metrics.lockedCount / metrics.total) * 100) : 0}%
                            </span>{' '}
                            hoàn tất khóa điểm
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center shrink-0 text-[#0F766E] text-lg">
                        <LockOutlined />
                    </div>
                </div>

                <div className="rounded-2xl bg-white border border-emerald-200/80 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Chờ phê duyệt
                        </div>
                        <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums">
                            {metrics.awaitingApprovalCount}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Điểm TB toàn khóa · <span className="font-mono tabular-nums font-semibold text-slate-700">{metrics.avgScore}</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 text-emerald-700 text-lg">
                        <CheckCircleOutlined />
                    </div>
                </div>

                <div className="rounded-2xl bg-white border border-rose-200/80 p-4 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                            Cảnh báo lệch điểm
                        </div>
                        <div className="text-2xl font-bold text-rose-700 mt-1 font-mono tabular-nums">
                            {metrics.discrepancyCount}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Độ lệch giám khảo từ <span className="font-mono tabular-nums font-semibold text-rose-700">1.5</span> điểm
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0 text-rose-600 text-lg">
                        <WarningOutlined />
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 space-y-3" data-od-id="grading-filter-strip">
                {/* Row 1: Responsive Faceted Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                    <div className="lg:col-span-3">
                        <Select
                            aria-label="Chọn đợt học kỳ"
                            className="w-full"
                            value={selectedSemesterId}
                            onChange={handleSemesterChange}
                            loading={semesterQuery.isPending}
                            disabled={semesters.length === 0}
                            placeholder="Chọn đợt học kỳ"
                            options={semesters.map((s) => ({
                                value: s.id,
                                label: formatSemesterLabel(s),
                            }))}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <Select
                            aria-label="Lọc theo loại đồ án"
                            className="w-full"
                            allowClear
                            value={selectedProjectCatalogId}
                            onChange={(val) => setSelectedProjectCatalogId(val || undefined)}
                            loading={projectCatalogsQuery.isPending}
                            placeholder="Tất cả loại đồ án"
                            options={projectCatalogs.map((cat) => ({
                                value: cat.id,
                                label: cat.name,
                            }))}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <Select
                            aria-label="Lọc theo hội đồng"
                            className="w-full"
                            allowClear
                            value={selectedCouncilId}
                            onChange={(val) => setSelectedCouncilId(val || undefined)}
                            placeholder="Tất cả hội đồng"
                            options={councils.map((c) => ({
                                value: c.id,
                                label: c.location ? `${c.name} · ${c.location}` : c.name,
                            }))}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <Select
                            aria-label="Lọc theo xếp loại"
                            className="w-full"
                            allowClear
                            value={selectedGradeFilter}
                            onChange={(val) => setSelectedGradeFilter(val || undefined)}
                            placeholder="Tất cả xếp loại"
                            options={[
                                { value: 'A', label: 'Loại A · Giỏi' },
                                { value: 'B', label: 'Loại B · Khá' },
                                { value: 'C', label: 'Loại C · Trung bình' },
                            ]}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <Input
                            allowClear
                            prefix={<SearchOutlined className="text-slate-400" aria-hidden="true" />}
                            placeholder="Tìm MSSV, họ tên, đề tài..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    <div className="lg:col-span-1 flex justify-end">
                        <Button
                            icon={<FilterOutlined aria-hidden="true" />}
                            onClick={handleResetFilters}
                            className="w-full"
                            title="Đặt lại toàn bộ bộ lọc"
                        >
                            Đặt lại
                        </Button>
                    </div>
                </div>

                {/* Row 2: Status Pill Bar & Compact Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                        {[
                            {
                                key: 'all',
                                label: 'Tất cả',
                                count: metrics.total,
                                active: activeTab === 'all' && !isApprovalsTab,
                                countClass: 'text-slate-700',
                            },
                            {
                                key: 'COMPLETED',
                                label: 'Đã chốt sổ',
                                count: meta.counts?.COMPLETED ?? metrics.lockedCount,
                                active: activeTab === 'COMPLETED' && !isApprovalsTab,
                                countClass: 'text-emerald-700',
                            },
                            {
                                key: 'AWAITING_GRADING',
                                label: 'Đang chấm',
                                count: meta.counts?.AWAITING_GRADING ?? Math.max(0, metrics.total - metrics.gradedCount),
                                active: activeTab === 'AWAITING_GRADING' && !isApprovalsTab,
                                countClass: 'text-amber-700',
                            },
                            {
                                key: 'discrepancy',
                                label: 'Cảnh báo lệch điểm',
                                count: metrics.discrepancyCount,
                                active: activeTab === 'discrepancy' && !isApprovalsTab,
                                countClass: 'text-rose-700',
                            },
                            {
                                key: 'approvals',
                                label: 'Chờ phê duyệt',
                                count: metrics.awaitingApprovalCount,
                                active: isApprovalsTab,
                                countClass: 'text-[#0F766E]',
                            },
                        ].map((tabItem) => (
                            <button
                                key={tabItem.key}
                                type="button"
                                onClick={() => handleTabChange(tabItem.key)}
                                className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                    tabItem.active
                                        ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-xs'
                                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                                }`}
                            >
                                <span>{tabItem.label}</span>
                                <span
                                    className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-full ${
                                        tabItem.active ? 'bg-white/20 text-white' : `bg-white ${tabItem.countClass}`
                                    }`}
                                >
                                    {tabItem.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Checkbox
                            checked={onlyDiscrepancy}
                            onChange={(e) => setOnlyDiscrepancy(e.target.checked)}
                            className="text-xs text-slate-600"
                        >
                            Chỉ hiện lệch điểm
                        </Checkbox>
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
                            Hiển thị <strong className="text-slate-800">{filteredData.length}</strong> / {metrics.total} hồ sơ
                        </span>
                    </div>
                </div>
            </section>

            {returnLogs.length > 0 && (
                <div>
                    <Alert
                        title="Hội đồng có lượt hoàn trả sổ điểm"
                        description="Hội đồng này đã từng có sổ điểm được hoàn trả để rà soát lại kết quả chấm."
                        type="warning"
                        showIcon
                        action={
                            <Button
                                size="small"
                                icon={<HistoryOutlined />}
                                onClick={() => setReturnHistoryModalVisible(true)}
                            >
                                Lịch sử hoàn trả · {returnLogs.length}
                            </Button>
                        }
                    />
                </div>
            )}

            {/* GRADING DATA TABLE */}
            <ContentRefreshIndicator refreshing={Boolean(resultsQuery.data) && resultsQuery.isFetching} />
            {resultsQuery.isError && resultsQuery.data && <QueryErrorState error={resultsQuery.error} onRetry={() => fetchData()} retrying={resultsQuery.isFetching} />}
            {loading ? <ContentSkeleton variant="table" /> : resultsQuery.isError && !resultsQuery.data ? (
                <QueryErrorState error={resultsQuery.error} onRetry={() => fetchData()} retrying={resultsQuery.isFetching} />
            ) : (resultsQuery.data || !semesterQuery.isError) && (
            <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden" data-od-id="grading-table-container">
                <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left" id="grading-table">
                    <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            <th className="py-3 px-3 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={filteredData.length > 0 && selectedRowKeys.length === filteredData.length}
                                    onChange={toggleSelectAll}
                                    aria-label="Chọn tất cả hồ sơ"
                                />
                            </th>
                            <th className="py-3 px-3.5">Mã &amp; Tên đề tài</th>
                            <th className="py-3 px-3.5">Sinh viên</th>
                            <th className="py-3 px-3.5">Hội đồng</th>
                            <th className="py-3 px-3.5 text-center">Điểm thành viên hội đồng</th>
                            <th className="py-3 px-3 text-center whitespace-nowrap">Điểm trung bình</th>
                            <th className="py-3 px-3 text-center whitespace-nowrap">Điểm tổng kết</th>
                            <th className="py-3 px-3 text-center whitespace-nowrap">Xếp loại</th>
                            <th className="py-3 px-3 whitespace-nowrap">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center py-12 text-sm text-slate-500">
                                    Không có hồ sơ nào phù hợp với bộ lọc hiện tại.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((r) => {
                                const id = r.registrationId || r.id;
                                const isSelected = selectedRowKeys.includes(id);
                                const grade = getGradeClassification(r.finalScore);
                                const {
                                    effectiveMemberScores,
                                    lockedCount,
                                    totalScorers,
                                    allLocked,
                                } = getRowScorerSummary(r);
                                const scores = effectiveMemberScores.map((m) => Number(m.finalScore)).filter((n) => Number.isFinite(n));
                                const delta = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
                                const hasDiscrepancy = delta >= 1.5;

                                return (
                                    <tr
                                        key={id}
                                        className={`transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/70'}`}
                                    >
                                        <td className="py-3 px-3 text-center align-top">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectRow(id)}
                                                aria-label={`Chọn hồ sơ ${r.student?.fullName || id}`}
                                            />
                                        </td>
                                        <td className="py-3 px-3.5 max-w-[290px] align-top">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono tabular-nums font-bold text-[#0F766E] text-[11.5px]">
                                                    {r.topic?.code || `DT-${String(r.topic?.id || r.topicId || r.id || '2026').padStart(3, '0')}`}
                                                </span>
                                                {r.topic?.projectCatalog?.name && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
                                                        {r.topic.projectCatalog.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-semibold text-slate-900 text-[13px] leading-snug mt-1">
                                                {r.topic?.title || '—'}
                                            </div>
                                            <div className="text-[11.5px] text-slate-500 mt-1">
                                                GVHD: <strong className="text-slate-700">{r.mentor?.fullName || 'Chưa phân công'}</strong>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate(`/admin/students/${id}`, {
                                                        state: { from: `${location.pathname}${location.search}` },
                                                    })
                                                }
                                                title="Xem chi tiết quá trình sinh viên"
                                                className="group flex items-center gap-2.5 text-left cursor-pointer bg-transparent border-0 p-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200/80 text-[#0F766E] font-display font-bold text-xs grid place-items-center shrink-0 group-hover:bg-teal-100 transition-colors">
                                                    {r.student?.fullName ? r.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'S'}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="font-semibold text-slate-900 group-hover:text-teal-700 group-hover:underline text-[13px] leading-tight transition-colors">
                                                        {r.student?.fullName || '—'}
                                                    </div>
                                                    <div>
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono tabular-nums text-[11px] font-medium">
                                                            {r.student?.code || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                            {r.council ? (
                                                <div>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200/80 text-xs font-semibold">
                                                        {r.council.name}
                                                    </span>
                                                    <div className="text-[11.5px] text-slate-500 font-mono tabular-nums mt-1">
                                                        {fmtDate(r.council.defenseDate)} {r.council.location && `· ${r.council.location}`}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">
                                                    Chưa gán hội đồng
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3.5 text-center align-top">
                                            <div className="flex gap-1 justify-center flex-wrap items-center">
                                                {effectiveMemberScores.length > 0 ? (
                                                    effectiveMemberScores.map((m, idx) => (
                                                        <span
                                                            key={m.evaluatorId || idx}
                                                            className="text-[11px] font-mono tabular-nums bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 inline-flex items-center gap-1"
                                                        >
                                                            <span>
                                                                {m.evaluator?.fullName ? m.evaluator.fullName.split(' ').slice(-1)[0] : (m.evaluatorName ? m.evaluatorName.split(' ').slice(-1)[0] : `GK${idx + 1}`)}:{' '}
                                                                <strong className="text-slate-900">{m.finalScore ?? '—'}</strong>
                                                            </span>
                                                            {m.scoreLocked ? (
                                                                <span className="text-[9.5px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-sans font-semibold">
                                                                    Đã khóa
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9.5px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-sans font-semibold">
                                                                    Chưa khóa
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Chưa có phiếu</span>
                                                )}
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                                                <span
                                                    data-testid={`row-scorer-counter-${id}`}
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-mono tabular-nums font-semibold border ${
                                                        allLocked
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}
                                                >
                                                    {lockedCount}/{totalScorers} phiếu đã khóa
                                                </span>
                                                {hasDiscrepancy && (
                                                    <Tag
                                                        color="error"
                                                        icon={<ExclamationCircleOutlined />}
                                                        className="m-0 text-[10.5px] font-mono tabular-nums"
                                                    >
                                                        Lệch {delta.toFixed(1)}đ
                                                    </Tag>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                                            {r.attendanceStatus === 'ABSENT' ? (
                                                <Tag color="error" className="m-0 font-semibold">Vắng mặt</Tag>
                                            ) : (
                                                <div className="font-mono tabular-nums text-[13.5px] font-semibold text-slate-700">
                                                    {r.rawAverageScore !== null && r.rawAverageScore !== undefined
                                                        ? Number(r.rawAverageScore).toFixed(2)
                                                        : r.finalScore !== null && r.finalScore !== undefined
                                                        ? Number(r.finalScore).toFixed(2)
                                                        : '—'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                                            {r.attendanceStatus === 'ABSENT' ? (
                                                <Tag color="error" className="m-0 font-semibold">Vắng mặt</Tag>
                                            ) : (
                                                <div className="font-mono tabular-nums text-base font-extrabold text-[#0F766E]">
                                                    {r.roundedFinalScore !== null && r.roundedFinalScore !== undefined
                                                        ? Number(r.roundedFinalScore).toFixed(1)
                                                        : r.finalScore !== null && r.finalScore !== undefined
                                                        ? Number(r.finalScore).toFixed(1)
                                                        : '—'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${grade.badgeClass}`}>
                                                {grade.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 align-top whitespace-nowrap">
                                            {(() => {
                                                const isPublished = Boolean(
                                                    r.isPublished
                                                    || r.resultPublishedAt
                                                    || r.defenseResult?.isPublished
                                                    || r.defenseResult?.publishedAt
                                                    || r.status === 'COMPLETED'
                                                    || r.status === 'ARCHIVED'
                                                );
                                                const isApprovedPass = Boolean(
                                                    r.status === 'DEFENSE_PASSED'
                                                    || r.status === 'APPROVED_FOR_GRADUATION'
                                                    || r.defenseResult?.approvalStatus === 'APPROVED'
                                                );
                                                const isFailed = Boolean(
                                                    r.status === 'DEFENSE_FAILED'
                                                    || r.status === 'FAILED'
                                                    || r.attendanceStatus === 'ABSENT'
                                                );
                                                if (isPublished) {
                                                    return (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Đã công bố
                                                        </span>
                                                    );
                                                }
                                                if (isApprovedPass) {
                                                    return (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-[#0F766E] border border-teal-200">
                                                            Đã duyệt đạt
                                                        </span>
                                                    );
                                                }
                                                if (isFailed) {
                                                    return (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                            Không đạt
                                                        </span>
                                                    );
                                                }
                                                if (r.scoreLocked) {
                                                    return (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                            Đã khóa sổ
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Đang chấm
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </div>
            </section>
            )}

            {/* FLOATING BATCH ACTION BAR */}
            {canRemindGrading && selectedRowKeys.length > 0 && (
                <div className="floating-batch-bar" style={{ display: 'flex' }}>
                    <span className="batch-count-text">
                        Đã chọn: <span className="font-mono tabular-nums font-bold">{selectedRowKeys.length}</span> đề tài
                    </span>
                    <div className="batch-divider" />
                    <Button
                        type="primary"
                        size="small"
                        icon={<BellOutlined />}
                        onClick={handleRemindGrading}
                        className="!bg-[#0F766E] hover:!bg-[#115E59] font-semibold"
                    >
                        Nhắc chấm điểm hội đồng
                    </Button>
                    <div className="batch-divider" />
                    <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => setSelectedRowKeys([])}
                    >
                        Bỏ chọn
                    </Button>
                </div>
            )}
            </>}

            {/* CONTEXT-PRESERVING RUBRIC GRADING DRAWER */}
            {drawerOpen && scoreSheetRegistration && <div className="drawer-overlay" onClick={closeRubricDrawer} />}
            {scoreSheetRegistration && (
            <aside
                aria-hidden={!drawerOpen}
                className={`side-drawer ${drawerOpen ? 'open' : ''}`}
                id="rubric-drawer"
                style={{ width: 740, right: drawerOpen ? 0 : -780, transition: 'right 0.25s ease' }}
                data-od-id="rubric-side-drawer"
            >
                <div className="drawer-header">
                    <div>
                        <span className="eyebrow font-mono tabular-nums" id="rubric-drawer-code">
                            {scoreSheetRegistration?.topic?.code || '—'} · {scoreSheetRegistration?.council?.name || 'HỘI ĐỒNG BẢO VỆ'}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                            <h2 className="font-display text-lg font-bold text-slate-900 m-0">
                                {scoreSheetRegistration?.student?.fullName || '—'}
                            </h2>
                            {scoreSheetRegistration?.student?.code && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono tabular-nums text-xs font-semibold">
                                    {scoreSheetRegistration.student.code}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={closeRubricDrawer}
                        aria-label="Đóng"
                    />
                </div>

                <div className="drawer-body">
                    {/* Topic info box */}
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                        <span className="drawer-field-label">Tên Đề tài</span>
                        <p style={{ fontWeight: 600, color: 'var(--fg)', fontSize: 13.5, marginTop: 2 }}>
                            {scoreSheetRegistration?.topic?.title || '—'}
                        </p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                            <span>GVHD: <strong style={{ color: 'var(--fg)' }}>{scoreSheetRegistration?.mentor?.fullName || scoreSheetRegistration?.topic?.mentor?.fullName || 'Chưa phân công'}</strong></span>
                            <span>Hội đồng: <strong style={{ color: 'var(--fg)' }}>{scoreSheetRegistration?.council?.name || '---'}</strong></span>
                        </div>
                    </div>

                    {/* Discrepancy Alert Banner */}
                    {drawerDiscrepancy >= 1.5 && (
                        <div className="discrepancy-alert-box" style={{ display: 'flex', marginTop: 14 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <div>
                                <strong>Phát hiện Lệch điểm Giám khảo: {drawerDiscrepancy.toFixed(1)} điểm!</strong>
                                <p style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>
                                    Theo Quy chế đào tạo Viện, khi độ lệch giữa 2 giám khảo vượt quá 1.5 điểm, Chủ tịch hội đồng phải chủ trì thảo luận thống nhất trước khi ký duyệt.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Jury Members Comparison Cards */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div className="drawer-section-title font-display" style={{ marginBottom: 0 }}>
                                Điểm số từng thành viên hội đồng
                            </div>
                            <span
                                className="badge"
                                data-testid="drawer-scorer-counter"
                                style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: drawerScorerSummary.allLocked ? '#ECFDF5' : '#FFFBEB',
                                    color: drawerScorerSummary.allLocked ? '#047857' : '#B45309',
                                    fontWeight: 600,
                                }}
                            >
                                {drawerScorerSummary.lockedCount}/{drawerScorerSummary.totalScorers} phiếu đã khóa
                            </span>
                        </div>
                        <div className="rubric-jury-strip">
                            {drawerScorerSummary.effectiveMemberScores.map((m, idx) => (
                                <div
                                    key={m.evaluatorId || idx}
                                    className={`rubric-jury-card ${activeJuryIndex === idx ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveJuryIndex(idx);
                                        if (m.evaluatorId && m.evaluatorId !== selectedEvaluatorId) {
                                            setSelectedEvaluatorId(m.evaluatorId);
                                            const regId = scoreSheetRegistration?.registrationId || scoreSheetRegistration?.id;
                                            if (regId) {
                                                loadScoreSheet(regId, m.evaluatorId);
                                            }
                                        }
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="jury-role-label">{m.role || m.roleInCouncil || `Giám khảo ${idx + 1}`}</span>
                                        {m.scoreLocked ? (
                                            <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
                                                Đã khóa
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: '#FEF3C7', color: '#B45309', fontWeight: 600 }}>
                                                Chưa khóa
                                            </span>
                                        )}
                                    </div>
                                    <span className="jury-person-name">{m.evaluatorName || m.evaluator?.fullName || `GK ${idx + 1}`}</span>
                                    <span className="rubric-jury-score num">
                                        {activeJuryIndex === idx
                                            ? (activeScoredCount > 0 ? activeEvaluatorScore.toFixed(2) : (m.finalScore ?? '—'))
                                            : (m.finalScore ?? '—')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {scoreLocked && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<LockOutlined />}
                            style={{ marginTop: 14 }}
                            title="Phiếu chấm đã được khóa"
                            description="Điểm số của phiếu chấm này đã được chốt vào biên bản hội đồng và đang ở chế độ chỉ đọc."
                        />
                    )}

                    {/* Rubric Quick Scoring Control */}
                    <div style={{ marginTop: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <span className="drawer-section-title" style={{ marginBottom: 0 }}>
                                Phiếu Chấm Chi Tiết Chuẩn Rubric ·{' '}
                                <span style={{ color: 'var(--accent)' }}>
                                    {drawerScorerSummary.effectiveMemberScores[activeJuryIndex]?.role
                                        || drawerScorerSummary.effectiveMemberScores[activeJuryIndex]?.roleInCouncil
                                        || 'Giám khảo'}
                                </span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Tag color="cyan" style={{ margin: 0 }}>
                                    Phiên bản {rubricInfo.version}
                                </Tag>
                                <span className="meta">
                                    Tổng tối đa: <strong className="num">{Number(rubricInfo?.totalMaxScore || 10).toFixed(1)} điểm</strong>
                                </span>
                            </div>
                        </div>

                        {drawerError ? (
                            <Alert
                                type="error"
                                showIcon
                                title="Không thể tải phiếu chấm rubric"
                                description={drawerError}
                                style={{ marginBottom: 12 }}
                            />
                        ) : drawerLoading ? (
                            <div style={{ padding: 32, textAlign: 'center' }}>
                                <Spin description="Đang tải phiếu chấm..." />
                            </div>
                        ) : drawerOpen ? (
                            <>
                                <RubricQuickScore
                                    categories={rubricCategories}
                                    policy={rubricInfo?.scoreLevelPolicy}
                                    scoresMap={scoresMap}
                                    commentsMap={commentsMap}
                                    disabled={scoreLocked || !canSubmitScore}
                                    onScoresChange={(nextScoresMap) => {
                                        if (scoreLocked || !canSubmitScore) return;
                                        setScoresMap(nextScoresMap);
                                    }}
                                    onCommentChange={(criterionCode, value) => {
                                        if (scoreLocked || !canSubmitScore) return;
                                        setCommentsMap((prev) => ({ ...prev, [criterionCode]: value }));
                                    }}
                                />

                                <div style={{ marginTop: 14 }}>
                                    <label style={{ display: 'block', fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>
                                        Nhận xét chung của Giám khảo:
                                    </label>
                                    <Input.TextArea
                                        rows={3}
                                        placeholder="Nhập nhận xét về khóa luận và buổi bảo vệ..."
                                        value={generalComment}
                                        disabled={scoreLocked || !canSubmitScore}
                                        onChange={(e) => setGeneralComment(e.target.value)}
                                    />
                                </div>
                            </>
                        ) : null}
                    </div>

                    {/* Realtime Summary Calculation Box */}
                    <div className="rubric-calc-summary" style={{ marginTop: 18 }}>
                        <div>
                            <span className="eyebrow font-display" style={{ color: 'var(--institutional)' }}>
                                KẾT QUẢ ĐIỂM TỔNG HỢP HỘI ĐỒNG
                            </span>
                            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                                <span className="font-mono tabular-nums text-2xl font-extrabold text-[#0F766E]">
                                    {finalCompositeScore.toFixed(2)}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">/ 10</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ml-1 ${getGradeClassification(finalCompositeScore).badgeClass}`}>
                                    {getGradeClassification(finalCompositeScore).label}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 mb-0">
                                Trung bình cộng điểm các thành viên hội đồng có hiệu lực · <span className="font-mono tabular-nums font-semibold text-slate-700">{drawerScorerSummary.totalScorers}</span> thành viên
                            </p>
                        </div>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                const regId = scoreSheetRegistration?.registrationId || scoreSheetRegistration?.id;
                                if (regId) {
                                    loadScoreSheet(regId, selectedEvaluatorId);
                                }
                                message.info('Đã cập nhật lại công thức tổng hợp điểm.');
                            }}
                        >
                            Tính Lại
                        </Button>
                    </div>
                </div>

                <div className="drawer-footer">
                    <button className="btn btn-secondary" onClick={closeRubricDrawer}>
                        Đóng
                    </button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={handleExportBM05Pdf}
                            loading={isExportingPdf}
                        >
                            In Biên Bản BM05
                        </Button>
                        <Button
                            icon={<FileTextOutlined />}
                            onClick={() => {
                                setSelectedRegForSummary(scoreSheetRegistration);
                                setSummaryModalOpen(true);
                            }}
                        >
                            Xem Biên Bản BM05
                        </Button>
                        {canSubmitScore && <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleSaveScoreSheet}
                            disabled={scoreSaving || memberLocking || scoreLocked || drawerLoading || Boolean(drawerError)}
                        >
                            <span>{scoreSaving ? 'Đang lưu...' : 'Lưu Điểm Nháp'}</span>
                        </button>}
                        {canSubmitScore && (
                            <Popconfirm
                                title="Khóa phiếu chấm thành viên"
                                description="Sau khi khóa phiếu, điểm số của thành viên này sẽ được chốt vào hội đồng và không thể chỉnh sửa trực tiếp. Bạn có chắc chắn muốn khóa?"
                                onConfirm={handleLockMemberScoreSheet}
                                okText="Xác nhận khóa"
                                cancelText="Hủy"
                                disabled={scoreLocked || !isSheetCompleted || scoreSaving || memberLocking || drawerLoading || Boolean(drawerError)}
                            >
                                <Button
                                    type="primary"
                                    icon={<LockOutlined />}
                                    disabled={scoreLocked || !isSheetCompleted || scoreSaving || memberLocking || drawerLoading || Boolean(drawerError)}
                                    loading={memberLocking}
                                    title={!isSheetCompleted ? 'Vui lòng chấm đủ tất cả các tiêu chí trước khi khóa' : undefined}
                                >
                                    {memberLocking ? 'Đang khóa...' : 'Khóa phiếu chấm'}
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                </div>
            </aside>
            )}
            {/* Modal Công Bố Kết Quả Bảo Vệ Học Kỳ */}
            <DefenseResultPublicationModal
                open={publishModalOpen && Boolean(selectedSemesterId)}
                onClose={handleClosePublicationModal}
                semesterId={selectedSemesterId}
                semesterName={selectedSemesterName}
            />

            {/* Modal Lịch Sử Công Bố Kết Quả */}
            <PublicationHistoryModal
                open={historyModalOpen && Boolean(selectedSemesterId)}
                onClose={() => setHistoryModalOpen(false)}
                semesterId={selectedSemesterId}
                semesterName={selectedSemesterName}
            />

            {/* Modal Trả Sổ Điểm Về Hội Đồng */}
            <Modal
                title={
                    <span className="font-display font-bold text-slate-900">
                        Trả sổ điểm về hội đồng · {selectedRegForReturn?.student?.fullName || ''}
                    </span>
                }
                open={returnModalOpen}
                onOk={handleConfirmReturnScoreBook}
                onCancel={() => {
                    setReturnModalOpen(false);
                    setSelectedRegForReturn(null);
                }}
                confirmLoading={returnLoading}
                okText="Xác nhận trả sổ điểm"
                okButtonProps={{ danger: true }}
                destroyOnHidden
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-600">
                        Thao tác này chỉ khả dụng <strong>trước khi công bố kết quả</strong>. Hệ thống sẽ mở lại các phiếu chấm đã chọn để giám khảo chấm lại và yêu cầu Chủ tịch khóa lại sổ điểm sau khi hoàn tất.
                    </p>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do trả sổ điểm <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do trả sổ điểm về hội đồng..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            maxLength={500}
                            showCount
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Chọn các phiếu giám khảo cần mở khóa lại <span className="text-rose-500">*</span>
                        </label>
                        <div className="space-y-1.5 mt-1 border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                            {(selectedRegForReturn?.memberScores || []).map((m, idx) => {
                                const scoreId = m?.id;
                                if (!scoreId) return null;
                                return (
                                    <div key={scoreId || idx} className="flex items-center gap-2 text-xs">
                                        <Checkbox
                                            checked={reopenMemberIds.includes(scoreId)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setReopenMemberIds([...reopenMemberIds, scoreId]);
                                                } else {
                                                    setReopenMemberIds(reopenMemberIds.filter((id) => id !== scoreId));
                                                }
                                            }}
                                        >
                                            <span className="font-semibold text-slate-800">
                                                {m.evaluator?.fullName || m.evaluatorName || `Giám khảo #${scoreId}`}
                                            </span>
                                            <Tag className="ml-1.5 mr-0 text-[10.5px]">
                                                {m.memberRole || 'Thành viên HĐ'}
                                            </Tag>
                                            {m.finalScore !== null && m.finalScore !== undefined && (
                                                <span className="ml-1.5 text-slate-500 font-mono tabular-nums">
                                                    · Điểm hiện tại: <strong className="text-slate-800">{Number(m.finalScore).toFixed(1)}</strong>
                                                </span>
                                            )}
                                        </Checkbox>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Lịch sử hoàn trả sổ điểm */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <HistoryOutlined className="text-amber-600" />
                        <span>Lịch sử hoàn trả sổ điểm Hội đồng</span>
                    </div>
                }
                open={returnHistoryModalVisible}
                onCancel={() => setReturnHistoryModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setReturnHistoryModalVisible(false)}>
                        Đóng
                    </Button>,
                ]}
                width={950}
                destroyOnHidden
            >
                {returnLogs.length === 0 && !loadingReturnLogs ? (
                    <Empty description="Chưa có lượt hoàn trả sổ điểm nào" className="my-8" />
                ) : (
                    <Table
                        columns={returnHistoryColumns}
                        dataSource={returnLogs}
                        rowKey="id"
                        loading={loadingReturnLogs}
                        pagination={{ pageSize: 8, showSizeChanger: true }}
                        size="small"
                        className="mt-2"
                        locale={{ emptyText: <Empty description="Chưa có lượt hoàn trả sổ điểm nào" /> }}
                    />
                )}
            </Modal>
            {/* Modal Biên Bản Tổng Hợp BM05 */}
            <DefenseSummaryRecordModal
                open={summaryModalOpen}
                onClose={() => {
                    setSummaryModalOpen(false);
                    setSelectedRegForSummary(null);
                }}
                registration={selectedRegForSummary}
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
