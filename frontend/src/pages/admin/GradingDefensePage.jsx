import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Alert,
    Button,
    Checkbox,
    Empty,
    Input,
    message,
    Modal,
    Popconfirm,
    Spin,
    Table,
    Tag,
    Tooltip,
} from 'antd';
import {
    ExclamationCircleOutlined,
    FileTextOutlined,
    HistoryOutlined,
    LockOutlined,
    PrinterOutlined,
    ReloadOutlined,
    RollbackOutlined,
    FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import { queryKeys } from '../../query/queryKeys';
import { useApproveDefenseResult, useDefenseResults, useGradingSemesters, useResultApprovals, useScoreBookReturnLogs } from '../../queries/gradingQueries';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import QueryErrorState from '../../components/common/QueryErrorState';
import ContentRefreshIndicator from '../../components/common/ContentRefreshIndicator';
import { PROJECT_NAME } from '../../utils/semesterDisplay';
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
    if (score === null || score === undefined || isNaN(score)) return { code: '—', label: 'Chưa có điểm', cls: 'grade-badge-c' };
    const num = Number(score);
    if (num >= 8.5) return { code: 'A', label: 'Loại A (Giỏi)', cls: 'grade-badge-a' };
    if (num >= 7.0) return { code: 'B', label: 'Loại B (Khá)', cls: 'grade-badge-b' };
    if (num >= 5.5) return { code: 'C', label: 'Loại C (Trung bình)', cls: 'grade-badge-c' };
    return { code: 'F', label: 'Loại F (Không đạt)', cls: 'grade-badge-c' };
};

export default function GradingDefensePage() {
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
    const [selectedSemesterId, setSelectedSemesterId] = useState(undefined);
    const [selectedCouncilId, setSelectedCouncilId] = useState('');
    const [selectedGradeFilter, setSelectedGradeFilter] = useState('');

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
    const filters = useMemo(() => ({
        ...(activeTab === 'COMPLETED' || activeTab === 'AWAITING_GRADING' ? { tab: activeTab } : {}),
        ...(selectedSemesterId ? { semesterId: selectedSemesterId } : {}),
        ...(selectedCouncilId ? { councilId: selectedCouncilId } : {}),
        ...(debouncedSearchText.trim() ? { search: debouncedSearchText.trim() } : {}),
    }), [activeTab, selectedSemesterId, selectedCouncilId, debouncedSearchText]);
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
        const targetId = semesterQuery.data?.data?.[0]?.id || resultsQuery.data?.meta?.targetSemester?.id;
        if (targetId) setSelectedSemesterId((previous) => previous || targetId);
    }, [semesterQuery.data, resultsQuery.data]);

    // Synchronize tab and publication modal with URL search parameters
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'approvals') {
            setActiveTab('all');
        } else if (tab === 'publish') {
            if (canViewPublications) {
                setIsPublicationModalOpen(true);
            }
        } else if (tab === 'COMPLETED' || tab === 'AWAITING_GRADING' || tab === 'discrepancy') {
            setActiveTab(tab);
        } else if (!tab) {
            setActiveTab((prev) => (prev === 'all' ? prev : 'all'));
        }
    }, [searchParams, canViewPublications]);

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
        let sumScore = 0;
        let validScores = 0;
        let excellentCount = 0;
        let discrepancyCount = 0;
        let awaitingApprovalCount = 0;

        data.forEach((r) => {
            if (r.status === 'AWAITING_FINAL_APPROVAL') {
                awaitingApprovalCount++;
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
            avgScore,
            excellentCount,
            discrepancyCount,
            awaitingApprovalCount,
        };
    }, [data]);

    // Filtered Rows
    const filteredData = useMemo(() => {
        const rows = searchParams.get('tab') === 'approvals' ? (approvalsQuery.data?.data || []) : data;
        return rows.filter((r) => {

            // Tab filter for discrepancy
            if (activeTab === 'discrepancy') {
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
    }, [data, approvalsQuery.data, activeTab, selectedGradeFilter, searchParams]);

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

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-grading">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">ACADEMIC GRADING LEDGER · RUBRIC EVALUATION</p>
                    <h1 className="h1">Sổ điểm Hội đồng & Thẩm định Rubric Học thuật</h1>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                        Quản lý bảng điểm bảo vệ khóa luận tốt nghiệp toàn diện, tích hợp kiểm định độ lệch điểm và ký duyệt điện tử.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {canReadLedger && <Button icon={<ReloadOutlined aria-hidden="true" />} onClick={() => fetchData()} disabled={!ledgerEnabled || resultsQuery.isFetching}>
                        Làm mới sổ điểm
                    </Button>}
                    {canViewPublications && <button
                        className="btn btn-primary"
                        onClick={handlePublishResults}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>{canPublishResult ? 'Công bố kết quả học kỳ' : 'Xem trước công bố kết quả'}</span>
                    </button>}
                    {canViewPublications && <button className="btn btn-secondary" onClick={handleOpenPublicationHistory}>
                        <span>Lịch sử công bố</span>
                    </button>}
                </div>
            </div>

            {semesterQuery.isError && <QueryErrorState error={semesterQuery.error} onRetry={() => semesterQuery.refetch()} retrying={semesterQuery.isFetching} />}
            {canReadLedger && <>
            {/* KPI Summary Cards */}
            <div className="kpi-grid-4" data-od-id="grading-kpi-grid">
                <div className="kpi-stat-card">
                    <span className="eyebrow">TIẾN ĐỘ CHẤM ĐIỂM</span>
                    <span className="kpi-stat-val num" style={{ color: 'var(--accent)' }}>
                        {metrics.gradedCount} / {metrics.total} SV
                    </span>
                    <span className="kpi-stat-sub">
                        {metrics.total > 0 ? Math.round((metrics.gradedCount / metrics.total) * 100) : 0}% sinh viên đã hoàn tất điểm bảo vệ
                    </span>
                </div>
                <div className="kpi-stat-card">
                    <span className="eyebrow">ĐIỂM TRUNG BÌNH TOÀN KHÓA</span>
                    <span className="kpi-stat-val num" style={{ color: 'var(--institutional)' }}>
                        {metrics.avgScore} / 10
                    </span>
                    <span className="kpi-stat-sub">Phổ điểm chuẩn: 7.2 - 9.4 (Chuẩn kiểm định AUN-QA)</span>
                </div>
                <div className="kpi-stat-card">
                    <span className="eyebrow">XUẤT SẮC / GIỎI (≥ 8.5)</span>
                    <span className="kpi-stat-val num" style={{ color: 'var(--success)' }}>
                        {metrics.excellentCount} Đề tài
                    </span>
                    <span className="kpi-stat-sub">
                        {metrics.total > 0 ? Math.round((metrics.excellentCount / metrics.total) * 100) : 0}% đạt loại Giỏi trở lên
                    </span>
                </div>
                <div className="kpi-stat-card" style={{ borderColor: 'color-mix(in oklch, var(--danger) 30%, var(--border))' }}>
                    <span className="eyebrow" style={{ color: 'var(--danger)' }}>CẢNH BÁO LỆCH ĐIỂM HỘI ĐỒNG</span>
                    <span className="kpi-stat-val num" style={{ color: 'var(--danger)' }}>
                        {metrics.discrepancyCount} Đề tài
                    </span>
                    <span className="kpi-stat-sub">Độ lệch giám khảo ≥ 1.5đ (Cần họp đối thoại)</span>
                </div>
            </div>

            {/* Faceted Filter & Grading Table */}
            <section className="filter-strip" data-od-id="grading-filter-strip">
                {/* Status Tabs */}
                <div className="status-tabs">
                    <button
                        className={`tab-pill ${activeTab === 'all' && searchParams.get('tab') !== 'approvals' ? 'active' : ''}`}
                        onClick={() => handleTabChange('all')}
                    >
                        <span>Tất cả</span>
                        <span className="tab-counter num">{metrics.total}</span>
                    </button>
                    <button
                        className={`tab-pill ${activeTab === 'COMPLETED' && searchParams.get('tab') !== 'approvals' ? 'active' : ''}`}
                        onClick={() => handleTabChange('COMPLETED')}
                    >
                        <span>Đã chốt sổ</span>
                        <span className="tab-counter num" style={{ color: 'var(--success)' }}>
                            {meta.counts?.COMPLETED || metrics.gradedCount}
                        </span>
                    </button>
                    <button
                        className={`tab-pill ${activeTab === 'AWAITING_GRADING' && searchParams.get('tab') !== 'approvals' ? 'active' : ''}`}
                        onClick={() => handleTabChange('AWAITING_GRADING')}
                    >
                        <span>Đang chấm</span>
                        <span className="tab-counter num" style={{ color: 'var(--warning)' }}>
                            {meta.counts?.AWAITING_GRADING || Math.max(0, metrics.total - metrics.gradedCount)}
                        </span>
                    </button>
                    <button
                        className={`tab-pill ${activeTab === 'discrepancy' && searchParams.get('tab') !== 'approvals' ? 'active' : ''}`}
                        onClick={() => handleTabChange('discrepancy')}
                    >
                        <span>Cảnh báo lệch điểm</span>
                        <span className="tab-counter num" style={{ color: 'var(--danger)' }}>
                            {metrics.discrepancyCount}
                        </span>
                    </button>
                    <button
                        className={`tab-pill ${searchParams.get('tab') === 'approvals' ? 'active' : ''}`}
                        onClick={() => handleTabChange('approvals')}
                    >
                        <span>Chờ phê duyệt</span>
                        <span className="tab-counter num" style={{ color: 'var(--accent)' }}>
                            {metrics.awaitingApprovalCount}
                        </span>
                    </button>
                </div>

                {/* Faceted Inputs Row */}
                <div className="faceted-row">
                    <div className="search-input-wrap">
                        <svg className="search-icon-abs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Tìm kiếm theo MSSV, Họ tên sinh viên, Đề tài, GVHD..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    <select
                        className="select-dropdown"
                        value={selectedCouncilId}
                        onChange={(e) => setSelectedCouncilId(e.target.value)}
                    >
                        <option value="">Tất cả Hội đồng</option>
                        {councils.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} {c.location ? `(${c.location})` : ''}
                            </option>
                        ))}
                    </select>

                    <select
                        className="select-dropdown"
                        value={selectedGradeFilter}
                        onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    >
                        <option value="">Tất cả Xếp loại</option>
                        <option value="A">Loại A / A+ (≥ 8.5)</option>
                        <option value="B">Loại B / B+ (7.0 - 8.4)</option>
                        <option value="C">Loại C (5.5 - 6.9)</option>
                    </select>

                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSearchText('');
                            setSelectedCouncilId('');
                            setSelectedGradeFilter('');
                            handleTabChange('all');
                        }}
                    >
                        Đặt lại bộ lọc
                    </button>
                </div>
            </section>

            {returnLogs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <Alert
                        message="Hội đồng có lượt hoàn trả sổ điểm"
                        description="Hội đồng này đã từng có sổ điểm được Giáo vụ/Trưởng Viện hoàn trả để rà soát lại kết quả chấm."
                        type="warning"
                        showIcon
                        action={
                            <Button
                                size="small"
                                icon={<HistoryOutlined />}
                                onClick={() => setReturnHistoryModalVisible(true)}
                            >
                                Xem lịch sử trả ({returnLogs.length})
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
            <section className="table-container" data-od-id="grading-table-container">
                <table className="data-table" id="grading-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={filteredData.length > 0 && selectedRowKeys.length === filteredData.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th>Mã & Tên Đề tài</th>
                            <th>Sinh viên</th>
                            <th>Hội đồng</th>
                            <th style={{ textAlign: 'center' }}>Chi tiết Điểm Giám khảo</th>
                            <th style={{ textAlign: 'center' }}>Điểm TB (Chưa làm tròn)</th>
                            <th style={{ textAlign: 'center' }}>Điểm Khóa Luận (Làm tròn 1 số lẻ)</th>
                            <th style={{ textAlign: 'center' }}>Xếp loại</th>
                            <th>Trạng thái</th>
                            <th style={{ textAlign: 'right' }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan="11" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
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
                                    <tr key={id} style={{ background: isSelected ? 'var(--primary-light)' : undefined }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectRow(id)}
                                            />
                                        </td>
                                        <td style={{ maxWidth: 280 }}>
                                            <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
                                                {r.topic?.code || `DT-${String(r.topic?.id || r.topicId || r.id || '2026').padStart(3, '0')}`}
                                            </div>
                                            <div style={{ fontWeight: 600, color: 'var(--fg)', fontSize: 13, lineHeight: 1.4, marginTop: 2 }}>
                                                {r.topic?.title || '—'}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                                GVHD: <strong>{r.mentor?.fullName || 'Chưa phân công'}</strong>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        background: '#E0F2FE',
                                                        color: '#0369A1',
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {r.student?.fullName ? r.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase() : 'S'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--fg)', fontSize: 13 }}>
                                                        {r.student?.fullName || '—'}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                                        {r.student?.code || '21004xxx'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {r.council ? (
                                                <div>
                                                    <span className="badge badge-approved" style={{ fontWeight: 700 }}>
                                                        {r.council.name}
                                                    </span>
                                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                                        {fmtDate(r.council.defenseDate)} {r.council.location && `· ${r.council.location}`}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="badge badge-pending">Chưa gán HĐ</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                                                {effectiveMemberScores.length > 0 ? (
                                                    effectiveMemberScores.map((m, idx) => (
                                                        <span
                                                            key={m.evaluatorId || idx}
                                                            style={{
                                                                fontSize: 11,
                                                                fontFamily: 'var(--font-mono)',
                                                                background: '#F1F5F9',
                                                                padding: '2px 6px',
                                                                borderRadius: 4,
                                                                color: '#334155',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <span>{m.evaluator?.fullName ? m.evaluator.fullName.split(' ').slice(-1)[0] : (m.evaluatorName ? m.evaluatorName.split(' ').slice(-1)[0] : `GK${idx + 1}`)}: <strong>{m.finalScore ?? '—'}</strong></span>
                                                            {m.scoreLocked ? (
                                                                <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
                                                                    Đã khóa
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: '#FEF3C7', color: '#B45309', fontWeight: 600 }}>
                                                                    Chưa khóa
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>Chưa có phiếu</span>
                                                )}
                                            </div>
                                            <div style={{ marginTop: 4 }}>
                                                <span
                                                    className="badge"
                                                    data-testid={`row-scorer-counter-${id}`}
                                                    style={{
                                                        fontSize: 10.5,
                                                        padding: '2px 6px',
                                                        borderRadius: 4,
                                                        background: allLocked ? '#ECFDF5' : '#FFFBEB',
                                                        color: allLocked ? '#047857' : '#B45309',
                                                        border: `1px solid ${allLocked ? '#A7F3D0' : '#FDE68A'}`,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {lockedCount}/{totalScorers} phiếu đã khóa
                                                </span>
                                            </div>
                                            {hasDiscrepancy && (
                                                <div style={{ marginTop: 4 }}>
                                                    <Tag
                                                        color="error"
                                                        icon={<ExclamationCircleOutlined />}
                                                        style={{ fontSize: 10, padding: '0 6px', margin: 0 }}
                                                    >
                                                        Lệch {delta.toFixed(1)}đ
                                                    </Tag>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.attendanceStatus === 'ABSENT' ? (
                                                <Tag color="error">VẮNG MẶT</Tag>
                                            ) : (
                                                <>
                                                    <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                                                        {r.rawAverageScore !== null && r.rawAverageScore !== undefined
                                                            ? Number(r.rawAverageScore).toFixed(2)
                                                            : r.finalScore !== null && r.finalScore !== undefined
                                                            ? Number(r.finalScore).toFixed(2)
                                                            : '—'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>rawAverage</div>
                                                </>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.attendanceStatus === 'ABSENT' ? (
                                                <Tag color="error" className="font-bold">ABSENT</Tag>
                                            ) : (
                                                <>
                                                    <div className="num" style={{ fontSize: 16, fontWeight: 900, color: 'var(--institutional)' }}>
                                                        {r.roundedFinalScore !== null && r.roundedFinalScore !== undefined
                                                            ? Number(r.roundedFinalScore).toFixed(1)
                                                            : r.finalScore !== null && r.finalScore !== undefined
                                                            ? Number(r.finalScore).toFixed(1)
                                                            : '—'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>roundedScore (1 số lẻ)</div>
                                                </>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={grade.cls}>{grade.label}</span>
                                        </td>
                                        <td>
                                            {r.scoreLocked ? (
                                                <span className="status-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                                    Đã khóa sổ
                                                </span>
                                            ) : (
                                                <span className="status-badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                                                    Đang chấm
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openRubricDrawer(r)}
                                                    style={{ padding: '4px 10px', fontSize: 12 }}
                                                >
                                                    Mở Sổ Điểm
                                                </button>
                                                <Button
                                                    size="small"
                                                    icon={<FileTextOutlined />}
                                                    onClick={() => {
                                                        setSelectedRegForSummary(r);
                                                        setSummaryModalOpen(true);
                                                    }}
                                                    title="Xem Biên bản tổng hợp BM05"
                                                >
                                                    BM05
                                                </Button>
                                                <Button
                                                    size="small"
                                                    icon={<FolderOpenOutlined />}
                                                    onClick={() => {
                                                        setSelectedRegForDossier(r);
                                                        setDossierDrawerOpen(true);
                                                    }}
                                                    title="Xem toàn bộ hồ sơ biểu mẫu học vụ (BM01 - BM05)"
                                                >
                                                    Hồ sơ BM
                                                </Button>
                                                {canLockResult && (r.scoreLocked ? (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleScoreLock(id, 'UNLOCK')}
                                                        disabled={lockingId === id}
                                                        style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                                        title="Mở khóa sổ điểm"
                                                    >
                                                        Mở khóa
                                                    </button>
                                                ) : (
                                                    <Tooltip
                                                        title={!allLocked ? `Cần đủ ${totalScorers} thành viên hội đồng nộp & khóa phiếu chấm trước khi khóa sổ điểm hội đồng (Hiện tại: ${lockedCount}/${totalScorers})` : ''}
                                                    >
                                                        <span>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleScoreLock(id, 'LOCK')}
                                                                disabled={!allLocked || lockingId === id}
                                                                style={{ padding: '4px 8px' }}
                                                                title={allLocked ? "Khóa sổ điểm hội đồng" : undefined}
                                                            >
                                                                Khóa sổ điểm hội đồng
                                                            </button>
                                                        </span>
                                                    </Tooltip>
                                                ))}
                                                {canApproveResult && r.status === 'AWAITING_FINAL_APPROVAL' && (
                                                    <>
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveResult(id, 'PASSED')} disabled={approvingId === id} style={{ padding: '4px 8px' }}>
                                                             Duyệt đạt
                                                        </button>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => handleApproveResult(id, 'FAILED')} disabled={approvingId === id} style={{ color: 'var(--danger)', padding: '4px 8px' }}>
                                                             Duyệt không đạt
                                                        </button>
                                                    </>
                                                )}
                                                {canLockResult && !r.isPublished && !r.isResultPublished && r.status !== 'COMPLETED' && (
                                                    <Button
                                                        size="small"
                                                        icon={<RollbackOutlined />}
                                                        onClick={() => handleOpenReturnModal(r)}
                                                        style={{ color: '#D97706', borderColor: '#FDE68A' }}
                                                    >
                                                        Trả sổ về Hội đồng
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </section>
            )}

            {/* FLOATING BATCH ACTION BAR */}
            {canRemindGrading && selectedRowKeys.length > 0 && (
                <div className="floating-batch-bar" style={{ display: 'flex' }}>
                    <span className="batch-count-text">
                        Đã chọn: <span className="num">{selectedRowKeys.length}</span> đề tài
                    </span>
                    <div className="batch-divider" />
                    <button className="btn-batch primary" onClick={handleRemindGrading}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Nhắc Chấm Điểm HĐ</span>
                    </button>
                    <div className="batch-divider" />
                    <button className="btn-batch" onClick={() => setSelectedRowKeys([])} style={{ opacity: 0.8 }}>
                        Bỏ chọn
                    </button>
                </div>
            )}
            </>}

            {/* CONTEXT-PRESERVING RUBRIC GRADING DRAWER */}
            {drawerOpen && <div className="drawer-overlay" onClick={closeRubricDrawer} />}
            <aside
                aria-hidden={!drawerOpen}
                className={`side-drawer ${drawerOpen ? 'open' : ''}`}
                id="rubric-drawer"
                style={{ width: 740, right: drawerOpen ? 0 : -780, transition: 'right 0.25s ease' }}
                data-od-id="rubric-side-drawer"
            >
                <div className="drawer-header">
                    <div>
                        <span className="eyebrow" id="rubric-drawer-code">
                            {scoreSheetRegistration?.topic?.code || 'DT-2026-001'} · {scoreSheetRegistration?.council?.name || 'HỘI ĐỒNG BẢO VỆ'}
                        </span>
                        <h2 className="h2" style={{ marginTop: 4 }}>
                            {scoreSheetRegistration?.student?.fullName || 'Nguyễn Tiến Đạt'} ({scoreSheetRegistration?.student?.code || '21004189'})
                        </h2>
                    </div>
                    <button className="btn-icon-only" onClick={closeRubricDrawer} title="Đóng">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="drawer-body">
                    {/* Topic info box */}
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                        <span className="drawer-field-label">Tên Đề tài</span>
                        <p style={{ fontWeight: 600, color: 'var(--fg)', fontSize: 13.5, marginTop: 2 }}>
                            {scoreSheetRegistration?.topic?.title || 'Hệ thống Quản lý Khóa luận Tốt nghiệp dựa trên Microservices và Ant Design'}
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
                            <div className="drawer-section-title" style={{ marginBottom: 0 }}>
                                Điểm số Từng Thành viên Hội đồng (Click chọn người đang chấm)
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
                            message="Phiếu chấm đã được khóa"
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
                                message="Không thể tải phiếu chấm rubric"
                                description={drawerError}
                                style={{ marginBottom: 12 }}
                            />
                        ) : drawerLoading ? (
                            <div style={{ padding: 32, textAlign: 'center' }}>
                                <Spin tip="Đang tải phiếu chấm..." />
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
                            <span className="eyebrow" style={{ color: 'var(--institutional)' }}>
                                KẾT QUẢ ĐIỂM TỔNG HỢP HỘI ĐỒNG
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                                <span className="h1 num" style={{ color: 'var(--institutional)' }}>
                                    {finalCompositeScore.toFixed(2)}
                                </span>
                                <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ 10</span>
                                <span className={getGradeClassification(finalCompositeScore).cls} style={{ marginLeft: 6 }}>
                                    {getGradeClassification(finalCompositeScore).label}
                                </span>
                            </div>
                            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                Quy chế Viện: Trung bình cộng điểm các thành viên Hội đồng bảo vệ có hiệu lực ({drawerScorerSummary.totalScorers} thành viên)
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
            {/* Modal Công Bố Kết Quả Bảo Vệ Snapshot */}
            <DefenseResultPublicationModal
                open={publishModalOpen && Boolean(selectedSemesterId)}
                onClose={handleClosePublicationModal}
                semesterId={selectedSemesterId}
                semesterName={semesters.find((s) => s.id === selectedSemesterId)?.name}
            />

            {/* Modal Lịch Sử Công Bố & Lưu Chiểu Snapshot */}
            <PublicationHistoryModal
                open={historyModalOpen && Boolean(selectedSemesterId)}
                onClose={() => setHistoryModalOpen(false)}
                semesterId={selectedSemesterId}
                semesterName={semesters.find((s) => s.id === selectedSemesterId)?.name}
            />

            {/* Modal Trả Sổ Điểm Về Hội Đồng (Trước Công Bố) */}
            <Modal
                title={`Trả Sổ Điểm Về Hội Đồng: ${selectedRegForReturn?.student?.fullName || ''}`}
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
                            Chọn các phiếu giám khảo cần mở khóa lại: <span className="text-rose-500">*</span>
                        </label>
                        <div className="space-y-1 mt-1 border border-slate-200 p-2.5 rounded bg-slate-50">
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
                                                {m.evaluator?.fullName || m.evaluatorName || `Giám khảo #${scoreId}`} ({m.memberRole || 'Thành viên HĐ'})
                                            </span>
                                            {m.finalScore !== null && m.finalScore !== undefined && (
                                                <span className="ml-1 text-slate-500">
                                                    - Điểm hiện tại: <strong>{Number(m.finalScore).toFixed(1)}</strong>
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
