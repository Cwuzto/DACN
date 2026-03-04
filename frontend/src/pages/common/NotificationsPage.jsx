import { useState } from 'react';
import { Card, Typography, Flex, Tag, Button, Badge, Empty, Tabs, Space, Avatar, theme } from 'antd';
import {
    BellOutlined, CheckOutlined, DeleteOutlined, SettingOutlined,
    InfoCircleOutlined, WarningOutlined, FileTextOutlined, TeamOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const initialNotifications = [
    {
        key: '1', type: 'submission', read: false, time: '5 phút trước',
        title: 'Nhóm 04 đã nộp báo cáo tiến độ Tuần 5',
        desc: 'Trần Minh Hiếu đã nộp file "BaoCao_Tuan5.pdf" (2.4 MB)',
        icon: <FileTextOutlined style={{ color: '#1677FF' }} />,
    },
    {
        key: '2', type: 'approval', read: false, time: '2 giờ trước',
        title: 'Yêu cầu duyệt đề tài mới',
        desc: 'Nhóm 08 đăng ký đề tài "Xây dựng hệ thống quản lý thư viện số dựa trên AI"',
        icon: <InfoCircleOutlined style={{ color: '#722ed1' }} />,
    },
    {
        key: '3', type: 'deadline', read: false, time: '5 giờ trước',
        title: 'Nhắc nhở: Hạn nộp báo cáo tiến độ',
        desc: 'Hạn cuối nộp báo cáo tiến độ Tuần 5 là 23:59 hôm nay.',
        icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
    },
    {
        key: '4', type: 'council', read: true, time: 'Hôm qua',
        title: 'Lịch họp hội đồng bảo vệ',
        desc: 'Bạn được phân công vào Hội đồng K17-CNTT-Đ1. Ngày bảo vệ: 15/06/2024.',
        icon: <TeamOutlined style={{ color: '#13C2C2' }} />,
    },
    {
        key: '5', type: 'system', read: true, time: '2 ngày trước',
        title: 'Cập nhật hệ thống',
        desc: 'Hệ thống đã được cập nhật phiên bản mới với các cải tiến về hiệu suất.',
        icon: <SettingOutlined style={{ color: '#8c8c8c' }} />,
    },
];

function NotificationsPage() {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [activeTab, setActiveTab] = useState('all');

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (key) => {
        setNotifications(prev => prev.map(n => n.key === key ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotif = (key) => {
        setNotifications(prev => prev.filter(n => n.key !== key));
    };

    const filteredNotifs = activeTab === 'all'
        ? notifications
        : activeTab === 'unread'
            ? notifications.filter(n => !n.read)
            : notifications.filter(n => n.read);

    const tabItems = [
        { key: 'all', label: <Badge count={notifications.length} size="small" offset={[10, 0]}>Tất cả</Badge> },
        { key: 'unread', label: <Badge count={unreadCount} size="small" offset={[10, 0]}>Chưa đọc</Badge> },
        { key: 'read', label: 'Đã đọc' },
    ];

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <BellOutlined style={{ marginRight: 8 }} />
                        Thông báo
                    </Title>
                    <Text type="secondary">{unreadCount} thông báo chưa đọc</Text>
                </div>
                <Space>
                    <Button icon={<CheckOutlined />} onClick={markAllRead}>Đánh dấu tất cả đã đọc</Button>
                </Space>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Tabs
                    items={tabItems}
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    style={{ padding: '0 24px' }}
                    tabBarStyle={{ marginBottom: 0 }}
                />

                <div style={{ padding: '8px 0' }}>
                    {filteredNotifs.length === 0 ? (
                        <Empty description="Không có thông báo" style={{ padding: '40px 0' }} />
                    ) : (
                        filteredNotifs.map((notif) => (
                            <div
                                key={notif.key}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: notif.read ? 'transparent' : '#f0f5ff',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                                onClick={() => markAsRead(notif.key)}
                            >
                                <Flex gap={16} align="flex-start">
                                    <Avatar
                                        size={40}
                                        icon={notif.icon}
                                        style={{
                                            background: notif.read ? '#f5f5f5' : '#e6f4ff',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <Flex justify="space-between" align="flex-start">
                                            <Text strong={!notif.read} style={{ fontSize: 14 }}>{notif.title}</Text>
                                            <Flex gap={8} align="center">
                                                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{notif.time}</Text>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={(e) => { e.stopPropagation(); deleteNotif(notif.key); }}
                                                />
                                            </Flex>
                                        </Flex>
                                        <Text type="secondary" style={{ fontSize: 13 }}>{notif.desc}</Text>
                                        {!notif.read && (
                                            <div style={{ marginTop: 4 }}>
                                                <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 11 }}>Mới</Text>} />
                                            </div>
                                        )}
                                    </div>
                                </Flex>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}

export default NotificationsPage;