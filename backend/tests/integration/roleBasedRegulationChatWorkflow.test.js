/**
 * Integration Tests for Role-Based Regulation Chat Workflow (Task 3)
 * Tests POST /api/ai/regulation-chat with dynamic role-based knowledge isolation and Gemini 3.8 Flash.
 *
 * Verifies:
 * 1. Student role receives academic guidance with strict guardrails and role: 'STUDENT'.
 * 2. Lecturer role receives faculty-level grading guidance and role: 'LECTURER'.
 * 3. Admin role receives administrative guidance and role: 'ADMIN'.
 * 4. Cache isolation: verifies cache keys and cached responses are strictly role-separated.
 * 5. Security & auth: rejection of unauthenticated requests with 401 UNAUTHORIZED.
 * 6. Input validation: rejection of empty or missing messages with 400 BAD_REQUEST.
 * 7. Zero Crash Guarantee: fallback to local provider on Gemini API failure.
 *
 * UTF-8 (no BOM)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
  $transaction: jest.fn(),
  semester: { findFirst: jest.fn(), findMany: jest.fn() },
  userPermissionGroup: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  topic: { findUnique: jest.fn(), findMany: jest.fn() },
  topicRegistration: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
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
const geminiProvider = require('../../src/services/ai/geminiProvider');
const { clearAuthCache } = require('../../src/middlewares/auth');

describe('Role-Based Regulation Chat Workflow Integration Tests (Task 3)', () => {
  const studentUser = {
    id: 10,
    fullName: 'Nguyễn Văn Sinh Viên',
    code: 'SV2026001',
    email: 'student@university.edu.vn',
    role: 'STUDENT',
    isActive: true,
    permissionGroups: [],
  };

  const lecturerUser = {
    id: 2,
    fullName: 'TS. Nguyễn Văn Hướng Dẫn',
    email: 'lecturer@university.edu.vn',
    role: 'LECTURER',
    isActive: true,
    permissionGroups: [],
  };

  const adminUser = {
    id: 1,
    fullName: 'Ban Giáo Vụ Viện',
    email: 'admin@university.edu.vn',
    role: 'ADMIN',
    isActive: true,
    permissionGroups: ['GIAO_VU'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache();
    aiCache.clear();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
    process.env.JWT_SECRET = 'test-jwt-secret';

    jwt.verify.mockImplementation((token) => {
      if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
      if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
      if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
      throw new Error('invalid token');
    });

    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 10) return studentUser;
      if (where.id === 2) return lecturerUser;
      if (where.id === 1) return adminUser;
      return null;
    });

    if (prisma.academicDelegation?.findMany) {
      prisma.academicDelegation.findMany.mockResolvedValue([]);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Authentication & Security Guard (401 Unauthorized)', () => {
    it('rejects POST /api/ai/regulation-chat when no token is provided', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .send({ message: 'Quy chế đồ án tốt nghiệp là gì?' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects POST /api/ai/regulation-chat with invalid bearer token', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer invalid-token')
        .send({ message: 'Quy chế đồ án tốt nghiệp là gì?' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Input Validation (400 Bad Request)', () => {
    it('returns 400 BAD_REQUEST if message field is missing', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send({ history: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 BAD_REQUEST if message is empty whitespace', async () => {
      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send({ message: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BAD_REQUEST');
    });
  });

  describe('3. Student Role: Strict Knowledge Guardrails & Gemini 3.8 Flash', () => {
    it('routes student query to Gemini with student-tier system instruction and returns STUDENT role', async () => {
      const chatSpy = jest.spyOn(geminiProvider, 'chatWithGemini').mockResolvedValue({
        reply: 'Đề cương BM01 chỉ được nộp lại v2 duy nhất 01 lần.',
        relatedRegulations: ['BM01: Đề cương chi tiết đồ án', 'Quy tắc nộp lại v2 duy nhất'],
        suggestedQuickQuestions: ['Hạn nộp BM01 khi nào?', 'Điều kiện để được ra bảo vệ đồ án?'],
        provider: 'gemini-3.8-flash',
      });

      const payload = {
        message: 'Em có được nộp lại đề cương BM01 nhiều lần không?',
        history: [{ sender: 'user', text: 'Xin chào' }, { sender: 'bot', text: 'Chào bạn!' }],
      };

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STUDENT');
      expect(res.body.data.provider).toBe('gemini-3.8-flash');
      expect(res.body.data.reply).toContain('BM01');
      expect(Array.isArray(res.body.data.relatedRegulations)).toBe(true);
      expect(Array.isArray(res.body.data.suggestedQuickQuestions)).toBe(true);

      // Verify Gemini invocation parameters
      expect(chatSpy).toHaveBeenCalledTimes(1);
      const callArgs = chatSpy.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('Bạn đang hỗ trợ SINH VIÊN');
      expect(callArgs.systemInstruction).toContain('NGUYÊN TẮC BẢO MẬT TUYỆT ĐỐI');
      expect(callArgs.systemInstruction).toContain('STRICT GUARDRAILS');
      expect(callArgs.systemInstruction).not.toContain('Thang điểm 4 nhóm chuẩn đầu ra BM04');

      // Verify messages conversion
      expect(callArgs.messages).toEqual([
        { role: 'user', text: 'Xin chào' },
        { role: 'model', text: 'Chào bạn!' },
        { role: 'user', text: expect.stringContaining('Em có được nộp lại đề cương BM01 nhiều lần không?') },
      ]);
      expect(callArgs.messages[2].text).toContain('<user_query>');
    });
  });

  describe('4. Lecturer Role: Faculty Knowledge & Grading Guidance', () => {
    it('routes lecturer query to Gemini with lecturer-tier system instruction and returns LECTURER role', async () => {
      const chatSpy = jest.spyOn(geminiProvider, 'chatWithGemini').mockResolvedValue({
        reply: 'Quy trình BM04 yêu cầu đánh giá 4 nhóm chuẩn đầu ra và 2 kết luận độc lập.',
        relatedRegulations: ['BM04: Phiếu nhận xét đồ án', 'Quy chế chấm điểm bảo vệ 3 thành viên độc lập'],
        suggestedQuickQuestions: ['Tiêu chí chấm 4 nhóm chuẩn đầu ra BM04?', 'Quy trình thẩm định đề xuất dừng đề tài BM03?'],
        provider: 'gemini-3.8-flash',
      });

      const payload = {
        message: 'Hướng dẫn quy chuẩn chấm điểm BM04 cho sinh viên?',
      };

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer lecturer-token')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('LECTURER');
      expect(res.body.data.provider).toBe('gemini-3.8-flash');
      expect(res.body.data.reply).toContain('BM04');

      expect(chatSpy).toHaveBeenCalledTimes(1);
      const callArgs = chatSpy.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('Bạn đang hỗ trợ GIẢNG VIÊN HƯỚNG DẪN / THÀNH VIÊN HỘI ĐỒNG BẢO VỆ');
      expect(callArgs.systemInstruction).toContain('bảng điểm chi tiết 4 tiêu chí chuẩn đầu ra BM04');
    });
  });

  describe('5. Admin Role: Governance & Automation Knowledge', () => {
    it('routes admin query with administrative governance instructions and returns ADMIN role', async () => {
      const chatSpy = jest.spyOn(geminiProvider, 'chatWithGemini').mockResolvedValue({
        reply: 'Viện có 5 Sweep Jobs tự động hóa và thời hạn SLA 168 giờ.',
        relatedRegulations: ['Cơ chế 5 Sweep Jobs tự động hóa', 'Quy chế giải quyết khiếu nại học vụ'],
        suggestedQuickQuestions: ['Cơ chế hoạt động của 5 Sweep Jobs tự động hóa?'],
        provider: 'gemini-3.8-flash',
      });

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer admin-token')
        .send({ message: 'Quy chế sweep jobs của hệ thống?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ADMIN');
      expect(res.body.data.provider).toBe('gemini-3.8-flash');

      const callArgs = chatSpy.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('Bạn đang hỗ trợ QUẢN TRỊ VIÊN / GIÁO VỤ VIỆN');
      expect(callArgs.systemInstruction).toContain('bm02ToBm04SweepService');
    });
  });

  describe('6. Role-Isolated Cache (Anti-Leak Guarantee)', () => {
    it('ensures identical questions asked by Student and Lecturer yield distinct cache keys and independent replies', async () => {
      let callCount = 0;
      jest.spyOn(geminiProvider, 'chatWithGemini').mockImplementation(async ({ systemInstruction }) => {
        callCount++;
        if (systemInstruction.includes('Bạn đang hỗ trợ SINH VIÊN')) {
          return {
            reply: 'Kính chào sinh viên: Bạn cần nộp BM01 đúng hạn.',
            relatedRegulations: ['BM01 dành cho sinh viên'],
            suggestedQuickQuestions: ['Hạn nộp BM01?'],
            provider: 'gemini-3.8-flash',
          };
        }
        return {
          reply: 'Kính chào thầy cô: Thầy cô thẩm định BM01 trên thang điểm tiêu chí.',
          relatedRegulations: ['Quy chế thẩm định dành cho giảng viên'],
          suggestedQuickQuestions: ['Tiêu chí chấm BM01?'],
          provider: 'gemini-3.8-flash',
        };
      });

      const identicalQuestion = { message: 'Quy định về thẩm định đề cương BM01?' };

      // Call 1: Student
      const resStudent1 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(identicalQuestion);

      expect(resStudent1.status).toBe(200);
      expect(resStudent1.body.data.reply).toContain('Kính chào sinh viên');
      expect(resStudent1.body.data.role).toBe('STUDENT');
      expect(resStudent1.body.fromCache).toBeUndefined();

      // Call 2: Lecturer with SAME question string
      const resLecturer1 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer lecturer-token')
        .send(identicalQuestion);

      expect(resLecturer1.status).toBe(200);
      // MUST NOT receive student's cached reply!
      expect(resLecturer1.body.data.reply).toContain('Kính chào thầy cô');
      expect(resLecturer1.body.data.role).toBe('LECTURER');
      expect(resLecturer1.body.fromCache).toBeUndefined();

      // Call 3: Student calls again -> gets STUDENT cache
      const resStudent2 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send(identicalQuestion);

      expect(resStudent2.status).toBe(200);
      expect(resStudent2.body.fromCache).toBe(true);
      expect(resStudent2.body.data.reply).toBe(resStudent1.body.data.reply);

      // Call 4: Lecturer calls again -> gets LECTURER cache
      const resLecturer2 = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer lecturer-token')
        .send(identicalQuestion);

      expect(resLecturer2.status).toBe(200);
      expect(resLecturer2.body.fromCache).toBe(true);
      expect(resLecturer2.body.data.reply).toBe(resLecturer1.body.data.reply);

      // Verify cache keys are genuinely distinct in aiCache
      const studentKey = aiCache.generateKey('regulation_chat', {
        message: identicalQuestion.message,
        history: [],
        role: 'STUDENT',
        isSuperOrAcademic: false,
      });

      const lecturerKey = aiCache.generateKey('regulation_chat', {
        message: identicalQuestion.message,
        history: [],
        role: 'LECTURER',
        isSuperOrAcademic: false,
      });

      expect(studentKey).not.toBe(lecturerKey);
    });
  });

  describe('7. Zero Crash Guarantee (Fallback Resilience)', () => {
    it('gracefully falls back to local heuristic provider if Gemini chat throws an error', async () => {
      jest.spyOn(geminiProvider, 'chatWithGemini').mockRejectedValue(
        new Error('503 Service Unavailable / Quota exceeded')
      );

      const res = await request(app)
        .post('/api/ai/regulation-chat')
        .set('Authorization', 'Bearer student-token')
        .send({ message: 'Thời hạn nộp lại đề cương v2 là bao lâu?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toBeTruthy();
      expect(res.body.data.role).toBe('STUDENT');
      expect(res.body.data.provider).toBe('local_fallback');
    });
  });
});
