import test from 'node:test';
import assert from 'node:assert/strict';
import projectEnrollmentService from '../src/services/projectEnrollmentService.js';
import api from '../src/services/api.js';

test('projectEnrollmentService defines all methods consumed by ProjectEnrollmentPage', () => {
    assert.equal(typeof projectEnrollmentService.getCatalogs, 'function');
    assert.equal(typeof projectEnrollmentService.getEnrollments, 'function');
    assert.equal(typeof projectEnrollmentService.bulkUpsert, 'function');
    assert.equal(typeof projectEnrollmentService.createEnrollment, 'function');
    assert.equal(typeof projectEnrollmentService.bulkAssign, 'function');
    assert.equal(typeof projectEnrollmentService.deleteEnrollment, 'function');
    assert.equal(typeof projectEnrollmentService.downloadTemplate, 'function');
    assert.equal(typeof projectEnrollmentService.importEnrollmentsExcel, 'function');
    assert.equal(typeof projectEnrollmentService.exportEnrollmentsExcel, 'function');
});

test('createEnrollment calls bulkUpsert with a single formatted item', async () => {
    let capturedPayload = null;
    const originalPost = api.post;
    api.post = async (url, data) => {
        if (url === '/project-enrollments/bulk-upsert') {
            capturedPayload = data;
            return { success: true, data: { created: 1, updated: 0 } };
        }
        return originalPost(url, data);
    };

    try {
        const res = await projectEnrollmentService.createEnrollment({
            semesterId: 1,
            projectCatalogId: 2,
            studentId: 10,
        });

        assert.equal(res.success, true);
        assert.deepEqual(capturedPayload, {
            items: [
                {
                    semesterId: 1,
                    projectCatalogId: 2,
                    studentId: 10,
                    note: undefined,
                    status: 'ACTIVE',
                    source: 'MANUAL',
                },
            ],
        });
    } finally {
        api.post = originalPost;
    }
});

test('bulkAssign calls bulkUpsert with mapped student items', async () => {
    let capturedPayload = null;
    const originalPost = api.post;
    api.post = async (url, data) => {
        if (url === '/project-enrollments/bulk-upsert') {
            capturedPayload = data;
            return { success: true, data: { created: 3, updated: 0 } };
        }
        return originalPost(url, data);
    };

    try {
        const res = await projectEnrollmentService.bulkAssign({
            semesterId: 1,
            projectCatalogId: 2,
            studentIds: [10, 11, 12],
        });

        assert.equal(res.success, true);
        assert.deepEqual(capturedPayload, {
            items: [
                { semesterId: 1, projectCatalogId: 2, studentId: 10, note: undefined, status: 'ACTIVE', source: 'MANUAL' },
                { semesterId: 1, projectCatalogId: 2, studentId: 11, note: undefined, status: 'ACTIVE', source: 'MANUAL' },
                { semesterId: 1, projectCatalogId: 2, studentId: 12, note: undefined, status: 'ACTIVE', source: 'MANUAL' },
            ],
        });
    } finally {
        api.post = originalPost;
    }
});
