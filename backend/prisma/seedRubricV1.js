require('dotenv').config();
const prisma = require('../src/config/database');

const RUBRIC_V1_SEED = {
    version: 'v1',
    title: 'Barem Tiêu Chuẩn Đánh Giá Bảo Vệ Đồ Án Tốt Nghiệp (Chuẩn K2026)',
    description: 'Barem điểm đánh giá bảo vệ đồ án tốt nghiệp chuẩn hóa 4 nhóm mục, tổng 14 tiêu chí đạt tổng điểm 10.0 tuyệt đối.',
    totalMaxScore: 10.0,
    status: 'ACTIVE',
    isActive: true,
    categories: [
        {
            code: 'CAT_REPORT_FORMAT',
            name: '1. Hình thức và kỹ năng trình bày báo cáo',
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
                },
                {
                    code: 'CITATION_FORMAT',
                    label: 'Trích dẫn, hình thức trình bày',
                    description: 'Tài liệu tham khảo được trích dẫn đúng chuẩn IEEE/APA, hình ảnh/bảng biểu rõ ràng có chú thích đầy đủ.',
                    maxScore: 0.25,
                    orderIndex: 2,
                },
                {
                    code: 'LANGUAGE',
                    label: 'Ngôn ngữ diễn đạt',
                    description: 'Hành văn khoa học, rõ ràng, mạch lạc, không mắc lỗi chính tả, câu từ chuẩn mực tiếng Việt hoặc tiếng Anh.',
                    maxScore: 0.25,
                    orderIndex: 3,
                },
            ],
        },
        {
            code: 'CAT_RESEARCH_CONTENT',
            name: '2. Nội dung và kết quả nghiên cứu',
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
                },
                {
                    code: 'RESEARCH_METHOD',
                    label: 'Phương pháp nghiên cứu',
                    description: 'Lựa chọn và áp dụng phương pháp nghiên cứu khoa học, mô hình, công nghệ hoặc thuật toán phù hợp với bài toán.',
                    maxScore: 0.5,
                    orderIndex: 2,
                },
                {
                    code: 'RESEARCH_CONTENT',
                    label: 'Nội dung nghiên cứu và giải pháp',
                    description: 'Nội dung sâu sắc, kiến trúc hệ thống hợp lý, khối lượng công việc hoàn thành đầy đủ theo đề cương được duyệt.',
                    maxScore: 2.5,
                    orderIndex: 3,
                },
                {
                    code: 'RESEARCH_RESULT',
                    label: 'Kết quả nghiên cứu và đánh giá',
                    description: 'Sản phẩm/kết quả hoạt động ổn định, có số liệu thực nghiệm, kiểm thử và đánh giá định lượng rõ ràng.',
                    maxScore: 1.0,
                    orderIndex: 4,
                },
            ],
        },
        {
            code: 'CAT_APPLICATION_NOVELTY',
            name: '3. Tính thời sự, ứng dụng và công bố',
            description: 'Đánh giá tính mới, khả năng ứng dụng thực tế và công bố khoa học của đề tài.',
            maxScore: 1.0,
            orderIndex: 3,
            criteria: [
                {
                    code: 'NOVELTY',
                    label: 'Tính mới và tính thời sự',
                    description: 'Đề tài bắt kịp xu hướng công nghệ hiện đại hoặc có giải pháp cải tiến sáng tạo so với các giải pháp hiện có.',
                    maxScore: 0.25,
                    orderIndex: 1,
                },
                {
                    code: 'APPLICABILITY',
                    label: 'Tính ứng dụng thực tiễn',
                    description: 'Khả năng ứng dụng giải quyết bài toán thực tế của doanh nghiệp, trường học hoặc xã hội, tiềm năng chuyển giao.',
                    maxScore: 0.5,
                    orderIndex: 2,
                },
                {
                    code: 'PUBLICATION',
                    label: 'Đề tài có bài báo khoa học',
                    description: 'Có bài báo khoa học được chấp nhận hoặc đăng tải trên kỷ yếu hội thảo, tạp chí chuyên ngành hoặc giải NCKH.',
                    maxScore: 0.25,
                    orderIndex: 3,
                },
            ],
        },
        {
            code: 'CAT_DEFENSE_QA',
            name: '4. Thuyết trình và trả lời câu hỏi Hội đồng',
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
                },
                {
                    code: 'ATTITUDE',
                    label: 'Thái độ, tác phong, bản lĩnh học thuật',
                    description: 'Tác phong nghiêm túc, chuẩn mực, cầu thị, lắng nghe và tiếp thu các ý kiến góp ý của Hội đồng.',
                    maxScore: 0.5,
                    orderIndex: 2,
                },
                {
                    code: 'PRESENTATION_CONTENT',
                    label: 'Nội dung bài thuyết trình',
                    description: 'Trình bày cô đọng, làm nổi bật được trọng tâm của đề tài, các đóng góp cốt lõi và các hạn chế cần khắc phục.',
                    maxScore: 1.0,
                    orderIndex: 3,
                },
                {
                    code: 'QA_RESPONSE',
                    label: 'Trả lời các câu hỏi phản biện',
                    description: 'Hiểu sâu bản chất vấn đề, trả lời chính xác, lập luận thuyết phục các câu hỏi chuyên môn từ thành viên Hội đồng.',
                    maxScore: 1.0,
                    orderIndex: 4,
                },
            ],
        },
    ],
};

async function seedRubricV1() {
    console.log('🔄 Bắt đầu seed Barem Rubric v1...');

    const existing = await prisma.rubricVersion.findUnique({
        where: { version: RUBRIC_V1_SEED.version },
        include: { categories: { include: { criteria: true } } },
    });

    if (existing) {
        console.log(`ℹ️ Phiên bản Rubric ${RUBRIC_V1_SEED.version} đã tồn tại. Đảm bảo trạng thái ACTIVE...`);
        await prisma.rubricVersion.update({
            where: { id: existing.id },
            data: {
                isActive: true,
                status: 'ACTIVE',
                title: RUBRIC_V1_SEED.title,
                description: RUBRIC_V1_SEED.description,
            },
        });
        console.log('✅ Đã cập nhật trạng thái ACTIVE cho phiên bản v1.');
        return;
    }

    const created = await prisma.rubricVersion.create({
        data: {
            version: RUBRIC_V1_SEED.version,
            title: RUBRIC_V1_SEED.title,
            description: RUBRIC_V1_SEED.description,
            totalMaxScore: RUBRIC_V1_SEED.totalMaxScore,
            status: RUBRIC_V1_SEED.status,
            isActive: RUBRIC_V1_SEED.isActive,
            categories: {
                create: RUBRIC_V1_SEED.categories.map((cat) => ({
                    code: cat.code,
                    name: cat.name,
                    description: cat.description,
                    maxScore: cat.maxScore,
                    orderIndex: cat.orderIndex,
                    criteria: {
                        create: cat.criteria.map((cri) => ({
                            code: cri.code,
                            label: cri.label,
                            description: cri.description,
                            maxScore: cri.maxScore,
                            orderIndex: cri.orderIndex,
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

    const totalCriteria = created.categories.reduce((acc, cat) => acc + cat.criteria.length, 0);
    console.log(`🎉 Đã khởi tạo thành công Rubric ${created.version}: ${created.categories.length} nhóm mục, ${totalCriteria} tiêu chí con, tổng điểm: ${created.totalMaxScore}`);
}

seedRubricV1()
    .catch((err) => {
        console.error('❌ Lỗi khi seed Rubric v1:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
