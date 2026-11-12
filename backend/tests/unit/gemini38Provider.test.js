/**
 * Unit Tests for Gemini 3.8 Flash Provider (Task 1)
 * Tests chatWithGemini, payload formatting, role mapping, system_instruction,
 * default model selection, error handling, and timeout resilience.
 */

describe('geminiProvider.js - Gemini 3.8 Flash REST Integration', () => {
  const originalEnv = process.env;
  let geminiProvider;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    geminiProvider = require('../../src/services/ai/geminiProvider');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Model Resolution & Configuration', () => {
    it('should default to gemini-3.8-flash when GEMINI_MODEL is not set', () => {
      expect(geminiProvider.DEFAULT_MODEL).toBe('gemini-3.8-flash');
    });

    it('should respect process.env.GEMINI_MODEL when configured', () => {
      process.env.GEMINI_MODEL = 'gemini-custom-flash';
      jest.resetModules();
      const customProvider = require('../../src/services/ai/geminiProvider');
      expect(customProvider.DEFAULT_MODEL).toBe('gemini-custom-flash');
    });
  });

  describe('2. chatWithGemini Payload Formatting & Role Mapping', () => {
    it('should format multi-turn contents and system_instruction correctly', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ reply: 'Chào bạn, tôi là Gemini 3.8' }) }],
                },
              },
            ],
          }),
        };
      });

      const messages = [
        { role: 'user', text: 'Chào trợ lý' },
        { role: 'model', text: 'Xin chào, tôi có thể giúp gì?' },
        { role: 'user', text: 'Quy chế nộp BM01 thế nào?' },
      ];
      const systemInstruction = 'Bạn là Trợ lý Học vụ của Viện Công nghệ Số.';

      const result = await geminiProvider.chatWithGemini({
        messages,
        systemInstruction,
        apiKey: 'test-api-key-123',
        fetchFn: mockFetch,
      });

      // Verify URL targets gemini-3.8-flash v1beta generateContent
      expect(capturedUrl).toContain('models/gemini-3.8-flash:generateContent?key=test-api-key-123');

      // Verify system_instruction format
      expect(capturedBody.system_instruction).toEqual({
        parts: [{ text: 'Bạn là Trợ lý Học vụ của Viện Công nghệ Số.' }],
      });

      // Verify contents formatting and role mapping
      expect(capturedBody.contents).toEqual([
        { role: 'user', parts: [{ text: 'Chào trợ lý' }] },
        { role: 'model', parts: [{ text: 'Xin chào, tôi có thể giúp gì?' }] },
        { role: 'user', parts: [{ text: 'Quy chế nộp BM01 thế nào?' }] },
      ]);

      // Verify generationConfig
      expect(capturedBody.generationConfig.temperature).toBe(0.2);

      // Verify return structure
      expect(result.reply).toBe('Chào bạn, tôi là Gemini 3.8');
      expect(result.provider).toBe('gemini-3.8-flash');
    });

    it('should map role "assistant" to "model" for Gemini API compatibility', async () => {
      let capturedBody = null;

      const mockFetch = jest.fn().mockImplementation(async (_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Phản hồi bình thường' }],
                },
              },
            ],
          }),
        };
      });

      const messages = [
        { role: 'user', content: 'Câu hỏi 1' },
        { role: 'assistant', content: 'Câu trả lời 1' },
        { role: 'user', content: 'Câu hỏi 2' },
      ];

      const result = await geminiProvider.chatWithGemini({
        messages,
        apiKey: 'test-key',
        fetchFn: mockFetch,
      });

      expect(capturedBody.contents[0].role).toBe('user');
      expect(capturedBody.contents[1].role).toBe('model');
      expect(capturedBody.contents[2].role).toBe('user');
      expect(result.reply).toBe('Phản hồi bình thường');
      expect(result.provider).toBe('gemini-3.8-flash');
    });

    it('should allow overriding model via explicit option', async () => {
      let capturedUrl = '';

      const mockFetch = jest.fn().mockImplementation(async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'OK' }],
                },
              },
            ],
          }),
        };
      });

      await geminiProvider.chatWithGemini({
        messages: [{ role: 'user', text: 'Test' }],
        model: 'gemini-1.5-pro-preview',
        apiKey: 'test-key',
        fetchFn: mockFetch,
      });

      expect(capturedUrl).toContain('models/gemini-1.5-pro-preview:generateContent');
    });
  });

  describe('3. Error & Timeout Handling', () => {
    it('should throw when GEMINI_API_KEY is not configured', async () => {
      await expect(
        geminiProvider.chatWithGemini({
          messages: [{ role: 'user', text: 'Hello' }],
        })
      ).rejects.toThrow('GEMINI_API_KEY is not configured');
    });

    it('should throw with status and text when Gemini API responds with non-ok status', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'API key not valid',
      });

      await expect(
        geminiProvider.chatWithGemini({
          messages: [{ role: 'user', text: 'Hello' }],
          apiKey: 'invalid-key',
          fetchFn: mockFetch,
        })
      ).rejects.toThrow(/Gemini API call failed with status 400 Bad Request/);
    });

    it('should throw when candidate content is empty', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [] } }],
        }),
      });

      await expect(
        geminiProvider.chatWithGemini({
          messages: [{ role: 'user', text: 'Hello' }],
          apiKey: 'test-key',
          fetchFn: mockFetch,
        })
      ).rejects.toThrow('Empty response content received from Gemini API');
    });

    it('should handle timeout when request exceeds timeoutMs', async () => {
      const mockFetch = jest.fn().mockImplementation((_url, opts) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      await expect(
        geminiProvider.chatWithGemini({
          messages: [{ role: 'user', text: 'Timeout test' }],
          apiKey: 'test-key',
          timeoutMs: 50,
          fetchFn: mockFetch,
        })
      ).rejects.toThrow();
    });
  });
});
