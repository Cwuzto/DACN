const {
    createExcelBuffer,
    parseExcelBuffer,
    generateStudentTemplateBuffer,
    generateLecturerTemplateBuffer,
    generateEnrollmentTemplateBuffer,
    generateStudentErrorExcelBuffer,
} = require('../../src/utils/excelHelper');

describe('excelHelper utility tests', () => {
    test('generateStudentTemplateBuffer creates canonical 8-column, 5-row student template', () => {
        const buffer = generateStudentTemplateBuffer();
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const parsed = parseExcelBuffer(buffer);
        expect(parsed).toHaveLength(5);

        const expectedColumns = [
            'MSSV (*)',
            'Họ và tên (*)',
            'Giới tính (*)',
            'Ngày sinh (*)',
            'Số điện thoại (*)',
            'Lớp (*)',
            'Email (*)',
            'Ngành (*)',
        ];

        // Verify column headers and order on the first row
        expect(Object.keys(parsed[0])).toEqual(expectedColumns);

        // Verify realistic sample data
        expect(parsed[0]['MSSV (*)']).toMatch(/^SV\d{8}$/);
        expect(parsed[0]['Họ và tên (*)']).toBeTruthy();
        expect(['Nam', 'Nữ', 'Khác']).toContain(parsed[0]['Giới tính (*)']);
        expect(parsed[0]['Ngày sinh (*)']).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        expect(parsed[0]['Số điện thoại (*)']).toMatch(/^0\d{9,10}$/);
        expect(parsed[0]['Lớp (*)']).toBeTruthy();
        expect(parsed[0]['Email (*)']).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect(parsed[0]['Ngành (*)']).toBeTruthy();

        // Check that all 5 rows have distinct MSSVs and emails
        const codes = parsed.map((r) => r['MSSV (*)']);
        const emails = parsed.map((r) => r['Email (*)']);
        expect(new Set(codes).size).toBe(5);
        expect(new Set(emails).size).toBe(5);
    });

    test('generateStudentErrorExcelBuffer creates error report workbook with 8 student fields and error info', () => {
        const errorRows = [
            {
                row: 2,
                code: 'SV20260001',
                fullName: 'Nguyen Van A',
                gender: 'Nam',
                dateOfBirth: '15/08/2004',
                phone: '0901234567',
                className: 'D20CNTT01',
                email: 'sv1@tdmu.edu.vn',
                major: 'Ky thuat Phan mem',
                errors: ['Email đã tồn tại trong hệ thống'],
            },
        ];

        const buffer = generateStudentErrorExcelBuffer(errorRows);
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const parsed = parseExcelBuffer(buffer);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toHaveProperty('Dòng trong file', 2);
        expect(parsed[0]).toHaveProperty('MSSV (*)', 'SV20260001');
        expect(parsed[0]).toHaveProperty('Họ và tên (*)', 'Nguyen Van A');
        expect(parsed[0]).toHaveProperty('Giới tính (*)', 'Nam');
        expect(parsed[0]).toHaveProperty('Ngày sinh (*)', '15/08/2004');
        expect(parsed[0]).toHaveProperty('Số điện thoại (*)', '0901234567');
        expect(parsed[0]).toHaveProperty('Lớp (*)', 'D20CNTT01');
        expect(parsed[0]).toHaveProperty('Email (*)', 'sv1@tdmu.edu.vn');
        expect(parsed[0]).toHaveProperty('Ngành (*)', 'Ky thuat Phan mem');
        expect(parsed[0]).toHaveProperty('Chi tiết lỗi', 'Email đã tồn tại trong hệ thống');
    });

    test('generateLecturerTemplateBuffer creates valid xlsx buffer with lecturer columns', () => {
        const buffer = generateLecturerTemplateBuffer();
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const parsed = parseExcelBuffer(buffer);
        expect(parsed.length).toBeGreaterThanOrEqual(2);
        expect(parsed[0]).toHaveProperty('Mã GV (*)');
        expect(parsed[0]).toHaveProperty('Họ và tên (*)');
        expect(parsed[0]).toHaveProperty('Email (*)');
        expect(parsed[0]).toHaveProperty('Học vị (*)');
    });

    test('generateEnrollmentTemplateBuffer creates valid xlsx buffer with enrollment columns', () => {
        const buffer = generateEnrollmentTemplateBuffer();
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const parsed = parseExcelBuffer(buffer);
        expect(parsed.length).toBeGreaterThanOrEqual(2);
        expect(parsed[0]).toHaveProperty('Mã SV (*)');
    });

    test('createExcelBuffer and parseExcelBuffer roundtrip successfully', () => {
        const testData = [
            { 'Mã SV': 'SV01', 'Họ tên': 'Nguyễn A' },
            { 'Mã SV': 'SV02', 'Họ tên': 'Trần B' },
        ];
        const buffer = createExcelBuffer('Sheet1', testData);
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const result = parseExcelBuffer(buffer);
        expect(result).toHaveLength(2);
        expect(result[0]['Mã SV']).toBe('SV01');
        expect(result[0]['Họ tên']).toBe('Nguyễn A');
    });
});
