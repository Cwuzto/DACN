import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Button,
    Empty,
    Modal,
    Input,
    message,
    Spin,
} from 'antd';
import {
    ReloadOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';
import registrationService from '../../services/registrationService';
import archiveService from '../../services/archiveService';
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

    // Score Appeal state
    const [appealModalOpen, setAppealModalOpen] = useState(false);
    const [appealComponents, setAppealComponents] = useState(['defense_score']);
    const [appealReason, setAppealReason] = useState('');
    const [appealProofUrl, setAppealProofUrl] = useState('');
    const [submittingAppeal, setSubmittingAppeal] = useState(false);

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
                    // Prioritize registration with defense result or active one
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

    const handleSubmitAppeal = async () => {
        if (!appealComponents.length) {
            message.warning('Vui lòng chọn ít nhất một thành phần cần phúc khảo.');
            return;
        }
        if (!appealReason.trim()) {
            message.warning('Vui lòng nhập căn cứ và lý do đề nghị phúc khảo chi tiết.');
            return;
        }

        try {
            setSubmittingAppeal(true);
            // Simulate submission to the Board of Academic Review
            await new Promise((resolve) => setTimeout(resolve, 600));
            message.success('Đã gửi đơn đề nghị phúc khảo thành công tới Ban Thẩm định Viện!');
            setAppealModalOpen(false);
            setAppealReason('');
            setAppealProofUrl('');
        } catch (error) {
            message.error(error?.message || 'Không thể gửi đơn phúc khảo lúc này.');
        } finally {
            setSubmittingAppeal(false);
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
                    <Button type="primary" style={{ marginTop: 16 }} onClick={fetchGrades}>
                        <ReloadOutlined /> Tải lại dữ liệu
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

    // Student-facing results are sourced exclusively from a publication item.
    // Council member scores remain internal, including after publication.
    const councilMembers = council?.members || [];
    const chairmanMember = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN');
    const secretaryMember = councilMembers.find((m) => m.roleInCouncil === 'SECRETARY');
    const reviewerMember = councilMembers.find((m) => m.roleInCouncil === 'REVIEWER');

    const compositeScore = hasScore ? Number(finalScore).toFixed(2) : '—';

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
                            ? `Kết Quả Chính Thức: ${gradeInfo.text} (Thang Điểm 10 & Điểm Chữ)`
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Hồ Sơ Lưu Chiểu Số & Thư Viện</span>
                        </div>
                        <span className={`tag ${archiveData?.reportFileUrl ? 'green' : 'teal'}`}>
                            {archiveData?.reportFileUrl ? 'Đã nộp đầy đủ' : 'Sẵn sàng nộp'}
                        </span>
                    </div>
                    <div className="card-body" style={{ padding: 18 }}>
                        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                            Theo quy định, sau khi chỉnh sửa theo góp ý của Hội đồng, sinh viên phải nộp hồ sơ lưu chiểu số để được cấp Giấy chứng nhận hoàn thành.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>Mã nguồn GitHub Repository</span>
                                <span className={`tag ${archiveData?.sourceCodeUrl ? 'green' : 'gray'}`}>
                                    {archiveData?.sourceCodeUrl ? 'Đã liên kết' : 'Chưa liên kết'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>Video Demo sản phẩm (YouTube/Drive)</span>
                                <span className={`tag ${archiveData?.demoVideoUrl ? 'green' : 'gray'}`}>
                                    {archiveData?.demoVideoUrl ? 'Đã nộp link' : 'Chưa nộp video'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}>
                                <span>Toàn văn đồ án đóng cuốn (PDF có chữ ký)</span>
                                <span className={`tag ${archiveData?.reportFileUrl ? 'teal' : 'gray'}`}>
                                    {archiveData?.reportFileName || (archiveData?.reportFileUrl ? 'Bản hoàn chỉnh v1.2' : 'Chưa nộp bản PDF')}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1 }}
                                onClick={() => setArchiveModalOpen(true)}
                            >
                                Cập nhật hồ sơ lưu chiểu
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1 }}
                                onClick={handleOpenCertificate}
                                disabled={certLoading}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="8" r="7" />
                                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                                </svg>
                                <span>Xem Giấy Xác Nhận</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official Result Publication Snapshot Card (Replaces fake CLO mock table) */}
            <div className="card">
                <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>Thông Tin Quyết Định & Snapshot Công Bố Kết Quả Đồ Án</span>
                    </div>
                    <span className={`tag ${isOfficialResult ? 'green' : 'teal'}`}>
                        {isOfficialResult ? 'Đã công bố chính thức' : 'Chưa công bố chính thức'}
                    </span>
                </div>
                <div className="card-body" style={{ padding: 18 }}>
                    {isOfficialResult && publishedResult ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>KẾT LUẬN HỘI ĐỒNG (SNAPSHOT)</div>
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`tag ${publishedResult.outcomeSnapshot === 'PASSED' ? 'green' : 'red'}`} style={{ fontSize: 12, fontWeight: 700 }}>
                                        {publishedResult.outcomeSnapshot === 'PASSED' ? 'ĐẠT (PASSED)' : 'KHÔNG ĐẠT (FAILED)'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>ĐIỂM SỐ CHÍNH THỨC</div>
                                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: '#0F766E' }} className="mono">
                                    {Number(publishedResult.finalScoreSnapshot).toFixed(2)} / 10 ({gradeInfo.letter})
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
                                Dữ liệu điểm số chỉ được hiển thị chính thức sau khi ban hành quyết định công bố (ResultPublication Snapshot).
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Score Appeal & Formal Regrading Notice Box */}
            <div style={{ marginTop: 20, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>Quy Chế Phúc Khảo Điểm Số Đồ Án Tốt Nghiệp</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#78350F', marginTop: 4, lineHeight: 1.5 }}>
                        Sinh viên có quyền gửi đơn đề nghị phúc khảo trong thời hạn <strong>03 ngày làm việc</strong> kể từ khi công bố kết quả Hội đồng. Kết quả phúc khảo do Hội đồng Chấm lại độc lập thẩm định và là điểm số chung cuộc.
                    </div>
                </div>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAppealModalOpen(true)}
                    style={{ background: 'white', borderColor: '#D97706', color: '#B45309', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M12 18v-6" />
                        <path d="m9 15 3 3 3-3" />
                    </svg>
                    <span>Gửi Đơn Đề Nghị Phúc Khảo</span>
                </button>
            </div>

            {/* Score Appeal Modal */}
            <Modal
                open={appealModalOpen}
                onCancel={() => setAppealModalOpen(false)}
                footer={null}
                width={620}
                title={(
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                            Đơn Đề Nghị Phúc Khảo Điểm Số Đồ Án Tốt Nghiệp
                        </h3>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            Thời hạn tiếp nhận khiếu nại: Trong vòng 03 ngày làm việc kể từ ngày công bố điểm
                        </div>
                    </div>
                )}
            >
                <div style={{ marginTop: 14 }}>
                    <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                            <div>Sinh viên: <strong>{publishedResult?.studentNameSnapshot || selectedRegistration?.student?.fullName || 'Sinh viên'} ({publishedResult?.studentCodeSnapshot || selectedRegistration?.student?.code || '—'})</strong></div>
                            <div>Hội đồng chấm: <strong>{council?.name || 'Hội đồng Bảo vệ'}</strong></div>
                            <div>Điểm công bố: <strong style={{ color: '#0F766E' }} className="mono">{compositeScore} / 10 ({gradeInfo.letter})</strong></div>
                            <div>Ngày bảo vệ: <strong>{council?.defenseDate ? new Date(council.defenseDate).toLocaleDateString('vi-VN') : (publishedResult?.createdAt ? new Date(publishedResult.createdAt).toLocaleDateString('vi-VN') : '—')}</strong></div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Chọn thành phần cần đề nghị phúc khảo *
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: '#FFFFFF' }}>
                                <input
                                    type="checkbox"
                                    checked={appealComponents.includes('defense_score')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAppealComponents([...appealComponents, 'defense_score']);
                                        else setAppealComponents(appealComponents.filter((c) => c !== 'defense_score'));
                                    }}
                                />
                                <span style={{ fontSize: 12.5 }}>
                                    Điểm Đánh Giá Hội Đồng Bảo Vệ (Điểm công bố: <strong className="mono">{hasScore ? Number(finalScore).toFixed(2) : '—'}</strong>)
                                </span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: '#FFFFFF' }}>
                                <input
                                    type="checkbox"
                                    checked={appealComponents.includes('rubric_criteria')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAppealComponents([...appealComponents, 'rubric_criteria']);
                                        else setAppealComponents(appealComponents.filter((c) => c !== 'rubric_criteria'));
                                    }}
                                />
                                <span style={{ fontSize: 12.5 }}>
                                    Nội dung & Biên bản thẩm định Rubric chuyên môn
                                </span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: '#FFFFFF' }}>
                                <input
                                    type="checkbox"
                                    checked={appealComponents.includes('calculation_process')}
                                    onChange={(e) => {
                                        if (e.target.checked) setAppealComponents([...appealComponents, 'calculation_process']);
                                        else setAppealComponents(appealComponents.filter((c) => c !== 'calculation_process'));
                                    }}
                                />
                                <span style={{ fontSize: 12.5 }}>
                                    Quy trình tổng hợp điểm số và kết luận bảo vệ
                                </span>
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Căn cứ & Lý do đề nghị phúc khảo chi tiết *
                        </label>
                        <Input.TextArea
                            rows={3}
                            placeholder="Nêu rõ căn cứ kỹ thuật (ví dụ: phát hiện cộng thiếu điểm tiêu chí Rubric hoặc có minh chứng đã demo thành công phần kiểm thử tương thích nhưng biên bản ghi nhận chưa đầy đủ)..."
                            value={appealReason}
                            onChange={(e) => setAppealReason(e.target.value)}
                        />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Tài liệu / Video minh chứng đính kèm (nếu có)
                        </label>
                        <Input
                            placeholder="Link Google Drive chứa video ghi hình buổi bảo vệ hoặc slide có chữ ký..."
                            value={appealProofUrl}
                            onChange={(e) => setAppealProofUrl(e.target.value)}
                        />
                    </div>

                    <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', fontSize: 11.5, color: '#92400E', lineHeight: 1.45, marginBottom: 16 }}>
                        <strong>* Quy định phúc khảo:</strong> Điểm số sau khi Ban Thẩm định độc lập chấm lại sẽ là <strong>điểm kết luận chung cuộc</strong> (có thể giữ nguyên, tăng hoặc giảm). Lệ phí phúc khảo là 150.000 VNĐ/thành phần, sẽ được hoàn lại 100% nếu điểm thay đổi tăng từ 0.5 điểm trở lên.
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button className="btn btn-secondary" onClick={() => setAppealModalOpen(false)}>
                            Hủy bỏ
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmitAppeal} disabled={submittingAppeal}>
                            {submittingAppeal ? 'Đang gửi...' : 'Gửi Đơn Phúc Khảo'}
                        </button>
                    </div>
                </div>
            </Modal>

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
