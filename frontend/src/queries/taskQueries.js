import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import taskService from '../services/taskService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const taskKeys = {
    all: (scope) => [...scope, 'tasks'],
    lists: (scope) => [...scope, 'tasks', 'list'],
    list: (scope, registrationId) => [...scope, 'tasks', 'list', String(registrationId)],
};

export const useTasksByRegistration = (scope, registrationId, enabled = true) => useQuery({
    queryKey: taskKeys.list(scope, registrationId),
    queryFn: async () => requireSuccess(await taskService.getTasksByRegistration(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useTaskMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await taskService[action](...args)),
        onSuccess: async () => {
            const keys = [
                taskKeys.list(scope, registrationId),
                queryKeys.registrations.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};
