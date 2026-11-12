import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('ProgressTrackingPage declares sPassed before sProgress to prevent TDZ ReferenceError', () => {
    const filePath = path.resolve(__dirname, '../ProgressTrackingPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const sPassedIndex = content.indexOf('const sPassed =');
    const sProgressIndex = content.indexOf('const sProgress =');

    assert.ok(sPassedIndex !== -1, 'sPassed declaration must exist');
    assert.ok(sProgressIndex !== -1, 'sProgress declaration must exist');
    assert.ok(
        sPassedIndex < sProgressIndex,
        `Expected sPassed declaration (index ${sPassedIndex}) to appear before sProgress (index ${sProgressIndex}) to prevent TDZ`
    );
});
