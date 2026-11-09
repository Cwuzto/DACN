import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('CouncilAssignmentPage connects auto-assign outline API and safe reopen modal', () => {
    const pageSource = read('src/pages/admin/CouncilAssignmentPage.jsx');

    // Auto assignment for outline councils
    assert.match(pageSource, /autoAssignOutlineCouncils/);
    assert.match(pageSource, /Tự động phân công HĐ Đề cương/);

    // Reopen modal and action triggers
    assert.match(pageSource, /handleOpenReopenModal/);
    assert.match(pageSource, /reopenResults/);
    assert.match(pageSource, /Mở khóa kết quả/);

    // Conflict 409 BM02 dependency error handling
    assert.match(pageSource, /BM02_DEPENDENCY_EXISTS|blockingRegistrations/);
    assert.match(pageSource, /reopenBlockingList/);
    assert.match(pageSource, /reopenReason/);
});
