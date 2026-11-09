/**
 * Navigation Registry Cố Định 27 Mục & 7 Khối Nghiệp Vụ
 * Tuân thủ chuẩn 2-Tier Capability Matrix (Section 5.1 & Section 7.1 của Technical Spec).
 * 
 * Mỗi mục menu tương ứng duy nhất 1 quyền xem (VIEW_*).
 * Client lọc menu theo effectivePermissions mà không rẽ nhánh role cứng.
 */

export const NAVIGATION_GROUPS = [
    'Hồ sơ của tôi',
    'Hướng dẫn & tiến độ',
    'Thẩm định & quyết định',
    'Hội đồng & bảo vệ',
    'Kết quả & công bố',
    'Quản trị học vụ',
    'Quản trị hệ thống',
];

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
        route: '/student/submissions',
    },
    {
        key: 'my-archive',
        label: 'Lưu chiểu số',
        icon: 'inventory_2',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_ARCHIVE',
        route: '/student/submissions?tab=archive',
    },
    {
        key: 'my-grades',
        label: 'Điểm đồ án của tôi',
        icon: 'workspace_premium',
        group: 'Hồ sơ của tôi',
        requiredPermission: 'VIEW_MY_GRADES',
        route: '/student/grades',
    },

    // KHỐI 2: HƯỚNG DẪN & TIẾN ĐỘ (3 mục)
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
        label: 'Checkpoint tiến độ',
        icon: 'fact_check',
        group: 'Hướng dẫn & tiến độ',
        requiredPermission: 'VIEW_CHECKPOINTS',
        route: '/lecturer/progress',
    },
    {
        key: 'bm04-evaluations',
        label: 'Đánh giá BM04',
        icon: 'assignment_turned_in',
        group: 'Hướng dẫn & tiến độ',
        requiredPermission: 'VIEW_BM04_EVALUATIONS',
        route: '/lecturer/progress?tab=bm04',
    },

    // KHỐI 3: THẨM ĐỊNH & QUYẾT ĐỊNH (4 mục)
    {
        key: 'outline-reviews',
        label: 'Thẩm định BM01',
        icon: 'rate_review',
        group: 'Thẩm định & quyết định',
        requiredPermission: 'VIEW_OUTLINE_REVIEWS',
        route: '/lecturer/approvals?tab=bm01',
    },
    {
        key: 'bm02-reviews',
        label: 'Duyệt đơn BM02',
        icon: 'verified',
        group: 'Thẩm định & quyết định',
        requiredPermission: 'VIEW_BM02_REVIEWS',
        route: '/lecturer/institute?tab=bm02',
    },
    {
        key: 'assignment-decisions',
        label: 'Quyết định giao đề tài',
        icon: 'gavel',
        group: 'Thẩm định & quyết định',
        requiredPermission: 'VIEW_ASSIGNMENT_DECISIONS',
        route: '/lecturer/institute?tab=decisions',
    },
    {
        key: 'academic-delegations',
        label: 'Ủy quyền chuyên môn',
        icon: 'assignment_ind',
        group: 'Thẩm định & quyết định',
        requiredPermission: 'VIEW_ACADEMIC_DELEGATIONS',
        route: '/lecturer/institute?tab=delegations',
    },

    // KHỐI 4: HỘI ĐỒNG & BẢO VỆ (3 mục)
    {
        key: 'council-assignments',
        label: 'Phân công Hội đồng',
        icon: 'groups',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'VIEW_COUNCIL_ASSIGNMENTS',
        route: '/admin/councils',
    },
    {
        key: 'defense-grading',
        label: 'Phiếu chấm bảo vệ',
        icon: 'edit_note',
        group: 'Hội đồng & bảo vệ',
        requiredPermission: 'VIEW_DEFENSE_GRADING',
        route: '/lecturer/grading',
    },
    {
        key: 'defense-lock',
        label: 'Trung tâm chấm & Khóa sổ',
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
        route: '/admin/grading?tab=approvals',
    },
    {
        key: 'result-publications',
        label: 'Công bố kết quả',
        icon: 'campaign',
        group: 'Kết quả & công bố',
        requiredPermission: 'VIEW_RESULT_PUBLICATIONS',
        route: '/admin/grading?tab=publish',
    },
    {
        key: 'rubric-config',
        label: 'Tiêu chí chấm (Rubric)',
        icon: 'rule',
        group: 'Kết quả & công bố',
        requiredPermission: 'VIEW_RUBRIC_CONFIG',
        route: '/admin/rubric-management',
    },

    // KHỐI 6: QUẢN TRỊ HỌC VỤ (4 mục)
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
        label: 'Gán môn đồ án (Enrollment)',
        icon: 'playlist_add_check',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_ENROLLMENTS',
        route: '/admin/project-enrollments',
    },
    {
        key: 'all-topics',
        label: 'Quản lý đề tài chung',
        icon: 'list_alt',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_ALL_TOPICS',
        route: '/admin/topics',
    },
    {
        key: 'project-oversight',
        label: 'Giám sát tiến độ & rà soát',
        icon: 'policy',
        group: 'Quản trị học vụ',
        requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
        route: '/admin/oversight',
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
        label: 'Phân quyền kỹ thuật & Nhóm',
        icon: 'shield_lock',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_PERMISSIONS',
        route: '/admin/permissions',
    },
    {
        key: 'announcements',
        label: 'Bản tin Portal',
        icon: 'feed',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_ANNOUNCEMENTS',
        route: '/admin/announcements',
    },
    {
        key: 'portal-content',
        label: 'Biểu mẫu & CMS Portal',
        icon: 'file_copy',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_PORTAL_CONTENT',
        route: '/admin/portal',
    },
    {
        key: 'notifications',
        label: 'Gửi thông báo người dùng',
        icon: 'notifications_active',
        group: 'Quản trị hệ thống',
        requiredPermission: 'VIEW_NOTIFICATIONS',
        route: '/admin/notifications',
    },
];

/**
 * Lọc danh sách menu khả dụng dựa trên tập quyền (permissions) của người dùng.
 * Gom các mục thỏa mãn quyền xem theo thứ tự NAVIGATION_GROUPS và loại trừ nhóm rỗng.
 *
 * @param {Array<string> | Set<string> | { permissions: Array<string> | Set<string> }} permissionsInput
 * @returns {Array<{ group: string, title: string, items: Array<object> }>}
 */
export function getVisibleNavigation(permissionsInput) {
    let permSet;
    if (permissionsInput instanceof Set) {
        permSet = permissionsInput;
    } else if (Array.isArray(permissionsInput)) {
        permSet = new Set(permissionsInput);
    } else if (permissionsInput && Array.isArray(permissionsInput.permissions)) {
        permSet = new Set(permissionsInput.permissions);
    } else if (permissionsInput && permissionsInput.permissions instanceof Set) {
        permSet = permissionsInput.permissions;
    } else {
        permSet = new Set();
    }

    const visibleItems = NAVIGATION_REGISTRY.filter((item) => {
        if (!item.requiredPermission) return true;
        return permSet.has(item.requiredPermission);
    });

    const groups = [];
    for (const groupName of NAVIGATION_GROUPS) {
        const items = visibleItems.filter((item) => item.group === groupName);
        if (items.length > 0) {
            groups.push({
                group: groupName,
                title: groupName,
                items,
            });
        }
    }

    return groups;
}
