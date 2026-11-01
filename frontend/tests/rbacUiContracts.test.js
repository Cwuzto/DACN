import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const gradingSource = readFileSync(new URL('../src/pages/admin/GradingDefensePage.jsx', import.meta.url), 'utf8');
const oversightSource = readFileSync(new URL('../src/pages/admin/ProjectOversightPage.jsx', import.meta.url), 'utf8');

test('platform admin routes require the same capabilities as backend routes', () => {
    for (const permission of [
        'REPORT_VIEW',
        'USER_MANAGE',
        'PERMISSION_GROUP_MANAGE',
        'SEMESTER_MANAGE',
        'ENROLLMENT_MANAGE',
        'PROJECT_CATALOG_MANAGE',
        'PUBLIC_ANNOUNCEMENT_MANAGE',
        'NOTIFICATION_MANAGE',
        'RUBRIC_MANAGE',
        'LEGACY_REVIEW_MANAGE',
    ]) {
        assert.match(appSource, new RegExp(`requiredPermissions=\\{\\[[^\\]]*'${permission}'`));
        assert.match(layoutSource, new RegExp(`permissions: \\[[^\\]]*'${permission}'`));
    }
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
        assert.match(appSource, new RegExp(`requiredPermissions=\\{\\[[^\\]]*'${permission}'`));
        assert.match(layoutSource, new RegExp(`permissions: \\[[^\\]]*'${permission}'`));
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
    assert.match(appSource, /requiredAnyPermissions=\{\['OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE'\]\}/);
    assert.match(gradingSource, /canSubmitScore && <button/);
    assert.match(gradingSource, /canLockResult && \(r\.scoreLocked/);
    assert.match(gradingSource, /canPublishResult && <button/);
    assert.match(oversightSource, /!isApproved && canReviewArchive/);
});
