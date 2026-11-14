import React, { useState } from 'react';
import { Table, Button, Tag, Space, Drawer, Input, message } from 'antd';
import { HistoryOutlined, CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import registrationService from '../../services/registrationService';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import StatusBadge from '../../components/common/StatusBadge';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrations } from '../../queries/registrationQueries';
import QueryPanel from '../../components/common/QueryPanel';

export default function AdminTopicApprovalPage() {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);
    const registrationsQuery = useRegistrations(scope);

    const registrations = registrationsQuery.data || [];
    const loading = registrationsQuery.isPending && registrationsQuery.fetchStatus !== 'idle';
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);

    const fetchData = () => registrationsQuery.refetch();

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
            title: 'Tiến trình',
            key: 'timeline',
            render: (_, record) => (
                <Button
                    size="small"
                    icon={<HistoryOutlined />}
                    onClick={() => {
                        setSelectedRegistration(record);
                        setTimelineOpen(true);
                    }}
                >
                    Lịch sử
                </Button>
            ),
        },
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Quản lý Đăng ký & Phê duyệt</h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Theo dõi danh sách sinh viên đăng ký đề tài và lịch sử thay đổi trạng thái
                    </p>
                </div>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                    Làm mới
                </Button>
            </div>

            <QueryPanel query={registrationsQuery} empty={registrations.length === 0} emptyDescription="Không có hồ sơ đăng ký đề tài nào.">
                <Table
                    columns={columns}
                    dataSource={registrations}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                />
            </QueryPanel>

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
