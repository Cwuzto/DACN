const prisma = require('../config/database');

const ACTIVE_REGISTRATION_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];

const getActiveSemester = async () => prisma.semester.findFirst({
    where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
    select: {
        id: true,
        name: true,
        startDate: true,
        registrationDeadline: true,
        endDate: true,
    },
});

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
        const [totalStudents, ongoingTopics, unassignedRegistrations, upcomingDefenses] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
            prisma.topic.count({ where: { status: 'APPROVED' } }),
            prisma.topicRegistration.count({
                where: {
                    status: { in: ACTIVE_REGISTRATION_STATUSES },
                    councilId: null,
                },
            }),
            prisma.council.count({
                where: { defenseDate: { gte: new Date() } },
            }),
        ]);

        res.json({
            success: true,
            data: {
                totalStudents,
                ongoingTopics,
                unassignedRegistrations,
                upcomingDefenses,
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
                        },
                    }),
                    prisma.defenseResult.count({
                        where: {
                            registration: { semesterId: semester.id },
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
        const results = await prisma.defenseResult.findMany({
            where: { finalScore: { not: null } },
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

/**
 * GET /api/dashboard/lecturer
 * Dashboard cho giảng viên
 */
const getLecturerDashboard = async (req, res, next) => {
    try {
        const mentorId = req.user.id;
        const activeSemester = await getActiveSemester();

        if (!activeSemester) {
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
                },
            });
        }

        const [activeTopics, activeRegistrations, completedRegistrations, pendingFeedbackSubmissions, upcomingTasks] = await Promise.all([
            prisma.topic.count({
                where: {
                    mentorId,
                    semesterId: activeSemester.id,
                    status: { not: 'REJECTED' },
                },
            }),
            prisma.topicRegistration.count({
                where: {
                    semesterId: activeSemester.id,
                    topic: { mentorId },
                    status: { in: ACTIVE_REGISTRATION_STATUSES },
                },
            }),
            prisma.topicRegistration.count({
                where: {
                    semesterId: activeSemester.id,
                    topic: { mentorId },
                    status: { in: ['DEFENDED', 'COMPLETED'] },
                },
            }),
            prisma.submission.findMany({
                where: {
                    feedback: null,
                    registration: {
                        semesterId: activeSemester.id,
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
                        semesterId: activeSemester.id,
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
                    pendingFeedback: pendingFeedbackSubmissions.length,
                },
                recentSubmissions,
                timelineEvents,
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
        const activeSemester = await getActiveSemester();

        if (!activeSemester) {
            return res.json({
                success: true,
                data: {
                    hasRegistration: false,
                    activeSemester: null,
                    registrationDetails: null,
                    taskStatus: null,
                    upcomingDeadlines: [],
                },
            });
        }

        const registration = await prisma.topicRegistration.findFirst({
            where: {
                studentId,
                semesterId: activeSemester.id,
                status: { not: 'REJECTED' },
            },
            include: {
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
                defenseResult: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!registration) {
            return res.json({
                success: true,
                data: {
                    hasRegistration: false,
                    activeSemester,
                    registrationDetails: null,
                    taskStatus: null,
                    upcomingDeadlines: [],
                },
            });
        }

        const tasks = registration.tasks || [];
        const totalTasks = tasks.length;
        const submittedTasksCount = tasks.filter(
            (task) => task.status === 'SUBMITTED' || task.status === 'COMPLETED'
        ).length;
        const remainingTasks = totalTasks - submittedTasksCount;
        const progressPercent = totalTasks > 0 ? Math.round((submittedTasksCount / totalTasks) * 100) : 0;

        const upcomingDeadlines = tasks
            .filter((task) => task.dueDate && new Date(task.dueDate) > new Date())
            .sort((firstTask, secondTask) => new Date(firstTask.dueDate) - new Date(secondTask.dueDate))
            .slice(0, 3)
            .map((task) => ({
                id: task.id,
                title: `Nộp phần việc: ${task.title}`,
                color: getDeadlineColor(task.dueDate),
                date: task.dueDate,
                desc: task.content || 'Hoàn thành công việc được giao trên hệ thống',
            }));

        res.json({
            success: true,
            data: {
                hasRegistration: true,
                activeSemester,
                registrationDetails: {
                    registrationId: registration.id,
                    status: registration.status,
                    topic: registration.topic
                        ? {
                            title: registration.topic.title,
                            mentorName: registration.topic.mentor?.fullName || 'Chưa rõ',
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
                    remaining: remainingTasks,
                    progressPercent,
                },
                upcomingDeadlines,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getGeneralStats,
    getSemesterStats,
    getScoreDistribution,
    getRecentActivities,
    getLecturerDashboard,
    getStudentDashboard,
};
