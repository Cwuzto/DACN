import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Progress, Select, Tag } from 'antd';
import {
    TeamOutlined,
    BookOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    ArrowRightOutlined,
    CalendarOutlined,
    SettingOutlined,
    FileTextOutlined,
    SafetyCertificateOutlined,
    CloudUploadOutlined,
    LockOutlined,
    HistoryOutlined,
    FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

import { useDashboardStats, useDashboardScores, useDashboardActivities, useDashboardOverview } from '../../queries/dashboardQueries';
import { useSemesters } from '../../queries/semesterQueries';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

function DashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const scope = queryKeys.scope(user);
    const statsQuery = useDashboardStats(scope);
    const scoresQuery = useDashboardScores(scope);
    const activitiesQuery = useDashboardActivities(scope);
    const semestersQuery = useSemesters(scope);
    const stats = statsQuery.data;
    const scoreDistribution = scoresQuery.data || [];
    const activities = activitiesQuery.data || [];
    const semesters = semestersQuery.data || [];
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const overviewQuery = useDashboardOverview(scope, selectedSemesterId);
    const semesterOverview = overviewQuery.data;

    useEffect(() => {
        if (selectedSemesterId || !semesters.length) return;
        const preferred = semesters.find(item => ['REGISTRATION', 'ONGOING', 'DEFENSE'].includes(item.status));
        setSelectedSemesterId(preferred?.id || semesters[0].id);
    }, [semesters, selectedSemesterId]);

    const activeSemester = useMemo(() => {
        if (!semesters.length) return null;
        return semesters.find((s) => s.id === selectedSemesterId) || semesters[0];
    }, [semesters, selectedSemesterId]);

    const scores = useMemo(() => {
        if (scoreDistribution && scoreDistribution.length > 0) return scoreDistribution;
        return [];
    }, [scoreDistribution]);

    const projectOptions = useMemo(() => [{ value: PROJECT_NAME, label: PROJECT_NAME }], []);

    const getActionBadge = (action = '') => {
        if (action.includes('CREATE') || action.includes('Tạo')) {
            return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'add_circle' };
        }
        if (action.includes('DELETE') || action.includes('Xóa')) {
            return { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'delete' };
        }
        if (action.includes('ASSIGN') || action.includes('Phân công')) {
            return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'link' };
        }
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'edit' };
    };

    const pendingTopicCount = semesterOverview?.registrations?.pending ?? stats?.pendingRegistrations ?? 0;
    const unassignedCount = stats?.unassignedRegistrations ?? 0;
    const upcomingDefensesCount = stats?.upcomingDefenses ?? 0;

    return (
        <div className="space-y-6 pb-8">
            {/* Command Center Header matching OpenDesign */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <div className="text-[11px] font-bold font-mono tracking-widest text-[#0F766E] uppercase">
                        COMMAND CENTER • HỌC VỤ {activeSemester?.academicYear || '2026-2027'}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight mt-0.5">
                        Trung Tâm Điều Hành & Quản Trị Học Vụ
                    </h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 mr-2">
                        Đợt: <strong className="text-slate-800">{activeSemester?.name || 'Học kỳ 1'}</strong> • <span className="font-mono">{stats?.totalStudents != null ? `${stats.totalStudents} SV` : 'Chưa có số liệu'}</span>
                    </span>
                    <Button
                        icon={<TeamOutlined />}
                        onClick={() => navigate('/admin/councils')}
                        className="font-medium text-xs rounded-md"
                    >
                        Phân công Hội đồng
                    </Button>
                    <Button
                        type="primary"
                        icon={<CalendarOutlined />}
                        onClick={() => navigate('/admin/project-periods')}
                        className="font-semibold text-xs !bg-[#0F766E] hover:!bg-[#115E59] rounded-md shadow-xs"
                    >
                        Quản lý Đợt đồ án
                    </Button>
                </div>
            </div>

            <QueryPanel query={statsQuery}>
            {/* TRIAGE QUEUE: Hàng đợi khẩn cấp */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Triage 1: Đề tài chờ phê duyệt */}
                <div
                    onClick={() => navigate('/admin/topics')}
                    className="cursor-pointer bg-white border border-slate-200 rounded-xl p-4 shadow-xs border-l-4 border-l-amber-500 hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <span className="text-2xl sm:text-3xl font-extrabold font-display font-mono text-amber-600">
                            {String(pendingTopicCount).padStart(2, '0')}
                        </span>
                        <div className="text-xs font-bold text-slate-800">Đề tài chờ BCN phê duyệt</div>
                        <div className="text-[11px] text-slate-600 font-medium">Cần thẩm định để sinh viên đăng ký</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-200 shrink-0">
                        →
                    </div>
                </div>

                {/* Triage 2: Chưa xếp Hội đồng bảo vệ */}
                <div
                    onClick={() => navigate('/admin/councils')}
                    className="cursor-pointer bg-white border border-slate-200 rounded-xl p-4 shadow-xs border-l-4 border-l-rose-500 hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <span className="text-2xl sm:text-3xl font-extrabold font-display font-mono text-rose-600">
                            {String(unassignedCount).padStart(2, '0')}
                        </span>
                        <div className="text-xs font-bold text-slate-800">Chưa gắn Hội đồng bảo vệ</div>
                        <div className="text-[11px] text-slate-600 font-medium">Sinh viên đủ điều kiện bảo vệ chờ gán ca thi</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs border border-rose-200 shrink-0">
                        !
                    </div>
                </div>

                {/* Triage 3: Hội đồng bảo vệ sắp diễn ra */}
                <div
                    onClick={() => navigate('/admin/grading')}
                    className="cursor-pointer bg-white border border-slate-200 rounded-xl p-4 shadow-xs border-l-4 border-l-teal-600 hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between"
                >
                    <div className="space-y-1">
                        <span className="text-2xl sm:text-3xl font-extrabold font-display font-mono text-[#0F766E]">
                            {String(upcomingDefensesCount).padStart(2, '0')}
                        </span>
                        <div className="text-xs font-bold text-slate-800">Hội đồng chấm bảo vệ</div>
                        <div className="text-[11px] text-slate-600 font-medium">Kiểm tra barem & điểm hội đồng</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-teal-50 text-[#0F766E] flex items-center justify-center font-bold text-xs border border-teal-200 shrink-0">
                        →
                    </div>
                </div>
            </div>

            {/* INTERACTIVE MILESTONE STEPPER (Lộ trình 5 Giai đoạn) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                        Lộ trình 5 Giai Đoạn Đồ Án • Đợt {activeSemester?.name || 'Hiện hành'}
                    </span>
                    <span className="text-xs text-slate-500">
                        Tiến độ chung: <strong className="font-mono text-[#0F766E]">{semesterOverview?.registrations?.completionRate || 64}%</strong>
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Milestone 1 */}
                    <div
                        onClick={() => navigate('/admin/topics')}
                        className="cursor-pointer p-3 rounded-lg border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#0F766E]">MỐC 01</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-[#0F766E]">Đạt</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 line-clamp-1">1. Đăng ký & Gán GVHD</div>
                        <div className="text-[11px] font-mono text-slate-500">{stats?.totalStudents || 0} Sinh viên</div>
                    </div>

                    {/* Milestone 2 */}
                    <div
                        onClick={() => navigate('/admin/oversight')}
                        className="cursor-pointer p-3 rounded-lg border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#0F766E]">MỐC 02</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-[#0F766E]">Đạt</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 line-clamp-1">2. Thẩm định đề cương</div>
                        <div className="text-[11px] font-mono text-slate-500">{stats?.ongoingTopics || 0} Đạt chuẩn</div>
                    </div>

                    {/* Milestone 3 (Active) */}
                    <div
                        onClick={() => navigate('/admin/oversight')}
                        className="cursor-pointer p-3 rounded-lg border-2 border-[#0F766E] bg-white shadow-2xs space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#0F766E]">MỐC 03 • HIỆN TẠI</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Đang nộp</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">3. Nhật ký & Đánh giá tiến độ</div>
                        <div className="text-[11px] font-mono text-[#0F766E] font-bold">Tiến độ giám sát</div>
                    </div>

                    {/* Milestone 4 */}
                    <div
                        onClick={() => navigate('/admin/councils')}
                        className="cursor-pointer p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-slate-500">MỐC 04</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">Đạt nhận xét</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 line-clamp-1">4. Thẩm định & Ghép HĐ</div>
                        <div className="text-[11px] font-mono text-slate-500">Phân công hội đồng</div>
                    </div>

                    {/* Milestone 5 */}
                    <div
                        onClick={() => navigate('/admin/grading')}
                        className="cursor-pointer p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-slate-500">MỐC 05</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">Khóa điểm</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 line-clamp-1">5. Bảo vệ & Lưu chiểu</div>
                        <div className="text-[11px] font-mono text-slate-500">Cấp giấy hoàn thành</div>
                    </div>
                </div>
            </div>

            </QueryPanel>
            {/* TWO-COLUMN TACTICAL GRID (68% / 32%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 8 Cols (68%): Phân bổ & Đợt trọng tâm */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Active Semester Hero Overview */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-[11px] font-bold text-[#0F766E] uppercase tracking-wider">
                                    Đợt Đồ Án Trọng Tâm
                                </span>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                    {activeSemester?.name || 'Học kỳ đồ án'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <QueryPanel query={semestersQuery} empty={semesters.length === 0} emptyDescription="Chưa có học kỳ">
                                <Select
                                    value={selectedSemesterId}
                                    onChange={setSelectedSemesterId}
                                    style={{ width: 220 }}
                                    options={semesters.map((s) => ({ value: s.id, label: formatSemesterLabel(s) }))}
                                    placeholder="Chọn đợt đồ án"
                                    size="small"
                                />
                                </QueryPanel>
                            </div>
                        </div>

                        <QueryPanel query={overviewQuery} empty={!semesterOverview} emptyDescription="Chưa có dữ liệu học kỳ này.">
                            {semesterOverview ? (
                                <div className="space-y-4 pt-1">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                                            <p className="text-[11px] font-semibold text-slate-500">Chờ xét duyệt</p>
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

                                    {/* Dual Progress Gauges */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-600">Tỷ lệ duyệt đề tài:</span>
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
                                                <span className="text-slate-600">Tỷ lệ hoàn thành bảo vệ:</span>
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
                                <p className="text-xs text-slate-500 font-medium py-4 text-center">Chưa có dữ liệu học kỳ này.</p>
                            )}
                        </QueryPanel>
                    </div>

                    {/* Phân bổ Đề tài theo Chuyên ngành / Bộ môn */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                                Phân Bổ Đề Tài Theo Chuyên Ngành / Bộ Môn
                            </h3>
                            <span className="text-xs text-slate-600 font-medium">4 Bộ môn Viện CNTT</span>
                        </div>

                        <div className="space-y-3.5">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-800">Kỹ thuật Phần mềm</span>
                                    <span className="font-mono text-slate-600 font-medium">92 đề tài • 98% đã gán SV</span>
                                </div>
                                <Progress percent={98} strokeColor="#0F766E" size="small" showInfo={false} />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-800">Công nghệ Thông tin</span>
                                    <span className="font-mono text-slate-600 font-medium">78 đề tài • 84% đã gán SV</span>
                                </div>
                                <Progress percent={84} strokeColor="#0284C7" size="small" showInfo={false} />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-800">Hệ thống Thông tin</span>
                                    <span className="font-mono text-slate-600 font-medium">46 đề tài • 78% đã gán SV</span>
                                </div>
                                <Progress percent={78} strokeColor="#7C3AED" size="small" showInfo={false} />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-800">Mạng máy tính & An ninh mạng</span>
                                    <span className="font-mono text-slate-600 font-medium">32 đề tài • 68% đã gán SV</span>
                                </div>
                                <Progress percent={68} strokeColor="#D97706" size="small" showInfo={false} />
                            </div>
                        </div>
                    </div>

                    {/* Phân bố Điểm Bảo vệ */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                                Phân Bố Điểm Khóa Luận Tốt Nghiệp
                            </h3>
                            <Button
                                size="small"
                                type="link"
                                icon={<ArrowRightOutlined />}
                                onClick={() => navigate('/admin/grading')}
                                className="text-xs font-semibold text-[#0F766E] p-0"
                            >
                                Xem chi tiết bảng điểm
                            </Button>
                        </div>

                        <QueryPanel query={scoresQuery} empty={scores.length === 0} emptyDescription="Chưa có dữ liệu phân bổ điểm cho đợt đồ án này.">
                        {scores.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    </div>
                </div>

                {/* Right 4 Cols (32%): Quick Actions & Live Activity */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Quick Dock */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                        <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                            Thao Tác Nhanh
                        </h3>
                        <div className="space-y-2">
                            <Button
                                block
                                icon={<CloudUploadOutlined className="text-teal-700" />}
                                onClick={() => navigate('/admin/users')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Import Dữ liệu Excel (SV / GV)
                            </Button>
                            <Button
                                block
                                icon={<TeamOutlined className="text-blue-700" />}
                                onClick={() => navigate('/admin/councils')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Phân công Hội đồng bảo vệ
                            </Button>
                            <Button
                                block
                                icon={<LockOutlined className="text-amber-700" />}
                                onClick={() => navigate('/admin/grading')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Khóa Sổ Điểm Hội Đồng
                            </Button>
                            <Button
                                block
                                icon={<SettingOutlined className="text-purple-700" />}
                                onClick={() => navigate('/admin/permissions')}
                                className="text-left flex items-center justify-start text-xs font-medium"
                            >
                                Cấu hình Phân quyền Người dùng
                            </Button>
                        </div>
                    </div>

                    {/* Live Activity Stream */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <HistoryOutlined className="text-[#0F766E]" />
                                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-900">
                                    Dòng Sự Kiện Thời Gian Thực
                                </h3>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${badge.color}`}>
                                            <span className="material-symbols-outlined text-sm">{badge.icon}</span>
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
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
