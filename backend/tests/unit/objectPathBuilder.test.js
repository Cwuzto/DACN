const { buildObjectPath } = require('../../src/storage/objectPathBuilder');
const { STORED_DOCUMENT_TYPES } = require('../../src/storage/assetPolicyCatalog');

describe('objectPathBuilder', () => {
    const fixedUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    describe('Canonical spec path patterns', () => {
        it('should build exact BM01 path in hoc-vu bucket', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.BM01,
                uuid: fixedUuid,
                extension: 'pdf',
                context: {
                    academicYear: '2025-2026',
                    semester: 1,
                    projectType: 'dacn',
                    round: '01',
                    registrationId: 842,
                    version: 1,
                },
            });

            expect(result.bucket).toBe('hoc-vu');
            expect(result.objectKey).toBe(
                'nam-hoc-2025-2026/hoc-ky-1/dacn/dot-01/dang-ky-842/bm01/phien-ban-01/a1b2c3d4-e5f6-7890-abcd-ef1234567890-de-cuong-do-an.pdf'
            );
        });

        it('should build exact BM05 grading sheet path with council and member context', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.BM05,
                uuid: fixedUuid,
                extension: 'pdf',
                context: {
                    academicYear: '2025-2026',
                    semester: 1,
                    projectType: 'dacn',
                    round: '01',
                    registrationId: 842,
                    councilId: 17,
                    memberId: 5,
                },
            });

            expect(result.bucket).toBe('hoc-vu');
            expect(result.objectKey).toBe(
                'nam-hoc-2025-2026/hoc-ky-1/dacn/dot-01/dang-ky-842/bm05/hoi-dong-17/thanh-vien-5/a1b2c3d4-e5f6-7890-abcd-ef1234567890-phieu-cham-diem.pdf'
            );
        });

        it('should build exact source-code ZIP archival path in hoc-vu bucket', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.SOURCE_ZIP,
                uuid: fixedUuid,
                extension: 'zip',
                context: {
                    academicYear: '2025-2026',
                    semester: 1,
                    projectType: 'dacn',
                    round: '01',
                    registrationId: 842,
                    version: 1,
                },
            });

            expect(result.bucket).toBe('hoc-vu');
            expect(result.objectKey).toBe(
                'nam-hoc-2025-2026/hoc-ky-1/dacn/dot-01/dang-ky-842/luu-chieu/source-code/phien-ban-01/a1b2c3d4-e5f6-7890-abcd-ef1234567890-ma-nguon.zip'
            );
        });

        it('should build exact public template path in cong-khai bucket', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.PORTAL_TEMPLATE,
                uuid: fixedUuid,
                extension: 'docx',
                context: {
                    formCode: 'bm01',
                    version: 1,
                    description: 'bieu mau de cuong',
                },
            });

            expect(result.bucket).toBe('cong-khai');
            expect(result.objectKey).toBe(
                'bieu-mau-da-cong-bo/bm01/phien-ban-01/a1b2c3d4-e5f6-7890-abcd-ef1234567890-bieu-mau-de-cuong.docx'
            );
        });

        it('should build exact user avatar path in ca-nhan bucket (current and replaced)', () => {
            const currentResult = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.USER_AVATAR,
                uuid: fixedUuid,
                extension: 'webp',
                context: { userId: 42 },
            });

            expect(currentResult.bucket).toBe('ca-nhan');
            expect(currentResult.objectKey).toBe(
                'nguoi-dung-42/anh-dai-dien/hien-tai/a1b2c3d4-e5f6-7890-abcd-ef1234567890-anh-dai-dien.webp'
            );

            const replacedResult = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.USER_AVATAR,
                uuid: fixedUuid,
                extension: 'webp',
                context: { userId: 42, isReplaced: true },
            });

            expect(replacedResult.bucket).toBe('ca-nhan');
            expect(replacedResult.objectKey).toBe(
                'nguoi-dung-42/anh-dai-dien/da-thay-the/a1b2c3d4-e5f6-7890-abcd-ef1234567890-anh-dai-dien.webp'
            );
        });

        it('should build exact temp staging path in tam bucket', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.TEMP_STAGING,
                uuid: fixedUuid,
                extension: 'pdf',
                context: {
                    uploadSessionId: 'session-123',
                    date: '2026-11-17',
                    description: 'tai lieu tam',
                },
            });

            expect(result.bucket).toBe('tam');
            expect(result.objectKey).toBe(
                'cho-kiem-tra/ngay-2026-11-17/phien-session-123/a1b2c3d4-e5f6-7890-abcd-ef1234567890-tai-lieu-tam.pdf'
            );
        });
    });

    describe('Strict context validation', () => {
        it('should throw when registrationId is missing for thesis document', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.BM01,
                    uuid: fixedUuid,
                    extension: 'pdf',
                    context: { academicYear: '2025-2026', semester: 1 },
                })
            ).toThrow(/registrationId/i);
        });

        it('should throw when councilId or memberId is missing for BM05', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.BM05,
                    uuid: fixedUuid,
                    extension: 'pdf',
                    context: { registrationId: 842, councilId: 10 },
                })
            ).toThrow(/memberId/i);
        });

        it('should throw when userId is missing for USER_AVATAR', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.USER_AVATAR,
                    uuid: fixedUuid,
                    extension: 'png',
                    context: {},
                })
            ).toThrow(/userId/i);
        });

        it('should throw when uploadSessionId is missing for TEMP_STAGING', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.TEMP_STAGING,
                    uuid: fixedUuid,
                    extension: 'pdf',
                    context: {},
                })
            ).toThrow(/uploadSessionId/i);
        });

        it('should throw when formCode is missing for PORTAL_TEMPLATE', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.PORTAL_TEMPLATE,
                    uuid: fixedUuid,
                    extension: 'docx',
                    context: {},
                })
            ).toThrow(/formCode/i);
        });

        it('should throw when announcementId is missing for PORTAL_DOCUMENT', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.PORTAL_DOCUMENT,
                    uuid: fixedUuid,
                    extension: 'pdf',
                    context: {},
                })
            ).toThrow(/announcementId/i);
        });
    });

    describe('Security and PII guards', () => {
        it('should throw when uuid is missing or invalid', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.BM01,
                    uuid: '',
                    extension: 'pdf',
                    context: { registrationId: 842 },
                })
            ).toThrow(/uuid/i);
        });

        it('should throw when extension is missing', () => {
            expect(() =>
                buildObjectPath({
                    documentType: STORED_DOCUMENT_TYPES.BM01,
                    uuid: fixedUuid,
                    extension: '',
                    context: { registrationId: 842 },
                })
            ).toThrow(/extension/i);
        });

        it('should normalize leading dots in extensions', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.BM01,
                uuid: fixedUuid,
                extension: '.pdf',
                context: {
                    academicYear: '2025-2026',
                    semester: 1,
                    projectType: 'dacn',
                    round: '01',
                    registrationId: 842,
                },
            });
            expect(result.objectKey.endsWith('.pdf')).toBe(true);
            expect(result.objectKey.includes('..')).toBe(false);
        });

        it('should never include PII (name, email, mssv) in the constructed path', () => {
            const result = buildObjectPath({
                documentType: STORED_DOCUMENT_TYPES.BM01,
                uuid: fixedUuid,
                extension: 'pdf',
                context: {
                    academicYear: '2025-2026',
                    semester: 1,
                    projectType: 'dacn',
                    round: '01',
                    registrationId: 842,
                    studentName: 'Nguyen Van A',
                    email: 'nguyenvana@gmail.com',
                    studentCode: '20110001',
                },
            });

            expect(result.objectKey).not.toContain('Nguyen');
            expect(result.objectKey).not.toContain('nguyenvana');
            expect(result.objectKey).not.toContain('20110001');
        });
    });
});
