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

    // pastSemester
    expect(semesters.pastSemester).toEqual({
      name: 'Đồ án tốt nghiệp — HK2 2025–2026',
      startDate: new Date('2026-01-05T00:00:00.000Z'),
      registrationDeadline: new Date('2026-01-20T00:00:00.000Z'),
      midtermReportDate: new Date('2026-03-25T00:00:00.000Z'),
      defenseDate: new Date('2026-05-15T00:00:00.000Z'),
      endDate: new Date('2026-05-30T00:00:00.000Z'),
      registrationOpen: false,
      status: 'COMPLETED',
    });

    // period2Supplementary
    const p2 = semesters.period2Supplementary;
    expect(p2.name).toBe('Đồ án tốt nghiệp — HK1 2026–2027 (Đợt 2 - Bổ sung)');
    expect(p2.startDate).toEqual(new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000));
    expect(p2.registrationDeadline).toEqual(new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000));
    expect(p2.midtermReportDate).toEqual(new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000));
    expect(p2.defenseDate).toEqual(new Date(baseDate.getTime() + 75 * 24 * 60 * 60 * 1000));
    expect(p2.endDate).toEqual(new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000));
    expect(p2.registrationOpen).toBe(true);
    expect(p2.status).toBe('REGISTRATION');
    expect(p2.registrationDeadline.getTime()).toBeGreaterThan(baseDate.getTime());

    // period1Main
    const p1 = semesters.period1Main;
    expect(p1.name).toBe('Đồ án tốt nghiệp — HK1 2026–2027 (Đợt 1 - Chính khóa)');
    expect(p1.startDate).toEqual(new Date(baseDate.getTime() - 90 * 24 * 60 * 60 * 1000));
    expect(p1.registrationDeadline).toEqual(new Date(baseDate.getTime() - 60 * 24 * 60 * 60 * 1000));
    expect(p1.midtermReportDate).toEqual(new Date(baseDate.getTime() - 20 * 24 * 60 * 60 * 1000));
    expect(p1.defenseDate).toEqual(baseDate);
    expect(p1.endDate).toEqual(new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000));
    expect(p1.registrationOpen).toBe(false);
    expect(p1.status).toBe('DEFENSE');

    // DEMO_SEMESTERS exported constant
    expect(DEMO_SEMESTERS.pastSemester.status).toBe('COMPLETED');
    expect(DEMO_SEMESTERS.period2Supplementary.status).toBe('REGISTRATION');
    expect(DEMO_SEMESTERS.period2Supplementary.registrationOpen).toBe(true);
    expect(DEMO_SEMESTERS.period1Main.status).toBe('DEFENSE');
    expect(DEMO_SEMESTERS.period1Main.registrationOpen).toBe(false);
  });

  test('preserves DEMO_CALENDAR aliasing period1Main for backward compatibility', () => {
    expect(DEMO_CALENDAR).toBeDefined();
    expect(DEMO_CALENDAR.name).toBe(DEMO_SEMESTERS.period1Main.name);
    expect(DEMO_CALENDAR.status).toBe('DEFENSE');
    expect(DEMO_CALENDAR.registrationOpen).toBe(false);
    expect(DEMO_CALENDAR.defenseDate).toEqual(DEMO_SEMESTERS.period1Main.defenseDate);
    expect(DEMO_CALENDAR.startDate).toEqual(DEMO_SEMESTERS.period1Main.startDate);
  });

  test('partitions all 120 students cleanly across cohorts with no gaps or overlaps', () => {
    expect(STUDENT_COHORTS).toBeDefined();

    const expectedCohorts = {
      PAST: { start: 1, end: 30, count: 30 },
      PERIOD2_UNREGISTERED: { start: 31, end: 40, count: 10 },
      PERIOD2_PENDING: { start: 41, end: 50, count: 10 },
      PERIOD2_BM01_NEEDS_REVISION: { start: 51, end: 55, count: 5 },
      PERIOD2_BM02_SUBMITTED: { start: 56, end: 60, count: 5 },
      PERIOD1_DECISION: { start: 61, end: 70, count: 10 },
      PERIOD1_CHECKPOINT: { start: 71, end: 85, count: 15 },
      PERIOD1_BM04: { start: 86, end: 95, count: 10 },
      PERIOD1_DEFENSE: { start: 96, end: 120, count: 25 },
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
