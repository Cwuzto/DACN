import React from 'react';
import A4PageContainer from './A4PageContainer';

function renderSignatureState(signedAt, signerName) {
    if (signedAt) {
        return (
            <div className="mt-2 text-[9.5pt] text-emerald-800 space-y-0.5">
                <p className="font-semibold">Đã xác thực nội bộ</p>
                {signerName && <p className="font-semibold text-black">{signerName}</p>}
                <p className="text-[8.5pt] text-slate-600">{new Date(signedAt).toLocaleString('vi-VN')}</p>
            </div>
        );
    }
    return (
        <div className="mt-2 text-[9.5pt] text-slate-500 italic">
            <p>Chờ xác nhận</p>
        </div>
    );
}

/**
 * BM02APrintSheet
 * Phiếu Đề Nghị Điều Chỉnh Tên Đề Tài (BM02-A)
 * Chuẩn hóa 100% theo BM02-A.docx của Viện Công nghệ Số.
 * UTF-8 (no BOM)
 */
export default function BM02APrintSheet({
    request = {},
    registration = {},
    student = {},
    mentor = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const sp = s.studentProfile || {};
    const m = mentor?.fullName ? mentor : registration?.mentor || registration?.topic?.mentor || {};
    const topic = registration?.topic || {};

    const oldTitle = request?.oldTitle || registration?.bm01ApprovedTitleSnapshot || topic?.title || '................................................................................................................';
    const newTitle = request?.newTitle || registration?.adjustedTitle || '................................................................................................................';
    const reason = request?.reason || '—';

    const studentClass = sp.className || s.className || s.class || s.studentClass || '....................';
    const academicYear = sp.academicYear || s.academicYear || '....................';
    const placeOfBirth = sp.placeOfBirth || s.placeOfBirth || s.birthPlace || '....................';
    const major = sp.major || s.major || topic.major || '....................';

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

    return (
        <A4PageContainer id="bm02a-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-6 text-center">
                <div className="w-[45%]">
                    <p className="font-bold text-[12pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
                    <p className="font-semibold text-[11pt] uppercase tracking-tight">CHƯƠNG TRÌNH: CÔNG NGHỆ THÔNG TIN</p>
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
                    PHIẾU ĐỀ NGHỊ ĐIỀU CHỈNH TÊN ĐỀ TÀI
                </h1>
                <p className="text-[10.5pt] italic text-slate-700">(Mã biểu mẫu: BM02-A - Cửa sổ điều chỉnh 168 giờ)</p>
            </div>

            {/* Thông tin sinh viên & đề tài */}
            <div className="space-y-3.5 text-[12pt] leading-loose pl-2 my-6">
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
                    <p>Tên đề tài đã đăng ký:</p>
                    <p className="pl-4 font-semibold text-[11.5pt] text-slate-700 border-l-2 border-slate-300 py-1 mt-1">
                        {oldTitle}
                    </p>
                </div>

                <div className="pt-2">
                    <p>Tên đề tài xin điều chỉnh:</p>
                    <p className="pl-4 uppercase font-bold text-[11.5pt] text-slate-900 border-l-2 border-emerald-500 py-1 mt-1 bg-emerald-50/40">
                        {newTitle}
                    </p>
                </div>

                <div className="pt-2">
                    <p>Lý do điều chỉnh:</p>
                    <p className="pl-4 italic text-[11pt] text-justify text-slate-800">
                        {reason}
                    </p>
                </div>
            </div>

            {/* Khối 3 chữ ký chuẩn hành chính */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11pt] mt-16 pt-8 page-break-avoid">
                <div>
                    <p className="font-bold uppercase">GIẢNG VIÊN HƯỚNG DẪN</p>
                    <p className="text-[10pt] italic">(Họ tên và xác nhận)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderSignatureState(request?.advisorSignedAt, m.fullName)}
                    </div>
                </div>
                <div>
                    <p className="font-bold uppercase">SINH VIÊN ĐĂNG KÝ</p>
                    <p className="text-[10pt] italic">(Họ tên và xác nhận)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderSignatureState(request?.studentSignedAt || request?.createdAt, s.fullName)}
                    </div>
                </div>
                <div>
                    <p className="font-bold uppercase">PHỤ TRÁCH BỘ MÔN</p>
                    <p className="text-[10pt] italic">(Họ tên và phê duyệt)</p>
                    <div className="min-h-20 flex flex-col justify-center">
                        {renderSignatureState(request?.headSignedAt || request?.approvedAt, request?.approvedBy?.fullName)}
                    </div>
                </div>
            </div>
        </A4PageContainer>
    );
}
