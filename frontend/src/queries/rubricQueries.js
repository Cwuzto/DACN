import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import rubricService from '../services/rubricService';
import { requireSuccess } from './semesterQueries';

export const rubricKeys = {
    all: (scope) => [...scope, 'rubrics'],
    versions: (scope) => [...scope, 'rubrics', 'versions'],
    detail: (scope, id) => [...scope, 'rubrics', 'detail', String(id)],
};

export const useRubricVersions = (scope, enabled = true) => useQuery({
    queryKey: rubricKeys.versions(scope),
    queryFn: async () => requireSuccess(await rubricService.getRubricVersions()).data,
    enabled,
});

export const useRubricDetail = (scope, id, enabled = true) => useQuery({
    queryKey: rubricKeys.detail(scope, id),
    queryFn: async () => requireSuccess(await rubricService.getRubricById(id)).data,
    enabled: Boolean(id) && enabled,
});

export const useRubricMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await rubricService[action](...args)),
        onSuccess: async (_, { action, args }) => {
            const requests = [
                client.invalidateQueries({ queryKey: rubricKeys.versions(scope) }),
            ];
            const targetId = ['updateRubric', 'lockRubric', 'restoreDefault', 'deleteRubric', 'activateRubric'].includes(action)
                ? args[0]
                : null;
            if (targetId) {
                requests.push(client.invalidateQueries({ queryKey: rubricKeys.detail(scope, targetId) }));
            }
            await Promise.all(requests);
        },
    });
};

