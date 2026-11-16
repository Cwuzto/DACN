/**
 * Feature Policy Manifest
 * Danh mục canonical xác định chính sách phân quyền cho toàn bộ hệ thống:
 * - Route bảo vệ
 * - Menu điều hướng (Navigation)
 * - Quyền xem (viewAnyOf, viewAllOf)
 * - Quyền thao tác (actions)
 * - Điều kiện phân công vai trò phụ / hội đồng (assignment)
 */

export const NAVIGATION_GROUPS = Object.freeze([
    'Hồ sơ của tôi',
    'Hướng dẫn & tiến độ',
    'Thẩm định & quyết định',
    'Hội đồng & bảo vệ',
    'Kết quả & công bố',
    'Quản trị học vụ',
    'Quản trị hệ thống',
]);

export const FEATURE_POLICIES = Object.freeze({
    // KHỐI 1: HỒ SƠ CỦA TÔI
    'my-registration': {
        key: 'my-registration',
        workspace: 'student',
        route: '/student/topics',
        menu: {
            label: 'Đề tài đăng ký',
            icon: 'folder_open',
            group: 'Hồ sơ của tôi',
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
            group: 'Hồ sơ của tôi',
            requiredPermission: 'VIEW_MY_TOPICS',
        },
        viewAnyOf: ['VIEW_MY_TOPICS', 'TOPIC_CREATE', 'TOPIC_UPDATE_OWN'],
        actions: {
            create: 'TOPIC_CREATE',
            update: 'TOPIC_UPDATE_OWN',
        },
    },
    'my-submissions': {
        key: 'my-submissions',
        workspace: 'student',
        route: '/student/submissions',
        menu: {
            label: 'Hồ sơ & Nộp bài',
            icon: 'cloud_upload',
            group: 'Hồ sơ của tôi',
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
    'my-archive': {
        key: 'my-archive',
        workspace: 'student',
        route: '/student/submissions?tab=archive',
        menu: {
            label: 'Hồ sơ lưu chiểu',
            icon: 'inventory_2',
            group: 'Hồ sơ của tôi',
            requiredPermission: 'VIEW_MY_ARCHIVE',
        },
        viewAnyOf: ['VIEW_MY_ARCHIVE', 'SUBMIT_PRE_DEFENSE_ARCHIVE', 'SUBMIT_FINAL_ARCHIVE'],
        actions: {
            submitPreDefense: 'SUBMIT_PRE_DEFENSE_ARCHIVE',
            submitFinal: 'SUBMIT_FINAL_ARCHIVE',
        },
    },
    'my-grades': {
        key: 'my-grades',
        workspace: 'student',
        route: '/student/grades',
        menu: {
            label: 'Kết quả & Điểm đồ án',
            icon: 'workspace_premium',
            group: 'Hồ sơ của tôi',
            requiredPermission: 'VIEW_MY_GRADES',
        },
        viewAnyOf: ['VIEW_MY_GRADES'],
        actions: {},
    },

    // KHỐI 2: HƯỚNG DẪN & TIẾN ĐỘ
    'mentored-students': {
        key: 'mentored-students',
        workspace: 'lecturer',
        route: '/lecturer/approvals',
        menu: {
            label: 'Sinh viên hướng dẫn',
            icon: 'school',
            group: 'Hướng dẫn & tiến độ',
            requiredPermission: 'VIEW_MENTORED_STUDENTS',
        },
        viewAnyOf: ['VIEW_MENTORED_STUDENTS', 'VIEW_MENTOR_STUDENTS', 'MENTOR_REQUEST_REVIEW'],
        actions: {
            reviewMentorRequest: 'MENTOR_REQUEST_REVIEW',
        },
    },
    'progress-checkpoints': {
        key: 'progress-checkpoints',
        workspace: 'lecturer',
        route: '/lecturer/progress',
        menu: {
            label: 'Theo dõi tiến độ',
            icon: 'fact_check',
            group: 'Hướng dẫn & tiến độ',
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

    // KHỐI 3: THẨM ĐỊNH & QUYẾT ĐỊNH
    'outline-reviews': {
        key: 'outline-reviews',
        workspace: 'lecturer',
        route: '/lecturer/approvals?tab=bm01',
        menu: {
            label: 'Thẩm định đề cương',
            icon: 'rate_review',
            group: 'Thẩm định & quyết định',
            requiredPermission: 'VIEW_OUTLINE_REVIEWS',
        },
        viewAnyOf: ['VIEW_OUTLINE_REVIEWS', 'OUTLINE_REVIEW', 'OUTLINE_APPROVE'],
        assignment: 'outlineCouncil',
        actions: {
            review: 'OUTLINE_REVIEW',
            approve: 'OUTLINE_APPROVE',
        },
    },

    // KHỐI 4: HỘI ĐỒNG & BẢO VỆ
    'outline-councils': {
        key: 'outline-councils',
        workspace: 'admin',
        route: '/admin/outline-councils',
        menu: {
            label: 'HĐ Xét duyệt Đề cương',
            icon: 'fact_check',
            group: 'Hội đồng & bảo vệ',
            requiredPermission: 'OUTLINE_COUNCIL_MANAGE',
        },
        viewAnyOf: ['OUTLINE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS', 'VIEW_DEFENSE_ASSIGNMENTS'],
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
            label: 'HĐ Bảo vệ khóa luận',
            icon: 'groups',
            group: 'Hội đồng & bảo vệ',
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
            label: 'Tổng hợp & Khóa điểm',
            icon: 'lock',
            group: 'Hội đồng & bảo vệ',
            requiredPermission: 'VIEW_DEFENSE_LOCK_LEDGER',
        },
        viewAnyOf: ['VIEW_DEFENSE_LOCK_LEDGER', 'VIEW_RESULT_LOCKS', 'RESULT_LOCK'],
        actions: {
            lock: 'RESULT_LOCK',
            returnScorebook: 'DEFENSE_SCOREBOOK_RETURN',
        },
    },

    // KHỐI 5: KẾT QUẢ & CÔNG BỐ
    'defense-result-approvals': {
        key: 'defense-result-approvals',
        workspace: 'admin',
        route: '/admin/grading?tab=approvals',
        menu: {
            label: 'Phê duyệt kết quả',
            icon: 'approval',
            group: 'Kết quả & công bố',
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
            label: 'Công bố kết quả',
            icon: 'campaign',
            group: 'Kết quả & công bố',
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
            group: 'Kết quả & công bố',
            requiredPermission: 'VIEW_RUBRIC_CONFIG',
        },
        viewAnyOf: ['VIEW_RUBRIC_CONFIG', 'RUBRIC_MANAGE'],
        actions: {
            manage: 'RUBRIC_MANAGE',
            lock: 'RUBRIC_LOCK',
        },
    },

    // KHỐI 6: QUẢN TRỊ HỌC VỤ
    'project-periods': {
        key: 'project-periods',
        workspace: 'admin',
        route: '/admin/project-periods',
        menu: {
            label: 'Đợt đồ án & Học kỳ',
            icon: 'calendar_month',
            group: 'Quản trị học vụ',
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
            label: 'Điều phối & Gán sinh viên',
            icon: 'playlist_add_check',
            group: 'Quản trị học vụ',
            requiredPermission: 'VIEW_PROJECT_ENROLLMENTS',
        },
        viewAnyOf: [
            'VIEW_PROJECT_ENROLLMENTS',
            'VIEW_PROJECT_CATALOGS',
            'ENROLLMENT_MANAGE',
            'MENTOR_ASSIGN',
            'PERMISSION_ASSIGN_ACADEMIC',
            'PROJECT_CATALOG_MANAGE',
        ],
        actions: {
            assignMentor: 'MENTOR_ASSIGN',
            adjustMentor: 'MENTOR_ASSIGNMENT_ADJUST',
            manageEnrollment: 'ENROLLMENT_MANAGE',
            assignAcademic: 'PERMISSION_ASSIGN_ACADEMIC',
        },
    },
    'all-topics': {
        key: 'all-topics',
        workspace: 'admin',
        route: '/admin/topics',
        menu: {
            label: 'Danh mục đề tài đồ án',
            icon: 'list_alt',
            group: 'Quản trị học vụ',
            requiredPermission: 'VIEW_ALL_TOPICS',
        },
        viewAnyOf: ['VIEW_ALL_TOPICS', 'VIEW_TOPIC_REVIEWS', 'TOPIC_REVIEW'],
        actions: {
            review: 'TOPIC_REVIEW',
        },
    },
    'project-oversight': {
        key: 'project-oversight',
        workspace: 'admin',
        route: '/admin/oversight',
        menu: {
            label: 'Theo dõi & Giám sát tiến độ',
            icon: 'policy',
            group: 'Quản trị học vụ',
            requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        },
        viewAnyOf: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        actions: {
            manage: 'PROJECT_OVERSIGHT_MANAGE',
        },
    },
    'academic-reports': {
        key: 'academic-reports',
        workspace: 'admin',
        route: '/admin/reports',
        menu: {
            label: 'Báo cáo & Thống kê',
            icon: 'bar_chart',
            group: 'Quản trị học vụ',
            requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        },
        viewAnyOf: ['REPORT_VIEW', 'VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        actions: {
            export: 'REPORT_VIEW',
        },
    },

    // KHỐI 7: QUẢN TRỊ HỆ THỐNG
    'users': {
        key: 'users',
        workspace: 'admin',
        route: '/admin/users',
        menu: {
            label: 'Quản lý người dùng',
            icon: 'group',
            group: 'Quản trị hệ thống',
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
            label: 'Phân quyền & Nhóm quyền',
            icon: 'shield_lock',
            group: 'Quản trị hệ thống',
            requiredPermission: 'VIEW_PERMISSIONS',
        },
        viewAnyOf: ['VIEW_PERMISSIONS', 'VIEW_PERMISSION_GROUPS', 'PERMISSION_GROUP_MANAGE', 'PERMISSION_ASSIGN_ACADEMIC'],
        actions: {
            manageGroups: 'PERMISSION_GROUP_MANAGE',
            assignAcademic: 'PERMISSION_ASSIGN_ACADEMIC',
        },
    },
    'announcements': {
        key: 'announcements',
        workspace: 'admin',
        route: '/admin/announcements',
        menu: {
            label: 'Bản tin & Thông báo',
            icon: 'feed',
            group: 'Quản trị hệ thống',
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
            label: 'Quản lý nội dung & Biểu mẫu',
            icon: 'file_copy',
            group: 'Quản trị hệ thống',
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
            label: 'Gửi thông báo hệ thống',
            icon: 'notifications_active',
            group: 'Quản trị hệ thống',
            requiredPermission: 'VIEW_NOTIFICATIONS',
        },
        viewAnyOf: ['VIEW_NOTIFICATIONS', 'NOTIFICATION_MANAGE'],
        actions: {
            send: 'NOTIFICATION_MANAGE',
        },
    },

    // CÁC FEATURE ROUTE ĐỘC LẬP / WORKSPACE KHÔNG HIỂN THỊ MENU
    'lecturer-institute': {
        key: 'lecturer-institute',
        workspace: 'lecturer',
        route: '/lecturer/institute',
        menu: null,
        viewAnyOf: [
            'VIEW_BM02_REVIEWS',
            'VIEW_ASSIGNMENT_DECISIONS',
            'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
            'VIEW_ACADEMIC_DELEGATIONS',
            'PROJECT_ASSIGNMENT_PUBLISH',
        ],
        actions: {
            publishAssignment: 'PROJECT_ASSIGNMENT_PUBLISH',
        },
    },
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
