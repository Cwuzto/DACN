import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
    CheckCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import councilService from '../../services/councilService';
import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { PROJECT_NAME, formatSemesterLabel } from '../../utils/semesterDisplay';

function CouncilAssignmentPage() {
    const [councils, setCouncils] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState(PROJECT_NAME);
    const [councilTypeFilter, setCouncilTypeFilter] = useState('ALL');
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    const [isCouncilModalVisible, setIsCouncilModalVisible] = useState(false);
    const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

    // Batch Bypass states
    const [isBatchBypassModalVisible, setIsBatchBypassModalVisible] = useState(false);
    const [outlineRegistrationsToBypass, setOutlineRegistrationsToBypass] = useState([]);
    const [selectedRegistrationsToBypass, setSelectedRegistrationsToBypass] = useState([]);
    const [bypassReasonInput, setBypassReasonInput] = useState('Được miễn thẩm định đề cương theo quyết định đợt của Viện / Khoa (Đề tài NCKH nghiệm thu)');
    const [isLogModalVisible, setIsLogModalVisible] = useState(false);

    const [editingCouncil, setEditingCouncil] = useState(null);
    const [memberCouncil, setMemberCouncil] = useState(null);
    const [assigningCouncil, setAssigningCouncil] = useState(null);
    const [detailCouncil, setDetailCouncil] = useState(null);
    const [logCouncil, setLogCouncil] = useState(null);
    const [councilLogs, setCouncilLogs] = useState([]);
    const [selectedRegistrationsToAssign, setSelectedRegistrationsToAssign] = useState([]);

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
            const response = await councilService.getCouncils({ semesterId: selectedSemester });
            if (response.success) setCouncils(response.data);
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách hội đồng');
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

    const showCreateModal = () => {
        setEditingCouncil(null);
        councilForm.resetFields();
        councilForm.setFieldsValue({
            councilType: 'DEFENSE_COUNCIL',
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

    const showBatchBypassModal = async () => {
        if (!selectedSemester) return message.warning('Vui lòng chọn đợt đồ án');
        setSelectedRegistrationsToBypass([]);
        try {
            setLoading(true);
            const response = await registrationService.getAllRegistrations({
                semesterId: selectedSemester,
                unassignedCouncilOnly: true,
                councilType: 'OUTLINE_REVIEW',
            });
            if (response.success) {
                setOutlineRegistrationsToBypass(response.data || []);
            }
            setIsBatchBypassModalVisible(true);
        } catch {
            message.error('Lỗi khi tải danh sách sinh viên chưa thẩm định đề cương');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmBatchBypass = async () => {
        if (!selectedRegistrationsToBypass.length) {
            return message.warning('Vui lòng chọn ít nhất 1 sinh viên/đề tài cần miễn thẩm định');
        }
        if (!bypassReasonInput.trim()) {
            return message.warning('Vui lòng nhập lý do miễn thẩm định');
        }
        try {
            setSubmitLoading(true);
            const res = await registrationService.batchBypassOutlineReview(selectedRegistrationsToBypass, bypassReasonInput.trim());
            if (res.success) {
                message.success(res.message || 'Miễn thẩm định đề cương hàng loạt thành công');
                setIsBatchBypassModalVisible(false);
                fetchCouncils();
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi miễn thẩm định đề cương');
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
            await Promise.all([fetchCouncils(), showDetailModal(councilId)]);
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
                label: `${registration.student?.fullName || 'N/A'} - ${registration.student?.code || 'N/A'}`,
                desc: (
                    <div>
                        <span className="font-bold">
                            {registration.student?.fullName || 'N/A'} - {registration.student?.code || 'N/A'}
                        </span>
                        <br />
                        <span className="text-xs text-slate-400">{registration.topic?.title || 'Không có đề tài'}</span>
                    </div>
                ),
            })),
        [unassignedRegistrations, assigningCouncil],
    );

    const filteredCouncils = useMemo(() => {
        if (councilTypeFilter === 'ALL') return councils;
        return councils.filter((c) => c.councilType === councilTypeFilter);
    }, [councils, councilTypeFilter]);

    const columns = [
        {
            title: 'Hội đồng',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{text}</span>
                        <Tag
                            color={record.councilType === 'OUTLINE_REVIEW' ? 'purple' : 'blue'}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        >
                            {record.councilType === 'OUTLINE_REVIEW' ? 'Xét duyệt đề cương' : 'Chấm bảo vệ'}
                        </Tag>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-[14px]">room</span>
                        <span>{record.location || 'Chưa xếp phòng'}</span>
                    </div>
                </div>
            ),
        },
        {
            title: 'Thành phần Hội đồng',
            key: 'members',
            render: (_, record) => {
                const chairman = record.members?.find((member) => member.roleInCouncil === 'CHAIRMAN')?.lecturer?.fullName;
                const secretary = record.members?.find((member) => member.roleInCouncil === 'SECRETARY')?.lecturer?.fullName;
                const reviewer = record.members?.find((member) => member.roleInCouncil === 'REVIEWER')?.lecturer?.fullName;
                const isComplete = (record.members?.length || 0) === 3;

                return (
                    <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">CT</span>
                            <span className={chairman ? 'font-medium text-slate-800' : 'text-slate-400 italic'}>
                                {chairman || 'Chưa phân công'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-1.5 py-0.2 rounded">TK</span>
                            <span className={secretary ? 'font-medium text-slate-800' : 'text-slate-400 italic'}>
                                {secretary || 'Chưa phân công'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded">PB</span>
                            <span className={reviewer ? 'font-medium text-slate-800' : 'text-slate-400 italic'}>
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
                        <span className="font-black text-slate-900 text-sm">{count} SV</span>
                        <div className="w-16 mx-auto bg-slate-100 rounded-full h-1.5">
                            <div
                                className="bg-[#1E3A5F] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Phân công',
            key: 'assign',
            align: 'center',
            width: 200,
            render: (_, record) => {
                const hasEnoughMembers = (record.members?.length || 0) === 3;
                return (
                    <Space size="small">
                        <Tooltip title="Phân công 3 giảng viên vào hội đồng">
                            <Button size="small" icon={<TeamOutlined />} onClick={() => showMemberModal(record)}>
                                Thành viên
                            </Button>
                        </Tooltip>
                        <Tooltip title={hasEnoughMembers ? 'Gán sinh viên vào hội đồng' : 'Cần đủ 3 giảng viên trước'}>
                            <Button
                                type="dashed"
                                size="small"
                                icon={<LinkOutlined />}
                                onClick={() => showAssignModal(record)}
                                disabled={!hasEnoughMembers}
                            >
                                Gán SV
                            </Button>
                        </Tooltip>
                        <Button size="small" onClick={() => showDetailModal(record.id)}>DS SV</Button>
                    </Space>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            align: 'center',
            render: (_, record) => (
                <div className="flex items-center justify-end gap-1.5">
                    <Button size="small" icon={<HistoryOutlined />} onClick={() => showLogModal(record)} />
                    <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)} />
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
            ),
        },
    ];

    const statsData = [
        { label: 'Tổng số Hội đồng', value: councils.length, icon: 'groups_3', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { label: 'Tổng thành viên HĐ', value: councils.reduce((sum, council) => sum + (council.members?.length || 0), 0), icon: 'how_to_reg', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        { label: 'SV đã xếp Hội đồng', value: councils.reduce((sum, council) => sum + (council._count?.registrations || 0), 0), icon: 'assignment_turned_in', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
    ];

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title="Phân công Hội đồng"
                subtitle="Quản lý thành lập hội đồng xét duyệt đề cương (BM01) và hội đồng chấm bảo vệ khóa luận"
                actions={
                    <div className="flex items-center gap-3 flex-wrap">
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 190 }}
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
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={showCreateModal}
                            disabled={!selectedSemester}
                        >
                            Tạo Hội đồng mới
                        </Button>
                        <Button
                            onClick={handleAutoAssign}
                            loading={submitLoading}
                            disabled={!selectedSemester}
                            icon={<span className="material-symbols-outlined text-[16px]">smart_toy</span>}
                        >
                            Tự động phân công
                        </Button>
                    </div>
                }
            />

            {/* 3 Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {statsData.map((card, idx) => (
                    <StatCard key={idx} {...card} />
                ))}
            </div>

            {/* Councils Table Container */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phân loại Hội đồng:</span>
                        <Segmented
                            value={councilTypeFilter}
                            onChange={setCouncilTypeFilter}
                            options={[
                                { label: `Tất cả (${councils.length})`, value: 'ALL' },
                                { label: 'Xét duyệt đề cương (BM01)', value: 'OUTLINE_REVIEW' },
                                { label: 'Chấm bảo vệ (DEFENSE)', value: 'DEFENSE_COUNCIL' },
                            ]}
                        />
                        {councilTypeFilter === 'OUTLINE_REVIEW' && (
                            <Button
                                icon={<ThunderboltOutlined className="text-amber-500" />}
                                onClick={showBatchBypassModal}
                                size="middle"
                                className="font-semibold text-xs border-amber-300 text-amber-700 hover:text-amber-600 bg-amber-50"
                            >
                                Miễn thẩm định hàng loạt
                            </Button>
                        )}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                        Hiển thị {filteredCouncils.length} hội đồng
                    </span>
                </div>

                <Table
                    dataSource={filteredCouncils}
                    columns={columns}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    rowKey="id"
                    loading={loading}
                    size="middle"
                    locale={{
                        emptyText: (
                            <div className="py-12 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 block">groups</span>
                                Chưa có hội đồng nào được tạo trong đợt này.
                            </div>
                        ),
                    }}
                />
            </div>

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
                                <Input placeholder="VD: Hội đồng CNTT - 01" />
                            </Form.Item>
                        </div>
                        <div className="col-span-2">
                            <Form.Item name="councilType" label="Loại hội đồng" rules={[{ required: true, message: 'Chọn loại hội đồng' }]}>
                                <Select
                                    options={[
                                        { label: 'Chấm bảo vệ', value: 'DEFENSE_COUNCIL' },
                                        { label: 'Xét duyệt đề cương', value: 'OUTLINE_REVIEW' },
                                    ]}
                                />
                            </Form.Item>
                        </div>
                        <div className="col-span-3">
                            <Form.Item name="location" label="Phòng họp / Phòng bảo vệ">
                                <Input placeholder="VD: P.301, Nhà C" />
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
                        <Form.Item name="chairman" label="Chủ tịch HĐ" rules={[{ required: true, message: 'Chọn chủ tịch' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item name="secretary" label="Thư ký HĐ" rules={[{ required: true, message: 'Chọn thư ký' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item name="reviewer" label="Phản biện HĐ" rules={[{ required: true, message: 'Chọn phản biện' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* Modal Gán Sinh viên */}
            <Modal
                title={`Phân công SV vào ${assigningCouncil?.councilType === 'OUTLINE_REVIEW' ? 'HĐ Xét duyệt đề cương' : 'HĐ Chấm bảo vệ'} "${assigningCouncil?.name || ''}"`}
                open={isAssignModalVisible}
                onOk={handleAssignRegistrations}
                onCancel={() => setIsAssignModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <div className="mb-4">
                    <p className="text-sm text-slate-700 font-medium">
                        Chọn sinh viên để phân công vào {assigningCouncil?.councilType === 'OUTLINE_REVIEW' ? 'Hội đồng xét duyệt đề cương (BM01)' : 'Hội đồng chấm bảo vệ khóa luận'}.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
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
                title={`Danh sách sinh viên - ${detailCouncil?.name || ''} (${detailCouncil?.councilType === 'OUTLINE_REVIEW' ? 'Xét duyệt đề cương' : 'Chấm bảo vệ'})`}
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
                                    <div className="w-8 h-8 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center font-bold text-xs">
                                        {registration.student?.fullName?.[0]?.toUpperCase()}
                                    </div>
                                }
                                title={
                                    <span className="font-bold text-slate-900">
                                        {registration.student?.fullName || 'N/A'}
                                        <span className="text-slate-400 font-normal font-mono ml-2">({registration.student?.code || 'N/A'})</span>
                                    </span>
                                }
                                description={<span className="text-xs text-slate-500">{registration.topic?.title || 'Không có đề tài'}</span>}
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

            {/* Modal Miễn thẩm định đề cương hàng loạt */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                        <ThunderboltOutlined className="text-amber-500 text-lg" />
                        <span>Miễn Thẩm Định Đề Cương Hàng Loạt (Bypass BM01-BM02)</span>
                    </div>
                }
                open={isBatchBypassModalVisible}
                onOk={handleConfirmBatchBypass}
                confirmLoading={submitLoading}
                okText={`Xác nhận Miễn Thẩm Định (${selectedRegistrationsToBypass.length})`}
                cancelText="Đóng"
                okButtonProps={{
                    className: 'bg-amber-600 hover:bg-amber-500 font-semibold',
                    disabled: selectedRegistrationsToBypass.length === 0,
                }}
                onCancel={() => setIsBatchBypassModalVisible(false)}
                width={850}
            >
                <div className="space-y-4 py-2">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">Đặc quyền Quản trị viên / Viện Trưởng:</span> Chọn các sinh viên/đề tài để bỏ qua bước thẩm định BM01-BM02. Các đề tài được chọn sẽ chuyển thẳng sang trạng thái <strong>Đang thực hiện (IN_PROGRESS)</strong> và tự động sinh mốc BM03.
                    </div>

                    <div>
                        <div className="text-xs font-bold text-slate-700 mb-2">
                            Danh sách sinh viên chưa thẩm định đề cương ({outlineRegistrationsToBypass.length}):
                        </div>
                        <Table
                            dataSource={outlineRegistrationsToBypass}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                            rowSelection={{
                                selectedRowKeys: selectedRegistrationsToBypass,
                                onChange: (selectedKeys) => setSelectedRegistrationsToBypass(selectedKeys),
                            }}
                            columns={[
                                {
                                    title: 'Sinh viên',
                                    key: 'student',
                                    width: 220,
                                    render: (_, r) => (
                                        <div>
                                            <div className="font-semibold text-slate-800">{r.student?.fullName}</div>
                                            <div className="text-xs text-slate-400 font-mono">{r.student?.code}</div>
                                        </div>
                                    ),
                                },
                                {
                                    title: 'Tên đề tài',
                                    key: 'topic',
                                    render: (_, r) => (
                                        <span className="font-medium text-slate-800 text-xs">
                                            {r.topic?.title || '—'}
                                        </span>
                                    ),
                                },
                                {
                                    title: 'GVHD',
                                    key: 'mentor',
                                    width: 180,
                                    render: (_, r) => (
                                        <span className="text-xs text-slate-600">
                                            {r.topic?.mentor?.fullName || '—'}
                                        </span>
                                    ),
                                },
                            ]}
                            locale={{ emptyText: 'Không có sinh viên nào chưa thẩm định đề cương trong đợt này.' }}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Lý do miễn thẩm định chung (*):
                        </label>
                        <Input.TextArea
                            rows={2}
                            value={bypassReasonInput}
                            onChange={(e) => setBypassReasonInput(e.target.value)}
                            placeholder="Nhập lý do miễn thẩm định đề cương cho các đề tài đã chọn..."
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default CouncilAssignmentPage;
