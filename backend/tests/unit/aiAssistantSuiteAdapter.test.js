/**
 * Unit Tests for Academic AI Assistant Suite Adapter Core (Task 1)
 * Tests localEmbeddingService, geminiProvider, localFallbackProvider, and aiProviderService.
 */

describe('Academic AI Assistant Suite - Adapter Core & Local Embeddings (Task 1)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. localEmbeddingService.js', () => {
    let localEmbeddingService;

    beforeEach(() => {
      localEmbeddingService = require('../../src/services/ai/localEmbeddingService');
    });

    it('should compute cosine similarity correctly for identical, orthogonal, and zero vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      const identicalSim = localEmbeddingService.computeCosineSimilarity(vecA, vecB);
      expect(identicalSim).toBeCloseTo(1.0, 4);

      const vecOrth1 = [1, 0];
      const vecOrth2 = [0, 1];
      const orthSim = localEmbeddingService.computeCosineSimilarity(vecOrth1, vecOrth2);
      expect(orthSim).toBeCloseTo(0.0, 4);

      const zeroVec = [0, 0, 0];
      expect(localEmbeddingService.computeCosineSimilarity(vecA, zeroVec)).toBe(0.0);
      expect(localEmbeddingService.computeCosineSimilarity([], [1, 2])).toBe(0.0);
      expect(localEmbeddingService.computeCosineSimilarity([1, 2], [1, 2, 3])).toBe(0.0);
    });

    it('should extract embeddings using custom pipeline option or handle fallback', async () => {
      // Mock pipeline returning normalized float array
      const mockPipeline = jest.fn().mockResolvedValue({
        data: new Float32Array([0.1, 0.2, 0.3]),
      });

      const embedding = await localEmbeddingService.getEmbedding('Nghiên cứu thị giác máy tính', {
        pipeline: mockPipeline,
      });

      expect(mockPipeline).toHaveBeenCalled();
      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(3);
    });

    it('should return 1.0 similarity for identical texts and 0.0 for empty input', async () => {
      const sameSim = await localEmbeddingService.computeSimilarity('Xây dựng hệ thống IoT', 'Xây dựng hệ thống IoT');
      expect(sameSim).toBe(1.0);

      const emptySim1 = await localEmbeddingService.computeSimilarity('', 'Hệ thống');
      expect(emptySim1).toBe(0.0);

      const emptySim2 = await localEmbeddingService.computeSimilarity('Hệ thống', null);
      expect(emptySim2).toBe(0.0);
    });

    it('should gracefully fallback to heuristic similarity (Jaccard / n-gram) when model is unavailable', async () => {
      // Force pipeline failure
      const failingPipeline = jest.fn().mockRejectedValue(new Error('Model loading failed'));

      const sim = await localEmbeddingService.computeSimilarity(
        'Phát hiện gian lận bằng máy học',
        'Phát hiện gian lận bằng học máy và AI',
        { pipeline: failingPipeline }
      );

      expect(typeof sim).toBe('number');
      expect(sim).toBeGreaterThan(0.0);
      expect(sim).toBeLessThanOrEqual(1.0);
    });
  });

  describe('2. geminiProvider.js (New Academic Capabilities)', () => {
    let geminiProvider;

    beforeEach(() => {
      geminiProvider = require('../../src/services/ai/geminiProvider');
    });

    it('should format academic feedback prompt with contextType, scores, and notes', () => {
      const payload = {
        contextType: 'BM01',
        topicTitle: 'Hệ thống IoT cảnh báo cháy',
        studentName: 'Trần Văn B',
        scores: { formatScore: 8.0, contentScore: 8.5 },
        notes: 'Cần bổ sung phần phân tích rủi ro',
      };
      const prompt = geminiProvider.formatFeedbackPrompt(payload);
      expect(prompt).toContain('BM01');
      expect(prompt).toContain('Hệ thống IoT cảnh báo cháy');
      expect(prompt).toContain('Trần Văn B');
      expect(prompt).toContain('8.5');
      expect(prompt).toContain('Cần bổ sung phần phân tích rủi ro');
      expect(prompt).toContain('strengths');
      expect(prompt).toContain('improvements');
    });

    it('should call Gemini API and parse academic feedback response', async () => {
      const mockResult = {
        feedback: 'Sinh viên hoàn thành tốt mục tiêu đề cương BM01.',
        strengths: ['Đề tài có tính thực tiễn cao', 'Bố cục rõ ràng'],
        improvements: ['Cần làm rõ phương pháp đánh giá thực nghiệm'],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockResult) }],
              },
            },
          ],
        }),
      });

      const response = await geminiProvider.generateAcademicFeedback(
        { contextType: 'BM01', topicTitle: 'Hệ thống IoT' },
        { apiKey: 'test-api-key', fetchFn: mockFetch }
      );

      expect(response.feedback).toBe(mockResult.feedback);
      expect(response.strengths).toEqual(mockResult.strengths);
      expect(response.improvements).toEqual(mockResult.improvements);
      expect(response.provider).toBe(geminiProvider.DEFAULT_MODEL);
    });

    it('should format defense questions prompt and parse 3-tier response', async () => {
      const payload = {
        topicTitle: 'Phân loại ảnh y tế bằng Deep Learning',
        technologies: 'Python, PyTorch, ResNet',
        major: 'Khoa học Dữ liệu',
      };
      const prompt = geminiProvider.formatDefenseQuestionsPrompt(payload);
      expect(prompt).toContain('Phân loại ảnh y tế bằng Deep Learning');
      expect(prompt).toContain('ResNet');
      expect(prompt).toContain('FOUNDATION');
      expect(prompt).toContain('TECHNICAL_CHALLENGE');
      expect(prompt).toContain('FUTURE_EXPANSION');

      const mockResult = {
        questions: [
          {
            level: 'FOUNDATION',
            levelLabel: 'Kiến thức nền tảng',
            question: 'Em hãy giải thích kiến trúc ResNet?',
            purpose: 'Kiểm tra kiến thức cơ bản.',
          },
          {
            level: 'TECHNICAL_CHALLENGE',
            levelLabel: 'Thách thức kỹ thuật',
            question: 'Xử lý mất cân bằng dữ liệu như thế nào?',
            purpose: 'Đánh giá kỹ năng thực tế.',
          },
          {
            level: 'FUTURE_EXPANSION',
            levelLabel: 'Hướng phát triển & Ứng dụng',
            question: 'Mô hình sẽ tối ưu suy luận như thế nào trong bệnh viện?',
            purpose: 'Đánh giá khả năng mở rộng.',
          },
        ],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResult) }] } }],
        }),
      });

      const response = await geminiProvider.generateDefenseQuestions(payload, {
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
      });

      expect(response.questions.length).toBe(3);
      expect(response.questions[0].level).toBe('FOUNDATION');
      expect(response.questions[1].level).toBe('TECHNICAL_CHALLENGE');
      expect(response.questions[2].level).toBe('FUTURE_EXPANSION');
      expect(response.provider).toBe(geminiProvider.DEFAULT_MODEL);
    });

    it('should format regulation chat prompt and parse reply with quick questions', async () => {
      const payload = {
        message: 'Nếu đề cương BM01 không đạt thì sao?',
        history: [{ role: 'user', content: 'Chào bot' }],
      };
      const prompt = geminiProvider.formatRegulationChatPrompt(payload);
      expect(prompt).toContain('Nếu đề cương BM01 không đạt thì sao?');
      expect(prompt).toContain('Quy chế học vụ');

      const mockResult = {
        reply: 'Sinh viên được nộp lại v2 duy nhất 01 lần.',
        relatedRegulations: ['BM01: Đề cương chi tiết', 'Quy định nộp lại v2'],
        suggestedQuickQuestions: ['Thời hạn nộp lại v2 là bao lâu?', 'Hội đồng duyệt lại khi nào?'],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResult) }] } }],
        }),
      });

      const response = await geminiProvider.answerRegulationChat(payload, {
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
      });

      expect(response.reply).toContain('nộp lại v2');
      expect(response.relatedRegulations.length).toBe(2);
      expect(response.suggestedQuickQuestions.length).toBe(2);
      expect(response.provider).toBe(geminiProvider.DEFAULT_MODEL);
    });
  });

  describe('3. localFallbackProvider.js (Offline Heuristic Intelligence)', () => {
    let localFallbackProvider;

    beforeEach(() => {
      localFallbackProvider = require('../../src/services/ai/localFallbackProvider');
    });

    it('should generate academic feedback with high scores correctly', () => {
      const payload = {
        contextType: 'BM01',
        topicTitle: 'Nghiên cứu Blockchain trong bầu cử',
        studentName: 'Lê Văn C',
        scores: { formatScore: 9.0, contentScore: 8.5, applicabilityScore: 9.0 },
        notes: 'Tiến độ rất tốt, trình bày mạch lạc',
      };

      const result = localFallbackProvider.generateAcademicFeedback(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.feedback).toBeTruthy();
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(Array.isArray(result.improvements)).toBe(true);
    });

    it('should generate academic feedback safely when scores are empty or missing', () => {
      const payload = {
        contextType: 'DEFENSE',
        topicTitle: 'Hệ thống nhận diện biển số xe',
        studentName: 'Phạm Thị D',
        scores: {},
        notes: '',
      };

      const result = localFallbackProvider.generateAcademicFeedback(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.feedback).toBeTruthy();
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.improvements.length).toBeGreaterThan(0);
    });

    it('should generate exactly 3 tiered defense questions based on topic and technologies', () => {
      const payload = {
        topicTitle: 'Xây dựng ứng dụng microservices với Docker và Kubernetes',
        description: 'Triển khai kiến trúc dịch vụ nhỏ, quản lý container tự động',
        technologies: 'Node.js, Docker, Kubernetes, MongoDB',
        major: 'Kỹ thuật Phần mềm',
      };

      const result = localFallbackProvider.generateDefenseQuestions(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.questions.length).toBe(3);

      const levels = result.questions.map((q) => q.level);
      expect(levels).toEqual(['FOUNDATION', 'TECHNICAL_CHALLENGE', 'FUTURE_EXPANSION']);

      result.questions.forEach((q) => {
        expect(q.question).toBeTruthy();
        expect(q.purpose).toBeTruthy();
        expect(q.levelLabel).toBeTruthy();
      });
    });

    it('should answer regulation chat queries accurately using keyword rules', () => {
      // Test BM01 question
      const bm01Result = localFallbackProvider.answerRegulationChat({
        message: 'Quy định nộp lại đề cương BM01 như thế nào?',
      });
      expect(bm01Result.provider).toBe('local_fallback');
      expect(bm01Result.reply).toMatch(/nộp lại|v2|chỉnh sửa/i);
      expect(bm01Result.relatedRegulations.some((r) => r.includes('BM01'))).toBe(true);
      expect(bm01Result.suggestedQuickQuestions.length).toBeGreaterThan(0);

      // Test 14-day archival question
      const archivalResult = localFallbackProvider.answerRegulationChat({
        message: 'Sau khi bảo vệ xong bao nhiêu ngày phải nộp lưu chiểu hồ sơ tốt nghiệp?',
      });
      expect(archivalResult.reply).toMatch(/14 ngày/i);
      expect(archivalResult.relatedRegulations.some((r) => r.includes('Lưu chiểu') || r.includes('14 ngày'))).toBe(true);

      // Test general fallback question
      const genericResult = localFallbackProvider.answerRegulationChat({
        message: 'Cho tôi biết quy trình làm đồ án',
      });
      expect(genericResult.reply).toBeTruthy();
      expect(genericResult.suggestedQuickQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('4. aiProviderService.js (Facade Routing, Timeout & Zero-Crash)', () => {
    let aiProviderService;

    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
      aiProviderService = require('../../src/services/ai/aiProviderService');
      delete process.env.GEMINI_API_KEY;
    });

    afterEach(() => {
      delete process.env.GEMINI_API_KEY;
      jest.restoreAllMocks();
    });

    it('should route generateFeedback to localFallbackProvider when GEMINI_API_KEY is not set', async () => {
      const payload = {
        contextType: 'BM03',
        topicTitle: 'Hệ thống gợi ý du lịch',
        scores: { progressScore: 8.0 },
      };

      const result = await aiProviderService.generateFeedback(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.feedback).toBeTruthy();
    });

    it('should route generateDefenseQuestions to localFallbackProvider when GEMINI_API_KEY is not set', async () => {
      const payload = {
        topicTitle: 'Phân tích cảm xúc văn bản tiếng Việt',
        technologies: 'Python, PhoBERT',
      };

      const result = await aiProviderService.generateDefenseQuestions(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.questions.length).toBe(3);
    });

    it('should route answerRegulationChat to localFallbackProvider when GEMINI_API_KEY is not set', async () => {
      const payload = {
        message: 'Thời hạn nộp BM04 là khi nào?',
      };

      const result = await aiProviderService.answerRegulationChat(payload);
      expect(result.provider).toBe('local_fallback');
      expect(result.reply).toBeTruthy();
    });

    it('should fall back gracefully to local provider when Gemini throws an error (Zero Crash)', async () => {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      const geminiProvider = require('../../src/services/ai/geminiProvider');
      jest.spyOn(geminiProvider, 'generateAcademicFeedback').mockRejectedValue(new Error('Network timeout'));

      const result = await aiProviderService.generateFeedback({
        contextType: 'DEFENSE',
        topicTitle: 'Kiểm thử phần mềm tự động',
      });

      expect(result.provider).toBe('local_fallback');
      expect(result.feedback).toBeTruthy();
    });

    it('should integrate local semantic topic similarity using embedding vector calculations', async () => {
      const newTopic = { title: 'Xây dựng website bán hàng trực tuyến' };
      const existingTopics = [
        { id: 101, title: 'Hệ thống thương mại điện tử bán sách', mentorName: 'TS. Nguyễn Văn A' },
        { id: 102, title: 'Nhận diện khuôn mặt bằng camera', mentorName: 'ThS. Trần Văn B' },
      ];

      const result = await aiProviderService.checkTopicSimilarity(newTopic, existingTopics);
      expect(result.provider).toBeTruthy();
      expect(result.maxSimilarityPercentage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.matchedTopics)).toBe(true);
      expect(result.refinedTitleSuggestions.length).toBe(3);
    });
  });
});
