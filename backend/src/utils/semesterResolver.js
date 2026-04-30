const prisma = require('../config/database');

const getDefaultSemester = async (select = { id: true }) => {
    const now = new Date();

    const activeSemester = await prisma.semester.findFirst({
        where: {
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: { startDate: 'desc' },
        select,
    });

    if (activeSemester) return activeSemester;

    const latestFinishedSemester = await prisma.semester.findFirst({
        where: {
            endDate: { lt: now },
        },
        orderBy: { endDate: 'desc' },
        select,
    });

    if (latestFinishedSemester) return latestFinishedSemester;

    return prisma.semester.findFirst({
        orderBy: { startDate: 'desc' },
        select,
    });
};

module.exports = {
    getDefaultSemester,
};
