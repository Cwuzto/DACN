import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import councilService from '../services/councilService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';
import { useUsers } from './userQueries';
import { usePublicLecturers } from './periodQueries';

export const councilKeys = {
    logs: (scope, id) => [...queryKeys.councils.detail(scope, String(id)), 'logs'],
    adjustments: (scope, id) => [...queryKeys.councils.detail(scope, String(id)), 'adjustments'],
};
export const useCouncils = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.councils.list(scope, filters),
    queryFn: async () => requireSuccess(await councilService.getCouncils(filters)).data,
    enabled: Boolean(filters.semesterId) && enabled,
});
export const useCouncilDetail = (scope, id, enabled = true) => useQuery({
    queryKey: queryKeys.councils.detail(scope, String(id)),
    queryFn: async () => requireSuccess(await councilService.getCouncilById(id)).data,
    enabled: Boolean(id) && enabled,
});
export const useCouncilLogs = (scope, id, enabled = true) => useQuery({
    queryKey: councilKeys.logs(scope, id),
    queryFn: async () => requireSuccess(await councilService.getCouncilLogs(id)).data,
    enabled: Boolean(id) && enabled,
});
export const useCouncilAdjustments = (scope, id, enabled = true) => useQuery({
    queryKey: councilKeys.adjustments(scope, id),
    queryFn: async () => requireSuccess(await councilService.getScheduleAdjustments(id)).data,
    enabled: Boolean(id) && enabled,
});
// Preserve the public-directory permission fallback, using the same user cache
// contract as every other getUsers consumer.
export const useCouncilLecturers = scope => {
    const primary = useUsers(scope, { role: 'LECTURER', status: 'active', limit: 1000 });
    const fallback = usePublicLecturers(scope, {}, primary.isError);
    if (primary.isError) return fallback;
    return { ...primary, data: primary.data?.data?.users || primary.data?.data };
};
export const useCouncilMutation = (scope, semesterId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await councilService[action](...args)),
        onSuccess: async (_, { action, args }) => {
            if (action === 'previewAutoOutlineCouncils') return;
            const bulk = ['autoAssignRegistrations', 'autoAssignOutlineCouncils', 'publishEligibleDefenseList', 'createCouncil'].includes(action);
            const id = bulk ? null : args[0];
            const requests = [client.invalidateQueries({
                queryKey: queryKeys.councils.lists(scope),
                predicate: query => !semesterId || String(query.queryKey.at(-1)?.semesterId) === String(semesterId),
            })];
            if (id) requests.push(client.invalidateQueries({ queryKey: queryKeys.councils.detail(scope, String(id)) }));
            if (bulk && action !== 'createCouncil') requests.push(client.invalidateQueries({
                queryKey: queryKeys.councils.details(scope),
                predicate: query => {
                    const councilId = query.queryKey[scope.length + 2];
                    const detail = client.getQueryData(queryKeys.councils.detail(scope, councilId));
                    return String(detail?.semesterId) === String(semesterId);
                },
            }));
            if (bulk || ['assignRegistrations', 'removeRegistration', 'reopenResults', 'replaceCouncilMember'].includes(action)) {
                requests.push(client.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope), predicate: query => !query.queryKey.at(-1)?.semesterId || String(query.queryKey.at(-1)?.semesterId) === String(semesterId) }));
            }
            if (['reopenResults', 'replaceCouncilMember', 'publishEligibleDefenseList'].includes(action)) {
                requests.push(client.invalidateQueries({ queryKey: queryKeys.grading.all(scope), predicate: query => !query.queryKey.at(-1)?.semesterId || String(query.queryKey.at(-1)?.semesterId) === String(semesterId) }));
            }
            await Promise.all(requests);
        },
    });
};
