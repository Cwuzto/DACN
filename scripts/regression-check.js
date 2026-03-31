const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const run = (title, command, options = {}) => {
    process.stdout.write(`\n[CHECK] ${title}\n`);
    execSync(command, {
        cwd: repoRoot,
        stdio: 'inherit',
        ...options,
    });
    process.stdout.write(`[PASS] ${title}\n`);
};

const assertNoPattern = (title, filePath, pattern) => {
    process.stdout.write(`\n[CHECK] ${title}\n`);
    const fullPath = path.join(repoRoot, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (pattern.test(content)) {
        throw new Error(`Legacy pattern detected in ${filePath}: ${pattern}`);
    }
    process.stdout.write(`[PASS] ${title}\n`);
};

const npmLintCommand =
    process.platform === 'win32'
        ? 'cmd /c npm --prefix frontend run lint'
        : 'npm --prefix frontend run lint';

try {
    run('UTF-8 validation', 'node scripts/check-utf8.js');
    run('Frontend lint', npmLintCommand);
    run(
        'Backend route graph load',
        `node -e "require('./backend/src/routes/index'); console.log('routes-ok')"`
    );
    run(
        'Critical controllers load',
        `node -e "require('./backend/src/controllers/councilController'); require('./backend/src/controllers/registrationController'); require('./backend/src/controllers/notificationController'); console.log('controllers-ok')"`
    );

    assertNoPattern(
        'No legacy evaluations in council controller',
        'backend/src/controllers/councilController.js',
        /\bevaluations\b/g
    );
    assertNoPattern(
        'No legacy council lookup via defenseResult in registration controller',
        'backend/src/controllers/registrationController.js',
        /defenseResult\s*:\s*\{\s*councilId/g
    );
    assertNoPattern(
        'No legacy council counts in admin council page',
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        /_count\?\.(evaluations|groups)/g
    );

    process.stdout.write('\n[PASS] Regression check completed successfully.\n');
} catch (error) {
    process.stderr.write(`\n[FAIL] Regression check failed: ${error.message}\n`);
    process.exit(1);
}
