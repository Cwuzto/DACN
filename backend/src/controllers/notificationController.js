const prisma = require('../config/database');

const AUDIENCE = {
    ALL_USERS: 'ALL_USERS',
    ALL_STUDENTS: 'ALL_STUDENTS',
    ALL_LECTURERS: 'ALL_LECTURERS',
    ALL_ADMINS: 'ALL_ADMINS',
    SPECIFIC_COUNCIL: 'SPECIFIC_COUNCIL',
};

const deriveAudience = (roles) => {
    const uniqueRoles = Array.from(new Set(roles));
    if (uniqueRoles.length === 1) {
        if (uniqueRoles[0] === 'STUDENT') return AUDIENCE.ALL_STUDENTS;
        if (uniqueRoles[0] === 'LECTURER') return AUDIENCE.ALL_LECTURERS;
        if (uniqueRoles[0] === 'ADMIN') return AUDIENCE.ALL_ADMINS;
    }

    if (
        uniqueRoles.includes('ADMIN') &&
        uniqueRoles.includes('LECTURER') &&
        uniqueRoles.includes('STUDENT')
    ) {
        return AUDIENCE.ALL_USERS;
    }

    return 'CUSTOM';
};

const getNotificationHistory = async (req, res, next) => {
    try {
        const rows = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 300,
            include: {
                user: {
                    select: {
                        id: true,
                        role: true,
                    },
                },
            },
        });

        const groups = new Map();

        rows.forEach((row) => {
            const key = `${row.title}__${row.content}__${row.type}__${row.createdAt.toISOString()}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    id: key,
                    title: row.title,
                    content: row.content,
                    type: row.type,
                    sentAt: row.createdAt,
                    recipients: new Set(),
                    readCount: 0,
                    roles: [],
                });
            }

            const item = groups.get(key);
            item.recipients.add(row.userId);
            item.roles.push(row.user?.role || 'STUDENT');
            if (row.isRead) item.readCount += 1;
        });

        const history = Array.from(groups.values())
            .map((item) => ({
                id: item.id,
                title: item.title,
                content: item.content,
                type: item.type,
                sentAt: item.sentAt,
                audience: deriveAudience(item.roles),
                readCount: item.readCount,
                totalAudience: item.recipients.size,
            }))
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
            .slice(0, 100);

        return res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        next(error);
    }
};

const buildAudienceWhere = (audience) => {
    if (audience === AUDIENCE.ALL_USERS) return { isActive: true };
    if (audience === AUDIENCE.ALL_STUDENTS) return { isActive: true, role: 'STUDENT' };
    if (audience === AUDIENCE.ALL_LECTURERS) return { isActive: true, role: 'LECTURER' };
    if (audience === AUDIENCE.ALL_ADMINS) return { isActive: true, role: 'ADMIN' };
    return null;
};

const sendBroadcastNotification = async (req, res, next) => {
    try {
        const { title, content, audience, councilId } = req.body;

        if (!title || !content || !audience) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc: title, content, audience.',
            });
        }

        if (!Object.values(AUDIENCE).includes(audience)) {
            return res.status(400).json({
                success: false,
                message: 'Audience không hợp lệ.',
            });
        }

        let recipients = [];

        if (audience === AUDIENCE.SPECIFIC_COUNCIL) {
            if (!councilId) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn hội đồng khi gửi theo SPECIFIC_COUNCIL.',
                });
            }

            const council = await prisma.council.findUnique({
                where: { id: parseInt(councilId, 10) },
                include: {
                    members: {
                        select: {
                            lecturerId: true,
                        },
                    },
                },
            });

            if (!council) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hội đồng.',
                });
            }

            recipients = council.members.map((member) => ({ id: member.lecturerId }));
        } else {
            const where = buildAudienceWhere(audience);
            recipients = await prisma.user.findMany({
                where,
                select: { id: true },
            });
        }

        if (!recipients.length) {
            return res.status(400).json({
                success: false,
                message: 'Không có người nhận phù hợp cho thông báo này.',
            });
        }

        const now = new Date();
        await prisma.notification.createMany({
            data: recipients.map((recipient) => ({
                userId: recipient.id,
                title,
                content,
                type: 'SYSTEM',
                createdAt: now,
            })),
        });

        return res.status(201).json({
            success: true,
            message: 'Đã gửi thông báo thành công.',
            data: {
                sentCount: recipients.length,
                audience,
                sentAt: now,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotificationHistory,
    sendBroadcastNotification,
};
