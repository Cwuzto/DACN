/**
 * Live Database Context Service for Academic AI
 *
 * Grounding AI prompts in dynamic, real-time database state:
 * - Active Semester dates and deadlines (with fallback to latest semester)
 * - Institute Leadership (Viện Trưởng)
 * - Active Lecturers list (capped at 20)
 * - Caller's personalized state (Topic & Advisor for Student, Advised Students for Lecturer)
 * - In-memory TTL caching (5 minutes) for institutional context
 */

const prisma = require('../../config/database');

const INSTITUTIONAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let institutionalCache = null;

/**
 * Format academic title to Vietnamese standard abbreviation
 * @param {string} [title]
 * @returns {string}
 */
function formatAcademicTitle(title) {
  if (!title) return '';
  switch (title) {
    case 'THAC_SI':
    case 'ThS':
      return 'ThS.';
    case 'TIEN_SI':
    case 'TS':
      return 'TS.';
    case 'PHO_GIAO_SU':
    case 'PGS_TS':
    case 'PGS':
      return 'PGS.TS.';
    case 'GIAO_SU':
    case 'GS':
      return 'GS.TS.';
    default:
      return title;
  }
}

/**
 * Combine academic title and full name
 * @param {string} [title]
 * @param {string} fullName
 * @returns {string}
 */
function formatFullNameWithTitle(title, fullName) {
  if (!fullName) return '';
  const prefix = formatAcademicTitle(title);
  return prefix ? `${prefix} ${fullName}` : fullName;
}

/**
 * Format Date to DD/MM/YYYY
 * @param {Date|string|null} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return 'Chưa công bố';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format semester status into Vietnamese human-readable string
 * @param {string} status
 * @returns {string}
 */
function formatSemesterStatus(status) {
  switch (status) {
    case 'ACTIVE':
    case 'ONGOING':
      return `Đang diễn ra (${status})`;
    case 'UPCOMING':
    case 'REGISTRATION':
      return `Sắp diễn ra (${status})`;
    case 'DEFENSE':
      return `Giai đoạn bảo vệ (${status})`;
    case 'COMPLETED':
      return `Đã kết thúc (${status})`;
    default:
      return status || 'N/A';
  }
}

/**
 * Format user role label
 * @param {string} role
 * @returns {string}
 */
function formatRole(role) {
  switch (role) {
    case 'STUDENT':
      return 'Sinh viên';
    case 'LECTURER':
      return 'Giảng viên';
    case 'ADMIN':
      return 'Quản trị viên';
    default:
      return role || 'Người dùng';
  }
}

/**
 * Clear the in-memory institutional cache
 */
function clearInstitutionalCache() {
  institutionalCache = null;
}

/**
 * Fetch the active semester or fall back to the latest semester
 * @returns {Promise<object|null>}
 */
async function fetchActiveSemester() {
  try {
    const active = await prisma.semester.findFirst({
      where: {
        status: { in: ['ONGOING', 'REGISTRATION', 'DEFENSE'] },
      },
      orderBy: { startDate: 'desc' },
    });
    if (active) {
      return {
        id: active.id,
        code: active.code,
        name: active.name,
        startDate: active.startDate,
        endDate: active.endDate,
        outlineSubmissionDeadline: active.outlineSubmissionDeadline,
        defenseDate: active.defenseDate,
        status: active.status,
      };
    }
  } catch (err) {
    // If status filter fails, continue to date-based or latest fallback
  }

  // Try date-based active semester (current date between start and end)
  try {
    const now = new Date();
    const dateActive = await prisma.semester.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'desc' },
    });
    if (dateActive) {
      return {
        id: dateActive.id,
        code: dateActive.code,
        name: dateActive.name,
        startDate: dateActive.startDate,
        endDate: dateActive.endDate,
        outlineSubmissionDeadline: dateActive.outlineSubmissionDeadline,
        defenseDate: dateActive.defenseDate,
        status: dateActive.status,
      };
    }
  } catch (_) {
    // ignore
  }

  // Fallback to latest semester
  try {
    const latest = await prisma.semester.findFirst({
      orderBy: { startDate: 'desc' },
    });
    if (latest) {
      return {
        id: latest.id,
        code: latest.code,
        name: latest.name,
        startDate: latest.startDate,
        endDate: latest.endDate,
        outlineSubmissionDeadline: latest.outlineSubmissionDeadline,
        defenseDate: latest.defenseDate,
        status: latest.status,
      };
    }
  } catch (err) {
    console.error('[liveContextService] Error fetching latest semester:', err.message);
  }

  return null;
}

/**
 * Fetch the Dean (Viện Trưởng)
 * @returns {Promise<object|null>}
 */
async function fetchDean() {
  try {
    if (prisma.userPermissionGroup && typeof prisma.userPermissionGroup.findFirst === 'function') {
      const upg = await prisma.userPermissionGroup.findFirst({
        where: {
          permissionGroup: { code: 'VIEN_TRUONG' },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              academicTitle: true,
              email: true,
              department: true,
            },
          },
        },
      });

      if (upg && upg.user) {
        return {
          id: upg.user.id,
          fullName: upg.user.fullName,
          academicTitle: upg.user.academicTitle,
          email: upg.user.email,
          department: upg.user.department,
        };
      }
    }
  } catch (_) {
    // ignore and try fallback
  }

  try {
    if (prisma.user && typeof prisma.user.findFirst === 'function') {
      const u = await prisma.user.findFirst({
        where: {
          permissionGroups: {
            some: {
              permissionGroup: { code: 'VIEN_TRUONG' },
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          academicTitle: true,
          email: true,
          department: true,
        },
      });

      if (u) {
        return {
          id: u.id,
          fullName: u.fullName,
          academicTitle: u.academicTitle,
          email: u.email,
          department: u.department,
        };
      }
    }
  } catch (err) {
    console.error('[liveContextService] Error fetching dean:', err.message);
  }

  return null;
}

/**
 * Fetch lecturers for current semester or active pool (max 20)
 * @param {object|null} activeSemester
 * @returns {Promise<Array<object>>}
 */
async function fetchLecturers(activeSemester) {
  try {
    if (activeSemester?.id) {
      const semesterLecturers = await prisma.user.findMany({
        where: {
          role: 'LECTURER',
          OR: [
            { mentoredTopics: { some: { semesterId: activeSemester.id } } },
            { proposedTopics: { some: { semesterId: activeSemester.id } } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          academicTitle: true,
          department: true,
          email: true,
        },
        take: 20,
        orderBy: { fullName: 'asc' },
      });

      if (semesterLecturers && semesterLecturers.length > 0) {
        return semesterLecturers;
      }
    }

    const activeLecturers = await prisma.user.findMany({
      where: {
        role: 'LECTURER',
      },
      select: {
        id: true,
        fullName: true,
        academicTitle: true,
        department: true,
        email: true,
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });

    return activeLecturers || [];
  } catch (err) {
    console.error('[liveContextService] Error fetching lecturers:', err.message);
    return [];
  }
}

/**
 * Get shared institutional context with 5-minute TTL caching
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<{ activeSemester: object|null, dean: object|null, lecturers: Array<object> }>}
 */
async function getCachedInstitutionalContext(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && institutionalCache && institutionalCache.expiresAt > now) {
    return institutionalCache.data;
  }

  const activeSemester = await fetchActiveSemester();
  const dean = await fetchDean();
  const lecturers = await fetchLecturers(activeSemester);

  const data = {
    activeSemester,
    dean,
    lecturers,
  };

  institutionalCache = {
    data,
    expiresAt: now + INSTITUTIONAL_CACHE_TTL_MS,
  };

  return data;
}

/**
 * Fetch personalized context for the calling user
 * @param {object|null} user
 * @param {object|null} activeSemester
 * @returns {Promise<object|null>}
 */
async function fetchPersonalContext(user, activeSemester) {
  if (!user || !user.id) {
    return null;
  }

  const numericUserId = Number.isInteger(user.id) ? user.id : Number.parseInt(user.id, 10);
  if (!Number.isFinite(numericUserId)) {
    return null;
  }

  if (user.role === 'STUDENT') {
    let registration = null;

    if (activeSemester?.id) {
      registration = await prisma.topicRegistration.findFirst({
        where: {
          studentId: numericUserId,
          semesterId: activeSemester.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          topic: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  academicTitle: true,
                  email: true,
                  department: true,
                },
              },
            },
          },
        },
      });
    }

    if (!registration) {
      registration = await prisma.topicRegistration.findFirst({
        where: {
          studentId: numericUserId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          topic: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  academicTitle: true,
                  email: true,
                  department: true,
                },
              },
            },
          },
        },
      });
    }

    if (registration) {
      const topicTitle =
        registration.adjustedTitle ||
        registration.bm01ApprovedTitleSnapshot ||
        registration.topic?.title ||
        null;

      return {
        role: 'STUDENT',
        hasTopic: true,
        registrationId: registration.id,
        topicTitle,
        status: registration.status,
        outlineReviewStatus: registration.outlineReviewStatus,
        assignmentStatus: registration.assignmentStatus,
        mentor: registration.topic?.mentor
          ? {
              id: registration.topic.mentor.id,
              fullName: registration.topic.mentor.fullName,
              academicTitle: registration.topic.mentor.academicTitle,
              email: registration.topic.mentor.email,
              department: registration.topic.mentor.department,
            }
          : null,
      };
    }

    return {
      role: 'STUDENT',
      hasTopic: false,
      topicTitle: null,
      mentor: null,
      status: null,
      message: 'Sinh viên chưa đăng ký hoặc chưa có đề tài trong hệ thống.',
    };
  }

  if (user.role === 'LECTURER') {
    let registrations = [];

    if (activeSemester?.id) {
      registrations = await prisma.topicRegistration.findMany({
        where: {
          topic: { mentorId: numericUserId },
          semesterId: activeSemester.id,
        },
        include: {
          student: {
            select: {
              id: true,
              code: true,
              fullName: true,
              email: true,
            },
          },
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!registrations || registrations.length === 0) {
      registrations = await prisma.topicRegistration.findMany({
        where: {
          topic: { mentorId: numericUserId },
        },
        include: {
          student: {
            select: {
              id: true,
              code: true,
              fullName: true,
              email: true,
            },
          },
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    }

    const advisedStudents = (registrations || []).map((r) => ({
      studentId: r.student?.id,
      studentCode: r.student?.code,
      studentName: r.student?.fullName,
      topicTitle: r.adjustedTitle || r.bm01ApprovedTitleSnapshot || r.topic?.title,
      status: r.status,
    }));

    return {
      role: 'LECTURER',
      advisedCount: advisedStudents.length,
      advisedStudents,
    };
  }

  return {
    role: user.role,
    userId: user.id,
    fullName: user.fullName,
  };
}

/**
 * Format live database context into a concise prompt text section (< 500 tokens)
 * @param {object} params
 * @param {object|null} params.activeSemester
 * @param {object|null} params.dean
 * @param {Array<object>} params.lecturers
 * @param {object|null} params.personalContext
 * @param {object|null} params.user
 * @returns {string}
 */
function formatLiveContextString({ activeSemester, dean, lecturers, personalContext, user }) {
  const parts = [];

  parts.push('=== THÔNG TIN THỰC TẾ HỌC KỲ HIỆN TẠI ===');

  if (activeSemester) {
    parts.push(
      `- Học kỳ: ${activeSemester.name} (${activeSemester.code}) - Trạng thái: ${formatSemesterStatus(activeSemester.status)}`
    );
    parts.push(
      `- Thời gian học kỳ: ${formatDate(activeSemester.startDate)} đến ${formatDate(activeSemester.endDate)}`
    );
    parts.push(
      `- Hạn nộp đề cương BM01: ${formatDate(activeSemester.outlineSubmissionDeadline)} | Ngày bảo vệ dự kiến: ${formatDate(activeSemester.defenseDate)}`
    );
  } else {
    parts.push('- Học kỳ: Chưa có thông tin học kỳ hoạt động trong hệ thống.');
  }

  if (dean) {
    const deanName = formatFullNameWithTitle(dean.academicTitle, dean.fullName);
    const deanEmail = dean.email ? ` (Email: ${dean.email})` : '';
    parts.push(`- Viện trưởng Viện Công nghệ Số: ${deanName}${deanEmail}`);
  } else {
    parts.push('- Viện trưởng Viện Công nghệ Số: Chưa cập nhật trên hệ thống phân quyền.');
  }

  parts.push('- Danh sách Giảng viên hướng dẫn đợt này:');
  if (lecturers && lecturers.length > 0) {
    lecturers.slice(0, 20).forEach((l) => {
      const lecturerName = formatFullNameWithTitle(l.academicTitle, l.fullName);
      const dept = l.department ? ` (${l.department})` : '';
      const email = l.email ? ` - ${l.email}` : '';
      parts.push(`  * ${lecturerName}${dept}${email}`);
    });
  } else {
    parts.push('  * Chưa có thông tin giảng viên hướng dẫn đợt này.');
  }

  if (user) {
    parts.push('');
    parts.push('=== THÔNG TIN CÁ NHÂN CỦA BẠN (NGƯỜI ĐANG HỎI) ===');
    const userCode = user.code ? ` (Mã: ${user.code})` : '';
    parts.push(`- Họ tên: ${user.fullName || 'N/A'}${userCode} - Vai trò: ${formatRole(user.role)}`);

    if (user.role === 'STUDENT') {
      if (personalContext && personalContext.hasTopic) {
        parts.push(`- Đề tài hiện tại: "${personalContext.topicTitle || 'Chưa đặt tên'}"`);
        const mentorText = personalContext.mentor
          ? `${formatFullNameWithTitle(personalContext.mentor.academicTitle, personalContext.mentor.fullName)}${personalContext.mentor.email ? ` (${personalContext.mentor.email})` : ''}`
          : 'Chưa phân công';
        parts.push(`- Giảng viên hướng dẫn: ${mentorText}`);
        parts.push(`- Trạng thái đồ án hiện tại: ${personalContext.status || 'Chưa cập nhật'}`);
      } else {
        parts.push('- Tình trạng đồ án: Chưa đăng ký đề tài hoặc chưa có đề tài được ghi nhận trong đợt này.');
      }
    } else if (user.role === 'LECTURER') {
      const count = personalContext?.advisedCount || 0;
      parts.push(`- Số sinh viên đang hướng dẫn: ${count}`);
      if (personalContext?.advisedStudents && personalContext.advisedStudents.length > 0) {
        personalContext.advisedStudents.forEach((s) => {
          const code = s.studentCode ? `[${s.studentCode}] ` : '';
          parts.push(`  * ${code}${s.studentName || 'Sinh viên'} - Đề tài: "${s.topicTitle || 'Chưa đặt tên'}" - Trạng thái: ${s.status || 'N/A'}`);
        });
      }
    } else if (user.role === 'ADMIN') {
      parts.push('- Quyền hạn: Quản trị viên / Cán bộ quản lý hệ thống.');
    }
  }

  return parts.join('\n');
}

/**
 * Retrieve comprehensive live database context and formatted projection
 * @param {object|null} user Calling user object (from req.user)
 * @returns {Promise<{ activeSemester: object|null, dean: object|null, lecturers: Array<object>, personalContext: object|null, formattedText: string }>}
 */
async function getLiveContext(user = null) {
  const institutional = await getCachedInstitutionalContext();
  const personalContext = await fetchPersonalContext(user, institutional.activeSemester);

  const formattedText = formatLiveContextString({
    activeSemester: institutional.activeSemester,
    dean: institutional.dean,
    lecturers: institutional.lecturers,
    personalContext,
    user,
  });

  return {
    activeSemester: institutional.activeSemester,
    dean: institutional.dean,
    lecturers: institutional.lecturers,
    personalContext,
    formattedText,
  };
}

module.exports = {
  getLiveContext,
  getCachedInstitutionalContext,
  formatLiveContextString,
  clearInstitutionalCache,
};
