import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import delegationService from '../services/delegationService';
import { requireSuccess } from './semesterQueries';
export const delegationKeys = { list: (scope, filters = {}) => [...scope, 'delegations', 'list', filters] };
export const useDelegations = (scope, enabled = true) => useQuery({
    queryKey: delegationKeys.list(scope),
    queryFn: async () => requireSuccess(await delegationService.getDelegations()).data,
    enabled,
});
export const useDelegationMutation = scope => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await delegationService[action](...args)),
        onSuccess: () => client.invalidateQueries({ queryKey: delegationKeys.list(scope) }),
    });
};
