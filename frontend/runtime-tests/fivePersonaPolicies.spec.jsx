/**
 * Five-Persona Frontend Policy Runtime Tests (Task 10)
 *
 * Verifies:
 * 1. canViewFeature across 5 personas (STUDENT, GVHD, GIAO_VU, VIEN_TRUONG, QUAN_TRI_VIEN).
 * 2. canPerformFeatureAction strictly adhering to capability boundaries (no technical admin bypass).
 * 3. Scoped delegation evaluation with department, semester, and expiration context.
 * 4. getVisibleNavigation filtering based on effective capabilities.
 */

import { describe, expect, it } from 'vitest';
import {
    canViewFeature,
    canPerformFeatureAction,
    getVisibleNavigation,
    getEffectivePermissions,
} from '../src/auth/policyEvaluator.js';

// ==========================================
// 5 PERSONA FIXTURES
// ==========================================
const studentPersona = {
    id: 101,
    role: 'STUDENT',
    permissions: [
        'VIEW_MY_REGISTRATION',
        'REGISTER_TOPIC',
        'RENAME_TOPIC',
        'REGISTRATION_CANCEL',
        'VIEW_MY_SUBMISSIONS',
        'SUBMIT_BM01',
        'SUBMIT_BM02',
        'SUBMIT_TASK',
        'CHECKPOINT_SIGN',
        'SIGNATURE_APPEAL_SUBMIT',
        'VIEW_MY_ARCHIVE',
        'SUBMIT_PRE_DEFENSE_ARCHIVE',
        'SUBMIT_FINAL_ARCHIVE',
        'VIEW_MY_GRADES',
    ],
};

const gvhdPersona = {
    id: 201,
    role: 'LECTURER',
    permissions: [
        'VIEW_MY_TOPICS',
        'TOPIC_CREATE',
        'TOPIC_UPDATE_OWN',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_MENTOR_STUDENTS',
        'MENTOR_REQUEST_REVIEW',
        'VIEW_CHECKPOINTS',
        'CHECKPOINT_ISSUE',
        'BM03_REVIEW',
        'BM04_SUBMIT',
        'BM04_CREATE_AND_SIGN',
    ],
    hasDefenseCouncilAssignment: false,
    hasOutlineCouncilAssignment: false,
};

const gvhdCouncilPersona = {
    id: 202,
    role: 'LECTURER',
    permissions: [
        'VIEW_MY_TOPICS',
        'TOPIC_CREATE',
        'TOPIC_UPDATE_OWN',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'BM03_REVIEW',
        'BM04_SUBMIT',
        'BM04_CREATE_AND_SIGN',
        'VIEW_OUTLINE_REVIEWS',
        'OUTLINE_REVIEW',
        'VIEW_DEFENSE_GRADING',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_SCORE_SUBMIT',
    ],
    hasDefenseCouncilAssignment: true,
    hasOutlineCouncilAssignment: true,
};

const giaoVuPersona = {
    id: 301,
    role: 'ADMIN',
    permissions: [
        'REPORT_VIEW',
        'VIEW_PROJECT_PERIODS',
        'SEMESTER_MANAGE',
        'VIEW_PROJECT_ENROLLMENTS',
        'ENROLLMENT_MANAGE',
        'MENTOR_ASSIGN',
        'MENTOR_ASSIGNMENT_ADJUST',
        'VIEW_ALL_TOPICS',
        'TOPIC_REVIEW',
        'VIEW_PROJECT_OVERSIGHT',
        'PROJECT_OVERSIGHT_MANAGE',
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_COUNCIL_ASSIGNMENTS',
        'VIEW_DEFENSE_LOCK_LEDGER',
        'RESULT_LOCK',
        'DEFENSE_SCOREBOOK_RETURN',
        'VIEW_RUBRIC_CONFIG',
        'RUBRIC_MANAGE',
        'VIEW_PORTAL_CONTENT',
        'PORTAL_CONTENT_MANAGE',
        'VIEW_NOTIFICATIONS',
        'NOTIFICATION_MANAGE',
    ],
};

const vienTruongPersona = {
    id: 401,
    role: 'ADMIN',
    permissions: [
        'REPORT_VIEW',
        'VIEW_PROJECT_OVERSIGHT',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'DEFENSE_RESULT_APPROVE',
        'VIEW_RESULT_PUBLICATIONS',
        'RESULT_PUBLICATION_PUBLISH',
        'VIEW_ACADEMIC_DELEGATIONS',
        'ACADEMIC_DELEGATION_MANAGE',
        'PROJECT_ASSIGNMENT_PUBLISH',
    ],
};

const quanTriVienPersona = {
    id: 501,
    role: 'ADMIN',
    permissions: [
        'VIEW_USERS',
        'USER_MANAGE',
        'USER_IMPORT',
        'VIEW_PERMISSIONS',
        'VIEW_PERMISSION_GROUPS',
        'PERMISSION_GROUP_MANAGE',
        'VIEW_ANNOUNCEMENTS',
        'PUBLIC_ANNOUNCEMENT_MANAGE',
        'VIEW_PORTAL_CONTENT',
        'PORTAL_CONTENT_MANAGE',
        'VIEW_NOTIFICATIONS',
        'NOTIFICATION_MANAGE',
        'REPORT_VIEW',
    ],
};

describe('Five-Persona Policy Evaluation Runtime Tests (Task 10)', () => {
    describe('1. Feature View Access (canViewFeature)', () => {
        it('STUDENT can view only student workspace features', () => {
            expect(canViewFeature(studentPersona, 'my-registration')).toBe(true);
            expect(canViewFeature(studentPersona, 'my-submissions')).toBe(true);
            expect(canViewFeature(studentPersona, 'my-archive')).toBe(true);
            expect(canViewFeature(studentPersona, 'my-grades')).toBe(true);
            expect(canViewFeature(studentPersona, 'student-dashboard')).toBe(true);

            // Denied from lecturer & admin workspaces
            expect(canViewFeature(studentPersona, 'my-topics')).toBe(false);
            expect(canViewFeature(studentPersona, 'mentored-students')).toBe(false);
            expect(canViewFeature(studentPersona, 'progress-checkpoints')).toBe(false);
            expect(canViewFeature(studentPersona, 'users')).toBe(false);
            expect(canViewFeature(studentPersona, 'permissions')).toBe(false);
            expect(canViewFeature(studentPersona, 'project-periods')).toBe(false);
            expect(canViewFeature(studentPersona, 'admin-dashboard')).toBe(false);
        });

        it('GVHD without council assignment can view mentoring features but not council reviews', () => {
            expect(canViewFeature(gvhdPersona, 'my-topics')).toBe(true);
            expect(canViewFeature(gvhdPersona, 'mentored-students')).toBe(true);
            expect(canViewFeature(gvhdPersona, 'progress-checkpoints')).toBe(true);
            expect(canViewFeature(gvhdPersona, 'lecturer-dashboard')).toBe(true);

            // Blocked from council features due to lack of assignment
            expect(canViewFeature(gvhdPersona, 'outline-reviews')).toBe(false);
            expect(canViewFeature(gvhdPersona, 'defense-grading')).toBe(false);

            // Blocked from student and admin workspaces
            expect(canViewFeature(gvhdPersona, 'my-registration')).toBe(false);
            expect(canViewFeature(gvhdPersona, 'users')).toBe(false);
            expect(canViewFeature(gvhdPersona, 'project-periods')).toBe(false);
        });

        it('GVHD with council assignment CAN view outline review and defense grading', () => {
            expect(canViewFeature(gvhdCouncilPersona, 'outline-reviews')).toBe(true);
            expect(canViewFeature(gvhdCouncilPersona, 'defense-grading')).toBe(true);
            expect(canViewFeature(gvhdCouncilPersona, 'lecturer-grading-sheet')).toBe(true);
        });

        it('GIAO_VU can view academic coordination features but not student/lecturer personal areas', () => {
            expect(canViewFeature(giaoVuPersona, 'project-periods')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'project-enrollments')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'all-topics')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'project-oversight')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'academic-reports')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'outline-councils')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'defense-councils')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'defense-lock')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'rubric-config')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'portal-content')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'notifications')).toBe(true);
            expect(canViewFeature(giaoVuPersona, 'admin-dashboard')).toBe(true);

            // Blocked from user management and system permissions
            expect(canViewFeature(giaoVuPersona, 'users')).toBe(false);
            expect(canViewFeature(giaoVuPersona, 'permissions')).toBe(false);
            // Blocked from student and lecturer workspaces
            expect(canViewFeature(giaoVuPersona, 'my-registration')).toBe(false);
            expect(canViewFeature(giaoVuPersona, 'my-topics')).toBe(false);
        });

        it('VIEN_TRUONG can view defense approvals, result publications, and academic reports', () => {
            expect(canViewFeature(vienTruongPersona, 'defense-result-approvals')).toBe(true);
            expect(canViewFeature(vienTruongPersona, 'result-publications')).toBe(true);
            expect(canViewFeature(vienTruongPersona, 'academic-reports')).toBe(true);
            expect(canViewFeature(vienTruongPersona, 'project-oversight')).toBe(true);

            // Blocked from system administration
            expect(canViewFeature(vienTruongPersona, 'users')).toBe(false);
            expect(canViewFeature(vienTruongPersona, 'permissions')).toBe(false);
            expect(canViewFeature(vienTruongPersona, 'my-registration')).toBe(false);
        });

        it('QUAN_TRI_VIEN can view user and system administration, but not academic council features', () => {
            expect(canViewFeature(quanTriVienPersona, 'users')).toBe(true);
            expect(canViewFeature(quanTriVienPersona, 'permissions')).toBe(true);
            expect(canViewFeature(quanTriVienPersona, 'announcements')).toBe(true);
            expect(canViewFeature(quanTriVienPersona, 'portal-content')).toBe(true);
            expect(canViewFeature(quanTriVienPersona, 'notifications')).toBe(true);
            expect(canViewFeature(quanTriVienPersona, 'admin-dashboard')).toBe(true);

            // Blocked from academic workflows without explicit capability
            expect(canViewFeature(quanTriVienPersona, 'defense-result-approvals')).toBe(false);
            expect(canViewFeature(quanTriVienPersona, 'result-publications')).toBe(false);
            expect(canViewFeature(quanTriVienPersona, 'my-registration')).toBe(false);
            expect(canViewFeature(quanTriVienPersona, 'my-topics')).toBe(false);
        });
    });

    describe('2. Feature Action Enforcement (canPerformFeatureAction)', () => {
        it('STUDENT action capabilities', () => {
            expect(canPerformFeatureAction(studentPersona, 'my-registration', 'register')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-registration', 'rename')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-registration', 'cancel')).toBe(true);

            expect(canPerformFeatureAction(studentPersona, 'my-submissions', 'submitBm01')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-submissions', 'submitBm02')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-submissions', 'submitTask')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-submissions', 'signCheckpoint')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-archive', 'submitPreDefense')).toBe(true);
            expect(canPerformFeatureAction(studentPersona, 'my-archive', 'submitFinal')).toBe(true);

            // Blocked actions
            expect(canPerformFeatureAction(studentPersona, 'my-topics', 'create')).toBe(false);
            expect(canPerformFeatureAction(studentPersona, 'users', 'create')).toBe(false);
        });

        it('GVHD action capabilities', () => {
            expect(canPerformFeatureAction(gvhdPersona, 'my-topics', 'create')).toBe(true);
            expect(canPerformFeatureAction(gvhdPersona, 'my-topics', 'update')).toBe(true);
            expect(canPerformFeatureAction(gvhdPersona, 'mentored-students', 'reviewMentorRequest')).toBe(true);
            expect(canPerformFeatureAction(gvhdPersona, 'progress-checkpoints', 'reviewBm03')).toBe(true);
            expect(canPerformFeatureAction(gvhdPersona, 'progress-checkpoints', 'signBm04')).toBe(true);

            // GVHD in council can submit scores
            expect(canPerformFeatureAction(gvhdCouncilPersona, 'defense-grading', 'submitScore')).toBe(true);
            expect(canPerformFeatureAction(gvhdCouncilPersona, 'outline-reviews', 'review')).toBe(true);

            // Normal GVHD cannot submit defense score
            expect(canPerformFeatureAction(gvhdPersona, 'defense-grading', 'submitScore')).toBe(false);

            // GVHD cannot perform admin mutations
            expect(canPerformFeatureAction(gvhdPersona, 'project-enrollments', 'assignMentor')).toBe(false);
            expect(canPerformFeatureAction(gvhdPersona, 'defense-lock', 'lock')).toBe(false);
        });

        it('GIAO_VU action capabilities', () => {
            expect(canPerformFeatureAction(giaoVuPersona, 'project-periods', 'manage')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'project-enrollments', 'assignMentor')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'project-enrollments', 'adjustMentor')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'project-enrollments', 'manageEnrollment')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'all-topics', 'review')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'outline-councils', 'manage')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'defense-councils', 'manage')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'defense-lock', 'lock')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'defense-lock', 'returnScorebook')).toBe(true);
            expect(canPerformFeatureAction(giaoVuPersona, 'rubric-config', 'manage')).toBe(true);

            // GIAO_VU CANNOT approve or publish defense results
            expect(canPerformFeatureAction(giaoVuPersona, 'defense-result-approvals', 'approve')).toBe(false);
            expect(canPerformFeatureAction(giaoVuPersona, 'result-publications', 'publish')).toBe(false);

            // GIAO_VU CANNOT manage system users
            expect(canPerformFeatureAction(giaoVuPersona, 'users', 'create')).toBe(false);
        });

        it('VIEN_TRUONG action capabilities', () => {
            expect(canPerformFeatureAction(vienTruongPersona, 'defense-result-approvals', 'approve')).toBe(true);
            expect(canPerformFeatureAction(vienTruongPersona, 'result-publications', 'publish')).toBe(true);
            expect(canPerformFeatureAction(vienTruongPersona, 'academic-reports', 'export')).toBe(true);

            // VIEN_TRUONG CANNOT perform technical administrator user management
            expect(canPerformFeatureAction(vienTruongPersona, 'users', 'create')).toBe(false);
            expect(canPerformFeatureAction(vienTruongPersona, 'permissions', 'manageGroups')).toBe(false);
        });

        it('QUAN_TRI_VIEN action capabilities and strict lack of academic bypass', () => {
            expect(canPerformFeatureAction(quanTriVienPersona, 'users', 'create')).toBe(true);
            expect(canPerformFeatureAction(quanTriVienPersona, 'users', 'edit')).toBe(true);
            expect(canPerformFeatureAction(quanTriVienPersona, 'users', 'delete')).toBe(true);
            expect(canPerformFeatureAction(quanTriVienPersona, 'users', 'import')).toBe(true);
            expect(canPerformFeatureAction(quanTriVienPersona, 'permissions', 'manageGroups')).toBe(true);
            expect(canPerformFeatureAction(quanTriVienPersona, 'announcements', 'create')).toBe(true);

            // Strictly NO technical admin bypass for academic approvals
            expect(canPerformFeatureAction(quanTriVienPersona, 'defense-result-approvals', 'approve')).toBe(false);
            expect(canPerformFeatureAction(quanTriVienPersona, 'result-publications', 'publish')).toBe(false);
            expect(canPerformFeatureAction(quanTriVienPersona, 'outline-reviews', 'review')).toBe(false);
            expect(canPerformFeatureAction(quanTriVienPersona, 'defense-lock', 'lock')).toBe(false);
        });
    });

    describe('3. Scoped Delegation Context Evaluation', () => {
        const delegateeLecturer = {
            id: 250,
            role: 'LECTURER',
            basePermissions: ['VIEW_MY_TOPICS'],
            permissions: ['VIEW_MY_TOPICS', 'OUTLINE_REVIEW', 'VIEW_OUTLINE_REVIEWS'],
            hasOutlineCouncilAssignment: true,
            activeDelegations: [
                {
                    capabilityCode: 'OUTLINE_REVIEW',
                    semesterId: 'SEMESTER_2026_1',
                    department: 'CNTT',
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                },
                {
                    capabilityCode: 'VIEW_OUTLINE_REVIEWS',
                    semesterId: 'SEMESTER_2026_1',
                    department: 'CNTT',
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                },
            ],
        };

        it('allows action when context matches delegation scope (semester & department)', () => {
            const matchingContext = {
                semesterId: 'SEMESTER_2026_1',
                department: 'CNTT',
            };
            expect(canViewFeature(delegateeLecturer, 'outline-reviews', matchingContext)).toBe(true);
            expect(canPerformFeatureAction(delegateeLecturer, 'outline-reviews', 'review', matchingContext)).toBe(true);
        });

        it('denies action when semester does not match delegation scope', () => {
            const mismatchedSemesterContext = {
                semesterId: 'SEMESTER_2025_2',
                department: 'CNTT',
            };
            expect(canPerformFeatureAction(delegateeLecturer, 'outline-reviews', 'review', mismatchedSemesterContext)).toBe(false);
        });

        it('denies action when department does not match delegation scope', () => {
            const mismatchedDeptContext = {
                semesterId: 'SEMESTER_2026_1',
                department: 'DIEN_TU',
            };
            expect(canPerformFeatureAction(delegateeLecturer, 'outline-reviews', 'review', mismatchedDeptContext)).toBe(false);
        });

        it('denies action when delegation is expired', () => {
            const expiredUser = {
                ...delegateeLecturer,
                activeDelegations: [
                    {
                        capabilityCode: 'OUTLINE_REVIEW',
                        semesterId: 'SEMESTER_2026_1',
                        department: 'CNTT',
                        status: 'ACTIVE',
                        expiresAt: new Date(Date.now() - 3600000).toISOString(), // expired 1 hour ago
                    },
                ],
            };
            const context = { semesterId: 'SEMESTER_2026_1', department: 'CNTT' };
            expect(canPerformFeatureAction(expiredUser, 'outline-reviews', 'review', context)).toBe(false);
        });

        it('denies action when delegation is revoked', () => {
            const revokedUser = {
                ...delegateeLecturer,
                activeDelegations: [
                    {
                        capabilityCode: 'OUTLINE_REVIEW',
                        semesterId: 'SEMESTER_2026_1',
                        department: 'CNTT',
                        status: 'REVOKED',
                        expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    },
                ],
            };
            const context = { semesterId: 'SEMESTER_2026_1', department: 'CNTT' };
            expect(canPerformFeatureAction(revokedUser, 'outline-reviews', 'review', context)).toBe(false);
        });
    });

    describe('4. Navigation Filtering (getVisibleNavigation)', () => {
        it('STUDENT receives only student menu items', () => {
            const nav = getVisibleNavigation(studentPersona);
            const groups = nav.map((g) => g.title);
            expect(groups).toContain('Hồ sơ của tôi');
            expect(groups).not.toContain('Quản trị học vụ');
            expect(groups).not.toContain('Quản trị hệ thống');

            const allItems = nav.flatMap((g) => g.items.map((i) => i.key));
            expect(allItems).toContain('my-registration');
            expect(allItems).toContain('my-submissions');
            expect(allItems).toContain('my-archive');
            expect(allItems).toContain('my-grades');
            expect(allItems).not.toContain('users');
            expect(allItems).not.toContain('my-topics');
        });

        it('GVHD receives mentor menu items without admin or student items', () => {
            const nav = getVisibleNavigation(gvhdPersona);
            const allItems = nav.flatMap((g) => g.items.map((i) => i.key));
            expect(allItems).toContain('my-topics');
            expect(allItems).toContain('mentored-students');
            expect(allItems).toContain('progress-checkpoints');
            expect(allItems).not.toContain('my-registration');
            expect(allItems).not.toContain('users');
            expect(allItems).not.toContain('outline-councils');
        });

        it('GIAO_VU receives academic coordination items without system admin user management', () => {
            const nav = getVisibleNavigation(giaoVuPersona);
            const allItems = nav.flatMap((g) => g.items.map((i) => i.key));
            expect(allItems).toContain('project-periods');
            expect(allItems).toContain('project-enrollments');
            expect(allItems).toContain('all-topics');
            expect(allItems).toContain('outline-councils');
            expect(allItems).toContain('defense-councils');
            expect(allItems).toContain('defense-lock');
            expect(allItems).not.toContain('users');
            expect(allItems).not.toContain('permissions');
        });

        it('QUAN_TRI_VIEN receives system administration items without academic governance', () => {
            const nav = getVisibleNavigation(quanTriVienPersona);
            const allItems = nav.flatMap((g) => g.items.map((i) => i.key));
            expect(allItems).toContain('users');
            expect(allItems).toContain('permissions');
            expect(allItems).toContain('announcements');
            expect(allItems).not.toContain('defense-result-approvals');
            expect(allItems).not.toContain('result-publications');
            expect(allItems).not.toContain('project-periods');
        });
    });
});

