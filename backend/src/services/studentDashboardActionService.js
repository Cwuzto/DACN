/**
 * studentDashboardActionService.js
 *
 * Tính toán một bước tiếp theo duy nhất (nextAction) cho dashboard sinh viên
 * dựa trên TopicRegistration, Semester, tasks và allowedActions thực tế.
 */

const CLOSED_SEMESTER_STATUSES = new Set(['COMPLETED', 'CLOSED', 'DRAFT', 'ARCHIVED']);

const WAIT_ACTION_BY_STATUS = {
    PENDING: {
        kind: 'WAIT_MENTOR_APPROVAL',
        title: 'Chờ giảng viên hướng dẫn duyệt đăng ký',
        description:
            'Nguyện vọng đăng ký đề tài của bạn đang chờ giảng viên hướng dẫn xem xét và phê duyệt.',
    },
    BM01_SUBMITTED: {
        kind: 'WAIT_BM01_REVIEW',
        title: 'Chờ thẩm định đề cương BM01',
        description:
            'Đề cương BM01 của bạn đã được nộp và đang chờ giảng viên hướng dẫn / hội đồng đề cương xem xét.',
    },
    BM01_RESUBMITTED: {
        kind: 'WAIT_BM01_REVIEW',
        title: 'Chờ thẩm định đề cương BM01',
        description:
            'Đề cương BM01 chỉnh sửa của bạn đã được nộp lại và đang chờ hội đồng / giảng viên hướng dẫn xem xét.',
    },
    BM02_SUBMITTED: {
        kind: 'WAIT_BM02_APPROVAL',
        title: 'Chờ xác nhận hồ sơ BM02 và ban hành quyết định',
        description:
            'Hồ sơ BM02 của bạn đang chờ giảng viên hướng dẫn, bộ môn và Viện xác nhận để ban hành quyết định giao đề tài.',
    },
    BM02_RESUBMITTED: {
        kind: 'WAIT_BM02_APPROVAL',
        title: 'Chờ xác nhận hồ sơ BM02 và ban hành quyết định',
        description:
            'Hồ sơ BM02 chỉnh sửa của bạn đang chờ giảng viên hướng dẫn, bộ môn và Viện xác nhận.',
    },
    BM02_APPROVED: {
        kind: 'WAIT_BM02_APPROVAL',
        title: 'Chờ ban hành quyết định giao đề tài',
        description:
            'Hồ sơ BM02 đã được xác nhận và đang chờ Viện ban hành quyết định giao đề tài chính thức.',
    },
    BM02_EXCEPTION_REVIEW: {
        kind: 'WAIT_BM02_APPROVAL',
        title: 'Chờ xem xét ngoại lệ hồ sơ BM02',
        description:
            'Hồ sơ BM02 của bạn đang được Viện/Khoa xem xét xử lý ngoại lệ.',
    },
    CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED: {
        kind: 'WAIT_CHECKPOINT_APPEAL_REVIEW',
        title: 'Chờ thẩm định giải trình BM03',
        description:
            'Đơn giải trình chữ ký checkpoint của bạn đang chờ Viện/Khoa xem xét.',
    },
    CHECKPOINT_SIGNATURE_APPEAL_REVIEW: {
        kind: 'WAIT_CHECKPOINT_APPEAL_REVIEW',
        title: 'Chờ thẩm định giải trình BM03',
        description:
            'Đơn giải trình chữ ký checkpoint của bạn đang được Viện/Khoa thẩm định.',
    },
    BM03_PASSED: {
        kind: 'WAIT_BM04_EVALUATION',
        title: 'Chờ đánh giá điều kiện bảo vệ BM04',
        description:
            'Bạn đã hoàn thành các mốc tiến độ BM03. Hồ sơ đang chờ giảng viên hướng dẫn nhận xét và đánh giá điều kiện bảo vệ (BM04).',
    },
    BM04_REVIEW: {
        kind: 'WAIT_BM04_EVALUATION',
        title: 'Chờ xét duyệt điều kiện bảo vệ BM04',
        description:
            'Hồ sơ BM04 của bạn đang được giảng viên hướng dẫn / Viện xem xét điều kiện bảo vệ.',
    },
    AWAITING_SCORES: {
        kind: 'WAIT_DEFENSE_RESULT',
        title: 'Chờ hoàn tất chấm điểm bảo vệ',
        description:
            'Hồ sơ đang trong quá trình tổng hợp điểm từ hội đồng bảo vệ. Kết quả sẽ hiển thị sau khi được công bố chính thức.',
    },
    AWAITING_FINAL_APPROVAL: {
        kind: 'WAIT_DEFENSE_RESULT',
        title: 'Chờ phê duyệt và công bố kết quả',
        description:
            'Điểm bảo vệ đang chờ phê duyệt và công bố chính thức từ Viện.',
    },
    SUBMITTED: {
        kind: 'WAIT_DEFENSE_RESULT',
        title: 'Chờ tổng hợp và công bố kết quả',
        description:
            'Bài nộp của bạn đã được ghi nhận và đang chờ xử lý ở bước tiếp theo.',
    },
    PENDING_INSTITUTE_SIGNATURE: {
        kind: 'WAIT_INSTITUTE_SIGNATURE',
        title: 'Chờ Viện ký xác nhận hoàn thành',
        description:
            'Hồ sơ lưu chiểu của bạn đã đạt và đang chờ Viện ký xác nhận hoàn thành đồ án.',
    },
};

const CLOSED_ACTION_BY_STATUS = {
    REJECTED: {
        title: 'Đăng ký đề tài không được duyệt',
        description: 'Nguyện vọng đăng ký đề tài này đã bị từ chối.',
    },
    BM02_REJECTED: {
        title: 'Hồ sơ BM02 không được duyệt',
        description: 'Hồ sơ đăng ký thực hiện đề tài BM02 không được phê duyệt.',
    },
    NOT_ELIGIBLE_FOR_DEFENSE: {
        title: 'Chưa đủ điều kiện bảo vệ',
        description: 'Hồ sơ hiện chưa đủ điều kiện tham gia bảo vệ trong đợt này.',
    },
    AUTO_NOT_ELIGIBLE: {
        title: 'Chưa đủ điều kiện bảo vệ',
        description: 'Hệ thống ghi nhận hồ sơ chưa đủ điều kiện tham gia bảo vệ.',
    },
    DEFENSE_FAILED: {
        title: 'Kết quả bảo vệ chưa đạt',
        description: 'Kết quả bảo vệ đồ án trong đợt này chưa đạt yêu cầu.',
    },
    STOP_REVIEW_PENDING: {
        title: 'Đang xem xét dừng thực hiện đề tài',
        description: 'Hồ sơ đang trong quy trình xem xét dừng thực hiện đề tài.',
    },
    DROPPED: {
        title: 'Hồ sơ đã dừng tham gia',
        description: 'Sinh viên đã dừng thực hiện đề tài trong đợt này.',
    },
    WITHDRAWN: {
        title: 'Đăng ký đã được rút',
        description: 'Hồ sơ đăng ký đề tài đã được rút khỏi đợt.',
    },
    AUTO_TERMINATED: {
        title: 'Hồ sơ đã bị chấm dứt thực hiện',
        description: 'Hồ sơ đã tự động chấm dứt theo quy định tiến độ của đợt.',
    },
    TERMINATED_FAILED_PROGRESS: {
        title: 'Hồ sơ đã bị chấm dứt do không đạt tiến độ',
        description: 'Hồ sơ đã chấm dứt thực hiện do không đạt mốc tiến độ BM03.',
    },
    TERMINATED_BM01: {
        title: 'Hồ sơ đã bị chấm dứt ở giai đoạn BM01',
        description: 'Hồ sơ đã chấm dứt thực hiện do không đạt yêu cầu đề cương BM01.',
    },
    TERMINATED_BM02: {
        title: 'Hồ sơ đã bị chấm dứt ở giai đoạn BM02',
        description: 'Hồ sơ đã chấm dứt thực hiện ở bước xác nhận BM02.',
    },
    TERMINATED_BM04: {
        title: 'Hồ sơ đã bị chấm dứt ở giai đoạn BM04',
        description: 'Hồ sơ đã chấm dứt thực hiện ở bước đánh giá điều kiện bảo vệ BM04.',
    },
};

function toValidDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function pickNextTaskDueDate(tasks = []) {
    if (!Array.isArray(tasks) || tasks.length === 0) return null;
    const pending = tasks.filter(
        (task) => !['SUBMITTED', 'COMPLETED'].includes(task?.status)
    );
    const candidates = (pending.length > 0 ? pending : tasks)
        .map((task) => task?.dueDate || task?.deadline || null)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return candidates[0] || null;
}

function buildNoRegistrationAction(semester, now) {
    if (!semester) return null;

    const regDeadline = semester.registrationDeadline || null;
    const deadlineDate = toValidDate(regDeadline);
    const isSemesterClosed = Boolean(
        semester.status && CLOSED_SEMESTER_STATUSES.has(semester.status)
    );
    const isDeadlinePassed = Boolean(deadlineDate && now > deadlineDate);
    const canAct = Boolean(
        semester.registrationOpen !== false && !isSemesterClosed && !isDeadlinePassed
    );

    let description =
        'Chọn một đề tài phù hợp và gửi nguyện vọng đến giảng viên hướng dẫn.';
    if (!canAct) {
        description = isDeadlinePassed
            ? 'Đã quá hạn đăng ký đề tài trong đợt này.'
            : 'Cổng đăng ký đề tài hiện đang đóng.';
    }

    return {
        kind: 'REGISTER_TOPIC',
        title: canAct ? 'Chọn và đăng ký đề tài' : 'Chưa thể đăng ký đề tài',
        description,
        dueAt: regDeadline,
        target: canAct ? '/student/topics' : null,
        sourceStatus: null,
        canAct,
    };
}

function buildBm01SubmitAction(status, semester, allowedSet, now) {
    const openAt = toValidDate(semester?.outlineSubmissionOpenAt);
    const deadline = toValidDate(semester?.outlineSubmissionDeadline);
    const notOpenYet = Boolean(openAt && now < openAt);
    const windowClosed = Boolean(deadline && now > deadline);
    const hasPermission = allowedSet.has('SUBMIT_BM01');
    const canAct = hasPermission && !notOpenYet && !windowClosed;

    let description =
        'Đề tài đã được giảng viên hướng dẫn duyệt. Hãy chuẩn bị và nộp đề cương BM01 đúng hạn.';
    if (notOpenYet) {
        description = 'Đề tài đã được duyệt. Cổng nộp đề cương BM01 chưa mở.';
    } else if (windowClosed) {
        description =
            'Đã quá hạn nộp đề cương BM01 trong đợt này. Vui lòng liên hệ giảng viên hướng dẫn hoặc giáo vụ nếu cần hỗ trợ.';
    } else if (!hasPermission) {
        description = 'Đề tài đã được duyệt, hiện chưa thể thực hiện nộp đề cương BM01.';
    }

    return {
        kind: 'SUBMIT_BM01',
        title: 'Nộp đề cương BM01',
        description,
        dueAt: semester?.outlineSubmissionDeadline || null,
        target: canAct ? '/student/submissions' : null,
        sourceStatus: status,
        canAct,
    };
}

/**
 * Trả về hành động tiếp theo phù hợp nhất cho sinh viên.
 *
 * @param {object} params
 * @param {object|null} params.registration
 * @param {object|null} params.semester
 * @param {Array} [params.tasks]
 * @param {Array<string>} [params.allowedActions]
 * @param {Date} [params.now]
 * @returns {{ kind: string, title: string, description: string, dueAt: Date|string|null, target: string|null, sourceStatus: string|null, canAct: boolean } | null}
 */
function buildStudentNextAction({
    registration = null,
    semester = null,
    tasks = [],
    allowedActions = [],
    now = new Date(),
} = {}) {
    const currentNow = toValidDate(now) || new Date();
    const allowedSet = new Set(Array.isArray(allowedActions) ? allowedActions : []);

    if (!registration) {
        return buildNoRegistrationAction(semester, currentNow);
    }

    const status = registration.status;
    if (!status) return null;

    if (WAIT_ACTION_BY_STATUS[status]) {
        const template = WAIT_ACTION_BY_STATUS[status];
        return {
            kind: template.kind,
            title: template.title,
            description: template.description,
            dueAt: null,
            target: null,
            sourceStatus: status,
            canAct: false,
        };
    }

    if (CLOSED_ACTION_BY_STATUS[status]) {
        const closed = CLOSED_ACTION_BY_STATUS[status];
        return {
            kind: 'REGISTRATION_CLOSED',
            title: closed.title,
            description: closed.description,
            dueAt: null,
            target: null,
            sourceStatus: status,
            canAct: false,
        };
    }

    if (status === 'REGISTERED' || status === 'APPROVED') {
        return buildBm01SubmitAction(status, semester, allowedSet, currentNow);
    }

    if (status === 'BM01_NEEDS_REVISION') {
        const canAct = allowedSet.has('RESUBMIT_BM01');
        return {
            kind: 'RESUBMIT_BM01',
            title: 'Chỉnh sửa và nộp lại đề cương BM01',
            description: canAct
                ? 'Đề cương BM01 cần chỉnh sửa theo góp ý. Hãy cập nhật và nộp lại để tiếp tục xét duyệt.'
                : 'Đề cương BM01 cần chỉnh sửa, hiện chưa thể nộp lại trên hệ thống.',
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: canAct ? '/student/submissions' : null,
            sourceStatus: status,
            canAct,
        };
    }

    if (['BM01_PASSED', 'BM02_OPEN', 'BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED'].includes(status)) {
        const canAct = allowedSet.has('SUBMIT_BM02');
        return {
            kind: 'SUBMIT_BM02',
            title: 'Nộp đơn đăng ký thực hiện đề tài BM02',
            description: canAct
                ? 'Đề cương BM01 đã đạt. Hãy hoàn thiện và nộp hồ sơ BM02 để làm thủ tục giao đề tài.'
                : 'Đề cương BM01 đã đạt, hiện chưa thể nộp hồ sơ BM02.',
            dueAt: pickNextTaskDueDate(tasks),
            target: canAct ? '/student/submissions' : null,
            sourceStatus: status,
            canAct,
        };
    }

    if (status === 'BM03_SIGNATURE_PENDING') {
        const canAct = allowedSet.has('SIGN_CHECKPOINT');
        return {
            kind: 'SIGN_BM03_CHECKPOINT',
            title: 'Ký xác nhận tiến độ BM03',
            description: canAct
                ? 'Giảng viên hướng dẫn đã ghi nhận kết quả kiểm tra tiến độ. Vui lòng kiểm tra và ký xác nhận trên hệ thống.'
                : 'Đang chờ xác nhận chữ ký tiến độ BM03.',
            dueAt: pickNextTaskDueDate(tasks),
            target: canAct ? '/student/submissions' : null,
            sourceStatus: status,
            canAct,
        };
    }

    if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') {
        const canAct = allowedSet.has('SUBMIT_CHECKPOINT_APPEAL');
        return {
            kind: 'SUBMIT_CHECKPOINT_APPEAL',
            title: 'Gửi giải trình / khiếu nại chữ ký BM03',
            description: canAct
                ? 'Đã quá thời hạn ký xác nhận checkpoint. Bạn có thể gửi đơn giải trình để được xem xét.'
                : 'Đã quá thời hạn ký xác nhận checkpoint BM03.',
            dueAt: pickNextTaskDueDate(tasks),
            target: canAct ? '/student/submissions' : null,
            sourceStatus: status,
            canAct,
        };
    }

    if (['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03', 'SIGNATURE_APPEAL_RESOLVED'].includes(status)) {
        return {
            kind: 'SUBMIT_PROGRESS_BM03',
            title: 'Thực hiện đề tài và cập nhật tiến độ BM03',
            description:
                'Quyết định giao đề tài đã được ban hành. Hãy thực hiện đề tài, hoàn thành các mốc nhiệm vụ và theo dõi đánh giá tiến độ BM03.',
            dueAt: pickNextTaskDueDate(tasks) || semester?.midtermReportDate || null,
            target: '/student/submissions',
            sourceStatus: status,
            canAct: true,
        };
    }

    if (['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE'].includes(status)) {
        return {
            kind: 'PREPARE_DEFENSE',
            title: 'Chuẩn bị bảo vệ đồ án tốt nghiệp',
            description:
                'Hồ sơ của bạn đủ điều kiện bảo vệ. Hãy hoàn thiện báo cáo, slide và theo dõi lịch hội đồng bảo vệ.',
            dueAt: semester?.defenseDate || pickNextTaskDueDate(tasks) || null,
            target: '/student/submissions',
            sourceStatus: status,
            canAct: true,
        };
    }

    if (['DEFENSE_PASSED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(status)) {
        return {
            kind: 'SUBMIT_ARCHIVE',
            title: status === 'ARCHIVE_REJECTED' ? 'Bổ sung và nộp lại hồ sơ lưu chiểu' : 'Nộp hồ sơ lưu chiểu số',
            description:
                'Hoàn thiện và nộp đầy đủ tài liệu lưu chiểu sau bảo vệ để làm thủ tục công nhận hoàn thành đồ án.',
            dueAt: pickNextTaskDueDate(tasks),
            target: '/student/submissions',
            sourceStatus: status,
            canAct: true,
        };
    }

    if (status === 'DEFENDED') {
        if (allowedSet.has('SUBMIT_ARCHIVE')) {
            return {
                kind: 'SUBMIT_ARCHIVE',
                title: 'Nộp hồ sơ lưu chiểu số',
                description:
                    'Bạn đã hoàn thành bảo vệ. Hãy nộp đầy đủ hồ sơ lưu chiểu số để làm thủ tục công nhận hoàn thành.',
                dueAt: pickNextTaskDueDate(tasks),
                target: '/student/submissions',
                sourceStatus: status,
                canAct: true,
            };
        }

        return {
            kind: 'VIEW_GRADES_CERTIFICATE',
            title: 'Xem kết quả và giấy xác nhận hoàn thành',
            description:
                'Bạn đã hoàn thành bảo vệ đồ án tốt nghiệp. Bạn có thể theo dõi kết quả và thông tin hoàn thành.',
            dueAt: null,
            target: '/student/grades',
            sourceStatus: status,
            canAct: true,
        };
    }

    if (status === 'COMPLETED') {
        return {
            kind: 'VIEW_GRADES_CERTIFICATE',
            title: 'Xem kết quả và giấy xác nhận hoàn thành',
            description:
                'Bạn đã hoàn thành đồ án tốt nghiệp. Bạn có thể xem kết quả chính thức và giấy xác nhận hoàn thành.',
            dueAt: null,
            target: '/student/grades',
            sourceStatus: status,
            canAct: true,
        };
    }

    return null;
}

module.exports = {
    buildStudentNextAction,
};
