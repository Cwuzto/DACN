import React from 'react';

/**
 * QuotaMeter - Visual Indicator for Academic Supervised Quotas
 * Strictly enforces TopicRegistration rule:
 * - 1 Student / 1 Topic (maxStudents = 1)
 * - 1 Lecturer / Max 10 Students (maxStudents = 10)
 */
export default function QuotaMeter({
    current = 0,
    max = 10,
    label = 'Định mức hướng dẫn',
    showLabel = true,
    compact = false,
    className = '',
}) {
    const safeCurrent = Math.max(0, Number(current) || 0);
    const safeMax = Math.max(1, Number(max) || 10);
    const isFull = safeCurrent >= safeMax;
    const isNearFull = !isFull && safeCurrent >= safeMax * 0.8;
    const remaining = Math.max(0, safeMax - safeCurrent);
    const percentage = Math.min(100, Math.round((safeCurrent / safeMax) * 100));

    // Status styling
    const statusColor = isFull
        ? 'text-rose-600 dark:text-rose-400'
        : isNearFull
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-teal-700 dark:text-teal-400';

    const barBgColor = isFull
        ? 'bg-rose-500'
        : isNearFull
        ? 'bg-amber-500'
        : 'bg-teal-600';

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1.5 ${className}`}>
                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                        className={`h-full transition-all duration-300 ${barBgColor}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <span className={`text-xs font-mono font-semibold ${statusColor}`}>
                    {safeCurrent}/{safeMax}
                </span>
            </div>
        );
    }

    return (
        <div className={`quota-meter-wrapper ${className}`}>
            {showLabel && (
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-600">{label}:</span>
                    <span className={`font-mono font-semibold ${statusColor}`}>
                        {safeCurrent} / {safeMax} SV{' '}
                        <span className="text-[11px] font-normal text-slate-500">
                            ({isFull ? 'Đã đủ 10/10' : `Còn ${remaining} chỗ`})
                        </span>
                    </span>
                </div>
            )}

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                    className={`h-full transition-all duration-500 rounded-full ${barBgColor}`}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={safeCurrent}
                    aria-valuemin={0}
                    aria-valuemax={safeMax}
                />
            </div>
        </div>
    );
}
