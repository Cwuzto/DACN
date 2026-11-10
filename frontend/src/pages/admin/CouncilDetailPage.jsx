import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Avatar,
    Button,
    Card,
    DatePicker,
    Empty,
    Form,
    Input,
    Modal,
    Popconfirm,
    Progress,
    Select,
    Spin,
    Table,
    Tag,
    Tooltip,
    message,
} from 'antd';
import {
    ArrowLeftOutlined,
    EditOutlined,
    TeamOutlined,
    UserAddOutlined,
    UnlockOutlined,
    UserOutlined,
    CalendarOutlined,
    EnvironmentOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import councilService from '../../services/councilService';
import registrationService from '../../services/registrationService';
import userService from '../../services/userService';
import useAuthStore from '../../stores/authStore';

export default function CouncilDetailPage({ forcedCouncilType }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);

    const canManageOutline = (user?.permissions || []).includes('OUTLINE_COUNCIL_MANAGE') || user?.role === 'QUAN_TRI_VIEN';
    const canManageDefense = (user?.permissions || []).includes('DEFENSE_COUNCIL_MANAGE') || user?.role === 'QUAN_TRI_VIEN';

    const [council, setCouncil] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lecturers, setLecturers] = useState([]);
    const [searchText, setSearchText] = useState('');

    // Modals
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);

    const [submitLoading, setSubmitLoading] = useState(false);
    const [councilForm] = Form.useForm();
    const [memberForm] = Form.useForm();

    // Assign Student state
    const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
    const [selectedRegistrationsToAssign, setSelectedRegistrationsToAssign] = useState([]);
    const [loadingUnassigned, setLoadingUnassigned] = useState(false);

    // Reopen state
    const [reopenReason, setReopenReason] = useState('');
    const [reopenLoading, setReopenLoading] = useState(false);
    const [reopenBlockingList, setReopenBlockingList] = useState(null);
    const [reopenError, setReopenError] = useState(null);

    const fetchCouncilDetail = useCallback(async () => {
        try {
            setLoading(true);
            const res = await councilService.getCouncilById(id);
            if (res.success && res.data) {
                setCouncil(res.data);
            } else {
                message.error(res.message || 'Không tìm thấy thông tin hội đồng');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi tải chi tiết hội đồng');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchCouncilDetail();
    }, [fetchCouncilDetail]);

    useEffect(() => {
        const loadLecturers = async () => {
            try {
                const res = await userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 });
                if (res.success) {
                    setLecturers(res.data?.users || res.data || []);
                }
            } catch {
                // Non-blocking
            }
        };
        loadLecturers();
    }, []);

    const effectiveCouncilType = forcedCouncilType || council?.councilType || 'DEFENSE_COUNCIL';

    const effectiveRegistrations = useMemo(() => {
        if (!council) return [];
        if (council.registrations && council.registrations.length > 0) return council.registrations;
        if (council.outlineRegistrations && council.outlineRegistrations.length > 0) return council.outlineRegistrations;
        if (council.defenseRegistrations && council.defenseRegistrations.length > 0) return council.defenseRegistrations;
        return [];
    }, [council]);

    // Dynamic conflict calculation
    const conflictNames = useMemo(() => {
        if (!council?.members?.length || !effectiveRegistrations?.length) return [];
        const memberIds = new Set((council.members || []).map((m) => m.lecturerId));
        const conflicts = new Set();
        effectiveRegistrations.forEach((reg) => {
            const mentorId = reg.topic?.mentorId;
            if (mentorId && memberIds.has(mentorId)) {
                const m = council.members?.find((mem) => mem.lecturerId === mentorId);
                conflicts.add(m?.lecturer?.fullName || reg.topic?.mentor?.fullName || reg.topic?.lecturer?.fullName || `GV #${mentorId}`);
            }
        });
        return Array.from(conflicts);
    }, [council?.members, effectiveRegistrations]);

    // Lecturers options for select dropdown
    const lecturerOptions = useMemo(
        () => lecturers.map((lec) => ({ label: `${lec.fullName} (${lec.code || 'GV'})`, value: lec.id })),
        [lecturers]
    );

    // Filtered registrations by search text
    const filteredRegistrations = useMemo(() => {
        if (!searchText.trim()) return effectiveRegistrations;
        const lower = searchText.trim().toLowerCase();
        return effectiveRegistrations.filter((reg) => {
            const studentCode = reg.student?.code?.toLowerCase() || '';
            const studentName = reg.student?.fullName?.toLowerCase() || '';
            const topicTitle = (reg.adjustedTitle || reg.topic?.title || '').toLowerCase();
            const mentorName = (reg.topic?.mentor?.fullName || reg.topic?.lecturer?.fullName || '').toLowerCase();
            return (
                studentCode.includes(lower) ||
                studentName.includes(lower) ||
                topicTitle.includes(lower) ||
                mentorName.includes(lower)
            );
        });
    }, [effectiveRegistrations, searchText]);

    // Unassigned options for assign modal
    const unassignedOptions = useMemo(() => {
        return unassignedRegistrations
            .filter((reg) => {
                if (effectiveCouncilType === 'OUTLINE_REVIEW') {
                    return !reg.outlineCouncilId;
                }
                return !reg.defenseCouncilId && !reg.councilId;
            })
            .map((reg) => ({
                value: reg.id,
                label: `${reg.student?.fullName || 'N/A'} - ${reg.student?.code || 'N/A'} (${reg.status})`,
                desc: (
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                                {reg.student?.fullName || 'N/A'} - {reg.student?.code || 'N/A'}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                {reg.status}
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">
                            {reg.adjustedTitle || reg.topic?.title || 'Không có đề tài'}
                        </span>
                    </div>
                ),
            }));
    }, [unassignedRegistrations, effectiveCouncilType]);

    // Edit Council Handlers
    const openEditModal = () => {
        if (!council) return;
        councilForm.setFieldsValue({
            name: council.name,
            location: council.location,
            defenseDate: council.defenseDate ? dayjs(council.defenseDate) : null,
            meetingMode: council.meetingMode || 'IN_PERSON',
        });
        setIsEditModalVisible(true);
    };

    const handleSaveCouncil = async () => {
        try {
            const values = await councilForm.validateFields();
            setSubmitLoading(true);
            const payload = {
                name: values.name,
                location: values.location,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
                meetingMode: values.meetingMode,
            };
            const res = await councilService.updateCouncil(council.id, payload);
            if (res.success !== false) {
                message.success('Cập nhật thông tin hội đồng thành công');
                setIsEditModalVisible(false);
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Lỗi khi cập nhật hội đồng');
            }
        } catch (err) {
            if (err.message) message.error(err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    // Member Handlers
    const openMemberModal = () => {
        if (!council) return;
        const chairId = council.members?.find((m) => m.roleInCouncil === 'CHAIRMAN')?.lecturerId;
        const secId = council.members?.find((m) => m.roleInCouncil === 'SECRETARY')?.lecturerId;
        const revId = council.members?.find((m) => m.roleInCouncil === 'REVIEWER')?.lecturerId;
        memberForm.setFieldsValue({
            chairman: chairId,
            secretary: secId,
            reviewer: revId,
        });
        setIsMemberModalVisible(true);
    };

    const handleSaveMembers = async () => {
        try {
            const values = await memberForm.validateFields();
            setSubmitLoading(true);
            const members = [
                { lecturerId: values.chairman, roleInCouncil: 'CHAIRMAN' },
                { lecturerId: values.secretary, roleInCouncil: 'SECRETARY' },
                { lecturerId: values.reviewer, roleInCouncil: 'REVIEWER' },
            ];
            const uniqueLecturers = new Set(members.map((m) => m.lecturerId));
            if (uniqueLecturers.size !== 3) {
                message.warning('3 vai trò phải là 3 giảng viên khác nhau.');
                setSubmitLoading(false);
                return;
            }

            const res = await councilService.updateCouncil(council.id, { members });
            if (res.success !== false) {
                message.success('Đã cập nhật thành viên hội đồng');
                if (res?.warnings?.length) {
                    res.warnings.forEach((warning) => message.warning(warning));
                }
                setIsMemberModalVisible(false);
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Lỗi khi cập nhật thành viên');
            }
        } catch (err) {
            if (err.message) message.error(err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    // Assign Registrations Handlers
    const openAssignModal = async () => {
        if (!council) return;
        setSelectedRegistrationsToAssign([]);
        setIsAssignModalVisible(true);
        try {
            setLoadingUnassigned(true);
            const res = await registrationService.getAllRegistrations({
                semesterId: council.semesterId,
                unassignedCouncilOnly: true,
                councilType: council.councilType,
            });
            if (res.success) {
                setUnassignedRegistrations(res.data || []);
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi tải danh sách sinh viên chưa phân công');
        } finally {
            setLoadingUnassigned(false);
        }
    };

    const handleAssignRegistrations = async () => {
        if (!selectedRegistrationsToAssign.length) {
            return message.warning('Vui lòng chọn ít nhất 1 sinh viên');
        }
        try {
            setSubmitLoading(true);
            const res = await councilService.assignRegistrations(council.id, selectedRegistrationsToAssign);
            if (res.success !== false) {
                message.success('Phân công sinh viên thành công');
                setIsAssignModalVisible(false);
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Lỗi khi phân công sinh viên');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi phân công sinh viên');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Remove Registration
    const handleRemoveRegistration = async (registrationId) => {
        try {
            setLoading(true);
            const res = await councilService.removeRegistration(council.id, registrationId);
            if (res.success !== false) {
                message.success('Đã gỡ sinh viên khỏi hội đồng thành công');
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Lỗi khi gỡ sinh viên');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gỡ sinh viên');
        } finally {
            setLoading(false);
        }
    };

    // Reopen Results Handlers (Outline Review)
    const openReopenModal = () => {
        setReopenReason('');
        setReopenBlockingList(null);
        setReopenError(null);
        setIsReopenModalVisible(true);
    };

    const handleConfirmReopen = async () => {
        if (!reopenReason.trim()) {
            return message.warning('Vui lòng nhập lý do mở khóa kết quả.');
        }
        try {
            setReopenLoading(true);
            setReopenBlockingList(null);
            setReopenError(null);
            const res = await councilService.reopenResults(council.id, reopenReason.trim());
            if (res.success !== false) {
                message.success('Đã mở khóa kết quả hội đồng thành công');
                setIsReopenModalVisible(false);
                setReopenReason('');
                await fetchCouncilDetail();
            } else {
                handleReopenFail(res);
            }
        } catch (err) {
            handleReopenFail(err);
        } finally {
            setReopenLoading(false);
        }
    };

    const handleReopenFail = (err) => {
        if (err?.blockingRegistrations) {
            setReopenBlockingList(err.blockingRegistrations);
            setReopenError(err.message || 'Không thể mở khóa do sinh viên đã có đơn BM02 / tiến độ kế tiếp gây chặn.');
        } else {
            setReopenError(err?.message || 'Lỗi khi mở khóa kết quả hội đồng.');
        }
    };

    const renderStatusTag = (status) => {
        const colorMap = {
            APPROVED: 'green',
            PASSED: 'success',
            DEFENSE_READY: 'blue',
            PENDING: 'gold',
            OUTLINE_REVIEWING: 'processing',
            REVISION_REQUIRED: 'orange',
            FAILED: 'error',
            REJECTED: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status || 'Chưa cập nhật'}</Tag>;
    };

    // Member assignments lookup
    const chairman = council?.members?.find((m) => m.roleInCouncil === 'CHAIRMAN');
    const secretary = council?.members?.find((m) => m.roleInCouncil === 'SECRETARY');
    const reviewer = council?.members?.find((m) => m.roleInCouncil === 'REVIEWER');

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_text, _record, index) => <span className="text-slate-500 font-medium">{index + 1}</span>,
        },
        {
            title: 'MSSV',
            dataIndex: ['student', 'code'],
            key: 'studentCode',
            width: 120,
            render: (code) => <span className="font-mono font-bold text-teal-800">{code || 'N/A'}</span>,
        },
        {
            title: 'Họ và tên',
            dataIndex: ['student', 'fullName'],
            key: 'studentName',
            width: 200,
            render: (name) => <span className="font-semibold text-slate-800">{name || 'N/A'}</span>,
        },
        {
            title: 'Tên đề tài',
            key: 'topicTitle',
            render: (_text, reg) => (
                <span className="text-slate-700">
                    {reg.adjustedTitle || reg.topic?.title || 'Không có đề tài'}
                </span>
            ),
        },
        {
            title: 'Giảng viên HD',
            key: 'mentor',
            width: 180,
            render: (_text, reg) => (
                <span className="text-slate-600 font-medium">
                    {reg.topic?.mentor?.fullName || reg.topic?.lecturer?.fullName || 'N/A'}
                </span>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status) => renderStatusTag(status),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 90,
            align: 'center',
            render: (_text, reg) => (
                <Popconfirm
                    title="Gỡ sinh viên khỏi hội đồng?"
                    description="Bạn có chắc muốn gỡ sinh viên này ra khỏi hội đồng không?"
                    onConfirm={() => handleRemoveRegistration(reg.id)}
                    okText="Gỡ"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                >
                    <Button size="small" danger>
                        Gỡ
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    if (loading && !council) {
        return (
            <div className="p-8 flex justify-center items-center min-h-[300px]">
                <Spin size="large" tip="Đang tải thông tin hội đồng..." />
            </div>
        );
    }

    if (!council) {
        return (
            <div className="p-6">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(effectiveCouncilType === 'OUTLINE_REVIEW' ? '/admin/outline-councils' : '/admin/defense-councils')}
                    className="mb-4"
                >
                    ← Quay lại Danh sách HĐ
                </Button>
                <Empty description="Không tìm thấy thông tin hội đồng" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header with Navigation, Title, and Actions */}
            <div className="flex flex-col gap-4">
                <div>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(effectiveCouncilType === 'OUTLINE_REVIEW' ? '/admin/outline-councils' : '/admin/defense-councils')}
                        className="mb-3 hover:border-teal-600 hover:text-teal-700 font-medium"
                    >
                        ← Quay lại Danh sách HĐ
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {council.name}
                            </h1>
                            <Tag color={effectiveCouncilType === 'OUTLINE_REVIEW' ? 'blue' : 'purple'} className="font-semibold">
                                {effectiveCouncilType === 'OUTLINE_REVIEW' ? 'Thẩm định Đề cương' : 'Chấm Bảo vệ'}
                            </Tag>
                            <Tag color={council.members?.length === 3 ? 'success' : 'warning'} className="font-semibold">
                                {council.members?.length === 3 ? '3 Giảng viên (Chuẩn Viện)' : 'Chưa đủ 3 GV'}
                            </Tag>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Học kỳ: <span className="font-semibold text-slate-700">{council.semester?.name || '---'}</span>
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button icon={<EditOutlined />} onClick={openEditModal}>
                            ✏️ Sửa thông tin HĐ
                        </Button>
                        <Button icon={<TeamOutlined />} onClick={openMemberModal}>
                            👥 Đổi thành viên HĐ
                        </Button>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={openAssignModal}
                            className="bg-teal-700 hover:bg-teal-800"
                        >
                            + Gán thêm Sinh viên
                        </Button>
                        {effectiveCouncilType === 'OUTLINE_REVIEW' && (
                            <Button danger icon={<UnlockOutlined />} onClick={openReopenModal}>
                                🔓 Mở khóa kết quả
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2-Column Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Card: Lịch & Địa điểm (1/3) */}
                <Card
                    title={
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                            <CalendarOutlined className="text-teal-700" />
                            <span>Thông tin lịch & địa điểm</span>
                        </div>
                    }
                    className="shadow-sm border border-slate-200 rounded-lg"
                >
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs text-slate-500 block mb-0.5 font-medium">Ngày tổ chức</span>
                            <span className="font-semibold text-slate-800 text-sm">
                                {council.defenseDate ? dayjs(council.defenseDate).format('DD/MM/YYYY') : 'Chưa xếp'}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs text-slate-500 block mb-0.5 font-medium">Hình thức họp</span>
                            <span className="font-semibold text-slate-800 text-sm">
                                {council.meetingMode === 'ONLINE'
                                    ? 'Trực tuyến (Online)'
                                    : council.meetingMode === 'HYBRID'
                                    ? 'Kết hợp (Hybrid)'
                                    : 'Trực tiếp (In-person)'}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs text-slate-500 block mb-0.5 font-medium">Phòng họp / Link</span>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-sm">
                                <EnvironmentOutlined className="text-slate-400" />
                                <span>{council.location || council.meetingUrl || 'Chưa xếp phòng'}</span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-500 font-medium">Quy mô sinh viên</span>
                                <span className="text-xs font-bold text-slate-700">
                                    {effectiveRegistrations.length} / 10 SV
                                </span>
                            </div>
                            <Progress
                                percent={Math.min(100, (effectiveRegistrations.length / 10) * 100)}
                                showInfo={false}
                                strokeColor={effectiveRegistrations.length > 10 ? '#ef4444' : '#0d9488'}
                                size="small"
                            />
                        </div>
                    </div>
                </Card>

                {/* Right Card: Thành phần Hội đồng (2/3) */}
                <Card
                    title={
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                                <TeamOutlined className="text-teal-700" />
                                <span>Thành phần Hội đồng (3 Ủy viên)</span>
                            </div>
                            {conflictNames.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200 font-semibold text-xs">
                                    ⚠️ Có GV {conflictNames.join(', ')} là GVHD của sinh viên HĐ này
                                </span>
                            )}
                        </div>
                    }
                    className="lg:col-span-2 shadow-sm border border-slate-200 rounded-lg"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Chairman */}
                        <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-teal-800 block mb-2 uppercase tracking-wider">
                                    1. Chủ tịch Hội đồng
                                </span>
                                {chairman ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-teal-700 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">
                                                {chairman.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Mã: {chairman.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate" title={chairman.lecturer?.email}>
                                                {chairman.lecturer?.email || '---'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400 italic py-2">
                                        Chưa phân công
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Secretary */}
                        <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-blue-800 block mb-2 uppercase tracking-wider">
                                    2. Thư ký Hội đồng
                                </span>
                                {secretary ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-blue-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">
                                                {secretary.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Mã: {secretary.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate" title={secretary.lecturer?.email}>
                                                {secretary.lecturer?.email || '---'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400 italic py-2">
                                        Chưa phân công
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Reviewer */}
                        <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-indigo-800 block mb-2 uppercase tracking-wider">
                                    3. Ủy viên Phản biện
                                </span>
                                {reviewer ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-indigo-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">
                                                {reviewer.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Mã: {reviewer.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate" title={reviewer.lecturer?.email}>
                                                {reviewer.lecturer?.email || '---'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400 italic py-2">
                                        Chưa phân công
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Student Table Section */}
            <Card
                title={
                    <div className="flex items-center justify-between flex-wrap gap-4 py-1">
                        <span className="font-bold text-slate-800 text-base">
                            Danh sách Sinh viên thuộc Hội đồng ({effectiveRegistrations.length} SV)
                        </span>
                        <Input
                            placeholder="Tìm kiếm theo MSSV, tên SV, đề tài, GVHD..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            style={{ maxWidth: 360 }}
                        />
                    </div>
                }
                className="shadow-sm border border-slate-200 rounded-lg"
            >
                <Table
                    columns={columns}
                    dataSource={filteredRegistrations}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    locale={{ emptyText: 'Chưa có sinh viên nào được phân công vào hội đồng này.' }}
                />
            </Card>

            {/* Modal Sửa thông tin Hội đồng */}
            <Modal
                title="Sửa thông tin Hội đồng"
                open={isEditModalVisible}
                onOk={handleSaveCouncil}
                onCancel={() => setIsEditModalVisible(false)}
                confirmLoading={submitLoading}
                destroyOnClose
            >
                <Form form={councilForm} layout="vertical" className="mt-4">
                    <Form.Item
                        name="name"
                        label="Tên hội đồng"
                        rules={[{ required: true, message: 'Vui lòng nhập tên hội đồng' }]}
                    >
                        <Input placeholder="VD: Hội đồng KTPM - 01" />
                    </Form.Item>
                    <Form.Item name="location" label="Phòng họp / Link meeting">
                        <Input placeholder="VD: P.301 Tòa C hoặc link Google Meet" />
                    </Form.Item>
                    <Form.Item name="defenseDate" label="Ngày tổ chức">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
                    </Form.Item>
                    <Form.Item name="meetingMode" label="Hình thức họp">
                        <Select
                            options={[
                                { label: 'Trực tiếp (In-person)', value: 'IN_PERSON' },
                                { label: 'Trực tuyến (Online)', value: 'ONLINE' },
                                { label: 'Kết hợp (Hybrid)', value: 'HYBRID' },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Đổi thành viên HĐ */}
            <Modal
                title={`Đổi thành viên HĐ - ${council.name}`}
                open={isMemberModalVisible}
                onOk={handleSaveMembers}
                onCancel={() => setIsMemberModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <p className="text-xs text-slate-500 mb-4">
                    Quy chuẩn Viện: Hội đồng gồm đúng 3 giảng viên độc lập (Chủ tịch, Thư ký, Phản biện). Không được trùng lặp.
                </p>
                <Form form={memberForm} layout="vertical">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item
                            name="chairman"
                            label="1. Chủ tịch HĐ"
                            rules={[{ required: true, message: 'Chọn chủ tịch' }]}
                        >
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item
                            name="secretary"
                            label="2. Thư ký HĐ"
                            rules={[{ required: true, message: 'Chọn thư ký' }]}
                        >
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item
                            name="reviewer"
                            label="3. Phản biện HĐ"
                            rules={[{ required: true, message: 'Chọn phản biện' }]}
                        >
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Modal Gán thêm Sinh viên */}
            <Modal
                title={`Gán thêm Sinh viên vào Hội đồng "${council.name}"`}
                open={isAssignModalVisible}
                onOk={handleAssignRegistrations}
                onCancel={() => setIsAssignModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <div className="mb-4">
                    <p className="text-sm text-slate-700 font-medium">
                        Chọn sinh viên để phân công vào hội đồng.
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        (Chỉ hiển thị sinh viên chưa được phân công vào hội đồng loại này trong học kỳ)
                    </p>
                </div>
                <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Chọn sinh viên..."
                    value={selectedRegistrationsToAssign}
                    onChange={setSelectedRegistrationsToAssign}
                    optionLabelProp="label"
                    loading={loadingUnassigned}
                    options={unassignedOptions}
                    optionRender={(option) => option.data.desc}
                />
            </Modal>

            {/* Modal Mở khóa kết quả (Reopen) cho HĐ Đề cương */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-amber-600">
                        <UnlockOutlined />
                        <span>Mở khóa kết quả Hội đồng Đề cương</span>
                    </div>
                }
                open={isReopenModalVisible}
                onCancel={() => {
                    if (!reopenLoading) {
                        setIsReopenModalVisible(false);
                        setReopenBlockingList(null);
                        setReopenError(null);
                    }
                }}
                onOk={handleConfirmReopen}
                okText="Xác nhận mở khóa"
                okButtonProps={{ danger: true, loading: reopenLoading }}
                cancelButtonProps={{ disabled: reopenLoading }}
                destroyOnClose
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-slate-700">
                        Hội đồng: <strong>{council.name}</strong>
                    </p>
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                        ⚠️ Thao tác mở khóa sẽ hủy hiệu lực của bản công bố kết quả hiện tại và chuyển hội đồng về trạng thái Nháp (DRAFT) để Thư ký và Chủ tịch có thể cập nhật kết quả đánh giá.
                    </p>

                    {reopenError && (
                        <Alert
                            type="error"
                            showIcon
                            message="Không thể mở khóa kết quả"
                            description={
                                <div className="mt-1 space-y-2">
                                    <div>{reopenError}</div>
                                    {reopenBlockingList && reopenBlockingList.length > 0 && (
                                        <div>
                                            <div className="font-semibold text-xs text-rose-800 mb-1">
                                                Danh sách sinh viên gây chặn (đã phát sinh đơn BM02 / tiến độ kế tiếp):
                                            </div>
                                            <ul className="list-disc pl-5 text-xs text-rose-700 space-y-1">
                                                {reopenBlockingList.map((item, idx) => (
                                                    <li key={item.registrationId || idx}>
                                                        <strong>{item.studentName}</strong> (Mã ĐK: #{item.registrationId}) - Trạng thái: <Tag color="volcano">{item.bm02Status}</Tag>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            }
                        />
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do mở khóa <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do cần mở khóa kết quả (bắt buộc, ví dụ: Nhập nhầm kết quả đánh giá, Phúc tra theo yêu cầu...)"
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            maxLength={500}
                            showCount
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
