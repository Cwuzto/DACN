const { StoredAssetService } = require('../../src/services/storedAssetService');
const { generateImmutableAcademicPdf } = require('../../src/services/academicPdfService');

describe('Task 2: Generated Academic PDF Actor Flows (P0.8, P0.11, P0.21, P1.7)', () => {
    describe('1. systemActorService.resolveSystemActor', () => {
        let resolveSystemActor;
        const originalEnv = process.env.SYSTEM_ACTOR_USER_ID;

        beforeEach(() => {
            // Clear require cache to test cleanly
            delete require.cache[require.resolve('../../src/services/systemActorService')];
            resolveSystemActor = require('../../src/services/systemActorService').resolveSystemActor;
        });

        afterEach(() => {
            process.env.SYSTEM_ACTOR_USER_ID = originalEnv;
        });

        test('resolves SYSTEM_ACTOR_USER_ID from process.env when user exists and isActive = true', async () => {
            process.env.SYSTEM_ACTOR_USER_ID = '42';
            const mockDb = {
                user: {
                    findFirst: jest.fn().mockResolvedValue({ id: 42, role: 'ADMIN', isActive: true }),
                },
            };

            const actor = await resolveSystemActor(mockDb);
            expect(actor).toEqual({ id: 42 });
            expect(mockDb.user.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 42, isActive: true },
                })
            );
        });

        test('falls back to first active ADMIN when SYSTEM_ACTOR_USER_ID is not configured or user inactive/not found', async () => {
            delete process.env.SYSTEM_ACTOR_USER_ID;
            const mockDb = {
                user: {
                    findFirst: jest.fn().mockResolvedValue({ id: 99, role: 'ADMIN', isActive: true }),
                },
            };

            const actor = await resolveSystemActor(mockDb);
            expect(actor).toEqual({ id: 99 });
            expect(mockDb.user.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { role: 'ADMIN', isActive: true },
                    orderBy: { id: 'asc' },
                })
            );
        });

        test('throws clear configuration error and NEVER returns null or 0 when no active user found', async () => {
            delete process.env.SYSTEM_ACTOR_USER_ID;
            const mockDb = {
                user: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
            };

            await expect(resolveSystemActor(mockDb)).rejects.toThrow(/system actor/i);
        });
    });

    describe('2. StoredAssetService rejects missing or invalid uploadedById', () => {
        let service;
        let mockPrisma;
        let mockStorageAdapter;

        beforeEach(() => {
            mockPrisma = {
                storedAsset: {
                    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'uuid-1', ...data })),
                },
            };
            mockStorageAdapter = {
                upload: jest.fn().mockResolvedValue({}),
            };
            service = new StoredAssetService({ prisma: mockPrisma, storageAdapter: mockStorageAdapter });
        });

        test('rejects createStoredAssetFromBuffer when actor is null, 0, or negative', async () => {
            const buffer = Buffer.from('%PDF-1.4 test');
            await expect(
                service.createStoredAssetFromBuffer({
                    buffer,
                    originalName: 'test.pdf',
                    documentType: 'BM03',
                    resourceContext: { registrationId: 101 },
                    actor: null,
                })
            ).rejects.toThrow(/uploadedById|actor/i);

            await expect(
                service.createStoredAssetFromBuffer({
                    buffer,
                    originalName: 'test.pdf',
                    documentType: 'BM03',
                    resourceContext: { registrationId: 101 },
                    actor: { id: 0 },
                })
            ).rejects.toThrow(/uploadedById|actor/i);

            await expect(
                service.createStoredAssetFromBuffer({
                    buffer,
                    originalName: 'test.pdf',
                    documentType: 'BM03',
                    resourceContext: { registrationId: 101 },
                    actor: { id: -5 },
                })
            ).rejects.toThrow(/uploadedById|actor/i);
        });

        test('successfully creates StoredAsset when actor has valid positive integer id', async () => {
            const buffer = Buffer.from('%PDF-1.4 test');
            const result = await service.createStoredAssetFromBuffer({
                buffer,
                originalName: 'test.pdf',
                documentType: 'BM03',
                resourceContext: { registrationId: 101 },
                actor: { id: 10 },
            });

            expect(result).toBeDefined();
            expect(mockPrisma.storedAsset.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        uploadedById: 10,
                        ownerUserId: 10,
                    }),
                })
            );
        });
    });

    describe('3. BM02-A Workflow passes signer actor to PDF generation (P0.8)', () => {
        test('departmentSignBM02A passes deptHeadId as actor to generateImmutableAcademicPdf', async () => {
            const academicPdfService = require('../../src/services/academicPdfService');
            const pdfSpy = jest.spyOn(academicPdfService, 'generateImmutableAcademicPdf');

            const electronicSignatureService = require('../../src/services/electronicSignatureService');
            const sigSpy = jest.spyOn(electronicSignatureService, 'recordSignatureEvent').mockResolvedValue({ id: 501 });

            const bm02aWorkflowService = require('../../src/services/bm02aWorkflowService');
            const mockTx = {
                user: {
                    findUnique: jest.fn().mockResolvedValue({ id: 77, role: 'DEPARTMENT_HEAD', department: 'CNTT' }),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: { mentor: { department: 'CNTT' } },
                    }),
                },
                bM02AAdjustmentRequest: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 1,
                        registrationId: 101,
                        status: 'PENDING_DEPARTMENT_APPROVAL',
                        currentVersionNumber: 1,
                        versions: [{
                            id: 10,
                            versionNumber: 1,
                            payloadHash: 'hash-version-1',
                            studentSnapshot: { fullName: 'Sinh Vien A' },
                        }],
                    }),
                    update: jest.fn().mockResolvedValue({
                        id: 1,
                        status: 'APPROVED_PENDING_APPENDIX',
                        finalPdfFileUrl: '/api/assets/asset-1/download',
                    }),
                },
                bM02AFormVersion: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 10,
                        versionNumber: 1,
                        payloadHash: 'hash-version-1',
                        studentSnapshot: { fullName: 'Sinh Vien A' },
                    }),
                    update: jest.fn().mockResolvedValue({}),
                },
                electronicSignatureEvent: {
                    create: jest.fn().mockResolvedValue({ id: 501 }),
                },
            };

            const mockUploadService = {
                uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://example.com/bm02a.pdf' }),
            };

            const res = await bm02aWorkflowService.departmentSignBM02A(
                { requestId: 1, departmentHeadId: 77 },
                { tx: mockTx, uploadService: mockUploadService }
            );

            expect(res).toBeDefined();
            expect(pdfSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    docType: 'BM02A',
                    actor: { id: 77 },
                }),
                expect.anything()
            );

            pdfSpy.mockRestore();
            sigSpy.mockRestore();
        });
    });

    describe('4. BM03 Workflow passes student actor to PDF generation (P0.11)', () => {
        test('studentAcknowledgeBM03 passes studentId as actor to generateImmutableAcademicPdf', async () => {
            const academicPdfService = require('../../src/services/academicPdfService');
            const pdfSpy = jest.spyOn(academicPdfService, 'generateImmutableAcademicPdf');

            const bm03WorkflowService = require('../../src/services/bm03WorkflowService');
            const mockTx = {
                bM03ProgressRecord: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 201,
                        registrationId: 102,
                        studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                        finalConclusion: 'CONTINUE_TO_BM04',
                        advisorPayloadHash: 'hash-bm03-adv',
                        registration: {
                            id: 102,
                            studentId: 88,
                            student: { fullName: 'Sinh Vien B' },
                            topic: { mentor: { fullName: 'GVHD C' } },
                        },
                    }),
                    update: jest.fn().mockResolvedValue({
                        id: 201,
                        studentAckStatus: 'ACKNOWLEDGED',
                        finalPdfFileUrl: '/api/assets/asset-bm03/download',
                    }),
                },
                topicRegistration: {
                    update: jest.fn().mockResolvedValue({}),
                },
                task: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 301 }),
                },
                electronicSignatureEvent: {
                    create: jest.fn().mockResolvedValue({ id: 502 }),
                },
            };

            const mockUploadService = {
                uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://example.com/bm03.pdf' }),
            };

            const res = await bm03WorkflowService.studentAcknowledgeBM03(
                { bm03RecordId: 201, studentId: 88, action: 'ACKNOWLEDGED' },
                { tx: mockTx, uploadService: mockUploadService }
            );

            expect(res).toBeDefined();
            expect(pdfSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    docType: 'BM03',
                    actor: { id: 88 },
                }),
                expect.anything()
            );

            pdfSpy.mockRestore();
        });
    });

    describe('5. BM04 Workflow does NOT swallow PDF exception (P0.11 / P1.7)', () => {
        test('signAndSubmitBM04 fails and throws when PDF generation fails instead of leaving empty URL', async () => {
            const bm04WorkflowService = require('../../src/services/bm04WorkflowService');
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 103,
                        status: 'BM03_PASSED',
                        stateVersion: 1,
                        topic: { mentorId: 55, mentor: { fullName: 'GVHD D' } },
                    }),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                bM04Evaluation: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 401 }),
                    update: jest.fn().mockResolvedValue({ id: 401 }),
                },
                electronicSignatureEvent: {
                    create: jest.fn().mockResolvedValue({ id: 503 }),
                },
                idempotencyRecord: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({}),
                },
                registrationStateHistory: {
                    create: jest.fn().mockResolvedValue({}),
                },
            };

            // Failing uploadService to force PDF failure
            const failingUploader = {
                uploadBuffer: jest.fn().mockRejectedValue(new Error('Storage failure: S3 upload timeout')),
            };

            await expect(
                bm04WorkflowService.signAndSubmitBM04(
                    {
                        registrationId: 103,
                        mentorId: 55,
                        conclusion: 'APPROVE_FOR_DEFENSE',
                        criteriaScores: { criterion1: 9 },
                    },
                    { tx: mockTx, uploadService: failingUploader }
                )
            ).rejects.toThrow();
        });
    });

    describe('6. Archival Workflow passes director actor to clearance certificate PDF (P0.21)', () => {
        test('signClearanceCertificateByInstituteDirector passes directorUserId as actor to generateImmutableAcademicPdf', async () => {
            const academicPdfService = require('../../src/services/academicPdfService');
            const pdfSpy = jest.spyOn(academicPdfService, 'generateImmutableAcademicPdf');

            const archivalWorkflowService = require('../../src/services/archivalWorkflowService');
            const mockTx = {
                projectArchive: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 501,
                        registrationId: 104,
                        mentorReviewStatus: 'APPROVED',
                        academicAffairsReviewStatus: 'APPROVED',
                        status: 'ACADEMIC_AFFAIRS_ACCEPTED',
                        registration: {
                            id: 104,
                            status: 'PENDING_INSTITUTE_SIGNATURE',
                            student: { fullName: 'Sinh Vien E', code: 'SV001' },
                            topic: { mentor: { fullName: 'GVHD F' } },
                            defenseResult: { finalScore: 8.5 },
                            stateVersion: 2,
                        },
                    }),
                    update: jest.fn().mockResolvedValue({
                        id: 501,
                        status: 'COMPLETED',
                        certificatePdfUrl: '/api/assets/asset-cert/download',
                    }),
                },
                electronicSignatureEvent: {
                    create: jest.fn().mockResolvedValue({ id: 504 }),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 104,
                        status: 'PENDING_INSTITUTE_SIGNATURE',
                        stateVersion: 2,
                    }),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                idempotencyRecord: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({}),
                },
                registrationStateHistory: {
                    create: jest.fn().mockResolvedValue({}),
                },
            };

            const mockUploadService = {
                uploadBuffer: jest.fn().mockResolvedValue({ url: 'https://example.com/cert.pdf' }),
            };

            const directorUser = {
                id: 66,
                fullName: 'Vien Truong X',
                role: 'VIEN_TRUONG',
                permissions: ['CLEARANCE_CERTIFICATE_SIGN'],
            };

            const res = await archivalWorkflowService.signClearanceCertificateByInstituteDirector(
                { archiveId: 501, directorUser },
                { tx: mockTx, uploadService: mockUploadService }
            );

            expect(res).toBeDefined();
            expect(pdfSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    docType: 'CLEARANCE_CERTIFICATE',
                    actor: { id: 66 },
                }),
                expect.anything()
            );

            pdfSpy.mockRestore();
        });
    });
});
