const {
    createExcelBuffer,
    parseExcelBuffer,
    generateStudentTemplateBuffer,
    generateLecturerTemplateBuffer,
    generateEnrollmentTemplateBuffer,
} = require('../../src/utils/excelHelper');

describe('excelHelper utility tests', () => {
    test('generateStudentTemplateBuffer creates valid xlsx buffer with student columns', () => {
        const buffer = generateStudentTemplateBuffer();
        expect(Buffer.isBuffer(buffer)).toBe(true);

        const parsed = parseExcelBuffer(buffer);
        expect(parsed.length).toBeGreaterThanOrEqual(2);
        expect(parsed[0]).toHaveProperty('Mã SV (*)');
        expect(parsed[0]).toHaveProperty('Họ và tên (*)');
        expect(parsed[0]).toHaveProperty('Email (*)');
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
