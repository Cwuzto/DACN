const mockPrisma = {
    semester: {
        findUnique: jest.fn(),
    },
    projectCatalog: {
        findUnique: jest.fn(),
    },
    user: {
        findMany: jest.fn(),
    },
    studentProjectEnrollment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);

const projectEnrollmentController = require('../../src/controllers/projectEnrollmentController');

describe('projectEnrollmentController Excel Import & Export', () => {
    let req, res, next;

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

    test('downloadEnrollmentTemplate returns xlsx attachment', async () => {
        await projectEnrollmentController.downloadEnrollmentTemplate(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(res.send).toHaveBeenCalled();
    });

    test('importEnrollmentsExcel maps valid active students and handles invalid codes', async () => {
        req.body = {
            semesterId: 1,
            projectCatalogId: 2,
            importBatchId: 'TEST_BATCH_01',
            items: [
                { studentCode: 'SV001' },
                { studentCode: 'SV_NOT_FOUND' },
            ],
        };

        mockPrisma.semester.findUnique.mockResolvedValue({ id: 1, name: 'Học kỳ 1 2026-2027' });
        mockPrisma.projectCatalog.findUnique.mockResolvedValue({ id: 2, name: 'Đồ án chuyên ngành', code: 'DACN' });
        mockPrisma.user.findMany.mockResolvedValue([
            { id: 101, code: 'SV001', fullName: 'Nguyễn Văn A', isActive: true },
        ]);
        mockPrisma.studentProjectEnrollment.findUnique.mockResolvedValue(null);
        mockPrisma.studentProjectEnrollment.create.mockResolvedValue({ id: 501 });

        await projectEnrollmentController.importEnrollmentsExcel(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    total: 2,
                    createdCount: 1,
                    errors: expect.arrayContaining([
                        expect.objectContaining({ code: 'SV_NOT_FOUND', message: expect.stringContaining('Không tìm thấy') }),
                    ]),
                }),
            })
        );
    });
});
