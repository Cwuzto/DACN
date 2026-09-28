import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Button,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Table,
    Tabs,
    Tag,
    Tooltip,
    message,
    Dropdown,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    DownloadOutlined,
    FileDoneOutlined,
    LockOutlined,
    NotificationOutlined,
    ReloadOutlined,
    SearchOutlined,
    TeamOutlined,
    UnlockOutlined,
    WarningOutlined,
    EllipsisOutlined,
    EditOutlined,
    EyeOutlined,
} from '@ant-design/icons';

import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import councilService from '../../services/councilService';
import evaluationService from '../../services/evaluationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

const TABS = [
    { key: 'PENDING_ASSIGNMENT', label: 'Chờ phân công', color: 'orange', countKey: 'PENDING_ASSIGNMENT' },
    { key: 'ASSIGNED_COUNCIL', label: 'Đã phân công HĐ', color: 'blue', countKey: 'ASSIGNED_COUNCIL' },
    { key: 'AWAITING_GRADING', label: 'Chờ nhập điểm', color: 'gold', countKey: 'AWAITING_GRADING' },
    { key: 'COMPLETED', label: 'Hoàn tất', color: 'green', countKey: 'COMPLETED' },
];

const GRADING_BADGE = {
    PENDING: { color: 'orange', text: 'Chưa chấm' },
    GRADED: { color: 'green', text: 'Đã chấm' },
};

const LEVEL_OPTIONS = [
    { value: 'TOT', label: 'Tốt (85%-100%)', ratio: 0.925 },
    { value: 'KHA', label: 'Khá (70%-84%)', ratio: 0.77 },
    { value: 'TRUNG_BINH', label: 'Trung bình (50%-69%)', ratio: 0.595 },
    { value: 'KEM', label: 'Kém (<50%)', ratio: 0.25 },
];

const ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch',
    SECRETARY: 'Thư ký',
    REVIEWER: 'Phản biện',
    MEMBER: 'Ủy viên',
};

const LEVEL_TEXT_MAP = {
    TOT: 'Tốt (85%-100%)',
    KHA: 'Khá (70%-84%)',
    TRUNG_BINH: 'Trung bình (50%-69%)',
    KEM: 'Kém (<50%)',
};

const getLevelByScore = (score, maxScore) => {
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    const percent = (score / maxScore) * 100;
    if (percent >= 85) return 'TOT';
    if (percent >= 70) return 'KHA';
    if (percent >= 50) return 'TRUNG_BINH';
    return 'KEM';
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

const fmtDateTime = (v) => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
};

function GradingDefensePage() {
    const [activeTab, setActiveTab] = useState('PENDING_ASSIGNMENT');
    const [data, setData] = useState([]);
    const [meta, setMeta] = useState({ counts: {}, targetSemester: null, total: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState(undefined);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [selectedCouncilId, setSelectedCouncilId] = useState(undefined);
    const [selectedMentorId, setSelectedMentorId] = useState(undefined);

    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [reminding, setReminding] = useState(false);
    const [lockingId, setLockingId] = useState(null);
    const [exportingId, setExportingId] = useState(null);

    const [semesters, setSemesters] = useState([]);
    const [councils, setCouncils] = useState([]);
    const [mentors, setMentors] = useState([]);

    const [scoreModalOpen, setScoreModalOpen] = useState(false);
    const [scoreModalLoading, setScoreModalLoading] = useState(false);
    const [scoreSaving, setScoreSaving] = useState(false);
    const [scoreSheetRegistration, setScoreSheetRegistration] = useState(null);
    const [scoreSheetRows, setScoreSheetRows] = useState([]);
    const [generalComment, setGeneralComment] = useState('');
    const [scoreLocked, setScoreLocked] = useState(false);
    const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(null);
    const [memberScoreOptions, setMemberScoreOptions] = useState([]);
    const [currentEvaluatorInfo, setCurrentEvaluatorInfo] = useState(null);

    useEffect(() => {
        semesterService.getAll()
            .then((res) => {
                if (res.success) setSemesters(res.data || []);
            })
            .catch(() => {
                setSemesters([]);
            });

        userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 })
            .then((res) => {
                if (res.success) setMentors(res.data || []);
            })
            .catch(() => {
                setMentors([]);
            });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchText(searchText), 350);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        const params = {};
        if (selectedSemesterId) params.semesterId = selectedSemesterId;

        councilService.getCouncils(params)
            .then((res) => {
                if (res.success) setCouncils(res.data || []);
            })
            .catch(() => {
                setCouncils([]);
            });
    }, [selectedSemesterId]);

    const fetchData = useCallback(
        async (showRefresh = false) => {
            try {
                if (showRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                const params = { tab: activeTab };
                if (selectedSemesterId) params.semesterId = selectedSemesterId;
                if (selectedCouncilId) params.councilId = selectedCouncilId;
                if (selectedMentorId) params.mentorId = selectedMentorId;
                if (debouncedSearchText?.trim()) params.search = debouncedSearchText.trim();

                const res = await evaluationService.getAdminDefenseCenter(params);
                if (res.success) {
                    setData(res.data || []);
                    setMeta(res.meta || { counts: {}, targetSemester: null, total: 0 });
                    if (!selectedSemesterId && res.meta?.targetSemester?.id) {
                        setSelectedSemesterId(res.meta.targetSemester.id);
                    }
                }
            } catch (err) {
                message.error(err?.message || 'Không thể tải dữ liệu');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [activeTab, debouncedSearchText, selectedCouncilId, selectedMentorId, selectedSemesterId]
    );

    useEffect(() => {
        fetchData(false);
        setSelectedRowKeys([]);
    }, [fetchData]);

    const handleRemindGrading = async () => {
        if (!selectedRowKeys.length) {
            message.warning('Vui lòng chọn ít nhất 1 dòng hồ sơ');
            return;
        }

        try {
            setReminding(true);
            const res = await evaluationService.remindDefenseGrading(selectedRowKeys);
            if (res.success) {
                message.success(res.message || `Đã gửi nhắc chấm điểm cho ${res.data?.sent || 0} hồ sơ`);
                setSelectedRowKeys([]);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể gửi nhắc chấm điểm');
        } finally {
            setReminding(false);
        }
    };

    const handleScoreLock = useCallback(async (registrationId, action) => {
        try {
            setLockingId(registrationId);
            const res = await evaluationService.setDefenseScoreLock(registrationId, action);
            if (res.success) {
                message.success(res.message || (action === 'LOCK' ? 'Đã khóa điểm bảo vệ' : 'Đã mở khóa điểm bảo vệ'));
                fetchData(true);
            }
        } catch (err) {
            message.error(err?.message || 'Thao tác thất bại');
        } finally {
            setLockingId(null);
        }
    }, [fetchData]);

    const handleExportPdf = useCallback(async (registrationId) => {
        try {
            setExportingId(registrationId);
            const res = await evaluationService.exportScoreSheetPdf(registrationId);
            if (res.success) {
                message.success(res.message || 'Đã xuất PDF bảng điểm');
                if (res.data?.pdfUrl) {
                    window.open(res.data.pdfUrl, '_blank');
                }
                fetchData(true);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể xuất PDF bảng điểm');
        } finally {
            setExportingId(null);
        }
    }, [fetchData]);

    const handleExportPdfForSelectedEvaluator = async () => {
        if (!scoreSheetRegistration?.id || !selectedEvaluatorId) {
            message.warning('Vui lòng chọn thành viên hội đồng trước khi xuất PDF.');
            return;
        }
        try {
            setExportingId(scoreSheetRegistration.id);
            const res = await evaluationService.exportScoreSheetPdf(scoreSheetRegistration.id, {
                evaluatorId: selectedEvaluatorId,
            });
            if (res.success) {
                message.success(res.message || 'Đã xuất PDF theo thành viên đang chọn.');
                if (res.data?.pdfUrl) window.open(res.data.pdfUrl, '_blank');
                fetchData(true);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể xuất PDF theo thành viên đã chọn');
        } finally {
            setExportingId(null);
        }
    };

    const loadScoreSheet = useCallback(async (registrationId, evaluatorId = undefined) => {
        const params = evaluatorId ? { evaluatorId } : {};
        const res = await evaluationService.getScoreSheet(registrationId, params);
        if (!res.success) return null;

        const payload = res.data || {};
        const rubric = payload.rubric?.criteria || [];
        const scoreMap = new Map((payload.scores || []).map((s) => [s.criterionCode, s]));
        const rows = rubric.map((criterion) => {
            const current = scoreMap.get(criterion.code);
            const currentScore = Number.isFinite(Number(current?.score)) ? Number(current.score) : null;
            return {
                criterionCode: criterion.code,
                criterionLabel: criterion.label,
                maxScore: criterion.maxScore,
                score: currentScore,
                level: getLevelByScore(currentScore, criterion.maxScore),
                comment: current?.comment || '',
            };
        });

        const normalizedOptions = (payload.memberScores || []).map((m) => ({
            value: m.evaluatorId,
            label: `${m.evaluatorName || `GV ${m.evaluatorId}`} (${m.finalScore ?? 'Chưa chấm'})`,
        }));

        setScoreSheetRegistration(payload.registration || null);
        setScoreSheetRows(rows);
        setGeneralComment(payload.defenseResult?.comments || '');
        setScoreLocked(Boolean(payload.scoreLocked));
        setSelectedEvaluatorId(payload.currentEvaluator?.id || evaluatorId || null);
        setCurrentEvaluatorInfo(payload.currentEvaluator || null);
        setMemberScoreOptions(normalizedOptions);
        return payload;
    }, []);

    const openScoreSheetModal = useCallback(async (registrationId) => {
        try {
            setScoreModalOpen(true);
            setScoreModalLoading(true);
            await loadScoreSheet(registrationId);
        } catch (err) {
            message.error(err?.message || 'Không thể tải bảng điểm chi tiết');
            setScoreModalOpen(false);
        } finally {
            setScoreModalLoading(false);
        }
    }, [loadScoreSheet]);

    const onChangeSelectedEvaluator = async (evaluatorId) => {
        if (!scoreSheetRegistration?.id || !evaluatorId) return;
        try {
            setScoreModalLoading(true);
            await loadScoreSheet(scoreSheetRegistration.id, evaluatorId);
        } catch (err) {
            message.error(err?.message || 'Không thể tải phiếu của người chấm đã chọn');
        } finally {
            setScoreModalLoading(false);
        }
    };

    const onLevelChange = (criterionCode, level) => {
        setScoreSheetRows((prev) => prev.map((row) => {
            if (row.criterionCode !== criterionCode) return row;
            const selected = LEVEL_OPTIONS.find((item) => item.value === level);
            const nextScore = selected ? round2(row.maxScore * selected.ratio) : row.score;
            return { ...row, level, score: nextScore };
        }));
    };

    const onScoreChange = (criterionCode, score) => {
        setScoreSheetRows((prev) => prev.map((row) => {
            if (row.criterionCode !== criterionCode) return row;
            const numericScore = score === null || score === undefined ? null : Number(score);
            return { ...row, score: numericScore, level: getLevelByScore(numericScore, row.maxScore) };
        }));
    };

    const onCommentChange = (criterionCode, comment) => {
        setScoreSheetRows((prev) => prev.map((row) => (row.criterionCode === criterionCode ? { ...row, comment } : row)));
    };

    const totalScore = useMemo(() => round2(scoreSheetRows.reduce((sum, row) => sum + (Number(row.score) || 0), 0)), [scoreSheetRows]);

    const handleSaveScoreSheet = async () => {
        if (!scoreSheetRegistration?.id) return;
        if (scoreSheetRows.some((row) => row.score === null || row.score === undefined)) {
            message.warning('Vui lòng nhập điểm đầy đủ cho tất cả tiêu chí.');
            return;
        }

        try {
            setScoreSaving(true);
            const payload = {
                scores: scoreSheetRows.map((row) => ({
                    criterionCode: row.criterionCode,
                    score: Number(row.score),
                    comment: row.comment?.trim() || undefined,
                })),
                generalComment: generalComment?.trim() || undefined,
                evaluatorId: selectedEvaluatorId || undefined,
            };

            const res = await evaluationService.saveScoreSheet(scoreSheetRegistration.id, payload);
            if (res.success) {
                message.success(res.message || 'Đã lưu bảng điểm online');
                setScoreModalOpen(false);
                fetchData(true);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể lưu bảng điểm chi tiết');
        } finally {
            setScoreSaving(false);
        }
    };

    const columns = useMemo(() => {
        const base = [
            {
                title: 'Sinh viên',
                key: 'student',
                width: 210,
                render: (_, r) => {
                    const initials = r.student?.fullName
                        ? r.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase()
                        : 'S';
                    return (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-slate-900 leading-snug truncate">
                                    {r.student?.fullName || '—'}
                                </div>
                                {r.student?.code && (
                                    <code className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                        {r.student.code}
                                    </code>
                                )}
                            </div>
                        </div>
                    );
                },
            },
            {
                title: 'Đề tài & GVHD',
                key: 'topic',
                width: 320,
                render: (_, r) => (
                    <div className="space-y-1">
                        <Tooltip title={r.topic?.title}>
                            <div className="font-semibold text-slate-800 line-clamp-2 text-sm leading-snug">
                                {r.topic?.title || '—'}
                            </div>
                        </Tooltip>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-medium text-slate-600">GVHD:</span>
                            <span>{r.mentor?.fullName || 'Chưa phân công'}</span>
                        </div>
                    </div>
                ),
            },
            {
                title: 'Hội đồng bảo vệ',
                key: 'council',
                width: 220,
                render: (_, r) => {
                    if (!r.council) {
                        return <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">Chưa gán HĐ</span>;
                    }
                    return (
                        <div className="space-y-1">
                            <Tag color="blue" className="font-semibold m-0 text-xs">
                                {r.council.name}
                            </Tag>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>{fmtDate(r.council?.defenseDate || r.semester?.defenseDate)}</span>
                                {r.council?.location && <span>• {r.council.location}</span>}
                            </div>
                        </div>
                    );
                },
            },
            {
                title: 'Điểm thành viên',
                key: 'memberScores',
                width: 210,
                render: (_, r) => {
                    const memberScores = r.memberScores || [];
                    const scores = memberScores.map((m) => Number(m.finalScore)).filter((n) => Number.isFinite(n));
                    const discrepancy = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
                    const hasDiscrepancy = discrepancy >= 2.0;

                    if (!memberScores.length) {
                        return <span className="text-xs text-slate-400 italic">Chưa có điểm</span>;
                    }

                    return (
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                                {memberScores.map((m, idx) => (
                                    <Tag
                                        key={idx}
                                        className="text-[11px] m-0 border-slate-200"
                                        color={m.finalScore !== null && m.finalScore !== undefined ? 'default' : 'orange'}
                                    >
                                        <span className="text-slate-500 font-mono mr-1">
                                            {m.evaluator?.fullName ? m.evaluator.fullName.split(' ').slice(-1)[0] : `GV${idx + 1}`}:
                                        </span>
                                        <b className="text-slate-900">{m.finalScore ?? '—'}</b>
                                    </Tag>
                                ))}
                            </div>
                            {hasDiscrepancy && (
                                <Tooltip title={`Điểm giữa các thành viên chênh lệch ${discrepancy.toFixed(1)}đ (>= 2.0đ). Cần hội đồng hội ý thống nhất điểm!`}>
                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        <WarningOutlined /> Lệch {discrepancy.toFixed(1)}đ
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                    );
                },
            },
            {
                title: 'Điểm cuối',
                key: 'finalScore',
                width: 100,
                align: 'center',
                render: (_, r) => {
                    if (r.finalScore === null || r.finalScore === undefined) {
                        return <span className="text-slate-300 font-bold">—</span>;
                    }
                    const num = Number(r.finalScore);
                    let colorClass = 'text-blue-600';
                    if (num >= 8.5) colorClass = 'text-emerald-600';
                    else if (num < 5.0) colorClass = 'text-rose-600';

                    return (
                        <div className="text-center">
                            <span className={`font-black text-lg ${colorClass}`}>{num.toFixed(1)}</span>
                            <div className="text-[10px] text-slate-400 font-medium">Thang 10</div>
                        </div>
                    );
                },
            },
            {
                title: 'Trạng thái',
                key: 'status',
                width: 130,
                align: 'center',
                render: (_, r) => {
                    const badge = GRADING_BADGE[r.gradingStatus] || GRADING_BADGE.PENDING;
                    return (
                        <div className="flex flex-col items-center gap-1">
                            <Tag color={badge.color} className="m-0 font-medium text-xs">
                                {badge.text}
                            </Tag>
                            {r.scoreLocked ? (
                                <Tag color="green" className="m-0 text-[10px]">
                                    <LockOutlined className="mr-0.5" /> Đã khóa
                                </Tag>
                            ) : (
                                <Tag color="default" className="m-0 text-[10px] text-slate-500">
                                    <UnlockOutlined className="mr-0.5" /> Chưa khóa
                                </Tag>
                            )}
                        </div>
                    );
                },
            },
            {
                title: 'Cập nhật',
                key: 'lastUpdated',
                width: 130,
                render: (_, r) => <span className="text-xs text-slate-500">{fmtDateTime(r.lastUpdatedAt)}</span>,
            },
        ];

        if (activeTab === 'AWAITING_GRADING' || activeTab === 'COMPLETED') {
            base.push({
                title: 'Thao tác',
                key: 'actions',
                width: 140,
                align: 'right',
                render: (_, r) => {
                    const menuItems = [
                        {
                            key: 'scoresheet',
                            icon: <EditOutlined />,
                            label: r.finalScore === null || r.finalScore === undefined ? 'Chấm điểm barem' : 'Xem & Sửa điểm',
                            onClick: () => openScoreSheetModal(r.registrationId),
                        },
                        {
                            key: 'pdf',
                            icon: <DownloadOutlined />,
                            label: 'Xuất PDF bảng điểm',
                            disabled: exportingId === r.registrationId,
                            onClick: () => handleExportPdf(r.registrationId),
                        },
                        { type: 'divider' },
                        activeTab === 'COMPLETED'
                            ? {
                                key: 'unlock',
                                icon: <UnlockOutlined />,
                                label: 'Mở khóa điểm',
                                danger: true,
                                disabled: lockingId === r.registrationId,
                                onClick: () => handleScoreLock(r.registrationId, 'UNLOCK'),
                            }
                            : {
                                key: 'lock',
                                icon: <LockOutlined />,
                                label: 'Khóa kết quả điểm',
                                disabled: r.gradingStatus !== 'GRADED' || lockingId === r.registrationId,
                                onClick: () => handleScoreLock(r.registrationId, 'LOCK'),
                            },
                    ];

                    return (
                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                            <Button size="small" className="text-xs font-semibold text-slate-700 hover:text-primary">
                                Thao tác <EllipsisOutlined />
                            </Button>
                        </Dropdown>
                    );
                },
            });
        }

        return base;
    }, [activeTab, exportingId, lockingId, handleExportPdf, handleScoreLock, openScoreSheetModal]);

    const rowSelection = activeTab === 'AWAITING_GRADING' || activeTab === 'ASSIGNED_COUNCIL'
        ? {
            selectedRowKeys,
            onChange: setSelectedRowKeys,
        }
        : undefined;

    const tabItems = TABS.map((t) => ({
        key: t.key,
        label: (
            <span className="flex items-center gap-1.5 font-medium">
                {t.label}
                <span className={`px-2 py-0.2 rounded-full text-xs font-bold ${
                    activeTab === t.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                    {meta.counts?.[t.countKey] ?? 0}
                </span>
            </span>
        ),
    }));

    const semesterOptions = useMemo(
        () => semesters.map((semester) => ({ value: semester.id, label: formatSemesterLabel(semester) })),
        [semesters]
    );

    const councilOptions = useMemo(
        () => councils.map((council) => ({ value: council.id, label: council.name })),
        [councils]
    );

    const mentorOptions = useMemo(
        () => mentors.map((mentor) => ({ value: mentor.id, label: `${mentor.fullName} (${mentor.code})` })),
        [mentors]
    );

    const stageDescription = useMemo(() => {
        const map = {
            PENDING_ASSIGNMENT: {
                icon: <ClockCircleOutlined className="text-orange-500 text-base" />,
                title: 'Chờ phân công hội đồng',
                text: 'Hồ sơ sinh viên đã đủ điều kiện bảo vệ nhưng chưa được gán vào hội đồng chấm chính thức.',
            },
            ASSIGNED_COUNCIL: {
                icon: <TeamOutlined className="text-blue-500 text-base" />,
                title: 'Đã phân công hội đồng',
                text: 'Hồ sơ đã được xếp lịch bảo vệ, đang chờ đến phiên bảo vệ hoặc đang diễn ra tại phòng chấm.',
            },
            AWAITING_GRADING: {
                icon: <FileDoneOutlined className="text-amber-500 text-base" />,
                title: 'Chờ nhập điểm & Thống nhất biên bản',
                text: 'Phiên bảo vệ đã hoàn tất, các thành viên hội đồng cần nhập điểm theo barem đánh giá trực tuyến.',
            },
            COMPLETED: {
                icon: <CheckCircleOutlined className="text-emerald-600 text-base" />,
                title: 'Đã hoàn tất kết quả bảo vệ',
                text: 'Kết quả điểm đã được tổng hợp và khóa an toàn. Admin có quyền mở khóa khi cần điều chỉnh biên bản.',
            },
        };
        return map[activeTab] || map.PENDING_ASSIGNMENT;
    }, [activeTab]);

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Quản trị hệ thống' },
                    { label: 'Hội đồng & Đánh giá' },
                    { label: 'Trung tâm Chấm bảo vệ' },
                ]}
                title="Trung tâm Chấm bảo vệ"
                subtitle="Điều phối phân công hội đồng, giám sát nhập điểm barem 3 thành viên và quản lý khóa kết quả bảo vệ khóa luận."
                tags={[
                    { label: PROJECT_NAME, color: 'blue' },
                    ...(meta.targetSemester ? [{ label: `Đợt: ${meta.targetSemester.name}`, color: 'geekblue' }] : []),
                ]}
                actions={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            loading={refreshing}
                            onClick={() => fetchData(true)}
                        >
                            Làm mới
                        </Button>
                        {(activeTab === 'AWAITING_GRADING' || activeTab === 'ASSIGNED_COUNCIL') && (
                            <Button
                                type="primary"
                                icon={<NotificationOutlined />}
                                loading={reminding}
                                disabled={!selectedRowKeys.length}
                                onClick={handleRemindGrading}
                            >
                                Nhắc chấm điểm {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                            </Button>
                        )}
                    </Space>
                }
            />

            {/* 4 StatCards with Click to Switch Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    icon="hourglass_top"
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                    label="Chờ phân công"
                    value={meta.counts?.PENDING_ASSIGNMENT ?? 0}
                    active={activeTab === 'PENDING_ASSIGNMENT'}
                    onClick={() => setActiveTab('PENDING_ASSIGNMENT')}
                />
                <StatCard
                    icon="groups"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Đã phân công HĐ"
                    value={meta.counts?.ASSIGNED_COUNCIL ?? 0}
                    active={activeTab === 'ASSIGNED_COUNCIL'}
                    onClick={() => setActiveTab('ASSIGNED_COUNCIL')}
                />
                <StatCard
                    icon="rate_review"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Chờ nhập điểm"
                    value={meta.counts?.AWAITING_GRADING ?? 0}
                    active={activeTab === 'AWAITING_GRADING'}
                    onClick={() => setActiveTab('AWAITING_GRADING')}
                />
                <StatCard
                    icon="task_alt"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Hoàn tất"
                    value={meta.counts?.COMPLETED ?? 0}
                    active={activeTab === 'COMPLETED'}
                    onClick={() => setActiveTab('COMPLETED')}
                />
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                {/* Stage Notification Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                            {stageDescription.icon}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                {stageDescription.title}
                            </div>
                            <div className="text-xs text-slate-600 font-medium">
                                {stageDescription.text}
                            </div>
                        </div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
                        Hồ sơ đợt này: <b className="text-slate-900">{meta.total ?? data.length}</b>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key)}
                    items={tabItems}
                    size="middle"
                    className="border-b border-slate-100"
                />

                {/* Unified Filter Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
                    <div className="lg:col-span-4">
                        <Input
                            placeholder="Tìm sinh viên, mã SV hoặc tên đề tài..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <Select
                            className="w-full"
                            placeholder="Đợt đồ án"
                            options={semesterOptions}
                            value={selectedSemesterId}
                            onChange={(value) => {
                                setSelectedSemesterId(value);
                                setSelectedCouncilId(undefined);
                            }}
                            allowClear
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <Select
                            className="w-full"
                            placeholder="Lọc theo Hội đồng"
                            options={councilOptions}
                            value={selectedCouncilId}
                            onChange={setSelectedCouncilId}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <Select
                            className="w-full"
                            placeholder="GV hướng dẫn"
                            options={mentorOptions}
                            value={selectedMentorId}
                            onChange={setSelectedMentorId}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs mt-3">
                    <Table
                        loading={loading}
                        columns={columns}
                        dataSource={data}
                        rowKey="registrationId"
                        rowSelection={rowSelection}
                        pagination={{
                            pageSize: 12,
                            showSizeChanger: true,
                            showTotal: (total) => `Tổng số ${total} hồ sơ`,
                        }}
                        size="middle"
                        scroll={{ x: 1280 }}
                    />
                </div>
            </div>

            {/* Score Sheet Rubric Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <FileDoneOutlined className="text-primary" />
                        Phiếu Chấm Điểm Barem Trực Tuyến
                    </div>
                }
                open={scoreModalOpen}
                onCancel={() => setScoreModalOpen(false)}
                width={1100}
                okText="Lưu bảng điểm"
                onOk={handleSaveScoreSheet}
                okButtonProps={{ loading: scoreSaving, disabled: scoreModalLoading || scoreLocked }}
                cancelText="Đóng"
                centered
            >
                {scoreSheetRegistration && (
                    <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                        <div>
                            <span className="text-slate-500 block">Sinh viên:</span>
                            <b className="text-slate-900 text-sm">
                                {scoreSheetRegistration.student?.fullName}
                            </b>
                            <span className="ml-1 text-slate-500 font-mono">
                                ({scoreSheetRegistration.student?.code})
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Ngành học:</span>
                            <b>{scoreSheetRegistration.student?.department || 'Công nghệ Thông tin'}</b>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Đề tài khóa luận:</span>
                            <b className="line-clamp-2 text-slate-900">{scoreSheetRegistration.topic?.title}</b>
                        </div>
                    </div>
                )}

                {/* Member Evaluator Selector */}
                <div className="mb-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    <div className="lg:col-span-7">
                        <div className="text-xs font-semibold text-slate-600 mb-1.5">
                            Chọn thành viên hội đồng chấm điểm:
                        </div>
                        <Select
                            className="w-full"
                            value={selectedEvaluatorId}
                            options={memberScoreOptions}
                            onChange={onChangeSelectedEvaluator}
                            placeholder="Chọn thành viên hội đồng"
                            showSearch
                            optionFilterProp="label"
                        />
                    </div>
                    <div className="lg:col-span-5 bg-blue-50/60 border border-blue-200 rounded-lg p-2.5 text-xs text-slate-700">
                        <div><b>Giảng viên chấm:</b> {currentEvaluatorInfo?.fullName || '—'}</div>
                        <div><b>Vai trò trong HĐ:</b> {ROLE_LABELS[currentEvaluatorInfo?.roleInCouncil] || currentEvaluatorInfo?.roleInCouncil || '—'}</div>
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        loading={exportingId === scoreSheetRegistration?.id}
                        onClick={handleExportPdfForSelectedEvaluator}
                        disabled={!selectedEvaluatorId}
                    >
                        Xuất PDF theo người chấm đang chọn
                    </Button>
                </div>

                {scoreLocked && (
                    <div className="mb-4 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                        <LockOutlined className="text-amber-600" />
                        Bảng điểm này hiện đang ở trạng thái khóa. Vui lòng mở khóa trước khi điều chỉnh điểm số.
                    </div>
                )}

                {/* Rubric Evaluation Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
                    <table className="w-full min-w-[900px] border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                                <th className="border-b border-r border-slate-200 p-2.5 text-center w-12">STT</th>
                                <th className="border-b border-r border-slate-200 p-2.5 text-left">Tiêu chí đánh giá</th>
                                <th className="border-b border-r border-slate-200 p-2.5 text-center w-24">Điểm max</th>
                                <th className="border-b border-r border-slate-200 p-2.5 text-center w-48">Mức đánh giá</th>
                                <th className="border-b border-slate-200 p-2.5 text-center w-40">Điểm chấm</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {scoreSheetRows.map((row, index) => (
                                <tr key={row.criterionCode} className="hover:bg-slate-50/60">
                                    <td className="p-2.5 text-center text-slate-500 font-mono border-r border-slate-200">{index + 1}</td>
                                    <td className="p-2.5 border-r border-slate-200">
                                        <div className="font-semibold text-slate-800">{row.criterionLabel}</div>
                                        <div className="text-[11px] text-slate-400 font-mono">{row.criterionCode}</div>
                                    </td>
                                    <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-200">{row.maxScore}</td>
                                    <td className="p-2.5 border-r border-slate-200">
                                        <Select
                                            className="w-full"
                                            value={row.level}
                                            onChange={(value) => onLevelChange(row.criterionCode, value)}
                                            options={LEVEL_OPTIONS}
                                            disabled={scoreLocked}
                                            allowClear
                                            placeholder="Chọn mức..."
                                            size="small"
                                        />
                                        <div className="mt-1 text-[11px] text-slate-400">
                                            {row.level ? LEVEL_TEXT_MAP[row.level] : 'Chưa xếp mức'}
                                        </div>
                                    </td>
                                    <td className="p-2.5 space-y-1">
                                        <InputNumber
                                            className="w-full font-bold"
                                            min={0}
                                            max={row.maxScore}
                                            step={0.05}
                                            precision={2}
                                            value={row.score}
                                            onChange={(value) => onScoreChange(row.criterionCode, value)}
                                            disabled={scoreLocked}
                                            size="small"
                                        />
                                        <Input
                                            value={row.comment}
                                            onChange={(e) => onCommentChange(row.criterionCode, e.target.value)}
                                            placeholder="Ghi chú tiêu chí"
                                            disabled={scoreLocked}
                                            size="small"
                                        />
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold">
                                <td className="p-2.5 text-right uppercase tracking-wider text-slate-600 border-r border-slate-200" colSpan={2}>
                                    Tổng điểm đánh giá
                                </td>
                                <td className="p-2.5 text-center text-slate-900 border-r border-slate-200">10.0</td>
                                <td className="p-2.5 border-r border-slate-200" />
                                <td className="p-2.5 text-center font-black text-primary text-base">
                                    {totalScore}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Comment & Total Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                    <div className="lg:col-span-9">
                        <div className="text-xs font-semibold text-slate-600 mb-1">Nhận xét chung của hội đồng:</div>
                        <Input.TextArea
                            rows={3}
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                            placeholder="Nhập nhận xét tổng thể về kết quả nghiên cứu, sản phẩm và phần trả lời của sinh viên..."
                            disabled={scoreLocked}
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500">Tổng điểm</div>
                            <div className="text-3xl font-black text-primary mt-1">{totalScore}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-1">
                                {totalScore >= 8.5 ? 'Xuất sắc / Giỏi' : totalScore >= 7.0 ? 'Khá' : totalScore >= 5.0 ? 'Trung bình' : 'Chưa đạt'}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default GradingDefensePage;
