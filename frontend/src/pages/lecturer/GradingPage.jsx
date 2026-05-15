import { useMemo, useState, useEffect, useCallback } from 'react';
import { message, Tooltip, Button, Select } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import PageLoader from '../../components/common/PageLoader';
import { PROJECT_NAME } from '../../utils/semesterDisplay';

const normalizeText = (value = '') =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

const pickNearestLatestSemesterId = (semesterList = []) => {
    if (!semesterList.length) return null;
    const now = dayjs();
    const scored = semesterList
        .map((semester) => {
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const deadline = semester?.registrationDeadline ? dayjs(semester.registrationDeadline) : null;
            const latestPoint =
                (start && start.isValid() && start.valueOf())
                || (deadline && deadline.isValid() && deadline.valueOf())
                || 0;
            const distanceToNow = Math.abs((latestPoint || now.valueOf()) - now.valueOf());
            return { semester, latestPoint, distanceToNow };
        })
        .sort((a, b) => {
            if (a.distanceToNow !== b.distanceToNow) return a.distanceToNow - b.distanceToNow;
            return b.latestPoint - a.latestPoint;
        });
    return scored[0]?.semester?.id || null;
};

function GradingCard({ registration, onOpenScoreSheet, onExportPdf }) {
    const student = registration.student;
    const hasScore = registration.finalScore !== null && registration.finalScore !== undefined;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <div className="p-5 border-b border-slate-100">
                <h4 className="text-base font-bold text-slate-900">{registration.topic?.title}</h4>
                <p className="text-xs text-slate-500 mt-1">
                    {registration.topic?.projectCatalog?.name || 'Học phần chưa xác định'} | {registration.topic?.semester?.name || 'Học kỳ'}
                </p>
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-slate-900">{student?.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono">{student?.code}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onOpenScoreSheet(registration)}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                        {hasScore ? 'Mở phiếu chấm' : 'Chấm điểm trên phiếu'}
                    </button>
                    <button
                        onClick={() => onExportPdf(registration)}
                        disabled={!hasScore}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    >
                        Xuất PDF
                    </button>
                    {registration.defenseResult?.pdfUrl && (
                        <Tooltip title="Xem PDF đã xuất">
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
    const [allRegistrations, setAllRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportingId, setExportingId] = useState(null);
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [selectedProjectCatalogId, setSelectedProjectCatalogId] = useState(null);
    const [selectedCouncilId, setSelectedCouncilId] = useState(null);

    const fetchGradingStudents = useCallback(async () => {
        try {
            setLoading(true);
            const [filteredRes, allRes] = await Promise.all([
                evaluationService.getGradingStudents({
                    semesterId: selectedSemesterId || undefined,
                    projectCatalogId: selectedProjectCatalogId || undefined,
                }),
                evaluationService.getGradingStudents(),
            ]);
            if (filteredRes.success) {
                const normalized = (filteredRes.data || []).map((item) => ({
                    ...item,
                    gradingStatus: item.finalScore !== null && item.finalScore !== undefined ? 'GRADED' : 'PENDING',
                }));
                setRegistrations(normalized);
            }
            if (allRes.success) {
                setAllRegistrations(allRes.data || []);
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi tải danh sách sinh viên chấm điểm');
        } finally {
            setLoading(false);
        }
    }, [selectedProjectCatalogId, selectedSemesterId]);

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
                message.success(res.message || 'Đã xuất PDF bảng điểm');
                if (res.data?.pdfUrl) window.open(res.data.pdfUrl, '_blank');
                fetchGradingStudents();
            }
        } catch (error) {
            message.error(error.message || 'Không thể xuất PDF bảng điểm');
        } finally {
            setExportingId(null);
        }
    };

    const semesterOptions = useMemo(() => {
        const map = new Map();
        for (const r of allRegistrations) {
            const semester = r.topic?.semester;
            if (semester?.id && !map.has(semester.id)) {
                map.set(semester.id, semester);
            }
        }
        return [...map.values()].map((semester) => ({
            value: semester.id,
            label: semester.name,
            raw: semester,
        }));
    }, [allRegistrations]);

    const projectCatalogOptions = useMemo(() => {
        const map = new Map();
        for (const r of allRegistrations) {
            const p = r.topic?.projectCatalog;
            if (p?.id && !map.has(p.id)) {
                map.set(p.id, {
                    value: p.id,
                    label: `${p.code} - ${p.name}`,
                    raw: p,
                });
            }
        }
        return [...map.values()];
    }, [allRegistrations]);

    useEffect(() => {
        if (!allRegistrations.length) return;

        const semesterStillExists = semesterOptions.some((opt) => opt.value === selectedSemesterId);
        if (!selectedSemesterId || !semesterStillExists) {
            const nearestSemesterId = pickNearestLatestSemesterId(semesterOptions.map((opt) => opt.raw));
            if (nearestSemesterId) setSelectedSemesterId(nearestSemesterId);
        }

        const projectStillExists = projectCatalogOptions.some((opt) => opt.value === selectedProjectCatalogId);
        if (!selectedProjectCatalogId || !projectStillExists) {
            const target = normalizeText(PROJECT_NAME);
            const defaultProject =
                projectCatalogOptions.find((opt) => normalizeText(opt.raw?.name).includes(target))
                || projectCatalogOptions.find((opt) => normalizeText(opt.label).includes(target))
                || projectCatalogOptions[0];
            if (defaultProject?.value) setSelectedProjectCatalogId(defaultProject.value);
        }
    }, [allRegistrations, semesterOptions, projectCatalogOptions, selectedSemesterId, selectedProjectCatalogId]);

    const councils = useMemo(() => {
        const map = new Map();
        for (const r of registrations) {
            if (!r.council?.id) continue;
            if (!map.has(r.council.id)) {
                map.set(r.council.id, {
                    id: r.council.id,
                    name: r.council.name || `Hội đồng ${r.council.id}`,
                    defenseDate: r.council.defenseDate || null,
                    count: 0,
                });
            }
            map.get(r.council.id).count += 1;
        }
        return [...map.values()];
    }, [registrations]);

    useEffect(() => {
        if (!selectedCouncilId && councils.length) {
            setSelectedCouncilId(councils[0].id);
            return;
        }
        if (selectedCouncilId && !councils.some((c) => c.id === selectedCouncilId)) {
            setSelectedCouncilId(councils[0]?.id || null);
        }
    }, [councils, selectedCouncilId]);

    const currentCouncilRegistrations = useMemo(() => {
        if (!selectedCouncilId) return [];
        return registrations.filter((r) => r.council?.id === selectedCouncilId);
    }, [registrations, selectedCouncilId]);

    const totalStudents = currentCouncilRegistrations.length;
    const scoredStudents = currentCouncilRegistrations.filter((r) => r.gradingStatus === 'GRADED').length;

    return (
        <div className="py-2">
            <PageHeader title="Hội đồng chấm điểm" subtitle="ọc theo học phần/học kỳ, chọn hội đồng, sau đó chấm điểm cho sinh viên thuộc hội đồng." />

            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                    allowClear
                    placeholder="Lọc theo học kỳ"
                    value={selectedSemesterId}
                    onChange={setSelectedSemesterId}
                    options={semesterOptions}
                />
                <Select
                    allowClear
                    placeholder="Lọc theo học phần đồ án"
                    value={selectedProjectCatalogId}
                    onChange={setSelectedProjectCatalogId}
                    options={projectCatalogOptions}
                />
                <Button icon={<ReloadOutlined />} onClick={fetchGradingStudents} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard icon="group_work" iconBg="bg-amber-100" iconColor="text-amber-600" label="Số hội đồng" value={councils.length} />
                <StatCard icon="task_alt" iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Đã chấm" value={`${scoredStudents} / ${totalStudents}`} />
                <StatCard icon="group" iconBg="bg-blue-100" iconColor="text-blue-600" label="SV trong hội đồng" value={totalStudents} />
            </div>

            {loading ? <PageLoader /> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        {councils.map((council) => (
                            <button
                                key={council.id}
                                onClick={() => setSelectedCouncilId(council.id)}
                                className={`text-left rounded-xl border p-4 ${selectedCouncilId === council.id ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white'}`}
                            >
                                <div className="font-bold text-slate-900">{council.name}</div>
                                <div className="text-xs text-slate-500 mt-1">Số SV bảo vệ: {council.count}</div>
                            </button>
                        ))}
                    </div>

                    {!councils.length && <div className="text-sm text-slate-500">Không có hội đồng phù hợp với bộ lọc.</div>}

                    {currentCouncilRegistrations.map((registration) => (
                        <div key={registration.id} className="relative">
                            {exportingId === registration.id && <div className="absolute right-4 top-4 text-xs text-slate-500">Dang xuat PDF...</div>}
                            <GradingCard registration={registration} onOpenScoreSheet={handleOpenSheet} onExportPdf={handleExportPdf} />
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default GradingPage;
