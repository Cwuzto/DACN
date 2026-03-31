import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

function RouteErrorPage({ path }) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-black text-red-600 mb-2">Duong dan khong hop le</h1>
                <p className="text-slate-600 mb-4">
                    He thong phat hien URL sai dinh dang. Vui long kiem tra lai duong dan.
                </p>
                <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 break-all">
                    {path}
                </div>
                <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
                    Ve trang dang nhap
                </Button>
            </div>
        </div>
    );
}

export default RouteErrorPage;
