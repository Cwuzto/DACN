import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Button,
    Empty,
    Tag,
    message,
    Spin,
} from 'antd';
import {
    ReloadOutlined,
    FileDoneOutlined,
    CloudUploadOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';
import registrationService from '../../services/registrationService';
import archiveService from '../../services/archiveService';
import { STATUS_MAP } from '../../components/common/statusMap';
import ArchiveSubmissionModal from '../../components/forms/ArchiveSubmissionModal';
import ClearanceCertificateModal from '../../components/forms/ClearanceCertificateModal';

const getLetterGrade = (score) => {
    if (score === null || score === undefined || isNaN(score)) return { letter: '—', text: 'Chờ công bố điểm', color: '#475569' };
    const num = Number(score);
    if (num >= 8.5) return { letter: 'A', text: 'Xuất sắc / Giỏi', color: '#16A34A' };
    if (num >= 7.0) return { letter: 'B', text: 'Khá', color: '#0284C7' };
    if (num >= 5.5) return { letter: 'C', text: 'Trung bình', color: '#D97706' };
    if (num >= 4.0) return { letter: 'D', text: 'Đạt', color: '#E11D48' };
    return { letter: 'F', text: 'Không đạt', color: '#DC2626' };
};

export default function GradeViewPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);
    const [selectedRegId, setSelectedRegId] = useState(null);
    const [publishedResult, setPublishedResult] = useState(null);

    // Archive & Certificate states
    const [archiveData, setArchiveData] = useState(null);
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certificateData, setCertificateData] = useState(null);
    const [certLoading, setCertLoading] = useState(false);

    const fetchGrades = useCallback(async () => {
        try {
            setLoading(true);
            const [gradeRes, regRes, publishedRes] = await Promise.all([
                evaluationService.getMyGrades(),
                registrationService.getMyRegistration().catch(() => ({ success: false })),
                evaluationService.getMyPublishedResult().catch(() => ({ success: false })),
            ]);

            setPublishedResult(publishedRes.success ? publishedRes.data : null);

            let list = [];
            if (gradeRes.success && Array.isArray(gradeRes.data) && gradeRes.data.length > 0) {
                list = [...gradeRes.data];
            }

            if (regRes.success && regRes.data) {
                const activeReg = regRes.data;
                const idx = list.findIndex((r) => r.id === activeReg.id);
                if (idx === -1) {
                    list.unshift(activeReg);
                } else {
                    list[idx] = { ...list[idx], ...activeReg };
                }
            }

            setRegistrations(list);
            if (list.length > 0) {
                setSelectedRegId((prev) => {
                    if (prev) return prev;
                    const withScore = list.find((item) => item.defenseResult || (item.finalScore !== null && item.finalScore !== undefined));
                    return (withScore || list[0]).id;
                });
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu điểm.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGrades();
    }, [fetchGrades]);

    const selectedRegistration = useMemo(() => {
        if (!registrations.length) return null;
        if (selectedRegId) {
            const found = registrations.find((r) => r.id === selectedRegId);
            if (found) return found;
        }
        return registrations[0];
    }, [registrations, selectedRegId]);

    const fetchArchive = useCallback(async (regId) => {
        if (!regId) return;
        try {
            const res = await archiveService.getArchiveByRegistration(regId);
            if (res.success) {
                setArchiveData(res.data?.archive || null);
            }
        } catch {
            setArchiveData(null);
        }
    }, []);

    useEffect(() => {
        if (selectedRegistration?.id) {
            fetchArchive(selectedRegistration.id);
        }
    }, [fetchArchive, selectedRegistration?.id]);

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

    if (loading) {
        return (
            <div style={{ padding: '60px 32px', textAlign: 'center' }} className="sub-view">
                <Spin size="large" tip="Đang tải bảng điểm và hồ sơ lưu chiểu..." />
            </div>
        );
    }

    if (!selectedRegistration) {
        return (
            <div style={{ padding: '24px 32px' }} className="sub-view">
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <Empty description="Bạn chưa có đề tài đăng ký hoặc chưa được xếp lịch chấm điểm hội đồng trong hệ thống." />
                    <Button type="primary" icon={<ReloadOutlined />} style={{ marginTop: 16 }} onClick={fetchGrades}>
                        Tải lại dữ liệu
                    </Button>
                </div>
            </div>
        );
    }

    const council = selectedRegistration?.council || selectedRegistration?.defenseCouncil || null;
    const isOfficialResult = publishedResult?.registrationId === selectedRegistration?.id;
    const finalScore = isOfficialResult
        ? publishedResult.finalScoreSnapshot
        : null;
    const hasScore = finalScore !== null && finalScore !== undefined && !isNaN(finalScore);
    const gradeInfo = getLetterGrade(finalScore);

    const semesterName = selectedRegistration.topic?.semester?.name || selectedRegistration.semester?.name || 'Học kỳ hiện tại';
    const isCompleted = selectedRegistration.status === 'COMPLETED';

    const councilMembers = council?.members || [];
    const chairmanMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
    const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');
    const reviewerMember = councilMembers.find((m) => m.roleInCouncil === 'REVIEWER');

    const compositeScore = hasScore ? Number(finalScore).toFixed(1) : '—';
    const currentStatusMeta = STATUS_MAP[selectedRegistration.status] || { text: selectedRegistration.status, color: 'default' };

    return (
        <div style={{ padding: '24px 32px' }} data-od-id="view-grades" className="sub-view">
            {/* Multi-registration selector if student has more than 1 registration history */}
            {registrations.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                        Chọn đợt đăng ký:
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {registrations.map((reg) => {
                            const isSelected = reg.id === selectedRegistration.id;
                            const title = reg.topic?.title || `Đề tài #${reg.id}`;
                            const isPassed = ['DEFENSE_PASSED', 'DEFENDED', 'COMPLETED'].includes(reg.status);
                            return (
                                <button
                                    key={reg.id}
                                    type="button"
                                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSelectedRegId(reg.id)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: isSelected ? 700 : 500,
                                    }}
                                >
                                    <span>{title.length > 35 ? `${title.slice(0, 35)}...` : title}</span>
                                    {isPassed ? (
                                        <span className="tag green" style={{ padding: '1px 6px', fontSize: 10 }}>Đã bảo vệ</span>
                                    ) : (
                                        <span className="tag teal" style={{ padding: '1px 6px', fontSize: 10 }}>{reg.status}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Registration Status Banner */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '12px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Trạng thái tiến trình hiện tại:</span>
                    <Tag color={currentStatusMeta.color} style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 10px' }}>
                        {currentStatusMeta.text}
                    </Tag>
                </div>
                {isCompleted && (
                    <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
                        Đã được Viện trưởng ký Giấy xác nhận hoàn thành
                    </span>
                )}
            </div>

            {/* Grade Summary Hero Box */}
            <div className="grade-hero-box">
                <div>
                    <span
                        className="tag green"
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            marginBottom: 8,
                            display: 'inline-block',
                            letterSpacing: '0.04em',
                            fontWeight: 700,
                        }}
                    >
                        {hasScore
                            ? `KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP CHÍNH THỨC · ${semesterName.toUpperCase()}`
                            : `KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP · ${semesterName.toUpperCase()}`}
                    </span>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginTop: 4 }}>
                        {hasScore
                            ? `Kết Quả Chính Thức: ${gradeInfo.text} — Thang điểm 10`
                            : `Chờ Viện Công Bố Kết Quả Chính Thức`}
                    </h2>
                    <p style={{ fontSize: 13, opacity: 0.9, marginTop: 6, lineHeight: 1.5 }}>
                        Công thức chuẩn hóa quy chế: Điểm tổng kết đồ án tốt nghiệp là Trung bình cộng điểm của các thành viên Hội đồng bảo vệ hợp lệ (Chủ tịch, Thư ký, Phản biện).
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="grade-score-pill">
                        {compositeScore}
                    </div>
                    <div className="grade-letter">
                        {gradeInfo.letter}
                    </div>
                </div>
            </div>

            {/* Detailed Grade Composition Table & Digital Archive Submission */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 22 }}>
                {/* Left Column: Grade Composition Table */}
                <div className="card">
                    <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                            <span>Bảng Điểm Thành Phần Hội Đồng Bảo Vệ (Quy Chế Viện)</span>
                        </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 12 }}>
                                    <th style={{ padding: '10px 14px' }}>Thành viên Hội đồng</th>
                                    <th style={{ padding: '10px 14px' }}>Trọng số</th>
                                    <th style={{ padding: '10px 14px' }}>Cán bộ chấm thi</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Điểm số</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '12px 14px' }}>
                                        <strong style={{ fontSize: 13 }}>Chủ tịch Hội đồng</strong>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                            Chấm độc lập: Điều hành vấn đáp, nội dung & giải pháp kỹ thuật
                                        </div>
                                    </td>
                                    <td className="mono" style={{ padding: '12px 14px', fontWeight: 600 }}>1/3</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {chairmanMember?.lecturer?.fullName || 'Chờ phân công'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }} className="mono">
                                        <span className="tag gray" style={{ fontSize: 11 }}>Không công bố riêng lẻ</span>
                                    </td>
                                </tr>

                                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '12px 14px' }}>
                                        <strong style={{ fontSize: 13 }}>Thư ký Hội đồng</strong>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                            Chấm độc lập: Thẩm định quy chuẩn báo cáo, demo & biên bản bảo vệ
                                        </div>
                                    </td>
                                    <td className="mono" style={{ padding: '12px 14px', fontWeight: 600 }}>1/3</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {secretaryMember?.lecturer?.fullName || 'Chờ phân công'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }} className="mono">
                                        <span className="tag gray" style={{ fontSize: 11 }}>Không công bố riêng lẻ</span>
                                    </td>
                                </tr>

                                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '12px 14px' }}>
                                        <strong style={{ fontSize: 13 }}>Cán bộ Phản biện</strong>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                            Chấm độc lập: Thẩm định chuyên môn sâu, tính mới & chất lượng sản phẩm
                                        </div>
                                    </td>
                                    <td className="mono" style={{ padding: '12px 14px', fontWeight: 600 }}>1/3</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {reviewerMember?.lecturer?.fullName || 'Chờ phân công'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }} className="mono">
                                        <span className="tag gray" style={{ fontSize: 11 }}>Không công bố riêng lẻ</span>
                                    </td>
                                </tr>

                                <tr style={{ background: '#F0FDFA', fontWeight: 800 }}>
                                    <td style={{ padding: '12px 14px', color: '#0F766E' }}>ĐIỂM TRUNG BÌNH CỘNG HỘI ĐỒNG</td>
                                    <td className="mono" style={{ padding: '12px 14px' }}>100%</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {hasScore ? `Xếp loại: ${gradeInfo.text}` : 'Trạng thái: Đang theo dõi'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 15, color: '#0F766E' }} className="mono">
                                        {compositeScore !== '—' ? `${compositeScore} / 10` : '—'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Digital Archive Submission */}
                <div className="card">
                    <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                            <span>Hồ Sơ Lưu Chiểu Số & Thư Viện</span>
                        </div>
                        <span className={`tag ${archiveData?.status === 'COMPLETED' || archiveData?.reportFileUrl ? 'green' : 'teal'}`}>
                            {archiveData?.status === 'COMPLETED' ? 'Đã nghiệm thu lưu chiểu' : (archiveData?.reportFileUrl ? 'Đã nộp lưu chiểu' : 'Sẵn sàng nộp')}
                        </span>
                    </div>
                    <div className="card-body" style={{ padding: 18 }}>
                        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                            Theo quy định, sau khi chỉnh sửa theo góp ý của Hội đồng, sinh viên phải nộp 4 tài liệu lưu chiểu số (Báo cáo Word, Báo cáo PDF, Video demo, Slide thuyết trình) để được cấp Giấy xác nhận hoàn thành.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>1. Toàn văn Báo cáo (Word .docx)</span>
                                <span className={`tag ${archiveData?.dossierFiles?.some(f => f.docType === 'REPORT_WORD') || archiveData?.sourceCodeUrl ? 'green' : 'gray'}`}>
                                    {archiveData?.dossierFiles?.some(f => f.docType === 'REPORT_WORD') ? 'Đã tải lên' : 'Chưa nộp'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>2. Báo cáo đóng cuốn (PDF .pdf)</span>
                                <span className={`tag ${archiveData?.dossierFiles?.some(f => f.docType === 'REPORT_PDF') || archiveData?.reportFileUrl ? 'green' : 'gray'}`}>
                                    {archiveData?.dossierFiles?.some(f => f.docType === 'REPORT_PDF') || archiveData?.reportFileUrl ? 'Đã tải lên' : 'Chưa nộp'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>3. Video giới thiệu sản phẩm (MP4/Link)</span>
                                <span className={`tag ${archiveData?.dossierFiles?.some(f => f.docType === 'DEMO_VIDEO') || archiveData?.demoVideoUrl ? 'green' : 'gray'}`}>
                                    {archiveData?.dossierFiles?.some(f => f.docType === 'DEMO_VIDEO') || archiveData?.demoVideoUrl ? 'Đã tải lên' : 'Chưa nộp'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>4. Slide thuyết trình (PPTX .pptx)</span>
                                <span className={`tag ${archiveData?.dossierFiles?.some(f => f.docType === 'SLIDE_PPTX') ? 'green' : 'gray'}`}>
                                    {archiveData?.dossierFiles?.some(f => f.docType === 'SLIDE_PPTX') ? 'Đã tải lên' : 'Chưa nộp'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <Button
                                icon={<CloudUploadOutlined />}
                                style={{ flex: 1 }}
                                onClick={() => setArchiveModalOpen(true)}
                                disabled={isCompleted}
                            >
                                {isCompleted ? 'Hồ sơ đã khóa nghiệm thu' : 'Cập nhật hồ sơ lưu chiểu'}
                            </Button>
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                style={{ flex: 1 }}
                                onClick={handleOpenCertificate}
                                loading={certLoading}
                            >
                                Xem Giấy xác nhận hoàn thành
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official Result Publication Snapshot Card */}
            <div className="card">
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                        <span>Thông Tin Quyết Định Công Bố Kết Quả Đồ Án</span>
                    </div>
                    <span className={`tag ${isOfficialResult ? 'green' : 'teal'}`}>
                        {isOfficialResult ? 'Đã công bố chính thức' : 'Chưa công bố chính thức'}
                    </span>
                </div>
                <div className="card-body" style={{ padding: 18 }}>
                    {isOfficialResult && publishedResult ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>KẾT LUẬN HỘI ĐỒNG</div>
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`tag ${publishedResult.outcomeSnapshot === 'PASSED' ? 'green' : 'red'}`} style={{ fontSize: 12, fontWeight: 700 }}>
                                        {publishedResult.outcomeSnapshot === 'PASSED' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>ĐIỂM SỐ CHÍNH THỨC</div>
                                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: '#0F766E' }} className="mono">
                                    {Number(publishedResult.finalScoreSnapshot).toFixed(1)} / 10 ({gradeInfo.letter})
                                </div>
                            </div>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>THỜI ĐIỂM CÔNG BỐ</div>
                                <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600 }}>
                                    {publishedResult.publication?.publishedAt ? new Date(publishedResult.publication.publishedAt).toLocaleString('vi-VN') : (publishedResult.createdAt ? new Date(publishedResult.createdAt).toLocaleString('vi-VN') : '—')}
                                </div>
                            </div>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>ĐỢT CÔNG BỐ & MÃ BẢN GHI</div>
                                <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'monospace' }}>
                                    Đợt #{publishedResult.publicationId || '—'} · Mục #{publishedResult.id || '—'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>
                            <p style={{ margin: 0 }}>
                                Hồ sơ bảo vệ đang trong quy trình đánh giá hoặc chờ Viện trưởng ký phê duyệt đợt công bố kết quả.
                            </p>
                            <p style={{ margin: '6px 0 0 0', fontSize: 12 }}>
                                Dữ liệu điểm số chỉ được hiển thị chính thức sau khi ban hành quyết định công bố kết quả.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Archive Submission Modal */}
            <ArchiveSubmissionModal
                open={archiveModalOpen}
                onClose={() => setArchiveModalOpen(false)}
                registration={selectedRegistration}
                registrationId={selectedRegistration.id}
                initialData={archiveData}
                onSuccess={() => fetchArchive(selectedRegistration.id)}
            />

            {/* Clearance Certificate Modal */}
            <ClearanceCertificateModal
                open={certModalOpen}
                onClose={() => setCertModalOpen(false)}
                certificate={certificateData}
            />
        </div>
    );
}
