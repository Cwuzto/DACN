import { useState } from 'react';
import {
    Tabs, Table, Button, Input, Select, Modal, Form,
    Upload, Tooltip, message, Space, Tag
} from 'antd';
import {
    SearchOutlined, DownloadOutlined, EditOutlined, UploadOutlined,
    FilePdfOutlined, FileExcelOutlined
} from '@ant-design/icons';
import CouncilAssignmentPage from './CouncilAssignmentPage';

const mockGrades = [
    {
        id: '1',
        student: 'Phạm Trọng Phúc',
        code: '2020xxxx',
        topic: 'Hệ thống quản lý đồ án dựa trên AI (Antigravity)',
        instructorScore: 9.5,
        reviewerScore: 9.0,
        councilScore: 9.2,
        finalScore: 9.23,
        status: 'PASSED'
    },
    {
        id: '2',
        student: 'Trần Hữu Khang',
        code: '2020yyyy',
        topic: 'Hệ thống quản lý đồ án dựa trên AI (Antigravity)',
        instructorScore: 9.5,
        reviewerScore: 8.5,
        councilScore: 9.0,
        finalScore: 9.0,
        status: 'PASSED'
    },
    {
        id: '3',
        student: 'Lê Hoàng C',
        code: '2021zzzz',
        topic: 'Nghiên cứu áp dụng Machine Learning trong Y tế dự phòng',
        instructorScore: null,
        reviewerScore: null,
        councilScore: null,
        finalScore: null,
        status: 'ONGOING'
    }
];

function GradingDefensePage() {
    const [grades, setGrades] = useState(mockGrades);
    const [searchText, setSearchText] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGrade, setEditingGrade] = useState(null);
    const [form] = Form.useForm();

    const handleEditScore = (record) => {
        setEditingGrade(record);
        form.setFieldsValue({
            finalScore: record.finalScore,
            reason: ''
        });
        setIsEditModalOpen(true);
    };

    const handleSaveScore = async () => {
        try {
            const values = await form.validateFields();
            if (!values.file || values.file.fileList.length === 0) {
                message.error('Bắt buộc phải tải lên quyết định bằng văn bản!');
                return;
            }
            
            const newGrades = grades.map(g => g.id === editingGrade.id ? { ...g, finalScore: values.finalScore } : g);
            setGrades(newGrades);
            message.success('Đã cập nhật điểm thành công và lưu Audit Log.');
            setIsEditModalOpen(false);
        } catch (error) {
            console.log(error);
        }
    };

    const columns = [
        {
            title: 'Sinh viên',
            dataIndex: 'student',
            key: 'student',
            render: (text, record) => (
                <div>
                    <div className="font-bold text-slate-900">{text}</div>
                    <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{record.code}</code>
                </div>
            )
        },
        {
            title: 'Đề tài',
            dataIndex: 'topic',
            key: 'topic',
            width: 300,
            render: (text) => <span className="text-sm text-slate-600 line-clamp-2">{text}</span>
        },
        { title: 'Điểm HD', dataIndex: 'instructorScore', key: 'instructorScore', align: 'center', render: val => val !== null ? val : '-' },
        { title: 'Điểm PB', dataIndex: 'reviewerScore', key: 'reviewerScore', align: 'center', render: val => val !== null ? val : '-' },
        { title: 'Điểm HĐ', dataIndex: 'councilScore', key: 'councilScore', align: 'center', render: val => val !== null ? val : '-' },
        {
            title: 'Điểm Tổng kết',
            dataIndex: 'finalScore',
            key: 'finalScore',
            align: 'center',
            render: (val) => val !== null ? <span className="font-black text-primary text-base">{val}</span> : '-'
        },
        {
            title: 'Hành động',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                record.finalScore !== null && (
                    <Tooltip title="Điều chỉnh điểm (Exception)">
                        <Button type="text" icon={<EditOutlined />} style={{ color: '#FA8C16' }} onClick={() => handleEditScore(record)} />
                    </Tooltip>
                )
            )
        }
    ];

    const filteredGrades = grades.filter(g => 
        g.student.toLowerCase().includes(searchText.toLowerCase()) || 
        g.code.toLowerCase().includes(searchText.toLowerCase())
    );

    const tabItems = [
        {
            key: 'grades',
            label: 'Bảng điểm Toàn viện',
            children: (
                <div className="pt-4">
                    {/* Filter & Export */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <Input
                            placeholder="Tìm sinh viên, mã số..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 300 }}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                        <Space>
                            <Button icon={<FileExcelOutlined style={{ color: 'green' }} />}>Xuất Excel</Button>
                            <Button icon={<FilePdfOutlined style={{ color: 'red' }} />}>Xuất PDF</Button>
                        </Space>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table 
                            columns={columns} 
                            dataSource={filteredGrades} 
                            rowKey="id" 
                            pagination={{ pageSize: 10 }}
                            size="middle"
                        />
                    </div>
                </div>
            )
        },
        {
            key: 'councils',
            label: 'Quản lý Hội đồng',
            children: (
                <div className="pt-4 border-t border-slate-100 mt-2">
                    <CouncilAssignmentPage />
                </div>
            )
        }
    ];

    return (
        <div className="py-2">
            <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900">Quản lý Điểm & Bảo vệ</h2>
                <p className="text-sm text-slate-500 mt-1">Tổng hợp điểm số, xuất dữ liệu và phần công Hội đồng bảo vệ.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 lg:p-6">
                <Tabs defaultActiveKey="grades" items={tabItems} size="large" />
            </div>

            {/* Modal: Edit Score */}
            <Modal
                title="Điều chỉnh điểm (Ngoại lệ)"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                onOk={handleSaveScore}
                okText="Lưu thay đổi"
                cancelText="Hủy"
            >
                {editingGrade && (
                    <Form form={form} layout="vertical" className="mt-4">
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-4">
                            <p className="font-bold text-slate-900">SV: {editingGrade.student} ({editingGrade.code})</p>
                            <p className="text-sm text-orange-800 mt-1">Điểm hiện tại: <span className="font-bold">{editingGrade.finalScore}</span></p>
                        </div>
                        <Form.Item name="finalScore" label="Điểm mới" rules={[{ required: true, message: 'Nhập điểm mới' }]}>
                            <Input type="number" step="0.1" max="10" min="0" />
                        </Form.Item>
                        <Form.Item name="reason" label="Lý do điều chỉnh (Audit Log)" rules={[{ required: true, message: 'Nhập lý do điều chỉnh' }]}>
                            <Input.TextArea rows={3} placeholder="Ví dụ: Theo quyết định số 123/QĐ-CNTT ngày..." />
                        </Form.Item>
                        <Form.Item name="file" label="Minh chứng văn bản (Bắt buộc)">
                            <Upload beforeUpload={() => false} maxCount={1}>
                                <Button icon={<UploadOutlined />}>Tải lên văn bản/hình ảnh</Button>
                            </Upload>
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </div>
    );
}

export default GradingDefensePage;
