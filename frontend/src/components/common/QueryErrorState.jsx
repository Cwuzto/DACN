import { Button, Result, Space } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';

export default function QueryErrorState({ error, onRetry, onBack, retrying = false }) {
    return (
        <section role="alert" aria-busy={retrying} className="rounded-lg border border-slate-200 bg-white p-4">
            <Result status="error" title="Không thể tải nội dung"
                subTitle={error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'}
                extra={(
                    <Space wrap>
                        {onRetry && <Button type="primary" icon={<ReloadOutlined aria-hidden="true" />} onClick={onRetry} loading={retrying} disabled={retrying}>Thử lại</Button>}
                        {onBack && <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={onBack}>Quay lại</Button>}
                    </Space>
                )}
            />
        </section>
    );
}
