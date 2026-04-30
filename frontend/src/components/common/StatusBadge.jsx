import { STATUS_MAP } from './statusMap';

export default function StatusBadge({ status, label }) {
    const config = STATUS_MAP[status] || { label: status, tw: 'bg-slate-100 text-slate-600' };
    return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${config.tw}`}>
            {label || config.label}
        </span>
    );
}
