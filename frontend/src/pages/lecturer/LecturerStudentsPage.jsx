import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Select, Tag } from 'antd';
import { CheckSquareOutlined, ReloadOutlined } from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useLecturerOverview } from '../../queries/dashboardQueries';
import { canViewFeature } from '../../auth/policyEvaluator';
import SupervisedStudentList from '../../components/lecturer/SupervisedStudentList';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';

/**
 * Trang danh sách sinh viên đang hướng dẫn của giảng viên hiện tại.
 * Dữ liệu lấy từ /api/dashboard/lecturer (lọc theo mentorId = actor.id và semesterId).
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

    if (overviewQuery.isPending && !overview) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-lecturer-students" className="space-y-4">
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 m-0">
                        Sinh viên đang hướng dẫn
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                        {activeSemester?.name && (
                            <Tag color="teal" className="m-0 font-semibold">
                                Đợt: {activeSemester.name}
                            </Tag>
                        )}
                        <span>
                            Chỉ hiển thị sinh viên thuộc danh sách hướng dẫn của bạn theo mô hình 1 sinh viên / 1 đề tài.
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {semesterOptions.length > 0 && (
                        <Select
                            aria-label="Chọn đợt đồ án"
                            value={effectiveSemesterId}
                            onChange={(value) => setSelectedSemesterId(value)}
                            options={semesterOptions}
                            style={{ minWidth: 210 }}
                            placeholder="Chọn đợt đồ án"
                        />
                    )}
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => overviewQuery.refetch()}
                        loading={overviewQuery.isFetching}
                    >
                        Làm mới
                    </Button>
                    {canApproveMentorRequests && (
                        <Button
                            type="primary"
                            icon={<CheckSquareOutlined />}
                            onClick={() => navigate('/lecturer/approvals?tab=mentor')}
                        >
                            Duyệt nguyện vọng
                        </Button>
                    )}
                </div>
            </header>

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
                    onOpenDossier={handleOpenDossier}
                    onOpenMeetingModal={handleOpenMeeting}
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
