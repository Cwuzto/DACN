import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementService } from '../services/announcementService';
import { requireSuccess } from './semesterQueries';

export const announcementKeys = {
    all: (scope) => [...scope, 'announcements'],
    lists: (scope) => [...scope, 'announcements', 'list'],
    list: (scope, filters = {}) => [...scope, 'announcements', 'list', filters],
    detail: (scope, id) => [...scope, 'announcements', 'detail', String(id)],
};

export const useAnnouncements = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: announcementKeys.list(scope, filters),
    queryFn: async () => requireSuccess(await announcementService.getAnnouncements(filters)),
    enabled,
});

export const useAnnouncementMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await announcementService[action](...args)),
        onSuccess: async (_, { action, args }) => {
            const requests = [
                client.invalidateQueries({ queryKey: announcementKeys.lists(scope) }),
            ];
            const id = ['updateAnnouncement', 'deleteAnnouncement'].includes(action) ? args[0] : null;
            if (id) {
                requests.push(client.invalidateQueries({ queryKey: announcementKeys.detail(scope, id) }));
            }
            await Promise.all(requests);
        },
    });
};

