import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lecturerDashboardPath = path.join(root, 'src/pages/lecturer/LecturerDashboardPage.jsx');

const read = (p) => fs.readFileSync(p, 'utf8');

test('Step 1: File existence and adherence to UTF-8 without BOM (Rule 2.4)', () => {
    assert.ok(fs.existsSync(lecturerDashboardPath), 'LecturerDashboardPage.jsx must exist');
    const buf = fs.readFileSync(lecturerDashboardPath);
    assert.ok(buf.length > 0, 'LecturerDashboardPage.jsx must not be empty');
    const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    assert.equal(hasBOM, false, 'LecturerDashboardPage.jsx must not have UTF-8 BOM');
});

test('Step 2: Rule 2.1 compliance - No legacy group/groupMember references', () => {
    const src = read(lecturerDashboardPath);
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'Must not reference legacy groupMember');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'Must not reference legacy groupMembers');
    assert.doesNotMatch(src, /\bgroupId\b/i, 'Must not reference legacy groupId');
});

test('Step 3: Rule 2.6 compliance - Button text without raw emojis, pure Vietnamese labels, and @ant-design/icons', () => {
    const src = read(lecturerDashboardPath);
    const forbidden = /[🤖←→+📋✓✏️👥🗑️🔓▾▴↗✕🖨️⚠️]/;

    // Check Button elements for raw emojis / forbidden symbols in their text content
    const buttonBlocks = src.match(/<Button[^>]*>([\s\S]*?)<\/Button>/g) || [];
    assert.ok(buttonBlocks.length > 0, 'Must contain Button elements');
    for (const block of buttonBlocks) {
        const textContent = block.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
        if (textContent) {
            assert.ok(!forbidden.test(textContent), `Button text "${textContent}" must not contain forbidden symbols`);
        }
    }

    // Required icons imported from @ant-design/icons
    assert.match(src, /FormOutlined/, 'Must import FormOutlined for milestone 1');
    assert.match(src, /FileTextOutlined/, 'Must import FileTextOutlined for milestone 2');
    assert.match(src, /AuditOutlined/, 'Must import AuditOutlined for milestone 3');
    assert.match(src, /ScheduleOutlined/, 'Must import ScheduleOutlined for milestone 4');
    assert.match(src, /SafetyCertificateOutlined/, 'Must import SafetyCertificateOutlined for milestone 5');
    assert.match(src, /TrophyOutlined/, 'Must import TrophyOutlined for milestone 6');
});

test('Step 4: Component contract - imports AcademicRoadmapStepper and renders with role="LECTURER"', () => {
    const src = read(lecturerDashboardPath);

    // Verify import
    assert.match(
        src,
        /import\s+AcademicRoadmapStepper\s+from\s+['"]\.\.\/\.\.\/components\/common\/AcademicRoadmapStepper['"]/,
        'Must import AcademicRoadmapStepper from ../../components/common/AcademicRoadmapStepper'
    );

    // Verify usage
    assert.match(
        src,
        /<AcademicRoadmapStepper[\s\S]*?role="LECTURER"[\s\S]*?\/>/,
        'Must render AcademicRoadmapStepper with role="LECTURER"'
    );
    assert.match(src, /progressPercent=\{progressPercent\}/, 'Must pass progressPercent prop');
    assert.match(src, /milestones=\{lecturerMilestones\}/, 'Must pass milestones={lecturerMilestones}');
    assert.match(src, /badgeLabel=\{`\$\{progressPercent\}% Tiến độ TB`\}/, 'Must pass badgeLabel with average progress');
});

test('Step 5: 6 milestones defined with correct titles, colors, routes, and id="supervised-students-section"', () => {
    const src = read(lecturerDashboardPath);

    // id="supervised-students-section" must exist for smooth scroll anchor
    assert.match(src, /id="supervised-students-section"/, 'Must contain id="supervised-students-section" container');

    // Milestone titles
    assert.match(src, /title:\s*['"]1\.\s*Đăng ký đề tài['"]/, 'Milestone 1 title must be "1. Đăng ký đề tài"');
    assert.match(src, /title:\s*['"]2\.\s*Đề cương chi tiết['"]/, 'Milestone 2 title must be "2. Đề cương chi tiết"');
    assert.match(src, /title:\s*['"]3\.\s*Đơn ĐK chính thức['"]/, 'Milestone 3 title must be "3. Đơn ĐK chính thức"');
    assert.match(src, /title:\s*['"]4\.\s*Nhật ký tiến độ['"]/, 'Milestone 4 title must be "4. Nhật ký tiến độ"');
    assert.match(src, /title:\s*['"]5\.\s*Đánh giá GVHD['"]/, 'Milestone 5 title must be "5. Đánh giá GVHD"');
    assert.match(src, /title:\s*['"]6\.\s*Bảo vệ & Điểm số['"]/, 'Milestone 6 title must be "6. Bảo vệ & Điểm số"');

    // Navigation routes
    assert.match(src, /\/lecturer\/approvals/, 'Milestone 1 must navigate to /lecturer/approvals');
    assert.match(src, /\/lecturer\/outline-evaluations/, 'Milestone 2 must navigate to /lecturer/outline-evaluations');
    assert.match(src, /supervised-students-section/, 'Milestone 3 must scroll to supervised-students-section');
    assert.match(src, /\/lecturer\/progress\?tab=meeting-logs/, 'Milestone 4 must navigate to /lecturer/progress?tab=meeting-logs');
    assert.match(src, /\/lecturer\/progress\?tab=bm04/, 'Milestone 5 must navigate to /lecturer/progress?tab=bm04');
    assert.match(src, /\/lecturer\/grading/, 'Milestone 6 must navigate to /lecturer/grading');

    // Colors
    assert.match(src, /#0F766E/, 'Milestone 1 must use #0F766E');
    assert.match(src, /#0284C7/, 'Milestone 2 must use #0284C7');
    assert.match(src, /#4F46E5/, 'Milestone 3 must use #4F46E5');
    assert.match(src, /#7C3AED/, 'Milestone 4 must use #7C3AED');
    assert.match(src, /#D97706/, 'Milestone 5 must use #D97706');
    assert.match(src, /#059669/, 'Milestone 6 must use #059669');
});

test('Step 6: Milestone state and average progress calculation unit tests', () => {
    // Pure logic test simulating the exact milestone calculation
    const getMilestoneWeight = (status) => {
        if (status === 'PENDING' || status === 'REGISTERED') return 16;
        if (['APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED', 'TERMINATED_BM01'].includes(status)) return 33;
        if (['BM01_PASSED', 'BM02_OPEN', 'BM02_SUBMITTED', 'BM02_NEEDS_REVISION', 'BM02_RESUBMITTED', 'BM02_APPROVED', 'TERMINATED_BM02'].includes(status)) return 50;
        if (['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03', 'BM03_SIGNATURE_PENDING', 'TERMINATED_FAILED_PROGRESS'].includes(status)) return 66;
        if (['BM03_PASSED', 'BM04_REVIEW', 'TERMINATED_BM04'].includes(status)) return 83;
        if (['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'DEFENDED', 'DEFENSE_PASSED', 'COMPLETED'].includes(status)) return 100;
        return 0;
    };

    const calcProgress = (students) => {
        if (!students || students.length === 0) return 0;
        const total = students.reduce((sum, s) => sum + getMilestoneWeight(s?.status), 0);
        return Math.min(100, Math.round(total / students.length));
    };

    const calcMilestoneStates = (students) => {
        const buckets = [[], [], [], [], [], []];
        (students || []).forEach((s) => {
            const status = s?.status;
            if (status === 'PENDING' || status === 'REGISTERED') buckets[0].push(s);
            else if (['APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED', 'TERMINATED_BM01'].includes(status)) buckets[1].push(s);
            else if (['BM01_PASSED', 'BM02_OPEN', 'BM02_SUBMITTED', 'BM02_NEEDS_REVISION', 'BM02_RESUBMITTED', 'BM02_APPROVED', 'TERMINATED_BM02'].includes(status)) buckets[2].push(s);
            else if (['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03', 'BM03_SIGNATURE_PENDING', 'TERMINATED_FAILED_PROGRESS'].includes(status)) buckets[3].push(s);
            else if (['BM03_PASSED', 'BM04_REVIEW', 'TERMINATED_BM04'].includes(status)) buckets[4].push(s);
            else if (['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'DEFENDED', 'DEFENSE_PASSED', 'COMPLETED'].includes(status)) buckets[5].push(s);
        });

        return buckets.map((bucket, i) => {
            const count = bucket.length;
            const afterCount = buckets.slice(i + 1).reduce((acc, b) => acc + b.length, 0);
            const state = students.length > 0 ? (count > 0 ? 'active' : afterCount > 0 ? 'completed' : 'pending') : 'pending';
            return { count, state };
        });
    };

    // Case 1: Empty students array
    assert.equal(calcProgress([]), 0, 'Progress for 0 students must be 0');
    const emptyStates = calcMilestoneStates([]);
    assert.equal(emptyStates.length, 6);
    emptyStates.forEach((m, idx) => {
        assert.equal(m.count, 0, `Milestone ${idx + 1} count must be 0`);
        assert.equal(m.state, 'pending', `Milestone ${idx + 1} state must be pending when 0 students`);
    });

    // Case 2: 2 students in Mốc 4 (IN_PROGRESS)
    const midTermStudents = [{ status: 'IN_PROGRESS' }, { status: 'IN_PROGRESS_BM03' }];
    assert.equal(calcProgress(midTermStudents), 66, 'Progress for 2 mid-term students must be 66%');
    const midStates = calcMilestoneStates(midTermStudents);
    assert.equal(midStates[0].state, 'completed', 'Mốc 1 must be completed');
    assert.equal(midStates[1].state, 'completed', 'Mốc 2 must be completed');
    assert.equal(midStates[2].state, 'completed', 'Mốc 3 must be completed');
    assert.equal(midStates[3].state, 'active', 'Mốc 4 must be active');
    assert.equal(midStates[3].count, 2, 'Mốc 4 count must be 2');
    assert.equal(midStates[4].state, 'pending', 'Mốc 5 must be pending');
    assert.equal(midStates[5].state, 'pending', 'Mốc 6 must be pending');

    // Case 3: Mixed students across Mốc 2 and Mốc 5
    const mixedStudents = [{ status: 'BM01_SUBMITTED' }, { status: 'BM04_REVIEW' }];
    assert.equal(calcProgress(mixedStudents), Math.round((33 + 83) / 2));
    const mixedStates = calcMilestoneStates(mixedStudents);
    assert.equal(mixedStates[0].state, 'completed', 'Mốc 1 completed');
    assert.equal(mixedStates[1].state, 'active', 'Mốc 2 active (count 1)');
    assert.equal(mixedStates[2].state, 'completed', 'Mốc 3 completed (afterCount > 0)');
    assert.equal(mixedStates[3].state, 'completed', 'Mốc 4 completed (afterCount > 0)');
    assert.equal(mixedStates[4].state, 'active', 'Mốc 5 active (count 1)');
    assert.equal(mixedStates[5].state, 'pending', 'Mốc 6 pending');
});
