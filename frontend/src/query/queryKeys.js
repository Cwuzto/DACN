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
    grading: createResourceKeys('grading'),
    archives: createResourceKeys('archives'),
    registrations: createResourceKeys('registrations'),
    semesters: createResourceKeys('semesters'),
    users: createResourceKeys('users'),
    permissions: createResourceKeys('permissions'),
    councils: createResourceKeys('councils'),
    topics: createResourceKeys('topics'),
    notifications: createResourceKeys('notifications'),
};
