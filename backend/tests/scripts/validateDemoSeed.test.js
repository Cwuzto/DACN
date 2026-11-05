const { validateDemoSummary, validateDemoSeed } = require('../../scripts/seed/validateDemoSeed');

describe('demo seed summary validator', () => {
  test('accepts the agreed account and mentor distribution', () => {
    expect(() => validateDemoSummary({ admins: 1, lecturers: 12, students: 120, mentorCounts: Array(12).fill(10), activeEnrollments: 120, conflicts: 0, failedCompleted: 0, timelineTasks: 1 })).not.toThrow();
  });

  test('rejects an advisor that does not own exactly ten registrations', () => {
    expect(() => validateDemoSummary({ admins: 1, lecturers: 12, students: 120, mentorCounts: [9, ...Array(11).fill(10)], activeEnrollments: 120, conflicts: 0, failedCompleted: 0, timelineTasks: 1 })).toThrow('exactly 10');
  });

  test('derives council conflicts, failed completion and task timeline from persisted rows', async () => {
    const prisma = {
      user: { count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(12).mockResolvedValueOnce(120) },
      topicRegistration: {
        findMany: jest.fn().mockResolvedValue(Array.from({ length: 120 }, (_, index) => ({ id: index + 1, studentId: index + 1, semesterId: 1, status: index === 0 ? 'DEFENSE_FAILED' : 'IN_PROGRESS', topic: { mentorId: Math.floor(index / 10) + 2 }, defenseCouncil: { members: [{ lecturerId: 20 }, { lecturerId: 21 }, { lecturerId: 22 }] }, defenseResultApprovals: [] }))),
        count: jest.fn().mockResolvedValue(0),
      },
      studentProjectEnrollment: { findMany: jest.fn().mockResolvedValue(Array.from({ length: 120 }, (_, index) => ({ studentId: index + 1, semesterId: 1 }))) },
      task: { count: jest.fn().mockResolvedValue(3) },
    };

    const summary = await validateDemoSeed(prisma);

    expect(summary.conflicts).toBe(0);
    expect(summary.failedCompleted).toBe(0);
    expect(summary.timelineTasks).toBe(3);
  });
});
