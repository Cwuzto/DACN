import React from 'react';
import A4PageContainer from './A4PageContainer';

function parseSubmissionContent(submission) {
    if (!submission) return {};
    if (typeof submission.content === 'string') {
        try {
            const parsed = JSON.parse(submission.content);
            return parsed?.fields || parsed || {};
        } catch {
            return { objectives: submission.content };
        }
    }
    if (submission.content && typeof submission.content === 'object') {
        return submission.content;
    }
    return {};
}

function renderVerificationStatus(event, roleLabel, versionNo) {
    if (event?.valid === true) {
        const signerName = event?.signer?.fullName || event?.signerName || '';
        const signedDate = event?.signedAt ? new Date(event.signedAt).toLocaleString('vi-VN') : '';
        const stepVersion = event?.versionNumber || versionNo;
        return (
            <div className="mt-2 text-[9.5pt] text-emerald-800 space-y-0.5">
                <p className="font-semibold">Đã xác thực nội bộ</p>
                <p className="text-[8.5pt] text-slate-700">{roleLabel}</p>
                {signerName && <p className="font-semibold text-black">{signerName}</p>}
                {signedDate && <p className="text-[8.5pt] text-slate-600">{signedDate}</p>}
                {stepVersion ? <p className="text-[8.5pt] text-slate-500">Mã phiên bản: v{stepVersion}</p> : null}
            </div>
        );
    }
    return (
        <div className="mt-2 text-[9.5pt] text-slate-500 italic space-y-0.5">
            <p>Chờ xác nhận</p>
            <p className="text-[8.5pt] not-italic text-slate-500">{roleLabel}</p>
        </div>
    );
}

/**
 * BM02PrintSheet
 * Phiếu Đăng Ký Đề Tài / Giao Nhiệm Vụ (BM02)
 * Chuẩn hóa 100% theo BM02.docx của Viện Công nghệ Số.
 * UTF-8 (no BOM)
 */
export default function BM02PrintSheet({
    registration = {},
    submission = null,
    verification = null,
    student = {},
    mentor = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const sp = s.studentProfile || {};
    const m = mentor?.fullName ? mentor : registration?.mentor || registration?.topic?.mentor || {};
    const topic = registration?.topic || {};
    const contentData = parseSubmissionContent(submission);

    const title =
        submission?.title ||
        submission?.topicTitle ||
        contentData?.title ||
        contentData?.topicTitle ||
        registration?.adjustedTitle ||
        registration?.bm01ApprovedTitleSnapshot ||
        topic?.title ||
        '................................................................................................................';

    const objectives =
        submission?.objectives ||
        submission?.researchObjectives ||
        contentData?.objectives ||
        contentData?.researchObjectives ||
        contentData?.tasks ||
        '';

    const studentClass = sp.className || s.className || s.class || s.studentClass || '....................';
    const academicYear = sp.academicYear || s.academicYear || '....................';
    const placeOfBirth = sp.placeOfBirth || s.placeOfBirth || s.birthPlace || '....................';
    const major = sp.major || s.major || topic.major || '....................';
    const versionNo = submission?.versionNo || submission?.versionNumber || verification?.versionNo || null;

    const formatDate = (d) => {
        if (!d) return '...../...../..........';
        try {
            const date = new Date(d);
            if (Number.isNaN(date.getTime())) return String(d);
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        } catch {
            return String(d);
        }
    };

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();

    const studentVerification = verification?.student || null;
    const advisorVerification = verification?.advisor || null;
    const departmentVerification = verification?.department || null;
    const isDraft = !verification || !(
        verification.allValid === true
        || (
            studentVerification?.valid === true
            && advisorVerification?.valid === true
            && departmentVerification?.valid === true
        )
    );

    return (
        <A4PageContainer id="bm02-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-6 text-center">
                <div className="w-[45%]">
                    <p className="font-bold text-[12pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
                    <p className="font-semibold text-[11pt] uppercase tracking-tight">BỘ MÔN CÔNG NGHỆ THÔNG TIN</p>
                    <div className="w-24 h-[1px] bg-black mx-auto mt-1" />
                </div>
                <div className="w-[52%]">
                    <p className="font-bold text-[11pt] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold text-[11pt]">Độc lập - Tự do - Hạnh phúc</p>
                    <div className="w-32 h-[1px] bg-black mx-auto mt-1 mb-2" />
                    <p className="italic text-[10.5pt] text-right font-serif">
                        Bình Dương, ngày {day} tháng {month} năm {year}
                    </p>
                </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-6">
                <h1 className="font-bold text-[15pt] uppercase tracking-normal mb-1">
                    PHIẾU ĐĂNG KÝ ĐỀ TÀI
                </h1>
                <p className="text-[10.5pt] italic text-slate-700">
                    (Mã biểu mẫu: BM02 - Giao nhiệm vụ đồ án tốt nghiệp{versionNo ? ` · Phiên bản v${versionNo}` : ''})
                </p>
                {isDraft && (
                    <p className="text-[9.5pt] font-semibold text-amber-700 mt-1">
                        [BẢN NHÁP - CHƯA ĐỦ XÁC NHẬN]
                    </p>
                )}
            </div>

            {/* Thông tin sinh viên & đề tài */}
            <div className="space-y-3 text-[12pt] leading-loose pl-2 my-6">
                <div className="flex justify-between">
                    <p className="w-[60%]">Họ tên sinh viên: <strong>{s.fullName || '...................................................'}</strong></p>
                    <p className="w-[40%]">MSSV: <strong>{s.code || s.studentCode || sp.studentCode || '..............................'}</strong></p>
                </div>

                <div className="flex justify-between">
                    <p className="w-[60%]">Ngày tháng năm sinh: <strong>{formatDate(s.dateOfBirth || sp.dateOfBirth)}</strong></p>
                    <p className="w-[40%]">Nơi sinh: <strong>{placeOfBirth}</strong></p>
                </div>

                <div className="flex justify-between">
                    <p className="w-[60%]">Lớp: <strong>{studentClass}</strong></p>
                    <p className="w-[40%]">Khóa: <strong>{academicYear}</strong></p>
                </div>

                <div>
                    <p>Chuyên ngành: <strong>{major}</strong></p>
                </div>

                <div className="pt-2">
                    <p>Tên đề tài đăng ký:</p>
                    <p className="pl-4 uppercase font-bold text-[11.5pt] text-slate-900 border-l-2 border-slate-400 py-1 mt-1">
                        {title}
                    </p>
                </div>

                {objectives && (
                    <div className="pt-2">
                        <p>Mục tiêu / Nhiệm vụ thực hiện:</p>
                        <p className="pl-4 text-[11pt] text-justify text-slate-800 border-l-2 border-slate-300 py-1 mt-1">
                            {objectives}
                        </p>
                    </div>
                )}

                <div className="pt-2">
                    <p>Đề nghị cán bộ hướng dẫn (nếu đã liên hệ trước): <strong>{m.academicTitle ? `${m.academicTitle}. ` : ''}{m.fullName || '...................................................'}</strong></p>
                </div>
            </div>

            {/* Khối 3 chữ ký chuẩn hành chính */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11pt] mt-16 pt-8 page-break-avoid">
                <div>
                    <p className="font-bold uppercase">GIẢNG VIÊN HƯỚNG DẪN</p>
                    <p className="text-[10pt] italic">(Họ tên và xác nhận)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderVerificationStatus(advisorVerification, 'Giảng viên hướng dẫn', versionNo)}
                    </div>
                </div>
                <div>
                    <p className="font-bold uppercase">SINH VIÊN ĐĂNG KÝ</p>
                    <p className="text-[10pt] italic">(Họ tên và xác nhận)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderVerificationStatus(studentVerification, 'Sinh viên đăng ký', versionNo)}
                    </div>
                </div>
                <div>
                    <p className="font-bold uppercase">PHỤ TRÁCH BỘ MÔN</p>
                    <p className="text-[10pt] italic">(Họ tên và phê duyệt)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderVerificationStatus(departmentVerification, 'Phụ trách bộ môn', versionNo)}
                    </div>
                </div>
            </div>
        </A4PageContainer>
    );
}
