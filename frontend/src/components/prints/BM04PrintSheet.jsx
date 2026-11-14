import React from 'react';
import A4PageContainer from './A4PageContainer';

/**
 * BM04PrintSheet
 * Phiếu Nhận Xét Đồ Án Tốt Nghiệp (BM04)
 * Dành cho Giảng viên hướng dẫn hoặc Giảng viên phản biện.
 * Chuẩn hóa 100% theo BM04.docx của Viện Công nghệ Số.
 * UTF-8 (no BOM)
 */
export default function BM04PrintSheet({
    evaluation = {},
    registration = {},
    evaluatorRole = 'MENTOR', // 'MENTOR' or 'REVIEWER'
    evaluatorName = '',
    student = {},
    mentor = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const m = mentor?.fullName ? mentor : registration?.topic?.mentor || {};
    const topic = registration?.topic || {};
    const title = registration?.adjustedTitle || registration?.bm01ApprovedTitleSnapshot || topic?.title || '................................................................................................................';

    const isMentor = evaluatorRole === 'MENTOR';
    const roleSubtitle = isMentor ? 'Dành cho giảng viên hướng dẫn' : 'Dành cho giảng viên phản biện';

    const crit1 = evaluation?.formReview || 'Bố cục báo cáo phù hợp, văn phong rõ ràng mạch lạc, danh mục hình ảnh và bảng biểu được trình bày đúng quy chuẩn học thuật.';
    const crit2 = evaluation?.contentReview || 'Nội dung nghiên cứu phù hợp với mục tiêu đề ra; phương pháp nghiên cứu hợp lý và các kết quả đạt được có giá trị khoa học.';
    const crit3 = evaluation?.applicabilityReview || 'Đề tài có tính ứng dụng thực tiễn cao, có khả năng triển khai ứng dụng cho các đơn vị hoặc phục vụ đào tạo.';
    const crit4 = evaluation?.attitudeReview || 'Sinh viên có tinh thần tự giác, ý thức nghiên cứu độc lập, thái độ làm việc nghiêm túc và tinh thần trách nhiệm cao.';

    const programOutcomeMet = evaluation?.programOutcomeMet !== false;
    const defenseRecommended = evaluation?.defenseRecommended !== false;

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();

    const reviewerFullName = evaluatorName || (isMentor ? m.fullName : evaluation?.evaluator?.fullName) || '';

    return (
        <A4PageContainer id="bm04-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-6 text-center">
                <div className="w-[45%]">
                    <p className="font-bold text-[12pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
                    <p className="font-semibold text-[10.5pt] uppercase tracking-tight">CHƯƠNG TRÌNH: KTPM & HTTT</p>
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
                    PHIẾU NHẬN XÉT
                </h1>
                <p className="text-[11pt] italic font-medium">({roleSubtitle})</p>
                <p className="text-[10pt] italic text-slate-700 mt-0.5">(Mã biểu mẫu: BM04 - Đánh giá trước bảo vệ)</p>
            </div>

            {/* I. Thông tin chung */}
            <div className="mb-4 text-[11.5pt] leading-relaxed pl-1">
                <h2 className="font-bold text-[12pt] mb-2 uppercase">I. Thông tin chung</h2>
                <div className="space-y-1.5 pl-3">
                    <p>
                        1. Họ và tên sinh viên: <strong>{s.fullName || '...................................................'}</strong>
                        &nbsp;&nbsp;&nbsp;&nbsp;MSSV: <strong>{s.code || s.studentCode || '..........................'}</strong>
                        &nbsp;&nbsp;&nbsp;&nbsp;Lớp: <strong>{s.class || s.studentClass || 'D21KTPM02'}</strong>
                    </p>
                    <div className="pt-1">
                        <p>2. Tên đề tài:</p>
                        <p className="pl-4 uppercase font-bold text-[11pt] text-slate-900 border-l-2 border-slate-300 py-0.5 mt-0.5">
                            {title}
                        </p>
                    </div>
                </div>
            </div>

            {/* II. Nội dung nhận xét (4 tiêu chí CĐR) */}
            <div className="mb-4 text-[11.5pt] leading-relaxed pl-1 space-y-3">
                <h2 className="font-bold text-[12pt] mb-1 uppercase">II. Nội dung nhận xét</h2>
                
                <div className="pl-3">
                    <p className="font-semibold text-slate-900">Tiêu chí 1: Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp</p>
                    <p className="pl-3 text-justify italic text-slate-800">{crit1}</p>
                </div>

                <div className="pl-3">
                    <p className="font-semibold text-slate-900">Tiêu chí 2: Nội dung (Tổng quan tình hình NC; PP nghiên cứu; kết quả nghiên cứu…)</p>
                    <p className="pl-3 text-justify italic text-slate-800">{crit2}</p>
                </div>

                <div className="pl-3">
                    <p className="font-semibold text-slate-900">Tiêu chí 3: Tính ứng dụng và triển vọng của đề tài</p>
                    <p className="pl-3 text-justify italic text-slate-800">{crit3}</p>
                </div>

                <div className="pl-3">
                    <p className="font-semibold text-slate-900">Tiêu chí 4: Đánh giá về thái độ và ý thức làm việc của sinh viên</p>
                    <p className="pl-3 text-justify italic text-slate-800">{crit4}</p>
                </div>
            </div>

            {/* III. Kết luận */}
            <div className="mb-6 text-[11.5pt] leading-relaxed pl-1 space-y-2 page-break-avoid">
                <h2 className="font-bold text-[12pt] mb-1 uppercase">III. Kết luận</h2>
                
                <div className="pl-3 space-y-1.5">
                    <p>
                        - Đáp ứng / không đáp ứng chuẩn đầu ra CTĐT:&nbsp;&nbsp;
                        <strong>
                            {programOutcomeMet ? 'Đáp ứng chuẩn đầu ra của Chương trình đào tạo' : 'Chưa đáp ứng chuẩn đầu ra của Chương trình đào tạo'}
                        </strong>
                    </p>

                    <div className="flex items-center gap-8 pt-1">
                        <span>
                            {defenseRecommended ? '☑' : '◻'}&nbsp;&nbsp;<strong>Đồng ý cho bảo vệ</strong>
                        </span>
                        <span>
                            {!defenseRecommended ? '☑' : '◻'}&nbsp;&nbsp;<strong>Không đồng ý cho bảo vệ</strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* Khối chữ ký người nhận xét */}
            <div className="flex justify-end text-center text-[11pt] mt-10 pr-8 page-break-avoid">
                <div>
                    <p className="font-bold uppercase">NGƯỜI NHẬN XÉT</p>
                    <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                    <div className="h-24" />
                    <p className="font-semibold">{reviewerFullName || ''}</p>
                </div>
            </div>
        </A4PageContainer>
    );
}

