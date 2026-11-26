import React, { useMemo } from 'react';
import { Button, Progress } from 'antd';
import {
    WarningOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    CalendarOutlined,
    FieldTimeOutlined,
    UploadOutlined,
    LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

export const ARCHIVE_REQUIRED_DOCS = [
    { key: 'REPORT_WORD', label: 'Báo cáo Word (.docx)' },
    { key: 'REPORT_PDF', label: 'Báo cáo PDF (.pdf)' },
    { key: 'DEMO_VIDEO', label: 'Video Demo (Link)' },
    { key: 'SLIDE_PPTX', label: 'Slide thuyết trình (.pptx)' },
];

const PRE_DEFENSE_STATUSES = [
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
];

const formatDateTime = (value) => {
    if (!value) return 'Sẽ cập nhật sau khi có lịch bảo vệ';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : 'Sẽ cập nhật sau khi có lịch bảo vệ';
};

export function resolveArchiveTimeWindows({ dossier, archiveSummary, archive } = {}) {
    const dWin = dossier?.timeWindows || {};
    const sWin = archiveSummary?.timeWindows || {};
    const aWin = archive?.timeWindows || {};

    const softPreparationDeadlineAt =
        dWin.softPreparationDeadlineAt
        || sWin.softPreparationDeadlineAt
        || aWin.softPreparationDeadlineAt
        || archive?.softPreparationDeadlineAt
        || null;

    const defenseSnapshotAt =
        dWin.defenseSnapshotAt
        || sWin.defenseSnapshotAt
        || aWin.defenseSnapshotAt
        || archive?.defenseSnapshotAt
        || null;

    const defenseDateYmd =
        dWin.defenseDateYmd
        || sWin.defenseDateYmd
        || aWin.defenseDateYmd
        || null;

    const windowClosesAt =
        dWin.windowClosesAt
        || sWin.windowClosesAt
        || aWin.windowClosesAt
        || archive?.windowClosesAt
        || null;

    const windowClosedAt =
        dWin.windowClosedAt
        || sWin.windowClosedAt
        || aWin.windowClosedAt
        || archive?.windowClosedAt
        || null;

    const isWindowClosed = Boolean(
        dossier?.isWindowClosed
        ?? dWin.isWindowClosed
        ?? archiveSummary?.isWindowClosed
        ?? sWin.isWindowClosed
        ?? archive?.isWindowClosed
        ?? aWin.isWindowClosed
        ?? windowClosedAt
        ?? (windowClosesAt && dayjs(windowClosesAt).isValid() && dayjs().isAfter(dayjs(windowClosesAt)))
    );

    const isSoftDeadlinePast = Boolean(
        dossier?.isSoftDeadlinePast
        ?? dWin.isSoftDeadlinePassed
        ?? dWin.isSoftDeadlinePast
        ?? archiveSummary?.isSoftDeadlinePast
        ?? sWin.isSoftDeadlinePassed
        ?? aWin.isSoftDeadlinePassed
        ?? (softPreparationDeadlineAt && dayjs(softPreparationDeadlineAt).isValid() && dayjs().isAfter(dayjs(softPreparationDeadlineAt)))
    );

    return {
        softPreparationDeadlineAt,
        defenseSnapshotAt,
        defenseDateYmd,
        windowClosesAt,
        windowClosedAt,
        isWindowClosed,
        isSoftDeadlinePast,
    };
}

export function computeArchiveDocumentStatus({ dossier, archiveSummary, archive } = {}) {
    const dossierDocs = Array.isArray(dossier?.documents) ? dossier.documents : [];
    const archiveFiles = Array.isArray(archive?.dossierFiles) ? archive.dossierFiles : [];
    const hasExplicitSources = Boolean(
        dossier?.currentFiles
        || dossierDocs.length > 0
        || archiveFiles.length > 0
        || archive?.reportWordFileUrl
        || archive?.reportPdfFileUrl
        || archive?.reportFileUrl
        || archive?.demoVideoUrl
        || archive?.slideFileUrl
    );

    const fallbackMissing =
        (Array.isArray(archiveSummary?.missingTypes) && archiveSummary.missingTypes)
        || (Array.isArray(archive?.missingTypes) && archive.missingTypes)
        || (Array.isArray(dossier?.missingTypes) && dossier.missingTypes)
        || null;

    const urlPresenceMap = {
        REPORT_WORD: Boolean(archive?.reportWordFileUrl),
        REPORT_PDF: Boolean(archive?.reportPdfFileUrl || archive?.reportFileUrl),
        DEMO_VIDEO: Boolean(archive?.demoVideoUrl),
        SLIDE_PPTX: Boolean(archive?.slideFileUrl),
    };

    const items = ARCHIVE_REQUIRED_DOCS.map((doc) => {
        const inDossierCurrent = Boolean(dossier?.currentFiles?.[doc.key]);
        const inDossierDocs = dossierDocs.some((d) => (d?.documentType || d?.docType) === doc.key);
        const inArchiveFiles = archiveFiles.some((f) => (f?.docType || f?.documentType) === doc.key);
        const inUrls = urlPresenceMap[doc.key];

        let submitted = inDossierCurrent || inDossierDocs || inArchiveFiles || inUrls;
        if (!submitted && !hasExplicitSources && fallbackMissing) {
            submitted = !fallbackMissing.includes(doc.key);
        }

        return {
            ...doc,
            submitted,
        };
    });

    const submittedDocs = items.filter((item) => item.submitted);
    const missingDocs = items.filter((item) => !item.submitted);
    const submittedCount = submittedDocs.length;
    const totalCount = ARCHIVE_REQUIRED_DOCS.length;
    const percent = Math.round((submittedCount / totalCount) * 100);

    return {
        items,
        submittedDocs,
        missingDocs,
        submittedCount,
        totalCount,
        percent,
        isComplete: missingDocs.length === 0,
    };
}

function computeCountdownState(timeWindows, registrationStatus) {
    const now = dayjs();
    const isPreDefense = PRE_DEFENSE_STATUSES.includes(registrationStatus);

    if (timeWindows.isWindowClosed) {
        return {
            label: 'Đã đóng cổng lưu chiểu',
            tone: 'danger',
            isUrgent: true,
            isClosed: true,
        };
    }

    const softParsed = timeWindows.softPreparationDeadlineAt ? dayjs(timeWindows.softPreparationDeadlineAt) : null;
    const closeParsed = timeWindows.windowClosesAt ? dayjs(timeWindows.windowClosesAt) : null;

    const target = isPreDefense && softParsed?.isValid()
        ? softParsed
        : (closeParsed?.isValid() ? closeParsed : (softParsed?.isValid() ? softParsed : null));

    if (!target) {
        return {
            label: 'Chờ lịch bảo vệ',
            tone: 'neutral',
            isUrgent: false,
            isClosed: false,
        };
    }

    const diffHours = target.diff(now, 'hour', true);
    if (diffHours <= 0) {
        if (isPreDefense && target === softParsed) {
            return {
                label: 'Đã quá hạn mềm',
                tone: 'danger',
                isUrgent: true,
                isClosed: false,
            };
        }
        return {
            label: 'Đã đóng cổng lưu chiểu',
            tone: 'danger',
            isUrgent: true,
            isClosed: true,
        };
    }

    if (diffHours < 24) {
        return {
            label: 'Còn dưới 24 giờ',
            tone: 'danger',
            isUrgent: true,
            isClosed: false,
        };
    }

    const days = Math.floor(diffHours / 24);
    const hours = Math.floor(diffHours % 24);
    const label = hours > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${days} ngày`;

    return {
        label,
        tone: days <= 3 ? 'danger' : 'warning',
        isUrgent: days <= 3,
        isClosed: false,
    };
}

export default function ArchiveDeadlineBanner({
    dossier,
    archive,
    archiveSummary,
    registrationStatus,
    variant = 'prominent',
    onAction,
    actionLabel = 'Bổ sung tài liệu ngay',
    showAction = true,
    audience = 'student',
    className = '',
}) {
    const timeWindows = useMemo(
        () => resolveArchiveTimeWindows({ dossier, archiveSummary, archive }),
        [dossier, archiveSummary, archive]
    );

    const docStatus = useMemo(
        () => computeArchiveDocumentStatus({ dossier, archiveSummary, archive }),
        [dossier, archiveSummary, archive]
    );

    const countdown = useMemo(
        () => computeCountdownState(timeWindows, registrationStatus),
        [timeWindows, registrationStatus]
    );

    const { items, missingDocs, submittedCount, totalCount, percent, isComplete } = docStatus;
    const isRejectedOrIncomplete = ['ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'].includes(registrationStatus);
    const isHighAlert = !isComplete && (countdown.isUrgent || countdown.isClosed || isRejectedOrIncomplete);
    const isCompletedRegistration = registrationStatus === 'COMPLETED';

    const statusAriaText = isComplete
        ? `Đã nộp đủ ${totalCount}/${totalCount} tài liệu lưu chiểu`
        : `Còn thiếu ${missingDocs.length}/${totalCount} tài liệu lưu chiểu`;

    const softDeadlineText = formatDateTime(timeWindows.softPreparationDeadlineAt);
    const closeDeadlineText = formatDateTime(timeWindows.windowClosesAt);

    if (variant === 'compact') {
        const compactContainerClass = isComplete
            ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 space-y-2.5'
            : isHighAlert
                ? 'rounded-2xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50/70 px-4 py-3 space-y-2.5'
                : 'rounded-2xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/70 px-4 py-3 space-y-2.5';

        const countdownPillClass = countdown.isClosed || countdown.tone === 'danger'
            ? 'bg-rose-100 text-rose-800 border-rose-200'
            : countdown.tone === 'warning'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';

        return (
            <div className={`${compactContainerClass} ${className}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shrink-0 ${
                                isComplete
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isHighAlert
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                            }`}
                        >
                            {isComplete ? <CheckCircleOutlined /> : <WarningOutlined />}
                            <span>{submittedCount}/{totalCount} tài liệu</span>
                        </span>
                        <span
                            role="status"
                            aria-atomic="true"
                            className={`text-xs font-semibold ${
                                isComplete ? 'text-emerald-800' : isHighAlert ? 'text-rose-800' : 'text-amber-900'
                            }`}
                        >
                            {statusAriaText}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 ${countdownPillClass}`}
                        >
                            {countdown.isClosed ? <LockOutlined /> : <ClockCircleOutlined />}
                            <span>{countdown.label}</span>
                        </span>
                        {showAction && onAction && !isCompletedRegistration && (
                            <Button
                                size="small"
                                type="primary"
                                danger={isHighAlert}
                                icon={<UploadOutlined />}
                                onClick={onAction}
                            >
                                {actionLabel}
                            </Button>
                        )}
                    </div>
                </div>

                {missingDocs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 shrink-0">Còn thiếu:</span>
                        {missingDocs.map((doc) => (
                            <span
                                key={doc.key}
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-rose-400 bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-rose-700 whitespace-nowrap shrink-0"
                            >
                                <ExclamationCircleOutlined />
                                <span>{doc.label}</span>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-700 pt-1 border-t border-slate-200/70">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <CalendarOutlined className="text-amber-600" />
                        <span>Hạn sơ bộ (trước BV 3 ngày):</span>
                        <strong className="text-slate-900">{softDeadlineText}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <FieldTimeOutlined className="text-rose-600" />
                        <span>Hạn chót đóng cổng (14 ngày sau BV):</span>
                        <strong className={countdown.isClosed ? 'text-rose-700' : 'text-slate-900'}>
                            {closeDeadlineText}
                        </strong>
                    </span>
                </div>
            </div>
        );
    }

    // Prominent variant: Complete 4/4
    if (isComplete) {
        return (
            <div
                className={`rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 shadow-sm space-y-4 ${className}`}
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-lg">
                            <CheckCircleOutlined />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm sm:text-base font-bold text-emerald-900">
                                Đã nộp đủ 4/4 tài liệu lưu chiểu
                            </div>
                            <div
                                role="status"
                                aria-atomic="true"
                                className="text-xs text-emerald-800 mt-0.5"
                            >
                                {isCompletedRegistration
                                    ? 'Hồ sơ lưu chiểu đã được nghiệm thu hoàn tất và cấp Giấy xác nhận.'
                                    : countdown.isClosed
                                        ? 'Cổng lưu chiểu đã đóng; hồ sơ 4/4 tài liệu đang được khóa để lưu trữ.'
                                        : 'Bạn vẫn có thể tải lên phiên bản mới hơn cho từng tài liệu trước thời điểm đóng cổng.'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                                countdown.isClosed
                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                        >
                            {countdown.isClosed ? <LockOutlined /> : <ClockCircleOutlined />}
                            <span>{countdown.label}</span>
                        </span>
                        {showAction && onAction && !isCompletedRegistration && !countdown.isClosed && (
                            <Button
                                size="middle"
                                icon={<UploadOutlined />}
                                onClick={onAction}
                                className="border-emerald-600 text-emerald-800 hover:text-emerald-900"
                            >
                                Cập nhật phiên bản mới
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {items.map((doc) => (
                        <span
                            key={doc.key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0"
                        >
                            <CheckCircleOutlined className="text-emerald-600" />
                            <span>{doc.label}</span>
                        </span>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-white/75 border border-emerald-200/80 px-3.5 py-2.5 text-xs text-slate-700">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <CalendarOutlined className="text-emerald-700" />
                        <span>Hạn sơ bộ (trước BV 3 ngày):</span>
                        <strong className="text-slate-900">{softDeadlineText}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <FieldTimeOutlined className="text-emerald-700" />
                        <span>Hạn chót đóng cổng chỉnh sửa (14 ngày sau BV):</span>
                        <strong className="text-slate-900">{closeDeadlineText}</strong>
                    </span>
                </div>
            </div>
        );
    }

    // Prominent variant: Missing documents (High-visibility alert)
    const containerTheme = isHighAlert
        ? 'bg-gradient-to-r from-rose-50 via-red-50/80 to-amber-50/50 border-l-rose-600 ring-1 ring-rose-200/80'
        : 'bg-gradient-to-r from-amber-50 via-orange-50/70 to-rose-50/60 border-l-amber-500 ring-1 ring-amber-200/80';

    const iconBoxTheme = isHighAlert
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

    const titleTheme = isHighAlert ? 'text-rose-900' : 'text-amber-950';
    const progressStroke = isHighAlert ? '#E11D48' : '#D97706';

    return (
        <div
            className={`rounded-2xl border-l-4 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow space-y-4 ${containerTheme} ${className}`}
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconBoxTheme}`}>
                        {countdown.isClosed ? <LockOutlined /> : <WarningOutlined />}
                    </div>
                    <div className="min-w-0">
                        <div className={`text-sm sm:text-base font-bold ${titleTheme}`}>
                            {audience === 'lecturer'
                                ? `Hồ sơ lưu chiểu của sinh viên chưa đủ (${submittedCount}/${totalCount} tài liệu)`
                                : `Hồ sơ lưu chiểu chưa đủ (${submittedCount}/${totalCount} tài liệu)`}
                        </div>
                        <div className="text-xs text-slate-700 mt-0.5">
                            {countdown.isClosed
                                ? 'Cổng nộp hồ sơ lưu chiểu đã đóng. Vui lòng liên hệ Giáo vụ Viện nếu cần hỗ trợ mở bổ sung.'
                                : 'Vui lòng hoàn tất đủ 4 tài liệu lưu chiểu bắt buộc đúng hạn để đủ điều kiện nghiệm thu và cấp Giấy xác nhận hoàn thành.'}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 ${
                            isHighAlert
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                    >
                        {!countdown.isClosed && (
                            <span
                                className={`h-2 w-2 rounded-full animate-pulse shrink-0 ${
                                    isHighAlert ? 'bg-rose-600' : 'bg-amber-600'
                                }`}
                            />
                        )}
                        {countdown.isClosed ? <LockOutlined /> : <ClockCircleOutlined />}
                        <span>{countdown.label}</span>
                    </span>

                    {showAction && onAction && (
                        <Button
                            type="primary"
                            danger={isHighAlert}
                            icon={<UploadOutlined />}
                            onClick={onAction}
                            disabled={countdown.isClosed}
                        >
                            {actionLabel}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress Bar & Live Status */}
            <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                        role="status"
                        aria-atomic="true"
                        className={`font-bold ${isHighAlert ? 'text-rose-800' : 'text-amber-900'}`}
                    >
                        {statusAriaText}
                    </span>
                    <span className="font-mono font-semibold text-slate-700">
                        {submittedCount}/{totalCount} ({percent}%)
                    </span>
                </div>
                <Progress
                    percent={percent}
                    showInfo={false}
                    strokeColor={progressStroke}
                    railColor="rgba(255,255,255,0.85)"
                    size="small"
                />
            </div>

            {/* 4 Document Chips */}
            <div className="flex flex-wrap gap-2">
                {items.map((doc) =>
                    doc.submitted ? (
                        <span
                            key={doc.key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0"
                        >
                            <CheckCircleOutlined className="text-emerald-600" />
                            <span>{doc.label}</span>
                        </span>
                    ) : (
                        <span
                            key={doc.key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-rose-400 bg-white/90 px-3 py-1 text-xs font-bold text-rose-700 whitespace-nowrap shrink-0 shadow-2xs"
                        >
                            <ExclamationCircleOutlined className="text-rose-600" />
                            <span>{doc.label} · Còn thiếu</span>
                        </span>
                    )
                )}
            </div>

            {/* Two Deadlines Bar */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-white/80 border border-amber-200/80 px-3.5 py-2.5 text-xs text-slate-700">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <CalendarOutlined className="text-amber-600" />
                    <span>Hạn sơ bộ (trước BV 3 ngày):</span>
                    <strong className={timeWindows.isSoftDeadlinePast ? 'text-rose-700' : 'text-slate-900'}>
                        {softDeadlineText}
                    </strong>
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <FieldTimeOutlined className="text-rose-600" />
                    <span>Hạn chót đóng cổng (14 ngày sau BV):</span>
                    <strong className={countdown.isClosed || isHighAlert ? 'text-rose-700' : 'text-slate-900'}>
                        {closeDeadlineText}
                    </strong>
                </span>
            </div>
        </div>
    );
}
