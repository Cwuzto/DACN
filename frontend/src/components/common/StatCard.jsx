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
            className={`bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs transition-all duration-150 ${
                isClickable
                    ? 'cursor-pointer hover:border-teal-600/70 hover:shadow-sm active:scale-[0.995]'
                    : 'hover:border-slate-300'
            } ${className}`}
        >
            <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider truncate">
                    {label}
                </span>
                <div className={`w-8 h-8 ${iconBg} rounded-md flex items-center justify-center shrink-0 border border-black/5`}>
                    <span className={`material-symbols-outlined text-[19px] ${iconColor}`}>
                        {icon}
                    </span>
                </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-none">
                    {value}
                </p>
                {trend && (
                    <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                            trend.isPositive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                    >
                        {trend.isPositive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>

            {description && (
                <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                    {description}
                </p>
            )}
        </div>
    );
}
