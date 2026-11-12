const PLATFORM_AUTHORIZATION_EXEMPTIONS = [
  { routeFile: 'announcementRoutes', method: 'GET', path: '/', type: 'PUBLIC', reason: 'Danh sách thông báo công khai.' },
  { routeFile: 'announcementRoutes', method: 'GET', path: '/:id', type: 'PUBLIC', reason: 'Chi tiết thông báo công khai.' },
  { routeFile: 'userRoutes', method: 'GET', path: '/public-lecturers', type: 'PUBLIC', reason: 'Danh bạ giảng viên công khai.' },
  { routeFile: 'semesterRoutes', method: 'GET', path: '/public', type: 'PUBLIC', reason: 'Thông tin đợt học kỳ công khai.' },
  { routeFile: 'semesterRoutes', method: 'GET', path: '/', type: 'SELF_SERVICE', reason: 'Dữ liệu học kỳ dùng chung cho user đã đăng nhập.' },
  { routeFile: 'semesterRoutes', method: 'GET', path: '/:id', type: 'SELF_SERVICE', reason: 'Chi tiết học kỳ dùng chung cho user đã đăng nhập.' },
  { routeFile: 'dashboardRoutes', method: 'GET', path: '/lecturer', type: 'OWNERSHIP_GUARDED', reason: 'Dashboard của chính giảng viên.' },
  { routeFile: 'dashboardRoutes', method: 'GET', path: '/student', type: 'OWNERSHIP_GUARDED', reason: 'Dashboard của chính sinh viên.' },
  { routeFile: 'notificationRoutes', method: 'GET', path: '/my', type: 'OWNERSHIP_GUARDED', reason: 'Thông báo của chính user.' },
  { routeFile: 'notificationRoutes', method: 'PATCH', path: '/:id/read', type: 'OWNERSHIP_GUARDED', reason: 'Đánh dấu thông báo của chính user.' },
  { routeFile: 'notificationRoutes', method: 'PATCH', path: '/read-all', type: 'OWNERSHIP_GUARDED', reason: 'Đánh dấu toàn bộ thông báo của chính user.' },
  { routeFile: 'notificationRoutes', method: 'DELETE', path: '/:id', type: 'OWNERSHIP_GUARDED', reason: 'Xóa thông báo của chính user.' },
  { routeFile: 'notificationRoutes', method: 'POST', path: '/lecturer-broadcast', type: 'OWNERSHIP_GUARDED', reason: 'Giảng viên gửi thông báo đến các sinh viên mình đang hướng dẫn.' },
  { routeFile: 'rubricRoutes', method: 'GET', path: '/active', type: 'SELF_SERVICE', reason: 'Rubric active cho user đã đăng nhập.' },
  { routeFile: 'portalContentRoutes', method: 'GET', path: '/public', type: 'PUBLIC', reason: 'Nội dung Portal đã công bố.' },
];

const ACADEMIC_AUTHORIZATION_EXEMPTIONS = [
  { routeFile: 'topicRoutes', method: 'GET', path: '/mentors', type: 'SELF_SERVICE', reason: 'Danh sách GVHD cho user đã đăng nhập.' },
  { routeFile: 'topicRoutes', method: 'GET', path: '/', type: 'SELF_SERVICE', reason: 'Danh sách đề tài cho user đã đăng nhập.' },
  { routeFile: 'topicRoutes', method: 'GET', path: '/:id', type: 'SELF_SERVICE', reason: 'Chi tiết đề tài cho user đã đăng nhập.' },
  { routeFile: 'registrationRoutes', method: 'GET', path: '/my', type: 'OWNERSHIP_GUARDED', reason: 'Hồ sơ đăng ký của chính sinh viên.' },
  { routeFile: 'registrationRoutes', method: 'GET', path: '/my-project-enrollments', type: 'OWNERSHIP_GUARDED', reason: 'Enrollment của chính sinh viên.' },
  { routeFile: 'registrationRoutes', method: 'POST', path: '/', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên tự đăng ký đề tài.' },
  { routeFile: 'registrationRoutes', method: 'POST', path: '/bm02-submit', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên tự nộp BM02.' },
  { routeFile: 'registrationRoutes', method: 'POST', path: '/adjust-title', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên tự đề nghị đổi tên.' },
  { routeFile: 'registrationRoutes', method: 'GET', path: '/adjust-title/my', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên xem đơn đổi tên của mình.' },
  { routeFile: 'registrationRoutes', method: 'DELETE', path: '/:id', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên hủy đăng ký của mình.' },
  { routeFile: 'registrationRoutes', method: 'GET', path: '/:id/allowed-actions', type: 'OWNERSHIP_GUARDED', reason: 'Action contract sau kiểm tra quyền xem hồ sơ.' },
  { routeFile: 'taskRoutes', method: 'POST', path: '/:id/submit', type: 'OWNERSHIP_GUARDED', reason: 'Sinh viên nộp task của mình.' },
];

module.exports = {
  PLATFORM_AUTHORIZATION_EXEMPTIONS,
  ACADEMIC_AUTHORIZATION_EXEMPTIONS,
};
