import { LoadingOutlined } from '@ant-design/icons';

export default function ContentRefreshIndicator({ refreshing }) {
    if (!refreshing) return null;
    return (
        <div role="status" aria-live="polite" className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            <LoadingOutlined aria-hidden="true" />
            <span>Đang cập nhật dữ liệu</span>
        </div>
    );
}
