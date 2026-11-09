const mockLecturerProjectAssignment = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
};

const mockSemester = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
};

const mockProjectCatalog = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
};

const mockStudentProjectEnrollment = {
    findMany: jest.fn(),
    count: jest.fn(),
};

const mockTopicRegistration = {
    findMany: jest.fn(),
    count: jest.fn(),
};

const mockTopic = {
    findMany: jest.fn(),
    count: jest.fn(),
};

const mockAcademicDelegation = {
    findMany: jest.fn(),
};

const mockPrisma = {
    lecturerProjectAssignment: mockLecturerProjectAssignment,
    user: mockUser,
    semester: mockSemester,
    projectCatalog: mockProjectCatalog,
    studentProjectEnrollment: mockStudentProjectEnrollment,
    topicRegistration: mockTopicRegistration,
    topic: mockTopic,
    academicDelegation: mockAcademicDelegation,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-signed-token'),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

function buildUser({ id, role, permissions = [], permissionVersion = 1, isActive = true }) {
    return {
        id,
        role,
        department: 'CNTT',
        email: `${role.toLowerCase()}${id}@test.vn`,
        fullName: `User ${role} ${id}`,
        code: `${role}-${id}`,
        isActive,
        permissionVersion,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('Lecturer Project Assignment Controller (/api/lecturer-assignments)', () => {
    const adminToken = 'admin-token';
    const unauthorizedToken = 'unauthorized-token';

    const academicAdmin = buildUser({
        id: 1,
        role: 'ADMIN',
        permissions: ['PERMISSION_ASSIGN_ACADEMIC', 'MENTOR_ASSIGN', 'VIEW_PROJECT_ENROLLMENTS', 'LECTURER_DIRECTORY_VIEW'],
    });

    const unauthorizedUser = buildUser({
        id: 2,
        role: 'STUDENT',
        permissions: ['VIEW_MY_REGISTRATION'],
    });

    const mockSem1 = {
        id: 1,
        name: 'ĐATN 2026.1',
        code: '2026.1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T23:59:59.000Z'),
        status: 'ONGOING',
    };

    const mockSem2 = {
        id: 2,
        name: 'DACN Hè 2026',
        code: '2026.HE',
        startDate: new Date('2026-05-15T00:00:00.000Z'),
        endDate: new Date('2026-08-31T23:59:59.000Z'),
        status: 'REGISTRATION',
    };

    const mockLecturer = {
        id: 10,
        fullName: 'TS. Nguyễn Văn A',
        code: 'GV001',
        email: 'nguyenvana@test.vn',
        department: 'CNTT',
        academicTitle: 'TIEN_SI',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === adminToken) return { userId: academicAdmin.id, role: academicAdmin.role, permissionVersion: academicAdmin.permissionVersion };
            if (token === unauthorizedToken) return { userId: unauthorizedUser.id, role: unauthorizedUser.role, permissionVersion: unauthorizedUser.permissionVersion };
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            if (where.id === academicAdmin.id) return Promise.resolve(academicAdmin);
            if (where.id === unauthorizedUser.id) return Promise.resolve(unauthorizedUser);
            if (where.id === mockLecturer.id) return Promise.resolve(mockLecturer);
            return Promise.resolve(null);
        });

        mockAcademicDelegation.findMany.mockResolvedValue([]);
    });

    describe('GET /api/lecturer-assignments', () => {
        it('returns list of lecturer assignments with workload metrics (currentRoundLoad, activeTodayLoad, peakConcurrentLoad, peakInterval)', async () => {
            const assignmentRecord = {
                id: 100,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 1,
                plannedQuota: 8,
                status: 'ACTIVE',
                lecturer: mockLecturer,
                semester: mockSem1,
                projectCatalog: { id: 1, name: 'Đồ án tốt nghiệp', code: 'DATN' },
            };

            mockLecturerProjectAssignment.findMany.mockResolvedValue([assignmentRecord]);

            // Mock student registrations for this lecturer: 3 active students in Sem 1
            const activeRegs = [
                {
                    id: 1,
                    semesterId: 1,
                    assignmentStatus: 'ACTIVE',
                    effectiveAt: mockSem1.startDate,
                    semester: mockSem1,
                    topic: { mentorId: 10, semester: mockSem1 },
                },
                {
                    id: 2,
                    semesterId: 1,
                    assignmentStatus: 'ACTIVE',
                    effectiveAt: mockSem1.startDate,
                    semester: mockSem1,
                    topic: { mentorId: 10, semester: mockSem1 },
                },
                {
                    id: 3,
                    semesterId: 1,
                    assignmentStatus: 'ACTIVE',
                    effectiveAt: mockSem1.startDate,
                    semester: mockSem1,
                    topic: { mentorId: 10, semester: mockSem1 },
                },
            ];

            mockTopicRegistration.findMany.mockResolvedValue(activeRegs);

            const res = await request(app)
                .get('/api/lecturer-assignments?semesterId=1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data).toHaveLength(1);

            const item = res.body.data[0];
            expect(item.id).toBe(100);
            expect(item.plannedQuota).toBe(8);
            expect(item.currentRoundLoad).toBe(3);
            expect(typeof item.activeTodayLoad).toBe('number');
            expect(item.peakConcurrentLoad).toBe(3);
            expect(item.peakInterval).toBeDefined();
        });

        it('returns 403 when user lacks view permission', async () => {
            const res = await request(app)
                .get('/api/lecturer-assignments?semesterId=1')
                .set('Authorization', `Bearer ${unauthorizedToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/lecturer-assignments', () => {
        it('validates plannedQuota with validatePlannedQuotaSweep and returns 400 when exceeding 10 across overlapping rounds', async () => {
            mockSemester.findUnique.mockResolvedValue(mockSem2);

            // Existing assignment in Sem 1 (overlaps Sem 2 from May 15 to June 30) with plannedQuota = 6
            mockLecturerProjectAssignment.findMany.mockResolvedValue([
                {
                    id: 50,
                    lecturerId: 10,
                    semesterId: 1,
                    plannedQuota: 6,
                    status: 'ACTIVE',
                    semester: mockSem1,
                },
            ]);

            // Attempting to assign plannedQuota = 6 in Sem 2 -> peak load would be 12 (> 10)
            const res = await request(app)
                .post('/api/lecturer-assignments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    lecturerId: 10,
                    semesterId: 2,
                    projectCatalogId: 1,
                    plannedQuota: 6,
                    status: 'ACTIVE',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('không thể thực hiện');
            expect(res.body.data.peakQuota).toBe(12);
            expect(mockLecturerProjectAssignment.upsert).not.toHaveBeenCalled();
            expect(mockLecturerProjectAssignment.create).not.toHaveBeenCalled();
        });

        it('creates assignment (HTTP 201) when plannedQuota is valid across overlapping rounds', async () => {
            mockSemester.findUnique.mockResolvedValue(mockSem2);

            // Existing assignment in Sem 1 with plannedQuota = 6
            mockLecturerProjectAssignment.findMany.mockResolvedValue([
                {
                    id: 50,
                    lecturerId: 10,
                    semesterId: 1,
                    plannedQuota: 6,
                    status: 'ACTIVE',
                    semester: mockSem1,
                },
            ]);

            // Assigning plannedQuota = 4 in Sem 2 -> peak = 10 (valid)
            const createdAssignment = {
                id: 101,
                lecturerId: 10,
                semesterId: 2,
                projectCatalogId: 1,
                plannedQuota: 4,
                status: 'ACTIVE',
                assignedById: academicAdmin.id,
                lecturer: mockLecturer,
                semester: mockSem2,
                projectCatalog: { id: 1, name: 'Đồ án tốt nghiệp', code: 'DATN' },
            };

            mockLecturerProjectAssignment.upsert.mockResolvedValue(createdAssignment);

            const res = await request(app)
                .post('/api/lecturer-assignments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    lecturerId: 10,
                    semesterId: 2,
                    projectCatalogId: 1,
                    plannedQuota: 4,
                    status: 'ACTIVE',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(101);
            expect(res.body.data.plannedQuota).toBe(4);
        });
    });

    describe('PUT /api/lecturer-assignments/:id', () => {
        it('updates plannedQuota and re-validates sweep capacity, rejecting if overloaded (HTTP 400)', async () => {
            const currentAssignment = {
                id: 101,
                lecturerId: 10,
                semesterId: 2,
                projectCatalogId: 1,
                plannedQuota: 4,
                status: 'ACTIVE',
                semester: mockSem2,
            };

            mockLecturerProjectAssignment.findUnique.mockResolvedValue(currentAssignment);

            // Existing overlapping assignment in Sem 1 with quota 6
            mockLecturerProjectAssignment.findMany.mockResolvedValue([
                {
                    id: 50,
                    lecturerId: 10,
                    semesterId: 1,
                    plannedQuota: 6,
                    status: 'ACTIVE',
                    semester: mockSem1,
                },
                currentAssignment,
            ]);

            // Updating plannedQuota to 7 -> total 6 + 7 = 13 (> 10)
            const res = await request(app)
                .put('/api/lecturer-assignments/101')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    plannedQuota: 7,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('không thể thực hiện');
            expect(mockLecturerProjectAssignment.update).not.toHaveBeenCalled();
        });

        it('updates status to CLOSED successfully when requested (HTTP 200)', async () => {
            const currentAssignment = {
                id: 101,
                lecturerId: 10,
                semesterId: 2,
                projectCatalogId: 1,
                plannedQuota: 4,
                status: 'ACTIVE',
                semester: mockSem2,
            };

            mockLecturerProjectAssignment.findUnique.mockResolvedValue(currentAssignment);
            mockLecturerProjectAssignment.findMany.mockResolvedValue([currentAssignment]);

            const updatedAssignment = {
                ...currentAssignment,
                status: 'CLOSED',
                lecturer: mockLecturer,
                semester: mockSem2,
                projectCatalog: { id: 1, name: 'Đồ án tốt nghiệp', code: 'DATN' },
            };
            mockLecturerProjectAssignment.update.mockResolvedValue(updatedAssignment);

            const res = await request(app)
                .put('/api/lecturer-assignments/101')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'CLOSED',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('CLOSED');
        });
    });

    describe('DELETE /api/lecturer-assignments/:id', () => {
        it('rejects deletion with HTTP 400 if lecturer has active student registrations in that semester', async () => {
            const currentAssignment = {
                id: 101,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 1,
                plannedQuota: 5,
                status: 'ACTIVE',
            };

            mockLecturerProjectAssignment.findUnique.mockResolvedValue(currentAssignment);
            // Lecturer has 2 active student registrations
            mockTopicRegistration.count.mockResolvedValue(2);

            const res = await request(app)
                .delete('/api/lecturer-assignments/101')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('sinh viên');
            expect(mockLecturerProjectAssignment.delete).not.toHaveBeenCalled();
        });

        it('deletes assignment with HTTP 200 when lecturer has no active registrations in that semester', async () => {
            const currentAssignment = {
                id: 101,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 1,
                plannedQuota: 5,
                status: 'ACTIVE',
            };

            mockLecturerProjectAssignment.findUnique.mockResolvedValue(currentAssignment);
            mockTopicRegistration.count.mockResolvedValue(0);
            mockLecturerProjectAssignment.delete.mockResolvedValue(currentAssignment);

            const res = await request(app)
                .delete('/api/lecturer-assignments/101')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockLecturerProjectAssignment.delete).toHaveBeenCalledWith({
                where: { id: 101 },
            });
        });
    });

    describe('POST /api/lecturer-assignments/bulk-upsert', () => {
        it('bulk upserts assignments when all rows are valid within sweep capacity', async () => {
            mockSemester.findUnique.mockResolvedValue(mockSem1);
            mockLecturerProjectAssignment.findMany.mockResolvedValue([]);
            mockLecturerProjectAssignment.findUnique.mockResolvedValue(null);
            mockLecturerProjectAssignment.create.mockResolvedValue({ id: 1 });

            const res = await request(app)
                .post('/api/lecturer-assignments/bulk-upsert')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    items: [
                        { lecturerId: 10, semesterId: 1, projectCatalogId: 1, plannedQuota: 8, status: 'ACTIVE' },
                        { lecturerId: 11, semesterId: 1, projectCatalogId: 1, plannedQuota: 10, status: 'ACTIVE' },
                    ],
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual({ created: 2, updated: 0 });
        });

        it('rejects bulk upsert with 400 when an item exceeds sweep capacity', async () => {
            mockSemester.findUnique.mockResolvedValue(mockSem2);
            // Lecturer 10 already has 8 in overlapping Sem 1
            mockLecturerProjectAssignment.findMany.mockImplementation(({ where }) => {
                if (where.lecturerId === 10) {
                    return Promise.resolve([
                        { id: 1, lecturerId: 10, semesterId: 1, plannedQuota: 8, status: 'ACTIVE', semester: mockSem1 },
                    ]);
                }
                return Promise.resolve([]);
            });

            // Trying to assign 5 more in Sem 2 -> 8 + 5 = 13 (> 10)
            const res = await request(app)
                .post('/api/lecturer-assignments/bulk-upsert')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    items: [
                        { lecturerId: 10, semesterId: 2, projectCatalogId: 1, plannedQuota: 5, status: 'ACTIVE' },
                    ],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('không thể thực hiện');
        });
    });

    describe('GET /api/lecturer-assignments/overview', () => {
        it('returns coordination overview metrics (enrolled vs assigned students, lecturers, planned slots, capacity utilization, overload alerts)', async () => {
            mockSemester.findUnique.mockResolvedValue(mockSem1);

            // 50 enrolled students
            mockStudentProjectEnrollment.count.mockResolvedValue(50);

            // 35 assigned students
            mockTopicRegistration.count.mockResolvedValue(35);

            // 5 assigned lecturers with total 45 planned slots
            const assignments = [
                { id: 1, lecturerId: 10, plannedQuota: 10, status: 'ACTIVE', semester: mockSem1, lecturer: mockLecturer },
                { id: 2, lecturerId: 11, plannedQuota: 10, status: 'ACTIVE', semester: mockSem1, lecturer: { id: 11, fullName: 'GV B', code: 'GV002' } },
                { id: 3, lecturerId: 12, plannedQuota: 8, status: 'ACTIVE', semester: mockSem1, lecturer: { id: 12, fullName: 'GV C', code: 'GV003' } },
                { id: 4, lecturerId: 13, plannedQuota: 10, status: 'ACTIVE', semester: mockSem1, lecturer: { id: 13, fullName: 'GV D', code: 'GV004' } },
                { id: 5, lecturerId: 14, plannedQuota: 7, status: 'ACTIVE', semester: mockSem1, lecturer: { id: 14, fullName: 'GV E', code: 'GV005' } },
            ];
            mockLecturerProjectAssignment.findMany.mockResolvedValue(assignments);

            // Registrations for overload calculation: lecturer 10 has 10 registrations (peak >= 10: CRITICAL alert)
            // lecturer 12 has 8 registrations (peak >= 8: WARNING alert)
            mockTopicRegistration.findMany.mockImplementation(({ where }) => {
                const lecturerId = where?.topic?.mentorId;
                if (lecturerId === 10) {
                    return Promise.resolve(Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        semesterId: 1,
                        assignmentStatus: 'ACTIVE',
                        effectiveAt: mockSem1.startDate,
                        semester: mockSem1,
                        topic: { mentorId: 10, semester: mockSem1 },
                    })));
                }
                if (lecturerId === 12) {
                    return Promise.resolve(Array.from({ length: 8 }, (_, i) => ({
                        id: 100 + i,
                        semesterId: 1,
                        assignmentStatus: 'ACTIVE',
                        effectiveAt: mockSem1.startDate,
                        semester: mockSem1,
                        topic: { mentorId: 12, semester: mockSem1 },
                    })));
                }
                return Promise.resolve([]);
            });

            const res = await request(app)
                .get('/api/lecturer-assignments/overview?semesterId=1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const overview = res.body.data;
            expect(overview.totalEnrolledStudents).toBe(50);
            expect(overview.totalAssignedStudents).toBe(35);
            expect(overview.unassignedStudents).toBe(15);
            expect(overview.totalAssignedLecturers).toBe(5);
            expect(overview.totalPlannedSlots).toBe(45);
            expect(overview.capacityUtilization).toBeCloseTo(77.8, 1);
            expect(Array.isArray(overview.overloadAlerts)).toBe(true);
            expect(overview.overloadAlerts.length).toBeGreaterThanOrEqual(2);

            const criticalAlert = overview.overloadAlerts.find(a => a.lecturerId === 10);
            expect(criticalAlert).toBeDefined();
            expect(criticalAlert.peakConcurrentLoad).toBe(10);
            expect(criticalAlert.severity).toBe('CRITICAL');

            const warningAlert = overview.overloadAlerts.find(a => a.lecturerId === 12);
            expect(warningAlert).toBeDefined();
            expect(warningAlert.peakConcurrentLoad).toBe(8);
            expect(warningAlert.severity).toBe('WARNING');
        });
    });
});
