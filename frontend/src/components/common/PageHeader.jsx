import React from 'react';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';

const PAGE_HEADER_ACCENTS = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200/80',
    sky: 'bg-sky-50 text-sky-700 border-sky-200/80',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
};

/**
 * PageHeader — Nordic Institute Academic Page Header
 * Standardized across all administrative & academic views.
 * Supports: title, subtitle, icon, accent, breadcrumbs (or breadcrumb), badge/tags, and action buttons.
 */
export default function PageHeader({
    title,
    subtitle,
    icon,
    accent = 'teal',
    breadcrumbs,
    breadcrumb,
    badge,
    tags,
    actions,
    className = '',
}) {
    const crumbs = breadcrumbs || breadcrumb;
    const accentClasses = PAGE_HEADER_ACCENTS[accent] || PAGE_HEADER_ACCENTS.teal;

    return (
        <div className={`mb-5 pb-4 border-b border-slate-200/80 ${className}`}>
            {crumbs && crumbs.length > 0 && (
                <div className="mb-2">
                    <Breadcrumb
                        items={crumbs.map((crumb, idx) => ({
                            title: crumb.path ? (
                                <Link to={crumb.path} className="text-xs text-slate-500 hover:text-[#0F766E] transition-colors">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-xs text-slate-700 font-medium">{crumb.label}</span>
                            ),
                            key: idx,
                        }))}
                    />
                </div>
            )}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-[280px] flex-1">
                    {icon && (
                        <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 mt-0.5 shadow-sm ${accentClasses}`}
                            aria-hidden="true"
                        >
                            {icon}
                        </div>
                    )}
                    <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                                {title}
                            </h1>
                            {badge && <div>{badge}</div>}
                            {tags && tags.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    {tags.map((t, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                                        >
                                            {t.label || t}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {subtitle && (
                            <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex items-center flex-wrap gap-2.5 shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
