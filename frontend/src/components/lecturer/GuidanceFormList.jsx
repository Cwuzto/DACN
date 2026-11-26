import React from 'react';
import { Button, Dropdown, Tag } from 'antd';
import {
    AuditOutlined,
    CheckCircleOutlined,
    CheckSquareOutlined,
    ClockCircleOutlined,
    EyeOutlined,
    FileTextOutlined,
    FormOutlined,
    MoreOutlined,
    PrinterOutlined,
    SafetyCertificateOutlined,
    ScheduleOutlined,
    TrophyOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStatusTagConfig } from '../common/statusMap';

const FORM_TITLE_FALLBACKS = {
    BM01: 'Đề cương nghiên cứu chi tiết',
    BM02: 'Giao nhiệm vụ khóa luận',
    'BM02-A': 'Đơn đề nghị điều chỉnh tên đề tài',
    BM03: 'Sổ theo dõi tiến độ & hướng dẫn',
    BM04: 'Phiếu nhận xét của người hướng dẫn',
    BM05: 'Biên bản tổng hợp chấm bảo vệ',
};

const FORM_THEMES = {
    BM01: {
        title: 'Đề cương nghiên cứu chi tiết',
        colorName: 'teal',
        gradient: 'from-teal-600 to-teal-500',
        bgSoft: 'bg-teal-50/70',
        borderSoft: 'border-teal-200',
        textAccent: 'text-teal-700',
        badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
        barGradient: 'linear-gradient(135deg, #0F766E, #14B8A6)',
        dotColor: '#0F766E',
        iconBg: 'bg-teal-100 text-teal-700',
        icon: <FileTextOutlined aria-hidden="true" />,
    },
    BM02: {
        title: 'Giao nhiệm vụ khóa luận',
        colorName: 'blue',
        gradient: 'from-blue-600 to-sky-500',
        bgSoft: 'bg-blue-50/70',
        borderSoft: 'border-blue-200',
        textAccent: 'text-blue-700',
        badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
        barGradient: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
        dotColor: '#1D4ED8',
        iconBg: 'bg-blue-100 text-blue-700',
        icon: <SafetyCertificateOutlined aria-hidden="true" />,
    },
    'BM02-A': {
        title: 'Đơn đề nghị điều chỉnh tên đề tài',
        colorName: 'indigo',
        gradient: 'from-indigo-600 to-violet-500',
        bgSoft: 'bg-indigo-50/70',
        borderSoft: 'border-indigo-200',
        textAccent: 'text-indigo-700',
        badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        barGradient: 'linear-gradient(135deg, #4338CA, #6366F1)',
        dotColor: '#4338CA',
        iconBg: 'bg-indigo-100 text-indigo-700',
        icon: <FormOutlined aria-hidden="true" />,
    },
    BM03: {
        title: 'Sổ theo dõi tiến độ & hướng dẫn',
        colorName: 'purple',
        gradient: 'from-purple-600 to-violet-500',
        bgSoft: 'bg-purple-50/70',
        borderSoft: 'border-purple-200',
        textAccent: 'text-purple-700',
        badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
        barGradient: 'linear-gradient(135deg, #7E22CE, #A855F7)',
        dotColor: '#7E22CE',
        iconBg: 'bg-purple-100 text-purple-700',
        icon: <ScheduleOutlined aria-hidden="true" />,
    },
    BM04: {
        title: 'Phiếu nhận xét của người hướng dẫn',
        colorName: 'amber',
        gradient: 'from-amber-600 to-orange-500',
        bgSoft: 'bg-amber-50/70',
        borderSoft: 'border-amber-200',
        textAccent: 'text-amber-700',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        barGradient: 'linear-gradient(135deg, #B45309, #F59E0B)',
        dotColor: '#B45309',
        iconBg: 'bg-amber-100 text-amber-700',
        icon: <AuditOutlined aria-hidden="true" />,
    },
    BM05: {
        title: 'Biên bản tổng hợp chấm bảo vệ',
        colorName: 'emerald',
        gradient: 'from-emerald-600 to-teal-500',
        bgSoft: 'bg-emerald-50/70',
        borderSoft: 'border-emerald-200',
        textAccent: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        barGradient: 'linear-gradient(135deg, #047857, #10B981)',
        dotColor: '#047857',
        iconBg: 'bg-emerald-100 text-emerald-700',
        icon: <TrophyOutlined aria-hidden="true" />,
    },
};

const DEFAULT_THEME = FORM_THEMES.BM01;

const FORM_STATUS_LABELS = {
    NOT_STARTED: { label: 'Chưa bắt đầu', color: 'default' },
    NOT_SUBMITTED: { label: 'Chưa nộp', color: 'default' },
    SUBMITTED: { label: 'Đã nộp', color: 'blue' },
    PENDING_REVIEW: { label: 'Chờ thẩm định', color: 'blue' },
    NEEDS_REVISION: { label: 'Cần chỉnh sửa', color: 'orange' },
    APPROVED: { label: 'Đã duyệt', color: 'green' },
    IN_PROGRESS: { label: 'Đang ghi nhận', color: 'cyan' },
    FINALIZED: { label: 'Đã chốt', color: 'green' },
    DRAFT: { label: 'Bản nháp', color: 'default' },
    PENDING_SIGNATURE: { label: 'Chờ ký', color: 'orange' },
    SIGNED: { label: 'Đã ký / khóa', color: 'green' },
    NOT_CREATED: { label: 'Chưa lập', color: 'default' },
    NO_RESULT: { label: 'Chưa có kết quả', color: 'default' },
    PROCESSING: { label: 'Đang xử lý', color: 'blue' },
    PUBLISHED: { label: 'Đã công bố', color: 'green' },
};

const COMPLETED_STATUSES = new Set(['APPROVED', 'FINALIZED', 'SIGNED', 'PUBLISHED']);
const IN_PROGRESS_STATUSES = new Set(['SUBMITTED', 'PENDING_REVIEW', 'IN_PROGRESS', 'PENDING_SIGNATURE', 'PROCESSING']);
const UNSUBMITTED_BM02A_STATUSES = new Set(['STUDENT_PREPARING', 'NOT_STARTED', 'NOT_SUBMITTED', 'NOT_CREATED']);
const READONLY_ACTION_CODES = new Set(['VIEW', 'VIEW_PRINT']);

const ACTION_CONFIG = {
    VIEW: { label: 'Xem chi tiết', icon: <EyeOutlined aria-hidden="true" />, type: 'default' },
    VIEW_PRINT: { label: 'Xem / In', icon: <PrinterOutlined aria-hidden="true" />, type: 'default' },
    REVIEW: { label: 'Xử lý / Duyệt', icon: <CheckSquareOutlined aria-hidden="true" />, type: 'primary' },
    OPEN_PROGRESS: { label: 'Theo dõi tiến độ', icon: <ScheduleOutlined aria-hidden="true" />, type: 'default' },
};

const getFormStatusBadge = (form) => {
    if (form?.statusLabel) {
        const mapped = FORM_STATUS_LABELS[form.status] || getStatusTagConfig(form.status);
        return { label: form.statusLabel, color: mapped?.color || 'default' };
    }
    if (FORM_STATUS_LABELS[form?.status]) {
        return FORM_STATUS_LABELS[form.status];
    }
    return getStatusTagConfig(form?.status);
};

const formatUpdatedAt = (value) => {
    if (!value) return null;
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : null;
};

/**
 * Danh sách biểu mẫu học vụ của sinh viên theo đúng thứ tự và quyền từ backend.
 * Thiết kế giao diện Bento Box Grid kết hợp Pipeline trực quan & Shape Stats sinh động.
 * Không tự sinh nút nghiệp vụ theo role hoặc tự chèn BM02-A khi chưa có yêu cầu.
 */
export default function GuidanceFormList({ forms = [], onAction, readOnly = false }) {
    const visibleForms = (Array.isArray(forms) ? forms : []).filter((form) => {
        if (!form) return false;
        if (form.code === 'BM02-A') {
            if (!form.status || UNSUBMITTED_BM02A_STATUSES.has(form.status)) {
                return false;
            }
        }
        return true;
    });

    if (visibleForms.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                <FileTextOutlined className="mx-auto mb-2 text-2xl text-slate-400" aria-hidden="true" />
                <div>Chưa có dữ liệu biểu mẫu cho hồ sơ này.</div>
            </div>
        );
    }

    const totalCount = visibleForms.length;
    const completedCount = visibleForms.filter((f) => COMPLETED_STATUSES.has(f?.status)).length;
    const inProgressCount = visibleForms.filter((f) => IN_PROGRESS_STATUSES.has(f?.status)).length;
    const attentionCount = visibleForms.filter((f) => f?.status === 'NEEDS_REVISION').length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Bento Overview: Shape Stats & Multi-segment Pipeline Bar */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F766E] text-white shadow-xs">
                                <CheckCircleOutlined className="text-xs" aria-hidden="true" />
                            </span>
                            <h2 className="m-0 font-display text-base font-bold text-slate-900">
                                Hồ sơ biểu mẫu học vụ
                            </h2>
                            <Tag color="cyan" className="m-0 rounded-full font-mono tabular-nums font-semibold">
                                {completionPercentage}% hoàn tất
                            </Tag>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">
                                <span className="font-mono tabular-nums">{completedCount}/{totalCount}</span> biểu mẫu hoàn tất
                            </span>
                            <span>•</span>
                            <span>
                                <span className="font-mono tabular-nums font-medium text-slate-700">{inProgressCount}</span> đang xử lý
                            </span>
                            {attentionCount > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="font-semibold text-amber-600">
                                        <span className="font-mono tabular-nums">{attentionCount}</span> cần chỉnh sửa
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mini Progress Bar with smooth rounded shape */}
                    <div className="w-full sm:w-52">
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                            <span>Tỷ lệ hoàn thành</span>
                            <span className="font-mono tabular-nums font-bold text-[#0F766E]">{completionPercentage}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${completionPercentage}%`,
                                    background: 'linear-gradient(90deg, #0F766E 0%, #14B8A6 60%, #10B981 100%)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Multi-segment Pipeline Bar */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Quy trình chuỗi biểu mẫu
                    </div>
                    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${visibleForms.length <= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
                        {visibleForms.map((form) => {
                            const theme = FORM_THEMES[form.code] || DEFAULT_THEME;
                            const isDone = COMPLETED_STATUSES.has(form.status);
                            const isInProgress = IN_PROGRESS_STATUSES.has(form.status);
                            const isRevision = form.status === 'NEEDS_REVISION';
                            const statusBadge = getFormStatusBadge(form);

                            return (
                                <div
                                    key={form.code}
                                    className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-2.5 transition-all duration-200 hover:shadow-xs ${
                                        isDone
                                            ? 'border-emerald-300 bg-emerald-50/50'
                                            : isInProgress
                                            ? `${theme.borderSoft} ${theme.bgSoft}`
                                            : isRevision
                                            ? 'border-amber-300 bg-amber-50/70'
                                            : 'border-slate-200 bg-slate-50/80'
                                    }`}
                                >
                                    <div
                                        className="absolute left-0 top-0 h-1 w-full"
                                        style={{
                                            background: isDone
                                                ? 'linear-gradient(90deg, #047857, #10B981)'
                                                : isInProgress
                                                ? theme.barGradient
                                                : isRevision
                                                ? 'linear-gradient(90deg, #B45309, #F59E0B)'
                                                : '#CBD5E1',
                                        }}
                                    />
                                    <div className="flex items-center justify-between gap-1 pt-0.5">
                                        <span className="font-mono tabular-nums text-xs font-bold text-slate-800">
                                            {form.code}
                                        </span>
                                        <span
                                            className={`h-2 w-2 rounded-full ${
                                                isDone
                                                    ? 'bg-emerald-500 shadow-xs shadow-emerald-400'
                                                    : isInProgress
                                                    ? 'bg-blue-500 animate-pulse'
                                                    : isRevision
                                                    ? 'bg-amber-500 animate-pulse'
                                                    : 'bg-slate-300'
                                            }`}
                                        />
                                    </div>
                                    <div className="mt-1 truncate text-[11px] font-medium text-slate-600">
                                        {statusBadge.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bento Form Cards Grid */}
            <ul
                className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
                aria-label="Danh sách biểu mẫu học vụ"
            >
                {visibleForms.map((form) => {
                    const theme = FORM_THEMES[form.code] || DEFAULT_THEME;
                    const statusBadge = getFormStatusBadge(form);
                    const updatedAtText = formatUpdatedAt(form.updatedAt);
                    const rawActions = Array.isArray(form.actions) ? form.actions : [];
                    const actions = readOnly
                        ? rawActions.filter((a) => READONLY_ACTION_CODES.has(a?.code))
                        : rawActions;
                    const directActions = actions.slice(0, 2);
                    const overflowActions = actions.slice(2);

                    const overflowMenuItems = overflowActions.map((action, index) => {
                        const meta = ACTION_CONFIG[action.code] || ACTION_CONFIG.VIEW;
                        return {
                            key: `${action.code}-${index}`,
                            label: action.label || meta.label,
                            icon: meta.icon,
                        };
                    });

                    const handleOverflowClick = ({ key }) => {
                        const index = Number(String(key).split('-').pop());
                        const selected = overflowActions[index];
                        if (selected && typeof onAction === 'function') {
                            onAction(selected, form);
                        }
                    };

                    return (
                        <li
                            key={form.code}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                        >
                            {/* Color Accent Bar */}
                            <div
                                className="h-1.5 w-full shrink-0"
                                style={{ background: theme.barGradient }}
                            />

                            {/* Card Content Area */}
                            <div className="flex flex-1 flex-col justify-between space-y-3 p-4 sm:p-5">
                                <div>
                                    {/* Top Row: Icon, Form Code Pill, Status Tag */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base shadow-xs ${theme.iconBg}`}
                                            >
                                                {theme.icon}
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono tabular-nums text-xs font-bold ${theme.badgeBg}`}
                                            >
                                                {form.code}
                                            </span>
                                        </div>
                                        <Tag
                                            color={statusBadge.color}
                                            className="m-0 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs"
                                        >
                                            {statusBadge.label}
                                        </Tag>
                                    </div>

                                    {/* Form Title */}
                                    <h3 className="m-0 mt-3 font-display text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                                        {form.title || FORM_TITLE_FALLBACKS[form.code] || form.code}
                                    </h3>
                                </div>

                                {/* Metadata & Next Actor Box */}
                                <div className="space-y-2 border-t border-slate-100 pt-2.5">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <ClockCircleOutlined aria-hidden="true" className="text-slate-400" />
                                        <span className={updatedAtText ? 'font-mono tabular-nums text-[11.5px]' : ''}>
                                            {updatedAtText ? `Cập nhật: ${updatedAtText}` : 'Chưa có cập nhật'}
                                        </span>
                                    </div>

                                    {!readOnly && form.nextActor && (
                                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-xs">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                                                <UserOutlined aria-hidden="true" className="text-[10px]" />
                                            </span>
                                            <div className="min-w-0 flex-1 truncate text-slate-600">
                                                <span className="text-slate-400">Bước kế tiếp: </span>
                                                <strong className="font-semibold text-slate-800">
                                                    {form.nextActorLabel || form.nextActor}
                                                </strong>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            {actions.length > 0 && (
                                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                                    {directActions.map((action, index) => {
                                        const meta = ACTION_CONFIG[action.code] || ACTION_CONFIG.VIEW;
                                        const buttonLabel = action.label || meta.label;
                                        return (
                                            <Button
                                                key={`${form.code}-${action.code}-${index}`}
                                                type={meta.type}
                                                size="small"
                                                icon={meta.icon}
                                                onClick={() => onAction?.(action, form)}
                                                className={meta.type === 'primary' ? 'shadow-xs' : ''}
                                            >
                                                {buttonLabel}
                                            </Button>
                                        );
                                    })}

                                    {overflowActions.length > 0 && (
                                        <Dropdown
                                            menu={{ items: overflowMenuItems, onClick: handleOverflowClick }}
                                            trigger={['click']}
                                        >
                                            <Button size="small" icon={<MoreOutlined aria-hidden="true" />}>
                                                Thao tác khác
                                            </Button>
                                        </Dropdown>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
