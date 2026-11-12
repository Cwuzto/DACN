/**
 * Route paths and coordination hub helpers
 */
export const ROUTES = {
    PROJECT_ENROLLMENTS: '/admin/project-enrollments',
    PROJECT_ROUND_COORDINATION: '/admin/project-rounds/:roundId/coordination',
    ACADEMIC_REPORTS: '/admin/reports',
};

/**
 * Helper xây dựng đường dẫn điều phối đợt đồ án với tham số URL (deep-linking)
 * @param {number|string} roundId 
 * @param {Object} options { tab: 'overview'|'students'|'lecturers', semesterId, projectCatalogId }
 */
export function buildRoundCoordinationUrl(roundId, options = {}) {
    const base = roundId
        ? `/admin/project-rounds/${roundId}/coordination`
        : '/admin/project-enrollments';

    const searchParams = new URLSearchParams();
    if (options.tab) searchParams.set('tab', options.tab);
    if (options.semesterId && !roundId) searchParams.set('semesterId', options.semesterId);
    if (options.projectCatalogId) searchParams.set('projectCatalogId', options.projectCatalogId);

    const query = searchParams.toString();
    return query ? `${base}?${query}` : base;
}

export default ROUTES;
