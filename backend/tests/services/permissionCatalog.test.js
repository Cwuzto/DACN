const {
    PERMISSIONS,
    PERMISSION_CATALOG,
    DEFAULT_GROUPS,
} = require('../../src/constants/permissions');

describe('Permission catalog invariants', () => {
    test('permission codes are unique and constants match the catalog', () => {
        const catalogCodes = PERMISSION_CATALOG.map(({ code }) => code);

        expect(new Set(catalogCodes).size).toBe(catalogCodes.length);
        expect(Object.values(PERMISSIONS).sort()).toEqual([...catalogCodes].sort());
    });

    test('default groups reference only catalog permissions without duplicates', () => {
        const catalogCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));

        for (const group of DEFAULT_GROUPS) {
            expect(new Set(group.permissions).size).toBe(group.permissions.length);
            for (const code of group.permissions) {
                expect(catalogCodes.has(code)).toBe(true);
            }
        }
    });

    test('P1 capabilities exist with the approved default mappings', () => {
        const codes = new Set(PERMISSION_CATALOG.map(({ code }) => code));
        const groups = Object.fromEntries(DEFAULT_GROUPS.map((group) => [group.code, new Set(group.permissions)]));

        for (const code of [
            PERMISSIONS.RUBRIC_MANAGE,
            PERMISSIONS.NOTIFICATION_MANAGE,
            PERMISSIONS.LEGACY_REVIEW_MANAGE,
            PERMISSIONS.FINAL_DOCUMENT_REVIEW,
        ]) {
            expect(codes.has(code)).toBe(true);
        }

        expect(groups.QUAN_TRI_VIEN.has(PERMISSIONS.RUBRIC_MANAGE)).toBe(true);
        expect(groups.QUAN_TRI_VIEN.has(PERMISSIONS.NOTIFICATION_MANAGE)).toBe(true);
        expect(groups.QUAN_TRI_VIEN.has(PERMISSIONS.LEGACY_REVIEW_MANAGE)).toBe(true);
        expect(groups.GVHD.has(PERMISSIONS.FINAL_DOCUMENT_REVIEW)).toBe(true);
        expect(groups.VIEN_TRUONG.has(PERMISSIONS.RUBRIC_MANAGE)).toBe(true);
        expect(groups.VIEN_TRUONG.has(PERMISSIONS.FINAL_DOCUMENT_REVIEW)).toBe(true);
    });
});
