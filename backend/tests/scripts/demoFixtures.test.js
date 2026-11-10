const {
  DEMO_CALENDAR,
  DEMO_SEMESTERS,
  STUDENT_COHORTS,
  buildAccounts,
  advisorEmailForStudentNumber,
  buildMentorAssignments,
  allocateCouncilForRegistration,
  getSemesterDefinitions,
} = require('../../scripts/seed/demoFixtures');

describe('deterministic demo fixtures', () => {
  test('creates the agreed account inventory (1 admin, 12 lecturers, 120 students)', () => {
    const accounts = buildAccounts();

    expect(accounts.filter((account) => account.role === 'ADMIN')).toHaveLength(1);
    expect(accounts.filter((account) => account.role === 'LECTURER')).toHaveLength(12);
    expect(accounts.filter((account) => account.role === 'STUDENT')).toHaveLength(120);
    expect(accounts.find((account) => account.email === 'admin@university.edu.vn')).toBeDefined();
    expect(accounts.find((account) => account.email === 'lecturer01@university.edu.vn')).toBeDefined();
    expect(accounts.find((account) => account.email === 'lecturer12@university.edu.vn')).toBeDefined();
    expect(accounts.find((account) => account.email === 'sv001@university.edu.vn')).toBeDefined();
    expect(accounts.find((account) => account.email === 'sv120@university.edu.vn')).toBeDefined();
  });

  test('maps fixed blocks of ten students to their advisor', () => {
    expect(advisorEmailForStudentNumber(1)).toBe('lecturer01@university.edu.vn');
    expect(advisorEmailForStudentNumber(10)).toBe('lecturer01@university.edu.vn');
    expect(advisorEmailForStudentNumber(11)).toBe('lecturer02@university.edu.vn');
    expect(advisorEmailForStudentNumber(20)).toBe('lecturer02@university.edu.vn');
    expect(advisorEmailForStudentNumber(120)).toBe('lecturer12@university.edu.vn');
    expect(() => advisorEmailForStudentNumber(0)).toThrow();
    expect(() => advisorEmailForStudentNumber(121)).toThrow();
    expect(buildMentorAssignments()).toHaveLength(120);
  });

  test('defines multi-semester calendar with relative dates and appropriate flags', () => {
    const baseDate = new Date('2026-11-05T12:00:00.000Z');
    const semesters = getSemesterDefinitions(baseDate);

    // semesterHK1
    const hk1 = semesters.semesterHK1;
    expect(hk1.code).toBe('DATN-HK1-2026-27');
    expect(hk1.name).toBe('Đồ án tốt nghiệp — HK1 2026–2027');
    expect(hk1.startDate).toEqual(new Date(baseDate.getTime() - 90 * 24 * 60 * 60 * 1000));
    expect(hk1.registrationDeadline).toEqual(new Date(baseDate.getTime() - 60 * 24 * 60 * 60 * 1000));
    expect(hk1.midtermReportDate).toEqual(new Date(baseDate.getTime() - 20 * 24 * 60 * 60 * 1000));
    expect(hk1.defenseDate).toEqual(baseDate);
    expect(hk1.endDate).toEqual(new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000));
    expect(hk1.registrationOpen).toBe(false);
    expect(hk1.status).toBe('DEFENSE');

    // semesterHK2
    const hk2 = semesters.semesterHK2;
    expect(hk2.code).toBe('DATN-HK2-2026-27');
    expect(hk2.name).toBe('Đồ án tốt nghiệp — HK2 2026–2027');
    expect(hk2.startDate).toEqual(new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000));
    expect(hk2.registrationDeadline).toEqual(new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000));
    expect(hk2.midtermReportDate).toEqual(new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000));
    expect(hk2.defenseDate).toEqual(new Date(baseDate.getTime() + 75 * 24 * 60 * 60 * 1000));
    expect(hk2.endDate).toEqual(new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000));
    expect(hk2.registrationOpen).toBe(true);
    expect(hk2.status).toBe('REGISTRATION');
    expect(hk2.registrationDeadline.getTime()).toBeGreaterThan(baseDate.getTime());

    // DEMO_SEMESTERS exported constant
    expect(DEMO_SEMESTERS.semesterHK1.status).toBe('DEFENSE');
    expect(DEMO_SEMESTERS.semesterHK2.status).toBe('REGISTRATION');
    expect(DEMO_SEMESTERS.semesterHK2.registrationOpen).toBe(true);
  });

  test('preserves DEMO_CALENDAR aliasing semesterHK1 for backward compatibility', () => {
    expect(DEMO_CALENDAR).toBeDefined();
    expect(DEMO_CALENDAR.name).toBe(DEMO_SEMESTERS.semesterHK1.name);
    expect(DEMO_CALENDAR.status).toBe('DEFENSE');
    expect(DEMO_CALENDAR.registrationOpen).toBe(false);
    expect(DEMO_CALENDAR.defenseDate).toEqual(DEMO_SEMESTERS.semesterHK1.defenseDate);
    expect(DEMO_CALENDAR.startDate).toEqual(DEMO_SEMESTERS.semesterHK1.startDate);
  });

  test('partitions all 120 students cleanly across cohorts with no gaps or overlaps', () => {
    expect(STUDENT_COHORTS).toBeDefined();

    const expectedCohorts = {
      HK2_UNREGISTERED: { start: 1, end: 10, count: 10 },
      HK2_PENDING: { start: 11, end: 20, count: 10 },
      HK2_APPROVED: { start: 21, end: 30, count: 10 },
      HK1_BM01_SUBMITTED: { start: 31, end: 35, count: 5 },
      HK1_BM01_NEEDS_REVISION: { start: 36, end: 40, count: 5 },
      HK1_BM01_RESUBMITTED: { start: 41, end: 45, count: 5 },
      HK1_BM02_SUBMITTED: { start: 46, end: 50, count: 5 },
      HK1_DECISION: { start: 51, end: 70, count: 20 },
      HK1_CHECKPOINT: { start: 71, end: 85, count: 15 },
      HK1_BM04: { start: 86, end: 95, count: 10 },
      HK1_DEFENSE: { start: 96, end: 120, count: 25 },
    };

    let totalCount = 0;
    const allSeenStudents = new Set();

    for (const [key, expected] of Object.entries(expectedCohorts)) {
      const cohort = STUDENT_COHORTS[key];
      expect(cohort).toBeDefined();
      expect(cohort.start).toBe(expected.start);
      expect(cohort.end).toBe(expected.end);
      expect(cohort.count).toBe(expected.count);
      totalCount += cohort.count;

      for (let n = cohort.start; n <= cohort.end; n += 1) {
        expect(allSeenStudents.has(n)).toBe(false);
        allSeenStudents.add(n);
        expect(cohort.includes(n)).toBe(true);
      }
    }

    expect(totalCount).toBe(120);
    expect(allSeenStudents.size).toBe(120);
    for (let i = 1; i <= 120; i += 1) {
      expect(allSeenStudents.has(i)).toBe(true);
    }

    // sv085 specifically belongs to PERIOD1_CHECKPOINT (for appeal test)
    expect(STUDENT_COHORTS.PERIOD1_CHECKPOINT.includes(85)).toBe(true);
  });

  test('allocates council with Zero-COI and balances loads evenly across councils', () => {
    const councils = [
      { id: 1, name: 'Hội đồng 1', memberIds: [1, 2, 3] },
      { id: 2, name: 'Hội đồng 2', memberIds: [4, 5, 6] },
      { id: 3, name: 'Hội đồng 3', memberIds: [7, 8, 9] },
      { id: 4, name: 'Hội đồng 4', memberIds: [10, 11, 12] },
    ];

    // Single allocation without load map (backward compatibility)
    const council = allocateCouncilForRegistration({
      mentorId: 2,
      councils,
    });
    expect(council.memberIds).not.toContain(2);
    expect(council.id).toBe(2); // first eligible council

    // Throws if no eligible council exists
    expect(() => {
      allocateCouncilForRegistration({
        mentorId: 1,
        councils: [{ id: 10, memberIds: [1, 2, 3] }],
      });
    }).toThrow(/No eligible defense council exists/);

    // Multi-student allocation for 25 defense students across 4 councils using Map
    const councilLoadMap = new Map(councils.map((c) => [c.id, 0]));
    const defenseStudentNumbers = STUDENT_COHORTS.PERIOD1_DEFENSE.studentNumbers;
    expect(defenseStudentNumbers).toHaveLength(25);

    const allocations = defenseStudentNumbers.map((studentNumber, idx) => {
      // Mentor distributed across 12 lecturers
      const mentorId = (idx % 12) + 1;
      const allocatedCouncil = allocateCouncilForRegistration({
        mentorId,
        councils,
        councilLoadMap,
      });
      return { studentNumber, mentorId, councilId: allocatedCouncil.id };
    });

    // 100% Zero-COI check
    allocations.forEach(({ mentorId, councilId }) => {
      const assignedCouncil = councils.find((c) => c.id === councilId);
      expect(assignedCouncil.memberIds).not.toContain(mentorId);
    });

    // Balanced distribution check: 7 + 6 + 6 + 6 = 25
    const loads = councils.map((c) => councilLoadMap.get(c.id)).sort((a, b) => b - a);
    expect(loads).toEqual([7, 6, 6, 6]);

    // Also verify object-based councilLoadMap works
    const objLoadMap = { 1: 0, 2: 0, 3: 0, 4: 0 };
    defenseStudentNumbers.forEach((_, idx) => {
      const mentorId = (idx % 12) + 1;
      allocateCouncilForRegistration({ mentorId, councils, councilLoadMap: objLoadMap });
    });
    const objLoads = Object.values(objLoadMap).sort((a, b) => b - a);
    expect(objLoads).toEqual([7, 6, 6, 6]);
  });
});
