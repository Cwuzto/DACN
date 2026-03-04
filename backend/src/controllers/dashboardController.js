const prisma = require('../config/database');

/**
 * GET /api/dashboard/stats
 * Thống kê tổng quan (Admin)
 */
const getGeneralStats = async (req, res, next) => {
    try {
        const [totalStudents, ongoingTopics, unassignedGroups, upcomingDefenses] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
            prisma.topic.count({ where: { status: 'APPROVED' } }),
            prisma.group.count({ where: { topicId: { not: null }, councilId: null } }),
            prisma.council.count({ where: { defenseDate: { gte: new Date() } } })
        ]);

        res.json({
            success: true,
            data: {
                totalStudents,
                ongoingTopics,
                unassignedGroups,
                upcomingDefenses
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/semesters
 * Biểu đồ cột: Số lượng đề tài đăng ký vs hoàn thành theo từng học kỳ
 */
const getSemesterStats = async (req, res, next) => {
    try {
        // Lấy 5 học kỳ gần nhất hoặc đang active
        const semesters = await prisma.semester.findMany({
            orderBy: { id: 'desc' },
            take: 5
        });

        const chartData = await Promise.all(semesters.reverse().map(async (sem) => {
            // Dem nhom da dang ky de tai trong HK
            const registeredGroups = await prisma.group.count({
                where: { semesterId: sem.id, topicId: { not: null } }
            });

            // Dem nhom co điểm hội đồng (coi như hoàn thành)
            // Lấy unique groups có chứa điểm đánh giá loại COUNCIL_SCORE
            const evalG = await prisma.evaluation.groupBy({
                by: ['groupId'],
                where: {
                    group: { semesterId: sem.id },
                    evaluationType: 'COUNCIL_SCORE'
                }
            });

            return {
                label: sem.name,
                registered: registeredGroups,
                completed: evalG.length // so nhom co diem hd
            };
        }));

        res.json({
            success: true,
            data: chartData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/scores
 * Biểu đồ tròn: Phân bổ điểm
 */
const getScoreDistribution = async (req, res, next) => {
    try {
        const evaluations = await prisma.evaluation.findMany({
            where: { evaluationType: 'COUNCIL_SCORE' },
            select: { score: true }
        });

        // Initialize counters
        let excellent = 0; // >= 9.0
        let good = 0;      // 8.0 - < 9.0
        let fair = 0;      // 7.0 - < 8.0
        let average = 0;   // < 7.0

        evaluations.forEach(e => {
            if (e.score >= 9.0) excellent++;
            else if (e.score >= 8.0) good++;
            else if (e.score >= 7.0) fair++;
            else average++;
        });

        const total = evaluations.length || 1; // tránh chia cho 0

        res.json({
            success: true,
            data: [
                { label: 'Xuất sắc', percent: Math.round((excellent / total) * 100) || 0, color: '#1677FF' },
                { label: 'Giỏi', percent: Math.round((good / total) * 100) || 0, color: '#13C2C2' },
                { label: 'Khá', percent: Math.round((fair / total) * 100) || 0, color: '#52C41A' },
                { label: 'Trung bình', percent: Math.round((average / total) * 100) || 0, color: '#FAAD14' }
            ],
            total: evaluations.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/activities
 * Bảng: Hoạt động gần đây (Tạm lấy từ Notifications mapping với User)
 */
const getRecentActivities = async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                user: { select: { fullName: true } }
            }
        });

        const recentActivities = notifications.map(n => {
            let status = 'updated';
            if (n.type === 'APPROVAL') status = 'done';
            if (n.type === 'SUBMISSION') status = 'submitted';
            if (n.type === 'INVITATION') status = 'new';

            return {
                id: n.id,
                time: n.createdAt,
                user: n.user?.fullName || 'Hệ thống',
                action: n.title,
                detail: n.content,
                status
            }
        });

        res.json({
            success: true,
            data: recentActivities
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/lecturer
 * Thống kê dành cho Giảng viên hướng dẫn
 */
const getLecturerDashboard = async (req, res, next) => {
    try {
        const mentorId = req.user.id;

        // 1. Số lượng đề tài đang hướng dẫn (trừ bị từ chối)
        const activeTopics = await prisma.topic.count({
            where: {
                mentorId,
                status: { not: 'REJECTED' }
            }
        });

        // 2. Số nhóm sinh viên đang hướng dẫn
        const studentGroups = await prisma.group.count({
            where: {
                topic: { mentorId }
            }
        });

        // 3. Nhóm có bài nộp chờ phản hồi (Submission chưa có feedback và thuộc task của nhóm được HD)
        const pendingFeedbackSubmissions = await prisma.submission.findMany({
            where: {
                feedback: null,
                task: {
                    group: {
                        topic: { mentorId }
                    }
                }
            },
            include: {
                task: { include: { group: { include: { topic: true } } } },
                student: { select: { fullName: true } }
            },
            orderBy: { submittedAt: 'desc' }
        });

        // Số lượng đơn submission chờ phản hồi
        const pendingFeedbackCount = pendingFeedbackSubmissions.length;

        // Top 5 bài nộp gần đây để hiển thị lên UI Dashboard "Nhóm cần phản hồi"
        const recentSubmissions = pendingFeedbackSubmissions.slice(0, 5).map(sub => ({
            id: sub.id,
            groupName: sub.task.group.groupName,
            topicTitle: sub.task.group.topic?.title || 'Chưa đăng ký',
            taskTitle: sub.task.title,
            studentName: sub.student.fullName,
            fileName: sub.fileName,
            fileUrl: sub.fileUrl,
            submittedAt: sub.submittedAt
        }));

        // 4. Lịch sắp tới: Task có hạn nộp sắp tới của các nhóm được hướng dẫn
        const upcomingTasks = await prisma.task.findMany({
            where: {
                group: { topic: { mentorId } },
                dueDate: { gt: new Date() } // Hạn nộp trong tương lai
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
            include: { group: true }
        });

        const timelineEvents = upcomingTasks.map(t => ({
            id: t.id,
            title: `Hạn nộp: ${t.title}`,
            desc: `Nhóm ${t.group.groupName} cần nộp bài.`,
            date: t.dueDate,
            color: 'red'
        }));

        res.json({
            success: true,
            data: {
                stats: {
                    activeTopics,
                    studentGroups,
                    pendingFeedback: pendingFeedbackCount
                },
                recentSubmissions,
                timelineEvents
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/dashboard/student
 * Thống kê dành cho Sinh viên
 */
const getStudentDashboard = async (req, res, next) => {
    try {
        const studentId = req.user.id;

        // Tìm thành viên nhóm (nếu có, lấy group trong kỳ hiện tại hoặc membership đang active)
        const membership = await prisma.groupMember.findFirst({
            where: { studentId },
            include: {
                group: {
                    include: {
                        topic: { include: { mentor: { select: { fullName: true } } } },
                        members: {
                            include: { student: { select: { id: true, fullName: true, code: true } } },
                            where: { status: 'ACCEPTED' } // Chỉ lấy thành viên chính thức
                        },
                        tasks: true
                    }
                }
            }
        });

        if (!membership || !membership.group) {
            return res.json({
                success: true,
                data: {
                    hasGroup: false,
                    stats: null,
                    groupDetails: null
                }
            });
        }

        const group = membership.group;
        const tasks = group.tasks || [];

        // Tính toán Task Progress
        const totalTasks = tasks.length;
        const submittedTasksCount = tasks.filter(t => t.status === 'SUBMITTED' || t.status === 'COMPLETED').length;
        const remainingTasks = totalTasks - submittedTasksCount;
        const progressPercent = totalTasks > 0 ? Math.round((submittedTasksCount / totalTasks) * 100) : 0;

        // Lấy danh sách hạn nộp sắp tới
        const now = new Date();
        const upcomingDeadlines = tasks
            .filter(t => t.dueDate && new Date(t.dueDate) > now)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 3)
            .map(t => {
                // Determine color
                const hoursLeft = (new Date(t.dueDate) - now) / (1000 * 60 * 60);
                let color = '#13C2C2';
                if (hoursLeft < 24) color = 'red';
                else if (hoursLeft < 72) color = '#fa8c16';

                return {
                    id: t.id,
                    title: `Nộp phần việc: ${t.title}`,
                    color,
                    date: t.dueDate,
                    desc: t.description || 'Hoàn thành công việc được giao trên hệ thống'
                };
            });

        // Structure response
        const data = {
            hasGroup: true,
            stats: {
                hasTopic: group.topic ? 1 : 0,
                groupName: group.groupName,
            },
            groupDetails: {
                groupName: group.groupName,
                leaderId: group.leaderId,
                topic: group.topic ? {
                    title: group.topic.title,
                    mentorName: group.topic.mentor?.fullName || 'Chưa rõ',
                    topicCode: `DT-${String(group.topic.id).padStart(3, '0')}`
                } : null,
                members: group.members.map(m => ({
                    id: m.student.id,
                    fullName: m.student.fullName,
                    code: m.student.code,
                    role: m.student.id === group.leaderId ? 'Nhóm trưởng' : 'Thành viên'
                }))
            },
            taskStatus: {
                total: totalTasks,
                submitted: submittedTasksCount,
                remaining: remainingTasks,
                progressPercent
            },
            upcomingDeadlines
        };

        res.json({
            success: true,
            data
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
    getStudentDashboard
};
