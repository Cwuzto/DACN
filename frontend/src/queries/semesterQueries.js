import { useQuery } from '@tanstack/react-query';
import { semesterService } from '../services/semesterService';
import { queryKeys } from '../query/queryKeys';
import { normalizeApiError } from '../utils/apiError';

export const requireSuccess = response => {
    if (!response?.success) throw normalizeApiError(response);
    return response;
};

export const useSemesters = scope => useQuery({
    queryKey: queryKeys.semesters.list(scope),
    queryFn: async () => requireSuccess(await semesterService.getAll()).data,
});

export const usePublicSemesters = scope => useQuery({
    queryKey: [...queryKeys.semesters.all(scope), 'public'],
    queryFn: async () => requireSuccess(await semesterService.getPublic()).data,
});

export const useAssignedSemesters = (scope, enabled = true) => useQuery({
    queryKey: [...queryKeys.semesters.all(scope), 'assigned'],
    queryFn: async () => requireSuccess(await semesterService.getAll({ assignedOnly: 'true' })).data,
    enabled,
});
