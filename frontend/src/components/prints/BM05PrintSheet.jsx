import React from 'react';
import { WarningOutlined } from '@ant-design/icons';
import A4PageContainer from './A4PageContainer';

const ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch Hội đồng',
    SECRETARY: 'Thư ký Hội đồng',
    REVIEWER: 'Ủy viên Phản biện',
    MEMBER: 'Ủy viên Hội đồng',
};

const GRADE_CLASSIFICATION = [
    { min: 9.0, label: 'Xuất sắc' },
    { min: 8.0, label: 'Giỏi' },
    { min: 7.0, label: 'Khá' },
    { min: 5.0, label: 'Trung bình' },
    { min: 0.0, label: 'Không đạt' },
];

/**
 * BM05PrintSheet
 * Biên Bản Tổng Hợp Điểm & Nhận Xét Của Hội Đồng Bảo Vệ (BM05)
 * Khổ A4 chuẩn hóa in ấn hành chính của Viện Công nghệ Số.
 * UTF-8 (no BOM)
 */
export default function BM05PrintSheet({ registration = {}, summaryRecord = null }) {
    const sr = summaryRecord || {};
    const student = registration.student || {};
    const topic = registration.topic || {};
    const mentor = registration.mentor || topic.mentor || {};
    const council = registration.council || registration.defenseCouncil || {};
    const defenseResult = registration.defenseResult || {};
    const memberScores = sr.memberScores || defenseResult.memberScores || [];
    const councilMembers = council.members || [];

    const isAbsent = Boolean(sr.isAbsent ?? registration.isAbsent);

    const chairMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
    const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');

    const chairName = sr.chairmanName || chairMember?.lecturer?.fullName || '';
    const secretaryName = sr.secretaryName || secretaryMember?.lecturer?.fullName || '';

    const scoresList = memberScores
        .filter((row) => row.finalScore !== null && row.finalScore !== undefined)
        .map((row) => Number(row.finalScore));

    const resolvedFinal = sr.finalScore ?? defenseResult.finalScore ?? null;

    const rawAverage = scoresList.length > 0
        ? (scoresList.reduce((acc, v) => acc + v, 0) / scoresList.length).toFixed(2)
        : (resolvedFinal !== null && resolvedFinal !== undefined
            ? Number(resolvedFinal).toFixed(2)
            : '—');

    const numericFinal = resolvedFinal !== null && resolvedFinal !== undefined
        ? Number(resolvedFinal)
        : (scoresList.length > 0
            ? Math.round((scoresList.reduce((acc, v) => acc + v, 0) / scoresList.length) * 10) / 10
            : null);

    const roundedFinal = numericFinal !== null ? numericFinal.toFixed(1) : '—';
    const isPassed = !isAbsent && numericFinal !== null && numericFinal >= 5.0;

    const grade = numericFinal !== null
        ? (GRADE_CLASSIFICATION.find((g) => numericFinal >= g.min) || { label: 'Chưa xếp loại' })
        : { label: 'Chưa xếp loại' };

    const defenseDateRaw = sr.defenseDate || council.defenseDate;
    const defenseDateFormatted = defenseDateRaw
        ? new Date(defenseDateRaw).toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'Chưa ấn định';

    const councilName = sr.councilName || council.name || 'Chưa phân công';
    const location = sr.location || council.location || '—';
    const decisionCode = sr.decisionCode || council.decisionCode || '—';
    const studentName = sr.studentName || student.fullName || '—';
    const studentCode = sr.studentCode || student.code || '—';
    const studentClass = student.studentProfile?.className || student.className || student.class || '—';
    const studentMajor = student.studentProfile?.major || student.department || topic.major || '—';
    const topicTitle = sr.topicTitle || registration.adjustedTitle || topic.title || '—';
    const mentorName = sr.mentorName || mentor.fullName || '—';
    const commentsText = sr.comments || registration.comments || defenseResult.comments || 'Chưa có nhận xét tổng hợp.';

    const secretarySigned = Boolean(sr.secretarySignedAt);
    const chairmanSigned = Boolean(sr.chairmanSignedAt);

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();

    return (
        <A4PageContainer id="bm05-print-sheet">
            {/* Header Quốc hiệu & Đơn vị */}
            <div className="flex justify-between items-start mb-4 text-center">
                <div className="w-[45%]">
                    <p className="font-normal text-[10.5pt] uppercase tracking-tight">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</p>
                    <p className="font-bold text-[11.5pt] uppercase tracking-tight">VIỆN CÔNG NGHỆ SỐ</p>
                    <div className="w-24 h-[1px] bg-black mx-auto mt-1" />
                </div>
                <div className="w-[52%]">
                    <p className="font-bold text-[11pt] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold text-[11pt]">Độc lập - Tự do - Hạnh phúc</p>
                    <div className="w-32 h-[1px] bg-black mx-auto mt-1 mb-2" />
                    <p className="italic text-[10pt] text-right font-serif">
                        Bình Dương, ngày {day} tháng {month} năm {year}
                    </p>
                </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-4">
                <h1 className="font-bold text-[13.5pt] uppercase tracking-normal mb-1">
                    BIÊN BẢN TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ ĐỒ ÁN / KHÓA LUẬN TỐT NGHIỆP
                </h1>
                <p className="text-[10pt] italic text-slate-700">(Mẫu BM05 - Tổng hợp điểm &amp; kết luận hội đồng)</p>
            </div>

            {/* Section I: Thông tin hội đồng */}
            <div className="mb-3 text-[11pt] leading-relaxed pl-1">
                <p className="font-bold text-[11.5pt] uppercase border-b border-slate-300 pb-0.5 mb-1.5">
                    I. THÔNG TIN HỘI ĐỒNG &amp; BUỔI BẢO VỆ
                </p>
                <div className="grid grid-cols-2 gap-x-4 pl-2 text-[10.5pt]">
                    <p>• <strong>Hội đồng:</strong> {councilName}</p>
                    <p>• <strong>Ngày bảo vệ:</strong> {defenseDateFormatted}</p>
                    <p>• <strong>Địa điểm:</strong> {location}</p>
                    <p>• <strong>Quyết định thành lập:</strong> {decisionCode}</p>
                </div>
            </div>

            {/* Section II: Thông tin sinh viên & đề tài */}
            <div className="mb-3 text-[11pt] leading-relaxed pl-1">
                <p className="font-bold text-[11.5pt] uppercase border-b border-slate-300 pb-0.5 mb-1.5">
                    II. THÔNG TIN SINH VIÊN &amp; ĐỀ TÀI
                </p>
                <div className="grid grid-cols-2 gap-x-4 pl-2 text-[10.5pt]">
                    <p>• <strong>Họ và tên SV:</strong> <span className="uppercase font-semibold">{studentName}</span></p>
                    <p>• <strong>Mã số SV:</strong> <span className="font-semibold">{studentCode}</span></p>
                    <p>• <strong>Lớp / Khóa:</strong> {studentClass}</p>
                    <p>• <strong>Chuyên ngành:</strong> {studentMajor}</p>
                    <div className="col-span-2 pt-0.5">
                        <p>• <strong>Tên đề tài:</strong> <span className="font-semibold uppercase">{topicTitle}</span></p>
                    </div>
                    <div className="col-span-2">
                        <p>• <strong>Giảng viên hướng dẫn:</strong> {mentorName}</p>
                    </div>
                </div>
            </div>

            {/* Section III: Bảng điểm thành viên */}
            <div className="mb-3 text-[11pt] leading-relaxed pl-1 page-break-avoid">
                <p className="font-bold text-[11.5pt] uppercase border-b border-slate-300 pb-0.5 mb-1.5">
                    III. KẾT QUẢ ĐÁNH GIÁ CỦA CÁC THÀNH VIÊN HỘI ĐỒNG
                </p>

                {isAbsent ? (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-800 my-2">
                        <div className="font-bold flex items-center gap-1 mb-1">
                            <WarningOutlined />
                            <span>SINH VIÊN VẮNG MẶT TẠI BUỔI BẢO VỆ</span>
                        </div>
                        <div>Hội đồng đã lập biên bản xác nhận sinh viên vắng mặt theo quy chế học vụ.</div>
                    </div>
                ) : (
                    <table className="w-full border-collapse border border-black text-[10pt] my-2">
                        <thead>
                            <tr className="bg-slate-100 text-center font-bold">
                                <th className="border border-black p-1 w-10">STT</th>
                                <th className="border border-black p-1 text-left">Thành viên Hội đồng</th>
                                <th className="border border-black p-1 w-36">Vai trò trong HĐ</th>
                                <th className="border border-black p-1 w-28">Điểm số (Hệ 10)</th>
                                <th className="border border-black p-1 w-24">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberScores.length > 0 ? (
                                memberScores.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                                        <td className="border border-black p-1 font-medium pl-2">{row.evaluator?.fullName || `Giám khảo ${idx + 1}`}</td>
                                        <td className="border border-black p-1 text-center">{ROLE_LABELS[row.roleInCouncilSnapshot] || row.roleInCouncilSnapshot || 'Thành viên'}</td>
                                        <td className="border border-black p-1 text-center font-bold">{row.finalScore !== null && row.finalScore !== undefined ? Number(row.finalScore).toFixed(2) : '—'}</td>
                                        <td className="border border-black p-1 text-center text-[9pt]">{row.scoreLocked ? 'Đã khóa' : 'Đang chấm'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="border border-black p-2 text-center italic text-slate-500">Chưa ghi nhận phiếu chấm thành viên</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Tổng hợp điểm */}
                <div className="bg-slate-50 border border-slate-300 p-2.5 text-[10pt] space-y-1 my-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                        <span>Điểm trung bình cộng (Chưa làm tròn):</span>
                        <span className="font-bold">{isAbsent ? '—' : `${rawAverage} / 10`}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                        <span className="font-bold text-teal-900">ĐIỂM KHÓA LUẬN CHÍNH THỨC (Làm tròn 1 chữ số lẻ):</span>
                        <span className="font-extrabold text-[12pt] text-teal-800">{isAbsent ? 'VẮNG MẶT' : `${roundedFinal} / 10`}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                        <span>Xếp loại học lực:</span>
                        <span className="font-bold">{isAbsent ? 'Không đạt (Vắng mặt)' : grade.label}</span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                        <span className="font-bold uppercase">KẾT LUẬN CỦA HỘI ĐỒNG:</span>
                        <span className="font-bold text-teal-900">
                            {isAbsent ? 'KHÔNG ĐẠT (VẮNG MẶT)' : isPassed ? 'ĐẠT (Đủ điều kiện nộp lưu chiểu)' : numericFinal !== null ? 'KHÔNG ĐẠT' : 'CHỜ CHỐT SỔ ĐIỂM'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Section IV: Ý kiến nhận xét */}
            <div className="mb-4 text-[10.5pt] leading-relaxed pl-1 page-break-avoid">
                <p className="font-bold text-[11.5pt] uppercase border-b border-slate-300 pb-0.5 mb-1">
                    IV. Ý KIẾN NHẬN XÉT &amp; NỘI DUNG CẦN CHỈNH SỬA
                </p>
                <p className="italic text-slate-700 pl-2">
                    {commentsText}
                </p>
            </div>

            {/* Section V: Khối chữ ký Thư ký & Chủ tịch */}
            <div className="grid grid-cols-2 gap-4 text-center text-[11pt] mt-8 pt-2 page-break-avoid">
                <div>
                    <p className="font-bold uppercase text-slate-800">THƯ KÝ HỘI ĐỒNG</p>
                    <p className="italic text-[10pt] text-slate-500">(Ký và ghi rõ họ tên)</p>
                    <div className="min-h-16 flex flex-col justify-center mt-2">
                        {secretaryName && <p className="font-bold text-slate-900">{secretaryName}</p>}
                        {secretarySigned ? (
                            <p className="text-[9pt] text-emerald-700 mt-0.5">Đã xác thực nội bộ</p>
                        ) : (
                            <p className="text-[9pt] italic text-slate-500 mt-0.5">Chờ xác nhận</p>
                        )}
                    </div>
                </div>
                <div>
                    <p className="font-bold uppercase text-slate-800">CHỦ TỊCH HỘI ĐỒNG</p>
                    <p className="italic text-[10pt] text-slate-500">(Ký và ghi rõ họ tên)</p>
                    <div className="min-h-16 flex flex-col justify-center mt-2">
                        {chairName && <p className="font-bold text-slate-900">{chairName}</p>}
                        {chairmanSigned ? (
                            <p className="text-[9pt] text-emerald-700 mt-0.5">Đã xác thực nội bộ</p>
                        ) : (
                            <p className="text-[9pt] italic text-slate-500 mt-0.5">Chờ xác nhận</p>
                        )}
                    </div>
                </div>
            </div>
        </A4PageContainer>
    );
}
