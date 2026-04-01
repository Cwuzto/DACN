import { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, Empty, Flex, Space, Tabs, Typography, message } from 'antd';
import {
    BellOutlined,
    CheckOutlined,
    DeleteOutlined,
    FileTextOutlined,
    InfoCircleOutlined,
    SettingOutlined,
    TeamOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import notificationService from '../../services/notificationService';

const { Title, Text } = Typography;

const typeIconMap = {
    SYSTEM: <SettingOutlined style={{ color: '#8c8c8c' }} />,
    APPROVAL: <InfoCircleOutlined style={{ color: '#722ed1' }} />,
    TASK_REMINDER: <WarningOutlined style={{ color: '#fa8c16' }} />,
    REGISTRATION: <TeamOutlined style={{ color: '#13C2C2' }} />,
    SUBMISSION: <FileTextOutlined style={{ color: '#1677FF' }} />,
    DEFENSE: <FileTextOutlined style={{ color: '#1677FF' }} />,
};

function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await notificationService.getMyNotifications();
            if (response.success) setNotifications(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải thông báo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.isRead).length,
        [notifications]
    );

    const markAsRead = async (id) => {
        const target = notifications.find((item) => item.id === id);
        if (!target || target.isRead) return;
        try {
            await notificationService.markRead(id);
            setNotifications((prev) =>
                prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
            );
        } catch (error) {
            message.error(error?.message || 'Không thể đánh dấu đã đọc');
        }
    };

    const markAllRead = async () => {
        try {
            await notificationService.markAllRead();
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            message.success('Đã đánh dấu tất cả thông báo là đã đọc');
        } catch (error) {
            message.error(error?.message || 'Không thể đánh dấu tất cả đã đọc');
        }
    };

    const deleteNotification = async (id) => {
        try {
            await notificationService.deleteNotification(id);
            setNotifications((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            message.error(error?.message || 'Không thể xóa thông báo');
        }
    };

    const filteredNotifications = useMemo(() => {
        if (activeTab === 'unread') return notifications.filter((item) => !item.isRead);
        if (activeTab === 'read') return notifications.filter((item) => item.isRead);
        return notifications;
    }, [activeTab, notifications]);

    const tabItems = [
        {
            key: 'all',
            label: <Badge count={notifications.length} size="small" offset={[10, 0]}>Tất cả</Badge>,
        },
        {
            key: 'unread',
            label: <Badge count={unreadCount} size="small" offset={[10, 0]}>Chưa đọc</Badge>,
        },
        {
            key: 'read',
            label: 'Đã đọc',
        },
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
                    <Button icon={<CheckOutlined />} onClick={markAllRead}>
                        Đánh dấu tất cả đã đọc
                    </Button>
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
                    {!loading && filteredNotifications.length === 0 ? (
                        <Empty description="Không có thông báo" style={{ padding: '40px 0' }} />
                    ) : (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: notification.isRead ? 'transparent' : '#f0f5ff',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                                onClick={() => markAsRead(notification.id)}
                            >
                                <Flex gap={16} align="flex-start">
                                    <Avatar
                                        size={40}
                                        icon={typeIconMap[notification.type] || <InfoCircleOutlined />}
                                        style={{
                                            background: notification.isRead ? '#f5f5f5' : '#e6f4ff',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <Flex justify="space-between" align="flex-start">
                                            <Text strong={!notification.isRead} style={{ fontSize: 14 }}>
                                                {notification.title}
                                            </Text>
                                            <Flex gap={8} align="center">
                                                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {dayjs(notification.createdAt).format('HH:mm DD/MM/YYYY')}
                                                </Text>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteNotification(notification.id);
                                                    }}
                                                />
                                            </Flex>
                                        </Flex>
                                        <Text type="secondary" style={{ fontSize: 13 }}>
                                            {notification.content}
                                        </Text>
                                        {!notification.isRead && (
                                            <div style={{ marginTop: 4 }}>
                                                <Badge
                                                    status="processing"
                                                    text={<Text type="secondary" style={{ fontSize: 11 }}>Moi</Text>}
                                                />
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


