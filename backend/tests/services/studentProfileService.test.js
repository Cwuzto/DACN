const { Prisma, PrismaClient, StudentGender } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
    normalizeStudentPayload,
    validateStudentPayload,
} = require('../../src/services/studentProfileService');

describe('Student profile Prisma contract', () => {
    const profile = Prisma.dmmf.datamodel.models.find((model) => model.name === 'StudentProfile');
    const user = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User');

    test('exports all supported student genders for profile consumers', () => {
        expect(StudentGender).toEqual(expect.objectContaining({
            MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER',
        }));
    });

    test('exposes a studentProfile delegate for persistence', async () => {
        // Construct the real client without opening a database connection.
        const prisma = new PrismaClient({
            adapter: new PrismaPg({ connectionString: 'postgresql://localhost/student_profile_contract' }),
        });

        try {
            expect(prisma.studentProfile).toBeDefined();
            expect(typeof prisma.studentProfile?.upsert).toBe('function');
        } finally {
            await prisma.$disconnect();
        }
    });

    test('exposes the profile fields and database column mapping for consumers', () => {
        expect(profile).toBeDefined();
        expect(profile?.dbName).toBe('student_profiles');
        expect(profile?.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'studentId', type: 'Int', dbName: 'student_id' }),
            expect.objectContaining({ name: 'gender', type: 'StudentGender', kind: 'enum' }),
            expect.objectContaining({ name: 'dateOfBirth', type: 'DateTime', dbName: 'date_of_birth' }),
            expect.objectContaining({ name: 'className', type: 'String', dbName: 'class_name' }),
            expect.objectContaining({ name: 'major', type: 'String' }),
            expect.objectContaining({ name: 'createdAt', type: 'DateTime', dbName: 'created_at' }),
            expect.objectContaining({ name: 'updatedAt', type: 'DateTime', dbName: 'updated_at' }),
        ]));
    });

    test('exposes reciprocal profile and user relations', () => {
        expect(profile?.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'student', type: 'User', kind: 'object', relationName: 'StudentProfileToUser',
            }),
        ]));
        expect(user.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'studentProfile', type: 'StudentProfile', kind: 'object', relationName: 'StudentProfileToUser' }),
        ]));
    });
});

describe('studentProfileService payload normalization and validation', () => {
    const validStudentInput = {
        code: 'sv20260001',
        fullName: '  Nguyen Van A  ',
        email: '  Student.A@School.EDU.VN ',
        phone: '  0912345678  ',
        gender: 'Nam',
        dateOfBirth: '15/05/2002',
        className: '  D20PM01  ',
        major: '  Ky thuat phan mem  ',
    };

    describe('normalizeStudentPayload', () => {
        test('normalizes case, whitespace, gender and strict DD/MM/YYYY date', () => {
            const normalized = normalizeStudentPayload(validStudentInput);

            expect(normalized.user).toEqual({
                code: 'SV20260001',
                fullName: 'Nguyen Van A',
                email: 'student.a@school.edu.vn',
                phone: '0912345678',
                role: 'STUDENT',
                department: null,
            });
            expect(normalized.studentProfile.gender).toBe('MALE');
            expect(normalized.studentProfile.className).toBe('D20PM01');
            expect(normalized.studentProfile.major).toBe('Ky thuat phan mem');
            expect(normalized.studentProfile.dateOfBirth).toBeInstanceOf(Date);
            expect(normalized.studentProfile.dateOfBirth.toISOString().startsWith('2002-05-15')).toBe(true);
        });

        test('maps Vietnamese and English gender strings to StudentGender enum', () => {
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'Nam' }).studentProfile.gender).toBe('MALE');
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'male' }).studentProfile.gender).toBe('MALE');
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'Nữ' }).studentProfile.gender).toBe('FEMALE');
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'female' }).studentProfile.gender).toBe('FEMALE');
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'Khác' }).studentProfile.gender).toBe('OTHER');
            expect(normalizeStudentPayload({ ...validStudentInput, gender: 'other' }).studentProfile.gender).toBe('OTHER');
        });

        test('supports aliases mssv, hoTen, sdt, lop, nganh', () => {
            const aliasedInput = {
                mssv: 'SV20260002',
                hoTen: 'Tran Thi B',
                email: 'b@school.edu.vn',
                sdt: '0987654321',
                gioiTinh: 'Nữ',
                ngaySinh: '20/10/2003',
                lop: 'D20HT01',
                nganh: 'He thong thong tin',
            };
            const normalized = normalizeStudentPayload(aliasedInput);

            expect(normalized.user.code).toBe('SV20260002');
            expect(normalized.user.fullName).toBe('Tran Thi B');
            expect(normalized.user.phone).toBe('0987654321');
            expect(normalized.studentProfile.gender).toBe('FEMALE');
            expect(normalized.studentProfile.className).toBe('D20HT01');
            expect(normalized.studentProfile.major).toBe('He thong thong tin');
        });
    });

    describe('validateStudentPayload', () => {
        test('passes valid payload and returns structured user and studentProfile', () => {
            const validated = validateStudentPayload(validStudentInput);
            expect(validated.user.code).toBe('SV20260001');
            expect(validated.studentProfile.gender).toBe('MALE');
        });

        test('rejects missing or blank MSSV', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, code: '' })).toThrow(/Mã số sinh viên/i);
            expect(() => validateStudentPayload({ ...validStudentInput, code: null })).toThrow(/Mã số sinh viên/i);
        });

        test('rejects missing or blank fullName', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, fullName: '   ' })).toThrow(/Họ và tên/i);
        });

        test('rejects missing or invalid email', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, email: '' })).toThrow(/Email là bắt buộc/i);
            expect(() => validateStudentPayload({ ...validStudentInput, email: 'not-an-email' })).toThrow(/Email không hợp lệ/i);
        });

        test('rejects missing or blank phone', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, phone: '' })).toThrow(/Số điện thoại/i);
        });

        test('rejects invalid or missing gender', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, gender: '' })).toThrow(/Giới tính là bắt buộc/i);
            expect(() => validateStudentPayload({ ...validStudentInput, gender: 'InvalidGender' })).toThrow(/Giới tính không hợp lệ/i);
        });

        test('rejects missing, invalid format, impossible calendar date or future date of birth', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, dateOfBirth: '' })).toThrow(/Ngày sinh là bắt buộc/i);
            expect(() => validateStudentPayload({ ...validStudentInput, dateOfBirth: '2002-05-15' })).toThrow(/Ngày sinh không hợp lệ/i);
            expect(() => validateStudentPayload({ ...validStudentInput, dateOfBirth: '31/02/2002' })).toThrow(/Ngày sinh không hợp lệ/i);
            expect(() => validateStudentPayload({ ...validStudentInput, dateOfBirth: '01/01/2099' })).toThrow(/Ngày sinh phải là ngày trong quá khứ/i);
        });

        test('rejects missing or blank className', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, className: '' })).toThrow(/Lớp là bắt buộc/i);
        });

        test('rejects missing or blank major', () => {
            expect(() => validateStudentPayload({ ...validStudentInput, major: '' })).toThrow(/Ngành là bắt buộc/i);
        });

        test('supports non-throwing mode returning error array for batch imports', () => {
            const result = validateStudentPayload({ ...validStudentInput, email: 'bad', gender: 'unknown' }, { throwOnError: false });
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });
    });
});

