import React from 'react';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';

/**
 * PageHeader — Swiss Modernism 2.0 Unified Page Header
 * Standardized across all administrative & academic views.
 * Supports: title, subtitle, breadcrumbs, contextual tags/badges, and action buttons.
 */
export default function PageHeader({
    title,
    subtitle,
    breadcrumbs,
    badge,
    actions,
    className = '',
}) {
    return (
        <div className={`mb-6 pb-2 border-b border-slate-200/60 ${className}`}>
            {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="mb-2">
                    <Breadcrumb
                        items={breadcrumbs.map((crumb, idx) => ({
                            title: crumb.path ? (
                                <Link to={crumb.path} className="text-xs text-slate-500 hover:text-primary transition-colors">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                            {title}
                        </h1>
                        {badge && <div>{badge}</div>}
                    </div>
                    {subtitle && (
                        <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                            {subtitle}
                        </p>
                    )}
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
