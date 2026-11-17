import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';
import { requireSuccess } from './semesterQueries';

export const dashboardKeys = {
    stats: scope => [...scope, 'dashboard', 'stats'],
    scores: scope => [...scope, 'dashboard', 'scores'],
    activities: scope => [...scope, 'dashboard', 'activities'],
    overview: (scope, semesterId) => [...scope, 'dashboard', 'overview', { semesterId }],
    lecturerOverviewRoot: (scope) => [...scope, 'dashboard', 'lecturer-overview'],
    lecturerOverview: (scope, semesterId = null) => [...scope, 'dashboard', 'lecturer-overview', { semesterId: semesterId ?? null }],
};
export const useDashboardStats = scope => useQuery({ queryKey: dashboardKeys.stats(scope), queryFn: async () => requireSuccess(await dashboardService.getStats()).data });
export const useDashboardScores = scope => useQuery({ queryKey: dashboardKeys.scores(scope), queryFn: async () => requireSuccess(await dashboardService.getScores()).data });
export const useDashboardActivities = scope => useQuery({ queryKey: dashboardKeys.activities(scope), queryFn: async () => requireSuccess(await dashboardService.getActivities()).data });
export const useDashboardOverview = (scope, semesterId) => useQuery({
    queryKey: dashboardKeys.overview(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getSemesterOverview({ semesterId })).data,
    enabled: Boolean(semesterId),
});
export const useLecturerOverview = (scope, semesterId = null, enabled = true) => useQuery({
    queryKey: dashboardKeys.lecturerOverview(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getLecturerOverview({ semesterId })).data,
    enabled,
});
