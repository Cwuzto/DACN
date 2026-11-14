import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import portalContentService from '../services/portalContentService';
import { requireSuccess } from './semesterQueries';

export const portalKeys = {
    all: (scope) => [...scope, 'portal'],
    resourcesList: (scope) => [...scope, 'portal', 'resources'],
    resources: (scope, type) => [...scope, 'portal', 'resources', type],
    publicContent: (scope) => [...scope, 'portal', 'public-content'],
};

export const usePortalResources = (scope, type, enabled = true) => useQuery({
    queryKey: portalKeys.resources(scope, type),
    queryFn: async () => requireSuccess(await portalContentService.listResources(type)).data,
    enabled: Boolean(type) && enabled,
});

export const usePublicPortalContent = (scope, enabled = true) => useQuery({
    queryKey: portalKeys.publicContent(scope),
    queryFn: async () => requireSuccess(await portalContentService.getPublicContent()).data,
    enabled,
});

export const usePortalMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await portalContentService[action](...args)),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: portalKeys.resourcesList(scope) }),
                client.invalidateQueries({ queryKey: portalKeys.publicContent(scope) }),
            ]);
        },
    });
};

