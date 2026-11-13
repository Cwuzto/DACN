import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import evaluationService from '../services/evaluationService.js';
import { semesterService } from '../services/semesterService.js';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';

const requireSuccess = (response) => {
    if (!response?.success) throw normalizeApiError(response);
    return response;
};

const defenseOptions = (scope, filters) => ({
    queryKey: queryKeys.grading.defenseResults(scope, filters),
    queryFn: async ({ signal }) => requireSuccess(await evaluationService.getAdminDefenseCenter(filters, { signal })),
});

export const useDefenseResults = (scope, filters = {}, options = {}) => useQuery({
    ...defenseOptions(scope, filters), ...options,
});

const selectApprovals = (response) => ({
    ...response,
    data: (response.data || []).filter((row) => row.status === 'AWAITING_FINAL_APPROVAL'),
});

export const useResultApprovals = (scope, filters = {}, options = {}) => useQuery({
    ...defenseOptions(scope, filters),
    ...options,
    select: selectApprovals,
});

export const useGradingSemesters = (scope) => useQuery({
    queryKey: queryKeys.semesters.list(scope),
    queryFn: async () => requireSuccess(await semesterService.getAll()).data,
    select: data => ({ success: true, data }),
});

export const usePublicationHistory = (scope, semesterId, options = {}) => useQuery({
    queryKey: queryKeys.grading.publicationHistory(scope, semesterId),
    queryFn: async ({ signal }) => requireSuccess(await evaluationService.getResultPublicationHistory(semesterId, { signal })),
    ...options,
    enabled: Boolean(semesterId) && options.enabled !== false,
});

export const usePublicationPreview = (scope, semesterId, options = {}) => useQuery({
    queryKey: queryKeys.grading.publicationPreview(scope, semesterId),
    queryFn: async ({ signal }) => requireSuccess(await evaluationService.previewResultPublication(semesterId, { signal })),
    ...options,
    enabled: Boolean(semesterId) && options.enabled !== false,
});

// Invalidate each concrete cached filter key, rather than the whole grading or
// account cache. The approval observer shares each ledger key through select.
const invalidateResultViews = async (client, scope, semesterId) => {
    const ledgerKeys = client.getQueryCache().findAll({ queryKey: queryKeys.grading.all(scope) })
        .filter(({ queryKey }) => queryKey[scope.length + 1] === 'defense-results'
            && (!queryKey[scope.length + 2]?.semesterId
                || String(queryKey[scope.length + 2].semesterId) === String(semesterId)))
        .map(({ queryKey }) => queryKey);
    await Promise.all([
        ...ledgerKeys,
        queryKeys.grading.publicationHistory(scope, semesterId),
        queryKeys.grading.publicationPreview(scope, semesterId),
    ].map((queryKey) => client.invalidateQueries({ queryKey, exact: true })));
};

export const useApproveDefenseResult = (scope, semesterId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ registrationId, outcome }) => requireSuccess(await evaluationService.approveDefenseResult(registrationId, { outcome })),
        onSuccess: () => invalidateResultViews(client, scope, semesterId),
    });
};

export const usePublishDefenseResults = (scope, semesterId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ payload, idempotencyKey }) => requireSuccess(await evaluationService.publishDefenseResults(semesterId, payload, idempotencyKey)),
        onSuccess: () => invalidateResultViews(client, scope, semesterId),
    });
};

export const gradingCustomKeys = {
    councils: (scope) => [...scope, 'grading', 'my-councils'],
    scoreSheet: (scope, registrationId) => [...scope, 'grading', 'score-sheet', String(registrationId)],
};

export const useCouncilDefenses = (scope, enabled = true) => useQuery({
    queryKey: gradingCustomKeys.councils(scope),
    queryFn: async () => requireSuccess(await evaluationService.getMyCouncilDefenses()).data,
    enabled,
});

export const useScoreSheet = (scope, registrationId, enabled = true) => useQuery({
    queryKey: gradingCustomKeys.scoreSheet(scope, registrationId),
    queryFn: async () => requireSuccess(await evaluationService.getScoreSheet(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useScoreSheetMutation = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await evaluationService[action](...args)),
        onSuccess: async () => {
            const keys = [
                gradingCustomKeys.scoreSheet(scope, registrationId),
                gradingCustomKeys.councils(scope),
            ];
            await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
        },
    });
};

