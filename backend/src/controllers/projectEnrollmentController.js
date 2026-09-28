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
        const source = ['SEED', 'MANUAL', 'EXCEL'].includes(req.query.source) ? req.query.source : null;
        const importBatchId = typeof req.query.importBatchId === 'string' && req.query.importBatchId.trim()
            ? req.query.importBatchId.trim()
            : null;

        const where = {};
        if (semesterId) where.semesterId = semesterId;
        if (studentId) where.studentId = studentId;
        if (projectCatalogId) where.projectCatalogId = projectCatalogId;
        if (source) where.source = source;
        if (importBatchId) where.importBatchId = importBatchId;

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
            source: item.source === 'MANUAL' || item.source === 'EXCEL' || item.source === 'SEED' ? item.source : 'MANUAL',
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

const downloadEnrollmentTemplate = async (req, res, next) => {
    try {
        const { generateEnrollmentTemplateBuffer } = require('../utils/excelHelper');
        const buffer = generateEnrollmentTemplateBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Mau_Gan_Mon_Do_An.xlsx"');
        return res.send(buffer);
    } catch (error) {
        next(error);
    }
};

const importEnrollmentsExcel = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.body.semesterId);
        const projectCatalogId = parsePositiveInt(req.body.projectCatalogId);
        const { items, importBatchId } = req.body;

        if (!semesterId || !projectCatalogId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn Học kỳ và Tên đồ án hợp lệ.' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách sinh viên import không được để trống.' });
        }

        const [semester, catalog] = await Promise.all([
            prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true, name: true } }),
            prisma.projectCatalog.findUnique({ where: { id: projectCatalogId }, select: { id: true, name: true } }),
        ]);

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin học kỳ.' });
        }
        if (!catalog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục đồ án.' });
        }

        const batchCode = typeof importBatchId === 'string' && importBatchId.trim()
            ? importBatchId.trim()
            : `BATCH_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;

        const errorRows = [];
        const rawCodes = [];

        items.forEach((item, index) => {
            const rowIdx = index + 1;
            const code = item.studentCode || item.code || item['Mã SV (*)'] || item['Mã SV'] || item['Mã số'];
            if (!code || !String(code).trim()) {
                errorRows.push({ row: rowIdx, code: '', message: 'Thiếu mã sinh viên' });
                return;
            }
            rawCodes.push({ rowIdx, code: String(code).trim().toUpperCase() });
        });

        const seenCodes = new Set();
        const uniqueItems = [];
        for (const item of rawCodes) {
            if (seenCodes.has(item.code)) {
                errorRows.push({ row: item.rowIdx, code: item.code, message: 'Mã SV bị trùng lặp trong file' });
                continue;
            }
            seenCodes.add(item.code);
            uniqueItems.push(item);
        }

        // Tìm kiếm các sinh viên trong database
        const lookupCodes = uniqueItems.map((it) => it.code);
        const students = await prisma.user.findMany({
            where: {
                code: { in: lookupCodes },
                role: 'STUDENT',
            },
            select: { id: true, code: true, fullName: true, isActive: true },
        });

        const studentMap = new Map(students.map((s) => [s.code, s]));
        const validStudentRows = [];

        for (const item of uniqueItems) {
            const foundStudent = studentMap.get(item.code);
            if (!foundStudent) {
                errorRows.push({
                    row: item.rowIdx,
                    code: item.code,
                    message: 'Không tìm thấy tài khoản sinh viên với mã này trong hệ thống',
                });
                continue;
            }
            if (!foundStudent.isActive) {
                errorRows.push({
                    row: item.rowIdx,
                    code: item.code,
                    message: `Tài khoản sinh viên (${foundStudent.fullName}) hiện đang bị khóa`,
                });
                continue;
            }

            validStudentRows.push({
                studentId: foundStudent.id,
                semesterId,
                projectCatalogId,
                status: 'ACTIVE',
                source: 'EXCEL',
                importBatchId: batchCode,
            });
        }

        let createdCount = 0;
        let updatedCount = 0;

        if (validStudentRows.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const row of validStudentRows) {
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
                                status: 'ACTIVE',
                                source: 'EXCEL',
                                importBatchId: row.importBatchId,
                            },
                        });
                        updatedCount += 1;
                    } else {
                        await tx.studentProjectEnrollment.create({ data: row });
                        createdCount += 1;
                    }
                }
            });
        }

        res.json({
            success: true,
            message: `Gán môn đồ án hoàn tất: Thêm mới ${createdCount}, Cập nhật ${updatedCount}, Lỗi ${errorRows.length}`,
            data: {
                total: items.length,
                createdCount,
                updatedCount,
                batchId: batchCode,
                errors: errorRows,
            },
        });
    } catch (error) {
        next(error);
    }
};

const exportEnrollmentsExcel = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.query.semesterId);
        const studentId = parsePositiveInt(req.query.studentId);
        const projectCatalogId = parsePositiveInt(req.query.projectCatalogId);
        const source = ['SEED', 'MANUAL', 'EXCEL'].includes(req.query.source) ? req.query.source : null;
        const importBatchId = typeof req.query.importBatchId === 'string' && req.query.importBatchId.trim()
            ? req.query.importBatchId.trim()
            : null;

        const where = {};
        if (semesterId) where.semesterId = semesterId;
        if (studentId) where.studentId = studentId;
        if (projectCatalogId) where.projectCatalogId = projectCatalogId;
        if (source) where.source = source;
        if (importBatchId) where.importBatchId = importBatchId;

        const rows = await prisma.studentProjectEnrollment.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                semester: { select: { id: true, name: true, status: true } },
                projectCatalog: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ semesterId: 'desc' }, { studentId: 'asc' }],
        });

        const excelData = rows.map((r) => ({
            'Mã SV': r.student?.code || '',
            'Họ và tên': r.student?.fullName || '',
            'Email': r.student?.email || '',
            'Khoa / Bộ môn': r.student?.department || '',
            'Học kỳ': r.semester?.name || '',
            'Tên đồ án': r.projectCatalog?.name || '',
            'Mã đồ án': r.projectCatalog?.code || '',
            'Nguồn gán': r.source || 'MANUAL',
            'Đợt Import': r.importBatchId || '',
            'Trạng thái': r.status === 'ACTIVE' ? 'Đang hiệu lực' : 'Đã hủy',
            'Ngày gán': r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
        }));

        const colWidths = [
            { wch: 14 },
            { wch: 26 },
            { wch: 32 },
            { wch: 28 },
            { wch: 24 },
            { wch: 30 },
            { wch: 14 },
            { wch: 14 },
            { wch: 24 },
            { wch: 16 },
            { wch: 16 },
        ];

        const { createExcelBuffer } = require('../utils/excelHelper');
        const buffer = createExcelBuffer('Danh_Sach_Gan_Do_An', excelData, colWidths);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_gan_do_an_${Date.now()}.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listProjectCatalogs,
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
    deleteStudentProjectEnrollment,
    downloadEnrollmentTemplate,
    importEnrollmentsExcel,
    exportEnrollmentsExcel,
};


