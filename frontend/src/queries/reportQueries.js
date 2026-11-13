import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/reportService';
import { normalizeApiError } from '../utils/apiError';

export const reportKeys = {
    overview: (scope, filters) => [...scope, 'reports', 'overview', filters],
    workload: (scope, semesterId) => [...scope, 'reports', 'workload', { semesterId }],
};
const reportData = response => {
    if (response?.success === false) throw normalizeApiError(response);
    return response?.data !== undefined ? response.data : response;
};
export const useReportOverview = (scope, filters) => useQuery({
    queryKey: reportKeys.overview(scope, filters),
    queryFn: async () => reportData(await reportService.getOverview(filters)),
    enabled: Boolean(filters.semesterId),
});
export const useLecturerWorkload = (scope, semesterId) => useQuery({
    queryKey: reportKeys.workload(scope, semesterId),
    queryFn: async () => reportData(await reportService.getLecturerWorkload({ semesterId })),
    enabled: Boolean(semesterId),
});
