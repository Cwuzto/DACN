/**
 * Unit Tests for ragService (Task 3)
 * Tests chunkKnowledgeBase, filterChunksByRole, cosineSimilarity,
 * retrieveRelevantChunks, formatRagContext, index persistence and RBAC isolation.
 *
 * UTF-8 (no BOM)
 */

describe('ragService.js - Academic Knowledge RAG Engine', () => {
  let ragService;

  beforeEach(() => {
    jest.resetModules();
    ragService = require('../../src/services/ai/ragService');
  });

  describe('1. chunkKnowledgeBase()', () => {
    it('should split academic knowledge into well-structured semantic chunks', () => {
      const chunks = ragService.chunkKnowledgeBase();

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(15);

      for (const chunk of chunks) {
        expect(chunk).toHaveProperty('id');
        expect(typeof chunk.id).toBe('string');
        expect(chunk.id.trim().length).toBeGreaterThan(0);

        expect(chunk).toHaveProperty('title');
        expect(typeof chunk.title).toBe('string');
        expect(chunk.title.trim().length).toBeGreaterThan(0);

        expect(chunk).toHaveProperty('stage');
        expect(chunk.stage !== undefined && chunk.stage !== null).toBe(true);

        expect(chunk).toHaveProperty('roleScope');
        expect(['STUDENT', 'LECTURER', 'ADMIN']).toContain(chunk.roleScope);

        expect(chunk).toHaveProperty('text');
        expect(typeof chunk.text).toBe('string');
        expect(chunk.text.trim().length).toBeGreaterThan(50);
      }
    });

    it('should ensure all chunk IDs are unique', () => {
      const chunks = ragService.chunkKnowledgeBase();
      const ids = chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should cover all 6 stages of academic thesis workflow', () => {
      const chunks = ragService.chunkKnowledgeBase();
      const stages = chunks.map((c) => String(c.stage));

      expect(stages).toContain('1');
      expect(stages).toContain('2');
      expect(stages).toContain('3');
      expect(stages).toContain('4');
      expect(stages).toContain('5');
      expect(stages).toContain('6');
    });

    it('should cover key forms BM01, BM02, BM02-A, BM03, BM04', () => {
      const chunks = ragService.chunkKnowledgeBase();
      const combinedText = chunks.map((c) => `${c.title} ${c.text}`).join(' ');

      expect(combinedText).toContain('BM01');
      expect(combinedText).toContain('BM02');
      expect(combinedText).toContain('BM02-A');
      expect(combinedText).toContain('BM03');
      expect(combinedText).toContain('BM04');
    });

    it('should contain chunks for all three roleScopes: STUDENT, LECTURER, ADMIN', () => {
      const chunks = ragService.chunkKnowledgeBase();
      const studentChunks = chunks.filter((c) => c.roleScope === 'STUDENT');
      const lecturerChunks = chunks.filter((c) => c.roleScope === 'LECTURER');
      const adminChunks = chunks.filter((c) => c.roleScope === 'ADMIN');

      expect(studentChunks.length).toBeGreaterThan(0);
      expect(lecturerChunks.length).toBeGreaterThan(0);
      expect(adminChunks.length).toBeGreaterThan(0);
    });
  });

  describe('2. filterChunksByRole(chunks, userRole)', () => {
    let sampleChunks;

    beforeEach(() => {
      sampleChunks = [
        { id: 's1', roleScope: 'STUDENT', title: 'Student 1' },
        { id: 's2', roleScope: 'STUDENT', title: 'Student 2' },
        { id: 'l1', roleScope: 'LECTURER', title: 'Lecturer 1' },
        { id: 'l2', roleScope: 'LECTURER', title: 'Lecturer 2' },
        { id: 'a1', roleScope: 'ADMIN', title: 'Admin 1' },
        { id: 'a2', roleScope: 'ADMIN', title: 'Admin 2' },
      ];
    });

    it('should only return STUDENT chunks for role STUDENT', () => {
      const filtered = ragService.filterChunksByRole(sampleChunks, 'STUDENT');
      expect(filtered.map((c) => c.id)).toEqual(['s1', 's2']);
      expect(filtered.every((c) => c.roleScope === 'STUDENT')).toBe(true);
    });

    it('should return STUDENT and LECTURER chunks for role LECTURER', () => {
      const filtered = ragService.filterChunksByRole(sampleChunks, 'LECTURER');
      expect(filtered.map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2']);
      expect(filtered.some((c) => c.roleScope === 'ADMIN')).toBe(false);
    });

    it('should return all chunks (STUDENT, LECTURER, ADMIN) for role ADMIN', () => {
      const filtered = ragService.filterChunksByRole(sampleChunks, 'ADMIN');
      expect(filtered.map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2', 'a1', 'a2']);
    });

    it('should handle user object with role and permissionGroups', () => {
      const studentUser = { role: 'STUDENT' };
      const lecturerUser = { role: 'LECTURER' };
      const giaoVuUser = { role: 'LECTURER', permissionGroups: ['GIAO_VU'] };
      const oversightUser = { role: 'LECTURER', permissionGroups: ['PROJECT_OVERSIGHT_MANAGE'] };
      const vienTruongUser = { role: 'VIEN_TRUONG' };

      expect(ragService.filterChunksByRole(sampleChunks, studentUser).map((c) => c.id)).toEqual(['s1', 's2']);
      expect(ragService.filterChunksByRole(sampleChunks, lecturerUser).map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2']);
      expect(ragService.filterChunksByRole(sampleChunks, giaoVuUser).map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2', 'a1', 'a2']);
      expect(ragService.filterChunksByRole(sampleChunks, oversightUser).map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2', 'a1', 'a2']);
      expect(ragService.filterChunksByRole(sampleChunks, vienTruongUser).map((c) => c.id)).toEqual(['s1', 's2', 'l1', 'l2', 'a1', 'a2']);
    });

    it('should default to STUDENT scope for unknown or missing role (least privilege)', () => {
      expect(ragService.filterChunksByRole(sampleChunks, null).map((c) => c.id)).toEqual(['s1', 's2']);
      expect(ragService.filterChunksByRole(sampleChunks, undefined).map((c) => c.id)).toEqual(['s1', 's2']);
      expect(ragService.filterChunksByRole(sampleChunks, 'ANONYMOUS').map((c) => c.id)).toEqual(['s1', 's2']);
      expect(ragService.filterChunksByRole([], 'ADMIN')).toEqual([]);
    });
  });

  describe('3. cosineSimilarity(vecA, vecB)', () => {
    it('should return 1.0 for identical vectors', () => {
      const vecA = [0.2, 0.4, 0.6, 0.8];
      const vecB = [0.2, 0.4, 0.6, 0.8];
      expect(ragService.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      expect(ragService.cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 5);
    });

    it('should return -1.0 for opposite vectors', () => {
      const vecA = [1, 0];
      const vecB = [-1, 0];
      expect(ragService.cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 5);
    });

    it('should calculate accurate cosine similarity for general vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      // dot = 32, normA = sqrt(14), normB = sqrt(77) -> 32 / (sqrt(14)*sqrt(77)) = 32 / sqrt(1078) ≈ 0.97463
      expect(ragService.cosineSimilarity(vecA, vecB)).toBeCloseTo(0.97463, 4);
    });

    it('should handle edge cases safely and return 0.0 without throwing', () => {
      expect(ragService.cosineSimilarity([], [])).toBe(0);
      expect(ragService.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
      expect(ragService.cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      expect(ragService.cosineSimilarity(null, [1, 2])).toBe(0);
      expect(ragService.cosineSimilarity([1, 2], undefined)).toBe(0);
      expect(ragService.cosineSimilarity('invalid', [1, 2])).toBe(0);
    });
  });

  describe('4. retrieveRelevantChunks({ query, userRole, topK, minScore, embedFn, chunks })', () => {
    let mockChunks;
    let mockEmbedFn;

    beforeEach(() => {
      mockChunks = [
        {
          id: 's_bm02a',
          title: 'Cửa sổ đổi tên BM02-A',
          stage: 2,
          roleScope: 'STUDENT',
          text: 'Sinh viên có 7 ngày (168 giờ) để nộp đơn xin đổi tên đề tài BM02-A.',
          embedding: [1.0, 0.0, 0.0],
        },
        {
          id: 's_bm03',
          title: 'Tiến độ BM03',
          stage: 3,
          roleScope: 'STUDENT',
          text: 'Đánh giá tiến độ qua 2 Checkpoint. Không đạt sẽ dừng ngay lập tức.',
          embedding: [0.0, 1.0, 0.0],
        },
        {
          id: 'l_questions',
          title: 'Câu hỏi phản biện bí mật',
          stage: 5,
          roleScope: 'LECTURER',
          text: 'Bộ câu hỏi phản biện 3 cấp độ dành cho hội đồng chấm bảo vệ.',
          embedding: [0.6, 0.8, 0.0],
        },
        {
          id: 'a_sweep',
          title: '5 Sweep Jobs tự động',
          stage: 'SYSTEM',
          roleScope: 'ADMIN',
          text: 'Hệ thống chạy 5 background jobs quét định kỳ quá hạn SLA.',
          embedding: [0.2, 0.9, 0.0],
        },
      ];

      // Query embedding matches [1.0, 0.0, 0.0]
      mockEmbedFn = jest.fn().mockResolvedValue([1.0, 0.0, 0.0]);
    });

    it('should retrieve topK relevant chunks sorted by similarity descending', async () => {
      const results = await ragService.retrieveRelevantChunks({
        query: 'Làm sao để đổi tên đề tài BM02-A?',
        userRole: 'ADMIN',
        topK: 2,
        minScore: 0.5,
        embedFn: mockEmbedFn,
        chunks: mockChunks,
      });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('s_bm02a');
      expect(results[0].similarity).toBeCloseTo(1.0, 4);
      expect(results[1].id).toBe('l_questions');
      expect(results[1].similarity).toBeCloseTo(0.6, 2);
    });

    it('should enforce strict RBAC: STUDENT never receives LECTURER or ADMIN chunks even with high similarity', async () => {
      const results = await ragService.retrieveRelevantChunks({
        query: 'Câu hỏi phản biện bí mật và đổi tên',
        userRole: 'STUDENT',
        topK: 5,
        minScore: 0.1,
        embedFn: mockEmbedFn,
        chunks: mockChunks,
      });

      // Even though l_questions (0.6) and a_sweep (0.2) have scores >= 0.1,
      // a STUDENT must only receive student chunks
      expect(results.every((r) => r.roleScope === 'STUDENT')).toBe(true);
      expect(results.map((r) => r.id)).not.toContain('l_questions');
      expect(results.map((r) => r.id)).not.toContain('a_sweep');
    });

    it('should allow LECTURER to receive STUDENT and LECTURER chunks but not ADMIN', async () => {
      const results = await ragService.retrieveRelevantChunks({
        query: 'Đổi tên và câu hỏi phản biện',
        userRole: 'LECTURER',
        topK: 5,
        minScore: 0.1,
        embedFn: mockEmbedFn,
        chunks: mockChunks,
      });

      const ids = results.map((r) => r.id);
      expect(ids).toContain('s_bm02a');
      expect(ids).toContain('l_questions');
      expect(ids).not.toContain('a_sweep');
    });

    it('should filter out chunks below minScore', async () => {
      const results = await ragService.retrieveRelevantChunks({
        query: 'Test query',
        userRole: 'ADMIN',
        topK: 5,
        minScore: 0.5, // s_bm02a is 1.0, l_questions is 0.6, a_sweep is ~0.2, s_bm03 is 0.0
        embedFn: mockEmbedFn,
        chunks: mockChunks,
      });

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('s_bm02a');
      expect(results[1].id).toBe('l_questions');
    });

    it('should return empty array gracefully when embedFn fails', async () => {
      const failingEmbedFn = jest.fn().mockRejectedValue(new Error('Ollama service down'));

      const results = await ragService.retrieveRelevantChunks({
        query: 'Đổi tên đề tài',
        userRole: 'STUDENT',
        embedFn: failingEmbedFn,
        chunks: mockChunks,
      });

      expect(results).toEqual([]);
    });

    it('should return empty array if query is empty or whitespace', async () => {
      const results = await ragService.retrieveRelevantChunks({
        query: '   ',
        userRole: 'STUDENT',
        embedFn: mockEmbedFn,
        chunks: mockChunks,
      });

      expect(results).toEqual([]);
    });
  });

  describe('5. formatRagContext(chunks)', () => {
    it('should format chunks into clear Markdown RAG context header and sections', () => {
      const chunks = [
        {
          id: 's_bm01',
          title: 'Đề cương BM01',
          stage: 2,
          roleScope: 'STUDENT',
          text: 'Nội dung đề cương gồm 5 phần chính.',
        },
        {
          id: 's_bm02',
          title: 'Đơn đăng ký đề tài chính thức BM02',
          stage: 2,
          roleScope: 'STUDENT',
          text: 'Sau khi BM01 đạt, nộp đơn BM02.',
        },
      ];

      const formatted = ragService.formatRagContext(chunks);

      expect(formatted).toContain('=== CÁC ĐIỀU KHOẢN QUY CHẾ ĐƯỢC TRÍCH XUẤT (RAG CONTEXT) ===');
      expect(formatted).toContain('[Điều khoản 1: Đề cương BM01 (Giai đoạn 2 - Phân quyền STUDENT)]');
      expect(formatted).toContain('Nội dung đề cương gồm 5 phần chính.');
      expect(formatted).toContain('[Điều khoản 2: Đơn đăng ký đề tài chính thức BM02 (Giai đoạn 2 - Phân quyền STUDENT)]');
      expect(formatted).toContain('Sau khi BM01 đạt, nộp đơn BM02.');
    });

    it('should return empty string when chunks is null, undefined or empty', () => {
      expect(ragService.formatRagContext([])).toBe('');
      expect(ragService.formatRagContext(null)).toBe('');
      expect(ragService.formatRagContext(undefined)).toBe('');
    });
  });

  describe('6. loadPrecomputedIndex() and savePrecomputedIndex()', () => {
    const fs = require('fs');
    const path = require('path');
    const testIndexPath = path.join(__dirname, 'test_knowledge_index.json');

    afterEach(() => {
      if (fs.existsSync(testIndexPath)) {
        fs.unlinkSync(testIndexPath);
      }
    });

    it('should save and load precomputed index accurately', () => {
      const sampleData = [
        {
          id: 'chunk_test_1',
          title: 'Test Title',
          stage: 1,
          roleScope: 'STUDENT',
          text: 'Sample chunk test content.',
          embedding: [0.1, 0.2, 0.3],
        },
      ];

      ragService.savePrecomputedIndex(sampleData, testIndexPath);
      expect(fs.existsSync(testIndexPath)).toBe(true);

      const loaded = ragService.loadPrecomputedIndex(testIndexPath);
      expect(loaded).toEqual(sampleData);
    });

    it('should return null when file does not exist', () => {
      const nonExistentPath = path.join(__dirname, 'non_existent_rag_index.json');
      const loaded = ragService.loadPrecomputedIndex(nonExistentPath);
      expect(loaded).toBeNull();
    });
  });
});
