/**
 * Navigation Registry Cố Định 25 Mục & 7 Khối Nghiệp Vụ
 * Tuân thủ chuẩn 2-Tier Capability Matrix (Section 5.1 & Section 7.1 của Technical Spec).
 * 
 * Mỗi mục menu tương ứng quyền xem (requiredPermission hoặc requiredAnyPermissions).
 * Client lọc menu theo effectivePermissions mà không rẽ nhánh role cứng.
 */

import { NAVIGATION_GROUPS } from '../auth/featurePolicies.js';
export { NAVIGATION_GROUPS };

export const NAVIGATION_REGISTRY = [
    // KHỐI 1: HỒ SƠ CỦA TÔI (5 mục)
    {
        key: 'my-registration',
        label: 'Đề tài đăng ký',
        icon: 'folder_open',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_REGISTRATION',
        route: '/student/topics',
    },
    {
        key: 'my-topics',
        label: 'Đề tài phụ trách',
        icon: 'topic',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_TOPICS',
        route: '/lecturer/topics',
    },
    {
        key: 'my-submissions',
        label: 'Hồ sơ & Nộp bài',
        icon: 'cloud_upload',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_SUBMISSIONS',
        requiredAnyPermissions: ['VIEW_MY_SUBMISSIONS', 'VIEW_MY_ARCHIVE', 'SUBMIT_BM01', 'SUBMIT_BM02', 'SUBMIT_TASK'],
        route: '/student/submissions',
    },
    {
        key: 'my-archive',
        label: 'Hồ sơ lưu chiểu',
        icon: 'inventory_2',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_ARCHIVE',
        route: '/student/submissions?tab=archive',
    },
    {
        key: 'my-grades',
        label: 'Kết quả & Điểm đồ án',
        icon: 'workspace_premium',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_GRADES',
        route: '/student/grades',
    },

    // KHỐI 2: HƯỚNG DẪN & TIẾN ĐỘ (2 mục)
    {
        key: 'mentored-students',
        label: 'Sinh viên hướng dẫn',
        icon: 'school',
        group: 'Hướng dẫn & tiến độ',
        requiredPermission: 'VIEW_MENTORED_STUDENTS',
        route: '/lecturer/approvals',
    },
    {
        key: 'progress-checkpoints',
        label: 'Theo dõi tiến độ',
        icon: 'fact_check',
        group: 'Hướng dẫn & tiến độ',
        requiredPermission: 'VIEW_CHECKPOINTS',
        route: '/lecturer/progress',
    },

    // KHỐI 3: THẨM ĐỊNH & QUYẾT ĐỊNH (1 mục)
    {
        key: 'outline-reviews',
        label: 'Thẩm định đề cương',
        icon: 'rate_review',
        group: 'Thẩm định & quyết định',
        requiredPermission: 'VIEW_OUTLINE_REVIEWS',
        requiresOutlineCouncil: true,
        route: '/lecturer/approvals?tab=bm01',
    },

    // KHỐI 4: HỘI ĐỒNG & BẢO VỆ (4 mục)
    {
        key: 'outline-councils',
        label: 'HĐ Xét duyệt Đề cương',
        icon: 'fact_check',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'OUTLINE_COUNCIL_MANAGE',
        requiresOutlineCouncil: true,
        route: '/admin/outline-councils',
    },
    {
        key: 'defense-councils',
        label: 'HĐ Bảo vệ khóa luận',
        icon: 'groups',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'DEFENSE_COUNCIL_MANAGE',
        requiresDefenseCouncil: true,
        route: '/admin/defense-councils',
    },
    {
        key: 'defense-grading',
        label: 'Phiếu chấm bảo vệ',
        icon: 'edit_note',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'VIEW_DEFENSE_GRADING',
        requiresDefenseCouncil: true,
        route: '/lecturer/grading',
    },
    {
        key: 'defense-lock',
        label: 'Tổng hợp & Khóa điểm',
        icon: 'lock',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'VIEW_DEFENSE_LOCK_LEDGER',
        route: '/admin/grading',
    },

    // KHỐI 5: KẾT QUẢ & CÔNG BỐ (3 mục)
    {
        key: 'defense-result-approvals',
        label: 'Phê duyệt kết quả',
        icon: 'approval',
        group: 'Kết quả & công bố',
        requiredPermission: 'VIEW_DEFENSE_RESULT_APPROVALS',
        requiredAnyPermissions: ['VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL', 'DEFENSE_RESULT_APPROVE'],
        route: '/admin/grading?tab=approvals',
    },
    {
        key: 'result-publications',
        label: 'Công bố kết quả',
        icon: 'campaign',
        group: 'Kết quả & công bố',
        requiredPermission: 'VIEW_RESULT_PUBLICATIONS',
        requiredAnyPermissions: ['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH'],
        route: '/admin/grading?tab=publish',
    },
    {
        key: 'rubric-config',
        label: 'Tiêu chí chấm điểm',
        icon: 'rule',
        group: 'Kết quả & công bố',
        requiredPermission: 'VIEW_RUBRIC_CONFIG',
        route: '/admin/rubric-management',
    },

    // KHỐI 6: QUẢN TRỊ HỌC VỤ (5 mục)
    {
        key: 'project-periods',
        label: 'Đợt đồ án & Học kỳ',
        icon: 'calendar_month',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_PERIODS',
        route: '/admin/project-periods',
    },
    {
        key: 'project-enrollments',
        label: 'Điều phối & Gán sinh viên',
        icon: 'playlist_add_check',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_ENROLLMENTS',
        requiredAnyPermissions: ['VIEW_PROJECT_ENROLLMENTS', 'MENTOR_ASSIGN', 'PERMISSION_ASSIGN_ACADEMIC', 'ENROLLMENT_MANAGE'],
        route: '/admin/project-enrollments',
    },
    {
        key: 'all-topics',
        label: 'Danh mục đề tài đồ án',
        icon: 'list_alt',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_ALL_TOPICS',
        route: '/admin/topics',
    },
    {
        key: 'project-oversight',
        label: 'Theo dõi & Giám sát tiến độ',
        icon: 'policy',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        route: '/admin/oversight',
    },
    {
        key: 'academic-reports',
        label: 'Báo cáo & Thống kê',
        icon: 'bar_chart',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        requiredAnyPermissions: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        route: '/admin/reports',
    },

    // KHỐI 7: QUẢN TRỊ HỆ THỐNG (5 mục)
    {
        key: 'users',
        label: 'Quản lý người dùng',
        icon: 'group',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_USERS',
        route: '/admin/users',
    },
    {
        key: 'permissions',
        label: 'Phân quyền & Nhóm quyền',
        icon: 'shield_lock',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_PERMISSIONS',
        route: '/admin/permissions',
    },
    {
        key: 'announcements',
        label: 'Bản tin & Thông báo',
        icon: 'feed',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_ANNOUNCEMENTS',
        route: '/admin/announcements',
    },
    {
        key: 'portal-content',
        label: 'Quản lý nội dung & Biểu mẫu',
        icon: 'file_copy',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_PORTAL_CONTENT',
        route: '/admin/portal',
    },
    {
        key: 'notifications',
        label: 'Gửi thông báo hệ thống',
        icon: 'notifications_active',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_NOTIFICATIONS',
        route: '/admin/notifications',
    },
];

export { getVisibleNavigation } from '../auth/policyEvaluator.js';
