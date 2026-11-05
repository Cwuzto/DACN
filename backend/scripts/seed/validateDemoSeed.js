function validateDemoSummary(summary) {
  if (summary.admins !== 1 || summary.lecturers !== 12 || summary.students !== 120) throw new Error('Demo seed must contain 1 admin, 12 lecturers, and 120 students.');
  if (summary.mentorCounts.length !== 12 || summary.mentorCounts.some((count) => count !== 10)) throw new Error('Each lecturer must mentor exactly 10 registrations.');
  if (summary.activeEnrollments !== 120) throw new Error('Every demo registration must have one active enrollment.');
  if (summary.conflicts !== 0) throw new Error('Defense council conflicts must be zero.');
  if (summary.failedCompleted !== 0) throw new Error('DEFENSE_FAILED registrations must not be completed.');
  if (summary.timelineTasks < 1) throw new Error('Demo seed must include implementation timeline tasks.');
}

async function validateDemoSeed(prisma) {
  const [admins, lecturers, students, registrations, enrollments, timelineTasks] = await Promise.all([
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'LECTURER' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.topicRegistration.findMany({ select: { id: true, studentId: true, semesterId: true, status: true, topic: { select: { mentorId: true } }, defenseCouncil: { select: { members: { select: { lecturerId: true } } } }, defenseResultApprovals: { select: { outcome: true, isEffective: true } } } }),
    prisma.studentProjectEnrollment.findMany({ where: { status: 'ACTIVE' }, select: { studentId: true, semesterId: true } }),
    prisma.task.count({ where: { dueDate: { gte: new Date('2026-08-01T00:00:00.000Z'), lte: new Date('2026-11-30T23:59:59.999Z') } } }),
  ]);
  const mentorMap = new Map();
  const enrollmentKeys = new Set(enrollments.map((row) => `${row.studentId}:${row.semesterId}`));
  let conflicts = 0; let failedCompleted = 0;
  for (const registration of registrations) {
    const mentorId = registration.topic.mentorId;
    mentorMap.set(mentorId, (mentorMap.get(mentorId) || 0) + 1);
    if (registration.defenseCouncil?.members?.some((member) => member.lecturerId === mentorId)) conflicts += 1;
    if (registration.status === 'COMPLETED' && registration.defenseResultApprovals?.some((approval) => approval.isEffective && approval.outcome === 'FAILED')) failedCompleted += 1;
  }
  const summary = { admins, lecturers, students, mentorCounts: [...mentorMap.values()].sort((a, b) => a - b), activeEnrollments: enrollmentKeys.size, conflicts, failedCompleted, timelineTasks };
  validateDemoSummary(summary);
  return summary;
}

module.exports = { validateDemoSeed, validateDemoSummary };
