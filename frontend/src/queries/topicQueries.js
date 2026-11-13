import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicService } from '../services/topicService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const topicKeys = {
    cloneable: (scope, semesterId) => [...scope, 'topics', 'cloneable', semesterId],
};

export const useTopics = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.topics.list(scope, filters),
    queryFn: async () => requireSuccess(await topicService.getAll(filters)).data,
    enabled,
});

export const useTopicDetail = (scope, id, enabled = true) => useQuery({
    queryKey: queryKeys.topics.detail(scope, String(id)),
    queryFn: async () => requireSuccess(await topicService.getById(id)).data,
    enabled: Boolean(id) && enabled,
});

export const useCloneableTopics = (scope, semesterId, enabled = true) => useQuery({
    queryKey: topicKeys.cloneable(scope, semesterId),
    queryFn: async () => requireSuccess(await topicService.getCloneableTopics({ semesterId })).data,
    enabled: Boolean(semesterId) && enabled,
});

export const useTopicMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await topicService[action](...args)),
        onSuccess: async (_, { action, args }) => {
            const requests = [
                client.invalidateQueries({ queryKey: queryKeys.topics.lists(scope) }),
                client.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) }),
            ];
            const id = ['update', 'changeStatus', 'delete'].includes(action) ? args[0] : null;
            if (id) {
                requests.push(client.invalidateQueries({ queryKey: queryKeys.topics.detail(scope, String(id)) }));
            }
            await Promise.all(requests);
        },
    });
};

