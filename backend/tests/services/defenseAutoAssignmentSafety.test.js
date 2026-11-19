const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn() },
    council: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    councilMember: { findMany: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    periodWorkflowPolicyVersion: { findMany: jest.fn() },
    academicDelegation: { findMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn(),
}));
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const councilAutoSetupService = require('../../src/services/councilAutoSetupService');
const {
    isBm04Eligible,
    isTopicValid,
    validateDefenseAssignment,
    MAX_STUDENTS_PER_DEFENSE_COUNCIL,
} = require('../../src/services/defenseCouncilEligibilityService');

describe('Defense Auto-Assignment Safety & Eligibility Guard Tests (Task 1: P0.4, P0.16)', () => {
    const adminUser = {
        id: 1,
        code: 'AD0001',
        fullName: 'Admin Quản Trị',
        role: 'ADMIN',
        isActive: true,
        permissions: ['DEFENSE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS'],
        permissionGroups: [
            {
                permissionGroup: {
                    permissions: [
                        { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                        { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                    ],
                },
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((t) => {
            if (t === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('Invalid token');
        });

        prisma.user.findUnique.mockResolvedValue(adminUser);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([]);
        prisma.academicDelegation.findMany.mockResolvedValue([]);
    });

    describe('1. Legacy auto-assign endpoint mutation guard', () => {
        test('POST /api/councils/auto-assign returns 400 and blocks background mutations', async () => {
            const res = await request(app)
                .post('/api/councils/auto-assign')
                .set('Authorization', 'Bearer admin-token')
                .send({ semesterId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(['USE_ASSIGNMENT_PREVIEW', 'DEFENSE_ASSIGNMENT_REQUIRES_REVIEW']).toContain(res.body.code);
            // Verify no mutations took place
            expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        });
    });

    describe('2. councilAutoSetupService safe 0-write contracts', () => {
        test('runAutoCouncilSetupForSemester performs 0 writes and returns safety warning', async () => {
            const result = await councilAutoSetupService.runAutoCouncilSetupForSemester(1);
            expect(result.createdCouncils).toBe(0);
            expect(result.updatedCouncils).toBe(0);
            expect(result.assigned).toBe(0);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toMatch(/Assignment Preview|vô hiệu hóa/);
        });

        test('runAutoCouncilSetupForDueSemesters performs 0 writes in scheduler', async () => {
            const result = await councilAutoSetupService.runAutoCouncilSetupForDueSemesters(14);
            expect(result.semesterCount).toBe(0);
            expect(result.results).toHaveLength(0);
            expect(result.warnings[0]).toMatch(/ngừng hoạt động|toàn vẹn học vụ/);
        });
    });

    describe('3. Defense Eligibility & BM04 Checks', () => {
        test('Single COMPLETED task alone is NOT eligible without finalized/locked BM04 evaluation', () => {
            const regWithOnlyCompletedTask = {
                id: 10,
                status: 'IN_PROGRESS',
                tasks: [{ id: 1, taskType: 'BM04', status: 'COMPLETED' }],
                bm04Evaluation: null,
            };
            expect(isBm04Eligible(regWithOnlyCompletedTask)).toBe(false);
        });

        test('BM04 evaluation unlocked is NOT eligible', () => {
            const regUnlockedBm04 = {
                id: 11,
                status: 'IN_PROGRESS',
                bm04Evaluation: {
                    isLocked: false,
                    finalized: false,
                    conclusion: 'AGREED_FOR_DEFENSE',
                },
            };
            expect(isBm04Eligible(regUnlockedBm04)).toBe(false);
        });

        test('BM04 locked with AGREED_FOR_DEFENSE is eligible', () => {
            const regValidBm04 = {
                id: 12,
                status: 'DEFENSE_READY',
                bm04Evaluation: {
                    isLocked: true,
                    conclusion: 'AGREED_FOR_DEFENSE',
                },
            };
            expect(isBm04Eligible(regValidBm04)).toBe(true);
        });

        test('Institute override ELIGIBLE_BY_INSTITUTE is eligible', () => {
            const regInstituteOverride = {
                id: 13,
                status: 'ELIGIBLE_BY_INSTITUTE',
                bm04Evaluation: null,
            };
            expect(isBm04Eligible(regInstituteOverride)).toBe(true);
        });

        test('1 student / 1 topic constraint: maxStudents > 1 is rejected', () => {
            const validTopic = { topic: { id: 1, maxStudents: 1 } };
            const invalidTopic = { topic: { id: 2, maxStudents: 2 } };
            expect(isTopicValid(validTopic)).toBe(true);
            expect(isTopicValid(invalidTopic)).toBe(false);
        });
    });

    describe('4. validateDefenseAssignment rules', () => {
        const baseCouncil = {
            id: 100,
            councilType: 'DEFENSE_COUNCIL',
            semesterId: 1,
            isActive: true,
            deletedAt: null,
            currentCount: 5,
        };

        const activeMembers = [
            { lecturerId: 201, roleInCouncil: 'CHAIRMAN', isActive: true },
            { lecturerId: 202, roleInCouncil: 'SECRETARY', isActive: true },
            { lecturerId: 203, roleInCouncil: 'REVIEWER', isActive: true },
        ];

        const validRegistration = {
            id: 50,
            semesterId: 1,
            status: 'DEFENSE_READY',
            topic: {
                id: 301,
                title: 'Hệ thống Quản lý Đồ án',
                mentorId: 999, // Không trùng với ai trong hội đồng
                maxStudents: 1,
            },
            bm04Evaluation: {
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
            },
        };

        test('passes when all conditions are strictly met', async () => {
            const validation = await validateDefenseAssignment({
                registration: validRegistration,
                council: baseCouncil,
                members: activeMembers,
            }, {
                db: {
                    councilMember: { findMany: jest.fn().mockResolvedValue([]) },
                    topicExpertiseAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
                },
            });

            expect(validation.ok).toBe(true);
            expect(validation.reasons).toHaveLength(0);
        });

        test('rejects when council member is student mentor (Conflict of Interest)', async () => {
            const conflictRegistration = {
                ...validRegistration,
                topic: {
                    ...validRegistration.topic,
                    mentorId: 201, // Trùng Chủ tịch HĐ
                },
            };

            const validation = await validateDefenseAssignment({
                registration: conflictRegistration,
                council: baseCouncil,
                members: activeMembers,
            }, {
                db: {
                    councilMember: { findMany: jest.fn().mockResolvedValue([]) },
                    topicExpertiseAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
                },
            });

            expect(validation.ok).toBe(false);
            expect(validation.reasons.some((r) => r.includes('Conflict of interest'))).toBe(true);
        });

        test('rejects when registration belongs to a different semester', async () => {
            const diffSemesterReg = {
                ...validRegistration,
                semesterId: 99, // Hội đồng là semesterId = 1
            };

            const validation = await validateDefenseAssignment({
                registration: diffSemesterReg,
                council: baseCouncil,
                members: activeMembers,
            }, {
                db: {
                    councilMember: { findMany: jest.fn().mockResolvedValue([]) },
                    topicExpertiseAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
                },
            });

            expect(validation.ok).toBe(false);
            expect(validation.reasons.some((r) => r.includes('cùng học kỳ'))).toBe(true);
        });

        test('rejects when council exceeds capacity of 30 students', async () => {
            const fullCouncil = {
                ...baseCouncil,
                currentCount: MAX_STUDENTS_PER_DEFENSE_COUNCIL, // 30
            };

            const validation = await validateDefenseAssignment({
                registration: validRegistration,
                council: fullCouncil,
                members: activeMembers,
            }, {
                db: {
                    councilMember: { findMany: jest.fn().mockResolvedValue([]) },
                    topicExpertiseAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
                },
            });

            expect(validation.ok).toBe(false);
            expect(validation.reasons.some((r) => r.includes('đạt sức chứa tối đa'))).toBe(true);
        });

        test('rejects when council is inactive or deleted', async () => {
            const inactiveCouncil = {
                ...baseCouncil,
                isActive: false,
            };

            const validation = await validateDefenseAssignment({
                registration: validRegistration,
                council: inactiveCouncil,
                members: activeMembers,
            }, {
                db: {
                    councilMember: { findMany: jest.fn().mockResolvedValue([]) },
                    topicExpertiseAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
                },
            });

            expect(validation.ok).toBe(false);
            expect(validation.reasons.some((r) => r.includes('không còn hoạt động'))).toBe(true);
        });
    });
});
