const {
  buildRegistrationFixture,
  assertDefenseEvidence,
  TIMELINE_TASK_TYPE,
} = require('../../scripts/seed/workflowFixtures');

describe('workflow demo fixtures', () => {
  test('creates one approved one-student topic and matching active enrollment', () => {
    const fixture = buildRegistrationFixture({
      number: 1,
      semesterId: 4,
      catalogId: 7,
      studentId: 11,
      mentorId: 2,
      policyVersionId: 3,
    });

    expect(fixture.enrollment).toMatchObject({ studentId: 11, semesterId: 4, projectCatalogId: 7, status: 'ACTIVE' });
    expect(fixture.topic).toMatchObject({ semesterId: 4, mentorId: 2, proposedById: 2, maxStudents: 1, status: 'APPROVED' });
    expect(fixture.registration).toMatchObject({ studentId: 11, semesterId: 4, periodPolicyVersionId: 3 });
  });

  test('uses visible workflows states without a failed defense being completed', () => {
    expect(buildRegistrationFixture({ number: 116, semesterId: 1, catalogId: 1, studentId: 1, mentorId: 2, policyVersionId: 1 }).registration.status)
      .toBe('DEFENSE_FAILED');
    expect(buildRegistrationFixture({ number: 111, semesterId: 1, catalogId: 1, studentId: 1, mentorId: 2, policyVersionId: 1 }).registration.status)
      .toBe('DEFENSE_PASSED');
  });

  test('uses the schema-supported BM03 checkpoint task type for the implementation timeline', () => {
    expect(TIMELINE_TASK_TYPE).toBe('BM03_CHECKPOINT');
  });

  test('requires three distinct locked council scores and a locked aggregate before publication', () => {
    const valid = {
      councilMemberIds: [21, 22, 23],
      memberScores: [
        { evaluatorId: 21, finalScore: 8, scoreLocked: true },
        { evaluatorId: 22, finalScore: 8.5, scoreLocked: true },
        { evaluatorId: 23, finalScore: 9, scoreLocked: true },
      ],
      defenseResult: { finalScore: 8.5, scoreLocked: true, scoreRubricVersion: 'DEMO-2026-V1' },
    };

    expect(() => assertDefenseEvidence(valid)).not.toThrow();
    expect(() => assertDefenseEvidence({ ...valid, memberScores: valid.memberScores.slice(0, 2) }))
      .toThrow('LOCKED_DEFENSE_EVIDENCE_REQUIRED');
  });
});
