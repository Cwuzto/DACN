jest.mock('../../src/config/database', () => ({
    projectCatalog: {
        findMany: jest.fn(),
    },
    studentProjectEnrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
    },
    user: {
        findMany: jest.fn(),
    },
    topicRegistration: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn(),
}));

const prisma = require('../../src/config/database');
const {
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
    getAvailableStudents,
} = require('../../src/controllers/projectEnrollmentController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('projectEnrollmentController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('listStudentProjectEnrollments supports source/importBatchId filters', async () => {
        prisma.studentProjectEnrollment.findMany.mockResolvedValue([]);
        const req = createMockReq({
            query: {
                semesterId: '10',
                source: 'EXCEL',
                importBatchId: 'batch-2026-05-04',
            },
        });
        const res = createMockRes();
        const next = createNext();

        await listStudentProjectEnrollments(req, res, next);

        expect(prisma.studentProjectEnrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    semesterId: 10,
                    source: 'EXCEL',
                    importBatchId: 'batch-2026-05-04',
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        expect(next).not.toHaveBeenCalled();
    });

    test('bulkUpsert keeps source=SEED and importBatchId when provided', async () => {
        const createMock = jest.fn().mockResolvedValue({ id: 1 });
        prisma.$transaction.mockImplementation(async (cb) =>
            cb({
                studentProjectEnrollment: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    update: jest.fn(),
                    create: createMock,
                },
            })
        );

        const req = createMockReq({
            body: {
                items: [
                    {
                        studentId: 1,
                        semesterId: 2,
                        projectCatalogId: 3,
                        status: 'ACTIVE',
                        source: 'SEED',
                        importBatchId: 'seed-batch-v2',
                    },
                ],
            },
        });
        const res = createMockRes();
        const next = createNext();

        await bulkUpsertStudentProjectEnrollments(req, res, next);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    source: 'SEED',
                    importBatchId: 'seed-batch-v2',
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: { created: 1, updated: 0 },
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    describe('getAvailableStudents', () => {
        test('returns 400 when semesterId is missing', async () => {
            const req = createMockReq({ query: {} });
            const res = createMockRes();
            const next = createNext();

            await getAvailableStudents(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, message: 'semesterId là bắt buộc.' })
            );
        });

        test('returns 404 when semester not found', async () => {
            prisma.semester.findUnique.mockResolvedValue(null);
            const req = createMockReq({ query: { semesterId: '999' } });
            const res = createMockRes();
            const next = createNext();

            await getAvailableStudents(req, res, next);

            expect(prisma.semester.findUnique).toHaveBeenCalledWith({
                where: { id: 999 },
                select: { id: true },
            });
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, message: 'Đợt đồ án không tồn tại.' })
            );
        });

        test('returns empty array when no active students exist', async () => {
            prisma.semester.findUnique.mockResolvedValue({ id: 10 });
            prisma.user.findMany.mockResolvedValue([]);
            const req = createMockReq({ query: { semesterId: '10' } });
            const res = createMockRes();
            const next = createNext();

            await getAvailableStudents(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        });

        test('filters out students already enrolled in round or account restricted and sorts results', async () => {
            prisma.semester.findUnique.mockResolvedValue({ id: 10 });

            // 4 students:
            // S1 (id: 1, code: 'SV002'): normal available
            // S2 (id: 2, code: 'SV001'): already enrolled in this round
            // S3 (id: 3, code: 'SV003'): defended/completed (restricted)
            // S4 (id: 4, code: 'SV000'): normal available
            prisma.user.findMany.mockResolvedValue([
                {
                    id: 1,
                    fullName: 'Nguyen Van B',
                    code: 'SV002',
                    email: 'b@student.edu.vn',
                    department: 'CNTT',
                    studentProfile: { major: 'KTPM', className: '20KTPM' },
                },
                {
                    id: 2,
                    fullName: 'Tran Thi C',
                    code: 'SV001',
                    email: 'c@student.edu.vn',
                    department: 'CNTT',
                    studentProfile: { major: 'KHMT', className: '20KHMT' },
                },
                {
                    id: 3,
                    fullName: 'Le Van D',
                    code: 'SV003',
                    email: 'd@student.edu.vn',
                    department: 'CNTT',
                    studentProfile: { major: 'KTPM', className: '19KTPM' },
                },
                {
                    id: 4,
                    fullName: 'An Van A',
                    code: 'SV000',
                    email: 'a@student.edu.vn',
                    department: 'CNTT',
                    studentProfile: { major: 'HTTT', className: '20HTTT' },
                },
            ]);

            // S2 is enrolled
            prisma.studentProjectEnrollment.findMany.mockResolvedValue([
                { studentId: 2 },
            ]);

            // S3 is restricted (defended)
            prisma.topicRegistration.findMany.mockResolvedValue([
                { studentId: 3 },
            ]);

            const req = createMockReq({ query: { semesterId: '10', projectCatalogId: '5' } });
            const res = createMockRes();
            const next = createNext();

            await getAvailableStudents(req, res, next);

            expect(prisma.studentProjectEnrollment.findMany).toHaveBeenCalledWith({
                where: { semesterId: 10, projectCatalogId: 5, status: 'ACTIVE' },
                select: { studentId: true },
            });
            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith({
                where: { status: { in: ['COMPLETED', 'DEFENDED', 'DEFENSE_PASSED'] } },
                select: { studentId: true },
                distinct: ['studentId'],
            });

            // S4 (SV000) and S1 (SV002) should be returned, sorted by code
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: [
                    {
                        id: 4,
                        fullName: 'An Van A',
                        code: 'SV000',
                        email: 'a@student.edu.vn',
                        department: 'CNTT',
                        major: 'HTTT',
                        className: '20HTTT',
                    },
                    {
                        id: 1,
                        fullName: 'Nguyen Van B',
                        code: 'SV002',
                        email: 'b@student.edu.vn',
                        department: 'CNTT',
                        major: 'KTPM',
                        className: '20KTPM',
                    },
                ],
            });
        });
    });
});
