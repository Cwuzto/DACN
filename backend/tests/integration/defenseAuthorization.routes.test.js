jest.mock('../../src/config/database', () => ({
    user: { findUnique: jest.fn() },
    council: { findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn() },
    projectArchive: {},
    notification: { create: jest.fn() },
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

const permissionGroups = (...codes) => [{
    permissionGroup: {
        code: 'TEST',
        permissions: codes.map((code) => ({ permission: { code } })),
    },
}];

const users = {
    outline: { id: 11, role: 'LECTURER', permissions: ['OUTLINE_COUNCIL_MANAGE'] },
    defense: { id: 12, role: 'LECTURER', permissions: ['DEFENSE_COUNCIL_MANAGE'] },
    scoreView: { id: 13, role: 'LECTURER', permissions: ['DEFENSE_SCORE_VIEW'] },
    scoreSubmit: { id: 14, role: 'LECTURER', permissions: ['DEFENSE_SCORE_SUBMIT'] },
    resultLock: { id: 15, role: 'LECTURER', permissions: ['RESULT_LOCK'] },
    resultApprove: { id: 16, role: 'LECTURER', permissions: ['DEFENSE_RESULT_APPROVE'] },
    resultPublish: { id: 17, role: 'LECTURER', permissions: ['RESULT_PUBLISH'] },
    archiveReviewer: { id: 99, role: 'LECTURER', permissions: ['FINAL_DOCUMENT_REVIEW'] },
};

describe('Defense and archive capability boundaries', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'defense-authorization-secret';

        jwt.verify.mockImplementation((token) => ({ userId: users[token].id }));
        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            const user = Object.values(users).find((candidate) => candidate.id === where.id);
            return user && {
                id: user.id,
                role: user.role,
                isActive: true,
                fullName: user.id.toString(),
                permissionGroups: permissionGroups(...user.permissions),
            };
        });
        prisma.council.findUnique.mockImplementation(async ({ where }) => ({
            id: where.id,
            councilType: where.id === 1 ? 'OUTLINE_REVIEW' : 'DEFENSE_COUNCIL',
        }));
    });

    test('outline council capability cannot mutate a defense council', async () => {
        const response = await request(app)
            .post('/api/councils/2/assign')
            .set('Authorization', 'Bearer outline')
            .send({ registrationIds: [101] });

        expect(response.status).toBe(403);
    });

    test('defense council capability cannot mutate an outline council', async () => {
        const response = await request(app)
            .post('/api/councils/1/assign')
            .set('Authorization', 'Bearer defense')
            .send({ registrationIds: [101] });

        expect(response.status).toBe(403);
    });

    test('score view capability cannot write a score sheet', async () => {
        const response = await request(app)
            .put('/api/evaluations/101/score-sheet')
            .set('Authorization', 'Bearer scoreView')
            .send({ scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }] });

        expect(response.status).toBe(403);
    });

    test('score submit capability does not grant result locking', async () => {
        const response = await request(app)
            .patch('/api/evaluations/admin-defense-center/101/score-lock')
            .set('Authorization', 'Bearer scoreSubmit')
            .send({ action: 'LOCK' });

        expect(response.status).toBe(403);
    });

    test('result lock capability does not grant score submission', async () => {
        const response = await request(app)
            .put('/api/evaluations/101/score-sheet')
            .set('Authorization', 'Bearer resultLock')
            .send({ scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }] });

        expect(response.status).toBe(403);
    });

    test('approval endpoint rejects an unauthenticated caller', async () => {
        const response = await request(app)
            .post('/api/evaluations/admin-defense-center/101/result-approval')
            .send({ outcome: 'PASSED' });

        expect(response.status).toBe(401);
    });

    test('result lock capability does not grant result approval or publication', async () => {
        const approvalResponse = await request(app)
            .post('/api/evaluations/admin-defense-center/101/result-approval')
            .set('Authorization', 'Bearer resultLock')
            .send({ outcome: 'PASSED' });
        const publicationResponse = await request(app)
            .post('/api/evaluations/semesters/1/result-publications')
            .set('Authorization', 'Bearer resultLock')
            .set('Idempotency-Key', 'result-lock-publication-key-001')
            .send({ type: 'INITIAL' });

        expect(approvalResponse.status).toBe(403);
        expect(publicationResponse.status).toBe(403);
    });

    test('approval and publication capabilities remain separate', async () => {
        const publicationResponse = await request(app)
            .post('/api/evaluations/semesters/1/result-publications')
            .set('Authorization', 'Bearer resultApprove')
            .set('Idempotency-Key', 'approval-publication-key-001')
            .send({ type: 'INITIAL' });
        const approvalResponse = await request(app)
            .post('/api/evaluations/admin-defense-center/101/result-approval')
            .set('Authorization', 'Bearer resultPublish')
            .send({ outcome: 'PASSED' });

        expect(publicationResponse.status).toBe(403);
        expect(approvalResponse.status).toBe(403);
    });

    test('archive review capability still requires mentor or institute scope', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 101,
            studentId: 10,
            topic: { mentorId: 2 },
            archive: { id: 5, status: 'SUBMITTED' },
        });

        const response = await request(app)
            .post('/api/archives/registrations/101/review')
            .set('Authorization', 'Bearer archiveReviewer')
            .send({ decision: 'APPROVED' });

        expect(response.status).toBe(403);
    });
});
