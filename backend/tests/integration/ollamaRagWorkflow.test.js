/**
 * Integration Tests: Local Ollama RAG Chatbot Workflow & Dual-Engine Fallback (Task 4)
 *
 * Verifies end-to-end integration between:
 * - Express router & controller: POST /api/ai/regulation-chat
 * - aiProviderService Dual-Engine Router (Ollama / Gemini / Local Fallback)
 * - ragService knowledge chunk retrieval and RBAC role isolation
 * - liveContextService live database grounding
 * - ollamaProvider chat interaction with local Qwen3:4b
 *
 * Test cases:
 * 1. AI_PROVIDER=ollama & Ollama online: Retrieves RAG chunks, combines with live context, wraps <user_query>, calls Ollama and returns provider 'ollama'.
 * 2. Zero Crash Guarantee when Ollama offline / error:
 *    - Fallback to Gemini when Gemini API key is configured.
 *    - Fallback to local heuristic provider (localFallbackProvider) when unkeyed or Gemini fails.
 * 3. Strict RBAC isolation in RAG flow: Student queries strictly scoped to STUDENT knowledge chunks.
 * 4. Grounding harmony: System instruction seamlessly combines dynamic database context and retrieved RAG context.
 *
 * UTF-8 (no BOM)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
  $transaction: jest.fn(),
  semester: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  userPermissionGroup: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  topic: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  topicRegistration: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  academicDelegation: {
    findMany: jest.fn(),
  },
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

// Mock ollamaProvider and geminiProvider for controlled testing
jest.mock('../../src/services/ai/ollamaProvider', () => {
  const actual = jest.requireActual('../../src/services/ai/ollamaProvider');
  return {
    ...actual,
    isOllamaAvailable: jest.fn(),
    chatWithOllama: jest.fn(),
    generateEmbedding: jest.fn(),
  };
});

jest.mock('../../src/services/ai/geminiProvider', () => {
  const actual = jest.requireActual('../../src/services/ai/geminiProvider');
  return {
    ...actual,
    chatWithGemini: jest.fn(),
  };
});

// Spy on ragService
const ragService = require('../../src/services/ai/ragService');
const ollamaProvider = require('../../src/services/ai/ollamaProvider');
const geminiProvider = require('../../src/services/ai/geminiProvider');
const prisma = require('../../src/config/database');
const app = require('../../src/app');
const aiCache = require('../../src/services/ai/aiCache');
const { clearAuthCache } = require('../../src/middlewares/auth');
const { clearInstitutionalCache } = require('../../src/services/ai/liveContextService');

describe('Local Ollama RAG Chatbot Workflow & Dual-Engine Fallback Tests (Task 4)', () => {
  const studentUser = {
    id: 101,
    fullName: 'Nguyễn Văn Sinh Viên A',
    code: 'SV2026101',
    email: 'studentA@university.edu.vn',
    role: 'STUDENT',
    isActive: true,
    permissionGroups: [],
  };

  const lecturerUser = {
    id: 201,
    fullName: 'Lê Giảng Viên Hướng Dẫn',
    email: 'lecturer@university.edu.vn',
    role: 'LECTURER',
    isActive: true,
    permissionGroups: [],
  };

  const activeSemester = {
    id: 10,
    code: 'HK1_2026_2027',
    name: 'Học kỳ 1 (2026 - 2027)',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2027-01-15'),
    outlineSubmissionDeadline: new Date('2026-09-25'),
    defenseDate: new Date('2027-01-10'),
    status: 'ACTIVE',
  };

  const deanUser = {
    id: 99,
    fullName: 'Trần Viện Trưởng',
    academicTitle: 'PHO_GIAO_SU',
    email: 'dean@university.edu.vn',
    department: 'Ban Lãnh đạo Viện',
  };

  const studentRegistration = {
    id: 501,
    studentId: 101,
    semesterId: 10,
    status: 'BM01_PASSED',
    outlineReviewStatus: 'APPROVED',
    assignmentStatus: 'ACTIVE',
    adjustedTitle: 'Xây dựng Chatbot Tư vấn Học vụ Thông minh với Ollama RAG',
    topic: {
      id: 11,
      title: 'Hệ thống Chatbot Học vụ',
      mentor: {
        id: 201,
        fullName: 'Lê Giảng Viên Hướng Dẫn',
        academicTitle: 'TIEN_SI',
        email: 'legv@university.edu.vn',
        department: 'Hệ thống Thông tin',
      },
    },
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache();
    clearInstitutionalCache();
    aiCache.clear();

    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_CHAT_MODEL = 'qwen3:4b';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';

    jwt.verify.mockImplementation((token) => {
      if (token === 'student-token') return { userId: 101, role: 'STUDENT' };
      if (token === 'lecturer-token') return { userId: 201, role: 'LECTURER' };
      throw new Error('invalid token');
    });

    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 101) return studentUser;
      if (where.id === 201) return lecturerUser;
      return null;
    });

    prisma.semester.findFirst.mockResolvedValue(activeSemester);
    prisma.userPermissionGroup.findFirst.mockResolvedValue({ user: deanUser });
    prisma.user.findFirst.mockResolvedValue(deanUser);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.topicRegistration.findFirst.mockResolvedValue(studentRegistration);

    // Mock embedding generation returning valid 768-dim vector to activate RAG retrieval
    const sampleVector = require('../../src/services/ai/knowledge/knowledgeVectorIndex.json')[0].embedding;
    ollamaProvider.generateEmbedding.mockResolvedValue(sampleVector);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('Test 1: When AI_PROVIDER=ollama and Ollama online, retrieves RAG context and replies with provider ollama', async () => {
    // 1. Mock Ollama online & response
    ollamaProvider.isOllamaAvailable.mockResolvedValue(true);
    ollamaProvider.chatWithOllama.mockResolvedValue({
      reply: 'Mỗi đề tài tốt nghiệp chỉ do đúng 01 sinh viên thực hiện độc lập theo quy chế Viện.',
      provider: 'ollama',
      model: 'qwen3:4b',
    });

    const retrieveSpy = jest.spyOn(ragService, 'retrieveRelevantChunks');

    // 2. Call POST /api/ai/regulation-chat
    const response = await request(app)
      .post('/api/ai/regulation-chat')
      .set('Authorization', 'Bearer student-token')
      .send({
        message: 'Quy định số lượng sinh viên làm một đề tài là bao nhiêu?',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.provider).toBe('ollama');
    expect(response.body.data.role).toBe('STUDENT');
    expect(response.body.data.reply).toContain('01 sinh viên thực hiện độc lập');

    // 3. Verify ragService.retrieveRelevantChunks called with safe role
    expect(retrieveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Quy định số lượng sinh viên làm một đề tài là bao nhiêu?',
        userRole: 'STUDENT',
        topK: 3,
      })
    );

    // 4. Verify ollamaProvider.chatWithOllama called with XML wrapped user message & systemInstruction
    expect(ollamaProvider.chatWithOllama).toHaveBeenCalled();
    const chatCallArgs = ollamaProvider.chatWithOllama.mock.calls[0][0];

    const lastMsg = chatCallArgs.messages[chatCallArgs.messages.length - 1];
    expect(lastMsg.text || lastMsg.content).toContain('<user_query>');
    expect(lastMsg.text || lastMsg.content).toContain('Quy định số lượng sinh viên làm một đề tài là bao nhiêu?');

    // 5. Verify systemInstruction contains RAG & live context
    expect(chatCallArgs.systemInstruction).toContain('THÔNG TIN THỰC TẾ HỌC KỲ & CÁ NHÂN HÓA');
    expect(chatCallArgs.model).toBe('qwen3:4b');

    retrieveSpy.mockRestore();
  });

  test('Test 2: Zero Crash Guarantee when Ollama is offline: falls back safely to Gemini or Local Heuristic', async () => {
    // 1. Case A: Ollama throws error, but Gemini is configured -> Fallback to Gemini
    ollamaProvider.isOllamaAvailable.mockResolvedValue(false);
    ollamaProvider.chatWithOllama.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

    geminiProvider.chatWithGemini.mockResolvedValue({
      reply: 'Gemini fallback: Sinh viên phải hoàn thành BM01 trước khi nộp BM02.',
      provider: 'gemini-3.8-flash',
    });

    const resA = await request(app)
      .post('/api/ai/regulation-chat')
      .set('Authorization', 'Bearer student-token')
      .send({
        message: 'Hạn nộp BM01 khi nào?',
      });

    expect(resA.status).toBe(200);
    expect(resA.body.success).toBe(true);
    expect(geminiProvider.chatWithGemini).toHaveBeenCalled();
    expect(resA.body.data.reply).toContain('Gemini fallback');

    // 2. Case B: Ollama throws error AND Gemini is unconfigured (or fails) -> Fallback to localFallbackProvider
    delete process.env.GEMINI_API_KEY;
    geminiProvider.chatWithGemini.mockRejectedValue(new Error('API key missing'));
    aiCache.clear();

    const resB = await request(app)
      .post('/api/ai/regulation-chat')
      .set('Authorization', 'Bearer student-token')
      .send({
        message: 'Hạn nộp BM01 khi nào?',
      });

    expect(resB.status).toBe(200);
    expect(resB.body.success).toBe(true);
    // localFallbackProvider returns a valid answer without crashing
    expect(resB.body.data.provider).toBe('local_fallback');
    expect(resB.body.data.role).toBe('STUDENT');
    expect(typeof resB.body.data.reply).toBe('string');
    expect(resB.body.data.reply.length).toBeGreaterThan(0);
  });

  test('Test 3: RBAC Isolation in RAG flow: Student queries never access Lecturer or Admin chunks', async () => {
    ollamaProvider.isOllamaAvailable.mockResolvedValue(true);
    ollamaProvider.chatWithOllama.mockResolvedValue({
      reply: 'Sinh viên chỉ được tiếp cận quy định cấp sinh viên.',
      provider: 'ollama',
      model: 'qwen3:4b',
    });

    let capturedSystemInstruction = '';
    ollamaProvider.chatWithOllama.mockImplementation(async (options) => {
      capturedSystemInstruction = options.systemInstruction || '';
      return {
        reply: 'Phản hồi an toàn cho sinh viên.',
        provider: 'ollama',
        model: 'qwen3:4b',
      };
    });

    const res = await request(app)
      .post('/api/ai/regulation-chat')
      .set('Authorization', 'Bearer student-token')
      .send({
        message: 'Quy trình thẩm định dừng đề tài BM03 và gia hạn 72 giờ SLA của Viện trưởng?',
      });

    expect(res.status).toBe(200);
    expect(ollamaProvider.chatWithOllama).toHaveBeenCalled();

    // Verify system instruction does NOT contain Admin-exclusive sweep jobs or full secret admin knowledge
    expect(capturedSystemInstruction).toContain('Bạn đang hỗ trợ SINH VIÊN');
    expect(capturedSystemInstruction).not.toContain('Bạn đang hỗ trợ QUẢN TRỊ VIÊN');
    expect(capturedSystemInstruction).not.toContain('5 sweep jobs tự động hóa (bm02ToBm04SweepService)');
  });

  test('Test 4: Seamless Grounding Harmony: combines dynamic live context and retrieved RAG context', async () => {
    ollamaProvider.isOllamaAvailable.mockResolvedValue(true);

    let capturedInstruction = '';
    ollamaProvider.chatWithOllama.mockImplementation(async (options) => {
      capturedInstruction = options.systemInstruction || '';
      return {
        reply: 'Đã nhận diện đề tài và điều khoản quy chế tương ứng.',
        provider: 'ollama',
        model: 'qwen3:4b',
      };
    });

    const res = await request(app)
      .post('/api/ai/regulation-chat')
      .set('Authorization', 'Bearer student-token')
      .send({
        message: 'Đề tài của em hiện tại trạng thái thế nào và quy chế bảo vệ ra sao?',
      });

    expect(res.status).toBe(200);
    expect(capturedInstruction).toContain('THÔNG TIN THỰC TẾ HỌC KỲ & CÁ NHÂN HÓA');
    expect(capturedInstruction).toContain('Xây dựng Chatbot Tư vấn Học vụ Thông minh với Ollama RAG');
    expect(capturedInstruction).toContain('Lê Giảng Viên Hướng Dẫn');
    expect(capturedInstruction).toContain('CÁC ĐIỀU KHOẢN QUY CHẾ ĐƯỢC TRÍCH XUẤT (RAG CONTEXT)');
  });
});
