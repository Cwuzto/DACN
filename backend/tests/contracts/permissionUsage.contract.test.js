const fs = require('fs');
const path = require('path');
const {
    PERMISSION_DEFINITIONS,
    normalizePermissionCode,
    isCanonicalPermissionCode,
} = require('../../src/auth/permissionCatalog');
const { CANONICAL_ALIAS_MAP } = require('../../src/constants/permissions');

const rootDir = path.resolve(__dirname, '../../..');
const backendSrc = path.join(rootDir, 'backend/src');
const frontendSrc = path.join(rootDir, 'frontend/src');

function collectFiles(dir, extensions = ['.js', '.jsx']) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'build') {
                files = files.concat(collectFiles(fullPath, extensions));
            }
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('Permission Usage Contract Tests', () => {
    const forbiddenPermissionStrings = [
        'VIEW_TOPICS',
        'TOPIC_APPROVE',
        'PROJECT_PERIOD_MANAGE',
        'DEFENSE_COUNCIL_ASSIGN',
        'DEFENSE_SCORE_LOCK',
    ];

    test('no source files contain forbidden/junk permission strings', () => {
        const files = [...collectFiles(backendSrc), ...collectFiles(frontendSrc)];
        const violations = [];

        for (const file of files) {
            const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');

            for (const badStr of forbiddenPermissionStrings) {
                // Check if the exact token appears in the file
                const regex = new RegExp(`\\b${badStr}\\b`);
                if (regex.test(content)) {
                    violations.push({ file: relPath, forbiddenCode: badStr });
                }
            }
        }

        expect(violations).toEqual([]);
    });

    test('all permission references in authorization consumers resolve to valid catalog entries', () => {
        const backendFiles = collectFiles(backendSrc);
        const invalidReferences = [];

        for (const file of backendFiles) {
            const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
            if (relPath.includes('src/constants/permissions.js') || relPath.includes('src/auth/permissionCatalog.js')) {
                continue;
            }

            const content = fs.readFileSync(file, 'utf8');

            // 1. permissions.includes('...')
            const includesRegex = /permissions\.includes\(\s*['"]([A-Z0-9_]+)['"]\s*\)/g;
            let match;
            while ((match = includesRegex.exec(content)) !== null) {
                const code = match[1];
                if (!normalizePermissionCode(code)) {
                    invalidReferences.push({ file: relPath, code, context: 'permissions.includes' });
                }
            }

            // 2. PERMISSIONS.<CODE>
            const permissionsDotRegex = /PERMISSIONS\.([A-Z0-9_]+)/g;
            while ((match = permissionsDotRegex.exec(content)) !== null) {
                const code = match[1];
                if (!normalizePermissionCode(code)) {
                    invalidReferences.push({ file: relPath, code, context: 'PERMISSIONS.<CODE>' });
                }
            }
        }

        expect(invalidReferences).toEqual([]);
    });

    test('every canonical permission in PERMISSION_DEFINITIONS has complete metadata', () => {
        expect(PERMISSION_DEFINITIONS.length).toBeGreaterThan(0);

        for (const def of PERMISSION_DEFINITIONS) {
            expect(def.code).toBeDefined();
            expect(isCanonicalPermissionCode(def.code)).toBe(true);
            expect(['VIEW', 'ACTION']).toContain(def.kind);
            expect(['TECHNICAL', 'ACADEMIC', 'STUDENT_BASE']).toContain(def.protectedDomain);
            expect(Array.isArray(def.eligibleRoles)).toBe(true);
            expect(def.eligibleRoles.length).toBeGreaterThan(0);
            expect(Array.isArray(def.scopeTypes)).toBe(true);
            expect(def.scopeTypes.length).toBeGreaterThan(0);
        }
    });
});

