const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { hashScoreEvidence } = require('../../src/services/defenseResultPublicationService');
const { allocateCouncilForRegistration } = require('./demoFixtures');

const RUBRIC_VERSION = 'DEMO-2026-V1';
const TIMELINE_TASK_TYPE = 'BM03_CHECKPOINT';

function statusForStudent(number) {
  if (number <= 10) return 'BM01_NEEDS_REVISION';
  if (number <= 20) return 'BM01_PASSED';
  if (number <= 30) return 'BM02_SUBMITTED';
  if (number <= 40) return 'DECISION_ISSUED';
  if (number <= 70) return 'IN_PROGRESS';
  if (number <= 90) return 'BM03_PASSED';
  if (number <= 100) return 'DEFENSE_READY';
  if (number <= 105) return 'AWAITING_SCORES';
  if (number <= 110) return 'AWAITING_FINAL_APPROVAL';
  if (number <= 115) return 'DEFENSE_PASSED';
  return 'DEFENSE_FAILED';
}

function buildRegistrationFixture({ number, semesterId, catalogId, studentId, mentorId, policyVersionId }) {
  const status = statusForStudent(number);
  const hasDecision = !['BM01_NEEDS_REVISION', 'BM01_PASSED', 'BM02_SUBMITTED'].includes(status);
  return {
    enrollment: { studentId, semesterId, projectCatalogId: catalogId, status: 'ACTIVE', source: 'SEED' },
    topic: { semesterId, projectCatalogId: catalogId, mentorId, proposedById: mentorId, maxStudents: 1, title: `Đồ án tốt nghiệp ${String(number).padStart(3, '0')}`, description: `Dữ liệu demo có kiểm soát cho sinh viên ${String(number).padStart(3, '0')}.`, status: 'APPROVED' },
    registration: { studentId, semesterId, periodPolicyVersionId: policyVersionId, status, outlineReviewStatus: status === 'BM01_NEEDS_REVISION' ? 'REVISION_REQUIRED' : 'PASSED', outlineFeedback: status === 'BM01_NEEDS_REVISION' ? 'Bổ sung phạm vi và kế hoạch thực hiện.' : null, decisionNumber: hasDecision ? 'QD-DATN-2026-01' : null, decisionDate: hasDecision ? new Date('2026-09-01T00:00:00.000Z') : null, stateVersion: 1 },
  };
}

function assertDefenseEvidence({ councilMemberIds, memberScores, defenseResult }) {
  const memberIds = new Set(councilMemberIds || []);
  const validScores = (memberScores || []).filter((score) => memberIds.has(score.evaluatorId) && score.scoreLocked && Number.isFinite(Number(score.finalScore)));
  if (memberIds.size !== 3 || validScores.length !== 3 || new Set(validScores.map((score) => score.evaluatorId)).size !== 3 || !defenseResult?.scoreLocked || !Number.isFinite(Number(defenseResult.finalScore)) || !defenseResult.scoreRubricVersion) throw new Error('LOCKED_DEFENSE_EVIDENCE_REQUIRED');
}

async function createCouncils(prisma, semesterId, lecturers, defenseDate) {
  const councils = [];
  for (let index = 0; index < 4; index += 1) {
    const members = lecturers.slice(index * 3, index * 3 + 3);
    const council = await prisma.council.create({ data: { semesterId, name: `Hội đồng bảo vệ ${index + 1}`, councilType: 'DEFENSE_COUNCIL', location: `Phòng ${201 + index}`, defenseDate } });
    await prisma.councilMember.createMany({ data: members.map((lecturer, memberIndex) => ({ councilId: council.id, lecturerId: lecturer.id, roleInCouncil: ['CHAIRMAN', 'SECRETARY', 'REVIEWER'][memberIndex] })) });
    councils.push({ id: council.id, memberIds: members.map((member) => member.id) });
  }
  return councils;
}

async function seedAcademicFixtures({ prisma, accountsByEmail, calendar }) {
  const admin = accountsByEmail.get('admin@university.edu.vn');
  const semester = await prisma.semester.create({ data: { name: calendar.name, startDate: new Date(`${calendar.startDate}T00:00:00.000Z`), registrationDeadline: new Date(`${calendar.registrationDeadline}T00:00:00.000Z`), midtermReportDate: new Date(`${calendar.midtermReportDate}T00:00:00.000Z`), defenseDate: new Date(`${calendar.defenseDate}T00:00:00.000Z`), endDate: new Date(`${calendar.endDate}T00:00:00.000Z`), registrationOpen: true, status: 'ONGOING' } });
  const catalog = await prisma.projectCatalog.create({ data: { code: 'DATN', name: 'Đồ án tốt nghiệp', isActive: true } });
  const policy = await prisma.periodWorkflowPolicyVersion.create({ data: { semesterId: semester.id, version: 1, policy: DEFAULT_POLICY, checksum: checksum(DEFAULT_POLICY), createdById: admin.id } });
  await prisma.rubricVersion.create({ data: { version: RUBRIC_VERSION, title: 'Rubric bảo vệ demo', totalMaxScore: 10, status: 'ACTIVE', isActive: true, createdById: admin.id } });
  const students = [...accountsByEmail.values()].filter((user) => user.role === 'STUDENT').sort((a, b) => a.email.localeCompare(b.email));
  const lecturers = [...accountsByEmail.values()].filter((user) => user.role === 'LECTURER').sort((a, b) => a.email.localeCompare(b.email));
  const councils = await createCouncils(prisma, semester.id, lecturers, new Date(`${calendar.defenseDate}T00:00:00.000Z`));
  const registrations = new Map();
  for (let index = 0; index < students.length; index += 1) {
    const number = index + 1; const student = students[index]; const mentor = lecturers[Math.floor(index / 10)];
    const fixture = buildRegistrationFixture({ number, semesterId: semester.id, catalogId: catalog.id, studentId: student.id, mentorId: mentor.id, policyVersionId: policy.id });
    await prisma.studentProjectEnrollment.create({ data: fixture.enrollment });
    const topic = await prisma.topic.create({ data: fixture.topic });
    const council = number >= 101 ? allocateCouncilForRegistration({ mentorId: mentor.id, councils }) : null;
    const registration = await prisma.topicRegistration.create({ data: { ...fixture.registration, topicId: topic.id, defenseCouncilId: council?.id || null } });
    await prisma.registrationStateHistory.create({ data: { registrationId: registration.id, fromStatus: 'REGISTERED', toStatus: fixture.registration.status, fromStateVersion: 0, toStateVersion: 1, actorId: admin.id, reason: 'Controlled demo seed', reference: { fixture: number }, idempotencyKey: `seed-registration-${number}` } });
    await prisma.idempotencyRecord.create({ data: { scope: 'seed', key: `seed-registration-${number}`, commandHash: 'controlled-demo-seed-v2', registrationId: registration.id, response: { status: fixture.registration.status } } });
    if (number >= 41 && number <= 100) await prisma.task.create({ data: { registrationId: registration.id, title: `Mốc triển khai ${number}`, content: 'Timeline demo', taskType: TIMELINE_TASK_TYPE, dueDate: new Date(`2026-${number <= 70 ? '09' : '11'}-15T00:00:00.000Z`), status: 'OPEN' } });
    registrations.set(number, { ...registration, student, topic, mentor, council });
  }
  return { semester, catalog, policy, admin, registrations, councils };
}

async function seedDefenseEvidenceAndPublications({ prisma, context, fixtures }) {
  const createEvidence = async (fixture) => {
    const memberScores = fixture.council.memberIds.map((evaluatorId, index) => ({ registrationId: fixture.id, evaluatorId, finalScore: [8, 8.5, 9][index], comments: 'Điểm demo đã khóa', scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: new Date('2026-12-15T08:00:00.000Z'), lockedBy: evaluatorId }));
    const resultData = { registrationId: fixture.id, finalScore: 8.5, comments: 'Kết quả tổng hợp demo', evaluatorId: context.admin.id, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: new Date('2026-12-15T09:00:00.000Z'), lockedBy: context.admin.id };
    assertDefenseEvidence({ councilMemberIds: fixture.council.memberIds, memberScores, defenseResult: resultData });
    await prisma.defenseMemberScore.createMany({ data: memberScores });
    const result = await prisma.defenseResult.create({ data: resultData });
    return { result, fingerprint: hashScoreEvidence({ defenseCouncilId: fixture.council.id, councilId: null, periodPolicyVersionId: fixture.periodPolicyVersionId, defenseResult: result, memberScores }) };
  };
  const createApproval = (fixture, evidence, supersedesApprovalId = null) => prisma.defenseResultApproval.create({ data: { registrationId: fixture.id, defenseResultId: evidence.result.id, outcome: 'PASSED', finalScoreSnapshot: 8.5, scoreFingerprint: evidence.fingerprint, rubricVersionSnapshot: RUBRIC_VERSION, defenseCouncilId: fixture.council.id, policyVersionId: fixture.periodPolicyVersionId, approvedById: context.admin.id, reason: supersedesApprovalId ? 'Điều chỉnh kết quả demo' : 'Phê duyệt kết quả demo', supersedesApprovalId, isEffective: true } });
  const initialFixture = fixtures.get(111); const supplementaryFixture = fixtures.get(112);
  const initialEvidence = await createEvidence(initialFixture); const supplementaryEvidence = await createEvidence(supplementaryFixture);
  const initialApproval = await createApproval(initialFixture, initialEvidence); const oldApproval = await createApproval(supplementaryFixture, supplementaryEvidence);
  const snapshot = (publicationId, fixture, approval, replacesPublicationItemId = null) => prisma.resultPublicationItem.create({ data: { publicationId, registrationId: fixture.id, sourceApprovalId: approval.id, replacesPublicationItemId, outcomeSnapshot: 'PASSED', finalScoreSnapshot: 8.5, studentCodeSnapshot: fixture.student.code, studentNameSnapshot: fixture.student.fullName, topicTitleSnapshot: fixture.topic.title } });
  const initial = await prisma.resultPublication.create({ data: { semesterId: context.semester.id, type: 'INITIAL', publishedById: context.admin.id, publishedAt: new Date('2026-12-16T08:00:00.000Z'), idempotencyKey: 'demo-initial-v1' } }); await snapshot(initial.id, initialFixture, initialApproval);
  const supplementary = await prisma.resultPublication.create({ data: { semesterId: context.semester.id, type: 'SUPPLEMENTARY', previousPublicationId: initial.id, reason: 'Bổ sung kết quả demo', publishedById: context.admin.id, publishedAt: new Date('2026-12-17T08:00:00.000Z'), idempotencyKey: 'demo-supplementary-v1' } }); const priorItem = await snapshot(supplementary.id, supplementaryFixture, oldApproval);
  await prisma.defenseResultApproval.update({ where: { id: oldApproval.id }, data: { isEffective: false, invalidatedAt: new Date('2026-12-18T08:00:00.000Z'), invalidatedReason: 'Điều chỉnh demo' } });
  const correctedApproval = await createApproval(supplementaryFixture, supplementaryEvidence, oldApproval.id);
  const correction = await prisma.resultPublication.create({ data: { semesterId: context.semester.id, type: 'CORRECTION', previousPublicationId: supplementary.id, reason: 'Điều chỉnh kết quả demo', publishedById: context.admin.id, publishedAt: new Date('2026-12-18T08:00:00.000Z'), idempotencyKey: 'demo-correction-v1' } }); const correctionItem = await snapshot(correction.id, supplementaryFixture, correctedApproval, priorItem.id);
  return { initial, supplementary, correction, correctionItem };
}

module.exports = { RUBRIC_VERSION, TIMELINE_TASK_TYPE, buildRegistrationFixture, seedAcademicFixtures, seedDefenseEvidenceAndPublications, assertDefenseEvidence, statusForStudent };
