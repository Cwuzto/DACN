import { useState, useEffect, useMemo } from 'react';
import { Button, Divider, Empty, Tag, Typography, message, Alert, Space } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloudUploadOutlined,
    ExclamationCircleOutlined,
    FilePdfOutlined,
    GithubOutlined,
    LinkOutlined,
    PrinterOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    TrophyOutlined,
    UserOutlined,
    YoutubeOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';
import archiveService from '../../services/archiveService';
import PageHeader from '../../components/common/PageHeader';
import PageLoader from '../../components/common/PageLoader';
import ArchiveSubmissionModal from '../../components/forms/ArchiveSubmissionModal';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';

const { Title, Text, Paragraph } = Typography;

const ROLE_LABELS = {
    CHAIRMAN: { label: 'Chủ tịch HĐ', color: 'blue' },
    SECRETARY: { label: 'Thư ký HĐ', color: 'cyan' },
    REVIEWER: { label: 'Phản biện HĐ', color: 'purple' },
    MEMBER: { label: 'Ủy viên HĐ', color: 'geekblue' },
};

const getLetterGrade = (score) => {
    if (score === null || score === undefined) return { letter: 'N/A', text: 'Chưa có điểm' };
    const num = Number(score);
    if (num >= 8.5) return { letter: 'A', text: 'Xuất sắc / Giỏi', color: 'text-emerald-400' };
    if (num >= 7.0) return { letter: 'B', text: 'Khá', color: 'text-blue-400' };
    if (num >= 5.5) return { letter: 'C', text: 'Trung bình', color: 'text-amber-400' };
    if (num >= 4.0) return { letter: 'D', text: 'Đạt', color: 'text-orange-400' };
    return { letter: 'F', text: 'Không đạt', color: 'text-rose-400' };
};

export default function GradeViewPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);

    // Archive & Certificate states
    const [archiveData, setArchiveData] = useState(null);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certificateData, setCertificateData] = useState(null);
    const [certLoading, setCertLoading] = useState(false);

    useEffect(() => {
        fetchGrades();
    }, []);

    const fetchGrades = async () => {
        try {
            setLoading(true);
            const res = await evaluationService.getMyGrades();
            if (res.success) {
                setRegistrations(res.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu điểm.');
        } finally {
            setLoading(false);
        }
    };

    const selectedRegistration = useMemo(() => {
        if (!registrations.length) return null;
        const withDefenseResult = registrations.find((item) => item.defenseResult);
        return withDefenseResult || registrations[0];
    }, [registrations]);

    const fetchArchive = async (regId) => {
        if (!regId) return;
        try {
            setArchiveLoading(true);
            const res = await archiveService.getArchiveByRegistration(regId);
            if (res.success) {
                setArchiveData(res.data?.archive || null);
            }
        } catch {
            setArchiveData(null);
        } finally {
            setArchiveLoading(false);
        }
    };

    useEffect(() => {
        if (selectedRegistration?.id) {
            fetchArchive(selectedRegistration.id);
        }
    }, [selectedRegistration?.id]);

    const handleOpenCertificate = async () => {
        if (!selectedRegistration?.id) return;
        try {
            setCertLoading(true);
            const res = await archiveService.getClearanceCertificate(selectedRegistration.id);
            if (res.success) {
                setCertificateData(res.data);
                setCertModalOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Giấy xác nhận hoàn thành');
        } finally {
            setCertLoading(false);
        }
    };

    const defenseResult = selectedRegistration?.defenseResult || null;
    const council = selectedRegistration?.council || null;
    const memberScores = selectedRegistration?.memberScores || [];
    const finalScore = defenseResult?.finalScore ?? null;
    const hasScore = finalScore !== null && finalScore !== undefined;
    const isPassed = hasScore && Number(finalScore) >= 4.0;
    const statusText = !hasScore ? 'ĐANG CHẤM ĐIỂM' : isPassed ? 'ĐẠT BẢO VỆ' : 'KHÔNG ĐẠT';
    const gradeInfo = getLetterGrade(finalScore);

    if (loading) {
        return <PageLoader />;
    }

    if (!selectedRegistration) {
        return (
            <div className="py-8 space-y-4">
                <PageHeader
                    breadcrumb={[
                        { label: 'Cổng Sinh viên' },
                        { label: 'Khóa luận & Đồ án' },
                        { label: 'Kết quả đánh giá' },
                    ]}
                    title="Kết quả Điểm & Đánh giá Đồ án"
                    subtitle="Bảng điểm tổng hợp và nhận xét chính thức từ Hội đồng chấm bảo vệ khóa luận."
                />
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-12 text-center max-w-2xl mx-auto space-y-3">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto text-3xl">
                        <span className="material-symbols-outlined">folder_off</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Chưa có dữ liệu bảo vệ</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Bạn chưa có đề tài đăng ký hoặc chưa được xếp lịch chấm điểm hội đồng trong hệ thống.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                breadcrumb={[
                    { label: 'Cổng Sinh viên' },
                    { label: 'Khóa luận & Đồ án' },
                    { label: 'Kết quả đánh giá' },
                ]}
                title="Kết quả Điểm & Đánh giá Đồ án"
                subtitle="Bảng điểm chi tiết theo 14 tiêu chí và nhận xét chính thức từ Hội đồng chấm bảo vệ khóa luận."
                tags={[
                    {
                        label: statusText,
                        color: !hasScore ? 'gold' : isPassed ? 'green' : 'red',
                    },
                    {
                        label: council?.name || 'Hội đồng',
                        color: 'blue',
                    },
                ]}
                actions={
                    <Button icon={<ReloadOutlined />} onClick={fetchGrades}>
                        Làm mới
                    </Button>
                }
            />

            {/* Hero Score Trophy Card */}
            <div className="bg-gradient-to-br from-[#1E3A5F] via-[#1a3252] to-[#0f172a] rounded-xl p-6 md:p-8 text-white shadow-md border border-slate-800 flex flex-col md:flex-row items-center md:justify-between gap-6">
                <div className="flex-1 space-y-3 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-blue-200 border border-white/10">
                        <TrophyOutlined className="text-amber-400" />
                        KẾT QUẢ ĐÁNH GIÁ CHÍNH THỨC
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
                        {selectedRegistration.topic?.title || 'Đề tài tốt nghiệp'}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-300">
                        <span>
                            GVHD: <b>{selectedRegistration.topic?.mentor?.fullName || 'Chưa cập nhật'}</b>
                        </span>
                        <span>•</span>
                        <span>
                            Học phần: <b>{selectedRegistration.topic?.projectCatalog?.name || 'Đồ án tốt nghiệp'}</b>
                        </span>
                    </div>
                </div>

                {/* Score Number Display */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/15 p-6 flex flex-col items-center justify-center min-w-[210px] text-center">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-slate-300">
                        Điểm Tổng Kết
                    </span>
                    <div className="flex items-baseline justify-center gap-1 my-1">
                        <span className="text-5xl font-black text-white">
                            {hasScore ? Number(finalScore).toFixed(2) : '--'}
                        </span>
                        <span className="text-lg font-semibold text-slate-400">/10</span>
                    </div>
                    <div className={`text-xs font-bold mt-0.5 ${gradeInfo.color}`}>
                        Thang điểm chữ: {gradeInfo.letter} ({gradeInfo.text})
                    </div>
                </div>
            </div>

            {/* Council Info Card & 3 Committee Members */}
            {council && (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <TeamOutlined className="text-lg" />
                            </div>
                            <div>
                                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                                    Hội đồng chấm bảo vệ
                                </span>
                                <h3 className="text-base font-bold text-slate-900 leading-tight">
                                    {council.name}
                                </h3>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Tag color={council.councilType === 'OUTLINE_REVIEW' ? 'purple' : 'blue'} className="font-semibold">
                                {council.councilType === 'OUTLINE_REVIEW' ? 'HĐ Xét duyệt Đề cương' : 'Hội đồng Bảo vệ'}
                            </Tag>
                            {council.location && (
                                <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                                    Phòng: <b>{council.location}</b>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 3 Members Grid */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                            Thành viên Hội đồng & Điểm thành phần
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(council.members || []).map((member) => {
                                const roleCfg = ROLE_LABELS[member.roleInCouncil] || { label: member.roleInCouncil, color: 'default' };
                                const memberScoreObj = memberScores.find((m) => m.evaluatorId === member.lecturerId);
                                const scored = memberScoreObj?.finalScore !== null && memberScoreObj?.finalScore !== undefined;

                                return (
                                    <div
                                        key={member.id}
                                        className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between space-y-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <Tag color={roleCfg.color} className="text-xs font-semibold">
                                                    {roleCfg.label}
                                                </Tag>
                                                {scored ? (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        {Number(memberScoreObj.finalScore).toFixed(2)}/10
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                        Đang chấm
                                                    </span>
                                                )}
                                            </div>

                                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2 mt-1">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                                    <UserOutlined />
                                                </div>
                                                <span>{member.lecturer?.fullName || 'Giảng viên'}</span>
                                            </div>
                                        </div>

                                        {memberScoreObj?.comments && (
                                            <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80 italic leading-relaxed">
                                                "{memberScoreObj.comments}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* General Feedback & Official Scoresheet */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                    <span className="material-symbols-outlined text-blue-600 text-lg">rate_review</span>
                    Nhận xét & Đánh giá chung của Hội đồng
                </div>

                {defenseResult ? (
                    <div className="space-y-4">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                            {defenseResult.comments || 'Hội đồng thống nhất kết quả đánh giá và thông qua kết quả bảo vệ đồ án của sinh viên.'}
                        </div>

                        {defenseResult.scoresheetUrl && (
                            <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                        <FilePdfOutlined className="text-xl" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">Biên bản & Bảng điểm PDF</div>
                                        <div className="text-sm font-bold text-slate-800">Bảng điểm bảo vệ đồ án chính thức</div>
                                    </div>
                                </div>
                                <Button
                                    type="primary"
                                    href={defenseResult.scoresheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium"
                                >
                                    Xem bảng điểm PDF
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-slate-400 italic py-2">
                        Hội đồng đang tiến hành tổng hợp và duyệt kết quả đánh giá cuối cùng.
                    </div>
                )}
            </div>

            {/* Post-Defense & Archive Workflow Card */}
            {(isPassed || ['DEFENDED', 'COMPLETED'].includes(selectedRegistration.status)) && (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <span className="material-symbols-outlined text-emerald-600 text-xl">inventory_2</span>
                            Hồ Sơ Lưu Chiểu Đồ Án Toàn Khóa & Nghiệm Thu Tốt Nghiệp
                        </div>
                        {archiveData?.status ? (
                            <Tag
                                color={
                                    archiveData.status === 'APPROVED' ? 'green' :
                                    archiveData.status === 'REVISION_REQUIRED' ? 'red' : 'orange'
                                }
                                className="font-semibold px-2.5 py-0.5"
                            >
                                {archiveData.status === 'APPROVED' ? '✓ ĐÃ NGHIỆM THU CHÍNH THỨC' :
                                 archiveData.status === 'REVISION_REQUIRED' ? '⚠ YÊU CẦU CHỈNH SỬA' :
                                 '⏳ ĐANG CHỜ GVHD NGHIỆM THU'}
                            </Tag>
                        ) : (
                            <Tag color="gold" className="font-semibold px-2.5 py-0.5">
                                ⏳ CHƯA NỘP LƯU CHIỂU
                            </Tag>
                        )}
                    </div>

                    {!archiveData ? (
                        <div className="space-y-4">
                            <Alert
                                type="info"
                                showIcon
                                message="Thủ tục bắt buộc sau khi bảo vệ"
                                description="Chúc mừng bạn đã bảo vệ đồ án đạt kết quả! Theo quy chế của Khoa, bạn cần nộp bản Báo cáo hoàn thiện (tiếp thu góp ý của Hội đồng), bản Slide, liên kết Video demo sản phẩm (Google Drive hoặc YouTube) và link mã nguồn để GVHD nghiệm thu và cấp Giấy xác nhận hoàn thành đồ án tốt nghiệp."
                            />
                            <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                onClick={() => setArchiveModalOpen(true)}
                                size="large"
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                className="font-semibold shadow-sm"
                            >
                                Nộp Hồ Sơ Lưu Chiểu Ngay
                            </Button>
                        </div>
                    ) : archiveData.status === 'SUBMITTED' ? (
                        <div className="space-y-4">
                            <Alert
                                type="warning"
                                showIcon
                                message="Hồ sơ đang chờ nghiệm thu"
                                description={`Hồ sơ lưu chiểu đã được gửi lúc ${new Date(archiveData.submittedAt).toLocaleString('vi-VN')}. Giảng viên hướng dẫn sẽ kiểm tra các tài liệu và xác nhận nghiệm thu cho bạn.`}
                            />
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                                <div className="font-bold text-slate-700">Tài liệu đã nộp:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {archiveData.reportFileUrl && (
                                        <div className="flex items-center gap-2">
                                            <FilePdfOutlined className="text-rose-500 text-base" />
                                            <a href={archiveData.reportFileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate">
                                                {archiveData.reportFileName || 'BaoCao_HoanThien.pdf'}
                                            </a>
                                        </div>
                                    )}
                                    {archiveData.demoVideoUrl && (
                                        <div className="flex items-center gap-2">
                                            <YoutubeOutlined className="text-red-500 text-base" />
                                            <a href={archiveData.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate">
                                                Video Demo Sản phẩm
                                            </a>
                                        </div>
                                    )}
                                    {archiveData.sourceCodeUrl && (
                                        <div className="flex items-center gap-2">
                                            <GithubOutlined className="text-slate-800 text-base" />
                                            <a href={archiveData.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate">
                                                Kho Mã Nguồn (Repo)
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button icon={<CloudUploadOutlined />} onClick={() => setArchiveModalOpen(true)}>
                                Cập nhật lại hồ sơ nộp
                            </Button>
                        </div>
                    ) : archiveData.status === 'REVISION_REQUIRED' ? (
                        <div className="space-y-4">
                            <Alert
                                type="error"
                                showIcon
                                message="Yêu cầu chỉnh sửa từ Giảng viên hướng dẫn"
                                description={archiveData.reviewerNotes || 'Vui lòng kiểm tra lại tài liệu và nộp bổ sung theo đúng quy cách.'}
                            />
                            <Button
                                type="primary"
                                danger
                                icon={<CloudUploadOutlined />}
                                onClick={() => setArchiveModalOpen(true)}
                            >
                                Cập nhật & Nộp lại hồ sơ
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Alert
                                type="success"
                                showIcon
                                message="Hồ sơ lưu chiểu đã được nghiệm thu chính thức"
                                description={`Đề tài đã hoàn tất quy trình bảo vệ và lưu chiểu ngày ${new Date(archiveData.reviewedAt || archiveData.updatedAt).toLocaleDateString('vi-VN')}. Bạn đã hoàn thành toàn bộ học phần đồ án tốt nghiệp.`}
                            />

                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    type="primary"
                                    icon={<SafetyCertificateOutlined />}
                                    onClick={handleOpenCertificate}
                                    loading={certLoading}
                                    size="large"
                                    className="bg-emerald-600 hover:bg-emerald-500 font-bold shadow-sm"
                                >
                                    Xem Giấy Xác Nhận Hoàn Thành Đồ Án (TDMU Certificate)
                                </Button>
                                {archiveData.reportFileUrl && (
                                    <Button
                                        icon={<FilePdfOutlined />}
                                        href={archiveData.reportFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Tải Báo cáo toàn văn
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <ArchiveSubmissionModal
                visible={archiveModalOpen}
                onClose={() => setArchiveModalOpen(false)}
                registration={selectedRegistration}
                initialArchive={archiveData}
                onSuccess={(savedArchive) => {
                    setArchiveData(savedArchive);
                    fetchGrades();
                }}
            />

            <ClearanceCertificateModal
                visible={certModalOpen}
                onClose={() => setCertModalOpen(false)}
                certificateData={certificateData}
            />
        </div>
    );
}
