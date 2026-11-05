const PERMISSION_CATALOG = [
  // CỔNG THÔNG TIN & TRUYỀN THÔNG
  { code: 'PORTAL_CONTENT_MANAGE', label: 'Quản trị nội dung & biểu mẫu Portal', module: 'PORTAL' },
  { code: 'PUBLIC_ANNOUNCEMENT_MANAGE', label: 'Quản lý bản tin & thông báo Portal', module: 'ANNOUNCEMENT' },

  // GIẢNG VIÊN & PHÂN CÔNG HƯỚNG DẪN
  { code: 'LECTURER_DIRECTORY_VIEW', label: 'Xem danh bạ & danh sách giảng viên', module: 'LECTURER' },
  { code: 'MENTOR_REQUEST_REVIEW', label: 'Xét duyệt nguyện vọng chọn GVHD', module: 'MENTOR' },
  { code: 'MENTOR_ASSIGN', label: 'Phân công giảng viên hướng dẫn', module: 'MENTOR' },
  { code: 'MENTOR_ASSIGNMENT_ADJUST', label: 'Điều chỉnh phân công GVHD', module: 'MENTOR' },

  // ĐỀ TÀI & XÉT DUYỆT CHUYÊN MÔN
  { code: 'TOPIC_CREATE', label: 'Tạo đề tài nghiên cứu mới', module: 'TOPIC' },
  { code: 'TOPIC_UPDATE_OWN', label: 'Cập nhật đề tài phụ trách', module: 'TOPIC' },
  { code: 'TOPIC_REVIEW', label: 'Xét duyệt chuyên môn đề tài', module: 'TOPIC' },

  // ĐỀ CƯƠNG BM01 & HỘI ĐỒNG THẨM ĐỊNH
  { code: 'OUTLINE_REVIEW', label: 'Xem & góp ý đề cương BM01', module: 'OUTLINE' },
  { code: 'OUTLINE_APPROVE', label: 'Phê duyệt đề cương BM01', module: 'OUTLINE' },
  { code: 'OUTLINE_COUNCIL_MANAGE', label: 'Thành lập Hội đồng thẩm định BM01', module: 'OUTLINE' },

  // ĐƠN ĐĂNG KÝ BM02 & QUYẾT ĐỊNH GIAO ĐỀ TÀI
  { code: 'BM02_REVIEW', label: 'Thẩm định đơn đăng ký đề tài BM02', module: 'REGISTRATION' },
  { code: 'PROJECT_ASSIGNMENT_PUBLISH', label: 'Ban hành Quyết định giao đề tài', module: 'REGISTRATION' },

  // TIẾN ĐỘ BM03, CHECKPOINT & BM04
  { code: 'BM03_SUBMIT', label: 'Ghi nhật ký trao đổi & nhiệm vụ BM03', module: 'PROGRESS' },
  { code: 'BM03_REVIEW', label: 'Theo dõi & giám sát tiến độ BM03', module: 'PROGRESS' },
  { code: 'BM03_CHECKPOINT_DECIDE', label: 'Đánh giá checkpoint tiến độ', module: 'PROGRESS' },
  { code: 'BM04_SUBMIT', label: 'Lập phiếu nhận xét BM04 (GVHD)', module: 'PROGRESS' },
  { code: 'BM04_REVIEW', label: 'Xem phiếu nhận xét BM04', module: 'PROGRESS' },

  // HỘI ĐỒNG BẢO VỆ & ĐIỂM SỐ
  { code: 'DEFENSE_COUNCIL_MANAGE', label: 'Thành lập Hội đồng chấm bảo vệ', module: 'DEFENSE' },
  { code: 'DEFENSE_SCORE_SUBMIT', label: 'Nhập phiếu chấm điểm bảo vệ (HĐ)', module: 'DEFENSE' },
  { code: 'DEFENSE_SCORE_VIEW', label: 'Xem tổng hợp điểm hội đồng bảo vệ', module: 'DEFENSE' },
  { code: 'RESULT_LOCK', label: 'Khóa bảng điểm & biên bản hội đồng', module: 'DEFENSE' },
  { code: 'DEFENSE_RESULT_APPROVE', label: 'Phê duyệt kết quả bảo vệ', module: 'DEFENSE' },
  { code: 'RESULT_PUBLISH', label: 'Công bố bảng điểm & kết quả bảo vệ', module: 'DEFENSE' },
  { code: 'RUBRIC_MANAGE', label: 'Quản trị tiêu chí chấm điểm (Rubric)', module: 'DEFENSE' },

  // LƯU CHIỂU SỐ
  { code: 'FINAL_DOCUMENT_REVIEW', label: 'Thẩm định & xác nhận lưu chiểu', module: 'REVISION' },

  // BÁO CÁO & THỐNG KÊ
  { code: 'REPORT_VIEW', label: 'Xem báo cáo & thống kê học vụ', module: 'REPORT' },

  // QUẢN TRỊ HỆ THỐNG
  { code: 'USER_MANAGE', label: 'Quản lý danh sách người dùng', module: 'ADMIN' },
  { code: 'USER_IMPORT', label: 'Import tài khoản từ file Excel', module: 'ADMIN' },
  { code: 'PERMISSION_GROUP_MANAGE', label: 'Quản lý nhóm quyền & phân quyền', module: 'ADMIN' },
  { code: 'SEMESTER_MANAGE', label: 'Quản lý đợt đồ án & học kỳ', module: 'ADMIN' },
  { code: 'PROJECT_CATALOG_MANAGE', label: 'Quản lý danh mục môn đồ án', module: 'ADMIN' },
  { code: 'ENROLLMENT_MANAGE', label: 'Quản lý gán môn sinh viên (Enrollment)', module: 'ADMIN' },
  { code: 'NOTIFICATION_MANAGE', label: 'Gửi thông báo & nhắc nhở người dùng', module: 'ADMIN' },
  { code: 'LEGACY_REVIEW_MANAGE', label: 'Thẩm định hồ sơ chuyển giao / ngoại lệ', module: 'ADMIN' },
];

const PERMISSIONS = Object.freeze(Object.fromEntries(
  PERMISSION_CATALOG.map(({ code }) => [code, code]),
));

const DEFAULT_GROUPS = [
  {
    name: 'Giảng viên hướng dẫn',
    code: 'GVHD',
    description: 'Quyền nghiệp vụ của giảng viên hướng dẫn',
    permissions: [
      'LECTURER_DIRECTORY_VIEW',
      'TOPIC_CREATE',
      'TOPIC_UPDATE_OWN',
      'MENTOR_REQUEST_REVIEW',
      'OUTLINE_REVIEW',
      'BM03_SUBMIT',
      'BM03_REVIEW',
      'BM03_CHECKPOINT_DECIDE',
      'BM04_SUBMIT',
      'DEFENSE_SCORE_SUBMIT',
      'DEFENSE_SCORE_VIEW',
      'FINAL_DOCUMENT_REVIEW',
      'REPORT_VIEW',
    ],
  },
  {
    name: 'Viện trưởng',
    code: 'VIEN_TRUONG',
    description: 'Quyền quản lý nghiệp vụ của Viện trưởng kiêm GVHD',
    permissions: [
      'LECTURER_DIRECTORY_VIEW',
      'MENTOR_ASSIGN',
      'MENTOR_ASSIGNMENT_ADJUST',
      'TOPIC_REVIEW',
      'OUTLINE_REVIEW',
      'OUTLINE_APPROVE',
      'OUTLINE_COUNCIL_MANAGE',
      'BM02_REVIEW',
      'PROJECT_ASSIGNMENT_PUBLISH',
      'BM03_REVIEW',
      'BM04_REVIEW',
      'DEFENSE_COUNCIL_MANAGE',
      'DEFENSE_SCORE_VIEW',
      'RESULT_LOCK',
      'DEFENSE_RESULT_APPROVE',
      'RESULT_PUBLISH',
      'RUBRIC_MANAGE',
      'FINAL_DOCUMENT_REVIEW',
      'PUBLIC_ANNOUNCEMENT_MANAGE',
      'REPORT_VIEW',
    ],
  },
  {
    name: 'Quản trị viên',
    code: 'QUAN_TRI_VIEN',
    description: 'Quyền quản trị hệ thống',
    permissions: [
      'USER_MANAGE',
      'USER_IMPORT',
      'PERMISSION_GROUP_MANAGE',
      'SEMESTER_MANAGE',
      'PROJECT_CATALOG_MANAGE',
      'ENROLLMENT_MANAGE',
      'RUBRIC_MANAGE',
      'NOTIFICATION_MANAGE',
      'LEGACY_REVIEW_MANAGE',
      'PUBLIC_ANNOUNCEMENT_MANAGE',
      'PORTAL_CONTENT_MANAGE',
      'REPORT_VIEW',
    ],
  },
];

module.exports = {
  PERMISSIONS,
  PERMISSION_CATALOG,
  DEFAULT_GROUPS,
};
