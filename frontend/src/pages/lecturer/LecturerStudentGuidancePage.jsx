import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Result, Tag, message } from 'antd';
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    AuditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    PrinterOutlined,
    SafetyCertificateOutlined,
    ScheduleOutlined,
    TrophyOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrationDetail } from '../../queries/registrationQueries';
import { useRegistrationMeetingLogs, useBM03Record } from '../../queries/meetingQueries';
import { useRegistrationCheckpoints } from '../../queries/checkpointQueries';
import { useBM04Record } from '../../queries/gradingQueries';
import { useRegistrationBm02aRequests } from '../../queries/bm02aQueries';
import { getAssetDownloadUrl } from '../../services/resumableUploadService';
import { getErrorStatus } from '../../utils/apiError';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import QueryErrorState from '../../components/common/QueryErrorState';
import { getStatusTagConfig } from '../../components/common/statusMap';
import GuidanceFormList from '../../components/lecturer/GuidanceFormList';
import AcademicFormPrintModal from '../../components/prints/AcademicFormPrintModal';
import BM02PrintSheet from '../../components/prints/BM02PrintSheet';
import BM02APrintSheet from '../../components/prints/BM02APrintSheet';
import BM03PrintSheet from '../../components/prints/BM03PrintSheet';
import BM04PrintSheet from '../../components/prints/BM04PrintSheet';
import BM05PrintSheet from '../../components/prints/BM05PrintSheet';

const FALLBACK_TEXT = 'Chưa cập nhật';

const MILESTONE_ORDER = [
    { key: 'BM01', label: 'BM01 · Đề cương' },
    { key: 'BM02', label: 'BM02 · Giao nhiệm vụ' },
    { key: 'BM03', label: 'BM03 · Tiến độ hướng dẫn' },
    { key: 'BM04', label: 'BM04 · Nhận xét GVHD' },
    { key: 'BM05', label: 'Bảo vệ / Kết quả' },
];

const MILESTONE_STYLES = {
    BM01: {
        stepNumber: '01',
        icon: <FileTextOutlined aria-hidden="true" />,
        gradient: 'from-teal-600 to-teal-500',
        activeBorder: 'border-teal-300',
        activeBg: 'bg-teal-50/70',
        dotColor: 'bg-teal-500',
        accentText: 'text-teal-700',
    },
    BM02: {
        stepNumber: '02',
        icon: <SafetyCertificateOutlined aria-hidden="true" />,
        gradient: 'from-blue-600 to-sky-500',
        activeBorder: 'border-blue-300',
        activeBg: 'bg-blue-50/70',
        dotColor: 'bg-blue-500',
        accentText: 'text-blue-700',
    },
    BM03: {
        stepNumber: '03',
        icon: <ScheduleOutlined aria-hidden="true" />,
        gradient: 'from-purple-600 to-violet-500',
        activeBorder: 'border-purple-300',
        activeBg: 'bg-purple-50/70',
        dotColor: 'bg-purple-500',
        accentText: 'text-purple-700',
    },
    BM04: {
        stepNumber: '04',
        icon: <AuditOutlined aria-hidden="true" />,
        gradient: 'from-amber-600 to-orange-500',
        activeBorder: 'border-amber-300',
        activeBg: 'bg-amber-50/70',
        dotColor: 'bg-amber-500',
        accentText: 'text-amber-700',
    },
    BM05: {
        stepNumber: '05',
        icon: <TrophyOutlined aria-hidden="true" />,
        gradient: 'from-emerald-600 to-teal-500',
        activeBorder: 'border-emerald-300',
        activeBg: 'bg-emerald-50/70',
        dotColor: 'bg-emerald-500',
        accentText: 'text-emerald-700',
    },
};

const PRINTABLE_BUNDLE_ORDER = ['BM02', 'BM02-A', 'BM03', 'BM04', 'BM05'];

const hasPrintableData = (formCode, registration, isBm05Published) => {
    if (!registration) return false;
    switch (formCode) {
        case 'BM01':
            return Boolean(
                registration.bm01AssetId ||
                registration.bm01PdfUrl ||
                (Array.isArray(registration.submissions) &&
                    registration.submissions.some((s) => s?.fileUrl || s?.assetId))
            );
        case 'BM02':
            return Boolean(registration.currentBM02Submission || registration.bm02Submissions?.[0]);
        case 'BM02-A':
            return Boolean(
                (Array.isArray(registration.bm02aRequests) && registration.bm02aRequests.length > 0) ||
                registration.latestBm02aRequest
            );
        case 'BM03':
            return Boolean(
                registration.bm03Record ||
                (Array.isArray(registration.bm03MeetingEntries) && registration.bm03MeetingEntries.length > 0) ||
                (Array.isArray(registration.meetingLogs) && registration.meetingLogs.length > 0)
            );
        case 'BM04':
            return Boolean(registration.bm04Evaluation && registration.bm04Evaluation.status !== 'DRAFT');
        case 'BM05':
            return Boolean(isBm05Published);
        default:
            return false;
    }
};

const formatDateValue = (value) => {
    if (!value) return FALLBACK_TEXT;
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : FALLBACK_TEXT;
};

export default function LecturerStudentGuidancePage() {
    const { registrationId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const detailQuery = useRegistrationDetail(scope, registrationId);
    const registration = detailQuery.data || null;

    // On-demand A4 print modal state — never mounted on initial render
    const [printModal, setPrintModal] = useState({
        open: false,
        mode: 'single',
        formCode: '',
        title: '',
    });

    const printDataEnabled = Boolean(printModal.open && registration?.id);
    const isBundlePrint = printModal.mode === 'all';
    const meetingLogsQuery = useRegistrationMeetingLogs(scope, registration?.id, printDataEnabled && (isBundlePrint || printModal.formCode === 'BM03'));
    const checkpointsQuery = useRegistrationCheckpoints(scope, registration?.id, printDataEnabled && (isBundlePrint || printModal.formCode === 'BM03'));
    const bm03Query = useBM03Record(scope, registration?.id, printDataEnabled && (isBundlePrint || printModal.formCode === 'BM03'));
    const bm04Query = useBM04Record(scope, registration?.id, printDataEnabled && (isBundlePrint || printModal.formCode === 'BM04'));
    const bm02aQuery = useRegistrationBm02aRequests(scope, registration?.id, printDataEnabled && (isBundlePrint || printModal.formCode === 'BM02-A'));

    const handleBack = () => {
        if (location.state?.from) {
            navigate(location.state.from, {
                state: {
                    semesterId: location.state?.semesterId ?? null,
                },
            });
            return;
        }
        navigate('/lecturer/students');
    };

    const workspace = registration?.guidanceWorkspace || null;
    const forms = useMemo(
        () => (Array.isArray(workspace?.forms) ? workspace.forms : []),
        [workspace]
    );
    const formMap = useMemo(() => new Map(forms.map((item) => [item.code, item])), [forms]);
    const nextAction = workspace?.nextAction || null;

    const isBm05Published = useMemo(() => {
        if (!registration) return false;
        const defenseResult = registration.defenseResult || {};
        return Boolean(
            defenseResult.isPublished ||
            defenseResult.publishedAt ||
            registration.resultPublishedAt ||
            registration.status === 'COMPLETED' ||
            registration.status === 'ARCHIVED'
        );
    }, [registration]);

    const summaryRecord = useMemo(() => {
        if (!registration || !isBm05Published) return null;
        const defenseResult = registration.defenseResult || {};
        const council = registration.council || registration.defenseCouncil || {};
        const councilMembers = council.members || [];
        const chairMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
        const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');

        return {
            topicTitle: registration.adjustedTitle || registration.topic?.title || registration.customTopicTitle,
            studentName: registration.student?.fullName,
            studentCode: registration.student?.code,
            mentorName: registration.mentor?.fullName || registration.topic?.mentor?.fullName,
            councilName: council.name,
            defenseDate: council.defenseDate,
            location: council.location,
            decisionCode: council.decisionCode,
            finalScore: defenseResult.finalScore ?? registration.finalScore ?? registration.roundedFinalScore,
            status: registration.status,
            memberScores: defenseResult.memberScores || registration.memberScores || [],
            comments: defenseResult.comments || registration.comments,
            secretaryName: secretaryMember?.lecturer?.fullName,
            chairmanName: chairMember?.lecturer?.fullName,
            secretarySignedAt: defenseResult.secretarySignedAt || null,
            chairmanSignedAt: defenseResult.chairmanSignedAt || null,
            isPublished: true,
        };
    }, [registration, isBm05Published]);

    const eligiblePrintCodes = useMemo(() => {
        return PRINTABLE_BUNDLE_ORDER.filter((code) => {
            const matched = formMap.get(code);
            const hasServerPrintAction = Boolean(matched?.actions?.some((a) => a.code === 'VIEW_PRINT'));
            return hasServerPrintAction && hasPrintableData(code, registration, isBm05Published);
        });
    }, [formMap, registration, isBm05Published]);

    const handleOpenBm01Pdf = async (action) => {
        const assetId = action?.params?.assetId || registration?.bm01AssetId || null;
        const directUrl = action?.params?.fileUrl || registration?.bm01PdfUrl || null;
        let targetUrl = directUrl;
        if (assetId) {
            try {
                const data = await getAssetDownloadUrl(assetId);
                targetUrl = data?.downloadUrl || data?.url || directUrl;
            } catch {
                targetUrl = directUrl;
            }
        }
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        } else {
            message.warning('Chưa có tệp PDF BM01 để hiển thị.');
        }
    };

    const handleAction = async (action, form) => {
        if (!action) return;
        const regId = action.params?.registrationId || registration?.id;
        const requestId = action.params?.requestId;
        const formCode = form?.code || action.params?.formCode || '';

        if (action.code === 'VIEW_PRINT') {
            if (formCode === 'BM01') {
                const hasBm01 = hasPrintableData('BM01', registration, isBm05Published)
                    || Boolean(action?.params?.assetId || action?.params?.fileUrl);
                if (!hasBm01) {
                    message.warning('Chưa có tệp PDF BM01 để hiển thị.');
                    return;
                }
                await handleOpenBm01Pdf(action);
                return;
            }
            if (!hasPrintableData(formCode, registration, isBm05Published)) {
                message.warning(
                    formCode === 'BM05'
                        ? 'Kết quả BM05 chưa được công bố chính thức.'
                        : `Biểu mẫu ${formCode} chưa có dữ liệu để xem hoặc in.`
                );
                return;
            }
            setPrintModal({
                open: true,
                mode: 'single',
                formCode,
                title: form?.title ? `${formCode} · ${form.title}` : `Biểu mẫu ${formCode}`,
            });
            return;
        }

        if (formCode === 'BM02') {
            if (action.code === 'REVIEW') {
                navigate(`/lecturer/dashboard?registrationId=${regId}`);
                return;
            }
            if (!hasPrintableData('BM02', registration, isBm05Published)) {
                message.warning('Chưa có dữ liệu BM02 để xem.');
                return;
            }
            setPrintModal({
                open: true,
                mode: 'single',
                formCode: 'BM02',
                title: form?.title ? `BM02 · ${form.title}` : 'Biểu mẫu BM02',
            });
            return;
        }

        if (formCode === 'BM02-A' || requestId) {
            const target = requestId
                ? `/lecturer/title-adjustments?requestId=${requestId}`
                : `/lecturer/title-adjustments?registrationId=${regId}`;
            navigate(target);
            return;
        }

        if (formCode === 'BM01') {
            navigate(`/lecturer/approvals?tab=outline&registrationId=${regId}`);
            return;
        }

        if (action.code === 'OPEN_PROGRESS' || formCode === 'BM03' || formCode === 'BM04') {
            navigate(`/lecturer/progress?registrationId=${regId}`);
            return;
        }

        if (action.code === 'REVIEW') {
            navigate(`/lecturer/approvals?tab=outline&registrationId=${regId}`);
            return;
        }

        navigate(`/lecturer/progress?registrationId=${regId}`);
    };

    const renderSheetByCode = (code) => {
        if (!registration) return null;

        switch (code) {
            case 'BM02': {
                const submission = registration.currentBM02Submission || registration.bm02Submissions?.[0] || null;
                return (
                    <BM02PrintSheet
                        submission={submission}
                        verification={submission?.verification || registration.bm02Verification || null}
                        registration={registration}
                    />
                );
            }
            case 'BM02-A': {
                const requests = bm02aQuery.data || [];
                return (
                    <BM02APrintSheet
                        request={requests[0] || registration.latestBm02aRequest || {}}
                        registration={registration}
                    />
                );
            }
            case 'BM03':
                return (
                    <BM03PrintSheet
                        meetingLogs={meetingLogsQuery.data || []}
                        checkpoints={checkpointsQuery.data || []}
                        registration={registration}
                        bm03Record={bm03Query.data || registration.bm03Record || null}
                    />
                );
            case 'BM04':
                return (
                    <BM04PrintSheet
                        evaluation={bm04Query.data || registration.bm04Evaluation || {}}
                        registration={registration}
                    />
                );
            case 'BM05':
                if (!isBm05Published) return null;
                return (
                    <BM05PrintSheet
                        summaryRecord={summaryRecord}
                        registration={registration}
                    />
                );
            default:
                return null;
        }
    };

    const renderPrintSheet = () => {
        if (!printModal.open || !registration) return null;
        if (printModal.mode === 'all') {
            return (
                <div className="space-y-8">
                    {eligiblePrintCodes.map((code, idx) => (
                        <React.Fragment key={code}>
                            {idx > 0 && <div className="print-page-break" />}
                            {renderSheetByCode(code)}
                        </React.Fragment>
                    ))}
                </div>
            );
        }
        return renderSheetByCode(printModal.formCode);
    };

    if (detailQuery.isLoading) {
        return <ContentSkeleton variant="detail" rows={6} />;
    }

    if (detailQuery.isError) {
        const status = getErrorStatus(detailQuery.error);
        if (status === 403) {
            return (
                <Result
                    status="403"
                    title="Không có quyền truy cập"
                    subTitle={detailQuery.error?.message || 'Bạn không có quyền xem quá trình hướng dẫn của sinh viên này.'}
                    extra={(
                        <Button type="primary" icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={handleBack}>
                            Quay lại danh sách
                        </Button>
                    )}
                />
            );
        }
        if (status === 404) {
            return (
                <Result
                    status="404"
                    title="Không tìm thấy hồ sơ"
                    subTitle={detailQuery.error?.message || 'Hồ sơ đăng ký đề tài không tồn tại hoặc đã bị xóa.'}
                    extra={(
                        <Button type="primary" icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={handleBack}>
                            Quay lại danh sách
                        </Button>
                    )}
                />
            );
        }
        return (
            <QueryErrorState
                error={detailQuery.error}
                onRetry={() => detailQuery.refetch()}
                onBack={handleBack}
                retrying={detailQuery.isFetching}
            />
        );
    }

    if (!registration) {
        return (
            <Result
                status="404"
                title="Không có dữ liệu hồ sơ"
                subTitle="Không tìm thấy thông tin đăng ký đề tài cho sinh viên này."
                extra={(
                    <Button type="primary" icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={handleBack}>
                        Quay lại danh sách
                    </Button>
                )}
            />
        );
    }

    const student = registration.student || {};
    const profile = student.studentProfile || {};
    const officialTopicTitle = registration.adjustedTitle || registration.topic?.title || registration.customTopicTitle || FALLBACK_TEXT;
    const mentorName = registration.topic?.mentor?.fullName || registration.mentor?.fullName || FALLBACK_TEXT;
    const semesterName = registration.semester?.name || registration.topic?.semester?.name || FALLBACK_TEXT;
    const statusTag = getStatusTagConfig(registration.status);
    const classMajor = [profile.className, profile.major].filter(Boolean).join(' · ') || FALLBACK_TEXT;

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
            {/* Header: Hồ sơ sinh viên & đề tài */}
            <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={handleBack}>
                        Quay lại danh sách
                    </Button>
                    <Tag color={statusTag.color} className="m-0 rounded-full px-3 py-0.5 text-xs font-semibold">
                        {statusTag.label}
                    </Tag>
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            {student.fullName || FALLBACK_TEXT}
                        </h1>
                        <span className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-800">
                            MSSV: {student.code || FALLBACK_TEXT}
                        </span>
                        <span className="text-sm font-medium text-slate-500">
                            {classMajor}
                        </span>
                    </div>

                    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 sm:p-3.5">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                            Tên đề tài chính thức
                        </div>
                        <p className="m-0 text-base font-bold leading-relaxed text-teal-950 sm:text-lg">
                            {officialTopicTitle}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                        <span>GVHD: <strong className="font-semibold text-slate-800">{mentorName}</strong></span>
                        <span>Đợt đồ án: <strong className="font-semibold text-slate-800">{semesterName}</strong></span>
                    </div>
                </div>
            </header>

            {/* Việc cần xử lý — luôn đứng trước danh mục trên màn hình hẹp */}
            <section
                aria-labelledby="next-action-heading"
                className={`overflow-hidden rounded-2xl border transition-all ${
                    nextAction
                        ? 'border-teal-300 bg-gradient-to-r from-teal-500/10 via-teal-50 to-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/70'
                } p-4 sm:p-5`}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span
                                className={`flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-xs ${
                                    nextAction ? 'bg-teal-600' : 'bg-slate-400'
                                }`}
                            >
                                <CheckCircleOutlined className="text-xs" aria-hidden="true" />
                            </span>
                            <h2
                                id="next-action-heading"
                                className="m-0 text-base font-bold text-slate-900"
                            >
                                Việc cần xử lý
                            </h2>
                            {nextAction && (
                                <Tag color="orange" className="m-0 rounded-full font-semibold animate-pulse">
                                    Ưu tiên
                                </Tag>
                            )}
                        </div>
                        <p className="m-0 text-sm font-medium text-slate-700">
                            {nextAction ? nextAction.label : 'Hiện không có việc cần xử lý'}
                        </p>
                    </div>
                    {nextAction && (
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined aria-hidden="true" />}
                            onClick={() => handleAction(nextAction, formMap.get(nextAction.params?.formCode))}
                            className="self-start sm:self-center shadow-xs"
                        >
                            Thực hiện ngay
                        </Button>
                    )}
                </div>
            </section>

            {/* Quá trình hướng dẫn: Milestone Steps */}
            <section
                aria-labelledby="guidance-timeline-heading"
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5"
            >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-white shadow-xs">
                            <ClockCircleOutlined className="text-xs" aria-hidden="true" />
                        </span>
                        <h2
                            id="guidance-timeline-heading"
                            className="m-0 text-base font-bold text-slate-900"
                        >
                            Quá trình hướng dẫn
                        </h2>
                    </div>
                    <Button
                        size="small"
                        icon={<ScheduleOutlined aria-hidden="true" />}
                        onClick={() => navigate(`/lecturer/progress?registrationId=${registration.id}`)}
                    >
                        Mở theo dõi tiến độ
                    </Button>
                </div>

                <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-5">
                    {MILESTONE_ORDER.map((step) => {
                        const matchedForm = formMap.get(step.key);
                        const statusText = matchedForm?.statusLabel || 'Chưa bắt đầu';
                        const isActive =
                            matchedForm &&
                            matchedForm.status !== 'NOT_STARTED' &&
                            matchedForm.status !== 'NOT_CREATED' &&
                            matchedForm.status !== 'NO_RESULT';
                        const isDone = matchedForm && ['APPROVED', 'FINALIZED', 'SIGNED', 'PUBLISHED'].includes(matchedForm.status);
                        const style = MILESTONE_STYLES[step.key] || MILESTONE_STYLES.BM01;

                        return (
                            <li
                                key={step.key}
                                className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-3.5 transition-all duration-200 hover:shadow-xs ${
                                    isDone
                                        ? 'border-emerald-200 bg-emerald-50/40'
                                        : isActive
                                        ? `${style.activeBorder} ${style.activeBg}`
                                        : 'border-slate-200 bg-slate-50/70'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                            isDone
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : isActive
                                                ? 'bg-slate-800 text-white shadow-xs'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}
                                    >
                                        {style.icon}
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-slate-400">
                                        {style.stepNumber}
                                    </span>
                                </div>
                                <div className="mt-2.5">
                                    <div className="text-xs font-bold leading-snug text-slate-800">
                                        {step.label}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                isDone
                                                    ? 'bg-emerald-500'
                                                    : isActive
                                                    ? style.dotColor
                                                    : 'bg-slate-300'
                                            }`}
                                        />
                                        <span className="text-xs font-medium text-slate-600">
                                            {statusText}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </section>

            <section aria-label="Danh sách biểu mẫu học vụ" className="space-y-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {eligiblePrintCodes.length > 0 && (
                        <Button
                            size="small"
                            icon={<PrinterOutlined aria-hidden="true" />}
                            onClick={() =>
                                setPrintModal({
                                    open: true,
                                    mode: 'all',
                                    formCode: 'DOSSIER_FULL',
                                    title: 'In toàn bộ biểu mẫu đủ điều kiện',
                                })
                            }
                        >
                            In toàn bộ
                        </Button>
                    )}
                </div>
                <GuidanceFormList forms={forms} onAction={handleAction} />
            </section>

            {/* Thông tin sinh viên */}
            <Card
                title={(
                    <span className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <UserOutlined aria-hidden="true" />
                        Thông tin sinh viên
                    </span>
                )}
                className="overflow-hidden rounded-2xl border-slate-200/90 shadow-xs"
            >
                <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                    <Descriptions.Item label="Email">{student.email || FALLBACK_TEXT}</Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">{student.phone || FALLBACK_TEXT}</Descriptions.Item>
                    <Descriptions.Item label="Lớp">{profile.className || FALLBACK_TEXT}</Descriptions.Item>
                    <Descriptions.Item label="Chuyên ngành">{profile.major || FALLBACK_TEXT}</Descriptions.Item>
                    <Descriptions.Item label="Ngày sinh">{formatDateValue(profile.dateOfBirth)}</Descriptions.Item>
                    <Descriptions.Item label="Khóa đào tạo">{profile.academicYear || FALLBACK_TEXT}</Descriptions.Item>
                    <Descriptions.Item label="Nơi sinh">{profile.placeOfBirth || FALLBACK_TEXT}</Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Modal in A4 chỉ mount khi người dùng bấm VIEW_PRINT */}
            {printModal.open && (
                <AcademicFormPrintModal
                    open={printModal.open}
                    onClose={() => setPrintModal({ open: false, mode: 'single', formCode: '', title: '' })}
                    title={printModal.title}
                    documentCode={printModal.formCode}
                >
                    {printModal.formCode === 'BM05' && !isBm05Published ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="Kết quả BM05 chưa được công bố chính thức"
                        />
                    ) : (
                        renderPrintSheet()
                    )}
                </AcademicFormPrintModal>
            )}
        </div>
    );
}
