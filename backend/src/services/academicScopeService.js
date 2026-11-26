const { WorkflowTransitionError } = require('./registrationTransitionService');

const CS_IT_DEPARTMENTS = [
  'KY THUAT PHAN MEM',
  'CONG NGHE PHAN MEM',
  'BO MON CONG NGHE PHAN MEM',
  'BO MON KY THUAT PHAN MEM',
  'HE THONG THONG TIN',
  'BO MON HE THONG THONG TIN',
  'CONG NGHE THONG TIN',
  'BO MON CONG NGHE THONG TIN',
  'KHOA HOC MAY TINH',
  'BO MON KHOA HOC MAY TINH',
  'MANG MAY TINH',
  'BO MON MANG MAY TINH',
  'AN TOAN THONG TIN',
  'BO MON AN TOAN THONG TIN',
  'TRI TUE NHAN TAO',
  'KHOA HOC DU LIEU',
  'DIEN TU VIEN THONG',
];

const INSTITUTE_DEPARTMENTS_MAP = {
  'VIEN CONG NGHE SO': CS_IT_DEPARTMENTS,
  'VIEN CONG NGHE THONG TIN': CS_IT_DEPARTMENTS,
  'VIEN CONG NGHE THONG TIN VA TRUYEN THONG': CS_IT_DEPARTMENTS,
  'KHOA CONG NGHE THONG TIN': CS_IT_DEPARTMENTS,
  'CNTT': CS_IT_DEPARTMENTS,
};

const normalizeText = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

function isDepartmentUnderInstitute(instituteName, departmentName) {
  if (!instituteName || !departmentName) return false;
  const normInst = normalizeText(instituteName);
  const normDept = normalizeText(departmentName);
  if (normInst === normDept) return true;

  for (const [instKey, deptList] of Object.entries(INSTITUTE_DEPARTMENTS_MAP)) {
    if (normInst.includes(instKey) || instKey.includes(normInst) || normInst === 'CNTT') {
      if (deptList.some((d) => normDept.includes(d) || d.includes(normDept))) {
        return true;
      }
    }
  }

  if (normInst.startsWith('VIEN') && normDept.includes(normInst.replace('VIEN', '').trim())) {
    return true;
  }
  return false;
}

/**
 * Validates that actor has authoritative departmental scope to execute capabilityCode on registrationId.
 * Source of truth for registration's department: registration.topic.mentor.department (or proposedBy.department).
 */
async function validateAcademicScope(tx, { actorId, registrationId, capabilityCode, now = new Date() }) {
  if (!actorId || !registrationId || !capabilityCode) return;

  const actor = typeof tx?.user?.findUnique === 'function'
    ? await tx.user.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        role: true,
        department: true,
        permissionGroups: {
          select: {
            permissionGroup: {
              select: { code: true },
            },
          },
        },
      },
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

    const groupCodes = (actor?.permissionGroups || [])
      .map((g) => g.permissionGroup?.code)
      .filter(Boolean);
    const isInstituteDirector =
      actor?.role === 'INSTITUTE_DIRECTOR' ||
      actor?.role === 'VIEN_TRUONG' ||
      actor?.role === 'ADMIN' ||
      groupCodes.includes('VIEN_TRUONG') ||
      groupCodes.includes('INSTITUTE_DIRECTOR');

    if (isInstituteDirector) {
      if (!actor?.department || isDepartmentUnderInstitute(actor.department, authoritativeDepartment)) {
        return { authoritativeDepartment, grantedVia: 'INSTITUTE_SCOPE' };
      }
    }

    if (actor?.department && isDepartmentUnderInstitute(actor.department, authoritativeDepartment)) {
      return { authoritativeDepartment, grantedVia: 'INSTITUTE_SCOPE' };
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

module.exports = { validateAcademicScope, isDepartmentUnderInstitute };


