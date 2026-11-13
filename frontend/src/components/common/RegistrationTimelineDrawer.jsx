import React from 'react';
import { Drawer, Timeline, Tag, Spin, Skeleton, Alert, Empty, Button } from 'antd';
import {
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    ExclamationCircleOutlined,
    CloseOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrationHistory } from '../../queries/registrationQueries';
import QueryPanel from './QueryPanel';

const STATUS_LABELS = {
    PROPOSED: 'Đã đề xuất',
    APPROVED: 'Đã duyệt đề tài',
    REJECTED: 'Bị từ chối',
    IN_PROGRESS_BM01: 'Nộp đề cương chi tiết (BM01)',
    BM01_PASSED: 'Đề cương đạt yêu cầu',
    IN_PROGRESS_BM02: 'Nộp đăng ký chính thức (BM02)',
    BM02_SUBMITTED: 'Đã nộp BM02',
    OFFICIALLY_REGISTERED: 'Đã có QĐ giao đề tài',
    IN_PROGRESS_BM03: 'Thực hiện & Đánh giá tiến độ',
    BM03_PASSED: 'Tiến độ đạt yêu cầu',
    IN_PROGRESS_BM04: 'Đánh giá điều kiện bảo vệ (BM04)',
    BM04_PASSED: 'Đủ điều kiện ra bảo vệ',
    COUNCIL_ASSIGNED: 'Đã phân công hội đồng',
    DEFENSE_READY: 'Sẵn sàng bảo vệ',
    DEFENSE_IN_PROGRESS: 'Đang bảo vệ',
    DEFENDED: 'Đã bảo vệ',
    DEFENSE_PASSED: 'Bảo vệ đạt yêu cầu',
    DEFENSE_FAILED: 'Bảo vệ không đạt',
    POST_DEFENSE_REVISION: 'Chỉnh sửa sau bảo vệ',
    COMPLETED: 'Đã hoàn thành khóa luận',
    ARCHIVED: 'Đã lưu chiểu thư viện',
    CANCELLED: 'Đề tài đã bị hủy',
    TERMINATED: 'Dừng thực hiện đề tài',
};

const ROLE_LABEL_MAP = {
    STUDENT: 'Sinh viên',
    LECTURER: 'Giảng viên',
    ADMIN: 'Giáo vụ',
    DEPARTMENT_HEAD: 'Trưởng bộ môn',
};

const getStatusLabel = (status) => STATUS_LABELS[status] || status || 'Chưa xác định';

const getDotColor = (status) => {
    if (!status) return 'gray';
    if (status.includes('PASSED') || status === 'COMPLETED' || status === 'ARCHIVED' || status === 'OFFICIALLY_REGISTERED') {
        return 'green';
    }
    if (status.includes('REJECTED') || status === 'DEFENSE_FAILED' || status === 'CANCELLED' || status === 'TERMINATED') {
        return 'red';
    }
    if (status.includes('IN_PROGRESS') || status.includes('SUBMITTED') || status === 'DEFENSE_READY') {
        return 'blue';
    }
    return 'orange';
};

export default function RegistrationTimelineDrawer({
    open,
    onClose,
    registrationId,
    topicTitle,
    studentName,
    studentCode,
}) {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const historyQuery = useRegistrationHistory(scope, registrationId, Boolean(open && registrationId));

    const history = historyQuery.data || [];
    const loading = historyQuery.isPending && historyQuery.fetchStatus !== 'idle';
    const error = historyQuery.isError ? (historyQuery.error?.message || 'Không thể tải lịch sử tiến trình đề tài.') : null;

    const timelineItems = history.map((item, index) => {
        const color = getDotColor(item.toStatus);
        const toLabel = getStatusLabel(item.toStatus);
        const fromLabel = item.fromStatus ? getStatusLabel(item.fromStatus) : null;
        const timeStr = item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : '—';
        const actorName = item.actor?.fullName || 'Hệ thống';
        const actorRole = item.actor?.role ? (ROLE_LABEL_MAP[item.actor.role] || item.actor.role) : '';
        const actorDisplay = actorRole ? `${actorName} - ${actorRole}` : actorName;

        return {
            key: item.id || index,
            color,
            children: (
                <div className="text-sm pb-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-800">
                            {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
                        </span>
                        <span className="text-xs text-slate-600 shrink-0 font-mono">
                            {timeStr}
                        </span>
                    </div>

                    <div className="text-xs text-slate-600 mb-1">
                        Người thực hiện: <span className="font-medium text-slate-700">{actorDisplay}</span>
                    </div>

                    {item.reason && (
                        <div className="text-xs bg-slate-50 border border-slate-200 rounded p-2 mt-1 text-slate-700">
                            <strong>Lý do:</strong> {item.reason}
                        </div>
                    )}
                </div>
            ),
        };
    });

    return (
        <Drawer
            title="Lịch sử Tiến trình Đề tài"
            width={520}
            open={open}
            onClose={onClose}
            extra={
                <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => historyQuery.refetch()}
                    loading={loading}
                >
                    Làm mới
                </Button>
            }
            footer={
                <div className="flex justify-end">
                    <Button icon={<CloseOutlined />} onClick={onClose}>
                        Đóng
                    </Button>
                </div>
            }
        >
            {(topicTitle || studentName) && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    {topicTitle && (
                        <div>
                            <span className="text-slate-600 font-medium">Đề tài: </span>
                            <span className="font-semibold text-slate-800">{topicTitle}</span>
                        </div>
                    )}
                    {studentName && (
                        <div>
                            <span className="text-slate-600 font-medium">Sinh viên: </span>
                            <span className="font-semibold text-slate-800">{studentName}</span>
                            {studentCode && (
                                <span className="font-mono text-slate-600 ml-1">({studentCode})</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            <QueryPanel query={historyQuery} empty={history.length === 0} emptyDescription="Chưa có lịch sử chuyển trạng thái cho đề tài này.">
                <Timeline items={timelineItems} />
            </QueryPanel>
        </Drawer>
    );
}
