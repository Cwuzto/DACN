import { Skeleton } from 'antd';

export default function ContentSkeleton({ variant = 'detail', rows = 5 }) {
    const panel = <Skeleton active title={{ width: '40%' }} paragraph={{ rows }} />;
    return (
        <section role="status" aria-label="Đang tải nội dung" aria-busy="true" className="min-h-[40vh] space-y-6 py-2">
            <span className="sr-only">Đang tải nội dung</span>
            <div aria-hidden="true" className="space-y-6">
                <Skeleton title={{ width: '32%' }} paragraph={{ rows: 1 }} active />
                {variant === 'dashboard' ? (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {[0, 1, 2].map((index) => <div key={index} className="rounded-lg border border-slate-200 bg-white p-5"><Skeleton active title paragraph={{ rows: 1 }} /></div>)}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-5">{panel}</div>
                    </>
                ) : variant === 'table' ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <Skeleton.Button block active />
                        <div className="mt-6">{panel}</div>
                    </div>
                ) : variant === 'form' ? (
                    <div className="max-w-3xl space-y-6 rounded-lg border border-slate-200 bg-white p-5">
                        {Array.from({ length: rows }, (_, index) => <Skeleton key={index} active title={{ width: '25%' }} paragraph={{ rows: 1, width: '100%' }} />)}
                        <Skeleton.Button active />
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-200 bg-white p-5">{panel}</div>
                )}
            </div>
        </section>
    );
}
