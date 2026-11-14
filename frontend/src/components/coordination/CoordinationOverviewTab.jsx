import { useCoordinationOverview } from '../../queries/lecturerAssignmentQueries';
import { queryKeys } from '../../query/queryKeys';
import useAuthStore from '../../stores/authStore';
import QueryPanel from '../common/QueryPanel';

import { Card, Progress, Tag, Alert, Button, Spin, Row, Col } from 'antd';
import {
    WarningOutlined,
    AlertOutlined,
    CheckCircleOutlined,
    TeamOutlined,
    UserOutlined,
    CalendarOutlined,
    ReloadOutlined,
    ArrowRightOutlined,
    AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

export function CoordinationOverviewTab({
    semesterId,
    projectCatalogId,
    semesters = [],
    catalogs = [],
    onNavigateTab,
}) {
    const user = useAuthStore(state => state.user);
    const overviewQuery = useCoordinationOverview(queryKeys.scope(user), { semesterId, projectCatalogId: projectCatalogId || undefined });
    const overviewData = overviewQuery.data;
    const loading = overviewQuery.isFetching;
    const fetchOverview = () => overviewQuery.refetch();

    const activeSemester = semesters.find((s) => s.id === Number(semesterId)) || overviewData?.semester;
    const activeCatalog = catalogs.find((c) => c.id === Number(projectCatalogId));

    const renderSemesterStatus = (status) => {
        switch (status) {
            case 'REGISTRATION':
                return <Tag color="blue" className="font-semibold">Đăng ký đề tài</Tag>;
            case 'ONGOING':
                return <Tag color="green" className="font-semibold">Đang thực hiện</Tag>;
            case 'DEFENSE':
                return <Tag color="purple" className="font-semibold">Bảo vệ hội đồng</Tag>;
            case 'FINISHED':
                return <Tag color="default">Đã kết thúc</Tag>;
            default:
                return <Tag>{status || 'Chưa bắt đầu'}</Tag>;
        }
    };

    const {
        totalEnrolledStudents = 0,
        totalAssignedStudents = 0,
        unassignedStudents = 0,
        totalAssignedLecturers = 0,
        totalPlannedSlots = 0,
        capacityUtilization = 0,
        overloadAlerts = [],
    } = overviewData || {};

    const criticalAlerts = overloadAlerts.filter((a) => a.severity === 'CRITICAL');
    const warningAlerts = overloadAlerts.filter((a) => a.severity !== 'CRITICAL');

    return (
        <QueryPanel query={overviewQuery}>
        <div className="space-y-5">
            {/* Header / Period Metadata Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="eyebrow text-teal-700 font-bold tracking-wide">ĐỢT ĐỒ ÁN ĐƯỢC CHỌN</span>
                        {activeSemester && renderSemesterStatus(activeSemester.status)}
                        {activeCatalog ? (
                            <Tag color="cyan" className="font-semibold">{activeCatalog.name}</Tag>
                        ) : (
                            <Tag color="default" className="text-slate-600">Toàn bộ môn đồ án</Tag>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                        {activeSemester?.name || 'Chưa chọn học kỳ'}
                        {activeSemester?.code ? ` (${activeSemester.code})` : ''}
                    </h2>
                    <div className="text-xs text-slate-600 flex items-center gap-3 font-medium">
                        <span className="flex items-center gap-1">
                            <CalendarOutlined className="text-teal-600" />
                            {activeSemester?.startDate
                                ? `${dayjs(activeSemester.startDate).format('DD/MM/YYYY')} - ${dayjs(activeSemester.endDate).format('DD/MM/YYYY')}`
                                : 'Chưa thiết lập thời gian'}
                        </span>
                        {activeSemester?.academicYear && (
                            <span>• Năm học: {activeSemester.academicYear}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchOverview}
                        loading={loading}
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric 1: Students */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <TeamOutlined className="text-teal-600" />
                            Sinh viên đợt này
                        </span>
                        <Button
                            type="link"
                            size="small"
                            className="text-xs p-0 text-teal-700 font-semibold"
                            onClick={() => onNavigateTab && onNavigateTab('students')}
                        >
                            Chi tiết <ArrowRightOutlined />
                        </Button>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900">{totalAssignedStudents}</span>
                        <span className="text-sm font-semibold text-slate-500">/ {totalEnrolledStudents} sinh viên</span>
                    </div>
                    <div className="text-xs space-y-1 pt-1">
                        <div className="flex justify-between text-slate-600">
                            <span>Đã có đề tài/hướng dẫn:</span>
                            <span className="font-bold text-teal-700">{totalAssignedStudents}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Chưa có đề tài hướng dẫn:</span>
                            <span className={`font-bold ${unassignedStudents > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                {unassignedStudents}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Metric 2: Lecturers & Planned Slots */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <UserOutlined className="text-teal-600" />
                            Giảng viên & Chỉ tiêu
                        </span>
                        <Button
                            type="link"
                            size="small"
                            className="text-xs p-0 text-teal-700 font-semibold"
                            onClick={() => onNavigateTab && onNavigateTab('lecturers')}
                        >
                            Chi tiết <ArrowRightOutlined />
                        </Button>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900">{totalAssignedLecturers}</span>
                        <span className="text-sm font-semibold text-slate-500">GV tham gia</span>
                    </div>
                    <div className="text-xs space-y-1 pt-1">
                        <div className="flex justify-between text-slate-600">
                            <span>Tổng chỉ tiêu tiếp nhận:</span>
                            <span className="font-bold text-slate-900">{totalPlannedSlots} slot</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Chỉ tiêu trung bình/GV:</span>
                            <span className="font-semibold text-slate-700">
                                {totalAssignedLecturers > 0
                                    ? (totalPlannedSlots / totalAssignedLecturers).toFixed(1)
                                    : 0} slot
                            </span>
                        </div>
                    </div>
                </div>

                {/* Metric 3: Capacity Utilization Progress */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <AuditOutlined className="text-teal-600" />
                            Tỷ lệ Lấp đầy Tải
                        </span>
                        <Tag
                            color={capacityUtilization > 100 ? 'red' : capacityUtilization >= 80 ? 'green' : 'blue'}
                            className="font-semibold text-xs"
                        >
                            {capacityUtilization}%
                        </Tag>
                    </div>
                    <div className="pt-1">
                        <Progress
                            percent={Math.min(100, capacityUtilization)}
                            status={capacityUtilization > 100 ? 'exception' : 'active'}
                            strokeColor={
                                capacityUtilization > 100
                                    ? '#DC2626'
                                    : capacityUtilization >= 80
                                    ? '#0F766E'
                                    : '#0284C7'
                            }
                        />
                    </div>
                    <div className="text-xs text-slate-500 pt-1">
                        {totalPlannedSlots > 0 ? (
                            <span>
                                Đã giao {totalAssignedStudents} / {totalPlannedSlots} slot chỉ tiêu kế hoạch
                            </span>
                        ) : (
                            <span className="text-amber-600 font-medium">Chưa thiết lập chỉ tiêu cho GV trong đợt này</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Overload Warning Alerts Banner */}
            {overloadAlerts.length > 0 ? (
                <div className="bg-white rounded-xl border border-amber-300 bg-amber-50/40 p-5 shadow-xs space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 text-xl font-bold border border-amber-200">
                                <WarningOutlined />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    Cảnh báo quá tải tải đỉnh ({overloadAlerts.length} giảng viên)
                                    {criticalAlerts.length > 0 && (
                                        <Tag color="red" className="font-bold">
                                            {criticalAlerts.length} GV chạm trần 10/10
                                        </Tag>
                                    )}
                                    {warningAlerts.length > 0 && (
                                        <Tag color="gold" className="font-bold">
                                            {warningAlerts.length} GV cận tải (8-9/10)
                                        </Tag>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                                    Thuật toán quét sweep tải đồng thời phát hiện các giảng viên dưới đây đang chạm hoặc vượt ngưỡng 8–10 sinh viên hướng dẫn cùng lúc giữa các đợt giao thoa. Vui lòng cân đối chỉ tiêu hoặc điều phối sang GV khác.
                                </p>
                            </div>
                        </div>

                        <Button
                            type="primary"
                            className="bg-amber-700 hover:bg-amber-800 border-none text-white font-semibold"
                            onClick={() => onNavigateTab && onNavigateTab('lecturers')}
                        >
                            Quản lý phân công GV
                        </Button>
                    </div>

                    {/* Table-like summary of overloaded lecturers */}
                    <div className="divide-y divide-amber-200/80 bg-white rounded-lg border border-amber-200 overflow-hidden text-xs">
                        {overloadAlerts.map((lecturer) => {
                            const isCritical = lecturer.severity === 'CRITICAL' || lecturer.peakConcurrentLoad >= 10;
                            return (
                                <div
                                    key={lecturer.lecturerId}
                                    className="p-3 px-4 flex flex-wrap items-center justify-between gap-3 hover:bg-amber-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-[220px]">
                                        <div
                                            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold shrink-0 ${
                                                isCritical
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            {lecturer.lecturerName?.[0]?.toUpperCase() || 'G'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">
                                                {lecturer.lecturerName}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {lecturer.lecturerCode} • {lecturer.department || 'Bộ môn chưa cập nhật'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 flex-wrap">
                                        <div>
                                            <span className="text-slate-500 block text-[11px]">Tải trong đợt:</span>
                                            <span className="font-bold text-slate-800">{lecturer.currentRoundLoad} SV</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-[11px]">Tải hôm nay:</span>
                                            <span className="font-bold text-slate-800">{lecturer.activeTodayLoad} / 10</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-[11px]">Tải đỉnh đồng thời:</span>
                                            <Tag
                                                color={isCritical ? 'red' : 'gold'}
                                                className="font-bold text-xs"
                                            >
                                                {lecturer.peakConcurrentLoad} / 10 (
                                                {isCritical ? 'CHẠM TRẦN' : 'CẬN TẢI'})
                                            </Tag>
                                        </div>
                                        {lecturer.peakInterval && (
                                            <div className="hidden sm:block text-[11px] text-slate-500">
                                                Khoảng đạt đỉnh: {dayjs(lecturer.peakInterval.start).format('DD/MM/YYYY')} - {dayjs(lecturer.peakInterval.end).format('DD/MM/YYYY')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-xs flex items-center gap-3">
                    <CheckCircleOutlined className="text-emerald-600 text-2xl shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-emerald-900">
                            Không có giảng viên nào chạm ngưỡng quá tải
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                            Tải hướng dẫn đồng thời của toàn bộ giảng viên trong đợt hiện đang dưới ngưỡng an toàn (dưới 8/10).
                        </p>
                    </div>
                </div>
            )}
        </div>
        </QueryPanel>
    );
}

export default CoordinationOverviewTab;
