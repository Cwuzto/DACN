const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
  $transaction: jest.fn(),
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  topic: { findUnique: jest.fn(), findMany: jest.fn() },
  topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
  titleAdjustmentAppendixItem: { findFirst: jest.fn() },
  topicAssignmentDecisionItem: { findFirst: jest.fn() },
  academicDelegation: { findMany: jest.fn() },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const aiCache = require('../../src/services/ai/aiCache');
const { clearAuthCache } = require('../../src/middlewares/auth');

describe('Academic AI Suite Workflow Integration Tests (TDD)', () => {
  const adminUser = {
    id: 1,
    fullName: 'Quản trị viên',
    email: 'admin@university.edu.vn',
    role: 'ADMIN',
    isActive: true,
    permissionGroups: [
      {
        permissionGroup: {
          code: 'ADMIN_GROUP',
          permissions: [{ permission: { code: 'PROJECT_OVERSIGHT_MANAGE' } }],
        },
      },
    ],
  };

  const mentorUser = {
    id: 2,
    fullName: 'TS. Nguyễn Văn Hướng Dẫn',
    email: 'mentor@university.edu.vn',
    role: 'LECTURER',
    isActive: true,
    permissionGroups: [],
  };

  const student1User = {
    id: 10,
    fullName: 'Nguyễn Văn Sinh Viên',
    code: 'SV2026001',
    email: 'student1@university.edu.vn',
    role: 'STUDENT',
    isActive: true,
    permissionGroups: [],
  };

  const student2User = {
    id: 20,
    fullName: 'Lê Thị Sinh Viên Khác',
    code: 'SV2026002',
    email: 'student2@university.edu.vn',
    role: 'STUDENT',
    isActive: true,
    permissionGroups: [],
  };

  const sampleRegistration = {
    id: 101,
    studentId: 10,
    topicId: 1,
    status: 'BM01_SUBMITTED',
    bm01ApprovedTitleSnapshot: 'Hệ thống gợi ý học tập thích ứng ứng dụng trí tuệ nhân tạo',
    student: student1User,
    topic: {
      id: 1,
      title: 'Hệ thống gợi ý học tập thích ứng ứng dụng trí tuệ nhân tạo',
      mentorId: 2,
      mentor: mentorUser,
    },
  };

  const validOutline = {
    topicTitle: 'Hệ thống gợi ý học tập thích ứng ứng dụng trí tuệ nhân tạo',
    researchContext: 'Bối cảnh chuyển đổi số trong giáo dục đại học đặt ra yêu cầu xây dựng các hệ thống cá nhân hóa học tập.',
    objectives: 'Xây dựng thuật toán gợi ý lộ trình học tập tối ưu cho sinh viên ngành CNTT dựa trên kết quả học tập và phong cách học tập.',
    scope: 'Áp dụng thử nghiệm cho 500 sinh viên khoa CNTT trong phạm vi các môn học cơ sở ngành.',
    methodology: 'Sử dụng mô hình Hybrid Recommendation kết hợp Collaborative Filtering và Content-Based Deep Learning.',
    expectedDeliverables: 'Ứng dụng web, bộ dữ liệu thực nghiệm, báo cáo khoa học và tài liệu kỹ thuật hoàn chỉnh.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache();
    aiCache.clear();
    delete process.env.GEMINI_API_KEY;
    process.env.JWT_SECRET = 'test-secret';

    jwt.verify.mockImplementation((token) => {
      if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
      if (token === 'mentor-token') return { userId: 2, role: 'LECTURER' };
      if (token === 'student1-token') return { userId: 10, role: 'STUDENT' };
      if (token === 'student2-token') return { userId: 20, role: 'STUDENT' };
      throw new Error('invalid token');
    });

    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 1) return adminUser;
      if (where.id === 2) return mentorUser;
      if (where.id === 10) return student1User;
      if (where.id === 20) return student2User;
      return null;
    });

    if (prisma.academicDelegation?.findMany) {
      prisma.academicDelegation.findMany.mockResolvedValue([]);
    }

    prisma.titleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
    prisma.topicAssignmentDecisionItem.findFirst.mockResolvedValue(null);
  });

  describe('Authentication & Input Validation', () => {
    it('returns 401 UNAUTHORIZED when no token is provided', async () => {
      const res = await request(app).post('/api/ai/bm01-copilot').send({
        registrationId: 101,
        outlineContent: validOutline,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 BAD_REQUEST if registrationId or outlineContent is missing in bm01Copilot', async () => {
      const res = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer student1-token')
        .send({ registrationId: 101 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 BAD_REQUEST if title is missing in topicSimilarity', async () => {
      const res = await request(app)
        .post('/api/ai/topic-similarity')
        .set('Authorization', 'Bearer student1-token')
        .send({ summary: 'Mô tả thiếu title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 BAD_REQUEST if registrationId is missing in crossCheckArchive', async () => {
      const res = await request(app)
        .post('/api/ai/cross-check-archive')
        .set('Authorization', 'Bearer student1-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('returns 404 NOT_FOUND if registration does not exist', async () => {
      prisma.topicRegistration.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: 9999,
          outlineContent: validOutline,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('a) POST /api/ai/bm01-copilot: Đánh giá đề cương thành công, trả về điểm và 5 chiều logic', () => {
    it('evaluates outline successfully for the owner student and returns score and 5 dimensions', async () => {
      prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);

      const res = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: 101,
          outlineContent: validOutline,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.overallScore).toBe('number');
      expect(res.body.data.overallScore).toBeGreaterThanOrEqual(1.0);
      expect(res.body.data.overallScore).toBeLessThanOrEqual(10.0);
      expect(Array.isArray(res.body.data.dimensions)).toBe(true);
      expect(res.body.data.dimensions.length).toBe(5);

      res.body.data.dimensions.forEach((dim) => {
        expect(dim).toHaveProperty('name');
        expect(dim).toHaveProperty('status');
        expect(dim).toHaveProperty('feedback');
      });

      expect(Array.isArray(res.body.data.actionableSuggestions)).toBe(true);
    });

    it('evaluates outline successfully when requested by the assigned mentor', async () => {
      prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);

      const res = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer mentor-token')
        .send({
          registrationId: 101,
          outlineContent: validOutline,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dimensions.length).toBe(5);
    });
  });

  describe('b) POST /api/ai/bm01-copilot: Từ chối sinh viên khác cố tình can thiệp hồ sơ không phải của mình (403)', () => {
    it('returns 403 FORBIDDEN when student 2 attempts to run copilot on student 1 registration', async () => {
      prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);

      const res = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer student2-token')
        .send({
          registrationId: 101,
          outlineContent: validOutline,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  describe('c) POST /api/ai/topic-similarity: So sánh đề tài với CSDL, trả về tỷ lệ tương đồng và 3 gợi ý', () => {
    it('compares proposal title with approved historical topics in database and returns similarity and 3 suggestions', async () => {
      prisma.topic.findMany.mockResolvedValue([
        {
          id: 501,
          title: 'Hệ thống gợi ý khóa học thông minh cho sinh viên đại học',
          description: 'Nghiên cứu áp dụng máy học để gợi ý các môn học và tài liệu bổ trợ phù hợp cho sinh viên.',
          mentor: { fullName: 'PGS. TS. Lê Văn Thầy' },
        },
        {
          id: 502,
          title: 'Xây dựng ứng dụng blockchain truy xuất nguồn gốc nông sản xuất khẩu',
          description: 'Hệ thống quản lý chuỗi cung ứng thực phẩm sạch sử dụng Hyperledger Fabric.',
          mentor: { fullName: 'TS. Hoàng Văn Hướng Dẫn' },
        },
      ]);

      const res = await request(app)
        .post('/api/ai/topic-similarity')
        .set('Authorization', 'Bearer student1-token')
        .send({
          title: 'Hệ thống gợi ý học tập thích ứng ứng dụng trí tuệ nhân tạo',
          summary: 'Xây dựng công cụ gợi ý lộ trình và tài liệu học tập theo năng lực sinh viên.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.maxSimilarityPercentage).toBe('number');
      expect(res.body.data).toHaveProperty('riskLevel');
      expect(res.body.data).toHaveProperty('verdict');
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
      expect(res.body.data.recommendations.length).toBe(3);
    });
  });

  describe('d) POST /api/ai/topic-similarity: Nhận kết quả từ cache khi gọi lặp payload giống nhau trong 5 phút', () => {
    it('serves second identical call directly from in-memory cache without repeating database query', async () => {
      prisma.topic.findMany.mockResolvedValue([
        {
          id: 501,
          title: 'Hệ thống gợi ý khóa học thông minh cho sinh viên đại học',
          description: 'Nghiên cứu áp dụng máy học để gợi ý các môn học phù hợp.',
          mentor: { fullName: 'PGS. TS. Lê Văn Thầy' },
        },
      ]);

      const payload = {
        title: 'Hệ thống gợi ý học tập thích ứng ứng dụng trí tuệ nhân tạo',
        summary: 'Xây dựng công cụ gợi ý lộ trình và tài liệu học tập theo năng lực sinh viên.',
      };

      // 1st call: Cache miss, hits DB
      const res1 = await request(app)
        .post('/api/ai/topic-similarity')
        .set('Authorization', 'Bearer student1-token')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      const dbCallCountBefore = prisma.topic.findMany.mock.calls.length;
      expect(dbCallCountBefore).toBe(1);

      // 2nd call: Cache hit, skips DB
      const res2 = await request(app)
        .post('/api/ai/topic-similarity')
        .set('Authorization', 'Bearer student1-token')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.fromCache).toBe(true);
      expect(prisma.topic.findMany.mock.calls.length).toBe(dbCallCountBefore);
      expect(res2.body.data.maxSimilarityPercentage).toBe(res1.body.data.maxSimilarityPercentage);
    });
  });

  describe('e) POST /api/ai/cross-check-archive: Đối soát thành công tên đề tài pháp lý BM02-A với hồ sơ lưu chiểu', () => {
    it('validates matching legal BM02-A title against archival dossier files', async () => {
      const regId = 102;
      const legalOfficialTitle = 'Hệ thống gợi ý học tập thích ứng ứng dụng Deep Learning';

      const regWithAppendix = {
        id: regId,
        studentId: 10,
        topicId: 2,
        status: 'DEFENSE_PASSED',
        bm01ApprovedTitleSnapshot: 'Tên đề tài cũ BM01',
        student: student1User,
        topic: {
          id: 2,
          title: 'Tên đề tài cũ BM01',
          mentorId: 2,
          mentor: mentorUser,
        },
      };

      prisma.topicRegistration.findUnique.mockResolvedValue(regWithAppendix);

      // Mock legal title from BM02-A issued appendix
      prisma.titleAdjustmentAppendixItem.findFirst.mockResolvedValue({
        id: 1,
        registrationId: regId,
        newTitle: legalOfficialTitle,
        appendix: {
          id: 1,
          appendixNumber: 'PL-01/2026',
          signedDate: new Date('2026-05-01'),
          status: 'ISSUED',
        },
      });

      const matchingDossierFiles = [
        {
          fileName: 'BaoCaoKhoaLuan_Final.pdf',
          documentType: 'FINAL_REPORT_PDF',
          extractedTitle: legalOfficialTitle,
          extractedStudentName: 'Nguyễn Văn Sinh Viên',
          extractedStudentCode: 'SV2026001',
          extractedMentorName: 'TS. Nguyễn Văn Hướng Dẫn',
        },
      ];

      const res = await request(app)
        .post('/api/ai/cross-check-archive')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: regId,
          dossierFiles: matchingDossierFiles,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isReadyForArchiving).toBe(true);
      expect(res.body.data.discrepancies.length).toBe(0);

      const titleCheck = res.body.data.checklist.find((c) => c.field.includes('Tên đề tài'));
      expect(titleCheck).toBeDefined();
      expect(titleCheck.status).toBe('EXACT_MATCH');
    });
  });

  describe('f) POST /api/ai/cross-check-archive: Phát hiện mismatch nếu tên đề tài trên file không khớp với tên hiệu lực', () => {
    it('flags discrepancies and marks isReadyForArchiving as false when file title does not match legal title', async () => {
      const regId = 102;
      const legalOfficialTitle = 'Hệ thống gợi ý học tập thích ứng ứng dụng Deep Learning';

      const regWithAppendix = {
        id: regId,
        studentId: 10,
        topicId: 2,
        status: 'DEFENSE_PASSED',
        bm01ApprovedTitleSnapshot: 'Tên đề tài cũ BM01',
        student: student1User,
        topic: {
          id: 2,
          title: 'Tên đề tài cũ BM01',
          mentorId: 2,
          mentor: mentorUser,
        },
      };

      prisma.topicRegistration.findUnique.mockResolvedValue(regWithAppendix);

      prisma.titleAdjustmentAppendixItem.findFirst.mockResolvedValue({
        id: 1,
        registrationId: regId,
        newTitle: legalOfficialTitle,
        appendix: {
          id: 1,
          appendixNumber: 'PL-01/2026',
          signedDate: new Date('2026-05-01'),
          status: 'ISSUED',
        },
      });

      // File has completely divergent title
      const mismatchDossierFiles = [
        {
          fileName: 'BaoCaoKhoaLuan_Final.pdf',
          documentType: 'FINAL_REPORT_PDF',
          extractedTitle: 'Nghiên cứu ứng dụng Blockchain trong chuỗi cung ứng thực phẩm',
          extractedStudentName: 'Nguyễn Văn Sinh Viên',
          extractedStudentCode: 'SV2026001',
          extractedMentorName: 'TS. Nguyễn Văn Hướng Dẫn',
        },
      ];

      const res = await request(app)
        .post('/api/ai/cross-check-archive')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: regId,
          dossierFiles: mismatchDossierFiles,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isReadyForArchiving).toBe(false);
      expect(res.body.data.discrepancies.length).toBeGreaterThan(0);

      const titleCheck = res.body.data.checklist.find((c) => c.field.includes('Tên đề tài'));
      expect(titleCheck).toBeDefined();
      expect(titleCheck.status).toBe('MISMATCH');
    });
  });

  describe('g) Không có GEMINI_API_KEY: Toàn bộ 3 endpoint đều trả về 200 OK với provider "local_fallback", không bao giờ bị 500 error', () => {
    it('ensures zero-crash guarantee: all 3 endpoints return 200 OK with local_fallback provider when offline/unkeyed', async () => {
      delete process.env.GEMINI_API_KEY;

      prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);
      prisma.topic.findMany.mockResolvedValue([
        {
          id: 501,
          title: 'Đề tài mẫu',
          description: 'Mô tả mẫu',
          mentor: { fullName: 'GVHD Mẫu' },
        },
      ]);

      // 1. BM01 Copilot
      const res1 = await request(app)
        .post('/api/ai/bm01-copilot')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: 101,
          outlineContent: validOutline,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.provider).toBe('local_fallback');

      // 2. Topic Similarity
      const res2 = await request(app)
        .post('/api/ai/topic-similarity')
        .set('Authorization', 'Bearer student1-token')
        .send({
          title: 'Hệ thống gợi ý học tập',
          summary: 'Nghiên cứu gợi ý',
        });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(['local_fallback', 'local_embedding']).toContain(res2.body.data.provider);

      // 3. Cross-Check Archive
      const res3 = await request(app)
        .post('/api/ai/cross-check-archive')
        .set('Authorization', 'Bearer student1-token')
        .send({
          registrationId: 101,
          dossierFiles: [
            {
              fileName: 'BaoCao.pdf',
              extractedTitle: sampleRegistration.topic.title,
            },
          ],
        });

      expect(res3.status).toBe(200);
      expect(res3.body.success).toBe(true);
      expect(res3.body.data.provider).toBe('local_fallback');
    });
  });
});
