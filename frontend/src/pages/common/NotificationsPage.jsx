import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Tabs, message } from 'antd';
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
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';

const typeIconMap = {
    SYSTEM: <SettingOutlined className="text-slate-500" />,
    APPROVAL: <InfoCircleOutlined className="text-purple-500" />,
    TASK_REMINDER: <WarningOutlined className="text-orange-500" />,
    REGISTRATION: <TeamOutlined className="text-teal-500" />,
    SUBMISSION: <FileTextOutlined className="text-blue-500" />,
    DEFENSE: <FileTextOutlined className="text-blue-500" />,
};

function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await notificationService.getMyNotifications();
            if (response.success) setNotifications(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải thông báo');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchNotifications();
        }, 30000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchNotifications();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [fetchNotifications]);

    const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

    const markAsRead = async (id) => {
        const target = notifications.find((item) => item.id === id);
        if (!target || target.isRead) return;

        try {
            await notificationService.markRead(id);
            setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
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
        <div className="py-2">
            <PageHeader
                title="Thông báo"
                subtitle={`${unreadCount} thông báo chưa đọc`}
                actions={
                    <Button icon={<CheckOutlined />} onClick={markAllRead} disabled={unreadCount === 0}>
                        Đánh dấu tất cả đã đọc
                    </Button>
                }
            />

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Tabs
                    items={tabItems}
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="px-6 pt-4"
                    tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid #f1f5f9' }}
                />

                <div className="divide-y divide-slate-100 min-h-[400px]">
                    {!loading && filteredNotifications.length === 0 ? (
                        <div className="py-12">
                            <EmptyState
                                icon={<BellOutlined />}
                                title="Không có thông báo"
                                description="Bạn hiện không có thông báo nào trong mục này."
                            />
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-5 cursor-pointer transition-colors hover:bg-slate-50 flex gap-4 ${
                                    notification.isRead ? 'bg-white' : 'bg-blue-50/30'
                                }`}
                                onClick={() => markAsRead(notification.id)}
                            >
                                <Avatar
                                    size={44}
                                    icon={typeIconMap[notification.type] || <InfoCircleOutlined />}
                                    className={`shrink-0 ${
                                        notification.isRead ? 'bg-slate-100' : 'bg-white shadow-sm border border-blue-100'
                                    }`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-4 mb-1">
                                        <h4 className={`text-sm m-0 ${notification.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                                            {notification.title}
                                        </h4>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-slate-500 font-medium">
                                                {dayjs(notification.createdAt).format('HH:mm DD/MM/YYYY')}
                                            </span>
                                            <Button
                                                type="text"
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="opacity-50 hover:opacity-100"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 truncate mb-0">
                                        {notification.content}
                                    </p>
                                    {!notification.isRead && (
                                        <div className="mt-2">
                                            <Badge status="processing" text={<span className="text-xs text-primary font-medium">Mới</span>} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default NotificationsPage;
