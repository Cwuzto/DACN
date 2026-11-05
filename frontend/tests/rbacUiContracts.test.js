import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const gradingSource = readFileSync(new URL('../src/pages/admin/GradingDefensePage.jsx', import.meta.url), 'utf8');
const oversightSource = readFileSync(new URL('../src/pages/admin/ProjectOversightPage.jsx', import.meta.url), 'utf8');
const periodSource = readFileSync(new URL('../src/pages/admin/ProjectPeriodPage.jsx', import.meta.url), 'utf8');
const protectedRouteSource = readFileSync(new URL('../src/components/common/ProtectedRoute.jsx', import.meta.url), 'utf8');

test('platform admin and oversight routes require PROJECT_OVERSIGHT_MANAGE instead of LEGACY_REVIEW_MANAGE', () => {
    assert.doesNotMatch(appSource, /LEGACY_REVIEW_MANAGE/);
    assert.match(appSource, /PROJECT_OVERSIGHT_MANAGE/);

    for (const permission of [
        'REPORT_VIEW',
        'USER_MANAGE',
        'PERMISSION_GROUP_MANAGE',
        'SEMESTER_MANAGE',
        'ENROLLMENT_MANAGE',
        'PROJECT_CATALOG_MANAGE',
        'PUBLIC_ANNOUNCEMENT_MANAGE',
        'PORTAL_CONTENT_MANAGE',
        'NOTIFICATION_MANAGE',
        'RUBRIC_MANAGE',
        'PROJECT_OVERSIGHT_MANAGE',
    ]) {
        assert.match(appSource, new RegExp(`(?:requiredPermissions|requiredAnyPermissions|requiredPermission)=\\{\\[?[^\\}]*'${permission}'`));
    }
});

test('ProtectedRoute supports requiredPermission prop and routes are guarded with VIEW_* capabilities', () => {
    // ProtectedRoute supports requiredPermission
    assert.match(protectedRouteSource, /requiredPermission/);

    // Key view capabilities guarding routes
    const viewCapabilities = [
        'VIEW_MY_REGISTRATION',
        'VIEW_MY_SUBMISSIONS',
        'VIEW_MY_GRADES',
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_DEFENSE_GRADING',
        'VIEW_BM02_REVIEWS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'VIEW_ACADEMIC_DELEGATIONS',
        'VIEW_PROJECT_PERIODS',
        'VIEW_PROJECT_ENROLLMENTS',
        'VIEW_ALL_TOPICS',
        'VIEW_PROJECT_OVERSIGHT',
        'VIEW_COUNCIL_ASSIGNMENTS',
        'VIEW_DEFENSE_LOCK_LEDGER',
        'VIEW_RUBRIC_CONFIG',
        'VIEW_USERS',
        'VIEW_PERMISSIONS',
        'VIEW_ANNOUNCEMENTS',
        'VIEW_PORTAL_CONTENT',
        'VIEW_NOTIFICATIONS',
    ];

    for (const cap of viewCapabilities) {
        assert.match(appSource, new RegExp(cap), `App.jsx route guards should include capability ${cap}`);
    }
});

test('dashboard aliases (/admin/dashboard, /lecturer/dashboard, /student/dashboard) remain valid under AppLayout', () => {
    assert.match(appSource, /path="\/admin"/);
    assert.match(appSource, /path="\/lecturer"/);
    assert.match(appSource, /path="\/student"/);
    assert.match(appSource, /path="dashboard"/);
    assert.match(appSource, /path="\/dashboard"/);
    assert.match(appSource, /AppLayout/);
});

test('navigation filters by permissions and institute route has no group fallback', () => {
    assert.match(layoutSource, /new Set\(user\?\.permissions \|\| \[\]\)/);
    assert.match(layoutSource, /item\.permissions\.every/);
    assert.match(layoutSource, /permissionSet\.has\('PROJECT_ASSIGNMENT_PUBLISH'\)/);
    assert.doesNotMatch(appSource, /allowedPermissionGroups=\{\['VIEN_TRUONG'\]\}/);
});

test('lecturer workflow routes and navigation require academic capabilities', () => {
    for (const permission of [
        'BM03_REVIEW',
        'TOPIC_CREATE',
        'TOPIC_UPDATE_OWN',
        'MENTOR_REQUEST_REVIEW',
        'OUTLINE_REVIEW',
    ]) {
        assert.match(appSource, new RegExp(`(?:requiredPermissions|requiredAnyPermissions)=\\{\\[[^\\]]*'${permission}'`));
    }
});

test('defense and archive UI separates view, submit, lock, publish, and review capabilities', () => {
    for (const permission of [
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_SCORE_SUBMIT',
        'RESULT_LOCK',
        'RESULT_PUBLISH',
        'FINAL_DOCUMENT_REVIEW',
    ]) {
        assert.match(`${appSource}\n${layoutSource}\n${gradingSource}\n${oversightSource}`, new RegExp(permission));
    }
    assert.match(appSource, /requiredAnyPermissions=\{\[[^\]]*'OUTLINE_COUNCIL_MANAGE'[^\]]*'DEFENSE_COUNCIL_MANAGE'[^\]]*\]\}/);
    assert.match(gradingSource, /canSubmitScore && <button/);
    assert.match(gradingSource, /canLockResult && \(r\.scoreLocked/);
    assert.match(gradingSource, /canPublishResult && <button/);
    assert.match(oversightSource, /!isApproved && canReviewArchive/);
});

test('ProjectPeriodPage embeds academic delegations tab for VIEW_ACADEMIC_DELEGATIONS or PERMISSION_ASSIGN_ACADEMIC with idempotency', () => {
    assert.match(periodSource, /tab=delegations|'delegations'/);
    assert.match(periodSource, /VIEW_ACADEMIC_DELEGATIONS/);
    assert.match(periodSource, /PERMISSION_ASSIGN_ACADEMIC/);
    assert.match(periodSource, /\/api\/delegations|delegationService/);
    assert.match(periodSource, /Idempotency-Key|crypto\.randomUUID/);
});

test('action CTA buttons in views rely on allowedActions contract', () => {
    const studentDashSource = readFileSync(new URL('../src/pages/student/StudentDashboardPage.jsx', import.meta.url), 'utf8');
    const lecturerDashSource = readFileSync(new URL('../src/pages/lecturer/LecturerDashboardPage.jsx', import.meta.url), 'utf8');
    assert.match(studentDashSource, /allowedActions/);
    assert.match(lecturerDashSource, /allowedActions/);
});
