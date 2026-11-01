const prisma = require('../config/database');
const { safeNotify } = require('../services/notificationService');
const { auditLog } = require('../services/auditLogService');
const { issueAssignmentDecision, createDecisionAmendment } = require('../services/academicDocumentService');
const { WorkflowTransitionError } = require('../services/registrationTransitionService');

const REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS = 14;

const isWithinRegistrationWindow = (semester, now = new Date()) => {
    if (!semester?.startDate || !semester?.registrationDeadline) return false;

    const start = new Date(semester.startDate);
    const registrationDeadline = new Date(semester.registrationDeadline);

    if (Number.isNaN(start.getTime()) || Number.isNaN(registrationDeadline.getTime())) return false;

    return now >= start && now <= registrationDeadline;
};

const calculateStatus = (semester) => {
    const now = new Date();
    const start = new Date(semester.startDate);
    const registrationDeadline = semester.registrationDeadline ? new Date(semester.registrationDeadline) : null;
    const defenseDate = semester.defenseDate ? new Date(semester.defenseDate) : null;
    const end = new Date(semester.endDate);

    if (now < start) return 'UPCOMING';
    if (registrationDeadline && now >= start && now < registrationDeadline) return 'REGISTRATION';

    if (defenseDate) {
        if (now >= (registrationDeadline || start) && now < defenseDate) return 'ONGOING';
        if (now >= defenseDate && now < end) return 'DEFENSE';
    } else if (now >= (registrationDeadline || start) && now < end) {
        return 'ONGOING';
    }

    if (now >= end) return 'COMPLETED';
    return 'UPCOMING';
};

const mapSemesterForResponse = (semester) => {
    const status = calculateStatus(semester);
    const registrationOpenConfigured = !!semester.registrationOpen;

    return {
        ...semester,
        status,
        registrationOpenConfigured,
        registrationOpen: registrationOpenConfigured && isWithinRegistrationWindow(semester),
    };
};

const getToggleWindowWarning = (semester) => {
    if (!semester?.startDate || !semester?.registrationDeadline) {
        return 'Học kỳ chưa đủ mốc thời gian để đối chiếu cửa sổ cảnh báo, hệ thống vẫn cho phép override.';
    }

    const now = Date.now();
    const startTime = new Date(semester.startDate).getTime();
    const deadlineTime = new Date(semester.registrationDeadline).getTime();

    if (Number.isNaN(startTime) || Number.isNaN(deadlineTime)) {
        return 'Không thể xác định cửa sổ cảnh báo do dữ liệu ngày không hợp lệ, hệ thống vẫn cho phép override.';
    }

    const offsetMs = REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const windowStart = startTime - offsetMs;
    const windowEnd = deadlineTime + offsetMs;

    if (now < windowStart || now > windowEnd) {
        return 'Đang thay đổi toggle đăng ký ngoài cửa sổ gợi ý (startDate - 14 ngày đến registrationDeadline + 14 ngày).';
    }

    return null;
};

const getAllSemesters = async (_req, res, next) => {
    try {
        const semesters = await prisma.semester.findMany({
            orderBy: { startDate: 'desc' },
        });

        res.json({
            success: true,
            data: semesters.map(mapSemesterForResponse),
        });
    } catch (error) {
        next(error);
    }
};

const getSemesterById = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.params.id, 10);
        if (!Number.isInteger(semesterId)) {
            return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterId },
        });

        if (!semester) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đợt đồ án.',
            });
        }

        res.json({
            success: true,
            data: mapSemesterForResponse(semester),
        });
    } catch (error) {
        next(error);
    }
};

const createSemester = async (req, res, next) => {
    try {
        const {
            name,
            startDate,
            endDate,
            registrationDeadline,
            midtermReportDate,
            defenseDate,
            registrationOpen,
        } = req.body;

        if (!name || !startDate || !registrationDeadline || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Tên, ngày bắt đầu, hạn đăng ký và ngày kết thúc là bắt buộc.',
            });
        }

        const calculatedStatus = calculateStatus({
            startDate,
            endDate,
            registrationDeadline,
            defenseDate,
        });

        const newSemester = await prisma.semester.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                registrationDeadline: new Date(registrationDeadline),
                midtermReportDate: midtermReportDate ? new Date(midtermReportDate) : null,
                defenseDate: defenseDate ? new Date(defenseDate) : null,
                registrationOpen: typeof registrationOpen === 'boolean' ? registrationOpen : true,
                status: calculatedStatus,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Tạo đợt đồ án thành công.',
            data: mapSemesterForResponse(newSemester),
        });
    } catch (error) {
        next(error);
    }
};

const updateSemester = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.params.id, 10);
        if (!Number.isInteger(semesterId)) {
            return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ.' });
        }

        const {
            name,
            startDate,
            endDate,
            registrationDeadline,
            midtermReportDate,
            defenseDate,
            registrationOpen,
        } = req.body;

        const semester = await prisma.semester.findUnique({
            where: { id: semesterId },
        });

        if (!semester) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đợt đồ án để cập nhật.',
            });
        }

        const nextStartDate = startDate ? new Date(startDate) : semester.startDate;
        const nextEndDate = endDate ? new Date(endDate) : semester.endDate;
        const nextRegistrationDeadline = registrationDeadline
            ? new Date(registrationDeadline)
            : semester.registrationDeadline;
        const nextMidtermReportDate =
            midtermReportDate !== undefined
                ? (midtermReportDate ? new Date(midtermReportDate) : null)
                : semester.midtermReportDate;
        const nextDefenseDate =
            defenseDate !== undefined ? (defenseDate ? new Date(defenseDate) : null) : semester.defenseDate;

        const calculatedStatus = calculateStatus({
            startDate: nextStartDate,
            endDate: nextEndDate,
            registrationDeadline: nextRegistrationDeadline,
            defenseDate: nextDefenseDate,
        });

        const updatedSemester = await prisma.semester.update({
            where: { id: semesterId },
            data: {
                name: name !== undefined ? name : semester.name,
                startDate: nextStartDate,
                endDate: nextEndDate,
                registrationDeadline: nextRegistrationDeadline,
                midtermReportDate: nextMidtermReportDate,
                defenseDate: nextDefenseDate,
                registrationOpen:
                    typeof registrationOpen === 'boolean' ? registrationOpen : semester.registrationOpen,
                status: calculatedStatus,
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật đợt đồ án thành công.',
            data: mapSemesterForResponse(updatedSemester),
        });
    } catch (error) {
        next(error);
    }
};

const toggleSemesterRegistration = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.params.id, 10);
        const { registrationOpen } = req.body;

        if (!Number.isInteger(semesterId)) {
            return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ.' });
        }

        if (typeof registrationOpen !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'registrationOpen phải là kiểu boolean.',
            });
        }

        const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
        if (!semester) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đợt đồ án.',
            });
        }

        if (registrationOpen && !isWithinRegistrationWindow(semester)) {
            return res.status(400).json({
                success: false,
                message:
                    'Không thể mở đăng ký ở giai đoạn hiện tại. Chỉ được mở trong khoảng từ ngày bắt đầu đến hạn đăng ký.',
            });
        }

        const warning = getToggleWindowWarning(semester);

        const updated = await prisma.semester.update({
            where: { id: semesterId },
            data: { registrationOpen },
        });

        return res.json({
            success: true,
            message: registrationOpen
                ? 'Đã mở đăng ký đề tài cho học kỳ.'
                : 'Đã đóng đăng ký đề tài cho học kỳ.',
            warning,
            data: mapSemesterForResponse(updated),
        });
    } catch (error) {
        next(error);
    }
};

const deleteSemester = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.params.id, 10);
        if (!Number.isInteger(semesterId)) {
            return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ.' });
        }

        const [relatedTopics, relatedRegistrations, relatedCouncils] = await Promise.all([
            prisma.topic.count({ where: { semesterId } }),
            prisma.topicRegistration.count({ where: { semesterId } }),
            prisma.council.count({ where: { semesterId } }),
        ]);

        if (relatedTopics > 0 || relatedRegistrations > 0 || relatedCouncils > 0) {
            return res.status(400).json({
                success: false,
                message:
                    'Không thể xóa đợt đồ án đã có đề tài, đăng ký hoặc hội đồng liên quan.',
            });
        }

        await prisma.semester.delete({
            where: { id: semesterId },
        });

        res.json({
            success: true,
            message: 'Xóa đợt đồ án thành công.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/semesters/:id/issue-decision
 * Trưởng Viện / Admin ban hành Quyết định giao đề tài kèm danh sách sinh viên nộp BM02
 */
const issuePeriodDecision = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.params.id, 10);
        const { decisionNumber, decisionDate, note } = req.body;
        const userId = req.user.id;

        if (!Number.isInteger(semesterId) || semesterId <= 0) {
            return res.status(400).json({ success: false, message: 'ID học kỳ không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterId },
        });

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đồ án / học kỳ.' });
        }

        const eligibleRegistrations = await prisma.topicRegistration.findMany({
            where: {
                semesterId,
                status: { in: ['BM02_SUBMITTED', 'BM02_RESUBMITTED'] },
                currentBM02Submission: { outcome: 'APPROVED' },
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
            },
        });

        if (eligibleRegistrations.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có sinh viên nào ở trạng thái đã nộp BM02 để ban hành Quyết định.',
            });
        }

        const generatedDecisionNumber = decisionNumber && String(decisionNumber).trim()
            ? String(decisionNumber).trim()
            : `QĐ-${semester.name.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
        const effectiveDecisionDate = decisionDate ? new Date(decisionDate) : new Date();

        const registrationIds = eligibleRegistrations.map((r) => r.id);

        const requestKey = req.get('Idempotency-Key');
        if (!requestKey || requestKey.length < 8) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key là bắt buộc khi ban hành Quyết định.' });
        }
        for (const reg of eligibleRegistrations) {
            await issueAssignmentDecision({
                registrationId: reg.id,
                issuedById: userId,
                decisionNumber: generatedDecisionNumber,
                issuedAt: effectiveDecisionDate,
                idempotencyKey: `${requestKey}:${reg.id}`,
            });
        }

        for (const reg of eligibleRegistrations) {
            const hasBM03 = await prisma.task.findFirst({
                where: { registrationId: reg.id, taskType: 'BM03_CHECKPOINT_1' },
            });
            if (!hasBM03) {
                await prisma.task.create({
                    data: {
                        registrationId: reg.id,
                        title: 'BM03 - Báo cáo tiến độ Đợt 1 (Tuần 6)',
                        content: 'Báo cáo tiến độ thực hiện đồ án đợt 1: khối lượng công việc hoàn thành và kế hoạch giai đoạn tiếp theo.',
                        taskType: 'BM03_CHECKPOINT_1',
                        status: 'OPEN',
                    },
                });
            }
        }

        for (const reg of eligibleRegistrations) {
            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Ban hành Quyết định giao đề tài tốt nghiệp',
                    content: `Viện đã ban hành Quyết định số ${generatedDecisionNumber} giao đề tài "${reg.topic.title}". Bạn có 7 ngày để gửi đơn điều chỉnh tên đề tài nếu cần.`,
                    type: 'APPROVAL',
                },
                'issuePeriodDecision',
            );
        }

        await auditLog(
            userId,
            'ISSUE_PERIOD_DECISION',
            'Semester',
            semesterId,
            {
                decisionNumber: generatedDecisionNumber,
                decisionDate: effectiveDecisionDate,
                studentCount: registrationIds.length,
                note: note || null,
            },
            req.ip || null,
        );

        res.json({
            success: true,
            message: `Đã ban hành Quyết định số ${generatedDecisionNumber} thành công cho ${registrationIds.length} sinh viên.`,
            data: {
                decisionNumber: generatedDecisionNumber,
                decisionDate: effectiveDecisionDate,
                studentCount: registrationIds.length,
                registrationIds,
            },
        });
    } catch (error) {
        next(error);
    }
};

const amendAssignmentDecision = async (req, res, next) => {
    try {
        const assignmentDecisionId = parseInt(req.params.decisionId, 10);
        const { amendmentNumber, reason, changes, effectiveAt } = req.body;
        const result = await createDecisionAmendment({
            assignmentDecisionId,
            signedById: req.user.id,
            amendmentNumber,
            reason,
            changes,
            effectiveAt: effectiveAt ? new Date(effectiveAt) : new Date(),
            idempotencyKey: req.get('Idempotency-Key'),
        });

        if (!result.idempotent) {
            await auditLog(
                req.user.id,
                'CREATE_DECISION_AMENDMENT',
                'DecisionAmendment',
                result.id,
                { assignmentDecisionId, amendmentNumber, reason, changes },
                req.ip || null,
            );
        }
        return res.status(201).json({
            success: true,
            message: 'Đã tạo Quyết định điều chỉnh; Quyết định gốc được giữ nguyên.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError) {
            return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        }
        next(error);
    }
};

module.exports = {
    getAllSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    toggleSemesterRegistration,
    deleteSemester,
    issuePeriodDecision,
    amendAssignmentDecision,
};
