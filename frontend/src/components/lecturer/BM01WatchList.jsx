import React from 'react';
import { Button, Card, Empty, Tag } from 'antd';
import {
    BellOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

function resolveDeadlineMeta(item) {
    if (!item?.dueAt || item?.deadlineState === 'NO_DEADLINE') {
        return {
            label: 'Chưa đặt hạn',
            color: 'default',
            icon: <ClockCircleOutlined />,
            cardClass: 'border-slate-200 bg-white',
            dueText: 'Chưa đặt hạn',
        };
    }

    const isOverdue = item.deadlineState === 'OVERDUE' || dayjs(item.dueAt).isBefore(dayjs());
    const formattedDue = dayjs(item.dueAt).format('DD/MM/YYYY HH:mm');

    if (isOverdue) {
        return {
            label: 'Quá hạn',
            color: 'error',
            icon: <ExclamationCircleOutlined />,
            cardClass: 'border-red-200 bg-red-50/30',
            dueText: formattedDue,
        };
    }

    return {
        label: 'Còn hạn',
        color: 'processing',
        icon: <ClockCircleOutlined />,
        cardClass: 'border-slate-200 bg-white',
        dueText: formattedDue,
    };
}

/**
 * Danh sách theo dõi sinh viên đã được duyệt đề tài (APPROVED) nhưng chưa nộp BM01.
 * Tách riêng khỏi hàng đợi xử lý của GVHD; hệ thống gửi nhắc tự động theo lịch.
 */
export default function BM01WatchList({ items = [], onOpenStudent }) {
    return (
        <Card
            className="rounded-xl border border-slate-200 shadow-sm"
            styles={{ body: { padding: '16px 18px' } }}
        >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900 m-0">
                        Sinh viên chưa nộp BM01
                    </h2>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                        Theo dõi tiến độ nộp đề cương BM01 của sinh viên hướng dẫn; hệ thống tự động gửi nhắc theo hạn đợt.
                    </p>
                </div>
                <Tag color={items.length > 0 ? 'orange' : 'default'} className="m-0 font-semibold self-start sm:self-center">
                    {items.length} sinh viên
                </Tag>
            </div>

            {items.length === 0 ? (
                <div className="py-6">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có sinh viên chưa nộp BM01"
                    />
                </div>
            ) : (
                <ul className="space-y-2.5 m-0 p-0 list-none">
                    {items.map((item) => {
                        const deadline = resolveDeadlineMeta(item);
                        const reminderText = item.lastReminderAt
                            ? `Nhắc tự động gần nhất: ${dayjs(item.lastReminderAt).format('DD/MM/YYYY HH:mm')}`
                            : 'Chưa gửi nhắc tự động';

                        return (
                            <li
                                key={item.registrationId}
                                className={`rounded-lg border p-3 ${deadline.cardClass}`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-sm font-semibold text-slate-900 break-words">
                                                {item.studentName || 'Sinh viên'}
                                            </span>
                                            {item.studentCode && (
                                                <span className="text-xs font-mono text-slate-500">
                                                    {item.studentCode}
                                                </span>
                                            )}
                                            <Tag
                                                color={deadline.color}
                                                icon={deadline.icon}
                                                className="m-0 text-xs font-semibold"
                                            >
                                                {deadline.label}
                                            </Tag>
                                        </div>

                                        <p className="text-xs text-slate-700 m-0 break-words">
                                            {item.topicTitle || 'Chưa cập nhật đề tài'}
                                        </p>

                                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3 text-xs text-slate-500 pt-0.5">
                                            <span className="inline-flex items-center gap-1">
                                                <ClockCircleOutlined />
                                                Hạn nộp BM01: {deadline.dueText}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <BellOutlined />
                                                {reminderText}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        <Button
                                            size="small"
                                            icon={<FolderOpenOutlined />}
                                            disabled={!item.target}
                                            onClick={() => onOpenStudent?.(item)}
                                        >
                                            Xem quá trình
                                        </Button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
