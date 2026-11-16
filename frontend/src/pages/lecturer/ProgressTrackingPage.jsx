import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Tag, Alert, Select, Radio, Input, Space, Popconfirm, message } from 'antd';
import {
    PlusOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    FilePdfOutlined,
    FileDoneOutlined,
    SaveOutlined,
    SafetyCertificateOutlined,
    NotificationOutlined,
    ExclamationCircleOutlined,
    TeamOutlined,
    HistoryOutlined,
    CloseOutlined,
    PrinterOutlined,
    CalendarOutlined,
    EnvironmentOutlined,
    BookOutlined,
    UserOutlined,
    VideoCameraOutlined,
    CheckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import taskService from '../../services/taskService';
import meetingLogService from '../../services/meetingLogService';
import archiveService from '../../services/archiveService';
import BM04EvaluationModal from '../../components/lecturer/BM04EvaluationModal';
import CheckpointIssueModal from '../../components/lecturer/CheckpointIssueModal';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import AcademicFormPrintModal from '../../components/prints/AcademicFormPrintModal';
import BM03PrintSheet from '../../components/prints/BM03PrintSheet';
import BM04PrintSheet from '../../components/prints/BM04PrintSheet';
import evaluationService from '../../services/evaluationService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useSemesters } from '../../queries/semesterQueries';
import { useProjectCatalogs } from '../../queries/topicQueries';
import { useRegistrations } from '../../queries/registrationQueries';
import { useTasksByRegistration, useTaskMutation } from '../../queries/taskQueries';
import { useMeetingLogs, useBM03Record, useMeetingMutation } from '../../queries/meetingQueries';
import { useCheckpointEvaluations, useCheckpointMutation } from '../../queries/checkpointQueries';
import { useStudentArchive } from '../../queries/archiveQueries';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';

/**
 * ProgressTrackingPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html (view-progress):
 * - Split layout: Left column student cards list, right column detailed workspace
 * - 4 Sub Nav Tabs:
 *   1. Nhiệm vụ tuần (Tasks)
 *   2. Nhật ký trao đổi (BM03 timeline)
 *   3. Đánh giá Checkpoint (Checkpoint 1 & 2)
 *   4. Thẩm định BM04 & Nghiệm thu Lưu chiểu
 * - Interactive modals: Giao việc mới, Ghi nhận buổi gặp, Chấm BM04, Giấy xác nhận
 */
export default function ProgressTrackingPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const paramRegId = searchParams.get('registrationId');
    const tabParam = searchParams.get('tab');

    const resolveTabKey = (tab) => {
        if (tab === 'bm04' || tab === 'archive') return 'archive';
        if (tab === 'meeting-logs' || tab === 'bm03') return 'meeting-logs';
        if (tab === 'checkpoints') return 'checkpoints';
        if (tab === 'tasks') return 'tasks';
        return null;
    };

    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const scope = useMemo(() => queryKeys.scope(currentUser), [currentUser]);

    const registrationsQuery = useRegistrations(scope);
    const rawStudents = useMemo(
        () => (Array.isArray(registrationsQuery.data) ? registrationsQuery.data : []),
        [registrationsQuery.data]
    );
    const students = useMemo(
        () => rawStudents.filter((r) => !['PENDING', 'REJECTED', 'WITHDRAWN', 'DROPPED'].includes(r.status)),
        [rawStudents]
    );

    const semestersQuery = useSemesters(scope);
    const semesters = Array.isArray(semestersQuery.data) ? semestersQuery.data : [];
    const catalogsQuery = useProjectCatalogs(scope);
    const catalogs = Array.isArray(catalogsQuery.data) ? catalogsQuery.data : [];

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [filterSemesterId, setFilterSemesterId] = useState('ALL');
    const [filterCatalog, setFilterCatalog] = useState('ALL');
    const [activeTab, setActiveTab] = useState(() => resolveTabKey(tabParam) || 'tasks'); // 'tasks' | 'meeting-logs' | 'checkpoints' | 'archive'

    useEffect(() => {
        const resolved = resolveTabKey(tabParam);
        if (resolved && resolved !== activeTab) {
            setActiveTab(resolved);
        }
    }, [tabParam]);

    const handleTabChange = (key) => {
        setActiveTab(key);
        const nextParams = new URLSearchParams(searchParams);
        if (key === 'archive') {
            nextParams.set('tab', 'bm04');
        } else if (key === 'tasks') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', key);
        }
        setSearchParams(nextParams, { replace: true });
    };

    const filteredStudents = useMemo(() => {
        let list = students;

        if (filterSemesterId !== 'ALL') {
            list = list.filter((s) => s.semesterId === Number(filterSemesterId) || s.topic?.semesterId === Number(filterSemesterId));
        }

        if (filterCatalog !== 'ALL') {
            list = list.filter((s) => {
                const catCode = s.topic?.projectCatalog?.code;
                const catName = s.topic?.projectCatalog?.name;
                const catId = s.topic?.projectCatalogId || s.topic?.projectCatalog?.id;
                return catCode === filterCatalog || catName === filterCatalog || String(catId) === String(filterCatalog);
            });
        }

        if (studentSearch.trim()) {
            const q = studentSearch.trim().toLowerCase();
            list = list.filter(
                (s) =>
                    (s.student?.fullName && s.student.fullName.toLowerCase().includes(q)) ||
                    (s.student?.code && s.student.code.toLowerCase().includes(q)) ||
                    (s.topic?.title && s.topic.title.toLowerCase().includes(q)) ||
                    (s.topic?.code && s.topic.code.toLowerCase().includes(q))
            );
        }

        return list;
    }, [students, studentSearch, filterSemesterId, filterCatalog]);

    // Auto-select first matching student
    useEffect(() => {
        if (filteredStudents.length > 0) {
            setSelectedStudent((current) => {
                if (paramRegId) {
                    const found = filteredStudents.find((s) => String(s.id) === String(paramRegId));
                    if (found) return found;
                }
                if (current && filteredStudents.some((s) => s.id === current.id)) {
                    return filteredStudents.find((s) => s.id === current.id);
                }
                return filteredStudents[0];
            });
        } else {
            setSelectedStudent(null);
        }
    }, [filteredStudents, paramRegId]);

    const selectedRegId = selectedStudent?.id || null;
    const isStudentSelected = Boolean(selectedRegId);

    // Queries gated on selected student
    const tasksQuery = useTasksByRegistration(scope, selectedRegId, isStudentSelected);
    const meetingLogsQuery = useMeetingLogs(scope, selectedRegId, isStudentSelected);
    const bm03Query = useBM03Record(scope, selectedRegId, isStudentSelected);
    const checkpointsQuery = useCheckpointEvaluations(scope, selectedRegId, isStudentSelected);
    const archiveQuery = useStudentArchive(scope, selectedRegId, isStudentSelected);

    const taskMutation = useTaskMutation(scope, selectedRegId);
    const meetingMutation = useMeetingMutation(scope, selectedRegId);
    const checkpointMutation = useCheckpointMutation(scope, selectedRegId);

    // Selected student data derived from queries
    const tasks = useMemo(() => (Array.isArray(tasksQuery.data) ? tasksQuery.data : []), [tasksQuery.data]);
    const bm03Record = bm03Query.data || null;
    const meetingLogs = useMemo(() => {
        const meetings = bm03Record?.meetings || bm03Record?.meetingEntries || [];
        const raw = meetings.length > 0 ? meetings : (Array.isArray(meetingLogsQuery.data) ? meetingLogsQuery.data : []);
        // Sắp xếp tăng dần theo thời gian để gán số thứ tự buổi gặp chuẩn xác (Buổi 1 là buổi sớm nhất)
        const chronological = [...raw].sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));
        const withIndex = chronological.map((item, idx) => ({
            ...item,
            meetingIndex: idx + 1,
        }));
        // Sắp xếp mới nhất lên đầu để hiển thị timeline trực quan
        return withIndex.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));
    }, [bm03Record, meetingLogsQuery.data]);
    const checkpoints = useMemo(
        () => (Array.isArray(checkpointsQuery.data) ? checkpointsQuery.data : []),
        [checkpointsQuery.data]
    );
    const archiveData = useMemo(
        () => archiveQuery.data?.archive || archiveQuery.data?.data?.archive || archiveQuery.data || null,
        [archiveQuery.data]
    );

    const [mentorReviewNotes, setMentorReviewNotes] = useState('');
    const [mentorReviewing, setMentorReviewing] = useState(false);

    // Modals
    const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);
    const [selectedCheckpointNo, setSelectedCheckpointNo] = useState(1);
    const [bm04ModalOpen, setBm04ModalOpen] = useState(false);
    const [bm03PrintOpen, setBm03PrintOpen] = useState(false);
    const [bm04PrintOpen, setBm04PrintOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [timelineOpen, setTimelineOpen] = useState(false);

    // New Task Form
    const [taskWeek, setTaskWeek] = useState('11');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [taskDueDate, setTaskDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'));
    const [taskSubmitting, setTaskSubmitting] = useState(false);

    // New Meeting Form (BM03 Meeting Entry)
    const [meetingDate, setMeetingDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [meetingMode, setMeetingMode] = useState('IN_PERSON');
    const [meetingLocation, setMeetingLocation] = useState('Tại Lab H2-502');
    const [meetingContent, setMeetingContent] = useState('');
    const [studentCompletedWork, setStudentCompletedWork] = useState('');
    const [remainingIssues, setRemainingIssues] = useState('');
    const [progressRating, setProgressRating] = useState('ON_TRACK');
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);
    const [signingMeetingId, setSigningMeetingId] = useState(null);

    // BM03 State & Stage Evaluations
    const [signingWholeBm03, setSigningWholeBm03] = useState(false);
    const [midtermDecision, setMidtermDecision] = useState('CONTINUE');
    const [midtermComments, setMidtermComments] = useState('');
    const [midtermSubmitting, setMidtermSubmitting] = useState(false);

    const [finalDecision, setFinalDecision] = useState('CONTINUE_TO_BM04');
    const [finalComments, setFinalComments] = useState('');
    const [finalSubmitting, setFinalSubmitting] = useState(false);

    // Sync stage evaluation values from BM03 record
    useEffect(() => {
        if (bm03Record) {
            const stageEvals = bm03Record?.stageEvaluations || [];
            const midterm = bm03Record.midtermStageEvaluation || stageEvals.find((e) => e.stage === 'MIDTERM');
            if (midterm) {
                setMidtermDecision(midterm.decision || 'CONTINUE');
                setMidtermComments(midterm.comments || '');
            }
            const final = bm03Record.finalStageEvaluation || stageEvals.find((e) => e.stage === 'FINAL');
            if (final) {
                setFinalDecision(final.decision || 'CONTINUE_TO_BM04');
                setFinalComments(final.comments || '');
            }
        }
    }, [bm03Record]);

    const loadStudentDetails = useCallback(async () => {
        if (!selectedRegId) return;
        await Promise.all([
            tasksQuery.refetch(),
            meetingLogsQuery.refetch(),
            bm03Query.refetch(),
            checkpointsQuery.refetch(),
            archiveQuery.refetch(),
        ]);
    }, [selectedRegId, tasksQuery, meetingLogsQuery, bm03Query, checkpointsQuery, archiveQuery]);

    const handleCreateTask = async () => {
        if (!taskTitle.trim()) {
            message.warning('Vui lòng nhập tên nhiệm vụ');
            return;
        }

        try {
            setTaskSubmitting(true);
            await taskMutation.mutateAsync({
                action: 'createTask',
                args: [{
                    registrationId: selectedStudent.id,
                    title: `Tuần ${taskWeek}: ${taskTitle.trim()}`,
                    description: taskDesc.trim() || undefined,
                    dueDate: new Date(taskDueDate),
                    taskType: 'PROGRESS_REPORT',
                }],
            });
            message.success('Đã giao nhiệm vụ mới cho sinh viên!');
            setNewTaskModalOpen(false);
            setTaskTitle('');
            setTaskDesc('');
        } catch (error) {
            message.error(error?.message || 'Không thể tạo nhiệm vụ');
        } finally {
            setTaskSubmitting(false);
        }
    };

    const handleCreateMeeting = async () => {
        if (!meetingContent.trim()) {
            message.warning('Vui lòng nhập nội dung buổi trao đổi');
            return;
        }

        try {
            setMeetingSubmitting(true);
            await meetingMutation.mutateAsync({
                action: 'createMeetingEntry',
                args: [selectedStudent.id, {
                    meetingDate: new Date(meetingDate),
                    meetingMode: meetingLocation.includes('Meet') || meetingLocation.includes('Online') ? 'ONLINE' : meetingMode,
                    locationOrLink: meetingLocation.trim(),
                    discussionContent: meetingContent.trim(),
                    studentCompletedWork: studentCompletedWork.trim() || undefined,
                    remainingIssues: remainingIssues.trim() || undefined,
                    progressRating,
                }],
            });
            message.success('Đã ghi nhận nhật ký buổi hướng dẫn BM03 thành công!');
            setMeetingModalOpen(false);
            setMeetingContent('');
            setStudentCompletedWork('');
            setRemainingIssues('');
        } catch (error) {
            message.error(error?.message || 'Không thể lưu nhật ký');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    const handleSignMeetingEntry = async (meetingId) => {
        try {
            setSigningMeetingId(meetingId);
            await meetingMutation.mutateAsync({
                action: 'signMeetingEntry',
                args: [meetingId, {
                    signatureImageId: currentUser?.signatureImageId || null,
                }],
            });
            message.success('Đã ký khóa buổi hướng dẫn thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi ký khóa buổi hướng dẫn');
        } finally {
            setSigningMeetingId(null);
        }
    };

    const handleSubmitMidtermEvaluation = async () => {
        if (!midtermComments.trim()) {
            message.warning('Vui lòng nhập nhận xét đánh giá giữa kỳ');
            return;
        }
        try {
            setMidtermSubmitting(true);
            await meetingMutation.mutateAsync({
                action: 'submitStageEvaluation',
                args: [selectedStudent.id, {
                    stage: 'MIDTERM',
                    decision: midtermDecision,
                    comments: midtermComments.trim(),
                }],
            });
            message.success('Đã lưu đánh giá giữa kỳ thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lưu đánh giá giữa kỳ');
        } finally {
            setMidtermSubmitting(false);
        }
    };

    const handleSubmitFinalEvaluation = async () => {
        if (!finalComments.trim()) {
            message.warning('Vui lòng nhập nhận xét đánh giá cuối kỳ');
            return;
        }
        try {
            setFinalSubmitting(true);
            await meetingMutation.mutateAsync({
                action: 'submitStageEvaluation',
                args: [selectedStudent.id, {
                    stage: 'FINAL',
                    decision: finalDecision,
                    comments: finalComments.trim(),
                }],
            });
            message.success('Đã lưu đánh giá cuối kỳ thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lưu đánh giá cuối kỳ');
        } finally {
            setFinalSubmitting(false);
        }
    };

    const handleAdvisorSignWholeBM03 = async () => {
        if (!bm03Record?.id) {
            message.warning('Chưa có hồ sơ BM03 để ký');
            return;
        }
        try {
            setSigningWholeBm03(true);
            await meetingMutation.mutateAsync({
                action: 'advisorSignWholeBM03',
                args: [bm03Record.id, {
                    signatureImageId: currentUser?.signatureImageId || null,
                }],
            });
            message.success('Đã ký xác nhận toàn phiếu BM03 thành công! Sinh viên có 48 giờ để xác nhận.');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi ký toàn phiếu BM03');
        } finally {
            setSigningWholeBm03(false);
        }
    };

    const handleMentorReview = async (reviewStatus) => {
        if (!archiveData?.id) {
            message.warning('Sinh viên chưa nộp hồ sơ lưu chiểu.');
            return;
        }
        try {
            setMentorReviewing(true);
            const res = await archiveService.reviewArchiveByMentor(archiveData.id, {
                status: reviewStatus,
                notes: mentorReviewNotes.trim() || undefined,
            });
            if (res.success) {
                message.success('Đã cập nhật đánh giá hồ sơ lưu chiểu thành công!');
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.archives.detail(scope, selectedRegId),
                });
            } else {
                message.error(res.message || 'Thao tác không thành công.');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi thẩm định hồ sơ lưu chiểu.');
        } finally {
            setMentorReviewing(false);
        }
    };

    const reg = selectedStudent;
    const bm04Status = reg?.status === 'COMPLETED' || reg?.status === 'DEFENDED' || reg?.status === 'DEFENSE_READY';
    const regWaitingBM04 = reg?.status === 'BM03_PASSED' || reg?.status === 'BM04_REVIEW' || Boolean(reg?.bm03Record?.advisorSignedAt);
    const progress = reg?.progressPercent ?? reg?.progress ?? (bm04Status ? 100 : 0);
    const isAtRisk = !bm04Status && !regWaitingBM04 && (Boolean(reg?.isMeetingWarning) || progress < 50);

    return (
        <section id="view-progress" className="view-pane active" style={{ display: 'block' }}>
            {/* 1. Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="flex-wrap gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Theo Dõi Tiến Độ & Biểu Mẫu Hướng Dẫn
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Giao nhiệm vụ theo tuần, lưu nhật ký gặp hướng dẫn và hoàn thiện phiếu nhận xét của người hướng dẫn.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }} className="flex-wrap items-center">
                    <Button
                        icon={<NotificationOutlined />}
                        onClick={() => message.success(`Đã gửi email nhắc nhở đôn đốc tiến độ đến ${students.length} sinh viên!`)}
                    >
                        Nhắc nộp bài hàng loạt
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setNewTaskModalOpen(true)}
                    >
                        Giao việc mới
                    </Button>
                </div>
            </div>

            {/* 2. Split Layout (OpenDesign 2-Column Standard) */}
            <div className="split-layout">
                {/* Left Column: Student Cards List */}
                <div className="student-list-col">
                    <div className="student-search-box" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Tìm sinh viên, MSSV, đề tài..."
                            style={{ width: '100%' }}
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <Select
                                size="small"
                                className="w-full text-xs"
                                value={filterSemesterId}
                                onChange={(val) => setFilterSemesterId(val)}
                                options={[
                                    { value: 'ALL', label: 'Tất cả đợt' },
                                    ...semesters.map((s) => ({
                                        value: s.id,
                                        label: s.name,
                                    })),
                                ]}
                            />
                            <Select
                                size="small"
                                className="w-full text-xs"
                                value={filterCatalog}
                                onChange={(val) => setFilterCatalog(val)}
                                options={[
                                    { value: 'ALL', label: 'Tất cả loại' },
                                    ...catalogs.map((c) => ({
                                        value: c.code,
                                        label: c.code,
                                    })),
                                ]}
                            />
                        </div>
                    </div>

                    <QueryPanel query={registrationsQuery}>
                        <div className="student-cards-scroll" id="student-select-list">
                            {filteredStudents.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                                    Không tìm thấy sinh viên nào.
                                </div>
                            ) : (
                                filteredStudents.map((s) => {
                                    const isSel = s.id === reg?.id;
                                    const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';
                                    const sBm03Done = s.status === 'BM03_PASSED' || s.status === 'BM04_REVIEW' || Boolean(s.bm03Record?.advisorSignedAt);
                                    const sProgress = s.progressPercent ?? s.progress ?? (sPassed ? 100 : sBm03Done ? 75 : 0);
                                    const sRisk = !sPassed && !sBm03Done && (Boolean(s.isMeetingWarning) || sProgress < 50);
                                    const logCount = s.totalMeetings ?? s._count?.meetingLogs ?? s.meetingLogs?.length ?? 0;

                                    return (
                                        <div
                                            key={s.id}
                                            className={`student-item-card ${isSel ? 'selected' : ''}`}
                                            onClick={() => setSelectedStudent(s)}
                                        >
                                            <div className="student-card-top">
                                                <span className="student-card-name">{s.student?.fullName}</span>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <span
                                                        className={`tag ${s.topic?.projectCatalog?.code === 'DATN' ? 'purple' : 'teal'}`}
                                                        style={{ fontSize: 10, padding: '1px 5px', fontWeight: 600 }}
                                                    >
                                                        {s.topic?.projectCatalog?.code || 'DACN'}
                                                    </span>
                                                    <span className={`tag ${sPassed ? 'green' : sRisk ? 'red' : sBm03Done ? 'blue' : 'yellow'}`}>
                                                        {sPassed ? 'Đủ điều kiện BV' : sRisk ? 'Nguy cơ trễ' : sBm03Done ? 'Chờ duyệt BM04' : 'Đang làm'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="student-card-topic">
                                                {s.topic?.code || 'DT'}: {s.topic?.title}
                                            </div>
                                            <div className="student-card-foot">
                                                <span>MSSV: {s.student?.code}</span>
                                                <strong style={{ color: logCount >= 3 ? 'var(--primary)' : 'var(--warning)' }}>
                                                    {logCount} buổi gặp
                                                </strong>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </QueryPanel>
                </div>

                {/* Right Column: Detailed Supervision Workspace */}
                <div className="supervision-detail-col">
                    {/* Header Bar */}
                    <div className="supervision-header-bar flex-wrap gap-3">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h2 style={{ fontSize: 16 }}>{reg?.student?.fullName || 'Chọn sinh viên'}</h2>
                                <span className="mono" style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                                    MSSV: {reg?.student?.code || '-'}
                                </span>
                                <span className={`tag ${bm04Status ? 'green' : regWaitingBM04 ? 'blue' : 'yellow'}`}>
                                    {bm04Status
                                        ? '✓ Đã duyệt phiếu nhận xét — Đủ điều kiện bảo vệ'
                                        : regWaitingBM04
                                            ? 'Đã hoàn thành BM03 — Chờ lập phiếu BM04'
                                            : 'Đang thực hiện'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--fg)', marginTop: 3 }}>
                                {reg?.topic?.code || 'DT'}: {reg?.topic?.title}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Button
                                icon={<PrinterOutlined />}
                                onClick={() => setBm03PrintOpen(true)}
                            >
                                In Sổ tiến độ BM03
                            </Button>
                            <Button
                                icon={<PrinterOutlined />}
                                onClick={() => setBm04PrintOpen(true)}
                                disabled={!bm04Status && !reg?.bm04Evaluation}
                            >
                                In Phiếu BM04
                            </Button>
                            <Button
                                icon={<HistoryOutlined />}
                                onClick={() => setTimelineOpen(true)}
                            >
                                Lịch sử tiến trình
                            </Button>
                            <Button
                                icon={<FilePdfOutlined />}
                                onClick={() => message.info('Mở xem bản dự thảo luận văn tốt nghiệp...')}
                            >
                                Xem Báo cáo PDF
                            </Button>
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                onClick={() => setBm04ModalOpen(true)}
                            >
                                Lập / Cập nhật Phiếu nhận xét
                            </Button>
                        </div>
                    </div>

                    {/* Risk Alert Bar */}
                    {isAtRisk && (
                        <div
                            id="risk-alert-bar"
                            style={{
                                display: 'flex',
                                padding: '10px 20px',
                                background: '#FEE2E2',
                                borderBottom: '1px solid #FCA5A5',
                                color: '#991B1B',
                                fontSize: '12.5px',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>
                                    <strong>Cảnh báo học vụ:</strong> Sinh viên này có nguy cơ chậm tiến độ. Hãy lên lịch hẹn gặp trao đổi ngay!
                                </span>
                            </div>
                            <Button
                                danger
                                icon={<PlusOutlined />}
                                onClick={() => setMeetingModalOpen(true)}
                            >
                                Ghi nhận buổi hướng dẫn mới
                            </Button>
                        </div>
                    )}

                    {/* Sub Nav Tabs */}
                    <div className="detail-nav-tabs">
                        <div
                            className={`d-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                            onClick={() => handleTabChange('tasks')}
                        >
                            1. Nhiệm vụ tuần
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'meeting-logs' ? 'active' : ''}`}
                            onClick={() => handleTabChange('meeting-logs')}
                        >
                            2. Nhật ký trao đổi
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'checkpoints' ? 'active' : ''}`}
                            onClick={() => handleTabChange('checkpoints')}
                        >
                            3. Đánh giá tiến độ
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'archive' ? 'active' : ''}`}
                            onClick={() => handleTabChange('archive')}
                        >
                            4. Phiếu nhận xét & Lưu chiểu
                        </div>
                    </div>

                    {/* Tab Body */}
                    <div className="detail-tab-body">
                        {/* TAB 1: TASKS */}
                        {activeTab === 'tasks' && (
                            <div id="tab-tasks" className="tab-pane-content">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                        Danh sách nhiệm vụ giao theo tuần ({tasks.length} nhiệm vụ)
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => setNewTaskModalOpen(true)}
                                    >
                                        Thêm nhiệm vụ tuần mới
                                    </Button>
                                </div>

                                <QueryPanel query={tasksQuery}>
                                    <div className="table-wrap">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Nhiệm vụ</th>
                                                    <th>Mô tả / Yêu cầu</th>
                                                    <th>Hạn nộp</th>
                                                    <th>Trạng thái</th>
                                                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tasks.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                                                            Chưa có nhiệm vụ nào được giao cho sinh viên này. Nhấn "+ Thêm nhiệm vụ" để giao việc.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    tasks.map((t) => {
                                                        const isDone = t.status === 'COMPLETED' || t.status === 'SUBMITTED';
                                                        return (
                                                            <tr key={t.id}>
                                                                <td><strong>{t.title}</strong></td>
                                                                <td style={{ color: 'var(--muted)', fontSize: '11.5px' }}>
                                                                    {t.description || 'Theo dõi tiến độ theo kế hoạch đồ án'}
                                                                </td>
                                                                <td className="mono" style={{ fontSize: 12 }}>
                                                                    {t.dueDate ? dayjs(t.dueDate).format('DD/MM/YYYY') : '---'}
                                                                </td>
                                                                <td>
                                                                    <span className={`tag ${isDone ? 'green' : 'yellow'}`}>
                                                                        {isDone ? 'Đã duyệt (Đạt)' : 'Đang làm'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => message.info(`Xem chi tiết bài nộp của nhiệm vụ: ${t.title}`)}
                                                                    >
                                                                        Xem xét
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </QueryPanel>
                            </div>
                        )}

                        {/* TAB 2: MEETING LOGS (BM03) */}
                        {activeTab === 'meeting-logs' && (
                            <div id="tab-meeting-logs" className="tab-pane-content">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div>
                                        <span style={{ fontSize: '13.5px', fontWeight: 700 }}>
                                            Nhật ký trao đổi hướng dẫn thực tế (BM03):
                                        </span>
                                        <span className="mono" style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: 6 }}>
                                            {meetingLogs.length} buổi
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <Button
                                            icon={<PrinterOutlined />}
                                            onClick={() => setBm03PrintOpen(true)}
                                        >
                                            In Sổ tiến độ BM03
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => setMeetingModalOpen(true)}
                                        >
                                            Ghi nhận buổi hướng dẫn mới
                                        </Button>
                                    </div>
                                </div>

                                <QueryPanel query={bm03Query}>
                                    <div className="timeline" id="meeting-timeline-container">
                                        {meetingLogs.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13 }}>
                                                Chưa có buổi gặp hướng dẫn nào được ghi nhận. Hãy nhấn "Ghi nhận buổi hướng dẫn mới" để lưu thông tin nhật ký.
                                            </div>
                                        ) : (
                                            meetingLogs.map((log, index) => {
                                                const ratingTag = log.progressRating === 'ON_TRACK'
                                                    ? <Tag color="success">Đúng tiến độ</Tag>
                                                    : log.progressRating === 'AT_RISK'
                                                    ? <Tag color="warning">Có rủi ro</Tag>
                                                    : log.progressRating === 'BEHIND'
                                                    ? <Tag color="error">Chậm tiến độ</Tag>
                                                    : log.progressRating === 'NO_PROGRESS'
                                                    ? <Tag color="default">Không có tiến độ</Tag>
                                                    : <Tag color="processing">Tiến độ đạt yêu cầu</Tag>;

                                                return (
                                                    <div key={log.id || index} className="timeline-node">
                                                        <div className="timeline-dot done" />
                                                        <div className="timeline-card">
                                                            <div className="timeline-head flex-wrap gap-2">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <strong>Buổi {log.meetingIndex || (meetingLogs.length - index)}: {log.meetingMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp tại Lab'}</strong>
                                                                    <span className="tag teal">
                                                                        {log.locationOrLink || (log.meetingMode === 'ONLINE' ? 'Online Meet' : 'Lab H2-502')}
                                                                    </span>
                                                                    {ratingTag}
                                                                    {log.isLocked ? (
                                                                        <Tag color="purple">Đã ký khóa</Tag>
                                                                    ) : (
                                                                        <Tag color="orange">Chưa khóa</Tag>
                                                                    )}
                                                                </div>
                                                                <span className="mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                                                    {dayjs(log.meetingDate).format('DD/MM/YYYY')}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '12.5px', color: 'var(--fg)', lineHeight: 1.5, marginTop: 8 }} className="space-y-1.5">
                                                                <div><strong>Nội dung trao đổi:</strong> {log.discussionContent || log.meetingNote || log.summary || 'Sinh viên báo cáo kết quả và chạy thử nghiệm.'}</div>
                                                                <div><strong>Kết quả sinh viên đã hoàn thành:</strong> {log.studentCompletedWork || 'Chưa ghi nhận'}</div>
                                                                {log.remainingIssues && (
                                                                    <div><strong>Vấn đề tồn đọng:</strong> {log.remainingIssues}</div>
                                                                )}
                                                                {(log.nextTasks || log.nextMilestone) && (
                                                                    <div><strong>Nhiệm vụ kỳ tới:</strong> {log.nextTasks || log.nextMilestone}</div>
                                                                )}
                                                                {log.expectedDeadline && (
                                                                    <div className="font-mono text-xs text-slate-500">
                                                                        Hạn hoàn thành: {dayjs(log.expectedDeadline).format('DD/MM/YYYY')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                                                                {log.isLocked ? (
                                                                    <span className="text-xs text-slate-500 font-mono">
                                                                        Đã ký bởi GVHD {log.advisorSignedAt ? dayjs(log.advisorSignedAt).format('DD/MM/YYYY HH:mm') : ''}
                                                                    </span>
                                                                ) : (
                                                                    <Button
                                                                        size="small"
                                                                        type="primary"
                                                                        icon={<SafetyCertificateOutlined />}
                                                                        loading={signingMeetingId === log.id}
                                                                        onClick={() => handleSignMeetingEntry(log.id)}
                                                                    >
                                                                        Ký khóa buổi hướng dẫn
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </QueryPanel>
                            </div>
                        )}

                        {/* TAB 3: CHECKPOINTS & BM03 STAGE EVALUATIONS */}
                        {activeTab === 'checkpoints' && (() => {
                            const stageEvals = bm03Record?.stageEvaluations || [];
                            const midtermEval = bm03Record?.midtermStageEvaluation || stageEvals.find((e) => e.stage === 'MIDTERM');
                            const finalEval = bm03Record?.finalStageEvaluation || stageEvals.find((e) => e.stage === 'FINAL');

                            return (
                                <div id="tab-checkpoints" className="tab-pane-content">
                                    <QueryPanel query={checkpointsQuery}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {/* Top Banner Toolbar */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} className="flex-wrap gap-2">
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Đánh giá các giai đoạn & Sổ theo dõi tiến độ BM03</div>
                                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                                    Theo dõi 2 mốc đánh giá (Giữa kỳ & Cuối kỳ) cùng chữ ký điện tử nội bộ chốt sổ BM03.
                                                </div>
                                            </div>
                                            <Button
                                                icon={<PrinterOutlined />}
                                                onClick={() => setBm03PrintOpen(true)}
                                            >
                                                In Sổ tiến độ BM03
                                            </Button>
                                        </div>

                                        {/* Midterm Stage Evaluation Card */}
                                        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #0F766E' }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Đánh giá giữa kỳ</div>
                                                    <div className="card-subtitle">Đánh giá tiến độ giữa giai đoạn đồ án · Kết luận Tiếp tục hoặc Đề nghị dừng</div>
                                                </div>
                                                <div>
                                                    {midtermEval ? (
                                                        <Tag color={midtermEval.decision === 'CONTINUE' ? 'success' : 'error'}>
                                                            {midtermEval.decision === 'CONTINUE' ? 'Tiếp tục thực hiện' : 'Đề nghị dừng đề tài'}
                                                        </Tag>
                                                    ) : (
                                                        <Tag color="warning">Chưa đánh giá giữa kỳ</Tag>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px', fontSize: 13 }} className="space-y-3">
                                                {midtermEval && (
                                                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                                                        <div><strong>Kết luận đã lưu:</strong> {midtermEval.decision === 'CONTINUE' ? 'Cho phép tiếp tục thực hiện' : 'Đề nghị dừng đề tài'}</div>
                                                        <div><strong>Nhận xét:</strong> {midtermEval.comments}</div>
                                                        <div className="text-slate-500 font-mono text-[11px]">Đã đánh giá lúc: {dayjs(midtermEval.evaluatedAt).format('DD/MM/YYYY HH:mm')}</div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <label className="font-semibold block text-slate-700">Kết luận đánh giá giữa kỳ:</label>
                                                    <Radio.Group value={midtermDecision} onChange={(e) => setMidtermDecision(e.target.value)}>
                                                        <Radio value="CONTINUE">Cho phép tiếp tục</Radio>
                                                        <Radio value="PROPOSE_STOP">Đề nghị dừng đề tài</Radio>
                                                    </Radio.Group>
                                                </div>

                                                {midtermDecision === 'PROPOSE_STOP' && (
                                                    <Alert
                                                        type="warning"
                                                        showIcon
                                                        message="Cảnh báo quy trình thẩm định cấp Viện"
                                                        description="Đề nghị dừng đề tài sẽ chuyển ngay sang hàng đợi thẩm định của Viện với thời hạn xử lý 168 giờ (+72h nếu yêu cầu bổ sung thông tin)."
                                                    />
                                                )}

                                                <div className="space-y-1">
                                                    <label className="font-semibold block text-slate-700">Ý kiến nhận xét của GVHD (*):</label>
                                                    <Input.TextArea
                                                        rows={2}
                                                        value={midtermComments}
                                                        onChange={(e) => setMidtermComments(e.target.value)}
                                                        placeholder="Nhận xét chi tiết khối lượng thực hiện, tiến độ và năng lực của sinh viên..."
                                                    />
                                                </div>

                                                <Button
                                                    type="primary"
                                                    icon={<SaveOutlined />}
                                                    loading={midtermSubmitting}
                                                    onClick={handleSubmitMidtermEvaluation}
                                                >
                                                    Lưu đánh giá giữa kỳ
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Final Stage Evaluation Card */}
                                        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #2563EB' }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Đánh giá cuối kỳ</div>
                                                    <div className="card-subtitle">Kết luận hoàn thành tiến độ BM03 · Điều kiện tiên quyết để mở BM04</div>
                                                </div>
                                                <div>
                                                    {finalEval ? (
                                                        <Tag color={finalEval.decision === 'CONTINUE_TO_BM04' ? 'success' : 'error'}>
                                                            {finalEval.decision === 'CONTINUE_TO_BM04' ? 'Chuyển sang BM04' : 'Đề nghị dừng đề tài'}
                                                        </Tag>
                                                    ) : (
                                                        <Tag color="warning">Chưa đánh giá cuối kỳ</Tag>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px', fontSize: 13 }} className="space-y-3">
                                                {finalEval && (
                                                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                                                        <div><strong>Kết luận đã lưu:</strong> {finalEval.decision === 'CONTINUE_TO_BM04' ? 'Đạt - Chuyển sang BM04' : 'Đề nghị dừng đề tài'}</div>
                                                        <div><strong>Nhận xét:</strong> {finalEval.comments}</div>
                                                        <div className="text-slate-500 font-mono text-[11px]">Đã đánh giá lúc: {dayjs(finalEval.evaluatedAt).format('DD/MM/YYYY HH:mm')}</div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <label className="font-semibold block text-slate-700">Kết luận đánh giá cuối kỳ:</label>
                                                    <Radio.Group value={finalDecision} onChange={(e) => setFinalDecision(e.target.value)}>
                                                        <Radio value="CONTINUE_TO_BM04">Đạt yêu cầu - Chuyển sang BM04</Radio>
                                                        <Radio value="PROPOSE_STOP">Đề nghị dừng đề tài</Radio>
                                                    </Radio.Group>
                                                </div>

                                                {finalDecision === 'PROPOSE_STOP' && (
                                                    <Alert
                                                        type="warning"
                                                        showIcon
                                                        message="Cảnh báo quy trình thẩm định cấp Viện (SLA 168h)"
                                                        description="Đề nghị dừng đề tài cuối kỳ sẽ chuyển sang hàng đợi thẩm định của Viện với thời hạn xử lý 168 giờ."
                                                    />
                                                )}

                                                <div className="space-y-1">
                                                    <label className="font-semibold block text-slate-700">Ý kiến nhận xét tổng kết (*):</label>
                                                    <Input.TextArea
                                                        rows={2}
                                                        value={finalComments}
                                                        onChange={(e) => setFinalComments(e.target.value)}
                                                        placeholder="Tổng kết toàn bộ quá trình thực hiện đồ án của sinh viên..."
                                                    />
                                                </div>

                                                <Button
                                                    type="primary"
                                                    icon={<SaveOutlined />}
                                                    loading={finalSubmitting}
                                                    onClick={handleSubmitFinalEvaluation}
                                                >
                                                    Lưu đánh giá cuối kỳ
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Whole BM03 Sign Card */}
                                        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #7C3AED' }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Ký toàn phiếu BM03 & Xác nhận sinh viên (48h)</div>
                                                    <div className="card-subtitle">Chữ ký điện tử nội bộ chốt toàn bộ quá trình theo dõi tiến độ</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <Button
                                                        icon={<PrinterOutlined />}
                                                        onClick={() => setBm03PrintOpen(true)}
                                                    >
                                                        In Sổ tiến độ BM03
                                                    </Button>
                                                    {bm03Record?.advisorSignedAt ? (
                                                        <Tag color="purple">GVHD đã ký số</Tag>
                                                    ) : (
                                                        <Tag color="default">Chưa ký toàn phiếu</Tag>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px', fontSize: 13 }} className="space-y-3">
                                                {bm03Record?.advisorSignedAt ? (
                                                    <div className="p-3 bg-purple-50/50 rounded border border-purple-200 text-xs space-y-2">
                                                        <div className="font-semibold text-purple-900">
                                                            ✓ GVHD đã ký xác nhận toàn phiếu BM03 lúc {dayjs(bm03Record.advisorSignedAt).format('DD/MM/YYYY HH:mm')}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-600">Trạng thái phản hồi của sinh viên:</span>
                                                            {bm03Record.studentAckStatus === 'ACKNOWLEDGED' ? (
                                                                <Tag color="green">Sinh viên đã xác nhận đã biết</Tag>
                                                            ) : bm03Record.studentAckStatus === 'ACKNOWLEDGED_WITH_COMMENT' ? (
                                                                <Tag color="blue">Sinh viên xác nhận kèm ý kiến</Tag>
                                                            ) : bm03Record.studentAckStatus === 'DECLINED_TO_ACKNOWLEDGE' ? (
                                                                <Tag color="red">Sinh viên từ chối ký</Tag>
                                                            ) : bm03Record.studentAckStatus === 'ACKNOWLEDGEMENT_TIMEOUT' ? (
                                                                <Tag color="purple">Quá hạn 48h (Tự động chuyển tiếp)</Tag>
                                                            ) : (
                                                                <Tag color="gold">Chờ sinh viên xác nhận (Hạn: 48h)</Tag>
                                                            )}
                                                        </div>
                                                        {bm03Record.studentComment && (
                                                            <div className="text-slate-700 bg-white p-2 rounded border border-slate-200">
                                                                <strong>Ý kiến sinh viên:</strong> {bm03Record.studentComment}
                                                            </div>
                                                        )}
                                                        {bm03Record.finalPdfFileUrl && (
                                                            <div className="pt-1">
                                                                <Button
                                                                    type="link"
                                                                    icon={<FilePdfOutlined />}
                                                                    href={bm03Record.finalPdfFileUrl}
                                                                    target="_blank"
                                                                    className="p-0 text-purple-700"
                                                                >
                                                                    Tải PDF BM03 đã ký
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <p className="text-xs text-slate-600 m-0">
                                                            Sau khi hoàn tất đánh giá cuối kỳ với kết luận chuyển sang BM04, GVHD thực hiện ký xác nhận toàn phiếu BM03. Hệ thống sẽ mở cửa sổ 48 giờ để sinh viên xem và phản hồi.
                                                        </p>
                                                        <Button
                                                            type="primary"
                                                            icon={<FileDoneOutlined />}
                                                            loading={signingWholeBm03}
                                                            onClick={handleAdvisorSignWholeBM03}
                                                        >
                                                            Ký toàn phiếu BM03
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </QueryPanel>
                            </div>
                        );
                        })()}

                        {/* TAB 4: BM04 & ARCHIVE */}
                        {activeTab === 'archive' && (
                            <div id="tab-archive" className="tab-pane-content">
                                <QueryPanel query={archiveQuery}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* BM04 Status Card */}
                                    <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid var(--success)' }}>
                                        <div className="card-head flex-wrap gap-2">
                                            <div>
                                                <div className="card-title">Phiếu Nhận Xét Của Giảng Viên Hướng Dẫn (BM04)</div>
                                                <div className="card-subtitle">
                                                    Văn bản pháp lý quyết định sinh viên có được phép ra bảo vệ trước Hội đồng
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <Button
                                                    icon={<PrinterOutlined />}
                                                    onClick={() => setBm04PrintOpen(true)}
                                                    disabled={!bm04Status && !reg?.bm04Evaluation}
                                                >
                                                    In Phiếu BM04
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    icon={<FileDoneOutlined />}
                                                    onClick={() => setBm04ModalOpen(true)}
                                                >
                                                    Xem / Sửa Phiếu nhận xét
                                                </Button>
                                            </div>
                                        </div>
                                        <div style={{ padding: '16px 20px', fontSize: 13 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 12 }}>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Tổng số buổi gặp BM03:</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>
                                                        {meetingLogs.length || reg?.totalMeetings || reg?._count?.bm03MeetingEntries || reg?._count?.meetingLogs || 0} buổi làm việc
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chuẩn đầu ra (CĐR):</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                                                        {reg?.bm04Evaluation?.programOutcome === 'MEETS_PROGRAM_OUTCOMES' || bm04Status ? 'Đạt chuẩn đầu ra' : 'Đang thẩm định'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Kết luận của GVHD:</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                                                        {bm04Status || reg?.bm04Evaluation?.conclusion === 'AGREED_FOR_DEFENSE' ? 'Đồng ý cho bảo vệ' : 'Chưa thẩm định'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                <strong>Ý kiến nhận xét của GVHD:</strong>{' '}
                                                {reg?.bm04Evaluation?.generalNotes ||
                                                 reg?.bm04Evaluation?.attitudeScore ||
                                                 'Chưa có nhận xét tổng quát. Nhấp "Xem / Sửa Phiếu nhận xét" để nhập nội dung đánh giá và xuất BM04.'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Archive Verification Card */}
                                    <div className="card" style={{ marginBottom: 0 }}>
                                        <div className="card-head flex-wrap gap-2">
                                            <div>
                                                <div className="card-title">Hàng Đợi Duyệt Hồ Sơ Lưu Chiểu 4 Tài Liệu (GVHD)</div>
                                                <div className="card-subtitle">
                                                    Thẩm định tính đầy đủ và quy chuẩn chuyên môn của 4 tệp nộp trong thời hạn 14 ngày
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                {archiveData?.mentorReviewStatus ? (
                                                    <Tag color={archiveData.mentorReviewStatus === 'APPROVED' ? 'green' : (archiveData.mentorReviewStatus === 'REVISION_REQUIRED' ? 'orange' : (archiveData.mentorReviewStatus === 'REJECTED' ? 'red' : 'blue'))}>
                                                        {archiveData.mentorReviewStatus === 'APPROVED' ? 'ĐÃ DUYỆT CHUYÊN MÔN' : (archiveData.mentorReviewStatus === 'REVISION_REQUIRED' ? 'YÊU CẦU NỘP LẠI' : (archiveData.mentorReviewStatus === 'REJECTED' ? 'TỪ CHỐI HỒ SƠ' : 'CHỜ DUYỆT'))}
                                                    </Tag>
                                                ) : (
                                                    <Tag color="default">CHƯA DUYỆT</Tag>
                                                )}
                                                <Button
                                                    icon={<SafetyCertificateOutlined />}
                                                    onClick={() => setCertModalOpen(true)}
                                                >
                                                    Xem Giấy Xác Nhận
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Thành phần hồ sơ (4 tệp)</th>
                                                        <th>Tên tệp & Mã kiểm tra SHA-256</th>
                                                        <th>Phiên bản / Ngày nộp</th>
                                                        <th style={{ textAlign: 'right' }}>Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { key: 'REPORT_WORD', label: '1. Báo cáo Word', ext: '.docx' },
                                                        { key: 'REPORT_PDF', label: '2. Báo cáo đóng cuốn PDF', ext: '.pdf' },
                                                        { key: 'DEMO_VIDEO', label: '3. Video demo sản phẩm', ext: '.mp4 / url' },
                                                        { key: 'SLIDE_PPTX', label: '4. Slide thuyết trình PPTX', ext: '.pptx' },
                                                    ].map((item) => {
                                                        const doc = archiveData?.dossierFiles?.find(f => f.docType === item.key);
                                                        return (
                                                            <tr key={item.key}>
                                                                <td>
                                                                    <strong>{item.label}</strong>
                                                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loại chuẩn: <code>{item.key}</code></div>
                                                                </td>
                                                                <td>
                                                                    {doc ? (
                                                                        <div>
                                                                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{doc.fileName || 'Tệp đính kèm'}</span>
                                                                            {doc.checksumSha256 && (
                                                                                <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--muted)' }}>
                                                                                    SHA-256: {doc.checksumSha256.substring(0, 16)}...
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa có tệp</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {doc ? (
                                                                        <div>
                                                                            <Tag color="cyan">v{doc.version || 1}</Tag>
                                                                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                                                {doc.uploadedAt ? dayjs(doc.uploadedAt).format('DD/MM/YYYY HH:mm') : '—'}
                                                                            </span>
                                                                        </div>
                                                                    ) : '—'}
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    {doc?.fileUrl ? (
                                                                        <Button
                                                                            size="small"
                                                                            icon={<FilePdfOutlined />}
                                                                            href={doc.fileUrl}
                                                                            target="_blank"
                                                                        >
                                                                            Xem tệp
                                                                        </Button>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Trống</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Auto-linked BM03 & BM04 Info */}
                                        <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FileDoneOutlined style={{ color: '#0F766E' }} />
                                                <span>BM03 Nhật ký: <strong>Tự động trích xuất liên kết</strong></span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FileDoneOutlined style={{ color: '#0F766E' }} />
                                                <span>BM04 Phiếu nhận xét: <strong>Tự động trích xuất liên kết</strong></span>
                                            </div>
                                        </div>

                                        {/* Mentor Review Action Panel */}
                                        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: '#FFFFFF' }}>
                                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                                                Nhận xét & Đánh giá chuyên môn hồ sơ lưu chiểu (GVHD):
                                            </label>
                                            <Input.TextArea
                                                rows={2}
                                                placeholder="Ghi nhận xét về báo cáo chỉnh sửa, tài liệu minh chứng, hoặc chỉ rõ các điểm sinh viên cần nộp lại..."
                                                value={mentorReviewNotes}
                                                onChange={(e) => setMentorReviewNotes(e.target.value)}
                                            />
                                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                                <Button
                                                    danger
                                                    icon={<CloseCircleOutlined />}
                                                    loading={mentorReviewing}
                                                    onClick={() => handleMentorReview('REJECTED')}
                                                >
                                                    Không duyệt hồ sơ
                                                </Button>
                                                <Button
                                                    icon={<ExclamationCircleOutlined />}
                                                    loading={mentorReviewing}
                                                    onClick={() => handleMentorReview('REVISION_REQUIRED')}
                                                >
                                                    Yêu cầu nộp lại
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    icon={<CheckCircleOutlined />}
                                                    loading={mentorReviewing}
                                                    onClick={() => handleMentorReview('APPROVED')}
                                                >
                                                    Phê duyệt chuyên môn
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    </div>
                                </QueryPanel>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL: GIAO NHIỆM VỤ MỚI */}
            {newTaskModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">Giao Nhiệm Vụ Tuần Cho Sinh Viên</div>
                            <button type="button" className="modal-close" onClick={() => setNewTaskModalOpen(false)} aria-label="Đóng"><CloseOutlined /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Tuần học vụ:</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={taskWeek}
                                        onChange={(e) => setTaskWeek(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Hạn chót nộp bài:</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={taskDueDate}
                                        onChange={(e) => setTaskDueDate(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Tiêu đề nhiệm vụ (*):</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Ví dụ: Đo lường độ trễ truy vấn vector database..."
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Yêu cầu và tài liệu tham khảo:</label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    placeholder="Mô tả chi tiết tiêu chí nghiệm thu của tuần này..."
                                    value={taskDesc}
                                    onChange={(e) => setTaskDesc(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div className="modal-foot flex justify-end gap-2">
                            <Button onClick={() => setNewTaskModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                loading={taskSubmitting}
                                onClick={handleCreateTask}
                            >
                                Giao việc
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: GHI NHẬN BUỔI GẶP LAB (BM03) */}
            {meetingModalOpen && (
                <div
                    className="modal-overlay open"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1050,
                    }}
                >
                    <div
                        className="modal-box"
                        style={{
                            maxWidth: 640,
                            width: '100%',
                            borderRadius: 16,
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid #E2E8F0',
                            padding: 0,
                        }}
                    >
                        {/* Header with Teal Gradient */}
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
                                padding: '18px 24px',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: '#FFFFFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                    }}
                                >
                                    <TeamOutlined style={{ fontSize: 20, color: '#0F766E' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3 }}>
                                        Ghi Nhận Buổi Hướng Dẫn Mới (BM03)
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                                        Nhật ký gặp mặt định kỳ & đánh giá kết quả thực hiện
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMeetingModalOpen(false)}
                                aria-label="Đóng"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: 32,
                                    height: 32,
                                    cursor: 'pointer',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <CloseOutlined style={{ fontSize: 13 }} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div
                            className="modal-body"
                            style={{
                                maxHeight: 'calc(88vh - 130px)',
                                overflowY: 'auto',
                                padding: '20px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                                background: '#F8FAFC',
                            }}
                        >
                            {/* Student Spotlight Summary Card */}
                            {reg && (
                                <div
                                    style={{
                                        background: '#FFFFFF',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: 12,
                                        padding: '12px 16px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%)',
                                                    color: '#0F766E',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {reg.student?.fullName
                                                    ? reg.student.fullName.split(' ').slice(-2).map((n) => n[0]).join('')
                                                    : <UserOutlined />}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                                                    {reg.student?.fullName}
                                                </span>
                                                <span
                                                    style={{
                                                        marginLeft: 8,
                                                        fontSize: 11,
                                                        fontFamily: 'monospace',
                                                        background: '#F1F5F9',
                                                        padding: '1px 6px',
                                                        borderRadius: 4,
                                                        color: '#475569',
                                                    }}
                                                >
                                                    {reg.student?.code}
                                                </span>
                                            </div>
                                        </div>
                                        <span
                                            className={`tag ${reg.topic?.projectCatalog?.code === 'DATN' ? 'purple' : 'teal'}`}
                                            style={{ fontSize: 10, padding: '1px 8px', fontWeight: 600 }}
                                        >
                                            {reg.topic?.projectCatalog?.code || 'ĐACN'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        <BookOutlined style={{ marginTop: 2, color: '#0D9488', flexShrink: 0 }} />
                                        <span style={{ lineHeight: 1.4 }}>
                                            {reg.topic?.title || reg.topic?.name || reg.effectiveTitle || 'Đề tài chưa cập nhật'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Timing & Modality Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                        Ngày gặp mặt:
                                    </label>
                                    <Input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        prefix={<CalendarOutlined style={{ color: '#0D9488', marginRight: 4 }} />}
                                        style={{ width: '100%', borderRadius: 8, height: 38 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                        Hình thức làm việc:
                                    </label>
                                    <Select
                                        value={meetingMode}
                                        onChange={setMeetingMode}
                                        style={{ width: '100%', height: 38 }}
                                        options={[
                                            { value: 'IN_PERSON', label: 'Trực tiếp tại Lab (Offline)' },
                                            { value: 'ONLINE', label: 'Trực tuyến (Meet / Teams / Zoom)' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Location / Link */}
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                    Địa điểm / Link họp:
                                </label>
                                <Input
                                    value={meetingLocation}
                                    onChange={(e) => setMeetingLocation(e.target.value)}
                                    placeholder="Ví dụ: Lab H2-502 hoặc https://meet.google.com/xyz"
                                    prefix={meetingMode === 'ONLINE' ? <VideoCameraOutlined style={{ color: '#0D9488', marginRight: 4 }} /> : <EnvironmentOutlined style={{ color: '#0D9488', marginRight: 4 }} />}
                                    style={{ width: '100%', borderRadius: 8, height: 38 }}
                                />
                            </div>

                            {/* Progress Rating */}
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                    Đánh giá tiến độ buổi gặp:
                                </label>
                                <Select
                                    value={progressRating}
                                    onChange={setProgressRating}
                                    style={{ width: '100%', height: 38 }}
                                    options={[
                                        {
                                            value: 'ON_TRACK',
                                            label: (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                                                    <strong style={{ color: '#047857' }}>Đúng tiến độ</strong>
                                                    <span style={{ color: '#64748B', fontSize: 11 }}>(Đạt yêu cầu kế hoạch)</span>
                                                </span>
                                            ),
                                        },
                                        {
                                            value: 'AT_RISK',
                                            label: (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                                                    <strong style={{ color: '#B45309' }}>Có rủi ro</strong>
                                                    <span style={{ color: '#64748B', fontSize: 11 }}>(Cần theo dõi sát)</span>
                                                </span>
                                            ),
                                        },
                                        {
                                            value: 'BEHIND',
                                            label: (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
                                                    <strong style={{ color: '#C2410C' }}>Chậm tiến độ</strong>
                                                    <span style={{ color: '#64748B', fontSize: 11 }}>(Cần tăng tốc thực hiện)</span>
                                                </span>
                                            ),
                                        },
                                        {
                                            value: 'NO_PROGRESS',
                                            label: (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                                                    <strong style={{ color: '#B91C1C' }}>Không có tiến độ</strong>
                                                    <span style={{ color: '#64748B', fontSize: 11 }}>(Chưa thực hiện công việc)</span>
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
                            </div>

                            {/* Meeting Content */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>
                                        Nội dung trao đổi <span style={{ color: '#EF4444' }}>*</span>:
                                    </label>
                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                        {meetingContent.length} ký tự
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {[
                                        'Báo cáo tiến độ tuần',
                                        'Thử nghiệm mô hình & thuật toán',
                                        'Review tài liệu & báo cáo kỹ thuật',
                                        'Sửa lỗi & hoàn thiện giao diện',
                                    ].map((promptText) => (
                                        <button
                                            key={promptText}
                                            type="button"
                                            onClick={() => {
                                                setMeetingContent((prev) =>
                                                    prev ? `${prev}; ${promptText}` : promptText
                                                );
                                            }}
                                            style={{
                                                fontSize: 11,
                                                padding: '2px 8px',
                                                borderRadius: 12,
                                                background: '#E0F2FE',
                                                color: '#0369A1',
                                                border: '1px solid #BAE6FD',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {promptText}
                                        </button>
                                    ))}
                                </div>
                                <Input.TextArea
                                    rows={3}
                                    value={meetingContent}
                                    onChange={(e) => setMeetingContent(e.target.value)}
                                    placeholder="Sinh viên báo cáo công việc thực hiện, kết quả đạt được, định hướng tuần tiếp theo..."
                                    style={{ borderRadius: 8 }}
                                />
                            </div>

                            {/* Student Completed Work */}
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                    Kết quả sinh viên đã hoàn thành:
                                </label>
                                <Input.TextArea
                                    rows={2}
                                    value={studentCompletedWork}
                                    onChange={(e) => setStudentCompletedWork(e.target.value)}
                                    placeholder="Mô tả cụ thể module/tính năng/kết quả đã xong..."
                                    style={{ borderRadius: 8 }}
                                />
                            </div>

                            {/* Remaining Issues */}
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, color: '#334155', display: 'block', marginBottom: 6 }}>
                                    Vấn đề còn tồn đọng:
                                </label>
                                <Input.TextArea
                                    rows={2}
                                    value={remainingIssues}
                                    onChange={(e) => setRemainingIssues(e.target.value)}
                                    placeholder="Khó khăn, lỗi kỹ thuật hoặc vướng mắc cần giải quyết..."
                                    style={{ borderRadius: 8 }}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div
                            style={{
                                padding: '14px 24px',
                                background: '#FFFFFF',
                                borderTop: '1px solid #E2E8F0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                BM03 Meeting Entry • Biên bản lưu trữ phục vụ bảo vệ đồ án
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button onClick={() => setMeetingModalOpen(false)}>Hủy</Button>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={meetingSubmitting}
                                    onClick={handleCreateMeeting}
                                    style={{ background: '#0D9488', borderColor: '#0D9488' }}
                                >
                                    Lưu nhật ký buổi gặp
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BM04 EVALUATION MODAL */}
            {bm04ModalOpen && reg && (
                <BM04EvaluationModal
                    open={bm04ModalOpen}
                    onClose={() => setBm04ModalOpen(false)}
                    registration={reg}
                    currentLecturerName={currentUser?.fullName || currentUser?.name || ''}
                    onSuccess={() => {
                        message.success('Đã cập nhật phiếu nhận xét của người hướng dẫn!');
                        setBm04ModalOpen(false);
                    }}
                />
            )}

            {/* CLEARANCE CERTIFICATE MODAL */}
            {certModalOpen && reg && (
                <ClearanceCertificateModal
                    visible={certModalOpen}
                    onClose={() => setCertModalOpen(false)}
                    registration={reg}
                    archiveData={archiveData}
                />
            )}

            {/* CHECKPOINT ISSUE MODAL */}
            {checkpointModalOpen && reg && (
                <CheckpointIssueModal
                    open={checkpointModalOpen}
                    onClose={() => setCheckpointModalOpen(false)}
                    registration={reg}
                    defaultCheckpointNo={selectedCheckpointNo}
                    currentLecturerName={currentUser?.fullName || currentUser?.name || ''}
                    onSuccess={() => {
                        setCheckpointModalOpen(false);
                        loadStudentDetails();
                    }}
                />
            )}

            {/* BM03 PRINT MODAL */}
            <AcademicFormPrintModal
                open={bm03PrintOpen}
                onClose={() => setBm03PrintOpen(false)}
                onCancel={() => setBm03PrintOpen(false)}
                title={`In Sổ Theo Dõi Tiến Độ & Hướng Dẫn BM03 - ${reg?.student?.fullName || ''}`}
                documentCode="BM03"
            >
                <BM03PrintSheet
                    meetingLogs={meetingLogs}
                    checkpoints={checkpoints}
                    registration={reg}
                    bm03Record={bm03Record}
                />
            </AcademicFormPrintModal>

            {/* BM04 PRINT MODAL */}
            <AcademicFormPrintModal
                open={bm04PrintOpen}
                onClose={() => setBm04PrintOpen(false)}
                onCancel={() => setBm04PrintOpen(false)}
                title={`In Phiếu Nhận Xét BM04 - ${reg?.student?.fullName || ''}`}
                documentCode="BM04"
            >
                <BM04PrintSheet
                    evaluation={reg?.bm04Evaluation}
                    registration={reg}
                />
            </AcademicFormPrintModal>

            <RegistrationTimelineDrawer
                open={timelineOpen}
                onClose={() => setTimelineOpen(false)}
                registrationId={reg?.id}
                topicTitle={reg?.topic?.title}
                studentName={reg?.student?.fullName}
                studentCode={reg?.student?.code || reg?.student?.studentCode}
            />
        </section>
    );
}
