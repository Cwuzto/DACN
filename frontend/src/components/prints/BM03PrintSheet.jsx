import React from 'react';
import A4PageContainer from './A4PageContainer';

/**
 * BM03PrintSheet
 * Phiếu Theo Dõi Tiến Độ Thực Hiện Báo Cáo Tốt Nghiệp (BM03)
 * Chuẩn hóa 100% theo BM03.docx của Trường Đại học Thủ Dầu Một / Viện Công nghệ Số.
 * UTF-8 (no BOM)
 */
export default function BM03PrintSheet({
    registration = {},
    progressRecords = [],
    student = {},
    mentor = {},
    checkpoints = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const m = mentor?.fullName ? mentor : registration?.topic?.mentor || {};
    const topic = registration?.topic || {};
    const title = registration?.adjustedTitle || registration?.bm01ApprovedTitleSnapshot || topic?.title || '................................................................................................................';

    // 10 default sample or real weeks
    const defaultMeetings = [
        { week: 1, date: '24/08/2025', plan: 'Gặp mặt giáo viên hướng dẫn, xác định phạm vi và tên đề tài.', comment: 'Đạt, thống nhất tên đề tài.' },
        { week: 2, date: '31/08/2025', plan: 'Lập danh sách chức năng website và biểu mẫu khảo sát.', comment: 'Yêu cầu bổ sung phân quyền người dùng.' },
        { week: 3, date: '03/09/2025', plan: 'Phân tích thiết kế kiến trúc hệ thống và cơ sở dữ liệu.', comment: 'Mô hình dữ liệu cơ bản ổn định.' },
        { week: 4, date: '20/09/2025', plan: 'Tạo khung dự án, thiết lập kết nối CSDL và phân quyền JWT.', comment: 'Hoàn thành tốt đúng hạn.' },
        { week: 5, date: '02/10/2025', plan: 'Hiện thực hóa các API nghiệp vụ cốt lõi và kiểm thử đơn vị.', comment: 'Cần tối ưu câu truy vấn bảng điểm.' },
        { week: 6, date: '15/10/2025', plan: 'Xây dựng giao diện web cho Admin và Sinh viên.', comment: 'Giao diện thân thiện, bám sát Ant Design.' },
        { week: 7, date: '28/10/2025', plan: 'Tích hợp chức năng phân công hội đồng và sổ điểm.', comment: 'Hoàn thành cơ bản các chức năng.' },
        { week: 8, date: '10/11/2025', plan: 'Kiểm thử toàn diện, viết báo cáo tổng kết và chuẩn bị nghiệm thu.', comment: 'Đủ điều kiện hoàn tất tiến độ đồ án.' },
    ];

    const meetings = (progressRecords && progressRecords.length > 0)
        ? progressRecords.map((r, idx) => ({
            week: r.weekNumber || idx + 1,
            date: r.meetingDate ? new Date(r.meetingDate).toLocaleDateString('vi-VN') : '...../...../202...',
            plan: r.taskContent || r.plan || 'Làm việc theo kế hoạch phân công.',
            comment: r.mentorFeedback || r.comment || 'Hoàn thành đạt yêu cầu.',
        }))
        : defaultMeetings;

    const cp1Passed = checkpoints?.cp1Passed !== false;
    const cp2Passed = checkpoints?.cp2Passed !== false;

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();

    return (
        <A4PageContainer id="bm03-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-4 text-center">
                <div className="w-[48%]">
                    <p className="font-normal text-[10.5pt] uppercase tracking-tight">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</p>
                    <p className="font-bold text-[11.5pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
                    <p className="font-semibold text-[10pt] uppercase tracking-tight">BỘ MÔN: CÔNG NGHỆ THÔNG TIN</p>
                    <div className="w-24 h-[1px] bg-black mx-auto mt-1" />
                </div>
                <div className="w-[50%]">
                    <p className="font-bold text-[11pt] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold text-[11pt]">Độc lập – Tự do – Hạnh phúc</p>
                    <div className="w-32 h-[1px] bg-black mx-auto mt-1 mb-2" />
                    <p className="italic text-[10pt] text-right font-serif">
                        Bình Dương, ngày {day} tháng {month} năm {year}
                    </p>
                </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-4">
                <h1 className="font-bold text-[14pt] uppercase tracking-normal mb-1">
                    PHIẾU THEO DÕI TIẾN ĐỘ
                </h1>
                <h2 className="font-bold text-[13pt] uppercase tracking-normal mb-0.5">
                    THỰC HIỆN BÁO CÁO TỐT NGHIỆP
                </h2>
                <p className="text-[10pt] italic text-slate-700">(Mã biểu mẫu: BM03 - Sổ theo dõi tiến độ & Checkpoint)</p>
            </div>

            {/* Thông tin sinh viên & đề tài */}
            <div className="mb-3 text-[11pt] leading-relaxed pl-1 space-y-1">
                <p>
                    Họ tên sinh viên: <strong>{s.fullName || '...................................................'}</strong>
                    &nbsp;&nbsp;MSSV: <strong>{s.code || s.studentCode || '..........................'}</strong>
                    &nbsp;&nbsp;Lớp: <strong>{s.class || s.studentClass || 'D22CNTT01'}</strong>
                </p>
                <p>
                    Điện thoại: <strong>{s.phone || '0909123456'}</strong>
                    &nbsp;&nbsp;&nbsp;&nbsp;Email: <strong>{s.email || `${s.code || 'sv'}@student.tdmu.edu.vn`}</strong>
                </p>
                <div className="pt-1">
                    <p>2. Tên đề tài:</p>
                    <p className="pl-4 uppercase font-bold text-[10.5pt] text-slate-900 py-0.5">
                        {title}
                    </p>
                </div>
            </div>

            {/* Bảng theo dõi tiến độ tuần & 2 mốc Checkpoint */}
            <div className="my-2">
                <table className="w-full border-collapse border border-black text-[10pt]">
                    <thead>
                        <tr className="bg-slate-100 text-center font-bold">
                            <th className="border border-black p-1 w-16">Tuần thứ</th>
                            <th className="border border-black p-1 w-24">Ngày</th>
                            <th className="border border-black p-1">Kế hoạch thực hiện</th>
                            <th className="border border-black p-1 w-44">Nhận xét của CBHD (Ký tên)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meetings.slice(0, 4).map((mItem, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-1 text-center font-medium">{mItem.week}</td>
                                <td className="border border-black p-1 text-center">{mItem.date}</td>
                                <td className="border border-black p-1 text-justify">{mItem.plan}</td>
                                <td className="border border-black p-1 text-center text-[9.5pt]">{mItem.comment}</td>
                            </tr>
                        ))}

                        {/* Checkpoint 1 Row */}
                        <tr className="bg-emerald-50/50 font-medium">
                            <td colSpan={4} className="border border-black p-2">
                                <div className="flex justify-between items-center px-2">
                                    <span>
                                        <strong>ĐÁNH GIÁ TIẾN ĐỘ ĐỢT 1 (CHECKPOINT 1):</strong>
                                    </span>
                                    <span>
                                        Được tiếp tục: {cp1Passed ? '☑' : '◻'} &nbsp;&nbsp;&nbsp;&nbsp;
                                        Không tiếp tục: {!cp1Passed ? '☑' : '◻'}
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {meetings.slice(4).map((mItem, idx) => (
                            <tr key={idx + 4}>
                                <td className="border border-black p-1 text-center font-medium">{mItem.week}</td>
                                <td className="border border-black p-1 text-center">{mItem.date}</td>
                                <td className="border border-black p-1 text-justify">{mItem.plan}</td>
                                <td className="border border-black p-1 text-center text-[9.5pt]">{mItem.comment}</td>
                            </tr>
                        ))}

                        {/* Checkpoint 2 Row */}
                        <tr className="bg-emerald-50/50 font-medium">
                            <td colSpan={4} className="border border-black p-2">
                                <div className="flex justify-between items-center px-2">
                                    <span>
                                        <strong>ĐÁNH GIÁ TIẾN ĐỘ ĐỢT 2 (CHECKPOINT 2):</strong>
                                    </span>
                                    <span>
                                        Được tiếp tục: {cp2Passed ? '☑' : '◻'} &nbsp;&nbsp;&nbsp;&nbsp;
                                        Không tiếp tục: {!cp2Passed ? '☑' : '◻'}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Nhận xét chung & Chữ ký của GVHD */}
            <div className="mt-4 text-[11pt] leading-relaxed pl-1 page-break-avoid">
                <p className="font-semibold mb-1">Đánh giá chung của Cán bộ hướng dẫn:</p>
                <p className="italic text-justify pl-3 text-slate-800">
                    Sinh viên có tinh thần học hỏi cao, bám sát kế hoạch tiến độ định kỳ, hoàn thành tốt các sản phẩm bàn giao theo yêu cầu.
                </p>

                <div className="flex justify-end text-center mt-6 pr-6">
                    <div>
                        <p className="font-bold uppercase">CÁN BỘ HƯỚNG DẪN</p>
                        <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                        <div className="h-20" />
                        <p className="font-semibold">{m.fullName || ''}</p>
                    </div>
                </div>
            </div>
        </A4PageContainer>
    );
}

