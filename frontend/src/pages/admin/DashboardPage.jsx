import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Progress, Select, Tag } from 'antd';
import {
    ArrowRightOutlined,
    AuditOutlined,
    BookOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    CloudUploadOutlined,
    CommentOutlined,
    FileTextOutlined,
    FormOutlined,
    HistoryOutlined,
    SafetyCertificateOutlined,
    ScheduleOutlined,
    SettingOutlined,
    TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

import {
    useAdminDashboardActions,
    useDashboardActivities,
    useDashboardOverview,
    useDashboardScores,
    useDashboardStats,
} from '../../queries/dashboardQueries';
import { useSemesters } from '../../queries/semesterQueries';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import QueryErrorState from '../../components/common/QueryErrorState';
import EmptyState from '../../components/common/EmptyState';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicRoadmapStepper from '../../components/common/AcademicRoadmapStepper';
import { formatSemesterLabel } from '../../utils/semesterDisplay';

const STAGE_STYLE_VARS = {
    1: {
        '--step-color': '#0F766E',
        '--step-soft': '#F0FDFA',
        '--step-border': '#99F6E4',
        '--step-glow': 'rgba(15, 118, 110, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #0F766E, #14B8A6)',
    },
    2: {
        '--step-color': '#0284C7',
        '--step-soft': '#F0F9FF',
        '--step-border': '#BAE6FD',
        '--step-glow': 'rgba(2, 132, 199, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #0284C7, #38BDF8)',
    },
    3: {
        '--step-color': '#4F46E5',
        '--step-soft': '#EEF2FF',
        '--step-border': '#C7D2FE',
        '--step-glow': 'rgba(79, 70, 229, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #4F46E5, #818CF8)',
    },
    4: {
        '--step-color': '#7C3AED',
        '--step-soft': '#F5F3FF',
        '--step-border': '#DDD6FE',
        '--step-glow': 'rgba(124, 58, 237, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    },
    5: {
        '--step-color': '#D97706',
        '--step-soft': '#FFFBEB',
        '--step-border': '#FDE68A',
        '--step-glow': 'rgba(217, 119, 6, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #D97706, #FBBF24)',
    },
    6: {
        '--step-color': '#059669',
        '--step-soft': '#ECFDF5',
        '--step-border': '#A7F3D0',
        '--step-glow': 'rgba(5, 150, 105, 0.35)',
        '--step-gradient': 'linear-gradient(135deg, #059669, #34D399)',
    },
};

const ROADMAP_ICON_MAP = {
    1: <FormOutlined />,
    2: <FileTextOutlined />,
    3: <AuditOutlined />,
    4: <ScheduleOutlined />,
    5: <SafetyCertificateOutlined />,
    6: <TrophyOutlined />,
    REGISTRATION: <FormOutlined />,
    BM01: <FileTextOutlined />,
    BM02: <AuditOutlined />,
    BM03: <ScheduleOutlined />,
    BM04: <SafetyCertificateOutlined />,
    BM05: <TrophyOutlined />,
};

const PRIORITY_RANK = {
    OVERDUE: 0,
    DUE_SOON: 1,
    NORMAL: 2,
    INFO: 3,
};

const WORKFLOW_ORDER = {
    TOPIC_REVIEW: 1,
    OUTLINE_COUNCIL_ASSIGN: 2,
    BM02_REVIEW: 3,
    DEFENSE_COUNCIL_ALLOCATION: 4,
    RESULT_LOCK: 5,
    RESULT_APPROVE: 6,
    RESULT_PUBLISH: 7,
};

const PRIORITY_META = {
    OVERDUE: { label: 'Quá hạn', color: 'red', border: 'border-l-rose-500', badgeClass: 'text-rose-700' },
    DUE_SOON: { label: 'Sắp đến hạn', color: 'orange', border: 'border-l-amber-500', badgeClass: 'text-amber-700' },
    NORMAL: { label: 'Cần xử lý', color: 'teal', border: 'border-l-teal-600', badgeClass: 'text-[#0F766E]' },
    INFO: { label: 'Theo dõi', color: 'blue', border: 'border-l-sky-600', badgeClass: 'text-sky-700' },
};

const isSafeInternalTarget = (target) => typeof target === 'string' && target.startsWith('/') && !target.startsWith('//');

const sortAdminActions = (items = []) => [...items]
    .filter((item) => item && item.count > 0)
    .sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority] ?? 99;
        const rankB = PRIORITY_RANK[b.priority] ?? 99;
        if (rankA !== rankB) return rankA - rankB;

        const timeA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;

        const orderA = WORKFLOW_ORDER[a.kind] ?? 99;
        const orderB = WORKFLOW_ORDER[b.kind] ?? 99;
        return orderA - orderB;
    });

function DashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const semestersQuery = useSemesters(scope);
    const semesters = semestersQuery.data || [];
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);

    useEffect(() => {
        if (selectedSemesterId || !semesters.length) return;
        const preferred = semesters.find((item) => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(item.status));
        setSelectedSemesterId(preferred?.id || semesters[0].id);
    }, [semesters, selectedSemesterId]);

    const activeSemester = useMemo(() => {
        if (!semesters.length) return null;
        return semesters.find((s) => s.id === selectedSemesterId) || semesters[0];
    }, [semesters, selectedSemesterId]);

    const adminActionsQuery = useAdminDashboardActions(scope, selectedSemesterId, Boolean(selectedSemesterId));
    const statsQuery = useDashboardStats(scope, selectedSemesterId, Boolean(selectedSemesterId));
    const scoresQuery = useDashboardScores(scope, selectedSemesterId, Boolean(selectedSemesterId));
    const activitiesQuery = useDashboardActivities(scope, selectedSemesterId, Boolean(selectedSemesterId));
    const overviewQuery = useDashboardOverview(scope, selectedSemesterId);

    const stats = statsQuery.data;
    const scoreDistribution = scoresQuery.data || [];
    const activities = activitiesQuery.data || [];
    const semesterOverview = overviewQuery.data;

    const sortedActions = useMemo(
        () => sortAdminActions(adminActionsQuery.data?.items || []),
        [adminActionsQuery.data]
    );
    const topActionCards = useMemo(() => sortedActions.slice(0, 3), [sortedActions]);
    const queuedActions = useMemo(() => sortedActions.slice(3), [sortedActions]);
    const roadmapStages = useMemo(() => adminActionsQuery.data?.roadmap || [], [adminActionsQuery.data]);

    const completedStagesCount = useMemo(
        () => roadmapStages.filter((s) => s.state === 'COMPLETED').length,
        [roadmapStages]
    );

    const adminProgressPercent = useMemo(
        () => Math.round((completedStagesCount / (roadmapStages.length || 6)) * 100),
        [completedStagesCount, roadmapStages]
    );

    const adminMilestones = useMemo(() => {
        return roadmapStages.map((stage, idx) => {
            const stepNum = stage.step || idx + 1;
            const styleVars = STAGE_STYLE_VARS[stepNum] || STAGE_STYLE_VARS[idx + 1] || STAGE_STYLE_VARS[1];
            const icon = ROADMAP_ICON_MAP[stage.key] || ROADMAP_ICON_MAP[stepNum] || <FormOutlined />;

            return {
                key: stage.key || `admin-stage-${stepNum}`,
                stepNumber: stepNum,
                title: stage.title,
                subText: typeof stage.count === 'number' ? `${stage.count} Hồ sơ` : '',
                dateText: stage.date
                    ? `${stage.datePrefix ? `${stage.datePrefix}: ` : ''}${dayjs(stage.date).format('DD/MM/YYYY')}`
                    : 'Chưa đặt mốc',
                state: stage.state === 'COMPLETED' ? 'completed' : (stage.state === 'ACTIVE' ? 'active' : 'pending'),
                icon,
                onClick: () => handleNavigateTarget(stage.target),
                styleVars,
            };
        });
    }, [roadmapStages]);

    const scores = useMemo(() => {
        if (scoreDistribution && scoreDistribution.length > 0) return scoreDistribution;
        return [];
    }, [scoreDistribution]);

    const handleNavigateTarget = (target) => {
        if (!isSafeInternalTarget(target)) return;
        navigate(target);
    };

    const getActionBadge = (action = '') => {
        if (action.includes('CREATE') || action.includes('Tạo')) {
            return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Tạo' };
        }
        if (action.includes('DELETE') || action.includes('Xóa')) {
            return { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Xóa' };
        }
        if (action.includes('ASSIGN') || action.includes('Phân công')) {
            return { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Phân công' };
        }
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Cập nhật' };
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header & Consistent Semester Selector */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-slate-200/80">
                <div className="min-w-0">
                    <div className="text-[11px] font-bold font-mono tracking-widest text-[#0F766E] uppercase">
                        {activeSemester?.academicYear ? `ĐIỀU HÀNH HỌC VỤ • ${activeSemester.academicYear}` : 'ĐIỀU HÀNH HỌC VỤ'}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight mt-0.5">
                        Trung Tâm Điều Hành & Quản Trị Học Vụ
                    </h1>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
                    <QueryPanel query={semestersQuery} empty={semesters.length === 0} emptyDescription="Chưa có học kỳ">
                        <Select
                            aria-label="Chọn đợt đồ án"
                            value={selectedSemesterId}
                            onChange={setSelectedSemesterId}
                            className="w-full sm:w-60"
                            options={semesters.map((s) => ({ value: s.id, label: formatSemesterLabel(s) }))}
                            placeholder="Chọn đợt đồ án"
                        />
                    </QueryPanel>
                    <Button
                        type="primary"
                        icon={<CalendarOutlined aria-hidden="true" />}
                        onClick={() => handleNavigateTarget('/admin/project-periods')}
                        className="font-semibold text-xs !bg-[#0F766E] hover:!bg-[#115E59] rounded-md shadow-xs w-full sm:w-auto"
                    >
                        Quản lý Đợt đồ án
                    </Button>
                </div>
            </div>

            {/* Primary Region: Việc cần xử lý */}
            <section aria-labelledby="admin-actions-heading" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 id="admin-actions-heading" className="text-base font-bold text-slate-900">
                            Việc cần xử lý
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                            {activeSemester
                                ? `Các công việc thuộc quyền xử lý trong ${formatSemesterLabel(activeSemester)}`
                                : 'Chọn đợt đồ án để xem danh sách việc cần xử lý'}
                        </p>
                    </div>
                    {stats?.totalStudents != null && (
                        <span className="text-xs text-slate-600 font-mono">
                            Quy mô đợt: <strong className="text-slate-900">{stats.totalStudents} SV</strong>
                        </span>
                    )}
                </div>

                {adminActionsQuery.isPending && adminActionsQuery.fetchStatus !== 'idle' ? (
                    <ContentSkeleton variant="cards" rows={3} />
                ) : adminActionsQuery.isError ? (
                    <QueryErrorState
                        error={adminActionsQuery.error}
                        onRetry={() => adminActionsQuery.refetch()}
                        retrying={adminActionsQuery.isFetching}
                    />
                ) : sortedActions.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                        <EmptyState description="Chưa có việc cần xử lý trong đợt này" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Top 3 Priority Action Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {topActionCards.map((item) => {
                                const meta = PRIORITY_META[item.priority] || PRIORITY_META.NORMAL;
                                return (
                                    <article
                                        key={item.kind}
                                        className={`bg-white border border-slate-200 rounded-xl p-4 shadow-xs border-l-4 ${meta.border} flex flex-col justify-between gap-3`}
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-2xl sm:text-3xl font-extrabold font-display font-mono ${meta.badgeClass}`}>
                                                    {String(item.count).padStart(2, '0')}
                                                </span>
                                                <Tag color={meta.color}>{meta.label}</Tag>
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                                            <p className="text-xs text-slate-600">{item.description}</p>
                                            {item.dueAt && (
                                                <p className="text-[11px] font-mono text-slate-500">
                                                    Hạn xử lý: {dayjs(item.dueAt).format('DD/MM/YYYY')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="pt-1">
                                            <Button
                                                type="primary"
                                                size="small"
                                                icon={<ArrowRightOutlined aria-hidden="true" />}
                                                onClick={() => handleNavigateTarget(item.target)}
                                                className="!bg-[#0F766E] hover:!bg-[#115E59]"
                                            >
                                                Xử lý ngay
                                            </Button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        {/* Remaining Action Queue List */}
                        {queuedActions.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                                    Hàng đợi công việc khác ({queuedActions.length})
                                </h3>
                                <div className="divide-y divide-slate-100">
                                    {queuedActions.map((item) => {
                                        const meta = PRIORITY_META[item.priority] || PRIORITY_META.NORMAL;
                                        return (
                                            <div
                                                key={item.kind}
                                                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Tag color={meta.color}>{meta.label}</Tag>
                                                        <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                                                        <span className="text-xs font-mono font-bold text-slate-700">
                                                            ({item.count})
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600">{item.description}</p>
                                                    {item.dueAt && (
                                                        <p className="text-[11px] font-mono text-slate-500">
                                                            Hạn xử lý: {dayjs(item.dueAt).format('DD/MM/YYYY')}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    size="small"
                                                    icon={<ArrowRightOutlined aria-hidden="true" />}
                                                    onClick={() => handleNavigateTarget(item.target)}
                                                    className="shrink-0 self-start sm:self-center"
                                                >
                                                    Mở danh sách
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 6-Stage Semester Roadmap */}
            {roadmapStages.length > 0 && (
                <AcademicRoadmapStepper
                    role="ADMIN"
                    title={`Lộ trình 6 Mốc Quy Trình (${activeSemester ? formatSemesterLabel(activeSemester) : 'Học kỳ hiện tại'})`}
                    subtitle="Trạng thái thực thi các mốc nghiệp vụ học kỳ theo cấu hình đợt và dữ liệu thực tế"
                    badgeLabel={`${completedStagesCount}/${roadmapStages.length || 6} Mốc hoàn tất`}
                    progressPercent={adminProgressPercent}
                    milestones={adminMilestones}
                />
            )}

            {/* Secondary Grid: Semester Overview + Scores + Shortcuts + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                    {/* Semester Overview */}
                    <section aria-labelledby="semester-overview-heading" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                                    Tổng Quan Đợt Đồ Án
                                </span>
                                <h2 id="semester-overview-heading" className="text-base font-bold text-slate-900 mt-0.5">
                                    {activeSemester ? formatSemesterLabel(activeSemester) : 'Chưa chọn đợt đồ án'}
                                </h2>
                            </div>
                        </div>

                        <QueryPanel query={overviewQuery} empty={!semesterOverview} emptyDescription="Chưa có dữ liệu học kỳ này.">
                            {semesterOverview ? (
                                <div className="space-y-4 pt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                                            <p className="text-[11px] font-semibold text-slate-500">Tổng đề tài</p>
                                            <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                                                {semesterOverview.topics.total}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                                            <p className="text-[11px] font-semibold text-slate-500">Đã đăng ký</p>
                                            <p className="text-xl font-bold font-mono text-teal-700 mt-1">
                                                {semesterOverview.registrations.total}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                                            <p className="text-[11px] font-semibold text-slate-500">Chờ GVHD duyệt</p>
                                            <p className="text-xl font-bold font-mono text-amber-600 mt-1">
                                                {semesterOverview.registrations.pending}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                                            <p className="text-[11px] font-semibold text-slate-500">Đã hoàn thành</p>
                                            <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                                                {semesterOverview.registrations.completed}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-600">Tỷ lệ duyệt đăng ký:</span>
                                                <span className="font-bold text-[#0F766E]">{semesterOverview.registrations.approvalRate}%</span>
                                            </div>
                                            <Progress
                                                percent={semesterOverview.registrations.approvalRate}
                                                strokeColor="#0F766E"
                                                size="small"
                                                showInfo={false}
                                            />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-600">Tỷ lệ hoàn thành đợt:</span>
                                                <span className="font-bold text-emerald-700">{semesterOverview.registrations.completionRate}%</span>
                                            </div>
                                            <Progress
                                                percent={semesterOverview.registrations.completionRate}
                                                strokeColor="#059669"
                                                size="small"
                                                showInfo={false}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <EmptyState description="Chưa có dữ liệu học kỳ này." />
                            )}
                        </QueryPanel>
                    </section>

                    {/* Score Distribution (shown from real data only) */}
                    <section aria-labelledby="score-distribution-heading" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <h2 id="score-distribution-heading" className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                                Phân Bố Điểm Khóa Luận Tốt Nghiệp
                            </h2>
                            <Button
                                size="small"
                                type="link"
                                icon={<ArrowRightOutlined aria-hidden="true" />}
                                onClick={() => handleNavigateTarget(selectedSemesterId ? `/admin/grading?semesterId=${selectedSemesterId}` : '/admin/grading')}
                                className="text-xs font-semibold text-[#0F766E] p-0 self-start sm:self-auto"
                            >
                                Xem chi tiết bảng điểm
                            </Button>
                        </div>

                        <QueryPanel query={scoresQuery} empty={scores.length === 0} emptyDescription="Chưa có dữ liệu phân bổ điểm cho đợt đồ án này.">
                            {scores.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {scores.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-center space-y-1">
                                            <div className="text-xs font-medium text-slate-600">{item.label}</div>
                                            <div className="text-xl font-bold font-mono text-slate-900">{item.percent}%</div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-1.5 rounded-full"
                                                    style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 font-medium py-4 text-center bg-slate-50 border border-slate-200/60 rounded-lg">
                                    Chưa có dữ liệu phân bổ điểm cho đợt đồ án này.
                                </div>
                            )}
                        </QueryPanel>
                    </section>
                </div>

                {/* Right 4 Cols: Neutral Admin Shortcuts & Activity Stream */}
                <div className="lg:col-span-4 space-y-6">
                    <section aria-labelledby="admin-shortcuts-heading" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                        <h2 id="admin-shortcuts-heading" className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                            Điều Hướng Quản Trị
                        </h2>
                        <div className="space-y-2">
                            <Button
                                block
                                icon={<BookOutlined className="text-[#0F766E]" aria-hidden="true" />}
                                onClick={() => handleNavigateTarget(selectedSemesterId ? `/admin/topics?semesterId=${selectedSemesterId}` : '/admin/topics')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Quản lý Đề tài
                            </Button>
                            <Button
                                block
                                icon={<CloudUploadOutlined className="text-teal-700" aria-hidden="true" />}
                                onClick={() => handleNavigateTarget('/admin/users')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Quản lý Người dùng & Import
                            </Button>
                            <Button
                                block
                                icon={<SettingOutlined className="text-purple-700" aria-hidden="true" />}
                                onClick={() => handleNavigateTarget('/admin/permissions')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Cấu hình Phân quyền Người dùng
                            </Button>
                        </div>
                    </section>

                    <section aria-labelledby="recent-activities-heading" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <HistoryOutlined className="text-[#0F766E]" aria-hidden="true" />
                                <h2 id="recent-activities-heading" className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                                    Dòng Sự Kiện Hệ Thống
                                </h2>
                            </div>
                        </div>

                        <QueryPanel query={activitiesQuery} empty={activities.length === 0} emptyDescription="Chưa có hoạt động gần đây">
                            <div className="space-y-3">
                                {(activities || []).slice(0, 5).map((item) => {
                                    const badge = getActionBadge(item.action);
                                    return (
                                        <div
                                            key={item.id}
                                            className="border border-slate-100 rounded-lg p-3 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start gap-2.5 text-xs"
                                        >
                                            <div className={`px-2 py-1 rounded-md flex items-center justify-center shrink-0 border text-[10px] font-semibold ${badge.color}`}>
                                                {badge.label}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="font-bold text-slate-900 truncate text-xs">{item.action}</p>
                                                    <span className="text-[10px] text-slate-500 font-mono font-medium whitespace-nowrap">
                                                        {dayjs(item.time).fromNow()}
                                                    </span>
                                                </div>
                                                <p className="text-slate-700 mt-0.5 line-clamp-2 text-[11.5px]">{item.detail}</p>
                                                <p className="text-[10px] text-slate-500 font-medium mt-1">
                                                    Bởi: <strong className="text-slate-700">{item.user}</strong>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </QueryPanel>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
