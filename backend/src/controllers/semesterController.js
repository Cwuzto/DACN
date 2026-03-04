const prisma = require('../config/database');

/**
 * Hàm hỗ trợ tính toán trạng thái đợt đồ án dựa trên thời gian
 */
const calculateStatus = (semester) => {
    const now = new Date();
    const start = new Date(semester.startDate);
    const reg = semester.registrationDeadline ? new Date(semester.registrationDeadline) : null;
    const def = semester.defenseDate ? new Date(semester.defenseDate) : null;
    const end = new Date(semester.endDate);

    if (now < start) return 'UPCOMING';
    if (reg && now >= start && now < reg) return 'REGISTRATION';
    if (def) {
        if (now >= (reg || start) && now < def) return 'ONGOING';
        if (now >= def && now < end) return 'DEFENSE';
    } else {
        if (now >= (reg || start) && now < end) return 'ONGOING';
    }
    if (now >= end) return 'COMPLETED';

    return 'UPCOMING';
};

/**
 * Lấy danh sách tất cả đợt đồ án
 */
const getAllSemesters = async (req, res, next) => {
    try {
        const semesters = await prisma.semester.findMany({
            orderBy: { startDate: 'desc' },
        });

        const semestersWithDynamicStatus = semesters.map(sem => ({
            ...sem,
            status: calculateStatus(sem)
        }));

        res.json({
            success: true,
            data: semestersWithDynamicStatus,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy chi tiết một đợt đồ án theo ID
 */
const getSemesterById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const semester = await prisma.semester.findUnique({
            where: { id: parseInt(id) },
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
                status: calculateStatus(semester)
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Tạo mới đợt đồ án (Chỉ Admin)
 */
const createSemester = async (req, res, next) => {
    try {
        const { name, startDate, endDate, registrationDeadline, defenseDate } = req.body;

        // Validation cơ bản
        if (!name || !startDate || !registrationDeadline || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Tên, ngày bắt đầu, hạn đăng ký và ngày kết thúc là bắt buộc.',
            });
        }

        // Tính toán status ban đầu để lưu vào DB (dù sau này có tính lại)
        const dummySemester = { startDate, endDate, registrationDeadline, defenseDate };
        const calculatedStatus = calculateStatus(dummySemester);

        const newSemester = await prisma.semester.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                registrationDeadline: new Date(registrationDeadline),
                defenseDate: defenseDate ? new Date(defenseDate) : null,
                status: calculatedStatus,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Tạo đợt đồ án thành công.',
            data: {
                ...newSemester,
                status: calculatedStatus
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật đợt đồ án (Chỉ Admin)
 */
const updateSemester = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, startDate, endDate, registrationDeadline, defenseDate } = req.body;

        const semester = await prisma.semester.findUnique({
            where: { id: parseInt(id) }
        });

        if (!semester) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đợt đồ án để cập nhật.',
            });
        }

        const newStartDate = startDate ? new Date(startDate) : semester.startDate;
        const newEndDate = endDate ? new Date(endDate) : semester.endDate;
        const newRegistrationDeadline = registrationDeadline ? new Date(registrationDeadline) : semester.registrationDeadline;
        const newDefenseDate = defenseDate !== undefined ? (defenseDate ? new Date(defenseDate) : null) : semester.defenseDate;

        const dummySemester = {
            startDate: newStartDate,
            endDate: newEndDate,
            registrationDeadline: newRegistrationDeadline,
            defenseDate: newDefenseDate
        };
        const calculatedStatus = calculateStatus(dummySemester);

        const updatedSemester = await prisma.semester.update({
            where: { id: parseInt(id) },
            data: {
                name: name !== undefined ? name : semester.name,
                startDate: newStartDate,
                endDate: newEndDate,
                registrationDeadline: newRegistrationDeadline,
                defenseDate: newDefenseDate,
                status: calculatedStatus,
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật đợt đồ án thành công.',
            data: {
                ...updatedSemester,
                status: calculatedStatus
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xóa đợt đồ án (Chỉ Admin)
 */
const deleteSemester = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Kiểm tra xem có topic hay group nào liên quan không, nếu có thì ko cho xóa
        const relatedTopics = await prisma.topic.count({ where: { semesterId: parseInt(id) } });
        const relatedGroups = await prisma.group.count({ where: { semesterId: parseInt(id) } });

        if (relatedTopics > 0 || relatedGroups > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa đợt đồ án đã có đề tài hoặc nhóm sinh viên tham gia.',
            });
        }

        await prisma.semester.delete({
            where: { id: parseInt(id) },
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
    deleteSemester,
};
