import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import meetingLogService from '../services/meetingLogService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const meetingKeys = {
    all: (scope) => [...scope, 'meeting-logs'],
    lists: (scope) => [...scope, 'meeting-logs', 'list'],
    list: (scope, registrationId) => [...scope, 'meeting-logs', 'list', String(registrationId)],
    stats: (scope, registrationId) => [...scope, 'meeting-logs', 'stats', String(registrationId)],
    bm03: (scope, registrationId) => [...scope, 'meeting-logs', 'bm03', String(registrationId)],
};

export const useMeetingLogs = (scope, registrationId, enabled = true) => useQuery({
    queryKey: meetingKeys.list(scope, registrationId),
    queryFn: async () => requireSuccess(await meetingLogService.getMeetingLogs(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useBM03Record = (scope, registrationId, enabled = true) => useQuery({
    queryKey: meetingKeys.bm03(scope, registrationId),
    queryFn: async () => requireSuccess(await meetingLogService.getBM03Record(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useMeetingMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await meetingLogService[action](...args)),
        onSuccess: async () => {
            const keys = [
                meetingKeys.list(scope, registrationId),
                meetingKeys.bm03(scope, registrationId),
                queryKeys.registrations.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};
