import { useState, useMemo } from 'react';
import {
    Select,
    Input,
    Tag,
    Radio,
    Progress,
    Empty,
    Button,
    Tooltip,
} from 'antd';
import {
    SearchOutlined,
    BookOutlined,
    UserOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    ClockCircleOutlined,
    ArrowRightOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSemesters } from '../../queries/semesterQueries';
import { useTopics } from '../../queries/topicQueries';

function getProgressBadge(status) {
    switch (status) {
        case 'IN_PROGRESS_BM03':
        case 'IN_PROGRESS':
            return {
                color: 'blue',
                icon: <ClockCircleOutlined />,
                text: 'Đang làm đồ án (BM03)',
            };
        case 'STOP_REVIEW_PENDING':
        case 'AUTO_NOT_ELIGIBLE':
        case 'TERMINATED_FAILED_PROGRESS':
            return {
                color: 'error',
                icon: <ExclamationCircleOutlined />,
                text: 'Cảnh báo / Đề xuất dừng',
            };
        case 'DEFENSE_READY':
        case 'DEFENSE_ELIGIBLE':
            return {
                color: 'cyan',
                icon: <CheckCircleOutlined />,
                text: 'Đủ điều kiện bảo vệ',
            };
        case 'COMPLETED':
        case 'DEFENDED':
        case 'DEFENSE_PASSED':
            return {
                color: 'success',
                icon: <CheckCircleOutlined />,
                text: 'Đã bảo vệ & Lưu chiểu',
            };
        default:
            return {
                color: 'default',
                icon: <ClockCircleOutlined />,
                text: status || 'Đang xử lý',
            };
    }
}

function LecturerTopicList({ user, scope }) {
    const navigate = useNavigate();

    // 1. Fetch semesters for the semester filter dropdown
    const semestersQuery = useSemesters(scope);
    const semesters = semestersQuery.data || [];

    // Identify current ongoing semester as default
    const ongoingSemester = useMemo(() => {
        return (
            semesters.find((s) => s.status === 'ONGOING') ||
            semesters.find((s) => s.status === 'REGISTRATION') ||
            semesters[0] ||
            null
        );
    }, [semesters]);

    const [selectedSemesterId, setSelectedSemesterId] = useState('ALL');
    const [selectedCatalog, setSelectedCatalog] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('attention');
    const [searchQuery, setSearchQuery] = useState('');

    // Set initial ongoing semester once loaded
    useMemo(() => {
        if (ongoingSemester && selectedSemesterId === 'ALL') {
            setSelectedSemesterId(ongoingSemester.id);
        }
    }, [ongoingSemester, selectedSemesterId]);

    // 2. Fetch all topics for this lecturer
    const topicsQuery = useTopics(scope, { mentorId: user?.id }, Boolean(user?.id));
    const allTopics = topicsQuery.data || [];

    // 3. Filter & Sort Logic
    const filteredTopics = useMemo(() => {
        let result = [...allTopics];

        // Semester filter
        if (selectedSemesterId !== 'ALL') {
            result = result.filter((t) => t.semesterId === Number(selectedSemesterId));
        }

        // Project Catalog filter
        if (selectedCatalog !== 'ALL') {
            result = result.filter(
                (t) =>
                    t.projectCatalog?.code === selectedCatalog ||
                    t.projectCatalogId === Number(selectedCatalog)
            );
        }

        // Status filter
        if (statusFilter !== 'ALL') {
            result = result.filter((t) => {
                const regStatus = t.registrations?.[0]?.status;
                if (statusFilter === 'IN_PROGRESS') {
                    return regStatus === 'IN_PROGRESS_BM03' || regStatus === 'IN_PROGRESS';
                }
                if (statusFilter === 'WARNING') {
                    return (
                        regStatus === 'STOP_REVIEW_PENDING' ||
                        regStatus === 'AUTO_NOT_ELIGIBLE' ||
                        regStatus === 'TERMINATED_FAILED_PROGRESS'
                    );
                }
                if (statusFilter === 'COMPLETED') {
                    return (
                        regStatus === 'COMPLETED' ||
                        regStatus === 'DEFENDED' ||
                        regStatus === 'DEFENSE_PASSED'
                    );
                }
                return true;
            });
        }

        // Search query
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            result = result.filter((t) => {
                const titleMatch = t.title?.toLowerCase().includes(query);
                const studentNameMatch = t.registrations?.[0]?.student?.fullName
                    ?.toLowerCase()
                    .includes(query);
                const studentCodeMatch = t.registrations?.[0]?.student?.code
                    ?.toLowerCase()
                    .includes(query);
                return titleMatch || studentNameMatch || studentCodeMatch;
            });
        }

        // Sắp xếp
        result.sort((a, b) => {
            const regA = a.registrations?.[0];
            const regB = b.registrations?.[0];
            const studentNameA = regA?.student?.fullName || '';
            const studentNameB = regB?.student?.fullName || '';

            if (sortBy === 'attention') {
                // Ưu tiên đề xuất dừng / cảnh báo lên trước
                const isWarningA =
                    regA?.status === 'STOP_REVIEW_PENDING' ||
                    regA?.status === 'AUTO_NOT_ELIGIBLE';
                const isWarningB =
                    regB?.status === 'STOP_REVIEW_PENDING' ||
                    regB?.status === 'AUTO_NOT_ELIGIBLE';
                if (isWarningA && !isWarningB) return -1;
                if (!isWarningA && isWarningB) return 1;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
            if (sortBy === 'latest') {
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
            if (sortBy === 'studentNameAsc') {
                return studentNameA.localeCompare(studentNameB, 'vi');
            }
            if (sortBy === 'topicTitleAsc') {
                return (a.title || '').localeCompare(b.title || '', 'vi');
            }
            return 0;
        });

        return result;
    }, [allTopics, selectedSemesterId, selectedCatalog, statusFilter, searchQuery, sortBy]);

    // 4. Capacity Metrics for currently selected semester
    const currentPeriodCapacity = useMemo(() => {
        const periodTopics =
            selectedSemesterId === 'ALL'
                ? allTopics
                : allTopics.filter((t) => t.semesterId === Number(selectedSemesterId));

        const activeCount = periodTopics.length;
        const maxSlots = 10;
        const percent = Math.min(100, Math.round((activeCount / maxSlots) * 100));

        const warningCount = periodTopics.filter(
            (t) => t.registrations?.[0]?.status === 'STOP_REVIEW_PENDING'
        ).length;
        const completedCount = periodTopics.filter(
            (t) => t.registrations?.[0]?.status === 'COMPLETED'
        ).length;
        const onTrackCount = activeCount - warningCount - completedCount;

        return {
            activeCount,
            maxSlots,
            remainingSlots: Math.max(0, maxSlots - activeCount),
            percent,
            warningCount,
            completedCount,
            onTrackCount,
        };
    }, [allTopics, selectedSemesterId]);

    const activeSemesterName = useMemo(() => {
        if (selectedSemesterId === 'ALL') return 'Tất cả các đợt';
        const found = semesters.find((s) => s.id === Number(selectedSemesterId));
        return found ? found.name : 'Đợt đồ án';
    }, [semesters, selectedSemesterId]);

    return (
        <div className="space-y-5">
            {/* 1. Header Toolbar with Filter & Sorting Controls */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Semester Select */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Đợt đồ án:
                            </span>
                            <Select
                                value={selectedSemesterId}
                                onChange={(val) => setSelectedSemesterId(val)}
                                className="w-56"
                                size="middle"
                                options={[
                                    { value: 'ALL', label: 'Tất cả các đợt đồ án' },
                                    ...semesters.map((s) => ({
                                        value: s.id,
                                        label: `${s.name} ${s.status === 'ONGOING' ? '(Hiện tại)' : ''}`,
                                    })),
                                ]}
                            />
                        </div>

                        {/* Project Catalog Select */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Loại:
                            </span>
                            <Select
                                value={selectedCatalog}
                                onChange={(val) => setSelectedCatalog(val)}
                                className="w-36"
                                size="middle"
                                options={[
                                    { value: 'ALL', label: 'Tất cả loại' },
                                    { value: 'DATN', label: 'Đồ án tốt nghiệp' },
                                    { value: 'KLTN', label: 'Khóa luận tốt nghiệp' },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="w-full sm:w-64">
                        <Input
                            prefix={<SearchOutlined className="text-slate-400" />}
                            placeholder="Tìm tên đề tài, SV, MSSV..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            allowClear
                            size="middle"
                            className="rounded-lg text-xs"
                        />
                    </div>
                </div>

                {/* Sub-toolbar: Status Quick Chips & Sort Dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-slate-500">Lọc tiến độ:</span>
                        <Radio.Group
                            size="small"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="ALL">Tất cả ({allTopics.length})</Radio.Button>
                            <Radio.Button value="IN_PROGRESS">Đang làm</Radio.Button>
                            <Radio.Button value="WARNING">Cần chú ý</Radio.Button>
                            <Radio.Button value="COMPLETED">Đã hoàn thành</Radio.Button>
                        </Radio.Group>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-500">Sắp xếp:</span>
                        <Select
                            value={sortBy}
                            onChange={(val) => setSortBy(val)}
                            size="small"
                            className="w-48 text-xs"
                            options={[
                                { value: 'attention', label: 'Cần chú ý trước (Mặc định)' },
                                { value: 'latest', label: 'Mới nhất theo ngày nộp' },
                                { value: 'studentNameAsc', label: 'Tên sinh viên: A → Z' },
                                { value: 'topicTitleAsc', label: 'Tên đề tài: A → Z' },
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* 2. Capacity Summary Banner for Selected Period */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CalendarOutlined className="text-blue-600" />
                        <h4 className="font-bold text-slate-900 text-sm m-0">
                            Tải lượng hướng dẫn: {activeSemesterName}
                        </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                        <span>
                            Đang hướng dẫn:{' '}
                            <strong className="text-slate-900">{currentPeriodCapacity.activeCount}</strong>/
                            {currentPeriodCapacity.maxSlots} sinh viên
                        </span>
                        <span>
                            Chỉ tiêu còn trống:{' '}
                            <strong className="text-emerald-600">
                                {currentPeriodCapacity.remainingSlots} chỗ
                            </strong>
                        </span>
                        {currentPeriodCapacity.warningCount > 0 && (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                                <ExclamationCircleOutlined />
                                {currentPeriodCapacity.warningCount} SV đề xuất dừng
                            </span>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-56 flex-shrink-0">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Công suất</span>
                        <span className="font-bold text-slate-800">{currentPeriodCapacity.percent}%</span>
                    </div>
                    <Progress
                        percent={currentPeriodCapacity.percent}
                        size="small"
                        status={currentPeriodCapacity.percent >= 100 ? 'exception' : 'active'}
                        strokeColor={
                            currentPeriodCapacity.percent >= 100
                                ? '#ef4444'
                                : currentPeriodCapacity.percent >= 80
                                ? '#f59e0b'
                                : '#2563eb'
                        }
                    />
                </div>
            </div>

            {/* 3. Topics List Cards */}
            {topicsQuery.isLoading ? (
                <div className="p-8 text-center text-slate-400">Đang tải danh sách đề tài phụ trách...</div>
            ) : filteredTopics.length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có đề tài nào phù hợp với bộ lọc đã chọn."
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3.5">
                    {filteredTopics.map((topic) => {
                        const registration = topic.registrations?.[0];
                        const student = registration?.student;
                        const badge = getProgressBadge(registration?.status);

                        return (
                            <div
                                key={topic.id}
                                className="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Tag color="blue" className="font-semibold text-[11px] m-0">
                                            {topic.projectCatalog?.code || 'DATN'}
                                        </Tag>
                                        <Tag color="default" className="text-[11px] m-0">
                                            {topic.semester?.name || 'Học kỳ'}
                                        </Tag>
                                        <Tag color={badge.color} icon={badge.icon} className="text-[11px] m-0 font-medium">
                                            {badge.text}
                                        </Tag>
                                    </div>

                                    <h4 className="font-bold text-slate-900 text-sm leading-snug truncate m-0" title={topic.title}>
                                        {topic.title}
                                    </h4>

                                    {student ? (
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                                <UserOutlined className="text-slate-400" />
                                                {student.fullName}
                                            </span>
                                            <span className="font-mono text-slate-400">MSSV: {student.code}</span>
                                            {student.email && (
                                                <span className="text-slate-400 truncate">{student.email}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-amber-600 font-medium">
                                            Chưa có sinh viên đăng ký đề tài này
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                                    <Tooltip title="Xem sổ theo dõi tiến độ BM03">
                                        <Button
                                            type="default"
                                            size="middle"
                                            icon={<FileTextOutlined />}
                                            onClick={() => navigate('/lecturer/progress')}
                                            className="text-xs rounded-lg"
                                        >
                                            Tiến độ
                                        </Button>
                                    </Tooltip>

                                    <Button
                                        type="primary"
                                        size="middle"
                                        icon={<ArrowRightOutlined />}
                                        onClick={() => navigate('/lecturer/progress')}
                                        className="text-xs rounded-lg font-medium"
                                    >
                                        Chi tiết
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default LecturerTopicList;

