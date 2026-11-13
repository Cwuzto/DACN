import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import archiveService, { normalizeDefenseDossier } from '../services/archiveService.js';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';

const requireSuccess = response => {
    if (!response?.success) throw normalizeApiError(response);
    return response;
};

export const useStudentArchive = (scope, registrationId) => useQuery({
    queryKey: queryKeys.archives.detail(scope, registrationId),
    queryFn: async () => {
        const response = requireSuccess(await archiveService.getArchiveByRegistration(registrationId));
        // This endpoint also returns a full registration. The student archive
        // view needs only the archive, so exclude that duplicate personal data.
        return { success: true, data: { archive: response.data?.archive ?? null } };
    },
    enabled: Boolean(registrationId),
});

export const useDefenseDossier = (scope, registrationId, options = {}) => useQuery({
    queryKey: queryKeys.archives.dossier(scope, registrationId),
    queryFn: async () => {
        const response = requireSuccess(await archiveService.getDefenseDossier(registrationId));
        return { success: true, data: normalizeDefenseDossier(response.data) };
    },
    ...options,
    enabled: Boolean(registrationId) && options.enabled !== false,
});

export const useUploadDefenseDocument = (scope, registrationId) => {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async payload => requireSuccess(await archiveService.uploadDefenseDocument(registrationId, payload)),
        onSuccess: async () => Promise.all([
            queryKeys.archives.detail(scope, registrationId),
            queryKeys.archives.dossier(scope, registrationId),
            queryKeys.registrations.current(scope),
        ].map(queryKey => client.invalidateQueries({ queryKey, exact: true }))),
    });
};

export const useClearanceCertificate = (scope, registrationId, enabled = true) => useQuery({
    queryKey: [...queryKeys.archives.detail(scope, registrationId), 'clearance-certificate'],
    queryFn: async () => requireSuccess(await archiveService.getClearanceCertificate(registrationId)).data,
    enabled: Boolean(registrationId) && enabled,
});

export const canUploadArchive = status => [
    'BM03_PASSED', 'DEFENSE_READY', 'DEFENSE_PASSED', 'DEFENDED', 'COMPLETED',
    'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'PENDING_INSTITUTE_SIGNATURE',
].includes(status);
