import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import archiveService from '../services/archiveService';
import taskService from '../services/taskService';
import { queryKeys } from '../query/queryKeys';
import { requireSuccess } from './semesterQueries';

export const oversightKeys = {
    all: (scope) => [...scope, 'oversight'],
    healthRadar: (scope, semesterId) => [...scope, 'oversight', 'health-radar', semesterId ?? null],
    archivesList: (scope) => [...scope, 'oversight', 'archives'],
    archives: (scope, filters = {}) => [...scope, 'oversight', 'archives', filters],
    certificate: (scope, registrationId) => [...scope, 'oversight', 'certificate', String(registrationId)],
    progressTasks: (scope, topicId) => [...scope, 'oversight', 'progress-tasks', String(topicId)],
};

export const useHealthRadarStats = (scope, semesterId, enabled = true) => useQuery({
    queryKey: oversightKeys.healthRadar(scope, semesterId),
    queryFn: async () => requireSuccess(await archiveService.getHealthRadarStats({ semesterId: semesterId || undefined })).data,
    enabled,
});

export const useArchives = (scope, filters = {}, enabled = true) => useQuery({
    queryKey: oversightKeys.archives(scope, filters),
    queryFn: async () => requireSuccess(await archiveService.getAllArchives(filters)).data,
    enabled,
});

export const useClearanceCertificate = (scope, registrationId, enabled = true) => useQuery({
    queryKey: oversightKeys.certificate(scope, registrationId),
    queryFn: async () => requireSuccess(await archiveService.getClearanceCertificate(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const useProgressTasks = (scope, topicId, enabled = true) => useQuery({
    queryKey: oversightKeys.progressTasks(scope, topicId),
    queryFn: async () => requireSuccess(await taskService.getTasksByTopic(topicId)).data,
    enabled: Boolean(topicId) && enabled,
});

export const useArchiveMutation = (scope) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ action, args }) => requireSuccess(await archiveService[action](...args)),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: oversightKeys.archivesList(scope) }),
                client.invalidateQueries({ queryKey: [...scope, 'oversight', 'health-radar'] }),
                client.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) }),
                client.invalidateQueries({ queryKey: queryKeys.archives.all(scope) }),
            ]);
        },
    });
};

