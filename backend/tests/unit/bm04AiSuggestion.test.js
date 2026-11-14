/**
 * Unit & Controller Tests for BM04 AI Suggestion from BM03 Milestones
 * Validates heuristic fallback, prompt generation, authorization, and controller flow.
 */

describe('BM04 AI Suggestion from BM03 Milestones', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. localFallbackProvider.generateBM04SuggestionFromBM03', () => {
    let localFallbackProvider;

    beforeEach(() => {
      localFallbackProvider = require('../../src/services/ai/localFallbackProvider');
    });

    it('should generate all 4 evaluation criteria and recommendations based on BM03 meetings and checkpoints', () => {
      const payload = {
        topicTitle: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
        studentName: 'Trần Văn A',
        studentCode: '22001122',
        mentorName: 'TS. Nguyễn Văn Thắng',
        meetings: [
          {
            meetingDate: '2026-03-01',
            discussionContent: 'Khảo sát hiện trạng và thiết kế CSDL',
            studentCompletedWork: 'Hoàn thành ERD và sơ đồ use case',
            progressRating: 'EXCELLENT',
          },
          {
            meetingDate: '2026-04-10',
            discussionContent: 'Hiện thực hóa các API backend',
            studentCompletedWork: 'Viết xong các endpoint CRUD và phân quyền JWT',
            progressRating: 'GOOD',
          },
        ],
        checkpoints: [
          { checkpointNo: 1, conclusion: 'PASS', comments: 'Tiến độ giữa kỳ đạt tốt' },
          { checkpointNo: 2, conclusion: 'PASS', comments: 'Sản phẩm hoàn thiện, đủ điều kiện bảo vệ' },
        ],
      };

      const result = localFallbackProvider.generateBM04SuggestionFromBM03(payload);

      expect(result).toBeDefined();
      expect(result.thesisFormatScore).toContain('Báo cáo khóa luận');
      expect(result.researchContentScore).toContain('Hệ thống Quản lý Khóa luận Tốt nghiệp');
      expect(result.applicabilityScore).toBeDefined();
      expect(result.attitudeScore).toContain('Trần Văn A');
      expect(result.attitudeScore).toContain('2 buổi');
      expect(result.programOutcome).toBe('MEETS_PROGRAM_OUTCOMES');
      expect(result.defenseRecommendation).toBe('APPROVE_FOR_DEFENSE');
      expect(result.evidenceSummary).toEqual(
        expect.objectContaining({
          totalMeetings: 2,
          checkpoint1Status: 'PASS',
          checkpoint2Status: 'PASS',
        })
      );
    });

    it('should recommend DOES_NOT_MEET_PROGRAM_OUTCOMES if a checkpoint failed', () => {
      const payload = {
        topicTitle: 'Xây dựng Website bán hàng',
        studentName: 'Lê Văn B',
        checkpoints: [
          { checkpointNo: 1, conclusion: 'FAIL', comments: 'Chưa hoàn thành khối lượng' },
          { checkpointNo: 2, conclusion: 'PASS', comments: 'Đã bổ sung nhưng còn thiếu' },
        ],
      };

      const result = localFallbackProvider.generateBM04SuggestionFromBM03(payload);
      expect(result.programOutcome).toBe('DOES_NOT_MEET_PROGRAM_OUTCOMES');
      expect(result.defenseRecommendation).toBe('NOT_APPROVE_FOR_DEFENSE');
    });
  });

  describe('2. geminiProvider.formatBM04SuggestionPrompt', () => {
    let geminiProvider;

    beforeEach(() => {
      geminiProvider = require('../../src/services/ai/geminiProvider');
    });

    it('should format BM04 prompt with all required academic dimensions', () => {
      const payload = {
        topicTitle: 'Nghiên cứu ứng dụng AI trong Y tế',
        studentName: 'Nguyễn Thị C',
        studentCode: '22003344',
        mentorName: 'TS. Lê Hoàng Nam',
        meetings: [
          {
            meetingDate: '2026-03-15',
            discussionContent: 'Xử lý tập dữ liệu ảnh X-quang',
            studentCompletedWork: 'Tiền xử lý 10,000 ảnh y tế',
            progressRating: 'EXCELLENT',
          },
        ],
        checkpoints: [
          { checkpointNo: 1, conclusion: 'PASS', comments: 'Mô hình đạt độ chính xác 92%' },
        ],
      };

      const prompt = geminiProvider.formatBM04SuggestionPrompt(payload);
      expect(prompt).toContain('Nghiên cứu ứng dụng AI trong Y tế');
      expect(prompt).toContain('Nguyễn Thị C');
      expect(prompt).toContain('22003344');
      expect(prompt).toContain('Tiền xử lý 10,000 ảnh y tế');
      expect(prompt).toContain('thesisFormatScore');
      expect(prompt).toContain('researchContentScore');
      expect(prompt).toContain('applicabilityScore');
      expect(prompt).toContain('attitudeScore');
    });
  });

  describe('3. aiController.bm04Suggestion (Authorization & Controller Flow)', () => {
    let aiController;
    let prisma;
    let topicTitleResolverService;
    let aiProviderService;

    beforeEach(() => {
      aiController = require('../../src/controllers/aiController');
      prisma = require('../../src/config/database');
      topicTitleResolverService = require('../../src/services/topicTitleResolverService');
      aiProviderService = require('../../src/services/ai/aiProviderService');

      jest.spyOn(aiProviderService, 'isGeminiConfigured').mockReturnValue(false);
      jest.spyOn(topicTitleResolverService, 'resolveEffectiveTopicTitle').mockResolvedValue({
        title: 'Đề tài mẫu hiệu lực',
      });
    });

    it('should reject with 400 if registrationId is missing', async () => {
      const req = { body: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await aiController.bm04Suggestion(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'BAD_REQUEST' })
      );
    });

    it('should reject with 403 if user is an unauthorized student', async () => {
      const req = {
        body: { registrationId: 999 },
        user: { id: 50, role: 'STUDENT', permissionGroups: [], permissions: [] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      jest.spyOn(prisma.topicRegistration, 'findUnique').mockResolvedValue({
        id: 999,
        studentId: 77,
        topic: { id: 10, mentorId: 101, mentor: { id: 101, fullName: 'GVHD A' } },
        student: { id: 77, fullName: 'Sinh viên B' },
      });

      await aiController.bm04Suggestion(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'FORBIDDEN' })
      );
    });

    it('should return 200 with BM04 suggestions when invoked by assigned mentor', async () => {
      const req = {
        body: { registrationId: 100 },
        user: { id: 101, role: 'LECTURER', permissionGroups: [], permissions: [] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      jest.spyOn(prisma.topicRegistration, 'findUnique').mockResolvedValue({
        id: 100,
        studentId: 88,
        topic: { id: 10, mentorId: 101, title: 'Đề tài mẫu', mentor: { id: 101, fullName: 'GVHD A' } },
        student: { id: 88, fullName: 'Sinh viên B', code: '22001122' },
        bm03Record: {
          meetings: [
            {
              meetingDate: new Date('2026-03-01'),
              discussionContent: 'Họp tuần 1',
              studentCompletedWork: 'Xong báo cáo tuần 1',
              progressRating: 'GOOD',
            },
          ],
          stageEvaluations: [],
        },
        meetingLogs: [],
        checkpointEvaluations: [
          { checkpointNo: 1, conclusion: 'PASS', comments: 'Đạt' },
          { checkpointNo: 2, conclusion: 'PASS', comments: 'Đạt' },
        ],
      });

      await aiController.bm04Suggestion(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            thesisFormatScore: expect.any(String),
            researchContentScore: expect.any(String),
            applicabilityScore: expect.any(String),
            attitudeScore: expect.any(String),
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: 'APPROVE_FOR_DEFENSE',
          }),
        })
      );
    });
  });
});
