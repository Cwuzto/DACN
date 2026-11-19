import React from 'react';
import { Card } from 'antd';
import {
    TeamOutlined,
    AlertOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    FileExclamationOutlined,
} from '@ant-design/icons';

const XL_COLS_MAP = {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
};

/**
 * Hiển thị các chỉ số tóm tắt GVHD từ dữ liệu backend thực tế.
 * Chỉ hiển thị các chỉ số có số lượng > 0 trong đợt đang chọn; khi tất cả bằng 0 hiển thị tóm tắt rỗng gọn gàng.
 */
export default function OverviewKpis({ summary, watchCount = 0 }) {
    const supervisedCount = summary?.supervisedCount ?? 0;
    const maxStudents = summary?.maxStudents ?? 10;
    const actionableCount = summary?.actionableCount ?? 0;
    const effectiveWatchCount = watchCount || summary?.watchCount || 0;
    const upcomingDeadlineCount = summary?.upcomingDeadlineCount ?? 0;
    const pendingFeedbackCount = summary?.pendingFeedbackCount ?? 0;

    const cards = [
        {
            key: 'supervised',
            count: supervisedCount,
            label: 'Sinh viên hướng dẫn',
            value: `${supervisedCount} / ${maxStudents}`,
            hint: `Chỉ tiêu tối đa ${maxStudents} sinh viên`,
            icon: <TeamOutlined className="text-teal-600 text-lg" />,
            accent: 'border-teal-200 bg-teal-50/40',
        },
        {
            key: 'actionable',
            count: actionableCount,
            label: 'Việc cần xử lý',
            value: String(actionableCount),
            hint: 'Tổng việc đang chờ thao tác',
            icon: <AlertOutlined className="text-amber-600 text-lg" />,
            accent: 'border-amber-200 bg-amber-50/40',
        },
        {
            key: 'bm01Watch',
            count: effectiveWatchCount,
            label: 'Chưa nộp BM01',
            value: String(effectiveWatchCount),
            hint: 'Sinh viên đã duyệt đề tài cần theo dõi',
            icon: <FileExclamationOutlined className="text-orange-600 text-lg" />,
            accent: 'border-orange-200 bg-orange-50/40',
        },
        {
            key: 'deadlines',
            count: upcomingDeadlineCount,
            label: 'Mốc sắp đến hạn',
            value: String(upcomingDeadlineCount),
            hint: 'Nhiệm vụ còn hạn trong đợt',
            icon: <ClockCircleOutlined className="text-blue-600 text-lg" />,
            accent: 'border-blue-200 bg-blue-50/40',
        },
        {
            key: 'feedback',
            count: pendingFeedbackCount,
            label: 'Bài nộp chờ phản hồi',
            value: String(pendingFeedbackCount),
            hint: 'Cần nhận xét cho sinh viên',
            icon: <FileTextOutlined className="text-slate-600 text-lg" />,
            accent: 'border-slate-200 bg-slate-50/60',
        },
    ];

    const visibleCards = cards.filter((card) => card.count > 0);

    if (visibleCards.length === 0) {
        return (
            <div
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600"
                aria-label="Chỉ số tổng quan giảng viên"
            >
                Chưa có hoạt động hoặc sinh viên hướng dẫn trong đợt này.
            </div>
        );
    }

    const xlGridClass = XL_COLS_MAP[Math.min(visibleCards.length, 5)] || 'xl:grid-cols-4';

    return (
        <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${xlGridClass} gap-3`}
            aria-label="Chỉ số tổng quan giảng viên"
        >
            {visibleCards.map((card) => (
                <Card
                    key={card.key}
                    size="small"
                    className={`rounded-xl border ${card.accent} shadow-sm`}
                    styles={{ body: { padding: '14px 16px' } }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {card.label}
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                                {card.value}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {card.hint}
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                            {card.icon}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
