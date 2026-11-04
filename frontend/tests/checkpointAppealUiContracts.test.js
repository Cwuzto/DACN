import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('archiveService exports submitPreDefenseArchive calling pre-defense API endpoint', () => {
    const serviceSource = read('src/services/archiveService.js');
    assert.match(serviceSource, /submitPreDefenseArchive\s*:\s*async/);
    assert.match(serviceSource, /\/archives\/.*pre-defense/);
});

test('SubmissionPage provides pre-defense checklist and archival submission when BM03_PASSED', () => {
    const pageSource = read('src/pages/student/SubmissionPage.jsx');
    assert.match(pageSource, /submitPreDefenseArchive/);
    assert.match(pageSource, /BM03_PASSED/);
    assert.match(pageSource, /Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt BM04/);
    assert.match(pageSource, /reportFileUrl/);
    assert.match(pageSource, /slideFileUrl/);
    assert.match(pageSource, /sourceCodeUrl/);
});

test('CheckpointAppealReviewModal enforces conflict-of-interest guard and handles APPROVED / REJECTED', () => {
    const modalPath = 'src/components/admin/CheckpointAppealReviewModal.jsx';
    assert.ok(fs.existsSync(path.join(root, modalPath)), 'CheckpointAppealReviewModal.jsx must exist');
    const modalSource = read(modalPath);
    assert.match(modalSource, /reviewCheckpointAppeal/);
    assert.match(modalSource, /Xung đột lợi ích: Giảng viên hướng dẫn không được thẩm định khiếu nại của sinh viên mình hướng dẫn/);
    assert.match(modalSource, /APPROVED/);
    assert.match(modalSource, /REJECTED/);
    assert.match(modalSource, /reviewNotes/);
});

test('ProjectOversightPage embeds checkpoint signature appeal review queue and modal', () => {
    const pageSource = read('src/pages/admin/ProjectOversightPage.jsx');
    assert.match(pageSource, /CheckpointAppealReviewModal/);
    assert.match(pageSource, /checkpointSignatureAppeals|CHECKPOINT_SIGNATURE_APPEAL/);
});
