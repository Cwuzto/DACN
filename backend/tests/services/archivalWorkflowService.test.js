const {
    checkArchiveComponents,
    generateCertificateVerificationHash,
    submitArchivePostDefense,
    reviewArchivePostDefense,
    getClearanceCertificateData,
} = require('../../src/services/archivalWorkflowService');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

describe('archivalWorkflowService', () => {
    describe('checkArchiveComponents', () => {
        it('phát hiện các thành phần còn thiếu khi nộp hồ sơ lưu chiểu', () => {
            const emptyCheck = checkArchiveComponents({});
            expect(emptyCheck.isComplete).toBe(false);
            expect(emptyCheck.missingComponents.length).toBeGreaterThanOrEqual(2);

            const completeCheck = checkArchiveComponents({
                reportFileUrl: 'https://storage/report.pdf',
                sourceCodeUrl: 'https://github.com/org/repo',
                demoVideoUrl: 'https://youtube.com/watch?v=123',
                slideFileUrl: 'https://storage/slide.pdf',
            });
            expect(completeCheck.isComplete).toBe(true);
            expect(completeCheck.missingComponents).toHaveLength(0);
        });
    });

    describe('generateCertificateVerificationHash', () => {
        it('tạo mã băm xác thực SHA256 64 ký tự chuẩn', () => {
            const payload = {
                certificateNumber: 'TDMU-DA-CERT-2026-00101',
                studentCode: '212480103001',
                topicTitle: 'Hệ thống AI',
                finalScore: 8.75,
                issueDate: '2026-06-25',
            };
            const hash1 = generateCertificateVerificationHash(payload);
            const hash2 = generateCertificateVerificationHash(payload);

            expect(hash1).toHaveLength(64);
            expect(hash1).toBe(hash2);

            const hashDifferent = generateCertificateVerificationHash({ ...payload, finalScore: 9.0 });
            expect(hashDifferent).not.toBe(hash1);
        });
    });

    describe('submitArchivePostDefense', () => {
        it('ném lỗi nếu registrationId không hợp lệ', async () => {
            await expect(submitArchivePostDefense({ registrationId: -1 })).rejects.toThrow(WorkflowTransitionError);
        });

        it('INV-06: Chặn nộp lưu chiểu nếu chưa có kết quả bảo vệ đạt đã phê duyệt', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        studentId: 10,
                        status: 'IN_PROGRESS',
                        defenseResult: { finalScore: 8.5 }, // điểm khóa không thay approval
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(
                submitArchivePostDefense(
                    {
                        registrationId: 101,
                        actorId: 10,
                        actorRole: 'STUDENT',
                        reportFileUrl: 'https://storage/report.pdf',
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'DEFENSE_NOT_PASSED',
                status: 400,
            });
        });

        it('INV-06: DEFENSE_FAILED không được nộp lưu chiểu dù điểm snapshot cao', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101, studentId: 10, status: 'DEFENSE_FAILED', defenseResult: { finalScore: 9.5 },
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(submitArchivePostDefense({
                registrationId: 101, actorId: 10, actorRole: 'STUDENT', reportFileUrl: 'https://storage/report.pdf',
            }, { db: mockDb })).rejects.toMatchObject({ code: 'DEFENSE_NOT_PASSED', status: 400 });
        });

        it('chặn sinh viên khác không phải chủ đề tài nộp lưu chiểu', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        studentId: 10, // chủ là 10
                        status: 'DEFENDED',
                        defenseResult: { finalScore: 8.0 },
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(
                submitArchivePostDefense(
                    {
                        registrationId: 101,
                        actorId: 99, // sinh viên khác
                        actorRole: 'STUDENT',
                        reportFileUrl: 'https://storage/report.pdf',
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                status: 403,
            });
        });

        it('nộp lưu chiểu thành công khi sinh viên đã bảo vệ đạt', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        studentId: 10,
                        status: 'DEFENDED',
                        defenseResult: { finalScore: 8.5 },
                    }),
                },
                projectArchive: {
                    upsert: jest.fn().mockResolvedValue({
                        id: 1,
                        registrationId: 101,
                        status: 'SUBMITTED',
                        reportFileUrl: 'https://storage/report.pdf',
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            const res = await submitArchivePostDefense(
                {
                    registrationId: 101,
                    actorId: 10,
                    actorRole: 'STUDENT',
                    reportFileUrl: 'https://storage/report.pdf',
                    sourceCodeUrl: 'https://github.com/org/repo',
                },
                { db: mockDb },
            );

            expect(res.status).toBe('SUBMITTED');
            expect(mockTx.projectArchive.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 101 },
                }),
            );
        });
    });

    describe('reviewArchivePostDefense', () => {
        it('chặn người không phải GVHD hoặc Admin nghiệm thu lưu chiểu', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: { mentorId: 2 },
                        archive: { id: 1, status: 'SUBMITTED' },
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(
                reviewArchivePostDefense(
                    {
                        registrationId: 101,
                        actorId: 99, // giảng viên khác
                        actorRole: 'LECTURER',
                        decision: 'APPROVED',
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'FORBIDDEN',
                status: 403,
            });
        });

        it('INV-06: Chặn nghiệm thu APPROVED khi DEFENSE_FAILED dù điểm cao', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: { mentorId: 2 },
                        archive: { id: 1, status: 'SUBMITTED' },
                        status: 'DEFENSE_FAILED',
                        defenseResult: { finalScore: 9.8 },
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(
                reviewArchivePostDefense(
                    {
                        registrationId: 101,
                        actorId: 2,
                        actorRole: 'LECTURER',
                        decision: 'APPROVED',
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'CANNOT_COMPLETE_FAILED_DEFENSE',
                status: 409,
            });
        });

        it('nghiệm thu APPROVED chuyển trạng thái sang COMPLETED', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        status: 'DEFENDED',
                        stateVersion: 3,
                        topic: { mentorId: 2 },
                        archive: { id: 1, status: 'SUBMITTED' },
                        defenseResult: { finalScore: 8.5 },
                    }),
                    update: jest.fn().mockResolvedValue({ id: 101, status: 'COMPLETED' }),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                projectArchive: {
                    update: jest.fn().mockResolvedValue({
                        id: 1,
                        status: 'APPROVED',
                        reviewedBy: 2,
                    }),
                },
                idempotencyRecord: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({}),
                },
                registrationStateHistory: {
                    create: jest.fn().mockResolvedValue({}),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            const res = await reviewArchivePostDefense(
                {
                    registrationId: 101,
                    actorId: 2,
                    actorRole: 'LECTURER',
                    decision: 'APPROVED',
                    reviewerNotes: 'Hồ sơ đạt yêu cầu',
                },
                { db: mockDb },
            );

            expect(res.status).toBe('APPROVED');
            expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 101 }),
                    data: expect.objectContaining({ status: 'COMPLETED' }),
                }),
            );
        });

        it('yêu cầu chỉnh sửa REVISION_REQUIRED không chuyển sang COMPLETED', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        status: 'DEFENDED',
                        topic: { mentorId: 2 },
                        archive: { id: 1, status: 'SUBMITTED' },
                        defenseResult: { finalScore: 8.5 },
                    }),
                    update: jest.fn(),
                },
                projectArchive: {
                    update: jest.fn().mockResolvedValue({
                        id: 1,
                        status: 'REVISION_REQUIRED',
                        reviewedBy: 2,
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            const res = await reviewArchivePostDefense(
                {
                    registrationId: 101,
                    actorId: 2,
                    actorRole: 'LECTURER',
                    decision: 'REVISION_REQUIRED',
                    reviewerNotes: 'Cần bổ sung slide và video demo',
                },
                { db: mockDb },
            );

            expect(res.status).toBe('REVISION_REQUIRED');
            expect(mockTx.topicRegistration.update).not.toHaveBeenCalled();
        });
    });

    describe('getClearanceCertificateData', () => {
        it('chặn cấp Giấy xác nhận nếu hồ sơ chưa được duyệt APPROVED hoặc COMPLETED', async () => {
            const mockDb = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        status: 'DEFENDED',
                        archive: { status: 'SUBMITTED' },
                    }),
                },
            };

            await expect(getClearanceCertificateData(101, { db: mockDb })).rejects.toMatchObject({
                code: 'ARCHIVE_NOT_APPROVED',
                status: 400,
            });
        });

        it('trích xuất đầy đủ dữ liệu Giấy xác nhận kèm mã băm SHA256', async () => {
            const mockDb = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        status: 'COMPLETED',
                        student: { fullName: 'Trần Văn A', code: '212480103001', department: 'CNTT' },
                        topic: {
                            title: 'Hệ thống BigData',
                            mentor: { fullName: 'TS. Nguyễn Văn B', academicTitle: 'TIEN_SI' },
                            projectCatalog: { name: 'Khóa luận tốt nghiệp' },
                            semester: { name: 'HK1 (2026 - 2027)' },
                        },
                        defenseResult: { finalScore: 9.0 },
                        defenseCouncil: { name: 'HĐ Bảo Vệ CNTT 01' },
                        archive: {
                            status: 'APPROVED',
                            reviewedAt: new Date('2026-06-25'),
                            reviewer: { fullName: 'TS. Nguyễn Văn B' },
                        },
                    }),
                },
            };

            const data = await getClearanceCertificateData(101, { db: mockDb });

            expect(data.certificateNumber).toContain('TDMU-DA-CERT');
            expect(data.verificationHash).toHaveLength(64);
            expect(data.evaluation.letterGrade).toBe('A');
            expect(data.evaluation.finalScore).toBe(9.0);
            expect(data.student.code).toBe('212480103001');
        });
    });
});
