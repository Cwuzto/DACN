const DEFAULT_MAX_STUDENTS_PER_MENTOR = 10;

/**
 * Trạng thái hồ sơ sinh viên thực tế đang chiếm quota hướng dẫn của GVHD trong đợt đồ án.
 * Không bao gồm các trạng thái đã hủy/kết thúc như CANCELLED, REJECTED, WITHDRAWN, TERMINATED, FAILED, DROPPED.
 */
const ACTIVE_MENTOR_OCCUPANCY_STATUSES = [
    'ASSIGNED',
    'APPROVED',
    'IN_PROGRESS',
    'SUBMITTED',
    'REGISTERED',
    'BM01_SUBMITTED',
    'BM01_RESUBMITTED',
    'BM01_NEEDS_REVISION',
    'BM01_REVISION_SUBMITTED',
    'BM01_PASSED',
    'BM02_OPEN',
    'BM02_SUBMITTED',
    'BM02_RESUBMITTED',
    'BM02_NEEDS_REVISION',
    'BM02_REVISION_REQUIRED',
    'BM02_APPROVED',
    'BM02_EXCEPTION_REVIEW',
    'DECISION_ISSUED',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'STOP_REVIEW_PENDING',
    'PENDING_INSTITUTE_SIGNATURE',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'DEFENSE_READY',
    'DEFENSE_SCHEDULED',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENDED',
    'DEFENSE_PASSED',
    'PASSED',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'COMPLETED',
];

const ACTIVE_REGISTRATION_STATUSES = Array.from(new Set([
    'PENDING',
    ...ACTIVE_MENTOR_OCCUPANCY_STATUSES,
]));

const ACADEMIC_TITLE_LIMITS = {
    THAC_SI: DEFAULT_MAX_STUDENTS_PER_MENTOR,
    TIEN_SI: DEFAULT_MAX_STUDENTS_PER_MENTOR,
    PHO_GIAO_SU: DEFAULT_MAX_STUDENTS_PER_MENTOR,
};

const getMentorMaxSlots = (_academicTitle) => DEFAULT_MAX_STUDENTS_PER_MENTOR;

const getDbClient = (options) => {
    if (options?.db) return options.db;
    try {
        return require('../config/database');
    } catch (_err) {
        return null;
    }
};

/**
 * Đếm số lượng hồ sơ đồ án đang chiếm quota của GVHD trong đợt đồ án
 */
const countActiveOccupiedMentoredTopics = async (mentorId, semesterId, options = {}) => {
    const db = getDbClient(options);
    if (!db?.topicRegistration?.count) return 0;

    const statuses = options.includePending
        ? Array.from(new Set([...ACTIVE_MENTOR_OCCUPANCY_STATUSES, 'PENDING']))
        : ACTIVE_MENTOR_OCCUPANCY_STATUSES;

    const where = {
        topic: { mentorId: Number(mentorId) },
        status: { in: statuses },
    };

    if (semesterId) {
        where.semesterId = Number(semesterId);
        where.topic.semesterId = Number(semesterId);
    }

    return await db.topicRegistration.count({ where });
};

/**
 * Kiểm tra ràng buộc quota tối đa 10 sinh viên / GVHD / đợt đồ án.
 * Ném HTTP 400 kèm code MENTOR_CAPACITY_EXCEEDED nếu vượt quá 10 sinh viên.
 */
const assertMentorCapacity = async (mentorId, semesterId, options = {}) => {
    const increment = options.increment !== undefined ? options.increment : 1;
    const maxCapacity = options.maxCapacity !== undefined ? options.maxCapacity : DEFAULT_MAX_STUDENTS_PER_MENTOR;
    const currentCount = await countActiveOccupiedMentoredTopics(mentorId, semesterId, options);

    if (currentCount + increment > maxCapacity) {
        const message = maxCapacity < DEFAULT_MAX_STUDENTS_PER_MENTOR
            ? `Giảng viên đã đạt giới hạn chỉ tiêu hướng dẫn trong đợt này (${maxCapacity} sinh viên).`
            : 'Giảng viên đã đạt giới hạn tối đa 10 sinh viên hướng dẫn trong đợt';
        const error = new Error(message);
        error.statusCode = 400;
        error.status = 400;
        error.code = 'MENTOR_CAPACITY_EXCEEDED';
        throw error;
    }

    return {
        currentCount,
        maxCapacity,
        availableSlots: Math.max(0, maxCapacity - (currentCount + increment)),
    };
};

module.exports = {
    DEFAULT_MAX_STUDENTS_PER_MENTOR,
    ACTIVE_MENTOR_OCCUPANCY_STATUSES,
    ACTIVE_REGISTRATION_STATUSES,
    ACADEMIC_TITLE_LIMITS,
    getMentorMaxSlots,
    countActiveOccupiedMentoredTopics,
    assertMentorCapacity,
};
