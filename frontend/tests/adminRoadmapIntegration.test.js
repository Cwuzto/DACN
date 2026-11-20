import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminDashboardPath = path.join(root, 'src/pages/admin/DashboardPage.jsx');

const read = (p) => fs.readFileSync(p, 'utf8');

test('Step 1: File existence and adherence to UTF-8 without BOM (Rule 2.4)', () => {
    assert.ok(fs.existsSync(adminDashboardPath), 'DashboardPage.jsx must exist');
    const buf = fs.readFileSync(adminDashboardPath);
    assert.ok(buf.length > 0, 'DashboardPage.jsx must not be empty');
    const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    assert.equal(hasBOM, false, 'DashboardPage.jsx must not have UTF-8 BOM');
});

test('Step 2: Rule 2.1 compliance - No legacy group/groupMember references', () => {
    const src = read(adminDashboardPath);
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'Must not reference legacy groupMember');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'Must not reference legacy groupMembers');
    assert.doesNotMatch(src, /\bgroupId\b/i, 'Must not reference legacy groupId');
});

test('Step 3: Rule 2.6 compliance - Button text without raw emojis, pure Vietnamese labels, and @ant-design/icons', () => {
    const src = read(adminDashboardPath);
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

test('Step 4: Component contract - imports AcademicRoadmapStepper and renders with role="ADMIN"', () => {
    const src = read(adminDashboardPath);

    // Verify import
    assert.match(
        src,
        /import\s+AcademicRoadmapStepper\s+from\s+['"]\.\.\/\.\.\/components\/common\/AcademicRoadmapStepper['"]/,
        'Must import AcademicRoadmapStepper from ../../components/common/AcademicRoadmapStepper'
    );

    // Verify usage
    assert.match(
        src,
        /<AcademicRoadmapStepper[\s\S]*?role="ADMIN"[\s\S]*?\/>/,
        'Must render AcademicRoadmapStepper with role="ADMIN"'
    );
    assert.match(src, /progressPercent=\{adminProgressPercent\}/, 'Must pass progressPercent={adminProgressPercent}');
    assert.match(src, /milestones=\{adminMilestones\}/, 'Must pass milestones={adminMilestones}');
    assert.match(
        src,
        /badgeLabel=\{`\$\{completedStagesCount\}\/\$\{roadmapStages\.length\s*\|\|\s*6\}\s*Mốc\s*hoàn\s*tất`\}/,
        'Must pass badgeLabel showing completed stages over total stages'
    );
    assert.match(
        src,
        /subtitle="Trạng thái thực thi các mốc nghiệp vụ học kỳ theo cấu hình đợt và dữ liệu thực tế"/,
        'Must render correct subtitle'
    );
});

test('Step 5: Milestone mapping - preserves stage.target navigation dynamically, maps 6 stages with correct icons and styles', () => {
    const src = read(adminDashboardPath);

    // 6 Step Colors
    assert.match(src, /#0F766E/, 'Milestone 1 must use #0F766E');
    assert.match(src, /#0284C7/, 'Milestone 2 must use #0284C7');
    assert.match(src, /#4F46E5/, 'Milestone 3 must use #4F46E5');
    assert.match(src, /#7C3AED/, 'Milestone 4 must use #7C3AED');
    assert.match(src, /#D97706/, 'Milestone 5 must use #D97706');
    assert.match(src, /#059669/, 'Milestone 6 must use #059669');

    // Soft backgrounds
    assert.match(src, /#F0FDFA/, 'Milestone 1 must have #F0FDFA soft bg');
    assert.match(src, /#F0F9FF/, 'Milestone 2 must have #F0F9FF soft bg');
    assert.match(src, /#EEF2FF/, 'Milestone 3 must have #EEF2FF soft bg');
    assert.match(src, /#F5F3FF/, 'Milestone 4 must have #F5F3FF soft bg');
    assert.match(src, /#FFFBEB/, 'Milestone 5 must have #FFFBEB soft bg');
    assert.match(src, /#ECFDF5/, 'Milestone 6 must have #ECFDF5 soft bg');

    // Dynamic target navigation preserved
    assert.match(src, /handleNavigateTarget\(stage\.target\)/, 'Must call handleNavigateTarget(stage.target)');

    // State mapping
    assert.match(
        src,
        /stage\.state === 'COMPLETED' \? 'completed' : \s*\(?stage\.state === 'ACTIVE' \? 'active' : 'pending'\)?/,
        'Must map stage.state to completed, active, or pending'
    );

    // subText mapping
    assert.match(src, /typeof stage\.count === 'number' \? `\$\{stage\.count\} Hồ sơ` : ''/, 'Must map subText with count');
});

test('Step 6: Milestone mapping and progress calculation unit tests', () => {
    // Pure logic simulation of the admin roadmap computation
    const mockRoadmapStages = [
        {
            step: 1,
            key: 'REGISTRATION',
            title: '1. Đăng ký đề tài',
            date: '2026-09-01T00:00:00.000Z',
            datePrefix: 'Hạn ĐK',
            count: 45,
            state: 'COMPLETED',
            target: '/admin/project-enrollments?semesterId=42',
        },
        {
            step: 2,
            key: 'BM01',
            title: '2. Đề cương BM01',
            date: '2026-09-20T00:00:00.000Z',
            datePrefix: 'Hạn nộp',
            count: 40,
            state: 'COMPLETED',
            target: '/admin/outline-councils?semesterId=42',
        },
        {
            step: 3,
            key: 'BM02',
            title: '3. Đơn BM02 & QĐ',
            date: null,
            datePrefix: 'Mốc',
            count: 38,
            state: 'ACTIVE',
            target: '/admin/project-enrollments?semesterId=42',
        },
        {
            step: 4,
            key: 'BM03',
            title: '4. Tiến độ BM03',
            date: '2026-10-15T00:00:00.000Z',
            datePrefix: 'Giữa kỳ',
            count: 0,
            state: 'UPCOMING',
            target: '/admin/oversight?semesterId=42',
        },
        {
            step: 5,
            key: 'BM04',
            title: '5. Nhận xét BM04',
            date: null,
            datePrefix: 'Mở từ',
            count: 0,
            state: 'UPCOMING',
            target: '/admin/defense-councils?semesterId=42',
        },
        {
            step: 6,
            key: 'BM05',
            title: '6. Bảo vệ & Lưu chiểu',
            date: '2026-12-01T00:00:00.000Z',
            datePrefix: 'Dự kiến',
            count: 0,
            state: 'UPCOMING',
            target: '/admin/grading?semesterId=42',
        },
    ];

    const completedStagesCount = mockRoadmapStages.filter((s) => s.state === 'COMPLETED').length;
    assert.equal(completedStagesCount, 2, 'Should count 2 completed stages');

    const adminProgressPercent = Math.round((completedStagesCount / (mockRoadmapStages.length || 6)) * 100);
    assert.equal(adminProgressPercent, 33, 'Progress percent should be 33% (2/6)');

    const STAGE_STYLE_VARS = {
        1: { '--step-color': '#0F766E', '--step-soft': '#F0FDFA', '--step-border': '#99F6E4' },
        2: { '--step-color': '#0284C7', '--step-soft': '#F0F9FF', '--step-border': '#BAE6FD' },
        3: { '--step-color': '#4F46E5', '--step-soft': '#EEF2FF', '--step-border': '#C7D2FE' },
        4: { '--step-color': '#7C3AED', '--step-soft': '#F5F3FF', '--step-border': '#DDD6FE' },
        5: { '--step-color': '#D97706', '--step-soft': '#FFFBEB', '--step-border': '#FDE68A' },
        6: { '--step-color': '#059669', '--step-soft': '#ECFDF5', '--step-border': '#A7F3D0' },
    };

    const adminMilestones = mockRoadmapStages.map((stage, idx) => ({
        key: stage.key || `admin-stage-${stage.step || idx + 1}`,
        stepNumber: stage.step || idx + 1,
        title: stage.title,
        subText: typeof stage.count === 'number' ? `${stage.count} Hồ sơ` : '',
        dateText: stage.date ? `${stage.datePrefix ? `${stage.datePrefix}: ` : ''}2026` : 'Chưa đặt mốc',
        state: stage.state === 'COMPLETED' ? 'completed' : stage.state === 'ACTIVE' ? 'active' : 'pending',
        target: stage.target,
        styleVars: STAGE_STYLE_VARS[stage.step || idx + 1],
    }));

    assert.equal(adminMilestones.length, 6);
    assert.equal(adminMilestones[0].state, 'completed');
    assert.equal(adminMilestones[0].subText, '45 Hồ sơ');
    assert.equal(adminMilestones[0].target, '/admin/project-enrollments?semesterId=42');
    assert.equal(adminMilestones[1].state, 'completed');
    assert.equal(adminMilestones[2].state, 'active');
    assert.equal(adminMilestones[3].state, 'pending');
    assert.equal(adminMilestones[3].dateText.includes('Giữa kỳ:'), true);
    assert.equal(adminMilestones[4].dateText, 'Chưa đặt mốc');
});
