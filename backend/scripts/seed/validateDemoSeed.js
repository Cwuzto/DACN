function validateDemoSummary(summary) {
  if (summary.admins !== 1 || summary.lecturers !== 12 || summary.students !== 120) {
    throw new Error('Demo seed must contain 1 admin, 12 lecturers, and 120 students.');
  }
  if (summary.semesters !== 3) {
    throw new Error('Demo seed must contain exactly 3 semesters.');
  }
  if (!summary.academicDelegations || summary.academicDelegations < 2) {
    throw new Error('Demo seed must contain at least 2 academic delegations.');
  }
  if (!summary.rubricCriteria || summary.rubricCriteria < 6) {
    throw new Error('Demo seed must contain at least 6 rubric criteria.');
  }
  if (summary.activeEnrollments !== 120) {
    throw new Error('Every demo registration must have one active enrollment.');
  }
  if (summary.maxMentorActivePerPeriod === undefined || summary.maxMentorActivePerPeriod > 10) {
    throw new Error('No mentor may exceed the maximum capacity of 10 registrations per period.');
  }
  if (summary.mentorsWithRegistrations !== 12) {
    throw new Error('All 12 lecturers must have registrations.');
  }
  if (summary.conflicts !== 0) {
    throw new Error('Defense council conflicts must be zero.');
  }
  if (summary.failedCompleted !== 0) {
    throw new Error('DEFENSE_FAILED registrations must not be completed.');
  }
  if (summary.timelineTasks === undefined || summary.timelineTasks < 1) {
    throw new Error('Demo seed must include implementation timeline tasks.');
  }
}

async function validateDemoSeed(prisma) {
  const [
    admins,
    lecturers,
    students,
    semesters,
    academicDelegations,
    rubricCriteria,
    registrations,
    enrollments,
    timelineTasks,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'LECTURER' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.semester.count(),
    prisma.academicDelegation.count(),
    prisma.rubricCriterion.count(),
    prisma.topicRegistration.findMany({
      select: {
        id: true,
        studentId: true,
        semesterId: true,
        status: true,
        topic: { select: { mentorId: true } },
        defenseCouncil: { select: { members: { select: { lecturerId: true } } } },
        defenseResultApprovals: { select: { outcome: true, isEffective: true } },
      },
    }),
    prisma.studentProjectEnrollment.findMany({
      where: { status: 'ACTIVE' },
      select: { studentId: true, semesterId: true },
    }),
    prisma.task.count(),
  ]);

  const periodMentorCounts = new Map();
  const allMentorsWithRegistrations = new Set();
  const enrollmentKeys = new Set(enrollments.map((row) => `${row.studentId}:${row.semesterId}`));
  let conflicts = 0;
  let failedCompleted = 0;

  for (const registration of registrations) {
    const mentorId = registration.topic?.mentorId;
    const semesterId = registration.semesterId;

    if (mentorId) {
      allMentorsWithRegistrations.add(mentorId);

      if (!periodMentorCounts.has(semesterId)) {
        periodMentorCounts.set(semesterId, new Map());
      }
      const semesterMap = periodMentorCounts.get(semesterId);
      semesterMap.set(mentorId, (semesterMap.get(mentorId) || 0) + 1);
    }

    if (registration.defenseCouncil?.members?.some((member) => member.lecturerId === mentorId)) {
      conflicts += 1;
    }
    if (
      registration.status === 'COMPLETED' &&
      registration.defenseResultApprovals?.some((approval) => approval.isEffective && approval.outcome === 'FAILED')
    ) {
      failedCompleted += 1;
    }
  }

  let maxMentorActivePerPeriod = 0;
  for (const semesterMap of periodMentorCounts.values()) {
    for (const count of semesterMap.values()) {
      if (count > maxMentorActivePerPeriod) {
        maxMentorActivePerPeriod = count;
      }
    }
  }

  const summary = {
    admins,
    lecturers,
    students,
    semesters,
    academicDelegations,
    rubricCriteria,
    activeEnrollments: enrollmentKeys.size,
    maxMentorActivePerPeriod,
    mentorsWithRegistrations: allMentorsWithRegistrations.size,
    conflicts,
    failedCompleted,
    timelineTasks,
    totalRegistrations: registrations.length,
  };

  validateDemoSummary(summary);
  return summary;
}

module.exports = { validateDemoSeed, validateDemoSummary };
