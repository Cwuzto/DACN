import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import outlineService from '../services/outlineService.js';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';
import { studentDashboardKeys } from './studentDashboardQueries.js';
import { taskKeys } from './taskQueries.js';

const requireSuccess = (response) => {
    if (!response?.success) throw normalizeApiError(response);
    return response;
};

export const outlineKeys = {
    all: (scope) => [...scope, 'outline'],
    myOutline: (scope, params = {}) => (params && Object.keys(params).length > 0
        ? [...scope, 'outline', 'my-outline', params]
        : [...scope, 'outline', 'my-outline']),
};

export const useMyOutline = (scope, params = {}, enabled = true) => useQuery({
    queryKey: outlineKeys.myOutline(scope, params),
    queryFn: async () => requireSuccess(await outlineService.getMyOutline(params)).data,
    enabled,
});

export const useOutlineMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, payload, args }) => {
            if (action && outlineService[action]) {
                return requireSuccess(await outlineService[action](...(args || [payload])));
            }
            return requireSuccess(await outlineService.submitInitialOutline(payload));
        },
        onSuccess: async () => {
            const keys = [
                outlineKeys.myOutline(scope),
                studentDashboardKeys.stats(scope),
                queryKeys.registrations.current(scope),
            ];
            if (registrationId) {
                keys.push(taskKeys.list(scope, registrationId));
            }
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};
