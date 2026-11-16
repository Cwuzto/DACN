import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('ProgressTrackingPage meeting creation modal excludes "Nhiệm vụ cho kỳ tiếp theo" and "Hạn hoàn thành" inputs', () => {
    const pageSource = read('src/pages/lecturer/ProgressTrackingPage.jsx');

    // Verify modal does not render these input fields
    assert.ok(
        !pageSource.includes('Nhiệm vụ cho kỳ tiếp theo:'),
        'Modal must not contain "Nhiệm vụ cho kỳ tiếp theo:" field'
    );
    assert.ok(
        !pageSource.includes('Công việc kỳ tới...'),
        'Modal must not contain "Công việc kỳ tới..." placeholder'
    );
    assert.ok(
        !pageSource.includes('<label style={{ fontWeight: 600, fontSize: 13, display: \'block\', marginBottom: 4 }}>Hạn hoàn thành:</label>'),
        'Modal must not contain "Hạn hoàn thành:" input label in the form'
    );

    // Verify state variables are cleaned up
    assert.ok(
        !pageSource.includes('meetingNextTask'),
        'State variable meetingNextTask should be removed'
    );
});
