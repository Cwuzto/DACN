/**
 * FilterBar — Unified search/filter container.
 * Wraps filter inputs in a consistent card-like container.
 */

export default function FilterBar({ children, actions }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">{children}</div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}
