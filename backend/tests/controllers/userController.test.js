const mockPrisma = {
    user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    studentProfile: {
        create: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
            return await cb(mockPrisma);
        }
        return cb;
    }),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('bcryptjs', () => ({
    hash: jest.fn(async (val) => `hashed_${val}`),
    compare: jest.fn(async () => true),
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn((title) => (title === 'THAC_SI' ? 8 : 10)),
}));

const userController = require('../../src/controllers/userController');

describe('userController.getPublicLecturers', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('returns public active lecturers with maxSlots and mentored topics', async () => {
        mockPrisma.user.findMany.mockResolvedValue([
            {
                id: 20,
                fullName: 'TS. Tran Huong Dan',
                code: 'GV00020',
                academicTitle: 'TIEN_SI',
                department: 'Kỹ thuật Phần mềm',
                avatarUrl: null,
                email: 'danhth@tdmu.edu.vn',
                mentoredTopics: [{ id: 1, title: 'AI trong giáo dục', description: 'Đề tài mẫu' }],
                _count: { mentoredTopics: 1 },
            },
        ]);

        await userController.getPublicLecturers(req, res, next);

        expect(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.success).toBe(true);
        expect(responseData.data).toHaveLength(1);
        expect(responseData.data[0].maxSlots).toBe(10);
        expect(responseData.data[0].fullName).toBe('TS. Tran Huong Dan');
    });

    test('applies search and department filter when provided', async () => {
        req.query = { search: 'Huong Dan', department: 'Kỹ thuật Phần mềm' };
        mockPrisma.user.findMany.mockResolvedValue([]);

        await userController.getPublicLecturers(req, res, next);

        expect(mockPrisma.user.findMany).toHaveBeenCalled();
        const callArg = mockPrisma.user.findMany.mock.calls[0][0];
        expect(callArg.where.role).toBe('LECTURER');
        expect(callArg.where.isActive).toBe(true);
        expect(callArg.where.department).toEqual({ contains: 'Kỹ thuật Phần mềm', mode: 'insensitive' });
        expect(callArg.where.OR).toBeDefined();
    });
});

describe('userController.createUser for STUDENT', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {
                role: 'STUDENT',
                code: 'SV20260010',
                fullName: 'Nguyen Van An',
                email: 'an.nv@school.edu.vn',
                phone: '0901234567',
                gender: 'Nam',
                dateOfBirth: '12/03/2002',
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('validates 8 fields and returns 400 when missing student profile fields', async () => {
        delete req.body.className;

        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: expect.stringMatching(/Lớp/i) })
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test('returns 400 when code already exists', async () => {
        mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.code === 'SV20260010') return { id: 99, code: 'SV20260010' };
            return null;
        });

        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: expect.stringMatching(/Mã số sinh viên/i) })
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test('creates User and StudentProfile in a single atomic transaction with provided MSSV', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const createdUserRecord = {
            id: 101,
            code: 'SV20260010',
            fullName: 'Nguyen Van An',
            email: 'an.nv@school.edu.vn',
            role: 'STUDENT',
            phone: '0901234567',
            department: null,
            isActive: true,
            createdAt: new Date(),
        };

        const createdProfileRecord = {
            studentId: 101,
            gender: 'MALE',
            dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
            className: 'D20PM01',
            major: 'Kỹ thuật Phần mềm',
        };

        mockPrisma.user.create.mockResolvedValue(createdUserRecord);
        mockPrisma.studentProfile.create.mockResolvedValue(createdProfileRecord);

        await userController.createUser(req, res, next);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                code: 'SV20260010',
                email: 'an.nv@school.edu.vn',
                role: 'STUDENT',
            }),
        }));
        expect(mockPrisma.studentProfile.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                studentId: 101,
                gender: 'MALE',
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
            }),
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                code: 'SV20260010',
                studentProfile: expect.objectContaining({
                    className: 'D20PM01',
                }),
            }),
        }));
    });

    test('rolls back and propagates error if studentProfile creation fails', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({ id: 101 });
        mockPrisma.studentProfile.create.mockRejectedValue(new Error('DB Profile Constraint Failure'));

        await userController.createUser(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});

describe('userController.updateUser for STUDENT', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            params: { id: '101' },
            body: {
                fullName: 'Nguyen Van An Updated',
                phone: '0988888888',
                gender: 'Nam',
                dateOfBirth: '12/03/2002',
                className: 'D20PM02',
                major: 'Trí Tuệ Nhân Tạo',
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('validates and upserts StudentProfile in transaction when updating student', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 101,
            code: 'SV20260010',
            email: 'an.nv@school.edu.vn',
            fullName: 'Nguyen Van An',
            role: 'STUDENT',
            phone: '0901234567',
            studentProfile: {
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
            },
        });

        mockPrisma.user.update.mockResolvedValue({
            id: 101,
            code: 'SV20260010',
            email: 'an.nv@school.edu.vn',
            fullName: 'Nguyen Van An Updated',
            role: 'STUDENT',
            phone: '0988888888',
        });

        mockPrisma.studentProfile.upsert.mockResolvedValue({
            studentId: 101,
            gender: 'MALE',
            dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
            className: 'D20PM02',
            major: 'Trí Tuệ Nhân Tạo',
        });

        await userController.updateUser(req, res, next);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.studentProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { studentId: 101 },
            create: expect.objectContaining({ className: 'D20PM02', major: 'Trí Tuệ Nhân Tạo' }),
            update: expect.objectContaining({ className: 'D20PM02', major: 'Trí Tuệ Nhân Tạo' }),
        }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                fullName: 'Nguyen Van An Updated',
                studentProfile: expect.objectContaining({ className: 'D20PM02' }),
            }),
        }));
    });
});

describe('userController.getUserById and getAllUsers studentProfile inclusion', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { params: { id: '101' }, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('getUserById returns user with studentProfile', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 101,
            code: 'SV20260010',
            fullName: 'Nguyen Van An',
            role: 'STUDENT',
            studentProfile: {
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
            },
            permissionGroups: [],
        });

        await userController.getUserById(req, res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                id: 101,
                studentProfile: expect.objectContaining({ className: 'D20PM01' }),
            }),
        }));
    });

    test('getAllUsers includes studentProfile in select query', async () => {
        mockPrisma.user.findMany.mockResolvedValue([]);
        mockPrisma.user.count.mockResolvedValue(0);

        await userController.getAllUsers(req, res, next);

        expect(mockPrisma.user.findMany).toHaveBeenCalled();
        const callArg = mockPrisma.user.findMany.mock.calls[0][0];
        expect(callArg.select.studentProfile).toBeDefined();
    });
});

describe('userController.createUser for LECTURER', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {
                role: 'LECTURER',
                code: 'GV202601',
                fullName: 'TS. Le Van C',
                email: 'levanc@tdmu.edu.vn',
                phone: '0912345678',
                department: 'Bộ môn Công Nghệ Thông Tin',
                academicTitle: 'TIEN_SI',
                expertiseAreas: ['Trí tuệ nhân tạo', 'Xử lý ảnh'],
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        mockPrisma.permissionGroup = {
            findUnique: jest.fn().mockResolvedValue({ id: 1, code: 'GVHD' }),
        };
        mockPrisma.userPermissionGroup = {
            create: jest.fn().mockResolvedValue({ id: 1 }),
        };
    });

    test('rejects with 400 when expertiseAreas is missing or empty for LECTURER', async () => {
        req.body.expertiseAreas = [];
        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                code: 'LECTURER_EXPERTISE_REQUIRED',
            })
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test('normalizes expertiseAreas and creates LECTURER successfully', async () => {
        req.body.expertiseAreas = 'AI ; Xử lý ảnh; ai';
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
            id: 201,
            code: 'GV202601',
            fullName: 'TS. Le Van C',
            role: 'LECTURER',
            expertiseAreas: ['AI', 'Xử lý ảnh'],
        });

        await userController.createUser(req, res, next);

        expect(mockPrisma.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    role: 'LECTURER',
                    department: 'Công Nghệ Thông Tin',
                    expertiseAreas: ['AI', 'Xử lý ảnh'],
                }),
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('rejects with 400 when LECTURER department is not in canonical list', async () => {
        req.body.department = 'Bộ môn Công nghệ Phần mềm';

        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Bộ môn không hợp lệ. Vui lòng chọn: Công Nghệ Thông Tin hoặc Hệ thống Thông tin.',
            })
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('userController.updateUser for LECTURER', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            params: { id: '201' },
            body: {
                expertiseAreas: ['Học máy', 'Kỹ nghệ phần mềm'],
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('rejects with 400 when updating LECTURER expertise to empty', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 201,
            role: 'LECTURER',
            code: 'GV202601',
            studentProfile: null,
        });

        req.body.expertiseAreas = [];
        await userController.updateUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                code: 'LECTURER_EXPERTISE_REQUIRED',
            })
        );
    });

    test('normalizes and updates expertiseAreas for LECTURER', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 201,
            role: 'LECTURER',
            code: 'GV202601',
            studentProfile: null,
        });
        mockPrisma.user.update.mockResolvedValue({
            id: 201,
            role: 'LECTURER',
            expertiseAreas: ['Học máy', 'Kỹ nghệ phần mềm'],
        });

        await userController.updateUser(req, res, next);

        expect(mockPrisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    expertiseAreas: ['Học máy', 'Kỹ nghệ phần mềm'],
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });
});

describe('userController STUDENT academicYear and placeOfBirth', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            params: { id: '101' },
            query: {},
            body: {
                role: 'STUDENT',
                code: 'SV20260010',
                fullName: 'Nguyen Van An',
                email: 'an.nv@school.edu.vn',
                phone: '0901234567',
                gender: 'Nam',
                dateOfBirth: '12/03/2002',
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('createUser stores optional academicYear and placeOfBirth when provided', async () => {
        req.body.academicYear = '2022–2026';
        req.body.placeOfBirth = 'Bình Dương';

        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
            id: 101,
            code: 'SV20260010',
            fullName: 'Nguyen Van An',
            email: 'an.nv@school.edu.vn',
            role: 'STUDENT',
        });
        mockPrisma.studentProfile.create.mockResolvedValue({
            studentId: 101,
            gender: 'MALE',
            dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
            className: 'D20PM01',
            major: 'Ky thuat phan mem',
            academicYear: '2022–2026',
            placeOfBirth: 'Bình Dương',
        });

        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(mockPrisma.studentProfile.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    academicYear: '2022–2026',
                    placeOfBirth: 'Bình Dương',
                }),
                select: expect.objectContaining({
                    academicYear: true,
                    placeOfBirth: true,
                }),
            })
        );
    });

    test('createUser normalizes empty or omitted academicYear and placeOfBirth to null', async () => {
        req.body.academicYear = '   ';
        // placeOfBirth omitted

        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({ id: 102, code: 'SV20260010', role: 'STUDENT' });
        mockPrisma.studentProfile.create.mockResolvedValue({
            studentId: 102,
            academicYear: null,
            placeOfBirth: null,
        });

        await userController.createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(mockPrisma.studentProfile.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    academicYear: null,
                    placeOfBirth: null,
                }),
            })
        );
    });

    test('updateUser updates academicYear and placeOfBirth and preserves existing when omitted', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 101,
            role: 'STUDENT',
            code: 'SV20260010',
            fullName: 'Nguyen Van An',
            email: 'an.nv@school.edu.vn',
            phone: '0901234567',
            studentProfile: {
                studentId: 101,
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
                academicYear: '2022–2026',
                placeOfBirth: 'Bình Dương',
            },
        });
        mockPrisma.user.update.mockResolvedValue({ id: 101, role: 'STUDENT' });
        mockPrisma.studentProfile.upsert.mockResolvedValue({
            studentId: 101,
            academicYear: '2022–2026',
            placeOfBirth: null,
        });

        req.body = {
            placeOfBirth: '', // explicitly cleared -> null; academicYear omitted -> preserved
        };

        await userController.updateUser(req, res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(mockPrisma.studentProfile.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    academicYear: '2022–2026',
                    placeOfBirth: null,
                }),
                select: expect.objectContaining({
                    academicYear: true,
                    placeOfBirth: true,
                }),
            })
        );
    });

    test('getAllUsers and getUserById select academicYear and placeOfBirth', async () => {
        mockPrisma.user.findMany.mockResolvedValue([]);
        mockPrisma.user.count.mockResolvedValue(0);

        await userController.getAllUsers(req, res, next);

        const listSelect = mockPrisma.user.findMany.mock.calls[0][0].select.studentProfile.select;
        expect(listSelect).toMatchObject({ academicYear: true, placeOfBirth: true });

        mockPrisma.user.findUnique.mockResolvedValue({
            id: 101,
            role: 'STUDENT',
            permissionGroups: [],
            studentProfile: {
                studentId: 101,
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Kỹ thuật Phần mềm',
                academicYear: '2022–2026',
                placeOfBirth: 'Bình Dương',
            },
        });

        await userController.getUserById(req, res, next);

        const detailSelect = mockPrisma.user.findUnique.mock.calls[0][0].select.studentProfile.select;
        expect(detailSelect).toMatchObject({ academicYear: true, placeOfBirth: true });
    });
});

