import ContentSkeleton from './ContentSkeleton';
import ContentRefreshIndicator from './ContentRefreshIndicator';
import QueryErrorState from './QueryErrorState';
import EmptyState from './EmptyState';

// A panel owns its request state. Cached content survives background failures.
export default function QueryPanel({ query, children, empty = false, emptyDescription, variant = 'detail' }) {
    if (query.isPending) return query.fetchStatus === 'idle' ? null : <ContentSkeleton variant={variant} rows={3} />;
    return <>
        {query.isError && <QueryErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />}
        {query.data !== undefined && <>
            <ContentRefreshIndicator refreshing={query.isFetching} />
            {empty ? <EmptyState description={emptyDescription} /> : children}
        </>}
    </>;
}
