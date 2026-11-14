import { Component } from 'react';
import { Button, Result, Space } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import QueryErrorState from './QueryErrorState';
import { isChunkLoadError } from '../../utils/chunkError';

class ErrorBoundary extends Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    }

    componentDidUpdate(previousProps) {
        const keys = this.props.resetKeys || [];
        const previousKeys = previousProps.resetKeys || [];
        if (this.state.hasError && (keys.length !== previousKeys.length
            || keys.some((value, index) => value !== previousKeys[index]))) {
            this.handleReset();
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        if (this.props.fallbackComponent) {
            return typeof this.props.fallbackComponent === 'function'
                ? this.props.fallbackComponent({ error: this.state.error, resetError: this.handleReset })
                : this.props.fallbackComponent;
        }

        const chunkFailure = isChunkLoadError(this.state.error);
        return (
            <div className="min-h-[40vh] py-6">
                {chunkFailure ? (
                    <section role="alert" className="rounded-lg border border-slate-200 bg-white p-4">
                        <Result status="error" title="Không thể tải phiên bản trang"
                            subTitle="Vui lòng tải lại trang để tiếp tục."
                            extra={(
                                <Space wrap>
                                    <Button type="primary" icon={<ReloadOutlined aria-hidden="true" />} onClick={() => window.location.reload()}>Tải lại trang</Button>
                                    {this.props.onBack && <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={this.props.onBack}>Quay lại</Button>}
                                </Space>
                            )}
                        />
                    </section>
                ) : (
                    <QueryErrorState
                        error={{ message: 'Đã xảy ra sự cố hiển thị. Bạn có thể thử lại hoặc quay lại trang trước.' }}
                        onRetry={this.handleReset}
                        onBack={this.props.onBack}
                    />
                )}
                {!import.meta.env.PROD && this.state.error && (
                    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                        <summary>Chi tiết lỗi kỹ thuật</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-red-700">{this.state.error.stack || this.state.error.message}</pre>
                    </details>
                )}
            </div>
        );
    }
}

export default ErrorBoundary;
