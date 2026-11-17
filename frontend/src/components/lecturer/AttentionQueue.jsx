import React, { useState } from 'react';
import { Button, Card, Empty, Tag } from 'antd';
import {
    ArrowRightOutlined,
    BellOutlined,
    CheckOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const PRIORITY_CONFIG = {
    OVERDUE: {
        label: 'Quá hạn',
        color: 'error',
        cardClass: 'border-red-300 bg-red-50/40',
    },
    DUE_SOON: {
        label: 'Sắp đến hạn',
        color: 'warning',
        cardClass: 'border-amber-300 bg-amber-50/30',
    },
    NORMAL: {
        label: 'Cần xử lý',
        color: 'processing',
        cardClass: 'border-slate-200 bg-white',
    },
    INFO: {
        label: 'Thông báo',
        color: 'default',
        cardClass: 'border-slate-200 bg-slate-50/70',
    },
};

const SOURCE_LABELS = {
    MENTOR: { label: 'GVHD', color: 'teal' },
    INSTITUTE_DIRECTOR: { label: 'Viện trưởng', color: 'gold' },
};

const ACTION_LABELS = {
    REVIEW_REGISTRATION: 'Xem xét đăng ký',
    REVIEW_BM01: 'Duyệt đề cương',
    REVIEW_TITLE_ADJUSTMENT: 'Xử lý đổi tên',
    PROVIDE_FEEDBACK: 'Phản hồi bài nộp',
    REVIEW_BM02: 'Thẩm định BM02',
    ISSUE_DECISION: 'Ban hành QĐ',
    PUBLISH_SCHEDULE: 'Công bố lịch HĐ',
    APPROVE_DEFENSE_RESULT: 'Phê duyệt kết quả',
};

/**
 * Hàng đợi chung cho việc GVHD và việc/thông báo Viện trưởng đã kiểm tra quyền.
 */
export default function AttentionQueue({
    items = [],
    syncKey = null,
    onNavigate,
    maxVisible = 8,
}) {
    const versionKey = syncKey ?? items;
    const [motionState, setMotionState] = useState(() => ({
        prevVersion: null,
        signatureMap: new Map(),
        animatedIds: new Set(),
    }));

    if (versionKey !== motionState.prevVersion) {
        const nextAnimated = new Set();
        const nextMap = new Map();

        for (const item of items) {
            nextMap.set(item.id, item.priority);
            const prevSig = motionState.signatureMap.get(item.id);
            const isNewUrgent = prevSig === undefined && (item.priority === 'OVERDUE' || item.priority === 'DUE_SOON');
            const escalatedToOverdue = prevSig !== undefined && prevSig !== 'OVERDUE' && item.priority === 'OVERDUE';
            if (isNewUrgent || escalatedToOverdue) {
                nextAnimated.add(item.id);
            }
        }

        setMotionState({
            prevVersion: versionKey,
            signatureMap: nextMap,
            animatedIds: nextAnimated,
        });
    }

    const animatedIds = motionState.animatedIds;

    const visibleItems = items.slice(0, maxVisible);

    return (
        <Card
            className="rounded-xl border border-slate-200 shadow-sm h-full"
            styles={{ body: { padding: '16px 18px' } }}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900 m-0">
                        Cần chú ý và xử lý
                    </h2>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                        Sắp xếp theo mức ưu tiên và hạn xử lý thực tế
                    </p>
                </div>
                <Tag color="blue" className="m-0 font-semibold">
                    {items.length} mục
                </Tag>
            </div>

            {visibleItems.length === 0 ? (
                <div className="py-8">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có việc cần xử lý"
                    />
                </div>
            ) : (
                <ul className="space-y-2.5 m-0 p-0 list-none">
                    {visibleItems.map((item) => {
                        const prio = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.NORMAL;
                        const src = SOURCE_LABELS[item.source] || SOURCE_LABELS.MENTOR;
                        const isAnimated = animatedIds.has(item.id);
                        const canMutate = Boolean(item.isActionable && item.allowedAction && item.priority !== 'INFO');
                        const actionLabel = canMutate
                            ? (ACTION_LABELS[item.allowedAction] || 'Xử lý ngay')
                            : 'Xem chi tiết';

                        return (
                            <li
                                key={item.id}
                                data-priority={item.priority}
                                className={`lecturer-attention-item rounded-lg border p-3 transition-colors ${prio.cardClass} ${
                                    isAnimated ? 'lecturer-attention-enter' : ''
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <Tag color={src.color} className="m-0 text-xs font-semibold">
                                                {src.label}
                                            </Tag>
                                            <Tag
                                                color={prio.color}
                                                icon={
                                                    item.priority === 'OVERDUE'
                                                        ? <ExclamationCircleOutlined />
                                                        : item.priority === 'INFO'
                                                            ? <BellOutlined />
                                                            : <ClockCircleOutlined />
                                                }
                                                className="m-0 text-xs font-semibold"
                                            >
                                                {prio.label}
                                            </Tag>
                                            {item.dueAt && (
                                                <span className="text-xs text-slate-500">
                                                    Hạn: {dayjs(item.dueAt).format('DD/MM/YYYY HH:mm')}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-sm font-semibold text-slate-900 m-0 break-words">
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className="text-xs text-slate-600 m-0 mt-1 break-words">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {item.target && (
                                        <div className="shrink-0">
                                            <Button
                                                size="small"
                                                type={canMutate ? 'primary' : 'default'}
                                                icon={canMutate ? <CheckOutlined /> : <ArrowRightOutlined />}
                                                onClick={() => onNavigate?.(item.target, item)}
                                            >
                                                {actionLabel}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
