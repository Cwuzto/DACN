import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Form,
    Input,
    Modal,
    Space,
    Table,
    Tabs,
    Tooltip,
    Upload,
    message,
} from 'antd';
import {
    EditOutlined,
    FileExcelOutlined,
    FilePdfOutlined,
    SearchOutlined,
    UploadOutlined,
} from '@ant-design/icons';

import CouncilAssignmentPage from './CouncilAssignmentPage';
import evaluationService from '../../services/evaluationService';
import uploadService from '../../services/uploadService';

const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
};

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

function GradingDefensePage() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadedScoresheetUrl, setUploadedScoresheetUrl] = useState('');
    const [form] = Form.useForm();

    const fetchGradingStudents = async () => {
        try {
            setLoading(true);
            const response = await evaluationService.getGradingStudents();
            if (response.success) setRegistrations(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách chấm điểm');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGradingStudents();
    }, []);

    const handleEditScore = (record) => {
        setEditingRecord(record);
        setUploadedScoresheetUrl(record.defenseResult?.scoresheetUrl || '');
        form.setFieldsValue({
            finalScore: record.finalScore,
            comments: record.defenseResult?.comments || '',
        });
        setIsEditModalOpen(true);
    };

    const handleUploadScoresheet = async ({ file, onSuccess, onError }) => {
        try {
            setUploading(true);
            const response = await uploadService.uploadFile(file, 'scoresheets');
            if (response.success) {
                setUploadedScoresheetUrl(response.data.url);
                message.success('Đã tải lên bảng điểm');
                onSuccess('ok');
                return;
            }
            onError(new Error(response.message || 'Upload failed'));
        } catch (error) {
            onError(error);
            message.error(error?.message || 'Không thể tải lên bảng điểm');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveScore = async () => {
        try {
            const values = await form.validateFields();
            if (!editingRecord) return;

            setSubmitting(true);
            const response = await evaluationService.submitDefenseResult({
                registrationId: editingRecord.id,
                finalScore: Number(values.finalScore),
                comments: values.comments || '',
                scoresheetUrl: uploadedScoresheetUrl || null,
            });

            if (response.success) {
                message.success('Đã cập nhật điểm bảo vệ thành công');
                setIsEditModalOpen(false);
                fetchGradingStudents();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật điểm');
        } finally {
            setSubmitting(false);
        }
    };

    const tableData = useMemo(
        () =>
            registrations.map((item) => ({
                id: item.id,
                student: item.student?.fullName || 'Sinh viên',
                code: item.student?.code || '',
                topic: item.topic?.title || '',
                council: item.council?.name || 'Chưa phân hội đồng',
                finalScore: item.finalScore,
                gradingStatus: item.gradingStatus,
                defenseResult: item.defenseResult,
            })),
        [registrations]
    );

    const filteredData = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return tableData;
        return tableData.filter(
            (item) =>
                item.student.toLowerCase().includes(keyword) ||
                item.code.toLowerCase().includes(keyword) ||
                item.topic.toLowerCase().includes(keyword)
        );
    }, [searchText, tableData]);

    const handleExportExcel = () => {
        const headers = ['Sinh viên', 'Mã số', 'Đề tài', 'Hội đồng', 'Trạng thái chấm', 'Điểm tổng kết'];
        const rows = filteredData.map((item) => [
            item.student,
            item.code,
            item.topic,
            item.council,
            item.gradingStatus,
            item.finalScore ?? '',
        ]);

        const csvContent = [headers, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `grading-defense-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success('Đã xuất file Excel (CSV UTF-8)');
    };

    const handleExportPdf = () => {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
        if (!printWindow) {
            message.error('Không mở được cửa sổ in PDF');
            return;
        }

        const rowsHtml = filteredData
            .map(
                (item) => `
                <tr>
                    <td>${item.student}</td>
                    <td>${item.code}</td>
                    <td>${item.topic}</td>
                    <td>${item.council}</td>
                    <td>${item.gradingStatus}</td>
                    <td style="text-align:right;">${item.finalScore ?? '-'}</td>
                </tr>
            `
            )
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Bảng điểm bảo vệ</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; }
                        h1 { margin: 0 0 8px; font-size: 20px; }
                        p { margin: 0 0 16px; color: #555; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
                        th { background: #f5f5f5; text-align: left; }
                    </style>
                </head>
                <body>
                    <h1>Bảng điểm bảo vệ</h1>
                    <p>Ngày xuất: ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Sinh viên</th>
                                <th>Mã số</th>
                                <th>Đề tài</th>
                                <th>Hội đồng</th>
                                <th>Trạng thái chấm</th>
                                <th>Điểm tổng kết</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        message.success('Đã mở chế độ in, chọn Save as PDF để lưu');
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
            ),
        },
        {
            title: 'Đề tài',
            dataIndex: 'topic',
            key: 'topic',
            width: 340,
            render: (text) => <span className="text-sm text-slate-600 line-clamp-2">{text}</span>,
        },
        {
            title: 'Hội đồng',
            dataIndex: 'council',
            key: 'council',
            width: 180,
        },
        {
            title: 'Trạng thái chấm',
            dataIndex: 'gradingStatus',
            key: 'gradingStatus',
            width: 140,
            render: (value) =>
                normalizeText(value).includes('da cham') ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        Đã chấm
                    </span>
                ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                        Chưa chấm
                    </span>
                ),
        },
        {
            title: 'Điểm tổng kết',
            dataIndex: 'finalScore',
            key: 'finalScore',
            align: 'center',
            width: 120,
            render: (value) =>
                value !== null && value !== undefined ? (
                    <span className="font-black text-primary text-base">{value}</span>
                ) : (
                    '-'
                ),
        },
        {
            title: 'Hành động',
            key: 'actions',
            align: 'right',
            width: 120,
            render: (_, record) => (
                <Tooltip title="Cập nhật điểm / biên bản">
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        style={{ color: '#FA8C16' }}
                        onClick={() => handleEditScore(record)}
                    />
                </Tooltip>
            ),
        },
    ];

    const tabItems = [
        {
            key: 'grades',
            label: 'Bảng điểm toàn viện',
            children: (
                <div className="pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <Input
                            placeholder="Tìm sinh viên, mã số, đề tài..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 320 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                        />
                        <Space>
                            <Button icon={<FileExcelOutlined style={{ color: 'green' }} />} onClick={handleExportExcel}>
                                Xuất Excel
                            </Button>
                            <Button icon={<FilePdfOutlined style={{ color: 'red' }} />} onClick={handleExportPdf}>
                                Xuất PDF
                            </Button>
                        </Space>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table
                            loading={loading}
                            columns={columns}
                            dataSource={filteredData}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            size="middle"
                        />
                    </div>
                </div>
            ),
        },
        {
            key: 'councils',
            label: 'Quản lý hội đồng',
            children: (
                <div className="pt-4 border-t border-slate-100 mt-2">
                    <CouncilAssignmentPage />
                </div>
            ),
        },
    ];

    return (
        <div className="py-2">
            <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900">Quản lý điểm và bảo vệ</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Tổng hợp điểm số, cập nhật kết quả bảo vệ và phân công hội đồng.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 lg:p-6">
                <Tabs defaultActiveKey="grades" items={tabItems} size="large" />
            </div>

            <Modal
                title="Cập nhật điểm bảo vệ"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                onOk={handleSaveScore}
                okText="Lưu thay đổi"
                cancelText="Hủy"
                confirmLoading={submitting}
            >
                {editingRecord && (
                    <Form form={form} layout="vertical" className="mt-4">
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-4">
                            <p className="font-bold text-slate-900">
                                SV: {editingRecord.student} ({editingRecord.code})
                            </p>
                            <p className="text-sm text-orange-800 mt-1">
                                Điểm hiện tại: <span className="font-bold">{editingRecord.finalScore ?? '-'}</span>
                            </p>
                        </div>

                        <Form.Item
                            name="finalScore"
                            label="Điểm mới"
                            rules={[
                                { required: true, message: 'Nhập điểm mới' },
                                {
                                    validator: (_, value) => {
                                        if (value === undefined || value === null || value === '') {
                                            return Promise.resolve();
                                        }
                                        const n = Number(value);
                                        if (Number.isNaN(n) || n < 0 || n > 10) {
                                            return Promise.reject(new Error('Điểm phải trong khoảng 0-10'));
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Input type="number" step="0.1" max="10" min="0" />
                        </Form.Item>

                        <Form.Item name="comments" label="Nhận xét">
                            <Input.TextArea rows={3} placeholder="Nhập nhận xét của hội đồng..." />
                        </Form.Item>

                        <Form.Item label="Bảng điểm/Minh chứng">
                            <Upload
                                customRequest={handleUploadScoresheet}
                                maxCount={1}
                                showUploadList={false}
                                accept="image/*,.pdf"
                            >
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                    Tải lên bảng điểm
                                </Button>
                            </Upload>
                            {uploadedScoresheetUrl && (
                                <a
                                    className="inline-block mt-2 text-primary"
                                    href={uploadedScoresheetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Xem file đã tải lên
                                </a>
                            )}
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </div>
    );
}

export default GradingDefensePage;
