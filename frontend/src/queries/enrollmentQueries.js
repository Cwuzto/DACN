import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import projectEnrollmentService from '../services/projectEnrollmentService';
import { topicService } from '../services/topicService';
import { requireSuccess } from './semesterQueries';
import { usePeriodRegistrations, usePeriodTopics } from './periodQueries';
import { queryKeys } from '../query/queryKeys';
import { lecturerAssignmentKeys } from './lecturerAssignmentQueries';
export const enrollmentKeys = {
    lists: scope => [...scope, 'enrollments', 'list'],
    list: (scope, filters = {}) => [...scope, 'enrollments', 'list', filters],
    catalogs: scope => [...scope, 'project-catalogs', 'list'],
};
export const useProjectCatalogs = scope => useQuery({
    queryKey: enrollmentKeys.catalogs(scope),
    queryFn: async () => requireSuccess(await projectEnrollmentService.getCatalogs()).data,
});
export const useEnrollments = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: enrollmentKeys.list(scope, filters),
    queryFn: async () => requireSuccess(await projectEnrollmentService.getEnrollments(filters)).data,
    enabled: Boolean(filters.semesterId) && enabled,
});
export const useEnrollmentAudit = (scope, semesterId, enabled = true) => {
    const enrollment = useEnrollments(scope, { semesterId }, enabled);
    const registration = usePeriodRegistrations(scope, { semesterId, limit: 5000 }, Boolean(semesterId) && enabled);
    const topic = usePeriodTopics(scope, { semesterId, limit: 5000 }, Boolean(semesterId) && enabled);
    const data = useMemo(() => {
        if (!enrollment.data || !registration.data || !topic.data) return undefined;
        const enrollments = enrollment.data, registrations = registration.data, topics = topic.data;
            const activeEnrollments = enrollments.filter((r) => r.status === 'ACTIVE');
            const activeRegistrations = registrations.filter((r) => r.status !== 'REJECTED');

            const registeredStudentIds = new Set(activeRegistrations.map((r) => r.studentId));
            const enrolledWithoutTopic = activeEnrollments.filter((r) => !registeredStudentIds.has(r.studentId));

            const topicsMissingCatalog = topics.filter((t) => !t.projectCatalogId);

            const studentCatalogMap = new Map();
            activeEnrollments.forEach((row) => {
                studentCatalogMap.set(row.studentId, row.projectCatalogId);
            });

            const ruleMismatch = [];
            activeRegistrations.forEach((reg) => {
                const topicCatalogId = reg.topic?.projectCatalogId;
                const studentEnrollmentCatalogId = studentCatalogMap.get(reg.studentId);

                if (!topicCatalogId) {
                    ruleMismatch.push({ ...reg, mismatchReason: 'TOPIC_MISSING_PROJECT_CATALOG' });
                } else if (!studentEnrollmentCatalogId || studentEnrollmentCatalogId !== topicCatalogId) {
                    ruleMismatch.push({ ...reg, mismatchReason: 'MISSING_MATCHED_ENROLLMENT' });
                }
            });

        return { enrolledWithoutTopicRegistration: enrolledWithoutTopic, topicsMissingProjectCatalog: topicsMissingCatalog, registrationsRuleMismatch: ruleMismatch };
    }, [enrollment.data, registration.data, topic.data]);
    const queries = [enrollment, registration, topic];
    return {
        data,
        isPending: queries.some(query => query.isPending) && !queries.some(query => query.isError),
        isError: queries.some(query => query.isError),
        error: queries.find(query => query.isError)?.error,
        isFetching: queries.some(query => query.isFetching),
        fetchStatus: queries.some(query => query.isFetching) ? 'fetching' : 'idle',
        refetch: () => Promise.all(queries.map(query => query.refetch())),
    };
};
export const useEnrollmentMutation = (scope, semesterId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await (action === 'updateTopic' ? topicService.update(...args) : projectEnrollmentService[action](...args))),
        onSuccess: async (_, { action, args }) => {
            const affectedSemesterId = args[0]?.semesterId || semesterId;
            const keys = action === 'updateTopic' ? [queryKeys.topics.lists(scope), queryKeys.registrations.lists(scope)] : [enrollmentKeys.lists(scope), lecturerAssignmentKeys.overviews(scope)];
            await Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey, predicate: query => !query.queryKey.at(-1)?.semesterId || String(query.queryKey.at(-1)?.semesterId) === String(affectedSemesterId) })));
        },
    });
};
