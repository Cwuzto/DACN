const prisma = require('../config/database');

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

const getAllSemesters = async (_req, res, next) => {
    try {
        const semesters = await prisma.semester.findMany({
            orderBy: { startDate: 'desc' },
        });

        res.json({
            success: true,
            data: semesters.map((semester) => ({
                ...semester,
                status: calculateStatus(semester),
            })),
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
            data: {
                ...semester,
                status: calculateStatus(semester),
            },
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
                defenseDate: defenseDate ? new Date(defenseDate) : null,
                registrationOpen:
                    typeof registrationOpen === 'boolean' ? registrationOpen : true,
                status: calculatedStatus,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Tạo đợt đồ án thành công.',
            data: {
                ...newSemester,
                status: calculatedStatus,
            },
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
                defenseDate: nextDefenseDate,
                registrationOpen:
                    typeof registrationOpen === 'boolean'
                        ? registrationOpen
                        : semester.registrationOpen,
                status: calculatedStatus,
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật đợt đồ án thành công.',
            data: {
                ...updatedSemester,
                status: calculatedStatus,
            },
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

        const updated = await prisma.semester.update({
            where: { id: semesterId },
            data: { registrationOpen },
        });

        return res.json({
            success: true,
            message: registrationOpen
                ? 'Đã mở đăng ký đề tài cho học kỳ.'
                : 'Đã đóng đăng ký đề tài cho học kỳ.',
            data: {
                ...updated,
                status: calculateStatus(updated),
            },
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

module.exports = {
    getAllSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    toggleSemesterRegistration,
    deleteSemester,
};
