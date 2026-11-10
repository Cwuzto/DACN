const {
  buildRegistrationFixture,
  assertDefenseEvidence,
  statusForStudent,
  seedAcademicFixtures,
  seedDefenseEvidenceAndPublications,
  RUBRIC_VERSION,
  TIMELINE_TASK_TYPE,
} = require('../../scripts/seed/workflowFixtures');
const { buildAccounts } = require('../../scripts/seed/demoFixtures');

function createMockPrisma() {
  const stores = {
    semesters: [],
    policies: [],
    catalogs: [],
    rubricVersions: [],
    rubricCategories: [],
    rubricCriteria: [],
    delegations: [],
    announcements: [],
    councils: [],
    councilMembers: [],
    councilResultBatches: [],
    enrollments: [],
    topics: [],
    registrations: [],
    bm01Evaluations: [],
    bm02Submissions: [],
    assignmentDecisions: [],
    decisionAmendments: [],
    topicTitleAdjustments: [],
    checkpointEvaluations: [],
    checkpointSignatureAppeals: [],
    bm04Evaluations: [],
    projectArchives: [],
    tasks: [],
    stateHistories: [],
    idempotencyRecords: [],
    defenseMemberScores: [],
    defenseResults: [],
    defenseResultApprovals: [],
    resultPublications: [],
    resultPublicationItems: [],
  };

  let idCounter = 1;
  const nextId = () => idCounter++;

  return {
    stores,
    semester: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.semesters.push(row);
        return row;
      }),
    },
    periodWorkflowPolicyVersion: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.policies.push(row);
        return row;
      }),
    },
    projectCatalog: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.catalogs.push(row);
        return row;
      }),
    },
    rubricVersion: {
      create: jest.fn(async ({ data }) => {
        const { categories, ...rest } = data;
        const versionRow = { id: nextId(), ...rest, categories: [] };
        stores.rubricVersions.push(versionRow);
        if (categories?.create) {
          for (const cat of categories.create) {
            const { criteria, ...catRest } = cat;
            const catRow = { id: nextId(), rubricVersionId: versionRow.id, ...catRest, criteria: [] };
            stores.rubricCategories.push(catRow);
            versionRow.categories.push(catRow);
            if (criteria?.create) {
              for (const crit of criteria.create) {
                const critRow = { id: nextId(), categoryId: catRow.id, ...crit };
                stores.rubricCriteria.push(critRow);
                catRow.criteria.push(critRow);
              }
            }
          }
        }
        return versionRow;
      }),
    },
    academicDelegation: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.delegations.push(row);
        return row;
      }),
    },
    publicAnnouncement: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.announcements.push(row);
        return row;
      }),
    },
    council: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.councils.push(row);
        return row;
      }),
    },
    councilMember: {
      createMany: jest.fn(async ({ data }) => {
        for (const item of data) {
          stores.councilMembers.push({ id: nextId(), ...item });
        }
        return { count: data.length };
      }),
    },
    councilResultBatch: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.councilResultBatches.push(row);
        return row;
      }),
    },
    studentProjectEnrollment: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.enrollments.push(row);
        return row;
      }),
    },
    topic: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.topics.push(row);
        return row;
      }),
    },
    topicRegistration: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.registrations.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) => {
        const reg = stores.registrations.find((r) => r.id === where.id);
        if (reg) Object.assign(reg, data);
        return reg;
      }),
    },
    bm01Evaluation: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.bm01Evaluations.push(row);
        return row;
      }),
    },
    bm02Submission: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.bm02Submissions.push(row);
        return row;
      }),
    },
    assignmentDecision: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.assignmentDecisions.push(row);
        return row;
      }),
    },
    decisionAmendment: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.decisionAmendments.push(row);
        return row;
      }),
    },
    topicTitleAdjustment: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.topicTitleAdjustments.push(row);
        return row;
      }),
    },
    checkpointEvaluation: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.checkpointEvaluations.push(row);
        return row;
      }),
    },
    checkpointSignatureAppeal: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.checkpointSignatureAppeals.push(row);
        return row;
      }),
    },
    bM04Evaluation: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.bm04Evaluations.push(row);
        return row;
      }),
    },
    projectArchive: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.projectArchives.push(row);
        return row;
      }),
    },
    task: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.tasks.push(row);
        return row;
      }),
    },
    registrationStateHistory: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.stateHistories.push(row);
        return row;
      }),
    },
    idempotencyRecord: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.idempotencyRecords.push(row);
        return row;
      }),
    },
    defenseMemberScore: {
      createMany: jest.fn(async ({ data }) => {
        for (const item of data) {
          stores.defenseMemberScores.push({ id: nextId(), ...item });
        }
        return { count: data.length };
      }),
    },
    defenseResult: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.defenseResults.push(row);
        return row;
      }),
    },
    defenseResultApproval: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.defenseResultApprovals.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) => {
        const approval = stores.defenseResultApprovals.find((a) => a.id === where.id);
        if (approval) Object.assign(approval, data);
        return approval;
      }),
    },
    resultPublication: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.resultPublications.push(row);
        return row;
      }),
    },
    resultPublicationItem: {
      create: jest.fn(async ({ data }) => {
        const row = { id: nextId(), ...data };
        stores.resultPublicationItems.push(row);
        return row;
      }),
    },
  };
}

describe('workflow demo fixtures', () => {
  test('uses standardized rubric version and BM03 checkpoint task type', () => {
    expect(RUBRIC_VERSION).toBe('RUBRIC-DATN-2026');
    expect(TIMELINE_TASK_TYPE).toBe('BM03_CHECKPOINT');
  });

  test('creates approved one-student topic and matching active enrollment', () => {
    const fixture = buildRegistrationFixture({
      number: 25,
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

  test('maps student status correctly across all cohorts', () => {
    expect(statusForStudent(1)).toBeNull();
    expect(statusForStudent(10)).toBeNull();
    expect(statusForStudent(11)).toBe('PENDING');
    expect(statusForStudent(20)).toBe('PENDING');
    expect(statusForStudent(21)).toBe('APPROVED');
    expect(statusForStudent(30)).toBe('APPROVED');
    expect(statusForStudent(31)).toBe('BM01_SUBMITTED');
    expect(statusForStudent(35)).toBe('BM01_SUBMITTED');
    expect(statusForStudent(36)).toBe('BM01_NEEDS_REVISION');
    expect(statusForStudent(40)).toBe('BM01_NEEDS_REVISION');
    expect(statusForStudent(41)).toBe('BM01_RESUBMITTED');
    expect(statusForStudent(45)).toBe('BM01_RESUBMITTED');
    expect(statusForStudent(46)).toBe('BM02_SUBMITTED');
    expect(statusForStudent(50)).toBe('BM02_SUBMITTED');
    expect(statusForStudent(51)).toBe('DECISION_ISSUED');
    expect(statusForStudent(70)).toBe('DECISION_ISSUED');
    expect(statusForStudent(71)).toBe('IN_PROGRESS');
    expect(statusForStudent(84)).toBe('IN_PROGRESS');
    expect(statusForStudent(85)).toBe('CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED');
    expect(statusForStudent(86)).toBe('BM03_PASSED');
    expect(statusForStudent(90)).toBe('BM03_PASSED');
    expect(statusForStudent(91)).toBe('BM04_REVIEW');
    expect(statusForStudent(95)).toBe('BM04_REVIEW');
    expect(statusForStudent(96)).toBe('DEFENSE_READY');
    expect(statusForStudent(100)).toBe('DEFENSE_READY');
    expect(statusForStudent(101)).toBe('AWAITING_SCORES');
    expect(statusForStudent(105)).toBe('AWAITING_SCORES');
    expect(statusForStudent(106)).toBe('AWAITING_FINAL_APPROVAL');
    expect(statusForStudent(110)).toBe('AWAITING_FINAL_APPROVAL');
    expect(statusForStudent(111)).toBe('DEFENSE_PASSED');
    expect(statusForStudent(115)).toBe('DEFENSE_PASSED');
    expect(statusForStudent(116)).toBe('DEFENSE_FAILED');
    expect(statusForStudent(120)).toBe('DEFENSE_FAILED');
  });

  test('requires three distinct locked council scores and a locked aggregate before publication', () => {
    const valid = {
      councilMemberIds: [21, 22, 23],
      memberScores: [
        { evaluatorId: 21, finalScore: 8, scoreLocked: true },
        { evaluatorId: 22, finalScore: 8.5, scoreLocked: true },
        { evaluatorId: 23, finalScore: 9, scoreLocked: true },
      ],
      defenseResult: { finalScore: 8.5, scoreLocked: true, scoreRubricVersion: RUBRIC_VERSION },
    };

    expect(() => assertDefenseEvidence(valid)).not.toThrow();
    expect(() => assertDefenseEvidence({ ...valid, memberScores: valid.memberScores.slice(0, 2) }))
      .toThrow('LOCKED_DEFENSE_EVIDENCE_REQUIRED');
  });

  test('seedAcademicFixtures creates multi-semester infrastructure and specialized entities', async () => {
    const prisma = createMockPrisma();
    const accounts = buildAccounts();
    const accountsByEmail = new Map();
    let idGen = 1;
    for (const acc of accounts) {
      accountsByEmail.set(acc.email, { id: idGen++, ...acc });
    }

    const baseDate = new Date('2026-11-05T08:00:00.000Z');
    const result = await seedAcademicFixtures({ prisma, accountsByEmail, baseDate });

    // 1. 2 Semesters and policies
    expect(prisma.stores.semesters).toHaveLength(2);
    const semNames = prisma.stores.semesters.map((s) => s.name);
    expect(semNames.some((n) => n.includes('HK1 2026–2027'))).toBe(true);
    expect(semNames.some((n) => n.includes('HK2 2026–2027'))).toBe(true);
    expect(prisma.stores.policies).toHaveLength(2);

    // 2. Project Catalog
    expect(prisma.stores.catalogs).toHaveLength(1);
    expect(prisma.stores.catalogs[0].code).toBe('DATN');

    // 3. Rubric Version with 3 categories and 6 criteria
    expect(prisma.stores.rubricVersions).toHaveLength(1);
    expect(prisma.stores.rubricVersions[0].version).toBe('RUBRIC-DATN-2026');
    expect(prisma.stores.rubricCategories).toHaveLength(3);
    expect(prisma.stores.rubricCriteria).toHaveLength(6);

    // 4. Academic Delegations
    expect(prisma.stores.delegations).toHaveLength(2);
    const activeDelegation = prisma.stores.delegations.find((d) => d.idempotencyKey === 'seed-delegation-active-01');
    expect(activeDelegation).toMatchObject({
      capabilityCode: 'BM02_REVIEW',
      status: 'ACTIVE',
    });
    expect(new Date(activeDelegation.effectiveTo).getTime()).toBeGreaterThan(baseDate.getTime());
    const expiredDelegation = prisma.stores.delegations.find((d) => d.idempotencyKey === 'seed-delegation-expired-02');
    expect(expiredDelegation).toMatchObject({
      capabilityCode: 'OUTLINE_REVIEW',
    });
    expect(new Date(expiredDelegation.effectiveTo).getTime()).toBeLessThan(baseDate.getTime());

    // 5. Announcements
    expect(prisma.stores.announcements).toHaveLength(3);
    const annCategories = prisma.stores.announcements.map((a) => a.category);
    expect(annCategories).toEqual(expect.arrayContaining(['REGISTRATION', 'ACADEMIC', 'DEFENSE']));

    // 6. Councils: 5 councils (4 defense + 1 outline)
    expect(prisma.stores.councils).toHaveLength(5);
    expect(prisma.stores.councilMembers).toHaveLength(15);

    // 7. Student Enrollments and Registrations
    // 120 total student enrollments
    expect(prisma.stores.enrollments).toHaveLength(120);
    // sv001-sv010 (10 SV) are unregistered in HK2 -> 110 registrations total
    expect(prisma.stores.registrations).toHaveLength(110);

    // HK2: open topics seeded
    const hk2Topics = prisma.stores.topics.filter((t) => t.semesterId === result.semesters.semesterHK2.id);
    expect(hk2Topics.length).toBeGreaterThanOrEqual(10);

    // HK2: 10 pending registrations (sv011-sv020)
    const pendingRegs = prisma.stores.registrations.filter((r) => r.status === 'PENDING');
    expect(pendingRegs).toHaveLength(10);

    // HK1: 5 BM01 revision with evaluations (sv036-sv040)
    const bm01Regs = prisma.stores.registrations.filter((r) => r.status === 'BM01_NEEDS_REVISION');
    expect(bm01Regs).toHaveLength(5);
    expect(prisma.stores.bm01Evaluations.length).toBeGreaterThanOrEqual(5);

    // HK1: 5 BM02 submitted with submissions (sv046-sv050)
    const bm02SubmittedRegs = prisma.stores.registrations.filter((r) => r.status === 'BM02_SUBMITTED');
    expect(bm02SubmittedRegs).toHaveLength(5);

    // HK1: Title adjustments for sv051 and sv052
    expect(prisma.stores.topicTitleAdjustments).toHaveLength(2);
    const pendingAdj = prisma.stores.topicTitleAdjustments.find((a) => a.status === 'PENDING');
    expect(pendingAdj).toBeDefined();
    const approvedAdj = prisma.stores.topicTitleAdjustments.find((a) => a.status === 'APPROVED');
    expect(approvedAdj).toBeDefined();
    expect(prisma.stores.decisionAmendments).toHaveLength(1);

    // HK1: sv085 Checkpoint appeal SUBMITTED
    const appeal = prisma.stores.checkpointSignatureAppeals.find((a) => a.status === 'SUBMITTED');
    expect(appeal).toBeDefined();
    expect(appeal.reason).toContain('Minh chứng báo cáo đầy đủ');

    // HK1: BM04 Evaluations and pre-defense archives
    expect(prisma.stores.bm04Evaluations.length).toBeGreaterThanOrEqual(10);
    const preDefenseArchives = prisma.stores.projectArchives.filter((a) => a.phase === 'PRE_DEFENSE');
    expect(preDefenseArchives.length).toBeGreaterThanOrEqual(10);

    // Đợt 1: 25 defense students across 4 councils with Zero-COI
    const defenseRegs = prisma.stores.registrations.filter((r) => r.defenseCouncilId !== null);
    expect(defenseRegs).toHaveLength(25);
    for (const reg of defenseRegs) {
      const topic = prisma.stores.topics.find((t) => t.id === reg.topicId);
      const councilMembers = prisma.stores.councilMembers.filter((m) => m.councilId === reg.defenseCouncilId);
      const memberLecturerIds = councilMembers.map((m) => m.lecturerId);
      expect(memberLecturerIds).not.toContain(topic.mentorId);
    }
  });

  test('seedDefenseEvidenceAndPublications creates multi-tier defense evidence and publications', async () => {
    const prisma = createMockPrisma();
    const accounts = buildAccounts();
    const accountsByEmail = new Map();
    let idGen = 1;
    for (const acc of accounts) {
      accountsByEmail.set(acc.email, { id: idGen++, ...acc });
    }

    const baseDate = new Date('2026-11-05T08:00:00.000Z');
    const context = await seedAcademicFixtures({ prisma, accountsByEmail, baseDate });
    const publications = await seedDefenseEvidenceAndPublications({
      prisma,
      context,
      fixtures: context.registrations,
    });

    expect(publications.initial).toBeDefined();
    expect(publications.supplementary).toBeDefined();
    expect(publications.correction).toBeDefined();

    // DefenseMemberScores and DefenseResults created for defense students (101-120)
    expect(prisma.stores.defenseMemberScores.length).toBeGreaterThanOrEqual(60); // 20 students * 3 members
    expect(prisma.stores.defenseResults.length).toBeGreaterThanOrEqual(20);
    expect(prisma.stores.defenseResultApprovals.length).toBeGreaterThanOrEqual(10); // passed + failed approvals
    expect(prisma.stores.resultPublications).toHaveLength(3);
    expect(prisma.stores.resultPublicationItems.length).toBeGreaterThanOrEqual(3);
  });
});
