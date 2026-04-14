/**
 * PageHeader — Unified page title + subtitle.
 * Replaces mix of h1/h2/Title across roles.
 */

export default function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
                <h2 className="text-2xl font-black text-slate-900">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    );
}
