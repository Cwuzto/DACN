import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Button,
    DatePicker,
    Form,
    Input,
    List,
    Descriptions,
    message,
    Modal,
    Popconfirm,
    Select,
    Space,
    Table,
    Tooltip,
    Tag,
    Segmented,
    Progress,
} from 'antd';
import {
    CalendarOutlined,
    DeleteOutlined,
    EditOutlined,
    LinkOutlined,
    TeamOutlined,
    PlusOutlined,
    HistoryOutlined,
    UserOutlined,
    UserAddOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SearchOutlined,
    AppstoreOutlined,
    BarsOutlined,
    RobotOutlined,
    ClockCircleOutlined,
    EnvironmentOutlined,
    UnlockOutlined,
    DownOutlined,
    UpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import councilService from '../../services/councilService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import PageHeader from '../../components/common/PageHeader';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';
import useAuthStore from '../../stores/authStore';

const getConflictingMentors = (council) => {
    const memberIds = new Set((council?.members || []).map((m) => m.lecturerId));
    const conflicts = new Set();
    const regs = council?.registrations || council?.outlineRegistrations || [];
    regs.forEach((reg) => {
        const mentorId = reg.topic?.mentorId;
        if (mentorId && memberIds.has(mentorId)) {
            const member = council.members?.find((m) => m.lecturerId === mentorId);
            const name = member?.lecturer?.fullName || reg.topic?.mentor?.fullName || reg.topic?.lecturer?.fullName || `GV #${mentorId}`;
            conflicts.add(name);
        }
    });
    return Array.from(conflicts);
};

function CouncilAssignmentPage({ forcedCouncilType }) {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const canManageOutline = (user?.permissions || []).includes('OUTLINE_COUNCIL_MANAGE');
    const canManageDefense = (user?.permissions || []).includes('DEFENSE_COUNCIL_MANAGE');
    const [councils, setCouncils] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [allRegistrations, setAllRegistrations] = useState([]);
    const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [councilTypeFilter, setCouncilTypeFilter] = useState(() => (
        forcedCouncilType || (canManageDefense ? 'DEFENSE_COUNCIL' : 'OUTLINE_REVIEW')
    )); // 'ALL' | 'OUTLINE_REVIEW' | 'DEFENSE_COUNCIL'

    useEffect(() => {
        if (forcedCouncilType) {
            setCouncilTypeFilter(forcedCouncilType);
        }
    }, [forcedCouncilType]);
    const [viewMode, setViewMode] = useState('matcher'); // 'matcher' | 'table'
    const [candidateFilter, setCandidateFilter] = useState('all'); // 'all' | 'unassigned' | 'assigned'
    const [candidateSearch, setCandidateSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    // Modals
    const [isCouncilModalVisible, setIsCouncilModalVisible] = useState(false);
    const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isLogModalVisible, setIsLogModalVisible] = useState(false);

    const [editingCouncil, setEditingCouncil] = useState(null);
    const [memberCouncil, setMemberCouncil] = useState(null);
    const [assigningCouncil, setAssigningCouncil] = useState(null);
    const [detailCouncil, setDetailCouncil] = useState(null);
    const [logCouncil, setLogCouncil] = useState(null);
    const [councilLogs, setCouncilLogs] = useState([]);
    const [selectedRegistrationsToAssign, setSelectedRegistrationsToAssign] = useState([]);

    // Reopen Outline Council State
    const [isReopenModalVisible, setIsReopenModalVisible] = useState(false);
    const [reopeningCouncil, setReopeningCouncil] = useState(null);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenLoading, setReopenLoading] = useState(false);
    const [reopenBlockingList, setReopenBlockingList] = useState(null);
    const [reopenError, setReopenError] = useState(null);

    // Auto-Assign Outline Review Preview Modal State
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [previewProposedCouncils, setPreviewProposedCouncils] = useState([]);
    const [previewSkippedStudents, setPreviewSkippedStudents] = useState([]);
    const [previewWarnings, setPreviewWarnings] = useState([]);
    const [expandedCouncilIds, setExpandedCouncilIds] = useState(new Set());
    const [previewConfirmLoading, setPreviewConfirmLoading] = useState(false);

    const [councilForm] = Form.useForm();
    const [memberForm] = Form.useForm();

    const fetchSemesters = useCallback(async () => {
        try {
            const response = await semesterService.getAll();
            if (response.success && response.data.length > 0) {
                setSemesters(response.data);
                if (!selectedSemester) setSelectedSemester(response.data[0].id);
            }
        } catch {
            message.error('Lỗi khi tải danh sách học kỳ');
        }
    }, [selectedSemester]);

    const fetchLecturers = useCallback(async () => {
        try {
            const response = await userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 });
            if (response.success) setLecturers(response.data);
        } catch {
            message.error('Lỗi khi tải danh sách giảng viên');
        }
    }, []);

    const fetchCouncils = useCallback(async () => {
        if (!selectedSemester) return;
        setLoading(true);
        try {
            const [councilsRes, regsRes] = await Promise.all([
                councilService.getCouncils({ semesterId: selectedSemester }),
                registrationService.getAllRegistrations({ semesterId: selectedSemester }),
            ]);
            if (councilsRes.success) setCouncils(councilsRes.data);
            if (regsRes.success) setAllRegistrations(regsRes.data || []);
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải dữ liệu hội đồng và sinh viên');
        } finally {
            setLoading(false);
        }
    }, [selectedSemester]);

    useEffect(() => {
        fetchSemesters();
        fetchLecturers();
    }, [fetchSemesters, fetchLecturers]);

    useEffect(() => {
        fetchCouncils();
    }, [fetchCouncils]);

    const handleAutoAssign = async () => {
        if (!selectedSemester) return;
        try {
            setSubmitLoading(true);
            const response = await councilService.autoAssignRegistrations(selectedSemester);
            if (response.success) {
                const assigned = response.data?.assigned || 0;
                const total = response.data?.totalUnassigned || 0;
                const skipped = response.data?.skipped?.length || 0;
                message.success(`Đã tự động phân công ${assigned}/${total} sinh viên`);
                if (skipped > 0) {
                    message.warning(`Còn ${skipped} sinh viên chưa thể phân công (xung đột/hết slot).`);
                }
                fetchCouncils();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi phân công tự động');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleAutoAssignOutline = async () => {
        if (!selectedSemester) return;
        try {
            setSubmitLoading(true);
            const response = await councilService.previewAutoOutlineCouncils(selectedSemester);
            const previewData = response?.data || response;
            const proposed = previewData?.proposedCouncils || [];
            const skipped = previewData?.skippedStudents || [];
            const warnings = previewData?.warnings || [];

            if (!proposed || proposed.length === 0) {
                message.warning(warnings[0] || 'Không có sinh viên nào đủ điều kiện hoặc cần lập hội đồng đề cương mới.');
                return;
            }

            setPreviewProposedCouncils(
                proposed.map((council, idx) => ({
                    tempId: council.tempId || `temp-council-${idx}`,
                    name: council.name,
                    members: (council.members || []).map((m) => ({
                        roleInCouncil: m.roleInCouncil,
                        lecturerId: m.lecturerId,
                        lecturerName: m.lecturerName,
                    })),
                    excludedMentors: council.excludedMentors || [],
                    registrations: council.registrations || [],
                }))
            );
            setPreviewSkippedStudents(skipped);
            setPreviewWarnings(warnings);
            setExpandedCouncilIds(new Set());
            setIsPreviewModalVisible(true);
        } catch (error) {
            message.error(error.message || 'Lỗi khi xem trước phân công hội đồng đề cương');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleToggleExpandCouncil = (councilId) => {
        setExpandedCouncilIds((prev) => {
            const next = new Set(prev);
            if (next.has(councilId)) {
                next.delete(councilId);
            } else {
                next.add(councilId);
            }
            return next;
        });
    };

    const handlePreviewMemberChange = (councilIndex, role, newLecturerId) => {
        setPreviewProposedCouncils((prev) => {
            const next = [...prev];
            const council = { ...next[councilIndex] };
            council.members = council.members.map((m) => {
                if (m.roleInCouncil === role) {
                    const foundLecturer = lecturers.find((l) => l.id === newLecturerId);
                    return {
                        ...m,
                        lecturerId: newLecturerId,
                        lecturerName: foundLecturer?.fullName || m.lecturerName,
                    };
                }
                return m;
            });
            next[councilIndex] = council;
            return next;
        });
    };

    const handleConfirmAutoAssignOutline = async () => {
        if (!selectedSemester) return;

        for (let i = 0; i < previewProposedCouncils.length; i++) {
            const c = previewProposedCouncils[i];
            const memberIds = (c.members || []).map((m) => m.lecturerId).filter(Boolean);
            if (memberIds.length !== 3 || new Set(memberIds).size !== 3) {
                message.error(`Hội đồng "${c.name}" phải có đúng 3 giảng viên khác nhau (Chủ tịch, Thư ký, UV Phản biện).`);
                return;
            }
        }

        try {
            setPreviewConfirmLoading(true);
            const payload = previewProposedCouncils.map((c) => ({
                name: c.name,
                members: c.members.map((m) => ({
                    roleInCouncil: m.roleInCouncil,
                    lecturerId: m.lecturerId,
                })),
                registrationIds: (c.registrations || []).map((r) => r.id),
            }));

            const response = await councilService.autoAssignOutlineCouncils(selectedSemester, payload);
            if (response.success) {
                const createdCouncils = response.data?.createdCouncils ?? payload.length;
                const assignedStudents = response.data?.assignedStudents ?? 0;
                const skipped = response.data?.skippedStudents?.length || 0;
                message.success(`Đã tự động phân công HĐ Đề cương: Tạo ${createdCouncils} hội đồng, xếp ${assignedStudents} sinh viên.`);
                if (skipped > 0) {
                    message.warning(`Có ${skipped} sinh viên chưa thể xếp hội đồng (xung đột/không thỏa điều kiện).`);
                }
                setIsPreviewModalVisible(false);
                fetchCouncils();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi xác nhận phân công hội đồng đề cương');
        } finally {
            setPreviewConfirmLoading(false);
        }
    };

    const handleOpenReopenModal = (council) => {
        setReopeningCouncil(council);
        setReopenReason('');
        setReopenBlockingList(null);
        setReopenError(null);
        setIsReopenModalVisible(true);
    };

    const handleConfirmReopen = async () => {
        if (!reopeningCouncil) return;
        if (!reopenReason.trim()) {
            message.warning('Vui lòng nhập lý do mở khóa kết quả.');
            return;
        }
        try {
            setReopenLoading(true);
            setReopenBlockingList(null);
            setReopenError(null);
            const res = await councilService.reopenResults(reopeningCouncil.id, reopenReason.trim());
            if (res.success) {
                message.success('Đã mở khóa kết quả hội đồng thành công. Hội đồng chuyển về trạng thái Nháp (DRAFT).');
                setIsReopenModalVisible(false);
                setReopeningCouncil(null);
                setReopenReason('');
                fetchCouncils();
            }
        } catch (err) {
            if (err?.blockingRegistrations || err?.error === 'BM02_DEPENDENCY_EXISTS') {
                setReopenBlockingList(err.blockingRegistrations || []);
                setReopenError(err.message || 'Không thể mở khóa do sinh viên đã có đơn BM02 / tiến độ kế tiếp gây chặn.');
            } else {
                setReopenError(err?.message || 'Lỗi khi mở khóa kết quả hội đồng.');
                message.error(err?.message || 'Lỗi khi mở khóa kết quả');
            }
        } finally {
            setReopenLoading(false);
        }
    };

    const showCreateModal = () => {
        setEditingCouncil(null);
        councilForm.resetFields();
        councilForm.setFieldsValue({
            councilType: councilTypeFilter === 'ALL' ? 'DEFENSE_COUNCIL' : councilTypeFilter,
        });
        setIsCouncilModalVisible(true);
    };

    const showEditModal = (council) => {
        setEditingCouncil(council);
        councilForm.setFieldsValue({
            name: council.name,
            councilType: council.councilType || 'DEFENSE_COUNCIL',
            location: council.location,
            defenseDate: council.defenseDate ? dayjs(council.defenseDate) : null,
        });
        setIsCouncilModalVisible(true);
    };

    const showMemberModal = (council) => {
        setMemberCouncil(council);
        const chairman = council.members.find((member) => member.roleInCouncil === 'CHAIRMAN')?.lecturerId;
        const secretary = council.members.find((member) => member.roleInCouncil === 'SECRETARY')?.lecturerId;
        const reviewer = council.members.find((member) => member.roleInCouncil === 'REVIEWER')?.lecturerId;
        memberForm.setFieldsValue({ chairman, secretary, reviewer });
        setIsMemberModalVisible(true);
    };

    const handleSaveCouncil = async () => {
        try {
            const values = await councilForm.validateFields();
            setSubmitLoading(true);

            const payload = {
                semesterId: selectedSemester,
                name: values.name,
                councilType: values.councilType || 'DEFENSE_COUNCIL',
                location: values.location,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
            };

            if (editingCouncil) {
                await councilService.updateCouncil(editingCouncil.id, payload);
                message.success('Cập nhật hội đồng thành công');
            } else {
                await councilService.createCouncil(payload);
                message.success('Tạo hội đồng thành công. Tiếp theo hãy phân công 3 giảng viên.');
            }

            setIsCouncilModalVisible(false);
            fetchCouncils();
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleSaveMembers = async () => {
        if (!memberCouncil) return;
        try {
            const values = await memberForm.validateFields();
            setSubmitLoading(true);

            const members = [
                { lecturerId: values.chairman, roleInCouncil: 'CHAIRMAN' },
                { lecturerId: values.secretary, roleInCouncil: 'SECRETARY' },
                { lecturerId: values.reviewer, roleInCouncil: 'REVIEWER' },
            ];

            const uniqueLecturers = new Set(members.map((member) => member.lecturerId));
            if (uniqueLecturers.size !== 3) {
                message.warning('3 vai trò phải là 3 giảng viên khác nhau.');
                return;
            }

            const response = await councilService.updateCouncil(memberCouncil.id, { members });
            message.success('Đã cập nhật thành viên hội đồng');
            if (response?.warnings?.length) response.warnings.forEach((warning) => message.warning(warning));

            setIsMemberModalVisible(false);
            fetchCouncils();
        } catch (error) {
            if (error.message) message.error(error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDeleteCouncil = async (id) => {
        try {
            const response = await councilService.deleteCouncil(id);
            if (response.success) {
                message.success('Xóa hội đồng thành công');
                fetchCouncils();
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi xóa hội đồng');
        }
    };

    const showAssignModal = async (council) => {
        setAssigningCouncil(council);
        setSelectedRegistrationsToAssign([]);
        try {
            setLoading(true);
            const response = await registrationService.getAllRegistrations({
                semesterId: selectedSemester,
                unassignedCouncilOnly: true,
                councilType: council.councilType,
            });
            if (response.success) setUnassignedRegistrations(response.data);
            setIsAssignModalVisible(true);
        } catch {
            message.error('Lỗi khi tải danh sách sinh viên chưa phân công');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignRegistrations = async () => {
        if (!selectedRegistrationsToAssign?.length) return message.warning('Vui lòng chọn ít nhất 1 sinh viên');
        try {
            setSubmitLoading(true);
            await councilService.assignRegistrations(assigningCouncil.id, selectedRegistrationsToAssign);
            message.success('Phân công thành công');
            setIsAssignModalVisible(false);
            fetchCouncils();
        } catch (error) {
            message.error(error.message || 'Lỗi phân công');
        } finally {
            setSubmitLoading(false);
        }
    };

    const showDetailModal = async (councilId) => {
        try {
            setLoading(true);
            const response = await councilService.getCouncilById(councilId);
            if (response.success) {
                setDetailCouncil(response.data);
                setIsDetailModalVisible(true);
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải chi tiết hội đồng');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveRegistration = async (councilId, registrationId) => {
        try {
            await councilService.removeRegistration(councilId, registrationId);
            message.success('Đã gỡ sinh viên khỏi hội đồng');
            await fetchCouncils();
            if (detailCouncil?.id === councilId) {
                showDetailModal(councilId);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi gỡ sinh viên');
        }
    };

    const showLogModal = async (council) => {
        try {
            setLogCouncil(council);
            setLoading(true);
            const response = await councilService.getCouncilLogs(council.id);
            if (response.success) {
                setCouncilLogs(response.data || []);
                setIsLogModalVisible(true);
            }
        } catch (error) {
            message.error(error.message || 'Không thể tải lịch sử hội đồng');
        } finally {
            setLoading(false);
        }
    };

    const actionTextMap = {
        CREATE_COUNCIL: 'Tạo hội đồng',
        UPDATE_COUNCIL: 'Cập nhật hội đồng',
        ASSIGN_COUNCIL: 'Phân công sinh viên vào hội đồng',
        REMOVE_REGISTRATION_FROM_COUNCIL: 'Gỡ sinh viên khỏi hội đồng',
        AUTO_ASSIGN_COUNCIL: 'Phân công tự động',
        DELETE_COUNCIL: 'Xóa hội đồng',
    };

    const lecturerOptions = useMemo(
        () => lecturers.map((lecturer) => ({ label: `${lecturer.fullName} (${lecturer.code})`, value: lecturer.id })),
        [lecturers],
    );
    const projectOptions = useMemo(
        () => [{ value: PROJECT_NAME, label: PROJECT_NAME }],
        [],
    );
    const semesterOptions = useMemo(
        () => semesters.map((semester) => ({ value: semester.id, label: formatSemesterLabel(semester) })),
        [semesters],
    );

    const filteredCouncils = useMemo(() => {
        if (councilTypeFilter === 'ALL') return councils;
        return councils.filter((c) => c.councilType === councilTypeFilter);
    }, [councils, councilTypeFilter]);

    // Check conflict of interest: Lecturer is in council AND is topic supervisor
    const conflictCount = useMemo(() => {
        let count = 0;
        filteredCouncils.forEach((c) => {
            const memberIds = new Set((c.members || []).map((m) => m.lecturerId));
            (c.registrations || []).forEach((r) => {
                const supervisorId = r.topic?.lecturerId;
                if (supervisorId && memberIds.has(supervisorId)) {
                    count++;
                }
            });
        });
        return count;
    }, [filteredCouncils]);

    // Candidate list for current phase
    const candidatesForPhase = useMemo(() => {
        return allRegistrations.filter((r) => {
            if (r.status === 'DROPPED' || r.status === 'WITHDRAWN') return false;
            if (councilTypeFilter === 'DEFENSE_COUNCIL') return r.status === 'DEFENSE_READY';
            if (councilTypeFilter === 'OUTLINE_REVIEW') {
                return ['REGISTERED', 'APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION'].includes(r.status);
            }
            return true;
        });
    }, [allRegistrations, councilTypeFilter]);

    // Candidate filtering
    const filteredCandidates = useMemo(() => {
        return candidatesForPhase.filter((r) => {
            const isAssigned = councilTypeFilter === 'OUTLINE_REVIEW'
                ? !!r.outlineCouncilId
                : (!!r.defenseCouncilId || !!r.councilId);

            if (candidateFilter === 'unassigned' && isAssigned) return false;
            if (candidateFilter === 'assigned' && !isAssigned) return false;

            if (candidateSearch.trim()) {
                const kw = candidateSearch.toLowerCase().trim();
                const studentName = (r.student?.fullName || '').toLowerCase();
                const studentCode = (r.student?.code || '').toLowerCase();
                const topicTitle = (r.topic?.title || r.adjustedTitle || '').toLowerCase();
                const supervisor = (r.topic?.lecturer?.fullName || '').toLowerCase();
                return studentName.includes(kw) || studentCode.includes(kw) || topicTitle.includes(kw) || supervisor.includes(kw);
            }
            return true;
        });
    }, [candidatesForPhase, councilTypeFilter, candidateFilter, candidateSearch]);

    // Counters for candidates
    const candidateStats = useMemo(() => {
        const total = candidatesForPhase.length;
        const assigned = candidatesForPhase.filter((r) => {
            return councilTypeFilter === 'OUTLINE_REVIEW'
                ? !!r.outlineCouncilId
                : (!!r.defenseCouncilId || !!r.councilId);
        }).length;
        const unassigned = total - assigned;
        return { total, assigned, unassigned };
    }, [candidatesForPhase, councilTypeFilter]);

    const unassignedRegistrationOptions = useMemo(
        () => unassignedRegistrations
            .filter((registration) => {
                if (assigningCouncil?.councilType === 'OUTLINE_REVIEW') {
                    return !registration?.outlineCouncilId;
                }
                return !registration?.defenseCouncilId && !registration?.councilId;
            })
            .map((registration) => ({
                value: registration.id,
                label: `${registration.student?.fullName || 'N/A'} - ${registration.student?.code || 'N/A'} (${registration.status})`,
                desc: (
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                                {registration.student?.fullName || 'N/A'} - {registration.student?.code || 'N/A'}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {registration.status}
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">{registration.adjustedTitle || registration.topic?.title || 'Không có đề tài'}</span>
                    </div>
                ),
            })),
        [unassignedRegistrations, assigningCouncil],
    );

    // Columns for standard table view
    const columns = [
        {
            title: 'Hội đồng',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => {
                const conflicts = getConflictingMentors(record);
                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className="font-bold text-teal-800 hover:text-teal-900 cursor-pointer hover:underline text-sm"
                                onClick={() => navigate(record.councilType === 'OUTLINE_REVIEW' ? `/admin/outline-councils/${record.id}` : `/admin/defense-councils/${record.id}`)}
                            >
                                {text}
                            </span>
                            <Tag
                                color={record.councilType === 'OUTLINE_REVIEW' ? 'purple' : 'teal'}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            >
                                {record.councilType === 'OUTLINE_REVIEW' ? 'Thẩm định Đề cương' : 'Chấm Bảo vệ'}
                            </Tag>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <EnvironmentOutlined className="text-slate-500" />
                            <span>{record.location || 'Chưa xếp phòng'}</span>
                        </div>
                        {conflicts.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-bold text-xs">
                                ⚠️ Có GV {conflicts.join(', ')} là GVHD của sinh viên HĐ này
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Thành phần Hội đồng',
            key: 'members',
            render: (_, record) => {
                const chairman = record.members?.find((member) => member.roleInCouncil === 'CHAIRMAN')?.lecturer?.fullName;
                const secretary = record.members?.find((member) => member.roleInCouncil === 'SECRETARY')?.lecturer?.fullName;
                const reviewer = record.members?.find((member) => member.roleInCouncil === 'REVIEWER')?.lecturer?.fullName;

                return (
                    <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-teal-100 text-teal-900 border border-teal-200 text-[10px] font-bold px-1.5 py-0.5 rounded">CT</span>
                            <span className={chairman ? 'font-semibold text-slate-800' : 'text-slate-500 italic'}>
                                {chairman || 'Chưa phân công'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">TK</span>
                            <span className={secretary ? 'font-semibold text-slate-800' : 'text-slate-500 italic'}>
                                {secretary || 'Chưa phân công'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded">PB</span>
                            <span className={reviewer ? 'font-semibold text-slate-800' : 'text-slate-500 italic'}>
                                {reviewer || 'Chưa phân công'}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Ngày bảo vệ',
            dataIndex: 'defenseDate',
            key: 'defenseDate',
            width: 140,
            render: (value) => (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <CalendarOutlined className="text-slate-400" />
                    <span>{value ? dayjs(value).format('DD/MM/YYYY') : 'Chưa xếp'}</span>
                </div>
            ),
        },
        {
            title: 'Quy mô SV',
            key: 'registrationCount',
            align: 'center',
            width: 130,
            render: (_, record) => {
                const count = record._count?.registrations || 0;
                return (
                    <div className="space-y-1">
                        <span className="font-bold text-slate-900 text-sm">{count} / 10 SV</span>
                        <div className="w-16 mx-auto bg-slate-100 rounded-full h-1.5">
                            <div
                                className="bg-[#0F766E] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 260,
            align: 'center',
            render: (_, record) => {
                const hasEnoughMembers = (record.members?.length || 0) === 3;
                return (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Tooltip title="Phân công 3 giảng viên vào hội đồng">
                            <Button size="small" icon={<TeamOutlined />} onClick={() => showMemberModal(record)}>
                                Đổi thành viên HĐ
                            </Button>
                        </Tooltip>
                        <Tooltip title={hasEnoughMembers ? 'Gán sinh viên vào hội đồng' : 'Cần đủ 3 giảng viên trước'}>
                            <Button
                                size="small"
                                type="primary"
                                icon={<LinkOutlined />}
                                onClick={() => showAssignModal(record)}
                                disabled={!hasEnoughMembers}
                            >
                                Gán SV
                            </Button>
                        </Tooltip>
                        <Button size="small" icon={<HistoryOutlined />} onClick={() => showLogModal(record)} />
                        <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)} />
                        {record.councilType === 'OUTLINE_REVIEW' && (
                            <Tooltip title="Mở khóa kết quả (Reopen)">
                                <Button
                                    size="small"
                                    icon={<UnlockOutlined />}
                                    onClick={() => handleOpenReopenModal(record)}
                                    style={{ color: '#d97706', borderColor: '#fcd34d' }}
                                >
                                    Mở khóa
                                </Button>
                            </Tooltip>
                        )}
                        <Popconfirm
                            title="Xóa hội đồng này?"
                            description="Chỉ xóa được nếu hội đồng chưa có sinh viên nào."
                            onConfirm={() => handleDeleteCouncil(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} disabled={record._count?.registrations > 0} />
                        </Popconfirm>
                    </div>
                );
            },
        },
    ];

    const pageTitle = forcedCouncilType === 'OUTLINE_REVIEW' || councilTypeFilter === 'OUTLINE_REVIEW'
        ? 'Phân công Hội đồng Xét duyệt Đề cương'
        : forcedCouncilType === 'DEFENSE_COUNCIL' || councilTypeFilter === 'DEFENSE_COUNCIL'
            ? 'Phân công Hội đồng Bảo vệ Khóa luận'
            : 'Phân công Hội đồng & Điều phối Ca thi';

    const pageSubtitle = forcedCouncilType === 'OUTLINE_REVIEW' || councilTypeFilter === 'OUTLINE_REVIEW'
        ? 'Quản lý thành lập hội đồng thẩm định BM01, tự động phân bổ sinh viên và xét duyệt đề cương'
        : forcedCouncilType === 'DEFENSE_COUNCIL' || councilTypeFilter === 'DEFENSE_COUNCIL'
            ? 'Quản lý thành lập hội đồng chấm bảo vệ tốt nghiệp, điều phối ca thi và phân công sinh viên'
            : 'Quản lý thành lập hội đồng xét duyệt đề cương và hội đồng chấm bảo vệ khóa luận';

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title={pageTitle}
                subtitle={pageSubtitle}
                actions={
                    <div className="flex items-center gap-3 flex-wrap">
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 180 }}
                            options={projectOptions}
                        />
                        <Select
                            value={selectedSemester}
                            onChange={setSelectedSemester}
                            style={{ width: 220 }}
                            options={semesterOptions}
                            loading={semesters.length === 0}
                            placeholder="Chọn đợt đồ án"
                        />
                        {councilTypeFilter === 'OUTLINE_REVIEW' ? (
                            canManageOutline && (
                                <Button
                                    onClick={handleAutoAssignOutline}
                                    loading={submitLoading}
                                    disabled={!selectedSemester}
                                    icon={<RobotOutlined />}
                                    type="primary"
                                    ghost
                                >
                                    Tự động phân công HĐ Đề cương
                                </Button>
                            )
                        ) : (
                            canManageDefense && (
                                <Button
                                    onClick={handleAutoAssign}
                                    loading={submitLoading}
                                    disabled={!selectedSemester}
                                    icon={<RobotOutlined />}
                                >
                                    Tự động phân công
                                </Button>
                            )
                        )}
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={showCreateModal}
                            disabled={!selectedSemester}
                        >
                        Lập Hội Đồng {councilTypeFilter === 'OUTLINE_REVIEW' ? 'Đề cương' : 'Bảo vệ'}
                        </Button>
                    </div>
                }
            />

            {/* Phase Switcher Navigation */}
            {!forcedCouncilType ? (
                <div className="flex items-center justify-between pb-3 border-b border-slate-300 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        {canManageOutline && <button
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                                councilTypeFilter === 'OUTLINE_REVIEW'
                                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm'
                                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 font-semibold'
                            }`}
                            onClick={() => setCouncilTypeFilter('OUTLINE_REVIEW')}
                        >
                            <span className="material-symbols-outlined text-base">description</span>
                            <span>1. Hội đồng Thẩm định Đề cương (Giai đoạn 2)</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                                councilTypeFilter === 'OUTLINE_REVIEW'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-slate-100 text-slate-700'
                            }`}>
                                {councils.filter((c) => c.councilType === 'OUTLINE_REVIEW').length} HĐ
                            </span>
                        </button>}
                        {canManageDefense && <button
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-all cursor-pointer ${
                                councilTypeFilter === 'DEFENSE_COUNCIL'
                                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm'
                                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 font-semibold'
                            }`}
                            onClick={() => setCouncilTypeFilter('DEFENSE_COUNCIL')}
                        >
                            <span className="material-symbols-outlined text-base">gavel</span>
                            <span>2. Hội đồng Chấm Bảo vệ Khóa luận (Giai đoạn 5)</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                                councilTypeFilter === 'DEFENSE_COUNCIL'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-slate-100 text-slate-700'
                            }`}>
                                {councils.filter((c) => c.councilType === 'DEFENSE_COUNCIL').length} HĐ
                            </span>
                        </button>}
                        {canManageOutline && canManageDefense && <button
                            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                councilTypeFilter === 'ALL'
                                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm'
                                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                            }`}
                            onClick={() => setCouncilTypeFilter('ALL')}
                        >
                            Tất cả ({councils.length})
                        </button>}
                    </div>

                    {/* View switcher: 2-column Matcher vs Table */}
                    <div className="flex items-center gap-2">
                        <Segmented
                            value={viewMode}
                            onChange={setViewMode}
                            options={[
                                { label: 'Ghép cặp (2 cột)', value: 'matcher', icon: <AppstoreOutlined /> },
                                { label: 'Bảng danh sách', value: 'table', icon: <BarsOutlined /> },
                            ]}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between pb-3 border-b border-slate-300 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <Tag color="cyan" className="px-3 py-1 text-sm font-bold border border-teal-300">
                            {councilTypeFilter === 'OUTLINE_REVIEW'
                                ? `Hội đồng Đề cương: ${councils.filter((c) => c.councilType === 'OUTLINE_REVIEW').length} HĐ`
                                : `Hội đồng Bảo vệ: ${councils.filter((c) => c.councilType === 'DEFENSE_COUNCIL').length} HĐ`}
                        </Tag>
                    </div>
                    <div className="flex items-center gap-2">
                        <Segmented
                            value={viewMode}
                            onChange={setViewMode}
                            options={[
                                { label: 'Ghép cặp (2 cột)', value: 'matcher', icon: <AppstoreOutlined /> },
                                { label: 'Bảng danh sách', value: 'table', icon: <BarsOutlined /> },
                            ]}
                        />
                    </div>
                </div>
            )}

            {/* Quick Metrics Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tổng Hội đồng</span>
                        <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{filteredCouncils.length} HĐ</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-bold border border-teal-200">
                        {filteredCouncils.filter((c) => c.members?.length === 3).length} Đủ 3 CB
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sinh viên Trong Đợt</span>
                        <p className="text-2xl font-black text-teal-800 mt-1 font-mono">{candidateStats.total} SV</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        Hợp lệ
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Đã xếp vào Hội đồng</span>
                        <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                            {candidateStats.assigned} / {candidateStats.total} SV
                        </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        candidateStats.unassigned === 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                        {candidateStats.unassigned === 0 ? 'Đã xếp đủ 100%' : `${candidateStats.unassigned} chưa xếp`}
                    </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Xung đột Lợi ích</span>
                        <p className={`text-lg font-black mt-1 ${conflictCount === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {conflictCount === 0 ? '✓ 0 Vi phạm' : `⚠ ${conflictCount} Vi phạm`}
                        </p>
                    </div>
                    <span className="text-[11px] text-slate-600 font-semibold">
                        (GVHD ≠ Giám khảo)
                    </span>
                </div>
            </div>

            {/* View Mode 1: TWO-COLUMN MATCHER */}
            {viewMode === 'matcher' ? (
                <div className="matcher-layout">
                    {/* CỘT TRÁI (38%): HÀNG ĐỢI SINH VIÊN */}
                    <div className="matcher-pane">
                        <div className="matcher-pane-header">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Hàng đợi Sinh viên</h3>
                                <span className="text-xs text-slate-600 font-medium">
                                    {councilTypeFilter === 'OUTLINE_REVIEW' ? 'Đề cương đã nộp' : 'Điều phối ca bảo vệ'}
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-xs font-bold border border-teal-200">
                                {filteredCandidates.length} SV
                            </span>
                        </div>

                        {/* Filter tabs inside candidate pane */}
                        <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-300 flex items-center gap-1.5">
                            <button
                                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                    candidateFilter === 'all'
                                        ? 'bg-white text-teal-900 shadow-sm font-bold border border-slate-300'
                                        : 'text-slate-700 hover:text-slate-900 font-medium'
                                }`}
                                onClick={() => setCandidateFilter('all')}
                            >
                                Tất cả ({candidateStats.total})
                            </button>
                            <button
                                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                    candidateFilter === 'unassigned'
                                        ? 'bg-white text-amber-800 shadow-sm font-bold border border-amber-300'
                                        : 'text-slate-700 hover:text-slate-900 font-medium'
                                }`}
                                onClick={() => setCandidateFilter('unassigned')}
                            >
                                Chưa xếp ({candidateStats.unassigned})
                            </button>
                            <button
                                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                    candidateFilter === 'assigned'
                                        ? 'bg-white text-emerald-800 shadow-sm font-bold border border-emerald-300'
                                        : 'text-slate-700 hover:text-slate-900 font-medium'
                                }`}
                                onClick={() => setCandidateFilter('assigned')}
                            >
                                Đã xếp ({candidateStats.assigned})
                            </button>
                        </div>

                        {/* Search input */}
                        <div className="p-3 border-b border-slate-300 bg-white">
                            <Input
                                prefix={<SearchOutlined className="text-slate-500" />}
                                placeholder="Tìm MSSV, tên SV, GVHD..."
                                value={candidateSearch}
                                onChange={(e) => setCandidateSearch(e.target.value)}
                                allowClear
                                size="small"
                            />
                        </div>

                        {/* Candidates List */}
                        <div className="matcher-pane-body">
                            {filteredCandidates.length === 0 ? (
                                <div className="text-center py-8 text-slate-600 font-medium text-xs">
                                    Không có sinh viên nào thỏa mãn bộ lọc.
                                </div>
                            ) : (
                                filteredCandidates.map((reg) => {
                                    const assignedCouncilId = councilTypeFilter === 'OUTLINE_REVIEW'
                                        ? reg.outlineCouncilId
                                        : (reg.defenseCouncilId || reg.councilId);
                                    const assignedCouncil = councils.find((c) => c.id === assignedCouncilId);
                                    const isAssigned = !!assignedCouncilId;

                                    return (
                                        <div
                                            key={reg.id}
                                            className={`candidate-card ${isAssigned ? 'assigned' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="font-mono font-bold text-xs text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                    {reg.student?.code || 'SV-N/A'}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                                                    {reg.status}
                                                </span>
                                            </div>
                                            <div className="font-bold text-slate-900 text-xs">
                                                {reg.student?.fullName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-800 line-clamp-2 mt-1 font-medium">
                                                {reg.adjustedTitle || reg.topic?.title || 'Chưa có tên đề tài'}
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-dashed border-slate-300 pt-2 mt-2">
                                                <span>
                                                    GVHD: <strong className="text-slate-900">{reg.topic?.lecturer?.fullName || 'N/A'}</strong>
                                                </span>
                                                <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                                                    Đạt điều kiện
                                                </span>
                                            </div>
                                            <div className="mt-2.5 flex items-center justify-between">
                                                {isAssigned ? (
                                                    <>
                                                        <span className="text-xs text-emerald-800 font-bold inline-flex items-center gap-1">
                                                            <CheckCircleOutlined />
                                                            {assignedCouncil?.name || 'Đã vào HĐ'}
                                                        </span>
                                                        <Button
                                                            size="small"
                                                            danger
                                                            type="text"
                                                            className="text-xs font-bold"
                                                            onClick={() => handleRemoveRegistration(assignedCouncilId, reg.id)}
                                                        >
                                                            Hủy ghép
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-xs text-amber-800 font-bold">
                                                            Chưa gán HĐ
                                                        </span>
                                                        <Button
                                                            size="small"
                                                            type="primary"
                                                            icon={<UserAddOutlined />}
                                                            className="text-xs font-bold"
                                                            onClick={() => {
                                                                if (filteredCouncils.length > 0) {
                                                                    showAssignModal(filteredCouncils[0]);
                                                                } else {
                                                                    message.info('Vui lòng tạo một hội đồng trước.');
                                                                }
                                                            }}
                                                        >
                                                            Gán HĐ
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* CỘT PHẢI (62%): DANH SÁCH HỘI ĐỒNG */}
                    <div className="matcher-pane">
                        <div className="matcher-pane-header">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Danh sách Hội đồng & Ca thi Chi tiết</h3>
                                <span className="text-xs text-slate-600 font-medium">
                                    Đợt bảo vệ: <strong className="text-slate-900">{semesters.find((s) => s.id === selectedSemester)?.name || 'Hiện tại'}</strong>
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-xs font-bold border border-teal-200">
                                {filteredCouncils.length} Hội đồng
                            </span>
                        </div>

                        <div className="councils-board p-4">
                            {filteredCouncils.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-300 p-8 text-center text-slate-600 font-medium">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-400 block">groups</span>
                                    Chưa có hội đồng nào trong đợt này. Nhấp "Lập Hội đồng Mới" ở trên để tạo.
                                </div>
                            ) : (
                                filteredCouncils.map((council) => {
                                    const assignedCount = council._count?.registrations || council.registrations?.length || 0;
                                    const maxSlots = 10;
                                    const percent = Math.min(100, Math.round((assignedCount / maxSlots) * 100));
                                    const isComplete = (council.members?.length || 0) === 3;
                                    const chairman = council.members?.find((m) => m.roleInCouncil === 'CHAIRMAN')?.lecturer?.fullName;
                                    const secretary = council.members?.find((m) => m.roleInCouncil === 'SECRETARY')?.lecturer?.fullName;
                                    const reviewer = council.members?.find((m) => m.roleInCouncil === 'REVIEWER')?.lecturer?.fullName;
                                    const conflicts = getConflictingMentors(council);

                                    return (
                                        <div key={council.id} className="council-card">
                                            {/* Council Card Header */}
                                            <div className="council-card-header">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className="font-bold text-teal-900 hover:text-teal-950 cursor-pointer hover:underline text-sm"
                                                            onClick={() => navigate(council.councilType === 'OUTLINE_REVIEW' ? `/admin/outline-councils/${council.id}` : `/admin/defense-councils/${council.id}`)}
                                                        >
                                                            {council.name}
                                                        </span>
                                                        <Tag color={council.councilType === 'OUTLINE_REVIEW' ? 'purple' : 'teal'} className="font-bold border border-slate-300">
                                                            {council.councilType === 'OUTLINE_REVIEW' ? 'Thẩm định Đề cương' : 'Chấm Bảo vệ'}
                                                        </Tag>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                                            isComplete ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
                                                        }`}>
                                                            {isComplete ? '3 Giảng viên (Chuẩn Viện)' : 'Chưa đủ 3 GV'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-medium">
                                                        <span className="inline-flex items-center gap-1">
                                                            <CalendarOutlined className="text-slate-500" />
                                                            {council.defenseDate ? dayjs(council.defenseDate).format('DD/MM/YYYY') : 'Chưa xếp ngày'}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <EnvironmentOutlined className="text-slate-500" />
                                                            {council.location || 'Chưa xếp phòng'}
                                                        </span>
                                                        {conflicts.length > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-bold text-xs">
                                                                ⚠️ Có GV {conflicts.join(', ')} là GVHD của sinh viên HĐ này
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Capacity Meter */}
                                                <div className="flex flex-col items-end gap-1 min-w-[120px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs text-slate-700 font-bold">Đang nhận:</span>
                                                        <strong className="text-sm font-mono text-slate-950 font-black">{assignedCount} / {maxSlots} SV</strong>
                                                    </div>
                                                    <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${assignedCount >= maxSlots ? 'bg-rose-600' : 'bg-teal-700'}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-slate-700 font-bold">
                                                        {assignedCount >= maxSlots ? 'Đã đủ slot' : `Còn ${maxSlots - assignedCount} chỗ`}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Jury Members Row (3 members) */}
                                            <div className="council-jury-grid">
                                                <div className="jury-cell jury-cell-chair bg-teal-50 border-1.5 border-teal-200 rounded-md p-2">
                                                    <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider">
                                                        1. Chủ tịch Hội đồng
                                                    </span>
                                                    <span className={`text-xs font-bold ${chairman ? 'text-teal-950' : 'text-slate-500 italic'}`}>
                                                        {chairman || 'Chưa phân công'}
                                                    </span>
                                                </div>
                                                <div className="jury-cell jury-cell-sec bg-blue-50 border-1.5 border-blue-200 rounded-md p-2">
                                                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                                                        2. Thư ký Hội đồng
                                                    </span>
                                                    <span className={`text-xs font-bold ${secretary ? 'text-blue-950' : 'text-slate-500 italic'}`}>
                                                        {secretary || 'Chưa phân công'}
                                                    </span>
                                                </div>
                                                <div className="jury-cell jury-cell-rev bg-purple-50 border-1.5 border-purple-200 rounded-md p-2">
                                                    <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                                                        3. UV Phản biện
                                                    </span>
                                                    <span className={`text-xs font-bold ${reviewer ? 'text-purple-950' : 'text-slate-500 italic'}`}>
                                                        {reviewer || 'Chưa phân công'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Council Card Action Footer */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200 flex-wrap gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        size="small"
                                                        icon={<TeamOutlined />}
                                                        onClick={() => showMemberModal(council)}
                                                    >
                                                        Đổi thành viên HĐ
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        icon={<LinkOutlined />}
                                                        onClick={() => showAssignModal(council)}
                                                        disabled={!isComplete}
                                                    >
                                                        Gán Sinh viên
                                                    </Button>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {council.councilType === 'OUTLINE_REVIEW' && (
                                                        <Button
                                                            size="small"
                                                            icon={<UnlockOutlined />}
                                                            onClick={() => handleOpenReopenModal(council)}
                                                            style={{ color: '#b45309', borderColor: '#f59e0b', fontWeight: 600 }}
                                                            title="Mở khóa kết quả (Reopen)"
                                                        />
                                                    )}
                                                    <Button
                                                        size="small"
                                                        icon={<HistoryOutlined />}
                                                        onClick={() => showLogModal(council)}
                                                        title="Nhật ký thao tác"
                                                    />
                                                    <Button
                                                        size="small"
                                                        icon={<EditOutlined />}
                                                        onClick={() => showEditModal(council)}
                                                        title="Sửa thông tin"
                                                    />
                                                    <Popconfirm
                                                        title="Xóa hội đồng này?"
                                                        description="Chỉ xóa được nếu hội đồng chưa có sinh viên nào."
                                                        onConfirm={() => handleDeleteCouncil(council.id)}
                                                        okText="Xóa"
                                                        cancelText="Hủy"
                                                        okButtonProps={{ danger: true }}
                                                    >
                                                        <Button
                                                            size="small"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            disabled={assignedCount > 0}
                                                            title="Xóa hội đồng"
                                                        />
                                                    </Popconfirm>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* View Mode 2: TABLE VIEW */
                <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
                    <Table
                        dataSource={filteredCouncils}
                        columns={columns}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        rowKey="id"
                        loading={loading}
                        size="middle"
                        locale={{
                            emptyText: (
                                <div className="py-12 text-center text-slate-500 font-medium">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-400 block">groups</span>
                                    Chưa có hội đồng nào được tạo trong đợt này.
                                </div>
                            ),
                        }}
                    />
                </div>
            )}

            {/* Modal Tạo/Sửa Hội đồng */}
            <Modal
                title={editingCouncil ? 'Chỉnh sửa thông tin hội đồng' : 'Tạo hội đồng mới'}
                open={isCouncilModalVisible}
                onOk={handleSaveCouncil}
                onCancel={() => setIsCouncilModalVisible(false)}
                confirmLoading={submitLoading}
                width={650}
                destroyOnClose
            >
                <Form form={councilForm} layout="vertical" style={{ marginTop: 16 }}>
                    <div className="grid grid-cols-6 gap-4">
                        <div className="col-span-4">
                            <Form.Item name="name" label="Tên hội đồng" rules={[{ required: true, message: 'Nhập tên hội đồng' }]}>
                                <Input placeholder="VD: Hội đồng KTPM - 01" />
                            </Form.Item>
                        </div>
                        <div className="col-span-2">
                            <Form.Item name="councilType" label="Loại hội đồng" rules={[{ required: true, message: 'Chọn loại hội đồng' }]}>
                                <Select
                                    options={[
                                        ...(canManageDefense ? [{ label: 'Hội đồng chấm bảo vệ', value: 'DEFENSE_COUNCIL' }] : []),
                                        ...(canManageOutline ? [{ label: 'Hội đồng thẩm định đề cương', value: 'OUTLINE_REVIEW' }] : []),
                                    ]}
                                />
                            </Form.Item>
                        </div>
                        <div className="col-span-3">
                            <Form.Item name="location" label="Phòng họp / Phòng bảo vệ">
                                <Input placeholder="VD: P.301, Tòa C" />
                            </Form.Item>
                        </div>
                        <div className="col-span-3">
                            <Form.Item name="defenseDate" label="Ngày tổ chức">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </div>
                    </div>
                </Form>
            </Modal>

            {/* Modal Phân công 3 Thành viên */}
            <Modal
                title={`Phân công 3 Thành viên - ${memberCouncil?.name || ''}`}
                open={isMemberModalVisible}
                onOk={handleSaveMembers}
                onCancel={() => setIsMemberModalVisible(false)}
                confirmLoading={submitLoading}
                width={720}
                destroyOnClose
            >
                <p className="text-xs text-slate-500 mb-4">
                    Hội đồng theo quy chế gồm 3 giảng viên độc lập (Chủ tịch, Thư ký, Phản biện). Không được trùng lặp.
                </p>
                <Form form={memberForm} layout="vertical">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200">
                            <Form.Item name="chairman" label={<span className="text-teal-900 font-bold">1. Chủ tịch HĐ</span>} rules={[{ required: true, message: 'Chọn chủ tịch' }]} className="mb-0">
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
                        <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                            <Form.Item name="secretary" label={<span className="text-blue-900 font-bold">2. Thư ký HĐ</span>} rules={[{ required: true, message: 'Chọn thư ký' }]} className="mb-0">
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
                        <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                            <Form.Item name="reviewer" label={<span className="text-purple-900 font-bold">3. Phản biện HĐ</span>} rules={[{ required: true, message: 'Chọn phản biện' }]} className="mb-0">
                                <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                            </Form.Item>
                        </div>
                    </div>
                </Form>
            </Modal>

            {/* Modal Gán Sinh viên */}
            <Modal
                title={`Phân công SV vào ${assigningCouncil?.councilType === 'OUTLINE_REVIEW' ? 'HĐ Thẩm định đề cương' : 'HĐ Chấm bảo vệ'} "${assigningCouncil?.name || ''}"`}
                open={isAssignModalVisible}
                onOk={handleAssignRegistrations}
                onCancel={() => setIsAssignModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <div className="mb-4">
                    <p className="text-sm text-slate-700 font-medium">
                        Chọn sinh viên để phân công vào {assigningCouncil?.councilType === 'OUTLINE_REVIEW' ? 'Hội đồng thẩm định đề cương' : 'Hội đồng chấm bảo vệ khóa luận'}.
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
                    loading={loading}
                    options={unassignedRegistrationOptions}
                    optionRender={(option) => option.data.desc}
                />
            </Modal>

            {/* Modal Danh sách Sinh viên trong HĐ */}
            <Modal
                title={`Danh sách sinh viên - ${detailCouncil?.name || ''} (${detailCouncil?.councilType === 'OUTLINE_REVIEW' ? 'Thẩm định đề cương' : 'Chấm bảo vệ'})`}
                open={isDetailModalVisible}
                onCancel={() => setIsDetailModalVisible(false)}
                footer={null}
                width={760}
                destroyOnClose
            >
                <List
                    dataSource={detailCouncil?.registrations || []}
                    locale={{ emptyText: 'Chưa có sinh viên được phân công vào hội đồng này.' }}
                    renderItem={(registration) => (
                        <List.Item
                            actions={[
                                <Popconfirm
                                    key="remove"
                                    title="Gỡ sinh viên khỏi hội đồng?"
                                    onConfirm={() => handleRemoveRegistration(detailCouncil.id, registration.id)}
                                    okText="Gỡ"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button size="small" danger>Gỡ</Button>
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs">
                                        {registration.student?.fullName?.[0]?.toUpperCase()}
                                    </div>
                                }
                                title={
                                    <span className="font-bold text-slate-900">
                                        {registration.student?.fullName || 'N/A'}
                                        <span className="text-slate-600 font-medium font-mono ml-2">({registration.student?.code || 'N/A'})</span>
                                    </span>
                                }
                                description={<span className="text-xs text-slate-500">{registration.adjustedTitle || registration.topic?.title || 'Không có đề tài'}</span>}
                            />
                        </List.Item>
                    )}
                />
            </Modal>

            {/* Modal Lịch sử thao tác */}
            <Modal
                title={`Lịch sử thao tác - ${logCouncil?.name || ''}`}
                open={isLogModalVisible}
                onCancel={() => setIsLogModalVisible(false)}
                footer={null}
                width={800}
                destroyOnClose
            >
                <List
                    dataSource={councilLogs}
                    locale={{ emptyText: 'Chưa có nhật ký ghi nhận cho hội đồng này.' }}
                    renderItem={(item) => (
                        <List.Item>
                            <Descriptions column={1} size="small" bordered style={{ width: '100%' }}>
                                <Descriptions.Item label="Thao tác">
                                    <span className="font-bold text-slate-900">{actionTextMap[item.action] || item.action}</span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Người thực hiện">
                                    {item.user?.fullName || 'N/A'} {item.user?.code ? `(${item.user.code})` : ''} - <Tag>{item.user?.role || 'N/A'}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Thời gian">
                                    {item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm:ss') : 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Chi tiết">
                                    <pre className="whitespace-pre-wrap text-xs bg-slate-50 rounded p-2 border border-slate-100 font-mono">
                                        {JSON.stringify(item.details || {}, null, 2)}
                                    </pre>
                                </Descriptions.Item>
                            </Descriptions>
                        </List.Item>
                    )}
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
                        setReopeningCouncil(null);
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
                        Hội đồng: <strong>{reopeningCouncil?.name}</strong>
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

            {/* Modal Xem trước Phân công Tự động HĐ Đề cương (BM01) */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <RobotOutlined className="text-teal-700 text-lg" />
                        <span className="font-bold text-slate-800 text-base">Xem trước Phân công Tự động HĐ Đề cương (BM01)</span>
                    </div>
                }
                open={isPreviewModalVisible}
                onCancel={() => setIsPreviewModalVisible(false)}
                width={900}
                footer={[
                    <Button key="cancel" onClick={() => setIsPreviewModalVisible(false)} disabled={previewConfirmLoading}>
                        Hủy bỏ
                    </Button>,
                    <Button
                        key="confirm"
                        type="primary"
                        loading={previewConfirmLoading}
                        disabled={previewProposedCouncils.some((c) => {
                            const memberIds = (c.members || []).map((m) => m.lecturerId).filter(Boolean);
                            return memberIds.length !== 3 || new Set(memberIds).size !== 3;
                        })}
                        onClick={handleConfirmAutoAssignOutline}
                        className="bg-teal-700 hover:bg-teal-800"
                    >
                        Xác nhận tạo {previewProposedCouncils.length} Hội đồng
                    </Button>,
                ]}
            >
                <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                    {previewWarnings.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Lưu ý hệ thống"
                            description={
                                <ul className="list-disc pl-4 text-xs space-y-1">
                                    {previewWarnings.map((w, idx) => (
                                        <li key={idx}>{w}</li>
                                    ))}
                                </ul>
                            }
                        />
                    )}

                    <div className="text-xs text-slate-700 bg-slate-100 p-3 rounded-lg border border-slate-300 flex items-center justify-between flex-wrap gap-2">
                        <span>
                            Dự kiến tạo: <strong className="text-teal-900 font-bold">{previewProposedCouncils.length}</strong> hội đồng | Tổng sinh viên: <strong className="text-teal-900 font-bold">{previewProposedCouncils.reduce((sum, c) => sum + (c.registrations?.length || 0), 0)}</strong> SV
                        </span>
                        {previewSkippedStudents.length > 0 && (
                            <span className="text-amber-900 font-bold bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                                Bỏ qua: {previewSkippedStudents.length} SV chưa đủ điều kiện
                            </span>
                        )}
                    </div>

                    {previewProposedCouncils.map((council, idx) => {
                        const isExpanded = expandedCouncilIds.has(council.tempId);
                        const excludedIds = new Set((council.excludedMentors || []).map((m) => m.id));
                        const memberIds = (council.members || []).map((m) => m.lecturerId).filter(Boolean);
                        const isDuplicate = memberIds.length !== 3 || new Set(memberIds).size !== 3;

                        // Live conflict check
                        const liveConflicts = [];
                        (council.members || []).forEach((m) => {
                            if (m.lecturerId && excludedIds.has(m.lecturerId)) {
                                const mentorObj = (council.excludedMentors || []).find((em) => em.id === m.lecturerId);
                                liveConflicts.push(mentorObj?.fullName || m.lecturerName || `GV #${m.lecturerId}`);
                            }
                        });

                        const chairman = council.members?.find((m) => m.roleInCouncil === 'CHAIRMAN');
                        const secretary = council.members?.find((m) => m.roleInCouncil === 'SECRETARY');
                        const reviewer = council.members?.find((m) => m.roleInCouncil === 'REVIEWER');

                        return (
                            <div key={council.tempId || idx} className="border-1.5 border-slate-300 rounded-xl p-4 bg-white shadow-xs space-y-3">
                                {/* Header */}
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-teal-950 text-sm">{council.name}</span>
                                            <Tag color="purple" className="text-xs font-bold border border-purple-300">
                                                {council.registrations?.length || 0} sinh viên
                                            </Tag>
                                        </div>
                                        {council.excludedMentors?.length > 0 && (
                                            <div className="text-[11px] text-slate-600 font-medium">
                                                GVHD của SV: <span className="font-bold text-slate-900">{council.excludedMentors.map((m) => m.fullName).join(', ')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        size="small"
                                        type="dashed"
                                        icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                        onClick={() => handleToggleExpandCouncil(council.tempId)}
                                        className="text-xs font-semibold"
                                    >
                                        {isExpanded
                                            ? `Ẩn danh sách sinh viên (${council.registrations?.length || 0})`
                                            : `Xem danh sách sinh viên (${council.registrations?.length || 0})`}
                                    </Button>
                                </div>

                                {/* Expandable student list table */}
                                {isExpanded && (
                                    <div className="border border-slate-300 rounded-lg overflow-hidden my-2">
                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={council.registrations || []}
                                            rowKey="id"
                                            columns={[
                                                {
                                                    title: 'STT',
                                                    key: 'stt',
                                                    width: 50,
                                                    align: 'center',
                                                    render: (_, __, i) => <span className="font-bold text-slate-700">{i + 1}</span>,
                                                },
                                                {
                                                    title: 'MSSV',
                                                    dataIndex: 'studentCode',
                                                    key: 'studentCode',
                                                    width: 110,
                                                    render: (val, r) => (
                                                        <span className="font-mono font-bold text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                            {val || r.student?.code || '—'}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    title: 'Họ và tên',
                                                    dataIndex: 'studentName',
                                                    key: 'studentName',
                                                    width: 160,
                                                    render: (val, r) => (
                                                        <span className="font-bold text-slate-900">
                                                            {val || r.student?.fullName || '—'}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    title: 'Tên đề tài',
                                                    dataIndex: 'topicTitle',
                                                    key: 'topicTitle',
                                                    render: (val, r) => (
                                                        <span className="font-medium text-slate-800">
                                                            {val || r.topic?.title || '—'}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    title: 'Giảng viên HD',
                                                    dataIndex: 'mentorName',
                                                    key: 'mentorName',
                                                    width: 160,
                                                    render: (val, r) => (
                                                        <span className="font-medium text-slate-700">
                                                            {val || r.topic?.mentor?.fullName || r.topic?.lecturer?.fullName || '—'}
                                                        </span>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </div>
                                )}

                                {/* 3 Select inputs for CHAIRMAN, SECRETARY, REVIEWER */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                                    <div className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200">
                                        <label className="block text-[11px] font-bold text-teal-900 uppercase tracking-wider mb-1">
                                            1. Chủ tịch Hội đồng
                                        </label>
                                        <Select
                                            size="small"
                                            className="w-full"
                                            placeholder="Chọn Chủ tịch"
                                            value={chairman?.lecturerId}
                                            onChange={(val) => handlePreviewMemberChange(idx, 'CHAIRMAN', val)}
                                            showSearch
                                            optionFilterProp="label"
                                            options={lecturers.map((l) => ({
                                                value: l.id,
                                                label: `${l.fullName} (${l.code || l.email || ''})`,
                                            }))}
                                        />
                                    </div>

                                    <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                                        <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-1">
                                            2. Thư ký Hội đồng
                                        </label>
                                        <Select
                                            size="small"
                                            className="w-full"
                                            placeholder="Chọn Thư ký"
                                            value={secretary?.lecturerId}
                                            onChange={(val) => handlePreviewMemberChange(idx, 'SECRETARY', val)}
                                            showSearch
                                            optionFilterProp="label"
                                            options={lecturers.map((l) => ({
                                                value: l.id,
                                                label: `${l.fullName} (${l.code || l.email || ''})`,
                                            }))}
                                        />
                                    </div>

                                    <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                                        <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1">
                                            3. UV Phản biện
                                        </label>
                                        <Select
                                            size="small"
                                            className="w-full"
                                            placeholder="Chọn UV Phản biện"
                                            value={reviewer?.lecturerId}
                                            onChange={(val) => handlePreviewMemberChange(idx, 'REVIEWER', val)}
                                            showSearch
                                            optionFilterProp="label"
                                            options={lecturers.map((l) => ({
                                                value: l.id,
                                                label: `${l.fullName} (${l.code || l.email || ''})`,
                                            }))}
                                        />
                                    </div>
                                </div>

                                {/* Inline duplicate lecturer warning */}
                                {isDuplicate && (
                                    <div className="text-rose-900 bg-rose-100 px-3 py-2 rounded-md border border-rose-300 text-xs font-bold">
                                        ⚠️ Mỗi hội đồng phải có đúng 3 giảng viên khác nhau (Chủ tịch, Thư ký, UV Phản biện).
                                    </div>
                                )}

                                {/* Live Conflict Warning */}
                                {liveConflicts.length > 0 && (
                                    <div className="text-amber-950 bg-amber-100 px-3 py-2 rounded-md border border-amber-300 text-xs font-bold">
                                        ⚠️ Có GV {liveConflicts.join(', ')} là GVHD của sinh viên HĐ này
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
}

export default CouncilAssignmentPage;
