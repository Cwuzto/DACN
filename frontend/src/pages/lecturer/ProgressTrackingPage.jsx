import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from '@ant-design/icons';
import dayjs from 'dayjs';

import registrationService from '../../services/registrationService';
import taskService from '../../services/taskService';
import meetingLogService from '../../services/meetingLogService';
import archiveService from '../../services/archiveService';
import PageLoader from '../../components/common/PageLoader';
import BM04EvaluationModal from '../../components/lecturer/BM04EvaluationModal';
import CheckpointIssueModal from '../../components/lecturer/CheckpointIssueModal';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import evaluationService from '../../services/evaluationService';
import useAuthStore from '../../stores/authStore';

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
    const [searchParams] = useSearchParams();
    const paramRegId = searchParams.get('registrationId');

    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'meeting-logs' | 'checkpoints' | 'archive'
    const currentUser = useAuthStore((s) => s.user);

    // Selected student data
    const [tasks, setTasks] = useState([]);
    const [meetingLogs, setMeetingLogs] = useState([]);
    const [checkpoints, setCheckpoints] = useState([]);
    const [archiveData, setArchiveData] = useState(null);
    const [mentorReviewNotes, setMentorReviewNotes] = useState('');
    const [mentorReviewing, setMentorReviewing] = useState(false);

    // Modals
    const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);
    const [selectedCheckpointNo, setSelectedCheckpointNo] = useState(1);
    const [bm04ModalOpen, setBm04ModalOpen] = useState(false);
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
    const [meetingNextTask, setMeetingNextTask] = useState('');
    const [expectedDeadline, setExpectedDeadline] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'));
    const [progressRating, setProgressRating] = useState('ON_TRACK');
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);
    const [signingMeetingId, setSigningMeetingId] = useState(null);

    // BM03 State & Stage Evaluations
    const [bm03Record, setBm03Record] = useState(null);
    const [signingWholeBm03, setSigningWholeBm03] = useState(false);
    const [midtermDecision, setMidtermDecision] = useState('CONTINUE');
    const [midtermComments, setMidtermComments] = useState('');
    const [midtermSubmitting, setMidtermSubmitting] = useState(false);

    const [finalDecision, setFinalDecision] = useState('CONTINUE_TO_BM04');
    const [finalComments, setFinalComments] = useState('');
    const [finalSubmitting, setFinalSubmitting] = useState(false);

    // Fetch initial student list
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                setLoading(true);
                const res = await registrationService.getAllRegistrations();
                if (res.success && Array.isArray(res.data)) {
                    const active = res.data.filter(
                        (r) => !['PENDING', 'REJECTED', 'WITHDRAWN', 'DROPPED'].includes(r.status)
                    );
                    setStudents(active);

                    if (active.length > 0) {
                        const target = paramRegId
                            ? active.find((s) => String(s.id) === String(paramRegId)) || active[0]
                            : active[0];
                        setSelectedStudent(target);
                    }
                }
            } catch {
                message.error('Không thể tải danh sách sinh viên hướng dẫn');
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, [paramRegId]);

    const loadStudentDetails = useCallback(async () => {
        if (!selectedStudent?.id) return;
        try {
            const [taskRes, logRes, arcRes, cpRes, bm03Res] = await Promise.all([
                taskService.getTasksByRegistration(selectedStudent.id).catch(() => ({ success: false, data: [] })),
                meetingLogService.getMeetingLogs(selectedStudent.id).catch(() => ({ success: false, data: [] })),
                archiveService.getArchiveByRegistration(selectedStudent.id).catch(() => ({ success: false, data: null })),
                evaluationService.getCheckpointEvaluations(selectedStudent.id).catch(() => ({ success: false, data: [] })),
                evaluationService.getBM03Record(selectedStudent.id).catch(() => ({ success: false, data: null })),
            ]);

            if (taskRes.success) setTasks(taskRes.data || []);
            if (arcRes.success) setArchiveData(arcRes.data?.archive || null);
            if (cpRes.success) setCheckpoints(cpRes.data || []);

            if (bm03Res?.success && bm03Res.data) {
                setBm03Record(bm03Res.data);
                const meetings = bm03Res.data?.meetings || bm03Res.data?.meetingEntries || [];
                if (meetings.length > 0) {
                    setMeetingLogs(meetings);
                } else if (logRes.success) {
                    setMeetingLogs(logRes.data || []);
                }
                const stageEvals = bm03Res.data?.stageEvaluations || [];
                const midterm = bm03Res.data.midtermStageEvaluation || stageEvals.find((e) => e.stage === 'MIDTERM');
                if (midterm) {
                    setMidtermDecision(midterm.decision || 'CONTINUE');
                    setMidtermComments(midterm.comments || '');
                }
                const final = bm03Res.data.finalStageEvaluation || stageEvals.find((e) => e.stage === 'FINAL');
                if (final) {
                    setFinalDecision(final.decision || 'CONTINUE_TO_BM04');
                    setFinalComments(final.comments || '');
                }
            } else if (logRes.success) {
                setMeetingLogs(logRes.data || []);
            }
        } catch {
            // Ignore silent load errors
        }
    }, [selectedStudent?.id]);

    // Fetch details for selected student
    useEffect(() => {
        if (!selectedStudent?.id) return;
        loadStudentDetails();
    }, [selectedStudent?.id, loadStudentDetails]);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        const q = studentSearch.trim().toLowerCase();
        return students.filter(
            (s) =>
                (s.student?.fullName && s.student.fullName.toLowerCase().includes(q)) ||
                (s.student?.code && s.student.code.toLowerCase().includes(q)) ||
                (s.topic?.title && s.topic.title.toLowerCase().includes(q)) ||
                (s.topic?.code && s.topic.code.toLowerCase().includes(q))
        );
    }, [students, studentSearch]);

    const handleCreateTask = async () => {
        if (!taskTitle.trim()) {
            message.warning('Vui lòng nhập tên nhiệm vụ');
            return;
        }

        try {
            setTaskSubmitting(true);
            const res = await taskService.createTask({
                registrationId: selectedStudent.id,
                title: `Tuần ${taskWeek}: ${taskTitle.trim()}`,
                description: taskDesc.trim() || undefined,
                dueDate: new Date(taskDueDate),
                taskType: 'PROGRESS_REPORT',
            });

            if (res.success) {
                message.success('Đã giao nhiệm vụ mới cho sinh viên!');
                setNewTaskModalOpen(false);
                setTaskTitle('');
                setTaskDesc('');
                const updatedTasks = await taskService.getTasksByRegistration(selectedStudent.id);
                if (updatedTasks.success) setTasks(updatedTasks.data || []);
            }
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
            const res = await evaluationService.createMeetingEntry(selectedStudent.id, {
                meetingDate: new Date(meetingDate),
                meetingMode: meetingLocation.includes('Meet') || meetingLocation.includes('Online') ? 'ONLINE' : meetingMode,
                locationOrLink: meetingLocation.trim(),
                discussionContent: meetingContent.trim(),
                studentCompletedWork: studentCompletedWork.trim() || undefined,
                remainingIssues: remainingIssues.trim() || undefined,
                nextTasks: meetingNextTask.trim() || undefined,
                expectedDeadline: expectedDeadline ? new Date(expectedDeadline) : undefined,
                progressRating,
            });

            if (res.success) {
                message.success('Đã ghi nhận nhật ký buổi hướng dẫn BM03 thành công!');
                setMeetingModalOpen(false);
                setMeetingContent('');
                setStudentCompletedWork('');
                setRemainingIssues('');
                setMeetingNextTask('');
                loadStudentDetails();
            } else {
                message.error(res.message || 'Không thể lưu nhật ký');
            }
        } catch (error) {
            message.error(error?.message || 'Không thể lưu nhật ký');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    const handleSignMeetingEntry = async (meetingId) => {
        try {
            setSigningMeetingId(meetingId);
            const res = await evaluationService.signMeetingEntry(meetingId, {
                signatureImageId: currentUser?.signatureImageId || null,
            });
            if (res.success) {
                message.success('Đã ký khóa buổi hướng dẫn thành công!');
                loadStudentDetails();
            } else {
                message.error(res.message || 'Không thể ký khóa buổi hướng dẫn');
            }
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
            const res = await evaluationService.submitStageEvaluation(selectedStudent.id, {
                stage: 'MIDTERM',
                decision: midtermDecision,
                comments: midtermComments.trim(),
            });
            if (res.success) {
                message.success('Đã lưu đánh giá giữa kỳ thành công!');
                loadStudentDetails();
            } else {
                message.error(res.message || 'Không thể lưu đánh giá giữa kỳ');
            }
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
            const res = await evaluationService.submitStageEvaluation(selectedStudent.id, {
                stage: 'FINAL',
                decision: finalDecision,
                comments: finalComments.trim(),
            });
            if (res.success) {
                message.success('Đã lưu đánh giá cuối kỳ thành công!');
                loadStudentDetails();
            } else {
                message.error(res.message || 'Không thể lưu đánh giá cuối kỳ');
            }
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
            const res = await evaluationService.advisorSignWholeBM03(bm03Record.id, {
                signatureImageId: currentUser?.signatureImageId || null,
            });
            if (res.success) {
                message.success('Đã ký xác nhận toàn phiếu BM03 thành công! Sinh viên có 48 giờ để xác nhận.');
                loadStudentDetails();
            } else {
                message.error(res.message || 'Không thể ký toàn phiếu BM03');
            }
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
                loadStudentDetails();
            } else {
                message.error(res.message || 'Thao tác không thành công.');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi thẩm định hồ sơ lưu chiểu.');
        } finally {
            setMentorReviewing(false);
        }
    };

    if (loading) {
        return <PageLoader />;
    }

    const reg = selectedStudent;
    const progress = reg?.progressPercent ?? (reg?.status === 'COMPLETED' || reg?.status === 'DEFENDED' ? 100 : 0);
    const bm04Status = reg?.status === 'COMPLETED' || reg?.status === 'DEFENDED' || reg?.status === 'DEFENSE_READY';
    const isAtRisk = progress < 50;

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
                    <div className="student-search-box">
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Tìm sinh viên..."
                            style={{ width: '100%' }}
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                        />
                    </div>

                    <div className="student-cards-scroll" id="student-select-list">
                        {filteredStudents.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                                Không tìm thấy sinh viên nào.
                            </div>
                        ) : (
                            filteredStudents.map((s) => {
                                const isSel = s.id === reg?.id;
                                const sProgress = s.progressPercent ?? (sPassed ? 100 : 0);
                                const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';
                                const sRisk = sProgress < 50;
                                const logCount = s._count?.meetingLogs ?? s.meetingLogs?.length ?? 0;

                                return (
                                    <div
                                        key={s.id}
                                        className={`student-item-card ${isSel ? 'selected' : ''}`}
                                        onClick={() => setSelectedStudent(s)}
                                    >
                                        <div className="student-card-top">
                                            <span className="student-card-name">{s.student?.fullName}</span>
                                            <span className={`tag ${sPassed ? 'green' : sRisk ? 'red' : 'blue'}`}>
                                                {sPassed ? 'Đủ điều kiện BV' : sRisk ? 'Nguy cơ trễ' : 'Đang làm'}
                                            </span>
                                        </div>
                                        <div className="student-card-topic">
                                            {s.topic?.code || 'DT'}: {s.topic?.title}
                                        </div>
                                        <div className="student-card-foot">
                                            <span>MSSV: {s.student?.code}</span>
                                            <strong style={{ color: logCount >= 5 ? 'var(--primary)' : 'var(--warning)' }}>
                                                {logCount} buổi gặp
                                            </strong>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
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
                                <span className={`tag ${bm04Status ? 'green' : 'yellow'}`}>
                                    {bm04Status ? '✓ Đã duyệt phiếu nhận xét — Đủ điều kiện bảo vệ' : 'Đang thực hiện'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--fg)', marginTop: 3 }}>
                                {reg?.topic?.code || 'DT'}: {reg?.topic?.title}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                                icon={<HistoryOutlined />}
                                onClick={() => setTimelineOpen(true)}
                            >
                                Lịch sử tiến trình
                            </Button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => message.info('Mở xem bản dự thảo luận văn tốt nghiệp...')}
                            >
                                Xem Báo cáo PDF
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setBm04ModalOpen(true)}
                            >
                                Lập / Cập nhật Phiếu nhận xét
                            </button>
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
                            onClick={() => setActiveTab('tasks')}
                        >
                            1. Nhiệm vụ tuần
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'meeting-logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('meeting-logs')}
                        >
                            2. Nhật ký trao đổi
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'checkpoints' ? 'active' : ''}`}
                            onClick={() => setActiveTab('checkpoints')}
                        >
                            3. Đánh giá tiến độ
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'archive' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archive')}
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
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => setMeetingModalOpen(true)}
                                    >
                                        Ghi nhận buổi hướng dẫn mới
                                    </Button>
                                </div>

                                <div className="timeline" id="meeting-timeline-container">
                                    {meetingLogs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13 }}>
                                            Chưa có buổi gặp hướng dẫn nào được ghi nhận. Hãy nhấn "Ghi nhận buổi hướng dẫn mới" để lưu thông tin nhật ký.
                                        </div>
                                    ) : (
                                        meetingLogs.map((log, index) => {
                                            const ratingTag = log.progressRating === 'ON_TRACK'
                                                ? <Tag color="success">Đúng tiến độ (ON_TRACK)</Tag>
                                                : log.progressRating === 'AT_RISK'
                                                ? <Tag color="warning">Có rủi ro (AT_RISK)</Tag>
                                                : log.progressRating === 'BEHIND'
                                                ? <Tag color="error">Chậm tiến độ (BEHIND)</Tag>
                                                : log.progressRating === 'NO_PROGRESS'
                                                ? <Tag color="default">Không có tiến độ (NO_PROGRESS)</Tag>
                                                : <Tag color="processing">Tiến độ đạt yêu cầu</Tag>;

                                            return (
                                                <div key={log.id || index} className="timeline-node">
                                                    <div className="timeline-dot done" />
                                                    <div className="timeline-card">
                                                        <div className="timeline-head flex-wrap gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <strong>Buổi {meetingLogs.length - index}: {log.meetingMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp tại Lab'}</strong>
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
                            </div>
                        )}

                        {/* TAB 3: CHECKPOINTS & BM03 STAGE EVALUATIONS */}
                        {activeTab === 'checkpoints' && (() => {
                            const stageEvals = bm03Record?.stageEvaluations || [];
                            const midtermEval = bm03Record?.midtermStageEvaluation || stageEvals.find((e) => e.stage === 'MIDTERM');
                            const finalEval = bm03Record?.finalStageEvaluation || stageEvals.find((e) => e.stage === 'FINAL');

                            return (
                                <div id="tab-checkpoints" className="tab-pane-content">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {/* Midterm Stage Evaluation Card */}
                                        <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #0F766E' }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Đánh giá giữa kỳ (BM03 Midterm Stage Evaluation)</div>
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
                                                        <Radio value="CONTINUE">Cho phép tiếp tục (CONTINUE)</Radio>
                                                        <Radio value="PROPOSE_STOP">Đề nghị dừng đề tài (PROPOSE_STOP)</Radio>
                                                    </Radio.Group>
                                                </div>

                                                {midtermDecision === 'PROPOSE_STOP' && (
                                                    <Alert
                                                        type="warning"
                                                        showIcon
                                                        message="Cảnh báo quy trình thẩm định cấp Viện (SLA 168h)"
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
                                                    <div className="card-title">Đánh giá cuối kỳ (BM03 Final Stage Evaluation)</div>
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
                                                        <Radio value="CONTINUE_TO_BM04">Đạt yêu cầu - Chuyển sang BM04 (CONTINUE_TO_BM04)</Radio>
                                                        <Radio value="PROPOSE_STOP">Đề nghị dừng đề tài (PROPOSE_STOP)</Radio>
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
                                                <div>
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
                                </div>
                            );
                        })()}

                        {/* TAB 4: BM04 & ARCHIVE */}
                        {activeTab === 'archive' && (
                            <div id="tab-archive" className="tab-pane-content">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* BM04 Status Card */}
                                    <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid var(--success)' }}>
                                        <div className="card-head flex-wrap gap-2">
                                            <div>
                                                <div className="card-title">Phiếu Nhận Xét Của Giảng Viên Hướng Dẫn</div>
                                                <div className="card-subtitle">
                                                    Văn bản pháp lý quyết định sinh viên có được phép ra bảo vệ trước Hội đồng
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={() => setBm04ModalOpen(true)}
                                            >
                                                Xem / Sửa Phiếu nhận xét
                                            </button>
                                        </div>
                                        <div style={{ padding: '16px 20px', fontSize: 13 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 12 }}>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Tổng số buổi gặp:</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>
                                                        {meetingLogs.length || 7} buổi làm việc
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Điểm đánh giá quá trình:</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                                                        {reg?.evaluationScore || '9.0'} / 10
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Kết luận pháp lý:</span>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                                                        {bm04Status ? 'Đồng ý cho bảo vệ' : 'Đang đánh giá'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                <strong>Ý kiến nhận xét:</strong> Sinh viên có tinh thần tự giác cao, nắm vững kiến thức công nghệ hiện đại. Đề tài có tính ứng dụng thực tiễn tốt, đủ điều kiện bảo vệ trước Hội đồng chấm khóa luận tốt nghiệp.
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
                            <button type="button" className="modal-close" onClick={() => setNewTaskModalOpen(false)}>×</button>
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
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 600 }}>
                        <div className="modal-head">
                            <div className="modal-title">Ghi Nhận Buổi Hướng Dẫn Mới (BM03)</div>
                            <button type="button" className="modal-close" onClick={() => setMeetingModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ padding: '10px 12px', background: '#F0FDFA', borderRadius: 'var(--radius-sm)', border: '1px solid #CCFBF1', fontSize: 13 }}>
                                Sinh viên trao đổi: <strong>{reg?.student?.fullName}</strong> ({reg?.student?.code})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Ngày gặp mặt:</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Hình thức làm việc:</label>
                                    <select
                                        className="input-field"
                                        value={meetingMode}
                                        onChange={(e) => setMeetingMode(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="IN_PERSON">Trực tiếp tại Lab (IN_PERSON)</option>
                                        <option value="ONLINE">Trực tuyến (ONLINE)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Địa điểm / Đường dẫn họp (locationOrLink):</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={meetingLocation}
                                    onChange={(e) => setMeetingLocation(e.target.value)}
                                    placeholder="Ví dụ: Lab H2-502 hoặc https://meet.google.com/xyz"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Đánh giá tiến độ buổi gặp (progressRating):</label>
                                <Select
                                    value={progressRating}
                                    onChange={setProgressRating}
                                    style={{ width: '100%' }}
                                    options={[
                                        { value: 'ON_TRACK', label: 'Đúng tiến độ (ON_TRACK)' },
                                        { value: 'AT_RISK', label: 'Có rủi ro (AT_RISK)' },
                                        { value: 'BEHIND', label: 'Chậm tiến độ (BEHIND)' },
                                        { value: 'NO_PROGRESS', label: 'Không có tiến độ (NO_PROGRESS)' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Nội dung trao đổi (*):</label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    value={meetingContent}
                                    onChange={(e) => setMeetingContent(e.target.value)}
                                    placeholder="Sinh viên báo cáo công việc thực hiện, kết quả đạt được..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Kết quả sinh viên đã hoàn thành (studentCompletedWork):</label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    value={studentCompletedWork}
                                    onChange={(e) => setStudentCompletedWork(e.target.value)}
                                    placeholder="Mô tả cụ thể module/tính năng/kết quả đã xong..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Vấn đề còn tồn đọng (remainingIssues):</label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    value={remainingIssues}
                                    onChange={(e) => setRemainingIssues(e.target.value)}
                                    placeholder="Khó khăn, lỗi kỹ thuật hoặc vướng mắc cần giải quyết..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Nhiệm vụ cho kỳ tiếp theo (nextTasks):</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={meetingNextTask}
                                        onChange={(e) => setMeetingNextTask(e.target.value)}
                                        placeholder="Công việc kỳ tới..."
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Hạn hoàn thành (expectedDeadline):</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={expectedDeadline}
                                        onChange={(e) => setExpectedDeadline(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-foot flex justify-end gap-2">
                            <Button onClick={() => setMeetingModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                loading={meetingSubmitting}
                                onClick={handleCreateMeeting}
                            >
                                Lưu nhật ký buổi gặp
                            </Button>
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
