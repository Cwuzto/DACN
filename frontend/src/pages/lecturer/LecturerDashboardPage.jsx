import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Select, Tag, message } from 'antd';
import {
    BellOutlined,
    BookOutlined,
    CalendarOutlined,
    CheckOutlined,
    CloseOutlined,
    PlusOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';

import notificationService from '../../services/notificationService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useSemesters } from '../../queries/semesterQueries';
import { usePendingTitleAdjustments } from '../../queries/registrationQueries';
import { useMeetingMutation } from '../../queries/meetingQueries';
import { dashboardKeys, useLecturerOverview } from '../../queries/dashboardQueries';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';
import OverviewKpis from '../../components/lecturer/OverviewKpis';
import AttentionQueue from '../../components/lecturer/AttentionQueue';
import SupervisedStudentList from '../../components/lecturer/SupervisedStudentList';
import './lecturer-opendesign.css';

export default function LecturerDashboardPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const queryClient = useQueryClient();

    const [selectedSemesterId, setSelectedSemesterId] = useState(null);

    const semestersQuery = useSemesters(scope);
    const overviewQuery = useLecturerOverview(scope, selectedSemesterId);
    const titleAdjustmentsQuery = usePendingTitleAdjustments(scope);

    // Modals & Drawer
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
    const [selectedRegForDossier, setSelectedRegForDossier] = useState(null);

    // Meeting Log Form State
    const [meetingStudentId, setMeetingStudentId] = useState('');
    const [meetingDate, setMeetingDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [meetingLocation, setMeetingLocation] = useState('Tại Lab H2-502');
    const [meetingContent, setMeetingContent] = useState('');
    const [meetingNextTask, setMeetingNextTask] = useState('');
    const [meetingSubmitting, setMeetingSubmitting] = useState(false);

    const meetingMutation = useMeetingMutation(scope, meetingStudentId);

    // Broadcast Form State
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastContent, setBroadcastContent] = useState('');
    const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);

    const semesters = useMemo(() => semestersQuery.data || [], [semestersQuery.data]);
    const overview = overviewQuery.data;
    const activeSemester = overview?.activeSemester || null;
    const students = useMemo(() => overview?.students || [], [overview?.students]);
    const attentionItems = useMemo(() => overview?.attentionItems || [], [overview?.attentionItems]);
    const mentorSummary = overview?.mentorSummary || null;

    useEffect(() => {
        if (students.length > 0) {
            setMeetingStudentId((current) => {
                const exists = students.some((s) => String(s.registrationId) === String(current));
                return exists ? current : String(students[0].registrationId);
            });
        } else {
            setMeetingStudentId('');
        }
    }, [students]);

    const selectedStudent = useMemo(
        () => students.find((s) => String(s.registrationId) === String(meetingStudentId)) || students[0] || null,
        [students, meetingStudentId],
    );

    const semesterOptions = useMemo(
        () => semesters.map((s) => ({ value: s.id, label: s.name || s.code || `Đợt #${s.id}` })),
        [semesters],
    );

    const handleOpenMeetingForStudent = (student) => {
        if (student?.registrationId) {
            setMeetingStudentId(String(student.registrationId));
        }
        setMeetingModalOpen(true);
    };

    const handleOpenDossier = (student) => {
        if (!student) return;
        setSelectedRegForDossier({
            id: student.registrationId,
            status: student.status,
            student: {
                id: student.studentId,
                fullName: student.studentName,
                code: student.studentCode,
            },
            topic: {
                title: student.topicTitle,
            },
        });
        setDossierDrawerOpen(true);
    };

    const handleCreateMeetingLog = async () => {
        if (!meetingStudentId) {
            message.warning('Vui lòng chọn sinh viên');
            return;
        }
        if (!meetingContent.trim()) {
            message.warning('Vui lòng nhập tóm tắt nội dung buổi gặp');
            return;
        }

        try {
            setMeetingSubmitting(true);
            await meetingMutation.mutateAsync({
                action: 'createMeetingLog',
                args: [
                    Number(meetingStudentId),
                    {
                        meetingDate: new Date(meetingDate),
                        meetingMode: meetingLocation.includes('Meet') ? 'ONLINE' : 'IN_PERSON',
                        meetingNote: meetingContent.trim(),
                        nextMilestone: meetingNextTask.trim() || undefined,
                    },
                ],
            });

            await queryClient.invalidateQueries({ queryKey: dashboardKeys.lecturerOverviewRoot(scope) });
            message.success('Đã lưu nhật ký buổi gặp hướng dẫn thành công!');
            setMeetingModalOpen(false);
            setMeetingContent('');
            setMeetingNextTask('');
        } catch (error) {
            message.error(error?.message || 'Không thể lưu nhật ký buổi gặp lúc này.');
        } finally {
            setMeetingSubmitting(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastContent.trim()) {
            message.warning('Vui lòng nhập nội dung thông báo');
            return;
        }
        try {
            setBroadcastSubmitting(true);
            const res = await notificationService.sendLecturerBroadcast({
                subject: broadcastSubject.trim() || undefined,
                content: broadcastContent.trim(),
            });
            if (res.success) {
                message.success(res.message || `Đã gửi thông báo đến ${students.length} sinh viên đang hướng dẫn!`);
                setBroadcastModalOpen(false);
                setBroadcastSubject('');
                setBroadcastContent('');
            } else {
                message.error(res.message || 'Không thể gửi thông báo');
            }
        } catch (err) {
            message.error(err?.message || 'Đã xảy ra lỗi khi gửi thông báo');
        } finally {
            setBroadcastSubmitting(false);
        }
    };

    if (overviewQuery.isPending && !overview) {
        return <ContentSkeleton variant="dashboard" />;
    }

    const effectiveSemesterId = selectedSemesterId ?? activeSemester?.id ?? undefined;

    return (
        <section id="view-dashboard" className="lecturer-dashboard-scope space-y-5">
            {/* 1. Tiêu đề và ngữ cảnh đợt */}
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 m-0">
                        Tổng quan giảng viên
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                        {activeSemester?.name && (
                            <Tag color="teal" className="m-0 font-semibold">
                                Đợt: {activeSemester.name}
                            </Tag>
                        )}
                        {overview?.generatedAt && (
                            <span>
                                Cập nhật lúc {dayjs(overview.generatedAt).format('HH:mm DD/MM/YYYY')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {semesterOptions.length > 0 && (
                        <Select
                            aria-label="Chọn đợt đồ án"
                            value={effectiveSemesterId}
                            onChange={(val) => setSelectedSemesterId(val)}
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
                </div>
            </header>

            {titleAdjustmentsQuery.isError && (
                <Alert
                    type="warning"
                    showIcon
                    message={titleAdjustmentsQuery.error?.message || 'Không thể đồng bộ một số dữ liệu phụ.'}
                />
            )}

            {overviewQuery.isError ? (
                <Alert
                    type="error"
                    showIcon
                    message="Không thể tải dữ liệu tổng quan giảng viên"
                    description={overviewQuery.error?.message || 'Vui lòng thử lại sau.'}
                    action={
                        <Button
                            size="small"
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={() => overviewQuery.refetch()}
                        >
                            Thử lại
                        </Button>
                    }
                />
            ) : (
                <>
                    {/* 2. KPI ngắn */}
                    <OverviewKpis summary={mentorSummary} />

                    {/* 3. Lưới hai vùng cân bằng: Hàng đợi trái, Sinh viên phải (Mobile: hàng đợi trước) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                        <div className="min-w-0">
                            <AttentionQueue
                                items={attentionItems}
                                onNavigate={(target) => navigate(target)}
                            />
                        </div>
                        <div className="min-w-0">
                            <SupervisedStudentList
                                students={students}
                                onOpenDossier={handleOpenDossier}
                                onOpenMeetingModal={handleOpenMeetingForStudent}
                            />
                        </div>
                    </div>

                    {/* 4. Tác vụ phụ sau nội dung chính */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500">
                            Thao tác nhanh cho nhóm sinh viên đang hướng dẫn
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                icon={<BellOutlined />}
                                onClick={() => setBroadcastModalOpen(true)}
                                disabled={students.length === 0}
                            >
                                Gửi thông báo nhóm
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setMeetingModalOpen(true)}
                                disabled={students.length === 0}
                                className="bg-teal-600 hover:bg-teal-700"
                            >
                                Ghi nhật ký buổi gặp
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL 1: GHI NHẬT KÝ BUỔI GẶP HƯỚNG DẪN */}
            {meetingModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 620, width: '92%', borderRadius: 14, overflow: 'hidden' }}>
                        <div
                            className="modal-head"
                            style={{
                                background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
                                padding: '16px 22px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 16 }}>
                                Ghi nhận buổi gặp hướng dẫn (BM03)
                            </div>
                            <Button
                                type="text"
                                icon={<CloseOutlined style={{ color: '#FFFFFF' }} />}
                                onClick={() => setMeetingModalOpen(false)}
                                aria-label="Đóng"
                            />
                        </div>

                        <div className="modal-body" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                    Sinh viên hướng dẫn:
                                </label>
                                <Select
                                    value={meetingStudentId || undefined}
                                    onChange={(val) => setMeetingStudentId(val)}
                                    style={{ width: '100%' }}
                                    placeholder="Chọn sinh viên"
                                    options={students.map((s) => ({
                                        value: String(s.registrationId),
                                        label: `${s.studentName} (${s.studentCode})`,
                                    }))}
                                />
                                {selectedStudent && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
                                        <span className="inline-flex items-center gap-1.5 truncate">
                                            <BookOutlined className="text-teal-600" />
                                            {selectedStudent.topicTitle || 'Chưa cập nhật đề tài'}
                                        </span>
                                        <Tag color="purple" className="m-0">BM03</Tag>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                        Ngày gặp mặt:
                                    </label>
                                    <Input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        prefix={<CalendarOutlined className="text-teal-600" />}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                        Hình thức làm việc:
                                    </label>
                                    <Select
                                        value={meetingLocation}
                                        onChange={setMeetingLocation}
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'Tại Lab H2-502', label: 'Tại Lab H2-502 (Trực tiếp)' },
                                            { value: 'Online Google Meet', label: 'Online Google Meet (Trực tuyến)' },
                                            { value: 'Văn phòng Bộ môn', label: 'Văn phòng Bộ môn' },
                                            { value: 'Phòng chuyên đề', label: 'Phòng chuyên đề khoa' },
                                        ]}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                    Tóm tắt nội dung sinh viên đã báo cáo:
                                </label>
                                <Input.TextArea
                                    rows={3}
                                    value={meetingContent}
                                    onChange={(e) => setMeetingContent(e.target.value)}
                                    placeholder="Nhập nội dung trao đổi trong buổi hướng dẫn..."
                                    maxLength={500}
                                />
                            </div>

                            <div>
                                <label style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                                    Nhiệm vụ giao cho tuần tiếp theo:
                                </label>
                                <Input
                                    value={meetingNextTask}
                                    onChange={(e) => setMeetingNextTask(e.target.value)}
                                    placeholder="Ví dụ: Hoàn thiện phần kiểm thử..."
                                    prefix={<CheckOutlined className="text-teal-600" />}
                                />
                            </div>
                        </div>

                        <div className="modal-foot" style={{ padding: '14px 22px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <Button onClick={() => setMeetingModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                loading={meetingSubmitting}
                                onClick={handleCreateMeetingLog}
                                className="bg-teal-600 hover:bg-teal-700"
                            >
                                Lưu nhật ký buổi gặp
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: GỬI THÔNG BÁO NHÓM */}
            {broadcastModalOpen && (
                <div className="modal-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-box" style={{ maxWidth: 540, width: '92%' }}>
                        <div className="modal-head">
                            <div className="modal-title">Gửi thông báo cho nhóm sinh viên hướng dẫn</div>
                            <Button
                                type="text"
                                icon={<CloseOutlined />}
                                onClick={() => setBroadcastModalOpen(false)}
                                aria-label="Đóng"
                            />
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Tiêu đề thông báo:</label>
                                <Input
                                    value={broadcastSubject}
                                    onChange={(e) => setBroadcastSubject(e.target.value)}
                                    placeholder="Ví dụ: Nhắc lịch đánh giá tiến độ..."
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Nội dung chi tiết:</label>
                                <Input.TextArea
                                    rows={4}
                                    value={broadcastContent}
                                    onChange={(e) => setBroadcastContent(e.target.value)}
                                    placeholder="Nhập nội dung nhắc nhở học vụ..."
                                />
                            </div>
                            <div className="text-xs text-slate-500">
                                Thông báo sẽ được chuyển đến {students.length} sinh viên trong danh sách hướng dẫn.
                            </div>
                        </div>
                        <div className="modal-foot">
                            <Button onClick={() => setBroadcastModalOpen(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                icon={<BellOutlined />}
                                loading={broadcastSubmitting}
                                onClick={handleSendBroadcast}
                            >
                                Gửi thông báo
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <AcademicDossierDrawer
                open={dossierDrawerOpen}
                onClose={() => {
                    setDossierDrawerOpen(false);
                    setSelectedRegForDossier(null);
                }}
                registration={selectedRegForDossier}
            />
        </section>
    );
}
