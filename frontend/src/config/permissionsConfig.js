/**
 * Cấu hình chuẩn hóa Quyền hạn, Bảo vệ Học thuật & Phân loại Ma trận RBAC
 * Đồng bộ tuyệt đối với backend/src/constants/permissions.js
 */

export const ACADEMIC_PROTECTED_PERMISSIONS = Object.freeze([
    // Đề tài & Xét duyệt
    'TOPIC_CREATE',
    'TOPIC_UPDATE_OWN',
    'TOPIC_REVIEW',
    'VIEW_TOPIC_REVIEWS',
    // Phân công hướng dẫn
    'MENTOR_REQUEST_REVIEW',
    'MENTOR_ASSIGN',
    'MENTOR_ASSIGNMENT_ADJUST',
    'VIEW_MENTOR_STUDENTS',
    'VIEW_MENTORED_STUDENTS',
    'VIEW_MY_TOPICS',
    // Đề cương BM01
    'OUTLINE_REVIEW',
    'OUTLINE_APPROVE',
    'OUTLINE_COUNCIL_MANAGE',
    'VIEW_OUTLINE_REVIEWS',
    // Đơn BM02 & Quyết định
    'BM02_REVIEW',
    'PROJECT_ASSIGNMENT_PUBLISH',
    'DECISION_AMENDMENT_SIGN',
    'VIEW_BM02_REVIEWS',
    'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
    'VIEW_ASSIGNMENT_DECISIONS',
    // Tiến độ BM03, Checkpoint & BM04
    'BM03_SUBMIT',
    'BM03_REVIEW',
    'BM03_CHECKPOINT_DECIDE',
    'CHECKPOINT_ISSUE',
    'BM04_SUBMIT',
    'BM04_REVIEW',
    'SIGNATURE_APPEAL_REVIEW',
    'VIEW_CHECKPOINTS',
    'VIEW_BM04_EVALUATIONS',
    // Hội đồng bảo vệ & Điểm số
    'DEFENSE_COUNCIL_MANAGE',
    'DEFENSE_SCORE_SUBMIT',
    'DEFENSE_SCORE_VIEW',
    'RESULT_LOCK',
    'DEFENSE_RESULT_APPROVE',
    'RESULT_PUBLISH',
    'RESULT_PUBLICATION_PUBLISH',
    'VIEW_DEFENSE_ASSIGNMENTS',
    'VIEW_COUNCIL_ASSIGNMENTS',
    'VIEW_DEFENSE_GRADING',
    'VIEW_RESULT_LOCKS',
    'VIEW_DEFENSE_LOCK_LEDGER',
    'VIEW_DEFENSE_RESULTS_APPROVAL',
    'VIEW_DEFENSE_RESULT_APPROVALS',
    'VIEW_RESULT_PUBLICATIONS',
    // Lưu chiểu số & Ủy quyền
    'FINAL_DOCUMENT_REVIEW',
    'VIEW_CLEARANCE_CERTIFICATES',
    'PERMISSION_ASSIGN_ACADEMIC',
    'VIEW_ACADEMIC_DELEGATIONS',
]);

export const TECHNICAL_PERMISSIONS = Object.freeze([
    'PORTAL_CONTENT_MANAGE',
    'VIEW_PORTAL_CONTENT',
    'PUBLIC_ANNOUNCEMENT_MANAGE',
    'VIEW_ANNOUNCEMENTS',
    'USER_MANAGE',
    'USER_IMPORT',
    'VIEW_USERS',
    'PERMISSION_GROUP_MANAGE',
    'VIEW_PERMISSION_GROUPS',
    'VIEW_PERMISSIONS',
    'SEMESTER_MANAGE',
    'VIEW_SEMESTERS',
    'VIEW_PROJECT_PERIODS',
    'PROJECT_CATALOG_MANAGE',
    'VIEW_PROJECT_CATALOGS',
    'ENROLLMENT_MANAGE',
    'VIEW_PROJECT_ENROLLMENTS',
    'NOTIFICATION_MANAGE',
    'VIEW_NOTIFICATIONS',
    'PROJECT_OVERSIGHT_MANAGE',
    'VIEW_PROJECT_OVERSIGHT',
    'REPORT_VIEW',
    'VIEW_ALL_TOPICS',
    'LECTURER_DIRECTORY_VIEW',
    'RUBRIC_MANAGE',
    'VIEW_RUBRIC_CONFIG',
]);

export const CANONICAL_ALIAS_MAP = Object.freeze({
    VIEW_MENTORED_STUDENTS: 'VIEW_MENTOR_STUDENTS',
    VIEW_ASSIGNMENT_DECISIONS: 'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
    VIEW_COUNCIL_ASSIGNMENTS: 'VIEW_DEFENSE_ASSIGNMENTS',
    VIEW_DEFENSE_LOCK_LEDGER: 'VIEW_RESULT_LOCKS',
    VIEW_DEFENSE_RESULT_APPROVALS: 'VIEW_DEFENSE_RESULTS_APPROVAL',
    VIEW_RUBRIC_CONFIG: 'RUBRIC_MANAGE',
    VIEW_ALL_TOPICS: 'TOPIC_REVIEW',
    VIEW_PERMISSIONS: 'VIEW_PERMISSION_GROUPS',
    VIEW_ANNOUNCEMENTS: 'PUBLIC_ANNOUNCEMENT_MANAGE',
    VIEW_NOTIFICATIONS: 'NOTIFICATION_MANAGE',
});

export const REVERSE_ALIAS_MAP = Object.freeze(
    Object.entries(CANONICAL_ALIAS_MAP).reduce((acc, [alias, canonical]) => {
        acc[canonical] = alias;
        return acc;
    }, {})
);

export const MODULE_COLORS = {
    PORTAL: 'cyan',
    ANNOUNCEMENT: 'blue',
    LECTURER: 'geekblue',
    MENTOR: 'purple',
    TOPIC: 'magenta',
    OUTLINE: 'volcano',
    REGISTRATION: 'orange',
    PROGRESS: 'gold',
    DEFENSE: 'red',
    REVISION: 'lime',
    REPORT: 'green',
    ADMIN: 'default',
    DELEGATION: 'purple',
    STUDENT: 'geekblue',
};

export const MODULE_TITLES = {
    PORTAL: 'Cổng thông tin & Biểu mẫu Portal',
    ANNOUNCEMENT: 'Bản tin & Quyết định học vụ',
    LECTURER: 'Danh bạ Giảng viên',
    MENTOR: 'Phân công hướng dẫn (GVHD)',
    TOPIC: 'Đề tài & Xét duyệt chuyên môn',
    OUTLINE: 'Đề cương BM01 & Hội đồng thẩm định',
    REGISTRATION: 'Đơn BM02 & Quyết định giao đề tài',
    PROGRESS: 'Tiến độ BM03, Checkpoint & BM04',
    DEFENSE: 'Hội đồng Chấm bảo vệ & Điểm số',
    REVISION: 'Lưu chiểu số & Sau bảo vệ',
    REPORT: 'Báo cáo & Thống kê học vụ',
    ADMIN: 'Quản trị hệ thống & Đào tạo',
    DELEGATION: 'Ủy quyền chuyên môn & Học thuật',
    STUDENT: 'Hồ sơ & Đăng ký sinh viên',
};

/**
 * Kiểm tra xem quyền có phải là quyền học thuật được bảo vệ không
 */
export const isAcademicProtected = (code) => ACADEMIC_PROTECTED_PERMISSIONS.includes(code);

/**
 * Kiểm tra xem quyền có phải là quyền kỹ thuật không
 */
export const isTechnical = (code) => TECHNICAL_PERMISSIONS.includes(code);

/**
 * Kiểm tra xem quyền có phải là quyền xem trang (VIEW_*) không
 */
export const isViewPermission = (code) => typeof code === 'string' && code.startsWith('VIEW_');

/**
 * Kiểm tra xem quyền có phải là quyền thao tác (Action capability) không
 */
export const isActionPermission = (code) => typeof code === 'string' && !code.startsWith('VIEW_');

/**
 * Kiểm tra xem mã quyền có phải là alias tương thích ngược không
 */
export const isAliasPermission = (code) => Boolean(CANONICAL_ALIAS_MAP[code]);

/**
 * Lấy mã chính nếu là alias, hoặc trả về chính nó
 */
export const getCanonicalCode = (code) => CANONICAL_ALIAS_MAP[code] || code;

/**
 * Lấy mã alias tương ứng (nếu có) từ mã chính
 */
export const getAliasCode = (code) => REVERSE_ALIAS_MAP[code] || null;

