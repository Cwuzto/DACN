import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import lecturerAssignmentService from '../services/lecturerAssignmentService';
import { requireSuccess } from './semesterQueries';
export const lecturerAssignmentKeys = {
    lists: scope => [...scope, 'lecturer-assignments', 'list'],
    list: (scope, filters = {}) => [...scope, 'lecturer-assignments', 'list', filters],
    overviews: scope => [...scope, 'lecturer-assignments', 'overview'],
    overview: (scope, filters = {}) => [...scope, 'lecturer-assignments', 'overview', filters],
    available: (scope, filters = {}) => [...scope, 'lecturer-assignments', 'available', filters],
};
export const useLecturerAssignments = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: lecturerAssignmentKeys.list(scope, filters),
    queryFn: async () => requireSuccess(await lecturerAssignmentService.getAll(filters)).data,
    enabled: Boolean(filters.semesterId) && enabled,
});
export const useCoordinationOverview = (scope, filters = {}) => useQuery({
    queryKey: lecturerAssignmentKeys.overview(scope, filters),
    queryFn: async () => requireSuccess(await lecturerAssignmentService.getOverview(filters)).data,
    enabled: Boolean(filters.semesterId),
});
export const useAvailableLecturers = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: lecturerAssignmentKeys.available(scope, filters),
    queryFn: async () => requireSuccess(await lecturerAssignmentService.getAvailableLecturers(filters)).data,
    enabled: Boolean(filters.semesterId) && enabled,
});
export const useLecturerAssignmentMutation = (scope, semesterId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await lecturerAssignmentService[action](...args)),
        onSuccess: async (_, { args }) => {
            const payload = args[0];
            const affected = new Set([semesterId, payload?.semesterId, ...(Array.isArray(payload) ? payload.map(item => item.semesterId) : [])].filter(Boolean).map(String));
            await client.invalidateQueries({ queryKey: [...scope, 'lecturer-assignments'], predicate: query => affected.has(String(query.queryKey.at(-1)?.semesterId)) });
        },
    });
};
