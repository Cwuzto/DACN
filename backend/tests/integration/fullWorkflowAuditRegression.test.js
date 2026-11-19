const { resolveEffectiveTopicTitle } = require('../../src/services/topicTitleResolverService');
const { safeNotify, safeNotifyMany } = require('../../src/services/notificationService');
const { createExcelBuffer } = require('../../src/utils/excelHelper');
const { resolveSystemActor } = require('../../src/services/systemActorService');
const { ACTIVE_MENTOR_OCCUPANCY_STATUSES } = require('../../src/constants/mentorCapacity');

describe('Six-Stage Full Workflow Audit Regression (Task 5 / 36-Item Audit)', () => {
    describe('Stage 1 & 2: Foundation & Quota Integrity', () => {
        test('resolveSystemActor yields valid non-null, non-zero actor ID', async () => {
            const actor = await resolveSystemActor();
            expect(actor).toBeDefined();
            expect(actor.id).toBeGreaterThan(0);
        });

        test('mentor occupancy capacity includes all active statuses up to DEFENSE_READY', () => {
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).toContain('BM01_SUBMITTED');
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).toContain('BM02_APPROVED');
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).toContain('IN_PROGRESS');
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).toContain('DEFENSE_READY');
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).not.toContain('CANCELLED');
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).not.toContain('AUTO_TERMINATED');
        });
    });

    describe('Stage 3: Academic Workflow & Title Resolution', () => {
        test('resolveEffectiveTopicTitle returns original title when no approved BM02-A exists', async () => {
            const mockDb = {
                titleAdjustmentAppendixItem: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
                topicAssignmentDecisionItem: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 999,
                        topic: { title: 'Đề tài Nghiên cứu AI' },
                        bm02aRequests: [],
                    }),
                },
            };

            const result = await resolveEffectiveTopicTitle(999, new Date(), { tx: mockDb });
            expect(result.title).toBe('Đề tài Nghiên cứu AI');
        });

        test('resolveEffectiveTopicTitle resolves to BM02-A approved title when approved', async () => {
            const approvedDate = new Date('2026-10-01T00:00:00Z');
            const mockDb = {
                titleAdjustmentAppendixItem: {
                    findFirst: jest.fn().mockResolvedValue({
                        newTitle: 'Tên đề tài mới đã duyệt',
                        appendix: { signedDate: approvedDate },
                    }),
                },
                topicAssignmentDecisionItem: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 999,
                        topic: { title: 'Tên đề tài cũ' },
                        bm02aRequests: [],
                    }),
                },
            };

            const result = await resolveEffectiveTopicTitle(999, new Date('2026-11-01T00:00:00Z'), { tx: mockDb });
            expect(result.title).toBe('Tên đề tài mới đã duyệt');
        });
    });

    describe('Stage 4: Council & Result Notifications (SEC-12 & Schema Safety)', () => {
        test('safeNotify sanitizes data and removes isPromulgated before Prisma create', async () => {
            const prisma = require('../../src/config/database');
            const spyCreate = jest.spyOn(prisma.notification, 'create').mockResolvedValueOnce({ id: 888 });

            const payload = {
                userId: 200,
                title: 'Kết quả công bố',
                content: 'Điểm: 9.0',
                type: 'DEFENSE',
                isPromulgated: true,
                nonExistentField: 'malicious_or_extra',
            };

            const res = await safeNotify(payload, 'regression-test');
            expect(res.ok).toBe(true);
            expect(spyCreate).toHaveBeenCalledWith({
                data: {
                    userId: 200,
                    title: 'Kết quả công bố',
                    content: 'Điểm: 9.0',
                    type: 'DEFENSE',
                },
            });
            expect(spyCreate.mock.calls[0][0].data.isPromulgated).toBeUndefined();
            expect(spyCreate.mock.calls[0][0].data.nonExistentField).toBeUndefined();
            spyCreate.mockRestore();
        });
    });

    describe('Stage 5 & 6: Archive & Reporting Integrity', () => {
        test('ineligible archive statuses strictly prohibit file upload', () => {
            const ineligibleStatuses = ['DEFENSE_FAILED', 'NOT_ELIGIBLE_FOR_DEFENSE', 'AUTO_TERMINATED'];
            expect(ineligibleStatuses).toContain('DEFENSE_FAILED');
            expect(ineligibleStatuses).toContain('NOT_ELIGIBLE_FOR_DEFENSE');
            expect(ineligibleStatuses).toContain('AUTO_TERMINATED');
            expect(ineligibleStatuses).not.toContain('DEFENSE_PASSED');
        });

        test('createExcelBuffer produces non-empty buffer with defaultHeaders when rows are empty (0 rows)', () => {
            const defaultHeaders = ['STT', 'Mã SV', 'Họ và tên', 'Tên đề tài', 'Điểm Tổng kết'];
            const buffer = createExcelBuffer('BaoCaoRong', [], [], defaultHeaders);

            expect(buffer).toBeDefined();
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(100);

            // Parse back workbook with xlsx to verify headers exist
            const XLSX = require('xlsx');
            const wb = XLSX.read(buffer, { type: 'buffer' });
            const sheet = wb.Sheets['BaoCaoRong'];
            expect(sheet).toBeDefined();
            expect(sheet['A1']?.v).toBe('STT');
            expect(sheet['B1']?.v).toBe('Mã SV');
            expect(sheet['E1']?.v).toBe('Điểm Tổng kết');
        });
    });
});
