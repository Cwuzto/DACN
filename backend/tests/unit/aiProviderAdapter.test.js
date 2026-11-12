/**
 * Unit Tests for Academic AI Suite Provider Adapter Core (Task 1)
 * Follows TDD methodology: written before implementation.
 */

describe('Academic AI Suite - Provider Adapter Core & Local Fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. geminiProvider.js', () => {
    let geminiProvider;

    beforeEach(() => {
      geminiProvider = require('../../src/services/ai/geminiProvider');
    });

    it('should safely parse clean JSON responses from Gemini', () => {
      const rawText = JSON.stringify({
        overallScore: 8.5,
        status: 'GOOD',
        summary: 'Đề cương hợp lý',
      });
      const parsed = geminiProvider.parseJsonResponse(rawText);
      expect(parsed).toEqual({
        overallScore: 8.5,
        status: 'GOOD',
        summary: 'Đề cương hợp lý',
      });
    });

    it('should strip markdown code block fences (```json ... ```) when parsing JSON', () => {
      const rawText = '```json\n{\n  "overallScore": 9.0,\n  "status": "GOOD"\n}\n```';
      const parsed = geminiProvider.parseJsonResponse(rawText);
      expect(parsed).toEqual({
        overallScore: 9.0,
        status: 'GOOD',
      });
    });

    it('should strip markdown code block fences without language tag (``` ... ```)', () => {
      const rawText = '```\n{\n  "riskLevel": "NOVEL",\n  "maxSimilarityPercentage": 15\n}\n```';
      const parsed = geminiProvider.parseJsonResponse(rawText);
      expect(parsed).toEqual({
        riskLevel: 'NOVEL',
        maxSimilarityPercentage: 15,
      });
    });

    it('should throw an error when parsing completely invalid JSON text', () => {
      const rawText = 'This is an error message, not JSON';
      expect(() => geminiProvider.parseJsonResponse(rawText)).toThrow(/Invalid JSON/i);
    });

    it('should format BM01 analysis prompt with all outline sections', () => {
      const outline = {
        topicTitle: 'Hệ thống AI',
        objectives: 'Mục tiêu nghiên cứu',
        scope: 'Phạm vi đề tài',
        methodology: 'Phương pháp nghiên cứu',
        expectedDeliverables: 'Báo cáo và mã nguồn',
      };
      const prompt = geminiProvider.formatBM01Prompt(outline);
      expect(prompt).toContain('Hệ thống AI');
      expect(prompt).toContain('Mục tiêu nghiên cứu');
      expect(prompt).toContain('Phạm vi đề tài');
      expect(prompt).toContain('Phương pháp nghiên cứu');
      expect(prompt).toContain('Báo cáo và mã nguồn');
      expect(prompt).toContain('overallScore');
      expect(prompt).toContain('dimensions');
    });

    it('should format topic similarity prompt including existing topics', () => {
      const newTopic = {
        title: 'Nghiên cứu thị giác máy tính',
        summary: 'Phát hiện đối tượng bằng YOLO',
      };
      const existingTopics = [
        { id: 1, title: 'Nhận diện xe hơi bằng YOLOv8', mentorName: 'TS. Nguyễn Văn A' },
      ];
      const prompt = geminiProvider.formatSimilarityPrompt(newTopic, existingTopics);
      expect(prompt).toContain('Nghiên cứu thị giác máy tính');
      expect(prompt).toContain('Nhận diện xe hơi bằng YOLOv8');
      expect(prompt).toContain('maxSimilarityPercentage');
      expect(prompt).toContain('riskLevel');
      expect(prompt).toContain('refinedTitleSuggestions');
    });

    it('should format archival dossier cross-check prompt with expected and extracted fields', () => {
      const registrationData = {
        effectiveOfficialTitle: 'Phát hiện xâm nhập mạng',
        studentCode: '21001234',
        studentName: 'Trần Văn An',
        mentorName: 'TS. Phạm Minh Tuấn',
      };
      const dossierFiles = [
        { type: 'REPORT_PDF', fileName: 'BaoCao_21001234.pdf', extractedTitle: 'Phát hiện xâm nhập mạng' },
      ];
      const prompt = geminiProvider.formatCrossCheckPrompt(registrationData, dossierFiles);
      expect(prompt).toContain('Phát hiện xâm nhập mạng');
      expect(prompt).toContain('21001234');
      expect(prompt).toContain('Trần Văn An');
      expect(prompt).toContain('checklist');
      expect(prompt).toContain('overallStatus');
    });

    it('should call Gemini REST API with native fetch and return parsed data with provider tag', async () => {
      const mockPayload = {
        overallScore: 8.8,
        status: 'GOOD',
        summary: 'Đề cương rất tốt',
        dimensions: [],
        actionableSuggestions: ['Bổ sung metrics'],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockPayload) }],
              },
            },
          ],
        }),
      });

      const result = await geminiProvider.analyzeBM01Outline(
        { topicTitle: 'AI Core' },
        { apiKey: 'fake-gemini-key', fetchFn: mockFetch }
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('gemini-2.0-flash:generateContent?key=fake-gemini-key');
      expect(calledOpts.method).toBe('POST');
      expect(calledOpts.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(calledOpts.body);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.temperature).toBe(0.2);

      expect(result.overallScore).toBe(8.8);
      expect(result.provider).toBe('gemini-2.0-flash');
    });

    it('should throw an informative error when Gemini REST API returns non-200 status', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Resource has been exhausted',
      });

      await expect(
        geminiProvider.analyzeBM01Outline(
          { topicTitle: 'AI Core' },
          { apiKey: 'fake-gemini-key', fetchFn: mockFetch }
        )
      ).rejects.toThrow(/Gemini API call failed with status 429/);
    });
  });

  describe('2. localFallbackProvider.js', () => {
    let localFallbackProvider;

    beforeEach(() => {
      localFallbackProvider = require('../../src/services/ai/localFallbackProvider');
    });

    describe('analyzeBM01Outline', () => {
      it('should evaluate a complete and high-quality outline as GOOD with 5 dimensions', () => {
        const outlineContent = {
          topicTitle: 'Xây dựng hệ thống phát hiện tấn công DDoS sử dụng Machine Learning',
          researchContext: 'Bối cảnh các cuộc tấn công DDoS ngày càng gia tăng và tinh vi trong kỷ nguyên số.',
          objectives: 'Phát hiện tấn công DDoS với độ chính xác trên 95% và thời gian phản hồi dưới 1 giây.',
          scope: 'Thực nghiệm trên bộ dữ liệu CICDDoS2019 trong môi trường mạng giả lập SDN.',
          methodology: 'Ứng dụng thuật toán Random Forest và XGBoost, kết hợp trích xuất đặc trưng gói tin luồng NetFlow.',
          expectedDeliverables: 'Mã nguồn hệ thống, mô hình đã huấn luyện, báo cáo đồ án tốt nghiệp.',
        };

        const result = localFallbackProvider.analyzeBM01Outline(outlineContent);

        expect(result.provider).toBe('local_fallback');
        expect(result.status).toBe('GOOD');
        expect(result.overallScore).toBeGreaterThanOrEqual(7.5);
        expect(result.overallScore).toBeLessThanOrEqual(10.0);
        expect(result.summary).toBeDefined();
        expect(Array.isArray(result.dimensions)).toBe(true);
        expect(result.dimensions).toHaveLength(5);

        // Check 5 required dimensions
        const dimensionNames = result.dimensions.map((d) => d.name);
        expect(dimensionNames).toContain('Tính logic Tên - Mục tiêu');
        expect(dimensionNames).toContain('Tính khả thi Phương pháp');
        expect(dimensionNames).toContain('Phạm vi & Dữ liệu');
        expect(dimensionNames).toContain('Sản phẩm dự kiến');
        expect(dimensionNames).toContain('Tính hoàn thiện học thuật');

        result.dimensions.forEach((dim) => {
          expect(['PASS', 'WARNING', 'NEEDS_IMPROVEMENT']).toContain(dim.status);
          expect(typeof dim.feedback).toBe('string');
        });

        expect(Array.isArray(result.actionableSuggestions)).toBe(true);
      });

      it('should flag incomplete outline missing methodology and scope as NEEDS_IMPROVEMENT with low score', () => {
        const incompleteOutline = {
          topicTitle: 'Ứng dụng web bán sách',
          objectives: 'Làm web bán hàng',
          // missing researchContext, scope, methodology, expectedDeliverables
        };

        const result = localFallbackProvider.analyzeBM01Outline(incompleteOutline);

        expect(result.provider).toBe('local_fallback');
        expect(['NEEDS_IMPROVEMENT', 'CRITICAL_GAPS']).toContain(result.status);
        expect(result.overallScore).toBeLessThan(6.0);

        // Check actionable suggestions specifically point out missing parts
        const suggestionsText = result.actionableSuggestions.join(' ');
        expect(suggestionsText.toLowerCase()).toMatch(/phương pháp|phạm vi|sản phẩm/);
      });
    });

    describe('checkTopicSimilarity', () => {
      const existingTopics = [
        {
          id: 1,
          title: 'Nghiên cứu nhận diện phương tiện vi phạm giao thông bằng YOLOv8',
          summary: 'Phát hiện phương tiện vượt đèn đỏ sử dụng camera giao thông và YOLOv8.',
          mentorName: 'TS. Nguyễn Văn A',
          semester: 'HK1 2024-2025',
        },
        {
          id: 2,
          title: 'Xây dựng website thương mại điện tử bán nông sản sạch với Next.js và Spring Boot',
          summary: 'Sàn thương mại điện tử kết nối nhà vườn với người tiêu dùng.',
          mentorName: 'ThS. Trần Thị B',
          semester: 'HK2 2024-2025',
        },
      ];

      it('should detect NOVEL risk level for an unrelated new topic', () => {
        const newTopic = {
          title: 'Thiết kế hệ thống chuỗi khối Blockchain cho quản lý chứng chỉ học tập',
          summary: 'Ứng dụng Smart Contract trên mạng Ethereum lưu trữ bằng cấp không thể giả mạo.',
        };

        const result = localFallbackProvider.checkTopicSimilarity(newTopic, existingTopics);

        expect(result.provider).toBe('local_fallback');
        expect(result.riskLevel).toBe('NOVEL');
        expect(result.maxSimilarityPercentage).toBeLessThan(40);
        expect(result.refinedTitleSuggestions).toHaveLength(3);
        expect(typeof result.verdict).toBe('string');
      });

      it('should detect HIGH_DUPLICATE_RISK when topic heavily overlaps with existing topic', () => {
        const duplicateTopic = {
          title: 'Nhận diện phương tiện giao thông vi phạm bằng YOLOv8 qua camera',
          summary: 'Sử dụng mô hình YOLOv8 để phát hiện phương tiện vượt đèn đỏ qua video camera.',
        };

        const result = localFallbackProvider.checkTopicSimilarity(duplicateTopic, existingTopics);

        expect(result.provider).toBe('local_fallback');
        expect(result.riskLevel).toBe('HIGH_DUPLICATE_RISK');
        expect(result.maxSimilarityPercentage).toBeGreaterThanOrEqual(70);
        expect(result.matchedTopics.length).toBeGreaterThan(0);

        const topMatch = result.matchedTopics[0];
        expect(topMatch.title).toContain('YOLOv8');
        expect(typeof topMatch.similarities).toBe('string');
        expect(typeof topMatch.differences).toBe('string');
        expect(result.refinedTitleSuggestions).toHaveLength(3);
      });

      it('should detect MODERATE_SIMILARITY for partially overlapping topic and suggest 3 refined titles', () => {
        const moderateTopic = {
          title: 'Phát hiện và đếm mật độ giao thông sử dụng YOLOv8 và DeepSORT trên Jetson Nano',
          summary: 'Ứng dụng thuật toán DeepSORT để theo dõi xe và đánh giá lưu lượng tại ngã tư.',
        };

        const result = localFallbackProvider.checkTopicSimilarity(moderateTopic, existingTopics);

        expect(result.provider).toBe('local_fallback');
        expect(['MODERATE_SIMILARITY', 'HIGH_DUPLICATE_RISK']).toContain(result.riskLevel);
        expect(result.refinedTitleSuggestions).toHaveLength(3);
        result.refinedTitleSuggestions.forEach((sug) => {
          expect(typeof sug).toBe('string');
          expect(sug.length).toBeGreaterThan(10);
        });
      });
    });

    describe('crossCheckArchivalDossier', () => {
      const registrationData = {
        effectiveOfficialTitle: 'Xây dựng hệ thống phát hiện mã độc bằng học sâu',
        studentCode: '21001234',
        studentName: 'Nguyễn Văn Cường',
        mentorName: 'TS. Phạm Minh Tuấn',
      };

      it('should return MATCHED when all dossier files align with official metadata', () => {
        const dossierFiles = [
          {
            type: 'REPORT_PDF',
            fileName: 'BaoCao_21001234.pdf',
            extractedTitle: 'Xây dựng hệ thống phát hiện mã độc bằng học sâu',
            extractedStudentCode: '21001234',
            extractedStudentName: 'Nguyễn Văn Cường',
            extractedMentorName: 'TS. Phạm Minh Tuấn',
          },
          {
            type: 'REPORT_WORD',
            fileName: 'BaoCao_21001234.docx',
            extractedTitle: 'Xây dựng hệ thống phát hiện mã độc bằng học sâu',
            extractedStudentCode: '21001234',
            extractedStudentName: 'Nguyễn Văn Cường',
            extractedMentorName: 'TS. Phạm Minh Tuấn',
          },
        ];

        const result = localFallbackProvider.crossCheckArchivalDossier(registrationData, dossierFiles);

        expect(result.provider).toBe('local_fallback');
        expect(result.overallStatus).toBe('MATCHED');
        expect(result.discrepancies).toEqual([]);
        expect(result.checklist.length).toBeGreaterThanOrEqual(4);
        expect(result.checklist.every((item) => ['EXACT_MATCH', 'CONSISTENT'].includes(item.status))).toBe(true);
        expect(result.academicAffairsGuidance).toContain('chuẩn xác');
      });

      it('should detect DISCREPANCY_FOUND when report file contains outdated title', () => {
        const dossierFiles = [
          {
            type: 'REPORT_PDF',
            fileName: 'BaoCao_21001234.pdf',
            extractedTitle: 'Nghiên cứu mã độc (Tên cũ chưa cập nhật BM02-A)',
            extractedStudentCode: '21001234',
            extractedStudentName: 'Nguyễn Văn Cường',
            extractedMentorName: 'TS. Phạm Minh Tuấn',
          },
        ];

        const result = localFallbackProvider.crossCheckArchivalDossier(registrationData, dossierFiles);

        expect(result.provider).toBe('local_fallback');
        expect(result.overallStatus).toBe('DISCREPANCY_FOUND');
        expect(result.discrepancies.length).toBeGreaterThan(0);

        const titleCheck = result.checklist.find((c) => c.field && c.field.includes('Tên đề tài'));
        expect(titleCheck.status).toBe('MISMATCH');
        expect(result.academicAffairsGuidance).toMatch(/không khớp|chỉnh sửa|yêu cầu/i);
      });
    });
  });

  describe('3. aiProviderService.js (Facade Router & Zero Crash Guarantee)', () => {
    let aiProviderService;
    let geminiProvider;
    let localFallbackProvider;

    beforeEach(() => {
      aiProviderService = require('../../src/services/ai/aiProviderService');
      geminiProvider = require('../../src/services/ai/geminiProvider');
      localFallbackProvider = require('../../src/services/ai/localFallbackProvider');
    });

    it('should route to local fallback provider when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;

      const fallbackSpy = jest.spyOn(localFallbackProvider, 'analyzeBM01Outline');
      const geminiSpy = jest.spyOn(geminiProvider, 'analyzeBM01Outline');

      const result = await aiProviderService.analyzeBM01Outline({
        topicTitle: 'Hệ thống IoT cảnh báo sớm ngập úng đô thị',
        objectives: 'Cảnh báo ngập qua cảm biến siêu âm',
        scope: 'Khu vực Quận 1',
        methodology: 'ESP32 kết nối MQTT',
        expectedDeliverables: 'Phần cứng và Dashboard web',
      });

      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(result.provider).toBe('local_fallback');
      expect(result.overallScore).toBeDefined();

      fallbackSpy.mockRestore();
      geminiSpy.mockRestore();
    });

    it('should route to geminiProvider when GEMINI_API_KEY is set and call succeeds', async () => {
      process.env.GEMINI_API_KEY = 'real-gemini-key-123';

      const mockGeminiResponse = {
        overallScore: 9.2,
        status: 'GOOD',
        summary: 'Rất chi tiết và khả thi',
        dimensions: [],
        actionableSuggestions: [],
        provider: 'gemini-2.0-flash',
      };

      const geminiSpy = jest
        .spyOn(geminiProvider, 'analyzeBM01Outline')
        .mockResolvedValue(mockGeminiResponse);
      const fallbackSpy = jest.spyOn(localFallbackProvider, 'analyzeBM01Outline');

      const result = await aiProviderService.analyzeBM01Outline({
        topicTitle: 'Test Gemini',
      });

      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.overallScore).toBe(9.2);
      expect(result.provider).toBe('gemini-2.0-flash');

      geminiSpy.mockRestore();
      fallbackSpy.mockRestore();
    });

    it('should automatically fall back to local fallback provider on network/timeout error (Zero Crash Guarantee)', async () => {
      process.env.GEMINI_API_KEY = 'test-key-timeout';

      // Simulate gemini failure (Network Error or Timeout)
      const geminiSpy = jest
        .spyOn(geminiProvider, 'checkTopicSimilarity')
        .mockRejectedValue(new Error('Fetch failed / Connection timeout after 8000ms'));
      const fallbackSpy = jest.spyOn(localFallbackProvider, 'checkTopicSimilarity');

      const result = await aiProviderService.checkTopicSimilarity(
        { title: 'Test Fallback Resilience' },
        []
      );

      // Verify zero crash: it did not throw, but smoothly returned fallback result
      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(result.provider).toBe('local_fallback');
      expect(result.riskLevel).toBe('NOVEL');

      geminiSpy.mockRestore();
      fallbackSpy.mockRestore();
    });

    it('should smoothly fall back for crossCheckArchivalDossier when Gemini throws', async () => {
      process.env.GEMINI_API_KEY = 'test-key-error';

      const geminiSpy = jest
        .spyOn(geminiProvider, 'crossCheckArchivalDossier')
        .mockRejectedValue(new Error('API quota exceeded 429'));

      const result = await aiProviderService.crossCheckArchivalDossier(
        {
          effectiveOfficialTitle: 'Hệ thống Quản lý',
          studentCode: '21000001',
          studentName: 'Lê Văn A',
          mentorName: 'ThS. Nguyễn B',
        },
        []
      );

      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(result.provider).toBe('local_fallback');
      expect(result.overallStatus).toBeDefined();

      geminiSpy.mockRestore();
    });

    it('should correctly report current provider mode and key status', () => {
      delete process.env.GEMINI_API_KEY;
      expect(aiProviderService.isGeminiConfigured()).toBe(false);
      expect(aiProviderService.getProviderMode()).toBe('local_fallback');

      process.env.GEMINI_API_KEY = 'test-key';
      expect(aiProviderService.isGeminiConfigured()).toBe(true);
      expect(aiProviderService.getProviderMode()).toBe('gemini-2.0-flash');
    });
  });
});
