import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import permissionService from '../services/permissionService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const permissionKeys = {
    groups: scope => queryKeys.permissions.list(scope, { resource: 'groups' }),
    catalog: scope => queryKeys.permissions.list(scope, { resource: 'catalog' }),
    matrix: scope => queryKeys.permissions.list(scope, { resource: 'matrix' }),
};
export const usePermissionGroups = (scope, enabled = true) => useQuery({
    queryKey: permissionKeys.groups(scope),
    queryFn: async () => requireSuccess(await permissionService.listGroups()).data,
    enabled,
});
export const usePermissionCatalog = (scope, enabled = true) => useQuery({
    queryKey: permissionKeys.catalog(scope),
    queryFn: async () => requireSuccess(await permissionService.listPermissions()).data,
    enabled,
});
export const usePermissionMatrix = (scope, enabled = true) => useQuery({
    queryKey: permissionKeys.matrix(scope),
    queryFn: async () => requireSuccess(await permissionService.getPermissionMatrix()).data,
    enabled,
});
export const usePermissionMutation = scope => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, id, data }) => {
            const request = {
                matrix: () => permissionService.bulkUpdatePermissionMatrix(data),
                create: () => permissionService.createGroup(data),
                update: () => permissionService.updateGroup(id, data),
                delete: () => permissionService.deleteGroup(id),
            }[action];
            return requireSuccess(await request());
        },
        onSuccess: async (_, { id }) => {
            const keys = [permissionKeys.groups(scope), permissionKeys.matrix(scope)];
            if (id) keys.push(queryKeys.permissions.detail(scope, id));
            await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey, exact: true })));
        },
    });
};
