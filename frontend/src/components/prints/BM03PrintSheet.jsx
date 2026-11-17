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
    meetingLogs,
    bm03Record,
    student = {},
    mentor = {},
    checkpoints = {},
}) {
    const s = student?.fullName ? student : registration?.student || {};
    const m = mentor?.fullName ? mentor : registration?.mentor || registration?.topic?.mentor || bm03Record?.advisorSignedBy || {};
    const topic = registration?.topic || {};
    const title = registration?.adjustedTitle || registration?.bm01ApprovedTitleSnapshot || bm03Record?.effectiveTitleSnapshot || topic?.title || '................................................................................................................';

    const studentClass = s.studentProfile?.className || s.className || s.class || s.studentClass || '....................';
    const studentCode = s.code || s.studentCode || s.studentProfile?.studentCode || '..........................';

    const rawList = (progressRecords && progressRecords.length > 0)
        ? progressRecords
        : (meetingLogs && meetingLogs.length > 0)
            ? meetingLogs
            : (bm03Record?.meetings && bm03Record.meetings.length > 0)
                ? bm03Record.meetings
                : [];

    // Filter out superseded meeting entries so only active versions appear in print sheet
    const activeMeetingsRaw = [...rawList]
        .filter((r) => !r?.supersededBy && !r?.isSuperseded)
        .sort((a, b) => {
            const dateDiff = new Date(a?.meetingDate || 0) - new Date(b?.meetingDate || 0);
            if (dateDiff !== 0) return dateDiff;
            return (a?.id || 0) - (b?.id || 0);
        });

    const meetings = activeMeetingsRaw.map((r, idx) => ({
        week: r.weekNumber || r.meetingIndex || idx + 1,
        date: r.meetingDate ? new Date(r.meetingDate).toLocaleDateString('vi-VN') : (r.date || '...../...../202...'),
        plan: r.taskContent || r.plan || r.discussionContent || r.studentCompletedWork || '—',
        comment: r.mentorFeedback || r.comment || (r.progressRating ? `Đánh giá: ${r.progressRating === 'ON_TRACK' ? 'Đúng tiến độ' : r.progressRating}${r.remainingIssues ? `. ${r.remainingIssues}` : ''}` : 'Chưa có nhận xét'),
    }));

    const midtermEval = bm03Record?.midtermStageEvaluation || bm03Record?.stageEvaluations?.find((e) => e.stage === 'MIDTERM');
    const finalEval = bm03Record?.finalStageEvaluation || bm03Record?.stageEvaluations?.find((e) => e.stage === 'FINAL');

    // Only mark passed/failed from real BM03StageEvaluation records (never default from legacy checkpoints or registration status)
    let cp1Status = null;
    if (midtermEval?.decision === 'CONTINUE') {
        cp1Status = true;
    } else if (midtermEval?.decision === 'STOP' || midtermEval?.decision === 'PROPOSE_STOP') {
        cp1Status = false;
    }

    let cp2Status = null;
    if (finalEval?.decision === 'CONTINUE' || finalEval?.decision === 'CONTINUE_TO_BM04') {
        cp2Status = true;
    } else if (finalEval?.decision === 'STOP' || finalEval?.decision === 'PROPOSE_STOP') {
        cp2Status = false;
    }

    const ackStatusLabels = {
        ACKNOWLEDGED: 'Đã xác nhận nội bộ',
        ACKNOWLEDGED_WITH_COMMENT: 'Đã xác nhận kèm ý kiến',
        DECLINED_TO_ACKNOWLEDGE: 'Từ chối xác nhận',
        ACKNOWLEDGEMENT_TIMEOUT: 'Quá hạn 48h (Hệ thống ghi nhận)',
    };
    const studentAckLabel = ackStatusLabels[bm03Record?.studentAckStatus] || null;

    const splitIndex = Math.max(1, Math.floor(meetings.length / 2));
    const firstHalfMeetings = meetings.slice(0, splitIndex);
    const secondHalfMeetings = meetings.slice(splitIndex);

    const overallComment =
        bm03Record?.finalComment ||
        bm03Record?.overallComment ||
        finalEval?.comments ||
        finalEval?.comment ||
        'Chưa có đánh giá chung cuối kỳ.';

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
                    <p className="font-semibold text-[10pt] uppercase tracking-tight">BỘ MÔN: KỸ THUẬT PHẦN MỀM &amp; HTTT</p>
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
                <p className="text-[10pt] italic text-slate-700">(Mã biểu mẫu: BM03 - Sổ theo dõi tiến độ &amp; Checkpoint)</p>
            </div>

            {/* Thông tin sinh viên & đề tài */}
            <div className="mb-3 text-[11pt] leading-relaxed pl-1 space-y-1">
                <p>
                    Họ tên sinh viên: <strong>{s.fullName || '...................................................'}</strong>
                    &nbsp;&nbsp;MSSV: <strong>{studentCode}</strong>
                    &nbsp;&nbsp;Lớp: <strong>{studentClass}</strong>
                </p>
                <p>
                    Điện thoại: <strong>{s.phone || '....................'}</strong>
                    &nbsp;&nbsp;&nbsp;&nbsp;Email: <strong>{s.email || '....................'}</strong>
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
                        {meetings.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="border border-black p-2 text-center italic text-slate-500">
                                    Chưa có nhật ký hướng dẫn được ghi nhận.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {firstHalfMeetings.map((mItem, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-black p-1 text-center font-medium">{mItem.week}</td>
                                        <td className="border border-black p-1 text-center">{mItem.date}</td>
                                        <td className="border border-black p-1 text-justify">{mItem.plan}</td>
                                        <td className="border border-black p-1 text-center text-[9.5pt]">{mItem.comment}</td>
                                    </tr>
                                ))}
                            </>
                        )}

                        {/* Checkpoint 1 Row */}
                        <tr className="bg-emerald-50/50 font-medium">
                            <td colSpan={4} className="border border-black p-2">
                                <div className="flex justify-between items-center px-2">
                                    <span>
                                        <strong>ĐÁNH GIÁ TIẾN ĐỘ ĐỢT 1 (CHECKPOINT 1):</strong>
                                    </span>
                                    <span>
                                        Được tiếp tục: {cp1Status === true ? '☑' : '◻'} &nbsp;&nbsp;&nbsp;&nbsp;
                                        Không tiếp tục: {cp1Status === false ? '☑' : '◻'}
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {secondHalfMeetings.map((mItem, idx) => (
                            <tr key={idx + splitIndex}>
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
                                        Được tiếp tục: {cp2Status === true ? '☑' : '◻'} &nbsp;&nbsp;&nbsp;&nbsp;
                                        Không tiếp tục: {cp2Status === false ? '☑' : '◻'}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Nhận xét chung & Chữ ký của Sinh viên + GVHD */}
            <div className="mt-4 text-[11pt] leading-relaxed pl-1 page-break-avoid">
                <p className="font-semibold mb-1">Đánh giá chung của Cán bộ hướng dẫn:</p>
                <p className="italic text-justify pl-3 text-slate-800">
                    {overallComment}
                </p>

                <div className="grid grid-cols-2 gap-8 text-center mt-6 px-4">
                    <div>
                        <p className="font-bold uppercase">SINH VIÊN THỰC HIỆN</p>
                        <p className="text-[10pt] italic">(Xác nhận toàn phiếu BM03)</p>
                        <div className="min-h-16 flex flex-col justify-center">
                            {studentAckLabel ? (
                                <div className="mt-2 text-[9.5pt] text-emerald-800">
                                    <p className="font-semibold">{studentAckLabel}</p>
                                    {s.fullName && <p className="font-semibold text-black">{s.fullName}</p>}
                                    {bm03Record?.studentAckAt && (
                                        <p className="text-[8.5pt] text-slate-600">
                                            {new Date(bm03Record.studentAckAt).toLocaleString('vi-VN')}
                                        </p>
                                    )}
                                    {bm03Record?.studentComment && (
                                        <p className="text-[8.5pt] italic text-slate-700 mt-0.5">
                                            Ý kiến: {bm03Record.studentComment}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-2 text-[9.5pt] italic text-slate-500">Chờ xác nhận</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="font-bold uppercase">CÁN BỘ HƯỚNG DẪN</p>
                        <p className="text-[10pt] italic">(Ký và ghi rõ họ tên)</p>
                        <div className="min-h-16 flex flex-col justify-center">
                            {bm03Record?.advisorSignedAt ? (
                                <div className="mt-2 text-[9.5pt] text-emerald-800">
                                    <p className="font-semibold">Đã xác thực nội bộ</p>
                                    {m.fullName && <p className="font-semibold text-black">{m.fullName}</p>}
                                    <p className="text-[8.5pt] text-slate-600">{new Date(bm03Record.advisorSignedAt).toLocaleString('vi-VN')}</p>
                                </div>
                            ) : (
                                <p className="mt-2 text-[9.5pt] italic text-slate-500">Chờ xác nhận</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </A4PageContainer>
    );
}
