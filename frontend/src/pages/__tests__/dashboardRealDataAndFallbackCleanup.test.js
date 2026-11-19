import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 5: StudentDashboardPage connects real tasks, meeting logs, mentor score and eliminates all mock fallbacks', () => {
    const studentDashSrc = read('frontend/src/pages/student/StudentDashboardPage.jsx');

    // 1. Elimination of hardcoded '18 / 20h'
    assert.ok(
        !studentDashSrc.includes('18 / 20h'),
        'Hardcoded 18 / 20h must be completely eliminated'
    );
    assert.match(
        studentDashSrc,
        /dashboardData\?\.meetingLogsCount\s*\?\?\s*0\}\s*buổi/,
        'StudentDashboardPage must display real meetingLogsCount'
    );
    assert.match(
        studentDashSrc,
        /Số buổi trao đổi GVHD/,
        'StudentDashboardPage must use label "Số buổi trao đổi GVHD"'
    );

    // 2. Elimination of hardcoded '8.8 / 10'
    assert.ok(
        !studentDashSrc.includes('8.8 / 10'),
        'Hardcoded mentor score fallback 8.8 / 10 must be completely eliminated'
    );
    assert.match(
        studentDashSrc,
        /dashboardData\?\.mentorScore\s*!=\s*null\s*\?\s*`\$\{Number\(dashboardData\.mentorScore\)\.toFixed\(1\)\}\s*\/\s*10`\s*:\s*['"]Chưa đánh giá['"]/,
        'StudentDashboardPage must format real mentorScore or display "Chưa đánh giá"'
    );

    // 3. Elimination of hardcoded 'PGS.TS Lê Quang Dũng'
    assert.ok(
        !studentDashSrc.includes('PGS.TS Lê Quang Dũng'),
        'Mock mentor name PGS.TS Lê Quang Dũng must be completely removed'
    );
    assert.match(
        studentDashSrc,
        /dashboardData\?\.mentorFullName\s*\|\|\s*currentRegistration\?\.topic\?\.mentor\?\.user\?\.fullName\s*\|\|\s*currentRegistration\?\.topic\?\.mentorName\s*\|\|\s*['"]Chưa phân công['"]/,
        'StudentDashboardPage must resolve mentor name through real dashboardData and registration fields'
    );

    // 4. Elimination of hardcoded progress 65%
    assert.ok(
        !/\b65\b/.test(studentDashSrc),
        'Hardcoded 65% progress fallback must be completely removed'
    );
    assert.match(
        studentDashSrc,
        /getProgressPercentByStatus/,
        'StudentDashboardPage must calculate progress percent based on registration status'
    );

    // 5. Weekly tasks block eliminated and 6 milestones progress displayed
    assert.ok(
        !studentDashSrc.includes('Nhiệm vụ & Hạn nộp sắp tới'),
        'StudentDashboardPage must eliminate weekly tasks block'
    );
    assert.ok(
        !studentDashSrc.includes('Chưa có nhiệm vụ cần nộp trong đợt này'),
        'StudentDashboardPage must eliminate empty tasks fallback'
    );
    assert.match(
        studentDashSrc,
        /Mốc quy trình hoàn thành|Mốc tiến độ hoàn thành/,
        'StudentDashboardPage must display milestone completion KPI'
    );
    assert.match(
        studentDashSrc,
        /milestones\.filter[\s\S]*?completed[\s\S]*?length[\s\S]*?\/\s*6/,
        'StudentDashboardPage must compute completed milestones count over 6'
    );

    // 6. Elimination of mock download toasts
    assert.ok(
        !studentDashSrc.includes("message.success('Đang tải DeCuong_NghienCuu.docx...')"),
        'Mock download toast for DeCuong_NghienCuu must be eliminated'
    );
    assert.ok(
        !studentDashSrc.includes("message.success('Đang tải NhatKy_DanhGiaTienDo.docx...')"),
        'Mock download toast for NhatKy_DanhGiaTienDo must be eliminated'
    );
    assert.ok(
        !studentDashSrc.includes("message.success('Đang tải VCS_Defense_Slide.pptx...')"),
        'Mock download toast for VCS_Defense_Slide must be eliminated'
    );
    assert.match(
        studentDashSrc,
        /Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường/,
        'Form download buttons must explain official form availability'
    );
});

test('Task 5: ProgressTrackingPage eliminates fake progress (75) and fake meeting logs (8:4)', () => {
    const progressSrc = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');

    // 1. Elimination of ?? 75
    assert.ok(
        !progressSrc.includes('?? 75'),
        'ProgressTrackingPage must not fall back to fake 75% progress'
    );
    assert.ok(
        !/: 75\)/.test(progressSrc),
        'ProgressTrackingPage must not use ternary fallback to 75'
    );

    // 2. Elimination of (sPassed ? 8 : 4)
    assert.ok(
        !progressSrc.includes('sPassed ? 8 : 4'),
        'ProgressTrackingPage must not use fake meeting logs count (sPassed ? 8 : 4)'
    );
    assert.match(
        progressSrc,
        /s\._count\?\.meetingLogs\s*\?\?\s*s\.meetingLogs\?\.length\s*\?\?\s*0/,
        'ProgressTrackingPage must use real meetingLogs count with 0 fallback'
    );

    // 3. Elimination of weekly tasks tab and button, default to meeting-logs
    assert.ok(
        !progressSrc.includes('1. Nhiệm vụ tuần'),
        'ProgressTrackingPage must eliminate weekly tasks tab'
    );
    assert.ok(
        !progressSrc.includes('Giao việc mới'),
        'ProgressTrackingPage must eliminate "Giao việc mới" button from header'
    );
    assert.match(
        progressSrc,
        /Lưu nhật ký gặp hướng dẫn BM03, đánh giá tiến độ định kỳ và hoàn thiện phiếu nhận xét BM04\./,
        'ProgressTrackingPage must update header description'
    );
});

test('Task 5: DashboardPage eliminates triage fake numbers (14, 4, 2) and fake score distribution', () => {
    const adminDashSrc = read('frontend/src/pages/admin/DashboardPage.jsx');

    // 1. Elimination of triage fallbacks 14, 4, 2 and static triage cards
    assert.ok(
        !adminDashSrc.includes('?? 14'),
        'DashboardPage must not fall back to fake 14 pending registrations'
    );
    assert.ok(
        !adminDashSrc.includes('?? 4'),
        'DashboardPage must not fall back to fake 4 unassigned registrations'
    );
    assert.ok(
        !adminDashSrc.includes('?? 2'),
        'DashboardPage must not fall back to fake 2 upcoming defenses'
    );
    assert.match(
        adminDashSrc,
        /useAdminDashboardActions/,
        'DashboardPage must read action cards from useAdminDashboardActions'
    );

    // 2. Elimination of 4-level mock score distribution
    assert.ok(
        !adminDashSrc.includes('Xuất sắc (A)'),
        'DashboardPage must not return fake score distribution array'
    );
    assert.match(
        adminDashSrc,
        /Chưa có dữ liệu phân bổ điểm/,
        'DashboardPage must inform user when score distribution data is empty'
    );
});

test('Admin Dashboard reads independent scoped server panels without effect-level fallback data', () => {
    const src = read('frontend/src/pages/admin/DashboardPage.jsx');
    for (const hook of ['useAdminDashboardActions', 'useDashboardStats', 'useDashboardScores', 'useDashboardActivities', 'useDashboardOverview', 'useSemesters']) {
        assert.ok(src.includes(hook));
    }
    assert.doesNotMatch(src, /Promise\.all|setStats|setScoreDistribution|setActivities/);
    assert.match(src, /<QueryPanel query=\{scoresQuery\}/);
    assert.match(src, /<QueryPanel query=\{activitiesQuery\}/);
});

test('Task 5: HomePage eliminates fallback ?? 4 and fake English topics', () => {
    const homeSrc = read('frontend/src/pages/common/HomePage.jsx');

    // 1. Elimination of ?? 4
    assert.ok(
        !homeSrc.includes('?? 4'),
        'HomePage must not fall back to fake 4 mentored topics'
    );

    // 2. Elimination of fake English topic pills
    assert.ok(
        !homeSrc.includes('Event-Driven Architecture'),
        'Fake topic "Event-Driven Architecture" must be completely removed from HomePage'
    );
    assert.ok(
        !homeSrc.includes('Distributed Tracing'),
        'Fake topic "Distributed Tracing" must be completely removed from HomePage'
    );
    assert.ok(
        !homeSrc.includes('Fintech Core Engine'),
        'Fake topic "Fintech Core Engine" must be completely removed from HomePage'
    );
    assert.match(
        homeSrc,
        /Chưa có đề tài đề xuất/,
        'HomePage must display empty state message when faculty member has no mentored topics'
    );
});

test('Task 5: Rule 2.6 Button text integrity across all modified files', () => {
    const filesToCheck = [
        'frontend/src/pages/student/StudentDashboardPage.jsx',
        'frontend/src/pages/lecturer/ProgressTrackingPage.jsx',
        'frontend/src/pages/lecturer/LecturerDashboardPage.jsx',
        'frontend/src/pages/admin/DashboardPage.jsx',
        'frontend/src/pages/common/HomePage.jsx',
    ];

    const forbiddenSymbolsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚠️❌]/;

    filesToCheck.forEach((filePath) => {
        const fullContent = read(filePath);
        const buttonRegex = /<(?:button|Button)\b[^>]*>([\s\S]*?)<\/(?:button|Button)>/g;
        let match;
        while ((match = buttonRegex.exec(fullContent)) !== null) {
            const innerText = match[1];
            const textOnly = innerText.replace(/<[^>]+>/g, '').trim();
            if (forbiddenSymbolsRegex.test(textOnly)) {
                assert.fail(`Rule 2.6 violation in ${filePath}: Button contains forbidden symbol "${textOnly}" in: ${match[0]}`);
            }
        }
    });
});

test('LecturerDashboardPage uses unified overview components and eliminates fake metrics (82, 75, 4/7, 2 Hội đồng)', () => {
    const src = read('frontend/src/pages/lecturer/LecturerDashboardPage.jsx');
    assert.ok(!src.includes(': 82'), 'Must not fall back to fake 82%');
    assert.ok(!src.includes('2 Hội đồng'), 'Must not hardcode 2 Hội đồng');
    assert.ok(!src.includes('4/7'), 'Must not hardcode 4/7');
    assert.match(src, /OverviewKpis/);
    assert.match(src, /AttentionQueue/);
    assert.match(src, /SupervisedStudentList/);
});

test('Task 4: StudentDashboardPage uses useStudentDashboard + nextAction and eliminates fake decision/code/semester fallbacks', () => {
    const studentDashSrc = read('frontend/src/pages/student/StudentDashboardPage.jsx');
    assert.match(studentDashSrc, /useStudentDashboard/);
    assert.match(studentDashSrc, /nextAction/);

    const forbiddenFallbacks = [
        'DA-2026-KTPM-04',
        '458/QĐ',
        '20/09/2026',
        '2022 - 2026',
        'HK1 2026–2027',
    ];
    for (const literal of forbiddenFallbacks) {
        assert.equal(
            studentDashSrc.includes(literal),
            false,
            `StudentDashboardPage must not contain fake fallback literal "${literal}"`
        );
    }
});
