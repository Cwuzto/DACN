import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { afterEach, expect, test } from 'vitest';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';

const clients = new Set();
afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.clear();
});

function CacheProbe({ value }) {
    const client = useQueryClient();
    clients.add(client);
    if (!client.getQueryData(['probe'])) client.setQueryData(['probe'], value);
    return <output>{client.getQueryData(['probe'])}</output>;
}

test('a mounted provider retains its client and cache across rerenders in StrictMode', () => {
    const view = render(<StrictMode><AppQueryProvider><CacheProbe value="initial" /></AppQueryProvider></StrictMode>);
    view.rerender(<StrictMode><AppQueryProvider><CacheProbe value="later" /></AppQueryProvider></StrictMode>);
    expect(screen.getByText('initial')).toBeInTheDocument();
    expect(clients.size).toBe(1);
});

test('separate providers do not share server state', () => {
    render(<><AppQueryProvider><CacheProbe value="first" /></AppQueryProvider><AppQueryProvider><CacheProbe value="second" /></AppQueryProvider></>);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(clients.size).toBe(2);
});

test('an injected client is used by descendants', () => {
    const client = createAppQueryClient();
    client.setQueryData(['probe'], 'injected');
    render(<AppQueryProvider client={client}><CacheProbe value="unused" /></AppQueryProvider>);
    expect(screen.getByText('injected')).toBeInTheDocument();
    expect(clients.has(client)).toBe(true);
});
