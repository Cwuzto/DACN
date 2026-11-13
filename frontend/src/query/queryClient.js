import { QueryClient } from '@tanstack/react-query';
import { shouldRetryQuery } from '../utils/apiError.js';

export const createAppQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            gcTime: 300000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
        },
        mutations: { retry: false },
    },
});
