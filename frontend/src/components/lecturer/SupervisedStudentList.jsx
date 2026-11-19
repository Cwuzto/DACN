import React, { useMemo, useState } from 'react';
import {
    Button,
    Card,
    Empty,
    Input,
    Progress,
    Segmented,
    Space,
    Table,
    Tag,
    Tooltip,
} from 'antd';
import {
    AppstoreOutlined,
    BarsOutlined,
    BookOutlined,
    CalendarOutlined,
    CheckCircleFilled,
    ClockCircleOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    FolderOpenOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStatusTagConfig } from '../common/statusMap';

const ACADEMIC_STEPS = [
    { step: 1, label: 'BM01 Đề cương' },
    { step: 2, label: 'BM02 Giao đề tài' },
    { step: 3, label: 'BM03 Tiến độ' },
    { step: 4, label: 'BM04 Đánh giá' },
    { step: 5, label: 'BM05 Bảo vệ' },
];

const getAcademicStep = (status) => {
    switch (status) {
        case 'ASSIGNED':
        case 'BM01_SUBMITTED':
        case 'BM01_REVISION_SUBMITTED':
        case 'BM01_NEEDS_REVISION':
        case 'BM01_REJECTED':
            return 1;
        case 'BM01_APPROVED':
        case 'BM02_PENDING':
        case 'BM02_APPROVED':
            return 2;
        case 'IN_PROGRESS':
        case 'IN_PROGRESS_BM03':
        case 'STOP_REVIEW_PENDING':
        case 'TERMINATED':
            return 3;
        case 'BM04_PENDING':
        case 'BM04_SUBMITTED':
        case 'BM04_REVISION':
        case 'READY_FOR_DEFENSE':
        case 'DEFENSE_READY':
        case 'DEFENSE_ELIGIBLE':
            return 4;
        case 'DEFENSE_PASSED':
        case 'DEFENDED':
        case 'COMPLETED':
            return 5;
        default:
            return 2;
    }
};

const AVATAR_GRADIENTS = [
    'from-teal-600 to-emerald-600',
    'from-blue-600 to-cyan-600',
    'from-indigo-600 to-violet-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-pink-600',
];

const getStudentInitials = (name) => {
    if (!name) return 'SV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Danh sách sinh viên do giảng viên hiện tại hướng dẫn trong học kỳ đang xem.
 * Thiết kế theo phong cách Bento-Box Grid kết hợp Minimalism & Swiss Style,
 * bổ sung họa tiết màu, thanh tiến trình học vụ trực quan và hiệu ứng chuyển động UX.
 */
export default function SupervisedStudentList({
    students = [],
    onOpenDossier,
    onOpenMeetingModal,
    onOpenTitleAdjustment,
    bm02aByRegistrationId,
}) {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [viewMode, setViewMode] = useState('grid');

    const filteredStudents = useMemo(() => {
        let list = students;
        if (searchKeyword.trim()) {
            const kw = searchKeyword.trim().toLowerCase();
            list = list.filter((s) =>
                (s.studentName && s.studentName.toLowerCase().includes(kw)) ||
                (s.studentCode && s.studentCode.toLowerCase().includes(kw)) ||
                (s.topicTitle && s.topicTitle.toLowerCase().includes(kw))
            );
        }
        if (statusFilter !== 'ALL') {
            list = list.filter((s) => {
                const step = getAcademicStep(s.status);
                if (statusFilter === 'OUTLINE') return step === 1;
                if (statusFilter === 'PROGRESS') return step === 2 || step === 3;
                if (statusFilter === 'EVALUATION') return step === 4;
                if (statusFilter === 'COMPLETED') return step === 5;
                return true;
            });
        }
        return list;
    }, [students, searchKeyword, statusFilter]);

    // Table columns definition for Table View
    const tableColumns = useMemo(() => [
        {
            title: 'Sinh viên & MSSV',
            key: 'student',
            render: (_, student, index) => {
                const gradClass = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
                return (
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradClass} text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}>
                            {getStudentInitials(student.studentName)}
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-sm">{student.studentName}</div>
                            <div className="text-xs font-mono text-slate-500">{student.studentCode}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Tên đề tài',
            dataIndex: 'topicTitle',
            key: 'topicTitle',
            render: (title) => (
                <div className="text-xs text-slate-800 font-medium max-w-md line-clamp-2" title={title}>
                    <BookOutlined className="text-teal-600 mr-1.5" />
                    {title || 'Chưa cập nhật đề tài'}
                </div>
            ),
        },
        {
            title: 'Trạng thái học vụ',
            key: 'status',
            render: (_, student) => {
                const statusCfg = getStatusTagConfig(student.status);
                const step = getAcademicStep(student.status);
                return (
                    <div className="space-y-1">
                        <Tag color={statusCfg.color} className="m-0 font-medium text-xs">
                            {statusCfg.label}
                        </Tag>
                        <div className="text-[11px] text-slate-500">
                            Chặng {step}/5: {ACADEMIC_STEPS[step - 1]?.label}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Mốc kế tiếp',
            key: 'milestone',
            render: (_, student) => (
                <div className="text-xs text-slate-600">
                    {student.nextMilestone ? (
                        <div className="flex items-center gap-1.5">
                            <ClockCircleOutlined className="text-amber-500" />
                            <span>{student.nextMilestone}</span>
                            {student.nextMilestoneAt && (
                                <span className="text-slate-400 font-mono text-[11px]">
                                    ({dayjs(student.nextMilestoneAt).format('DD/MM')})
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-400 italic">Đúng tiến độ</span>
                    )}
                </div>
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            align: 'right',
            render: (_, student) => {
                const bm02aRequestId =
                    student.bm02aRequestId ??
                    (bm02aByRegistrationId instanceof Map
                        ? bm02aByRegistrationId.get(student.registrationId)
                        : bm02aByRegistrationId?.[student.registrationId]) ??
                    null;
                return (
                    <Space size="small">
                        <Button
                            size="small"
                            icon={<FolderOpenOutlined />}
                            onClick={() => onOpenDossier?.(student)}
                        >
                            Hồ sơ
                        </Button>
                        <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<CalendarOutlined />}
                            onClick={() => onOpenMeetingModal?.(student)}
                        >
                            Ghi nhật ký
                        </Button>
                        {bm02aRequestId && onOpenTitleAdjustment && (
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() =>
                                    onOpenTitleAdjustment({
                                        ...student,
                                        bm02aRequestId,
                                    })
                                }
                                className="border-amber-400 text-amber-700 bg-amber-50/60 hover:bg-amber-100"
                            >
                                Đổi tên BM02-A
                            </Button>
                        )}
                    </Space>
                );
            },
        },
    ], [bm02aByRegistrationId, onOpenDossier, onOpenMeetingModal, onOpenTitleAdjustment]);

    return (
        <Card
            className="rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow bg-white overflow-hidden"
            styles={{ body: { padding: '20px 22px' } }}
        >
            {/* Control Bar: Header title, count badge, search, filter tabs & view switch */}
            <div className="flex flex-col gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-gradient-to-b from-teal-500 to-emerald-600 rounded-full" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 m-0 tracking-tight">
                                    Sinh viên đang hướng dẫn
                                </h2>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80">
                                    {students.length} sinh viên
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 m-0 mt-0.5">
                                Danh sách sinh viên thực hiện đồ án tốt nghiệp thuộc sự quản lý chuyên môn của bạn
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Segmented
                            value={viewMode}
                            onChange={setViewMode}
                            options={[
                                { value: 'grid', icon: <AppstoreOutlined />, label: 'Thẻ Bento' },
                                { value: 'table', icon: <BarsOutlined />, label: 'Bảng dữ liệu' },
                            ]}
                            className="bg-slate-100 p-0.5"
                        />
                    </div>
                </div>

                {/* Filter & Search Bar */}
                {students.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <Segmented
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { value: 'ALL', label: `Tất cả (${students.length})` },
                                { value: 'OUTLINE', label: 'Đề cương' },
                                { value: 'PROGRESS', label: 'Tiến độ' },
                                { value: 'EVALUATION', label: 'Đánh giá' },
                                { value: 'COMPLETED', label: 'Hoàn thành' },
                            ]}
                            className="bg-slate-100/80 p-0.5 text-xs font-medium overflow-x-auto max-w-full"
                        />

                        <div className="w-full sm:w-64">
                            <Input
                                placeholder="Tìm sinh viên, MSSV, đề tài..."
                                prefix={<SearchOutlined className="text-slate-400 text-xs" />}
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                allowClear
                                size="middle"
                                className="rounded-xl border-slate-200 text-xs hover:border-teal-500 focus:border-teal-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Content area: Empty or List/Grid view */}
            {students.length === 0 ? (
                <div className="py-14 text-center">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={(
                            <div className="space-y-1 mt-2">
                                <div className="font-medium text-slate-700 text-sm">Chưa có sinh viên trong đợt</div>
                                <div className="text-xs text-slate-400">
                                    Chưa có sinh viên nào được phân công hoặc phê duyệt đề tài trong đợt này.
                                </div>
                            </div>
                        )}
                    />
                </div>
            ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={(
                            <div className="space-y-2 mt-1">
                                <div className="text-sm font-medium text-slate-700">
                                    Không tìm thấy sinh viên phù hợp bộ lọc
                                </div>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setSearchKeyword('');
                                        setStatusFilter('ALL');
                                    }}
                                >
                                    Xóa bộ lọc
                                </Button>
                            </div>
                        )}
                    />
                </div>
            ) : viewMode === 'table' ? (
                <div className="pt-4 overflow-x-auto">
                    <Table
                        columns={tableColumns}
                        dataSource={filteredStudents}
                        rowKey="registrationId"
                        pagination={false}
                        size="middle"
                        className="border border-slate-100 rounded-xl overflow-hidden"
                    />
                </div>
            ) : (
                /* Bento Grid Cards Layout */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-4">
                    {filteredStudents.map((student, idx) => {
                        const statusCfg = getStatusTagConfig(student.status);
                        const step = getAcademicStep(student.status);
                        const bm02aRequestId =
                            student.bm02aRequestId ??
                            (bm02aByRegistrationId instanceof Map
                                ? bm02aByRegistrationId.get(student.registrationId)
                                : bm02aByRegistrationId?.[student.registrationId]) ??
                            null;

                        const gradClass = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                        const progressPercent = Math.min(100, Math.round((step / 5) * 100));

                        return (
                            <div
                                key={student.registrationId}
                                className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-teal-400/90 p-4 sm:p-5 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden"
                            >
                                {/* Decorative ambient gradient corner */}
                                <div className="absolute -right-8 -top-8 w-28 h-28 bg-gradient-to-br from-teal-50 to-emerald-100/50 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                                <div>
                                    {/* Student Info Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Initial Avatar */}
                                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradClass} text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                                                {getStudentInitials(student.studentName)}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-teal-700 transition-colors truncate">
                                                        {student.studentName}
                                                    </span>
                                                    {student.studentCode && (
                                                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                                                            {student.studentCode}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Tag color={statusCfg.color} className="m-0 font-medium text-xs">
                                                        {statusCfg.label}
                                                    </Tag>
                                                    {bm02aRequestId && (
                                                        <Tooltip title="Sinh viên có yêu cầu điều chỉnh tên đề tài BM02-A đang chờ duyệt">
                                                            <Tag color="warning" className="m-0 text-[11px] font-medium border-amber-300 text-amber-800 bg-amber-50">
                                                                <ExclamationCircleOutlined className="mr-1 text-amber-600 animate-pulse" />
                                                                Chờ duyệt BM02-A
                                                            </Tag>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Topic Card Motif */}
                                    <div className="mt-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100 group-hover:bg-teal-50/30 group-hover:border-teal-100/80 transition-colors">
                                        <div className="flex items-start gap-2">
                                            <BookOutlined className="text-teal-600 mt-0.5 shrink-0 text-sm" />
                                            <p className="text-xs font-medium text-slate-800 m-0 leading-relaxed line-clamp-2">
                                                {student.topicTitle || 'Chưa cập nhật đề tài'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Academic Milestones Stepper Bar */}
                                    <div className="mt-3.5 pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                                            <span>Tiến độ học vụ ({step}/5)</span>
                                            <span className="font-semibold text-teal-700">{ACADEMIC_STEPS[step - 1]?.label}</span>
                                        </div>
                                        <Progress
                                            percent={progressPercent}
                                            showInfo={false}
                                            strokeColor={{
                                                '0%': '#0D9488',
                                                '100%': '#10B981',
                                            }}
                                            size={['100%', 6]}
                                            className="m-0"
                                        />
                                        <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] text-center text-slate-400">
                                            {ACADEMIC_STEPS.map((s) => (
                                                <div
                                                    key={s.step}
                                                    className={`truncate ${
                                                        s.step < step
                                                            ? 'text-teal-700 font-semibold'
                                                            : s.step === step
                                                            ? 'text-emerald-700 font-bold'
                                                            : 'text-slate-400'
                                                    }`}
                                                >
                                                    {s.step <= step && (
                                                        <CheckCircleFilled className="inline mr-0.5 text-[9px] text-emerald-500" />
                                                    )}
                                                    {s.label.split(' ')[0]}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Next Milestone Notice */}
                                    {student.nextMilestone && (
                                        <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                                                <ClockCircleOutlined className="text-amber-600" />
                                                <span>Mốc kế tiếp: {student.nextMilestone}</span>
                                            </div>
                                            {student.nextMilestoneAt && (
                                                <span className="font-mono text-amber-800 font-semibold">
                                                    Hạn: {dayjs(student.nextMilestoneAt).format('DD/MM/YYYY')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons Footer (Rule 2.6 compliant) */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                        size="small"
                                        icon={<FolderOpenOutlined />}
                                        onClick={() => onOpenDossier?.(student)}
                                        className="text-xs border-slate-300 text-slate-700 hover:text-teal-700 hover:border-teal-500"
                                    >
                                        Hồ sơ
                                    </Button>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<CalendarOutlined />}
                                        onClick={() => onOpenMeetingModal?.(student)}
                                        className="text-xs bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-xs"
                                    >
                                        Ghi nhật ký
                                    </Button>
                                    {bm02aRequestId && onOpenTitleAdjustment && (
                                        <Button
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() =>
                                                onOpenTitleAdjustment({
                                                    ...student,
                                                    bm02aRequestId,
                                                })
                                            }
                                            className="text-xs border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold"
                                        >
                                            Đổi tên BM02-A
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
