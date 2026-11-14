import React, { useRef } from 'react';
import { Modal, Button, Tag, Space, Divider } from 'antd';
import {
    PrinterOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch',
    SECRETARY: 'Thư ký',
    REVIEWER: 'Ủy viên phản biện',
    MEMBER: 'Ủy viên',
};

const getGradeLabel = (score) => {
    if (score === null || score === undefined || isNaN(score)) return { code: '—', label: 'Chưa có điểm' };
    const num = Number(score);
    if (num >= 8.5) return { code: 'A', label: 'Loại A (Giỏi / Xuất sắc)' };
    if (num >= 7.0) return { code: 'B', label: 'Loại B (Khá)' };
    if (num >= 5.5) return { code: 'C', label: 'Loại C (Trung bình)' };
    return { code: 'F', label: 'Loại F (Không đạt)' };
};

export default function DefenseSummaryRecordModal({
    open,
    onClose,
    registration,
}) {
    const printContentRef = useRef(null);

    if (!registration) return null;

    const student = registration.student || {};
    const topic = registration.topic || {};
    const mentor = registration.mentor || topic.mentor || {};
    const council = registration.council || {};
    const councilMembers = council.members || [];
    const memberScores = registration.memberScores || [];
    const defenseResult = registration.defenseResult || {};

    const isAbsent = registration.attendanceStatus === 'ABSENT' || defenseResult.attendanceStatus === 'ABSENT';

    // Find council key roles
    const chairMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
    const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');
    const reviewerMember = councilMembers.find((m) => m.roleInCouncil === 'REVIEWER');

    const chairName = chairMember?.lecturer?.fullName || 'Chủ tịch Hội đồng';
    const secretaryName = secretaryMember?.lecturer?.fullName || 'Thư ký Hội đồng';

    // Calculate official scores
    const rawAverage = registration.rawAverageScore !== null && registration.rawAverageScore !== undefined
        ? Number(registration.rawAverageScore).toFixed(2)
        : registration.finalScore !== null && registration.finalScore !== undefined
        ? Number(registration.finalScore).toFixed(2)
        : '—';

    const roundedFinal = registration.roundedFinalScore !== null && registration.roundedFinalScore !== undefined
        ? Number(registration.roundedFinalScore).toFixed(1)
        : registration.finalScore !== null && registration.finalScore !== undefined
        ? Number(registration.finalScore).toFixed(1)
        : '—';

    const numericFinal = registration.roundedFinalScore ?? registration.finalScore ?? null;
    const grade = getGradeLabel(numericFinal);
    const isPassed = numericFinal !== null && Number(numericFinal) >= 5.0 && !isAbsent;

    // Defense date
    const defenseDateFormatted = council.defenseDate
        ? dayjs(council.defenseDate).format('DD/MM/YYYY')
        : dayjs().format('DD/MM/YYYY');

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={860}
            title={(
                <div className="flex items-center gap-2">
                    <FileTextOutlined className="text-teal-700 text-lg" />
                    <span className="font-bold text-slate-800 text-base">
                        Biên Bản Tổng Hợp Kết Quả Đánh Giá Bảo Vệ Khóa Luận Tốt Nghiệp (Mẫu BM05)
                    </span>
                </div>
            )}
            footer={(
                <div className="flex justify-between items-center w-full">
                    <div className="text-xs text-slate-500 font-mono">
                        Mã lưu trữ: BM05-{registration.registrationId || registration.id || '2026'}
                    </div>
                    <Space>
                        <Button onClick={onClose}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            className="bg-teal-700 hover:bg-teal-800"
                        >
                            In Biên Bản BM05
                        </Button>
                    </Space>
                </div>
            )}
        >
            <div className="simulated-bm05-container bg-slate-100 p-4 sm:p-6 rounded-lg max-h-[75vh] overflow-y-auto">
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .simulated-a4-bm05, .simulated-a4-bm05 * {
                            visibility: visible;
                        }
                        .simulated-a4-bm05 {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 15mm 20mm !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                    }
                `}</style>

                {/* Simulated A4 Paper */}
                <div
                    ref={printContentRef}
                    className="simulated-a4-bm05 bg-white p-8 sm:p-12 border border-slate-300 shadow-sm mx-auto text-slate-900 font-serif leading-relaxed text-[13px]"
                    style={{ maxWidth: '780px' }}
                >
                    {/* Header: National Emblem & Institution */}
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300 text-xs">
                        <div className="text-center">
                            <div className="font-bold uppercase tracking-wider text-slate-800">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</div>
                            <div className="font-bold uppercase tracking-wider text-teal-800">VIỆN CÔNG NGHỆ SỐ</div>
                            <div className="text-slate-500 font-mono mt-1">Hội đồng chấm: {council.name || 'HĐ Khóa luận'}</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                            <div className="font-bold border-b border-slate-800 inline-block pb-0.5">Độc lập - Tự do - Hạnh phúc</div>
                            <div className="italic text-slate-500 mt-1">
                                Bình Dương, ngày {dayjs().format('DD')} tháng {dayjs().format('MM')} năm {dayjs().format('YYYY')}
                            </div>
                        </div>
                    </div>

                    {/* Document Title */}
                    <div className="text-center my-6">
                        <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-slate-900 mb-1">
                            BIÊN BẢN TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ ĐỒ ÁN / KHÓA LUẬN TỐT NGHIỆP
                        </h2>
                        <div className="italic text-xs text-slate-600">
                            (Mẫu BM05 - Ban hành theo Quy chế Đào tạo & Quản lý Khóa luận Tốt nghiệp)
                        </div>
                    </div>

                    {/* Section I: Council Info */}
                    <div className="mb-4">
                        <div className="font-bold uppercase text-xs tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                            I. THÔNG TIN HỘI ĐỒNG &amp; BUỔI BẢO VỆ
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div>• <strong>Hội đồng:</strong> {council.name || 'Chưa phân công'}</div>
                            <div>• <strong>Ngày bảo vệ:</strong> {defenseDateFormatted}</div>
                            <div>• <strong>Địa điểm / Phòng:</strong> {council.location || 'Phòng chuyên đề Viện'}</div>
                            <div>• <strong>Quyết định thành lập:</strong> QĐ-VCN/2026</div>
                        </div>
                        <div className="mt-2 text-xs">
                            <strong>Thành phần Hội đồng:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-700">
                                {councilMembers.length > 0 ? (
                                    councilMembers.map((m, idx) => (
                                        <li key={idx}>
                                            <strong>{ROLE_LABELS[m.roleInCouncil] || m.roleInCouncil}:</strong> {m.lecturer?.fullName || '—'} {m.lecturer?.code ? `(${m.lecturer.code})` : ''}
                                        </li>
                                    ))
                                ) : (
                                    <>
                                        <li><strong>Chủ tịch:</strong> {chairName}</li>
                                        <li><strong>Thư ký:</strong> {secretaryName}</li>
                                        <li><strong>Ủy viên phản biện:</strong> {reviewerMember?.lecturer?.fullName || 'Ủy viên phản biện'}</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Section II: Student and Topic Info */}
                    <div className="mb-4">
                        <div className="font-bold uppercase text-xs tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                            II. THÔNG TIN SINH VIÊN &amp; ĐỀ TÀI
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div>• <strong>Họ và tên SV:</strong> <span className="uppercase font-semibold">{student.fullName || '—'}</span></div>
                            <div>• <strong>Mã số SV:</strong> <span className="font-mono font-semibold">{student.code || '—'}</span></div>
                            <div>• <strong>Lớp / Khóa:</strong> {student.className || student.class || 'Lớp Đồ án'}</div>
                            <div>• <strong>Ngành đào tạo:</strong> {student.department || 'Công nghệ Thông tin'}</div>
                            <div className="sm:col-span-2">• <strong>Tên đề tài:</strong> <span className="font-semibold">{registration.adjustedTitle || topic.title || '—'}</span></div>
                            <div className="sm:col-span-2">• <strong>Giảng viên hướng dẫn:</strong> {mentor.fullName || '—'}</div>
                        </div>
                    </div>

                    {/* Section III: Evaluation Scores */}
                    <div className="mb-4">
                        <div className="font-bold uppercase text-xs tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                            III. KẾT QUẢ ĐÁNH GIÁ CỦA CÁC THÀNH VIÊN HỘI ĐỒNG
                        </div>

                        {isAbsent ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 mb-3">
                                <div className="font-bold flex items-center gap-1.5 mb-1">
                                    <WarningOutlined />
                                    <span>SINH VIÊN VẮNG MẶT TẠI BUỔI BẢO VỆ</span>
                                </div>
                                <div>Hội đồng đã lập biên bản xác nhận sinh viên vắng mặt theo quy chế học vụ.</div>
                                {registration.absentMinutesText && (
                                    <div className="mt-1 italic text-slate-700 bg-white p-2 rounded border border-red-100">
                                        &ldquo;{registration.absentMinutesText}&rdquo;
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto mb-3">
                                <table className="w-full border-collapse border border-slate-400 text-xs">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="border border-slate-400 p-2 text-center w-10">STT</th>
                                            <th className="border border-slate-400 p-2 text-left">Thành viên Hội đồng</th>
                                            <th className="border border-slate-400 p-2 text-center w-32">Vai trò trong HĐ</th>
                                            <th className="border border-slate-400 p-2 text-center w-28">Điểm số (Hệ 10)</th>
                                            <th className="border border-slate-400 p-2 text-center w-28">Trạng thái phiếu</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {memberScores.length > 0 ? (
                                            memberScores.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="border border-slate-400 p-2 text-center font-mono">{idx + 1}</td>
                                                    <td className="border border-slate-400 p-2 font-medium">
                                                        {row.evaluator?.fullName || `Giám khảo ${idx + 1}`}
                                                    </td>
                                                    <td className="border border-slate-400 p-2 text-center">
                                                        {ROLE_LABELS[row.roleInCouncilSnapshot] || row.roleInCouncilSnapshot || (idx === 0 ? 'Chủ tịch' : idx === 1 ? 'Thư ký' : 'Ủy viên')}
                                                    </td>
                                                    <td className="border border-slate-400 p-2 text-center font-bold font-mono">
                                                        {row.finalScore !== null && row.finalScore !== undefined ? Number(row.finalScore).toFixed(2) : '—'}
                                                    </td>
                                                    <td className="border border-slate-400 p-2 text-center">
                                                        {row.scoreLocked ? (
                                                            <span className="text-emerald-700 font-medium">Đã khóa</span>
                                                        ) : (
                                                            <span className="text-amber-700 font-medium">Đang chấm</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="border border-slate-400 p-3 text-center text-slate-500 italic">
                                                    Chưa ghi nhận phiếu chấm thành viên
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Summary Block */}
                        <div className="bg-slate-50 border border-slate-300 p-3 rounded text-xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="font-semibold text-slate-700">Điểm trung bình cộng (Chưa làm tròn):</span>
                                <span className="font-mono font-bold text-slate-900">{isAbsent ? '—' : `${rawAverage} / 10`}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="font-bold text-teal-900">ĐIỂM KHÓA LUẬN CHÍNH THỨC (Làm tròn 1 chữ số lẻ):</span>
                                <span className="font-mono font-extrabold text-base text-teal-800">{isAbsent ? 'VẮNG MẶT' : `${roundedFinal} / 10`}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="font-semibold text-slate-700">Xếp loại học lực:</span>
                                <span className="font-bold text-slate-900">{isAbsent ? 'Không đạt (Vắng mặt)' : grade.label}</span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                                <span className="font-bold text-slate-900 uppercase">KẾT LUẬN CỦA HỘI ĐỒNG:</span>
                                <span>
                                    {isAbsent ? (
                                        <Tag color="error" className="font-bold uppercase">KHÔNG ĐẠT (VẮNG MẶT)</Tag>
                                    ) : isPassed ? (
                                        <Tag color="success" className="font-bold uppercase">ĐẠT (Đủ điều kiện nộp lưu chiểu)</Tag>
                                    ) : numericFinal !== null ? (
                                        <Tag color="error" className="font-bold uppercase">KHÔNG ĐẠT</Tag>
                                    ) : (
                                        <Tag color="warning" className="font-bold uppercase">CHỜ CHỐT SỔ ĐIỂM</Tag>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Section IV: Comments and Adjustments */}
                    <div className="mb-6">
                        <div className="font-bold uppercase text-xs tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                            IV. Ý KIẾN NHẬN XÉT &amp; NỘI DUNG CẦN CHỈNH SỬA
                        </div>
                        <div className="text-xs text-slate-700 space-y-1 bg-white p-2.5 border border-slate-200 rounded min-h-[50px]">
                            {registration.comments || defenseResult.comments ? (
                                <p className="italic">{registration.comments || defenseResult.comments}</p>
                            ) : (
                                <p className="italic text-slate-500">
                                    Hội đồng thống nhất sinh viên cần rà soát lại định dạng quyển báo cáo, bổ sung tài liệu tham khảo theo chuẩn học thuật và nộp hồ sơ lưu chiểu đúng thời hạn quy định.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Section V: Signatures */}
                    <div className="mb-4">
                        <div className="font-bold uppercase text-xs tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                            V. KÝ TÊN XÁC NHẬN
                        </div>
                        <div className="grid grid-cols-2 gap-6 pt-4 text-xs text-center">
                        <div>
                            <div className="font-bold uppercase text-slate-800">THƯ KÝ HỘI ĐỒNG</div>
                            <div className="italic text-[11px] text-slate-500 mb-12">(Ký và ghi rõ họ tên)</div>
                            <div className="font-bold text-slate-900">{secretaryName}</div>
                            <div className="text-[10px] text-emerald-700 font-sans mt-0.5 flex items-center justify-center gap-1">
                                <SafetyCertificateOutlined /> Xác nhận biên bản số
                            </div>
                        </div>
                        <div>
                            <div className="font-bold uppercase text-slate-800">CHỦ TỊCH HỘI ĐỒNG</div>
                            <div className="italic text-[11px] text-slate-500 mb-12">(Ký và ghi rõ họ tên)</div>
                            <div className="font-bold text-slate-900">{chairName}</div>
                            <div className="text-[10px] text-emerald-700 font-sans mt-0.5 flex items-center justify-center gap-1">
                                <SafetyCertificateOutlined /> Xác thực chữ ký số
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </Modal>
    );
}
