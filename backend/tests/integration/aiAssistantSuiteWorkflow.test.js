/**
 * Integration Tests for Academic AI Assistant Suite Workflow (Task 2)
 * Tests POST /api/ai/generate-feedback
 * Tests POST /api/ai/generate-defense-questions
 * Tests POST /api/ai/regulation-chat
 * Verifies authentication guards, input validations, zero-crash fallback, and SHA-256 in-memory caching.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
  $transaction: jest.fn(),
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  topic: { findUnique: jest.fn(), findMany: jest.fn() },
  topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
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

describe('Academic AI Assistant Suite Workflow Integration Tests (Task 2)', () => {
  const lecturerUser = {
    id: 2,
    fullName: 'TS. Nguyễn Văn Hướng Dẫn',
    email: 'lecturer@university.edu.vn',
    role: 'LECTURER',
    isActive: true,
    permissionGroups: [],
  };

  const studentUser = {
    id: 10,
    fullName: 'Nguyễn Văn Sinh Viên',
    code: 'SV2026001',
    email: 'student@university.edu.vn',
    role: 'STUDENT',
    isActive: true,
    permissionGroups: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache();
    aiCache.clear();
    delete process.env.GEMINI_API_KEY;
    process.env.JWT_SECRET = 'test-secret';

    jwt.verify.mockImplementation((token) => {
      if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
      if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
      throw new Error('invalid token');
    });

    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 2) return lecturerUser;
      if (where.id === 10) return studentUser;
      return null;
    });

    if (prisma.academicDelegation?.findMany) {
      prisma.academicDelegation.findMany.mockResolvedValue([]);
    }
  });

  describe('1. Authentication & Security Guard (401 Unauthorized)', () => {
    it('rejects POST /api/ai/generate-feedback when no token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/generate-feedback')
        .send({
          contextType: 'BM01',
          topicTitle: 'Hệ thống AI',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects POST /api/ai/generate-defense-questions when no token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/generate-defense-questions')
        .send({
          topicTitle: 'Hệ thống AI',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects POST /api/ai/regulation-chat when no token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .send({
          message: 'Quy chế bảo vệ',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Input Validation (400 Bad Request)', () => {
    it('returns 400 BAD_REQUEST if topicTitle is missing in generate-defense-questions', async () => {
      const res = await request(app)
        .post('/api/ai/generate-defense-questions')
        .set('Authorization', 'Bearer lecturer-token')
        .send({
          description: 'Mô tả thiếu title',
          technologies: 'Node.js, React',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('topicTitle');
    });

    it('returns 400 BAD_REQUEST if topicTitle is empty whitespace in generate-defense-questions', async () => {
      const res = await request(app)
        .post('/api/ai/generate-defense-questions')
        .set('Authorization', 'Bearer lecturer-token')
        .send({
          topicTitle: '   ',
          description: 'Mô tả',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 BAD_REQUEST if message is missing in regulation-chat', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(res.body.message).toContain('message');
    });

    it('returns 400 BAD_REQUEST if message is empty whitespace in regulation-chat', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send({
          message: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });
  });

  describe('3. POST /api/ai/generate-feedback', () => {
    it('generates academic feedback with strengths and improvements based on scores and notes', async () => {
      const payload = {
        contextType: 'BM04',
        topicTitle: 'Xây dựng hệ thống phát hiện gian lận giao dịch sử dụng Graph Neural Networks',
        studentName: 'Nguyễn Văn Sinh Viên',
        scores: {
          formatScore: 8.5,
          contentScore: 8.0,
          applicabilityScore: 8.5,
          attitudeScore: 9.0,
        },
        notes: 'Sinh viên nắm vững kiến thức, cần trau chuốt thêm phần thực nghiệm',
      };

      const res = await request(app)
        .post('/api/ai/generate-feedback')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const data = res.body.data;
      expect(typeof data.feedback).toBe('string');
      expect(data.feedback.length).toBeGreaterThan(10);
      expect(Array.isArray(data.strengths)).toBe(true);
      expect(data.strengths.length).toBeGreaterThan(0);
      expect(Array.isArray(data.improvements)).toBe(true);
      expect(data.provider).toBeDefined();
    });

    it('generates constructive academic feedback safely when scores are omitted or empty', async () => {
      const payload = {
        contextType: 'BM01',
        topicTitle: 'Ứng dụng IoT trong giám sát nông nghiệp thông minh',
        studentName: 'Trần Văn B',
        scores: {},
      };

      const res = await request(app)
        .post('/api/ai/generate-feedback')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.feedback).toBe('string');
      expect(res.body.data.feedback.length).toBeGreaterThan(10);
      expect(Array.isArray(res.body.data.strengths)).toBe(true);
      expect(Array.isArray(res.body.data.improvements)).toBe(true);
    });

    it('supports DEFENSE context feedback generation for council examiners', async () => {
      const payload = {
        contextType: 'DEFENSE',
        topicTitle: 'Nghiên cứu ứng dụng Transformer trong tóm tắt văn bản y khoa',
        studentName: 'Lê Thị C',
        scores: {
          presentationScore: 9.0,
          qaScore: 8.5,
        },
        notes: 'Thuyết trình rất tự tin, trả lời phản biện xuất sắc',
      };

      const res = await request(app)
        .post('/api/ai/generate-feedback')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.feedback).toContain('Lê Thị C');
      expect(res.body.data.feedback).toContain('Hội đồng');
    });
  });

  describe('4. POST /api/ai/generate-defense-questions', () => {
    it('generates 3-tiered defense questions for council examiners', async () => {
      const payload = {
        topicTitle: 'Nghiên cứu ứng dụng Deep Learning trong phân loại ảnh X-quang phổi',
        description: 'Mục tiêu xây dựng mô hình CNN phân loại ảnh X-quang phổi hỗ trợ bác sĩ chẩn đoán.',
        technologies: 'Python, PyTorch, ResNet-50, FastAPI',
        major: 'Khoa học Dữ liệu & AI',
      };

      const res = await request(app)
        .post('/api/ai/generate-defense-questions')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.questions)).toBe(true);
      expect(res.body.data.questions.length).toBe(3);

      const levels = res.body.data.questions.map((q) => q.level);
      expect(levels).toContain('FOUNDATION');
      expect(levels).toContain('TECHNICAL_CHALLENGE');
      expect(levels).toContain('FUTURE_EXPANSION');

      res.body.data.questions.forEach((q) => {
        expect(q).toHaveProperty('level');
        expect(q).toHaveProperty('levelLabel');
        expect(q).toHaveProperty('question');
        expect(q).toHaveProperty('purpose');
        expect(typeof q.question).toBe('string');
        expect(q.question.length).toBeGreaterThan(15);
        expect(typeof q.purpose).toBe('string');
        expect(q.purpose.length).toBeGreaterThan(10);
      });

      expect(res.body.data.provider).toBeDefined();
    });
  });

  describe('5. POST /api/ai/regulation-chat', () => {
    it('answers BM01 and v2 resubmission questions accurately', async () => {
      const payload = {
        message: 'Nếu đề cương BM01 của em bị hội đồng đánh giá chưa đạt thì có được nộp lại v2 không?',
        history: [],
      };

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.reply).toBe('string');
      expect(res.body.data.reply).toContain('v2');
      expect(Array.isArray(res.body.data.relatedRegulations)).toBe(true);
      expect(res.body.data.relatedRegulations.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.suggestedQuickQuestions)).toBe(true);
      expect(res.body.data.suggestedQuickQuestions.length).toBeGreaterThan(0);
      expect(res.body.data.provider).toBeDefined();
    });

    it('answers 14-day archival dossier questions accurately', async () => {
      const payload = {
        message: 'Sau khi bảo vệ xong em có bao nhiêu ngày để nộp hồ sơ lưu chiểu lên thư viện?',
        history: [],
      };

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toContain('14 ngày');
      expect(res.body.data.reply).toContain('lưu chiểu');
    });

    it('returns general 6-phase regulation overview for generic greeting', async () => {
      const payload = {
        message: 'Xin chào bot trợ lý, giới thiệu quy trình làm đồ án',
      };

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toContain('6 giai đoạn');
    });
  });

  describe('6. In-Memory Cache (aiCache TTL 5 min)', () => {
    it('returns cached response with fromCache: true for duplicate generate-feedback requests', async () => {
      const payload = {
        contextType: 'BM03',
        topicTitle: 'Hệ thống quản lý chuỗi cung ứng Blockchain',
        studentName: 'Trần Văn C',
        scores: { progressScore: 8.0 },
      };

      // 1st call: fresh
      const res1 = await request(app)
        .post('/api/ai/generate-feedback')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.fromCache).toBeUndefined();

      // 2nd call: cached
      const res2 = await request(app)
        .post('/api/ai/generate-feedback')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.fromCache).toBe(true);
      expect(res2.body.data.feedback).toBe(res1.body.data.feedback);
    });

    it('returns cached response with fromCache: true for duplicate generate-defense-questions requests', async () => {
      const payload = {
        topicTitle: 'Hệ thống phân tích hành vi người tiêu dùng E-commerce',
        description: 'Phân tích dữ liệu clickstream',
        technologies: 'Python, Pandas, Scikit-learn',
        major: 'Hệ thống Thông tin',
      };

      // 1st call
      const res1 = await request(app)
        .post('/api/ai/generate-defense-questions')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.fromCache).toBeUndefined();

      // 2nd call
      const res2 = await request(app)
        .post('/api/ai/generate-defense-questions')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.fromCache).toBe(true);
      expect(res2.body.data.questions).toEqual(res1.body.data.questions);
    });

    it('returns cached response with fromCache: true for duplicate regulation-chat requests', async () => {
      const payload = {
        message: 'Thời hạn nộp lại đề cương v2 là bao lâu?',
        history: [],
      };

      // 1st call
      const res1 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.fromCache).toBeUndefined();

      // 2nd call
      const res2 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.fromCache).toBe(true);
      expect(res2.body.data.reply).toBe(res1.body.data.reply);
    });
  });
});
