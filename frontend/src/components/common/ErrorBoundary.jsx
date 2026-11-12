import React, { Component } from 'react';
import { Result, Button, Typography, Space } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallbackComponent) {
                return typeof this.props.fallbackComponent === 'function'
                    ? this.props.fallbackComponent({ error: this.state.error, resetError: this.handleReset })
                    : this.props.fallbackComponent;
            }

            const errorMessage = this.state.error?.message || 'Đã có lỗi bất ngờ xảy ra trong quá trình hiển thị.';

            return (
                <div
                    style={{
                        minHeight: '60vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    <div
                        style={{
                            maxWidth: 640,
                            width: '100%',
                            background: '#FFFFFF',
                            borderRadius: 12,
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.08)',
                            padding: '32px 24px',
                        }}
                    >
                        <Result
                            status="error"
                            title={<span style={{ color: '#0F172A', fontWeight: 700 }}>Đã xảy ra sự cố hiển thị</span>}
                            subTitle={
                                <span style={{ color: '#475569' }}>
                                    Hệ thống ghi nhận ngoại lệ khi dựng giao diện. Bạn có thể tải lại trang hoặc quay về trang chủ để tiếp tục làm việc.
                                </span>
                            }
                            extra={
                                <Space orientation="horizontal" size="middle">
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={this.handleReload}
                                        style={{ backgroundColor: '#0F766E', borderColor: '#0F766E' }}
                                    >
                                        Tải lại trang
                                    </Button>
                                    <Button
                                        icon={<HomeOutlined />}
                                        onClick={this.handleGoHome}
                                    >
                                        Về trang chủ
                                    </Button>
                                </Space>
                            }
                        >
                            {process.env.NODE_ENV !== 'production' && this.state.error && (
                                <div
                                    style={{
                                        textAlign: 'left',
                                        background: '#F8FAFC',
                                        borderRadius: 8,
                                        border: '1px solid #CBD5E1',
                                        padding: '12px 16px',
                                        marginTop: 16,
                                    }}
                                >
                                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                                        Chi tiết lỗi kỹ thuật:
                                    </Text>
                                    <Paragraph
                                        ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }}
                                        style={{ color: '#DC2626', fontFamily: 'monospace', fontSize: 12, margin: '8px 0 0 0' }}
                                    >
                                        {errorMessage}
                                    </Paragraph>
                                </div>
                            )}
                        </Result>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
