const { validateDemoSummary, validateDemoSeed } = require('../../scripts/seed/validateDemoSeed');

describe('multi-semester demo seed summary validator', () => {
  const baseValidSummary = {
    admins: 1,
    lecturers: 12,
    students: 120,
    semesters: 3,
    academicDelegations: 2,
    rubricCriteria: 6,
    activeEnrollments: 120,
    maxMentorActivePerPeriod: 10,
    mentorsWithRegistrations: 12,
    conflicts: 0,
    failedCompleted: 0,
    timelineTasks: 1,
  };

  test('accepts valid multi-semester demo summary', () => {
    expect(() => validateDemoSummary(baseValidSummary)).not.toThrow();
  });

  test('rejects if maxMentorActivePerPeriod exceeds 10', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, maxMentorActivePerPeriod: 11 })).toThrow(
      /capacity|exceed|10/i
    );
  });

  test('rejects if semesters count is not exactly 3', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, semesters: 2 })).toThrow(
      /3 semesters/i
    );
  });

  test('rejects if defense council conflicts exist', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, conflicts: 1 })).toThrow(
      /conflicts must be zero/i
    );
  });

  test('rejects if academicDelegations is less than 2', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, academicDelegations: 1 })).toThrow(
      /academic delegations/i
    );
  });

  test('rejects if rubricCriteria is less than 6', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, rubricCriteria: 5 })).toThrow(
      /rubric criteria/i
    );
  });

  test('rejects if activeEnrollments is not 120', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, activeEnrollments: 119 })).toThrow(
      /active enrollment/i
    );
  });

  test('rejects if not all 12 mentors have registrations', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, mentorsWithRegistrations: 11 })).toThrow(
      /12.*(mentor|lecturer)/i
    );
  });

  test('rejects if DEFENSE_FAILED registration is marked as COMPLETED', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, failedCompleted: 1 })).toThrow(
      /DEFENSE_FAILED/i
    );
  });

  test('rejects if timelineTasks is less than 1', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, timelineTasks: 0 })).toThrow(
      /timeline tasks/i
    );
  });

  test('rejects if account counts do not match agreed inventory', () => {
    expect(() => validateDemoSummary({ ...baseValidSummary, admins: 2 })).toThrow(
      /1 admin, 12 lecturers, and 120 students/i
    );
    expect(() => validateDemoSummary({ ...baseValidSummary, lecturers: 11 })).toThrow(
      /1 admin, 12 lecturers, and 120 students/i
    );
    expect(() => validateDemoSummary({ ...baseValidSummary, students: 100 })).toThrow(
      /1 admin, 12 lecturers, and 120 students/i
    );
  });

  test('derives multi-semester metrics, Zero-COI council checks, and capacity from persisted rows', async () => {
    // 120 enrollments across 3 semesters
    const enrollments = Array.from({ length: 120 }, (_, index) => ({
      studentId: index + 1,
      semesterId: index < 30 ? 1 : (index < 60 ? 2 : 3),
    }));

    // 110 registrations (sv031 - sv040 have no registration)
    // 12 mentors: mentorIds 2 to 13
    // In sem 1: 30 registrations across mentors (max 3 per mentor)
    // In sem 2: 20 registrations across mentors (max 2 per mentor)
    // In sem 3: 60 registrations across mentors (5 per mentor)
    const registrations = [];
    for (let i = 1; i <= 120; i++) {
      if (i >= 31 && i <= 40) continue; // no registration cohort
      const semesterId = i <= 30 ? 1 : (i <= 60 ? 2 : 3);
      const mentorId = ((i - 1) % 12) + 2; // 2..13
      registrations.push({
        id: registrations.length + 1,
        studentId: i,
        semesterId,
        status: i === 120 ? 'DEFENSE_FAILED' : 'IN_PROGRESS',
        topic: { mentorId },
        defenseCouncil: {
          members: [
            { lecturerId: (mentorId + 1) % 12 + 2 },
            { lecturerId: (mentorId + 2) % 12 + 2 },
            { lecturerId: (mentorId + 3) % 12 + 2 },
          ],
        },
        defenseResultApprovals: [],
      });
    }

    const prisma = {
      user: {
        count: jest.fn()
          .mockResolvedValueOnce(1)   // ADMIN
          .mockResolvedValueOnce(12)  // LECTURER
          .mockResolvedValueOnce(120), // STUDENT
      },
      semester: { count: jest.fn().mockResolvedValue(3) },
      academicDelegation: { count: jest.fn().mockResolvedValue(2) },
      rubricCriterion: { count: jest.fn().mockResolvedValue(6) },
      topicRegistration: { findMany: jest.fn().mockResolvedValue(registrations) },
      studentProjectEnrollment: { findMany: jest.fn().mockResolvedValue(enrollments) },
      task: { count: jest.fn().mockResolvedValue(4) },
    };

    const summary = await validateDemoSeed(prisma);

    expect(summary.admins).toBe(1);
    expect(summary.lecturers).toBe(12);
    expect(summary.students).toBe(120);
    expect(summary.semesters).toBe(3);
    expect(summary.academicDelegations).toBe(2);
    expect(summary.rubricCriteria).toBe(6);
    expect(summary.activeEnrollments).toBe(120);
    expect(summary.conflicts).toBe(0);
    expect(summary.failedCompleted).toBe(0);
    expect(summary.timelineTasks).toBe(4);
    expect(summary.mentorsWithRegistrations).toBe(12);
    expect(summary.maxMentorActivePerPeriod).toBeLessThanOrEqual(10);
    expect(summary.maxMentorActivePerPeriod).toBe(5); // In sem 3, 60 / 12 = 5 per mentor
  });

  test('detects council conflicts and completed defense failures', async () => {
    const enrollments = Array.from({ length: 120 }, (_, index) => ({
      studentId: index + 1,
      semesterId: 1,
    }));

    // Registration with conflict (mentor is in defense council)
    // Registration with failed-completed (COMPLETED but has effective FAILED approval)
    const registrations = [
      {
        id: 1,
        studentId: 1,
        semesterId: 1,
        status: 'COMPLETED',
        topic: { mentorId: 2 },
        defenseCouncil: {
          members: [{ lecturerId: 2 }, { lecturerId: 3 }, { lecturerId: 4 }], // conflict!
        },
        defenseResultApprovals: [{ outcome: 'FAILED', isEffective: true }], // failed completed!
      },
      ...Array.from({ length: 11 }, (_, i) => ({
        id: i + 2,
        studentId: i + 2,
        semesterId: 1,
        status: 'IN_PROGRESS',
        topic: { mentorId: i + 3 },
        defenseCouncil: { members: [{ lecturerId: 10 }] },
        defenseResultApprovals: [],
      })),
    ];

    const prisma = {
      user: {
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(12).mockResolvedValueOnce(120),
      },
      semester: { count: jest.fn().mockResolvedValue(3) },
      academicDelegation: { count: jest.fn().mockResolvedValue(2) },
      rubricCriterion: { count: jest.fn().mockResolvedValue(6) },
      topicRegistration: { findMany: jest.fn().mockResolvedValue(registrations) },
      studentProjectEnrollment: { findMany: jest.fn().mockResolvedValue(enrollments) },
      task: { count: jest.fn().mockResolvedValue(1) },
    };

    await expect(validateDemoSeed(prisma)).rejects.toThrow();
  });
});
