const mockPrisma = {
    user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const userController = require('../../src/controllers/userController');

describe('userController Excel Import & Export', () => {
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

    test('downloadUserTemplate returns xlsx buffer with student template by default', async () => {
        req.query = { role: 'STUDENT' };
        await userController.downloadUserTemplate(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(res.send).toHaveBeenCalled();
    });

    test('importUsersExcel creates new users with default password hash', async () => {
        req.body = {
            role: 'STUDENT',
            items: [
                {
                    'Mã SV (*)': 'SV999901',
                    'Họ và tên (*)': 'Sinh Viên Test',
                    'Email (*)': 'svtest@tdmu.edu.vn',
                    'Bộ môn / Khoa': 'CNPM',
                },
            ],
            onDuplicate: 'SKIP',
        };

        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({ id: 1, code: 'SV999901' });

        await userController.importUsersExcel(req, res, next);

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

    test('importUsersExcel flags invalid emails and missing required fields', async () => {
        req.body = {
            role: 'STUDENT',
            items: [
                {
                    'Mã SV (*)': '',
                    'Họ và tên (*)': 'Thiếu Mã',
                    'Email (*)': 'sv@test.com',
                },
                {
                    'Mã SV (*)': 'SV999902',
                    'Họ và tên (*)': 'Sai Email',
                    'Email (*)': 'not-an-email',
                },
            ],
        };

        await userController.importUsersExcel(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    total: 2,
                    createdCount: 0,
                    errors: expect.arrayContaining([
                        expect.objectContaining({ message: expect.stringContaining('Thiếu mã số') }),
                        expect.objectContaining({ message: expect.stringContaining('Email không hợp lệ') }),
                    ]),
                }),
            })
        );
    });
});
