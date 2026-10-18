const prisma = require('../config/database');

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

/**
 * Kiểm tra xem hệ thống có đang trong đợt đồ án hay không.
 * Điều kiện cho phép sửa Rubric:
 * - Không có học kỳ nào ở trạng thái ONGOING hoặc DEFENSE
 * - Chưa có học kỳ nào đã bắt đầu (ngày hiện tại >= startDate và <= endDate)
 */
const checkCanEditRubric = async () => {
    const now = new Date();

    // 1. Kiểm tra trạng thái học kỳ
    const ongoingSemester = await prisma.semester.findFirst({
        where: {
            status: { in: ['ONGOING', 'DEFENSE'] },
        },
    });

    if (ongoingSemester) {
        return {
            canEdit: false,
            reason: `Học kỳ "${ongoingSemester.name}" đang trong giai đoạn thực hiện đồ án hoặc bảo vệ. Barem chấm điểm đã bị khóa để đảm bảo tính công bằng.`,
            semester: ongoingSemester,
        };
    }

    // 2. Kiểm tra ngày bắt đầu học kỳ
    const startedSemester = await prisma.semester.findFirst({
        where: {
            startDate: { lte: now },
            endDate: { gte: now },
        },
    });

    if (startedSemester) {
        return {
            canEdit: false,
            reason: `Học kỳ "${startedSemester.name}" đã bắt đầu (từ ngày ${new Date(startedSemester.startDate).toLocaleDateString('vi-VN')}). Barem chấm điểm đã bị khóa.`,
            semester: startedSemester,
        };
    }

    return {
        canEdit: true,
        reason: 'Hệ thống chưa vào đợt đồ án. Quản trị viên có toàn quyền cấu hình barem điểm.',
    };
};

/**
 * Kiểm tra tính hợp lệ của cấu trúc Rubric
 * - Mỗi mục có ít nhất 1 tiêu chí con
 * - Tổng điểm các tiêu chí con trong mục = maxScore của mục
 * - Tổng điểm tất cả các mục = 10.0 điểm
 */
const validateRubricStructure = (categories = [], expectedTotal = 10.0) => {
    if (!Array.isArray(categories) || categories.length === 0) {
        return { ok: false, message: 'Barem phải có ít nhất 1 nhóm mục (Category).' };
    }

    const seenCategoryCodes = new Set();
    const seenCriterionCodes = new Set();
    let totalCategoriesScore = 0;

    for (let cIdx = 0; cIdx < categories.length; cIdx += 1) {
        const cat = categories[cIdx];
        const catCode = String(cat.code || '').trim().toUpperCase();
        const catName = String(cat.name || '').trim();
        const catMaxScore = Number(cat.maxScore);

        if (!catCode) {
            return { ok: false, message: `Mục số ${cIdx + 1} chưa có mã định danh (Code).` };
        }
        if (seenCategoryCodes.has(catCode)) {
            return { ok: false, message: `Mã mục "${catCode}" bị trùng lặp.` };
        }
        seenCategoryCodes.add(catCode);

        if (!catName) {
            return { ok: false, message: `Mục "${catCode}" chưa có tên hiển thị.` };
        }
        if (!Number.isFinite(catMaxScore) || catMaxScore <= 0) {
            return { ok: false, message: `Điểm tối đa của mục "${catName}" phải là số dương lớn hơn 0.` };
        }

        const criteria = cat.criteria || [];
        if (!Array.isArray(criteria) || criteria.length === 0) {
            return { ok: false, message: `Mục "${catName}" phải có ít nhất 1 tiêu chí con.` };
        }

        let sumCriteriaScore = 0;
        for (let crIdx = 0; crIdx < criteria.length; crIdx += 1) {
            const cri = criteria[crIdx];
            const criCode = String(cri.code || '').trim().toUpperCase();
            const criLabel = String(cri.label || '').trim();
            const criMaxScore = Number(cri.maxScore);

            if (!criCode) {
                return { ok: false, message: `Tiêu chí thứ ${crIdx + 1} trong mục "${catName}" chưa có mã.` };
            }
            if (seenCriterionCodes.has(criCode)) {
                return { ok: false, message: `Mã tiêu chí "${criCode}" bị trùng lặp.` };
            }
            seenCriterionCodes.add(criCode);

            if (!criLabel) {
                return { ok: false, message: `Tiêu chí "${criCode}" chưa có tên tiêu chí.` };
            }
            if (!Number.isFinite(criMaxScore) || criMaxScore <= 0) {
                return { ok: false, message: `Điểm của tiêu chí "${criLabel}" phải lớn hơn 0.` };
            }

            sumCriteriaScore += criMaxScore;
        }

        sumCriteriaScore = round2(sumCriteriaScore);
        if (Math.abs(sumCriteriaScore - catMaxScore) > 0.001) {
            return {
                ok: false,
                message: `Tổng điểm các tiêu chí trong mục "${catName}" (${sumCriteriaScore}đ) không khớp với điểm tối đa của mục (${catMaxScore}đ).`,
            };
        }

        totalCategoriesScore += catMaxScore;
    }

    totalCategoriesScore = round2(totalCategoriesScore);
    if (Math.abs(totalCategoriesScore - expectedTotal) > 0.001) {
        return {
            ok: false,
            message: `Tổng điểm của tất cả các mục là ${totalCategoriesScore}đ. Bắt buộc phải bằng chính xác ${expectedTotal}đ.`,
        };
    }

    return { ok: true, totalScore: totalCategoriesScore };
};

/**
 * Lấy danh sách tất cả các phiên bản Rubric
 */
const getRubricVersions = async () => {
    const editCheck = await checkCanEditRubric();

    const versions = await prisma.rubricVersion.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        include: {
            categories: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    maxScore: true,
                    _count: { select: { criteria: true } },
                },
                orderBy: { orderIndex: 'asc' },
            },
            createdByUser: {
                select: { id: true, fullName: true, email: true },
            },
        },
    });

    return {
        versions: versions.map((v) => {
            const totalCriteria = v.categories.reduce((sum, c) => sum + (c._count?.criteria || 0), 0);
            return {
                id: v.id,
                version: v.version,
                title: v.title,
                description: v.description,
                totalMaxScore: v.totalMaxScore,
                status: v.status,
                isActive: v.isActive,
                createdAt: v.createdAt,
                updatedAt: v.updatedAt,
                createdByUser: v.createdByUser,
                categoriesCount: v.categories.length,
                criteriaCount: totalCriteria,
                categories: v.categories,
            };
        }),
        systemEditable: editCheck.canEdit,
        systemEditableReason: editCheck.reason,
    };
};

/**
 * Lấy chi tiết phiên bản Rubric đang ACTIVE
 */
const getActiveRubric = async () => {
    if (!prisma?.rubricVersion?.findFirst) return null;
    const rubric = await prisma.rubricVersion.findFirst({
        where: { isActive: true },
        include: {
            categories: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    criteria: {
                        orderBy: { orderIndex: 'asc' },
                    },
                },
            },
        },
    });

    return rubric;
};

/**
 * Lấy chi tiết phiên bản Rubric theo ID hoặc Version string
 */
const getRubricById = async (idOrVersion) => {
    const isId = Number.isInteger(Number(idOrVersion)) && Number(idOrVersion) > 0;
    const where = isId ? { id: Number(idOrVersion) } : { version: String(idOrVersion) };

    const rubric = await prisma.rubricVersion.findUnique({
        where,
        include: {
            categories: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    criteria: {
                        orderBy: { orderIndex: 'asc' },
                    },
                },
            },
            createdByUser: {
                select: { id: true, fullName: true, email: true },
            },
        },
    });

    if (!rubric) return null;

    // Kiểm tra xem phiên bản này đã có điểm số nào gắn vào chưa
    const usedInMemberScores = await prisma.defenseMemberScore.count({
        where: { scoreRubricVersion: rubric.version },
    });
    const usedInResults = await prisma.defenseResult.count({
        where: { scoreRubricVersion: rubric.version },
    });

    const isLockedByGrading = (usedInMemberScores + usedInResults) > 0;

    return {
        ...rubric,
        isLockedByGrading,
        totalGradedSubmissions: usedInMemberScores + usedInResults,
    };
};

/**
 * Tạo phiên bản Rubric mới (hoặc Clone từ phiên bản cũ)
 */
const createRubricVersion = async ({ version, title, description, categories = [], cloneFromId, userId }) => {
    const editCheck = await checkCanEditRubric();
    if (!editCheck.canEdit) {
        throw new Error(editCheck.reason);
    }

    const cleanVersion = String(version || '').trim().toLowerCase();
    if (!cleanVersion) {
        throw new Error('Mã phiên bản (version) không được để trống.');
    }

    const existing = await prisma.rubricVersion.findUnique({
        where: { version: cleanVersion },
    });
    if (existing) {
        throw new Error(`Phiên bản "${cleanVersion}" đã tồn tại trên hệ thống.`);
    }

    let finalCategories = categories;

    // Nếu chọn clone từ một phiên bản cũ
    if (cloneFromId) {
        const sourceRubric = await getRubricById(cloneFromId);
        if (!sourceRubric) {
            throw new Error('Phiên bản gốc cần nhân bản không tồn tại.');
        }

        finalCategories = sourceRubric.categories.map((cat, catIdx) => ({
            code: cat.code,
            name: cat.name,
            description: cat.description,
            maxScore: cat.maxScore,
            orderIndex: cat.orderIndex ?? (catIdx + 1),
            criteria: (cat.criteria || []).map((cri, criIdx) => ({
                code: cri.code,
                label: cri.label,
                description: cri.description,
                maxScore: cri.maxScore,
                orderIndex: cri.orderIndex ?? (criIdx + 1),
            })),
        }));
    }

    // Nếu có categories, kiểm tra tính hợp lệ
    let totalMaxScore = 10.0;
    if (finalCategories && finalCategories.length > 0) {
        const validation = validateRubricStructure(finalCategories, 10.0);
        if (!validation.ok) {
            throw new Error(validation.message);
        }
        totalMaxScore = validation.totalScore;
    }

    const created = await prisma.rubricVersion.create({
        data: {
            version: cleanVersion,
            title: String(title || `Barem đánh giá ${cleanVersion}`).trim(),
            description: description ? String(description).trim() : null,
            totalMaxScore,
            status: 'DRAFT',
            isActive: false,
            createdById: userId || null,
            categories: {
                create: finalCategories.map((cat, catIdx) => ({
                    code: String(cat.code).trim().toUpperCase(),
                    name: String(cat.name).trim(),
                    description: cat.description ? String(cat.description).trim() : null,
                    maxScore: Number(cat.maxScore),
                    orderIndex: cat.orderIndex ?? (catIdx + 1),
                    criteria: {
                        create: (cat.criteria || []).map((cri, criIdx) => ({
                            code: String(cri.code).trim().toUpperCase(),
                            label: String(cri.label).trim(),
                            description: cri.description ? String(cri.description).trim() : null,
                            maxScore: Number(cri.maxScore),
                            orderIndex: cri.orderIndex ?? (criIdx + 1),
                        })),
                    },
                })),
            },
        },
        include: {
            categories: {
                include: { criteria: true },
            },
        },
    });

    return created;
};

/**
 * Cập nhật cấu trúc Rubric (Chỉ cho phép khi chưa vào đợt đồ án)
 */
const updateRubricVersion = async (id, { title, description, categories = [] }) => {
    const editCheck = await checkCanEditRubric();
    if (!editCheck.canEdit) {
        throw new Error(editCheck.reason);
    }

    const rubric = await getRubricById(id);
    if (!rubric) {
        throw new Error('Không tìm thấy phiên bản Rubric.');
    }

    if (rubric.isLockedByGrading) {
        throw new Error(`Phiên bản ${rubric.version} đã có ${rubric.totalGradedSubmissions} điểm số được chấm. Vui lòng nhân bản (Clone) sang phiên bản mới thay vì sửa trực tiếp.`);
    }

    const validation = validateRubricStructure(categories, 10.0);
    if (!validation.ok) {
        throw new Error(validation.message);
    }

    // Thực hiện cập nhật trong transaction: xóa các categories cũ và tạo lại danh sách mới
    const updated = await prisma.$transaction(async (tx) => {
        // Xóa categories cũ (cascade xóa criteria)
        await tx.rubricCategory.deleteMany({
            where: { rubricVersionId: rubric.id },
        });

        // Tạo categories và criteria mới
        const res = await tx.rubricVersion.update({
            where: { id: rubric.id },
            data: {
                title: title !== undefined ? String(title).trim() : rubric.title,
                description: description !== undefined ? String(description).trim() : rubric.description,
                totalMaxScore: validation.totalScore,
                categories: {
                    create: categories.map((cat, catIdx) => ({
                        code: String(cat.code).trim().toUpperCase(),
                        name: String(cat.name).trim(),
                        description: cat.description ? String(cat.description).trim() : null,
                        maxScore: Number(cat.maxScore),
                        orderIndex: cat.orderIndex ?? (catIdx + 1),
                        criteria: {
                            create: (cat.criteria || []).map((cri, criIdx) => ({
                                code: String(cri.code).trim().toUpperCase(),
                                label: String(cri.label).trim(),
                                description: cri.description ? String(cri.description).trim() : null,
                                maxScore: Number(cri.maxScore),
                                orderIndex: cri.orderIndex ?? (criIdx + 1),
                            })),
                        },
                    })),
                },
            },
            include: {
                categories: {
                    include: { criteria: true },
                    orderBy: { orderIndex: 'asc' },
                },
            },
        });

        return res;
    });

    return updated;
};

/**
 * Kích hoạt phiên bản Rubric làm barem chính thức của hệ thống
 */
const activateRubricVersion = async (id) => {
    const editCheck = await checkCanEditRubric();
    if (!editCheck.canEdit) {
        throw new Error(editCheck.reason);
    }

    const rubric = await getRubricById(id);
    if (!rubric) {
        throw new Error('Không tìm thấy phiên bản Rubric.');
    }

    // Validate cấu trúc trước khi kích hoạt
    const validation = validateRubricStructure(rubric.categories, 10.0);
    if (!validation.ok) {
        throw new Error(`Không thể kích hoạt barem chưa hợp lệ: ${validation.message}`);
    }

    await prisma.$transaction(async (tx) => {
        // Đưa các bản active hiện tại về ARCHIVED
        await tx.rubricVersion.updateMany({
            where: { isActive: true },
            data: { isActive: false, status: 'ARCHIVED' },
        });

        // Kích hoạt bản mới
        await tx.rubricVersion.update({
            where: { id: rubric.id },
            data: { isActive: true, status: 'ACTIVE' },
        });
    });

    return getRubricById(id);
};

/**
 * Xóa phiên bản Rubric nháp (DRAFT)
 */
const deleteRubricVersion = async (id) => {
    const rubric = await getRubricById(id);
    if (!rubric) {
        throw new Error('Không tìm thấy phiên bản Rubric.');
    }

    if (rubric.isActive || rubric.status === 'ACTIVE') {
        throw new Error('Không thể xóa phiên bản đang áp dụng chính thức (ACTIVE).');
    }

    if (rubric.isLockedByGrading) {
        throw new Error(`Không thể xóa phiên bản đã có ${rubric.totalGradedSubmissions} hồ sơ chấm điểm liên kết.`);
    }

    await prisma.rubricVersion.delete({
        where: { id: rubric.id },
    });

    return { success: true, message: `Đã xóa phiên bản ${rubric.version}.` };
};

module.exports = {
    checkCanEditRubric,
    validateRubricStructure,
    getRubricVersions,
    getActiveRubric,
    getRubricById,
    createRubricVersion,
    updateRubricVersion,
    activateRubricVersion,
    deleteRubricVersion,
};
