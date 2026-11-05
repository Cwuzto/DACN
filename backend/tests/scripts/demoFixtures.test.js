const {
  DEMO_CALENDAR,
  buildAccounts,
  advisorEmailForStudentNumber,
  buildMentorAssignments,
  allocateCouncilForRegistration,
} = require('../../scripts/seed/demoFixtures');

describe('deterministic demo fixtures', () => {
  test('creates the agreed account inventory', () => {
    const accounts = buildAccounts();

    expect(accounts.filter((account) => account.role === 'ADMIN')).toHaveLength(1);
    expect(accounts.filter((account) => account.role === 'LECTURER')).toHaveLength(12);
    expect(accounts.filter((account) => account.role === 'STUDENT')).toHaveLength(120);
    expect(accounts.find((account) => account.email === 'lecturer01@university.edu.vn')).toBeDefined();
    expect(accounts.find((account) => account.email === 'sv120@university.edu.vn')).toBeDefined();
  });

  test('maps fixed blocks of ten students to their advisor', () => {
    expect(advisorEmailForStudentNumber(1)).toBe('lecturer01@university.edu.vn');
    expect(advisorEmailForStudentNumber(10)).toBe('lecturer01@university.edu.vn');
    expect(advisorEmailForStudentNumber(11)).toBe('lecturer02@university.edu.vn');
    expect(advisorEmailForStudentNumber(20)).toBe('lecturer02@university.edu.vn');
    expect(buildMentorAssignments()).toHaveLength(120);
  });

  test('uses an implementation phase ending in November and defense in mid December', () => {
    expect(DEMO_CALENDAR.startDate).toBe('2026-08-01');
    expect(DEMO_CALENDAR.implementationEndDate).toBe('2026-11-30');
    expect(DEMO_CALENDAR.defenseDate).toBe('2026-12-15');
    expect(DEMO_CALENDAR.endDate).toBe('2026-12-20');
  });

  test('allocates a council that excludes the mentor', () => {
    const council = allocateCouncilForRegistration({
      mentorId: 2,
      councils: [
        { id: 1, memberIds: [2, 3, 4] },
        { id: 2, memberIds: [5, 6, 7] },
      ],
    });

    expect(council.id).toBe(2);
  });
});
