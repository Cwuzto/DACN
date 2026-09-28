// src/controllers/meetingLogController.js
const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');

const getRequestIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

/**
 * GET /api/registrations/:registrationId/meeting-logs
 * Xem danh sách các buổi gặp gỡ tiến độ
 */
const getMeetingLogs = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const { id: userId, role } = req.user;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: { select: { mentorId: true, title: true } },
                student: { select: { id: true, fullName: true, code: true } },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Đăng ký đề tài không tồn tại.' });
        }

        // Access check
        if (role === 'STUDENT' && registration.studentId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem nhật ký của đề tài này.' });
        }
        if (role === 'LECTURER' && registration.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Chỉ giảng viên hướng dẫn của đề tài mới có quyền truy cập.' });
        }

        const meetingLogs = await prisma.meetingLog.findMany({
            where: { registrationId },
            include: {
                creator: { select: { id: true, fullName: true, code: true, email: true } },
            },
            orderBy: { meetingDate: 'desc' },
        });

        res.json({ success: true, data: meetingLogs });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/:registrationId/meeting-stats
 * Thống kê tổng hợp số buổi gặp phục vụ BM04 và giám sát
 */
const getMeetingStats = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const logs = await prisma.meetingLog.findMany({
            where: { registrationId },
            orderBy: { meetingDate: 'desc' },
        });

        const totalMeetings = logs.length;
        const labMeetings = logs.filter((l) => l.meetingType === 'LAB').length;
        const onlineMeetings = logs.filter((l) => l.meetingType === 'ONLINE').length;
        const officeMeetings = logs.filter((l) => l.meetingType === 'OFFICE').length;
        const lastMeeting = logs.length > 0 ? logs[0].meetingDate : null;

        let daysSinceLastMeeting = null;
        if (lastMeeting) {
            const diffMs = Date.now() - new Date(lastMeeting).getTime();
            daysSinceLastMeeting = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        res.json({
            success: true,
            data: {
                totalMeetings,
                labMeetings,
                onlineMeetings,
                officeMeetings,
                lastMeeting,
                daysSinceLastMeeting,
                isWarning: daysSinceLastMeeting !== null && daysSinceLastMeeting > 21,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/:registrationId/meeting-logs
 * Chỉ GVHD hoặc ADMIN được tạo nhật ký buổi gặp
 */
const createMeetingLog = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const { id: userId, role } = req.user;
        const {
            meetingDate,
            meetingType = 'LAB',
            studentWorkSummary,
            nextPlan,
            supervisorNotes,
        } = req.body;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (!studentWorkSummary || !studentWorkSummary.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tóm tắt nội dung sinh viên đã làm/báo cáo.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: { select: { mentorId: true, title: true } },
                student: { select: { id: true, fullName: true, code: true } },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Đăng ký đề tài không tồn tại.' });
        }

        if (role !== 'ADMIN' && registration.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Chỉ Giảng viên hướng dẫn mới có quyền tạo Nhật ký gặp gỡ.' });
        }

        const validTypes = ['LAB', 'OFFICE', 'ONLINE'];
        const normalizedType = validTypes.includes(meetingType) ? meetingType : 'LAB';

        const parsedDate = meetingDate ? new Date(meetingDate) : new Date();

        const log = await prisma.meetingLog.create({
            data: {
                registrationId,
                meetingDate: parsedDate,
                meetingType: normalizedType,
                studentWorkSummary: studentWorkSummary.trim(),
                nextPlan: nextPlan ? nextPlan.trim() : null,
                supervisorNotes: supervisorNotes ? supervisorNotes.trim() : null,
                createdBy: userId,
            },
            include: {
                creator: { select: { id: true, fullName: true, code: true } },
            },
        });

        // Gửi thông báo cho sinh viên
        await safeNotify({
            userId: registration.studentId,
            title: 'GVHD đã ghi nhận nhật ký buổi làm việc',
            content: `Thầy/Cô đã ghi nhận nhật ký buổi làm việc ngày ${parsedDate.toLocaleDateString('vi-VN')} cho đề tài "${registration.topic.title}".`,
            type: 'TASK_REMINDER',
        }, 'createMeetingLog');

        await auditLog(
            userId,
            'CREATE_MEETING_LOG',
            'MeetingLog',
            log.id,
            { registrationId, meetingType: normalizedType, meetingDate: parsedDate },
            getRequestIp(req),
        );

        res.status(201).json({
            success: true,
            message: 'Đã ghi nhận nhật ký buổi gặp gỡ thành công.',
            data: log,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/meeting-logs/:id
 * Sửa nhật ký gặp gỡ (GVHD hoặc ADMIN)
 */
const updateMeetingLog = async (req, res, next) => {
    try {
        const logId = parseInt(req.params.id, 10);
        const { id: userId, role } = req.user;
        const {
            meetingDate,
            meetingType,
            studentWorkSummary,
            nextPlan,
            supervisorNotes,
        } = req.body;

        if (!Number.isInteger(logId) || logId <= 0) {
            return res.status(400).json({ success: false, message: 'ID nhật ký không hợp lệ.' });
        }

        const existing = await prisma.meetingLog.findUnique({
            where: { id: logId },
            include: {
                registration: {
                    include: {
                        topic: { select: { mentorId: true } },
                    },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Nhật ký không tồn tại.' });
        }

        if (role !== 'ADMIN' && existing.registration?.topic?.mentorId !== userId && existing.createdBy !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa nhật ký này.' });
        }

        const updateData = {};
        if (meetingDate) updateData.meetingDate = new Date(meetingDate);
        if (meetingType && ['LAB', 'OFFICE', 'ONLINE'].includes(meetingType)) updateData.meetingType = meetingType;
        if (typeof studentWorkSummary === 'string') updateData.studentWorkSummary = studentWorkSummary.trim();
        if (typeof nextPlan === 'string') updateData.nextPlan = nextPlan.trim();
        if (typeof supervisorNotes === 'string') updateData.supervisorNotes = supervisorNotes.trim();

        const updated = await prisma.meetingLog.update({
            where: { id: logId },
            data: updateData,
            include: {
                creator: { select: { id: true, fullName: true, code: true } },
            },
        });

        res.json({
            success: true,
            message: 'Đã cập nhật nhật ký buổi gặp thành công.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/meeting-logs/:id
 * Xóa nhật ký gặp gỡ
 */
const deleteMeetingLog = async (req, res, next) => {
    try {
        const logId = parseInt(req.params.id, 10);
        const { id: userId, role } = req.user;

        if (!Number.isInteger(logId) || logId <= 0) {
            return res.status(400).json({ success: false, message: 'ID nhật ký không hợp lệ.' });
        }

        const existing = await prisma.meetingLog.findUnique({
            where: { id: logId },
            include: {
                registration: {
                    include: {
                        topic: { select: { mentorId: true } },
                    },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Nhật ký không tồn tại.' });
        }

        if (role !== 'ADMIN' && existing.registration?.topic?.mentorId !== userId && existing.createdBy !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa nhật ký này.' });
        }

        await prisma.meetingLog.delete({
            where: { id: logId },
        });

        await auditLog(
            userId,
            'DELETE_MEETING_LOG',
            'MeetingLog',
            logId,
            { registrationId: existing.registrationId },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã xóa nhật ký buổi gặp thành công.',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMeetingLogs,
    getMeetingStats,
    createMeetingLog,
    updateMeetingLog,
    deleteMeetingLog,
};
