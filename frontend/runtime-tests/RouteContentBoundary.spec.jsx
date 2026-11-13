import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RouteContentBoundary from '../src/components/common/RouteContentBoundary.jsx';
import { isChunkLoadError } from '../src/utils/chunkError.js';

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function ThrowingPage({ fail }) {
    if (fail()) throw new Error('private render details');
    return <p>Recovered content</p>;
}

test('a render error can retry in place using the keyboard', async () => {
    let failing = true;
    render(<MemoryRouter><RouteContentBoundary><ThrowingPage fail={() => failing} /></RouteContentBoundary></MemoryRouter>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải lại trang' })).not.toBeInTheDocument();
    failing = false;
    screen.getByRole('button', { name: 'Thử lại' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
});

test.each(['path', 'search', 'key'])('resets a failed content region when location %s changes', async (change) => {
    let failing = true;
    function Navigation() {
        const navigate = useNavigate();
        const location = useLocation();
        return <button onClick={() => { failing = false; navigate(change === 'path' ? '/next' : change === 'search' ? '/?tab=next' : location.pathname); }}>Navigate</button>;
    }
    render(<MemoryRouter><Navigation /><RouteContentBoundary><ThrowingPage fail={() => failing} /></RouteContentBoundary></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(await screen.findByText('Recovered content')).toBeInTheDocument();
});

test('back recovers through router history', async () => {
    function Page() {
        const location = useLocation();
        return <ThrowingPage fail={() => location.pathname === '/broken'} />;
    }
    render(<MemoryRouter initialEntries={['/healthy', '/broken']}><RouteContentBoundary><Page /></RouteContentBoundary></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(await screen.findByText('Recovered content')).toBeInTheDocument();
});

test('production fallback hides render messages and stacks', () => {
    vi.stubEnv('PROD', true);
    render(<MemoryRouter><RouteContentBoundary><ThrowingPage fail={() => true} /></RouteContentBoundary></MemoryRouter>);
    expect(screen.queryByText(/private render details/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ThrowingPage/)).not.toBeInTheDocument();
});

test('only chunk failures offer document reload', () => {
    const reload = vi.fn();
    function ChunkFailure() { throw new TypeError('Failed to fetch dynamically imported module: /assets/page.js'); }
    render(<MemoryRouter><RouteContentBoundary><ChunkFailure /></RouteContentBoundary></MemoryRouter>);
    expect(reload).not.toHaveBeenCalled();
    const reloadButton = screen.getByRole('button', { name: 'Tải lại trang' });
    vi.stubGlobal('window', { location: { reload } });
    fireEvent.click(reloadButton);
    vi.unstubAllGlobals();
    expect(reload).toHaveBeenCalledOnce();
});

test.each([
    [{ name: 'ChunkLoadError', message: 'Loading chunk 42 failed.' }, true],
    [new TypeError('Failed to fetch dynamically imported module: /assets/page.js'), true],
    [new TypeError('Importing a module script failed.'), true],
    [new Error('error loading dynamically imported module: /assets/page.js'), true],
    [new Error('Failed to fetch'), false],
    [new Error('A chunk of registration data is missing'), false],
    [null, false],
])('classifies module failures without treating request failures as chunk errors: %j', (error, expected) => {
    expect(isChunkLoadError(error)).toBe(expected);
});
