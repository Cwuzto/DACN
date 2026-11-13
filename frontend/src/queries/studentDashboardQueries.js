import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService.js';
import registrationService from '../services/registrationService.js';
import evaluationService from '../services/evaluationService.js';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';
import { meetingKeys } from './meetingQueries.js';

const requireSuccess = (response) => {
    if (!response?.success) throw normalizeApiError(response);
    return response;
};

export const studentDashboardKeys = {
    stats: (scope) => [...scope, 'student-dashboard', 'stats'],
    allowedActions: (scope, registrationId) => [...scope, 'registrations', 'allowed-actions', String(registrationId)],
    bm04: (scope, registrationId) => [...scope, 'evaluations', 'bm04', String(registrationId)],
};

export const useStudentStats = (scope, enabled = true) => useQuery({
    queryKey: studentDashboardKeys.stats(scope),
    queryFn: async () => requireSuccess(await dashboardService.getStudentStats()).data,
    enabled,
});

export const useAllowedActions = (scope, registrationId, enabled = true) => useQuery({
    queryKey: studentDashboardKeys.allowedActions(scope, registrationId),
    queryFn: async () => {
        const res = await registrationService.getAllowedActions(registrationId);
        if (res?.success && Array.isArray(res.data?.allowedActions)) {
            return res.data.allowedActions;
        }
        return [];
    },
    enabled: Boolean(registrationId) && enabled,
});

export const useBM04Record = (scope, registrationId, enabled = true) => useQuery({
    queryKey: studentDashboardKeys.bm04(scope, registrationId),
    queryFn: async () => {
        const res = await evaluationService.getBM04Record(registrationId);
        return res?.success ? res.data : null;
    },
    enabled: Boolean(registrationId) && enabled,
});

export const useStudentAckBM03Mutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ bm03RecordId, data }) => requireSuccess(await evaluationService.studentAcknowledgeBM03(bm03RecordId, data)),
        onSuccess: async () => {
            const keys = [
                studentDashboardKeys.stats(scope),
                meetingKeys.bm03(scope, registrationId),
                queryKeys.registrations.current(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};

export const useWithdrawRegistrationMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (reason) => requireSuccess(await registrationService.withdrawRegistration(registrationId, reason)),
        onSuccess: async () => {
            const keys = [
                studentDashboardKeys.stats(scope),
                queryKeys.registrations.current(scope),
                queryKeys.registrations.lists(scope),
                queryKeys.topics.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};

export const useStudentRegistrationMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            if (payload?.action && payload?.args) {
                return requireSuccess(await registrationService[payload.action](...payload.args));
            }
            const { topicId, semesterId } = payload;
            return requireSuccess(await registrationService.registerTopic(topicId, semesterId));
        },
        onSuccess: async () => {
            const keys = [
                studentDashboardKeys.stats(scope),
                queryKeys.registrations.current(scope),
                queryKeys.registrations.lists(scope),
                queryKeys.topics.lists(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};
