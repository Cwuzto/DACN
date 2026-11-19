import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Progress, Select, Tag } from 'antd';
import {
    ApartmentOutlined,
    ArrowRightOutlined,
    CheckSquareOutlined,
    ExclamationCircleOutlined,
    FileTextOutlined,
    ReloadOutlined,
    ScheduleOutlined,
    TrophyOutlined,
    UsergroupAddOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useLecturerOverview } from '../../queries/dashboardQueries';
import { useBm02aQueue } from '../../queries/bm02aQueries';
import { canViewFeature, getEffectivePermissions } from '../../auth/policyEvaluator';
import SupervisedStudentList from '../../components/lecturer/SupervisedStudentList';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';

const getAcademicStep = (status) => {
    switch (status) {
        case 'ASSIGNED':
        case 'BM01_SUBMITTED':
        case 'BM01_REVISION_SUBMITTED':
        case 'BM01_NEEDS_REVISION':
        case 'BM01_REJECTED':
            return 1;
        case 'BM01_APPROVED':
        case 'BM02_PENDING':
        case 'BM02_APPROVED':
            return 2;
        case 'IN_PROGRESS':
        case 'IN_PROGRESS_BM03':
        case 'STOP_REVIEW_PENDING':
        case 'TERMINATED':
            return 3;
        case 'BM04_PENDING':
        case 'BM04_SUBMITTED':
        case 'BM04_REVISION':
        case 'READY_FOR_DEFENSE':
        case 'DEFENSE_READY':
        case 'DEFENSE_ELIGIBLE':
            return 4;
        case 'DEFENSE_PASSED':
        case 'DEFENDED':
        case 'COMPLETED':
            return 5;
        default:
            return 2;
    }
};

/**
 * Trang danh sách sinh viên đang hướng dẫn của giảng viên hiện tại.
 * Thiết kế mới theo phong cách Bento Grid & Swiss Style, bổ sung dải màu gradient học thuật,
 * các thẻ thống kê tổng quan, thanh tiến trình học vụ và hiệu ứng chuyển động UX mượt mà.
 */
export default function LecturerStudentsPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [dossierOpen, setDossierOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);

    const overviewQuery = useLecturerOverview(scope, selectedSemesterId);
    const overview = overviewQuery.data;

    const semesters = useMemo(
        () => (Array.isArray(overview?.semesters) ? overview.semesters : []),
        [overview]
    );
    const activeSemester = overview?.activeSemester || null;
    const students = useMemo(
        () => (Array.isArray(overview?.students) ? overview.students : []),
        [overview]
    );

    const semesterOptions = useMemo(
        () => semesters.map((sem) => ({ value: sem.id, label: sem.name })),
        [semesters]
    );

    const effectiveSemesterId = selectedSemesterId ?? activeSemester?.id ?? undefined;
    const canApproveMentorRequests = canViewFeature(user, 'mentored-students');
    const canSignBm02a = useMemo(
        () => getEffectivePermissions(user).has('BM02A_ADVISOR_SIGN'),
        [user]
    );
    const bm02aQueueQuery = useBm02aQueue(scope, canSignBm02a);

    const bm02aByRegistrationId = useMemo(() => {
        const map = {};
        const queue = Array.isArray(bm02aQueueQuery.data) ? bm02aQueueQuery.data : [];
        for (const req of queue) {
            if (req?.status !== 'PENDING_ADVISOR') continue;
            const regId = req.registrationId ?? req.registration?.id;
            if (regId && req.id && !map[regId]) {
                map[regId] = req.id;
            }
        }
        return map;
    }, [bm02aQueueQuery.data]);

    // Compute academic stage summary metrics
    const stats = useMemo(() => {
        let outlineCount = 0;
        let progressCount = 0;
        let evaluationCount = 0;
        let completedCount = 0;

        for (const s of students) {
            const step = getAcademicStep(s.status);
            if (step === 1) outlineCount++;
            else if (step === 2 || step === 3) progressCount++;
            else if (step === 4) evaluationCount++;
            else if (step === 5) completedCount++;
        }

        const pendingBm02aCount = Object.keys(bm02aByRegistrationId).length;

        return {
            total: students.length,
            outlineCount,
            progressCount,
            evaluationCount,
            completedCount,
            pendingBm02aCount,
        };
    }, [students, bm02aByRegistrationId]);

    const handleOpenDossier = (student) => {
        if (!student?.registrationId) return;
        setSelectedRegistration({
            id: student.registrationId,
            status: student.status,
            student: {
                id: student.studentId,
                fullName: student.studentName,
                code: student.studentCode,
            },
            topic: {
                id: student.topicId,
                title: student.topicTitle,
            },
        });
        setDossierOpen(true);
    };

    const handleOpenMeeting = (student) => {
        if (student?.registrationId) {
            navigate(`/lecturer/progress?registrationId=${student.registrationId}`);
            return;
        }
        navigate('/lecturer/progress');
    };

    const handleOpenTitleAdjustment = (student) => {
        const requestId =
            student?.bm02aRequestId ?? bm02aByRegistrationId[student?.registrationId];
        if (requestId) {
            navigate(`/lecturer/title-adjustments?requestId=${requestId}`);
            return;
        }
        navigate('/lecturer/title-adjustments');
    };

    if (overviewQuery.isPending && !overview) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-lecturer-students" className="space-y-5">
            {/* Modern Hero Banner with Gradient Accents & Subtle Geometry */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white p-6 sm:p-8 shadow-xl border border-teal-800/40">
                {/* Decorative background glow orbs */}
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30 backdrop-blur-sm">
                                <ApartmentOutlined /> Giảng viên hướng dẫn
                            </span>
                            {activeSemester?.name && (
                                <Tag color="teal" className="m-0 font-semibold px-2.5 py-0.5 rounded-full border-teal-400/40 bg-teal-900/60 text-teal-200">
                                    Đợt: {activeSemester.name}
                                </Tag>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight m-0">
                            Sinh viên đang hướng dẫn
                        </h1>
                        <p className="text-xs sm:text-sm text-teal-100/80 m-0 leading-relaxed">
                            Chỉ hiển thị sinh viên thuộc danh sách hướng dẫn của bạn theo mô hình 1 sinh viên / 1 đề tài.
                        </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {semesterOptions.length > 0 && (
                            <Select
                                aria-label="Chọn đợt đồ án"
                                value={effectiveSemesterId}
                                onChange={(value) => setSelectedSemesterId(value)}
                                options={semesterOptions}
                                style={{ minWidth: 220 }}
                                placeholder="Chọn đợt đồ án"
                                className="bg-white rounded-lg shadow-sm"
                            />
                        )}
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => overviewQuery.refetch()}
                            loading={overviewQuery.isFetching}
                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                        >
                            Làm mới
                        </Button>
                        {canApproveMentorRequests && (
                            <Button
                                type="primary"
                                icon={<CheckSquareOutlined />}
                                onClick={() => navigate('/lecturer/approvals?tab=mentor')}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-none shadow-md"
                            >
                                Duyệt nguyện vọng
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bento Quick Stat Tiles — Aligned with Overview KPI Typography Standards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Metric 1: Quota */}
                <div className="bg-white rounded-xl border border-teal-200/90 bg-teal-50/40 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Chỉ tiêu hướng dẫn
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums flex items-baseline gap-1.5">
                                <span>{students.length}</span>
                                <span className="text-xs text-slate-500 font-normal">/ 10 sinh viên</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <UsergroupAddOutlined className="text-teal-600 text-lg" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <Progress
                            percent={Math.min(100, students.length * 10)}
                            showInfo={false}
                            strokeColor="#0D9488"
                            size={['100%', 4]}
                            className="m-0"
                        />
                        <div className="text-xs text-slate-500 mt-1">Quy định tối đa 10 SV/đợt</div>
                    </div>
                </div>

                {/* Metric 2: Outline & Approved */}
                <div className="bg-white rounded-xl border border-blue-200/90 bg-blue-50/40 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Đề cương BM01
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                                {stats.outlineCount}
                            </div>
                            <div className="text-xs text-blue-700 font-medium mt-1">Đang duyệt & hoàn thiện</div>
                            <div className="text-xs text-slate-500 mt-0.5">Khởi đầu quy trình đồ án</div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <FileTextOutlined className="text-blue-600 text-lg" />
                        </div>
                    </div>
                </div>

                {/* Metric 3: Progress BM03 */}
                <div className="bg-white rounded-xl border border-purple-200/90 bg-purple-50/40 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Tiến độ BM03
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                                {stats.progressCount}
                            </div>
                            <div className="text-xs text-purple-700 font-medium mt-1">Gặp định kỳ & Checkpoint</div>
                            <div className="text-xs text-slate-500 mt-0.5">Thực hiện nghiên cứu & giải pháp</div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <ScheduleOutlined className="text-purple-600 text-lg" />
                        </div>
                    </div>
                </div>

                {/* Metric 4: Defense & Completion */}
                <div className="bg-white rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Đánh giá & Bảo vệ
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                                {stats.evaluationCount + stats.completedCount}
                            </div>
                            <div className="text-xs text-emerald-700 font-medium mt-1">Sẵn sàng / Đã đạt bảo vệ</div>
                            <div className="text-xs text-slate-500 mt-0.5">BM04 và Hội đồng bảo vệ</div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            <TrophyOutlined className="text-emerald-600 text-lg" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification alert if there are pending BM02-A requests */}
            {stats.pendingBm02aCount > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 shadow-xs">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                        <ExclamationCircleOutlined className="text-amber-600 text-base animate-pulse" />
                        <span>Có <strong>{stats.pendingBm02aCount}</strong> sinh viên đang có yêu cầu điều chỉnh tên đề tài BM02-A chờ bạn ký duyệt.</span>
                    </div>
                    <Button
                        size="small"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate('/lecturer/title-adjustments')}
                        className="border-amber-400 text-amber-900 bg-white hover:bg-amber-100 font-medium text-xs"
                    >
                        Xem phiếu BM02-A
                    </Button>
                </div>
            )}

            {/* Error or Main Content */}
            {overviewQuery.isError ? (
                <Alert
                    type="error"
                    showIcon
                    message="Không thể tải danh sách sinh viên đang hướng dẫn"
                    description={overviewQuery.error?.message || 'Đã xảy ra lỗi khi tải dữ liệu.'}
                    action={(
                        <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => overviewQuery.refetch()}
                        >
                            Thử lại
                        </Button>
                    )}
                />
            ) : (
                <SupervisedStudentList
                    students={students}
                    bm02aByRegistrationId={bm02aByRegistrationId}
                    onOpenDossier={handleOpenDossier}
                    onOpenMeetingModal={handleOpenMeeting}
                    onOpenTitleAdjustment={handleOpenTitleAdjustment}
                />
            )}

            <AcademicDossierDrawer
                open={dossierOpen}
                onClose={() => {
                    setDossierOpen(false);
                    setSelectedRegistration(null);
                }}
                registration={selectedRegistration}
            />
        </section>
    );
}
