const prisma = require('../config/database');

const COMPLETED_GRADUATION_STATUSES = ['DEFENDED', 'COMPLETED'];

const hasCompletedGraduationProject = async (studentId) => {
    if (!Number.isInteger(studentId)) return false;

    const completed = await prisma.topicRegistration.findFirst({
        where: {
            studentId,
            status: { in: COMPLETED_GRADUATION_STATUSES },
        },
        select: { id: true },
    });

    return Boolean(completed);
};

const STUDENT_RESTRICTION_MESSAGE = 'Tài khoản sinh viên đã hoàn thành đồ án tốt nghiệp nên không thể đăng ký/đề xuất đề tài mới.';

module.exports = {
    COMPLETED_GRADUATION_STATUSES,
    hasCompletedGraduationProject,
    STUDENT_RESTRICTION_MESSAGE,
};

