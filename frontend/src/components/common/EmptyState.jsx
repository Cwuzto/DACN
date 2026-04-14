/**
 * EmptyState — Unified empty/no-data display.
 * Replaces ad-hoc empty state patterns across pages.
 */

export default function EmptyState({ icon = 'inventory_2', title = 'Không có dữ liệu', description }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">{icon}</span>
            <h3 className="text-xl font-bold text-slate-700 mb-2">{title}</h3>
            {description && <p className="text-slate-500 max-w-md">{description}</p>}
        </div>
    );
}
