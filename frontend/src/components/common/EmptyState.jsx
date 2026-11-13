import { Empty, Typography } from 'antd';

export default function EmptyState({ title = 'Không có dữ liệu', description, action, icon }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-10">
            <Empty image={icon || Empty.PRESENTED_IMAGE_SIMPLE} description={(
                <div className="space-y-2">
                    <Typography.Text strong>{title}</Typography.Text>
                    {description && <div className="text-slate-600">{description}</div>}
                </div>
            )}>
                {action}
            </Empty>
        </section>
    );
}
