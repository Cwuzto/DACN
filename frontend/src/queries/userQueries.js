import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import userService from '../services/userService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const userKeys = {
    counts: scope => [...queryKeys.users.all(scope), 'counts'],
    permissions: (scope, id) => [...queryKeys.users.detail(scope, id), 'permissions'],
};
export const useUsers = (scope, filters) => useQuery({
    queryKey: queryKeys.users.list(scope, filters),
    queryFn: async () => requireSuccess(await userService.getUsers(filters)),
});
export const useUserRoleCounts = scope => useQuery({
    queryKey: userKeys.counts(scope),
    queryFn: async () => {
        const roles = ['ADMIN', 'LECTURER', 'STUDENT'];
        const responses = await Promise.all(roles.map(role => userService.getUsers({ role, page: 1, limit: 1 }).then(requireSuccess)));
        return Object.fromEntries(roles.map((role, i) => [role, responses[i].pagination.total]));
    },
});
export const useUserPermissions = (scope, id) => useQuery({
    queryKey: userKeys.permissions(scope, id),
    queryFn: async () => requireSuccess(await userService.getUserPermissions(id)).data,
    enabled: Boolean(id),
});

export const useUserMutation = scope => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, id, data }) => {
            const request = {
                create: () => userService.createUser(data),
                update: () => userService.updateUser(id, data),
                delete: () => userService.deleteUser(id),
                toggleActive: () => userService.toggleActive(id),
                resetPassword: () => userService.resetPassword(id),
                permissionGroups: () => userService.updateUserPermissionGroups(id, data),
                import: () => userService.importUsersExcel(data),
            }[action];
            return requireSuccess(await request());
        },
        onSuccess: async (_, { action, id }) => {
            if (action === 'resetPassword') return;
            const keys = [queryKeys.users.lists(scope)];
            if (action !== 'permissionGroups') keys.push(userKeys.counts(scope));
            if (id) keys.push(queryKeys.users.detail(scope, id));
            if (action === 'permissionGroups') keys.push(queryKeys.permissions.list(scope, { resource: 'groups' }));
            await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));
        },
    });
};
