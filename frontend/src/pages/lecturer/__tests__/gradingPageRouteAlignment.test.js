import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('GradingPage navigates to /lecturer/grading/sheet/:registrationId instead of /lecturer/grading/:registrationId', () => {
    const filePath = path.resolve(__dirname, '../GradingPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must NOT contain old route without /sheet/
    assert.doesNotMatch(
        content,
        /navigate\(`\/lecturer\/grading\/\$\{cand\.id\}`\)/,
        'Old route /lecturer/grading/${cand.id} should be replaced with /lecturer/grading/sheet/${cand.id}'
    );

    // Must contain aligned sheet route
    assert.match(
        content,
        /navigate\(`\/lecturer\/grading\/sheet\/\$\{cand\.id\}`\)/,
        'Must navigate to /lecturer/grading/sheet/${cand.id} to match App.jsx route'
    );
});
