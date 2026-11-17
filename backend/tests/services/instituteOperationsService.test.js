const {
    getInstituteOperations,
    InstituteOperationsError,
    MAX_PAGE_SIZE,
} = require('../../src/services/instituteOperationsService');

function makeDb(overrides = {}) {
    return {
        semester: {
            findUnique: jest.fn(async ({ where }) => {
                if (where.id === 1) {
                    return {
                        id: 1,
                        code: 'HK1-2026',
                        name: 'Học kỳ 1 2026',
                        status: 'ACTIVE',
                        defenseEligibleListPublishedAt: null,
                        lockedDefenseRubricVersion: {
                            id: 10,
                            lockedAt: new Date('2026-11-01T00:00:00Z'),
                            totalMaxScore: 10.0,
                        },
                    };
                }
                if (where.id === 2) {
                    return {
                        id: 2,
                        code: 'HK2-2026',
                        name: 'Học kỳ 2 2026',
                        status: 'UPCOMING',
                        defenseEligibleListPublishedAt: null,
                        lockedDefenseRubricVersion: null,
                    };
                }
                return null;
            }),
            findFirst: jest.fn(async () => ({
                id: 1,
                code: 'HK1-2026',
                name: 'Học kỳ 1 2026',
                status: 'ACTIVE',
                defenseEligibleListPublishedAt: null,
                lockedDefenseRubricVersion: {
                    id: 10,
                    lockedAt: new Date('2026-11-01T00:00:00Z'),
                    totalMaxScore: 10.0,
                },
            })),
        },
        bM02Submission: { findMany: jest.fn(async () => []) },
        instituteStopReview: { findMany: jest.fn(async () => []) },
        instituteDefenseReview: { findMany: jest.fn(async () => []) },
        checkpointSignatureAppeal: { findMany: jest.fn(async () => []) },
        topicAssignmentDecision: { findMany: jest.fn(async () => []) },
        topicRegistration: {
            findMany: jest.fn(async () => []),
            count: jest.fn(async () => 0),
        },
        titleAdjustmentAppendix: { findMany: jest.fn(async () => []) },
        bM02AAdjustmentRequest: { findMany: jest.fn(async () => []) },
        projectArchive: { findMany: jest.fn(async () => []) },
        defenseResultApproval: { findMany: jest.fn(async () => []) },
        ...overrides,
    };
}

function makeReg({
    id,
    semesterId = 1,
    department = 'CNTT',
    mentorId = 99,
    studentName = 'Nguyễn Văn A',
    studentCode = 'SV001',
    topicTitle = 'Đề tài AI',
    status = 'BM02_SUBMITTED',
    extra = {},
}) {
    return {
        id,
        semesterId,
        status,
        student: { id: 1000 + id, fullName: studentName, code: studentCode },
        topic: {
            id: 2000 + id,
            title: topicTitle,
            mentorId,
            mentor: { id: mentorId, fullName: 'GVHD', department },
            proposedBy: { id: mentorId, department },
        },
        ...extra,
    };
}

describe('instituteOperationsService', () => {
    describe('validation & access control', () => {
        test('rejects invalid tab, invalid page, invalid pageSize, and clamps pageSize at 50', async () => {
            const db = makeDb();
            const actor = { id: 10, role: 'LECTURER', department: 'CNTT', permissions: ['BM02_REVIEW'] };

            await expect(getInstituteOperations({ actor, tab: 'invalid', semesterId: 1, db }))
                .rejects.toMatchObject({ code: 'INVALID_TAB', statusCode: 400 });

            await expect(getInstituteOperations({ actor, tab: 'review', semesterId: 1, page: 0, db }))
                .rejects.toMatchObject({ code: 'INVALID_PAGE', statusCode: 400 });

            await expect(getInstituteOperations({ actor, tab: 'review', semesterId: 1, pageSize: -1, db }))
                .rejects.toMatchObject({ code: 'INVALID_PAGE_SIZE', statusCode: 400 });

            const res = await getInstituteOperations({ actor, tab: 'review', semesterId: 1, pageSize: 200, db });
            expect(res.pagination.pageSize).toBe(MAX_PAGE_SIZE);
        });

        test('returns 403 when actor lacks capability for tab even if role is ADMIN or has VIEW_PROJECT_OVERSIGHT', async () => {
            const db = makeDb();
            const adminWithoutCap = {
                id: 1,
                role: 'ADMIN',
                department: 'CNTT',
                permissions: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
            };

            await expect(getInstituteOperations({ actor: adminWithoutCap, tab: 'review', semesterId: 1, db }))
                .rejects.toMatchObject({ code: 'TAB_ACCESS_FORBIDDEN', statusCode: 403 });

            await expect(getInstituteOperations({ actor: adminWithoutCap, tab: 'decisions', semesterId: 1, db }))
                .rejects.toMatchObject({ code: 'TAB_ACCESS_FORBIDDEN', statusCode: 403 });

            await expect(getInstituteOperations({ actor: adminWithoutCap, tab: 'publish', semesterId: 1, db }))
                .rejects.toMatchObject({ code: 'TAB_ACCESS_FORBIDDEN', statusCode: 403 });
        });
    });

    describe('Task 1: review tab', () => {
        test('filters by department scope, preserves view-only with empty allowedActions, and computes counts before pagination', async () => {
            const reg1 = makeReg({ id: 101, semesterId: 1, department: 'CNTT', status: 'BM02_SUBMITTED' });
            const reg2 = makeReg({ id: 102, semesterId: 1, department: 'CNTT', status: 'BM02_RESUBMITTED' });
            const regOtherDept = makeReg({ id: 103, semesterId: 1, department: 'ATTT', status: 'BM02_SUBMITTED' });

            const db = makeDb({
                bM02Submission: {
                    findMany: jest.fn(async () => [
                        {
                            id: 1,
                            registrationId: 101,
                            attemptNo: 1,
                            outcome: 'PENDING_REVIEW',
                            revisionDeadlineAt: null,
                            submittedAt: new Date('2026-11-10T00:00:00Z'),
                            registration: reg1,
                        },
                        {
                            id: 2,
                            registrationId: 102,
                            attemptNo: 2,
                            outcome: 'PENDING_REVIEW',
                            revisionDeadlineAt: new Date('2026-11-20T00:00:00Z'),
                            submittedAt: new Date('2026-11-11T00:00:00Z'),
                            registration: reg2,
                        },
                        {
                            id: 3,
                            registrationId: 103,
                            attemptNo: 1,
                            outcome: 'PENDING_REVIEW',
                            revisionDeadlineAt: null,
                            submittedAt: new Date('2026-11-12T00:00:00Z'),
                            registration: regOtherDept,
                        },
                    ]),
                },
                instituteStopReview: {
                    findMany: jest.fn(async () => [
                        {
                            id: 11,
                            registrationId: 101,
                            stage: 'MIDTERM',
                            status: 'STOP_REVIEW_PENDING',
                            stopReviewDeadline: new Date('2026-11-19T00:00:00Z'),
                            registration: reg1,
                        },
                        {
                            id: 12,
                            registrationId: 102,
                            stage: 'FINAL',
                            status: 'MORE_INFO_REQUIRED',
                            stopReviewDeadline: new Date('2026-11-21T00:00:00Z'),
                            registration: reg2,
                        },
                    ]),
                },
                instituteDefenseReview: {
                    findMany: jest.fn(async () => [
                        {
                            id: 21,
                            registrationId: 101,
                            status: 'PENDING_INSTITUTE_REVIEW',
                            reviewDeadlineAt: new Date('2026-11-18T00:00:00Z'),
                            registration: reg1,
                        },
                    ]),
                },
                checkpointSignatureAppeal: {
                    findMany: jest.fn(async () => [
                        {
                            id: 31,
                            registrationId: 101,
                            status: 'SUBMITTED',
                            appealDeadlineAt: new Date('2026-11-17T00:00:00Z'),
                            registration: makeReg({
                                id: 101,
                                department: 'CNTT',
                                mentorId: 10, // same as actionActor -> cannot review own mentee's appeal
                                status: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
                            }),
                        },
                    ]),
                },
            });

            // 1. View-only actor
            const viewActor = {
                id: 50,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['VIEW_BM02_REVIEWS', 'VIEW_CHECKPOINTS', 'BM04_REVIEW'],
            };
            const viewRes = await getInstituteOperations({
                actor: viewActor,
                tab: 'review',
                semesterId: 1,
                page: 1,
                pageSize: 2,
                db,
            });
            expect(viewRes.counts.review).toBe(6); // 2 BM02 + 2 BM03 + 1 BM04 + 1 appeal (excludes ATTT)
            expect(viewRes.pagination.total).toBe(6);
            expect(viewRes.pagination.totalPages).toBe(3);
            expect(viewRes.items).toHaveLength(2);
            expect(viewRes.items.every((item) => item.allowedActions.length === 0)).toBe(true);

            // 2. Action actor
            const actionActor = {
                id: 10,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['BM02_REVIEW', 'BM03_STOP_REVIEW', 'BM04_REJECTION_REVIEW', 'SIGNATURE_APPEAL_REVIEW'],
            };
            const actionRes = await getInstituteOperations({
                actor: actionActor,
                tab: 'review',
                semesterId: 1,
                page: 1,
                pageSize: 20,
                db,
            });

            const bm02First = actionRes.items.find((i) => i.id === 'bm02-submission-1');
            expect(bm02First.dueAt).toBeNull(); // Never synthesized when DB has null
            expect(bm02First.allowedActions).toEqual(['APPROVE_BM02', 'REQUEST_BM02_REVISION', 'MARK_BM02_EXCEPTION']);

            const stopPending = actionRes.items.find((i) => i.id === 'bm03-stop-review-11');
            expect(stopPending.allowedActions).toEqual(['REQUEST_MORE_INFO', 'DECIDE_STOP_REVIEW']);

            const stopMoreInfo = actionRes.items.find((i) => i.id === 'bm03-stop-review-12');
            expect(stopMoreInfo.allowedActions).toEqual(['DECIDE_STOP_REVIEW']);

            const bm04Item = actionRes.items.find((i) => i.id === 'bm04-defense-review-21');
            expect(bm04Item.allowedActions).toEqual(['REQUEST_MORE_INFO', 'DECIDE_DEFENSE_REVIEW']);

            // Mentor cannot review own mentee's signature appeal
            const appealItem = actionRes.items.find((i) => i.id === 'signature-appeal-31');
            expect(appealItem.allowedActions).toEqual([]);
        });
    });

    describe('Task 2: decisions and publish tabs', () => {
        test('decisions tab isolates capabilities, validates resource readiness, and never leaks BM05 scores', async () => {
            const regDecision = makeReg({ id: 201, department: 'CNTT', status: 'BM02_APPROVED' });
            const regClearanceReady = makeReg({ id: 202, department: 'CNTT', status: 'PENDING_INSTITUTE_SIGNATURE' });
            const regClearanceNotReady = makeReg({ id: 203, department: 'CNTT', status: 'PENDING_INSTITUTE_SIGNATURE' });
            const regDefenseApproval = makeReg({
                id: 204,
                department: 'CNTT',
                status: 'AWAITING_FINAL_APPROVAL',
                extra: {
                    defenseCouncil: { id: 5, name: 'HĐ 1', scoreBookLocked: true },
                    resultPublicationItems: [],
                    defenseResult: { finalScore: 9.2, roundedFinalScore: 9.2 },
                    memberScores: [{ score: 9.2, comment: 'Nhận xét nội bộ chưa công bố' }],
                },
            });

            const db = makeDb({
                topicAssignmentDecision: {
                    findMany: jest.fn(async () => [
                        {
                            id: 71,
                            decisionNumber: 'QD-01/2026',
                            status: 'DRAFT',
                            items: [{ registration: regDecision }],
                        },
                    ]),
                },
                topicRegistration: {
                    findMany: jest.fn(async ({ where }) => {
                        if (where.status === 'BM02_APPROVED') {
                            return [{ ...regDecision, topicAssignmentDecisionItem: null }];
                        }
                        if (where.status === 'AWAITING_FINAL_APPROVAL') {
                            return [regDefenseApproval];
                        }
                        return [];
                    }),
                    count: jest.fn(async () => 0),
                },
                titleAdjustmentAppendix: {
                    findMany: jest.fn(async () => [
                        {
                            id: 81,
                            appendixNumber: 'PL-01/2026',
                            status: 'DRAFT',
                            items: [{ registration: regDecision }],
                        },
                    ]),
                },
                bM02AAdjustmentRequest: {
                    findMany: jest.fn(async () => [
                        {
                            id: 91,
                            status: 'APPROVED_PENDING_APPENDIX',
                            titleAdjustmentDeadline: new Date('2026-11-25T00:00:00Z'),
                            registration: regDecision,
                        },
                    ]),
                },
                projectArchive: {
                    findMany: jest.fn(async () => [
                        {
                            id: 111,
                            mentorReviewStatus: 'APPROVED',
                            academicAffairsReviewStatus: 'APPROVED',
                            certificateSignedAt: null,
                            windowClosesAt: null,
                            registration: regClearanceReady,
                        },
                        {
                            id: 112,
                            mentorReviewStatus: 'APPROVED',
                            academicAffairsReviewStatus: 'PENDING', // not ready
                            certificateSignedAt: null,
                            windowClosesAt: null,
                            registration: regClearanceNotReady,
                        },
                    ]),
                },
            });

            // Actor only has PROJECT_ASSIGNMENT_PUBLISH -> should not see clearance or defense approval
            const decisionOnlyActor = {
                id: 20,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['PROJECT_ASSIGNMENT_PUBLISH'],
            };
            const decisionOnlyRes = await getInstituteOperations({
                actor: decisionOnlyActor,
                tab: 'decisions',
                semesterId: 1,
                db,
            });
            expect(decisionOnlyRes.items.every((i) => i.kind === 'ASSIGNMENT_DECISION')).toBe(true);
            expect(decisionOnlyRes.items.map((i) => i.allowedActions)).toEqual([
                ['ISSUE_TOPIC_DECISION'],
                ['PUBLISH_TOPIC_DECISION'],
            ]);

            // Full director actor
            const director = {
                id: 21,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: [
                    'PROJECT_ASSIGNMENT_PUBLISH',
                    'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
                    'CLEARANCE_CERTIFICATE_SIGN',
                    'DEFENSE_RESULT_APPROVE',
                ],
            };
            const fullRes = await getInstituteOperations({
                actor: director,
                tab: 'decisions',
                semesterId: 1,
                db,
            });

            const clearanceReadyItem = fullRes.items.find((i) => i.id === 'clearance-certificate-111');
            expect(clearanceReadyItem.allowedActions).toEqual(['SIGN_CLEARANCE_CERTIFICATE']);

            const clearanceNotReadyItem = fullRes.items.find((i) => i.id === 'clearance-certificate-112');
            expect(clearanceNotReadyItem.allowedActions).toEqual([]);

            const approvalItem = fullRes.items.find((i) => i.id === 'defense-result-approval-204');
            expect(approvalItem.allowedActions).toEqual(['APPROVE_DEFENSE_RESULT']);
            // Ensure no BM05 score or comment leakage
            const serialized = JSON.stringify(approvalItem);
            expect(serialized).not.toContain('9.2');
            expect(serialized).not.toContain('Nhận xét nội bộ chưa công bố');
            expect(approvalItem.finalScore).toBeUndefined();
            expect(approvalItem.memberScores).toBeUndefined();
        });

        test('publish tab enforces rubric lock, valid approval evidence, and hides BM05 scores', async () => {
            const { hashScoreEvidence } = require('../../src/services/defenseResultPublicationService');
            const reg = makeReg({
                id: 301,
                department: 'CNTT',
                status: 'DEFENSE_PASSED',
                extra: {
                    defenseCouncilId: 9,
                    periodPolicyVersionId: 1,
                    defenseCouncil: {
                        id: 9,
                        scoreBookLocked: true,
                        members: [
                            { id: 1, lecturerId: 2, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                            { id: 2, lecturerId: 3, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                            { id: 3, lecturerId: 4, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                        ],
                    },
                    defenseResult: {
                        id: 55,
                        attendanceStatus: 'PRESENT',
                        scoreLocked: true,
                        scoreRubricVersion: 'v1',
                        lockedAt: new Date('2026-10-29T00:00:00.000Z'),
                        roundedFinalScore: 8.7,
                        finalScore: 8.7,
                    },
                    memberScores: [
                        { id: 77, evaluatorId: 2, isEffective: true, scoreLocked: true, scoreRubricVersion: 'v1', finalScore: 8.5, lockedAt: new Date('2026-10-29T00:00:00.000Z'), submittedAt: new Date('2026-11-10T00:00:00Z') },
                        { id: 78, evaluatorId: 3, isEffective: true, scoreLocked: true, scoreRubricVersion: 'v1', finalScore: 8.7, lockedAt: new Date('2026-10-29T00:00:00.000Z'), submittedAt: new Date('2026-11-10T00:00:00Z') },
                        { id: 79, evaluatorId: 4, isEffective: true, scoreLocked: true, scoreRubricVersion: 'v1', finalScore: 8.9, lockedAt: new Date('2026-10-29T00:00:00.000Z'), submittedAt: new Date('2026-11-10T00:00:00Z') },
                    ],
                },
            });
            const validFingerprint = hashScoreEvidence(reg);

            const db = makeDb({
                topicRegistration: {
                    findMany: jest.fn(async () => []),
                    count: jest.fn(async () => 5),
                },
                defenseResultApproval: {
                    findMany: jest.fn(async () => [
                        {
                            id: 401,
                            isEffective: true,
                            outcome: 'PASSED',
                            defenseResultId: 55,
                            defenseCouncilId: 9,
                            policyVersionId: 1,
                            rubricVersionSnapshot: 'v1',
                            scoreFingerprint: validFingerprint,
                            finalScoreSnapshot: 8.7,
                            approvedAt: new Date('2026-11-12T00:00:00Z'),
                            registration: reg,
                            publicationItems: [],
                        },
                        {
                            id: 402,
                            isEffective: true,
                            outcome: 'PASSED',
                            defenseResultId: 55,
                            defenseCouncilId: 9,
                            policyVersionId: 1,
                            rubricVersionSnapshot: 'v1',
                            scoreFingerprint: 'stale-fp', // stale -> cannot publish
                            finalScoreSnapshot: 7.5,
                            approvedAt: new Date('2026-11-12T00:00:00Z'),
                            registration: reg,
                            publicationItems: [],
                        },
                    ]),
                },
            });

            const publisher = {
                id: 30,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['DEFENSE_COUNCIL_MANAGE', 'RESULT_PUBLICATION_PUBLISH'],
            };

            const res = await getInstituteOperations({
                actor: publisher,
                tab: 'publish',
                semesterId: 1,
                db,
            });

            const eligibleItem = res.items.find((i) => i.kind === 'DEFENSE_ELIGIBLE_LIST_PUBLICATION');
            expect(eligibleItem.allowedActions).toEqual(['PUBLISH_DEFENSE_ELIGIBLE_LIST']);

            const validApproval = res.items.find((i) => i.id === 'result-publication-candidate-401');
            expect(validApproval.allowedActions).toEqual(['PUBLISH_DEFENSE_RESULTS']);

            const staleApproval = res.items.find((i) => i.id === 'result-publication-candidate-402');
            expect(staleApproval.allowedActions).toEqual([]);
            expect(staleApproval.status).toBe('EVIDENCE_STALE');

            const serialized = JSON.stringify(res.items);
            expect(serialized).not.toContain('8.7');
            expect(serialized).not.toContain('7.5');
            expect(serialized).not.toContain('finalScoreSnapshot');

            // View-only actor on publish tab
            const viewPublisher = {
                id: 31,
                role: 'LECTURER',
                department: 'CNTT',
                permissions: ['VIEW_DEFENSE_ASSIGNMENTS', 'VIEW_RESULT_PUBLICATIONS'],
            };
            const viewRes = await getInstituteOperations({
                actor: viewPublisher,
                tab: 'publish',
                semesterId: 1,
                db,
            });
            expect(viewRes.items.every((i) => i.allowedActions.length === 0)).toBe(true);
        });
    });
});
