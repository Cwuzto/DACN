/**
 * Feature Policy Manifest
 * Danh mục canonical xác định chính sách phân quyền và cấu trúc điều hướng theo quy trình đồ án:
 * - Route bảo vệ
 * - Menu điều hướng (Navigation: label, icon, group, order, requiredPermission)
 * - Quyền xem (viewAnyOf, viewAllOf)
 * - Quyền thao tác (actions)
 * - Điều kiện phân công vai trò phụ / hội đồng (assignment)
 */

export const NAVIGATION_GROUPS = Object.freeze([
    'Đăng ký & đề cương',
    'Thực hiện đồ án',
    'Đợt & đăng ký',
    'Hướng dẫn & tiến độ',
    'Hội đồng & bảo vệ',
    'Bảo vệ & hoàn tất',
    'Kết quả & báo cáo',
    'Điều hành viện',
    'Nội dung & hệ thống',
]);

export const FEATURE_POLICIES = Object.freeze({
    // KHỐI: ĐĂNG KÝ & ĐỀ CƯƠNG
    'my-registration': {
        key: 'my-registration',
        workspace: 'student',
        route: '/student/topics',
        menu: {
            label: 'Tìm & đăng ký đề tài',
            icon: 'folder_open',
            group: 'Đăng ký & đề cương',
            order: 1,
            requiredPermission: 'VIEW_MY_REGISTRATION',
        },
        viewAnyOf: ['VIEW_MY_REGISTRATION', 'REGISTER_TOPIC'],
        actions: {
            register: 'REGISTER_TOPIC',
            rename: 'RENAME_TOPIC',
            cancel: 'REGISTRATION_CANCEL',
        },
    },
    'my-topics': {
        key: 'my-topics',
        workspace: 'lecturer',
        route: '/lecturer/topics',
        menu: {
            label: 'Đề tài phụ trách',
            icon: 'topic',
            group: 'Đăng ký & đề cương',
            order: 2,
            requiredPermission: 'VIEW_MY_TOPICS',
        },
        viewAnyOf: ['VIEW_MY_TOPICS', 'TOPIC_CREATE', 'TOPIC_UPDATE_OWN'],
        actions: {
            create: 'TOPIC_CREATE',
            update: 'TOPIC_UPDATE_OWN',
        },
    },
    'mentored-students': {
        key: 'mentored-students',
        workspace: 'lecturer',
        route: '/lecturer/approvals?tab=mentor',
        menu: {
            label: 'Duyệt nguyện vọng',
            icon: 'fact_check',
            group: 'Đăng ký & đề cương',
            order: 3,
            requiredPermission: 'VIEW_MENTORED_STUDENTS',
        },
        viewAnyOf: ['VIEW_MENTORED_STUDENTS', 'VIEW_MENTOR_STUDENTS', 'MENTOR_REQUEST_REVIEW'],
        actions: {
            reviewMentorRequest: 'MENTOR_REQUEST_REVIEW',
        },
    },
    'outline-reviews': {
        key: 'outline-reviews',
        workspace: 'lecturer',
        route: '/lecturer/approvals?tab=bm01',
        menu: {
            label: 'Thẩm định đề cương',
            icon: 'rate_review',
            group: 'Đăng ký & đề cương',
            order: 4,
            requiredPermission: 'VIEW_OUTLINE_REVIEWS',
        },
        viewAnyOf: ['VIEW_OUTLINE_REVIEWS', 'OUTLINE_REVIEW', 'OUTLINE_APPROVE'],
        assignment: 'outlineCouncil',
        actions: {
            review: 'OUTLINE_REVIEW',
            approve: 'OUTLINE_APPROVE',
        },
    },

    // KHỐI: THỰC HIỆN ĐỒ ÁN
    'my-submissions': {
        key: 'my-submissions',
        workspace: 'student',
        route: '/student/submissions',
        menu: {
            label: 'Hồ sơ & nộp bài',
            icon: 'cloud_upload',
            group: 'Thực hiện đồ án',
            order: 1,
            requiredPermission: 'VIEW_MY_SUBMISSIONS',
        },
        viewAnyOf: [
            'VIEW_MY_SUBMISSIONS',
            'VIEW_MY_ARCHIVE',
            'SUBMIT_BM01',
            'SUBMIT_BM02',
            'SUBMIT_TASK',
            'SUBMIT_PRE_DEFENSE_ARCHIVE',
            'SUBMIT_FINAL_ARCHIVE',
        ],
        actions: {
            submitBm01: 'SUBMIT_BM01',
            submitBm02: 'SUBMIT_BM02',
            submitTask: 'SUBMIT_TASK',
            signCheckpoint: 'CHECKPOINT_SIGN',
            appealSignature: 'SIGNATURE_APPEAL_SUBMIT',
        },
    },

    // KHỐI: ĐỢT & ĐĂNG KÝ
    'project-periods': {
        key: 'project-periods',
        workspace: 'admin',
        route: '/admin/project-periods',
        menu: {
            label: 'Đợt đồ án & học kỳ',
            icon: 'calendar_month',
            group: 'Đợt & đăng ký',
            order: 1,
            requiredPermission: 'VIEW_PROJECT_PERIODS',
        },
        viewAnyOf: ['VIEW_PROJECT_PERIODS', 'VIEW_SEMESTERS', 'SEMESTER_MANAGE'],
        actions: {
            manage: 'SEMESTER_MANAGE',
        },
    },
    'project-enrollments': {
        key: 'project-enrollments',
        workspace: 'admin',
        route: '/admin/project-enrollments',
        menu: {
            label: 'Điều phối sinh viên',
            icon: 'playlist_add_check',
            group: 'Đợt & đăng ký',
            order: 2,
            requiredPermission: 'VIEW_PROJECT_ENROLLMENTS',
        },
        viewAnyOf: [
            'VIEW_PROJECT_ENROLLMENTS',
            'VIEW_PROJECT_CATALOGS',
            'ENROLLMENT_MANAGE',
            'MENTOR_ASSIGN',
            'PERMISSION_ASSIGN_ACADEMIC',
            'PROJECT_CATALOG_MANAGE',
            'PROJECT_ASSIGNMENT_PUBLISH',
        ],
        actions: {
            assignMentor: 'MENTOR_ASSIGN',
            adjustMentor: 'MENTOR_ASSIGNMENT_ADJUST',
            manageEnrollment: 'ENROLLMENT_MANAGE',
            assignAcademic: 'PERMISSION_ASSIGN_ACADEMIC',
            publishAssignment: 'PROJECT_ASSIGNMENT_PUBLISH',
        },
    },
    'all-topics': {
        key: 'all-topics',
        workspace: 'admin',
        route: '/admin/topics',
        menu: {
            label: 'Danh mục đề tài',
            icon: 'list_alt',
            group: 'Đợt & đăng ký',
            order: 3,
            requiredPermission: 'VIEW_ALL_TOPICS',
        },
        viewAnyOf: ['VIEW_ALL_TOPICS', 'VIEW_TOPIC_REVIEWS', 'TOPIC_REVIEW'],
        actions: {
            review: 'TOPIC_REVIEW',
        },
    },

    // KHỐI: HƯỚNG DẪN & TIẾN ĐỘ
    'lecturer-students': {
        key: 'lecturer-students',
        workspace: 'lecturer',
        route: '/lecturer/students',
        menu: {
            label: 'Sinh viên đang hướng dẫn',
            icon: 'school',
            group: 'Hướng dẫn & tiến độ',
            order: 1,
            requiredPermission: 'VIEW_MENTORED_STUDENTS',
        },
        viewAnyOf: ['VIEW_MENTORED_STUDENTS', 'VIEW_MENTOR_STUDENTS'],
        actions: {},
    },
    'progress-checkpoints': {
        key: 'progress-checkpoints',
        workspace: 'lecturer',
        route: '/lecturer/progress',
        menu: {
            label: 'Theo dõi tiến độ',
            icon: 'fact_check',
            group: 'Hướng dẫn & tiến độ',
            order: 2,
            requiredPermission: 'VIEW_CHECKPOINTS',
        },
        viewAnyOf: ['VIEW_CHECKPOINTS', 'VIEW_BM04_EVALUATIONS', 'BM03_REVIEW'],
        actions: {
            issueCheckpoint: 'CHECKPOINT_ISSUE',
            reviewBm03: 'BM03_REVIEW',
            submitBm04: 'BM04_SUBMIT',
            signBm04: 'BM04_CREATE_AND_SIGN',
        },
    },
    'project-oversight': {
        key: 'project-oversight',
        workspace: 'admin',
        route: '/admin/oversight',
        menu: {
            label: 'Giám sát tiến độ',
            icon: 'policy',
            group: 'Hướng dẫn & tiến độ',
            order: 3,
            requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        },
        viewAnyOf: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        actions: {
            manage: 'PROJECT_OVERSIGHT_MANAGE',
        },
    },

    // KHỐI: HỘI ĐỒNG & BẢO VỆ
    'outline-councils': {
        key: 'outline-councils',
        workspace: 'admin',
        route: '/admin/outline-councils',
        menu: {
            label: 'Hội đồng xét duyệt đề cương',
            icon: 'fact_check',
            group: 'Hội đồng & bảo vệ',
            order: 1,
            requiredPermission: 'OUTLINE_COUNCIL_MANAGE',
        },
        viewAnyOf: ['OUTLINE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS'],
        assignment: 'outlineCouncil',
        actions: {
            manage: 'OUTLINE_COUNCIL_MANAGE',
        },
    },
    'defense-councils': {
        key: 'defense-councils',
        workspace: 'admin',
        route: '/admin/defense-councils',
        menu: {
            label: 'Hội đồng bảo vệ',
            icon: 'groups',
            group: 'Hội đồng & bảo vệ',
            order: 2,
            requiredPermission: 'DEFENSE_COUNCIL_MANAGE',
        },
        viewAnyOf: ['DEFENSE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS', 'VIEW_DEFENSE_ASSIGNMENTS'],
        assignment: 'defenseCouncil',
        actions: {
            manage: 'DEFENSE_COUNCIL_MANAGE',
            replaceMember: 'DEFENSE_MEMBER_REPLACE',
            publishSchedule: 'DEFENSE_SCHEDULE_PUBLISH',
        },
    },
    'defense-grading': {
        key: 'defense-grading',
        workspace: 'lecturer',
        route: '/lecturer/grading',
        menu: {
            label: 'Phiếu chấm bảo vệ',
            icon: 'edit_note',
            group: 'Hội đồng & bảo vệ',
            order: 3,
            requiredPermission: 'VIEW_DEFENSE_GRADING',
        },
        viewAnyOf: ['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW', 'DEFENSE_SCORE_SUBMIT'],
        assignment: 'defenseCouncil',
        actions: {
            submitScore: 'DEFENSE_SCORE_SUBMIT',
        },
    },
    'defense-lock': {
        key: 'defense-lock',
        workspace: 'admin',
        route: '/admin/grading',
        menu: {
            label: 'Sổ điểm bảo vệ',
            icon: 'lock',
            group: 'Hội đồng & bảo vệ',
            order: 4,
            requiredPermission: 'VIEW_DEFENSE_LOCK_LEDGER',
        },
        viewAnyOf: ['VIEW_DEFENSE_LOCK_LEDGER', 'VIEW_RESULT_LOCKS', 'RESULT_LOCK'],
        actions: {
            lock: 'RESULT_LOCK',
            returnScorebook: 'DEFENSE_SCOREBOOK_RETURN',
        },
    },

    // KHỐI: BẢO VỆ & HOÀN TẤT
    'my-grades': {
        key: 'my-grades',
        workspace: 'student',
        route: '/student/grades',
        menu: {
            label: 'Kết quả & điểm đồ án',
            icon: 'workspace_premium',
            group: 'Bảo vệ & hoàn tất',
            order: 1,
            requiredPermission: 'VIEW_MY_GRADES',
        },
        viewAnyOf: ['VIEW_MY_GRADES'],
        actions: {},
    },
    'my-archive': {
        key: 'my-archive',
        workspace: 'student',
        route: '/student/submissions?tab=archive',
        menu: {
            label: 'Nộp hồ sơ lưu chiểu',
            icon: 'inventory_2',
            group: 'Bảo vệ & hoàn tất',
            order: 2,
            requiredPermission: 'VIEW_MY_ARCHIVE',
        },
        viewAnyOf: ['VIEW_MY_ARCHIVE', 'SUBMIT_PRE_DEFENSE_ARCHIVE', 'SUBMIT_FINAL_ARCHIVE'],
        actions: {
            submitPreDefense: 'SUBMIT_PRE_DEFENSE_ARCHIVE',
            submitFinal: 'SUBMIT_FINAL_ARCHIVE',
        },
    },

    // KHỐI: KẾT QUẢ & BÁO CÁO
    'defense-result-approvals': {
        key: 'defense-result-approvals',
        workspace: 'admin',
        route: '/admin/grading?tab=approvals',
        menu: {
            label: 'Phê duyệt kết quả',
            icon: 'approval',
            group: 'Kết quả & báo cáo',
            order: 1,
            requiredPermission: 'VIEW_DEFENSE_RESULT_APPROVALS',
        },
        viewAnyOf: ['VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL', 'DEFENSE_RESULT_APPROVE'],
        actions: {
            approve: 'DEFENSE_RESULT_APPROVE',
        },
    },
    'result-publications': {
        key: 'result-publications',
        workspace: 'admin',
        route: '/admin/grading?tab=publish',
        menu: {
            label: 'Công bố kết quả học kỳ',
            icon: 'campaign',
            group: 'Kết quả & báo cáo',
            order: 2,
            requiredPermission: 'VIEW_RESULT_PUBLICATIONS',
        },
        viewAnyOf: ['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH'],
        actions: {
            publish: 'RESULT_PUBLICATION_PUBLISH',
        },
    },
    'rubric-config': {
        key: 'rubric-config',
        workspace: 'admin',
        route: '/admin/rubric-management',
        menu: {
            label: 'Tiêu chí chấm điểm',
            icon: 'rule',
            group: 'Kết quả & báo cáo',
            order: 3,
            requiredPermission: 'VIEW_RUBRIC_CONFIG',
        },
        viewAnyOf: ['VIEW_RUBRIC_CONFIG', 'RUBRIC_MANAGE'],
        actions: {
            manage: 'RUBRIC_MANAGE',
            lock: 'RUBRIC_LOCK',
        },
    },
    'academic-reports': {
        key: 'academic-reports',
        workspace: 'admin',
        route: '/admin/reports',
        menu: {
            label: 'Báo cáo học vụ',
            icon: 'bar_chart',
            group: 'Kết quả & báo cáo',
            order: 4,
            requiredPermission: 'REPORT_VIEW',
        },
        viewAnyOf: ['REPORT_VIEW'],
        actions: {
            export: 'REPORT_VIEW',
        },
    },

    // KHỐI: NỘI DUNG & HỆ THỐNG
    'announcements': {
        key: 'announcements',
        workspace: 'admin',
        route: '/admin/announcements',
        menu: {
            label: 'Bản tin công khai',
            icon: 'feed',
            group: 'Nội dung & hệ thống',
            order: 1,
            requiredPermission: 'VIEW_ANNOUNCEMENTS',
        },
        viewAnyOf: ['VIEW_ANNOUNCEMENTS', 'PUBLIC_ANNOUNCEMENT_MANAGE'],
        actions: {
            create: 'PUBLIC_ANNOUNCEMENT_MANAGE',
            edit: 'PUBLIC_ANNOUNCEMENT_MANAGE',
            delete: 'PUBLIC_ANNOUNCEMENT_MANAGE',
        },
    },
    'portal-content': {
        key: 'portal-content',
        workspace: 'admin',
        route: '/admin/portal',
        menu: {
            label: 'Biểu mẫu & nội dung',
            icon: 'file_copy',
            group: 'Nội dung & hệ thống',
            order: 2,
            requiredPermission: 'VIEW_PORTAL_CONTENT',
        },
        viewAnyOf: ['VIEW_PORTAL_CONTENT', 'PORTAL_CONTENT_MANAGE'],
        actions: {
            manage: 'PORTAL_CONTENT_MANAGE',
        },
    },
    'notifications': {
        key: 'notifications',
        workspace: 'admin',
        route: '/admin/notifications',
        menu: {
            label: 'Thông báo tài khoản',
            icon: 'notifications_active',
            group: 'Nội dung & hệ thống',
            order: 3,
            requiredPermission: 'VIEW_NOTIFICATIONS',
        },
        viewAnyOf: ['VIEW_NOTIFICATIONS', 'NOTIFICATION_MANAGE'],
        actions: {
            send: 'NOTIFICATION_MANAGE',
        },
    },
    'users': {
        key: 'users',
        workspace: 'admin',
        route: '/admin/users',
        menu: {
            label: 'Người dùng',
            icon: 'group',
            group: 'Nội dung & hệ thống',
            order: 4,
            requiredPermission: 'VIEW_USERS',
        },
        viewAnyOf: ['VIEW_USERS', 'USER_MANAGE', 'PERMISSION_GROUP_MANAGE'],
        actions: {
            create: 'USER_MANAGE',
            edit: 'USER_MANAGE',
            delete: 'USER_MANAGE',
            import: 'USER_IMPORT',
        },
    },
    'permissions': {
        key: 'permissions',
        workspace: 'admin',
        route: '/admin/permissions',
        menu: {
            label: 'Phân quyền',
            icon: 'shield_lock',
            group: 'Nội dung & hệ thống',
            order: 5,
            requiredPermission: 'VIEW_PERMISSIONS',
        },
        viewAnyOf: ['VIEW_PERMISSIONS', 'VIEW_PERMISSION_GROUPS', 'PERMISSION_GROUP_MANAGE', 'PERMISSION_ASSIGN_ACADEMIC'],
        actions: {
            manageGroups: 'PERMISSION_GROUP_MANAGE',
            assignAcademic: 'PERMISSION_ASSIGN_ACADEMIC',
        },
    },

    // KHỐI: ĐIỀU HÀNH VIỆN
    'lecturer-institute': {
        key: 'lecturer-institute',
        workspace: 'lecturer',
        route: '/lecturer/institute',
        menu: {
            label: 'Điều hành học vụ',
            icon: 'account_balance',
            group: 'Điều hành viện',
            order: 1,
            requiredPermission: 'VIEW_BM02_REVIEWS',
        },
        viewAnyOf: [
            'VIEW_BM02_REVIEWS',
            'BM02_REVIEW',
            'BM03_STOP_REVIEW',
            'BM04_REVIEW',
            'BM04_REJECTION_REVIEW',
            'SIGNATURE_APPEAL_REVIEW',
            'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
            'VIEW_ASSIGNMENT_DECISIONS',
            'PROJECT_ASSIGNMENT_PUBLISH',
            'TOPIC_ASSIGNMENT_DECISION_ISSUE',
            'BM02A_FINAL_APPROVE',
            'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
            'VIEW_CLEARANCE_CERTIFICATES',
            'CLEARANCE_CERTIFICATE_SIGN',
            'VIEW_DEFENSE_RESULTS_APPROVAL',
            'VIEW_DEFENSE_RESULT_APPROVALS',
            'DEFENSE_RESULT_APPROVE',
            'VIEW_DEFENSE_ASSIGNMENTS',
            'VIEW_RESULT_PUBLICATIONS',
            'RESULT_PUBLICATION_PUBLISH',
            'VIEW_ACADEMIC_DELEGATIONS',
            'ACADEMIC_DELEGATION_MANAGE',
        ],
        actions: {
            publishAssignment: 'PROJECT_ASSIGNMENT_PUBLISH',
        },
    },

    // CÁC FEATURE ROUTE ĐỘC LẬP / WORKSPACE KHÔNG HIỂN THỊ MENU
    'lecturer-grading-sheet': {
        key: 'lecturer-grading-sheet',
        workspace: 'lecturer',
        route: '/lecturer/grading/sheet/:registrationId',
        menu: null,
        viewAnyOf: ['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW', 'DEFENSE_SCORE_SUBMIT'],
        actions: {
            submitScore: 'DEFENSE_SCORE_SUBMIT',
        },
    },
    'admin-dashboard': {
        key: 'admin-dashboard',
        workspace: 'admin',
        route: '/admin/dashboard',
        menu: null,
        viewAnyOf: [],
        actions: {},
    },
    'lecturer-dashboard': {
        key: 'lecturer-dashboard',
        workspace: 'lecturer',
        route: '/lecturer/dashboard',
        menu: null,
        viewAnyOf: [],
        actions: {},
    },
    'student-dashboard': {
        key: 'student-dashboard',
        workspace: 'student',
        route: '/student/dashboard',
        menu: null,
        viewAnyOf: [],
        actions: {},
    },
});

export const FEATURE_POLICY_LIST = Object.freeze(Object.values(FEATURE_POLICIES));
