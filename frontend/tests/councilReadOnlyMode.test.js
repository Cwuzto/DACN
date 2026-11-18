import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const assignmentPagePath = path.resolve(frontendRoot, 'src/pages/admin/CouncilAssignmentPage.jsx');
const detailPagePath = path.resolve(frontendRoot, 'src/pages/admin/CouncilDetailPage.jsx');

test('Council Read-Only & Integrity: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    for (const filePath of [assignmentPagePath, detailPagePath]) {
        assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
        const buf = fs.readFileSync(filePath);
        assert.ok(buf.length >= 3, 'File must not be empty');
        const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
        assert.equal(hasBom, false, `File must not contain UTF-8 BOM: ${filePath}`);
    }
});

test('Council Read-Only & Integrity: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const rawCharPattern = /[←→🤖📋✓✏️👥🗑️🔓▾▴↗]/;

    for (const filePath of [assignmentPagePath, detailPagePath]) {
        const src = fs.readFileSync(filePath, 'utf8');
        const buttonRegex = /<(?:Button|button)[^>]*>([\s\S]*?)<\/(?:Button|button)>/g;
        let match;
        while ((match = buttonRegex.exec(src)) !== null) {
            const buttonContent = match[1];
            const textOnly = buttonContent.replace(/<[^>]+>/g, '').trim();
            if (textOnly) {
                assert.ok(
                    !rawCharPattern.test(textOnly),
                    `Button in ${path.basename(filePath)} contains raw emoji or graphic character in text label: "${textOnly}"`
                );
            }
        }
    }
});

test('CouncilAssignmentPage: Implements isSemesterCompleted banner and locks mutations', () => {
    const src = fs.readFileSync(assignmentPagePath, 'utf8');

    // 1. isSemesterCompleted logic
    assert.match(src, /isSemesterCompleted\s*=\s*currentSemesterObj\?\.status\s*===\s*['"]COMPLETED['"]/, 'Must detect COMPLETED semester');

    // 2. Read-only Alert Banner
    assert.match(src, /Đợt đồ án đã kết thúc — Chế độ chỉ đọc \(Read-only\)/, 'Must render Read-only Alert title');
    assert.match(src, /khóa cố định nhằm bảo toàn tính toàn vẹn của dữ liệu học vụ/, 'Must explain immutability in description');

    // 3. Header Action Disabling
    assert.match(src, /disabled=\{!selectedSemester\s*\|\|\s*isSemesterCompleted\}/, 'Header actions must be disabled when completed');

    // 4. Matcher pane student remove guard
    assert.match(src, /const\s+hasDefenseScore\s*=\s*Boolean\(reg\.defenseResult/, 'Must check defenseResult');
    assert.match(src, /const\s+isDefended\s*=\s*\['DEFENDED',\s*'DEFENSE_PASSED',\s*'DEFENSE_FAILED',\s*'COMPLETED'\]\.includes/, 'Must check defended statuses');
    assert.match(src, /const\s+hasOutlineEval\s*=\s*Boolean\(reg\.bM01Evaluations/, 'Must check outline evaluations');
    assert.match(src, /const\s+isRemoveDisabled\s*=\s*isSemesterCompleted\s*\|\|\s*isGradedOrEvaluated/, 'Must disable removal when completed or graded');

    // 5. Council card actions and Table view actions
    assert.match(src, /disabled=\{isSemesterCompleted\}/, 'Council edits must be disabled when completed');
    assert.match(src, /disabled=\{!hasEnoughMembers\s*\|\|\s*isSemesterCompleted\}/, 'Student assign must be disabled when completed');
    assert.match(src, /!isSemesterCompleted\s*&&\s*\([\s\S]*?Popconfirm[\s\S]*?handleDeleteCouncil/, 'Council deletion must be completely blocked when completed');
});

test('CouncilDetailPage: Implements isSemesterCompleted banner and locks student removal/actions', () => {
    const src = fs.readFileSync(detailPagePath, 'utf8');

    // 1. isSemesterCompleted logic
    assert.match(src, /isSemesterCompleted\s*=\s*council\?\.semester\?\.status\s*===\s*['"]COMPLETED['"]/, 'Must detect COMPLETED semester on council detail');

    // 2. Read-only Alert Banner
    assert.match(src, /Đợt đồ án đã kết thúc — Chế độ chỉ đọc \(Read-only\)/, 'Detail page must render Read-only Alert banner');

    // 3. Header buttons disabling
    assert.match(src, /handleConfirmAndPublishDefenseSchedule[\s\S]*?disabled=\{isSemesterCompleted\}/, 'Publish schedule must be disabled when completed');
    assert.match(src, /openEditModal[\s\S]*?disabled=\{isSemesterCompleted\}/, 'Edit council must be disabled when completed');
    assert.match(src, /openMemberModal[\s\S]*?disabled=\{isSemesterCompleted\}/, 'Member change must be disabled when completed');
    assert.match(src, /openAssignModal[\s\S]*?disabled=\{isSemesterCompleted\}/, 'Assign students must be disabled when completed');

    // 4. Registration table actions
    assert.match(src, /const\s+isRemoveDisabled\s*=\s*isSemesterCompleted\s*\|\|\s*isGradedOrEvaluated/, 'Detail page table must disable removal when completed or graded');
    assert.match(src, /Tooltip\s+title=\{tooltipMsg\}[\s\S]*?Button\s+size="small"\s+danger\s+disabled/, 'Must render disabled button with tooltip');
});
