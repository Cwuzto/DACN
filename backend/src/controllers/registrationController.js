const prisma = require('../config/database');
const {
    DEFAULT_MAX_STUDENTS_PER_MENTOR,
    ACTIVE_REGISTRATION_STATUSES,
    getMentorMaxSlots,
} = require('../constants/mentorCapacity');
const { calculateMentorPeakWorkload, formatWorkloadExceededMessage } = require('../utils/workloadSweep');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const { getDefaultSemester } = require('../utils/semesterResolver');
const { hasCompletedGraduationProject, STUDENT_RESTRICTION_MESSAGE } = require('../utils/studentAccountRestriction');
const { transitionRegistration, WorkflowTransitionError } = require('../services/registrationTransitionService');
const { submitBM02: submitBM02Command } = require('../services/academicDocumentService');
const { reviewBM01 } = require('../services/bm01WorkflowService');
const { reviewBM02 } = require('../services/bm02ReviewService');
const { transferMentor } = require('../services/mentorTransferService');
const { computeAllowedActions } = require('../services/workflowActionService');

const SERIALIZATION_ERROR_CODE = 'P2034';
const MENTOR_ACTIVE_REGISTRATION_STATUSES = Array.from(new Set([
    'PENDING',
    ...(ACTIVE_REGISTRATION_STATUSES || []),
]));
const MENTOR_APPROVED_REGISTRATION_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'AWAITING_SCORES', 'AWAITING_FINAL_APPROVAL', 'DEFENSE_PASSED', 'DEFENSE_FAILED', 'DEFENDED', 'COMPLETED'];
const PRE_DECISION_CANCELLABLE_STATUSES = [
    'PENDING',
    'APPROVED',
    'BM01_SUBMITTED',
    'BM01_NEEDS_REVISION',
    'BM01_PASSED',
    'BM02_SUBMITTED',
];

const createHttpError = (statusCode, message, code = null) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
};

const mentorLocks = new Map();

const acquireMentorLock = async (mentorId) => {
    while (mentorLocks.has(mentorId)) {
        await mentorLocks.get(mentorId);
    }
    let release;
    const lockPromise = new Promise((resolve) => {
        release = resolve;
    });
    mentorLocks.set(mentorId, lockPromise);
    return () => {
        mentorLocks.delete(mentorId);
        release();
    };
};

const isSerializationConflict = (error) => error?.code === SERIALIZATION_ERROR_CODE;
const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;
const getIdempotencyKey = (req) => req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'] || req.body?.idempotencyKey;
const sendWorkflowError = (res, error) => {
    if (error instanceof WorkflowTransitionError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return false;
};
const getPendingCutoffDate = (days = PENDING_REMINDER_DAYS) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
};

const fetchRegistrationWithContext = async (idInt) => prisma.topicRegistration.findUnique({
    where: { id: idInt },
    include: {
        topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
        student: { select: { id: true, fullName: true, code: true } },
        defenseResult: { select: { id: true } },
    },
});

/**
 * POST /api/registrations
 */
const registerTopic = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { topicId, semesterId } = req.body;
        const topicIdInt = parseInt(topicId, 10);
        const semesterIdInt = parseInt(semesterId, 10);
        const restricted = await hasCompletedGraduationProject(studentId);

        if (restricted) {
            return res.status(403).json({ success: false, message: STUDENT_RESTRICTION_MESSAGE });
        }

        if (!topicId || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn đề tài và đợt đồ án.' });
        }
        if (!Number.isInteger(topicIdInt)) {
            return res.status(400).json({ success: false, message: 'Đề tài không hợp lệ.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Đợt đồ án không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterIdInt },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                registrationDeadline: true,
                registrationOpen: true,
            },
        });

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đồ án.' });
        }

        if (!semester.registrationOpen) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án hiện đang đóng đăng ký. Vui lòng liên hệ quản trị viên.',
            });
        }

        const now = new Date();
        if (semester.startDate && now < new Date(semester.startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án chưa đến thời gian mở đăng ký.',
            });
        }

        if (semester.registrationDeadline && now > new Date(semester.registrationDeadline)) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án đã quá hạn đăng ký.',
            });
        }

        const preCheckTopic = await prisma.topic.findUnique({
            where: { id: topicIdInt },
            select: { mentorId: true },
        });

        const releaseMentorLock = preCheckTopic?.mentorId
            ? await acquireMentorLock(preCheckTopic.mentorId)
            : null;

        let registration;
        let mentorId;
        let topicTitle;

        try {
            const txResult = await prisma.$transaction(async (tx) => {
                const activePolicies = await tx.periodWorkflowPolicyVersion.findMany({
                    where: { semesterId: semesterIdInt, isActive: true },
                });

                if (!activePolicies || activePolicies.length === 0) {
                    throw createHttpError(
                        400,
                        'Đợt đồ án chưa cấu hình chính sách quy trình hợp lệ.',
                        'POLICY_UNAVAILABLE',
                    );
                }

                if (activePolicies.length > 1) {
                    throw createHttpError(
                        409,
                        'Phát hiện nhiều hơn 1 phiên bản chính sách quy trình đang hoạt động đồng thời. Vui lòng liên hệ Quản trị viên để chuẩn hóa.',
                        'POLICY_UNAVAILABLE',
                    );
                }

                const activePolicy = activePolicies[0];

                const existingReg = await tx.topicRegistration.findUnique({
                    where: { studentId_semesterId: { studentId, semesterId: semesterIdInt } },
                });

                if (existingReg) {
                    if (existingReg.status === 'REJECTED') {
                        await tx.topicRegistration.delete({ where: { id: existingReg.id } });
                    } else {
                        throw createHttpError(
                            400,
                            'Bạn đã đăng ký đề tài trong kỳ này. Chỉ có thể đổi khi bị từ chối.',
                        );
                    }
                }

                const topic = await tx.topic.findUnique({
                    where: { id: topicIdInt },
                    include: {
                        mentor: { select: { id: true, academicTitle: true } },
                        _count: { select: { registrations: true } },
                        projectCatalog: { select: { id: true, name: true } },
                    },
                });

                if (!topic || topic.status !== 'APPROVED') {
                    throw createHttpError(400, 'Đề tài không tồn tại hoặc chưa được duyệt.');
                }

                if (topic.semesterId !== semesterIdInt) {
                    throw createHttpError(400, 'Đề tài không thuộc đợt đăng ký hiện tại.');
                }

                if (!topic.projectCatalogId) {
                    throw createHttpError(400, 'Đề tài chưa được gắn tên đồ án. Vui lòng liên hệ quản trị viên.');
                }

                const enrollment = await tx.studentProjectEnrollment.findFirst({
                    where: {
                        studentId,
                        semesterId: semesterIdInt,
                        projectCatalogId: topic.projectCatalogId,
                        status: 'ACTIVE',
                    },
                    select: { id: true },
                });

                if (!enrollment) {
                    throw createHttpError(
                        400,
                        `Bạn chưa đăng ký môn "${topic.projectCatalog?.name || 'đồ án này'}" trong đợt hiện tại nên không thể đăng ký đề tài.`,
                    );
                }

                if (topic._count.registrations >= 1) {
                    throw createHttpError(400, 'Đề tài này đã có sinh viên đăng ký.');
                }

                // Pessimistic row-level lock on LecturerProjectAssignment
                if (typeof tx.$queryRaw === 'function') {
                    await tx.$queryRaw`
                        SELECT id FROM lecturer_project_assignments 
                        WHERE lecturer_id = ${topic.mentorId} AND semester_id = ${semesterIdInt} 
                        FOR UPDATE
                    `;
                }

                let mentorAssignment = null;
                if (tx.lecturerProjectAssignment) {
                    mentorAssignment = await tx.lecturerProjectAssignment.findFirst({
                        where: {
                            lecturerId: topic.mentorId,
                            semesterId: semesterIdInt,
                            status: 'ACTIVE',
                        },
                    });

                    if (!mentorAssignment) {
                        throw createHttpError(
                            400,
                            'Giảng viên hướng dẫn chưa được phân công nhiệm vụ trong đợt đồ án này.',
                            'MENTOR_NOT_ASSIGNED',
                        );
                    }
                }

                const roundQuota = mentorAssignment?.plannedQuota !== undefined
                    ? mentorAssignment.plannedQuota
                    : (getMentorMaxSlots(topic.mentor?.academicTitle) || DEFAULT_MAX_STUDENTS_PER_MENTOR || 10);

                const mentorStudentCount = await tx.topicRegistration.count({
                    where: {
                        topic: { mentorId: topic.mentorId, semesterId: semesterIdInt },
                        status: { in: MENTOR_ACTIVE_REGISTRATION_STATUSES },
                    },
                });

                if (mentorStudentCount >= roundQuota) {
                    throw createHttpError(
                        400,
                        `Giảng viên đã đạt giới hạn chỉ tiêu hướng dẫn trong đợt này (${roundQuota} sinh viên).`,
                        'MENTOR_CAPACITY_EXCEEDED',
                    );
                }

                // Workload sweep across overlapping rounds
                const existingRegistrations = await tx.topicRegistration.findMany({
                    where: {
                        topic: { mentorId: topic.mentorId },
                        status: { in: MENTOR_ACTIVE_REGISTRATION_STATUSES },
                    },
                    include: {
                        topic: {
                            select: {
                                id: true,
                                mentorId: true,
                                semester: {
                                    select: { id: true, name: true, startDate: true, endDate: true },
                                },
                            },
                        },
                    },
                });

                const candidateInterval = {
                    semester: {
                        id: semester.id,
                        name: semester.name,
                        startDate: semester.startDate,
                        endDate: semester.endDate,
                    },
                    startDate: semester.startDate,
                    endDate: semester.endDate,
                    name: semester.name,
                };

                const workloadResult = calculateMentorPeakWorkload({
                    existingRegistrations,
                    candidateInterval,
                });

                if (workloadResult.isExceeded || workloadResult.peakLoad > 10) {
                    const baselineWorkload = calculateMentorPeakWorkload({ existingRegistrations });
                    const currentPeak = baselineWorkload.peakLoad;
                    const message = formatWorkloadExceededMessage({
                        currentPeak: currentPeak > 0 ? currentPeak : 10,
                        newPeak: workloadResult.peakLoad,
                        peakStart: workloadResult.peakInterval?.start,
                        peakEnd: workloadResult.peakInterval?.end,
                        conflictingRounds: workloadResult.peakInterval?.semesterNames || [],
                    });
                    throw createHttpError(400, message, 'MENTOR_WORKLOAD_EXCEEDED');
                }

                const created = await tx.topicRegistration.create({
                    data: {
                        topicId: topicIdInt,
                        studentId,
                        semesterId: semesterIdInt,
                        status: 'PENDING',
                        assignmentStatus: 'ACTIVE',
                        effectiveAt: new Date(),
                        periodPolicyVersionId: activePolicy.id,
                    },
                    include: {
                        topic: {
                            select: {
                                title: true,
                                mentor: { select: { fullName: true } },
                                projectCatalog: { select: { id: true, name: true } },
                            },
                        },
                    },
                });

                // Tự động thu hồi/dọn dẹp các đề tài do sinh viên này tự đề xuất đang chờ duyệt trong cùng đợt (nếu có)
                if (tx.topic?.deleteMany) {
                    await tx.topic.deleteMany({
                        where: {
                            proposedById: studentId,
                            semesterId: semesterIdInt,
                            status: 'PENDING',
                        },
                    });
                }

                return {
                    registration: created,
                    mentorId: topic.mentorId,
                    topicTitle: topic.title,
                };
            }, { isolationLevel: 'Serializable' });

            registration = txResult.registration;
            mentorId = txResult.mentorId;
            topicTitle = txResult.topicTitle;
        } finally {
            if (releaseMentorLock) {
                releaseMentorLock();
            }
        }

        await safeNotify(
            {
                userId: mentorId,
                title: 'Sinh viên đăng ký đề tài',
                content: `${req.user.fullName} (${req.user.code}) đã đăng ký đề tài "${topicTitle}".`,
                type: 'REGISTRATION',
            },
            'registerTopic',
        );

        res.status(201).json({
            success: true,
            message: 'Đăng ký đề tài thành công! Chờ giảng viên phê duyệt.',
            data: registration,
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi đăng ký do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            const payload = { success: false, message: error.message };
            if (error.code) payload.code = error.code;
            return res.status(error.statusCode).json(payload);
        }
        next(error);
    }
};

/**
 * GET /api/registrations/my
 */
const getMyRegistration = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const semesterIdQuery = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let targetSemesterId = semesterIdQuery;
        const restricted = await hasCompletedGraduationProject(studentId);

        if (!targetSemesterId) {
            const defaultSemester = await getDefaultSemester({ id: true });
            targetSemesterId = defaultSemester?.id || null;
        }

        if (!targetSemesterId) {
            return res.json({
                success: true,
                data: null,
                message: 'Hiện chưa có đợt đồ án đang hoạt động.',
            });
        }

        const registration = await prisma.topicRegistration.findFirst({
            where: {
                studentId,
                semesterId: targetSemesterId,
            },
            include: {
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, code: true, email: true, department: true, academicTitle: true } },
                    },
                },
                meetingLogs: {
                    include: {
                        creator: { select: { fullName: true, code: true } },
                    },
                    orderBy: { meetingDate: 'desc' },
                },
                tasks: {
                    include: { submissions: { where: { submittedBy: studentId } } },
                    orderBy: { dueDate: 'asc' },
                },
                council: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                outlineCouncil: {
                    select: {
                        id: true,
                        name: true,
                        councilType: true,
                        defenseDate: true,
                        location: true,
                        members: {
                            select: {
                                lecturerId: true,
                                roleInCouncil: true,
                                lecturer: { select: { id: true, fullName: true, code: true } },
                            },
                        },
                    },
                },
                submissions: { orderBy: { submittedAt: 'desc' }, take: 5 },
                defenseCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                defenseResult: true,
                bm01Evaluations: { orderBy: { attemptNo: 'desc' }, take: 2 },
                currentBM02Submission: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!registration) {
            return res.json({ success: true, data: null, message: 'Bạn chưa đăng ký đề tài nào.' });
        }

        const allowedActions = computeAllowedActions(registration, req.user);
        res.json({ success: true, data: { ...registration, allowedActions } });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/my-project-enrollments
 */
const getMyProjectEnrollments = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const semesterIdQuery = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let targetSemesterId = semesterIdQuery;
        const restricted = await hasCompletedGraduationProject(studentId);

        if (!targetSemesterId) {
            const defaultSemester = await getDefaultSemester({ id: true });
            targetSemesterId = defaultSemester?.id || null;
        }

        if (!targetSemesterId) {
            return res.json({
                success: true,
                data: [],
                meta: {
                    semesterId: null,
                    accountRestricted: restricted,
                    accountRestrictionReason: restricted ? STUDENT_RESTRICTION_MESSAGE : null,
                },
                message: 'Hiện chưa có đợt đồ án hoạt động.',
            });
        }

        const rows = await prisma.studentProjectEnrollment.findMany({
            where: {
                studentId,
                semesterId: targetSemesterId,
            },
            include: {
                projectCatalog: { select: { id: true, code: true, name: true, isActive: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json({
            success: true,
            data: rows,
            meta: {
                semesterId: targetSemesterId,
                accountRestricted: restricted,
                accountRestrictionReason: restricted ? STUDENT_RESTRICTION_MESSAGE : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations
 */
const getAllRegistrations = async (req, res, next) => {
    try {
        const { role, id: userId, permissions = [], permissionGroups = [] } = req.user;
        const {
            semesterId,
            status,
            unassignedCouncilOnly,
            councilType,
            stalePendingOnly,
            asCouncilChairman,
            asInstituteDirector,
            scope,
        } = req.query;

        const where = {};

        const hasInstituteAuthority =
            role === 'ADMIN' ||
            permissionGroups.includes('VIEN_TRUONG') ||
            permissions.includes('BM02_REVIEW') ||
            permissions.includes('VIEW_BM02_REVIEWS') ||
            permissions.includes('PROJECT_PERIOD_MANAGE') ||
            permissions.includes('VIEW_PROJECT_PERIODS') ||
            permissions.includes('PROJECT_ASSIGNMENT_PUBLISH') ||
            permissions.includes('VIEW_ASSIGNMENT_DECISIONS') ||
            permissions.includes('PERMISSION_ASSIGN_ACADEMIC');

        const shouldViewInstituteScope =
            (asInstituteDirector === 'true' || scope === 'all' || scope === 'institute') && hasInstituteAuthority;

        if (role === 'LECTURER') {
            if (shouldViewInstituteScope) {
                // Viện trưởng hoặc cấp quản trị xem toàn viện trong đợt đồ án (BM02 queue, ban hành QĐ)
            } else if (asCouncilChairman === 'true') {
                where.outlineCouncil = {
                    members: {
                        some: {
                            lecturerId: userId,
                            roleInCouncil: 'CHAIRMAN',
                        },
                    },
                };
            } else {
                where.topic = { mentorId: userId };
            }
        }

        if (semesterId) {
            where.semesterId = parseInt(semesterId, 10);
        } else if (role === 'LECTURER' && !shouldViewInstituteScope) {
            const defaultSemester = await getDefaultSemester({ id: true });
            if (!defaultSemester) {
                return res.json({ success: true, data: [] });
            }
            where.semesterId = defaultSemester.id;
        }

        if (status) {
            if (status.includes(',')) {
                where.status = { in: status.split(',').map((s) => s.trim()) };
            } else {
                where.status = status;
            }
        } else if (role === 'LECTURER' && asCouncilChairman === 'true') {
            where.status = { in: ['BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_PASSED'] };
        }

        if (unassignedCouncilOnly === 'true') {
            if (councilType === 'OUTLINE_REVIEW') {
                where.outlineCouncilId = null;
                where.status = { in: ['REGISTERED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'APPROVED', 'IN_PROGRESS'] };
            } else {
                where.defenseCouncilId = null;
                where.status = 'DEFENSE_READY';
            }
        }

        if (stalePendingOnly === 'true') {
            where.status = 'PENDING';
            where.createdAt = { lte: getPendingCutoffDate() };
        }

        const registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        email: true,
                        department: true,
                        studentProfile: {
                            select: {
                                className: true,
                                major: true,
                            },
                        },
                    },
                },
                topic: { select: { id: true, title: true, mentorId: true, mentor: { select: { id: true, fullName: true, email: true } } } },
                council: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                outlineCouncil: {
                    include: {
                        members: {
                            include: {
                                lecturer: { select: { id: true, fullName: true, email: true } },
                            },
                        },
                    },
                },
                defenseCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                submissions: { orderBy: { submittedAt: 'desc' }, take: 5 },
                _count: { select: { submissions: true } },
                tasks: { select: { id: true, status: true, taskType: true } },
                meetingLogs: { select: { id: true, meetingDate: true }, orderBy: { meetingDate: 'desc' } },
                bm04Evaluation: true,
                titleAdjustments: { orderBy: { requestedAt: 'desc' } },
                currentBM02Submission: true,
                assignmentDecisions: {
                    include: {
                        amendments: {
                            orderBy: { createdAt: 'desc' },
                        },
                    },
                    orderBy: { issuedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const registrationIds = registrations.map((reg) => reg.id);
        const overdueCounts = registrationIds.length > 0
            ? await prisma.task.groupBy({
                by: ['registrationId'],
                where: {
                    registrationId: { in: registrationIds },
                    dueDate: { lt: new Date() },
                    status: { in: ['OPEN', 'IN_PROGRESS'] },
                },
                _count: { _all: true },
            })
            : [];

        const overdueCountMap = new Map(
            overdueCounts.map((item) => [item.registrationId, item._count._all || 0]),
        );

        const now = new Date();
        const enhanced = registrations.map((reg) => {
            const tasks = reg.tasks || [];
            const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
            const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
            const overdueTaskCount = overdueCountMap.get(reg.id) || 0;
            const pendingDays = reg.status === 'PENDING'
                ? Math.floor((now.getTime() - new Date(reg.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            const meetingLogs = reg.meetingLogs || [];
            const lastMeetingDate = meetingLogs.length > 0 ? meetingLogs[0].meetingDate : null;
            let daysSinceLastMeeting = null;
            if (lastMeetingDate) {
                daysSinceLastMeeting = Math.floor((now.getTime() - new Date(lastMeetingDate).getTime()) / (1000 * 60 * 60 * 24));
            }

            return {
                ...reg,
                allowedActions: computeAllowedActions(reg, req.user),
                progress,
                overdueTaskCount,
                hasOverdueTask: overdueTaskCount > 0,
                isStalePending: reg.status === 'PENDING' && pendingDays > PENDING_REMINDER_DAYS,
                pendingDays,
                totalMeetings: meetingLogs.length,
                lastMeetingDate,
                daysSinceLastMeeting,
                isMeetingWarning: daysSinceLastMeeting !== null && daysSinceLastMeeting > 21,
                tasks: undefined,
                meetingLogs: undefined,
            };
        });

        res.json({ success: true, data: enhanced });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/approve
 */
const handleRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const idInt = parseInt(id, 10);
        const { action, rejectReason } = req.body;
        const { role, id: userId } = req.user;

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Hành động phải là APPROVE hoặc REJECT.' });
        }

        if (action === 'APPROVE') {
            const reg = await prisma.$transaction(async (tx) => {
                const currentReg = await tx.topicRegistration.findUnique({
                    where: { id: idInt },
                    include: {
                        topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
                        student: { select: { id: true, fullName: true, code: true } },
                    },
                });

                if (!currentReg) {
                    throw createHttpError(404, 'Không tìm thấy đăng ký.');
                }

                if (currentReg.status !== 'PENDING') {
                    throw createHttpError(400, `Đăng ký đang ở trạng thái: ${currentReg.status}. Chỉ xử lý khi PENDING.`);
                }

                if (role === 'LECTURER' && currentReg.topic.mentorId !== userId) {
                    throw createHttpError(403, 'Bạn không có quyền duyệt đăng ký này.');
                }

                const mentor = currentReg.topic.mentor;
                const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
                const currentCount = await tx.topicRegistration.count({
                    where: {
                        topic: { mentorId: mentor.id, semesterId: currentReg.semesterId },
                        status: { in: MENTOR_APPROVED_REGISTRATION_STATUSES },
                    },
                });

                if (currentCount >= maxSlots) {
                    throw createHttpError(400, `Đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.`);
                }

                await tx.topicRegistration.update({
                    where: { id: idInt },
                    data: { status: 'APPROVED', rejectReason: null },
                });

                return currentReg;
            }, { isolationLevel: 'Serializable' });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài được duyệt',
                    content: `Đề tài "${reg.topic.title}" đã được phê duyệt. Bạn có thể bắt đầu thực hiện.`,
                    type: 'APPROVAL',
                },
                'handleRegistration_APPROVE',
            );

            await auditLog(
                userId,
                'APPROVE_REGISTRATION',
                'TopicRegistration',
                idInt,
                { byRole: role },
                getRequestIp(req),
            );
        } else {
            const reg = await fetchRegistrationWithContext(idInt);

            if (!reg) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
            }

            if (reg.status !== 'PENDING') {
                return res.status(400).json({ success: false, message: `Đăng ký đang ở trạng thái: ${reg.status}. Chỉ xử lý khi PENDING.` });
            }

            if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đăng ký này.' });
            }

            if (!rejectReason) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài bị từ chối',
                    content: `Đề tài "${reg.topic.title}" bị từ chối. Lý do: ${rejectReason}. Bạn có thể đăng ký đề tài khác.`,
                    type: 'APPROVAL',
                },
                'handleRegistration_REJECT',
            );

            await auditLog(
                userId,
                'REJECT_REGISTRATION',
                'TopicRegistration',
                idInt,
                { byRole: role, reason: rejectReason },
                getRequestIp(req),
            );
        }

        res.json({
            success: true,
            message: action === 'APPROVE' ? 'Đã phê duyệt đăng ký.' : 'Đã từ chối đăng ký.',
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi duyệt đăng ký do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/drop
 */
const dropRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const { role, id: userId } = req.user;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do drop là bắt buộc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền drop đăng ký này.' });
        }

        if (!PRE_DECISION_CANCELLABLE_STATUSES.includes(reg.status)) {
            return res.status(409).json({
                success: false,
                code: 'INVALID_TRANSITION',
                message: 'Không thể hủy hồ sơ sau khi Quyết định giao đề tài đã được ban hành.',
            });
        }

        await prisma.$transaction(async (tx) => {
            await transitionRegistration({
                registrationId: idInt,
                expectedStatus: reg.status,
                expectedStateVersion: reg.stateVersion ?? 0,
                targetStatus: 'DROPPED',
                actorId: userId,
                reason: String(reason).trim(),
                reference: { command: 'DROP_REGISTRATION', actorRole: role },
                idempotencyKey: getIdempotencyKey(req),
                changes: { rejectReason: String(reason).trim(), councilId: null },
            }, { tx });

            await tx.task.updateMany({
                where: {
                    registrationId: idInt,
                    status: { not: 'COMPLETED' },
                },
                data: { status: 'OVERDUE' },
            });
        });

        await safeNotify(
            {
                userId: reg.studentId,
                title: 'Đăng ký đồ án bị hủy',
                content: `Đăng ký đề tài "${reg.topic.title}" đã bị hủy. Lý do: ${reason}`,
                type: 'APPROVAL',
            },
            'dropRegistration',
        );

        await auditLog(
            userId,
            'DROP_REGISTRATION',
            'TopicRegistration',
            idInt,
            { byRole: role, reason: String(reason).trim() },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã drop đăng ký thành công.' });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/registrations/:id/withdraw
 */
const withdrawRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const { role, id: userId } = req.user;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do rút đăng ký là bắt buộc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        const canAccess = role === 'ADMIN'
            || (role === 'STUDENT' && reg.studentId === userId)
            || (role === 'LECTURER' && reg.topic.mentorId === userId);

        if (!canAccess) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền rút đăng ký này.' });
        }

        if (!PRE_DECISION_CANCELLABLE_STATUSES.includes(reg.status)) {
            return res.status(409).json({
                success: false,
                code: 'INVALID_TRANSITION',
                message: 'Không thể rút hồ sơ sau khi Quyết định giao đề tài đã được ban hành.',
            });
        }

        await transitionRegistration({
            registrationId: idInt,
            expectedStatus: reg.status,
            expectedStateVersion: reg.stateVersion ?? 0,
            targetStatus: 'WITHDRAWN',
            actorId: userId,
            reason: String(reason).trim(),
            reference: { command: 'WITHDRAW_REGISTRATION', actorRole: role },
            idempotencyKey: getIdempotencyKey(req),
            changes: { rejectReason: String(reason).trim(), councilId: null },
        });

        await safeNotify(
            {
                userId: role === 'STUDENT' ? reg.topic.mentorId : reg.studentId,
                title: 'Yêu cầu rút đăng ký đề tài',
                content: `${role === 'STUDENT' ? reg.student.fullName : 'Giảng viên/Admin'} đã rút đăng ký đề tài "${reg.topic.title}". Lý do: ${reason}`,
                type: 'REGISTRATION',
            },
            'withdrawRegistration',
        );

        await auditLog(
            userId,
            'WITHDRAW_REGISTRATION',
            'TopicRegistration',
            idInt,
            { byRole: role, reason: String(reason).trim() },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã rút đăng ký thành công.' });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/force-decision
 */
const forceDecisionRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { action, rejectReason } = req.body;
        const adminId = req.user.id;

        if (!['FORCE_APPROVE', 'FORCE_REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là FORCE_APPROVE hoặc FORCE_REJECT.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chỉ force decision được với đăng ký PENDING.' });
        }

        if (action === 'FORCE_APPROVE') {
            await prisma.$transaction(async (tx) => {
                const maxSlots = getMentorMaxSlots(reg.topic.mentor?.academicTitle);
                const currentCount = await tx.topicRegistration.count({
                    where: {
                        topic: { mentorId: reg.topic.mentorId, semesterId: reg.semesterId },
                        status: { in: MENTOR_APPROVED_REGISTRATION_STATUSES },
                    },
                });

                if (currentCount >= maxSlots) {
                    throw createHttpError(400, `Đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.`);
                }

                await tx.topicRegistration.update({
                    where: { id: idInt },
                    data: { status: 'APPROVED', rejectReason: null },
                });
            }, { isolationLevel: 'Serializable' });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài được duyệt bởi Admin',
                    content: `Admin đã force-approve đăng ký đề tài "${reg.topic.title}".`,
                    type: 'APPROVAL',
                },
                'forceDecisionRegistration_FORCE_APPROVE',
            );
        } else {
            if (!rejectReason || !String(rejectReason).trim()) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do force reject.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason: String(rejectReason).trim() },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài bị từ chối bởi Admin',
                    content: `Admin đã force-reject đăng ký đề tài "${reg.topic.title}". Lý do: ${rejectReason}`,
                    type: 'APPROVAL',
                },
                'forceDecisionRegistration_FORCE_REJECT',
            );
        }

        await auditLog(
            adminId,
            action,
            'TopicRegistration',
            idInt,
            { reason: rejectReason || null },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã xử lý force decision thành công.' });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi force approve do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * DELETE /api/registrations/:id
 */
const cancelRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;
        const idInt = parseInt(id, 10);

        const reg = await prisma.topicRegistration.findUnique({ where: { id: idInt } });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đăng ký này.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đăng ký khi đang chờ duyệt.' });
        }

        await transitionRegistration({
            registrationId: idInt,
            expectedStatus: 'PENDING',
            expectedStateVersion: reg.stateVersion ?? 0,
            targetStatus: 'WITHDRAWN',
            actorId: studentId,
            reason: 'Student cancelled pending registration',
            reference: { command: 'CANCEL_REGISTRATION' },
            idempotencyKey: getIdempotencyKey(req),
            changes: { councilId: null },
        });

        res.json({ success: true, message: 'Đã hủy đăng ký đề tài.' });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * PATCH or PUT /api/registrations/:id/outline-review
 * Cập nhật kết quả xét duyệt đề cương của Chủ tịch Hội đồng thẩm định (BM01)
 */
const updateOutlineReview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const status = req.body.status || req.body.decision;
        const feedback = req.body.feedback || req.body.reviewComment;

        const registrationId = parseInt(id, 10);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'ID đăng ký không hợp lệ.' });
        }

        const validStatuses = ['PASSED', 'REVISION_REQUIRED', 'NEEDS_REVISION'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái xét duyệt đề cương không hợp lệ.' });
        }

        const existing = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                outlineCouncil: {
                    include: { members: true },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lượt đăng ký.' });
        }

        const userPermissions = req.user?.permissions || [];
        const hasApproveCapability = userPermissions.includes('OUTLINE_APPROVE');
        const councilMembers = existing.outlineCouncil?.members || [];
        const membership = councilMembers.find((m) => m.lecturerId === req.user.id);

        if (membership) {
            if (membership.roleInCouncil !== 'CHAIRMAN') {
                return res.status(403).json({
                    success: false,
                    code: 'ONLY_CHAIRMAN_CAN_APPROVE_OUTLINE',
                    message: 'Chỉ Chủ tịch Hội đồng thẩm định đề cương mới có quyền kết luận duyệt hoặc yêu cầu chỉnh sửa đề cương.',
                });
            }
        } else if (!hasApproveCapability) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền cập nhật kết quả xét duyệt đề cương này.',
            });
        }

        const result = await reviewBM01({
            registrationId,
            reviewerId: req.user.id,
            attemptNo: 1,
            outcome: status === 'PASSED' ? 'PASSED' : 'NEEDS_REVISION',
            feedback,
            idempotencyKey: getIdempotencyKey(req),
        });

        if (!result.idempotent && existing.studentId) {
            await safeNotify(
                {
                    userId: existing.studentId,
                    title: status === 'PASSED' ? 'Đề cương BM01 đã được Hội đồng chấm ĐẠT' : 'Đề cương BM01 cần chỉnh sửa và thẩm định lại',
                    content: status === 'PASSED'
                        ? `Hội đồng xét duyệt đề cương đã chấm ĐẠT cho đề tài "${existing.topic?.title || ''}". Bạn có thể tiến hành nộp BM02.`
                        : `Hội đồng xét duyệt đề cương yêu cầu chỉnh sửa đề cương. Góp ý: ${feedback || 'Vui lòng sửa và nộp lại cho GVHD thẩm định.'}`,
                    type: 'APPROVAL',
                },
                'updateOutlineReview',
            );
        }

        res.json({
            success: true,
            message: status === 'PASSED'
                ? 'Đã ghi nhận kết quả ĐẠT cho đề cương. Đề tài chuyển sang trạng thái BM01_PASSED.'
                : 'Đã ghi nhận yêu cầu chỉnh sửa đề cương. Đề tài chuyển sang trạng thái BM01_NEEDS_REVISION.',
            data: result,
        });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/registrations/bm02-submit
 * Sinh viên nộp đơn đăng ký đề tài chính thức BM02 sau khi BM01 đã ĐẠT
 */
const submitBM02 = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { registrationId, officialTitle, content, fileUrl, fileName } = req.body;

        const regIdInt = parseInt(registrationId, 10);
        if (!Number.isInteger(regIdInt) || regIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (officialTitle && String(officialTitle).trim()) {
            return res.status(409).json({ success: false, code: 'TITLE_AMENDMENT_REQUIRED', message: 'Tên đề tài phải được điều chỉnh qua quy trình điều chỉnh có audit.' });
        }

        const commandSubmission = await submitBM02Command({
            registrationId: regIdInt,
            studentId,
            content,
            fileUrl,
            fileName,
            idempotencyKey: getIdempotencyKey(req),
        });
        await auditLog(studentId, 'SUBMIT_BM02', 'BM02Submission', commandSubmission.id, {
            registrationId: regIdInt,
            versionNo: commandSubmission.versionNo,
        }, getRequestIp(req));
        return res.status(201).json({ success: true, data: commandSubmission });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/registrations/bm02/:id/review
 * Viện thẩm định phiên bản BM02 hiện hành.
 */
const reviewCurrentBM02 = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id, 10);
        const { action, issues } = req.body;
        const context = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            select: {
                id: true,
                studentId: true,
                topic: { select: { title: true } },
            },
        });
        if (!context) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        const result = await reviewBM02({
            registrationId,
            reviewerId: req.user.id,
            action,
            issues,
            idempotencyKey: getIdempotencyKey(req),
        });

        if (!result.idempotent) {
            await safeNotify({
                userId: context.studentId,
                title: action === 'APPROVE' ? 'BM02 đã được Viện chấp thuận' : 'BM02 đã có kết quả thẩm định',
                content: action === 'APPROVE'
                    ? `BM02 của đề tài "${context.topic?.title || ''}" đã được chấp thuận.`
                    : `BM02 của đề tài "${context.topic?.title || ''}" có kết quả ${action}. Vui lòng xem chi tiết yêu cầu xử lý.`,
                type: 'APPROVAL',
            }, 'reviewCurrentBM02');
            await auditLog(
                req.user.id,
                'REVIEW_BM02',
                'BM02Submission',
                result.submission.id,
                { registrationId, action, issues: issues || null },
                getRequestIp(req),
            );
        }

        return res.json({
            success: true,
            message: 'Đã ghi nhận kết quả thẩm định BM02.',
            data: result,
        });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/registrations/adjust-title
 * Sinh viên gửi yêu cầu điều chỉnh tên đề tài trong thời hạn 7 ngày sau Quyết định của Viện
 */
const requestTitleAdjustment = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { registrationId, newTitle, reason } = req.body;

        const regIdInt = parseInt(registrationId, 10);
        if (!Number.isInteger(regIdInt) || regIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (!newTitle || !String(newTitle).trim()) {
            return res.status(400).json({ success: false, message: 'Tên đề tài mới không được để trống.' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do xin điều chỉnh tên đề tài là bắt buộc.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: regIdInt },
            include: { topic: true, student: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        if (registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xin điều chỉnh cho đề tài này.' });
        }

        if (!registration.decisionDate) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa có Quyết định giao đề tài chính thức từ Viện, chưa thể xin điều chỉnh tên.',
            });
        }

        const decisionTime = new Date(registration.decisionDate).getTime();
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const deadline = new Date(decisionTime + sevenDaysMs);

        if (now > deadline.getTime()) {
            return res.status(400).json({
                success: false,
                message: `Đã quá thời hạn 7 ngày cho phép điều chỉnh tên đề tài (Hạn chót: ${deadline.toLocaleDateString('vi-VN')}).`,
            });
        }

        const pendingAdjustment = await prisma.topicTitleAdjustment.findFirst({
            where: { registrationId: regIdInt, status: 'PENDING' },
        });

        if (pendingAdjustment) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã có một đơn xin đổi tên đề tài đang chờ GVHD xét duyệt.',
            });
        }

        const adjustment = await prisma.topicTitleAdjustment.create({
            data: {
                registrationId: regIdInt,
                originalTitle: registration.topic.title,
                newTitle: String(newTitle).trim(),
                reason: String(reason).trim(),
                deadline,
                status: 'PENDING',
            },
        });

        if (registration.topic?.mentorId) {
            await safeNotify(
                {
                    userId: registration.topic.mentorId,
                    title: 'Sinh viên xin điều chỉnh tên đề tài',
                    content: `Sinh viên ${registration.student?.fullName || ''} đã gửi đơn xin đổi tên đề tài từ "${registration.topic.title}" sang "${newTitle}". Vui lòng xem xét.`,
                    type: 'APPROVAL',
                },
                'requestTitleAdjustment',
            );
        }

        await auditLog(
            studentId,
            'REQUEST_TITLE_ADJUSTMENT',
            'TopicTitleAdjustment',
            adjustment.id,
            { registrationId: regIdInt, newTitle, reason },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã gửi đơn xin điều chỉnh tên đề tài thành công. Đang chờ GVHD phê duyệt.',
            data: adjustment,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/registrations/adjust-title/:id/review
 * GVHD phê duyệt hoặc từ chối đơn xin đổi tên đề tài
 */
const reviewTitleAdjustment = async (req, res, next) => {
    try {
        const adjustmentId = parseInt(req.params.id, 10);
        const { action, rejectionReason } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) {
            return res.status(400).json({ success: false, message: 'ID đơn điều chỉnh không hợp lệ.' });
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là APPROVE hoặc REJECT.' });
        }

        const adjustment = await prisma.topicTitleAdjustment.findUnique({
            where: { id: adjustmentId },
            include: {
                registration: {
                    include: { topic: true, student: true },
                },
            },
        });

        if (!adjustment) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn xin điều chỉnh tên đề tài.' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Đơn này đã được xử lý (trạng thái: ${adjustment.status}).` });
        }

        const isMentor = adjustment.registration.topic?.mentorId === userId;
        const isAdmin = role === 'ADMIN';

        if (!isMentor && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Chỉ giảng viên hướng dẫn của đề tài mới có quyền duyệt đơn này.' });
        }

        const isApproved = action === 'APPROVE';

        const updated = await prisma.$transaction(async (tx) => {
            const adjUpdated = await tx.topicTitleAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    status: isApproved ? 'APPROVED' : 'REJECTED',
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    rejectionReason: !isApproved ? (rejectionReason ? String(rejectionReason).trim() : 'Không đồng ý điều chỉnh') : null,
                },
            });

            if (isApproved) {
                await tx.topicRegistration.update({
                    where: { id: adjustment.registrationId },
                    data: { adjustedTitle: adjustment.newTitle },
                });

                await tx.topic.update({
                    where: { id: adjustment.registration.topicId },
                    data: { title: adjustment.newTitle },
                });
            }

            return adjUpdated;
        });

        await safeNotify(
            {
                userId: adjustment.registration.studentId,
                title: isApproved ? 'Đơn xin đổi tên đề tài đã được GVHD duyệt' : 'Đơn xin đổi tên đề tài bị từ chối',
                content: isApproved
                    ? `GVHD đã đồng ý đổi tên đề tài của bạn thành: "${adjustment.newTitle}". Tên này sẽ được áp dụng cho toàn bộ giai đoạn sau.`
                    : `GVHD đã từ chối yêu cầu đổi tên đề tài. Lý do: ${rejectionReason || 'Không chấp thuận'}`,
                type: 'APPROVAL',
            },
            'reviewTitleAdjustment',
        );

        await auditLog(
            userId,
            'REVIEW_TITLE_ADJUSTMENT',
            'TopicTitleAdjustment',
            adjustmentId,
            { action, newTitle: adjustment.newTitle },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: isApproved ? 'Đã duyệt thay đổi tên đề tài thành công.' : 'Đã từ chối đơn điều chỉnh tên đề tài.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/adjust-title/my
 * Sinh viên xem danh sách các yêu cầu điều chỉnh tên đề tài của mình
 */
const getMyTitleAdjustments = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const adjustments = await prisma.topicTitleAdjustment.findMany({
            where: {
                registration: { studentId },
            },
            include: {
                reviewedBy: { select: { id: true, fullName: true, email: true } },
                registration: {
                    include: { topic: { select: { id: true, title: true } } },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });

        res.json({ success: true, data: adjustments });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/adjust-title/pending
 * GVHD xem danh sách các yêu cầu đổi tên đề tài đang chờ duyệt
 */
const getPendingTitleAdjustments = async (req, res, next) => {
    try {
        const lecturerId = req.user.id;
        const role = req.user.role;

        const whereClause = { status: 'PENDING' };
        if (role !== 'ADMIN') {
            whereClause.registration = { topic: { mentorId: lecturerId } };
        }

        const adjustments = await prisma.topicTitleAdjustment.findMany({
            where: whereClause,
            include: {
                registration: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                        topic: { select: { id: true, title: true } },
                    },
                },
            },
            orderBy: { requestedAt: 'asc' },
        });

        res.json({ success: true, data: adjustments });
    } catch (error) {
        next(error);
    }
};

const transferTopicMentor = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const regIdInt = parseInt(req.params.id, 10);
        const { newMentorId, reason } = req.body;
        const result = await transferMentor({
            registrationId: regIdInt,
            newMentorId: parseInt(newMentorId, 10),
            reason,
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã điều chuyển GVHD thành công.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const getAllowedActions = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id, 10);
        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                defenseCouncil: { include: { members: true } },
                defenseResult: true,
                archive: true,
                manualReviewCases: { where: { status: 'OPEN' } },
            },
        });
        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }
        const allowedActions = computeAllowedActions(registration, req.user);
        res.json({
            success: true,
            data: {
                registrationId,
                status: registration.status,
                stateVersion: registration.stateVersion,
                allowedActions,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerTopic,
    getMyRegistration,
    getMyProjectEnrollments,
    getAllRegistrations,
    handleRegistration,
    dropRegistration,
    withdrawRegistration,
    forceDecisionRegistration,
    cancelRegistration,
    updateOutlineReview,
    submitBM02,
    reviewCurrentBM02,
    requestTitleAdjustment,
    reviewTitleAdjustment,
    getMyTitleAdjustments,
    getPendingTitleAdjustments,
    transferTopicMentor,
    getAllowedActions,
};
