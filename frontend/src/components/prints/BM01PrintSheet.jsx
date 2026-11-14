import React from 'react';
import A4PageContainer from './A4PageContainer';

/**
 * BM01PrintSheet
 * Đề Cương Đề Tài Báo Cáo Tốt Nghiệp (BM01)
 * Chuẩn hóa 100% theo BM01.docx của Viện Công nghệ Số - Trường ĐH Thủ Dầu Một.
 * UTF-8 (no BOM)
 */
export default function BM01PrintSheet({
    registration = {},
    outlineData = {},
    student = {},
    mentor = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const m = mentor?.fullName ? mentor : registration?.topic?.mentor || {};
    const topic = registration?.topic || {};
    const title = registration?.adjustedTitle || registration?.bm01ApprovedTitleSnapshot || outlineData?.title || topic?.title || '................................................................................................................';

    const defaultWeeks = [
        { week: 'Tuần 1-2', task: 'Khảo sát hiện trạng, thu thập yêu cầu và nghiên cứu tài liệu tổng quan.', output: 'Báo cáo tổng quan và đề cương chi tiết' },
        { week: 'Tuần 3-4', task: 'Phân tích yêu cầu nghiệp vụ, thiết kế kiến trúc hệ thống và cơ sở dữ liệu.', output: 'Tài liệu thiết kế kiến trúc & CSDL' },
        { week: 'Tuần 5-8', task: 'Hiện thực hóa các phân hệ chức năng cốt lõi và tích hợp dịch vụ phụ trợ.', output: 'Mã nguồn module chức năng' },
        { week: 'Tuần 9-11', task: 'Kiểm thử liên thông, đánh giá hiệu năng và khắc phục lỗi phát sinh.', output: 'Kịch bản & biên bản kiểm thử' },
        { week: 'Tuần 12-14', task: 'Hoàn thiện báo cáo khóa luận, chuẩn bị slide và hồ sơ nghiệm thu.', output: 'Quyển báo cáo tốt nghiệp hoàn chỉnh' },
    ];

    const weeklySchedule = (outlineData?.weeklyPlan && Array.isArray(outlineData.weeklyPlan) && outlineData.weeklyPlan.length > 0)
        ? outlineData.weeklyPlan
        : defaultWeeks;

    const objectives = outlineData?.objectives || 'Nghiên cứu và xây dựng hệ thống phần mềm giải quyết trọn vẹn bài toán thực tiễn của đề tài, đáp ứng các tiêu chuẩn kỹ thuật và chuẩn đầu ra của Chương trình đào tạo.';
    const scope = outlineData?.scope || 'Tập trung vào phạm vi nghiệp vụ cốt lõi, kiến trúc bảo mật, giao diện người dùng và cơ sở dữ liệu phục vụ đối tượng thụ hưởng của đơn vị.';
    const methodology = outlineData?.methodology || 'Phương pháp nghiên cứu kết hợp khảo sát thực tế, phân tích mô hình hóa UML, thiết kế phần mềm hiện đại và phương pháp phát triển Agile/Scrum.';
    const expectedOutcomes = outlineData?.expectedOutcomes || 'Hệ thống phần mềm hoàn chỉnh có khả năng triển khai thực tế; trọn bộ mã nguồn sạch, tài liệu đặc tả kỹ thuật và quyển báo cáo khóa luận tốt nghiệp đạt chuẩn.';

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();

    return (
        <A4PageContainer id="bm01-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-4 text-center">
                <div className="w-[45%]">
                    <p className="font-normal text-[11pt] uppercase tracking-tight">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</p>
                    <p className="font-bold text-[12pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
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
            <div className="text-center my-5">
                <h1 className="font-bold text-[14pt] uppercase tracking-normal mb-1">
                    ĐỀ CƯƠNG ĐỀ TÀI BÁO CÁO TỐT NGHIỆP
                </h1>
                <p className="text-[10.5pt] italic text-slate-700">(Mã biểu mẫu: BM01)</p>
            </div>

            {/* Section 1: Thông tin sinh viên */}
            <div className="mb-3 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">1. Thông tin sinh viên</h2>
                <div className="grid grid-cols-2 gap-x-4 pl-3">
                    <p>- Họ và tên: <strong>{s.fullName || '...................................................'}</strong></p>
                    <p>- Mã số sinh viên: <strong>{s.code || s.studentCode || '...........................'}</strong></p>
                    <p>- Lớp: <strong>{s.class || s.studentClass || 'D22CNTT01'}</strong></p>
                    <p>- Khóa: <strong>{s.academicYear || '2022 - 2026'}</strong></p>
                    <p>- Số điện thoại: <strong>{s.phone || '...................................................'}</strong></p>
                    <p>- Giảng viên hướng dẫn: <strong>{m.academicTitle ? `${m.academicTitle}. ` : ''}{m.fullName || '...........................'}</strong></p>
                </div>
            </div>

            {/* Section 2: Tên đề tài */}
            <div className="mb-3 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">2. Tên đề tài đăng ký</h2>
                <p className="pl-3 uppercase font-semibold text-[11pt] text-slate-900 border-l-2 border-slate-300 py-1">
                    {title}
                </p>
            </div>

            {/* Section 3: Mục tiêu nghiên cứu */}
            <div className="mb-3 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">3. Mục tiêu nghiên cứu</h2>
                <p className="pl-3 text-justify">{objectives}</p>
            </div>

            {/* Section 4: Nội dung, phạm vi nghiên cứu */}
            <div className="mb-3 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">4. Nội dung và phạm vi nghiên cứu</h2>
                <p className="pl-3 text-justify">{scope}</p>
            </div>

            {/* Section 5: Phương pháp nghiên cứu */}
            <div className="mb-3 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">5. Phương pháp nghiên cứu</h2>
                <p className="pl-3 text-justify">{methodology}</p>
            </div>

            {/* Section 6: Kế hoạch thực hiện theo tuần */}
            <div className="mb-3 leading-relaxed text-[11.5pt] page-break-avoid">
                <h2 className="font-bold text-[12pt] mb-1">6. Kế hoạch thực hiện</h2>
                <table className="w-full border-collapse border border-black text-[10.5pt] my-2">
                    <thead>
                        <tr className="bg-slate-100 text-center font-bold">
                            <th className="border border-black p-1.5 w-24">Thời gian</th>
                            <th className="border border-black p-1.5">Nội dung công việc</th>
                            <th className="border border-black p-1.5 w-52">Sản phẩm / Kết quả dự kiến</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeklySchedule.map((item, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-1.5 text-center font-medium">{item.week}</td>
                                <td className="border border-black p-1.5 text-justify">{item.task}</td>
                                <td className="border border-black p-1.5 text-center">{item.output}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Section 7: Kết quả dự kiến đạt được */}
            <div className="mb-5 leading-relaxed text-[11.5pt]">
                <h2 className="font-bold text-[12pt] mb-1">7. Kết quả dự kiến đạt được</h2>
                <p className="pl-3 text-justify">{expectedOutcomes}</p>
            </div>

            {/* Khối 3 chữ ký chuẩn hành chính */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11pt] mt-6 page-break-avoid">
                <div>
                    <p className="font-bold uppercase">GIẢNG VIÊN HƯỚNG DẪN</p>
                    <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                    <div className="h-20" />
                    <p className="font-semibold">{m.fullName || ''}</p>
                </div>
                <div>
                    <p className="font-bold uppercase">PHỤ TRÁCH BỘ MÔN</p>
                    <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                    <div className="h-20" />
                    <p className="font-semibold">.............................................</p>
                </div>
                <div>
                    <p className="font-bold uppercase">SINH VIÊN THỰC HIỆN</p>
                    <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                    <div className="h-20" />
                    <p className="font-semibold">{s.fullName || ''}</p>
                </div>
            </div>
        </A4PageContainer>
    );
}

