import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import ContentSkeleton from '../src/components/common/ContentSkeleton.jsx';
import QueryErrorState from '../src/components/common/QueryErrorState.jsx';
import EmptyState from '../src/components/common/EmptyState.jsx';
import ContentRefreshIndicator from '../src/components/common/ContentRefreshIndicator.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';

afterEach(() => vi.restoreAllMocks());

test.each(['dashboard', 'table', 'detail', 'form'])('%s skeleton exposes loading and reserves content space', (variant) => {
    const { container } = render(<ContentSkeleton variant={variant} rows={3} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveAccessibleName('Đang tải nội dung');
    expect(container.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('error has alert semantics, keyboard retry and pending feedback', async () => {
    const retry = vi.fn();
    const view = render(<QueryErrorState error={{ message: 'Không thể lấy dữ liệu' }} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể lấy dữ liệu');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(<QueryErrorState error={{ message: 'Không thể lấy dữ liệu' }} onRetry={retry} retrying />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Thử lại/ })).toBeDisabled();
});

test('empty renders explanation and optional action separately from error and loading', async () => {
    const action = vi.fn();
    render(<EmptyState title="Chưa có đề tài" description="Đăng ký đề tài để bắt đầu." action={<button onClick={action}>Đăng ký</button>} />);
    expect(screen.getByText('Chưa có đề tài')).toBeInTheDocument();
    expect(screen.getByText('Đăng ký đề tài để bắt đầu.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(action).toHaveBeenCalledOnce();
});

test('empty keeps the existing optional icon supplied by notifications', () => {
    render(<EmptyState title="Chưa có thông báo" icon={<span role="img" aria-label="Thông báo" />} />);
    expect(screen.getByRole('img', { name: 'Thông báo' })).toBeInTheDocument();
});

test('background query refresh retains cached content and announces progress', async () => {
    const client = createAppQueryClient();
    client.setQueryData(['shared-state'], 'Cached result');
    let finish;
    const queryFn = () => new Promise((resolve) => { finish = resolve; });
    function QueryPage() {
        const query = useQuery({ queryKey: ['shared-state'], queryFn });
        return <><ContentRefreshIndicator refreshing={query.isFetching} /><p>{query.data}</p><button onClick={() => query.refetch()}>Refresh</button></>;
    }
    const view = render(<AppQueryProvider client={client}><QueryPage /></AppQueryProvider>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const cachedNode = screen.getByText('Cached result');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật');
    expect(screen.getByText('Cached result')).toBe(cachedNode);
    finish('Updated result');
    await waitFor(() => expect(screen.getByText('Updated result')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.unmount();
    client.clear();
});
