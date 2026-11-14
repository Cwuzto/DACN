import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';
import { semesterService } from '../services/semesterService';
import registrationService from '../services/registrationService';
import { topicService } from '../services/topicService';
import userService from '../services/userService';

export const usePeriodRegistrations = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.registrations.list(scope, filters),
    queryFn: async () => requireSuccess(await registrationService.getAllRegistrations(filters)).data,
    enabled,
});
export const usePeriodTopics = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.topics.list(scope, filters),
    queryFn: async () => requireSuccess(await topicService.getAll(filters)).data,
    enabled,
});
export const usePublicLecturers = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.users.list(scope, { resource: 'public-lecturers', ...filters }),
    queryFn: async () => requireSuccess(await userService.getPublicLecturers(filters)).data,
    enabled,
});
export const usePeriodMutation = scope => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await (action === 'publishTopicDecision' ? registrationService : semesterService)[action](...args)),
        onSuccess: async (_, { action }) => {
            const keys = [queryKeys.semesters.list(scope)];
            if (['issuePeriodDecision', 'createDecisionAmendment', 'publishTopicDecision'].includes(action)) keys.push(queryKeys.registrations.lists(scope));
            await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));
        },
    });
};
