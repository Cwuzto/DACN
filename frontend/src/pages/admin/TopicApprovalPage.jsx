import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Drawer, Input, message } from 'antd';
import { HistoryOutlined, CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import registrationService from '../../services/registrationService';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import StatusBadge from '../../components/common/StatusBadge';

export default function AdminTopicApprovalPage() {
    const [loading, setLoading] = useState(false);
    const [registrations, setRegistrations] = useState([]);
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await registrationService.getAllRegistrations();
            if (res.success && Array.isArray(res.data)) {
                setRegistrations(res.data);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách đăng ký đề tài');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columns = [
        {
            title: 'Mã đề tài',
            dataIndex: ['topic', 'code'],
            key: 'topicCode',
            render: (text, record) => text || `DT-${record.topicId || record.id}`,
        },
        {
            title: 'Tên đề tài',
            dataIndex: ['topic', 'title'],
            key: 'topicTitle',
            render: (text, record) => record.adjustedTitle || text,
        },
        {
            title: 'Sinh viên',
            dataIndex: ['student', 'fullName'],
            key: 'studentName',
            render: (text, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{text}</div>
                    <div className="text-xs text-slate-600 font-mono">MSSV: {record.student?.code}</div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={() => {
                            setSelectedRegistration(record);
                            setTimelineOpen(true);
                        }}
                    >
                        Xem lịch sử
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Phê Duyệt & Quản Lý Đăng Ký Đề Tài</h1>
                    <p className="text-xs text-slate-600 mt-1">
                        Theo dõi tiến trình và thẩm định danh sách đăng ký đề tài của sinh viên.
                    </p>
                </div>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                    Làm mới
                </Button>
            </div>

            <Table
                dataSource={registrations}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
            />

            <RegistrationTimelineDrawer
                open={timelineOpen}
                onClose={() => {
                    setTimelineOpen(false);
                    setSelectedRegistration(null);
                }}
                registrationId={selectedRegistration?.id}
                topicTitle={selectedRegistration?.topic?.title}
                studentName={selectedRegistration?.student?.fullName}
                studentCode={selectedRegistration?.student?.code}
            />
        </div>
    );
}
