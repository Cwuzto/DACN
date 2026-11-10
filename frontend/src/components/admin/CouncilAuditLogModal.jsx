import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    Tag,
    List,
    Button,
    Empty,
    Spin,
    Typography,
} from 'antd';
import {
    HistoryOutlined,
    ReloadOutlined,
    ArrowRightOutlined,
    UserOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    UnlockOutlined,
    TeamOutlined,
    UserAddOutlined,
    UserDeleteOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import councilService from '../../services/councilService';

const { Text } = Typography;

const ACTION_CONFIG = {
    CREATE_COUNCIL: {
        label: 'Khởi tạo hội đồng',
        color: 'success',
        icon: <TeamOutlined />,
    },
    UPDATE_COUNCIL: {
        label: 'Cập nhật hội đồng',
        color: 'processing',
        icon: <InfoCircleOutlined />,
    },
    ASSIGN_COUNCIL: {
        label: 'Phân công sinh viên',
        color: 'cyan',
        icon: <UserAddOutlined />,
    },
    AUTO_ASSIGN_COUNCIL: {
        label: 'Phân công tự động',
        color: 'purple',
        icon: <TeamOutlined />,
    },
    AUTO_ASSIGN_OUTLINE_COUNCILS: {
        label: 'Tự động phân công đề cương',
        color: 'purple',
        icon: <TeamOutlined />,
    },
    REMOVE_REGISTRATION_FROM_COUNCIL: {
        label: 'Gỡ sinh viên khỏi HĐ',
        color: 'error',
        icon: <UserDeleteOutlined />,
    },
    REOPEN_COUNCIL_RESULTS: {
        label: 'Mở khóa kết quả',
        color: 'warning',
        icon: <UnlockOutlined />,
    },
    PUBLISH_COUNCIL_SCHEDULE: {
        label: 'Công bố lịch họp',
        color: 'geekblue',
        icon: <CalendarOutlined />,
    },
    PUBLISH_COUNCIL_RESULTS: {
        label: 'Công bố kết quả',
        color: 'success',
        icon: <CheckCircleOutlined />,
    },
    DELETE_COUNCIL: {
        label: 'Xóa hội đồng',
        color: 'error',
        icon: <CloseCircleOutlined />,
    },
};

const ROLE_NAME_MAP = {
    CHAIRMAN: 'Chủ tịch HĐ',
    SECRETARY: 'Thư ký HĐ',
    REVIEWER: 'UV Phản biện',
    MEMBER: 'Ủy viên HĐ',
};

const USER_ROLE_LABEL = {
    ADMIN: 'Quản trị viên',
    QUAN_TRI_VIEN: 'Quản trị viên',
    LECTURER: 'Giảng viên',
    GIANG_VIEN: 'Giảng viên',
    STUDENT: 'Sinh viên',
    SINH_VIEN: 'Sinh viên',
};

const USER_ROLE_COLOR = {
    ADMIN: 'red',
    QUAN_TRI_VIEN: 'red',
    LECTURER: 'blue',
    GIANG_VIEN: 'blue',
    STUDENT: 'green',
    SINH_VIEN: 'green',
};

const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return 'Trống';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        return dayjs(val).format('DD/MM/YYYY HH:mm');
    }
    return String(val);
};

export default function CouncilAuditLogModal({
    open,
    onCancel,
    onClose,
    council,
    logs: initialLogs,
}) {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState(initialLogs || []);

    const handleClose = onCancel || onClose;

    const fetchLogs = useCallback(async () => {
        if (!council?.id) return;
        try {
            setLoading(true);
            const response = await councilService.getCouncilLogs(council.id);
            if (response?.success) {
                setLogs(response.data || []);
            }
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [council?.id]);

    useEffect(() => {
        if (open) {
            if (initialLogs && initialLogs.length > 0) {
                setLogs(initialLogs);
            } else if (council?.id) {
                fetchLogs();
            }
        }
    }, [open, council?.id, initialLogs, fetchLogs]);

    const renderLogDetails = (item) => {
        const details = item?.details || {};
        const action = item?.action;

        const hasSummary = Boolean(details.summary);
        const hasChanges = Array.isArray(details.changes) && details.changes.length > 0;
        const hasMembers = Array.isArray(details.members) && details.members.length > 0;
        const hasStudents = Array.isArray(details.students) && details.students.length > 0;
        const hasStudentRemoval = Boolean(details.studentName);
        const hasReason = Boolean(details.reason);
        const hasSchedule = Boolean(details.defenseDate || details.location || details.meetingMode);

        const isLegacyWithMembersPayload = details.hasMembersPayload !== undefined && !hasChanges && !hasMembers;
        const isLegacyCreate = action === 'CREATE_COUNCIL' && !hasMembers && details.memberCount !== undefined;
        const isLegacyAssign = action === 'ASSIGN_COUNCIL' && !hasStudents && Array.isArray(details.registrationIds);
        const isLegacyRemove = action === 'REMOVE_REGISTRATION_FROM_COUNCIL' && !hasStudentRemoval && details.registrationId !== undefined;

        return (
            <div className="space-y-2 mt-1">
                {/* Dòng tóm tắt chính */}
                {hasSummary && (
                    <div className="text-xs font-semibold text-slate-800">
                        {details.summary}
                    </div>
                )}

                {/* Danh sách thay đổi thuộc tính hoặc vai trò */}
                {hasChanges && (
                    <div className="space-y-1.5 my-2">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Chi tiết các thay đổi:
                        </div>
                        <div className="space-y-1">
                            {details.changes.map((ch, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center flex-wrap gap-1.5 text-xs bg-slate-50 p-2 rounded border border-slate-200"
                                >
                                    <span className="font-semibold text-slate-700 min-w-[130px]">
                                        {ch.label || ch.field}:
                                    </span>
                                    <span className="line-through text-slate-400">
                                        {formatValue(ch.from)}
                                    </span>
                                    <ArrowRightOutlined className="text-blue-500 text-[10px]" />
                                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        {formatValue(ch.to)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Thẻ thành viên hội đồng */}
                {hasMembers && (
                    <div className="my-2">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Thành viên hội đồng ({details.members.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {details.members.map((m, idx) => {
                                const roleLabel = ROLE_NAME_MAP[m.roleInCouncil] || m.roleInCouncil;
                                return (
                                    <div
                                        key={idx}
                                        className="bg-slate-50 p-2 rounded border border-slate-200 text-xs"
                                    >
                                        <span className="font-bold text-teal-800 block text-[11px]">
                                            {roleLabel}
                                        </span>
                                        <span className="text-slate-800 font-medium">
                                            {m.fullName || 'N/A'}{' '}
                                            {m.code ? (
                                                <span className="text-slate-500 font-normal">({m.code})</span>
                                            ) : (
                                                ''
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Danh sách sinh viên được phân công */}
                {hasStudents && (
                    <div className="my-2">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Danh sách sinh viên phân công ({details.students.length}):
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded p-2 bg-slate-50">
                            {details.students.map((st, idx) => (
                                <div
                                    key={idx}
                                    className="text-xs flex items-center justify-between py-1 px-1.5 rounded hover:bg-white border-b border-slate-100 last:border-0"
                                >
                                    <span className="font-medium text-slate-800">
                                        {idx + 1}. {st.studentName}{' '}
                                        {st.studentCode ? (
                                            <span className="text-slate-500">({st.studentCode})</span>
                                        ) : (
                                            ''
                                        )}
                                    </span>
                                    <span
                                        className="text-slate-500 text-[11px] truncate max-w-[320px]"
                                        title={st.topicTitle}
                                    >
                                        {st.topicTitle}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Thông tin sinh viên bị gỡ */}
                {hasStudentRemoval && (
                    <div className="my-2 text-xs bg-rose-50 p-2.5 rounded border border-rose-200 text-rose-900">
                        <span className="font-bold">Sinh viên bị gỡ:</span>{' '}
                        {details.studentName}{' '}
                        {details.studentCode ? `(${details.studentCode})` : ''}
                        {details.topicTitle && (
                            <div className="text-rose-700 mt-0.5">
                                Đề tài: {details.topicTitle}
                            </div>
                        )}
                    </div>
                )}

                {/* Lý do mở khóa */}
                {hasReason && (
                    <div className="my-2 text-xs bg-amber-50 p-2.5 rounded border border-amber-200 text-amber-900">
                        <span className="font-bold">Lý do:</span> {details.reason}
                    </div>
                )}

                {/* Thông tin lịch họp */}
                {hasSchedule && action === 'PUBLISH_COUNCIL_SCHEDULE' && (
                    <div className="my-2 text-xs bg-indigo-50 p-2.5 rounded border border-indigo-200 text-indigo-900 space-y-1">
                        {details.defenseDate && (
                            <div>
                                <span className="font-semibold">Thời gian họp:</span>{' '}
                                {dayjs(details.defenseDate).format('DD/MM/YYYY HH:mm')}
                            </div>
                        )}
                        {details.location && (
                            <div>
                                <span className="font-semibold">Địa điểm:</span> {details.location}
                            </div>
                        )}
                        {details.meetingMode && (
                            <div>
                                <span className="font-semibold">Hình thức:</span>{' '}
                                {details.meetingMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}
                            </div>
                        )}
                    </div>
                )}

                {/* Xử lý tương thích ngược cho dữ liệu log cũ */}
                {isLegacyWithMembersPayload && (
                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        {details.hasMembersPayload
                            ? 'Đã cập nhật danh sách thành viên (Chủ tịch, Thư ký, Ủy viên Phản biện) hoặc thông tin cấu hình của hội đồng.'
                            : 'Đã cập nhật thông tin lịch họp và địa điểm của hội đồng.'}
                    </div>
                )}

                {isLegacyCreate && (
                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        Khởi tạo hội đồng mới với {details.memberCount || 0} giảng viên ủy viên.
                    </div>
                )}

                {isLegacyAssign && (
                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        Đã phân công {details.registrationIds.length} sinh viên vào hội đồng (Mã đăng ký: #{details.registrationIds.join(', #')}).
                    </div>
                )}

                {isLegacyRemove && (
                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        Đã gỡ 1 sinh viên khỏi hội đồng (Mã đăng ký: #{details.registrationId}).
                    </div>
                )}

                {!hasSummary &&
                    !hasChanges &&
                    !hasMembers &&
                    !hasStudents &&
                    !hasStudentRemoval &&
                    !hasReason &&
                    !hasSchedule &&
                    !isLegacyWithMembersPayload &&
                    !isLegacyCreate &&
                    !isLegacyAssign &&
                    !isLegacyRemove && (
                        <div className="text-xs text-slate-400 italic">
                            Thao tác hoàn tất thành công.
                        </div>
                    )}
            </div>
        );
    };

    return (
        <Modal
            title={
                <div className="flex items-center justify-between pr-8">
                    <div className="flex items-center gap-2">
                        <HistoryOutlined className="text-teal-700 text-lg" />
                        <span className="font-bold text-slate-800 text-base">
                            Lịch sử thao tác - {council?.name || 'Hội đồng'}
                        </span>
                    </div>
                </div>
            }
            open={open}
            onCancel={handleClose}
            footer={[
                <Button
                    key="refresh"
                    icon={<ReloadOutlined />}
                    onClick={fetchLogs}
                    loading={loading}
                >
                    Làm mới
                </Button>,
                <Button key="close" type="primary" onClick={handleClose}>
                    Đóng
                </Button>,
            ]}
            width={850}
            destroyOnClose
        >
            <div className="mb-3 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-600">Hội đồng:</span>
                    <span className="font-bold text-slate-900">{council?.name || '---'}</span>
                    <Tag color="cyan">
                        {council?.councilType === 'OUTLINE_REVIEW'
                            ? 'Xét duyệt Đề cương'
                            : 'Chấm Bảo vệ'}
                    </Tag>
                    {council?.semester?.name && (
                        <span className="text-slate-500">
                            • Học kỳ: <strong className="text-slate-700">{council.semester.name}</strong>
                        </span>
                    )}
                </div>
                <div className="text-slate-500 font-medium">
                    Tổng số: <strong className="text-slate-800">{logs.length}</strong> bản ghi
                </div>
            </div>

            <Spin spinning={loading}>
                {logs.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có nhật ký ghi nhận cho hội đồng này."
                        className="py-8"
                    />
                ) : (
                    <List
                        itemLayout="vertical"
                        size="small"
                        dataSource={logs}
                        className="max-h-[60vh] overflow-y-auto pr-1"
                        renderItem={(item) => {
                            const config = ACTION_CONFIG[item.action] || {
                                label: item.action,
                                color: 'default',
                                icon: <InfoCircleOutlined />,
                            };
                            const userRole = item.user?.role || 'N/A';
                            const roleText = USER_ROLE_LABEL[userRole] || userRole;
                            const roleColor = USER_ROLE_COLOR[userRole] || 'default';

                            return (
                                <List.Item
                                    key={item.id || item.createdAt}
                                    className="!py-3 !px-3 border border-slate-200 rounded-lg mb-2.5 hover:border-slate-300 transition-colors bg-white shadow-xs"
                                >
                                    {/* Header của từng bản ghi */}
                                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Tag
                                                color={config.color}
                                                icon={config.icon}
                                                className="font-bold text-xs px-2.5 py-0.5 rounded-sm m-0"
                                            >
                                                {config.label}
                                            </Tag>
                                        </div>
                                        <div className="text-slate-400 text-xs font-mono flex items-center gap-1">
                                            <CalendarOutlined className="text-[11px]" />
                                            {item.createdAt
                                                ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm:ss')
                                                : '---'}
                                        </div>
                                    </div>

                                    {/* Thông tin người thực hiện */}
                                    <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                                        <UserOutlined className="text-slate-400 text-[11px]" />
                                        <span className="font-medium text-slate-800">
                                            {item.user?.fullName || 'Hệ thống'}
                                        </span>
                                        {item.user?.code && (
                                            <span className="text-slate-500 font-mono">
                                                ({item.user.code})
                                            </span>
                                        )}
                                        <Tag
                                            color={roleColor}
                                            className="text-[10px] leading-tight px-1.5 py-0 m-0"
                                        >
                                            {roleText}
                                        </Tag>
                                    </div>

                                    {/* Khối chi tiết đã được format tự nhiên */}
                                    {renderLogDetails(item)}
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Spin>
        </Modal>
    );
}
