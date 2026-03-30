import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table, Tag, Button, Tooltip, Select, Modal, Form, Input, DatePicker, message, Popconfirm, Space
} from 'antd';
import {
    PlusOutlined, CalendarOutlined, EditOutlined, DeleteOutlined, LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import councilService from '../../services/councilService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';
import registrationService from '../../services/registrationService';

function CouncilAssignmentPage() {
    const [councils, setCouncils] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [unassignedRegistrations, setUnassignedRegistrations] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isCouncilModalVisible, setIsCouncilModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [editingCouncil, setEditingCouncil] = useState(null);
    const [assigningCouncil, setAssigningCouncil] = useState(null);
    const [selectedRegistrationsToAssign, setSelectedRegistrationsToAssign] = useState([]);
    const [form] = Form.useForm();

    const fetchSemesters = async () => {
        try { const res = await semesterService.getAll(); if (res.success && res.data.length > 0) { setSemesters(res.data); if (!selectedSemester) setSelectedSemester(res.data[0].id); } }
        catch { message.error('Lỗi khi tải danh sách học kỳ'); }
    };

    const fetchLecturers = async () => {
        try { const res = await userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 }); if (res.success) setLecturers(res.data); }
        catch { message.error('Lỗi khi tải danh sách giảng viên'); }
    };

    const fetchCouncils = useCallback(async () => {
        if (!selectedSemester) return;
        setLoading(true);
        try { const res = await councilService.getCouncils({ semesterId: selectedSemester }); if (res.success) setCouncils(res.data); }
        catch (error) { message.error(error.message || 'Lỗi khi tải danh sách hội đồng'); }
        finally { setLoading(false); }
    }, [selectedSemester]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchSemesters(); fetchLecturers(); }, []);
    useEffect(() => { fetchCouncils(); }, [fetchCouncils]);

    const showCreateModal = () => { setEditingCouncil(null); form.resetFields(); form.setFieldsValue({ semesterId: selectedSemester }); setIsCouncilModalVisible(true); };

    const showEditModal = (council) => {
        setEditingCouncil(council);
        const chairman = council.members.find(m => m.roleInCouncil === 'CHAIRMAN')?.lecturerId;
        const secretary = council.members.find(m => m.roleInCouncil === 'SECRETARY')?.lecturerId;
        const reviewers = council.members.filter(m => m.roleInCouncil === 'REVIEWER').map(m => m.lecturerId);
        const members = council.members.filter(m => m.roleInCouncil === 'MEMBER').map(m => m.lecturerId);
        form.setFieldsValue({ name: council.name, location: council.location, defenseDate: council.defenseDate ? dayjs(council.defenseDate) : null, chairman, secretary, reviewers, members });
        setIsCouncilModalVisible(true);
    };

    const handleSaveCouncil = async () => {
        try {
            const values = await form.validateFields(); setSubmitLoading(true);
            const builtMembers = [];
            if (values.chairman) builtMembers.push({ lecturerId: values.chairman, roleInCouncil: 'CHAIRMAN' });
            if (values.secretary) builtMembers.push({ lecturerId: values.secretary, roleInCouncil: 'SECRETARY' });
            if (values.reviewers?.length) values.reviewers.forEach(id => builtMembers.push({ lecturerId: id, roleInCouncil: 'REVIEWER' }));
            if (values.members?.length) values.members.forEach(id => builtMembers.push({ lecturerId: id, roleInCouncil: 'MEMBER' }));
            const payload = { semesterId: selectedSemester, name: values.name, location: values.location, defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null, members: builtMembers };
            if (editingCouncil) { await councilService.updateCouncil(editingCouncil.id, payload); message.success('Cập nhật hội đồng thành công'); }
            else { await councilService.createCouncil(payload); message.success('Tạo hội đồng thành công'); }
            setIsCouncilModalVisible(false); fetchCouncils();
        } catch (error) { if (error.message) message.error(error.message); } finally { setSubmitLoading(false); }
    };

    const handleDeleteCouncil = async (id) => {
        try { const res = await councilService.deleteCouncil(id); if (res.success) { message.success('Xóa hội đồng thành công'); fetchCouncils(); } }
        catch (error) { message.error(error.message || 'Lỗi khi xóa hội đồng'); }
    };

    const showAssignModal = async (council) => {
        setAssigningCouncil(council); setSelectedRegistrationsToAssign([]);
        try { 
            setLoading(true); 
            const res = await registrationService.getAllRegistrations({ semesterId: selectedSemester, unassignedCouncilOnly: true }); 
            if (res.success) setUnassignedRegistrations(res.data); 
            setIsAssignModalVisible(true); 
        }
        catch { message.error('Lỗi khi tải danh sách sinh viên chưa phân công'); } finally { setLoading(false); }
    };

    const handleAssignRegistrations = async () => {
        if (!selectedRegistrationsToAssign?.length) return message.warning('Vui lòng chọn ít nhất 1 sinh viên');
        try { setSubmitLoading(true); await councilService.assignRegistrations(assigningCouncil.id, selectedRegistrationsToAssign); message.success('Phân công thành công'); setIsAssignModalVisible(false); fetchCouncils(); }
        catch (error) { message.error(error.message || 'Lỗi phân công'); } finally { setSubmitLoading(false); }
    };

    const lecturerOptions = useMemo(() => lecturers.map(l => ({ label: `${l.fullName} (${l.code})`, value: l.id })), [lecturers]);

    const columns = [
        {
            title: 'Hội đồng', dataIndex: 'name', key: 'name',
            render: (text, record) => (<div><p className="font-bold text-slate-900">{text}</p><p className="text-xs text-slate-400">{record.location || 'Chưa xếp phòng'}</p></div>),
        },
        {
            title: 'Chủ tịch HĐ', key: 'chairman',
            render: (_, record) => {
                const chairman = record.members?.find(m => m.roleInCouncil === 'CHAIRMAN')?.lecturer;
                if (!chairman) return <span className="text-slate-400 text-sm">Chưa chọn</span>;
                return (<div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">{chairman.fullName[0]}</div><span className="text-sm">{chairman.fullName}</span></div>);
            },
        },
        {
            title: 'Ngày bảo vệ', dataIndex: 'defenseDate', key: 'defenseDate',
            render: (text) => (<div className="flex items-center gap-1.5"><CalendarOutlined style={{ color: '#8c8c8c' }} /><span className="text-sm">{text ? dayjs(text).format('DD/MM/YYYY') : 'Chưa xếp'}</span></div>),
        },
        {
            title: 'Thành viên', key: 'memberCount', align: 'center',
            render: (_, record) => <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{record.members?.length || 0} người</span>,
        },
        {
            title: 'SV Bảo vệ', key: 'groupCount', align: 'center',
            render: (_, record) => <span className="font-bold text-slate-900">{record._count?.evaluations || 0}</span>,
        },
        {
            title: 'Phân SV', key: 'assign', align: 'center',
            render: (_, record) => (
                <Tooltip title="Gán sinh viên bảo vệ"><Button type="dashed" size="small" icon={<LinkOutlined />} onClick={() => showAssignModal(record)}>Phân công</Button></Tooltip>
            ),
        },
        {
            title: 'Hành động', key: 'action', width: 120, align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Chỉnh sửa"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)} style={{ color: '#003366' }} /></Tooltip>
                    <Popconfirm title="Xóa hội đồng?" description="Bạn có chắc muốn xóa?" onConfirm={() => handleDeleteCouncil(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
                        <Tooltip title="Xóa"><Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={record._count?.evaluations > 0} /></Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const statsData = [
        { title: 'Tổng Hội đồng', value: councils.length, icon: 'groups_3', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { title: 'Tổng thành viên HĐ', value: councils.reduce((sum, c) => sum + (c.members?.length || 0), 0), icon: 'how_to_reg', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
        { title: 'SV được phân công', value: councils.reduce((sum, c) => sum + (c._count?.evaluations || 0), 0), icon: 'assignment', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
    ];

    return (
        <div className="py-2">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Phân công Hội đồng</h2>
                    <p className="text-sm text-slate-500 mt-1">Quản lý và phân công hội đồng bảo vệ đồ án</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedSemester} onChange={setSelectedSemester} style={{ width: 200 }}
                        options={semesters.map(s => ({ value: s.id, label: s.name }))} loading={semesters.length === 0} placeholder="Chọn học kỳ" />
                    <button onClick={showCreateModal} disabled={!selectedSemester}
                        className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Tạo hội đồng
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {statsData.map((card, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                                <span className={`material-symbols-outlined ${card.iconColor}`}>{card.icon}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</p>
                        </div>
                        <p className="text-3xl font-black text-slate-900">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table dataSource={councils} columns={columns} pagination={{ pageSize: 10 }} rowKey="id" loading={loading} size="middle" />
            </div>

            {/* Modal: Tạo / Sửa Hội đồng */}
            <Modal title={editingCouncil ? 'Chỉnh sửa Hội đồng' : 'Tạo Hội đồng mới'} open={isCouncilModalVisible}
                onOk={handleSaveCouncil} onCancel={() => setIsCouncilModalVisible(false)} confirmLoading={submitLoading} width={700} destroyOnClose>
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <div className="grid grid-cols-6 gap-4">
                        <div className="col-span-3"><Form.Item name="name" label="Tên hội đồng" rules={[{ required: true, message: 'Nhập tên' }]}><Input placeholder="VD: Hội đồng CNTT - 01" /></Form.Item></div>
                        <div className="col-span-1"><Form.Item name="location" label="Phòng"><Input placeholder="P. 301" /></Form.Item></div>
                        <div className="col-span-2"><Form.Item name="defenseDate" label="Ngày bảo vệ"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="chairman" label="Chủ tịch HĐ" rules={[{ required: true, message: 'Chọn chủ tịch' }]}>
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                        <Form.Item name="secretary" label="Thư ký HĐ">
                            <Select showSearch placeholder="Chọn giảng viên" optionFilterProp="label" options={lecturerOptions} />
                        </Form.Item>
                    </div>
                    <Form.Item name="reviewers" label="Ủy viên / Phản biện">
                        <Select mode="multiple" showSearch placeholder="Chọn GV phản biện" optionFilterProp="label" options={lecturerOptions} />
                    </Form.Item>
                    <Form.Item name="members" label="Ủy viên khác">
                        <Select mode="multiple" showSearch placeholder="Chọn GV ủy viên" optionFilterProp="label" options={lecturerOptions} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal: Phân công SV */}
            <Modal title={`Phân công SV vào "${assigningCouncil?.name}"`} open={isAssignModalVisible}
                onOk={handleAssignRegistrations} onCancel={() => setIsAssignModalVisible(false)} confirmLoading={submitLoading} width={700} destroyOnClose>
                <p className="text-sm text-slate-500 mb-4">Chọn các sinh viên chưa được phân công hội đồng.</p>
                <Select mode="multiple" style={{ width: '100%' }} placeholder="Chọn sinh viên" value={selectedRegistrationsToAssign}
                    onChange={setSelectedRegistrationsToAssign} optionLabelProp="label" loading={loading}
                    options={unassignedRegistrations.map(r => ({
                        value: r.id, label: `${r.student?.fullName} - ${r.topic?.title?.substring(0, 30)}...`,
                        desc: <div><span className="font-bold">{r.student?.fullName}</span><br /><span className="text-xs text-slate-400">{r.topic?.title}</span></div>
                    }))}
                    optionRender={(option) => option.data.desc}
                />
            </Modal>
        </div>
    );
}

export default CouncilAssignmentPage;
