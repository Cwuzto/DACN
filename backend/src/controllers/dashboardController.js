const prisma = require('../config/database');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { getDefaultSemester } = require('../utils/semesterResolver');
const {
    resolveLecturerSemester,
    buildUnifiedLecturerOverview,
} = require('../services/lecturerOverviewService');
const {
    buildAdminDashboardActions,
} = require('../services/adminDashboardActionsService');
const { computeAllowedActions } = require('../services/workflowActionService');
const { buildStudentWorkState } = require('../services/studentWorkItemService');
const { buildStudentNextAction } = require('../services/studentDashboardActionService');
const { buildArchiveDeadlineSummary } = require('../utils/defenseTimeWindowUtils');
const {
    resolveReportReadScope,
    buildTopicDepartmentWhere,
    buildRegistrationDepartmentWhere,
} = require('../auth/reportReadScope');

const requireDashboardReportScope = async (req, res, { requireGlobal = false } = {}) => {
    const scope = await resolveReportReadScope({ actor: req.user, db: prisma });
    if (!scope || (requireGlobal && !scope.global)) {
        res.status(403).json({
            success: false,
            error: 'REPORT_SCOPE_FORBIDDEN',
            message: requireGlobal
                ? 'Chức năng này yêu cầu quyền xem báo cáo phạm vi toàn viện.'
                : 'Không xác định được phạm vi xem thống kê hợp lệ.',
        });
        return null;
    }
    return scope;
};

const ACTIVE_REGISTRATION_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];
const getPendingCutoffDate = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PENDING_REMINDER_DAYS);
    return cutoff;
};

const getDeadlineColor = (dueDate) => {
    if (!dueDate) return '#13C2C2';

    const hoursLeft = (new Date(dueDate) - new Date()) / (1000 * 60 * 60);
    if (hoursLeft < 24) return 'red';
    if (hoursLeft < 72) return '#fa8c16';
    return '#13C2C2';
};

/**
 * GET /api/dashboard/stats
 * Thống kê tổng quan cho Admin
 */
const getGeneralStats = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res);
        if (!scope) return;

        const semesterIdQuery = req.query?.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let activeSemester = null;

        if (semesterIdQuery && Number.isInteger(semesterIdQuery)) {
            activeSemester = await prisma.semester.findUnique({
                where: { id: semesterIdQuery },
            });
        } else {
            activeSemester = await getDefaultSemester({ id: true });
        }

        const regDeptWhere = !scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {};
        const topicDeptWhere = !scope.global ? buildTopicDepartmentWhere(scope.departments) : {};

        const unassignedWhere = {
            ...(activeSemester?.id ? { semesterId: activeSemester.id } : {}),
            ...regDeptWhere,
            OR: [
                // Giai đoạn 1: Sinh viên đã duyệt đề tài / nộp đề cương nhưng chưa có Hội đồng Đề cương
                {
                    status: { in: ['APPROVED', 'BM01_PASSED', 'BM01_SUBMITTED', 'BM01_RESUBMITTED'] },
                    councilId: null,
                },
                // Giai đoạn 2: Sinh viên đã hoàn thành BM04 đủ điều kiện bảo vệ nhưng chưa có Hội đồng Bảo vệ
                {
                    status: { in: ['DEFENSE_READY', 'ELIGIBLE_BY_INSTITUTE'] },
                    defenseCouncilId: null,
                },
            ],
        };

        const [totalStudents, ongoingTopics, unassignedRegistrations, upcomingDefenses] = await Promise.all([
            prisma.user.count({
                where: {
                    role: 'STUDENT',
                    isActive: true,
                    ...(!scope.global ? { department: { in: scope.departments } } : {}),
                },
            }),
            prisma.topic.count({
                where: {
                    status: 'APPROVED',
                    ...(activeSemester?.id ? { semesterId: activeSemester.id } : {}),
                    ...topicDeptWhere,
                },
            }),
            prisma.topicRegistration.count({
                where: unassignedWhere,
            }),
            prisma.council.count({
                where: {
                    defenseDate: { gte: new Date() },
                    ...(activeSemester?.id ? { semesterId: activeSemester.id } : {}),
                    ...(!scope.global
                        ? { members: { some: { lecturer: { department: { in: scope.departments } } } } }
                        : {}),
                },
            }),
        ]);

        res.json({
            success: true,
            data: {
                totalStudents: totalStudents ?? 0,
                ongoingTopics: ongoingTopics ?? 0,
                unassignedRegistrations: unassignedRegistrations ?? 0,
                upcomingDefenses: upcomingDefenses ?? 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/semester-overview
 * Tổng quan vận hành theo học kỳ cho Admin
 */
const getSemesterOverview = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res);
        if (!scope) return;

        const semesterIdQuery = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let targetSemester = null;

        if (semesterIdQuery && Number.isInteger(semesterIdQuery)) {
            targetSemester = await prisma.semester.findUnique({
                where: { id: semesterIdQuery },
            });
        } else {
            targetSemester = await getDefaultSemester({
                id: true,
                name: true,
                startDate: true,
                registrationDeadline: true,
                endDate: true,
                registrationOpen: true,
                status: true,
            });
        }

        if (!targetSemester) {
            return res.json({
                success: true,
                data: null,
                message: 'Chưa có học kỳ để thống kê.',
            });
        }

        const topicDeptWhere = !scope.global ? buildTopicDepartmentWhere(scope.departments) : {};
        const regDeptWhere = !scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {};

        const [
            totalTopics,
            approvedTopics,
            totalRegistrations,
            pendingRegistrations,
            approvedRegistrations,
            rejectedRegistrations,
            inProgressRegistrations,
            completedRegistrations,
            defenseResults,
            stalePendingRegistrations,
            unassignedRegistrations,
        ] = await Promise.all([
            prisma.topic.count({ where: { semesterId: targetSemester.id, ...topicDeptWhere } }),
            prisma.topic.count({ where: { semesterId: targetSemester.id, status: 'APPROVED', ...topicDeptWhere } }),
            prisma.topicRegistration.count({ where: { semesterId: targetSemester.id, ...regDeptWhere } }),
            prisma.topicRegistration.count({ where: { semesterId: targetSemester.id, status: 'PENDING', ...regDeptWhere } }),
            prisma.topicRegistration.count({ where: { semesterId: targetSemester.id, status: 'APPROVED', ...regDeptWhere } }),
            prisma.topicRegistration.count({ where: { semesterId: targetSemester.id, status: 'REJECTED', ...regDeptWhere } }),
            prisma.topicRegistration.count({
                where: { semesterId: targetSemester.id, status: { in: ['IN_PROGRESS', 'SUBMITTED'] }, ...regDeptWhere },
            }),
            prisma.topicRegistration.count({
                where: { semesterId: targetSemester.id, status: { in: ['DEFENDED', 'COMPLETED'] }, ...regDeptWhere },
            }),
            prisma.defenseResult.count({ where: { registration: { semesterId: targetSemester.id, ...regDeptWhere } } }),
            prisma.topicRegistration.count({
                where: {
                    semesterId: targetSemester.id,
                    status: 'PENDING',
                    createdAt: { lte: getPendingCutoffDate() },
                    ...regDeptWhere,
                },
            }),
            prisma.topicRegistration.count({
                where: {
                    semesterId: targetSemester.id,
                    ...regDeptWhere,
                    OR: [
                        // Giai đoạn 1: Sinh viên đã duyệt đề tài / nộp đề cương nhưng chưa có Hội đồng Đề cương
                        {
                            status: { in: ['APPROVED', 'BM01_PASSED', 'BM01_SUBMITTED', 'BM01_RESUBMITTED'] },
                            councilId: null,
                        },
                        // Giai đoạn 2: Sinh viên đã hoàn thành BM04 đủ điều kiện bảo vệ nhưng chưa có Hội đồng Bảo vệ
                        {
                            status: { in: ['DEFENSE_READY', 'ELIGIBLE_BY_INSTITUTE'] },
                            defenseCouncilId: null,
                        },
                    ],
                },
            }),
        ]);

        const processedRegistrations = approvedRegistrations + rejectedRegistrations;
        const approvalRate = processedRegistrations > 0
            ? Math.round((approvedRegistrations / processedRegistrations) * 100)
            : 0;
        const completionRate = approvedRegistrations > 0
            ? Math.round((completedRegistrations / approvedRegistrations) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                semester: {
                    id: targetSemester.id,
                    name: targetSemester.name,
                    status: targetSemester.status,
                    startDate: targetSemester.startDate,
                    registrationDeadline: targetSemester.registrationDeadline,
                    endDate: targetSemester.endDate,
                    registrationOpen: targetSemester.registrationOpen,
                },
                topics: {
                    total: totalTopics ?? 0,
                    approved: approvedTopics ?? 0,
                },
                registrations: {
                    total: totalRegistrations ?? 0,
                    pending: pendingRegistrations ?? 0,
                    approved: approvedRegistrations ?? 0,
                    rejected: rejectedRegistrations ?? 0,
                    inProgress: inProgressRegistrations ?? 0,
                    completed: completedRegistrations ?? 0,
                    approvalRate: approvalRate ?? 0,
                    completionRate: completionRate ?? 0,
                    stalePendingRegistrations: stalePendingRegistrations ?? 0,
                    unassignedRegistrations: unassignedRegistrations ?? 0,
                    unassigned: unassignedRegistrations ?? 0,
                },
                triage: {
                    unassignedRegistrations: unassignedRegistrations ?? 0,
                    pendingRegistrations: pendingRegistrations ?? 0,
                    stalePendingRegistrations: stalePendingRegistrations ?? 0,
                },
                defenseResults: defenseResults ?? 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/semesters
 * Biểu đồ số lượng đăng ký và hoàn thành theo học kỳ
 */
const getSemesterStats = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res);
        if (!scope) return;

        const regDeptWhere = !scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {};

        const semesters = await prisma.semester.findMany({
            orderBy: { id: 'desc' },
            take: 5,
        });

        const chartData = await Promise.all(
            semesters.reverse().map(async (semester) => {
                const [registered, completed] = await Promise.all([
                    prisma.topicRegistration.count({
                        where: {
                            semesterId: semester.id,
                            status: { not: 'REJECTED' },
                            ...regDeptWhere,
                        },
                    }),
                    prisma.defenseResult.count({
                        where: {
                            registration: { semesterId: semester.id, ...regDeptWhere },
                        },
                    }),
                ]);

                return {
                    label: semester.name,
                    registered,
                    completed,
                };
            })
        );

        res.json({
            success: true,
            data: chartData,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/scores
 * Phân bố điểm cuối cùng
 */
const getScoreDistribution = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res);
        if (!scope) return;

        const regDeptWhere = !scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {};

        const results = await prisma.defenseResult.findMany({
            where: {
                finalScore: { not: null },
                ...(!scope.global ? { registration: regDeptWhere } : {}),
            },
            select: { finalScore: true },
        });

        let excellent = 0;
        let good = 0;
        let fair = 0;
        let average = 0;

        results.forEach((result) => {
            const score = result.finalScore || 0;
            if (score >= 9.0) excellent++;
            else if (score >= 8.0) good++;
            else if (score >= 7.0) fair++;
            else average++;
        });

        const total = results.length || 1;

        res.json({
            success: true,
            data: [
                { label: 'Xuất sắc', percent: Math.round((excellent / total) * 100) || 0, color: '#1677FF' },
                { label: 'Giỏi', percent: Math.round((good / total) * 100) || 0, color: '#13C2C2' },
                { label: 'Khá', percent: Math.round((fair / total) * 100) || 0, color: '#52C41A' },
                { label: 'Trung bình', percent: Math.round((average / total) * 100) || 0, color: '#FAAD14' },
            ],
            total: results.length,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/activities
 * Hoạt động gần đây
 */
const getRecentActivities = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res, { requireGlobal: true });
        if (!scope) return;

        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                user: { select: { fullName: true } },
            },
        });

        const recentActivities = notifications.map((notification) => {
            let status = 'updated';
            if (notification.type === 'APPROVAL') status = 'done';
            if (notification.type === 'SUBMISSION') status = 'submitted';
            if (notification.type === 'REGISTRATION') status = 'new';

            return {
                id: notification.id,
                time: notification.createdAt,
                user: notification.user?.fullName || 'Hệ thống',
                action: notification.title,
                detail: notification.content,
                status,
            };
        });

        res.json({
            success: true,
            data: recentActivities,
        });
    } catch (error) {
        next(error);
    }
};

const fetchLecturerDashboardData = async (mentorId, semesterId) => {
    return Promise.all([
        prisma.topic.count({
            where: {
                mentorId,
                semesterId,
                status: { not: 'REJECTED' },
            },
        }),
        prisma.topicRegistration.count({
            where: {
                semesterId,
                topic: { mentorId },
                status: { in: ACTIVE_REGISTRATION_STATUSES },
            },
        }),
        prisma.topicRegistration.count({
            where: {
                semesterId,
                topic: { mentorId },
                status: { in: ['DEFENDED', 'COMPLETED'] },
            },
        }),
        prisma.submission.findMany({
            where: {
                feedback: null,
                task: {
                    status: 'SUBMITTED',
                },
                registration: {
                    semesterId,
                    topic: { mentorId },
                },
            },
            include: {
                task: { select: { title: true } },
                student: { select: { fullName: true, code: true } },
                registration: {
                    select: {
                        id: true,
                        topic: { select: { title: true } },
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
            take: 5,
        }),
        prisma.task.findMany({
            where: {
                dueDate: { gt: new Date() },
                registration: {
                    semesterId,
                    topic: { mentorId },
                    status: { in: ACTIVE_REGISTRATION_STATUSES },
                },
            },
            include: {
                registration: {
                    select: {
                        student: { select: { fullName: true, code: true } },
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
        }),
        prisma.topicRegistration.count({
            where: {
                semesterId,
                status: 'PENDING',
                createdAt: { lte: getPendingCutoffDate() },
                topic: { mentorId },
            },
        }),
    ]);
};

/**
 * GET /api/dashboard/lecturer
 * Dashboard cho giảng viên
 */
const getLecturerDashboard = async (req, res, next) => {
    try {
        const mentorId = req.user.id;
        const requestedSemesterId = req.query?.semesterId;
        const activeSemester = await resolveLecturerSemester({
            actorId: mentorId,
            requestedSemesterId,
            db: prisma,
        });

        if (!activeSemester) {
            const emptyOverview = await buildUnifiedLecturerOverview({
                actor: req.user,
                semesterId: null,
                db: prisma,
            });
            return res.json({
                success: true,
                data: {
                    activeSemester: null,
                    stats: {
                        activeTopics: 0,
                        studentGroups: 0,
                        completedRegistrations: 0,
                        pendingFeedback: 0,
                    },
                    recentSubmissions: [],
                    timelineEvents: [],
                    ...emptyOverview,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        const [
            [
                activeTopics,
                activeRegistrations,
                completedRegistrations,
                pendingFeedbackSubmissions,
                upcomingTasks,
                stalePendingRegistrations,
            ],
            mentorOverview,
        ] = await Promise.all([
            fetchLecturerDashboardData(mentorId, activeSemester.id),
            buildUnifiedLecturerOverview({
                actor: req.user,
                semesterId: activeSemester.id,
                db: prisma,
            }),
        ]);

        const recentSubmissions = pendingFeedbackSubmissions.map((submission) => ({
            id: submission.id,
            groupName: submission.student?.code || `SV-${submission.registration.id}`,
            topicTitle: submission.registration?.topic?.title || 'Chưa đăng ký',
            taskTitle: submission.task?.title || 'Nhiệm vụ',
            studentName: submission.student?.fullName || 'Sinh viên',
            fileName: submission.fileName,
            fileUrl: submission.fileUrl,
            submittedAt: submission.submittedAt,
        }));

        const timelineEvents = upcomingTasks.map((task) => ({
            id: task.id,
            title: `Hạn nộp: ${task.title}`,
            desc: `${task.registration?.student?.fullName || 'Sinh viên'} cần nộp bài.`,
            date: task.dueDate,
            color: 'red',
        }));

        res.json({
            success: true,
            data: {
                activeSemester,
                stats: {
                    activeTopics,
                    studentGroups: activeRegistrations,
                    completedRegistrations,
                    pendingFeedback: mentorOverview?.mentorSummary?.pendingFeedbackCount ?? 0,
                    stalePendingRegistrations,
                },
                recentSubmissions,
                timelineEvents,
                ...mentorOverview,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/student
 * Dashboard cho sinh viên
 */
const getStudentDashboard = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        let activeSemester = await getDefaultSemester({
            id: true,
            code: true,
            name: true,
            status: true,
            registrationOpen: true,
            startDate: true,
            registrationDeadline: true,
            outlineSubmissionOpenAt: true,
            outlineSubmissionDeadline: true,
            midtermReportDate: true,
            bm03MidtermEvaluationOpenAt: true,
            bm03FinalizationOpenAt: true,
            defenseDate: true,
            endDate: true,
        });

        if (!activeSemester) {
            return res.json({
                success: true,
                data: {
                    hasRegistration: false,
                    activeSemester: null,
                    registrationDetails: null,
                    registration: null,
                    topic: null,
                    tasks: [],
                    meetingLogsCount: 0,
                    mentorScore: null,
                    mentorFullName: null,
                    taskStatus: null,
                    upcomingDeadlines: [],
                    workItems: [],
                    waitingStatus: null,
                    nextAction: null,
                },
            });
        }

        const registrationInclude = {
            student: { select: { id: true, fullName: true, code: true } },
            topic: {
                include: {
                    mentor: { select: { fullName: true } },
                },
            },
            tasks: {
                include: {
                    submissions: {
                        where: { submittedBy: studentId },
                    },
                },
                orderBy: { dueDate: 'asc' },
            },
            meetingLogs: {
                select: { id: true },
            },
            bm04Evaluation: true,
            defenseResult: true,
            defenseCouncil: { select: { id: true, name: true, defenseDate: true, location: true } },
            council: { select: { id: true, name: true, defenseDate: true, location: true } },
            archive: {
                include: {
                    documentVersions: {
                        orderBy: { versionNumber: 'desc' },
                    },
                },
            },
            bm03Record: true,
            currentBM02Submission: true,
        };

        let registration = await prisma.topicRegistration.findFirst({
            where: {
                studentId,
                semesterId: activeSemester.id,
                status: { not: 'REJECTED' },
            },
            include: registrationInclude,
            orderBy: { createdAt: 'desc' },
        });

        if (!registration) {
            const activeRegistration = await prisma.topicRegistration.findFirst({
                where: {
                    studentId,
                    semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                    status: { not: 'REJECTED' },
                },
                include: {
                    ...registrationInclude,
                    semester: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            if (activeRegistration) {
                registration = activeRegistration;
                activeSemester = activeRegistration.semester;
            }
        }

        if (!registration) {
            const workState = buildStudentWorkState({
                registration: null,
                semester: activeSemester,
                tasks: [],
                allowedActions: [],
                now: new Date(),
            });

            return res.json({
                success: true,
                data: {
                    hasRegistration: false,
                    activeSemester,
                    registrationDetails: null,
                    registration: null,
                    topic: null,
                    tasks: [],
                    meetingLogsCount: 0,
                    mentorScore: null,
                    mentorFullName: null,
                    taskStatus: null,
                    upcomingDeadlines: [],
                    workItems: workState.workItems,
                    waitingStatus: workState.waitingStatus,
                    nextAction: workState.nextAction,
                },
            });
        }

        // 1. tasks: Danh sách các nhiệm vụ thật
        let rawTasks = registration.tasks;
        if (!rawTasks && prisma.task?.findMany) {
            rawTasks = await prisma.task.findMany({
                where: { registrationId: registration.id },
                include: {
                    submissions: {
                        where: { submittedBy: studentId },
                    },
                },
                orderBy: { dueDate: 'asc' },
            });
        }
        rawTasks = rawTasks || [];

        const formattedTasks = rawTasks.map((task) => ({
            ...task,
            id: task.id,
            title: task.title,
            description: task.content || task.description || '',
            content: task.content || task.description || '',
            deadline: task.dueDate || task.deadline || null,
            dueDate: task.dueDate || task.deadline || null,
            status: task.status,
            taskType: task.taskType || 'GENERIC',
            submissions: task.submissions || [],
        }));

        // 2. meetingLogsCount: Đếm số buổi gặp thực tế (MeetingLog hoặc BM03MeetingEntry)
        let meetingLogsCount = 0;
        if (Array.isArray(registration.meetingLogs)) {
            meetingLogsCount = registration.meetingLogs.length;
        } else if (typeof prisma.meetingLog?.count === 'function') {
            const count = await prisma.meetingLog.count({
                where: { registrationId: registration.id },
            });
            if (typeof count === 'number') {
                meetingLogsCount = count;
            }
        }
        if (meetingLogsCount === 0) {
            if (Array.isArray(registration.bm03MeetingEntries)) {
                meetingLogsCount = registration.bm03MeetingEntries.length;
            } else if (typeof prisma.bM03MeetingEntry?.count === 'function') {
                const count = await prisma.bM03MeetingEntry.count({
                    where: { registrationId: registration.id },
                });
                if (typeof count === 'number') {
                    meetingLogsCount = count;
                }
            }
        }

        // 3. mentorScore: Lấy điểm số thực tế (nếu có) và mentorConclusion từ BM04Evaluation
        let mentorScore = null;
        let mentorConclusion = null;
        const bm04 = registration.bm04Evaluation || (
            prisma.bM04Evaluation?.findUnique
                ? await prisma.bM04Evaluation.findUnique({ where: { registrationId: registration.id } })
                : null
        );
        if (bm04) {
            if (typeof bm04.score === 'number' && Number.isFinite(bm04.score)) {
                mentorScore = bm04.score;
            } else if (typeof bm04.finalScore === 'number' && Number.isFinite(bm04.finalScore)) {
                mentorScore = bm04.finalScore;
            } else if (bm04.score !== undefined && bm04.score !== null && bm04.score !== '' && Number.isFinite(Number(bm04.score))) {
                mentorScore = Number(bm04.score);
            } else if (bm04.finalScore !== undefined && bm04.finalScore !== null && bm04.finalScore !== '' && Number.isFinite(Number(bm04.finalScore))) {
                mentorScore = Number(bm04.finalScore);
            }
            mentorConclusion = bm04.conclusion || bm04.programOutcome || null;
        }

        // 4. mentorFullName
        const mentorFullName = registration.topic?.mentor?.fullName || null;

        const tasks = formattedTasks;
        const now = new Date();
        const DONE_TASK_STATUSES = ['SUBMITTED', 'COMPLETED', 'APPROVED', 'PASSED'];
        const totalTasks = tasks.length;
        const submittedTasksCount = tasks.filter(
            (task) => DONE_TASK_STATUSES.includes(task.status)
        ).length;
        const completedTasksCount = tasks.filter((task) => ['COMPLETED', 'APPROVED', 'PASSED'].includes(task.status)).length;
        const overdueTasksCount = tasks.filter(
            (task) =>
                (task.dueDate || task.deadline) &&
                new Date(task.dueDate || task.deadline) < now &&
                !DONE_TASK_STATUSES.includes(task.status)
        ).length;
        const upcomingTasksCount = tasks.filter(
            (task) =>
                (task.dueDate || task.deadline) &&
                new Date(task.dueDate || task.deadline) >= now &&
                !DONE_TASK_STATUSES.includes(task.status)
        ).length;
        const remainingTasks = totalTasks - submittedTasksCount;
        const STATUS_PROGRESS_MAP = {
            PENDING_MENTOR: 5,
            TOPIC_APPROVED: 10,
            OUTLINE_PENDING: 15,
            BM01_SUBMITTED: 20,
            BM01_NEEDS_REVISION: 20,
            BM01_PASSED: 30,
            BM02_PENDING_STUDENT: 35,
            BM02_PENDING_ADVISOR: 40,
            BM02_PENDING_DEPARTMENT: 45,
            BM02_SUBMITTED: 45,
            BM02_APPROVED: 50,
            DECISION_ISSUED: 55,
            IN_PROGRESS: 60,
            IN_PROGRESS_BM03: 60,
            BM03_SIGNATURE_PENDING: 65,
            BM03_PASSED: 70,
            BM04_REVIEW: 75,
            DEFENSE_READY: 80,
            DEFENSE_ELIGIBLE: 80,
            ELIGIBLE_BY_INSTITUTE: 80,
            AWAITING_SCORES: 85,
            AWAITING_FINAL_APPROVAL: 90,
            DEFENDED: 90,
            DEFENSE_PASSED: 95,
            PENDING_INSTITUTE_SIGNATURE: 98,
            COMPLETED: 100,
        };
        const taskProgress = totalTasks > 0 ? Math.round((submittedTasksCount / totalTasks) * 100) : 0;
        const statusProgress = STATUS_PROGRESS_MAP[registration.status] || 0;
        const progressPercent = Math.max(statusProgress, taskProgress);

        const archiveSummary = buildArchiveDeadlineSummary(
            { ...registration, semester: registration.semester || activeSemester },
            registration.archive || null,
            now
        );

        if (registration.archive) {
            registration.archive = {
                ...registration.archive,
                softPreparationDeadlineAt:
                    registration.archive.softPreparationDeadlineAt || archiveSummary.timeWindows.softPreparationDeadlineAt,
                defenseSnapshotAt:
                    registration.archive.defenseSnapshotAt || archiveSummary.timeWindows.defenseSnapshotAt,
                windowClosesAt:
                    registration.archive.windowClosesAt || archiveSummary.timeWindows.windowClosesAt,
                timeWindows: archiveSummary.timeWindows,
            };
        }

        const PRE_DEFENSE_ARCHIVE_STAGES = [
            'BM03_PASSED',
            'BM04_REVIEW',
            'DEFENSE_READY',
            'DEFENSE_ELIGIBLE',
            'ELIGIBLE_BY_INSTITUTE',
        ];
        const POST_DEFENSE_ARCHIVE_STAGES = [
            'DEFENSE_PASSED',
            'ARCHIVE_INCOMPLETE',
            'ARCHIVE_REJECTED',
        ];

        const taskUpcomingDeadlines = tasks
            .filter(
                (task) =>
                    !DONE_TASK_STATUSES.includes(task.status) &&
                    (task.dueDate || task.deadline) &&
                    new Date(task.dueDate || task.deadline) > now
            )
            .map((task) => ({
                id: task.id,
                title: `Nộp phần việc: ${task.title}`,
                color: getDeadlineColor(task.dueDate || task.deadline),
                date: task.dueDate || task.deadline,
                desc: task.content || task.description || 'Hoàn thành công việc được giao trên hệ thống',
            }));

        const isPreDefenseArchiveStage = PRE_DEFENSE_ARCHIVE_STAGES.includes(registration.status);
        const isPostDefenseArchiveStage = POST_DEFENSE_ARCHIVE_STAGES.includes(registration.status);

        if ((isPreDefenseArchiveStage || isPostDefenseArchiveStage) && !archiveSummary.isComplete) {
            const archiveDeadlineAt = isPostDefenseArchiveStage
                ? archiveSummary.timeWindows.windowClosesAt
                : (archiveSummary.timeWindows.softPreparationDeadlineAt || archiveSummary.timeWindows.windowClosesAt);

            if (archiveDeadlineAt && !archiveSummary.isWindowClosed) {
                const deadlineDate = new Date(archiveDeadlineAt);
                const isFutureOrExpiring = !Number.isNaN(deadlineDate.getTime()) && (deadlineDate >= now || isPostDefenseArchiveStage);
                if (isFutureOrExpiring) {
                    taskUpcomingDeadlines.push({
                        id: `archive-deadline-${registration.id}`,
                        title: isPostDefenseArchiveStage
                            ? `Hạn nộp hồ sơ lưu chiểu (${archiveSummary.submittedCount}/${archiveSummary.totalRequired})`
                            : `Hạn nộp hồ sơ bảo vệ (${archiveSummary.submittedCount}/${archiveSummary.totalRequired})`,
                        color: getDeadlineColor(archiveDeadlineAt),
                        date: archiveDeadlineAt,
                        desc: `Còn thiếu ${archiveSummary.missingTypes.length} tài liệu: ${archiveSummary.missingTypes.join(', ')}`,
                        kind: 'ARCHIVE_DEADLINE',
                    });
                }
            }
        }

        const upcomingDeadlines = taskUpcomingDeadlines
            .sort((firstItem, secondItem) => new Date(firstItem.date) - new Date(secondItem.date))
            .slice(0, 4);

        // Hide defenseResult if not published yet to prevent leaking grades/comments
        if (registration?.defenseResult && !registration.defenseResult.isPublished) {
            registration.defenseResult = null;
        }

        const allowedActions = computeAllowedActions(
            { ...registration, studentId: registration.studentId ?? studentId },
            { ...req.user, role: req.user?.role || 'STUDENT' }
        );
        const workState = buildStudentWorkState({
            registration,
            semester: activeSemester,
            tasks: formattedTasks,
            outline: registration.outline || null,
            bm03Record: registration.bm03Record || null,
            bm04Record: bm04,
            archive: registration.archive || null,
            allowedActions,
            now,
        });
        const nextAction = workState.nextAction;

        res.json({
            success: true,
            data: {
                hasRegistration: true,
                activeSemester,
                allowedActions,
                nextAction,
                workItems: workState.workItems,
                waitingStatus: workState.waitingStatus,
                registrationDetails: {
                    registrationId: registration.id,
                    status: registration.status,
                    registeredAt: registration.createdAt || null,
                    decisionNumber: registration.decisionNumber,
                    decisionDate: registration.decisionDate,
                    bm04SignedAt: bm04 && bm04.status !== 'DRAFT' ? (bm04.signedAt || bm04.createdAt || null) : null,
                    adjustedTitle: registration.adjustedTitle,
                    mentorScore,
                    mentorConclusion,
                    mentorFullName,
                    meetingLogsCount,
                    tasks: formattedTasks,
                    topic: registration.topic
                        ? {
                            title: registration.adjustedTitle || registration.topic.title,
                            originalTitle: registration.topic.title,
                            mentorName: mentorFullName || 'Chưa rõ',
                            topicCode: `DT-${String(registration.topic.id).padStart(3, '0')}`,
                        }
                        : null,
                    members: [
                        {
                            id: registration.student.id,
                            fullName: registration.student.fullName,
                            code: registration.student.code,
                            role: 'Sinh viên',
                        },
                    ],
                },
                taskStatus: {
                    total: totalTasks,
                    submitted: submittedTasksCount,
                    completed: completedTasksCount,
                    remaining: remainingTasks,
                    overdue: overdueTasksCount,
                    upcoming: upcomingTasksCount,
                    progressPercent,
                },
                upcomingDeadlines,
                archiveSummary,
                registration,
                topic: registration.topic || null,
                tasks: formattedTasks,
                meetingLogsCount,
                mentorScore,
                mentorFullName,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/admin-actions
 * Danh mục việc cần xử lý thuộc thẩm quyền Admin/Viện theo đợt và quyền actor
 */
const getAdminDashboardActions = async (req, res, next) => {
    try {
        const scope = await requireDashboardReportScope(req, res);
        if (!scope) return;

        const rawSemesterId = req.query?.semesterId;
        let targetSemesterId = null;

        if (rawSemesterId !== undefined && rawSemesterId !== null && String(rawSemesterId).trim() !== '') {
            const parsed = Number(rawSemesterId);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_SEMESTER_ID',
                    message: 'semesterId không hợp lệ.',
                });
            }
            targetSemesterId = parsed;
        } else {
            const activeSemester = await getDefaultSemester({ id: true });
            targetSemesterId = activeSemester?.id || null;
        }

        const data = await buildAdminDashboardActions({
            actor: req.user,
            semesterId: targetSemesterId,
            db: prisma,
            scope,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getGeneralStats,
    getSemesterOverview,
    getSemesterStats,
    getScoreDistribution,
    getRecentActivities,
    getLecturerDashboard,
    getStudentDashboard,
    getAdminDashboardActions,
};
