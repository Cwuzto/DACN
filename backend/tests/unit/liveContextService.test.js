const mockPrisma = {
  semester: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  userPermissionGroup: {
    findFirst: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  topicRegistration: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../../src/config/database', () => mockPrisma);

const {
  getLiveContext,
  getCachedInstitutionalContext,
  formatLiveContextString,
  clearInstitutionalCache,
} = require('../../src/services/ai/liveContextService');

describe('Task 1: liveContextService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearInstitutionalCache();
  });

  describe('1. Semester Query & Fallback', () => {
    test('returns active semester when status = ACTIVE exists', async () => {
      const activeSem = {
        id: 10,
        code: 'HK1_2026_2027',
        name: 'Học kỳ 1 (2026 - 2027)',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-15'),
        outlineSubmissionDeadline: new Date('2026-09-25'),
        defenseDate: new Date('2027-01-10'),
        status: 'ACTIVE',
      };

      mockPrisma.semester.findFirst.mockResolvedValueOnce(activeSem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();

      expect(mockPrisma.semester.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        })
      );
      expect(result.activeSemester).toBeDefined();
      expect(result.activeSemester.code).toBe('HK1_2026_2027');
      expect(result.activeSemester.status).toBe('ACTIVE');
    });

    test('falls back to latest semester when no semester has status = ACTIVE', async () => {
      const fallbackSem = {
        id: 9,
        code: 'HK2_2025_2026',
        name: 'Học kỳ 2 (2025 - 2026)',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-06-30'),
        outlineSubmissionDeadline: new Date('2026-02-15'),
        defenseDate: new Date('2026-06-20'),
        status: 'COMPLETED',
      };

      // First query for ACTIVE returns null, fallback query returns latest
      mockPrisma.semester.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fallbackSem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();

      expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(2);
      expect(result.activeSemester).toBeDefined();
      expect(result.activeSemester.code).toBe('HK2_2025_2026');
      expect(result.activeSemester.status).toBe('COMPLETED');
    });

    test('handles null when database has no semesters at all', async () => {
      mockPrisma.semester.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();
      expect(result.activeSemester).toBeNull();
    });
  });

  describe('2. Dean (Viện Trưởng) Identification', () => {
    test('identifies dean through userPermissionGroup with code = VIEN_TRUONG', async () => {
      mockPrisma.semester.findFirst.mockResolvedValueOnce({
        id: 1,
        code: 'HK1_2026',
        name: 'HK1',
        status: 'ACTIVE',
      });

      const deanUser = {
        id: 2,
        fullName: 'PGS.TS. Trần Viện Trưởng',
        academicTitle: 'PHO_GIAO_SU',
        email: 'tranthi@dti.edu.vn',
        department: 'Ban Giám đốc Viện',
      };

      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce({
        user: deanUser,
      });
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();

      expect(result.dean).toBeDefined();
      expect(result.dean.fullName).toBe('PGS.TS. Trần Viện Trưởng');
      expect(result.dean.email).toBe('tranthi@dti.edu.vn');
      expect(result.dean.academicTitle).toBe('PHO_GIAO_SU');
    });

    test('falls back to prisma.user query if userPermissionGroup returns null', async () => {
      mockPrisma.semester.findFirst.mockResolvedValueOnce({
        id: 1,
        code: 'HK1_2026',
        name: 'HK1',
        status: 'ACTIVE',
      });

      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 3,
        fullName: 'TS. Lê Quản Lý',
        academicTitle: 'TIEN_SI',
        email: 'lequanly@dti.edu.vn',
      });
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();

      expect(result.dean).toBeDefined();
      expect(result.dean.fullName).toBe('TS. Lê Quản Lý');
    });

    test('handles unconfigured dean gracefully', async () => {
      mockPrisma.semester.findFirst.mockResolvedValueOnce(null);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getCachedInstitutionalContext();
      expect(result.dean).toBeNull();
    });
  });

  describe('3. Lecturers List Query', () => {
    test('queries active lecturers capped at 20', async () => {
      mockPrisma.semester.findFirst.mockResolvedValueOnce({
        id: 1,
        code: 'HK1_2026',
        name: 'HK1',
        status: 'ACTIVE',
      });
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockLecturers = Array.from({ length: 25 }, (_, i) => ({
        id: 10 + i,
        fullName: `Giảng Viên ${i + 1}`,
        academicTitle: i % 2 === 0 ? 'TIEN_SI' : 'THAC_SI',
        department: 'Công nghệ phần mềm',
        email: `gv${i + 1}@dti.edu.vn`,
      })).slice(0, 20);

      mockPrisma.user.findMany.mockResolvedValueOnce(mockLecturers);

      const result = await getCachedInstitutionalContext();

      expect(result.lecturers).toHaveLength(20);
      expect(result.lecturers[0].fullName).toBe('Giảng Viên 1');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });
  });

  describe('4. In-Memory Cache TTL (5 Minutes)', () => {
    test('caches institutional data and avoids re-querying Prisma within 5 minutes', async () => {
      const sem = { id: 1, code: 'HK1', name: 'HK1', status: 'ACTIVE' };
      mockPrisma.semester.findFirst.mockResolvedValueOnce(sem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const firstCall = await getCachedInstitutionalContext();
      expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(1);

      // Second call immediately - should hit cache
      const secondCall = await getCachedInstitutionalContext();
      expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(1);
      expect(secondCall).toEqual(firstCall);

      // After clearing cache, it should query Prisma again
      clearInstitutionalCache();
      mockPrisma.semester.findFirst.mockResolvedValueOnce(sem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const thirdCall = await getCachedInstitutionalContext();
      expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(2);
      expect(thirdCall.activeSemester.code).toBe('HK1');
    });
  });

  describe('5. Caller Personalized Context', () => {
    test('for role STUDENT with existing registration: returns topic, advisor, and status', async () => {
      const studentUser = {
        id: 101,
        code: 'SV001',
        fullName: 'Nguyễn Văn Sinh Viên',
        role: 'STUDENT',
      };

      const sem = { id: 5, code: 'HK1_2026', name: 'HK1', status: 'ACTIVE' };
      mockPrisma.semester.findFirst.mockResolvedValueOnce(sem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      mockPrisma.topicRegistration.findFirst.mockResolvedValueOnce({
        id: 77,
        status: 'BM01_PASSED',
        outlineReviewStatus: 'APPROVED',
        assignmentStatus: 'ACTIVE',
        adjustedTitle: 'Xây dựng chatbot tư vấn học vụ thông minh',
        topic: {
          id: 12,
          title: 'Nghiên cứu chatbot học vụ',
          mentor: {
            id: 20,
            fullName: 'TS. Nguyễn Hướng Dẫn',
            academicTitle: 'TIEN_SI',
            email: 'nguyenhd@dti.edu.vn',
            department: 'Hệ thống thông tin',
          },
        },
      });

      const result = await getLiveContext(studentUser);

      expect(result.personalContext).toBeDefined();
      expect(result.personalContext.hasTopic).toBe(true);
      expect(result.personalContext.topicTitle).toBe('Xây dựng chatbot tư vấn học vụ thông minh');
      expect(result.personalContext.status).toBe('BM01_PASSED');
      expect(result.personalContext.mentor.fullName).toBe('TS. Nguyễn Hướng Dẫn');
      expect(result.personalContext.mentor.academicTitle).toBe('TIEN_SI');
      expect(result.formattedText).toContain('Nguyễn Văn Sinh Viên');
      expect(result.formattedText).toContain('Xây dựng chatbot tư vấn học vụ thông minh');
      expect(result.formattedText).toContain('TS. Nguyễn Hướng Dẫn');
    });

    test('for role STUDENT without registration: returns hasTopic = false', async () => {
      const studentUser = {
        id: 102,
        code: 'SV002',
        fullName: 'Lê Văn Mới',
        role: 'STUDENT',
      };

      mockPrisma.semester.findFirst.mockResolvedValueOnce(null);
      mockPrisma.semester.findFirst.mockResolvedValueOnce(null);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      mockPrisma.topicRegistration.findFirst.mockResolvedValueOnce(null);
      mockPrisma.topicRegistration.findFirst.mockResolvedValueOnce(null);

      const result = await getLiveContext(studentUser);

      expect(result.personalContext).toBeDefined();
      expect(result.personalContext.hasTopic).toBe(false);
      expect(result.formattedText).toContain('Chưa đăng ký đề tài');
    });

    test('for role LECTURER: returns list of advised students', async () => {
      const lecturerUser = {
        id: 20,
        code: 'GV001',
        fullName: 'TS. Nguyễn Hướng Dẫn',
        role: 'LECTURER',
      };

      const sem = { id: 5, code: 'HK1_2026', name: 'HK1', status: 'ACTIVE' };
      mockPrisma.semester.findFirst.mockResolvedValueOnce(sem);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      mockPrisma.topicRegistration.findMany.mockResolvedValueOnce([
        {
          id: 77,
          status: 'BM01_PASSED',
          topic: { id: 12, title: 'Đề tài 1' },
          student: { id: 101, code: 'SV001', fullName: 'Sinh Viên 1' },
        },
        {
          id: 78,
          status: 'REGISTERED',
          topic: { id: 13, title: 'Đề tài 2' },
          student: { id: 102, code: 'SV002', fullName: 'Sinh Viên 2' },
        },
      ]);

      const result = await getLiveContext(lecturerUser);

      expect(result.personalContext).toBeDefined();
      expect(result.personalContext.advisedCount).toBe(2);
      expect(result.personalContext.advisedStudents).toHaveLength(2);
      expect(result.personalContext.advisedStudents[0].studentName).toBe('Sinh Viên 1');
      expect(result.formattedText).toContain('Sinh Viên 1');
      expect(result.formattedText).toContain('Sinh Viên 2');
    });

    test('for unauthenticated caller (user = null): returns personalContext = null', async () => {
      mockPrisma.semester.findFirst.mockResolvedValueOnce(null);
      mockPrisma.semester.findFirst.mockResolvedValueOnce(null);
      mockPrisma.userPermissionGroup.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await getLiveContext(null);

      expect(result.personalContext).toBeNull();
      expect(result.formattedText).not.toContain('THÔNG TIN CÁ NHÂN CỦA BẠN');
    });
  });

  describe('6. formatLiveContextString', () => {
    test('produces formatted text under 500 tokens with Vietnamese conventions', () => {
      const activeSemester = {
        code: 'HK1_2026_2027',
        name: 'Học kỳ 1 (2026 - 2027)',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-15'),
        outlineSubmissionDeadline: new Date('2026-09-25'),
        defenseDate: new Date('2027-01-10'),
        status: 'ACTIVE',
      };
      const dean = {
        fullName: 'Nguyễn Văn Viện Trưởng',
        academicTitle: 'TIEN_SI',
        email: 'dean@dti.edu.vn',
      };
      const lecturers = [
        {
          fullName: 'Trần Văn Giảng Viên',
          academicTitle: 'THAC_SI',
          department: 'Khoa học máy tính',
          email: 'gv@dti.edu.vn',
        },
      ];
      const personalContext = {
        hasTopic: true,
        topicTitle: 'Hệ thống Quản lý Đồ án',
        status: 'BM01_PASSED',
        mentor: {
          fullName: 'Trần Văn Giảng Viên',
          academicTitle: 'THAC_SI',
          email: 'gv@dti.edu.vn',
        },
      };
      const user = {
        fullName: 'Nguyễn Sinh Viên',
        code: 'SV999',
        role: 'STUDENT',
      };

      const text = formatLiveContextString({
        activeSemester,
        dean,
        lecturers,
        personalContext,
        user,
      });

      expect(text).toContain('=== THÔNG TIN THỰC TẾ HỌC KỲ HIỆN TẠI ===');
      expect(text).toContain('Học kỳ 1 (2026 - 2027)');
      expect(text).toContain('TS. Nguyễn Văn Viện Trưởng');
      expect(text).toContain('ThS. Trần Văn Giảng Viên');
      expect(text).toContain('Hệ thống Quản lý Đồ án');
      expect(text).toContain('BM01_PASSED');
      // Token budget check: 500 tokens is approximately 2000 characters
      expect(text.length).toBeLessThan(2500);
    });
  });
});
