import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import dayjs from 'dayjs';

import evaluationService from '../../services/evaluationService';
import PageLoader from '../../components/common/PageLoader';

/**
 * GradingPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html (view-grading):
 * - Segmented tabs: Hội đồng Khóa luận (Pha 5) & Hội đồng Thẩm định Đề cương (Pha 2)
 * - Council cards with 3-member composition banner
 * - Defense candidate table with exam sessions, final scores, and grading status
 */
export default function GradingPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [councils, setCouncils] = useState([]);
    const [activeStage, setActiveStage] = useState('defense'); // 'defense' | 'outline'

    const fetchDefenseData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await evaluationService.getMyCouncilDefenses();
            if (res.success && Array.isArray(res.data)) {
                setCouncils(res.data);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải danh sách Hội đồng');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDefenseData();
    }, [fetchDefenseData]);

    const defenseCouncils = useMemo(() => {
        return councils.filter((c) => c.councilType !== 'OUTLINE_REVIEW');
    }, [councils]);

    const outlineCouncils = useMemo(() => {
        return councils.filter((c) => c.councilType === 'OUTLINE_REVIEW');
    }, [councils]);

    const currentList = activeStage === 'defense' ? defenseCouncils : outlineCouncils;

    if (loading) {
        return <PageLoader />;
    }

    return (
        <section id="view-grading" className="view-pane active" style={{ display: 'block' }}>
            {/* 1. Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="flex-wrap gap-4">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Hội Đồng Chấm Bảo Vệ Khóa Luận
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Danh sách các hội đồng bạn được phân công tham gia đánh giá học thuật.
                    </p>
                </div>
                <div className="segmented-tabs">
                    <div
                        className={`seg-tab ${activeStage === 'defense' ? 'active' : ''}`}
                        onClick={() => setActiveStage('defense')}
                    >
                        Hội đồng Khóa luận (Pha 5 · {defenseCouncils.length} HĐ)
                    </div>
                    <div
                        className={`seg-tab ${activeStage === 'outline' ? 'active' : ''}`}
                        onClick={() => setActiveStage('outline')}
                    >
                        Hội đồng Thẩm định Đề cương (Pha 2 · {outlineCouncils.length} HĐ)
                    </div>
                </div>
            </div>

            {/* 2. Council Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {currentList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                            Chưa có Hội đồng nào trong danh mục này
                        </h3>
                        <p style={{ fontSize: 13, marginTop: 4 }}>
                            Phòng Đào tạo & Ban Chủ nhiệm Viện sẽ thông báo khi có quyết định phân công chính thức.
                        </p>
                    </div>
                ) : (
                    currentList.map((council, idx) => {
                        const members = council.members || [];
                        const chairman = members.find((m) => m.role === 'CHAIRMAN')?.lecturer?.fullName || 'PGS.TS Lê Quang Dũng';
                        const secretary = members.find((m) => m.role === 'SECRETARY')?.lecturer?.fullName || 'TS. Hoàng Văn Tuấn';
                        const reviewer = members.find((m) => m.role === 'REVIEWER')?.lecturer?.fullName || 'TS. Trần Minh Khoa';

                        const candidates = council.registrations || council.candidates || [];
                        const gradedCount = candidates.filter((c) => c.defenseResult?.finalScore !== null && c.defenseResult?.finalScore !== undefined).length;

                        return (
                            <div key={council.id || idx} className="card" style={{ marginBottom: 0 }}>
                                <div className="card-head flex-wrap gap-2" style={{ background: '#F0FDFA' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="flex-wrap">
                                            <span className="card-title" style={{ color: '#0F766E' }}>
                                                {council.name || `Hội Đồng ${idx + 1}: Công Nghệ Phần Mềm & AI`}
                                            </span>
                                            <span className="tag teal">
                                                Vai trò: {council.myRole || 'Thành viên Hội đồng'}
                                            </span>
                                        </div>
                                        <div className="card-subtitle" style={{ color: '#115E59' }}>
                                            Ngày thi: <strong>{council.defenseDate ? dayjs(council.defenseDate).format('dddd, DD/MM/YYYY') : 'Thứ Sáu, 24/10/2026'}</strong> · Ca Sáng (08:00 - 11:30) · Địa điểm: <strong>{council.location || 'Phòng 402, Tòa H1'}</strong>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className="tag green">
                                            Tiến độ: {gradedCount} / {candidates.length || 4} SV đã có điểm
                                        </span>
                                    </div>
                                </div>

                                <div style={{ padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                                    <strong>Cơ cấu Hội đồng 3 thành viên:</strong> Chủ tịch: <strong>{chairman}</strong> · Thư ký: <strong>{secretary}</strong> · UV Phản biện: <strong>{reviewer}</strong>
                                </div>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Ca thi</th>
                                                <th>Sinh viên bảo vệ</th>
                                                <th>Tên Đề tài Khóa luận</th>
                                                <th>Giảng viên HD</th>
                                                <th>Điểm TB Khóa luận</th>
                                                <th>Trạng thái Điểm</th>
                                                <th style={{ textAlign: 'right' }}>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidates.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)' }}>
                                                        Danh sách ca thi đang được Phòng Đào tạo sắp xếp.
                                                    </td>
                                                </tr>
                                            ) : (
                                                candidates.map((cand, cIdx) => {
                                                    const sName = cand.student?.fullName || cand.studentName || 'Sinh viên';
                                                    const sCode = cand.student?.code || cand.studentCode || '21110000';
                                                    const score = cand.defenseResult?.finalScore ?? cand.finalScore ?? null;
                                                    const hasScore = score !== null && score !== undefined;
                                                    const mentorName = cand.topic?.mentor?.fullName || cand.mentorName || 'GVHD';

                                                    const sessionTimes = [
                                                        '08:00 - 08:45',
                                                        '08:45 - 09:30',
                                                        '09:45 - 10:30',
                                                        '10:30 - 11:15',
                                                    ];

                                                    return (
                                                        <tr key={cand.id || cIdx}>
                                                            <td className="mono" style={{ fontSize: 12 }}>
                                                                {sessionTimes[cIdx % 4]}
                                                            </td>
                                                            <td>
                                                                <strong>{sName}</strong>
                                                                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                                    {sCode}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div style={{ fontWeight: 600 }}>{cand.topic?.title || 'Đề tài tốt nghiệp'}</div>
                                                                {cand.topic?.code && (
                                                                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                                        {cand.topic.code}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>{mentorName}</td>
                                                            <td>
                                                                {hasScore ? (
                                                                    <strong className="mono" style={{ color: 'var(--primary)', fontSize: 14 }}>
                                                                        {Number(score).toFixed(2)} / 10
                                                                    </strong>
                                                                ) : (
                                                                    <strong className="mono" style={{ color: 'var(--warning)', fontSize: 13 }}>
                                                                        Đang chấm
                                                                    </strong>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`tag ${hasScore ? 'green' : 'yellow'}`}>
                                                                    {hasScore ? 'Đã chốt sổ điểm' : 'Chờ nhập điểm'}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <button
                                                                    type="button"
                                                                    className={`btn ${hasScore ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                                                    onClick={() => navigate(`/lecturer/grading/${cand.id}`)}
                                                                >
                                                                    {hasScore ? 'Xem phiếu chấm' : 'Vào chấm điểm →'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}
