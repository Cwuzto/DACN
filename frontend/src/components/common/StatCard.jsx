import React from 'react';

/**
 * StatCard — Swiss Modernism 2.0 Unified KPI & Metric Card
 * Displays high-contrast metrics with semantic status colors and optional trend indicator.
 */
export default function StatCard({
    icon,
    iconBg = 'bg-blue-50',
    iconColor = 'text-blue-600',
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
            className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm transition-all duration-200 ${
                isClickable
                    ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.99]'
                    : 'hover:shadow-md'
            } ${className}`}
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {label}
                </span>
                <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>
                        {icon}
                    </span>
                </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                    {value}
                </p>
                {trend && (
                    <span
                        className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                            trend.isPositive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                        }`}
                    >
                        {trend.isPositive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>

            {description && (
                <p className="text-xs text-slate-400 font-normal mt-2.5 leading-snug">
                    {description}
                </p>
            )}
        </div>
    );
}
