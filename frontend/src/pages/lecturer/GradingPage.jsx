import { useMemo, useState, useEffect, useCallback } from 'react';
import { message, Tooltip, Button, Select, Tag } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
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
function GradingCard({ registration, onOpenScoreSheet, onExportPdf, exporting }) {
    const student = registration.student;
    const council = registration.council;
    const memberScores = registration.memberScores || [];
    const gradedCount = memberScores.filter((m) => m.finalScore !== null && m.finalScore !== undefined).length;
    const finalScore = registration.defenseResult?.finalScore ?? registration.finalScore ?? null;
    const hasScore = finalScore !== null && finalScore !== undefined;

    const roleLabels = {
        CHAIRMAN: 'Chủ tịch',
        SECRETARY: 'Thư ký',
        REVIEWER: 'Ủy viên',
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden mb-4 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">{registration.topic?.title || 'Chưa có tên đề tài'}</span>
                        {council?.councilType && (
                            <Tag color={council.councilType === 'OUTLINE_REVIEW' ? 'purple' : 'blue'} className="font-medium">
                                {council.councilType === 'OUTLINE_REVIEW' ? 'HĐ Đề cương' : 'HĐ Bảo vệ'}
                            </Tag>
                        )}
                        {hasScore ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Đã hoàn thành
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Đang chấm điểm
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{registration.topic?.projectCatalog?.name || 'Đồ án tốt nghiệp'}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-700">{council?.name || 'Chưa gán HĐ'}</span>
                        {council?.location && <span className="text-slate-400">({council.location})</span>}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-slate-500 font-medium">
                            Tiến độ HĐ: <strong className="text-slate-800">{gradedCount}/3 thành viên</strong>
                        </div>
                        {hasScore ? (
                            <div className="text-base font-black text-emerald-600">
                                Điểm TB: {Number(finalScore).toFixed(2)}/10
                            </div>
                        ) : (
                            <div className="text-xs text-amber-600 font-semibold mt-0.5">Chưa có điểm tổng</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                            {student?.fullName ? student.fullName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 leading-none">{student?.fullName || 'Sinh viên'}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">MSSV: {student?.code || 'N/A'}</p>
                        </div>
                    </div>

                    {memberScores.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            {memberScores.map((m, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-50 text-slate-700 border border-slate-200"
                                >
                                    <span className="font-semibold text-slate-600">
                                        {roleLabels[m.role] || m.role}:
                                    </span>
                                    <span className={m.finalScore !== null && m.finalScore !== undefined ? 'font-bold text-blue-600' : 'text-slate-400 italic'}>
                                        {m.finalScore !== null && m.finalScore !== undefined ? Number(m.finalScore).toFixed(2) : 'Chưa chấm'}
                                    </span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="primary"
                        onClick={() => onOpenScoreSheet(registration)}
                        className="rounded-lg font-medium"
                    >
                        {hasScore ? 'Xem / Cập nhật phiếu chấm' : 'Chấm điểm 14 tiêu chí'}
                    </Button>
                    <Button
                        onClick={() => onExportPdf(registration)}
                        disabled={!hasScore || exporting}
                        loading={exporting}
                        className="rounded-lg font-medium"
                    >
                        Xuất PDF
                    </Button>
                    {registration.defenseResult?.pdfUrl && (
                        <Tooltip title="Xem PDF đã xuất">
                            <Button
                                icon={<EyeOutlined />}
                                onClick={() => window.open(registration.defenseResult.pdfUrl, '_blank')}
                                className="rounded-lg"
                            >
                                Xem PDF
                            </Button>
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
        <div className="py-2 space-y-5">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Giảng viên' },
                    { label: 'Hội đồng & Chấm điểm' },
                    { label: 'Chấm điểm sinh viên' },
                ]}
                title="Hội đồng Chấm điểm & Đánh giá"
                subtitle="Lọc theo học kỳ, học phần đồ án và lựa chọn hội đồng để thực hiện đánh giá theo 14 tiêu chí hoặc xuất PDF bảng điểm."
                tags={[
                    { label: `Số hội đồng: ${councils.length}`, color: 'blue' },
                    { label: `Đã chấm: ${scoredStudents}/${totalStudents}`, color: scoredStudents === totalStudents && totalStudents > 0 ? 'green' : 'gold' },
                ]}
            />

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
                    <Select
                        allowClear
                        placeholder="Lọc theo học kỳ"
                        value={selectedSemesterId}
                        onChange={setSelectedSemesterId}
                        options={semesterOptions}
                        className="w-full sm:w-64"
                    />
                    <Select
                        allowClear
                        placeholder="Lọc theo học phần đồ án"
                        value={selectedProjectCatalogId}
                        onChange={setSelectedProjectCatalogId}
                        options={projectCatalogOptions}
                        className="w-full sm:w-72"
                    />
                </div>
                <Button icon={<ReloadOutlined />} onClick={fetchGradingStudents}>
                    Làm mới
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon="group_work" iconBg="bg-amber-50" iconColor="text-amber-600" label="Số hội đồng phụ trách" value={councils.length} />
                <StatCard icon="task_alt" iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Đã hoàn thành chấm" value={`${scoredStudents} / ${totalStudents}`} />
                <StatCard icon="group" iconBg="bg-blue-50" iconColor="text-blue-600" label="SV trong hội đồng" value={totalStudents} />
            </div>

            {loading ? <PageLoader /> : (
                <div className="space-y-4">
                    {councils.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Danh sách Hội đồng (Chọn để xem sinh viên)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {councils.map((council) => {
                                    const isSelected = selectedCouncilId === council.id;
                                    return (
                                        <div
                                            key={council.id}
                                            onClick={() => setSelectedCouncilId(council.id)}
                                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                                                isSelected
                                                    ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                                                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={`font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                                                    {council.name}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {council.count} sinh viên
                                                </span>
                                            </div>
                                            {council.defenseDate && (
                                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                                                    Ngày bảo vệ: {dayjs(council.defenseDate).format('DD/MM/YYYY')}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!councils.length ? (
                        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 shadow-sm">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                            <p className="text-sm font-medium">Không có hội đồng nào phù hợp với bộ lọc hiện tại.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between pb-1">
                                <h3 className="text-sm font-bold text-slate-800">
                                    Sinh viên báo cáo trong hội đồng
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Tổng số: <b className="text-slate-700">{currentCouncilRegistrations.length}</b> sinh viên
                                </span>
                            </div>

                            {currentCouncilRegistrations.map((registration) => (
                                <GradingCard
                                    key={registration.id}
                                    registration={registration}
                                    onOpenScoreSheet={handleOpenSheet}
                                    onExportPdf={handleExportPdf}
                                    exporting={exportingId === registration.id}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default GradingPage;
