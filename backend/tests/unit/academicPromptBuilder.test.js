const { buildAcademicSystemInstruction } = require('../../src/services/ai/academicPromptBuilder');
const { studentKnowledge } = require('../../src/services/ai/knowledge/studentKnowledge');
const { lecturerKnowledge } = require('../../src/services/ai/knowledge/lecturerKnowledge');
const { adminKnowledge } = require('../../src/services/ai/knowledge/adminKnowledge');

describe('AcademicPromptBuilder & Knowledge Base Isolation', () => {
  describe('Knowledge Modules Content Verification', () => {
    test('studentKnowledge should cover all 6 stages, FAQ and Single Registration invariants', () => {
      expect(typeof studentKnowledge).toBe('string');
      expect(studentKnowledge.length).toBeGreaterThan(1000);
      expect(studentKnowledge).toContain('Giai đoạn 1');
      expect(studentKnowledge).toContain('Giai đoạn 2');
      expect(studentKnowledge).toContain('Giai đoạn 3');
      expect(studentKnowledge).toContain('Giai đoạn 4');
      expect(studentKnowledge).toContain('Giai đoạn 5');
      expect(studentKnowledge).toContain('Giai đoạn 6');
      expect(studentKnowledge).toContain('maxStudents = 1');
      expect(studentKnowledge).toContain('BM01');
      expect(studentKnowledge).toContain('BM02');
      expect(studentKnowledge).toContain('BM02-A');
      expect(studentKnowledge).toContain('BM03');
      expect(studentKnowledge).toContain('BM04');
      expect(studentKnowledge).toContain('TERMINATED_FAILED_PROGRESS');
      expect(studentKnowledge).toContain('DEFENSE_READY');
    });

    test('lecturerKnowledge should include 4-criteria BM04 rubrics, stop procedures and defense question guide', () => {
      expect(typeof lecturerKnowledge).toBe('string');
      expect(lecturerKnowledge.length).toBeGreaterThan(1000);
      expect(lecturerKnowledge).toContain('Hình thức BCTN (0-2 điểm)');
      expect(lecturerKnowledge).toContain('Nội dung nghiên cứu và giải pháp khoa học (0-4 điểm)');
      expect(lecturerKnowledge).toContain('Tính ứng dụng và triển vọng phát triển (0-2 điểm)');
      expect(lecturerKnowledge).toContain('Thái độ làm việc, tính chủ động và hoàn thành nhiệm vụ (0-2 điểm)');
      expect(lecturerKnowledge).toContain('PROPOSE_STOP');
      expect(lecturerKnowledge).toContain('ALLOW_DEFENSE');
      expect(lecturerKnowledge).toContain('DO_NOT_ALLOW_DEFENSE');
      expect(lecturerKnowledge).toContain('FOUNDATION');
      expect(lecturerKnowledge).toContain('TECHNICAL_CHALLENGE');
      expect(lecturerKnowledge).toContain('FUTURE_EXPANSION');
    });

    test('adminKnowledge should include decisions, adjustments appendix, SLA rules and sweep jobs', () => {
      expect(typeof adminKnowledge).toBe('string');
      expect(adminKnowledge.length).toBeGreaterThan(1000);
      expect(adminKnowledge).toContain('decisionNumber');
      expect(adminKnowledge).toContain('decisionDate');
      expect(adminKnowledge).toContain('TitleAdjustmentAppendix');
      expect(adminKnowledge).toContain('bm02ToBm04SweepService');
      expect(adminKnowledge).toContain('ACKNOWLEDGEMENT_TIMEOUT');
      expect(adminKnowledge).toContain('SYSTEM_TIMEOUT');
      expect(adminKnowledge).toContain('168 giờ');
      expect(adminKnowledge).toContain('72 giờ');
    });
  });

  describe('buildAcademicSystemInstruction Role-Based Access Control', () => {
    test('Role STUDENT: receives only studentKnowledge with strict security guardrails, without lecturer or admin secrets', () => {
      const studentUser = { id: 101, role: 'STUDENT', fullName: 'Nguyễn Văn A' };
      const result = buildAcademicSystemInstruction(studentUser);

      expect(result).toHaveProperty('systemInstruction');
      expect(result.permittedRole).toBe('STUDENT');
      expect(result.knowledgeTier).toBe('STUDENT');

      const { systemInstruction } = result;

      // Must contain student content
      expect(systemInstruction).toContain('Giai đoạn 1');
      expect(systemInstruction).toContain('maxStudents = 1');
      expect(systemInstruction).toContain('TERMINATED_FAILED_PROGRESS');

      // Must contain strict guardrails
      expect(systemInstruction).toContain('NGUYÊN TẮC BẢO MẬT TUYỆT ĐỐI');
      expect(systemInstruction).toContain('STRICT GUARDRAILS');
      expect(systemInstruction).toContain('TỪ CHỐI LỊCH SỰ');

      // Must NOT contain sensitive faculty or admin rubrics
      expect(systemInstruction).not.toContain('Bảng điểm chi tiết 4 tiêu chí chuẩn đầu ra BM04: 1) Hình thức BCTN (0-2 điểm)');
      expect(systemInstruction).not.toContain('TECHNICAL_CHALLENGE');
      expect(systemInstruction).not.toContain('FUTURE_EXPANSION');
      expect(systemInstruction).not.toContain('TitleAdjustmentAppendix');
      expect(systemInstruction).not.toContain('bm02ToBm04SweepService');
      expect(systemInstruction).not.toContain('ACKNOWLEDGEMENT_TIMEOUT');
    });

    test('Role LECTURER: receives studentKnowledge + lecturerKnowledge, without adminKnowledge', () => {
      const lecturerUser = { id: 202, role: 'LECTURER', fullName: 'TS. Trần Thị B' };
      const result = buildAcademicSystemInstruction(lecturerUser);

      expect(result.permittedRole).toBe('LECTURER');
      expect(result.knowledgeTier).toBe('FACULTY');

      const { systemInstruction } = result;

      // Contains both student and lecturer knowledge
      expect(systemInstruction).toContain('Giai đoạn 1');
      expect(systemInstruction).toContain('Hình thức BCTN (0-2 điểm)');
      expect(systemInstruction).toContain('TECHNICAL_CHALLENGE');
      expect(systemInstruction).toContain('PROPOSE_STOP');
      expect(systemInstruction).toContain('ALLOW_DEFENSE');

      // Must NOT contain admin secrets
      expect(systemInstruction).not.toContain('TitleAdjustmentAppendix');
      expect(systemInstruction).not.toContain('bm02ToBm04SweepService');
      expect(systemInstruction).not.toContain('ACKNOWLEDGEMENT_TIMEOUT');
      expect(systemInstruction).not.toContain('SYSTEM_TIMEOUT');
    });

    test('Role ADMIN: receives all 3 tiers of knowledge', () => {
      const adminUser = { id: 1, role: 'ADMIN', fullName: 'Quản trị viên Viện' };
      const result = buildAcademicSystemInstruction(adminUser);

      expect(result.permittedRole).toBe('ADMIN');
      expect(result.knowledgeTier).toBe('FULL');

      const { systemInstruction } = result;

      // Contains all 3 tiers
      expect(systemInstruction).toContain('Giai đoạn 1');
      expect(systemInstruction).toContain('Hình thức BCTN (0-2 điểm)');
      expect(systemInstruction).toContain('TECHNICAL_CHALLENGE');
      expect(systemInstruction).toContain('TitleAdjustmentAppendix');
      expect(systemInstruction).toContain('bm02ToBm04SweepService');
      expect(systemInstruction).toContain('168 giờ');
    });

    test('Role LECTURER with GIAO_VU permission group: upgraded to full admin tier', () => {
      const academicAffairsUser = {
        id: 303,
        role: 'LECTURER',
        fullName: 'ThS. Lê Giáo Vụ',
        permissionGroups: ['GIAO_VU'],
      };
      const result = buildAcademicSystemInstruction(academicAffairsUser);

      expect(result.permittedRole).toBe('ADMIN');
      expect(result.knowledgeTier).toBe('FULL');

      const { systemInstruction } = result;
      expect(systemInstruction).toContain('Giai đoạn 1');
      expect(systemInstruction).toContain('Hình thức BCTN (0-2 điểm)');
      expect(systemInstruction).toContain('TitleAdjustmentAppendix');
      expect(systemInstruction).toContain('bm02ToBm04SweepService');
    });

    test('Role LECTURER with PROJECT_OVERSIGHT_MANAGE permission group: upgraded to full admin tier', () => {
      const oversightUser = {
        id: 404,
        role: 'LECTURER',
        fullName: 'TS. Ban Điều Hành',
        permissionGroups: ['PROJECT_OVERSIGHT_MANAGE'],
      };
      const result = buildAcademicSystemInstruction(oversightUser);

      expect(result.permittedRole).toBe('ADMIN');
      expect(result.knowledgeTier).toBe('FULL');

      const { systemInstruction } = result;
      expect(systemInstruction).toContain('TitleAdjustmentAppendix');
    });

    test('Fallback / Empty user: defaults safely to STUDENT tier', () => {
      const result = buildAcademicSystemInstruction(null);
      expect(result.permittedRole).toBe('STUDENT');
      expect(result.knowledgeTier).toBe('STUDENT');
      expect(result.systemInstruction).toContain('STRICT GUARDRAILS');
    });
  });
});
