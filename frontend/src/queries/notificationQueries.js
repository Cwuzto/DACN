import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import notificationService from '../services/notificationService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';
import { normalizeApiError } from '../utils/apiError';

export const notificationCenterKeys = {
    history: (scope) => [...queryKeys.notifications.all(scope), 'history'],
    templates: (scope) => [...queryKeys.notifications.all(scope), 'templates'],
};

export const useMyNotifications = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: queryKeys.notifications.list(scope, filters),
    queryFn: async () => {
        const res = await notificationService.getMyNotifications(filters);
        if (!res?.success) throw normalizeApiError(res);
        return Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
    },
    enabled,
    refetchInterval: 30000,
});

export const useNotificationHistory = (scope, enabled = true) => useQuery({
    queryKey: notificationCenterKeys.history(scope),
    queryFn: async () => requireSuccess(await notificationService.getHistory()).data,
    enabled,
});

export const useNotificationTemplates = (scope, enabled = true) => useQuery({
    queryKey: notificationCenterKeys.templates(scope),
    queryFn: async () => requireSuccess(await notificationService.getTemplates()).data,
    enabled,
});

export const useNotificationMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await notificationService[action](...args)),
        onSuccess: async (_, { action }) => {
            const requests = [
                client.invalidateQueries({ queryKey: queryKeys.notifications.all(scope) }),
            ];
            if (action === 'sendBroadcast') {
                requests.push(client.invalidateQueries({ queryKey: notificationCenterKeys.history(scope) }));
            }
            if (action === 'updateTemplate') {
                requests.push(client.invalidateQueries({ queryKey: notificationCenterKeys.templates(scope) }));
            }
            await Promise.all(requests);
        },
    });
};

