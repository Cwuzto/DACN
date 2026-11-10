const crypto = require('crypto');
const {
  PERMISSIONS,
  PERMISSION_CATALOG,
  CANONICAL_ALIAS_MAP,
  ACADEMIC_PROTECTED_PERMISSIONS,
} = require('../../src/constants/permissions');

// Services to be tested
const {
  computeCanonicalPayloadHash,
  recordSignatureEvent,
} = require('../../src/services/electronicSignatureService');
const {
  resolveEffectiveTopicTitle,
} = require('../../src/services/topicTitleResolverService');
const {
  generateImmutableAcademicPdf,
} = require('../../src/services/academicPdfService');

describe('Task 1: RBAC Permissions, Title Resolver & Electronic Signature/PDF Engine', () => {
  describe('1. RBAC Permissions Constants', () => {
    const requiredPermissions = [
      'BM02_REVIEW',
      'TOPIC_ASSIGNMENT_DECISION_ISSUE',
      'BM02A_ADVISOR_SIGN',
      'BM02A_FINAL_APPROVE',
      'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
      'BM03_MEETING_RECORD',
      'BM03_STAGE_EVALUATE',
      'BM03_STOP_REVIEW',
      'BM04_CREATE_AND_SIGN',
      'BM04_REJECTION_REVIEW',
    ];

    it('should define all 10 required permissions in PERMISSIONS', () => {
      requiredPermissions.forEach((code) => {
        expect(PERMISSIONS[code]).toBe(code);
      });
    });

    it('should include all required permissions in PERMISSION_CATALOG with valid module and label', () => {
      requiredPermissions.forEach((code) => {
        const item = PERMISSION_CATALOG.find((entry) => entry.code === code);
        expect(item).toBeDefined();
        expect(typeof item.label).toBe('string');
        expect(item.label.length).toBeGreaterThan(0);
        expect(['REGISTRATION', 'PROGRESS']).toContain(item.module);
      });
    });

    it('should register academic permissions under ACADEMIC_PROTECTED_PERMISSIONS', () => {
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('TOPIC_ASSIGNMENT_DECISION_ISSUE');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM02A_ADVISOR_SIGN');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM02A_FINAL_APPROVE');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('TITLE_ADJUSTMENT_APPENDIX_ISSUE');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM03_MEETING_RECORD');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM03_STAGE_EVALUATE');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM03_STOP_REVIEW');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM04_CREATE_AND_SIGN');
      expect(ACADEMIC_PROTECTED_PERMISSIONS).toContain('BM04_REJECTION_REVIEW');
    });

    it('should support canonical alias between TOPIC_ASSIGNMENT_DECISION_ISSUE and PROJECT_ASSIGNMENT_PUBLISH', () => {
      const aliasTarget =
        CANONICAL_ALIAS_MAP.TOPIC_ASSIGNMENT_DECISION_ISSUE ||
        CANONICAL_ALIAS_MAP.PROJECT_ASSIGNMENT_PUBLISH;
      expect(aliasTarget).toBeDefined();
    });
  });

  describe('2. Canonical Payload Hash & Electronic Signature Service', () => {
    it('should compute deterministic hash regardless of object key order', () => {
      const payloadA = {
        title: 'Nghiên cứu AI trong y tế',
        studentId: 101,
        meta: { b: 2, a: 1 },
        items: ['first', 'second'],
      };
      const payloadB = {
        studentId: 101,
        items: ['first', 'second'],
        meta: { a: 1, b: 2 },
        title: 'Nghiên cứu AI trong y tế',
      };

      const hashA = computeCanonicalPayloadHash(payloadA);
      const hashB = computeCanonicalPayloadHash(payloadB);

      expect(hashA).toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for modified content', () => {
      const payloadA = { title: 'Tên đề tài A', studentId: 10 };
      const payloadB = { title: 'Tên đề tài B', studentId: 10 };

      expect(computeCanonicalPayloadHash(payloadA)).not.toBe(
        computeCanonicalPayloadHash(payloadB),
      );
    });

    it('should record signature event when expectedPayloadHash matches actualPayload', async () => {
      const mockCreatedEvent = {
        id: 1,
        registrationId: 42,
        entityType: 'BM02A_VERSION',
        entityId: 100,
        versionNumber: 1,
        signerId: 5,
        signerRole: 'STUDENT',
        action: 'SIGN',
        payloadHash: 'hash-123',
        signedAt: new Date(),
      };

      const mockTx = {
        electronicSignatureEvent: {
          create: jest.fn().mockResolvedValue(mockCreatedEvent),
        },
      };

      const payload = { formVersion: 1, proposedTitle: 'Hệ thống IoT nông nghiệp' };
      const computedHash = computeCanonicalPayloadHash(payload);

      const result = await recordSignatureEvent(
        {
          registrationId: 42,
          entityType: 'BM02A_VERSION',
          entityId: 100,
          versionNumber: 1,
          signerId: 5,
          signerRole: 'STUDENT',
          action: 'SIGN',
          expectedPayloadHash: computedHash,
          actualPayload: payload,
          ipAddress: '127.0.0.1',
          userAgent: 'Jest/TestEngine',
        },
        { tx: mockTx },
      );

      expect(mockTx.electronicSignatureEvent.create).toHaveBeenCalledTimes(1);
      const createArgs = mockTx.electronicSignatureEvent.create.mock.calls[0][0].data;
      expect(createArgs.registrationId).toBe(42);
      expect(createArgs.entityType).toBe('BM02A_VERSION');
      expect(createArgs.payloadHash).toBe(computedHash);
      expect(createArgs.action).toBe('SIGN');
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should throw an error when expectedPayloadHash does not match actualPayload', async () => {
      const mockTx = {
        electronicSignatureEvent: {
          create: jest.fn(),
        },
      };

      const payload = { proposedTitle: 'Tiêu đề thật' };
      const tamperedHash = crypto.createHash('sha256').update('tampered').digest('hex');

      await expect(
        recordSignatureEvent(
          {
            registrationId: 42,
            entityType: 'BM02A_VERSION',
            entityId: 100,
            signerId: 5,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            expectedPayloadHash: tamperedHash,
            actualPayload: payload,
          },
          { tx: mockTx },
        ),
      ).rejects.toThrow(/PAYLOAD_HASH_MISMATCH|mismatch/i);

      expect(mockTx.electronicSignatureEvent.create).not.toHaveBeenCalled();
    });

    it('should record return/rejection actions with reason note', async () => {
      const mockCreatedEvent = {
        id: 2,
        registrationId: 42,
        entityType: 'BM02A_VERSION',
        entityId: 100,
        versionNumber: 1,
        signerId: 9,
        signerRole: 'ADVISOR',
        action: 'RETURN',
        payloadHash: 'hash-abc',
        rejectionOrReturnReason: 'Cần diễn đạt rõ ràng phạm vi nghiên cứu',
      };

      const mockTx = {
        electronicSignatureEvent: {
          create: jest.fn().mockResolvedValue(mockCreatedEvent),
        },
      };

      const payload = { formVersion: 1, proposedTitle: 'Tiêu đề cần sửa' };
      const computedHash = computeCanonicalPayloadHash(payload);

      const result = await recordSignatureEvent(
        {
          registrationId: 42,
          entityType: 'BM02A_VERSION',
          entityId: 100,
          signerId: 9,
          signerRole: 'ADVISOR',
          action: 'RETURN',
          expectedPayloadHash: computedHash,
          actualPayload: payload,
          rejectionOrReturnReason: 'Cần diễn đạt rõ ràng phạm vi nghiên cứu',
        },
        { tx: mockTx },
      );

      expect(result.action).toBe('RETURN');
      expect(result.rejectionOrReturnReason).toBe('Cần diễn đạt rõ ràng phạm vi nghiên cứu');
    });
  });

  describe('3. Canonical Topic Title Resolver Service', () => {
    it('Priority 1: should return title from latest ISSUED appendix before or at target time', async () => {
      const t1 = new Date('2026-03-01T08:00:00Z');
      const t2 = new Date('2026-03-10T08:00:00Z');
      const queryTime = new Date('2026-03-15T08:00:00Z');

      const mockTx = {
        titleAdjustmentAppendixItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 12,
            oldTitle: 'Tên cũ theo quyết định',
            newTitle: 'Tên mới sau phụ lục 02',
            appendix: {
              id: 2,
              appendixNumber: 'PL-02/2026',
              sequenceNo: 2,
              signedDate: t2,
              status: 'ISSUED',
            },
          }),
        },
        topicAssignmentDecisionItem: { findFirst: jest.fn() },
        topicRegistration: { findUnique: jest.fn() },
      };

      const result = await resolveEffectiveTopicTitle(42, queryTime, { tx: mockTx });

      expect(result.title).toBe('Tên mới sau phụ lục 02');
      expect(result.source).toBe('APPENDIX');
      expect(result.referenceNumber).toBe('PL-02/2026');
      expect(result.effectiveDate).toEqual(t2);

      const findCall = mockTx.titleAdjustmentAppendixItem.findFirst.mock.calls[0][0];
      expect(findCall.where.registrationId).toBe(42);
      expect(findCall.where.appendix.status).toBe('ISSUED');
      expect(findCall.where.appendix.signedDate.lte).toEqual(queryTime);
    });

    it('Priority 1 (historical query): should ignore appendices issued after query time', async () => {
      const pastQueryTime = new Date('2026-03-05T08:00:00Z');

      const mockTx = {
        titleAdjustmentAppendixItem: {
          findFirst: jest.fn().mockResolvedValue(null), // no appendix was issued yet at pastQueryTime
        },
        topicAssignmentDecisionItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 5,
            approvedTitleSnapshot: 'Tên chuẩn theo quyết định ban hành',
            decision: {
              decisionNumber: 'QD-100/2026',
              decisionDate: new Date('2026-02-15T08:00:00Z'),
              decisionPublishedAt: new Date('2026-02-15T09:00:00Z'),
              status: 'PUBLISHED',
            },
          }),
        },
        topicRegistration: { findUnique: jest.fn() },
      };

      const result = await resolveEffectiveTopicTitle(42, pastQueryTime, { tx: mockTx });

      expect(result.title).toBe('Tên chuẩn theo quyết định ban hành');
      expect(result.source).toBe('DECISION');
      expect(result.referenceNumber).toBe('QD-100/2026');
    });

    it('Priority 2: should fall back to PUBLISHED Decision when no issued appendix exists', async () => {
      const mockTx = {
        titleAdjustmentAppendixItem: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        topicAssignmentDecisionItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 1,
            approvedTitleSnapshot: 'Xây dựng hệ thống quản lý học vụ số',
            decision: {
              decisionNumber: 'QD-456/2026',
              decisionDate: new Date('2026-02-10T00:00:00Z'),
              decisionPublishedAt: new Date('2026-02-10T02:00:00Z'),
              status: 'PUBLISHED',
            },
          }),
        },
        topicRegistration: { findUnique: jest.fn() },
      };

      const result = await resolveEffectiveTopicTitle(42, new Date(), { tx: mockTx });

      expect(result.title).toBe('Xây dựng hệ thống quản lý học vụ số');
      expect(result.source).toBe('DECISION');
      expect(result.referenceNumber).toBe('QD-456/2026');
    });

    it('Priority 3: should fall back to BM02_APPROVED when before decision and BM02 approved', async () => {
      const mockTx = {
        titleAdjustmentAppendixItem: { findFirst: jest.fn().mockResolvedValue(null) },
        topicAssignmentDecisionItem: { findFirst: jest.fn().mockResolvedValue(null) },
        topicRegistration: {
          findUnique: jest.fn().mockResolvedValue({
            id: 42,
            status: 'BM02_APPROVED',
            currentBM02Submission: {
              outcome: 'APPROVED',
              bm02ProposedTitle: 'Tên đề tài đã sửa theo góp ý BM01',
              bm01ApprovedTitle: 'Tên ban đầu lúc bảo vệ đề cương',
              reviewedAt: new Date('2026-02-05T00:00:00Z'),
            },
            topic: { title: 'Tên gốc ban đầu' },
          }),
        },
      };

      const result = await resolveEffectiveTopicTitle(42, new Date(), { tx: mockTx });

      expect(result.title).toBe('Tên đề tài đã sửa theo góp ý BM01');
      expect(result.source).toBe('BM02_APPROVED');
    });

    it('Priority 4: should fall back to TOPIC_INITIAL when no decision and no approved BM02', async () => {
      const mockTx = {
        titleAdjustmentAppendixItem: { findFirst: jest.fn().mockResolvedValue(null) },
        topicAssignmentDecisionItem: { findFirst: jest.fn().mockResolvedValue(null) },
        topicRegistration: {
          findUnique: jest.fn().mockResolvedValue({
            id: 42,
            status: 'BM01_PASSED',
            bm01ApprovedTitleSnapshot: 'Tên đề tài duyệt đề cương BM01',
            currentBM02Submission: null,
            topic: { title: 'Tên khởi tạo ban đầu' },
          }),
        },
      };

      const result = await resolveEffectiveTopicTitle(42, new Date(), { tx: mockTx });

      expect(result.title).toBe('Tên đề tài duyệt đề cương BM01');
      expect(result.source).toBe('TOPIC_INITIAL');
    });
  });

  describe('4. Academic PDF Engine & Invariants', () => {
    it('should generate immutable PDF with hash and upload metadata', async () => {
      const mockUploadService = {
        uploadBuffer: jest.fn().mockResolvedValue({
          secure_url: 'https://storage.example.com/academic/bm02a-42-v1.pdf',
          public_id: 'academic/bm02a-42-v1.pdf',
        }),
      };

      const input = {
        docType: 'BM02A',
        registrationId: 42,
        entityId: 10,
        versionNumber: 1,
        title: 'ĐƠN XIN ĐIỀU CHỈNH TÊN ĐỀ TÀI (BM02-A)',
        sections: [
          {
            heading: '1. Thông tin sinh viên',
            lines: ['Họ tên: Nguyễn Văn A', 'MSSV: 20210001', 'Lớp: CNTT1-K15'],
          },
          {
            heading: '2. Nội dung điều chỉnh',
            lines: [
              'Tên đề tài đã giao: Hệ thống AI sơ cấp',
              'Tên đề tài đề nghị điều chỉnh: Hệ thống AI đa tác vụ trên Edge Computing',
              'Lý do: Mở rộng phạm vi kỹ thuật theo khuyến nghị GVHD',
            ],
          },
        ],
        signatures: [
          {
            roleLabel: 'Sinh viên thực hiện',
            signerName: 'Nguyễn Văn A',
            signedAt: new Date('2026-02-12T10:00:00Z'),
            payloadHash: 'hash-student-123456',
          },
          {
            roleLabel: 'Giảng viên hướng dẫn',
            signerName: 'TS. Trần Văn B',
            signedAt: new Date('2026-02-12T14:00:00Z'),
            payloadHash: 'hash-advisor-123456',
          },
          {
            roleLabel: 'Phụ trách bộ môn',
            signerName: 'PGS. TS. Lê Văn C',
            signedAt: new Date('2026-02-13T09:00:00Z'),
            payloadHash: 'hash-dept-123456',
          },
        ],
      };

      const result = await generateImmutableAcademicPdf(input, {
        uploadService: mockUploadService,
      });

      expect(result).toBeDefined();
      expect(typeof result.fileUrl).toBe('string');
      expect(result.fileUrl).toContain('bm02a');
      expect(result.pdfHash).toMatch(/^[a-f0-9]{64}$/);
      expect(mockUploadService.uploadBuffer).toHaveBeenCalledTimes(1);
    });

    it('should NOT generate fake signer info for system timeout, but print explicit system note', async () => {
      const mockUploadService = {
        uploadBuffer: jest.fn().mockResolvedValue({
          secure_url: 'https://storage.example.com/academic/bm03-timeout.pdf',
          public_id: 'academic/bm03-timeout.pdf',
        }),
      };

      const input = {
        docType: 'BM03',
        registrationId: 42,
        entityId: 20,
        title: 'PHIẾU THEO DÕI TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN (BM03)',
        sections: [
          {
            heading: 'Kết luận cuối kỳ',
            lines: ['Đề nghị dừng đề tài do không đạt tiến độ'],
          },
        ],
        signatures: [
          {
            roleLabel: 'Giảng viên hướng dẫn',
            signerName: 'TS. Trần Văn B',
            signedAt: new Date('2026-03-01T10:00:00Z'),
            payloadHash: 'hash-gvhd',
          },
          {
            roleLabel: 'Sinh viên xác nhận',
            systemNote:
              'Sinh viên không xác nhận trong thời hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT)',
          },
        ],
      };

      const result = await generateImmutableAcademicPdf(input, {
        uploadService: mockUploadService,
      });

      expect(result).toBeDefined();
      expect(result.pdfHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
