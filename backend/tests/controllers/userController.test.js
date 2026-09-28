const mockPrisma = {
    user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);

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
