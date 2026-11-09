const { WorkflowTransitionError } = require('./registrationTransitionService');

/**
 * Validates that actor has authoritative departmental scope to execute capabilityCode on registrationId.
 * Source of truth for registration's department: registration.topic.mentor.department (or proposedBy.department).
 */
async function validateAcademicScope(tx, { actorId, registrationId, capabilityCode, now = new Date() }) {
  if (!actorId || !registrationId || !capabilityCode) return;

  const actor = typeof tx?.user?.findUnique === 'function'
    ? await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, department: true },
    })
    : null;

  const registration = typeof tx?.topicRegistration?.findUnique === 'function'
    ? await tx.topicRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        topic: {
          select: {
            mentor: { select: { department: true } },
            proposedBy: { select: { department: true } },
          },
        },
      },
    })
    : null;

  if (!registration) {
    return;
  }

  const authoritativeDepartment = registration.topic?.mentor?.department || registration.topic?.proposedBy?.department;

  if (authoritativeDepartment) {
    const isDirectDepartmentMatch = Boolean(actor?.department && actor.department === authoritativeDepartment);
    if (isDirectDepartmentMatch) {
      return { authoritativeDepartment, grantedVia: 'DIRECT_DEPARTMENT' };
    }

    if (typeof tx?.academicDelegation?.findFirst === 'function') {
      const activeDelegation = await tx.academicDelegation.findFirst({
        where: {
          delegateeId: actorId,
          capabilityCode,
          department: authoritativeDepartment,
          status: 'ACTIVE',
          effectiveFrom: { lte: now },
          effectiveTo: { gte: now },
        },
      });

      if (activeDelegation) {
        return { authoritativeDepartment, grantedVia: 'ACADEMIC_DELEGATION', delegationId: activeDelegation.id };
      }
    }

    const err = new WorkflowTransitionError(
      'DELEGATION_SCOPE_MISMATCH',
      403,
      `Người thực hiện không có thẩm quyền đối với khoa/bộ môn (${authoritativeDepartment}) của hồ sơ này hoặc ủy quyền đã hết hiệu lực.`,
    );
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { validateAcademicScope };

