import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Input,
    Modal,
    Table,
    Tag,
    message,
    Space,
    Tooltip,
} from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    ReloadOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import registrationService from '../../services/registrationService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

const { TextArea } = Input;

function TopicApprovalPage() {
    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const registrationRes = await registrationService.getAllRegistrations({ status: 'PENDING' });
            if (registrationRes.success) {
                setPendingRegistrations(registrationRes.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách chờ duyệt');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredRegistrations = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return pendingRegistrations;
        return pendingRegistrations.filter((record) => {
            const studentName = record.student?.fullName?.toLowerCase() || '';
            const studentCode = record.student?.code?.toLowerCase() || '';
            const topicTitle = record.topic?.title?.toLowerCase() || '';
            return studentName.includes(keyword) || studentCode.includes(keyword) || topicTitle.includes(keyword);
        });
    }, [pendingRegistrations, searchText]);

    const handleApproveRegistration = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt sinh viên vào đề tài',
            content: `Bạn có chắc chắn muốn duyệt sinh viên "${record.student?.fullName || ''}" vào đề tài "${record.topic?.title || ''}"?`,
            okText: 'Xác nhận duyệt',
            cancelText: 'Hủy',
            okButtonProps: { className: 'bg-emerald-600 hover:bg-emerald-700 font-bold' },
            onOk: async () => {
                try {
                    const res = await registrationService.handleRegistration(record.id, 'APPROVE');
                    if (res.success) {
                        message.success('Đã duyệt sinh viên vào đề tài thành công');
                        fetchData();
                    }
                } catch (error) {
                    message.error(error?.message || 'Không thể duyệt đăng ký');
                }
            },
        });
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            return message.warning('Vui lòng nhập lý do từ chối để phản hồi sinh viên');
        }

        try {
            setSubmitting(true);
            const res = await registrationService.handleRegistration(
                rejectingRecord.id,
                'REJECT',
                rejectReason.trim(),
            );

            if (res?.success) {
                message.success('Đã từ chối đăng ký đề tài');
                setRejectModalOpen(false);
                setRejectReason('');
                setRejectingRecord(null);
                fetchData();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đăng ký');
        } finally {
            setSubmitting(false);
        }
    };

    const registrationColumns = [
        {
            title: 'Sinh viên đăng ký',
            key: 'student',
            width: 250,
            render: (_, record) => {
                const initials = record.student?.fullName
                    ? record.student.fullName.trim().split(' ').slice(-1)[0][0]?.toUpperCase()
                    : 'S';
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-slate-900 leading-snug truncate">
                                {record.student?.fullName || 'Sinh viên'}
                            </div>
                            <code className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                {record.student?.code || 'N/A'}
                            </code>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Đề tài đăng ký',
            key: 'topic',
            render: (_, record) => (
                <div className="space-y-1">
                    <div className="font-semibold text-slate-800 text-sm leading-snug">
                        {record.topic?.title || 'Chưa rõ đề tài'}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                        Mã: DT-{String(record.topic?.id || '').padStart(3, '0')}
                    </span>
                </div>
            ),
        },
        {
            title: 'Thời gian đăng ký',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (text) => (
                <div className="text-xs text-slate-600 space-y-0.5">
                    <div className="font-medium">{dayjs(text).format('DD/MM/YYYY')}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{dayjs(text).format('HH:mm')}</div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 130,
            align: 'center',
            render: () => (
                <Tag color="orange" className="font-semibold text-xs m-0">
                    Chờ GV duyệt
                </Tag>
            ),
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 170,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-xs font-semibold"
                        onClick={() => handleApproveRegistration(record)}
                    >
                        Duyệt
                    </Button>
                    <Button
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                        className="text-xs font-semibold"
                        onClick={() => {
                            setRejectingRecord(record);
                            setRejectReason('');
                            setRejectModalOpen(true);
                        }}
                    >
                        Từ chối
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Giảng viên' },
                    { label: 'Hướng dẫn & Đề tài' },
                    { label: 'Phê duyệt sinh viên' },
                ]}
                title="Phê duyệt Đăng ký Đề tài"
                subtitle="Xem xét và quyết định tiếp nhận sinh viên đăng ký vào các đề tài do bạn hướng dẫn."
                tags={[
                    { label: `Chờ duyệt: ${pendingRegistrations.length} hồ sơ`, color: pendingRegistrations.length > 0 ? 'orange' : 'green' },
                ]}
                actions={
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>
                        Làm mới
                    </Button>
                }
            />

            {/* StatCards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                    icon="hourglass_top"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Hồ sơ đang chờ phê duyệt"
                    value={pendingRegistrations.length}
                />
                <StatCard
                    icon="fact_check"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Kết quả tìm kiếm phù hợp"
                    value={filteredRegistrations.length}
                />
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 lg:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Tìm theo tên sinh viên, mã SV hoặc tên đề tài..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        allowClear
                        className="max-w-md w-full"
                    />
                    <span className="text-xs text-slate-500">
                        Hiển thị: <b className="text-slate-800">{filteredRegistrations.length}</b> / {pendingRegistrations.length} hồ sơ
                    </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <Table
                        dataSource={filteredRegistrations}
                        rowKey="id"
                        columns={registrationColumns}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        size="middle"
                        loading={loading}
                        locale={{
                            emptyText: (
                                <div className="py-8 text-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300">verified</span>
                                    <p className="text-sm font-medium">Hiện tại không có đăng ký nào đang chờ duyệt</p>
                                </div>
                            ),
                        }}
                    />
                </div>
            </div>

            {/* Modal Từ chối đăng ký */}
            <Modal
                title={
                    <div className="text-base font-bold text-rose-600 flex items-center gap-2">
                        <CloseOutlined />
                        Từ chối Đăng ký Đề tài
                    </div>
                }
                open={rejectModalOpen}
                onCancel={() => {
                    setRejectModalOpen(false);
                    setRejectReason('');
                    setRejectingRecord(null);
                }}
                onOk={handleReject}
                confirmLoading={submitting}
                okText="Xác nhận từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true, className: 'font-bold' }}
                width={520}
                centered
            >
                <div className="space-y-3 pt-2">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                        <div><b>Sinh viên:</b> {rejectingRecord?.student?.fullName || ''} ({rejectingRecord?.student?.code || ''})</div>
                        <div><b>Đề tài:</b> {rejectingRecord?.topic?.title || ''}</div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                            Lý do từ chối phản hồi cho sinh viên: <span className="text-rose-500">*</span>
                        </label>
                        <TextArea
                            rows={4}
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            placeholder="Nhập lý do cụ thể (VD: Đã đủ sinh viên, đề tài yêu cầu kiến thức nền tảng khác...)"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default TopicApprovalPage;
