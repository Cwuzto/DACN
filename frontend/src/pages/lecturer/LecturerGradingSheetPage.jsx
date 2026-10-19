import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Button,
    Card,
    Input,
    InputNumber,
    message,
    Space,
    Tag,
    Tooltip,
} from 'antd';
import {
    ArrowLeftOutlined,
    CheckCircleOutlined,
    FilePdfOutlined,
    LockOutlined,
    PrinterOutlined,
    SaveOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import PageLoader from '../../components/common/PageLoader';

const ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch',
    SECRETARY: 'Thư ký',
    REVIEWER: 'Ủy viên phản biện',
    MEMBER: 'Ủy viên',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function LecturerGradingSheetPage() {
    const { registrationId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [scoreLocked, setScoreLocked] = useState(false);
    const [registration, setRegistration] = useState(null);
    const [currentEvaluator, setCurrentEvaluator] = useState(null);
    const [rubricInfo, setRubricInfo] = useState(null);
    const [categories, setCategories] = useState([]);
    const [scoresMap, setScoresMap] = useState({});
    const [commentsMap, setCommentsMap] = useState({});
    const [generalComment, setGeneralComment] = useState('');

    useEffect(() => {
        const loadScoreSheet = async () => {
            try {
                setLoading(true);
                const res = await evaluationService.getScoreSheet(registrationId);
                if (!res.success || !res.data) return;

                const payload = res.data;
                setRegistration(payload.registration || null);
                setCurrentEvaluator(payload.currentEvaluator || null);
                setScoreLocked(Boolean(payload.scoreLocked));
                setGeneralComment(payload.defenseResult?.comments || '');

                const rubric = payload.rubric || {};
                setRubricInfo({
                    version: rubric.version || 'v1',
                    title: rubric.title || 'Barem đánh giá bảo vệ đồ án',
                    totalMaxScore: rubric.totalMaxScore || 10.0,
                });

                // Cấu trúc Categories & Criteria
                let rawCategories = rubric.categories || [];
                if (!rawCategories.length && rubric.criteria?.length) {
                    // Fallback nếu dữ liệu chỉ có mảng criteria phẳng
                    rawCategories = [
                        {
                            code: 'DEFAULT_CAT',
                            name: 'Tiêu chuẩn đánh giá',
                            maxScore: rubric.totalMaxScore || 10.0,
                            criteria: rubric.criteria,
                        },
                    ];
                }
                setCategories(rawCategories);

                // Điền điểm đã chấm trước đó
                const sMap = {};
                const cMap = {};
                (payload.scores || []).forEach((item) => {
                    if (item?.criterionCode) {
                        sMap[item.criterionCode] = Number.isFinite(Number(item.score)) ? Number(item.score) : null;
                        cMap[item.criterionCode] = item.comment || '';
                    }
                });
                setScoresMap(sMap);
                setCommentsMap(cMap);
            } catch (e) {
                message.error(e.message || 'Không thể tải phiếu chấm điểm');
            } finally {
                setLoading(false);
            }
        };

        loadScoreSheet();
    }, [registrationId]);

    // Danh sách phẳng tất cả tiêu chí
    const allCriteria = useMemo(() => {
        return categories.flatMap((cat) => cat.criteria || []);
    }, [categories]);

    // Cập nhật điểm cho một tiêu chí
    const handleScoreChange = (criterionCode, value, maxScore) => {
        if (value === null || value === undefined || value === '') {
            setScoresMap((prev) => ({ ...prev, [criterionCode]: null }));
            return;
        }
        let numVal = Number(value);
        if (Number.isNaN(numVal)) return;
        if (numVal < 0) numVal = 0;
        if (numVal > maxScore) numVal = maxScore;

        setScoresMap((prev) => ({ ...prev, [criterionCode]: round2(numVal) }));
    };

    // Cập nhật nhận xét cho tiêu chí
    const handleCommentChange = (criterionCode, value) => {
        setCommentsMap((prev) => ({ ...prev, [criterionCode]: value }));
    };

    // Tổng điểm thời gian thực
    const totalScore = useMemo(() => {
        const sum = allCriteria.reduce((acc, cri) => {
            const val = scoresMap[cri.code];
            return acc + (Number.isFinite(Number(val)) ? Number(val) : 0);
        }, 0);
        return round2(sum);
    }, [allCriteria, scoresMap]);

    // Kiểm tra đã nhập đủ tất cả các ô điểm chưa
    const isCompleted = useMemo(() => {
        if (!allCriteria.length) return false;
        return allCriteria.every((cri) => {
            const val = scoresMap[cri.code];
            return val !== null && val !== undefined && Number.isFinite(Number(val));
        });
    }, [allCriteria, scoresMap]);

    // Lưu phiếu chấm
    const handleSave = async () => {
        if (!isCompleted) {
            message.warning('Vui lòng nhập đầy đủ điểm cho tất cả các tiêu chí trong barem trước khi lưu.');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                scores: allCriteria.map((cri) => ({
                    criterionCode: cri.code,
                    score: Number(scoresMap[cri.code] || 0),
                    comment: commentsMap[cri.code] || null,
                })),
                generalComment: generalComment ? generalComment.trim() : '',
            };

            const res = await evaluationService.saveScoreSheet(registrationId, payload);
            if (res.success) {
                message.success('Đã lưu phiếu chấm điểm thành công!');
            }
        } catch (e) {
            message.error(e.message || 'Lưu phiếu chấm thất bại');
        } finally {
            setSaving(false);
        }
    };

    // Xuất PDF
    const handleExportPdf = async () => {
        try {
            setExporting(true);
            const res = await evaluationService.exportScoreSheetPdf(registrationId);
            if (res.success) {
                message.success('Đã xuất PDF phiếu chấm');
                if (res.data?.pdfUrl) window.open(res.data.pdfUrl, '_blank');
            }
        } catch (e) {
            message.error(e.message || 'Không thể xuất PDF');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <div className="bg-slate-200/80 min-h-screen py-6 px-4 select-text">
            {/* Action Bar (Sticky Top) */}
            <div className="max-w-[950px] mx-auto mb-4 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-300 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
                <div className="flex items-center gap-3">
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/lecturer/grading')}>
                        Quay lại
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">
                                Phiếu Chấm Điểm Đồ Án Tốt Nghiệp
                            </span>
                            <Tag color="teal" className="font-semibold text-xs m-0">
                                Barem {rubricInfo?.version?.toUpperCase()}
                            </Tag>
                        </div>
                        <span className="text-xs text-slate-500">
                            Sinh viên: <b className="text-slate-800">{registration?.student?.fullName}</b> ({registration?.student?.code})
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Tooltip title="Tổng điểm chấm hiện tại">
                        <Tag
                            color={isCompleted ? '#059669' : '#D97706'}
                            className="font-bold text-sm px-3 py-1 flex items-center gap-1.5"
                        >
                            {isCompleted ? <CheckCircleOutlined /> : <WarningOutlined />}
                            Tổng: {totalScore} / 10.0đ
                        </Tag>
                    </Tooltip>

                    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                        In phiếu
                    </Button>
                    <Button icon={<FilePdfOutlined />} onClick={handleExportPdf} loading={exporting}>
                        Xuất PDF
                    </Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        className="bg-[#0F766E] hover:bg-[#115E59]"
                        onClick={handleSave}
                        loading={saving}
                        disabled={scoreLocked}
                    >
                        Lưu phiếu điểm
                    </Button>
                </div>
            </div>

            {/* Score Locked Alert */}
            {scoreLocked && (
                <div className="max-w-[950px] mx-auto mb-4 print:hidden">
                    <Alert
                        type="warning"
                        showIcon
                        icon={<LockOutlined />}
                        message="Phiếu điểm đã được khóa"
                        description="Hồ sơ điểm của bạn cho sinh viên này đã bị khóa bởi Hội đồng hoặc Quản trị viên. Bạn hiện chỉ có thể xem hoặc in phiếu."
                        className="border border-amber-300 bg-amber-50"
                    />
                </div>
            )}

            {/* A4 Sheet Container */}
            <div className="max-w-[950px] mx-auto bg-white p-8 md:p-12 shadow-lg border border-slate-300 rounded-lg print:shadow-none print:border-none print:p-0 print:m-0 font-serif text-[13px] leading-relaxed text-black">
                {/* Header section: Quốc hiệu & Tiêu ngữ */}
                <div className="flex justify-between items-start text-center mb-6">
                    <div className="w-[45%]">
                        <p className="uppercase font-bold text-xs">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</p>
                        <p className="uppercase font-bold text-sm text-teal-900 border-b-2 border-black inline-block pb-0.5">
                            VIỆN CÔNG NGHỆ SỐ
                        </p>
                    </div>
                    <div className="w-[50%]">
                        <p className="uppercase font-bold text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p className="font-bold text-xs border-b border-black inline-block pb-0.5">
                            Độc lập - Tự do - Hạnh phúc
                        </p>
                        <p className="italic text-xs text-slate-600 mt-1">
                            Bình Dương, ngày {dayjs().format('DD')} tháng {dayjs().format('MM')} năm {dayjs().format('YYYY')}
                        </p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center my-6">
                    <h2 className="text-base md:text-lg font-bold uppercase tracking-wide">
                        PHIẾU ĐÁNH GIÁ BÁO CÁO TỐT NGHIỆP
                    </h2>
                    <p className="italic text-xs text-slate-600 mt-0.5">
                        (Dành cho thành viên Hội đồng đánh giá khóa luận/đồ án tốt nghiệp)
                    </p>
                </div>

                {/* Information Info Section */}
                <div className="border border-slate-300 rounded p-4 mb-6 space-y-1.5 text-xs bg-slate-50/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <span>Họ và tên sinh viên: </span>
                            <b className="uppercase text-slate-900">{registration?.student?.fullName || '—'}</b>
                        </div>
                        <div>
                            <span>Mã số sinh viên: </span>
                            <b className="font-mono text-slate-900">{registration?.student?.code || '—'}</b>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <span>Ngành / Chuyên ngành: </span>
                            <b>{registration?.student?.department || 'Công nghệ Thông tin'}</b>
                        </div>
                        <div>
                            <span>Khóa học: </span>
                            <b>{registration?.student?.course || '2022 - 2026'}</b>
                        </div>
                    </div>
                    <div>
                        <span>Tên đề tài: </span>
                        <b className="text-slate-900">{registration?.topic?.title || '—'}</b>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                        <div>
                            <span>Cán bộ đánh giá: </span>
                            <b className="text-slate-900">{currentEvaluator?.fullName || '—'}</b>
                        </div>
                        <div>
                            <span>Vai trò trong Hội đồng: </span>
                            <b className="text-teal-800">
                                {ROLE_LABELS[currentEvaluator?.roleInCouncil] || currentEvaluator?.roleInCouncil || 'Thành viên'}
                            </b>
                        </div>
                    </div>
                </div>

                {/* Rubric Dynamic Table */}
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                            <tr className="bg-slate-100 font-bold text-center">
                                <th className="border border-black p-2 w-10">STT</th>
                                <th className="border border-black p-2 text-left">Nội dung đánh giá & Tiêu chí</th>
                                <th className="border border-black p-2 w-20">Điểm tối đa</th>
                                <th className="border border-black p-2 w-28">Điểm chấm</th>
                                <th className="border border-black p-2 w-44 print:w-32">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((cat, catIdx) => (
                                <div key={cat.code || catIdx} style={{ display: 'contents' }}>
                                    {/* Category Header Row */}
                                    <tr className="bg-slate-100/90 font-bold">
                                        <td className="border border-black p-2 text-center text-slate-800">
                                            {String.fromCharCode(65 + catIdx)}
                                        </td>
                                        <td className="border border-black p-2 text-slate-900 uppercase">
                                            {cat.name}
                                        </td>
                                        <td className="border border-black p-2 text-center font-bold text-slate-900">
                                            {cat.maxScore}đ
                                        </td>
                                        <td className="border border-black p-2 text-center bg-slate-50 text-slate-400">
                                            —
                                        </td>
                                        <td className="border border-black p-2 bg-slate-50"></td>
                                    </tr>

                                    {/* Criteria Rows in this Category */}
                                    {(cat.criteria || []).map((cri, criIdx) => {
                                        const currentScore = scoresMap[cri.code];
                                        const currentComment = commentsMap[cri.code] || '';

                                        return (
                                            <tr key={cri.code || criIdx} className="hover:bg-slate-50/50">
                                                <td className="border border-black p-2 text-center font-mono text-slate-600">
                                                    {catIdx + 1}.{criIdx + 1}
                                                </td>
                                                <td className="border border-black p-2">
                                                    <div className="font-bold text-slate-900">{cri.label}</div>
                                                    {cri.description && (
                                                        <div className="text-[11px] text-slate-600 italic mt-0.5 leading-snug">
                                                            {cri.description}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-black p-2 text-center font-bold text-slate-800">
                                                    {cri.maxScore}
                                                </td>
                                                <td className="border border-black p-2 text-center">
                                                    <InputNumber
                                                        min={0}
                                                        max={cri.maxScore}
                                                        step={0.05}
                                                        value={currentScore}
                                                        onChange={(val) => handleScoreChange(cri.code, val, cri.maxScore)}
                                                        disabled={scoreLocked}
                                                        className="w-full text-center font-bold text-xs"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="border border-black p-1.5">
                                                    <Input
                                                        value={currentComment}
                                                        onChange={(e) => handleCommentChange(cri.code, e.target.value)}
                                                        disabled={scoreLocked}
                                                        placeholder="Nhận xét..."
                                                        className="text-xs"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Total Score Summary Row */}
                            <tr className="bg-slate-100 font-bold text-sm">
                                <td colSpan={2} className="border border-black p-2.5 text-right uppercase text-slate-900">
                                    TỔNG SỐ ĐIỂM ĐÁNH GIÁ (Thang điểm 10):
                                </td>
                                <td className="border border-black p-2.5 text-center text-slate-900">
                                    10.0
                                </td>
                                <td className="border border-black p-2.5 text-center text-emerald-800 text-base">
                                    {totalScore}
                                </td>
                                <td className="border border-black p-2.5 text-center text-xs text-slate-600">
                                    {isCompleted ? 'Đầy đủ điểm' : 'Chưa hoàn tất'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* General Comment Section */}
                <div className="border border-black rounded p-3 mb-8">
                    <label className="block font-bold text-xs uppercase mb-1">
                        Nhận xét chung của Cán bộ đánh giá:
                    </label>
                    <Input.TextArea
                        rows={3}
                        value={generalComment}
                        onChange={(e) => setGeneralComment(e.target.value)}
                        disabled={scoreLocked}
                        placeholder="Ghi nhận xét về ưu điểm, khuyết điểm chính của đề tài và kỹ năng bảo vệ của sinh viên..."
                        className="text-xs font-serif"
                    />
                </div>

                {/* Signature Section */}
                <div className="flex justify-between items-start text-center pt-2">
                    <div className="w-[45%]"></div>
                    <div className="w-[45%]">
                        <p className="font-bold text-xs uppercase">CÁN BỘ ĐÁNH GIÁ</p>
                        <p className="italic text-[11px] text-slate-500 mb-16">(Ký và ghi rõ họ tên)</p>
                        <p className="font-bold text-sm text-slate-900">{currentEvaluator?.fullName || ''}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
