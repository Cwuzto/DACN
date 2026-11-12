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
    HistoryOutlined,
    SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import CouncilAuditLogModal from '../../components/admin/CouncilAuditLogModal';
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
    const [isLogModalVisible, setIsLogModalVisible] = useState(false);
    const [councilLogs, setCouncilLogs] = useState([]);

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

    // Adjust schedule modal state
    const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
    const [adjustingReg, setAdjustingReg] = useState(null);
    const [newShift, setNewShift] = useState('MORNING');
    const [newOrderInShift, setNewOrderInShift] = useState(1);
    const [adjustReason, setAdjustReason] = useState('');

    // Schedule adjustment logs modal state
    const [isAdjustmentsModalVisible, setIsAdjustmentsModalVisible] = useState(false);
    const [defenseScheduleAdjustmentLogs, setDefenseScheduleAdjustmentLogs] = useState([]);
    const [loadingAdjustments, setLoadingAdjustments] = useState(false);

    // Replace member modal state
    const [isReplaceMemberModalVisible, setIsReplaceMemberModalVisible] = useState(false);
    const [replacingMember, setReplacingMember] = useState(null);
    const [newLecturerId, setNewLecturerId] = useState(null);
    const [replaceReason, setReplaceReason] = useState('');
    const [confirmLockedSheetOverride, setConfirmLockedSheetOverride] = useState(false);

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
            const mentorId = reg.mentorId || reg.topic?.mentorId;
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

    // Confirm & Publish Defense Schedule
    const handleConfirmAndPublishDefenseSchedule = async () => {
        try {
            setSubmitLoading(true);
            const res = await councilService.confirmAndPublishDefenseSchedule(council.id);
            if (res.success) {
                message.success(res.message || 'Đã công bố lịch bảo vệ chia ca Sáng / Chiều thành công!');
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Không thể công bố lịch bảo vệ');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi công bố lịch bảo vệ chia ca');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Adjust Student Defense Schedule Handlers
    const openAdjustModal = (reg) => {
        setAdjustingReg(reg);
        setNewShift(reg.defenseShift || 'MORNING');
        setNewOrderInShift(reg.orderInShift || 1);
        setAdjustReason('');
        setIsAdjustModalVisible(true);
    };

    const handleAdjustStudentSchedule = async () => {
        if (!adjustingReg) return;
        if (!adjustReason.trim()) {
            message.warning('Bắt buộc nhập lý do điều chỉnh lịch bảo vệ.');
            return;
        }
        try {
            setSubmitLoading(true);
            const res = await councilService.adjustStudentSchedule(council.id, adjustingReg.id, {
                newShift,
                newOrderInShift: Number(newOrderInShift),
                reason: adjustReason.trim(),
            });
            if (res.success) {
                message.success('Đã điều chỉnh ca và thứ tự bảo vệ thành công!');
                setIsAdjustModalVisible(false);
                setAdjustingReg(null);
                setAdjustReason('');
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Không thể điều chỉnh lịch bảo vệ.');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi điều chỉnh lịch bảo vệ');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Replace Council Member Handlers
    const openReplaceMemberModal = (member) => {
        setReplacingMember(member);
        setNewLecturerId(null);
        setReplaceReason('');
        setConfirmLockedSheetOverride(false);
        setIsReplaceMemberModalVisible(true);
    };

    const handleReplaceCouncilMember = async () => {
        if (!replacingMember) return;
        if (!newLecturerId) {
            message.warning('Vui lòng chọn giảng viên thay thế.');
            return;
        }
        if (!replaceReason.trim()) {
            message.warning('Bắt buộc nhập lý do thay thế thành viên.');
            return;
        }
        try {
            setSubmitLoading(true);
            const res = await councilService.replaceCouncilMember(council.id, {
                oldMemberId: replacingMember.id,
                newLecturerId: Number(newLecturerId),
                reason: replaceReason.trim(),
                confirmLockedSheetOverride,
            });
            if (res.success) {
                message.success('Đã thay thế thành viên hội đồng thành công!');
                setIsReplaceMemberModalVisible(false);
                setReplacingMember(null);
                setNewLecturerId(null);
                setReplaceReason('');
                setConfirmLockedSheetOverride(false);
                await fetchCouncilDetail();
            } else {
                message.error(res.message || 'Không thể thay thế thành viên.');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi thay thế thành viên');
        } finally {
            setSubmitLoading(false);
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

    const openLogModal = async () => {
        if (!council?.id) return;
        try {
            setIsLogModalVisible(true);
            const res = await councilService.getCouncilLogs(council.id);
            if (res?.success) {
                setCouncilLogs(res.data || []);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể tải lịch sử thao tác của hội đồng');
        }
    };

    const handleOpenAdjustmentsModal = async () => {
        if (!council?.id) return;
        setIsAdjustmentsModalVisible(true);
        try {
            setLoadingAdjustments(true);
            const res = await councilService.getScheduleAdjustments(council.id);
            if (res?.success) {
                setDefenseScheduleAdjustmentLogs(res.data || []);
            } else {
                setDefenseScheduleAdjustmentLogs([]);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể tải nhật ký đổi ca');
            setDefenseScheduleAdjustmentLogs([]);
        } finally {
            setLoadingAdjustments(false);
        }
    };

    const adjustmentColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 50,
            align: 'center',
            render: (_t, _r, index) => <span className="text-slate-600 font-medium">{index + 1}</span>,
        },
        {
            title: 'Sinh viên',
            key: 'student',
            width: 200,
            render: (_text, item) => (
                <div>
                    <span className="font-bold text-slate-800">
                        {item.registration?.student?.fullName || 'N/A'}
                    </span>
                    <span className="text-slate-500 text-xs ml-1">
                        - {item.registration?.student?.studentCode || item.registration?.student?.code || 'N/A'}
                    </span>
                </div>
            ),
        },
        {
            title: 'Đề tài',
            key: 'topic',
            render: (_text, item) => (
                <span className="text-slate-700 text-xs font-medium">
                    {item.registration?.topic?.title || 'Không có đề tài'}
                </span>
            ),
        },
        {
            title: 'Ca thi & Thứ tự',
            key: 'shifts',
            width: 250,
            render: (_text, item) => (
                <span className="text-xs font-medium text-slate-700">
                    {`Ca cũ: ${item.oldShift || 'Chưa xếp'} (STT: ${item.oldOrderInShift || '-'}) → Ca mới: ${item.newShift} (STT: ${item.newOrderInShift})`}
                </span>
            ),
        },
        {
            title: 'Lý do',
            dataIndex: 'reason',
            key: 'reason',
            render: (reason) => <span className="text-slate-600 text-xs">{reason || '—'}</span>,
        },
        {
            title: 'Người thực hiện',
            key: 'adjustedBy',
            width: 150,
            render: (_text, item) => (
                <span className="text-slate-800 font-medium text-xs">
                    {item.adjustedBy?.fullName || '—'}
                </span>
            ),
        },
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 140,
            render: (createdAt) => (
                <span className="text-slate-500 text-xs">
                    {createdAt ? dayjs(createdAt).format('DD/MM/YYYY HH:mm') : '—'}
                </span>
            ),
        },
    ];

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
            render: (_text, _record, index) => <span className="text-slate-600 font-bold">{index + 1}</span>,
        },
        {
            title: 'MSSV',
            dataIndex: ['student', 'code'],
            key: 'studentCode',
            width: 120,
            render: (code) => <span className="bg-teal-50 border border-teal-300 text-teal-900 font-mono font-bold px-2 py-0.5 rounded">{code || 'N/A'}</span>,
        },
        {
            title: 'Họ và tên',
            dataIndex: ['student', 'fullName'],
            key: 'studentName',
            width: 200,
            render: (name) => <span className="font-bold text-slate-900">{name || 'N/A'}</span>,
        },
        {
            title: 'Tên đề tài',
            key: 'topicTitle',
            render: (_text, reg) => (
                <span className="text-slate-800 font-medium">
                    {reg.adjustedTitle || reg.topic?.title || 'Không có đề tài'}
                </span>
            ),
        },
        {
            title: 'Giảng viên HD',
            key: 'mentor',
            width: 180,
            render: (_text, reg) => (
                <span className="text-slate-700 font-medium">
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
            title: 'Ca & Thứ tự bảo vệ',
            key: 'shift',
            width: 170,
            render: (_text, reg) => {
                const isMorning = reg.defenseShift === 'MORNING';
                const isAfternoon = reg.defenseShift === 'AFTERNOON';
                return (
                    <div className="space-y-1">
                        {isMorning && (
                            <Tag color="cyan" className="font-bold">
                                Ca Sáng (07:00–11:00) #{reg.orderInShift || '--'}
                            </Tag>
                        )}
                        {isAfternoon && (
                            <Tag color="orange" className="font-bold">
                                Ca Chiều (13:00–17:00) #{reg.orderInShift || '--'}
                            </Tag>
                        )}
                        {!isMorning && !isAfternoon && (
                            <span className="text-xs text-slate-400 italic">Chưa xếp ca</span>
                        )}
                        {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                            <div>
                                <Button
                                    size="small"
                                    type="link"
                                    icon={<EditOutlined />}
                                    onClick={() => openAdjustModal(reg)}
                                    className="p-0 text-xs text-teal-700"
                                >
                                    Đổi ca/STT
                                </Button>
                            </div>
                        )}
                    </div>
                );
            },
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
                    Quay lại Danh sách HĐ
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
                        Quay lại Danh sách HĐ
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-300">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {council.name}
                            </h1>
                            <Tag color={effectiveCouncilType === 'OUTLINE_REVIEW' ? 'purple' : 'teal'} className="font-bold border border-slate-300">
                                {effectiveCouncilType === 'OUTLINE_REVIEW' ? 'Thẩm định Đề cương' : 'Chấm Bảo vệ'}
                            </Tag>
                            <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                                council.members?.length === 3 ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
                            }`}>
                                {council.members?.length === 3 ? '3 Giảng viên (Chuẩn Viện)' : 'Chưa đủ 3 GV'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                            Học kỳ: <span className="font-bold text-slate-900">{council.semester?.name || '---'}</span>
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                            <Button
                                type="primary"
                                icon={<CalendarOutlined />}
                                onClick={handleConfirmAndPublishDefenseSchedule}
                                loading={submitLoading}
                                className="bg-emerald-700 hover:bg-emerald-800 font-semibold"
                            >
                                Công bố lịch bảo vệ chia ca
                            </Button>
                        )}
                        {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                            <Button icon={<HistoryOutlined />} onClick={() => handleOpenAdjustmentsModal()}>
                                Nhật ký đổi ca
                            </Button>
                        )}
                        <Button icon={<HistoryOutlined />} onClick={openLogModal}>
                            Lịch sử thao tác
                        </Button>
                        <Button icon={<EditOutlined />} onClick={openEditModal}>
                            Sửa thông tin HĐ
                        </Button>
                        <Button icon={<TeamOutlined />} onClick={openMemberModal}>
                            Đổi thành viên HĐ
                        </Button>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={openAssignModal}
                            className="bg-teal-700 hover:bg-teal-800 font-semibold"
                        >
                            Gán thêm Sinh viên
                        </Button>
                        {effectiveCouncilType === 'OUTLINE_REVIEW' && (
                            <Button danger icon={<UnlockOutlined />} onClick={openReopenModal}>
                                Mở khóa kết quả
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
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                            <CalendarOutlined className="text-teal-700" />
                            <span>Thông tin lịch & địa điểm</span>
                        </div>
                    }
                    className="shadow-sm border border-slate-300 rounded-lg"
                >
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs text-slate-600 block mb-0.5 font-semibold">Ngày tổ chức</span>
                            <span className="font-bold text-slate-900 text-sm">
                                {council.defenseDate ? dayjs(council.defenseDate).format('DD/MM/YYYY') : 'Chưa xếp'}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs text-slate-600 block mb-0.5 font-semibold">Hình thức họp</span>
                            <span className="font-bold text-slate-900 text-sm">
                                {council.meetingMode === 'ONLINE'
                                    ? 'Trực tuyến (Online)'
                                    : council.meetingMode === 'HYBRID'
                                    ? 'Kết hợp (Hybrid)'
                                    : 'Trực tiếp (In-person)'}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs text-slate-600 block mb-0.5 font-semibold">Phòng họp / Link</span>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                                <EnvironmentOutlined className="text-teal-700" />
                                <span>{council.location || council.meetingUrl || 'Chưa xếp phòng'}</span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-600 font-semibold">Quy mô sinh viên</span>
                                <span className="text-xs font-black text-slate-900">
                                    {effectiveRegistrations.length} / {effectiveCouncilType === 'DEFENSE_COUNCIL' ? 22 : 10} SV
                                </span>
                            </div>
                            <Progress
                                percent={Math.min(100, (effectiveRegistrations.length / (effectiveCouncilType === 'DEFENSE_COUNCIL' ? 22 : 10)) * 100)}
                                showInfo={false}
                                strokeColor={effectiveRegistrations.length > (effectiveCouncilType === 'DEFENSE_COUNCIL' ? 22 : 10) ? '#ef4444' : '#0f766e'}
                                size="small"
                            />
                        </div>
                    </div>
                </Card>

                {/* Right Card: Thành phần Hội đồng (2/3) */}
                <Card
                    title={
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                                <TeamOutlined className="text-teal-700" />
                                <span>Thành phần Hội đồng (3 Ủy viên)</span>
                            </div>
                            {conflictNames.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-950 bg-amber-100 px-2.5 py-1 rounded border border-amber-300 font-bold text-xs">
                                    ⚠️ Có GV {conflictNames.join(', ')} là GVHD của sinh viên HĐ này
                                </span>
                            )}
                        </div>
                    }
                    className="lg:col-span-2 shadow-sm border border-slate-300 rounded-lg"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Chairman */}
                        <div className="p-3.5 bg-teal-50 rounded-lg border-2 border-teal-200 text-teal-950 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-teal-900 block mb-2 uppercase tracking-wider">
                                    1. Chủ tịch Hội đồng
                                </span>
                                {chairman ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-teal-700 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-teal-950 text-sm truncate">
                                                {chairman.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-teal-800 font-medium">
                                                Mã: {chairman.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-teal-800 font-medium truncate" title={chairman.lecturer?.email}>
                                                {chairman.lecturer?.email || '---'}
                                            </div>
                                            {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<SwapOutlined />}
                                                    onClick={() => openReplaceMemberModal(chairman)}
                                                    className="p-0 text-xs text-teal-700 mt-1"
                                                >
                                                    Thay thế
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic py-2">
                                        Chưa phân công
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Secretary */}
                        <div className="p-3.5 bg-blue-50 rounded-lg border-2 border-blue-200 text-blue-950 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-blue-900 block mb-2 uppercase tracking-wider">
                                    2. Thư ký Hội đồng
                                </span>
                                {secretary ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-blue-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-blue-950 text-sm truncate">
                                                {secretary.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-blue-800 font-medium">
                                                Mã: {secretary.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-blue-800 font-medium truncate" title={secretary.lecturer?.email}>
                                                {secretary.lecturer?.email || '---'}
                                            </div>
                                            {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<SwapOutlined />}
                                                    onClick={() => openReplaceMemberModal(secretary)}
                                                    className="p-0 text-xs text-blue-700 mt-1"
                                                >
                                                    Thay thế
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic py-2">
                                        Chưa phân công
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Reviewer */}
                        <div className="p-3.5 bg-purple-50 rounded-lg border-2 border-purple-200 text-purple-950 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-bold text-purple-900 block mb-2 uppercase tracking-wider">
                                    3. Ủy viên Phản biện
                                </span>
                                {reviewer ? (
                                    <div className="flex items-start gap-2.5">
                                        <Avatar icon={<UserOutlined />} className="bg-purple-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-bold text-purple-950 text-sm truncate">
                                                {reviewer.lecturer?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-purple-800 font-medium">
                                                Mã: {reviewer.lecturer?.code || '---'}
                                            </div>
                                            <div className="text-xs text-purple-800 font-medium truncate" title={reviewer.lecturer?.email}>
                                                {reviewer.lecturer?.email || '---'}
                                            </div>
                                            {effectiveCouncilType === 'DEFENSE_COUNCIL' && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<SwapOutlined />}
                                                    onClick={() => openReplaceMemberModal(reviewer)}
                                                    className="p-0 text-xs text-purple-700 mt-1"
                                                >
                                                    Thay thế
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 italic py-2">
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
                        <span className="font-bold text-slate-900 text-base">
                            Danh sách Sinh viên thuộc Hội đồng ({effectiveRegistrations.length} SV)
                        </span>
                        <Input
                            placeholder="Tìm kiếm theo MSSV, tên SV, đề tài, GVHD..."
                            prefix={<SearchOutlined className="text-slate-500" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            style={{ maxWidth: 360 }}
                        />
                    </div>
                }
                className="shadow-sm border border-slate-300 rounded-lg"
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
                        <div className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200">
                            <Form.Item
                                name="chairman"
                                label={<span className="text-teal-900 font-bold">1. Chủ tịch HĐ</span>}
                                rules={[{ required: true, message: 'Chọn chủ tịch' }]}
                                className="mb-0"
                            >
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
                        <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                            <Form.Item
                                name="secretary"
                                label={<span className="text-blue-900 font-bold">2. Thư ký HĐ</span>}
                                rules={[{ required: true, message: 'Chọn thư ký' }]}
                                className="mb-0"
                            >
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
                        <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                            <Form.Item
                                name="reviewer"
                                label={<span className="text-purple-900 font-bold">3. Phản biện HĐ</span>}
                                rules={[{ required: true, message: 'Chọn phản biện' }]}
                                className="mb-0"
                            >
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
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

            {/* Modal Lịch sử thao tác */}
            <CouncilAuditLogModal
                open={isLogModalVisible}
                onCancel={() => setIsLogModalVisible(false)}
                council={council}
                logs={councilLogs}
            />

            {/* Modal Nhật ký đổi ca */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <HistoryOutlined className="text-teal-700" />
                        <span>Nhật ký điều chỉnh ca thi Hội đồng: {council.name}</span>
                    </div>
                }
                open={isAdjustmentsModalVisible}
                onCancel={() => setIsAdjustmentsModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setIsAdjustmentsModalVisible(false)}>
                        Đóng
                    </Button>,
                ]}
                width={950}
                destroyOnClose
            >
                {defenseScheduleAdjustmentLogs.length === 0 && !loadingAdjustments ? (
                    <Empty description="Chưa có lượt điều chỉnh ca thi nào" className="my-8" />
                ) : (
                    <Table
                        columns={adjustmentColumns}
                        dataSource={defenseScheduleAdjustmentLogs}
                        rowKey="id"
                        loading={loadingAdjustments}
                        pagination={{ pageSize: 8, showSizeChanger: true }}
                        size="small"
                        className="mt-2"
                        locale={{ emptyText: <Empty description="Chưa có lượt điều chỉnh ca thi nào" /> }}
                    />
                )}
            </Modal>

            {/* Modal Điều chỉnh Ca & Thứ tự bảo vệ */}
            <Modal
                title={`Điều chỉnh Lịch bảo vệ cho SV ${adjustingReg?.student?.fullName || ''}`}
                open={isAdjustModalVisible}
                onOk={handleAdjustStudentSchedule}
                onCancel={() => {
                    setIsAdjustModalVisible(false);
                    setAdjustingReg(null);
                }}
                confirmLoading={submitLoading}
                destroyOnClose
            >
                <div className="space-y-4 py-2">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Ca bảo vệ <span className="text-rose-500">*</span>
                        </label>
                        <Select
                            value={newShift}
                            onChange={setNewShift}
                            className="w-full"
                            options={[
                                { label: 'Ca Sáng (07:00 – 11:00)', value: 'MORNING' },
                                { label: 'Ca Chiều (13:00 – 17:00)', value: 'AFTERNOON' },
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Số thứ tự trong ca <span className="text-rose-500">*</span>
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={30}
                            value={newOrderInShift}
                            onChange={(e) => setNewOrderInShift(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do điều chỉnh <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do điều chỉnh ca/thứ tự bảo vệ (bắt buộc)..."
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            maxLength={500}
                            showCount
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal Thay thế Thành viên Chấm */}
            <Modal
                title={`Thay thế Thành viên "${replacingMember?.lecturer?.fullName || ''}"`}
                open={isReplaceMemberModalVisible}
                onOk={handleReplaceCouncilMember}
                onCancel={() => {
                    setIsReplaceMemberModalVisible(false);
                    setReplacingMember(null);
                }}
                confirmLoading={submitLoading}
                destroyOnClose
            >
                <div className="space-y-4 py-2">
                    <Alert
                        type="info"
                        message="Thay thế thành viên chấm điểm"
                        description="Thành viên mới sẽ tiếp quản chấm điểm cho các sinh viên trong hội đồng này."
                        showIcon
                    />
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Giảng viên thay thế <span className="text-rose-500">*</span>
                        </label>
                        <Select
                            showSearch
                            placeholder="Chọn giảng viên thay thế"
                            optionFilterProp="label"
                            options={lecturerOptions}
                            value={newLecturerId}
                            onChange={setNewLecturerId}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do thay thế <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập lý do thay thế thành viên (bắt buộc)..."
                            value={replaceReason}
                            onChange={(e) => setReplaceReason(e.target.value)}
                            maxLength={500}
                            showCount
                        />
                    </div>
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={confirmLockedSheetOverride}
                                onChange={(e) => setConfirmLockedSheetOverride(e.target.checked)}
                            />
                            <span>Xác nhận ghi đè / mở lại phiếu nếu thành viên cũ đã từng chấm điểm</span>
                        </label>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
