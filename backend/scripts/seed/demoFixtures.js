const DEMO_CALENDAR = Object.freeze({
  name: 'Đồ án tốt nghiệp — HK1 2026–2027',
  startDate: '2026-08-01',
  registrationDeadline: '2026-08-25',
  midtermReportDate: '2026-10-15',
  implementationEndDate: '2026-11-30',
  defenseDate: '2026-12-15',
  endDate: '2026-12-20',
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

function allocateCouncilForRegistration({ mentorId, councils }) {
  const council = councils.find((candidate) => !candidate.memberIds.includes(mentorId));
  if (!council) throw new Error(`No eligible defense council exists for mentor ${mentorId}.`);
  return council;
}

module.exports = {
  DEMO_CALENDAR,
  advisorEmailForStudentNumber,
  buildAccounts,
  buildMentorAssignments,
  allocateCouncilForRegistration,
};
