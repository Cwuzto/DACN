const crypto = require('crypto');
const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS } = require('../../src/services/rubricService');

const RUBRIC_VERSION = DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.version;
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

// 20 Giảng viên với học vị và bộ môn thực tế
const LECTURER_DEFINITIONS = Object.freeze([
  {
    code: 'GV001',
    fullName: 'PGS.TS. Nguyễn Văn Thắng',
    email: 'lecturer01@university.edu.vn',
    academicTitle: 'PHO_GIAO_SU',
    department: 'Viện Công nghệ số',
    phone: '0901000001',
    groups: ['VIEN_TRUONG', 'GVHD'],
  },
  {
    code: 'GV002',
    fullName: 'ThS. Trần Thị Mai Phương',
    email: 'lecturer02@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Viện Công nghệ số',
    phone: '0901000002',
    groups: ['GIAO_VU', 'GVHD'],
  },
  {
    code: 'GV003',
    fullName: 'PGS.TS. Lê Hoàng Nam',
    email: 'lecturer03@university.edu.vn',
    academicTitle: 'PHO_GIAO_SU',
    department: 'Bộ môn Kỹ thuật phần mềm',
    phone: '0901000003',
    groups: ['GVHD'],
  },
  {
    code: 'GV004',
    fullName: 'TS. Phạm Quốc Bảo',
    email: 'lecturer04@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Hệ thống thông tin',
    phone: '0901000004',
    groups: ['GVHD'],
  },
  {
    code: 'GV005',
    fullName: 'TS. Đỗ Thị Thu Hà',
    email: 'lecturer05@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Khoa học máy tính',
    phone: '0901000005',
    groups: ['GVHD'],
  },
  {
    code: 'GV006',
    fullName: 'ThS. Vũ Hải Đăng',
    email: 'lecturer06@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn Mạng và Truyền thông',
    phone: '0901000006',
    groups: ['GVHD'],
  },
  {
    code: 'GV007',
    fullName: 'TS. Bùi Minh Trí',
    email: 'lecturer07@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn An toàn thông tin',
    phone: '0901000007',
    groups: ['GVHD'],
  },
  {
    code: 'GV008',
    fullName: 'PGS.TS. Huỳnh Thanh Tùng',
    email: 'lecturer08@university.edu.vn',
    academicTitle: 'PHO_GIAO_SU',
    department: 'Bộ môn Khoa học máy tính',
    phone: '0901000008',
    groups: ['GVHD'],
  },
  {
    code: 'GV009',
    fullName: 'ThS. Nguyễn Ngọc Ánh',
    email: 'lecturer09@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn Kỹ thuật phần mềm',
    phone: '0901000009',
    groups: ['GVHD'],
  },
  {
    code: 'GV010',
    fullName: 'TS. Trương Công Định',
    email: 'lecturer10@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Hệ thống thông tin',
    phone: '0901000010',
    groups: ['GVHD'],
  },
  {
    code: 'GV011',
    fullName: 'TS. Đặng Quốc Huy',
    email: 'lecturer11@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn An toàn thông tin',
    phone: '0901000011',
    groups: ['GVHD'],
  },
  {
    code: 'GV012',
    fullName: 'ThS. Hoàng Thị Kim Oanh',
    email: 'lecturer12@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn Khoa học máy tính',
    phone: '0901000012',
    groups: ['GVHD'],
  },
  {
    code: 'GV013',
    fullName: 'TS. Trần Đình Long',
    email: 'lecturer13@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Kỹ thuật phần mềm',
    phone: '0901000013',
    groups: ['GVHD'],
  },
  {
    code: 'GV014',
    fullName: 'ThS. Phan Thanh Sơn',
    email: 'lecturer14@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn Hệ thống thông tin',
    phone: '0901000014',
    groups: ['GVHD'],
  },
  {
    code: 'GV015',
    fullName: 'TS. Võ Minh Trí',
    email: 'lecturer15@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Mạng và Truyền thông',
    phone: '0901000015',
    groups: ['GVHD'],
  },
  {
    code: 'GV016',
    fullName: 'ThS. Lê Thị Thanh Thảo',
    email: 'lecturer16@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn An toàn thông tin',
    phone: '0901000016',
    groups: ['GVHD'],
  },
  {
    code: 'GV017',
    fullName: 'TS. Nguyễn Hải Đăng',
    email: 'lecturer17@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Khoa học máy tính',
    phone: '0901000017',
    groups: ['GVHD'],
  },
  {
    code: 'GV018',
    fullName: 'ThS. Dương Quốc Dũng',
    email: 'lecturer18@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn Kỹ thuật phần mềm',
    phone: '0901000018',
    groups: ['GVHD'],
  },
  {
    code: 'GV019',
    fullName: 'TS. Mai Xuân Thành',
    email: 'lecturer19@university.edu.vn',
    academicTitle: 'TIEN_SI',
    department: 'Bộ môn Hệ thống thông tin',
    phone: '0901000019',
    groups: ['GVHD'],
  },
  {
    code: 'GV020',
    fullName: 'ThS. Vũ Hồng Quân',
    email: 'lecturer20@university.edu.vn',
    academicTitle: 'THAC_SI',
    department: 'Bộ môn An toàn thông tin',
    phone: '0901000020',
    groups: ['GVHD'],
  },
]);

const VIETNAMESE_SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const VIETNAMESE_MIDDLE_MALE = ['Văn', 'Đức', 'Thanh', 'Hữu', 'Minh', 'Ngọc', 'Quốc', 'Tuấn', 'Xuân', 'Gia', 'Trọng', 'Đình'];
const VIETNAMESE_MIDDLE_FEMALE = ['Thị', 'Ngọc', 'Phương', 'Mai', 'Thanh', 'Thu', 'Kim', 'Bảo', 'Khánh', 'Diệu', 'Mỹ', 'Thùy'];
const VIETNAMESE_GIVEN_MALE = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hậu', 'Hiếu', 'Hoàng', 'Huy', 'Khoa', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Phát', 'Phúc', 'Quang', 'Sơn', 'Tài', 'Tâm', 'Thành', 'Thắng', 'Thịnh', 'Thuận', 'Tiến', 'Trí', 'Trung', 'Tuấn', 'Vinh', 'Vũ'];
const VIETNAMESE_GIVEN_FEMALE = ['Anh', 'Chi', 'Dung', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Linh', 'Mai', 'My', 'Ngân', 'Ngọc', 'Nhung', 'Như', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Trang', 'Trâm', 'Tuyết', 'Uyên', 'Vân', 'Vy', 'Yến'];

const CLASSES_CONFIG = [
  { className: 'D22CNTT01', major: 'Công nghệ thông tin' },
  { className: 'D22CNTT02', major: 'Công nghệ thông tin' },
  { className: 'D22CNTT03', major: 'Công nghệ thông tin' },
  { className: 'D22KTPM01', major: 'Kỹ thuật phần mềm' },
  { className: 'D22HTTT01', major: 'Hệ thống thông tin' },
  { className: 'D22ATTT01', major: 'An toàn thông tin' },
];

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

function buildThreeSemestersAccounts(precomputedHashes) {
  const admin = {
    email: 'admin@university.edu.vn',
    code: 'ADMIN001',
    fullName: 'Quản trị hệ thống',
    role: 'ADMIN',
    department: 'Viện Công nghệ số',
    academicTitle: null,
    phone: '0900000001',
    passwordHash: precomputedHashes.get('admin123'),
    isActive: true,
  };

  const lecturers = LECTURER_DEFINITIONS.map((def) => ({
    email: def.email,
    code: def.code,
    fullName: def.fullName,
    role: 'LECTURER',
    department: def.department,
    academicTitle: def.academicTitle,
    phone: def.phone,
    passwordHash: precomputedHashes.get('lecturer123'),
    isActive: true,
  }));

  const students = Array.from({ length: 300 }, (_, idx) => {
    const studentNumber = idx + 1;
    const padStr = String(studentNumber).padStart(3, '0');
    return {
      email: `sv${padStr}@university.edu.vn`,
      code: `2200${padStr}`,
      fullName: generateStudentFullName(idx),
      role: 'STUDENT',
      department: 'Viện Công nghệ số',
      academicTitle: null,
      phone: `0912${String(studentNumber).padStart(6, '0')}`,
      passwordHash: precomputedHashes.get('student123'),
      isActive: true,
    };
  });

  return { admin, lecturers, students };
}

function buildStudentProfilesData(studentUsers) {
  return studentUsers.map((user, idx) => {
    const classInfo = CLASSES_CONFIG[idx % CLASSES_CONFIG.length];
    const isFemale = (idx + 1) % 2 === 0;
    const month = idx % 12;
    const day = ((idx * 3) % 27) + 1;
    const dateOfBirth = new Date(Date.UTC(2004, month, day));

    return {
      studentId: user.id,
      gender: isFemale ? 'FEMALE' : 'MALE',
      dateOfBirth,
      className: classInfo.className,
      major: classInfo.major,
    };
  });
}

function getThreeSemesterDefinitions(baseDate = new Date()) {
  const base = new Date(baseDate.getTime());

  // Đợt 1 (Đã qua): code DATN-HK1-2025-26, tên Đồ án tốt nghiệp — HK1 2025–2026, status COMPLETED
  const semesterHK1_2526 = {
    code: 'DATN-HK1-2025-26',
    name: 'Đồ án tốt nghiệp — HK1 2025–2026',
    startDate: addDays(base, -420),
    registrationDeadline: addDays(base, -390),
    midtermReportDate: addDays(base, -330),
    defenseDate: addDays(base, -270),
    endDate: addDays(base, -240),
    registrationOpen: false,
    status: 'COMPLETED',
  };

  // Đợt 2 (Đã qua): code DATN-HK2-2025-26, tên Đồ án tốt nghiệp — HK2 2025–2026, status COMPLETED
  const semesterHK2_2526 = {
    code: 'DATN-HK2-2025-26',
    name: 'Đồ án tốt nghiệp — HK2 2025–2026',
    startDate: addDays(base, -240),
    registrationDeadline: addDays(base, -210),
    midtermReportDate: addDays(base, -150),
    defenseDate: addDays(base, -90),
    endDate: addDays(base, -60),
    registrationOpen: false,
    status: 'COMPLETED',
  };

  // Đợt 3 (Hiện tại): code DATN-HK1-2026-27, tên Đồ án tốt nghiệp — HK1 2026–2027, status ONGOING
  const semesterHK1_2627 = {
    code: 'DATN-HK1-2026-27',
    name: 'Đồ án tốt nghiệp — HK1 2026–2027',
    startDate: addDays(base, -90),
    registrationDeadline: addDays(base, -60),
    midtermReportDate: addDays(base, -5),
    defenseDate: addDays(base, 45),
    endDate: addDays(base, 60),
    registrationOpen: false,
    status: 'ONGOING',
  };

  return {
    semesterHK1_2526,
    semesterHK2_2526,
    semesterHK1_2627,
  };
}

// 100 Đề tài mẫu cho mỗi đợt, đa dạng chuyên ngành
const TOPIC_TEMPLATES = [
  'Nghiên cứu và xây dựng hệ thống quản lý học tập thông minh tích hợp trợ lý ảo AI',
  'Ứng dụng học sâu (Deep Learning) trong phát hiện sớm bất thường trên ảnh nội soi',
  'Xây dựng hệ thống giám sát và cảnh báo rò rỉ dữ liệu nhạy cảm sử dụng Machine Learning',
  'Phát triển nền tảng thương mại điện tử đa kênh dựa trên kiến trúc Microservices và Docker',
  'Xây dựng ứng dụng di động hỗ trợ quản lý tài chính cá nhân sử dụng React Native và FastAPI',
  'Nghiên cứu và triển khai giải pháp xác thực không mật khẩu (Passwordless Authentication) với FIDO2',
  'Hệ thống quản lý chuỗi cung ứng nông sản an toàn ứng dụng công nghệ Blockchain',
  'Phát triển hệ thống điểm danh tự động sinh viên sử dụng nhận diện khuôn mặt thời gian thực',
  'Xây dựng giải pháp phát hiện gian lận giao dịch trực tuyến sử dụng thuật toán Random Forest',
  'Nghiên cứu kiến trúc Micro-frontend trong hiện đại hóa cổng thông tin dịch vụ công trực tuyến',
  'Ứng dụng xử lý ngôn ngữ tự nhiên (NLP) phân loại tự động phản hồi của người dùng',
  'Hệ thống tự động phân tích và đánh giá chất lượng mã nguồn tuân thủ tiêu chuẩn Clean Code',
  'Xây dựng nền tảng chia sẻ và lưu trữ tài liệu phân tán ứng dụng IPFS và mật mã khóa công khai',
  'Nghiên cứu giải pháp bảo vệ hệ thống trước tấn công từ chối dịch vụ phân tán (DDoS) bằng eBPF',
  'Phát triển ứng dụng hỗ trợ người khiếm thị nhận diện vật cản và đọc văn bản sử dụng thị giác máy tính',
  'Xây dựng hệ sinh thái IoT giám sát môi trường nuôi trồng thủy sản thông minh ứng dụng MQTT',
  'Nghiên cứu và xây dựng hệ thống tư vấn lộ trình học tập cá nhân hóa dựa trên đồ thị tri thức',
  'Phát triển giải pháp tối ưu hóa bộ nhớ đệm (Cache Optimization) cho hệ thống có lưu lượng cao',
  'Hệ thống phát hiện mã độc và phần mềm tống tiền (Ransomware) dựa trên phân tích hành vi',
  'Nghiên cứu và triển khai hạ tầng đám mây tự động hóa bằng Terraform và Kubernetes',
];

function generateTopicTitle(semesterCode, studentIndexInSemester, major) {
  const baseTitle = TOPIC_TEMPLATES[studentIndexInSemester % TOPIC_TEMPLATES.length];
  const variant = Math.floor(studentIndexInSemester / TOPIC_TEMPLATES.length) + 1;
  const suffix = variant > 1 ? ` (Phiên bản ${variant} — ${major})` : ` (${major})`;
  return `${baseTitle}${suffix}`;
}

module.exports = {
  LECTURER_DEFINITIONS,
  CLASSES_CONFIG,
  TOPIC_TEMPLATES,
  RUBRIC_VERSION,
  addDays,
  generateStudentFullName,
  buildThreeSemestersAccounts,
  buildStudentProfilesData,
  getThreeSemesterDefinitions,
  generateTopicTitle,
};
