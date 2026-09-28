const XLSX = require('xlsx');

/**
 * Tạo workbook và trả về Buffer .xlsx
 */
const createExcelBuffer = (sheetName, data, columnWidths = []) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    if (columnWidths && columnWidths.length > 0) {
        ws['!cols'] = columnWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Đọc buffer file Excel và parse ra mảng JSON
 */
const parseExcelBuffer = (buffer) => {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];

    const ws = wb.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Chuẩn hóa và làm sạch chuỗi
    return rawRows.map((row) => {
        const cleaned = {};
        for (const [key, value] of Object.entries(row)) {
            const cleanKey = String(key).trim();
            const cleanVal = typeof value === 'string' ? value.trim() : value;
            cleaned[cleanKey] = cleanVal === '' ? null : cleanVal;
        }
        return cleaned;
    });
};

/**
 * Tạo file mẫu Excel cho Sinh viên
 */
const generateStudentTemplateBuffer = () => {
    const sampleData = [
        {
            'Mã SV (*)': 'SV20260001',
            'Họ và tên (*)': 'Nguyễn Văn A',
            'Email (*)': 'sv20260001@student.tdmu.edu.vn',
            'Số điện thoại': '0901234567',
            'Bộ môn / Khoa': 'Bộ môn Công nghệ Phần mềm',
        },
        {
            'Mã SV (*)': 'SV20260002',
            'Họ và tên (*)': 'Trần Thị B',
            'Email (*)': 'sv20260002@student.tdmu.edu.vn',
            'Số điện thoại': '0909876543',
            'Bộ môn / Khoa': 'Bộ môn Hệ thống Thông tin',
        },
    ];

    const colWidths = [
        { wch: 16 }, // Mã SV
        { wch: 26 }, // Họ tên
        { wch: 36 }, // Email
        { wch: 16 }, // SĐT
        { wch: 32 }, // Bộ môn
    ];

    return createExcelBuffer('Mau_Sinh_Vien', sampleData, colWidths);
};

/**
 * Tạo file mẫu Excel cho Giảng viên
 */
const generateLecturerTemplateBuffer = () => {
    const sampleData = [
        {
            'Mã GV (*)': 'GV202601',
            'Họ và tên (*)': 'TS. Lê Văn C',
            'Email (*)': 'levanc@tdmu.edu.vn',
            'Số điện thoại': '0912345678',
            'Bộ môn / Khoa': 'Bộ môn Công nghệ Phần mềm',
            'Học vị (*)': 'Tiến sĩ', // Chấp nhận: Thạc sĩ, Tiến sĩ, Phó Giáo sư (hoặc THAC_SI, TIEN_SI, PHO_GIAO_SU)
            'SV Tối Đa (Quota)': 15,
        },
        {
            'Mã GV (*)': 'GV202602',
            'Họ và tên (*)': 'ThS. Phạm Thị D',
            'Email (*)': 'phamthid@tdmu.edu.vn',
            'Số điện thoại': '0987654321',
            'Bộ môn / Khoa': 'Bộ môn Mạng Máy tính',
            'Học vị (*)': 'Thạc sĩ',
            'SV Tối Đa (Quota)': 10,
        },
    ];

    const colWidths = [
        { wch: 16 }, // Mã GV
        { wch: 26 }, // Họ tên
        { wch: 32 }, // Email
        { wch: 16 }, // SĐT
        { wch: 32 }, // Bộ môn
        { wch: 18 }, // Học vị
        { wch: 20 }, // Quota
    ];

    return createExcelBuffer('Mau_Giang_Vien', sampleData, colWidths);
};

/**
 * Tạo file mẫu Excel cho Gán Môn Đồ Án
 */
const generateEnrollmentTemplateBuffer = () => {
    const sampleData = [
        {
            'Mã SV (*)': 'SV20260001',
            'Ghi chú': 'Đủ điều kiện làm đồ án chuyên ngành',
        },
        {
            'Mã SV (*)': 'SV20260002',
            'Ghi chú': 'Đủ điều kiện làm đồ án chuyên ngành',
        },
    ];

    const colWidths = [
        { wch: 18 }, // Mã SV
        { wch: 40 }, // Ghi chú
    ];

    return createExcelBuffer('Mau_Gan_Mon_Do_An', sampleData, colWidths);
};

module.exports = {
    createExcelBuffer,
    parseExcelBuffer,
    generateStudentTemplateBuffer,
    generateLecturerTemplateBuffer,
    generateEnrollmentTemplateBuffer,
};
