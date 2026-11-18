const { getAllCouncils } = require('../../src/controllers/councilController');
const prisma = require('../../src/config/database');

jest.mock('../../src/config/database', () => ({
    council: {
        findMany: jest.fn(),
    },
}));

describe('councilController.getAllCouncils forGrading filter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('filters to active memberships and hides finished defense councils when forGrading=true', async () => {
        const now = new Date();
        const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

        prisma.council.findMany.mockResolvedValue([
            {
                id: 1,
                name: 'HĐ Đã Xong (Đợt cũ)',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: pastDate,
                scoreBookLocked: true,
                semester: { id: 1, code: 'HK1-2526', name: 'HK1', status: 'COMPLETED' },
                members: [{ lecturerId: 2, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true }],
                defenseRegistrations: [
                    { id: 101, status: 'COMPLETED', defenseResult: { scoreLocked: true, isPublished: true }, memberScores: [] },
                ],
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 1 },
            },
            {
                id: 2,
                name: 'HĐ Đã Khóa Hết SV (Đợt hiện tại)',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: pastDate,
                scoreBookLocked: false,
                semester: { id: 3, code: 'HK1-2627', name: 'HK3', status: 'ONGOING' },
                members: [{ lecturerId: 2, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true }],
                defenseRegistrations: [
                    { id: 102, status: 'AWAITING_FINAL_APPROVAL', defenseResult: { scoreLocked: true, isPublished: false }, memberScores: [] },
                ],
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 1 },
            },
            {
                id: 3,
                name: 'HĐ Chuẩn Bị Bảo Vệ',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: futureDate,
                scoreBookLocked: false,
                semester: { id: 3, code: 'HK1-2627', name: 'HK3', status: 'ONGOING' },
                members: [{ lecturerId: 2, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true }],
                defenseRegistrations: [
                    {
                        id: 103,
                        status: 'DEFENSE_SCHEDULED',
                        defenseSessionShift: 'MORNING',
                        defenseOrderInShift: 1,
                        defenseResult: null,
                        memberScores: [{ id: 1, evaluatorId: 2, scoreLocked: false }],
                    },
                ],
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 1 },
            },
        ]);

        const req = {
            query: { forGrading: 'true' },
            user: { id: 2, permissions: ['DEFENSE_COUNCIL_MANAGE', 'VIEW_DEFENSE_GRADING'] },
        };
        const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        await getAllCouncils(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(prisma.council.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    members: { some: { lecturerId: 2, isActive: true } },
                }),
            })
        );
        expect(res.json).toHaveBeenCalledTimes(1);
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data).toHaveLength(1);
        expect(payload.data[0].id).toBe(3);
        expect(payload.data[0].myRole).toBe('SECRETARY');
        expect(payload.data[0].registrations).toHaveLength(1);
        expect(payload.data[0].registrations[0].defenseShift).toBe('MORNING');
        expect(payload.data[0].registrations[0].orderInShift).toBe(1);
    });
});

