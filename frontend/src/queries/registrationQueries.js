import { useQuery } from '@tanstack/react-query';
import registrationService from '../services/registrationService';
import { queryKeys } from '../query/queryKeys.js';
import { normalizeApiError } from '../utils/apiError.js';

export const useStudentRegistration = (scope) => useQuery({
    queryKey: queryKeys.registrations.current(scope),
    queryFn: async () => {
        const response = await registrationService.getMyRegistration();
        if (!response?.success) throw normalizeApiError(response);
        return response;
    },
});
