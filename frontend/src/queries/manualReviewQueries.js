import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import manualReviewService from '../services/manualReviewService';
import evaluationService from '../services/evaluationService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const manualReviewKeys = {
    all: (scope) => [...scope, 'manual-review'],
    casesList: (scope) => [...scope, 'manual-review', 'cases'],
    cases: (scope, filters = {}) => [...scope, 'manual-review', 'cases', filters],
    appealsList: (scope) => [...scope, 'manual-review', 'appeals'],
    appeals: (scope, filters = {}) => [...scope, 'manual-review', 'appeals', filters],
    bm03Stop: (scope) => [...scope, 'manual-review', 'bm03-stop'],
    bm04Defense: (scope) => [...scope, 'manual-review', 'bm04-defense'],
};

export const useManualReviewCases = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: manualReviewKeys.cases(scope, filters),
    queryFn: async () => requireSuccess(await manualReviewService.listCases(filters)).data,
    enabled,
});

export const useCheckpointAppeals = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: manualReviewKeys.appeals(scope, filters),
    queryFn: async () => requireSuccess(await evaluationService.getCheckpointAppeals(filters)).data,
    enabled,
});

export const useBm03StopReviews = (scope, enabled = true) => useQuery({
    queryKey: manualReviewKeys.bm03Stop(scope),
    queryFn: async () => {
        const res = await evaluationService.listStopReviews?.();
        return requireSuccess(res).data;
    },
    enabled,
});

export const useBm04DefenseReviews = (scope, enabled = true) => useQuery({
    queryKey: manualReviewKeys.bm04Defense(scope),
    queryFn: async () => {
        const res = await evaluationService.listDefenseReviews?.();
        return requireSuccess(res).data;
    },
    enabled,
});

export const useManualReviewMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ targetService, action, args }) => {
            const svc = targetService === 'manualReview' ? manualReviewService : evaluationService;
            return requireSuccess(await svc[action](...args));
        },
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: manualReviewKeys.casesList(scope) }),
                client.invalidateQueries({ queryKey: manualReviewKeys.appealsList(scope) }),
                client.invalidateQueries({ queryKey: manualReviewKeys.bm03Stop(scope) }),
                client.invalidateQueries({ queryKey: manualReviewKeys.bm04Defense(scope) }),
                client.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) }),
            ]);
        },
    });
};

