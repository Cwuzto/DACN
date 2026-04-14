/**
 * PageLoader — Unified full-page loading spinner.
 * Replaces custom spinners and antd Spin for page-level loading.
 */

export default function PageLoader() {
    return (
        <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        </div>
    );
}
