/**
 * Cấu hình chuẩn hóa Quyền hạn, Bảo vệ Học thuật & Phân loại Ma trận RBAC
 * Đồng bộ tuyệt đối với backend/src/constants/permissions.js và backend/src/auth/permissionCatalog.js
 */

export const PERMISSION_DEFINITIONS = Object.freeze([
    {
        "code": "PORTAL_CONTENT_MANAGE",
        "label": "Quản trị nội dung & biểu mẫu Portal",
        "module": "PORTAL",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "PUBLIC_ANNOUNCEMENT_MANAGE",
        "label": "Quản lý bản tin & thông báo Portal",
        "module": "ANNOUNCEMENT",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "LECTURER_DIRECTORY_VIEW",
        "label": "Xem danh bạ & danh sách giảng viên",
        "module": "LECTURER",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT"
        ]
    },
    {
        "code": "MENTOR_REQUEST_REVIEW",
        "label": "Xét duyệt nguyện vọng chọn GVHD",
        "module": "MENTOR",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "MENTOR_ASSIGN",
        "label": "Phân công giảng viên hướng dẫn",
        "module": "MENTOR",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "MENTOR_ASSIGNMENT_ADJUST",
        "label": "Điều chỉnh phân công GVHD",
        "module": "MENTOR",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "TOPIC_CREATE",
        "label": "Tạo đề tài nghiên cứu mới",
        "module": "TOPIC",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "TOPIC_UPDATE_OWN",
        "label": "Cập nhật đề tài phụ trách",
        "module": "TOPIC",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "TOPIC_REVIEW",
        "label": "Xét duyệt chuyên môn đề tài",
        "module": "TOPIC",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "OUTLINE_REVIEW",
        "label": "Xem & góp ý đề cương BM01",
        "module": "OUTLINE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "OUTLINE_APPROVE",
        "label": "Phê duyệt đề cương BM01",
        "module": "OUTLINE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "OUTLINE_COUNCIL_MANAGE",
        "label": "Thành lập Hội đồng thẩm định BM01",
        "module": "OUTLINE",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "BM02_REVIEW",
        "label": "Thẩm định đơn đăng ký đề tài BM02",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "PROJECT_ASSIGNMENT_PUBLISH",
        "label": "Ban hành Quyết định giao đề tài",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "BM02A_ADVISOR_SIGN",
        "label": "Ký xác nhận đơn điều chỉnh tên đề tài BM02-A (GVHD)",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM02A_FINAL_APPROVE",
        "label": "Phê duyệt đơn điều chỉnh tên đề tài BM02-A (Bộ môn)",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "TITLE_ADJUSTMENT_APPENDIX_ISSUE",
        "label": "Ban hành Phụ lục điều chỉnh tên đề tài",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "DECISION_AMENDMENT_SIGN",
        "label": "Ký quyết định điều chỉnh đề tài",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "BM03_SUBMIT",
        "label": "Ghi nhật ký trao đổi & nhiệm vụ BM03",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM03_REVIEW",
        "label": "Theo dõi & giám sát tiến độ BM03",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "BM03_MEETING_RECORD",
        "label": "Ghi & ký nhật ký hướng dẫn BM03",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM03_STAGE_EVALUATE",
        "label": "Đánh giá giai đoạn BM03",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM03_STOP_REVIEW",
        "label": "Thẩm định đề nghị dừng đề tài BM03",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "BM03_CHECKPOINT_DECIDE",
        "label": "Đánh giá checkpoint tiến độ",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "CHECKPOINT_ISSUE",
        "label": "Khởi tạo đánh giá checkpoint tiến độ",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "SIGNATURE_APPEAL_REVIEW",
        "label": "Xét duyệt khiếu nại chữ ký checkpoint",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "BM04_SUBMIT",
        "label": "Lập phiếu nhận xét BM04 (GVHD)",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM04_CREATE_AND_SIGN",
        "label": "Lập & ký phiếu nhận xét BM04",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "BM04_REVIEW",
        "label": "Xem phiếu nhận xét BM04",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "BM04_REJECTION_REVIEW",
        "label": "Thẩm định đề nghị không cho bảo vệ BM04",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "DEFENSE_COUNCIL_MANAGE",
        "label": "Thành lập Hội đồng chấm bảo vệ",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "DEFENSE_SCORE_SUBMIT",
        "label": "Nhập phiếu chấm điểm bảo vệ (HĐ)",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "DEFENSE_SCORE_VIEW",
        "label": "Xem tổng hợp điểm hội đồng bảo vệ",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "RESULT_LOCK",
        "label": "Khóa bảng điểm & biên bản hội đồng",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "DEFENSE_RESULT_APPROVE",
        "label": "Phê duyệt kết quả bảo vệ",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "RESULT_PUBLISH",
        "label": "Công bố bảng điểm & kết quả bảo vệ",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "RESULT_PUBLICATION_PUBLISH",
        "label": "Ban hành công bố kết quả bảo vệ",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "RUBRIC_MANAGE",
        "label": "Quản trị tiêu chí chấm điểm (Rubric)",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "RUBRIC_LOCK",
        "label": "Khóa bất biến bảng tiêu chí Rubric đợt bảo vệ",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "DEFENSE_SCHEDULE_PUBLISH",
        "label": "Công bố lịch bảo vệ đồ án hội đồng",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "DEFENSE_MEMBER_REPLACE",
        "label": "Thay thế thành viên chấm điểm hội đồng",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "DEFENSE_SCOREBOOK_RETURN",
        "label": "Trả sổ điểm hội đồng trước công bố",
        "module": "DEFENSE",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "FINAL_DOCUMENT_REVIEW",
        "label": "Thẩm định & xác nhận lưu chiểu",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "ARCHIVE_MENTOR_REVIEW",
        "label": "Duyệt nội dung chuyên môn hồ sơ lưu chiểu (GVHD)",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "ARCHIVE_ACADEMIC_AFFAIRS_REVIEW",
        "label": "Duyệt thủ tục hồ sơ lưu chiểu (Giáo vụ)",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "CLEARANCE_CERTIFICATE_SIGN",
        "label": "Ký số Giấy xác nhận hoàn thành đồ án (Viện trưởng)",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "REPORT_VIEW",
        "label": "Xem báo cáo & thống kê học vụ",
        "module": "REPORT",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT"
        ]
    },
    {
        "code": "USER_MANAGE",
        "label": "Quản lý danh sách người dùng",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "USER_IMPORT",
        "label": "Import tài khoản từ file Excel",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "PERMISSION_GROUP_MANAGE",
        "label": "Quản lý nhóm quyền & phân quyền",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "SEMESTER_MANAGE",
        "label": "Quản lý đợt đồ án & học kỳ",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "PROJECT_CATALOG_MANAGE",
        "label": "Quản lý danh mục môn đồ án",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT"
        ]
    },
    {
        "code": "ENROLLMENT_MANAGE",
        "label": "Quản lý gán môn sinh viên (Enrollment)",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "NOTIFICATION_MANAGE",
        "label": "Gửi thông báo & nhắc nhở người dùng",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "PROJECT_OVERSIGHT_MANAGE",
        "label": "Giám sát tiến độ & rà soát hồ sơ",
        "module": "ADMIN",
        "kind": "ACTION",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "PERMISSION_ASSIGN_ACADEMIC",
        "label": "Ủy quyền chuyên môn học thuật",
        "module": "DELEGATION",
        "kind": "ACTION",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT",
            "SEMESTER"
        ]
    },
    {
        "code": "REGISTER_TOPIC",
        "label": "Đăng ký đề tài đồ án",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "RENAME_TOPIC",
        "label": "Yêu cầu đổi tên đề tài",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "REGISTRATION_CANCEL",
        "label": "Hủy nguyện vọng đăng ký đề tài",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SUBMIT_BM01",
        "label": "Nộp đề cương BM01",
        "module": "OUTLINE",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SUBMIT_BM02",
        "label": "Nộp đơn đăng ký BM02",
        "module": "REGISTRATION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SUBMIT_TASK",
        "label": "Nộp báo cáo nhiệm vụ & tiến độ",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "CHECKPOINT_SIGN",
        "label": "Ký xác nhận biên bản checkpoint tiến độ",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SIGNATURE_APPEAL_SUBMIT",
        "label": "Gửi khiếu nại chữ ký checkpoint",
        "module": "PROGRESS",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SUBMIT_PRE_DEFENSE_ARCHIVE",
        "label": "Nộp hồ sơ duyệt trước bảo vệ",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "SUBMIT_FINAL_ARCHIVE",
        "label": "Nộp hồ sơ lưu chiểu số chính thức",
        "module": "REVISION",
        "kind": "ACTION",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_MY_REGISTRATION",
        "label": "Xem thông tin đề tài đăng ký của tôi",
        "module": "STUDENT",
        "kind": "VIEW",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_MY_SUBMISSIONS",
        "label": "Xem danh sách hồ sơ & nộp bài của tôi",
        "module": "STUDENT",
        "kind": "VIEW",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_MY_ARCHIVE",
        "label": "Xem hồ sơ lưu chiểu số của tôi",
        "module": "STUDENT",
        "kind": "VIEW",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_MY_GRADES",
        "label": "Xem điểm đồ án & kết quả của tôi",
        "module": "STUDENT",
        "kind": "VIEW",
        "protectedDomain": "STUDENT_BASE",
        "eligibleRoles": [
            "STUDENT"
        ],
        "scopeTypes": [
            "RESOURCE",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_MY_TOPICS",
        "label": "Xem danh sách đề tài phụ trách",
        "module": "LECTURER",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_MENTOR_STUDENTS",
        "label": "Xem danh sách sinh viên hướng dẫn",
        "module": "MENTOR",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_CHECKPOINTS",
        "label": "Xem checkpoint tiến độ",
        "module": "PROGRESS",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_BM04_EVALUATIONS",
        "label": "Xem đánh giá BM04",
        "module": "PROGRESS",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_TOPIC_REVIEWS",
        "label": "Xem danh sách thẩm định đề tài",
        "module": "TOPIC",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_OUTLINE_REVIEWS",
        "label": "Xem thẩm định đề cương BM01",
        "module": "OUTLINE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_BM02_REVIEWS",
        "label": "Xem duyệt đơn đăng ký BM02",
        "module": "REGISTRATION",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_TOPIC_ASSIGNMENT_DECISIONS",
        "label": "Xem quyết định giao đề tài",
        "module": "REGISTRATION",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_ACADEMIC_DELEGATIONS",
        "label": "Xem ủy quyền chuyên môn học thuật",
        "module": "DELEGATION",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT",
            "SEMESTER"
        ]
    },
    {
        "code": "VIEW_DEFENSE_ASSIGNMENTS",
        "label": "Xem phân công hội đồng bảo vệ",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_DEFENSE_GRADING",
        "label": "Xem phiếu chấm điểm bảo vệ",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "RESOURCE"
        ]
    },
    {
        "code": "VIEW_RESULT_LOCKS",
        "label": "Xem trung tâm chấm & khóa sổ điểm",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_DEFENSE_RESULTS_APPROVAL",
        "label": "Xem phê duyệt kết quả bảo vệ",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_RESULT_PUBLICATIONS",
        "label": "Xem công bố kết quả bảo vệ",
        "module": "DEFENSE",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_CLEARANCE_CERTIFICATES",
        "label": "Xem chứng nhận hoàn thành & lưu chiểu",
        "module": "REVISION",
        "kind": "VIEW",
        "protectedDomain": "ACADEMIC",
        "eligibleRoles": [
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_SEMESTERS",
        "label": "Xem danh sách học kỳ & đợt đồ án",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_PROJECT_PERIODS",
        "label": "Xem danh sách đợt đồ án & học kỳ",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_PROJECT_CATALOGS",
        "label": "Xem danh mục môn đồ án",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_PROJECT_ENROLLMENTS",
        "label": "Xem danh sách gán môn sinh viên",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_PROJECT_OVERSIGHT",
        "label": "Xem giám sát tiến độ & rà soát học vụ",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "SEMESTER",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_USERS",
        "label": "Xem danh sách người dùng",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL",
            "DEPARTMENT"
        ]
    },
    {
        "code": "VIEW_PERMISSION_GROUPS",
        "label": "Xem danh sách nhóm quyền",
        "module": "ADMIN",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    },
    {
        "code": "VIEW_PORTAL_CONTENT",
        "label": "Xem biểu mẫu & nội dung Portal",
        "module": "PORTAL",
        "kind": "VIEW",
        "protectedDomain": "TECHNICAL",
        "eligibleRoles": [
            "ADMIN",
            "LECTURER"
        ],
        "scopeTypes": [
            "GLOBAL"
        ]
    }
]);

export const ACADEMIC_PROTECTED_PERMISSIONS = Object.freeze([
    "TOPIC_CREATE",
    "TOPIC_UPDATE_OWN",
    "TOPIC_REVIEW",
    "VIEW_TOPIC_REVIEWS",
    "MENTOR_REQUEST_REVIEW",
    "MENTOR_ASSIGN",
    "MENTOR_ASSIGNMENT_ADJUST",
    "VIEW_MENTOR_STUDENTS",
    "VIEW_MENTORED_STUDENTS",
    "VIEW_MY_TOPICS",
    "OUTLINE_REVIEW",
    "OUTLINE_APPROVE",
    "VIEW_OUTLINE_REVIEWS",
    "BM02_REVIEW",
    "PROJECT_ASSIGNMENT_PUBLISH",
    "TOPIC_ASSIGNMENT_DECISION_ISSUE",
    "BM02A_ADVISOR_SIGN",
    "BM02A_FINAL_APPROVE",
    "TITLE_ADJUSTMENT_APPENDIX_ISSUE",
    "DECISION_AMENDMENT_SIGN",
    "VIEW_BM02_REVIEWS",
    "VIEW_TOPIC_ASSIGNMENT_DECISIONS",
    "VIEW_ASSIGNMENT_DECISIONS",
    "BM03_SUBMIT",
    "BM03_REVIEW",
    "BM03_MEETING_RECORD",
    "BM03_STAGE_EVALUATE",
    "BM03_STOP_REVIEW",
    "BM03_CHECKPOINT_DECIDE",
    "CHECKPOINT_ISSUE",
    "BM04_SUBMIT",
    "BM04_CREATE_AND_SIGN",
    "BM04_REVIEW",
    "BM04_REJECTION_REVIEW",
    "SIGNATURE_APPEAL_REVIEW",
    "VIEW_CHECKPOINTS",
    "VIEW_BM04_EVALUATIONS",
    "DEFENSE_SCORE_SUBMIT",
    "DEFENSE_SCORE_VIEW",
    "RESULT_LOCK",
    "DEFENSE_RESULT_APPROVE",
    "RESULT_PUBLISH",
    "RESULT_PUBLICATION_PUBLISH",
    "RUBRIC_LOCK",
    "DEFENSE_SCOREBOOK_RETURN",
    "VIEW_DEFENSE_GRADING",
    "VIEW_RESULT_LOCKS",
    "VIEW_DEFENSE_LOCK_LEDGER",
    "VIEW_DEFENSE_RESULTS_APPROVAL",
    "VIEW_DEFENSE_RESULT_APPROVALS",
    "VIEW_RESULT_PUBLICATIONS",
    "FINAL_DOCUMENT_REVIEW",
    "ARCHIVE_MENTOR_REVIEW",
    "ARCHIVE_ACADEMIC_AFFAIRS_REVIEW",
    "CLEARANCE_CERTIFICATE_SIGN",
    "VIEW_CLEARANCE_CERTIFICATES",
    "PERMISSION_ASSIGN_ACADEMIC",
    "VIEW_ACADEMIC_DELEGATIONS"
]);

export const TECHNICAL_PERMISSIONS = Object.freeze([
    "PORTAL_CONTENT_MANAGE",
    "VIEW_PORTAL_CONTENT",
    "PUBLIC_ANNOUNCEMENT_MANAGE",
    "VIEW_ANNOUNCEMENTS",
    "USER_MANAGE",
    "USER_IMPORT",
    "VIEW_USERS",
    "PERMISSION_GROUP_MANAGE",
    "VIEW_PERMISSION_GROUPS",
    "VIEW_PERMISSIONS",
    "SEMESTER_MANAGE",
    "VIEW_SEMESTERS",
    "VIEW_PROJECT_PERIODS",
    "PROJECT_CATALOG_MANAGE",
    "VIEW_PROJECT_CATALOGS",
    "ENROLLMENT_MANAGE",
    "VIEW_PROJECT_ENROLLMENTS",
    "NOTIFICATION_MANAGE",
    "VIEW_NOTIFICATIONS",
    "PROJECT_OVERSIGHT_MANAGE",
    "VIEW_PROJECT_OVERSIGHT",
    "REPORT_VIEW",
    "VIEW_ALL_TOPICS",
    "LECTURER_DIRECTORY_VIEW",
    "RUBRIC_MANAGE",
    "VIEW_RUBRIC_CONFIG",
    "OUTLINE_COUNCIL_MANAGE",
    "DEFENSE_COUNCIL_MANAGE",
    "DEFENSE_SCHEDULE_PUBLISH",
    "DEFENSE_MEMBER_REPLACE",
    "VIEW_COUNCIL_ASSIGNMENTS",
    "VIEW_DEFENSE_ASSIGNMENTS"
]);

export const CANONICAL_ALIAS_MAP = Object.freeze({
    "TOPIC_ASSIGNMENT_DECISION_ISSUE": "PROJECT_ASSIGNMENT_PUBLISH",
    "VIEW_MENTORED_STUDENTS": "VIEW_MENTOR_STUDENTS",
    "VIEW_ASSIGNMENT_DECISIONS": "VIEW_TOPIC_ASSIGNMENT_DECISIONS",
    "VIEW_COUNCIL_ASSIGNMENTS": "VIEW_DEFENSE_ASSIGNMENTS",
    "VIEW_DEFENSE_LOCK_LEDGER": "VIEW_RESULT_LOCKS",
    "VIEW_DEFENSE_RESULT_APPROVALS": "VIEW_DEFENSE_RESULTS_APPROVAL",
    "VIEW_RUBRIC_CONFIG": "RUBRIC_MANAGE",
    "VIEW_ALL_TOPICS": "TOPIC_REVIEW",
    "VIEW_PERMISSIONS": "VIEW_PERMISSION_GROUPS",
    "VIEW_ANNOUNCEMENTS": "PUBLIC_ANNOUNCEMENT_MANAGE",
    "VIEW_NOTIFICATIONS": "NOTIFICATION_MANAGE"
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

const DEFINITIONS_BY_CODE = new Map(
    PERMISSION_DEFINITIONS.map((def) => [def.code, def])
);

/**
 * Kiểm tra xem mã quyền có phải là mã canonical không
 */
export const isCanonicalPermissionCode = (code) => {
    if (!code || typeof code !== 'string') return false;
    return DEFINITIONS_BY_CODE.has(code);
};

/**
 * Chuẩn hóa mã quyền về canonical code.
 */
export const normalizePermissionCode = (code) => {
    if (!code || typeof code !== 'string') return null;
    if (DEFINITIONS_BY_CODE.has(code)) {
        return code;
    }
    const aliasTarget = CANONICAL_ALIAS_MAP[code];
    if (aliasTarget && DEFINITIONS_BY_CODE.has(aliasTarget)) {
        return aliasTarget;
    }
    return null;
};

/**
 * Lấy metadata definition của quyền
 */
export const getPermissionDefinition = (code) => {
    const canonical = normalizePermissionCode(code);
    if (!canonical) return undefined;
    return DEFINITIONS_BY_CODE.get(canonical);
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
export const isViewPermission = (code) => {
    if (typeof code !== 'string') return false;
    if (code.startsWith('VIEW_')) return true;
    const def = getPermissionDefinition(code);
    return def ? def.kind === 'VIEW' : false;
};

/**
 * Kiểm tra xem quyền có phải là quyền thao tác (Action capability) không
 */
export const isActionPermission = (code) => {
    if (typeof code !== 'string') return false;
    return !isViewPermission(code);
};

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

/**
 * Danh mục quyền nội tại cố định của sinh viên (không cấu hình qua ma trận RBAC)
 */
export const STUDENT_BASE_PERMISSIONS = Object.freeze([
    "VIEW_MY_REGISTRATION",
    "VIEW_MY_SUBMISSIONS",
    "VIEW_MY_ARCHIVE",
    "VIEW_MY_GRADES",
    "REGISTER_TOPIC",
    "RENAME_TOPIC",
    "REGISTRATION_CANCEL",
    "SUBMIT_BM01",
    "SUBMIT_BM02",
    "SUBMIT_TASK",
    "CHECKPOINT_SIGN",
    "SIGNATURE_APPEAL_SUBMIT",
    "SUBMIT_PRE_DEFENSE_ARCHIVE",
    "SUBMIT_FINAL_ARCHIVE"
]);

/**
 * Kiểm tra xem quyền có phải là quyền nội tại của sinh viên không
 */
export const isStudentPermission = (code) => STUDENT_BASE_PERMISSIONS.includes(code);
