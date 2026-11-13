const createResourceKeys = (resource) => ({
    all: (scope) => [...scope, resource],
    lists: (scope) => [...scope, resource, 'list'],
    list: (scope, filters = {}) => [...scope, resource, 'list', filters],
    details: (scope) => [...scope, resource, 'detail'],
    detail: (scope, id, filters = {}) => [...scope, resource, 'detail', id, filters],
});

// Use the authenticated Zustand user, never the token. Pass every API filter to
// list/detail; the complete object participates in TanStack Query's stable hash.
export const queryKeys = {
    scope: (user) => ['scope', user?.id ?? null, user?.permissionVersion ?? null],
    grading: {
        ...createResourceKeys('grading'),
        defenseResults: (scope, filters = {}) => [...scope, 'grading', 'defense-results', filters],
        // Approvals are a select projection of the same server response. Sharing
        // the key deduplicates reads and keeps both observers consistent.
        resultApprovals: (scope, filters = {}) => [...scope, 'grading', 'defense-results', filters],
        publicationHistory: (scope, semesterId) => [...scope, 'grading', 'publication-history', semesterId],
        publicationPreview: (scope, semesterId) => [...scope, 'grading', 'publication-preview', semesterId],
    },
    archives: {
        ...createResourceKeys('archives'),
        dossier: (scope, registrationId) => [...scope, 'archives', 'dossier', registrationId],
    },
    registrations: {
        ...createResourceKeys('registrations'),
        current: (scope) => [...scope, 'registrations', 'current'],
    },
    semesters: createResourceKeys('semesters'),
    users: createResourceKeys('users'),
    permissions: createResourceKeys('permissions'),
    councils: createResourceKeys('councils'),
    topics: createResourceKeys('topics'),
    notifications: createResourceKeys('notifications'),
};
