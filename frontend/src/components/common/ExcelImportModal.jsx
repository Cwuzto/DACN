import React, { useState, useMemo } from 'react';
import { Modal, Button, Radio, Table, Tag, Tooltip, message, Select, Input, Form } from 'antd';
import {
    CloudUploadOutlined,
    FileExcelOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
    EditOutlined,
    ExportOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ExcelImportModal({
    open,
    onCancel,
    onSuccess,
    type = 'STUDENT', // 'STUDENT' | 'LECTURER' | 'PROJECT_ENROLLMENT'
    semesters = [],
    catalogs = [],
    onDownloadTemplate,
    onExecuteImport,
}) {
    const [fileList, setFileList] = useState([]);
    const [parsedRows, setParsedRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'VALID' | 'ERROR'
    const [onDuplicate, setOnDuplicate] = useState('SKIP');
    const [isDragging, setIsDragging] = useState(false);

    // Dành cho PROJECT_ENROLLMENT
    const [selectedSemesterId, setSelectedSemesterId] = useState(semesters[0]?.id || null);
    const [selectedCatalogId, setSelectedCatalogId] = useState(catalogs[0]?.id || null);
    const [batchId, setBatchId] = useState('');

    // Sửa nhanh dòng lỗi (Quick Fix Modal)
    const [editingRow, setEditingRow] = useState(null);
    const [editForm] = Form.useForm();

    const resetState = () => {
        setFileList([]);
        setParsedRows([]);
        setFilterTab('ALL');
        setLoading(false);
        setEditingRow(null);
    };

    const handleClose = () => {
        resetState();
        onCancel();
    };

    // Tiêu đề modal
    const modalTitle = useMemo(() => {
        if (type === 'STUDENT') return 'Import Danh sách Sinh viên từ Excel';
        if (type === 'LECTURER') return 'Import Danh sách Giảng viên từ Excel';
        return 'Gán Sinh viên Môn Đồ Án từ Excel';
    }, [type]);

    // Validate 1 row độc lập
    const validateRow = (row) => {
        const errors = [];
        const code = String(row.code || '').trim().toUpperCase();
        const fullName = String(row.fullName || '').trim();
        const email = String(row.email || '').trim().toLowerCase();

        if (!code) {
            errors.push('Thiếu mã số');
        }

        if (type === 'STUDENT' || type === 'LECTURER') {
            if (!fullName) {
                errors.push('Thiếu họ và tên');
            }
            if (!email) {
                errors.push('Thiếu email');
            } else if (!EMAIL_REGEX.test(email)) {
                errors.push('Email không đúng định dạng');
            }
        }

        return errors;
    };

    // Hàm đọc và validate buffer file Excel
    const processExcelData = (dataBuffer) => {
        try {
            const data = new Uint8Array(dataBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                message.error('File Excel không có trang tính (sheet) nào.');
                return;
            }

            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rawData || rawData.length === 0) {
                message.warning('File Excel rỗng, không tìm thấy dữ liệu.');
                return;
            }

            const seenCodes = new Set();
            const seenEmails = new Set();

            const processed = rawData.map((row, idx) => {
                const rowNumber = idx + 1;
                const errors = [];

                // Chuẩn hóa tên cột
                const code = String(
                    row['Mã SV (*)'] ||
                    row['Mã GV (*)'] ||
                    row['Mã SV'] ||
                    row['Mã GV'] ||
                    row['Mã số'] ||
                    row['MSSV'] ||
                    row['MSGV'] ||
                    row.code ||
                    row.studentCode ||
                    ''
                ).trim().toUpperCase();

                const fullName = String(
                    row['Họ và tên (*)'] ||
                    row['Họ và tên'] ||
                    row['Họ tên'] ||
                    row['Tên SV'] ||
                    row['Tên GV'] ||
                    row.fullName ||
                    ''
                ).trim();

                const email = String(
                    row['Email (*)'] ||
                    row['Email'] ||
                    row.email ||
                    ''
                ).trim().toLowerCase();

                const phone = String(row['Số điện thoại'] || row['SĐT'] || row.phone || '').trim();
                const department = String(row['Bộ môn / Khoa'] || row['Bộ môn'] || row['Khoa'] || row.department || '').trim();
                const academicTitle = String(row['Học vị (*)'] || row['Học vị'] || row['Học hàm'] || row.academicTitle || '').trim();
                const quota = row['SV Tối Đa (Quota)'] || row.maxStudents || null;
                const note = String(row['Ghi chú'] || row.note || '').trim();

                // Validation Rules
                if (!code) {
                    errors.push('Thiếu mã số');
                } else if (seenCodes.has(code)) {
                    errors.push('Mã số bị trùng trong file');
                } else {
                    seenCodes.add(code);
                }

                if (type === 'STUDENT' || type === 'LECTURER') {
                    if (!fullName) {
                        errors.push('Thiếu họ và tên');
                    }

                    if (!email) {
                        errors.push('Thiếu email');
                    } else if (!EMAIL_REGEX.test(email)) {
                        errors.push('Email không đúng định dạng');
                    } else if (seenEmails.has(email)) {
                        errors.push('Email bị trùng trong file');
                    } else {
                        seenEmails.add(email);
                    }
                }

                return {
                    key: `row-${idx}`,
                    rowNumber,
                    code,
                    fullName,
                    email,
                    phone,
                    department,
                    academicTitle,
                    quota,
                    note,
                    isValid: errors.length === 0,
                    errors,
                };
            });

            setParsedRows(processed);
            message.success(`Đã phân tích thành công ${processed.length} dòng dữ liệu.`);
        } catch (err) {
            console.error('Excel parse error:', err);
            message.error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.');
        }
    };

    // Xử lý kéo thả file
    const handleFileDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        setFileList([file]);
        const reader = new FileReader();
        reader.onload = (evt) => processExcelData(evt.target.result);
        reader.readAsArrayBuffer(file);
    };

    // Xử lý chọn file thông thường
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileList([file]);
        const reader = new FileReader();
        reader.onload = (evt) => processExcelData(evt.target.result);
        reader.readAsArrayBuffer(file);
    };

    // Tự động tạo file mẫu Excel phía client
    const handleDownloadClientTemplate = () => {
        if (onDownloadTemplate) {
            onDownloadTemplate();
            return;
        }

        const wb = XLSX.utils.book_new();
        let sampleData = [];
        let sheetName = 'Du_Lieu_Mau';

        if (type === 'STUDENT') {
            sampleData = [
                {
                    'Mã SV (*)': 'SV2026001',
                    'Họ và tên (*)': 'Nguyễn Văn An',
                    'Email (*)': 'sv2026001@student.tdmu.edu.vn',
                    'Số điện thoại': '0901234567',
                    'Bộ môn / Khoa': 'Kỹ thuật Phần mềm',
                    'Ghi chú': 'Đủ điều kiện làm ĐATN',
                },
                {
                    'Mã SV (*)': 'SV2026002',
                    'Họ và tên (*)': 'Trần Thị Bình',
                    'Email (*)': 'sv2026002@student.tdmu.edu.vn',
                    'Số điện thoại': '0907654321',
                    'Bộ môn / Khoa': 'Hệ thống Thông tin',
                    'Ghi chú': '',
                },
            ];
        } else if (type === 'LECTURER') {
            sampleData = [
                {
                    'Mã GV (*)': 'GV001234',
                    'Họ và tên (*)': 'TS. Lê Hoàng Nam',
                    'Email (*)': 'namlh@tdmu.edu.vn',
                    'Số điện thoại': '0912345678',
                    'Bộ môn / Khoa': 'Khoa học Máy tính',
                    'Học vị (*)': 'TIEN_SI',
                    'Ghi chú': 'Hướng nghiên cứu AI & Cloud',
                },
                {
                    'Mã GV (*)': 'GV001235',
                    'Họ và tên (*)': 'ThS. Phạm Thu Trang',
                    'Email (*)': 'trangpt@tdmu.edu.vn',
                    'Số điện thoại': '0918765432',
                    'Bộ môn / Khoa': 'Mạng & An ninh Thông tin',
                    'Học vị (*)': 'THAC_SI',
                    'Ghi chú': 'Hướng nghiên cứu An ninh Mạng',
                },
            ];
        } else {
            sampleData = [
                {
                    'Mã SV (*)': 'SV2026001',
                    'Ghi chú': 'Lớp D20CNTT01',
                },
                {
                    'Mã SV (*)': 'SV2026002',
                    'Ghi chú': 'Lớp D20CNTT02',
                },
            ];
        }

        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Xuất file
        const filename = type === 'STUDENT'
            ? 'Mau_Import_Sinh_Vien.xlsx'
            : type === 'LECTURER'
            ? 'Mau_Import_Giang_Vien.xlsx'
            : 'Mau_Gan_Lop_Do_An.xlsx';

        XLSX.writeFile(wb, filename);
        message.success(`Đã tạo và tải xuống file mẫu "${filename}"`);
    };

    // Xuất các dòng bị lỗi thành file Excel để gửi sửa
    const handleExportErrorRows = () => {
        const errorRows = parsedRows.filter((r) => !r.isValid);
        if (errorRows.length === 0) {
            message.info('Không có dòng lỗi nào để xuất.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const exportData = errorRows.map((r) => ({
            'Dòng trong file': r.rowNumber,
            'Mã số': r.code,
            'Họ và tên': r.fullName,
            'Email': r.email,
            'Số điện thoại': r.phone,
            'Bộ môn / Khoa': r.department,
            'Ghi chú': r.note,
            'Chi tiết lỗi': r.errors.join('; '),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Dong_Bi_Loi');
        XLSX.writeFile(wb, `Danh_sach_dong_loi_${Date.now()}.xlsx`);
        message.success(`Đã xuất ${errorRows.length} dòng lỗi ra file Excel.`);
    };

    // Mở modal sửa nhanh 1 dòng
    const handleOpenEdit = (record) => {
        setEditingRow(record);
        editForm.setFieldsValue({
            code: record.code,
            fullName: record.fullName,
            email: record.email,
            phone: record.phone,
            department: record.department,
            academicTitle: record.academicTitle,
            note: record.note,
        });
    };

    // Lưu sửa nhanh
    const handleSaveEdit = (values) => {
        if (!editingRow) return;

        const updatedRows = parsedRows.map((r) => {
            if (r.key === editingRow.key) {
                const updatedItem = {
                    ...r,
                    code: String(values.code || '').trim().toUpperCase(),
                    fullName: String(values.fullName || '').trim(),
                    email: String(values.email || '').trim().toLowerCase(),
                    phone: String(values.phone || '').trim(),
                    department: String(values.department || '').trim(),
                    academicTitle: String(values.academicTitle || '').trim(),
                    note: String(values.note || '').trim(),
                };

                // Re-validate row
                const errors = validateRow(updatedItem);
                return {
                    ...updatedItem,
                    isValid: errors.length === 0,
                    errors,
                };
            }
            return r;
        });

        setParsedRows(updatedRows);
        setEditingRow(null);
        message.success(`Đã cập nhật dòng số ${editingRow.rowNumber}.`);
    };

    // Lọc dòng hiển thị
    const filteredRows = useMemo(() => {
        if (filterTab === 'VALID') return parsedRows.filter((r) => r.isValid);
        if (filterTab === 'ERROR') return parsedRows.filter((r) => !r.isValid);
        return parsedRows;
    }, [parsedRows, filterTab]);

    const stats = useMemo(() => {
        const total = parsedRows.length;
        const valid = parsedRows.filter((r) => r.isValid).length;
        const error = total - valid;
        return { total, valid, error };
    }, [parsedRows]);

    // Thực hiện Import
    const handleSubmit = async () => {
        const validRows = parsedRows.filter((r) => r.isValid);
        if (validRows.length === 0) {
            message.warning('Không có dòng dữ liệu hợp lệ nào để import.');
            return;
        }

        if (type === 'PROJECT_ENROLLMENT') {
            if (!selectedSemesterId || !selectedCatalogId) {
                message.error('Vui lòng chọn Học kỳ và Tên đồ án.');
                return;
            }
        }

        try {
            setLoading(true);
            let payload;

            if (type === 'PROJECT_ENROLLMENT') {
                payload = {
                    semesterId: selectedSemesterId,
                    projectCatalogId: selectedCatalogId,
                    importBatchId: batchId.trim() || undefined,
                    items: validRows.map((r) => ({
                        studentCode: r.code,
                        note: r.note,
                    })),
                };
            } else {
                payload = {
                    role: type,
                    onDuplicate,
                    items: validRows.map((r) => ({
                        code: r.code,
                        fullName: r.fullName,
                        email: r.email,
                        phone: r.phone || null,
                        department: r.department || null,
                        academicTitle: r.academicTitle || null,
                    })),
                };
            }

            const res = await onExecuteImport(payload);
            if (res?.success) {
                message.success(res.message || 'Import dữ liệu thành công!');
                handleClose();
                if (onSuccess) onSuccess();
            } else {
                message.error(res?.message || 'Import thất bại.');
            }
        } catch (error) {
            message.error(error?.message || 'Đã có lỗi xảy ra trong quá trình import.');
        } finally {
            setLoading(false);
        }
    };

    // Columns cho Table Preview
    const columns = useMemo(() => {
        const base = [
            {
                title: 'Dòng',
                dataIndex: 'rowNumber',
                key: 'rowNumber',
                width: 60,
                align: 'center',
                render: (val) => <span className="text-slate-400 font-mono text-xs">{val}</span>,
            },
            {
                title: 'Trạng thái',
                dataIndex: 'isValid',
                key: 'isValid',
                width: 105,
                render: (isValid, record) =>
                    isValid ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                            Hợp lệ
                        </Tag>
                    ) : (
                        <Tooltip title={record.errors.join('; ')}>
                            <Tag color="error" icon={<CloseCircleOutlined />} className="cursor-help">
                                Lỗi ({record.errors.length})
                            </Tag>
                        </Tooltip>
                    ),
            },
            {
                title: 'Mã số',
                dataIndex: 'code',
                key: 'code',
                width: 110,
                render: (code) => (
                    <code className="text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        {code || '(Trống)'}
                    </code>
                ),
            },
        ];

        if (type === 'STUDENT' || type === 'LECTURER') {
            base.push(
                {
                    title: 'Họ và tên',
                    dataIndex: 'fullName',
                    key: 'fullName',
                    width: 160,
                    render: (name) => <span className="font-medium text-slate-800 text-xs">{name || '—'}</span>,
                },
                {
                    title: 'Email',
                    dataIndex: 'email',
                    key: 'email',
                    width: 190,
                    render: (email) => <span className="text-slate-600 text-xs font-mono">{email || '—'}</span>,
                },
                {
                    title: 'Bộ môn / Khoa',
                    dataIndex: 'department',
                    key: 'department',
                    width: 150,
                    render: (dept) => <span className="text-slate-600 text-xs">{dept || '—'}</span>,
                }
            );

            if (type === 'LECTURER') {
                base.push({
                    title: 'Học vị',
                    dataIndex: 'academicTitle',
                    key: 'academicTitle',
                    width: 100,
                    render: (title) => (
                        <Tag color="blue" className="text-[11px]">
                            {title || 'ThS'}
                        </Tag>
                    ),
                });
            }
        }

        if (type === 'PROJECT_ENROLLMENT') {
            base.push({
                title: 'Ghi chú',
                dataIndex: 'note',
                key: 'note',
                render: (note) => <span className="text-slate-500 text-xs">{note || '—'}</span>,
            });
        }

        base.push({
            title: 'Chi tiết lỗi',
            key: 'errors',
            width: 170,
            render: (_, record) =>
                record.errors.length > 0 ? (
                    <span className="text-xs text-rose-600 font-medium">
                        {record.errors.join(', ')}
                    </span>
                ) : (
                    <span className="text-xs text-slate-400">—</span>
                ),
        });

        // Cột Thao tác (Sửa nhanh)
        base.push({
            title: 'Sửa',
            key: 'action',
            width: 65,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="Chỉnh sửa nhanh dòng này">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(record)}
                        className="text-slate-500 hover:text-primary"
                    />
                </Tooltip>
            ),
        });

        return base;
    }, [type]);

    return (
        <Modal
            title={
                <div className="flex items-center justify-between pr-6">
                    <div className="flex items-center gap-2">
                        <FileExcelOutlined className="text-emerald-600 text-lg" />
                        <span className="font-bold text-slate-800 text-base">{modalTitle}</span>
                    </div>
                    <Button
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadClientTemplate}
                        className="text-emerald-700 font-semibold"
                    >
                        Tải file mẫu Excel (.xlsx)
                    </Button>
                </div>
            }
            open={open}
            onCancel={handleClose}
            width={1000}
            footer={null}
            destroyOnHidden
        >
            <div className="py-2 space-y-4">
                {/* Dành cho PROJECT_ENROLLMENT: Chọn Học kỳ và Đồ án */}
                {type === 'PROJECT_ENROLLMENT' && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Học kỳ (*)</label>
                            <Select
                                className="w-full"
                                placeholder="Chọn học kỳ"
                                value={selectedSemesterId}
                                onChange={(val) => setSelectedSemesterId(val)}
                                options={semesters.map((s) => ({ label: s.name, value: s.id }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Tên Đồ án (*)</label>
                            <Select
                                className="w-full"
                                placeholder="Chọn tên đồ án"
                                value={selectedCatalogId}
                                onChange={(val) => setSelectedCatalogId(val)}
                                options={catalogs.map((c) => ({ label: `${c.name} (${c.code})`, value: c.id }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Mã đợt import (Tùy chọn)</label>
                            <Input
                                placeholder="VD: BATCH_2026_HK1"
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Khu vực Tải file lên - Hỗ trợ Kéo Thả Dropzone */}
                {parsedRows.length === 0 ? (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                        className={`border-2 border-dashed rounded-2xl p-9 text-center transition-all duration-200 ${
                            isDragging
                                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
                        }`}
                    >
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="hidden"
                            id="excel-file-input"
                        />
                        <label
                            htmlFor="excel-file-input"
                            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                <CloudUploadOutlined className="text-3xl" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 mt-2">
                                Nhấp để chọn file hoặc kéo thả file Excel vào đây
                            </p>
                            <p className="text-xs text-slate-400">
                                Định dạng được hỗ trợ: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code> (Dung lượng tối đa 10MB)
                            </p>
                        </label>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Thống kê & Filter */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500">Xem:</span>
                                <button
                                    onClick={() => setFilterTab('ALL')}
                                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                                        filterTab === 'ALL'
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Tất cả ({stats.total})
                                </button>
                                <button
                                    onClick={() => setFilterTab('VALID')}
                                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                                        filterTab === 'VALID'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                >
                                    Hợp lệ ({stats.valid})
                                </button>
                                {stats.error > 0 && (
                                    <button
                                        onClick={() => setFilterTab('ERROR')}
                                        className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${
                                            filterTab === 'ERROR'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                        }`}
                                    >
                                        Có lỗi ({stats.error})
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {stats.error > 0 && (
                                    <Button
                                        size="small"
                                        danger
                                        icon={<ExportOutlined />}
                                        onClick={handleExportErrorRows}
                                    >
                                        Xuất dòng lỗi ({stats.error})
                                    </Button>
                                )}
                                {type !== 'PROJECT_ENROLLMENT' && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-500">Nếu trùng:</span>
                                        <Radio.Group
                                            value={onDuplicate}
                                            onChange={(e) => setOnDuplicate(e.target.value)}
                                            size="small"
                                        >
                                            <Radio.Button value="SKIP">Bỏ qua</Radio.Button>
                                            <Radio.Button value="UPDATE">Cập nhật</Radio.Button>
                                        </Radio.Group>
                                    </div>
                                )}
                                <Button
                                    size="small"
                                    icon={<ReloadOutlined />}
                                    onClick={resetState}
                                >
                                    Chọn file khác
                                </Button>
                            </div>
                        </div>

                        {/* Bảng Xem Trước */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <Table
                                dataSource={filteredRows}
                                columns={columns}
                                size="small"
                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                scroll={{ x: 800, y: 320 }}
                            />
                        </div>
                    </div>
                )}

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <InfoCircleOutlined />
                        <span>Mật khẩu mặc định của người dùng mới tạo sẽ là <strong>Mã số</strong>.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleClose}>Hủy</Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={loading}
                            disabled={stats.valid === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                        >
                            Xác nhận Import ({stats.valid} dòng hợp lệ)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal Sửa Nhanh Dòng Lỗi (Quick Fix Inline Modal) */}
            <Modal
                title={`Chỉnh sửa nhanh dòng số ${editingRow?.rowNumber || ''}`}
                open={Boolean(editingRow)}
                onCancel={() => setEditingRow(null)}
                onOk={() => editForm.submit()}
                okText="Cập nhật & Kiểm tra lại"
                cancelText="Đóng"
                destroyOnHidden
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleSaveEdit}
                    className="mt-4"
                >
                    <Form.Item
                        name="code"
                        label="Mã số (*)"
                        rules={[{ required: true, message: 'Vui lòng nhập mã số' }]}
                    >
                        <Input placeholder="Mã số" />
                    </Form.Item>

                    {(type === 'STUDENT' || type === 'LECTURER') && (
                        <>
                            <Form.Item
                                name="fullName"
                                label="Họ và tên (*)"
                                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                            >
                                <Input placeholder="Họ và tên" />
                            </Form.Item>

                            <Form.Item
                                name="email"
                                label="Email (*)"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập email' },
                                    { type: 'email', message: 'Email không đúng định dạng' },
                                ]}
                            >
                                <Input placeholder="Email" />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-3">
                                <Form.Item name="phone" label="Số điện thoại">
                                    <Input placeholder="Số điện thoại" />
                                </Form.Item>
                                <Form.Item name="department" label="Bộ môn / Khoa">
                                    <Input placeholder="Bộ môn / Khoa" />
                                </Form.Item>
                            </div>

                            {type === 'LECTURER' && (
                                <Form.Item name="academicTitle" label="Học vị">
                                    <Select
                                        options={[
                                            { label: 'Thạc sĩ (THAC_SI)', value: 'THAC_SI' },
                                            { label: 'Tiến sĩ (TIEN_SI)', value: 'TIEN_SI' },
                                            { label: 'Phó Giáo sư (PHO_GIAO_SU)', value: 'PHO_GIAO_SU' },
                                            { label: 'Giáo sư (GIAO_SU)', value: 'GIAO_SU' },
                                        ]}
                                    />
                                </Form.Item>
                            )}
                        </>
                    )}

                    <Form.Item name="note" label="Ghi chú">
                        <Input.TextArea rows={2} placeholder="Ghi chú" />
                    </Form.Item>
                </Form>
            </Modal>
        </Modal>
    );
}
