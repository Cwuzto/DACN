import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Timeline, Skeleton, Empty, Alert, Button } from 'antd';
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import registrationService from '../../services/registrationService';
import { STATUS_MAP } from './statusMap';

const ROLE_LABEL_MAP = {
    STUDENT: 'Sinh viên',
    LECTURER: 'Giảng viên',
    ADMIN: 'Quản trị viên',
    DEPARTMENT_HEAD: 'Trưởng bộ môn',
    COUNCIL_PRESIDENT: 'Chủ tịch hội đồng',
    SECRETARY: 'Thư ký',
};

const getDotColor = (status) => {
    const s = String(status || '').toUpperCase();
    if (['COMPLETED', 'BM01_PASSED', 'BM03_PASSED', 'DEFENDED', 'DEFENSE_PASSED', 'PASSED'].includes(s)) {
        return 'green';
    }
    if ([
        'APPROVED',
        'IN_PROGRESS_BM03',
        'DEFENSE_READY',
        'READY_FOR_DEFENSE',
        'DECISION_ISSUED',
        'IN_PROGRESS',
        'REGISTERED',
        'SUBMITTED',
        'BM01_SUBMITTED',
        'BM02_SUBMITTED',
        'BM02_RESUBMITTED',
    ].includes(s)) {
        return 'blue';
    }
    if ([
        'STOPPED',
        'CANCELLED',
        'REJECTED',
        'TERMINATED_BM01',
        'TERMINATED_BM02',
        'TERMINATED_FAILED_PROGRESS',
        'TERMINATED_BM04',
        'DROPPED',
        'WITHDRAWN',
        'FAILED',
        'DEFENSE_FAILED',
        'ARCHIVE_REJECTED',
    ].includes(s)) {
        return 'red';
    }
    return 'gray';
};

const getStatusLabel = (status) => {
    if (!status) return 'Chưa xác định';
    return STATUS_MAP[status]?.label || status;
};

export default function RegistrationTimelineDrawer({
    open,
    onClose,
    registrationId,
    topicTitle,
    studentName,
    studentCode,
}) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);

    const fetchHistory = useCallback(async () => {
        if (!registrationId) {
            setHistory([]);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const res = await registrationService.getRegistrationHistory(registrationId);
            const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            setHistory(items);
        } catch (err) {
            setError(err?.message || 'Không thể tải lịch sử tiến trình đề tài.');
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [registrationId]);

    useEffect(() => {
        if (open && registrationId) {
            fetchHistory();
        } else if (!open) {
            setError(null);
        }
    }, [open, registrationId, fetchHistory]);

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
                <div className="space-y-1 pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">
                            {toLabel}
                        </span>
                        <span className="text-xs text-slate-600 font-mono">
                            {timeStr}
                        </span>
                    </div>

                    {fromLabel && fromLabel !== toLabel && (
                        <div className="text-xs text-slate-600">
                            Trạng thái trước: <span className="font-medium text-slate-700">{fromLabel}</span>
                        </div>
                    )}

                    <div className="text-xs text-slate-600">
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
                    onClick={fetchHistory}
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

            {error && (
                <Alert
                    type="error"
                    showIcon
                    message="Lỗi tải dữ liệu"
                    description={error}
                    style={{ marginBottom: 16 }}
                />
            )}

            {loading ? (
                <div className="py-4">
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            ) : history.length === 0 ? (
                <div className="py-12">
                    <Empty description="Chưa có lịch sử chuyển trạng thái" />
                </div>
            ) : (
                <div className="pt-2">
                    <Timeline items={timelineItems} />
                </div>
            )}
        </Drawer>
    );
}
