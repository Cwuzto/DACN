/**
 * Unit Tests for Ollama Provider (Task 2)
 * Tests isOllamaAvailable, chatWithOllama, generateEmbedding,
 * fallback logic, role mapping, error handling, and timeout resilience.
 */

describe('ollamaProvider.js - Local Ollama REST Provider', () => {
  const originalEnv = process.env;
  let ollamaProvider;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_CHAT_MODEL;
    delete process.env.OLLAMA_EMBED_MODEL;
    delete process.env.OLLAMA_TIMEOUT_MS;
    ollamaProvider = require('../../src/services/ai/ollamaProvider');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Default Configuration & Environment Resolution', () => {
    it('should have standard default values when env vars are not set', () => {
      expect(ollamaProvider.DEFAULT_BASE_URL).toBe('http://localhost:11434');
      expect(ollamaProvider.DEFAULT_CHAT_MODEL).toBe('qwen3:4b');
      expect(ollamaProvider.DEFAULT_EMBED_MODEL).toBe('embeddinggemma-2:270m');
      expect(ollamaProvider.DEFAULT_TIMEOUT_MS).toBe(30000);
    });

    it('should respect custom environment variables', () => {
      process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11435';
      process.env.OLLAMA_CHAT_MODEL = 'qwen2.5:7b';
      process.env.OLLAMA_EMBED_MODEL = 'nomic-embed-text';
      process.env.OLLAMA_TIMEOUT_MS = '45000';

      jest.resetModules();
      const customProvider = require('../../src/services/ai/ollamaProvider');

      expect(customProvider.DEFAULT_BASE_URL).toBe('http://127.0.0.1:11435');
      expect(customProvider.DEFAULT_CHAT_MODEL).toBe('qwen2.5:7b');
      expect(customProvider.DEFAULT_EMBED_MODEL).toBe('nomic-embed-text');
      expect(customProvider.DEFAULT_TIMEOUT_MS).toBe(45000);
    });
  });

  describe('2. isOllamaAvailable Health Check', () => {
    it('should return true when GET /api/version responds with 200 OK', async () => {
      let requestedUrl = '';
      let requestedMethod = '';

      const mockFetch = jest.fn().mockImplementation(async (url, opts = {}) => {
        requestedUrl = url;
        requestedMethod = opts.method || 'GET';
        return {
          ok: true,
          status: 200,
          json: async () => ({ version: '0.5.4' }),
        };
      });

      const available = await ollamaProvider.isOllamaAvailable({ fetchFn: mockFetch });

      expect(available).toBe(true);
      expect(requestedUrl).toBe('http://localhost:11434/api/version');
      expect(requestedMethod).toBe('GET');
    });

    it('should return false when GET /api/version responds with non-200 status', async () => {
      const mockFetch = jest.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'Service Unavailable' }),
        };
      });

      const available = await ollamaProvider.isOllamaAvailable({ fetchFn: mockFetch });
      expect(available).toBe(false);
    });

    it('should return false when network error or connection refused occurs', async () => {
      const mockFetch = jest.fn().mockImplementation(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
      });

      const available = await ollamaProvider.isOllamaAvailable({ fetchFn: mockFetch });
      expect(available).toBe(false);
    });
  });

  describe('3. chatWithOllama Payload Formatting & Response Parsing', () => {
    it('should format payload with system instruction, role mapping, and temperature', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'qwen3:4b',
            created_at: '2026-11-13T03:00:00Z',
            message: {
              role: 'assistant',
              content: 'Chào bạn, tôi là Qwen3:4b hỗ trợ học vụ đồ án.',
            },
            done: true,
          }),
        };
      });

      const messages = [
        { role: 'user', content: 'Chào bạn' },
        { role: 'model', text: 'Xin chào! Tôi có thể giúp gì?' },
        { role: 'user', text: 'Quy định nộp BM01?' },
      ];
      const systemInstruction = 'Bạn là Trợ lý Học vụ của Viện Công nghệ Số.';

      const result = await ollamaProvider.chatWithOllama({
        messages,
        systemInstruction,
        temperature: 0.3,
        fetchFn: mockFetch,
      });

      expect(capturedUrl).toBe('http://localhost:11434/api/chat');
      expect(capturedBody.model).toBe('qwen3:4b');
      expect(capturedBody.stream).toBe(false);
      expect(capturedBody.options).toEqual({ temperature: 0.3 });

      // Check messages formatting: system prepended, model -> assistant, text -> content
      expect(capturedBody.messages).toEqual([
        { role: 'system', content: 'Bạn là Trợ lý Học vụ của Viện Công nghệ Số.' },
        { role: 'user', content: 'Chào bạn' },
        { role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì?' },
        { role: 'user', content: 'Quy định nộp BM01?' },
      ]);

      // Verify return object
      expect(result).toEqual({
        reply: 'Chào bạn, tôi là Qwen3:4b hỗ trợ học vụ đồ án.',
        provider: 'ollama',
        model: 'qwen3:4b',
      });
    });

    it('should respect custom model and custom baseUrl', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'custom-model:latest',
            message: { role: 'assistant', content: 'OK' },
          }),
        };
      });

      const result = await ollamaProvider.chatWithOllama({
        messages: [{ role: 'user', content: 'Ping' }],
        baseUrl: 'http://custom-host:8000',
        model: 'custom-model:latest',
        fetchFn: mockFetch,
      });

      expect(capturedUrl).toBe('http://custom-host:8000/api/chat');
      expect(capturedBody.model).toBe('custom-model:latest');
      expect(result.reply).toBe('OK');
      expect(result.model).toBe('custom-model:latest');
    });

    it('should throw an informative error when Ollama responds with error status', async () => {
      const mockFetch = jest.fn().mockImplementation(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: 'model "qwen3:4b" not found, try pulling it first' }),
      }));

      await expect(
        ollamaProvider.chatWithOllama({
          messages: [{ role: 'user', content: 'Test' }],
          fetchFn: mockFetch,
        })
      ).rejects.toThrow('model "qwen3:4b" not found');
    });
  });

  describe('4. generateEmbedding Vector Generation & Fallback', () => {
    it('should generate embeddings using /api/embed endpoint', async () => {
      let capturedUrl = '';
      let capturedBody = null;

      const mockEmbedding = [0.12, -0.34, 0.56, 0.78];
      const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'embeddinggemma-2:270m',
            embeddings: [mockEmbedding],
          }),
        };
      });

      const embedding = await ollamaProvider.generateEmbedding({
        text: 'Quy trình bảo vệ đồ án tốt nghiệp',
        fetchFn: mockFetch,
      });

      expect(capturedUrl).toBe('http://localhost:11434/api/embed');
      expect(capturedBody).toEqual({
        model: 'embeddinggemma-2:270m',
        input: 'Quy trình bảo vệ đồ án tốt nghiệp',
      });
      expect(embedding).toEqual(mockEmbedding);
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should fallback to legacy /api/embeddings endpoint when /api/embed returns 404', async () => {
      const requestedUrls = [];
      const mockEmbedding = [0.42, 0.24, -0.15];

      const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
        requestedUrls.push(url);
        if (url.endsWith('/api/embed')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: '404 page not found' }),
          };
        }
        if (url.endsWith('/api/embeddings')) {
          const body = JSON.parse(opts.body);
          expect(body.prompt).toBe('Kiểm tra fallback');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              embedding: mockEmbedding,
            }),
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const embedding = await ollamaProvider.generateEmbedding({
        text: 'Kiểm tra fallback',
        fetchFn: mockFetch,
      });

      expect(requestedUrls).toEqual([
        'http://localhost:11434/api/embed',
        'http://localhost:11434/api/embeddings',
      ]);
      expect(embedding).toEqual(mockEmbedding);
    });

    it('should throw Error when text input is missing or empty', async () => {
      await expect(
        ollamaProvider.generateEmbedding({ text: '' })
      ).rejects.toThrow('Embedding input text is required');

      await expect(
        ollamaProvider.generateEmbedding({ text: '   ' })
      ).rejects.toThrow('Embedding input text is required');
    });
  });

  describe('5. Timeout Handling', () => {
    it('should abort and throw a timeout error when request exceeds timeoutMs', async () => {
      const slowFetch = jest.fn().mockImplementation((_url, opts) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      await expect(
        ollamaProvider.chatWithOllama({
          messages: [{ role: 'user', content: 'Slow message' }],
          timeoutMs: 50,
          fetchFn: slowFetch,
        })
      ).rejects.toThrow(/timed out/i);
    });

    it('should abort embedding request when exceeding timeoutMs', async () => {
      const slowFetch = jest.fn().mockImplementation((_url, opts) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      await expect(
        ollamaProvider.generateEmbedding({
          text: 'Slow embedding',
          timeoutMs: 50,
          fetchFn: slowFetch,
        })
      ).rejects.toThrow(/timed out/i);
    });
  });

  describe('7. Reasoning (<think>) and User Query Tag Sanitization', () => {
    it('should strip <think> reasoning tokens cleanly', () => {
      const raw = '<think>User is asking about BM01</think>Bạn cần nộp BM01 trước hạn.';
      expect(ollamaProvider.stripThinking(raw)).toBe('Bạn cần nộp BM01 trước hạn.');
    });

    it('should strip echoed <user_query> blocks cleanly', () => {
      const raw = '<user_query>\ntôi là ai\n</user_query>\n\nXin chào thầy/cô, bạn là sinh viên Nguyễn Văn A.';
      expect(ollamaProvider.stripThinking(raw)).toBe('Xin chào thầy/cô, bạn là sinh viên Nguyễn Văn A.');
    });

    it('should handle unclosed or escaped user query tags', () => {
      const raw = '&lt;user_query&gt;Đề tài của em&lt;/user_query&gt;\nĐề tài của bạn là Hệ thống DACN.';
      expect(ollamaProvider.stripThinking(raw)).toBe('Đề tài của bạn là Hệ thống DACN.');
    });

    it('should strip markdown asterisks and convert asterisk bullets to hyphens', () => {
      const raw = 'Xin chào **bạn**!\n* Bước 1: **Nộp BM01**\n* Bước 2: *Tiến độ BM03*\n***Lưu ý:*** Thực hiện đúng hạn.';
      const cleaned = ollamaProvider.stripThinking(raw);
      expect(cleaned).not.toContain('*');
      expect(cleaned).toContain('Xin chào bạn!');
      expect(cleaned).toContain('- Bước 1: Nộp BM01');
      expect(cleaned).toContain('- Bước 2: Tiến độ BM03');
      expect(cleaned).toContain('Lưu ý: Thực hiện đúng hạn.');
    });

    it('should translate raw database status keywords to natural Vietnamese', () => {
      const raw = 'Học kỳ đang ở trạng thái ONGOING. Điểm bảo vệ của bạn là 8.5, trạng thái: PASSED. Bạn đã DEFENSE_READY.';
      const cleaned = ollamaProvider.stripThinking(raw);
      expect(cleaned).not.toContain('PASSED');
      expect(cleaned).not.toContain('ONGOING');
      expect(cleaned).not.toContain('DEFENSE_READY');
      expect(cleaned).toContain('đang diễn ra');
      expect(cleaned).toContain('hoàn tất');
      expect(cleaned).toContain('sẵn sàng bảo vệ');
    });
  });
});
