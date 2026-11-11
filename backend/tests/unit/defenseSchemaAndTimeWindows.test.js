const { computeDefenseTimeWindows, roundDefenseScoreOneDecimal } = require('../../src/utils/defenseTimeWindowUtils');
const { PERMISSIONS, ACADEMIC_PROTECTED_PERMISSIONS } = require('../../src/constants/permissions');
const { ALLOWED_TRANSITIONS } = require('../../src/services/registrationTransitionService');

describe('Task 1: Defense Time Windows, Rounding, Permissions & State Machine', () => {
    test('computeDefenseTimeWindows computes exact 00:00 Asia/Ho_Chi_Minh boundaries for defense on 2026-11-20', () => {
        const windows = computeDefenseTimeWindows('2026-11-20T08:00:00+07:00');
        expect(windows.defenseDateYmd).toBe('2026-11-20');
        expect(windows.softPreparationDeadlineAt.toISOString()).toBe(new Date('2026-11-17T00:00:00+07:00').toISOString());
        expect(windows.defenseSnapshotAt.toISOString()).toBe(new Date('2026-11-20T00:00:00+07:00').toISOString());
        expect(windows.windowClosesAt.toISOString()).toBe(new Date('2026-12-05T00:00:00+07:00').toISOString());
    });

    test('roundDefenseScoreOneDecimal rounds deterministically to 1 decimal place', () => {
        expect(roundDefenseScoreOneDecimal((5.0 + 4.9 + 4.95) / 3)).toBe(5.0);
        expect(roundDefenseScoreOneDecimal(4.949)).toBe(4.9);
        expect(roundDefenseScoreOneDecimal(4.95)).toBe(5.0);
        expect(roundDefenseScoreOneDecimal(8.3333333)).toBe(8.3);
    });

    test('defines new defense & archival permissions and protects CLEARANCE_CERTIFICATE_SIGN as academic', () => {
        expect(PERMISSIONS.CLEARANCE_CERTIFICATE_SIGN).toBe('CLEARANCE_CERTIFICATE_SIGN');
        expect(PERMISSIONS.ARCHIVE_ACADEMIC_AFFAIRS_REVIEW).toBe('ARCHIVE_ACADEMIC_AFFAIRS_REVIEW');
        expect(PERMISSIONS.DEFENSE_SCOREBOOK_RETURN).toBe('DEFENSE_SCOREBOOK_RETURN');
        expect(ACADEMIC_PROTECTED_PERMISSIONS.has('CLEARANCE_CERTIFICATE_SIGN')).toBe(true);
    });

    test('registrationTransitionService allows DEFENSE_PASSED -> PENDING_INSTITUTE_SIGNATURE / ARCHIVE_INCOMPLETE / ARCHIVE_REJECTED and PENDING_INSTITUTE_SIGNATURE -> COMPLETED', () => {
        expect(ALLOWED_TRANSITIONS.DEFENSE_PASSED).toEqual(
            expect.arrayContaining(['PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'COMPLETED'])
        );
        expect(ALLOWED_TRANSITIONS.PENDING_INSTITUTE_SIGNATURE).toEqual(
            expect.arrayContaining(['COMPLETED', 'ARCHIVE_REJECTED'])
        );
    });
});
