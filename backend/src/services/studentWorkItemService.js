/**
 * studentWorkItemService.js
 *
 * Chuẩn hóa và phân loại các đầu việc của sinh viên (workItems) thành 3 vùng:
 * - READY (Cần làm ngay): Việc đã mở, sinh viên có quyền làm (canAct: true).
 * - UPCOMING (Sắp tới): Việc chưa mở nhưng có mốc thời gian thực tế trong 7 ngày tới (canAct: false).
 * - DONE (Đã hoàn thành): Các mốc / bản nộp thực tế đã hoàn thành (completedAt).
 *
 * Đồng thời xác định waitingStatus và nextAction cho dashboard và trang "Việc của tôi".
 */

const { buildArchiveDeadlineSummary } = require('../utils/defenseTimeWindowUtils');

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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toValidDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isWithin7Days(date, now) {
    if (!date) return false;
    const d = toValidDate(date);
    if (!d) return false;
    const diffMs = d.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= SEVEN_DAYS_MS;
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

/**
 * Xây dựng toàn bộ trạng thái việc sinh viên:
 * workItems (READY, UPCOMING, DONE), waitingStatus và nextAction
 */
function buildStudentWorkState({
    registration = null,
    semester = null,
    tasks = [],
    outline = null,
    bm03Record = null,
    bm04Record = null,
    archive = null,
    dossier = null,
    allowedActions = [],
    now = new Date(),
} = {}) {
    const currentNow = toValidDate(now) || new Date();
    const allowedSet = new Set(Array.isArray(allowedActions) ? allowedActions : []);
    const taskList = Array.isArray(tasks) ? tasks : [];
    const activeOutline = outline || registration?.outline || null;
    const activeBm03 = bm03Record || registration?.bm03Record || null;
    const activeBm04 = bm04Record || registration?.bm04Evaluation || null;
    const activeArchive = archive || registration?.archive || null;

    // Mask unpublished defense result to prevent leakage
    const defenseResult = registration?.defenseResult;
    const isDefenseResultPublished = Boolean(defenseResult?.isPublished);

    // 1. Trường hợp không có cả registration lẫn semester
    if (!registration && !semester) {
        return {
            workItems: [],
            waitingStatus: null,
            nextAction: null,
        };
    }

    // 2. Trường hợp chưa có đăng ký đề tài
    if (!registration) {
        const regDeadline = semester.registrationDeadline || null;
        const deadlineDate = toValidDate(regDeadline);
        const isSemesterClosed = Boolean(
            semester.status && CLOSED_SEMESTER_STATUSES.has(semester.status)
        );
        const isDeadlinePassed = Boolean(deadlineDate && currentNow > deadlineDate);
        const canAct = Boolean(
            semester.registrationOpen !== false && !isSemesterClosed && !isDeadlinePassed
        );

        let description = 'Chọn một đề tài phù hợp và gửi nguyện vọng đến giảng viên hướng dẫn.';
        if (!canAct) {
            description = isDeadlinePassed
                ? 'Đã quá hạn đăng ký đề tài trong đợt này.'
                : 'Cổng đăng ký đề tài hiện đang đóng.';
        }

        const workItems = [];
        let waitingStatus = null;
        let nextAction = null;

        if (canAct) {
            const item = {
                id: 'register-topic',
                kind: 'REGISTER_TOPIC',
                title: 'Chọn và đăng ký đề tài',
                description,
                bucket: 'READY',
                openAt: semester.startDate || null,
                dueAt: regDeadline,
                target: '/student/topics',
                canAct: true,
                sourceStatus: null,
                completedAt: null,
            };
            workItems.push(item);
            nextAction = {
                kind: 'REGISTER_TOPIC',
                title: item.title,
                description: item.description,
                dueAt: item.dueAt,
                target: item.target,
                sourceStatus: null,
                canAct: true,
            };
        } else {
            waitingStatus = {
                title: 'Chưa thể đăng ký đề tài',
                description,
                sourceStatus: null,
            };
            nextAction = {
                kind: 'REGISTER_TOPIC',
                title: 'Chưa thể đăng ký đề tài',
                description,
                dueAt: regDeadline,
                target: null,
                sourceStatus: null,
                canAct: false,
            };
        }

        return {
            workItems,
            waitingStatus,
            nextAction,
        };
    }

    const status = registration.status;
    if (!status) {
        return {
            workItems: [],
            waitingStatus: null,
            nextAction: null,
        };
    }

    // 3. Trường hợp hồ sơ bị đóng / kết thúc / dừng
    if (CLOSED_ACTION_BY_STATUS[status]) {
        const closed = CLOSED_ACTION_BY_STATUS[status];
        return {
            workItems: [],
            waitingStatus: null,
            nextAction: {
                kind: 'REGISTRATION_CLOSED',
                title: closed.title,
                description: closed.description,
                dueAt: null,
                target: null,
                sourceStatus: status,
                canAct: false,
            },
        };
    }

    // 4. Khởi tạo các mảng cho 3 vùng
    const readyItems = [];
    const upcomingItems = [];
    const doneItems = [];
    let waitingStatus = null;

    // Giai đoạn PENDING
    if (status === 'PENDING') {
        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS.PENDING.title,
            description: WAIT_ACTION_BY_STATUS.PENDING.description,
            sourceStatus: status,
        };
    }

    // Giai đoạn BM01 (APPROVED / REGISTERED)
    else if (status === 'REGISTERED' || status === 'APPROVED') {
        const openAt = toValidDate(semester?.outlineSubmissionOpenAt);
        const deadline = toValidDate(semester?.outlineSubmissionDeadline);
        const isOpen = !openAt || currentNow >= openAt;
        const isExpired = Boolean(deadline && currentNow > deadline);
        const hasPermission = allowedSet.has('SUBMIT_BM01');
        const canAct = hasPermission && isOpen && !isExpired;

        if (isOpen) {
            if (canAct) {
                readyItems.push({
                    id: 'work-bm01-initial',
                    kind: 'BM01_INITIAL',
                    title: 'Nộp đề cương BM01',
                    description:
                        'Đề tài đã được giảng viên hướng dẫn duyệt. Hãy chuẩn bị và nộp đề cương BM01 đúng hạn.',
                    bucket: 'READY',
                    openAt: semester?.outlineSubmissionOpenAt || null,
                    dueAt: semester?.outlineSubmissionDeadline || null,
                    target: '/student/submissions?work=BM01_INITIAL',
                    canAct: true,
                    sourceStatus: status,
                    completedAt: null,
                });
            } else {
                let description = 'Đề tài đã được duyệt, hiện chưa thể thực hiện nộp đề cương BM01.';
                if (isExpired) {
                    description =
                        'Đã quá hạn nộp đề cương BM01 trong đợt này. Vui lòng liên hệ giảng viên hướng dẫn hoặc giáo vụ nếu cần hỗ trợ.';
                }
                waitingStatus = {
                    title: 'Nộp đề cương BM01',
                    description,
                    sourceStatus: status,
                };
            }
        } else {
            // Cổng chưa mở
            if (isWithin7Days(openAt, currentNow)) {
                upcomingItems.push({
                    id: 'upcoming-bm01-initial',
                    kind: 'BM01_INITIAL',
                    title: 'Nộp đề cương BM01',
                    description: 'Đề tài đã được duyệt. Cổng nộp đề cương BM01 chưa mở.',
                    bucket: 'UPCOMING',
                    openAt: semester?.outlineSubmissionOpenAt || null,
                    dueAt: semester?.outlineSubmissionDeadline || null,
                    target: null,
                    canAct: false,
                    sourceStatus: status,
                    completedAt: null,
                });
            }
            waitingStatus = {
                title: 'Nộp đề cương BM01',
                description: 'Đề tài đã được duyệt. Cổng nộp đề cương BM01 chưa mở.',
                sourceStatus: status,
            };
        }
    }

    // Giai đoạn BM01 đã nộp (BM01_SUBMITTED / BM01_RESUBMITTED)
    else if (status === 'BM01_SUBMITTED' || status === 'BM01_RESUBMITTED') {
        doneItems.push({
            id: 'done-bm01-initial',
            kind: 'BM01_INITIAL',
            title: 'Đề cương nghiên cứu chi tiết (BM01)',
            description: 'Đã nộp đề cương BM01',
            bucket: 'DONE',
            openAt: semester?.outlineSubmissionOpenAt || null,
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: '/student/submissions?work=BM01_INITIAL',
            canAct: false,
            sourceStatus: status,
            completedAt: activeOutline?.submittedAt || registration.updatedAt || currentNow,
        });

        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS[status].title,
            description: WAIT_ACTION_BY_STATUS[status].description,
            sourceStatus: status,
        };
    }

    // Giai đoạn BM01 cần chỉnh sửa (BM01_NEEDS_REVISION)
    else if (status === 'BM01_NEEDS_REVISION') {
        doneItems.push({
            id: 'done-bm01-initial',
            kind: 'BM01_INITIAL',
            title: 'Đề cương nghiên cứu chi tiết (BM01)',
            description: 'Bản nộp đợt 1 cần chỉnh sửa theo góp ý',
            bucket: 'DONE',
            openAt: semester?.outlineSubmissionOpenAt || null,
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: '/student/submissions?work=BM01_INITIAL',
            canAct: false,
            sourceStatus: status,
            completedAt: activeOutline?.submittedAt || registration.updatedAt || currentNow,
        });

        const canAct = allowedSet.has('RESUBMIT_BM01');
        const dueAt = activeOutline?.deadlineAt || semester?.outlineSubmissionDeadline || null;
        if (canAct) {
            readyItems.push({
                id: 'work-bm01-resubmit',
                kind: 'BM01_RESUBMIT',
                title: 'Chỉnh sửa và nộp lại đề cương BM01',
                description:
                    'Đề cương BM01 cần chỉnh sửa theo góp ý. Hãy cập nhật và nộp lại để tiếp tục xét duyệt.',
                bucket: 'READY',
                openAt: null,
                dueAt,
                target: '/student/submissions?work=BM01_RESUBMIT',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
            });
        } else {
            waitingStatus = {
                title: 'Chỉnh sửa và nộp lại đề cương BM01',
                description: 'Đề cương BM01 cần chỉnh sửa, hiện chưa thể nộp lại trên hệ thống.',
                sourceStatus: status,
            };
        }
    }

    // Giai đoạn BM01 đã đạt -> Nộp BM02 (BM01_PASSED, BM02_OPEN, BM02_NEEDS_REVISION, BM02_REVISION_REQUIRED)
    else if (['BM01_PASSED', 'BM02_OPEN', 'BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED'].includes(status)) {
        doneItems.push({
            id: 'done-bm01',
            kind: 'BM01_INITIAL',
            title: 'Đề cương nghiên cứu chi tiết (BM01)',
            description: 'Đề cương BM01 đã được duyệt đạt',
            bucket: 'DONE',
            openAt: semester?.outlineSubmissionOpenAt || null,
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: '/student/submissions?work=BM01_INITIAL',
            canAct: false,
            sourceStatus: status,
            completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
        });

        const canAct = allowedSet.has('SUBMIT_BM02');
        const dueAt = pickNextTaskDueDate(taskList);
        if (canAct) {
            readyItems.push({
                id: 'work-bm02',
                kind: 'BM02',
                title: 'Nộp đơn đăng ký thực hiện đề tài BM02',
                description:
                    'Đề cương BM01 đã đạt. Hãy hoàn thiện và nộp hồ sơ BM02 để làm thủ tục giao đề tài.',
                bucket: 'READY',
                openAt: null,
                dueAt,
                target: '/student/submissions?work=BM02',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
            });
        } else {
            waitingStatus = {
                title: 'Nộp đơn đăng ký thực hiện đề tài BM02',
                description: 'Đề cương BM01 đã đạt, hiện chưa thể nộp hồ sơ BM02.',
                sourceStatus: status,
            };
        }
    }

    // Giai đoạn BM02 đã nộp / duyệt (BM02_SUBMITTED, BM02_RESUBMITTED, BM02_APPROVED, BM02_EXCEPTION_REVIEW)
    else if (['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_APPROVED', 'BM02_EXCEPTION_REVIEW'].includes(status)) {
        doneItems.push({
            id: 'done-bm01',
            kind: 'BM01_INITIAL',
            title: 'Đề cương nghiên cứu chi tiết (BM01)',
            description: 'Đề cương BM01 đã được duyệt đạt',
            bucket: 'DONE',
            openAt: semester?.outlineSubmissionOpenAt || null,
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: '/student/submissions?work=BM01_INITIAL',
            canAct: false,
            sourceStatus: status,
            completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
        });

        doneItems.push({
            id: 'done-bm02',
            kind: 'BM02',
            title: 'Đơn đăng ký thực hiện đề tài (BM02)',
            description: 'Đã nộp hồ sơ BM02',
            bucket: 'DONE',
            openAt: null,
            dueAt: null,
            target: '/student/submissions?work=BM02',
            canAct: false,
            sourceStatus: status,
            completedAt: registration.currentBM02Submission?.submittedAt || registration.updatedAt || currentNow,
        });

        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS[status].title,
            description: WAIT_ACTION_BY_STATUS[status].description,
            sourceStatus: status,
        };
    }

    // Giai đoạn thực hiện đề tài / BM03
    else if ([
        'DECISION_ISSUED',
        'IN_PROGRESS',
        'IN_PROGRESS_BM03',
        'BM03_SIGNATURE_PENDING',
        'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
        'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
        'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
        'SIGNATURE_APPEAL_RESOLVED',
    ].includes(status)) {
        // BM01 và BM02 đã hoàn thành trong quá khứ
        doneItems.push({
            id: 'done-bm01',
            kind: 'BM01_INITIAL',
            title: 'Đề cương nghiên cứu chi tiết (BM01)',
            description: 'Đề cương BM01 đã được duyệt đạt',
            bucket: 'DONE',
            openAt: semester?.outlineSubmissionOpenAt || null,
            dueAt: semester?.outlineSubmissionDeadline || null,
            target: '/student/submissions?work=BM01_INITIAL',
            canAct: false,
            sourceStatus: status,
            completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
        });

        doneItems.push({
            id: 'done-bm02',
            kind: 'BM02',
            title: 'Đơn đăng ký thực hiện đề tài (BM02)',
            description: 'Đã ban hành quyết định giao đề tài',
            bucket: 'DONE',
            openAt: null,
            dueAt: null,
            target: '/student/submissions?work=BM02',
            canAct: false,
            sourceStatus: status,
            completedAt: registration.decisionDate || registration.updatedAt || currentNow,
        });

        // Xử lý các task thật
        taskList.forEach((task) => {
            const isCompleted = ['SUBMITTED', 'COMPLETED'].includes(task.status);
            if (isCompleted) {
                doneItems.push({
                    id: `task-${task.id}`,
                    kind: 'TASK_SUBMISSION',
                    title: task.title,
                    description: task.content || task.description || '',
                    bucket: 'DONE',
                    openAt: null,
                    dueAt: task.dueDate || task.deadline || null,
                    target: `/student/submissions?work=task-${task.id}`,
                    canAct: false,
                    sourceStatus: task.status,
                    completedAt: task.submissions?.[0]?.submittedAt || task.completedAt || task.updatedAt || currentNow,
                });
            } else {
                const openAt = toValidDate(task.openAt || task.startDate);
                if (openAt && openAt > currentNow) {
                    if (isWithin7Days(openAt, currentNow)) {
                        upcomingItems.push({
                            id: `task-${task.id}`,
                            kind: 'TASK_SUBMISSION',
                            title: task.title,
                            description: task.content || task.description || '',
                            bucket: 'UPCOMING',
                            openAt,
                            dueAt: task.dueDate || task.deadline || null,
                            target: null,
                            canAct: false,
                            sourceStatus: task.status,
                            completedAt: null,
                        });
                    }
                } else {
                    readyItems.push({
                        id: `task-${task.id}`,
                        kind: 'TASK_SUBMISSION',
                        title: task.title,
                        description: task.content || task.description || '',
                        bucket: 'READY',
                        openAt: openAt || null,
                        dueAt: task.dueDate || task.deadline || null,
                        target: `/student/submissions?work=task-${task.id}`,
                        canAct: true,
                        sourceStatus: task.status,
                        completedAt: null,
                    });
                }
            }
        });

        // Xử lý BM03 48h ký xác nhận
        const isBm03SignaturePending =
            status === 'BM03_SIGNATURE_PENDING' ||
            activeBm03?.studentAckStatus === 'PENDING' ||
            allowedSet.has('SIGN_CHECKPOINT');

        if (isBm03SignaturePending) {
            readyItems.push({
                id: 'work-bm03-ack',
                kind: 'BM03_ACK',
                title: 'Ký xác nhận tiến độ BM03',
                description:
                    'Giảng viên hướng dẫn đã ghi nhận kết quả kiểm tra tiến độ. Vui lòng kiểm tra và ký xác nhận trên hệ thống.',
                bucket: 'READY',
                openAt: activeBm03?.advisorSignedAt || null,
                dueAt: activeBm03?.studentAckDeadlineAt || pickNextTaskDueDate(taskList),
                target: '/student/submissions?work=BM03_ACK',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
            });
        }

        // Xử lý giải trình khiếu nại chữ ký BM03
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN' || allowedSet.has('SUBMIT_CHECKPOINT_APPEAL')) {
            readyItems.push({
                id: 'work-bm03-appeal',
                kind: 'BM03_APPEAL',
                title: 'Gửi giải trình / khiếu nại chữ ký BM03',
                description:
                    'Đã quá thời hạn ký xác nhận checkpoint. Bạn có thể gửi đơn giải trình để được xem xét.',
                bucket: 'READY',
                openAt: null,
                dueAt: pickNextTaskDueDate(taskList),
                target: '/student/submissions?work=BM03_APPEAL',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
            });
        } else if (
            status === 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED' ||
            status === 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW'
        ) {
            waitingStatus = {
                title: WAIT_ACTION_BY_STATUS[status].title,
                description: WAIT_ACTION_BY_STATUS[status].description,
                sourceStatus: status,
            };
        }

        // Nếu trạng thái chung không có checkpoint 48h và không có task mở:
        // KHÔNG sinh việc nộp ảo, đặt waitingStatus để hiển thị rõ
        if (readyItems.length === 0 && !waitingStatus) {
            waitingStatus = {
                title: 'Đang thực hiện đề tài',
                description:
                    'Quyết định giao đề tài đã được ban hành. Hãy thực hiện đề tài, hoàn thành các mốc nhiệm vụ và theo dõi đánh giá tiến độ BM03.',
                sourceStatus: status,
            };
        }
    }

    // Giai đoạn BM03_PASSED hoặc BM04_REVIEW
    else if (status === 'BM03_PASSED' || status === 'BM04_REVIEW') {
        doneItems.push(
            {
                id: 'done-bm01',
                kind: 'BM01_INITIAL',
                title: 'Đề cương nghiên cứu chi tiết (BM01)',
                description: 'Đề cương BM01 đã được duyệt đạt',
                bucket: 'DONE',
                openAt: semester?.outlineSubmissionOpenAt || null,
                dueAt: semester?.outlineSubmissionDeadline || null,
                target: '/student/submissions?work=BM01_INITIAL',
                canAct: false,
                sourceStatus: status,
                completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm02',
                kind: 'BM02',
                title: 'Đơn đăng ký thực hiện đề tài (BM02)',
                description: 'Đã ban hành quyết định giao đề tài',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM02',
                canAct: false,
                sourceStatus: status,
                completedAt: registration.decisionDate || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm03',
                kind: 'BM03',
                title: 'Nhật ký & Đánh giá tiến độ (BM03)',
                description: 'Đã hoàn thành các mốc tiến độ BM03',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM03',
                canAct: false,
                sourceStatus: status,
                completedAt: activeBm03?.studentAckAt || activeBm03?.updatedAt || registration.updatedAt || currentNow,
            },
        );

        // BM04 chỉ hiển thị trong DONE khi GVHD đã ký nộp chính thức (không tính bản nháp DRAFT)
        const isBm04Done = Boolean(
            activeBm04
            && activeBm04.status !== 'DRAFT'
            && (activeBm04.isLocked || ['SIGNED_APPROVED', 'COMPLETED', 'PENDING_INSTITUTE_REVIEW'].includes(activeBm04.status)),
        );
        if (isBm04Done) {
            doneItems.push({
                id: 'done-bm04',
                kind: 'BM04',
                title: 'Phiếu nhận xét của người hướng dẫn (BM04)',
                description: 'Giảng viên hướng dẫn đã đánh giá điều kiện bảo vệ',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM04',
                canAct: false,
                sourceStatus: activeBm04.status || 'COMPLETED',
                completedAt: activeBm04.signedAt || activeBm04.createdAt || currentNow,
            });
        }

        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS[status].title,
            description: WAIT_ACTION_BY_STATUS[status].description,
            sourceStatus: status,
        };
    }

    // Giai đoạn trước bảo vệ (DEFENSE_READY, DEFENSE_ELIGIBLE, ELIGIBLE_BY_INSTITUTE)
    else if (['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE'].includes(status)) {
        doneItems.push(
            {
                id: 'done-bm01',
                kind: 'BM01_INITIAL',
                title: 'Đề cương nghiên cứu chi tiết (BM01)',
                description: 'Đề cương BM01 đã được duyệt đạt',
                bucket: 'DONE',
                openAt: semester?.outlineSubmissionOpenAt || null,
                dueAt: semester?.outlineSubmissionDeadline || null,
                target: '/student/submissions?work=BM01_INITIAL',
                canAct: false,
                sourceStatus: status,
                completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm02',
                kind: 'BM02',
                title: 'Đơn đăng ký thực hiện đề tài (BM02)',
                description: 'Đã ban hành quyết định giao đề tài',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM02',
                canAct: false,
                sourceStatus: status,
                completedAt: registration.decisionDate || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm03',
                kind: 'BM03',
                title: 'Nhật ký & Đánh giá tiến độ (BM03)',
                description: 'Đã hoàn thành các mốc tiến độ BM03',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM03',
                canAct: false,
                sourceStatus: status,
                completedAt: activeBm03?.studentAckAt || activeBm03?.updatedAt || registration.updatedAt || currentNow,
            },
        );

        const isBm04Done = Boolean(
            activeBm04
            && activeBm04.status !== 'DRAFT'
            && (activeBm04.isLocked || ['SIGNED_APPROVED', 'COMPLETED', 'PENDING_INSTITUTE_REVIEW'].includes(activeBm04.status)),
        );
        if (isBm04Done) {
            doneItems.push({
                id: 'done-bm04',
                kind: 'BM04',
                title: 'Phiếu nhận xét của người hướng dẫn (BM04)',
                description: 'Giảng viên hướng dẫn đã đánh giá điều kiện bảo vệ',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM04',
                canAct: false,
                sourceStatus: activeBm04.status || 'COMPLETED',
                completedAt: activeBm04.signedAt || activeBm04.createdAt || currentNow,
            });
        }

        readyItems.push({
            id: 'work-pre-defense',
            kind: 'PRE_DEFENSE',
            title: 'Chuẩn bị bảo vệ đồ án tốt nghiệp',
            description:
                'Hồ sơ của bạn đủ điều kiện bảo vệ. Hãy hoàn thiện báo cáo, slide và theo dõi lịch hội đồng bảo vệ.',
            bucket: 'READY',
            openAt: null,
            dueAt: semester?.defenseDate || pickNextTaskDueDate(taskList) || null,
            target: '/student/submissions?work=PRE_DEFENSE',
            canAct: true,
            sourceStatus: status,
            completedAt: null,
        });
    }

    // Giai đoạn chờ kết quả chấm bảo vệ (AWAITING_SCORES, AWAITING_FINAL_APPROVAL, SUBMITTED)
    else if (['AWAITING_SCORES', 'AWAITING_FINAL_APPROVAL', 'SUBMITTED'].includes(status)) {
        doneItems.push(
            {
                id: 'done-bm01',
                kind: 'BM01_INITIAL',
                title: 'Đề cương nghiên cứu chi tiết (BM01)',
                description: 'Đề cương BM01 đã được duyệt đạt',
                bucket: 'DONE',
                openAt: semester?.outlineSubmissionOpenAt || null,
                dueAt: semester?.outlineSubmissionDeadline || null,
                target: '/student/submissions?work=BM01_INITIAL',
                canAct: false,
                sourceStatus: status,
                completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm02',
                kind: 'BM02',
                title: 'Đơn đăng ký thực hiện đề tài (BM02)',
                description: 'Đã ban hành quyết định giao đề tài',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM02',
                canAct: false,
                sourceStatus: status,
                completedAt: registration.decisionDate || registration.updatedAt || currentNow,
            },
        );
        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS[status].title,
            description: WAIT_ACTION_BY_STATUS[status].description,
            sourceStatus: status,
        };
    }

    // Giai đoạn sau bảo vệ -> Nộp lưu chiểu (DEFENSE_PASSED, ARCHIVE_INCOMPLETE, ARCHIVE_REJECTED)
    else if (['DEFENSE_PASSED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(status)) {
        doneItems.push(
            {
                id: 'done-bm01',
                kind: 'BM01_INITIAL',
                title: 'Đề cương nghiên cứu chi tiết (BM01)',
                description: 'Đề cương BM01 đã được duyệt đạt',
                bucket: 'DONE',
                openAt: semester?.outlineSubmissionOpenAt || null,
                dueAt: semester?.outlineSubmissionDeadline || null,
                target: '/student/submissions?work=BM01_INITIAL',
                canAct: false,
                sourceStatus: status,
                completedAt: activeOutline?.reviewedAt || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm02',
                kind: 'BM02',
                title: 'Đơn đăng ký thực hiện đề tài (BM02)',
                description: 'Đã ban hành quyết định giao đề tài',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM02',
                canAct: false,
                sourceStatus: status,
                completedAt: registration.decisionDate || registration.updatedAt || currentNow,
            },
            {
                id: 'done-bm03',
                kind: 'BM03',
                title: 'Nhật ký & Đánh giá tiến độ (BM03)',
                description: 'Đã hoàn thành các mốc tiến độ BM03',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM03',
                canAct: false,
                sourceStatus: status,
                completedAt: activeBm03?.studentAckAt || activeBm03?.updatedAt || registration.updatedAt || currentNow,
            },
        );
        const isBm04Done = Boolean(
            activeBm04
            && activeBm04.status !== 'DRAFT'
            && (activeBm04.isLocked || ['SIGNED_APPROVED', 'COMPLETED', 'PENDING_INSTITUTE_REVIEW'].includes(activeBm04.status)),
        );
        if (isBm04Done) {
            doneItems.push({
                id: 'done-bm04',
                kind: 'BM04',
                title: 'Phiếu nhận xét của người hướng dẫn (BM04)',
                description: 'Giảng viên hướng dẫn đã đánh giá điều kiện bảo vệ',
                bucket: 'DONE',
                openAt: null,
                dueAt: null,
                target: '/student/submissions?work=BM04',
                canAct: false,
                sourceStatus: activeBm04.status || 'COMPLETED',
                completedAt: activeBm04.signedAt || activeBm04.createdAt || currentNow,
            });
        }
        const archiveSummary = buildArchiveDeadlineSummary(
            { ...registration, semester: registration?.semester || semester },
            activeArchive,
            currentNow
        );
        readyItems.push({
            id: 'work-archive',
            kind: 'SUBMIT_ARCHIVE',
            title: status === 'ARCHIVE_REJECTED' ? 'Bổ sung và nộp lại hồ sơ lưu chiểu' : 'Nộp hồ sơ lưu chiểu số',
            description:
                'Hoàn thiện và nộp đầy đủ tài liệu lưu chiểu sau bảo vệ để làm thủ tục công nhận hoàn thành đồ án.',
            bucket: 'READY',
            openAt: null,
            dueAt:
                archiveSummary.timeWindows.windowClosesAt
                || archiveSummary.timeWindows.softPreparationDeadlineAt
                || pickNextTaskDueDate(taskList)
                || null,
            target: '/student/submissions?work=SUBMIT_ARCHIVE',
            canAct: true,
            sourceStatus: status,
            completedAt: null,
            meta: {
                archiveSummary,
            },
        });
    }

    // Giai đoạn DEFENDED
    else if (status === 'DEFENDED') {
        if (allowedSet.has('SUBMIT_ARCHIVE')) {
            const archiveSummary = buildArchiveDeadlineSummary(
                { ...registration, semester: registration?.semester || semester },
                activeArchive,
                currentNow
            );
            readyItems.push({
                id: 'work-archive',
                kind: 'SUBMIT_ARCHIVE',
                title: 'Nộp hồ sơ lưu chiểu số',
                description:
                    'Bạn đã hoàn thành bảo vệ. Hãy nộp đầy đủ hồ sơ lưu chiểu số để làm thủ tục công nhận hoàn thành.',
                bucket: 'READY',
                openAt: null,
                dueAt:
                    archiveSummary.timeWindows.windowClosesAt
                    || archiveSummary.timeWindows.softPreparationDeadlineAt
                    || pickNextTaskDueDate(taskList)
                    || null,
                target: '/student/submissions?work=SUBMIT_ARCHIVE',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
                meta: {
                    archiveSummary,
                },
            });
        } else {
            readyItems.push({
                id: 'view-grades',
                kind: 'VIEW_GRADES_CERTIFICATE',
                title: 'Xem kết quả và giấy xác nhận hoàn thành',
                description:
                    'Bạn đã hoàn thành bảo vệ đồ án tốt nghiệp. Bạn có thể theo dõi kết quả và thông tin hoàn thành.',
                bucket: 'READY',
                openAt: null,
                dueAt: null,
                target: '/student/grades',
                canAct: true,
                sourceStatus: status,
                completedAt: null,
            });
        }
    }

    // Giai đoạn PENDING_INSTITUTE_SIGNATURE
    else if (status === 'PENDING_INSTITUTE_SIGNATURE') {
        waitingStatus = {
            title: WAIT_ACTION_BY_STATUS.PENDING_INSTITUTE_SIGNATURE.title,
            description: WAIT_ACTION_BY_STATUS.PENDING_INSTITUTE_SIGNATURE.description,
            sourceStatus: status,
        };
    }

    // Giai đoạn COMPLETED
    else if (status === 'COMPLETED') {
        doneItems.push({
            id: 'done-archive',
            kind: 'SUBMIT_ARCHIVE',
            title: 'Hồ sơ lưu chiểu số',
            description: 'Đã hoàn tất lưu chiểu và cấp giấy xác nhận hoàn thành đồ án',
            bucket: 'DONE',
            openAt: null,
            dueAt: null,
            target: '/student/submissions?work=SUBMIT_ARCHIVE',
            canAct: false,
            sourceStatus: status,
            completedAt: activeArchive?.certificateSignedAt || registration.updatedAt || currentNow,
        });

        readyItems.push({
            id: 'view-grades',
            kind: 'VIEW_GRADES_CERTIFICATE',
            title: 'Xem kết quả và giấy xác nhận hoàn thành',
            description:
                'Bạn đã hoàn thành đồ án tốt nghiệp. Bạn có thể xem kết quả chính thức và giấy xác nhận hoàn thành.',
            bucket: 'READY',
            openAt: null,
            dueAt: null,
            target: '/student/grades',
            canAct: true,
            sourceStatus: status,
            completedAt: null,
        });
    }

    // 5. Lọc UPCOMING: Không lặp việc đã có ở READY, chỉ giữ mốc thật trong 7 ngày tới
    const readyKinds = new Set(readyItems.map((item) => item.kind));
    const filteredUpcoming = upcomingItems.filter((item) => {
        if (readyKinds.has(item.kind)) return false;
        const hasRealisticDate =
            isWithin7Days(item.openAt, currentNow) || isWithin7Days(item.dueAt, currentNow);
        return Boolean(hasRealisticDate && (item.openAt || item.dueAt));
    });

    // 6. Sắp xếp READY: Quá hạn -> Gần hạn / 48h (BM03_ACK) / sửa nộp lại (BM01_RESUBMIT) -> thường theo dueAt
    readyItems.sort((a, b) => {
        const aDue = a.dueAt ? toValidDate(a.dueAt) : null;
        const bDue = b.dueAt ? toValidDate(b.dueAt) : null;
        const aOverdue = Boolean(aDue && aDue < currentNow);
        const bOverdue = Boolean(bDue && bDue < currentNow);

        // 1. Quá hạn đứng trước
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (aOverdue && bOverdue) return aDue.getTime() - bDue.getTime();

        // 2. Việc 48h (BM03_ACK) hoặc sửa nộp lại (BM01_RESUBMIT)
        const isUrgent = (item) => ['BM03_ACK', 'BM01_RESUBMIT', 'BM02_RESUBMIT'].includes(item.kind);
        const aUrgent = isUrgent(a);
        const bUrgent = isUrgent(b);

        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;

        // 3. Sắp xếp theo hạn chót gần nhất
        if (aDue && bDue) return aDue.getTime() - bDue.getTime();
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        return 0;
    });

    // 7. Sắp xếp DONE: Mới nhất lên đầu (completedAt giảm dần)
    doneItems.sort((a, b) => {
        const aTime = a.completedAt ? toValidDate(a.completedAt)?.getTime() || 0 : 0;
        const bTime = b.completedAt ? toValidDate(b.completedAt)?.getTime() || 0 : 0;
        return bTime - aTime;
    });

    // 8. Chọn nextAction từ READY ưu tiên, hoặc waitingStatus nếu không có READY
    let nextAction = null;
    if (readyItems.length > 0) {
        const topReady = readyItems[0];
        nextAction = {
            kind: topReady.kind,
            title: topReady.title,
            description: topReady.description,
            dueAt: topReady.dueAt,
            target: topReady.target,
            sourceStatus: topReady.sourceStatus,
            canAct: true,
        };
    } else if (waitingStatus) {
        const fallbackKind =
            WAIT_ACTION_BY_STATUS[status]?.kind ||
            (status === 'APPROVED'
                ? 'BM01_INITIAL'
                : status === 'BM01_NEEDS_REVISION'
                ? 'BM01_RESUBMIT'
                : ['BM01_PASSED', 'BM02_OPEN', 'BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED'].includes(status)
                ? 'BM02'
                : ['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03', 'SIGNATURE_APPEAL_RESOLVED'].includes(status)
                ? 'SUBMIT_PROGRESS_BM03'
                : 'WAIT_ACTION');

        nextAction = {
            kind: fallbackKind,
            title: waitingStatus.title,
            description: waitingStatus.description,
            dueAt: status === 'APPROVED' ? semester?.outlineSubmissionDeadline || null : null,
            target: null,
            sourceStatus: waitingStatus.sourceStatus || status,
            canAct: false,
        };
    }

    const workItems = [...readyItems, ...filteredUpcoming, ...doneItems];

    return {
        workItems,
        waitingStatus,
        nextAction,
    };
}

module.exports = {
    buildStudentWorkState,
};
