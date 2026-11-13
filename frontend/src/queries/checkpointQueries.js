import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import evaluationService from '../services/evaluationService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const checkpointKeys = {
    all: (scope) => [...scope, 'checkpoints'],
    lists: (scope) => [...scope, 'checkpoints', 'list'],
    list: (scope, registrationId) => [...scope, 'checkpoints', 'list', String(registrationId)],
    appeals: (scope, filters = {}) => [...scope, 'checkpoints', 'appeals', filters],
};

export const useCheckpointEvaluations = (scope, registrationId, enabled = true) => useQuery({
    queryKey: checkpointKeys.list(scope, registrationId),
    queryFn: async () => requireSuccess(await evaluationService.getCheckpointEvaluations(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useCheckpointAppeals = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: checkpointKeys.appeals(scope, filters),
    queryFn: async () => requireSuccess(await evaluationService.getCheckpointAppeals(filters)).data,
    enabled,
});

export const useCheckpointMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await evaluationService[action](...args)),
        onSuccess: async () => {
            const keys = [
                checkpointKeys.list(scope, registrationId),
                checkpointKeys.appeals(scope),
                queryKeys.registrations.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};
