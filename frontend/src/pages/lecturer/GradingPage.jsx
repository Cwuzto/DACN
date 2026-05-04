import { useMemo, useState, useEffect, useCallback } from 'react';
import { message, Tooltip, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PageLoader from '../../components/common/PageLoader';

function GradingCard({ registration, onOpenScoreSheet, onExportPdf }) {
    const student = registration.student;
    const hasScore = registration.finalScore !== null && registration.finalScore !== undefined;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="p-6 border-b border-slate-100">
                <h4 className="text-lg font-bold text-slate-900">{registration.topic?.title}</h4>
            </div>
            <div className="p-6 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-slate-900">{student?.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono">{student?.code}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onOpenScoreSheet(registration)}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                        {hasScore ? 'Mo phieu cham' : 'Cham diem tren phieu'}
                    </button>
                    <button
                        onClick={() => onExportPdf(registration)}
                        disabled={!hasScore}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    >
                        Xuat PDF
                    </button>
                    {registration.defenseResult?.pdfUrl && (
                        <Tooltip title="Xem PDF da xuat">
                            <Button icon={<EyeOutlined />} onClick={() => window.open(registration.defenseResult.pdfUrl, '_blank')}>Xem PDF</Button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
}

function GradingPage() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportingId, setExportingId] = useState(null);

    const fetchGradingStudents = useCallback(async () => {
        try {
            setLoading(true);
            const res = await evaluationService.getGradingStudents();
            if (res.success) {
                const normalized = (res.data || []).map((item) => ({
                    ...item,
                    gradingStatus: item.defenseResult ? 'GRADED' : 'PENDING',
                    finalScore: item.defenseResult?.finalScore ?? item.finalScore ?? null,
                }));
                setRegistrations(normalized);
            }
        } catch (error) {
            message.error(error.message || 'Loi khi tai danh sach sinh vien cham diem');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGradingStudents();
    }, [fetchGradingStudents]);

    const handleOpenSheet = (registration) => {
        window.open(`/lecturer/grading/sheet/${registration.id}`, '_blank');
    };

    const handleExportPdf = async (registration) => {
        try {
            setExportingId(registration.id);
            const res = await evaluationService.exportScoreSheetPdf(registration.id);
            if (res.success) {
                message.success(res.message || 'Da xuat PDF bang diem');
                if (res.data?.pdfUrl) window.open(res.data.pdfUrl, '_blank');
                fetchGradingStudents();
            }
        } catch (error) {
            message.error(error.message || 'Khong the xuat PDF bang diem');
        } finally {
            setExportingId(null);
        }
    };

    const totalStudents = registrations.length;
    const scoredStudents = useMemo(() => registrations.filter((r) => r.gradingStatus === 'GRADED').length, [registrations]);

    return (
        <div className="py-2">
            <PageHeader title="Cham diem Do an" subtitle="Mo phieu mau tren trang rieng de cham truc tiep, sau do xuat PDF." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard icon="task_alt" iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Da cham" value={`${scoredStudents} / ${totalStudents}`} />
                <StatCard icon="group" iconBg="bg-blue-100" iconColor="text-blue-600" label="Tong sinh vien" value={totalStudents} />
                <StatCard icon="assignment_ind" iconBg="bg-purple-100" iconColor="text-purple-600" label="Vai tro" value="Giam khao / GVHD" />
            </div>

            {loading ? <PageLoader /> : registrations.map((registration) => (
                <div key={registration.id} className="relative">
                    {exportingId === registration.id && <div className="absolute right-4 top-4 text-xs text-slate-500">Dang xuat PDF...</div>}
                    <GradingCard registration={registration} onOpenScoreSheet={handleOpenSheet} onExportPdf={handleExportPdf} />
                </div>
            ))}
        </div>
    );
}

export default GradingPage;
