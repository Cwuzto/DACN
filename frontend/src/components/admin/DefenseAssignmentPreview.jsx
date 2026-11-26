import { useState, useMemo } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    Descriptions,
    Divider,
    Input,
    List,
    Space,
    Table,
    Tag,
    Tooltip,
    message,
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    EnvironmentOutlined,
    ExclamationCircleOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    TeamOutlined,
    UserOutlined,
    CheckOutlined,
    DownOutlined,
    UpOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { useConfirmDefenseAssignmentMutation } from '../../queries/councilQueries';

export default function DefenseAssignmentPreview({
    previewData,
    semesterId,
    onConfirmSuccess,
    onRegeneratePreview,
    loading = false,
    userRole: propUserRole,
}) {
    const authUser = useAuthStore((state) => state.user);
    const currentUserRole = propUserRole || authUser?.role;
    const isAdmin = currentUserRole === 'ADMIN';
    const isGiaoVu = currentUserRole === 'GIAO_VU';

    const [confirmError, setConfirmError] = useState(null);
    const [is409Conflict, setIs409Conflict] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedCouncils, setExpandedCouncils] = useState(new Set([0])); // expand first council by default
    const [customRooms, setCustomRooms] = useState({});

    const confirmMutation = useConfirmDefenseAssignmentMutation(['councils'], semesterId);

    const status = previewData?.status || 'FEASIBLE';
    const isFeasible = status === 'FEASIBLE';
    const isSearchLimit = status === 'SEARCH_LIMIT';
    const isInfeasible = status === 'INFEASIBLE';

    const councils = useMemo(() => {
        if (!previewData?.councils) return [];
        return previewData.councils.map((c, idx) => ({
            ...c,
            location: customRooms[idx] !== undefined ? customRooms[idx] : (c.location || c.room || ''),
        }));
    }, [previewData?.councils, customRooms]);

    const coverage = previewData?.coverage || {};
    const totalEligible = coverage.totalEligible ?? councils.reduce((acc, c) => acc + (c.studentCount || c.students?.length || 0), 0);
    const assigned = coverage.assigned ?? councils.reduce((acc, c) => acc + (c.studentCount || c.students?.length || 0), 0);
    const coveragePercentage = coverage.coverageRate !== undefined
        ? (typeof coverage.coverageRate === 'number'
            ? Math.round(coverage.coverageRate <= 1 ? coverage.coverageRate * 100 : coverage.coverageRate)
            : coverage.coverageRate)
        : (totalEligible > 0 ? Math.round((assigned / totalEligible) * 100) : 100);

    const defenseDate = previewData?.date || councils[0]?.defenseDate || councils[0]?.date || 'Chưa cấu hình';
    const usedRooms = Array.from(new Set(councils.map((c) => c.location).filter(Boolean))).join(', ') || 'Chưa gán phòng';

    const toggleExpandCouncil = (idx) => {
        setExpandedCouncils((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const handleRoomChange = (idx, newRoom) => {
        setCustomRooms((prev) => ({
            ...prev,
            [idx]: newRoom,
        }));
    };

    const handleConfirm = async () => {
        if (!isFeasible) {
            return message.warning('Phương án phân công không khả thi, không thể xác nhận.');
        }
        if (!isAdmin) {
            return message.error('Chỉ tài khoản Quản trị viên (Admin) mới có quyền xác nhận phân công.');
        }

        try {
            setSubmitting(true);
            setConfirmError(null);
            setIs409Conflict(false);

            const payload = {
                semesterId: Number(semesterId),
                fingerprint: previewData.fingerprint,
                councils: councils.map((c) => ({
                    ...c,
                    room: c.location,
                })),
            };

            const result = await confirmMutation.mutateAsync(payload);
            message.success('Xác nhận phân công hội đồng bảo vệ thành công!');
            if (onConfirmSuccess) {
                onConfirmSuccess(result);
            }
        } catch (err) {
            const statusCode = err?.status || err?.response?.status || err?.statusCode;
            const errorMsg = err?.message || err?.response?.data?.message || 'Lỗi khi xác nhận phân công hội đồng';

            if (statusCode === 409 || err?.code === 'STALE_PREVIEW' || err?.code === 'FINGERPRINT_MISMATCH') {
                setIs409Conflict(true);
                setConfirmError('Dữ liệu nguồn đã thay đổi hoặc phương án đã hết hiệu lực (Conflict 409). Vui lòng tạo lại bản xem trước mới.');
            } else {
                setConfirmError(errorMsg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const renderStatusBadge = () => {
        if (isFeasible) {
            return (
                <Tag color="success" icon={<CheckCircleOutlined />} className="px-3 py-1 text-sm font-bold">
                    Khả thi (FEASIBLE)
                </Tag>
            );
        }
        if (isSearchLimit) {
            return (
                <Tag color="warning" icon={<ExclamationCircleOutlined />} className="px-3 py-1 text-sm font-bold">
                    Giới hạn tìm kiếm (SEARCH_LIMIT)
                </Tag>
            );
        }
        return (
            <Tag color="error" icon={<CloseCircleOutlined />} className="px-3 py-1 text-sm font-bold">
                Không khả thi (INFEASIBLE)
            </Tag>
        );
    };

    const studentColumns = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center',
            render: (_, __, i) => <span className="font-bold text-slate-600">{i + 1}</span>,
        },
        {
            title: 'MSSV',
            key: 'studentCode',
            width: 110,
            render: (_, record) => (
                <span className="font-mono font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {record.studentCode || record.student?.code || record.student?.studentCode || 'N/A'}
                </span>
            ),
        },
        {
            title: 'Họ và tên',
            key: 'studentName',
            width: 170,
            render: (_, record) => (
                <span className="font-bold text-slate-900">
                    {record.studentName || record.student?.fullName || 'N/A'}
                </span>
            ),
        },
        {
            title: 'Tên đề tài',
            key: 'topicTitle',
            render: (_, record) => (
                <div>
                    <span className="font-medium text-slate-800">
                        {record.topicTitle || record.topic?.title || 'Chưa có tên đề tài'}
                    </span>
                    {record.acceptedExpertise && record.acceptedExpertise.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {record.acceptedExpertise.map((exp, idx) => (
                                <Tag key={idx} color="geekblue" className="text-[11px] m-0">
                                    {exp}
                                </Tag>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'GVHD',
            key: 'mentor',
            width: 150,
            render: (_, record) => (
                <span className="text-slate-700 text-xs">
                    {record.mentorName || record.topic?.mentor?.fullName || record.mentorId ? `GV #${record.mentorId}` : '—'}
                </span>
            ),
        },
        {
            title: 'Khớp chuyên môn / Phân công',
            key: 'expertiseMatch',
            width: 220,
            render: (_, record) => {
                const matched = record.matchedExpertise || [];
                const role = record.matchedRole;
                return (
                    <div className="space-y-1">
                        {matched.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                                <Tag color="green" icon={<CheckOutlined />} className="text-xs font-semibold m-0">
                                    Khớp: {matched.join(', ')}
                                </Tag>
                                {role && (
                                    <Tag color="cyan" className="text-[10px] m-0">
                                        với {role === 'REVIEWER' ? 'Phản biện' : role === 'CHAIRMAN' ? 'Chủ tịch' : 'Thư ký'}
                                    </Tag>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs text-slate-500 italic">Tiêu chuẩn chung</span>
                        )}
                        {record.explanation && (
                            <p className="text-[11px] text-slate-500 m-0 leading-tight">
                                {record.explanation}
                            </p>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header Metrics & Status Banner */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900 m-0">
                                Bản xem trước phương án phân công hội đồng
                            </h3>
                            {renderStatusBadge()}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 m-0">
                            Phương án được tính toán tự động dựa trên ràng buộc chuyên môn, phòng học và không xung đột giảng viên hướng dẫn.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {onRegeneratePreview && (
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={onRegeneratePreview}
                                loading={loading}
                            >
                                Tạo lại xem trước
                            </Button>
                        )}
                        {isAdmin && isFeasible && (
                            <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={handleConfirm}
                                loading={submitting || loading}
                                className="bg-teal-700 hover:bg-teal-800"
                            >
                                Xác nhận phân công hội đồng
                            </Button>
                        )}
                    </div>
                </div>

                {/* Conflict Alert (409) */}
                {is409Conflict && (
                    <Alert
                        type="error"
                        showIcon
                        title="Dữ liệu nguồn đã thay đổi (Xung đột 409)"
                        description={
                            <div className="space-y-2">
                                <p className="m-0 text-xs">
                                    {confirmError || 'Dữ liệu sinh viên, giảng viên hoặc phòng bảo vệ đã bị thay đổi kể từ khi tạo bản xem trước. Bạn cần làm mới lại phương án xem trước trước khi xác nhận.'}
                                </p>
                                {onRegeneratePreview && (
                                    <Button
                                        size="small"
                                        type="primary"
                                        danger
                                        icon={<ReloadOutlined />}
                                        onClick={onRegeneratePreview}
                                    >
                                        Tạo lại xem trước
                                    </Button>
                                )}
                            </div>
                        }
                    />
                )}

                {/* General Error Alert */}
                {!is409Conflict && confirmError && (
                    <Alert
                        type="error"
                        showIcon
                        title="Không thể xác nhận phân công"
                        description={confirmError}
                    />
                )}

                {/* Read-only notification for GIAO_VU */}
                {isGiaoVu && (
                    <Alert
                        type="info"
                        showIcon
                        title="Chế độ xem dành cho Giáo vụ"
                        description="Tài khoản Giáo vụ chỉ có quyền xem bản xem trước phương án phân công. Chỉ tài khoản Quản trị viên (Admin) mới có quyền xác nhận và ghi dữ liệu vào hệ thống."
                    />
                )}

                {/* Key Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Đủ điều kiện
                        </span>
                        <strong className="text-xl font-mono text-slate-900 block mt-0.5">
                            {totalEligible} SV
                        </strong>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Đã xếp vào HĐ
                        </span>
                        <strong className="text-xl font-mono text-teal-800 block mt-0.5">
                            {assigned} SV
                        </strong>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Tỷ lệ phủ
                        </span>
                        <strong className="text-xl font-mono text-emerald-700 block mt-0.5">
                            {coveragePercentage}%
                        </strong>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Ngày bảo vệ
                        </span>
                        <strong className="text-sm font-semibold text-slate-800 block mt-1 truncate">
                            {defenseDate}
                        </strong>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Phòng sử dụng
                        </span>
                        <strong className="text-sm font-semibold text-slate-800 block mt-1 truncate" title={usedRooms}>
                            {usedRooms}
                        </strong>
                    </div>
                </div>
            </div>

            {/* Infeasible or Search Limit Reasons Alert */}
            {(isInfeasible || isSearchLimit) && (
                <Alert
                    type={isInfeasible ? 'error' : 'warning'}
                    showIcon
                    title={
                        <span className="font-bold text-sm">
                            {isInfeasible ? 'Phương án không khả thi — Không thể xác nhận' : 'Vượt quá giới hạn tìm kiếm — Không thể xác nhận'}
                        </span>
                    }
                    description={
                        <div className="space-y-2 mt-1">
                            <p className="text-xs text-slate-700 m-0">
                                Hệ thống phát hiện các vi phạm ràng buộc sau đây. Vui lòng bổ sung phòng bảo vệ, kiểm tra chuyên môn giảng viên hoặc điều chỉnh quy mô mục tiêu:
                            </p>
                            <List
                                size="small"
                                dataSource={previewData?.reasons || ['Không tìm được phương án thỏa mãn ràng buộc chuyên môn và không xung đột']}
                                renderItem={(reason, idx) => (
                                    <List.Item className="text-xs text-rose-800 py-1 border-0">
                                        <ExclamationCircleOutlined className="mr-2 text-rose-600" />
                                        <span>{reason}</span>
                                    </List.Item>
                                )}
                            />
                        </div>
                    }
                />
            )}

            {/* Explanations Banner */}
            {previewData?.explanations && previewData.explanations.length > 0 && (
                <Alert
                    type="info"
                    showIcon
                    title={<span className="font-bold text-xs">Tóm tắt phân bổ phương án</span>}
                    description={
                        <ul className="text-xs text-slate-600 m-0 pl-4 list-disc space-y-0.5 mt-1">
                            {previewData.explanations.map((exp, i) => (
                                <li key={i}>{exp}</li>
                            ))}
                        </ul>
                    }
                />
            )}

            {/* Proposed Councils List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-slate-900 m-0">
                        Danh sách hội đồng đề xuất ({councils.length} hội đồng)
                    </h4>
                </div>

                {councils.map((council, idx) => {
                    const isExpanded = expandedCouncils.has(idx);
                    const chairman = council.members?.find((m) => m.role === 'CHAIRMAN');
                    const secretary = council.members?.find((m) => m.role === 'SECRETARY');
                    const reviewer = council.members?.find((m) => m.role === 'REVIEWER');

                    const morningStudents = council.morningShift?.students || [];
                    const afternoonStudents = council.afternoonShift?.students || [];
                    const totalCouncilStudents = council.studentCount || (morningStudents.length + afternoonStudents.length);

                    return (
                        <Card
                            key={idx}
                            className="border border-slate-300 shadow-sm rounded-xl overflow-hidden"
                            title={
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-teal-950 text-base">
                                            {council.name || `Hội đồng ${idx + 1}`}
                                        </span>
                                        <Tag color="purple" className="font-bold text-xs border border-purple-300">
                                            {totalCouncilStudents} sinh viên
                                        </Tag>
                                        {council.isFixed && (
                                            <Tag color="default" className="text-xs">
                                                Cố định
                                            </Tag>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                            <EnvironmentOutlined />
                                            <span>Phòng:</span>
                                            {isAdmin ? (
                                                <Input
                                                    size="small"
                                                    value={council.location}
                                                    onChange={(e) => handleRoomChange(idx, e.target.value)}
                                                    placeholder="Nhập phòng"
                                                    className="w-24 text-xs font-semibold"
                                                />
                                            ) : (
                                                <span className="font-bold text-slate-800">{council.location || 'N/A'}</span>
                                            )}
                                        </div>

                                        <Button
                                            size="small"
                                            type="dashed"
                                            icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                            onClick={() => toggleExpandCouncil(idx)}
                                            className="text-xs"
                                        >
                                            {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                        </Button>
                                    </div>
                                </div>
                            }
                        >
                            {/* Council Members Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                                {/* Chairman */}
                                <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider block">
                                        1. Chủ tịch Hội đồng
                                    </span>
                                    <strong className="text-xs font-bold text-teal-950 block mt-0.5">
                                        {chairman?.fullName || chairman?.lecturer?.fullName || 'Chưa gán'}
                                    </strong>
                                    {chairman?.expertiseAreas && chairman.expertiseAreas.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {chairman.expertiseAreas.map((exp, i) => (
                                                <Tag key={i} color="teal" className="text-[10px] m-0">
                                                    {exp}
                                                </Tag>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Secretary */}
                                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                                        2. Thư ký Hội đồng
                                    </span>
                                    <strong className="text-xs font-bold text-blue-950 block mt-0.5">
                                        {secretary?.fullName || secretary?.lecturer?.fullName || 'Chưa gán'}
                                    </strong>
                                    {secretary?.expertiseAreas && secretary.expertiseAreas.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {secretary.expertiseAreas.map((exp, i) => (
                                                <Tag key={i} color="blue" className="text-[10px] m-0">
                                                    {exp}
                                                </Tag>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Reviewer */}
                                <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
                                        3. UV Phản biện (Khớp chuyên môn)
                                    </span>
                                    <strong className="text-xs font-bold text-purple-950 block mt-0.5">
                                        {reviewer?.fullName || reviewer?.lecturer?.fullName || 'Chưa gán'}
                                    </strong>
                                    {reviewer?.expertiseAreas && reviewer.expertiseAreas.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {reviewer.expertiseAreas.map((exp, i) => (
                                                <Tag key={i} color="purple" className="text-[10px] m-0">
                                                    {exp}
                                                </Tag>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Shifts & Student Tables */}
                            {isExpanded && (
                                <div className="space-y-4 pt-3">
                                    {/* Morning Shift */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-amber-50/80 px-3 py-1.5 rounded-lg border border-amber-200">
                                            <div className="flex items-center gap-2">
                                                <ClockCircleOutlined className="text-amber-700" />
                                                <span className="font-bold text-xs text-amber-950">
                                                    Ca Sáng (07:00 – 11:00)
                                                </span>
                                            </div>
                                            <Tag color="gold" className="font-mono font-bold text-xs">
                                                {morningStudents.length} sinh viên
                                            </Tag>
                                        </div>

                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={morningStudents}
                                            rowKey={(r) => r.id || r.registrationId || r.studentId}
                                            columns={studentColumns}
                                            className="border border-slate-200 rounded-lg overflow-hidden"
                                        />
                                    </div>

                                    {/* Afternoon Shift */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-sky-50/80 px-3 py-1.5 rounded-lg border border-sky-200">
                                            <div className="flex items-center gap-2">
                                                <ClockCircleOutlined className="text-sky-700" />
                                                <span className="font-bold text-xs text-sky-950">
                                                    Ca Chiều (13:00 – 17:00)
                                                </span>
                                            </div>
                                            <Tag color="cyan" className="font-mono font-bold text-xs">
                                                {afternoonStudents.length} sinh viên
                                            </Tag>
                                        </div>

                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={afternoonStudents}
                                            rowKey={(r) => r.id || r.registrationId || r.studentId}
                                            columns={studentColumns}
                                            className="border border-slate-200 rounded-lg overflow-hidden"
                                        />
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
