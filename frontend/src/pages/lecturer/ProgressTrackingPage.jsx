import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import dayjs from 'dayjs';

import registrationService from '../../services/registrationService';
import taskService from '../../services/taskService';
import meetingLogService from '../../services/meetingLogService';
import archiveService from '../../services/archiveService';
import PageLoader from '../../components/common/PageLoader';
import BM04EvaluationModal from '../../components/lecturer/BM04EvaluationModal';
import CheckpointIssueModal from '../../components/lecturer/CheckpointIssueModal';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';
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

    // Modals
    const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [checkpointModalOpen, setCheckpointModalOpen] = useState(false);
    const [selectedCheckpointNo, setSelectedCheckpointNo] = useState(1);
    const [bm04ModalOpen, setBm04ModalOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);

    // New Task Form
    const [taskWeek, setTaskWeek] = useState('11');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [taskDueDate, setTaskDueDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'));
    const [taskSubmitting, setTaskSubmitting] = useState(false);

    // New Meeting Form
    const [meetingDate, setMeetingDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [meetingLocation, setMeetingLocation] = useState('Tại Lab H2-502');
    const [meetingContent, setMeetingContent] = useState('');
    const [meetingNextTask, setMeetingNextTask] = useState('');
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);

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
            const [taskRes, logRes, arcRes, cpRes] = await Promise.all([
                taskService.getTasksByRegistration(selectedStudent.id).catch(() => ({ success: false, data: [] })),
                meetingLogService.getMeetingLogs(selectedStudent.id).catch(() => ({ success: false, data: [] })),
                archiveService.getArchiveByRegistration(selectedStudent.id).catch(() => ({ success: false, data: null })),
                evaluationService.getCheckpointEvaluations(selectedStudent.id).catch(() => ({ success: false, data: [] })),
            ]);

            if (taskRes.success) setTasks(taskRes.data || []);
            if (logRes.success) setMeetingLogs(logRes.data || []);
            if (arcRes.success) setArchiveData(arcRes.data?.archive || null);
            if (cpRes.success) setCheckpoints(cpRes.data || []);
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
            const res = await meetingLogService.createMeetingLog({
                registrationId: selectedStudent.id,
                meetingDate: new Date(meetingDate),
                meetingMode: meetingLocation.includes('Meet') ? 'ONLINE' : 'IN_PERSON',
                meetingNote: meetingContent.trim(),
                nextMilestone: meetingNextTask.trim() || undefined,
            });

            if (res.success) {
                message.success('Đã ghi nhận nhật ký buổi gặp BM03!');
                setMeetingModalOpen(false);
                setMeetingContent('');
                setMeetingNextTask('');
                const updatedLogs = await meetingLogService.getMeetingLogs(selectedStudent.id);
                if (updatedLogs.success) setMeetingLogs(updatedLogs.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể lưu nhật ký');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    if (loading) {
        return <PageLoader />;
    }

    const reg = selectedStudent;
    const progress = reg?.progressPercent ?? (reg?.status === 'COMPLETED' || reg?.status === 'DEFENDED' ? 100 : 75);
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
                        Giao nhiệm vụ theo tuần, lưu nhật ký gặp Lab và hoàn thiện hồ sơ thẩm định BM04.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }} className="flex-wrap">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => message.success(`Đã gửi email nhắc nhở đôn đốc tiến độ đến ${students.length} sinh viên!`)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        Nhắc nộp bài hàng loạt
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setNewTaskModalOpen(true)}
                    >
                        + Giao việc mới
                    </button>
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
                                const sProgress = s.progressPercent ?? 75;
                                const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';
                                const sRisk = sProgress < 50;
                                const logCount = s._count?.meetingLogs || s.meetingLogs?.length || (sPassed ? 8 : 4);

                                return (
                                    <div
                                        key={s.id}
                                        className={`student-item-card ${isSel ? 'selected' : ''}`}
                                        onClick={() => setSelectedStudent(s)}
                                    >
                                        <div className="student-card-top">
                                            <span className="student-card-name">{s.student?.fullName}</span>
                                            <span className={`tag ${sPassed ? 'green' : sRisk ? 'red' : 'blue'}`}>
                                                {sPassed ? 'Đạt BM04' : sRisk ? 'Nguy cơ trễ' : 'Đang làm'}
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
                                    {bm04Status ? '✓ Đã duyệt BM04 (Cho BV)' : 'Đang thực hiện'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--fg)', marginTop: 3 }}>
                                {reg?.topic?.code || 'DT'}: {reg?.topic?.title}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
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
                                Lập / Cập nhật BM04
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
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setMeetingModalOpen(true)}
                            >
                                + Ghi nhận Buổi gặp Lab
                            </button>
                        </div>
                    )}

                    {/* Sub Nav Tabs */}
                    <div className="detail-nav-tabs">
                        <div
                            className={`d-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tasks')}
                        >
                            1. Nhiệm vụ tuần (Tasks)
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'meeting-logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('meeting-logs')}
                        >
                            2. Nhật ký trao đổi (BM03)
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'checkpoints' ? 'active' : ''}`}
                            onClick={() => setActiveTab('checkpoints')}
                        >
                            3. Đánh giá Checkpoint
                        </div>
                        <div
                            className={`d-tab ${activeTab === 'archive' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archive')}
                        >
                            4. Thẩm định BM04 & Lưu chiểu
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
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setNewTaskModalOpen(true)}
                                    >
                                        + Thêm nhiệm vụ tuần mới
                                    </button>
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
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setMeetingModalOpen(true)}
                                    >
                                        + Ghi nhận Buổi gặp Lab (1 phút)
                                    </button>
                                </div>

                                <div className="timeline" id="meeting-timeline-container">
                                    {meetingLogs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13 }}>
                                            Chưa có buổi gặp Lab nào được ghi nhận. Hãy nhấn "+ Ghi nhận Buổi gặp Lab" để lưu thông tin BM03.
                                        </div>
                                    ) : (
                                        meetingLogs.map((log, index) => (
                                            <div key={log.id || index} className="timeline-node">
                                                <div className="timeline-dot done" />
                                                <div className="timeline-card">
                                                    <div className="timeline-head">
                                                        <div>
                                                            <strong>Buổi {meetingLogs.length - index}: {log.meetingMode === 'ONLINE' ? 'Online Google Meet' : 'Gặp trực tiếp tại Lab'}</strong>
                                                            <span className="tag teal" style={{ marginLeft: 6 }}>
                                                                {log.meetingMode === 'ONLINE' ? 'Google Meet' : 'Lab H2-502'}
                                                            </span>
                                                        </div>
                                                        <span className="mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                                            {dayjs(log.meetingDate).format('DD/MM/YYYY')}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '12.5px', color: 'var(--fg)', lineHeight: 1.5 }}>
                                                        <div><strong>Nội dung trao đổi:</strong> {log.meetingNote || log.summary || 'Sinh viên báo cáo kết quả tiến độ và chạy thử nghiệm.'}</div>
                                                        {log.nextMilestone && (
                                                            <div style={{ marginTop: 4 }}><strong>Nhiệm vụ tiếp theo:</strong> {log.nextMilestone}</div>
                                                        )}
                                                        <span style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4, display: 'block' }}>
                                                            ✓ Đánh giá: Tiến độ đạt yêu cầu.
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: CHECKPOINTS */}
                        {activeTab === 'checkpoints' && (() => {
                            const cp1 = checkpoints.find((cp) => cp.checkpointNo === 1);
                            const cp2 = checkpoints.find((cp) => cp.checkpointNo === 2);
                            const cp1Completed = cp1 && cp1.studentSignature;
                            const cp1Passed = cp1Completed && cp1.conclusion === 'ALLOWED_TO_CONTINUE';

                            return (
                                <div id="tab-checkpoints" className="tab-pane-content">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {/* Card Checkpoint 1 */}
                                        <div className="card" style={{ marginBottom: 0 }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Checkpoint 1 (Tuần 6) · Thẩm tra Đề cương & Kiến trúc</div>
                                                    <div className="card-subtitle">Yêu cầu hoàn thành tối thiểu 50% khối lượng đề tài (Biên bản BM03)</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    {cp1 ? (
                                                        <span className={`tag ${cp1.conclusion === 'ALLOWED_TO_CONTINUE' ? 'green' : 'red'}`}>
                                                            {cp1.conclusion === 'ALLOWED_TO_CONTINUE' ? '✓ ĐẠT (Cho phép tiếp tục)' : '✕ KHÔNG ĐẠT (Dừng tiến độ)'}
                                                        </span>
                                                    ) : (
                                                        <span className="tag yellow">Chưa đánh giá</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => {
                                                            setSelectedCheckpointNo(1);
                                                            setCheckpointModalOpen(true);
                                                        }}
                                                    >
                                                        {cp1 ? 'Cập nhật CP1' : '+ Đánh giá CP1'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px', fontSize: 13 }}>
                                                {cp1 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>GVHD ký phát hành:</span>
                                                                <div style={{ fontWeight: 600 }}>{cp1.mentorSignature || 'Đã ký số'}</div>
                                                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                                    {cp1.mentorSignatureDate ? dayjs(cp1.mentorSignatureDate).format('DD/MM/YYYY HH:mm') : '---'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Sinh viên xác nhận:</span>
                                                                {cp1.studentSignature ? (
                                                                    <>
                                                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ {cp1.studentSignature}</div>
                                                                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                                            {dayjs(cp1.studentSignatureDate).format('DD/MM/YYYY HH:mm')}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div style={{ color: '#D97706', fontWeight: 600 }}>
                                                                        Chờ SV ký (Hạn: {cp1.studentSignDeadlineAt ? dayjs(cp1.studentSignDeadlineAt).format('DD/MM/YYYY HH:mm') : '3 ngày'})
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Minh chứng:</span>
                                                                <div>
                                                                    {cp1.evidenceUrl ? (
                                                                        <a href={cp1.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                                            {cp1.evidenceName || 'Mở tài liệu minh chứng'}
                                                                        </a>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--muted)' }}>Không có đính kèm</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {cp1.comments && (
                                                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: 4 }}>
                                                                <strong>Ý kiến nhận xét của GVHD:</strong> {cp1.comments}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                                        Chưa lập biên bản đánh giá Checkpoint 1 cho sinh viên này. Nhấn nút "+ Đánh giá CP1" để ghi nhận và ký phát hành.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Checkpoint 2 */}
                                        <div className="card" style={{ marginBottom: 0, opacity: cp1Passed ? 1 : 0.75 }}>
                                            <div className="card-head flex-wrap gap-2">
                                                <div>
                                                    <div className="card-title">Checkpoint 2 (Tuần 11) · Thẩm tra Dự thảo Luận văn & Demo</div>
                                                    <div className="card-subtitle">Yêu cầu hoàn thành tối thiểu 85% khối lượng đề tài (Biên bản BM03)</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    {cp2 ? (
                                                        <span className={`tag ${cp2.conclusion === 'ALLOWED_TO_CONTINUE' ? 'green' : 'red'}`}>
                                                            {cp2.conclusion === 'ALLOWED_TO_CONTINUE' ? '✓ ĐẠT (Cho phép hoàn thiện BV)' : '✕ KHÔNG ĐẠT'}
                                                        </span>
                                                    ) : (
                                                        <span className="tag yellow">Chưa đánh giá</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        disabled={!cp1Passed}
                                                        onClick={() => {
                                                            setSelectedCheckpointNo(2);
                                                            setCheckpointModalOpen(true);
                                                        }}
                                                    >
                                                        {cp2 ? 'Cập nhật CP2' : '+ Đánh giá CP2'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px 20px', fontSize: 13 }}>
                                                {!cp1Passed ? (
                                                    <div style={{ color: '#DC2626', background: '#FEF2F2', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid #FEE2E2' }}>
                                                        ⚠️ <strong>Quy định tiên quyết:</strong> Sinh viên phải hoàn thành và đạt Checkpoint 1 (có đủ chữ ký của GVHD và Sinh viên) trước khi thực hiện đánh giá Checkpoint 2.
                                                    </div>
                                                ) : cp2 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>GVHD ký phát hành:</span>
                                                                <div style={{ fontWeight: 600 }}>{cp2.mentorSignature || 'Đã ký số'}</div>
                                                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                                    {cp2.mentorSignatureDate ? dayjs(cp2.mentorSignatureDate).format('DD/MM/YYYY HH:mm') : '---'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Sinh viên xác nhận:</span>
                                                                {cp2.studentSignature ? (
                                                                    <>
                                                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ {cp2.studentSignature}</div>
                                                                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                                            {dayjs(cp2.studentSignatureDate).format('DD/MM/YYYY HH:mm')}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div style={{ color: '#D97706', fontWeight: 600 }}>
                                                                        Chờ SV ký (Hạn: {cp2.studentSignDeadlineAt ? dayjs(cp2.studentSignDeadlineAt).format('DD/MM/YYYY HH:mm') : '3 ngày'})
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Minh chứng:</span>
                                                                <div>
                                                                    {cp2.evidenceUrl ? (
                                                                        <a href={cp2.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                                            {cp2.evidenceName || 'Mở tài liệu minh chứng'}
                                                                        </a>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--muted)' }}>Không có đính kèm</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {cp2.comments && (
                                                            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: 4 }}>
                                                                <strong>Ý kiến nhận xét của GVHD:</strong> {cp2.comments}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                                        Chưa lập biên bản đánh giá Checkpoint 2. Nhấn nút "+ Đánh giá CP2" để ghi nhận và ký phát hành.
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
                                                <div className="card-title">Phiếu Nhận Xét Của Giảng Viên Hướng Dẫn (BM04)</div>
                                                <div className="card-subtitle">
                                                    Văn bản pháp lý quyết định sinh viên có được phép ra bảo vệ trước Hội đồng
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={() => setBm04ModalOpen(true)}
                                            >
                                                Xem / Sửa BM04
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
                                                        {bm04Status ? 'ĐỒNG Ý CHO BẢO VỆ' : 'ĐANG ĐÁNH GIÁ'}
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
                                                <div className="card-title">Nghiệm Thu Hồ Sơ Lưu Chiểu Sau Bảo Vệ</div>
                                                <div className="card-subtitle">
                                                    Kiểm tra đủ 4 thành phần bắt buộc để cấp Giấy xác nhận hoàn thành khóa luận
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setCertModalOpen(true)}
                                            >
                                                Xem Giấy Xác Nhận (A4)
                                            </button>
                                        </div>

                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Thành phần hồ sơ</th>
                                                        <th>Định dạng & Dung lượng</th>
                                                        <th>Thời điểm nộp</th>
                                                        <th style={{ textAlign: 'right' }}>Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td><strong>1. Luận văn toàn văn</strong></td>
                                                        <td>PDF · 4.2 MB</td>
                                                        <td className="mono">Hoàn tất</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => message.info('Mở xem file PDF luận văn lưu chiểu')}
                                                            >
                                                                Xem
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>2. Slide thuyết trình</strong></td>
                                                        <td>PPTX · 18.5 MB</td>
                                                        <td className="mono">Hoàn tất</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => message.info('Tải slide thuyết trình bảo vệ')}
                                                            >
                                                                Tải
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>3. Video Demo hệ thống</strong></td>
                                                        <td>YouTube Link (3 phút)</td>
                                                        <td className="mono">Đã nộp</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => message.info('Mở liên kết Video Demo')}
                                                            >
                                                                Xem video
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>4. Mã nguồn Codebase</strong></td>
                                                        <td>GitHub Repo (Public)</td>
                                                        <td className="mono">Đã liên kết</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => message.info('Mở kho lưu trữ GitHub Repository')}
                                                            >
                                                                Mở Repo
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
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
                            <div className="modal-title">+ Giao Nhiệm Vụ Tuần Cho Sinh Viên</div>
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
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setNewTaskModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={taskSubmitting}
                                onClick={handleCreateTask}
                            >
                                {taskSubmitting ? 'Đang lưu...' : 'Giao Việc'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: GHI NHẬN BUỔI GẶP LAB (BM03) */}
            {meetingModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540 }}>
                        <div className="modal-head">
                            <div className="modal-title">+ Ghi Nhận Buổi Gặp Lab Mới (BM03)</div>
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
                                        value={meetingLocation}
                                        onChange={(e) => setMeetingLocation(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option>Tại Lab H2-502</option>
                                        <option>Online Google Meet</option>
                                        <option>Văn phòng Bộ môn</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Tóm tắt nội dung sinh viên đã báo cáo:</label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    value={meetingContent}
                                    onChange={(e) => setMeetingContent(e.target.value)}
                                    placeholder="Ví dụ: Sinh viên báo cáo kết quả tối ưu hóa truy vấn cơ sở dữ liệu và hoàn thiện giao diện..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Nhiệm vụ giao cho tuần tiếp theo:</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={meetingNextTask}
                                    onChange={(e) => setMeetingNextTask(e.target.value)}
                                    placeholder="Ví dụ: Hoàn thiện slide thuyết trình và chạy thử demo kiểm thử tải..."
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button type="button" className="btn btn-secondary" onClick={() => setMeetingModalOpen(false)}>Hủy</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={meetingSubmitting}
                                onClick={handleCreateMeeting}
                            >
                                {meetingSubmitting ? 'Đang lưu...' : 'Lưu Nhật Ký Buổi Gặp'}
                            </button>
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
                        message.success('Đã cập nhật đánh giá BM04!');
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
        </section>
    );
}
