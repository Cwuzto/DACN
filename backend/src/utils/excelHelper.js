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
 * Tạo file mẫu Excel cho Sinh viên (Canonical 8 columns, 5 example rows)
 */
const generateStudentTemplateBuffer = () => {
    const sampleData = [
        {
            'MSSV (*)': 'SV20260001',
            'Họ và tên (*)': 'Nguyễn Văn An',
            'Giới tính (*)': 'Nam',
            'Ngày sinh (*)': '15/08/2004',
            'Số điện thoại (*)': '0901234567',
            'Lớp (*)': 'D20CNTT01',
            'Email (*)': 'sv20260001@student.tdmu.edu.vn',
            'Ngành (*)': 'Kỹ thuật Phần mềm',
        },
        {
            'MSSV (*)': 'SV20260002',
            'Họ và tên (*)': 'Trần Thị Bình',
            'Giới tính (*)': 'Nữ',
            'Ngày sinh (*)': '20/11/2004',
            'Số điện thoại (*)': '0909876543',
            'Lớp (*)': 'D20CNTT02',
            'Email (*)': 'sv20260002@student.tdmu.edu.vn',
            'Ngành (*)': 'Hệ thống Thông tin',
        },
        {
            'MSSV (*)': 'SV20260003',
            'Họ và tên (*)': 'Lê Hoàng Cường',
            'Giới tính (*)': 'Nam',
            'Ngày sinh (*)': '05/03/2003',
            'Số điện thoại (*)': '0912345678',
            'Lớp (*)': 'D20HTTT01',
            'Email (*)': 'sv20260003@student.tdmu.edu.vn',
            'Ngành (*)': 'Công nghệ Thông tin',
        },
        {
            'MSSV (*)': 'SV20260004',
            'Họ và tên (*)': 'Phạm Minh Đức',
            'Giới tính (*)': 'Nam',
            'Ngày sinh (*)': '12/09/2004',
            'Số điện thoại (*)': '0987654321',
            'Lớp (*)': 'D20KTPM01',
            'Email (*)': 'sv20260004@student.tdmu.edu.vn',
            'Ngành (*)': 'Kỹ thuật Phần mềm',
        },
        {
            'MSSV (*)': 'SV20260005',
            'Họ và tên (*)': 'Võ Thị Ánh Nguyệt',
            'Giới tính (*)': 'Nữ',
            'Ngày sinh (*)': '28/02/2003',
            'Số điện thoại (*)': '0933456789',
            'Lớp (*)': 'D20KTPM02',
            'Email (*)': 'sv20260005@student.tdmu.edu.vn',
            'Ngành (*)': 'Khoa học Máy tính',
        },
    ];

    const colWidths = [
        { wch: 16 }, // MSSV (*)
        { wch: 26 }, // Họ và tên (*)
        { wch: 14 }, // Giới tính (*)
        { wch: 16 }, // Ngày sinh (*)
        { wch: 16 }, // Số điện thoại (*)
        { wch: 16 }, // Lớp (*)
        { wch: 34 }, // Email (*)
        { wch: 26 }, // Ngành (*)
    ];

    return createExcelBuffer('Mau_Sinh_Vien', sampleData, colWidths);
};

/**
 * Tạo file Excel chứa các dòng sinh viên bị lỗi
 */
const generateStudentErrorExcelBuffer = (errorRows = []) => {
    const rows = errorRows.map((r) => {
        let genderStr = r.gender || r.gioiTinh || r['Giới tính (*)'] || r['Giới tính'] || '';
        if (genderStr === 'MALE') genderStr = 'Nam';
        else if (genderStr === 'FEMALE') genderStr = 'Nữ';
        else if (genderStr === 'OTHER') genderStr = 'Khác';

        let dobStr = r.dateOfBirth || r.ngaySinh || r['Ngày sinh (*)'] || r['Ngày sinh'] || '';
        if (dobStr instanceof Date) {
            const day = String(dobStr.getUTCDate()).padStart(2, '0');
            const month = String(dobStr.getUTCMonth() + 1).padStart(2, '0');
            const year = dobStr.getUTCFullYear();
            dobStr = `${day}/${month}/${year}`;
        }

        const errDetail = Array.isArray(r.errors)
            ? r.errors.join('; ')
            : r.message || r.error || '';

        return {
            'Dòng trong file': r.rowNumber || r.row || '',
            'MSSV (*)': r.code || r.mssv || r['MSSV (*)'] || r['MSSV'] || '',
            'Họ và tên (*)': r.fullName || r.hoTen || r['Họ và tên (*)'] || r['Họ và tên'] || '',
            'Giới tính (*)': genderStr,
            'Ngày sinh (*)': dobStr,
            'Số điện thoại (*)': r.phone || r.sdt || r['Số điện thoại (*)'] || r['Số điện thoại'] || '',
            'Lớp (*)': r.className || r.lop || r['Lớp (*)'] || r['Lớp'] || '',
            'Email (*)': r.email || r['Email (*)'] || r['Email'] || '',
            'Ngành (*)': r.major || r.nganh || r['Ngành (*)'] || r['Ngành'] || '',
            'Chi tiết lỗi': errDetail,
        };
    });

    const colWidths = [
        { wch: 16 }, // Dòng
        { wch: 16 }, // MSSV (*)
        { wch: 26 }, // Họ và tên (*)
        { wch: 14 }, // Giới tính (*)
        { wch: 16 }, // Ngày sinh (*)
        { wch: 16 }, // Số điện thoại (*)
        { wch: 16 }, // Lớp (*)
        { wch: 34 }, // Email (*)
        { wch: 26 }, // Ngành (*)
        { wch: 40 }, // Chi tiết lỗi
    ];

    return createExcelBuffer('Dong_Sinh_Vien_Loi', rows, colWidths);
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
    generateStudentErrorExcelBuffer,
    generateLecturerTemplateBuffer,
    generateEnrollmentTemplateBuffer,
};
