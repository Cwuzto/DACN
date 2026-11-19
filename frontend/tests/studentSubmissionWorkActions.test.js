import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 2 files exist and adhere strictly to UTF-8 without BOM', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentSubmissionActions.jsx',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must NOT have UTF-8 BOM`);
    }
});

test('Rule 2.1 compliance: No group/groupMember usage in student work action components', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentSubmissionActions.jsx',
    ];

    for (const file of files) {
        const src = read(file);
        assert.doesNotMatch(src, /\bgroupMember\b/i, `${file} must not reference groupMember`);
        assert.doesNotMatch(src, /\bgroupMembers\b/i, `${file} must not reference groupMembers`);
        assert.doesNotMatch(src, /\bgroupId\b/i, `${file} must not reference groupId`);
    }
});

test('Rule 2.6 compliance: Strict button icons and Vietnamese labels without raw emojis', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentSubmissionActions.jsx',
    ];

    const forbidden = /[🤖←→+📋✓✏️👥🗑️🔓▾▴↗✕🖨️⚠️]/;

    for (const f of files) {
        const src = read(f);
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} Button label "${label}" contains forbidden symbol/emoji`);
        }

        // HTML button tags check as well
        const htmlBtnRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
        while ((match = htmlBtnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} HTML button label "${label}" contains forbidden symbol/emoji`);
        }
    }
});

test('StudentWorkActions delegates BM01, BM02, and BM02-A work items to StudentSubmissionActions', () => {
    const src = read('src/components/student/work/StudentWorkActions.jsx');

    assert.match(src, /import\s+StudentSubmissionActions\s+from\s+['"]\.\/StudentSubmissionActions['"]/, 'StudentWorkActions must import StudentSubmissionActions');
    assert.match(src, /export\s+default\s+function\s+StudentWorkActions/, 'StudentWorkActions must have default export');

    // Kind delegation checks
    assert.match(src, /BM01_INITIAL|SUBMIT_BM01|BM01/, 'StudentWorkActions must handle BM01 Initial kinds');
    assert.match(src, /BM01_RESUBMISSION|RESUBMIT_BM01/, 'StudentWorkActions must handle BM01 Resubmission kinds');
    assert.match(src, /BM02|SUBMIT_BM02/, 'StudentWorkActions must handle BM02 kinds');
    assert.match(src, /BM02_A|BM02A|TITLE_ADJUSTMENT/, 'StudentWorkActions must handle BM02-A kinds');

    // Pass required props down
    assert.match(src, /registration/, 'Must forward registration');
    assert.match(src, /sources/, 'Must forward sources');
    assert.match(src, /onCompleted/, 'Must forward onCompleted');
});

test('StudentSubmissionActions implements BM01 v1/v2 workflows with outlineService and AI Copilot', () => {
    const src = read('src/components/student/work/StudentSubmissionActions.jsx');

    // Service imports
    assert.match(src, /import\s+.*outlineService.*from\s+['"].*outlineService['"]/, 'Must import outlineService');
    assert.match(src, /import\s+.*aiService.*from\s+['"].*aiService['"]/, 'Must import aiService');
    assert.match(src, /import\s+BM01CopilotDrawer\s+from\s+['"].*BM01CopilotDrawer['"]/, 'Must import BM01CopilotDrawer');
    assert.match(src, /import\s+HybridBMFormModal\s+from\s+['"].*HybridBMFormModal['"]/, 'Must import HybridBMFormModal');

    // BM01 Initial and Resubmission logic
    assert.match(src, /submitInitialOutline/, 'Must call outlineService.submitInitialOutline');
    assert.match(src, /submitResubmission/, 'Must call outlineService.submitResubmission');
    assert.match(src, /INITIAL_SUBMISSION_ALREADY_USED/, 'Must handle INITIAL_SUBMISSION_ALREADY_USED error');
    assert.match(src, /RESUBMISSION_ALREADY_USED/, 'Must handle RESUBMISSION_ALREADY_USED error');

    // Warning and AI guidance
    assert.match(src, /Bản nộp đầu tiên là bản chính thức và không thể thay thế/, 'Must display initial submission immutable warning');
    assert.match(src, /Chỉ được nộp lại đúng 01 lần duy nhất|chỉ được nộp lại duy nhất 01 lần/i, 'Must display single resubmission attempt warning');
    assert.match(src, /analyzeBM01/, 'Must trigger aiService.analyzeBM01');
    assert.match(src, /RobotOutlined/, 'Must use RobotOutlined for AI Copilot button');
});

test('StudentSubmissionActions implements BM02 submission and verification with registrationService', () => {
    const src = read('src/components/student/work/StudentSubmissionActions.jsx');

    assert.match(src, /import\s+.*registrationService.*from\s+['"].*registrationService['"]/, 'Must import registrationService');
    assert.match(src, /submitBM02/, 'Must call registrationService.submitBM02');
    assert.match(src, /getBM02Verification/, 'Must call registrationService.getBM02Verification');
    assert.match(src, /BM02_NEEDS_REVISION/, 'Must handle BM02_NEEDS_REVISION status');
    assert.match(src, /issues/, 'Must display issues/requirements when BM02 needs revision');
});

test('StudentSubmissionActions integrates TitleAdjustmentModal for BM02-A within 7 days', () => {
    const src = read('src/components/student/work/StudentSubmissionActions.jsx');

    assert.match(src, /import\s+TitleAdjustmentModal\s+from\s+['"].*TitleAdjustmentModal['"]/, 'Must import TitleAdjustmentModal');
    assert.match(src, /TitleAdjustmentModal/, 'Must render TitleAdjustmentModal');
    assert.match(src, /decisionPublishedAt|decisionDate/, 'Must evaluate decision publication date');
    assert.match(src, /168|7\s*(\*|\.|\b)/, 'Must check 7 days / 168 hours window');
});

test('StudentSubmissionActions adheres to conditional mounting: no blank print modals or eager sheets', () => {
    const src = read('src/components/student/work/StudentSubmissionActions.jsx');

    assert.match(src, /AcademicFormPrintModal/, 'Must import AcademicFormPrintModal');
    assert.match(src, /BM01PrintSheet/, 'Must import BM01PrintSheet');
    assert.match(src, /BM02PrintSheet/, 'Must import BM02PrintSheet');

    // Condition guards for print
    assert.match(src, /printBlockedReason/, 'Must provide printBlockedReason when data is missing');
    assert.match(src, /Chưa có dữ liệu nộp BM02 để in/, 'Must guard BM02 print with empty message');

    // Modal conditional rendering
    assert.match(src, /onCompleted/, 'Must invoke onCompleted callback upon successful submission');
});
