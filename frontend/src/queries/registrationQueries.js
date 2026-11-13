import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import registrationService from '../services/registrationService';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';
import { requireSuccess } from './semesterQueries.js';

export const registrationCustomKeys = {
    titleAdjustments: (scope) => [...scope, 'registrations', 'title-adjustments'],
    pendingTitleAdjustments: (scope) => [...scope, 'registrations', 'title-adjustments', 'pending'],
    projectEnrollments: (scope, filters = {}) => [...scope, 'registrations', 'project-enrollments', filters],
};

export const useStudentRegistration = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: Object.keys(filters).length ? [...queryKeys.registrations.current(scope), filters] : queryKeys.registrations.current(scope),
    queryFn: async () => {
        const response = await registrationService.getMyRegistration(filters);
        if (!response?.success) throw normalizeApiError(response);
        return response;
    },
    enabled,
});

export const useMyProjectEnrollments = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: registrationCustomKeys.projectEnrollments(scope, filters),
    queryFn: async () => {
        const res = await registrationService.getMyProjectEnrollments(filters);
        if (!res?.success) throw normalizeApiError(res);
        return res;
    },
    enabled,
});

export const useRegistrations = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.registrations.list(scope, filters),
    queryFn: async () => requireSuccess(await registrationService.getAllRegistrations(filters)).data,
    enabled: (filters?.semesterId !== undefined ? Boolean(filters.semesterId) : true) && enabled,
});

export const usePendingTitleAdjustments = (scope, enabled = true) => useQuery({
    queryKey: registrationCustomKeys.pendingTitleAdjustments(scope),
    queryFn: async () => requireSuccess(await registrationService.getPendingTitleAdjustments()).data,
    enabled,
});

export const useTitleAdjustmentMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await registrationService[action](...args)),
        onSuccess: async () => {
            const keys = [
                registrationCustomKeys.pendingTitleAdjustments(scope),
                queryKeys.registrations.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};

export const useRegistrationMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await registrationService[action](...args)),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) });
        },
    });
};
