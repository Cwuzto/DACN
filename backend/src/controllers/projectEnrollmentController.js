const prisma = require('../config/database');

const parsePositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const listProjectCatalogs = async (req, res, next) => {
    try {
        const rows = await prisma.projectCatalog.findMany({
            where: { isActive: true },
            orderBy: [{ code: 'asc' }],
        });
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const listStudentProjectEnrollments = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.query.semesterId);
        const studentId = parsePositiveInt(req.query.studentId);
        const projectCatalogId = parsePositiveInt(req.query.projectCatalogId);

        const where = {};
        if (semesterId) where.semesterId = semesterId;
        if (studentId) where.studentId = studentId;
        if (projectCatalogId) where.projectCatalogId = projectCatalogId;

        const rows = await prisma.studentProjectEnrollment.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true } },
                semester: { select: { id: true, name: true, status: true } },
                projectCatalog: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ semesterId: 'desc' }, { studentId: 'asc' }],
        });

        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const bulkUpsertStudentProjectEnrollments = async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items phải là mảng không rỗng.' });
        }

        const normalized = items.map((item) => ({
            studentId: parsePositiveInt(item.studentId),
            semesterId: parsePositiveInt(item.semesterId),
            projectCatalogId: parsePositiveInt(item.projectCatalogId),
            status: item.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
            source: item.source === 'MANUAL' || item.source === 'EXCEL' ? item.source : 'MANUAL',
            importBatchId: item.importBatchId || null,
        }));

        if (normalized.some((row) => !row.studentId || !row.semesterId || !row.projectCatalogId)) {
            return res.status(400).json({
                success: false,
                message: 'Mỗi item phải có studentId, semesterId, projectCatalogId hợp lệ.',
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            let created = 0;
            let updated = 0;

            for (const row of normalized) {
                const existing = await tx.studentProjectEnrollment.findUnique({
                    where: {
                        studentId_semesterId_projectCatalogId: {
                            studentId: row.studentId,
                            semesterId: row.semesterId,
                            projectCatalogId: row.projectCatalogId,
                        },
                    },
                    select: { id: true },
                });

                if (existing) {
                    await tx.studentProjectEnrollment.update({
                        where: { id: existing.id },
                        data: {
                            status: row.status,
                            source: row.source,
                            importBatchId: row.importBatchId,
                        },
                    });
                    updated += 1;
                } else {
                    await tx.studentProjectEnrollment.create({ data: row });
                    created += 1;
                }
            }

            return { created, updated };
        });

        res.json({
            success: true,
            message: 'Đã cập nhật enrollment thành công.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

const deleteStudentProjectEnrollment = async (req, res, next) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, message: 'id không hợp lệ.' });
        }

        await prisma.studentProjectEnrollment.delete({ where: { id } });
        res.json({ success: true, message: 'Đã xóa enrollment.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listProjectCatalogs,
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
    deleteStudentProjectEnrollment,
};

