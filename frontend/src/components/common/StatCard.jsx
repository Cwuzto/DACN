import React from 'react';

/**
 * StatCard — Nordic Institute Clean KPI Metric Card
 * Displays high-contrast metrics with semantic status colors and optional trend indicator.
 */
export default function StatCard({
    icon,
    iconBg = 'bg-teal-50',
    iconColor = 'text-teal-700',
    label,
    value,
    description,
    trend,
    onClick,
    className = '',
}) {
    const isClickable = Boolean(onClick);

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm transition-all duration-150 ${
                isClickable
                    ? 'cursor-pointer hover:border-teal-600/70 hover:shadow-md active:scale-[0.995]'
                    : 'hover:border-slate-300 hover:shadow-md'
            } ${className}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">
                        {label}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                        {value}
                    </div>
                    {description && (
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {description}
                        </div>
                    )}
                </div>
                {icon && (
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <span className={`material-symbols-outlined text-[19px] ${iconColor}`}>
                            {icon}
                        </span>
                    </div>
                )}
            </div>

            {trend && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                            trend.isPositive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                    >
                        {trend.isPositive ? '↑' : '↓'} {trend.value}
                    </span>
                </div>
            )}
        </div>
    );
}
