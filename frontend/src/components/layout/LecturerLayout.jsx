import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Flex, theme } from 'antd';
import {
    DashboardOutlined,
    FileTextOutlined,
    CheckSquareOutlined,
    BarChartOutlined,
    EditOutlined,
    BellOutlined,
    SettingOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BookOutlined,
    UserOutlined,
    DownOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
    {
        key: '/lecturer/dashboard',
        icon: <DashboardOutlined />,
        label: 'Tổng quan',
    },
    {
        key: '/lecturer/topics',
        icon: <FileTextOutlined />,
        label: 'Đề tài của tôi',
    },
    {
        key: '/lecturer/approvals',
        icon: <CheckSquareOutlined />,
        label: 'Duyệt đề tài',
    },
    {
        key: '/lecturer/progress',
        icon: <BarChartOutlined />,
        label: 'Theo dõi tiến độ',
    },
    {
        key: '/lecturer/grading',
        icon: <EditOutlined />,
        label: 'Chấm điểm',
    },
    { type: 'divider' },
    {
        key: '/lecturer/notifications',
        icon: <BellOutlined />,
        label: 'Thông báo',
    },
    {
        key: '/lecturer/profile',
        icon: <UserOutlined />,
        label: 'Hồ sơ cá nhân',
    },
];

function LecturerLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { token: themeToken } = theme.useToken();

    const handleMenuClick = ({ key }) => {
        navigate(key);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Thông tin cá nhân',
            onClick: () => navigate('/lecturer/profile'),
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Cài đặt',
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
            danger: true,
            onClick: handleLogout,
        },
    ];

    const getBreadcrumb = () => {
        const pathMap = {
            '/lecturer/dashboard': 'Tổng quan',
            '/lecturer/topics': 'Đề tài của tôi',
            '/lecturer/approvals': 'Duyệt đề tài',
            '/lecturer/progress': 'Theo dõi tiến độ',
            '/lecturer/grading': 'Chấm điểm',
            '/lecturer/notifications': 'Thông báo',
            '/lecturer/profile': 'Hồ sơ cá nhân',
        };
        return pathMap[location.pathname] || 'Tổng quan';
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={256}
                theme="dark"
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 10,
                    background: '#1a1a2e',
                }}
            >
                <div
                    style={{
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '0' : '0 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: '#722ed1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <BookOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </div>
                    {!collapsed && (
                        <span
                            style={{
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: 700,
                                marginLeft: 12,
                                whiteSpace: 'nowrap',
                                letterSpacing: -0.3,
                            }}
                        >
                            QLDA Giảng viên
                        </span>
                    )}
                </div>

                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ borderRight: 0, marginTop: 8, background: 'transparent' }}
                />

                {!collapsed && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '16px',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        <Flex
                            align="center"
                            gap={10}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.06)',
                            }}
                        >
                            <Avatar
                                size={36}
                                icon={<UserOutlined />}
                                style={{ background: '#722ed1', flexShrink: 0 }}
                            />
                            <div style={{ overflow: 'hidden' }}>
                                <Text
                                    strong
                                    style={{ color: '#fff', fontSize: 13, display: 'block' }}
                                    ellipsis
                                >
                                    {user?.name || 'Giảng viên'}
                                </Text>
                                <Text
                                    style={{
                                        color: 'rgba(255,255,255,0.45)',
                                        fontSize: 12,
                                        display: 'block',
                                    }}
                                    ellipsis
                                >
                                    Giảng viên hướng dẫn
                                </Text>
                            </div>
                        </Flex>
                    </div>
                )}
            </Sider>

            <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.2s' }}>
                <Header
                    style={{
                        background: '#fff',
                        padding: '0 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 4px rgba(0,21,41,.08)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 9,
                        height: 64,
                    }}
                >
                    <Flex align="center" gap={16}>
                        <span
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }}
                        >
                            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </span>
                        <Flex align="center" gap={8}>
                            <Text type="secondary" style={{ fontSize: 14 }}>Trang chủ</Text>
                            <Text type="secondary" style={{ fontSize: 14 }}>/</Text>
                            <Text strong style={{ fontSize: 14 }}>{getBreadcrumb()}</Text>
                        </Flex>
                    </Flex>

                    <Flex align="center" gap={16}>
                        <Badge count={3} size="small">
                            <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
                        </Badge>
                        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                            <Flex align="center" gap={8} style={{ cursor: 'pointer' }}>
                                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#722ed1' }} />
                                <Text strong style={{ fontSize: 14 }}>{user?.name || 'Giảng viên'}</Text>
                                <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                            </Flex>
                        </Dropdown>
                    </Flex>
                </Header>

                <Content style={{ margin: 24, minHeight: 'calc(100vh - 64px - 48px)' }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}

export default LecturerLayout;
