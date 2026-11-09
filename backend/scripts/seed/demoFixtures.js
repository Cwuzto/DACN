const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

function getSemesterDefinitions(baseDate = new Date()) {
  const base = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);

  const pastSemester = {
    code: 'DATN-HK2-2025-26',
    name: 'Đồ án tốt nghiệp — HK2 2025–2026',
    startDate: new Date('2026-01-05T00:00:00.000Z'),
    registrationDeadline: new Date('2026-01-20T00:00:00.000Z'),
    midtermReportDate: new Date('2026-03-25T00:00:00.000Z'),
    defenseDate: new Date('2026-05-15T00:00:00.000Z'),
    endDate: new Date('2026-05-30T00:00:00.000Z'),
    registrationOpen: false,
    status: 'COMPLETED',
  };

  const period2Supplementary = {
    code: 'DATN-HK1-2026-27-D2',
    name: 'Đồ án tốt nghiệp — HK1 2026–2027 (Đợt 2 - Bổ sung)',
    startDate: addDays(base, -10),
    registrationDeadline: addDays(base, 14),
    midtermReportDate: addDays(base, 45),
    defenseDate: addDays(base, 75),
    endDate: addDays(base, 90),
    registrationOpen: true,
    status: 'REGISTRATION',
  };

  const period1Main = {
    code: 'DATN-HK1-2026-27-D1',
    name: 'Đồ án tốt nghiệp — HK1 2026–2027 (Đợt 1 - Chính khóa)',
    startDate: addDays(base, -90),
    registrationDeadline: addDays(base, -60),
    midtermReportDate: addDays(base, -20),
    defenseDate: new Date(base.getTime()),
    endDate: addDays(base, 15),
    registrationOpen: false,
    status: 'DEFENSE',
  };

  return {
    pastSemester,
    period2Supplementary,
    period1Main,
  };
}

const DEMO_SEMESTERS = Object.freeze(getSemesterDefinitions());

const DEMO_CALENDAR = Object.freeze({
  ...DEMO_SEMESTERS.period1Main,
});

function createCohort(start, end) {
  const count = end - start + 1;
  const studentNumbers = Array.from({ length: count }, (_, i) => start + i);
  return Object.freeze({
    start,
    end,
    count,
    length: count,
    studentNumbers,
    includes(num) {
      return num >= start && num <= end;
    },
    [Symbol.iterator]() {
      return studentNumbers[Symbol.iterator]();
    },
  });
}

const STUDENT_COHORTS = Object.freeze({
  PAST: createCohort(1, 30),
  PERIOD2_UNREGISTERED: createCohort(31, 40),
  PERIOD2_PENDING: createCohort(41, 50),
  PERIOD2_BM01_NEEDS_REVISION: createCohort(51, 55),
  PERIOD2_BM02_SUBMITTED: createCohort(56, 60),
  PERIOD1_DECISION: createCohort(61, 70),
  PERIOD1_CHECKPOINT: createCohort(71, 85),
  PERIOD1_BM04: createCohort(86, 95),
  PERIOD1_DEFENSE: createCohort(96, 120),
});

const pad = (value) => String(value).padStart(2, '0');
const studentPad = (value) => String(value).padStart(3, '0');

function advisorEmailForStudentNumber(studentNumber) {
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 120) {
    throw new Error('Student number must be between 1 and 120.');
  }
  return `lecturer${pad(Math.ceil(studentNumber / 10))}@university.edu.vn`;
}

function buildAccounts() {
  const admin = [{
    email: 'admin@university.edu.vn', code: 'ADMIN001', fullName: 'Quản trị hệ thống',
    role: 'ADMIN', department: 'Viện Công nghệ số', password: 'admin123', isActive: true,
  }];
  const lecturers = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return {
      email: `lecturer${pad(number)}@university.edu.vn`, code: `GV${String(number).padStart(3, '0')}`,
      fullName: `Giảng viên ${pad(number)}`, role: 'LECTURER', department: 'Viện Công nghệ số',
      academicTitle: number === 1 ? 'TIEN_SI' : 'THAC_SI', password: 'lecturer123', isActive: true,
    };
  });
  const students = Array.from({ length: 120 }, (_, index) => {
    const number = index + 1;
    return {
      email: `sv${studentPad(number)}@university.edu.vn`, code: `SV${String(number).padStart(4, '0')}`,
      fullName: `Sinh viên ${studentPad(number)}`, role: 'STUDENT', department: 'Viện Công nghệ số',
      password: 'student123', isActive: true,
    };
  });
  return [...admin, ...lecturers, ...students];
}

function buildMentorAssignments() {
  return Array.from({ length: 120 }, (_, index) => {
    const studentNumber = index + 1;
    return {
      studentEmail: `sv${studentPad(studentNumber)}@university.edu.vn`,
      mentorEmail: advisorEmailForStudentNumber(studentNumber),
    };
  });
}

function allocateCouncilForRegistration({ mentorId, councils, councilLoadMap }) {
  const eligibleCouncils = councils.filter((candidate) => !candidate.memberIds.includes(mentorId));
  if (eligibleCouncils.length === 0) {
    throw new Error(`No eligible defense council exists for mentor ${mentorId}.`);
  }

  if (!councilLoadMap) {
    return eligibleCouncils[0];
  }

  const getLoad = (councilId) => {
    if (typeof councilLoadMap.get === 'function') {
      return councilLoadMap.get(councilId) || 0;
    }
    return councilLoadMap[councilId] || 0;
  };

  let bestCouncil = eligibleCouncils[0];
  let minLoad = getLoad(bestCouncil.id);

  for (let i = 1; i < eligibleCouncils.length; i += 1) {
    const candidate = eligibleCouncils[i];
    const load = getLoad(candidate.id);
    if (load < minLoad) {
      minLoad = load;
      bestCouncil = candidate;
    }
  }

  if (typeof councilLoadMap.set === 'function') {
    councilLoadMap.set(bestCouncil.id, minLoad + 1);
  } else if (typeof councilLoadMap === 'object' && !Object.isFrozen(councilLoadMap)) {
    councilLoadMap[bestCouncil.id] = minLoad + 1;
  }

  return bestCouncil;
}

module.exports = {
  DEMO_CALENDAR,
  DEMO_SEMESTERS,
  STUDENT_COHORTS,
  advisorEmailForStudentNumber,
  buildAccounts,
  buildMentorAssignments,
  allocateCouncilForRegistration,
  getSemesterDefinitions,
};
