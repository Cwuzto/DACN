const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

function getSemesterDefinitions(baseDate = new Date()) {
  const base = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);

  const semesterHK1 = {
    code: 'DATN-HK1-2026-27',
    name: 'Đồ án tốt nghiệp — HK1 2026–2027',
    startDate: addDays(base, -90),
    registrationDeadline: addDays(base, -60),
    midtermReportDate: addDays(base, -20),
    defenseDate: new Date(base.getTime()),
    endDate: addDays(base, 15),
    registrationOpen: false,
    status: 'DEFENSE',
  };

  const semesterHK2 = {
    code: 'DATN-HK2-2026-27',
    name: 'Đồ án tốt nghiệp — HK2 2026–2027',
    startDate: addDays(base, -10),
    registrationDeadline: addDays(base, 14),
    midtermReportDate: addDays(base, 45),
    defenseDate: addDays(base, 75),
    endDate: addDays(base, 90),
    registrationOpen: true,
    status: 'REGISTRATION',
  };

  return {
    semesterHK1,
    semesterHK2,
    period1Main: semesterHK1,
    period2Supplementary: semesterHK2,
  };
}

const DEMO_SEMESTERS = Object.freeze(getSemesterDefinitions());

const DEMO_CALENDAR = Object.freeze({
  ...DEMO_SEMESTERS.semesterHK1,
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
  HK2_UNREGISTERED: createCohort(1, 10),
  HK2_PENDING: createCohort(11, 20),
  HK2_APPROVED: createCohort(21, 30),
  HK1_BM01_SUBMITTED: createCohort(31, 35),
  HK1_BM01_NEEDS_REVISION: createCohort(36, 40),
  HK1_BM01_RESUBMITTED: createCohort(41, 45),
  HK1_BM02_SUBMITTED: createCohort(46, 50),
  HK1_DECISION: createCohort(51, 70),
  HK1_CHECKPOINT: createCohort(71, 85),
  HK1_BM04: createCohort(86, 95),
  HK1_DEFENSE: createCohort(96, 120),
  // Backward-compatibility aliases
  PERIOD2_UNREGISTERED: createCohort(1, 10),
  PERIOD2_PENDING: createCohort(11, 20),
  PERIOD2_BM01_NEEDS_REVISION: createCohort(36, 40),
  PERIOD2_BM02_SUBMITTED: createCohort(46, 50),
  PERIOD1_DECISION: createCohort(51, 70),
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

const LECTURER_PROFILES = [
  { fullName: 'TS. Nguyễn Văn Thắng', academicTitle: 'TIEN_SI' }, // Viện trưởng Viện Công nghệ số
  { fullName: 'ThS. Trần Thị Mai Phương', academicTitle: 'THAC_SI' }, // Trưởng bộ môn KTPM & HTTT
  { fullName: 'TS. Lê Hoàng Nam', academicTitle: 'TIEN_SI' },
  { fullName: 'ThS. Phạm Quốc Bảo', academicTitle: 'THAC_SI' },
  { fullName: 'TS. Đỗ Thị Thu Hà', academicTitle: 'TIEN_SI' },
  { fullName: 'ThS. Vũ Hải Đăng', academicTitle: 'THAC_SI' },
  { fullName: 'ThS. Bùi Minh Trí', academicTitle: 'THAC_SI' },
  { fullName: 'TS. Huỳnh Thanh Tùng', academicTitle: 'TIEN_SI' },
  { fullName: 'ThS. Nguyễn Ngọc Ánh', academicTitle: 'THAC_SI' },
  { fullName: 'ThS. Trương Công Định', academicTitle: 'THAC_SI' },
  { fullName: 'TS. Đặng Quốc Huy', academicTitle: 'TIEN_SI' },
  { fullName: 'ThS. Hoàng Thị Kim Oanh', academicTitle: 'THAC_SI' },
];

const VIETNAMESE_SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const VIETNAMESE_MIDDLE_MALE = ['Văn', 'Đức', 'Thanh', 'Hữu', 'Minh', 'Ngọc', 'Quốc', 'Tuấn', 'Xuân', 'Gia', 'Trọng', 'Đình'];
const VIETNAMESE_MIDDLE_FEMALE = ['Thị', 'Ngọc', 'Phương', 'Mai', 'Thanh', 'Thu', 'Kim', 'Bảo', 'Khánh', 'Diệu', 'Mỹ', 'Thùy'];
const VIETNAMESE_GIVEN_MALE = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hậu', 'Hiếu', 'Hoàng', 'Huy', 'Khoa', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Phát', 'Phúc', 'Quang', 'Sơn', 'Tài', 'Tâm', 'Thành', 'Thắng', 'Thịnh', 'Thuận', 'Tiến', 'Trí', 'Trung', 'Tuấn', 'Vinh', 'Vũ'];
const VIETNAMESE_GIVEN_FEMALE = ['Anh', 'Chi', 'Dung', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Linh', 'Mai', 'My', 'Ngân', 'Ngọc', 'Nhung', 'Như', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Trang', 'Trâm', 'Tuyết', 'Uyên', 'Vân', 'Vy', 'Yến'];

function generateStudentFullName(index) {
  const isFemale = (index + 1) % 2 === 0;
  const surname = VIETNAMESE_SURNAMES[index % VIETNAMESE_SURNAMES.length];
  const middle = isFemale
    ? VIETNAMESE_MIDDLE_FEMALE[(index * 3) % VIETNAMESE_MIDDLE_FEMALE.length]
    : VIETNAMESE_MIDDLE_MALE[(index * 3) % VIETNAMESE_MIDDLE_MALE.length];
  const given = isFemale
    ? VIETNAMESE_GIVEN_FEMALE[(index * 7) % VIETNAMESE_GIVEN_FEMALE.length]
    : VIETNAMESE_GIVEN_MALE[(index * 7) % VIETNAMESE_GIVEN_MALE.length];
  return `${surname} ${middle} ${given}`;
}

function buildAccounts(options = {}) {
  const envCount = process.env.SEED_STUDENT_COUNT ? parseInt(process.env.SEED_STUDENT_COUNT, 10) : undefined;
  const studentCount = options.studentCount !== undefined 
    ? options.studentCount 
    : (envCount !== undefined ? envCount : 120);

  const admin = [{
    email: 'admin@university.edu.vn', code: 'ADMIN001', fullName: 'Quản trị hệ thống',
    role: 'ADMIN', department: 'Viện Công nghệ số', password: 'admin123', isActive: true,
  }];
  const lecturers = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const profile = LECTURER_PROFILES[index] || {
      fullName: `Giảng viên ${pad(number)}`,
      academicTitle: number === 1 ? 'TIEN_SI' : 'THAC_SI',
    };
    return {
      email: `lecturer${pad(number)}@university.edu.vn`, code: `GV${String(number).padStart(3, '0')}`,
      fullName: profile.fullName, role: 'LECTURER', department: 'Viện Công nghệ số',
      academicTitle: profile.academicTitle, password: 'lecturer123', isActive: true,
    };
  });
  const students = Array.from({ length: studentCount }, (_, index) => {
    const number = index + 1;
    return {
      email: `sv${studentPad(number)}@university.edu.vn`, code: `SV${String(number).padStart(4, '0')}`,
      fullName: generateStudentFullName(index), role: 'STUDENT', department: 'Viện Công nghệ số',
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
