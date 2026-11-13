import { useLayoutEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from '../stores/authStore.js';
import { createAppQueryClient } from '../query/queryClient.js';
import { queryKeys } from '../query/queryKeys.js';

const getAuthScope = (state) => JSON.stringify(queryKeys.scope(state.isAuthenticated ? state.user : null));

export function AppQueryProvider({ children, client }) {
    const [ownedClient] = useState(() => client ?? createAppQueryClient());
    const queryClient = client ?? ownedClient;
    const authScope = useAuthStore(getAuthScope);
    const previousScope = useRef(authScope);

    useLayoutEffect(() => {
        const syncScope = (state) => {
            const nextScope = getAuthScope(state);
            if (previousScope.current === nextScope) return;
            previousScope.current = nextScope;
            // The Zustand subscription runs synchronously, before consumers can
            // render the next session. Do not await cancellation before clearing.
            void queryClient.cancelQueries();
            queryClient.clear();
        };
        const unsubscribe = useAuthStore.subscribe(syncScope);
        syncScope(useAuthStore.getState());
        return unsubscribe;
    }, [queryClient]);

    // Reset query observers (including keepPreviousData/local component state)
    // at session boundaries so a new account cannot render the old account's data.
    return (
        <QueryClientProvider client={queryClient} key={authScope}>
            {children}
        </QueryClientProvider>
    );
}

export default AppQueryProvider;
