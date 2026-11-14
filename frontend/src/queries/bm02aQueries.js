import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import bm02aService from '../services/bm02aService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';
export const bm02aKeys = {
    appendices: (scope, decisionId) => [...scope, 'bm02a', 'appendices', decisionId],
    queue: (scope, filters = {}) => [...scope, 'bm02a', 'queue', filters],
    byRegistration: (scope, registrationId) => [...scope, 'bm02a', 'registration', registrationId],
};
export const useDecisionAppendices = (scope, decisionId, enabled = true) => useQuery({
    queryKey: bm02aKeys.appendices(scope, decisionId),
    queryFn: async () => requireSuccess(await bm02aService.getAppendices(decisionId)).data,
    enabled: Boolean(decisionId) && enabled,
});
export const useRegistrationBm02aRequests = (scope, registrationId, enabled = true) => useQuery({
    queryKey: bm02aKeys.byRegistration(scope, registrationId),
    queryFn: async () => requireSuccess(await bm02aService.getRequestsByRegistration(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});
export const useBm02aQueue = (scope, enabled = true) => useQuery({
    queryKey: bm02aKeys.queue(scope),
    queryFn: async () => requireSuccess(await bm02aService.getPendingQueue()).data,
    enabled,
});
export const useBm02aMutation = (scope, decisionId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await bm02aService[action](...args)),
        onSuccess: async (_, { args }) => Promise.all([bm02aKeys.appendices(scope, args[0]?.decisionId || decisionId), bm02aKeys.queue(scope), queryKeys.registrations.lists(scope)].map(queryKey => client.invalidateQueries({ queryKey }))),
    });
};
