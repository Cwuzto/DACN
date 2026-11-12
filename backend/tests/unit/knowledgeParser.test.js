/**
 * Unit Tests for knowledgeParser.js
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án Tốt nghiệp
 *
 * UTF-8 (no BOM)
 */

const path = require('path');
const {
  parseMetadataComment,
  parseMarkdownChunks,
  getRoleFromFilename,
  loadChunksFromDocs,
  loadKnowledgeTextByRole,
  clearCache,
  DOCS_DIR,
} = require('../../src/services/ai/knowledge/knowledgeParser');

describe('knowledgeParser', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('parseMetadataComment()', () => {
    it('should parse double-quoted key-value pairs', () => {
      const line = '<!-- chunk: id="student_core_rules" stage="1" role="STUDENT" -->';
      const meta = parseMetadataComment(line);
      expect(meta).toEqual({
        id: 'student_core_rules',
        stage: '1',
        role: 'STUDENT',
      });
    });

    it('should parse single-quoted key-value pairs', () => {
      const line = "<!-- metadata: id='lecturer_bm01' stage='2' role='LECTURER' -->";
      const meta = parseMetadataComment(line);
      expect(meta).toEqual({
        id: 'lecturer_bm01',
        stage: '2',
        role: 'LECTURER',
      });
    });

    it('should return empty object for empty or invalid line', () => {
      expect(parseMetadataComment('')).toEqual({});
      expect(parseMetadataComment(null)).toEqual({});
      expect(parseMetadataComment('<!-- nothing here -->')).toEqual({});
    });
  });

  describe('parseMarkdownChunks()', () => {
    it('should parse sections delimited by level 2 headings', () => {
      const md = `
# Document Title

## Section One
<!-- chunk: id="chunk_1" stage="1" role="STUDENT" -->
This is the content of section one.
Multi-line content here.

## Section Two
<!-- chunk: id="chunk_2" stage="2" role="LECTURER" -->
Content of section two.
`;
      const chunks = parseMarkdownChunks(md);
      expect(chunks).toHaveLength(2);

      expect(chunks[0].id).toBe('chunk_1');
      expect(chunks[0].title).toBe('Section One');
      expect(chunks[0].stage).toBe(1);
      expect(chunks[0].roleScope).toBe('STUDENT');
      expect(chunks[0].text).toContain('This is the content of section one.');

      expect(chunks[1].id).toBe('chunk_2');
      expect(chunks[1].title).toBe('Section Two');
      expect(chunks[1].stage).toBe(2);
      expect(chunks[1].roleScope).toBe('LECTURER');
      expect(chunks[1].text).toBe('Content of section two.');
    });

    it('should generate fallback id when metadata is absent', () => {
      const md = `
## Quy định cốt lõi
Nội dung quy định tại đây.
`;
      const chunks = parseMarkdownChunks(md, 'ADMIN');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].id).toBe('quy_dinh_cot_loi');
      expect(chunks[0].stage).toBe(1);
      expect(chunks[0].roleScope).toBe('ADMIN');
      expect(chunks[0].text).toBe('Nội dung quy định tại đây.');
    });

    it('should return empty array for empty markdown', () => {
      expect(parseMarkdownChunks('')).toEqual([]);
      expect(parseMarkdownChunks(null)).toEqual([]);
    });
  });

  describe('getRoleFromFilename()', () => {
    it('should correctly infer role from filename', () => {
      expect(getRoleFromFilename('student_regulations.md')).toBe('STUDENT');
      expect(getRoleFromFilename('lecturer_regulations.md')).toBe('LECTURER');
      expect(getRoleFromFilename('admin_regulations.md')).toBe('ADMIN');
      expect(getRoleFromFilename('other.md')).toBe('STUDENT');
    });
  });

  describe('loadChunksFromDocs()', () => {
    it('should load all 19 chunks from the docs directory in consistent order', () => {
      const chunks = loadChunksFromDocs(DOCS_DIR);
      expect(chunks.length).toBe(19);

      const studentChunks = chunks.filter((c) => c.roleScope === 'STUDENT');
      const lecturerChunks = chunks.filter((c) => c.roleScope === 'LECTURER');
      const adminChunks = chunks.filter((c) => c.roleScope === 'ADMIN');

      expect(studentChunks.length).toBe(10);
      expect(lecturerChunks.length).toBe(5);
      expect(adminChunks.length).toBe(4);

      // Verify unique IDs
      const ids = chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify all chunks have non-empty text
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeGreaterThan(50);
        expect(chunk.title.length).toBeGreaterThan(0);
      }
    });

    it('should use in-memory cache on subsequent calls', () => {
      const first = loadChunksFromDocs(DOCS_DIR);
      const second = loadChunksFromDocs(DOCS_DIR);
      expect(first).toBe(second); // same reference
    });
  });

  describe('loadKnowledgeTextByRole()', () => {
    it('should load full markdown text for each role', () => {
      const studentText = loadKnowledgeTextByRole('STUDENT');
      expect(studentText).toContain('Mô hình đăng ký đơn lẻ');
      expect(studentText).toContain('maxStudents = 1');
      expect(studentText).toContain('Giai đoạn 1');
      expect(studentText).toContain('Giai đoạn 6');

      const lecturerText = loadKnowledgeTextByRole('LECTURER');
      expect(lecturerText).toContain('Khung thẩm định 5 chiều logic');
      expect(lecturerText).toContain('BM04');

      const adminText = loadKnowledgeTextByRole('ADMIN');
      expect(adminText).toContain('TitleAdjustmentAppendix');
      expect(adminText).toContain('5 Sweep Jobs');
    });
  });
});
