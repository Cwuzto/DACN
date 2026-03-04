import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Form,
    Input,
    Button,
    Checkbox,
    Typography,
    message,
    Modal,
    Flex,
} from 'antd';
import {
    UserOutlined,
    LockOutlined,
    BookOutlined,
    TeamOutlined,
    FileSearchOutlined,
    CheckCircleOutlined,
    BarChartOutlined,
    ExclamationCircleFilled,
} from '@ant-design/icons';
import { authService } from '../../services/authService';
import useAuthStore from '../../stores/authStore';

const { Title, Text, Paragraph } = Typography;

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const response = await authService.login(values.email, values.password);
            const { token, user } = response.data;
            setAuth(token, user);
            message.success('Đăng nhập thành công!');

            // Điều hướng dựa trên role
            if (user.role === 'ADMIN') {
                navigate('/admin/dashboard');
            } else if (user.role === 'LECTURER') {
                navigate('/lecturer/dashboard');
            } else {
                navigate('/student/dashboard');
            }

        } catch (error) {
            // Hiển thị popup cảnh báo lỗi (không xóa nội dung form)
            Modal.error({
                title: 'Đăng nhập thất bại',
                icon: <ExclamationCircleFilled />,
                content: error?.response?.data?.message || error?.message || 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!',
                okText: 'Thử lại',
                centered: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* ===== LEFT SIDE: Hero/Branding ===== */}
            <div style={styles.heroSide}>
                {/* Decorative blurred circles */}
                <div style={styles.decorCircle1} />
                <div style={styles.decorCircle2} />
                <div style={styles.decorCircle3} />

                {/* Content */}
                <div style={styles.heroContent}>
                    {/* Logo bar */}
                    <Flex align="center" gap={12} style={{ marginBottom: 48 }}>
                        <div style={styles.heroBadge}>
                            <BookOutlined style={{ fontSize: 22, color: '#fff' }} />
                        </div>
                        <Text
                            strong
                            style={{
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: 16,
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                            }}
                        >
                            Viện Công nghệ Số
                        </Text>
                    </Flex>

                    {/* Heading */}
                    <Title
                        level={1}
                        style={{
                            color: '#fff',
                            fontSize: 52,
                            fontWeight: 900,
                            lineHeight: 1.15,
                            margin: 0,
                            letterSpacing: -1,
                        }}
                    >
                        HỆ THỐNG
                        <br />
                        QUẢN LÝ ĐỒ ÁN
                    </Title>
                    <Paragraph
                        style={{
                            color: 'rgba(200, 225, 255, 0.9)',
                            fontSize: 17,
                            maxWidth: 480,
                            marginTop: 16,
                            lineHeight: 1.7,
                        }}
                    >
                        Nền tảng hỗ trợ sinh viên và giảng viên quản lý tiến độ, báo cáo và
                        đánh giá đồ án một cách hiệu quả và minh bạch.
                    </Paragraph>

                    {/* Feature cards thay cho khoảng trống cũ */}
                    <div style={styles.featureGrid}>
                        <div style={styles.featureCard}>
                            <div style={styles.featureIconWrapper}>
                                <TeamOutlined style={{ fontSize: 22, color: '#60a5fa' }} />
                            </div>
                            <div>
                                <Text style={styles.featureTitle}>Quản lý nhóm</Text>
                                <Text style={styles.featureDesc}>Tạo nhóm, phân công đề tài tự động</Text>
                            </div>
                        </div>
                        <div style={styles.featureCard}>
                            <div style={styles.featureIconWrapper}>
                                <FileSearchOutlined style={{ fontSize: 22, color: '#34d399' }} />
                            </div>
                            <div>
                                <Text style={styles.featureTitle}>Theo dõi tiến độ</Text>
                                <Text style={styles.featureDesc}>Cập nhật real-time từng giai đoạn</Text>
                            </div>
                        </div>
                        <div style={styles.featureCard}>
                            <div style={styles.featureIconWrapper}>
                                <CheckCircleOutlined style={{ fontSize: 22, color: '#fbbf24' }} />
                            </div>
                            <div>
                                <Text style={styles.featureTitle}>Duyệt đề tài</Text>
                                <Text style={styles.featureDesc}>Quy trình xét duyệt minh bạch</Text>
                            </div>
                        </div>
                        <div style={styles.featureCard}>
                            <div style={styles.featureIconWrapper}>
                                <BarChartOutlined style={{ fontSize: 22, color: '#f472b6' }} />
                            </div>
                            <div>
                                <Text style={styles.featureTitle}>Chấm điểm</Text>
                                <Text style={styles.featureDesc}>Hội đồng đánh giá trực tuyến</Text>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Text style={{ color: 'rgba(180, 210, 255, 0.8)', fontSize: 13, position: 'relative', zIndex: 1 }}>
                    © 2026 Viện Công nghệ Số - Trường đại học Thủ Dầu Một.
                </Text>
            </div>

            {/* ===== RIGHT SIDE: Login Form ===== */}
            <div style={styles.formSide}>
                <div style={styles.formWrapper}>
                    {/* Header */}
                    <Flex vertical align="center" gap={8} style={{ marginBottom: 40 }}>
                        <div style={styles.formLogo}>
                            <BookOutlined style={{ fontSize: 32, color: '#1677FF' }} />
                        </div>
                        <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: -0.5 }}>
                            Đăng nhập
                        </Title>
                        <Text type="secondary" style={{ fontSize: 15 }}>
                            Vui lòng đăng nhập để tiếp tục
                        </Text>
                    </Flex>

                    {/* Form - preserve values on error via preserveOnUnmount */}
                    <Form
                        name="login"
                        layout="vertical"
                        onFinish={onFinish}
                        autoComplete="off"
                        requiredMark={false}
                        size="large"
                    >
                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: 'Vui lòng nhập email!' },
                                { type: 'email', message: 'Email không hợp lệ!' },
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined style={styles.inputIcon} />}
                                placeholder="Email đăng nhập"
                                style={styles.inputField}
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={styles.inputIcon} />}
                                placeholder="Mật khẩu"
                                style={styles.inputField}
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 28 }}>
                            <Flex justify="space-between" align="center">
                                <Form.Item name="remember" valuePropName="checked" noStyle>
                                    <Checkbox>
                                        <Text style={{ fontSize: 14, color: '#64748b' }}>Ghi nhớ đăng nhập</Text>
                                    </Checkbox>
                                </Form.Item>
                                <a
                                    href="#"
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: '#1677FF',
                                    }}
                                >
                                    Quên mật khẩu?
                                </a>
                            </Flex>
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={styles.submitBtn}
                            >
                                Đăng nhập
                            </Button>
                        </Form.Item>
                    </Form>

                    {/* Hướng dẫn tài khoản */}
                    <div style={styles.hintBox}>
                        <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                            Tài khoản được cấp bởi Quản trị viên hệ thống.
                        </Text>
                        <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                            Liên hệ Phòng Đào tạo nếu quên mật khẩu.
                        </Text>
                    </div>

                    {/* Footer */}
                    <div style={styles.formFooter}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            © 2026 Viện Công nghệ Số. All rights reserved.
                        </Text>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ===== INLINE STYLES ===== */
const styles = {
    container: {
        display: 'flex',
        minHeight: '100vh',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },

    /* --- Hero Side --- */
    heroSide: {
        flex: '0 0 60%',
        background: 'linear-gradient(135deg, #1677FF 0%, #0958D9 50%, #003EB3 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
    },
    decorCircle1: {
        position: 'absolute',
        top: '-12%',
        left: '-8%',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
    },
    decorCircle2: {
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'rgba(64, 150, 255, 0.15)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
    },
    decorCircle3: {
        position: 'absolute',
        top: '40%',
        right: '15%',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
    },
    heroContent: {
        position: 'relative',
        zIndex: 1,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    heroBadge: {
        width: 42,
        height: 42,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Feature cards */
    featureGrid: {
        marginTop: 40,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        maxWidth: 520,
    },
    featureCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '18px 20px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.3s ease',
        cursor: 'default',
    },
    featureIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    featureTitle: {
        display: 'block',
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
    },
    featureDesc: {
        display: 'block',
        color: 'rgba(200,220,255,0.7)',
        fontSize: 12,
        lineHeight: 1.4,
    },

    /* --- Form Side --- */
    formSide: {
        flex: '0 0 40%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: '#fff',
        overflowY: 'auto',
    },
    formWrapper: {
        width: '100%',
        maxWidth: 420,
    },
    formLogo: {
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'rgba(22, 119, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    inputField: {
        height: 48,
        borderRadius: 10,
        fontSize: 15,
    },
    inputIcon: {
        color: '#94a3b8',
        fontSize: 17,
        marginRight: 4,
    },
    submitBtn: {
        height: 48,
        fontWeight: 600,
        fontSize: 16,
        borderRadius: 10,
        boxShadow: '0 4px 14px rgba(22, 119, 255, 0.25)',
    },
    hintBox: {
        marginTop: 12,
        padding: '14px 16px',
        background: '#f8fafc',
        borderRadius: 10,
        border: '1px solid #f1f5f9',
        textAlign: 'center',
    },
    formFooter: {
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid #f1f5f9',
        textAlign: 'center',
    },
};

export default LoginPage;