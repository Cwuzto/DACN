import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { shouldRetryQuery } from '../src/utils/apiError.js';

test('clients use the agreed freshness, retention, focus and retry policy', () => {
    const client = createAppQueryClient();
    assert.deepEqual(client.getDefaultOptions(), {
        queries: {
            staleTime: 30000,
            gcTime: 300000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
        },
        mutations: { retry: false },
    });
    client.clear();
});

test('each client has an isolated cache', () => {
    const first = createAppQueryClient();
    const second = createAppQueryClient();
    first.setQueryData(['test'], 'private');
    assert.equal(second.getQueryData(['test']), undefined);
    first.clear();
    second.clear();
});

test('transient queries retry once and reuse fresh results', async () => {
    const client = createAppQueryClient();
    let attempts = 0;
    const options = {
        queryKey: ['retry'],
        retryDelay: 0,
        queryFn: async () => {
            attempts += 1;
            if (attempts === 1) throw { status: 503 };
            return 'recovered';
        },
    };
    try {
        assert.equal(await client.fetchQuery(options), 'recovered');
        assert.equal(await client.fetchQuery(options), 'recovered');
        assert.equal(attempts, 2);
        let failures = 0;
        await assert.rejects(client.fetchQuery({
            queryKey: ['unavailable'], retryDelay: 0,
            queryFn: async () => { failures += 1; throw { status: 500 }; },
        }));
        assert.equal(failures, 2);
    } finally {
        client.clear();
    }
});

test('mutations do not retry failures', async () => {
    const client = createAppQueryClient();
    let attempts = 0;
    try {
        const mutation = client.getMutationCache().build(client, {
            mutationFn: async () => { attempts += 1; throw { status: 503 }; },
        });
        await assert.rejects(mutation.execute());
        assert.equal(attempts, 1);
    } finally {
        client.clear();
    }
});
