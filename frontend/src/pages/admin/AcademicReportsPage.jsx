import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Col,
    Empty,
    Input,
    message,
    Progress,
    Row,
    Select,
    Spin,
    Statistic,
    Table,
    Tabs,
    Tag,
    Tooltip,
} from 'antd';
import {
    BarChartOutlined,
    CheckCircleOutlined,
    DownloadOutlined,
    FallOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    RiseOutlined,
    SearchOutlined,
    TeamOutlined,
    TrophyOutlined,
    UserOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { reportService } from '../../services/reportService';
import { useSemesters } from '../../queries/semesterQueries';
import { useReportOverview, useLecturerWorkload } from '../../queries/reportQueries';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import QueryPanel from '../../components/common/QueryPanel';
import EmptyState from '../../components/common/EmptyState';

const GRADE_BAND_COLORS = {
    EXCELLENT: '#10B981',
    GOOD: '#0F766E',
    FAIR: '#F59E0B',
    AVERAGE: '#64748B',
    FAILED: '#EF4444',
};

const GRADE_RANGES = {
    EXCELLENT: '8.5 - 10.0',
    GOOD: '7.0 - 8.4',
    FAIR: '5.5 - 6.9',
    AVERAGE: '4.0 - 5.4',
    FAILED: '< 4.0 / Vắng',
};

export default function AcademicReportsPage() {
    const user = useAuthStore(state => state.user);
    const scope = queryKeys.scope(user);
    const semestersQuery = useSemesters(scope);
    const semesters = semestersQuery.data || [];
    const [selectedSemesterId, setSelectedSemesterId] = useState(undefined);
    const [selectedMajor, setSelectedMajor] = useState('ALL');
    const [availableMajors, setAvailableMajors] = useState([]);

    const [exporting, setExporting] = useState(false);

    const overviewQuery = useReportOverview(scope, {
        semesterId: selectedSemesterId,
        major: selectedMajor !== 'ALL' ? selectedMajor : undefined,
    });
    const workloadQuery = useLecturerWorkload(scope, selectedSemesterId);
    const overviewData = overviewQuery.data;
    const workloadData = workloadQuery.data || [];
    const loading = overviewQuery.isPending;
    const [lecturerSearch, setLecturerSearch] = useState('');

    useEffect(() => {
        if (selectedSemesterId || !semesters.length) return;
        const active = semesters.find(s => s.status === 'ACTIVE' || s.status === 'ONGOING') || semesters[0];
        setSelectedSemesterId(active.id);
    }, [semesters, selectedSemesterId]);

    useEffect(() => {
        if (selectedMajor === 'ALL' && Array.isArray(overviewData?.majors)) {
            setAvailableMajors(Array.from(new Set(overviewData.majors.map(m => m.major).filter(Boolean))));
        }
    }, [overviewData, selectedMajor]);

    const loadReportData = () => {
        if (!selectedSemesterId) return;
        overviewQuery.refetch();
        workloadQuery.refetch();
    };

    const handleExportExcel = async () => {
        if (!selectedSemesterId) {
            message.warning('Vui lòng chọn học kỳ để xuất báo cáo');
            return;
        }

        setExporting(true);
        try {
            const majorParam = selectedMajor !== 'ALL' ? selectedMajor : undefined;
            const res = await reportService.exportExcel({
                semesterId: selectedSemesterId,
                major: majorParam,
            });

            const blob = new Blob([res], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const currentSem = semesters.find((s) => s.id === selectedSemesterId);
            const semesterCode = currentSem?.code || currentSem?.name || 'HocKy';
            a.download = `Bang_Tong_Hop_Ket_Qua_Tot_Nghiep_${semesterCode}.xlsx`;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            message.success('Xuất file Excel báo cáo tốt nghiệp thành công');
        } catch (error) {
            message.error(error?.message || 'Không thể xuất file Excel báo cáo');
        } finally {
            setExporting(false);
        }
    };

    // Dữ liệu KPIs tổng hợp
    const kpis = overviewData?.kpis || {
        totalStudents: 0,
        completedCount: 0,
        completionRate: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
    };

    const gradeDistribution = overviewData?.gradeDistribution || [];
    const funnel = overviewData?.funnel || [];
    const majorsData = overviewData?.majors || [];

    // Tỷ lệ Xuất sắc & Giỏi
    const excellenceStats = useMemo(() => {
        const excellent = gradeDistribution.find((g) => g.grade === 'EXCELLENT') || { count: 0, percent: 0 };
        const good = gradeDistribution.find((g) => g.grade === 'GOOD') || { count: 0, percent: 0 };
        const totalRate = Math.round((Number(excellent.percent) + Number(good.percent)) * 10) / 10;
        return {
            rate: totalRate,
            excellentCount: excellent.count,
            goodCount: good.count,
        };
    }, [gradeDistribution]);

    // Lọc danh sách Giảng viên theo tìm kiếm
    const filteredWorkload = useMemo(() => {
        if (!lecturerSearch.trim()) return workloadData;
        const q = lecturerSearch.trim().toLowerCase();
        return workloadData.filter((item) =>
            (item.fullName || '').toLowerCase().includes(q) ||
            (item.email || '').toLowerCase().includes(q) ||
            (item.department || '').toLowerCase().includes(q)
        );
    }, [workloadData, lecturerSearch]);

    // Cột bảng Phổ điểm (Tab 1)
    const gradeColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 70,
            align: 'center',
            render: (_, __, idx) => idx + 1,
        },
        {
            title: 'Phân loại học lực',
            dataIndex: 'label',
            key: 'label',
            render: (label, record) => (
                <div className="flex items-center space-x-2">
                    <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: record.color || GRADE_BAND_COLORS[record.grade] }}
                    />
                    <span className="font-semibold text-slate-800">{label}</span>
                </div>
            ),
        },
        {
            title: 'Khoảng điểm quy chuẩn',
            dataIndex: 'grade',
            key: 'range',
            width: 200,
            render: (grade) => (
                <Tag color="blue">{GRADE_RANGES[grade] || '—'}</Tag>
            ),
        },
        {
            title: 'Số lượng sinh viên',
            dataIndex: 'count',
            key: 'count',
            width: 180,
            align: 'center',
            render: (count) => (
                <span className="font-bold text-slate-800 text-base">{count}</span>
            ),
        },
        {
            title: 'Tỷ lệ %',
            dataIndex: 'percent',
            key: 'percent',
            width: 140,
            align: 'center',
            render: (percent) => (
                <span className="font-semibold text-emerald-700">{percent}%</span>
            ),
        },
        {
            title: 'Thanh phân bổ trực quan',
            dataIndex: 'percent',
            key: 'progress',
            render: (percent, record) => (
                <Progress
                    percent={percent}
                    strokeColor={record.color || GRADE_BAND_COLORS[record.grade]}
                    showInfo={false}
                />
            ),
        },
    ];

    // Cột bảng So sánh Chuyên ngành (Tab 3)
    const majorColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 70,
            align: 'center',
            render: (_, __, idx) => idx + 1,
        },
        {
            title: 'Chuyên ngành đào tạo',
            dataIndex: 'major',
            key: 'major',
            render: (major) => <span className="font-semibold text-slate-800">{major}</span>,
        },
        {
            title: 'Tổng số sinh viên',
            dataIndex: 'studentCount',
            key: 'studentCount',
            width: 160,
            align: 'center',
            render: (count) => <span className="font-bold text-slate-800">{count}</span>,
        },
        {
            title: 'Số SV hoàn thành',
            dataIndex: 'completedCount',
            key: 'completedCount',
            width: 160,
            align: 'center',
            render: (count) => <span className="font-semibold text-emerald-600">{count}</span>,
        },
        {
            title: 'Tỷ lệ hoàn thành %',
            key: 'completionRate',
            width: 200,
            render: (_, record) => {
                const rate = record.studentCount > 0
                    ? Math.round((record.completedCount / record.studentCount) * 1000) / 10
                    : 0;
                return (
                    <div className="flex items-center space-x-2">
                        <Progress percent={rate} size="small" strokeColor="#10B981" />
                    </div>
                );
            },
        },
        {
            title: 'Điểm trung bình',
            dataIndex: 'avgScore',
            key: 'avgScore',
            width: 160,
            align: 'center',
            render: (score) => (
                <span className="font-bold text-teal-800 text-base">
                    {score !== undefined && score !== null ? Number(score).toFixed(2) : '—'}
                </span>
            ),
        },
        {
            title: 'Đánh giá chất lượng',
            key: 'evaluation',
            width: 180,
            align: 'center',
            render: (_, record) => {
                const score = Number(record.avgScore) || 0;
                if (score >= 8.0) return <Tag color="success">Xuất sắc & Giỏi</Tag>;
                if (score >= 7.0) return <Tag color="processing">Khá tốt</Tag>;
                if (score >= 5.5) return <Tag color="warning">Trung bình khá</Tag>;
                return <Tag color="error">Cần cải thiện</Tag>;
            },
        },
    ];

    // Cột bảng Tải giảng viên & Độ lệch điểm (Tab 4)
    const workloadColumns = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, idx) => idx + 1,
        },
        {
            title: 'Giảng viên hướng dẫn',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (name, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{name}</div>
                    <div className="text-xs text-slate-500">{record.email}</div>
                </div>
            ),
        },
        {
            title: 'Bộ môn / Khoa',
            dataIndex: 'department',
            key: 'department',
            width: 180,
            render: (dept) => dept || '—',
        },
        {
            title: 'SV hướng dẫn',
            dataIndex: 'assignedCount',
            key: 'assignedCount',
            width: 130,
            align: 'center',
            render: (val) => <span className="font-bold text-slate-800">{val}</span>,
        },
        {
            title: 'Hoàn thành',
            dataIndex: 'completedCount',
            key: 'completedCount',
            width: 120,
            align: 'center',
            render: (val) => <span className="text-emerald-600 font-semibold">{val}</span>,
        },
        {
            title: 'Tỷ lệ %',
            dataIndex: 'completionRate',
            key: 'completionRate',
            width: 140,
            align: 'center',
            render: (val) => (
                <Progress percent={val} size="small" strokeColor="#10B981" />
            ),
        },
        {
            title: 'Điểm BM04 TB',
            dataIndex: 'avgMentorScore',
            key: 'avgMentorScore',
            width: 130,
            align: 'center',
            render: (val) => (
                <span className="font-semibold text-slate-700">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : '—'}
                </span>
            ),
        },
        {
            title: 'Điểm HĐ TB',
            dataIndex: 'avgCouncilScore',
            key: 'avgCouncilScore',
            width: 130,
            align: 'center',
            render: (val) => (
                <span className="font-semibold text-slate-700">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : '—'}
                </span>
            ),
        },
        {
            title: 'Độ lệch điểm Δ',
            dataIndex: 'variance',
            key: 'variance',
            width: 140,
            align: 'center',
            render: (val) => {
                if (val === null || val === undefined) return '—';
                const isHigh = Number(val) > 1.5;
                return (
                    <span className={`font-bold ${isHigh ? 'text-amber-600' : 'text-slate-700'}`}>
                        {Number(val).toFixed(2)}
                    </span>
                );
            },
        },
        {
            title: 'Đánh giá độ lệch',
            key: 'varianceCheck',
            width: 170,
            align: 'center',
            render: (_, record) => {
                const variance = Number(record.variance) || 0;
                if (variance > 1.5) {
                    return (
                        <Tag color="warning" icon={<WarningOutlined />}>
                            Lệch cao (&gt; 1.5)
                        </Tag>
                    );
                }
                return <Tag color="success">Bình thường</Tag>;
            },
        },
    ];

    // Xác định mốc hao hụt lớn nhất trong phễu học vụ
    const funnelDropoffAnalysis = useMemo(() => {
        if (!funnel || funnel.length < 2) return null;
        let maxDrop = { stage: null, dropCount: 0, dropRate: 0 };

        for (let i = 1; i < funnel.length; i++) {
            const prev = funnel[i - 1];
            const curr = funnel[i];
            const drop = prev.count - curr.count;
            const dropPercent = prev.count > 0 ? Math.round((drop / prev.count) * 1000) / 10 : 0;

            if (drop > maxDrop.dropCount) {
                maxDrop = {
                    stage: curr.label,
                    dropCount: drop,
                    dropRate: dropPercent,
                };
            }
        }

        return maxDrop.dropCount > 0 ? maxDrop : null;
    }, [funnel]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Top Bar: Tiêu đề & Bộ điều khiển */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                        <BarChartOutlined className="text-teal-600" />
                        <span>Báo Cáo & Thống Kê Học Vụ</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Trung tâm phân tích kết quả học vụ, phổ điểm, phễu tiến độ và khối lượng hướng dẫn tốt nghiệp
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Chọn học kỳ */}
                    <Select
                        placeholder="Chọn học kỳ"
                        value={selectedSemesterId}
                        onChange={setSelectedSemesterId}
                        className="w-56"
                        options={semesters.map((s) => ({
                            value: s.id,
                            label: `${s.name}${s.status === 'ACTIVE' || s.status === 'ONGOING' ? ' (Hiện tại)' : ''}`,
                        }))}
                    />

                    {/* Lọc chuyên ngành */}
                    <Select
                        value={selectedMajor}
                        onChange={setSelectedMajor}
                        className="w-48"
                        options={[
                            { value: 'ALL', label: 'Tất cả chuyên ngành' },
                            ...availableMajors.map((m) => ({ value: m, label: m })),
                        ]}
                    />

                    {/* Nút Làm mới */}
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={loadReportData}
                        loading={overviewQuery.isFetching || workloadQuery.isFetching}
                        disabled={!selectedSemesterId}
                    >
                        Làm mới
                    </Button>

                    {/* Nút Xuất Báo Cáo Excel */}
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExportExcel}
                        loading={exporting}
                        className="bg-teal-600 hover:bg-teal-700"
                    >
                        Xuất Báo Cáo Excel
                    </Button>
                </div>
            </div>

            {/* 4 Thẻ KPI Tổng hợp */}
            <QueryPanel query={semestersQuery} empty={semesters.length === 0} />
            <QueryPanel query={overviewQuery}>
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" className="shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Tổng SV Tham Gia</p>
                                <div className="text-3xl font-extrabold text-slate-800 mt-1">
                                    {loading ? <Spin size="small" /> : kpis.totalStudents || 0}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Sinh viên đăng ký thực hiện đồ án
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                                <UserOutlined className="text-blue-500 text-2xl" />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" className="shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Tỷ Lệ Hoàn Thành</p>
                                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                                    {loading ? <Spin size="small" /> : `${kpis.completionRate ?? 0}%`}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {kpis.completedCount || 0} / {kpis.totalStudents || 0} sinh viên hoàn thành
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <CheckCircleOutlined className="text-emerald-500 text-2xl" />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" className="shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Điểm Trung Bình Viện</p>
                                <div className="text-3xl font-extrabold text-teal-700 mt-1">
                                    {loading ? <Spin size="small" /> : (kpis.averageScore !== undefined ? Number(kpis.averageScore).toFixed(2) : '0.00')}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Min: {kpis.minScore ?? 0} — Max: {kpis.maxScore ?? 0}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                                <BarChartOutlined className="text-teal-600 text-2xl" />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" className="shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Tỷ Lệ Xuất Sắc & Giỏi</p>
                                <div className="text-3xl font-extrabold text-amber-500 mt-1">
                                    {loading ? <Spin size="small" /> : `${excellenceStats.rate}%`}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Xuất sắc: {excellenceStats.excellentCount} | Giỏi: {excellenceStats.goodCount}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                                <TrophyOutlined className="text-amber-500 text-2xl" />
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>
            </QueryPanel>

            {/* Hệ thống 4 Tabs Chuyên Sâu */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <Tabs
                    defaultActiveKey="1"
                    items={[
                        {
                            key: '1',
                            label: 'Phổ điểm & Xếp loại',
                            children: overviewData ? (
                                <div className="space-y-6 pt-2">
                                    {/* Thanh phân bổ phổ điểm trực quan */}
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                                                Thanh Phân Bổ Tỷ Lệ Xếp Loại Tốt Nghiệp Toàn Khóa
                                            </h3>
                                            <span className="text-xs text-slate-500">
                                                Tổng: {kpis.totalStudents || 0} sinh viên
                                            </span>
                                        </div>

                                        {/* Stacked Bar */}
                                        <div className="w-full h-7 rounded-lg overflow-hidden flex bg-slate-200 border border-slate-300">
                                            {gradeDistribution.map((item) => {
                                                if (!item.percent || item.percent <= 0) return null;
                                                return (
                                                    <Tooltip
                                                        key={item.grade}
                                                        title={`${item.label}: ${item.count} SV (${item.percent}%)`}
                                                    >
                                                        <div
                                                            style={{
                                                                width: `${item.percent}%`,
                                                                backgroundColor: item.color || GRADE_BAND_COLORS[item.grade],
                                                            }}
                                                            className="h-full flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-90 cursor-pointer"
                                                        >
                                                            {item.percent >= 8 ? `${item.percent}%` : ''}
                                                        </div>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>

                                        {/* Chú giải màu sắc */}
                                        <div className="flex flex-wrap gap-4 mt-3 pt-2 border-t border-slate-200 text-xs">
                                            {gradeDistribution.map((item) => (
                                                <div key={item.grade} className="flex items-center space-x-1.5">
                                                    <span
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: item.color || GRADE_BAND_COLORS[item.grade] }}
                                                    />
                                                    <span className="font-medium text-slate-700">{item.label}:</span>
                                                    <span className="font-bold text-slate-900">{item.count} SV ({item.percent}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bảng chi tiết phân loại */}
                                    <Table
                                        rowKey="grade"
                                        dataSource={gradeDistribution}
                                        columns={gradeColumns}
                                        pagination={false}
                                        locale={{ emptyText: <EmptyState /> }}
                                        loading={loading}
                                        bordered
                                        size="middle"
                                    />
                                </div>
                            ) : null,
                        },
                        {
                            key: '2',
                            label: 'Phễu tiến độ học vụ',
                            children: overviewData ? (
                                <div className="space-y-6 pt-2">
                                    {/* Cảnh báo hao hụt nếu có */}
                                    {funnelDropoffAnalysis && (
                                        <Alert
                                            type="warning"
                                            showIcon
                                            icon={<WarningOutlined />}
                                            message="Phát hiện điểm nghẽn học vụ"
                                            description={`Giai đoạn "${funnelDropoffAnalysis.stage}" ghi nhận mức độ hao hụt cao nhất với ${funnelDropoffAnalysis.dropCount} sinh viên không đạt yêu cầu (${funnelDropoffAnalysis.dropRate}% so với mốc trước). Cần chú ý rà soát chất lượng hướng dẫn và hồ sơ tại giai đoạn này.`}
                                            className="rounded-lg"
                                        />
                                    )}

                                    {/* Hiển thị 6 giai đoạn phễu */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {funnel.map((stage, index) => {
                                            const prev = index > 0 ? funnel[index - 1] : null;
                                            const dropCount = prev ? prev.count - stage.count : 0;
                                            const dropRate = prev && prev.count > 0
                                                ? Math.round((dropCount / prev.count) * 1000) / 10
                                                : 0;

                                            return (
                                                <div
                                                    key={stage.step}
                                                    className="p-5 bg-slate-50 rounded-xl border border-slate-200 hover:border-teal-400 transition-all flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                                            <span>Mốc {index + 1}</span>
                                                            <Tag color={index === funnel.length - 1 ? 'green' : 'blue'}>
                                                                {stage.step}
                                                            </Tag>
                                                        </div>
                                                        <h4 className="font-bold text-slate-800 text-base mt-2">
                                                            {stage.label}
                                                        </h4>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <span className="text-2xl font-black text-slate-800">
                                                                {stage.count} <span className="text-xs font-normal text-slate-500">sinh viên</span>
                                                            </span>
                                                            <span className="text-base font-bold text-teal-700">
                                                                {stage.rate}%
                                                            </span>
                                                        </div>

                                                        <Progress
                                                            percent={stage.rate}
                                                            strokeColor={index === funnel.length - 1 ? '#10B981' : '#0F766E'}
                                                            size="small"
                                                            showInfo={false}
                                                        />

                                                        {index > 0 && (
                                                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                                                                <span>Hao hụt so với mốc trước:</span>
                                                                {dropCount > 0 ? (
                                                                    <span className="text-red-500 font-semibold flex items-center space-x-1">
                                                                        <FallOutlined />
                                                                        <span>-{dropCount} SV (-{dropRate}%)</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                                                                        <RiseOutlined />
                                                                        <span>Giữ nguyên (100%)</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null,
                        },
                        {
                            key: '3',
                            label: 'So sánh Chuyên ngành',
                            children: overviewData ? (
                                <div className="space-y-4 pt-2">
                                    <div className="flex justify-between items-center">
                                        <p className="text-slate-500 text-sm">
                                            Bảng thống kê đối sánh quy mô sinh viên, tỷ lệ hoàn thành đồ án và chất lượng điểm số giữa các chuyên ngành đào tạo
                                        </p>
                                    </div>

                                    <Table
                                        rowKey="major"
                                        dataSource={majorsData}
                                        columns={majorColumns}
                                        pagination={false}
                                        locale={{ emptyText: <EmptyState /> }}
                                        loading={loading}
                                        bordered
                                        size="middle"
                                    />
                                </div>
                            ) : null,
                        },
                        {
                            key: '4',
                            label: 'Tải GVHD & Độ lệch điểm',
                            children: (
                                <QueryPanel query={workloadQuery} variant="table">
                                <div className="space-y-4 pt-2">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <p className="text-slate-500 text-sm">
                                            Theo dõi khối lượng hướng dẫn, tỷ lệ sinh viên hoàn thành và độ lệch điểm đánh giá quá trình (BM04) so với điểm Hội đồng bảo vệ
                                        </p>
                                        <div className="w-72">
                                            <Input
                                                prefix={<SearchOutlined className="text-slate-400" />}
                                                placeholder="Tìm theo tên, email, bộ môn..."
                                                value={lecturerSearch}
                                                onChange={(e) => setLecturerSearch(e.target.value)}
                                                allowClear
                                            />
                                        </div>
                                    </div>

                                    <Table
                                        rowKey="lecturerId"
                                        dataSource={filteredWorkload}
                                        columns={workloadColumns}
                                        pagination={{ pageSize: 15, showTotal: (total) => `Tổng cộng ${total} giảng viên` }}
                                        locale={{ emptyText: <EmptyState /> }}
                                        loading={false}
                                        bordered
                                        size="middle"
                                    />
                                </div>
                                </QueryPanel>
                            ),
                        },
                    ]}
                />
            </div>
        </div>
    );
}
