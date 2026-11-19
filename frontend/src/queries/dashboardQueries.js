import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';
import { requireSuccess } from './semesterQueries';

export const dashboardKeys = {
    stats: (scope, semesterId = null) => [...scope, 'dashboard', 'stats', { semesterId: semesterId ?? null }],
    adminActions: (scope, semesterId = null) => [...scope, 'dashboard', 'admin-actions', { semesterId: semesterId ?? null }],
    scores: (scope, semesterId = null) => [...scope, 'dashboard', 'scores', { semesterId: semesterId ?? null }],
    activities: (scope, semesterId = null) => [...scope, 'dashboard', 'activities', { semesterId: semesterId ?? null }],
    overview: (scope, semesterId) => [...scope, 'dashboard', 'overview', { semesterId }],
    lecturerOverviewRoot: (scope) => [...scope, 'dashboard', 'lecturer-overview'],
    lecturerOverview: (scope, semesterId = null) => [...scope, 'dashboard', 'lecturer-overview', { semesterId: semesterId ?? null }],
    studentDashboard: (scope) => [...scope, 'dashboard', 'student'],
};
export const useDashboardStats = (scope, semesterId = null, enabled = true) => useQuery({
    queryKey: dashboardKeys.stats(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getStats(semesterId)).data,
    enabled,
});
export const useAdminDashboardActions = (scope, semesterId, enabled = true) => useQuery({
    queryKey: dashboardKeys.adminActions(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getAdminActions(semesterId)).data,
    enabled: Boolean(enabled && semesterId),
});
export const useDashboardScores = (scope, semesterId = null, enabled = true) => useQuery({
    queryKey: dashboardKeys.scores(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getScores(semesterId)).data,
    enabled,
});
export const useDashboardActivities = (scope, semesterId = null, enabled = true) => useQuery({
    queryKey: dashboardKeys.activities(scope, semesterId),
    queryFn: async () => requireSuccess(await dashboardService.getActivities(semesterId)).data,
    enabled,
});
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
export const useStudentDashboard = (scope, enabled = true) => useQuery({
    queryKey: dashboardKeys.studentDashboard(scope),
    queryFn: async () => requireSuccess(await dashboardService.getStudentDashboard()).data,
    enabled,
});
