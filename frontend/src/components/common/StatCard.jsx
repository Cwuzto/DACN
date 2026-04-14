/**
 * StatCard — Unified dashboard metric card.
 * Replaces 4 different stat card patterns across roles.
 */

export default function StatCard({ icon, iconBg = 'bg-blue-50', iconColor = 'text-blue-600', label, value, description }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-black text-slate-900">{value}</p>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
    );
}
