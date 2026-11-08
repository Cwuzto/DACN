const mockPrisma = {
    user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    studentProfile: {
        create: jest.fn(),
        upsert: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => {
        if (typeof callback === 'function') {
            return callback(mockPrisma);
        }
        return callback;
    }),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const userController = require('../../src/controllers/userController');
const { parseExcelBuffer } = require('../../src/utils/excelHelper');

describe('userController Excel Import & Export', () => {
    let req, res, next;

    const validStudentRow = {
        'MSSV (*)': 'SV20260001',
        'Họ và tên (*)': 'Nguyen Van A',
        'Giới tính (*)': 'Nam',
        'Ngày sinh (*)': '15/08/2004',
        'Số điện thoại (*)': '0901234567',
        'Lớp (*)': 'D20CNTT01',
        'Email (*)': 'sv20260001@student.tdmu.edu.vn',
        'Ngành (*)': 'Kỹ thuật Phần mềm',
    };

    const validStudentRow2 = {
        'MSSV (*)': 'SV20260002',
        'Họ và tên (*)': 'Tran Thi B',
        'Giới tính (*)': 'Nữ',
        'Ngày sinh (*)': '20/11/2004',
        'Số điện thoại (*)': '0909876543',
        'Lớp (*)': 'D20CNTT02',
        'Email (*)': 'sv20260002@student.tdmu.edu.vn',
        'Ngành (*)': 'Hệ thống Thông tin',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            query: {},
            body: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    describe('downloadUserTemplate', () => {
        test('returns canonical 8-column student template buffer by default', async () => {
            req.query = { role: 'STUDENT' };
            await userController.downloadUserTemplate(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res.send).toHaveBeenCalled();
            const buffer = res.send.mock.calls[0][0];
            const parsed = parseExcelBuffer(buffer);
            expect(parsed).toHaveLength(5);
            expect(parsed[0]).toHaveProperty('MSSV (*)');
            expect(parsed[0]).toHaveProperty('Giới tính (*)');
            expect(parsed[0]).toHaveProperty('Ngày sinh (*)');
            expect(parsed[0]).toHaveProperty('Lớp (*)');
            expect(parsed[0]).toHaveProperty('Ngành (*)');
        });
    });

    describe('importUsersExcel - Student All-or-Nothing Import', () => {
        test('creates all users and student profiles atomically when 100% of rows are valid', async () => {
            req.body = {
                role: 'STUDENT',
                items: [validStudentRow, validStudentRow2],
                onDuplicate: 'SKIP',
            };

            mockPrisma.user.findMany.mockResolvedValue([]);
            mockPrisma.user.create
                .mockResolvedValueOnce({ id: 101, code: 'SV20260001' })
                .mockResolvedValueOnce({ id: 102, code: 'SV20260002' });

            await userController.importUsersExcel(req, res, next);

            expect(mockPrisma.user.findMany).toHaveBeenCalled();
            expect(mockPrisma.$transaction).toHaveBeenCalled();
            expect(mockPrisma.user.create).toHaveBeenCalledTimes(2);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        total: 2,
                        createdCount: 2,
                        updatedCount: 0,
                        errors: [],
                    }),
                })
            );
        });

        test('supports Excel serial date format for date of birth', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    {
                        ...validStudentRow,
                        'Ngày sinh (*)': 38214, // serial date approx Aug 15, 2004
                    },
                ],
                onDuplicate: 'SKIP',
            };

            mockPrisma.user.findMany.mockResolvedValue([]);
            mockPrisma.user.create.mockResolvedValue({ id: 101, code: 'SV20260001' });

            await userController.importUsersExcel(req, res, next);

            expect(mockPrisma.user.create).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        total: 1,
                        createdCount: 1,
                        errors: [],
                    }),
                })
            );
        });

        test('returns HTTP 400 and performs ZERO database writes when ANY row is missing required fields', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    validStudentRow, // valid row
                    {
                        ...validStudentRow2,
                        'MSSV (*)': '', // missing MSSV
                    },
                ],
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            row: 2,
                            message: expect.stringContaining('Mã số sinh viên'),
                        }),
                    ]),
                })
            );

            // ZERO database writes must occur
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
            expect(mockPrisma.studentProfile.upsert).not.toHaveBeenCalled();
        });

        test('returns HTTP 400 and zero writes when date of birth is invalid or in the future', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    {
                        ...validStudentRow,
                        'Ngày sinh (*)': '2004-08-15', // not DD/MM/YYYY
                    },
                    {
                        ...validStudentRow2,
                        'Ngày sinh (*)': '15/08/2099', // future date
                    },
                ],
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({ row: 1, message: expect.stringContaining('Ngày sinh không hợp lệ') }),
                        expect.objectContaining({ row: 2, message: expect.stringContaining('quá khứ') }),
                    ]),
                })
            );
        });

        test('returns HTTP 400 and zero writes when gender is unrecognized', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    {
                        ...validStudentRow,
                        'Giới tính (*)': 'UnknownGender',
                    },
                ],
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({ row: 1, message: expect.stringContaining('Giới tính không hợp lệ') }),
                    ]),
                })
            );
        });

        test('returns HTTP 400 and zero writes when duplicate MSSV or email exists within the file itself', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    validStudentRow,
                    {
                        ...validStudentRow2,
                        'MSSV (*)': validStudentRow['MSSV (*)'], // duplicate MSSV in file
                    },
                ],
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            row: 2,
                            message: expect.stringContaining('trùng lặp trong file import'),
                        }),
                    ]),
                })
            );
        });

        test('returns HTTP 400 and zero writes when duplicate MSSV or email exists in DB under SKIP mode', async () => {
            req.body = {
                role: 'STUDENT',
                items: [validStudentRow],
                onDuplicate: 'SKIP',
            };

            mockPrisma.user.findMany.mockResolvedValue([
                { id: 99, code: validStudentRow['MSSV (*)'], email: 'other@school.edu.vn' },
            ]);

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            row: 1,
                            message: expect.stringContaining('đã tồn tại trong hệ thống'),
                        }),
                    ]),
                })
            );
        });

        test('in UPDATE mode, successfully updates user and student profile when all 8 fields are provided', async () => {
            req.body = {
                role: 'STUDENT',
                items: [validStudentRow],
                onDuplicate: 'UPDATE',
            };

            mockPrisma.user.findMany.mockResolvedValue([
                { id: 99, code: validStudentRow['MSSV (*)'], email: validStudentRow['Email (*)'] },
            ]);
            mockPrisma.user.update.mockResolvedValue({ id: 99 });
            mockPrisma.studentProfile.upsert.mockResolvedValue({ studentId: 99 });

            await userController.importUsersExcel(req, res, next);

            expect(mockPrisma.$transaction).toHaveBeenCalled();
            expect(mockPrisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 99 },
                })
            );
            expect(mockPrisma.studentProfile.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { studentId: 99 },
                    create: expect.objectContaining({
                        gender: 'MALE',
                        className: 'D20CNTT01',
                        major: 'Kỹ thuật Phần mềm',
                    }),
                    update: expect.objectContaining({
                        gender: 'MALE',
                        className: 'D20CNTT01',
                        major: 'Kỹ thuật Phần mềm',
                    }),
                })
            );

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        total: 1,
                        updatedCount: 1,
                        createdCount: 0,
                    }),
                })
            );
        });

        test('in UPDATE mode, rejects row if any of the 8 required fields is omitted (does not silently retain old value)', async () => {
            req.body = {
                role: 'STUDENT',
                items: [
                    {
                        ...validStudentRow,
                        'Ngành (*)': '', // omitted major
                    },
                ],
                onDuplicate: 'UPDATE',
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
            expect(mockPrisma.studentProfile.upsert).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            row: 1,
                            message: expect.stringContaining('Ngành là bắt buộc'),
                        }),
                    ]),
                })
            );
        });
    });

    describe('exportUsersExcel', () => {
        test('exports students with exact 8 canonical columns and formatted dates/genders', async () => {
            req.query = { role: 'STUDENT' };

            mockPrisma.user.findMany.mockResolvedValue([
                {
                    id: 1,
                    code: 'SV20260001',
                    fullName: 'Nguyen Van A',
                    email: 'sv1@tdmu.edu.vn',
                    phone: '0901234567',
                    role: 'STUDENT',
                    studentProfile: {
                        gender: 'MALE',
                        dateOfBirth: new Date(Date.UTC(2004, 7, 15)),
                        className: 'D20CNTT01',
                        major: 'Kỹ thuật Phần mềm',
                    },
                },
            ]);

            await userController.exportUsersExcel(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            expect(res.send).toHaveBeenCalled();

            const buffer = res.send.mock.calls[0][0];
            const parsed = parseExcelBuffer(buffer);
            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toEqual({
                'MSSV (*)': 'SV20260001',
                'Họ và tên (*)': 'Nguyen Van A',
                'Giới tính (*)': 'Nam',
                'Ngày sinh (*)': '15/08/2004',
                'Số điện thoại (*)': '0901234567',
                'Lớp (*)': 'D20CNTT01',
                'Email (*)': 'sv1@tdmu.edu.vn',
                'Ngành (*)': 'Kỹ thuật Phần mềm',
            });
        });
    });
});
