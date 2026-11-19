import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Alert, Tag, Button, Tooltip, message } from 'antd';
import {
    CalendarOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CheckCircleFilled,
    ExclamationCircleOutlined,
    FileSearchOutlined,
    HistoryOutlined,
    HourglassOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    UserOutlined,
    BookOutlined,
    ApartmentOutlined,
    IdcardOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useStudentDashboard, dashboardKeys } from '../../queries/dashboardQueries';
import { useStudentRegistration } from '../../queries/registrationQueries';
import { useRegistrationTasks } from '../../queries/taskQueries';
import { useRegistrationMeetingLogs, useBM03Record } from '../../queries/meetingQueries';
import { useRegistrationCheckpoints } from '../../queries/checkpointQueries';
import { useBM04Record } from '../../queries/gradingQueries';
import { useStudentArchive, useDefenseDossier } from '../../queries/archiveQueries';
import { useMyOutline } from '../../queries/outlineQueries';
import { useQueryClient } from '@tanstack/react-query';
import StudentWorkActions from '../../components/student/work/StudentWorkActions';
import AcademicDossierDrawer from '../../components/prints/AcademicDossierDrawer';
import { getStatusTagConfig } from '../../components/common/statusMap';
import dayjs from 'dayjs';
import './student-work-hub.css';

/**
 * Định dạng thời gian hiển thị: ngày/tháng/năm
 */
const formatDate = (dateValue) => {
    if (!dateValue) return null;
    const parsed = dayjs(dateValue);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : null;
};

/**
 * Định dạng thời gian hiển thị: giờ:phút ngày/tháng/năm
 */
const formatDateTime = (dateValue) => {
    if (!dateValue) return null;
    const parsed = dayjs(dateValue);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : null;
};

/**
 * Phân loại mức độ khẩn cấp của việc Cần làm ngay (READY):
 * - Quá hạn: Đỏ (error)
 * - 48h xác nhận BM03: Tím (purple)
 * - Sắp hết hạn (<= 48h): Vàng/Hổ phách (warning)
 * - Thường: Teal (cyan)
 */
const getItemUrgencyBadge = (item) => {
    if (!item) return null;
    const now = dayjs();
    const due = item.dueAt ? dayjs(item.dueAt) : null;
    const isOverdue = Boolean(due && due.isBefore(now));
    const hoursLeft = due && !isOverdue ? due.diff(now, 'hour') : null;
    const isUnder48h = due && !isOverdue && hoursLeft !== null && hoursLeft <= 48;

    if (isOverdue) {
        return {
            type: 'overdue',
            color: 'error',
            label: 'Đã quá hạn',
            className: 'badge-overdue',
            icon: <ClockCircleOutlined />,
        };
    }
    if (item.kind === 'BM03_ACK') {
        return {
            type: 'ack_48h',
            color: 'purple',
            label: 'Xác nhận trong 48 giờ',
            className: 'badge-ack-48h',
            icon: <ExclamationCircleOutlined />,
        };
    }
    if (isUnder48h) {
        return {
            type: 'urgent',
            color: 'warning',
            label: `Sắp hết hạn (${hoursLeft} giờ còn lại)`,
            className: 'badge-urgent',
            icon: <ClockCircleOutlined />,
        };
    }
    return {
        type: 'normal',
        color: 'cyan',
        label: 'Đang mở',
        className: 'badge-normal',
        icon: <CalendarOutlined />,
    };
};

/**
 * StudentWorkHubPage (Trang "Việc của tôi")
 *
 * Tổ chức theo 3 vùng rõ ràng:
 * 1. Cần làm ngay (Ready): Hero container nổi bật, hiển thị việc ưu tiên và form thao tác.
 *    Khi không có việc: hiển thị khối trạng thái chờ trang nhã, KHÔNG có nút ảo.
 * 2. Sắp tới (Upcoming): Các mốc mở trong 7 ngày tới. Tuyệt đối KHÔNG có nút nộp/mutation.
 * 3. Đã hoàn thành (Done): Lịch sử các mốc/bản nộp hoàn thành, cho phép xem lại hoặc in PDF.
 */
export default function StudentWorkHubPage() {
    const user = useAuthStore((s) => s.user);
    const scope = queryKeys.scope(user);
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Drawer hồ sơ học thuật
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);

    // Việc READY đang được chọn để xử lý trong hero card
    const [selectedReadyItem, setSelectedReadyItem] = useState(null);

    // Thông báo trạng thái khi mở qua deep link (?work=... hoặc ?tab=archive)
    const [deeplinkNotice, setDeeplinkNotice] = useState(null);

    // Khóa của mục hoàn thành được mở rộng
    const [expandedDoneKey, setExpandedDoneKey] = useState(null);

    // Query nguồn chính: Student Dashboard (đã chuẩn hóa workItems, waitingStatus, nextAction)
    const studentDashboardQuery = useStudentDashboard(scope);
    const {
        data: dashboardData,
        isLoading,
        isError,
        error,
        refetch,
    } = studentDashboardQuery;

    const {
        registrationDetails,
        activeSemester,
        workItems: rawWorkItems = [],
        waitingStatus = null,
    } = dashboardData || {};

    const regId = registrationDetails?.registrationId || registrationDetails?.id;

    // Query đăng ký đề tài (TopicRegistration 1 SV / 1 đề tài)
    const registrationQuery = useStudentRegistration(scope, {}, Boolean(user?.id));
    const registration = registrationQuery.data?.data || null;
    const effectiveRegId = regId || registration?.id;

    // Các query phụ trợ cung cấp nguồn dữ liệu thực tế cho StudentWorkActions
    const tasksQuery = useRegistrationTasks(scope, effectiveRegId, Boolean(effectiveRegId));
    const meetingLogsQuery = useRegistrationMeetingLogs(scope, effectiveRegId, Boolean(effectiveRegId));
    const checkpointsQuery = useRegistrationCheckpoints(scope, effectiveRegId, Boolean(effectiveRegId));
    const outlineQuery = useMyOutline(scope, Boolean(effectiveRegId));
    const bm03Query = useBM03Record(scope, effectiveRegId, Boolean(effectiveRegId));
    const bm04Query = useBM04Record(scope, effectiveRegId, Boolean(effectiveRegId));
    const archiveQuery = useStudentArchive(scope, effectiveRegId);
    const dossierQuery = useDefenseDossier(scope, effectiveRegId);

    // Đăng ký đề tài hoàn chỉnh (gộp registrationDetails và registration query)
    const effectiveRegistration = useMemo(() => {
        const reg = registration || registrationDetails;
        if (!reg) return null;
        return {
            ...reg,
            id: reg.id || reg.registrationId || effectiveRegId,
            topic: reg.topic || (registrationDetails?.topic ? {
                title: registrationDetails.topic.title,
                mentor: { fullName: registrationDetails.mentorFullName },
            } : null),
        };
    }, [registration, registrationDetails, effectiveRegId]);

    // Gom dữ liệu phụ trợ cho `sources`
    const sources = useMemo(() => ({
        tasks: tasksQuery.data || registrationDetails?.tasks || [],
        meetingLogs: meetingLogsQuery.data || [],
        checkpoints: checkpointsQuery.data || [],
        outlineData: outlineQuery.data || null,
        bm03Record: bm03Query.data || null,
        bm04Record: bm04Query.data || null,
        archive: archiveQuery.data?.data?.archive || archiveQuery.data || null,
        dossier: dossierQuery.data?.data || dossierQuery.data || null,
    }), [
        tasksQuery.data,
        registrationDetails,
        meetingLogsQuery.data,
        checkpointsQuery.data,
        outlineQuery.data,
        bm03Query.data,
        bm04Query.data,
        archiveQuery.data,
        dossierQuery.data,
    ]);

    // 1. Vùng Cần làm ngay: việc có bucket READY
    const readyItems = useMemo(() => {
        return (rawWorkItems || []).filter((item) => item.bucket === 'READY');
    }, [rawWorkItems]);

    // 2. Vùng Sắp tới (trong 7 ngày): việc có bucket UPCOMING
    const upcomingItems = useMemo(() => {
        return (rawWorkItems || []).filter((item) => item.bucket === 'UPCOMING');
    }, [rawWorkItems]);

    // 3. Vùng Đã hoàn thành: việc có bucket DONE
    const doneItems = useMemo(() => {
        return (rawWorkItems || []).filter((item) => item.bucket === 'DONE');
    }, [rawWorkItems]);

    // Xử lý deep link `?work=<KIND>` và route cũ `?tab=archive`
    useEffect(() => {
        const workParam = searchParams.get('work');
        const tabParam = searchParams.get('tab');
        const targetKind = tabParam === 'archive' ? 'SUBMIT_ARCHIVE' : workParam;

        if (!targetKind) {
            if (readyItems.length > 0 && !selectedReadyItem) {
                setSelectedReadyItem(readyItems[0]);
            }
            return;
        }

        // 1. Tìm trong readyItems
        const matchReady = readyItems.find(
            (i) => i.kind === targetKind || i.id === targetKind || i.kind?.includes(targetKind)
        );
        if (matchReady) {
            setSelectedReadyItem(matchReady);
            setDeeplinkNotice(null);
            return;
        }

        // 2. Tìm trong doneItems
        const matchDone = doneItems.find(
            (i) => i.kind === targetKind || i.id === targetKind || i.kind?.includes(targetKind)
        );
        if (matchDone) {
            setExpandedDoneKey(matchDone.id);
            setDeeplinkNotice({
                type: 'info',
                message: `Nhiệm vụ "${matchDone.title}" đã hoàn tất và đang được hiển thị trong mục Đã hoàn thành.`,
            });
            if (readyItems.length > 0 && !selectedReadyItem) {
                setSelectedReadyItem(readyItems[0]);
            }
            return;
        }

        // 3. Tìm trong upcomingItems
        const matchUpcoming = upcomingItems.find(
            (i) => i.kind === targetKind || i.id === targetKind || i.kind?.includes(targetKind)
        );
        if (matchUpcoming) {
            setDeeplinkNotice({
                type: 'warning',
                message: `Nhiệm vụ "${matchUpcoming.title}" chưa mở cổng thực hiện (dự kiến mở: ${matchUpcoming.openAt ? formatDate(matchUpcoming.openAt) : 'trong 7 ngày tới'}).`,
            });
            if (readyItems.length > 0 && !selectedReadyItem) {
                setSelectedReadyItem(readyItems[0]);
            }
            return;
        }

        // 4. Không tìm thấy mục hợp lệ
        setDeeplinkNotice({
            type: 'warning',
            message: 'Yêu cầu công việc trong liên kết không còn hiệu lực hoặc đã thay đổi theo tiến độ hiện tại.',
        });
        if (readyItems.length > 0 && !selectedReadyItem) {
            setSelectedReadyItem(readyItems[0]);
        }
    }, [searchParams, readyItems, doneItems, upcomingItems, selectedReadyItem]);

    // Khi danh sách readyItems thay đổi hoặc item đang chọn bị xóa sau hoàn thành
    useEffect(() => {
        if (readyItems.length > 0) {
            const exists = readyItems.some((i) => i.id === selectedReadyItem?.id);
            if (!exists) {
                setSelectedReadyItem(readyItems[0]);
            }
        } else {
            setSelectedReadyItem(null);
        }
    }, [readyItems, selectedReadyItem]);

    // Xử lý chuyển đổi giữa các việc READY (khi có nhiều hơn 1 việc cần làm)
    const handleSelectReadyItem = (item) => {
        setSelectedReadyItem(item);
        setDeeplinkNotice(null);
        setSearchParams({ work: item.kind });
    };

    // Callback sau khi hoàn thành một tác vụ (nộp đề cương, xác nhận BM03, nộp hồ sơ...)
    const handleActionCompleted = async () => {
        message.success('Thao tác đã được ghi nhận thành công.');
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: dashboardKeys.studentDashboard(scope) }),
            queryClient.invalidateQueries({ queryKey: ['registration'] }),
        ]);
        await studentDashboardQuery.refetch();
        if (registrationQuery.refetch) {
            await registrationQuery.refetch();
        }
    };

    // Nút làm mới dữ liệu
    const handleRefetch = async () => {
        await Promise.all([
            studentDashboardQuery.refetch(),
            registrationQuery.refetch(),
        ]);
        message.success('Đã cập nhật dữ liệu việc mới nhất.');
    };

    // Trạng thái tải dữ liệu
    if (isLoading && !dashboardData) {
        return (
            <div className="student-work-hub-container">
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <Spin size="large" tip="Đang tải danh sách việc cần làm..." />
                </div>
            </div>
        );
    }

    // Trạng thái lỗi tải dữ liệu
    if (isError && !dashboardData) {
        return (
            <div className="student-work-hub-container">
                <Alert
                    type="error"
                    showIcon
                    message="Lỗi tải dữ liệu công việc"
                    description={error?.message || 'Không thể tải danh sách việc cần làm của sinh viên. Vui lòng thử lại.'}
                    action={
                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>
                            Thử lại
                        </Button>
                    }
                />
            </div>
        );
    }

    // Dữ liệu hiển thị Header
    const topicTitle =
        registrationDetails?.topic?.title ||
        registration?.topic?.title ||
        'Chưa đăng ký đề tài';
    const topicCode =
        registrationDetails?.topic?.topicCode ||
        (registration?.topic?.id ? `DT-${String(registration.topic.id).padStart(3, '0')}` : null);
    const mentorName =
        registrationDetails?.mentorFullName ||
        registration?.topic?.mentor?.fullName ||
        'Chưa phân công';
    const semesterName = activeSemester?.name || 'Học kỳ hiện tại';
    const studentCode =
        user?.code ||
        registrationDetails?.members?.[0]?.code ||
        registration?.student?.code ||
        '';
    const statusConfig = getStatusTagConfig(registration?.status || registrationDetails?.status);

    const activeUrgency = getItemUrgencyBadge(selectedReadyItem);

    return (
        <div className="student-work-hub-container hub-animate-in">
            {/* Header Bento Card */}
            <header className="work-hub-header">
                <div className="work-hub-header-main">
                    <div className="work-hub-eyebrow">
                        <span className="work-hub-page-tag">
                            <ThunderboltOutlined /> Việc của tôi
                        </span>
                        {topicCode && (
                            <Tag color="cyan">
                                <BookOutlined /> {topicCode}
                            </Tag>
                        )}
                        <Tag color={statusConfig.color || 'default'}>
                            {statusConfig.label}
                        </Tag>
                    </div>

                    <h1 className="work-hub-topic-title">{topicTitle}</h1>

                    <div className="work-hub-meta-grid">
                        <div className="work-hub-meta-item">
                            <UserOutlined />
                            <span>GVHD: <strong>{mentorName}</strong></span>
                        </div>
                        <div className="work-hub-meta-item">
                            <ApartmentOutlined />
                            <span>Đợt: <strong>{semesterName}</strong></span>
                        </div>
                        {studentCode && (
                            <div className="work-hub-meta-item">
                                <IdcardOutlined />
                                <span>Mã sinh viên: <strong>{studentCode}</strong></span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="work-hub-header-actions">
                    <Button
                        icon={<FileSearchOutlined />}
                        onClick={() => setDossierDrawerOpen(true)}
                    >
                        Hồ sơ học thuật
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefetch}
                        loading={isLoading}
                    >
                        Làm mới
                    </Button>
                </div>
            </header>

            {/* Thông báo điều hướng deep link (nếu có) */}
            {deeplinkNotice && (
                <Alert
                    className="work-hub-notice"
                    type={deeplinkNotice.type}
                    showIcon
                    closable
                    onClose={() => setDeeplinkNotice(null)}
                    message={deeplinkNotice.message}
                />
            )}

            {/* VÙNG 1: CẦN LÀM NGAY (READY) */}
            <section className="region-ready" id="region-ready">
                {readyItems.length > 0 && selectedReadyItem ? (
                    <div className="work-hero-card">
                        <div className="work-hero-header">
                            <div>
                                <div className="work-hero-badge-group">
                                    <Tag color={activeUrgency?.color} icon={activeUrgency?.icon}>
                                        {activeUrgency?.label}
                                    </Tag>
                                    <Tag color="default">
                                        Nhiệm vụ {readyItems.indexOf(selectedReadyItem) + 1} / {readyItems.length}
                                    </Tag>
                                </div>
                                <h2 className="work-hero-title">{selectedReadyItem.title}</h2>
                            </div>

                            {selectedReadyItem.dueAt && (
                                <div className={`work-hero-due ${activeUrgency?.type === 'overdue' ? 'overdue' : activeUrgency?.type === 'urgent' ? 'urgent' : ''}`}>
                                    <ClockCircleOutlined />
                                    <span>Hạn chót: {formatDateTime(selectedReadyItem.dueAt)}</span>
                                </div>
                            )}
                        </div>

                        {/* Danh sách chọn nếu có nhiều việc READY đồng thời */}
                        {readyItems.length > 1 && (
                            <div className="work-ready-pills">
                                {readyItems.map((item) => {
                                    const isSelected = selectedReadyItem?.id === item.id;
                                    const badge = getItemUrgencyBadge(item);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`work-item-pill ${isSelected ? 'active' : ''}`}
                                            onClick={() => handleSelectReadyItem(item)}
                                        >
                                            <span>{item.title}</span>
                                            {badge?.type === 'overdue' && (
                                                <Tag color="error" style={{ margin: 0, padding: '0 4px', fontSize: 10 }}>
                                                    Quá hạn
                                                </Tag>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <p className="work-hero-desc">{selectedReadyItem.description}</p>

                        {/* Nhúng component xử lý nghiệp vụ cho việc đang chọn */}
                        <div className="work-hero-action-box">
                            <StudentWorkActions
                                item={selectedReadyItem}
                                registration={effectiveRegistration}
                                sources={sources}
                                onCompleted={handleActionCompleted}
                            />
                        </div>
                    </div>
                ) : waitingStatus ? (
                    /* Trạng thái chờ trang nhã khi không có việc READY và có waitingStatus */
                    <div className="work-waiting-card">
                        <div className="work-waiting-icon-box">
                            <HourglassOutlined />
                        </div>
                        <div className="work-waiting-content">
                            <h3 className="work-waiting-title">{waitingStatus.title}</h3>
                            <p className="work-waiting-desc">{waitingStatus.description}</p>
                        </div>
                    </div>
                ) : (
                    /* Trạng thái hoàn thành / chưa có việc khi không có việc READY lẫn waitingStatus */
                    <div className="work-empty-card">
                        <CheckCircleOutlined className="work-empty-icon" />
                        <h3 className="work-empty-title">Hiện chưa có việc cần làm</h3>
                        <p className="work-empty-desc">
                            Bạn đã hoàn thành các nhiệm vụ trong giai đoạn này hoặc hệ thống chưa mở đợt tiếp theo.
                        </p>
                    </div>
                )}
            </section>

            {/* BỐ CỤC PHỤ: VÙNG 2 (SẮP TỚI) & VÙNG 3 (ĐÃ HOÀN THÀNH) */}
            <div className="work-hub-secondary-grid">
                {/* VÙNG 2: SẮP TỚI (UPCOMING - TRONG 7 NGÀY) */}
                <section className="region-upcoming" id="region-upcoming">
                    <div className="region-header">
                        <h3 className="region-title upcoming">
                            <CalendarOutlined /> Sắp tới (trong 7 ngày)
                        </h3>
                        {upcomingItems.length > 0 && (
                            <Tag color="blue">{upcomingItems.length} mốc</Tag>
                        )}
                    </div>

                    {upcomingItems.length > 0 ? (
                        upcomingItems.map((item) => (
                            <div key={item.id} className="upcoming-item-card">
                                <div className="upcoming-item-header">
                                    <h4 className="upcoming-item-title">{item.title}</h4>
                                    <Tag color="blue" icon={<InfoCircleOutlined />}>
                                        Chưa mở cổng
                                    </Tag>
                                </div>

                                <p className="upcoming-item-desc">{item.description}</p>

                                <div className="upcoming-item-meta">
                                    {item.openAt && (
                                        <span>
                                            Dự kiến mở: <strong>{formatDateTime(item.openAt)}</strong>
                                        </span>
                                    )}
                                    {item.dueAt && (
                                        <span>
                                            Hạn nộp: <strong>{formatDateTime(item.dueAt)}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="upcoming-empty-note">
                            Không có mốc nào sắp mở trong 7 ngày tới.
                        </div>
                    )}
                </section>

                {/* VÙNG 3: ĐÃ HOÀN THÀNH (DONE / HISTORY) */}
                <section className="region-done" id="region-done">
                    <div className="region-header">
                        <h3 className="region-title done">
                            <HistoryOutlined /> Đã hoàn thành
                        </h3>
                        {doneItems.length > 0 && (
                            <Tag color="success">{doneItems.length} mục</Tag>
                        )}
                    </div>

                    {doneItems.length > 0 ? (
                        <div className="done-items-list">
                            {doneItems.map((item) => {
                                const isHighlighted = expandedDoneKey === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className={`done-item-card ${isHighlighted ? 'highlighted' : ''}`}
                                    >
                                        <div className="done-item-header">
                                            <h4 className="done-item-title">
                                                <CheckCircleFilled style={{ color: '#16a34a' }} />
                                                <span>{item.title}</span>
                                            </h4>
                                            <Tag color="success">Đã hoàn thành</Tag>
                                        </div>

                                        <p className="done-item-desc">{item.description}</p>

                                        <div className="done-item-footer">
                                            <span>
                                                {item.completedAt
                                                    ? `Thời điểm: ${formatDateTime(item.completedAt)}`
                                                    : 'Đã hoàn tất'}
                                            </span>
                                            <Button
                                                size="small"
                                                icon={<FileSearchOutlined />}
                                                onClick={() => setDossierDrawerOpen(true)}
                                            >
                                                Xem hồ sơ học thuật
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="done-empty-note">
                            Chưa có mốc nào được ghi nhận hoàn thành.
                        </div>
                    )}
                </section>
            </div>

            {/* Academic Dossier Drawer để xem lại toàn bộ hồ sơ BM01-BM05 & bản in PDF */}
            <AcademicDossierDrawer
                open={dossierDrawerOpen}
                onClose={() => setDossierDrawerOpen(false)}
                registration={effectiveRegistration}
            />
        </div>
    );
}
