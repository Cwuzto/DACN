jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    semester: { findUnique: jest.fn() },
    topicRegistration: { findMany: jest.fn() },
    defenseResultApproval: { findFirst: jest.fn(), findMany: jest.fn() },
    resultPublication: { findUnique: jest.fn(), findMany: jest.fn() },
    resultPublicationItem: { findMany: jest.fn() },
}));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { hashScoreEvidence } = require('../../src/services/defenseResultPublicationService');

const approvalReaders = ['VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL', 'DEFENSE_RESULT_APPROVE'];
const publicationReaders = ['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH'];
const permissionCodes = [...approvalReaders, ...publicationReaders, 'VIEW_USERS', 'RESULT_PUBLISH'];
const student = {
    id: 10, code: 'SV010', fullName: 'Student Ten', email: 'student@example.test',
    gender: 'FEMALE', dateOfBirth: '2002-01-01',
    studentProfile: { gender: 'FEMALE', dateOfBirth: '2002-01-01' },
};

// Model the database's student projection so accidentally widening a select leaks
// the sensitive fixture fields into the real controller response and fails tests.
const projectStudent = (selection) => selection?.select
    ? Object.fromEntries(Object.entries(student).filter(([field]) => selection.select[field]))
    : { ...student };

const expectNoSensitiveStudentFields = (value) => {
    if (!value || typeof value !== 'object') return;
    expect(value).not.toHaveProperty('gender');
    expect(value).not.toHaveProperty('dateOfBirth');
    Object.values(value).forEach(expectNoSensitiveStudentFields);
};

describe('Result read permissions and student projections', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'result-read-permissions-secret';
        jwt.verify.mockImplementation((permission) => ({ userId: permissionCodes.indexOf(permission) + 1 }));
        prisma.user.findUnique.mockImplementation(async ({ where }) => ({
            id: where.id, role: 'LECTURER', isActive: true,
            permissionGroups: [{ permissionGroup: {
                code: 'SINGLE_CAPABILITY',
                permissions: [{ permission: { code: permissionCodes[where.id - 1] } }],
            } }],
        }));
        prisma.semester.findUnique.mockResolvedValue({ id: 1, name: 'Semester One' });
        prisma.topicRegistration.findMany.mockImplementation(async ({ include }) => [{
            id: 101, semesterId: 1, status: 'AWAITING_FINAL_APPROVAL',
            student: projectStudent(include.student),
            topic: { title: 'Topic One', semester: { id: 1, name: 'Semester One' } },
            defenseResult: { id: 201, finalScore: 8, scoreLocked: true },
        }]);
        prisma.defenseResultApproval.findFirst.mockResolvedValue({ id: 301, registrationId: 101, outcome: 'PASSED' });
        prisma.defenseResultApproval.findMany.mockImplementation(async ({ include }) => {
            const registration = {
                id: 101, semesterId: 1, councilId: null, periodPolicyVersionId: null,
                student: projectStudent(include.registration.include.student),
                topic: { title: 'Topic One' },
                defenseResult: { id: 201, attendanceStatus: 'ABSENT', scoreLocked: true, scoreRubricVersion: 'v1' },
                memberScores: [],
            };
            return [{
                id: 301, registrationId: 101, outcome: 'FAILED', defenseResultId: 201,
                defenseCouncilId: null, policyVersionId: null, rubricVersionSnapshot: 'v1',
                finalScoreSnapshot: null, scoreFingerprint: hashScoreEvidence(registration), registration,
            }];
        });
        prisma.resultPublicationItem.findMany.mockResolvedValue([]);
        prisma.resultPublication.findMany.mockResolvedValue([{
            id: 401, semesterId: 1, type: 'INITIAL',
            items: [{ id: 501, registrationId: 101, studentCodeSnapshot: 'SV010', studentNameSnapshot: 'Student Ten' }],
        }]);
        // A successful replay exercises the real publication service without
        // setting up unrelated publication writes or notification side effects.
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        prisma.resultPublication.findUnique.mockResolvedValue({ id: 401, semesterId: 1, type: 'INITIAL', items: [] });
    });

    test.each(approvalReaders)('%s can read defense-center approval rows without student demographics', async (permission) => {
        const response = await request(app)
            .get('/api/evaluations/admin-defense-center?semesterId=1')
            .set('Authorization', `Bearer ${permission}`);

        expect(response.status).toBe(200);
        expect(response.body.data[0]).toMatchObject({ registrationId: 101, student: { code: 'SV010' } });
        expectNoSensitiveStudentFields(response.body);
    });

    test.each(approvalReaders)('%s can read approval detail', async (permission) => {
        const response = await request(app)
            .get('/api/evaluations/admin-defense-center/101/result-approval')
            .set('Authorization', `Bearer ${permission}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: 301, registrationId: 101 });
        expectNoSensitiveStudentFields(response.body);
    });

    test.each(publicationReaders)('%s can preview publication results without student demographics', async (permission) => {
        const response = await request(app)
            .get('/api/evaluations/semesters/1/result-publications/preview')
            .set('Authorization', `Bearer ${permission}`);

        expect(response.status).toBe(200);
        expect(response.body.data.eligible).toHaveLength(1);
        expect(response.body.data.eligible[0].registration.student).toEqual({ code: 'SV010', fullName: 'Student Ten' });
        expectNoSensitiveStudentFields(response.body);
    });

    test.each(publicationReaders)('%s can read publication history without student demographics', async (permission) => {
        const response = await request(app)
            .get('/api/evaluations/semesters/1/result-publications')
            .set('Authorization', `Bearer ${permission}`);

        expect(response.status).toBe(200);
        expect(response.body.data[0].items[0].studentCodeSnapshot).toBe('SV010');
        expectNoSensitiveStudentFields(response.body);
        const itemSelection = prisma.resultPublication.findMany.mock.calls[0][0].include.items;
        expect(itemSelection.select).not.toHaveProperty('registration');
        expect(itemSelection).not.toHaveProperty('include');
    });

    test('canonical publisher can replay a publication', async () => {
        const response = await request(app)
            .post('/api/evaluations/semesters/1/result-publications')
            .set('Authorization', 'Bearer RESULT_PUBLICATION_PUBLISH')
            .set('Idempotency-Key', 'publication-replay-001')
            .send({ type: 'INITIAL' });

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ idempotent: true, publication: { id: 401 } });
    });

    test.each([
        '/api/evaluations/admin-defense-center?semesterId=1',
        '/api/evaluations/admin-defense-center/101/result-approval',
        '/api/evaluations/semesters/1/result-publications/preview',
        '/api/evaluations/semesters/1/result-publications',
    ])('unrelated capability cannot read %s', async (path) => {
        const response = await request(app).get(path).set('Authorization', 'Bearer VIEW_USERS');
        expect(response.status).toBe(403);
    });

    test.each(['', '/preview'])('legacy publisher alone cannot read publication endpoint %s', async (suffix) => {
        const response = await request(app)
            .get(`/api/evaluations/semesters/1/result-publications${suffix}`)
            .set('Authorization', 'Bearer RESULT_PUBLISH');
        expect(response.status).toBe(403);
    });
});
