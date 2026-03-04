import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Flex, theme } from 'antd';
import {
    DashboardOutlined,
    TeamOutlined,
    CalendarOutlined,
    FileTextOutlined,
    UsergroupAddOutlined,
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
        key: '/admin/dashboard',
        icon: <DashboardOutlined />,
        label: 'Tổng quan',
    },
    {
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: 'Người dùng',
    },
    {
        key: '/admin/project-periods',
        icon: <CalendarOutlined />,
        label: 'Đợt đồ án',
    },
    {
        key: '/admin/topics',
        icon: <FileTextOutlined />,
        label: 'Đề tài',
    },
    {
        key: '/admin/councils',
        icon: <UsergroupAddOutlined />,
        label: 'Hội đồng',
    },
    { type: 'divider' },
    {
        key: '/admin/notifications',
        icon: <BellOutlined />,
        label: 'Thông báo',
    },
    {
        key: '/admin/settings',
        icon: <SettingOutlined />,
        label: 'Cài đặt',
    },
];

function AdminLayout() {
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

    // Determine breadcrumb from current path
    const getBreadcrumb = () => {
        const pathMap = {
            '/admin/dashboard': 'Tổng quan',
            '/admin/users': 'Người dùng',
            '/admin/project-periods': 'Đợt đồ án',
            '/admin/topics': 'Đề tài',
            '/admin/councils': 'Hội đồng',
            '/admin/notifications': 'Thông báo',
            '/admin/settings': 'Cài đặt',
        };
        return pathMap[location.pathname] || 'Tổng quan';
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Sidebar */}
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
                }}
            >
                {/* Logo */}
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
                            background: '#1677FF',
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
                            QLDA Admin
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ borderRight: 0, marginTop: 8 }}
                />

                {/* User info at bottom */}
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
                                style={{ background: '#1677FF', flexShrink: 0 }}
                            />
                            <div style={{ overflow: 'hidden' }}>
                                <Text
                                    strong
                                    style={{
                                        color: '#fff',
                                        fontSize: 13,
                                        display: 'block',
                                    }}
                                    ellipsis
                                >
                                    {user?.name || 'Admin User'}
                                </Text>
                                <Text
                                    style={{
                                        color: 'rgba(255,255,255,0.45)',
                                        fontSize: 12,
                                        display: 'block',
                                    }}
                                    ellipsis
                                >
                                    Quản trị viên
                                </Text>
                            </div>
                        </Flex>
                    </div>
                )}
            </Sider>

            {/* Main Content Area */}
            <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.2s' }}>
                {/* Header */}
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
                        {/* Collapse toggle */}
                        <span
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }}
                        >
                            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </span>
                        {/* Breadcrumb */}
                        <Flex align="center" gap={8}>
                            <Text type="secondary" style={{ fontSize: 14 }}>Trang chủ</Text>
                            <Text type="secondary" style={{ fontSize: 14 }}>/</Text>
                            <Text strong style={{ fontSize: 14 }}>{getBreadcrumb()}</Text>
                        </Flex>
                    </Flex>

                    <Flex align="center" gap={16}>
                        {/* Notifications */}
                        <Badge count={3} size="small">
                            <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
                        </Badge>
                        {/* User dropdown */}
                        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                            <Flex align="center" gap={8} style={{ cursor: 'pointer' }}>
                                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1677FF' }} />
                                <Text strong style={{ fontSize: 14 }}>{user?.name || 'Admin'}</Text>
                                <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                            </Flex>
                        </Dropdown>
                    </Flex>
                </Header>

                {/* Page Content */}
                <Content
                    style={{
                        margin: 24,
                        minHeight: 'calc(100vh - 64px - 48px)',
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}

export default AdminLayout;
