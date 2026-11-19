const { buildAdminDashboardActions } = require('../../src/services/adminDashboardActionsService');

const createMockDb = () => ({
    academicDelegation: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    semester: {
        findUnique: jest.fn().mockResolvedValue({ id: 2, code: 'HK2', name: 'HK2' }),
    },
    topic: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    topicRegistration: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    defenseResultApproval: {
        findMany: jest.fn().mockResolvedValue([]),
    },
});

const fullAdminActor = {
    id: 1,
    role: 'ADMIN',
    department: 'CNTT',
    permissionGroups: ['GIAO_VU'],
    basePermissions: [
        'REPORT_VIEW',
        'TOPIC_REVIEW',
        'OUTLINE_COUNCIL_MANAGE',
        'BM02_REVIEW',
        'DEFENSE_COUNCIL_MANAGE',
        'RESULT_LOCK',
        'DEFENSE_RESULT_APPROVE',
        'RESULT_PUBLICATION_PUBLISH',
    ],
    permissions: [
        'REPORT_VIEW',
        'TOPIC_REVIEW',
        'OUTLINE_COUNCIL_MANAGE',
        'BM02_REVIEW',
        'DEFENSE_COUNCIL_MANAGE',
        'RESULT_LOCK',
        'DEFENSE_RESULT_APPROVE',
        'RESULT_PUBLICATION_PUBLISH',
    ],
    activeDelegations: [],
};

describe('adminDashboardActionsService - buildAdminDashboardActions', () => {
    test('counts only records in selected semesterId and never counts TopicRegistration.PENDING as TOPIC_REVIEW', async () => {
        const db = createMockDb();
        const pendingMentorRegistrations = 5;

        db.topic.findMany.mockImplementation(async ({ where }) => {
            if (where.semesterId === 1) {
                return [{ id: 10 }, { id: 11 }, { id: 12 }];
            }
            if (where.semesterId === 2) {
                return [{ id: 20 }];
            }
            return [];
        });

        db.topicRegistration.findMany.mockImplementation(async ({ where }) => {
            // Simulate outline council query
            if (where.status === 'BM01_SUBMITTED' && where.outlineCouncilId === null) {
                if (where.semesterId === 2) {
                    return [
                        { id: 201, updatedAt: new Date('2026-10-01T00:00:00Z') },
                        { id: 201, updatedAt: new Date('2026-10-01T00:00:00Z') }, // duplicate guard
                        { id: 202, updatedAt: new Date('2026-10-02T00:00:00Z') },
                    ];
                }
                return [{ id: 101 }, { id: 102 }, { id: 103 }];
            }
            // Simulate pending mentor registrations in semester 2 (must NOT be counted as TOPIC_REVIEW)
            if (where.status === 'PENDING') {
                return Array.from({ length: pendingMentorRegistrations }, (_, idx) => ({ id: 900 + idx }));
            }
            return [];
        });

        const result = await buildAdminDashboardActions({
            actor: fullAdminActor,
            semesterId: 2,
            db,
            now: new Date('2026-10-10T00:00:00Z'),
        });

        expect(result.semesterId).toBe(2);
        expect(result.items.find((x) => x.kind === 'TOPIC_REVIEW')?.count).toBe(1);
        expect(result.items.some((x) => x.kind === 'TOPIC_REVIEW' && x.count === pendingMentorRegistrations)).toBe(false);
        expect(result.items.find((x) => x.kind === 'OUTLINE_COUNCIL_ASSIGN')?.count).toBe(2);
        expect(result.items.find((x) => x.kind === 'OUTLINE_COUNCIL_ASSIGN')?.target).toBe('/admin/outline-councils?semesterId=2');
        expect(result.items.find((x) => x.kind === 'TOPIC_REVIEW')?.target).toBe('/admin/topics?status=PENDING&semesterId=2');
    });

    test('omits BM02_REVIEW when BM02 is not submitted (only BM01_PASSED / BM02_OPEN), and counts only submitted BM02', async () => {
        const db = createMockDb();

        db.topicRegistration.findMany.mockImplementation(async ({ where }) => {
            if (where?.status?.in?.includes('BM02_SUBMITTED')) {
                expect(where.status.in).not.toContain('BM01_PASSED');
                expect(where.status.in).not.toContain('BM02_OPEN');
                expect(where.status.in).not.toContain('BM02_NEEDS_REVISION');
                return [];
            }
            return [];
        });

        const resultEmpty = await buildAdminDashboardActions({
            actor: fullAdminActor,
            semesterId: 2,
            db,
        });

        expect(resultEmpty.items.some((x) => x.kind === 'BM02_REVIEW')).toBe(false);

        db.topicRegistration.findMany.mockImplementation(async ({ where }) => {
            if (where?.status?.in?.includes('BM02_SUBMITTED')) {
                return [
                    { id: 301, currentBM02Submission: { outcome: 'PENDING_REVIEW', revisionDeadlineAt: null } },
                    { id: 302, currentBM02Submission: { outcome: 'EXCEPTION_REVIEW', revisionDeadlineAt: null } },
                ];
            }
            return [];
        });

        const resultSubmitted = await buildAdminDashboardActions({
            actor: fullAdminActor,
            semesterId: 2,
            db,
        });

        const bm02Item = resultSubmitted.items.find((x) => x.kind === 'BM02_REVIEW');
        expect(bm02Item).toBeDefined();
        expect(bm02Item.count).toBe(2);
        expect(bm02Item.target).toContain('semesterId=2');
    });

    test('counts DEFENSE_COUNCIL_ASSIGN only for DEFENSE_READY unassigned registrations and RESULT_* steps accurately', async () => {
        const db = createMockDb();

        db.topicRegistration.findMany.mockImplementation(async ({ where }) => {
            if (where.status === 'DEFENSE_READY' && where.defenseCouncilId === null && where.councilId === null) {
                return [{ id: 401 }, { id: 402 }];
            }
            if (where?.status?.in?.includes('AWAITING_SCORES')) {
                return [
                    { id: 501, defenseCouncil: { scoreBookLocked: false }, defenseResult: null, resultPublicationItems: [] },
                    { id: 502, defenseCouncil: { scoreBookLocked: true }, defenseResult: { scoreLocked: true }, resultPublicationItems: [] },
                ];
            }
            if (where.status === 'AWAITING_FINAL_APPROVAL') {
                return [
                    { id: 601, defenseCouncil: { scoreBookLocked: true }, defenseResult: { scoreLocked: true }, resultPublicationItems: [] },
                    { id: 602, defenseCouncil: { scoreBookLocked: false }, defenseResult: { scoreLocked: false }, resultPublicationItems: [] },
                ];
            }
            return [];
        });

        db.defenseResultApproval.findMany.mockResolvedValue([
            { id: 1, registrationId: 701, publicationItems: [] },
            { id: 2, registrationId: 701, publicationItems: [] }, // same registrationId
            { id: 3, registrationId: 702, publicationItems: [{ id: 99 }] }, // already published
        ]);

        const result = await buildAdminDashboardActions({
            actor: fullAdminActor,
            semesterId: 3,
            db,
        });

        expect(result.items.find((x) => x.kind === 'DEFENSE_COUNCIL_ASSIGN')?.count).toBe(2);
        expect(result.items.find((x) => x.kind === 'RESULT_LOCK')?.count).toBe(1);
        expect(result.items.find((x) => x.kind === 'RESULT_APPROVE')?.count).toBe(1);
        expect(result.items.find((x) => x.kind === 'RESULT_PUBLISH')?.count).toBe(1);
    });

    test('omits items when actor lacks the required permission or report scope', async () => {
        const db = createMockDb();
        db.topic.findMany.mockResolvedValue([{ id: 1 }]);
        db.topicRegistration.findMany.mockResolvedValue([{ id: 10 }]);
        db.defenseResultApproval.findMany.mockResolvedValue([{ id: 1, registrationId: 99, publicationItems: [] }]);

        const limitedActor = {
            id: 2,
            role: 'LECTURER',
            department: 'CNTT',
            permissionGroups: ['TRUONG_BO_MON'],
            basePermissions: ['REPORT_VIEW', 'TOPIC_REVIEW'],
            permissions: ['REPORT_VIEW', 'TOPIC_REVIEW'],
            activeDelegations: [],
        };

        const limitedResult = await buildAdminDashboardActions({
            actor: limitedActor,
            semesterId: 2,
            db,
        });

        expect(limitedResult.items.map((x) => x.kind)).toEqual(['TOPIC_REVIEW']);
        expect(db.defenseResultApproval.findMany).not.toHaveBeenCalled();

        // Check department scope was applied on topic query
        expect(db.topic.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    semesterId: 2,
                    status: 'PENDING',
                    OR: expect.any(Array),
                }),
            })
        );

        const noScopeActor = {
            id: 3,
            role: 'LECTURER',
            department: 'CNTT',
            permissionGroups: [],
            basePermissions: ['TOPIC_REVIEW'],
            permissions: ['TOPIC_REVIEW'],
            activeDelegations: [],
        };

        const noScopeResult = await buildAdminDashboardActions({
            actor: noScopeActor,
            semesterId: 2,
            db,
        });

        expect(noScopeResult.items).toEqual([]);
    });

    test('orders earlier workflow steps ahead of later steps even when later step has larger count, and never marks null dueAt as OVERDUE', async () => {
        const db = createMockDb();
        db.topic.findMany.mockResolvedValue([{ id: 1 }]);
        db.defenseResultApproval.findMany.mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => ({ id: i + 1, registrationId: 800 + i, publicationItems: [] }))
        );

        const result = await buildAdminDashboardActions({
            actor: fullAdminActor,
            semesterId: 2,
            db,
        });

        expect(result.items.map((x) => x.kind)).toEqual(['TOPIC_REVIEW', 'RESULT_PUBLISH']);
        for (const item of result.items) {
            if (!item.dueAt) {
                expect(item.priority).toBe('NORMAL');
            }
        }
    });
});
