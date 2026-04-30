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
} from 'antd';
import { CalendarOutlined, DeleteOutlined, EditOutlined, LinkOutlined, TeamOutlined } from '@ant-design/icons';
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
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

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

    const showEditModal = (council) => {
        setEditingCouncil(council);
        councilForm.setFieldsValue({
            name: council.name,
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
            .filter((registration) => registration?.councilId == null)
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
        [unassignedRegistrations],
    );

    const columns = [
        {
            title: 'Hội đồng',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div>
                    <p className="font-bold text-slate-900">{text}</p>
                    <p className="text-xs text-slate-400">{record.location || 'Chưa xếp phòng'}</p>
                </div>
            ),
        },
        {
            title: 'Thành viên',
            key: 'members',
            render: (_, record) => {
                const chairman = record.members?.find((member) => member.roleInCouncil === 'CHAIRMAN')?.lecturer?.fullName;
                const secretary = record.members?.find((member) => member.roleInCouncil === 'SECRETARY')?.lecturer?.fullName;
                const reviewer = record.members?.find((member) => member.roleInCouncil === 'REVIEWER')?.lecturer?.fullName;
                return (
                    <div className="text-xs leading-5">
                        <div><b>CT:</b> {chairman || 'Chưa có'}</div>
                        <div><b>TK:</b> {secretary || 'Chưa có'}</div>
                        <div><b>PB:</b> {reviewer || 'Chưa có'}</div>
                    </div>
                );
            },
        },
        {
            title: 'Ngày bảo vệ',
            dataIndex: 'defenseDate',
            key: 'defenseDate',
            render: (value) => (
                <div className="flex items-center gap-1.5">
                    <CalendarOutlined style={{ color: '#8c8c8c' }} />
                    <span className="text-sm">{value ? dayjs(value).format('DD/MM/YYYY') : 'Chưa xếp'}</span>
                </div>
            ),
        },
        {
            title: 'SV Bảo vệ',
            key: 'registrationCount',
            align: 'center',
            render: (_, record) => <span className="font-bold text-slate-900">{record._count?.registrations || 0}</span>,
        },
        {
            title: 'Phân công',
            key: 'assign',
            align: 'center',
            render: (_, record) => {
                const hasEnoughMembers = (record.members?.length || 0) === 3;
                return (
                    <Space size="small">
                        <Tooltip title="Phân công giảng viên vào vai trò hội đồng">
                            <Button size="small" icon={<TeamOutlined />} onClick={() => showMemberModal(record)}>
                                Thành viên
                            </Button>
                        </Tooltip>
                        <Tooltip title={hasEnoughMembers ? 'Gán sinh viên bảo vệ' : 'Cần phân công đủ 3 vai trò trước'}>
                            <Button type="dashed" size="small" icon={<LinkOutlined />} onClick={() => showAssignModal(record)} disabled={!hasEnoughMembers}>
                                SV
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
            width: 120,
            align: 'center',
            render: (_, record) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button size="small" onClick={() => showLogModal(record)}>Lịch sử</Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)}>Sửa</Button>
                    <Popconfirm
                        title="Xóa hội đồng?"
                        description="Bạn có chắc muốn xóa?"
                        onConfirm={() => handleDeleteCouncil(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} disabled={record._count?.registrations > 0}>Xóa</Button>
                    </Popconfirm>
                </div>
            ),
        },
    ];

    const statsData = [
        { title: 'Tổng Hội đồng', value: councils.length, icon: 'groups_3', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { title: 'Tổng thành viên HĐ', value: councils.reduce((sum, council) => sum + (council.members?.length || 0), 0), icon: 'how_to_reg', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
        { title: 'SV được phân công', value: councils.reduce((sum, council) => sum + (council._count?.registrations || 0), 0), icon: 'assignment', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
    ];

    return (
        <div className="py-2">
            <PageHeader
                title="Phân công Hội đồng"
                subtitle={`${PROJECT_NAME} - theo đợt đồ án mới nhất (gắn với học kỳ, năm học)`}
                actions={(
                    <>
                        <Select
                            value={selectedProjectName}
                            onChange={setSelectedProjectName}
                            style={{ width: 220 }}
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
                        <Button type="primary" onClick={handleAutoAssign} loading={submitLoading} disabled={!selectedSemester}>
                            Phân công tự động
                        </Button>
                    </>
                )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {statsData.map((card, idx) => (
                    <StatCard key={idx} icon={card.icon} iconBg={card.iconBg} iconColor={card.iconColor} label={card.title} value={card.value} />
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table dataSource={councils} columns={columns} pagination={{ pageSize: 10 }} rowKey="id" loading={loading} size="middle" />
            </div>

            <Modal
                title={editingCouncil ? 'Chỉnh sửa thông tin hội đồng' : 'Tạo hội đồng mới'}
                open={isCouncilModalVisible}
                onOk={handleSaveCouncil}
                onCancel={() => setIsCouncilModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <Form form={councilForm} layout="vertical" style={{ marginTop: 16 }}>
                    <div className="grid grid-cols-6 gap-4">
                        <div className="col-span-3">
                            <Form.Item name="name" label="Tên hội đồng" rules={[{ required: true, message: 'Nhập tên' }]}>
                                <Input placeholder="VD: Hội đồng CNTT - 01" />
                            </Form.Item>
                        </div>
                        <div className="col-span-1">
                            <Form.Item name="location" label="Phòng">
                                <Input placeholder="P.301" />
                            </Form.Item>
                        </div>
                        <div className="col-span-2">
                            <Form.Item name="defenseDate" label="Ngày bảo vệ">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </div>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`Phân công thành viên - ${memberCouncil?.name || ''}`}
                open={isMemberModalVisible}
                onOk={handleSaveMembers}
                onCancel={() => setIsMemberModalVisible(false)}
                confirmLoading={submitLoading}
                width={720}
                destroyOnClose
            >
                <Form form={memberForm} layout="vertical" style={{ marginTop: 12 }}>
                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item name="chairman" label="Chủ tịch HĐ" rules={[{ required: true, message: 'Chọn chủ tịch' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item name="secretary" label="Thư ký HĐ" rules={[{ required: true, message: 'Chọn thư ký' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item name="reviewer" label="Phản biện" rules={[{ required: true, message: 'Chọn phản biện' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`Phân công SV vào "${assigningCouncil?.name}"`}
                open={isAssignModalVisible}
                onOk={handleAssignRegistrations}
                onCancel={() => setIsAssignModalVisible(false)}
                confirmLoading={submitLoading}
                width={700}
                destroyOnClose
            >
                <p className="text-sm text-slate-500 mb-4">Chọn các sinh viên chưa được phân công hội đồng.</p>
                <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Chọn sinh viên"
                    value={selectedRegistrationsToAssign}
                    onChange={setSelectedRegistrationsToAssign}
                    optionLabelProp="label"
                    loading={loading}
                    options={unassignedRegistrationOptions}
                    optionRender={(option) => option.data.desc}
                />
            </Modal>

            <Modal
                title={`Danh sách sinh viên - ${detailCouncil?.name || ''}`}
                open={isDetailModalVisible}
                onCancel={() => setIsDetailModalVisible(false)}
                footer={null}
                width={760}
                destroyOnClose
            >
                <List
                    dataSource={detailCouncil?.registrations || []}
                    locale={{ emptyText: 'Chưa có sinh viên được phân công.' }}
                    renderItem={(registration) => (
                        <List.Item
                            actions={[
                                <Popconfirm
                                    key="remove"
                                    title="Gỡ sinh viên khỏi hội đồng?"
                                    onConfirm={() => handleRemoveRegistration(detailCouncil.id, registration.id)}
                                    okText="Gỡ"
                                    cancelText="Hủy"
                                >
                                    <Button size="small" danger>Gỡ</Button>
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                title={`${registration.student?.fullName || 'N/A'} (${registration.student?.code || 'N/A'})`}
                                description={registration.topic?.title || 'Không có đề tài'}
                            />
                        </List.Item>
                    )}
                />
            </Modal>
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
                    locale={{ emptyText: 'Chưa có log cho hội đồng này.' }}
                    renderItem={(item) => (
                        <List.Item>
                            <Descriptions column={1} size="small" bordered style={{ width: '100%' }}>
                                <Descriptions.Item label="Thao tác">
                                    {actionTextMap[item.action] || item.action}
                                </Descriptions.Item>
                                <Descriptions.Item label="Người thao tác">
                                    {item.user?.fullName || 'N/A'} {item.user?.code ? `(${item.user.code})` : ''}
                                </Descriptions.Item>
                                <Descriptions.Item label="Vai trò">
                                    {item.user?.role || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Thời gian">
                                    {item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm:ss') : 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Chi tiết">
                                    <pre className="whitespace-pre-wrap text-xs bg-slate-50 rounded p-2 border border-slate-100">
                                        {JSON.stringify(item.details || {}, null, 2)}
                                    </pre>
                                </Descriptions.Item>
                            </Descriptions>
                        </List.Item>
                    )}
                />
            </Modal>
        </div>
    );
}

export default CouncilAssignmentPage;
