const prisma = require('../config/database');

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

const DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS = {
    version: 'v1_standard_14',
    title: 'Barem Tiêu Chuẩn Đánh Giá Bảo Vệ Đồ Án Tốt Nghiệp (4 Nhóm - 14 Mục)',
    description: 'Barem chuẩn đánh giá bảo vệ đồ án tốt nghiệp với 4 nhóm mục, 14 tiêu chí con đạt tổng 10.0 điểm, gắn chuẩn đầu ra (CLO) và 4 mức mô tả.',
    totalMaxScore: 10.0,
    categories: [
        {
            code: 'CAT_REPORT_FORMAT',
            name: 'Hình thức',
            description: 'Đánh giá cấu trúc văn bản khóa luận, trích dẫn tài liệu và phong cách diễn đạt khoa học.',
            maxScore: 1.0,
            orderIndex: 1,
            criteria: [
                {
                    code: 'STRUCTURE',
                    label: 'Cấu trúc, bố cục đề tài',
                    description: 'Bố cục hợp lý, cân đối giữa các chương mục, tuân thủ đúng quy định về định dạng khóa luận tốt nghiệp.',
                    maxScore: 0.5,
                    orderIndex: 1,
                    cloCode: 'CLO1',
                    levelGoodDesc: 'Bố cục chuẩn mực, đầy đủ các phần, mục lục và phân chương hợp lý.',
                    levelFairDesc: 'Bố cục khá tốt, còn thiếu sót nhỏ về phân chia đề mục.',
                    levelAverageDesc: 'Bố cục đạt yêu cầu cơ bản, dung lượng các chương chưa cân đối.',
                    levelPoorDesc: 'Bố cục lộn xộn, thiếu các phần bắt buộc theo quy định.',
                },
                {
                    code: 'CITATION_FORMAT',
                    label: 'Trích dẫn, hình thức trình bày',
                    description: 'Tài liệu tham khảo được trích dẫn đúng chuẩn IEEE/APA, hình ảnh/bảng biểu rõ ràng có chú thích đầy đủ.',
                    maxScore: 0.25,
                    orderIndex: 2,
                    cloCode: 'CLO1',
                    levelGoodDesc: 'Trích dẫn chuẩn xác, danh mục TLTK đầy đủ, bảng biểu hình vẽ rõ ràng.',
                    levelFairDesc: 'Trích dẫn tương đối tốt, một vài nguồn chưa đồng nhất định dạng.',
                    levelAverageDesc: 'Còn nhiều lỗi trích dẫn, thiếu liên kết nguồn trong văn bản.',
                    levelPoorDesc: 'Không trích dẫn nguồn hoặc sao chép không ghi chú.',
                },
                {
                    code: 'LANGUAGE',
                    label: 'Ngôn ngữ diễn đạt',
                    description: 'Hành văn khoa học, rõ ràng, mạch lạc, không mắc lỗi chính tả, câu từ chuẩn mực tiếng Việt hoặc tiếng Anh.',
                    maxScore: 0.25,
                    orderIndex: 3,
                    cloCode: 'CLO1',
                    levelGoodDesc: 'Văn phong khoa học, trong sáng, chuẩn thuật ngữ chuyên ngành.',
                    levelFairDesc: 'Diễn đạt dễ hiểu, chỉ mắc vài lỗi ngữ pháp nhỏ.',
                    levelAverageDesc: 'Câu từ đôi chỗ còn lủng củng, văn phong chưa thuần khoa học.',
                    levelPoorDesc: 'Nhiều lỗi chính tả, câu què cụt, sai thuật ngữ chuyên môn.',
                },
            ],
        },
        {
            code: 'CAT_RESEARCH_CONTENT',
            name: 'Nội dung',
            description: 'Đánh giá tính cấp thiết, phương pháp khoa học, giải pháp thực nghiệm và kết quả nghiên cứu của đề tài.',
            maxScore: 5.0,
            orderIndex: 2,
            criteria: [
                {
                    code: 'PROBLEM_STATEMENT',
                    label: 'Đặt vấn đề, tổng quan tình hình nghiên cứu',
                    description: 'Xác định rõ tính cấp thiết, mục tiêu nghiên cứu cụ thể và tổng quan đầy đủ các công trình nghiên cứu liên quan.',
                    maxScore: 1.0,
                    orderIndex: 1,
                    cloCode: 'CLO2',
                    levelGoodDesc: 'Đặt vấn đề sắc sảo, mục tiêu tường minh, phân tích sâu công trình đi trước.',
                    levelFairDesc: 'Xác định được mục tiêu rõ ràng, tổng quan tương đối đầy đủ.',
                    levelAverageDesc: 'Mục tiêu còn chung chung, tổng quan tài liệu còn mỏng.',
                    levelPoorDesc: 'Không xác định được vấn đề nghiên cứu cốt lõi.',
                },
                {
                    code: 'RESEARCH_METHOD',
                    label: 'Phương pháp nghiên cứu',
                    description: 'Lựa chọn và áp dụng phương pháp nghiên cứu khoa học, mô hình, công nghệ hoặc thuật toán phù hợp với bài toán.',
                    maxScore: 0.5,
                    orderIndex: 2,
                    cloCode: 'CLO2',
                    levelGoodDesc: 'Phương pháp luận vững chắc, lựa chọn công cụ/thuật toán tối ưu.',
                    levelFairDesc: 'Phương pháp khoa học phù hợp, đáp ứng tốt bài toán.',
                    levelAverageDesc: 'Phương pháp áp dụng cơ bản, chưa so sánh ưu nhược điểm kỹ lưỡng.',
                    levelPoorDesc: 'Lựa chọn sai phương pháp hoặc áp dụng không có cơ sở khoa học.',
                },
                {
                    code: 'RESEARCH_CONTENT',
                    label: 'Nội dung nghiên cứu và giải pháp',
                    description: 'Nội dung sâu sắc, kiến trúc hệ thống hợp lý, khối lượng công việc hoàn thành đầy đủ theo đề cương được duyệt.',
                    maxScore: 2.5,
                    orderIndex: 3,
                    cloCode: 'CLO3',
                    levelGoodDesc: 'Giải pháp kiến trúc hoàn chỉnh, khối lượng thực hiện lớn, xử lý tốt tình huống phức tạp.',
                    levelFairDesc: 'Nội dung bám sát đề cương, giải pháp mạch lạc, đáp ứng yêu cầu cốt lõi.',
                    levelAverageDesc: 'Hoàn thành khối lượng ở mức trung bình, giải pháp còn đơn giản.',
                    levelPoorDesc: 'Không đáp ứng được nội dung đề cương, giải pháp chắp vá.',
                },
                {
                    code: 'RESEARCH_RESULT',
                    label: 'Kết quả nghiên cứu và đánh giá',
                    description: 'Sản phẩm/kết quả hoạt động ổn định, có số liệu thực nghiệm, kiểm thử và đánh giá định lượng rõ ràng.',
                    maxScore: 1.0,
                    orderIndex: 4,
                    cloCode: 'CLO3',
                    levelGoodDesc: 'Kết quả rõ ràng, kiểm thử toàn diện, có phân tích định lượng thuyết phục.',
                    levelFairDesc: 'Sản phẩm hoạt động tốt, có kịch bản kiểm thử cụ thể.',
                    levelAverageDesc: 'Kết quả kiểm nghiệm còn sơ sài, thiếu đánh giá độ tin cậy.',
                    levelPoorDesc: 'Không có sản phẩm minh chứng hoặc sản phẩm lỗi không chạy được.',
                },
            ],
        },
        {
            code: 'CAT_APPLICATION_NOVELTY',
            name: 'Tính ứng dụng và triển vọng',
            description: 'Đánh giá tính mới, khả năng ứng dụng thực tế và triển vọng phát triển của đề tài.',
            maxScore: 1.0,
            orderIndex: 3,
            criteria: [
                {
                    code: 'NOVELTY',
                    label: 'Tính mới và tính thời sự',
                    description: 'Đề tài bắt kịp xu hướng công nghệ hiện đại hoặc có giải pháp cải tiến sáng tạo so với các giải pháp hiện có.',
                    maxScore: 0.25,
                    orderIndex: 1,
                    cloCode: 'CLO4',
                    levelGoodDesc: 'Ý tưởng sáng tạo, nắm bắt công nghệ mới nhất trong ngành.',
                    levelFairDesc: 'Có điểm cải tiến đáng ghi nhận so với ứng dụng phổ thông.',
                    levelAverageDesc: 'Áp dụng công nghệ quen thuộc, ít yếu tố mới.',
                    levelPoorDesc: 'Công nghệ lạc hậu, sao chép rập khuôn.',
                },
                {
                    code: 'APPLICABILITY',
                    label: 'Tính ứng dụng thực tiễn',
                    description: 'Khả năng ứng dụng giải quyết bài toán thực tế của doanh nghiệp, trường học hoặc xã hội, tiềm năng chuyển giao.',
                    maxScore: 0.5,
                    orderIndex: 2,
                    cloCode: 'CLO4',
                    levelGoodDesc: 'Khả năng triển khai thực tế ngay, giải quyết bài toán cấp thiết của thực tiễn.',
                    levelFairDesc: 'Có tiềm năng áp dụng tốt trong phạm vi cụ thể.',
                    levelAverageDesc: 'Khó ứng dụng thực tế nếu không cải tiến đáng kể.',
                    levelPoorDesc: 'Không có khả năng ứng dụng thực tiễn.',
                },
                {
                    code: 'PUBLICATION',
                    label: 'Đề tài có bài báo khoa học hoặc giải thưởng',
                    description: 'Có bài báo khoa học được chấp nhận hoặc đăng tải trên kỷ yếu hội thảo, tạp chí chuyên ngành hoặc giải NCKH.',
                    maxScore: 0.25,
                    orderIndex: 3,
                    cloCode: 'CLO4',
                    levelGoodDesc: 'Có bài báo đăng kỷ yếu hội thảo/tạp chí hoặc đạt giải NCKH.',
                    levelFairDesc: 'Bản thảo bài báo hoàn chỉnh, có tiềm năng công bố tốt.',
                    levelAverageDesc: 'Báo cáo tóm tắt NCKH cấp cơ sở.',
                    levelPoorDesc: 'Chưa có hoạt động công bố khoa học.',
                },
            ],
        },
        {
            code: 'CAT_DEFENSE_QA',
            name: 'Phần trình bày báo cáo',
            description: 'Đánh giá kỹ năng báo cáo, thái độ tác phong và năng lực trả lời phản biện của sinh viên trước Hội đồng.',
            maxScore: 3.0,
            orderIndex: 4,
            criteria: [
                {
                    code: 'PRESENTATION_SKILL',
                    label: 'Kỹ năng và hình thức bài thuyết trình',
                    description: 'Slide trực quan, chuyên nghiệp, tự tin, phát âm rõ ràng, quản lý thời gian trình bày đúng quy định.',
                    maxScore: 0.5,
                    orderIndex: 1,
                    cloCode: 'CLO5',
                    levelGoodDesc: 'Slide thiết kế xuất sắc, thuyết trình lôi cuốn, đúng thời gian.',
                    levelFairDesc: 'Thuyết trình rõ ràng, slide trực quan, kiểm soát giờ tốt.',
                    levelAverageDesc: 'Slide nhiều chữ, nói nhỏ hoặc quá giờ một chút.',
                    levelPoorDesc: 'Slide cẩu thả, đọc chữ, quá giờ quy định nghiêm trọng.',
                },
                {
                    code: 'ATTITUDE',
                    label: 'Thái độ, tác phong, bản lĩnh học thuật',
                    description: 'Tác phong nghiêm túc, chuẩn mực, cầu thị, lắng nghe và tiếp thu các ý kiến góp ý của Hội đồng.',
                    maxScore: 0.5,
                    orderIndex: 2,
                    cloCode: 'CLO5',
                    levelGoodDesc: 'Tác phong đĩnh đạc, bản lĩnh học thuật tốt, khiêm tốn cầu thị.',
                    levelFairDesc: 'Thái độ nghiêm túc, tôn trọng hội đồng và người nghe.',
                    levelAverageDesc: 'Tác phong còn thiếu tự tin, lúng túng khi trình bày.',
                    levelPoorDesc: 'Thiếu nghiêm túc, thái độ chưa đúng mực trước Hội đồng.',
                },
                {
                    code: 'PRESENTATION_CONTENT',
                    label: 'Nội dung bài thuyết trình',
                    description: 'Trình bày cô đọng, làm nổi bật được trọng tâm của đề tài, các đóng góp cốt lõi và các hạn chế cần khắc phục.',
                    maxScore: 1.0,
                    orderIndex: 3,
                    cloCode: 'CLO5',
                    levelGoodDesc: 'Nội dung cô đọng, làm nổi bật tuyệt vời đóng góp cốt lõi của đề tài.',
                    levelFairDesc: 'Nêu bật được các kết quả chính và hạn chế của đề tài.',
                    levelAverageDesc: 'Nội dung còn dàn trải, chưa nhấn mạnh được trọng tâm nghiên cứu.',
                    levelPoorDesc: 'Nội dung sơ sài, trình bày lạc hướng.',
                },
                {
                    code: 'QA_RESPONSE',
                    label: 'Trả lời các câu hỏi phản biện',
                    description: 'Hiểu sâu bản chất vấn đề, trả lời chính xác, lập luận thuyết phục các câu hỏi chuyên môn từ thành viên Hội đồng.',
                    maxScore: 1.0,
                    orderIndex: 4,
                    cloCode: 'CLO5',
                    levelGoodDesc: 'Nắm vững kiến thức, trả lời chính xác và phản biện thuyết phục.',
                    levelFairDesc: 'Trả lời đúng hầu hết các câu hỏi của các thành viên.',
                    levelAverageDesc: 'Trả lời được câu hỏi cơ bản, còn ấp úng với câu hỏi sâu.',
                    levelPoorDesc: 'Không trả lời được các câu hỏi chuyên môn cơ bản.',
                },
            ],
        },
    ],
};

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
                cloCode: cri.cloCode || null,
                levelGoodDesc: cri.levelGoodDesc || null,
                levelFairDesc: cri.levelFairDesc || null,
                levelAverageDesc: cri.levelAverageDesc || null,
                levelPoorDesc: cri.levelPoorDesc || null,
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
                            cloCode: cri.cloCode ? String(cri.cloCode).trim() : null,
                            levelGoodDesc: cri.levelGoodDesc ? String(cri.levelGoodDesc).trim() : null,
                            levelFairDesc: cri.levelFairDesc ? String(cri.levelFairDesc).trim() : null,
                            levelAverageDesc: cri.levelAverageDesc ? String(cri.levelAverageDesc).trim() : null,
                            levelPoorDesc: cri.levelPoorDesc ? String(cri.levelPoorDesc).trim() : null,
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
                                cloCode: cri.cloCode ? String(cri.cloCode).trim() : null,
                                levelGoodDesc: cri.levelGoodDesc ? String(cri.levelGoodDesc).trim() : null,
                                levelFairDesc: cri.levelFairDesc ? String(cri.levelFairDesc).trim() : null,
                                levelAverageDesc: cri.levelAverageDesc ? String(cri.levelAverageDesc).trim() : null,
                                levelPoorDesc: cri.levelPoorDesc ? String(cri.levelPoorDesc).trim() : null,
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
 * Khóa phiên bản Rubric (Immutable, totalMaxScore = 10.0, status = ACTIVE)
 */
const lockRubricVersion = async (id, { semesterId, actorId } = {}) => {
    const isId = Number.isInteger(Number(id)) && Number(id) > 0;
    const where = isId ? { id: Number(id) } : { version: String(id) };

    const rubric = await prisma.rubricVersion.findUnique({
        where,
        include: {
            categories: {
                include: { criteria: true },
                orderBy: { orderIndex: 'asc' },
            },
        },
    });

    if (!rubric) {
        const error = new Error('Không tìm thấy phiên bản Rubric.');
        error.statusCode = 404;
        throw error;
    }

    const validation = validateRubricStructure(rubric.categories, 10.0);
    if (!validation.ok) {
        const error = new Error(`Cấu trúc Rubric không hợp lệ để khóa: ${validation.message}`);
        error.statusCode = 400;
        throw error;
    }

    const lockedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
        const updatedRubric = await tx.rubricVersion.update({
            where: { id: rubric.id },
            data: {
                lockedAt,
                lockedById: actorId || null,
                status: 'ACTIVE',
                isActive: true,
            },
            include: {
                categories: {
                    include: { criteria: true },
                    orderBy: { orderIndex: 'asc' },
                },
            },
        });

        const targetSemesterId = semesterId ? Number(semesterId) : rubric.semesterId;
        if (targetSemesterId) {
            await tx.semester.update({
                where: { id: targetSemesterId },
                data: {
                    lockedDefenseRubricVersionId: rubric.id,
                },
            });
        }

        return updatedRubric;
    });

    return updated;
};

/**
 * Khôi phục cấu trúc mẫu mặc định chuẩn 4 nhóm, 14 mục
 */
const restoreDefaultReferenceRubric = async (id, userId) => {
    return updateRubricVersion(id, {
        title: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.title,
        description: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.description,
        categories: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.categories,
    });
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
    DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS,
    checkCanEditRubric,
    validateRubricStructure,
    getRubricVersions,
    getActiveRubric,
    getRubricById,
    createRubricVersion,
    updateRubricVersion,
    lockRubricVersion,
    restoreDefaultReferenceRubric,
    activateRubricVersion,
    deleteRubricVersion,
};
