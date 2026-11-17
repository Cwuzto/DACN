import { useQuery } from '@tanstack/react-query';
import instituteOperationsService from '../services/instituteOperationsService';
import { requireSuccess } from './semesterQueries';

export const instituteOperationsKeys = {
    all: (scope) => [...scope, 'institute-operations'],
    queues: (scope) => [...scope, 'institute-operations', 'queue'],
    queue: (scope, filters = {}) => [...scope, 'institute-operations', 'queue', filters],
};

export const invalidateInstituteOperations = (client, scope) =>
    client.invalidateQueries({ queryKey: instituteOperationsKeys.all(scope) });

export const useInstituteOperations = (
    scope,
    { tab = 'review', semesterId = null, status = undefined, page = 1, pageSize = 20 } = {},
    options = {}
) => {
    const normalizedFilters = {
        tab,
        semesterId: semesterId ?? null,
        status: status && status !== 'ALL' ? status : undefined,
        page,
        pageSize,
    };

    return useQuery({
        queryKey: instituteOperationsKeys.queue(scope, normalizedFilters),
        queryFn: async ({ signal }) =>
            requireSuccess(await instituteOperationsService.getOperations(normalizedFilters, { signal })).data,
        enabled: options.enabled !== false,
    });
};
