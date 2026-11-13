import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test } from 'vitest';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';

let client;
const userA = { id: 'account-a', permissionVersion: 1 };
const userB = { id: 'account-b', permissionVersion: 1 };
beforeEach(() => {
    useAuthStore.getState().setAuth('token-a', userA);
    client = createAppQueryClient();
});
afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.getState().logout();
});

for (const [event, change] of [
    ['logout', () => useAuthStore.getState().logout()],
    ['account switch', () => useAuthStore.getState().setAuth('token-b', userB)],
    ['permission update', () => useAuthStore.getState().updateUser({ ...userA, permissionVersion: 2 })],
]) {
    test(`${event} immediately aborts active queries and clears query and mutation caches`, async () => {
        render(<AppQueryProvider client={client}><div>Workspace</div></AppQueryProvider>);
        const scope = queryKeys.scope(userA);
        const key = queryKeys.topics.list(scope);
        client.setQueryData(queryKeys.grading.list(scope), 'private grades');
        const mutation = client.getMutationCache().build(client, { mutationFn: async () => 'private mutation result' });
        await mutation.execute();
        let signal;
        let finish;
        const pending = client.fetchQuery({ queryKey: key, queryFn: (context) => {
            signal = context.signal;
            return new Promise((resolve) => { finish = resolve; });
        } }).catch(() => undefined);
        expect(signal.aborted).toBe(false);
        act(change);
        expect(signal.aborted).toBe(true);
        expect(client.getQueryCache().getAll()).toHaveLength(0);
        expect(client.getMutationCache().getAll()).toHaveLength(0);
        finish('late response from account A');
        await pending;
        expect(client.getQueryData(key)).toBeUndefined();
    });
}

function PrivateData({ finishers, rendered }) {
    const user = useAuthStore((state) => state.user);
    const query = useQuery({
        queryKey: queryKeys.topics.list(queryKeys.scope(user)),
        queryFn: () => new Promise((resolve) => { finishers[user.id] = resolve; }),
        placeholderData: keepPreviousData,
        enabled: !!user,
    });
    const text = query.data ?? 'Loading';
    rendered.push({ id: user?.id, text });
    return <output>{text}</output>;
}

test('the next account never renders prior data, including previous-data placeholders', async () => {
    const finishers = {};
    const rendered = [];
    render(<AppQueryProvider client={client}><PrivateData finishers={finishers} rendered={rendered} /></AppQueryProvider>);
    await act(async () => finishers['account-a']('Account A private topics'));
    await screen.findByText('Account A private topics');
    act(() => useAuthStore.getState().setAuth('token-b', userB));
    expect(screen.queryByText('Account A private topics')).not.toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await act(async () => finishers['account-b']('Account B topics'));
    await screen.findByText('Account B topics');
    expect(rendered.filter((entry) => entry.id === 'account-b').every((entry) => entry.text !== 'Account A private topics')).toBe(true);
});

test('token and profile refreshes keep cache when identity and permission version are unchanged', async () => {
    render(<AppQueryProvider client={client}><div>Workspace</div></AppQueryProvider>);
    const key = queryKeys.users.list(queryKeys.scope(userA));
    client.setQueryData(key, 'same scope');
    act(() => useAuthStore.getState().setAuth('refreshed-token', { ...userA, fullName: 'New name' }));
    await waitFor(() => expect(client.getQueryData(key)).toBe('same scope'));
});
