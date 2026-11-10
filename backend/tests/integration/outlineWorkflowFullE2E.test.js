const request = require('supertest');
const jwt = require('jsonwebtoken');

// In-memory data store for E2E integration test
let store = {
    users: [],
    semesters: [],
    topics: [],
    topicRegistrations: [],
    councils: [],
    councilMembers: [],
    councilResultBatches: [],
    bm01Evaluations: [],
    tasks: [],
    submissions: [],
    bm02Submissions: [],
    idempotencyRecords: [],
    auditLogs: [],
};

let councilIdCounter = 200;
let councilMemberIdCounter = 1;
let batchIdCounter = 1;
let evalIdCounter = 1;
let taskIdCounter = 1;
let submissionIdCounter = 1;

const mockPrisma = {
    $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(async ({ where, select }) => {
            const user = store.users.find((u) => u.id === where.id);
            if (!user) return null;
            return {
                ...user,
                permissionGroups: user.permissionGroups || [],
                councilMembers: user.councilMembers || [],
            };
        }),
        findMany: jest.fn(async ({ where, select }) => {
            let list = [...store.users];
            if (where?.role) list = list.filter((u) => u.role === where.role);
            if (where?.isActive !== undefined) list = list.filter((u) => u.isActive === where.isActive);
            if (select) {
                return list.map((u) => {
                    const res = {};
                    for (const k of Object.keys(select)) res[k] = u[k];
                    return res;
                });
            }
            return list;
        }),
    },
    semester: {
        findUnique: jest.fn(async ({ where }) => {
            return store.semesters.find((s) => s.id === where.id) || null;
        }),
    },
    topic: {
        findUnique: jest.fn(async ({ where }) => {
            return store.topics.find((t) => t.id === where.id) || null;
        }),
    },
    topicRegistration: {
        findUnique: jest.fn(async ({ where, include }) => {
            const reg = store.topicRegistrations.find((r) => r.id === where.id);
            if (!reg) return null;
            const res = { ...reg };
            if (include?.outlineCouncil) {
                res.outlineCouncil = store.councils.find((c) => c.id === reg.outlineCouncilId) || null;
            }
            if (include?.student) {
                res.student = store.users.find((u) => u.id === reg.studentId) || null;
            }
            if (include?.topic) {
                res.topic = store.topics.find((t) => t.id === reg.topicId) || null;
            }
            if (include?.bm02Submissions) {
                res.bm02Submissions = store.bm02Submissions.filter((b) => b.registrationId === reg.id);
            }
            return res;
        }),
        findFirst: jest.fn(async ({ where, include }) => {
            let list = [...store.topicRegistrations];
            if (where?.studentId) list = list.filter((r) => r.studentId === where.studentId);
            if (where?.semesterId) list = list.filter((r) => r.semesterId === where.semesterId);
            if (where?.status) list = list.filter((r) => r.status === where.status);
            const reg = list[0];
            if (!reg) return null;
            const res = { ...reg };
            if (include?.outlineCouncil) {
                res.outlineCouncil = store.councils.find((c) => c.id === reg.outlineCouncilId) || null;
            }
            if (include?.student) {
                res.student = store.users.find((u) => u.id === reg.studentId) || null;
            }
            if (include?.topic) {
                res.topic = store.topics.find((t) => t.id === reg.topicId) || null;
            }
            return res;
        }),
        findMany: jest.fn(async ({ where, include }) => {
            let list = [...store.topicRegistrations];
            if (where?.semesterId) list = list.filter((r) => r.semesterId === where.semesterId);
            if (where?.status) list = list.filter((r) => r.status === where.status);
            if (where?.outlineCouncilId === null) {
                list = list.filter((r) => r.outlineCouncilId === null);
            } else if (where?.outlineCouncilId !== undefined) {
                list = list.filter((r) => r.outlineCouncilId === where.outlineCouncilId);
            }

            return list.map((reg) => {
                const res = { ...reg };
                if (include?.student) {
                    res.student = store.users.find((u) => u.id === reg.studentId) || null;
                }
                if (include?.topic) {
                    res.topic = store.topics.find((t) => t.id === reg.topicId) || null;
                }
                if (include?.bm02Submissions) {
                    res.bm02Submissions = store.bm02Submissions.filter((b) => b.registrationId === reg.id);
                }
                return res;
            });
        }),
        update: jest.fn(async ({ where, data }) => {
            const reg = store.topicRegistrations.find((r) => r.id === where.id);
            if (!reg) throw new Error(`TopicRegistration ${where.id} not found`);
            if (data.status) reg.status = data.status;
            if (data.outlineCouncilId !== undefined) reg.outlineCouncilId = data.outlineCouncilId;
            if (data.stateVersion?.increment) {
                reg.stateVersion = (reg.stateVersion || 1) + data.stateVersion.increment;
            }
            return { ...reg };
        }),
        updateMany: jest.fn(async ({ where, data }) => {
            let count = 0;
            for (const reg of store.topicRegistrations) {
                let match = true;
                if (where?.id?.in && !where.id.in.includes(reg.id)) match = false;
                if (where?.outlineCouncilId !== undefined && reg.outlineCouncilId !== where.outlineCouncilId) match = false;
                if (where?.status && reg.status !== where.status) match = false;
                if (match) {
                    if (data.status) reg.status = data.status;
                    if (data.outlineCouncilId !== undefined) reg.outlineCouncilId = data.outlineCouncilId;
                    count++;
                }
            }
            return { count };
        }),
        count: jest.fn(async ({ where }) => {
            let list = [...store.topicRegistrations];
            if (where?.outlineCouncilId !== undefined) {
                list = list.filter((r) => r.outlineCouncilId === where.outlineCouncilId);
            }
            if (where?.status) {
                list = list.filter((r) => r.status === where.status);
            }
            return list.length;
        }),
    },
    council: {
        create: jest.fn(async ({ data }) => {
            const newCouncil = {
                id: ++councilIdCounter,
                semesterId: data.semesterId,
                name: data.name,
                councilType: data.councilType || 'OUTLINE_REVIEW',
                defenseDate: data.defenseDate || null,
                location: data.location || null,
                meetingMode: data.meetingMode || 'IN_PERSON',
                schedulePublishedAt: null,
                revisionSubmissionDeadline: null,
                ...data,
            };
            store.councils.push(newCouncil);
            return { ...newCouncil };
        }),
        findUnique: jest.fn(async ({ where, include, select }) => {
            const c = store.councils.find((x) => x.id === where.id);
            if (!c) return null;
            const res = { ...c };
            if (include?.semester) {
                res.semester = store.semesters.find((s) => s.id === c.semesterId) || null;
            }
            if (include?.members || select?.members) {
                res.members = store.councilMembers.filter((m) => m.councilId === c.id);
            }
            return res;
        }),
        findFirst: jest.fn(async ({ where }) => {
            return store.councils.find((x) => x.id === where.id) || null;
        }),
        findMany: jest.fn(async ({ where, include }) => {
            let list = store.councils.filter((c) =>
                where?.semesterId ? c.semesterId === where.semesterId : true
            );
            return list.map((c) => ({
                ...c,
                members: include?.members ? store.councilMembers.filter((m) => m.councilId === c.id) : undefined,
            }));
        }),
        update: jest.fn(async ({ where, data }) => {
            const c = store.councils.find((x) => x.id === where.id);
            if (!c) throw new Error(`Council ${where.id} not found`);
            Object.assign(c, data);
            return { ...c };
        }),
    },
    councilMember: {
        createMany: jest.fn(async ({ data }) => {
            for (const item of data) {
                store.councilMembers.push({
                    id: ++councilMemberIdCounter,
                    councilId: item.councilId,
                    lecturerId: item.lecturerId,
                    roleInCouncil: item.roleInCouncil,
                });
            }
            return { count: data.length };
        }),
        create: jest.fn(async ({ data }) => {
            const mem = {
                id: ++councilMemberIdCounter,
                ...data,
            };
            store.councilMembers.push(mem);
            return { ...mem };
        }),
        deleteMany: jest.fn(async ({ where }) => {
            const initial = store.councilMembers.length;
            store.councilMembers = store.councilMembers.filter((m) => {
                if (where?.councilId && m.councilId === where.councilId) return false;
                return true;
            });
            return { count: initial - store.councilMembers.length };
        }),
        findFirst: jest.fn(async ({ where }) => {
            return store.councilMembers.find((m) => {
                if (where?.councilId && m.councilId !== where.councilId) return false;
                if (where?.lecturerId && m.lecturerId !== where.lecturerId) return false;
                if (where?.roleInCouncil) {
                    if (typeof where.roleInCouncil === 'string') {
                        if (m.roleInCouncil !== where.roleInCouncil) return false;
                    } else if (where.roleInCouncil.in) {
                        if (!where.roleInCouncil.in.includes(m.roleInCouncil)) return false;
                    }
                }
                return true;
            }) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
            return store.councilMembers.filter((m) =>
                where?.councilId ? m.councilId === where.councilId : true
            );
        }),
    },
    councilResultBatch: {
        create: jest.fn(async ({ data }) => {
            const batch = {
                id: ++batchIdCounter,
                versionNumber: data.versionNumber || 1,
                status: data.status || 'DRAFT',
                councilId: data.councilId,
                ...data,
            };
            store.councilResultBatches.push(batch);
            return { ...batch };
        }),
        findFirst: jest.fn(async ({ where, orderBy }) => {
            let list = store.councilResultBatches.filter((b) => b.councilId === where.councilId);
            if (orderBy?.versionNumber === 'desc') {
                list.sort((a, b) => b.versionNumber - a.versionNumber);
            }
            return list[0] || null;
        }),
        findUnique: jest.fn(async ({ where }) => {
            return store.councilResultBatches.find((b) => b.id === where.id) || null;
        }),
        update: jest.fn(async ({ where, data }) => {
            const b = store.councilResultBatches.find((x) => x.id === where.id);
            if (!b) throw new Error(`Batch ${where.id} not found`);
            Object.assign(b, data);
            return { ...b };
        }),
    },
    bM01Evaluation: {
        create: jest.fn(async ({ data }) => {
            const ev = {
                id: ++evalIdCounter,
                batchId: null,
                submissionId: null,
                revisionSubmissionId: null,
                initialOutcome: null,
                outcome: null,
                revisionApprovalStatus: null,
                ...data,
            };
            store.bm01Evaluations.push(ev);
            return { ...ev };
        }),
        findFirst: jest.fn(async ({ where, orderBy }) => {
            let list = store.bm01Evaluations.filter((e) => {
                if (where?.registrationId && e.registrationId !== where.registrationId) return false;
                if (where?.batchId !== undefined) {
                    const targetBatch = where.batchId ?? null;
                    const evalBatch = e.batchId ?? null;
                    if (targetBatch !== evalBatch) return false;
                }
                if (where?.OR) {
                    const matchesOr = where.OR.some((cond) => {
                        if (cond.batchId !== undefined) {
                            const condBatch = cond.batchId ?? null;
                            const evalBatch = e.batchId ?? null;
                            return condBatch === evalBatch;
                        }
                        return true;
                    });
                    if (!matchesOr) return false;
                }
                return true;
            });
            if (orderBy?.attemptNo === 'desc') {
                list.sort((a, b) => (b.attemptNo || 0) - (a.attemptNo || 0));
            }
            return list[0] ? { ...list[0] } : null;
        }),
        findMany: jest.fn(async ({ where }) => {
            return store.bm01Evaluations.filter((e) => {
                if (where?.batchId !== undefined) {
                    const targetBatch = where.batchId ?? null;
                    const evalBatch = e.batchId ?? null;
                    if (targetBatch !== evalBatch) return false;
                }
                if (where?.registrationId !== undefined && e.registrationId !== where.registrationId) return false;
                return true;
            }).map((e) => ({ ...e }));
        }),
        update: jest.fn(async ({ where, data }) => {
            const ev = store.bm01Evaluations.find((x) => x.id === where.id);
            if (!ev) throw new Error(`BM01Evaluation ${where.id} not found`);
            Object.assign(ev, data);
            return { ...ev };
        }),
        updateMany: jest.fn(async ({ where, data }) => {
            let count = 0;
            for (const ev of store.bm01Evaluations) {
                let match = true;
                if (where?.id !== undefined && ev.id !== where.id) match = false;
                if (where?.registrationId !== undefined && ev.registrationId !== where.registrationId) match = false;
                if (where?.submissionId === null && ev.submissionId !== null) match = false;
                if (where?.revisionSubmissionId === null && ev.revisionSubmissionId !== null) match = false;
                if (match) {
                    Object.assign(ev, data);
                    count++;
                }
            }
            return { count };
        }),
        count: jest.fn(async ({ where }) => {
            return store.bm01Evaluations.filter((e) => {
                if (where?.batchId !== undefined) {
                    const targetBatch = where.batchId ?? null;
                    const evalBatch = e.batchId ?? null;
                    if (targetBatch !== evalBatch) return false;
                }
                if (where?.initialOutcome?.not === null && (e.initialOutcome === null || e.initialOutcome === undefined)) return false;
                return true;
            }).length;
        }),
    },
    task: {
        create: jest.fn(async ({ data }) => {
            const t = {
                id: ++taskIdCounter,
                ...data,
            };
            store.tasks.push(t);
            return { ...t };
        }),
        findFirst: jest.fn(async ({ where }) => {
            return store.tasks.find((t) => {
                if (where?.registrationId && t.registrationId !== where.registrationId) return false;
                if (where?.taskType && t.taskType !== where.taskType) return false;
                return true;
            }) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
            return store.tasks.filter((t) =>
                where?.registrationId ? t.registrationId === where.registrationId : true
            );
        }),
        update: jest.fn(async ({ where, data }) => {
            const t = store.tasks.find((x) => x.id === where.id);
            if (!t) throw new Error(`Task ${where.id} not found`);
            Object.assign(t, data);
            return { ...t };
        }),
        updateMany: jest.fn(async ({ where, data }) => {
            let count = 0;
            for (const t of store.tasks) {
                let match = true;
                if (where?.registrationId && t.registrationId !== where.registrationId) match = false;
                if (where?.taskType && t.taskType !== where.taskType) match = false;
                if (match) {
                    Object.assign(t, data);
                    count++;
                }
            }
            return { count };
        }),
    },
    submission: {
        create: jest.fn(async ({ data }) => {
            const s = {
                id: ++submissionIdCounter,
                ...data,
            };
            store.submissions.push(s);
            return { ...s };
        }),
    },
    idempotencyRecord: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
    },
    auditLog: {
        create: jest.fn(async ({ data }) => {
            store.auditLogs.push(data);
            return data;
        }),
    },
    academicDelegation: {
        findMany: jest.fn(async () => []),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const app = require('../../src/app');

function makeUser(id, role, fullName, code, permissions = []) {
    return {
        id,
        role,
        email: `${code.toLowerCase()}@university.edu.vn`,
        fullName,
        code,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GRP_${code}`,
                permissions: permissions.map((p) => ({ permission: { code: p } })),
            },
        }],
    };
}

describe('Full E2E Outline Review & Council Lifecycle (Task 7 - Steps 1 to 9)', () => {
    let createdCouncilId = null;
    const registrationId = 101;
    const semesterId = 1;

    beforeAll(() => {
        process.env.JWT_SECRET = 'outline-e2e-workflow-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'mentor-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'chairman-token') return { userId: 30, role: 'LECTURER' };
            if (token === 'secretary-token') return { userId: 31, role: 'LECTURER' };
            if (token === 'member-token') return { userId: 32, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        // Initialize Store State
        store.users = [
            makeUser(10, 'STUDENT', 'Nguyen Van A', 'SV001', ['SUBMIT_BM01', 'VIEW_MY_REGISTRATION']),
            makeUser(20, 'LECTURER', 'TS. Tran Huong Dan', 'GV020', ['OUTLINE_REVIEW']),
            makeUser(30, 'LECTURER', 'TS. Chu Tich', 'GV030', ['OUTLINE_REVIEW']),
            makeUser(31, 'LECTURER', 'ThS. Thu Ky', 'GV031', ['OUTLINE_REVIEW']),
            makeUser(32, 'LECTURER', 'TS. Uy Vien', 'GV032', ['OUTLINE_REVIEW']),
            makeUser(1, 'ADMIN', 'Quan Tri Vien Khoa', 'AD001', ['OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE']),
        ];

        store.semesters = [
            {
                id: 1,
                name: 'Học kỳ 1 2026-2027',
                outlineSubmissionOpenAt: new Date(Date.now() - 86400000),
                outlineSubmissionDeadline: new Date(Date.now() + 86400000),
                outlineAllowedExtensions: ['.pdf', '.docx'],
                outlineMaxFileSizeBytes: 20971520,
                defenseDate: new Date(Date.now() + 7 * 86400000),
            },
        ];

        store.topics = [
            {
                id: 50,
                title: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
                mentorId: 20,
            },
        ];

        store.topicRegistrations = [
            {
                id: registrationId,
                studentId: 10,
                semesterId: 1,
                topicId: 50,
                status: 'APPROVED',
                outlineCouncilId: null,
                periodPolicyVersionId: 1,
                stateVersion: 1,
            },
        ];

        store.councils = [];
        store.councilMembers = [];
        store.councilResultBatches = [];
        store.bm01Evaluations = [];
        store.tasks = [];
        store.submissions = [];
        store.bm02Submissions = [];
        store.auditLogs = [];
    });

    test('Bước 1: Sinh viên nộp đề cương v1 (POST /api/outline/submissions) -> BM01_SUBMITTED', async () => {
        const payload = {
            registrationId,
            fileData: {
                fileName: 'de_cuong_v1.pdf',
                fileUrl: 'https://storage.university.edu/outlines/de_cuong_v1.pdf',
                fileSize: 102400,
                mimeType: 'application/pdf',
            },
        };

        const res = await request(app)
            .post('/api/outline/submissions')
            .set('Authorization', 'Bearer student-token')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Nộp đề cương thành công');

        // Verify Database State
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        expect(reg.status).toBe('BM01_SUBMITTED');

        const initialTask = store.tasks.find(
            (t) => t.registrationId === registrationId && t.taskType === 'BM01_INITIAL_SUBMISSION'
        );
        expect(initialTask).toBeDefined();
        expect(initialTask.status).toBe('COMPLETED');

        const evaluation = store.bm01Evaluations.find((e) => e.registrationId === registrationId);
        expect(evaluation).toBeDefined();
        expect(evaluation.attemptNo).toBe(1);
        expect(evaluation.submissionId).toBeDefined();
    });

    test('Bước 2: Admin kích hoạt tự động phân công (POST /api/councils/auto-assign-outline) -> sinh hội đồng gom cụm & 3 GV', async () => {
        const res = await request(app)
            .post('/api/councils/auto-assign-outline')
            .set('Authorization', 'Bearer admin-token')
            .send({ semesterId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.createdCouncils).toBe(1);
        expect(res.body.data.assignedStudents).toBe(1);

        // Verify Council Creation
        expect(store.councils.length).toBe(1);
        const council = store.councils[0];
        createdCouncilId = council.id;
        expect(council.councilType).toBe('OUTLINE_REVIEW');
        expect(council.name).toContain('Hội đồng Xét duyệt Đề cương 1');

        // Verify Student Assignment
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        expect(reg.outlineCouncilId).toBe(createdCouncilId);

        // Verify Conflict-free 3 Members Assigned (Mentor 20 excluded, Candidates 30, 31, 32)
        const members = store.councilMembers.filter((m) => m.councilId === createdCouncilId);
        expect(members.length).toBe(3);

        const chairman = members.find((m) => m.roleInCouncil === 'CHAIRMAN');
        const secretary = members.find((m) => m.roleInCouncil === 'SECRETARY');
        const reviewer = members.find((m) => m.roleInCouncil === 'REVIEWER');

        expect(chairman).toBeDefined();
        expect(chairman.lecturerId).toBe(30);

        expect(secretary).toBeDefined();
        expect(secretary.lecturerId).toBe(31);

        expect(reviewer).toBeDefined();
        expect(reviewer.lecturerId).toBe(32);

        // Ensure mentor 20 is not assigned to this council
        expect(members.some((m) => m.lecturerId === 20)).toBe(false);
    });

    test('Bước 3: Chủ tịch công bố lịch bảo vệ (PUT /api/councils/:id/schedule)', async () => {
        const schedulePayload = {
            defenseDate: '2026-11-20T08:30:00.000Z',
            meetingMode: 'IN_PERSON',
            location: 'Phòng Hội đồng B102',
        };

        const res = await request(app)
            .put(`/api/councils/${createdCouncilId}/schedule`)
            .set('Authorization', 'Bearer chairman-token')
            .send(schedulePayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Công bố lịch bảo vệ đề cương thành công');

        // Verify Council Schedule Published
        const council = store.councils.find((c) => c.id === createdCouncilId);
        expect(council.defenseDate).toEqual(new Date('2026-11-20T08:30:00.000Z'));
        expect(council.location).toBe('Phòng Hội đồng B102');
        expect(council.schedulePublishedAt).toBeDefined();
    });

    test('Bước 4: Thư ký lưu nháp và hoàn tất kết quả (REVISION_REQUIRED) -> PENDING_CHAIR', async () => {
        // 4a: Thư ký lưu nháp kết quả đánh giá
        const draftPayload = {
            initialOutcome: 'REVISION_REQUIRED',
            attendanceStatus: 'PRESENT',
            revisionRequirements: 'Cần bổ sung mô hình quan hệ cơ sở dữ liệu chi tiết và cập nhật kế hoạch triển khai.',
        };

        const draftRes = await request(app)
            .put(`/api/councils/${createdCouncilId}/results/${registrationId}`)
            .set('Authorization', 'Bearer secretary-token')
            .send(draftPayload);

        expect(draftRes.status).toBe(200);
        expect(draftRes.body.success).toBe(true);
        expect(draftRes.body.message).toContain('Lưu nháp đánh giá thành công');

        // 4b: Thư ký hoàn tất đánh giá hội đồng
        const completeRes = await request(app)
            .post(`/api/councils/${createdCouncilId}/results/secretary-complete`)
            .set('Authorization', 'Bearer secretary-token')
            .send();

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.success).toBe(true);
        expect(completeRes.body.data.status).toBe('PENDING_CHAIR');

        // Verify Batch State
        const batch = store.councilResultBatches.find((b) => b.councilId === createdCouncilId);
        expect(batch).toBeDefined();
        expect(batch.status).toBe('PENDING_CHAIR');
        expect(batch.secretaryCompletedAt).toBeDefined();
        expect(batch.secretaryCompletedById).toBe(31);
    });

    test('Bước 5: Chủ tịch công bố kết quả (POST /api/councils/:id/results/publish) -> BM01_NEEDS_REVISION', async () => {
        const res = await request(app)
            .post(`/api/councils/${createdCouncilId}/results/publish`)
            .set('Authorization', 'Bearer chairman-token')
            .send();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Công bố kết quả hội đồng thành công');

        // Verify Batch Published
        const batch = store.councilResultBatches.find((b) => b.councilId === createdCouncilId);
        expect(batch.status).toBe('PUBLISHED');
        expect(batch.chairPublishedAt).toBeDefined();
        expect(batch.chairPublishedById).toBe(30);

        // Verify Registration transitions to BM01_NEEDS_REVISION
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        expect(reg.status).toBe('BM01_NEEDS_REVISION');

        const evaluation = store.bm01Evaluations.find((e) => e.registrationId === registrationId);
        expect(evaluation.outcome).toBe('NEEDS_REVISION');
        expect(evaluation.revisionApprovalStatus).toBe('PENDING');
    });

    test('Bước 6: Chủ tịch đặt hạn nộp lại (PUT /api/councils/:id/revision-deadline) -> Task BM01_RESUBMISSION OPEN', async () => {
        const deadlinePayload = {
            revisionDeadline: '2026-11-25T17:00:00.000Z',
        };

        const res = await request(app)
            .put(`/api/councils/${createdCouncilId}/revision-deadline`)
            .set('Authorization', 'Bearer chairman-token')
            .send(deadlinePayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Đã cập nhật hạn nộp lại đề cương');

        // Verify Council revisionSubmissionDeadline updated
        const council = store.councils.find((c) => c.id === createdCouncilId);
        expect(council.revisionSubmissionDeadline).toEqual(new Date('2026-11-25T17:00:00.000Z'));

        // Verify BM01_RESUBMISSION Task created with OPEN status
        const resubmissionTask = store.tasks.find(
            (t) => t.registrationId === registrationId && t.taskType === 'BM01_RESUBMISSION'
        );
        expect(resubmissionTask).toBeDefined();
        expect(resubmissionTask.status).toBe('OPEN');
        expect(resubmissionTask.dueDate).toEqual(new Date('2026-11-25T17:00:00.000Z'));
    });

    test('Bước 7: Sinh viên nộp lại file v2 (POST /api/outline/resubmissions) -> BM01_RESUBMITTED và chặn nộp lại lần nữa (409)', async () => {
        const payload = {
            registrationId,
            fileData: {
                fileName: 'de_cuong_v2_chinh_sua.pdf',
                fileUrl: 'https://storage.university.edu/outlines/de_cuong_v2_chinh_sua.pdf',
                fileSize: 125000,
                mimeType: 'application/pdf',
            },
        };

        // 7a: Nộp lần 1 thành công
        const res1 = await request(app)
            .post('/api/outline/resubmissions')
            .set('Authorization', 'Bearer student-token')
            .send(payload);

        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);
        expect(res1.body.message).toContain('Nộp lại đề cương thành công');

        // Verify Database State
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        expect(reg.status).toBe('BM01_RESUBMITTED');

        const task = store.tasks.find(
            (t) => t.registrationId === registrationId && t.taskType === 'BM01_RESUBMISSION'
        );
        expect(task.status).toBe('COMPLETED');

        const evaluation = store.bm01Evaluations.find((e) => e.registrationId === registrationId);
        expect(evaluation.revisionSubmissionId).toBeDefined();

        // 7b: Chặn nộp lại lần 2 ngay lập tức với lỗi 409 (RESUBMISSION_ALREADY_USED)
        const res2 = await request(app)
            .post('/api/outline/resubmissions')
            .set('Authorization', 'Bearer student-token')
            .send(payload);

        expect(res2.status).toBe(409);
        expect(res2.body.success).toBe(false);
        expect(res2.body.message).toBe('RESUBMISSION_ALREADY_USED');
    });

    test('Bước 8: Chủ tịch thẩm định duyệt bản sửa (POST /api/councils/:id/resubmissions/:registrationId/review) -> BM01_PASSED, sinh Task BM02 OPEN', async () => {
        const reviewPayload = {
            decision: 'APPROVE',
            revisionFeedback: 'Bản đề cương đã chỉnh sửa đầy đủ theo yêu cầu của hội đồng.',
        };

        const res = await request(app)
            .post(`/api/councils/${createdCouncilId}/resubmissions/${registrationId}/review`)
            .set('Authorization', 'Bearer chairman-token')
            .send(reviewPayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify Registration transitions to BM01_PASSED
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        expect(reg.status).toBe('BM01_PASSED');

        // Verify Evaluation Approval
        const evaluation = store.bm01Evaluations.find((e) => e.registrationId === registrationId);
        expect(evaluation.revisionApprovalStatus).toBe('APPROVED');
        expect(evaluation.outcome).toBe('PASSED');
        expect(evaluation.revisionReviewedById).toBe(30);

        // Verify BM02 Task is automatically created in OPEN status
        const bm02Task = store.tasks.find(
            (t) => t.registrationId === registrationId && t.taskType === 'BM02'
        );
        expect(bm02Task).toBeDefined();
        expect(bm02Task.status).toBe('OPEN');
        expect(bm02Task.title).toContain('BM02');
    });

    test('Bước 9: Kiểm thử Reopen an toàn: Giả lập sinh viên đã có đơn BM02 -> Admin mở khóa bị chặn với 409 BM02_DEPENDENCY_EXISTS', async () => {
        // 9a: Giả lập sinh viên đã nộp đơn BM02 downstream
        store.bm02Submissions.push({
            id: 1,
            registrationId,
            status: 'BM02_SUBMITTED',
            submittedAt: new Date(),
        });
        const reg = store.topicRegistrations.find((r) => r.id === registrationId);
        reg.status = 'BM02_SUBMITTED';

        // 9b: Admin gọi POST /api/councils/:id/results/reopen bị chặn ngay với 409
        const reopenPayload = {
            reason: 'Phát hiện sai sót trong ghi nhận điểm số của hội đồng.',
        };

        const resBlocked = await request(app)
            .post(`/api/councils/${createdCouncilId}/results/reopen`)
            .set('Authorization', 'Bearer admin-token')
            .send(reopenPayload);

        expect(resBlocked.status).toBe(409);
        expect(resBlocked.body.success).toBe(false);
        expect(resBlocked.body.message).toBe('BM02_DEPENDENCY_EXISTS');

        // Verify details contain blocking registrations list
        expect(resBlocked.body.blockingRegistrations).toBeDefined();
        expect(Array.isArray(resBlocked.body.blockingRegistrations)).toBe(true);
        expect(resBlocked.body.blockingRegistrations.length).toBe(1);
        expect(resBlocked.body.blockingRegistrations[0].registrationId).toBe(registrationId);
        expect(resBlocked.body.blockingRegistrations[0].studentName).toBe('Nguyen Van A');

        // 9c: Đảm bảo khi KHÔNG còn dependency BM02, Admin mở khóa thành công
        store.bm02Submissions = [];
        reg.status = 'BM01_PASSED';

        const resAllowed = await request(app)
            .post(`/api/councils/${createdCouncilId}/results/reopen`)
            .set('Authorization', 'Bearer admin-token')
            .send(reopenPayload);

        expect(resAllowed.status).toBe(200);
        expect(resAllowed.body.success).toBe(true);
        expect(resAllowed.body.message).toContain('Đã mở khóa kết quả hội đồng');

        // Verify previous batch SUPERSEDED and new batch created with incremented versionNumber
        const batches = store.councilResultBatches.filter((b) => b.councilId === createdCouncilId);
        expect(batches.length).toBe(2);

        const oldBatch = batches.find((b) => b.versionNumber === 1);
        expect(oldBatch.status).toBe('SUPERSEDED');

        const newBatch = batches.find((b) => b.versionNumber === 2);
        expect(newBatch.status).toBe('REOPENED');
    });
});
