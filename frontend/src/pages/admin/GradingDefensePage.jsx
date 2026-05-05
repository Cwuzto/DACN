import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd';
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
} from '@ant-design/icons';

import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import councilService from '../../services/councilService';
import evaluationService from '../../services/evaluationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

const TABS = [
    { key: 'PENDING_ASSIGNMENT', label: 'Chờ phân công', color: 'orange' },
    { key: 'ASSIGNED_COUNCIL', label: 'Đã phân công HĐ', color: 'blue' },
    { key: 'AWAITING_GRADING', label: 'Chờ nhập điểm', color: 'gold' },
    { key: 'COMPLETED', label: 'Hoàn tất', color: 'green' },
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
    REVIEWER: 'Ủy viên',
};

const LEVEL_TEXT_MAP = {
    TOT: 'Tot (85%-100%)',
    KHA: 'Kha (70%-84%)',
    TRUNG_BINH: 'Trung binh (50%-69%)',
    KEM: 'Kem (<50%)',
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
            message.warning('Vui lòng chọn ít nhất 1 dòng');
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
                message.success(res.message || (action === 'LOCK' ? 'Đã khóa điểm' : 'Đã mở khóa điểm'));
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
            label: `${m.evaluatorName || `GV ${m.evaluatorId}`} (${m.finalScore ?? 'Chua cham'})`,
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
            message.error(err?.message || 'Khong the tai phieu cua nguoi cham da chon');
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
                width: 200,
                render: (_, r) => (
                    <div>
                        <div className="font-semibold text-slate-900 leading-tight">{r.student?.fullName || '—'}</div>
                        {r.student?.code && (
                            <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                {r.student.code}
                            </code>
                        )}
                    </div>
                ),
            },
            {
                title: 'Điểm cuối',
                key: 'finalScore',
                width: 100,
                align: 'center',
                render: (_, r) =>
                    r.finalScore !== null && r.finalScore !== undefined ? (
                        <span className="font-black text-base text-primary">{r.finalScore}</span>
                    ) : (
                        <span className="text-slate-300">—</span>
                    ),
            },
            {
                title: 'Đề tài',
                key: 'topic',
                width: 280,
                ellipsis: { showTitle: false },
                render: (_, r) => (
                    <Tooltip title={r.topic?.title}>
                        <span className="text-sm text-slate-600 line-clamp-2">{r.topic?.title || '—'}</span>
                    </Tooltip>
                ),
            },
            {
                title: 'Tên đồ án',
                key: 'projectName',
                width: 130,
                render: () => <span className="text-sm">{PROJECT_NAME}</span>,
            },
            {
                title: 'Đợt đồ án',
                key: 'semester',
                width: 170,
                render: (_, r) => (
                    <span className="text-sm">
                        {r.semester ? formatSemesterLabel(r.semester) : '—'}
                    </span>
                ),
            },
            {
                title: 'GVHD',
                key: 'mentor',
                width: 170,
                render: (_, r) => <span className="text-sm">{r.mentor?.fullName || '—'}</span>,
            },
            {
                title: 'Hội đồng',
                key: 'council',
                width: 170,
                render: (_, r) =>
                    r.council ? (
                        <Tag color="blue">{r.council.name}</Tag>
                    ) : (
                        <span className="text-slate-400 text-xs italic">Chưa phân công</span>
                    ),
            },
            {
                title: 'Lịch bảo vệ',
                key: 'defenseDate',
                width: 130,
                render: (_, r) => (
                    <span className="text-sm">{fmtDate(r.council?.defenseDate || r.semester?.defenseDate)}</span>
                ),
            },
            {
                title: 'Trạng thái chấm',
                key: 'gradingStatus',
                width: 130,
                align: 'center',
                render: (_, r) => {
                    const badge = GRADING_BADGE[r.gradingStatus] || GRADING_BADGE.PENDING;
                    return <Tag color={badge.color}>{badge.text}</Tag>;
                },
            },
            {
                title: 'Khóa điểm',
                key: 'scoreLocked',
                width: 120,
                align: 'center',
                render: (_, r) => (
                    r.scoreLocked
                        ? <Tag color="green">Đã khóa</Tag>
                        : <Tag color="orange">Chưa khóa</Tag>
                ),
            },
            {
                title: 'Cập nhật',
                key: 'lastUpdated',
                width: 140,
                render: (_, r) => <span className="text-xs text-slate-500">{fmtDateTime(r.lastUpdatedAt)}</span>,
            },
        ];

        if (activeTab === 'AWAITING_GRADING' || activeTab === 'COMPLETED') {
            base.push({
                title: 'Barem',
                key: 'scoresheet',
                width: 120,
                align: 'center',
                render: (_, r) => (
                    <Button
                        size="small"
                        onClick={() => openScoreSheetModal(r.registrationId)}
                        className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:border-indigo-300"
                    >
                        {r.finalScore === null || r.finalScore === undefined ? 'Chấm điểm' : 'Sửa điểm'}
                    </Button>
                ),
            });

            base.push({
                title: 'PDF',
                key: 'pdfExport',
                width: 90,
                align: 'center',
                render: (_, r) => (
                    <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        loading={exportingId === r.registrationId}
                        onClick={() => handleExportPdf(r.registrationId)}
                        className="text-xs border-blue-200 text-blue-700 bg-blue-50/50 hover:border-blue-300"
                    >
                        PDF
                    </Button>
                ),
            });

            base.push({
                title: '',
                key: 'actions',
                width: 120,
                align: 'right',
                render: (_, r) => {
                    if (activeTab === 'COMPLETED') {
                        return (
                            <Button
                                size="small"
                                icon={<UnlockOutlined />}
                                loading={lockingId === r.registrationId}
                                onClick={() => handleScoreLock(r.registrationId, 'UNLOCK')}
                                className="text-xs border-orange-200 text-orange-600 bg-orange-50/50 hover:border-orange-300"
                            >
                                Mở khóa
                            </Button>
                        );
                    }

                    return r.gradingStatus === 'GRADED' ? (
                        <Button
                            size="small"
                            icon={<LockOutlined />}
                            loading={lockingId === r.registrationId}
                            onClick={() => handleScoreLock(r.registrationId, 'LOCK')}
                            className="text-xs border-green-200 text-green-700 bg-green-50/50 hover:border-green-300"
                        >
                            Khóa điểm
                        </Button>
                    ) : null;
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
            <span>
                {t.label}
                <Tag color={t.color} className="ml-2 rounded-full text-xs font-bold" style={{ marginInlineStart: 8 }}>
                    {meta.counts?.[t.key] ?? 0}
                </Tag>
            </span>
        ),
    }));

    const semesterOptions = useMemo(
        () => semesters.map((semester) => ({ value: semester.id, label: formatSemesterLabel(semester) })),
        [semesters]
    );
    const projectOptions = useMemo(
        () => [{ value: PROJECT_NAME, label: PROJECT_NAME }],
        []
    );

    const councilOptions = useMemo(
        () => councils.map((council) => ({ value: council.id, label: council.name })),
        [councils]
    );

    const mentorOptions = useMemo(
        () => mentors.map((mentor) => ({ value: mentor.id, label: `${mentor.fullName} (${mentor.code})` })),
        [mentors]
    );

    const statsData = useMemo(
        () => [
            {
                title: 'Chờ phân công',
                value: meta.counts?.PENDING_ASSIGNMENT ?? 0,
                icon: 'hourglass_top',
                iconBg: 'bg-orange-50',
                iconColor: 'text-orange-600',
            },
            {
                title: 'Đã phân công hội đồng',
                value: meta.counts?.ASSIGNED_COUNCIL ?? 0,
                icon: 'groups',
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
            },
            {
                title: 'Chờ nhập điểm',
                value: meta.counts?.AWAITING_GRADING ?? 0,
                icon: 'rate_review',
                iconBg: 'bg-amber-50',
                iconColor: 'text-amber-600',
            },
            {
                title: 'Hoàn tất',
                value: meta.counts?.COMPLETED ?? 0,
                icon: 'task_alt',
                iconBg: 'bg-green-50',
                iconColor: 'text-green-600',
            },
        ],
        [meta.counts]
    );

    const stageDescription = useMemo(() => {
        const map = {
            PENDING_ASSIGNMENT: {
                icon: <ClockCircleOutlined className="text-orange-500" />,
                text: 'Danh sách hồ sơ đã đủ điều kiện nhưng chưa gán hội đồng.',
            },
            ASSIGNED_COUNCIL: {
                icon: <TeamOutlined className="text-blue-500" />,
                text: 'Đã có hội đồng, chờ đến lịch hoặc đang trong phiên bảo vệ.',
            },
            AWAITING_GRADING: {
                icon: <FileDoneOutlined className="text-amber-500" />,
                text: 'Đã bảo vệ xong, hội đồng cần nhập điểm và hoàn tất biên bản.',
            },
            COMPLETED: {
                icon: <CheckCircleOutlined className="text-green-600" />,
                text: 'Điểm đã hoàn tất, có thể mở khóa khi cần điều chỉnh.',
            },
        };
        return map[activeTab];
    }, [activeTab]);

    return (
        <div className="py-2">
            <PageHeader
                title="Quản lý Hội đồng bảo vệ"
                subtitle="Trung tâm điều phối phân công hội đồng, theo dõi chấm điểm và khóa kết quả bảo vệ theo từng workflow stage."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                {statsData.map((card) => (
                    <StatCard
                        key={card.title}
                        icon={card.icon}
                        iconBg={card.iconBg}
                        iconColor={card.iconColor}
                        label={card.title}
                        value={card.value}
                    />
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        {stageDescription.icon}
                        <span>{stageDescription.text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Tổng hồ sơ:</span>
                        <span className="font-black text-slate-800 text-sm">{meta.total ?? data.length}</span>
                    </div>
                </div>

                {meta.targetSemester && (
                    <div className="text-xs text-slate-500 mb-4">
                        Đợt hiện tại: <span className="font-bold text-slate-700">{meta.targetSemester.name}</span>
                    </div>
                )}

                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} items={tabItems} size="large" />

                <div className="grid grid-cols-1 lg:grid-cols-15 gap-3 mb-4">
                    <div className="lg:col-span-4">
                        <Input
                            placeholder="Tìm SV, mã SV hoặc đề tài..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <Select
                            className="w-full"
                            placeholder="Tên đồ án"
                            options={projectOptions}
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
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
                            placeholder="Hội đồng"
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

                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <Space>
                        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => fetchData(true)}>
                            Làm mới
                        </Button>
                    </Space>

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
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-2">
                    <Table
                        loading={loading}
                        columns={columns}
                        dataSource={data}
                        rowKey="registrationId"
                        rowSelection={rowSelection}
                        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} kết quả` }}
                        size="middle"
                        scroll={{ x: 1300 }}
                    />
                </div>
            </div>

            <Modal
                title="Chấm điểm theo barem"
                open={scoreModalOpen}
                onCancel={() => setScoreModalOpen(false)}
                width={1200}
                okText="Lưu bảng điểm"
                onOk={handleSaveScoreSheet}
                okButtonProps={{ loading: scoreSaving, disabled: scoreModalLoading || scoreLocked }}
                cancelText="Đóng"
            >
                {scoreSheetRegistration && (
                    <div className="mb-3 text-sm text-slate-600">
                        <div><b>Sinh viên:</b> {scoreSheetRegistration.student?.fullName} ({scoreSheetRegistration.student?.code})</div>
                        <div><b>Ngành học:</b> {scoreSheetRegistration.student?.department || '—'}</div>
                        <div><b>Đề tài:</b> {scoreSheetRegistration.topic?.title}</div>
                    </div>
                )}

                <div className="mb-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-7">
                        <div className="text-xs text-slate-500 mb-1">Phiếu chấm của thành viên hội đồng</div>
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
                    <div className="lg:col-span-5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">
                        <div><b>Họ tên người chấm:</b> {currentEvaluatorInfo?.fullName || '—'}</div>
                        <div><b>Chức danh trong HĐ:</b> {ROLE_LABELS[currentEvaluatorInfo?.roleInCouncil] || currentEvaluatorInfo?.roleInCouncil || '—'}</div>
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <Button
                        icon={<DownloadOutlined />}
                        loading={exportingId === scoreSheetRegistration?.id}
                        onClick={handleExportPdfForSelectedEvaluator}
                        disabled={!selectedEvaluatorId}
                    >
                        Xuất PDF theo người chấm đang chọn
                    </Button>
                </div>

                {scoreLocked && (
                    <div className="mb-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                        Bảng điểm đang ở trạng thái khóa, cần mở khóa trước khi chỉnh sửa.
                    </div>
                )}

                <div className="overflow-x-auto border border-slate-300 rounded-md">
                    <table className="w-full min-w-[1200px] border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="border border-slate-300 p-2 text-center align-middle" rowSpan={2}>STT</th>
                                <th className="border border-slate-300 p-2 text-center align-middle" rowSpan={2}>Tieu chi danh gia</th>
                                <th className="border border-slate-300 p-2 text-center align-middle" rowSpan={2}>Diem toi da</th>
                                <th className="border border-slate-300 p-2 text-center align-middle" colSpan={4}>Cac cap do danh gia</th>
                                <th className="border border-slate-300 p-2 text-center align-middle" rowSpan={2}>Muc danh gia</th>
                                <th className="border border-slate-300 p-2 text-center align-middle" rowSpan={2}>Diem danh gia</th>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="border border-slate-300 p-2 text-center">Tot<br />85%-100%</th>
                                <th className="border border-slate-300 p-2 text-center">Kha<br />70%-84%</th>
                                <th className="border border-slate-300 p-2 text-center">Trung binh<br />50%-69%</th>
                                <th className="border border-slate-300 p-2 text-center">Kem<br />&lt;50%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scoreSheetRows.map((row, index) => (
                                <tr key={row.criterionCode}>
                                    <td className="border border-slate-300 p-2 align-top text-center">{index + 1}</td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        <div className="font-semibold">{row.criterionLabel}</div>
                                        <div className="text-[11px] text-slate-500">{row.criterionCode}</div>
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top text-center font-semibold">{row.maxScore}</td>
                                    <td className="border border-slate-300 p-2 align-top text-slate-500">Dat muc Tot</td>
                                    <td className="border border-slate-300 p-2 align-top text-slate-500">Dat muc Kha</td>
                                    <td className="border border-slate-300 p-2 align-top text-slate-500">Dat muc Trung binh</td>
                                    <td className="border border-slate-300 p-2 align-top text-slate-500">Dat muc Kem</td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        <Select
                                            className="w-full"
                                            value={row.level}
                                            onChange={(value) => onLevelChange(row.criterionCode, value)}
                                            options={LEVEL_OPTIONS}
                                            disabled={scoreLocked}
                                            allowClear
                                        />
                                        <div className="mt-1 text-[11px] text-slate-500">
                                            {row.level ? LEVEL_TEXT_MAP[row.level] : 'Chua chon'}
                                        </div>
                                    </td>
                                    <td className="border border-slate-300 p-2 align-top">
                                        <InputNumber
                                            className="w-full"
                                            min={0}
                                            max={row.maxScore}
                                            step={0.01}
                                            precision={2}
                                            value={row.score}
                                            onChange={(value) => onScoreChange(row.criterionCode, value)}
                                            disabled={scoreLocked}
                                        />
                                        <Input
                                            className="mt-1"
                                            value={row.comment}
                                            onChange={(e) => onCommentChange(row.criterionCode, e.target.value)}
                                            placeholder="Nhan xet ngan"
                                            disabled={scoreLocked}
                                        />
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50">
                                <td className="border border-slate-300 p-2 font-bold text-right" colSpan={2}>Tong so diem</td>
                                <td className="border border-slate-300 p-2 font-bold text-center">10.0</td>
                                <td className="border border-slate-300 p-2" colSpan={5} />
                                <td className="border border-slate-300 p-2 font-bold text-center">{totalScore}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>


                <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                    <div className="lg:col-span-9">
                        <Input.TextArea
                            rows={3}
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                            placeholder="Nhận xét chung"
                            disabled={scoreLocked}
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                            <div className="text-xs text-slate-500">Tổng điểm</div>
                            <div className="text-2xl font-black text-primary">{totalScore}/10</div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default GradingDefensePage;
