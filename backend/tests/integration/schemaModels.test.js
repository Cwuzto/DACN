const prisma = require('../../src/config/database');
const {
    Prisma,
    LecturerAssignmentStatus,
    MentorAssignmentStatus,
    TopicRegistrationScalarFieldEnum,
    LecturerProjectAssignmentScalarFieldEnum,
} = require('@prisma/client');

describe('Prisma Schema Models and Enums (Task 1)', () => {
    describe('LecturerAssignmentStatus enum', () => {
        it('should be defined with DRAFT, ACTIVE, CLOSED', () => {
            expect(LecturerAssignmentStatus).toBeDefined();
            expect(LecturerAssignmentStatus).toEqual({
                DRAFT: 'DRAFT',
                ACTIVE: 'ACTIVE',
                CLOSED: 'CLOSED',
            });
        });
    });

    describe('MentorAssignmentStatus enum', () => {
        it('should be defined with ACTIVE, TRANSFERRED, CANCELLED', () => {
            expect(MentorAssignmentStatus).toBeDefined();
            expect(MentorAssignmentStatus).toEqual({
                ACTIVE: 'ACTIVE',
                TRANSFERRED: 'TRANSFERRED',
                CANCELLED: 'CANCELLED',
            });
        });
    });

    describe('LecturerProjectAssignment model', () => {
        it('should be registered in Prisma.ModelName', () => {
            expect(Prisma.ModelName?.LecturerProjectAssignment).toBe('LecturerProjectAssignment');
        });

        it('should have client delegate on prisma instance', () => {
            expect(prisma.lecturerProjectAssignment).toBeDefined();
            expect(typeof prisma.lecturerProjectAssignment?.findMany).toBe('function');
            expect(typeof prisma.lecturerProjectAssignment?.findUnique).toBe('function');
            expect(typeof prisma.lecturerProjectAssignment?.create).toBe('function');
        });

        it('should have all expected scalar fields', () => {
            expect(LecturerProjectAssignmentScalarFieldEnum).toBeDefined();
            expect(LecturerProjectAssignmentScalarFieldEnum).toEqual(
                expect.objectContaining({
                    id: 'id',
                    lecturerId: 'lecturerId',
                    semesterId: 'semesterId',
                    projectCatalogId: 'projectCatalogId',
                    plannedQuota: 'plannedQuota',
                    status: 'status',
                    assignedAt: 'assignedAt',
                    assignedById: 'assignedById',
                    createdAt: 'createdAt',
                    updatedAt: 'updatedAt',
                })
            );
        });
    });

    describe('TopicRegistration model updates', () => {
        it('should have assignmentStatus, effectiveAt, and cancelledAt scalar fields', () => {
            expect(TopicRegistrationScalarFieldEnum).toEqual(
                expect.objectContaining({
                    assignmentStatus: 'assignmentStatus',
                    effectiveAt: 'effectiveAt',
                    cancelledAt: 'cancelledAt',
                })
            );
        });
    });

    describe('Database connectivity & query execution', () => {
        it('should execute findMany on lecturerProjectAssignment without error', async () => {
            const assignments = await prisma.lecturerProjectAssignment.findMany({ take: 1 });
            expect(Array.isArray(assignments)).toBe(true);
        });

        it('should query topicRegistration selecting new fields without error', async () => {
            const registration = await prisma.topicRegistration.findFirst({
                select: {
                    id: true,
                    assignmentStatus: true,
                    effectiveAt: true,
                    cancelledAt: true,
                },
            });
            if (registration) {
                expect(registration.assignmentStatus).toBeDefined();
                expect(registration.effectiveAt).toBeDefined();
            }
        });
    });
});
