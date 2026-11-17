const {
    buildInstituteAttention,
    sortAndDedupeAttentionItems,
} = require('../../src/services/instituteAttentionSource');

describe('instituteAttentionSource', () => {
    const fixedNow = new Date('2026-11-17T10:00:00.000Z');

    const makeMockDb = () => ({
        user: {
            findUnique: jest.fn(),
        },
        academicDelegation: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        topicRegistration: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn(),
        },
        council: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        notification: {
            findMany: jest.fn().mockResolvedValue([]),
        },
    });

    it('returns zero INSTITUTE_DIRECTOR items for a plain GVHD without institutional capabilities', async () => {
        const db = makeMockDb();
        db.notification.findMany.mockResolvedValue([
            {
                id: 1,
                userId: 77,
                title: 'Thông báo chung',
                content: 'Nhắc nộp đề cương',
                referenceUrl: null,
                isRead: false,
                createdAt: new Date('2026-11-17T08:00:00.000Z'),
            },
        ]);

        const items = await buildInstituteAttention({
            actor: { id: 77, role: 'LECTURER', department: 'CNTT', permissions: ['REPORT_VIEW', 'BM01_REVIEW'] },
            semesterId: 10,
            now: fixedNow,
            db,
        });

        expect(items.filter((i) => i.source === 'INSTITUTE_DIRECTOR')).toHaveLength(0);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            source: 'MENTOR',
            priority: 'INFO',
            isActionable: false,
            target: '/lecturer/notifications',
        });
        expect(items[0].allowedAction).toBeUndefined();
    });

    it('filters BM02, councils, and defense approvals by capability + department scope and never leaks unpublished BM05 scores', async () => {
        const db = makeMockDb();
        db.user.findUnique.mockResolvedValue({ id: 88, role: 'LECTURER', department: 'CNTT' });

        // BM02 + AWAITING_FINAL_APPROVAL across 2 departments (CNTT matches actor, KTPM does not)
        db.topicRegistration.findMany
            .mockResolvedValueOnce([
                {
                    id: 201,
                    semesterId: 10,
                    status: 'BM02_SUBMITTED',
                    updatedAt: new Date('2026-11-16T10:00:00.000Z'),
                    student: { fullName: 'SV CNTT', code: 'SV201' },
                    topic: { title: 'Đề tài CNTT', mentor: { department: 'CNTT' }, proposedBy: { department: 'CNTT' } },
                },
                {
                    id: 202,
                    semesterId: 10,
                    status: 'BM02_SUBMITTED',
                    updatedAt: new Date('2026-11-16T10:00:00.000Z'),
                    student: { fullName: 'SV KTPM', code: 'SV202' },
                    topic: { title: 'Đề tài KTPM', mentor: { department: 'KTPM' }, proposedBy: { department: 'KTPM' } },
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 301,
                    semesterId: 10,
                    status: 'AWAITING_FINAL_APPROVAL',
                    updatedAt: new Date('2026-11-16T10:00:00.000Z'),
                    student: { fullName: 'SV Chờ Công Bố', code: 'SV301' },
                    topic: { title: 'Đề tài Bảo Vệ', mentor: { department: 'CNTT' }, proposedBy: { department: 'CNTT' } },
                    defenseResult: { finalScore: 9.4, comments: 'Secret unpublished comment' },
                },
            ]);

        db.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 201 || where.id === 301) {
                return {
                    id: where.id,
                    topic: { mentor: { department: 'CNTT' }, proposedBy: { department: 'CNTT' } },
                };
            }
            if (where.id === 202) {
                return {
                    id: 202,
                    topic: { mentor: { department: 'KTPM' }, proposedBy: { department: 'KTPM' } },
                };
            }
            return null;
        });

        db.council.findMany.mockResolvedValue([
            {
                id: 401,
                name: 'Hội đồng BV 1',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: new Date('2026-11-18T08:00:00.000Z'),
                schedulePublishedAt: null,
            },
        ]);

        const items = await buildInstituteAttention({
            actor: {
                id: 88,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['BM02_REVIEW', 'DEFENSE_COUNCIL_MANAGE', 'DEFENSE_RESULT_APPROVE'],
            },
            semesterId: 10,
            now: fixedNow,
            db,
        });

        // Reg 202 (KTPM) must be excluded by scope
        expect(items.find((i) => i.registrationId === 202)).toBeUndefined();

        const bm02Item = items.find((i) => i.registrationId === 201);
        expect(bm02Item).toMatchObject({
            source: 'INSTITUTE_DIRECTOR',
            kind: 'BM02_REVIEW_PENDING',
            isActionable: true,
            target: '/lecturer/institute',
            allowedAction: 'REVIEW_BM02',
        });

        const councilItem = items.find((i) => i.kind === 'COUNCIL_SCHEDULE_PENDING');
        expect(councilItem).toMatchObject({
            source: 'INSTITUTE_DIRECTOR',
            priority: 'DUE_SOON',
            isActionable: true,
            target: '/admin/defense-councils',
        });

        const approvalItem = items.find((i) => i.registrationId === 301);
        expect(approvalItem).toBeDefined();
        expect(approvalItem.title).not.toContain('9.4');
        expect(approvalItem.description).not.toContain('9.4');
        expect(approvalItem.description).not.toContain('Secret unpublished comment');
    });

    it('treats notifications as read-only INFO without deadline/completion mutation and sorts + dedupes stably', async () => {
        const db = makeMockDb();
        db.notification.findMany.mockResolvedValue([
            {
                id: 501,
                userId: 88,
                title: 'Thông báo đã đọc',
                content: 'Nội dung thông báo',
                referenceUrl: '/admin/grading',
                isRead: true,
                createdAt: new Date('2026-11-15T10:00:00.000Z'),
            },
        ]);

        const notifItems = await buildInstituteAttention({
            actor: { id: 88, role: 'LECTURER', department: 'CNTT', permissions: ['BM02_REVIEW'] },
            semesterId: 10,
            now: fixedNow,
            db,
        });

        expect(notifItems).toHaveLength(1);
        expect(notifItems[0]).toMatchObject({
            priority: 'INFO',
            isActionable: false,
            semesterId: null,
            dueAt: null,
        });
        expect(notifItems[0].allowedAction).toBeUndefined();

        const sorted = sortAndDedupeAttentionItems([
            { id: 'n1', kind: 'NOTIFICATION', resourceId: 1, allowedAction: null, priority: 'INFO', dueAt: null },
            { id: 'm1', kind: 'SUBMISSION_FEEDBACK_PENDING', resourceId: 10, allowedAction: 'PROVIDE_FEEDBACK', priority: 'NORMAL', dueAt: null },
            { id: 'd1', kind: 'COUNCIL_SCHEDULE_PENDING', resourceId: 20, allowedAction: 'PUBLISH_SCHEDULE', priority: 'DUE_SOON', dueAt: '2026-11-18T10:00:00.000Z' },
            { id: 'o1', kind: 'TITLE_ADJUSTMENT_PENDING', resourceId: 30, allowedAction: 'REVIEW_TITLE_ADJUSTMENT', priority: 'OVERDUE', dueAt: '2026-11-16T10:00:00.000Z' },
            { id: 'o1-dup', kind: 'TITLE_ADJUSTMENT_PENDING', resourceId: 30, allowedAction: 'REVIEW_TITLE_ADJUSTMENT', priority: 'OVERDUE', dueAt: '2026-11-16T10:00:00.000Z' },
        ]);

        expect(sorted.map((i) => i.id)).toEqual(['o1', 'd1', 'm1', 'n1']);
    });
});
