import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';
import { instituteOperationsKeys } from './instituteOperationsQueries';

export const bm02VerificationKeys = {
    all: (scope) => [...scope, 'bm02', 'verification'],
    detail: (scope, submissionId) => [...scope, 'bm02', 'verification', submissionId ?? null],
};

const createIdempotencyHeaders = () => ({
    headers: {
        'Idempotency-Key': globalThis.crypto?.randomUUID?.()
            || `bm02-sign-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const invalidateBm02RelatedQueries = async (client, scope, submissionId) => {
    await Promise.all([
        client.invalidateQueries({ queryKey: bm02VerificationKeys.detail(scope, submissionId) }),
        client.invalidateQueries({ queryKey: bm02VerificationKeys.all(scope) }),
        client.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) }),
        client.invalidateQueries({ queryKey: [...scope, 'dashboard', 'lecturer-overview'] }),
        client.invalidateQueries({ queryKey: instituteOperationsKeys.all(scope) }),
    ]);
};

export const useBm02Verification = (scope, submissionId, enabled = true) => useQuery({
    queryKey: bm02VerificationKeys.detail(scope, submissionId),
    queryFn: async () => requireSuccess(await api.get(`/bm02/applications/${submissionId}/verification`)).data,
    enabled: Boolean(submissionId) && enabled,
});

export const useBm02AdvisorSignMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ submissionId, expectedPayloadHash }) =>
            requireSuccess(
                await api.post(
                    `/bm02/applications/${submissionId}/advisor-sign`,
                    { expectedPayloadHash },
                    createIdempotencyHeaders(),
                ),
            ).data,
        onSuccess: async (_data, variables) => {
            await invalidateBm02RelatedQueries(client, scope, variables?.submissionId);
        },
    });
};

export const useBm02DepartmentSignMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ submissionId, expectedPayloadHash }) =>
            requireSuccess(
                await api.post(
                    `/bm02/applications/${submissionId}/department-sign`,
                    { expectedPayloadHash },
                    createIdempotencyHeaders(),
                ),
            ).data,
        onSuccess: async (_data, variables) => {
            await invalidateBm02RelatedQueries(client, scope, variables?.submissionId);
        },
    });
};
