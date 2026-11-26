import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Tag, Tooltip, message } from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    FilePdfOutlined,
    LockOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';

import evaluationService from '../../services/evaluationService';
import archiveService from '../../services/archiveService';
import { getAssetDownloadUrl } from '../../services/resumableUploadService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useCouncilDefenses, gradingCustomKeys } from '../../queries/gradingQueries';
import QueryPanel from '../../components/common/QueryPanel';
import OutlineCouncilGradingCard from './components/OutlineCouncilGradingCard';

const COUNCIL_ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch Hội đồng',
    SECRETARY: 'Thư ký Hội đồng',
    REVIEWER: 'Ủy viên phản biện',
    MEMBER: 'Ủy viên Hội đồng',
};

const FINISHED_DEFENSE_REG_STATUSES = new Set([
    'AWAITING_FINAL_APPROVAL',
    'DEFENDED',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'COMPLETED',
]);

const isCandidateFinished = (cand) => Boolean(
    cand?.isScoreBookLocked
    || cand?.defenseResult?.scoreLocked
    || cand?.defenseResult?.isLocked
    || cand?.defenseResult?.isPublished
    || FINISHED_DEFENSE_REG_STATUSES.has(cand?.status),
);

const isUpcomingOrActiveDefenseCouncil = (council) => {
    if (!council || council.councilType === 'OUTLINE_REVIEW') return false;
    if (council.semester?.status === 'COMPLETED') return false;
    if (council.scoreBookLocked) return false;

    const candidates = council.registrations || council.candidates || [];
    if (candidates.length > 0) {
        return candidates.some((cand) => !isCandidateFinished(cand));
    }

    if (council.defenseDate) {
        return !dayjs(council.defenseDate).isBefore(dayjs(), 'day');
    }

    return true;
};

/**
 * GradingPage — 100% OpenDesign Golden Standard
 * Replicates the exact layout, DOM hierarchy, and CSS classes from lecturer-dacn-prototype.html (view-grading):
 * - Segmented tabs: Hội đồng Khóa luận (Pha 5) & Hội đồng Thẩm định Đề cương (Pha 2)
 * - Council cards with 3-member composition banner
 * - Defense candidate table with exam sessions, final scores, and grading status
 */
export default function GradingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const scope = useMemo(() => queryKeys.scope(currentUser), [currentUser]);

    const councilsQuery = useCouncilDefenses(scope);
    const councils = useMemo(
        () => (Array.isArray(councilsQuery.data) ? councilsQuery.data : []),
        [councilsQuery.data]
    );
    const [activeStage, setActiveStage] = useState('defense'); // 'defense' | 'outline'

    // Absent state
    const [absentModalVisible, setAbsentModalVisible] = useState(false);
    const [absentingReg, setAbsentingReg] = useState(null);
    const [absentMinutesText, setAbsentMinutesText] = useState('');
    const [submittingAbsent, setSubmittingAbsent] = useState(false);

    // Snapshot dossier state
    const [snapshotModalVisible, setSnapshotModalVisible] = useState(false);
    const [viewingDossier, setViewingDossier] = useState(null);
    const [dossierLoading, setDossierLoading] = useState(false);

    const refreshCouncils = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: gradingCustomKeys.councils(scope) });
    }, [queryClient, scope]);

    const handleOpenAbsentModal = (cand) => {
        setAbsentingReg(cand);
        setAbsentMinutesText(`Hội đồng xác nhận sinh viên ${cand.student?.fullName || cand.studentName} (MSSV: ${cand.student?.code || cand.studentCode}) vắng mặt không lý do vào thời điểm tổ chức bảo vệ.`);
        setAbsentModalVisible(true);
    };

    const handleConfirmMarkAbsent = async () => {
        if (!absentMinutesText.trim()) {
            message.warning('Bắt buộc nhập biên bản xác nhận vắng mặt.');
            return;
        }
        const regId = absentingReg?.registrationId || absentingReg?.id;
        if (!regId) {
            message.error('Không tìm thấy mã hồ sơ sinh viên hợp lệ.');
            return;
        }
        try {
            setSubmittingAbsent(true);
            const res = await evaluationService.markStudentAbsent(regId, {
                absentMinutesText: absentMinutesText.trim(),
            });
            if (res.success) {
                message.success('Đã lập biên bản vắng mặt thành công!');
                setAbsentModalVisible(false);
                setAbsentingReg(null);
                await refreshCouncils();
            } else {
                message.error(res.message || 'Không thể lập biên bản vắng mặt.');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi lập biên bản vắng mặt');
        } finally {
            setSubmittingAbsent(false);
        }
    };

    const handleLockScoreBook = async (cand) => {
        const regId = cand?.registrationId || cand?.id;
        if (!regId) {
            message.error('Không tìm thấy mã hồ sơ sinh viên hợp lệ.');
            return;
        }
        try {
            const res = await evaluationService.lockScoreBookByChairman(regId);
            if (res.success) {
                message.success('Đã khóa sổ điểm Hội đồng thành công!');
                await refreshCouncils();
            } else {
                message.error(res.message || 'Không thể khóa sổ điểm.');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi khóa sổ điểm Hội đồng');
        }
    };

    const handleViewDossier = async (cand) => {
        try {
            setDossierLoading(true);
            setSnapshotModalVisible(true);
            const res = await archiveService.getDefenseDossier(cand.id);
            if (res.success) {
                setViewingDossier(res.data);
            } else {
                message.error(res.message || 'Không thể tải bộ tài liệu bảo vệ');
            }
        } catch (err) {
            message.error(err.message || 'Lỗi khi tải bộ tài liệu bảo vệ');
        } finally {
            setDossierLoading(false);
        }
    };

    const defenseCouncils = useMemo(() => {
        return councils.filter((c) => isUpcomingOrActiveDefenseCouncil(c));
    }, [councils]);

    const outlineCouncils = useMemo(() => {
        return councils.filter((c) => c.councilType === 'OUTLINE_REVIEW');
    }, [councils]);

    const currentList = activeStage === 'defense' ? defenseCouncils : outlineCouncils;

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
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="segmented-tabs">
                        <div
                            className={`seg-tab ${activeStage === 'defense' ? 'active' : ''}`}
                            onClick={() => setActiveStage('defense')}
                        >
                            Hội đồng Khóa luận tốt nghiệp ({defenseCouncils.length} Hội đồng)
                        </div>
                        <div
                            className={`seg-tab ${activeStage === 'outline' ? 'active' : ''}`}
                            onClick={() => setActiveStage('outline')}
                        >
                            Hội đồng Thẩm định Đề cương ({outlineCouncils.length} Hội đồng)
                        </div>
                    </div>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={councilsQuery.isFetching}
                        onClick={() => councilsQuery.refetch()}
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* 2. Council Cards List */}
            <QueryPanel query={councilsQuery}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {currentList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                            {activeStage === 'defense'
                                ? 'Hiện chưa có hội đồng bảo vệ nào sắp diễn ra'
                                : 'Chưa có Hội đồng nào trong danh mục này'}
                        </h3>
                        <p style={{ fontSize: 13, marginTop: 4 }}>
                            {activeStage === 'defense'
                                ? 'Các hội đồng chuẩn bị có lịch bảo vệ bạn tham gia sẽ hiển thị tại đây. Các hội đồng đã hoàn tất chấm và khóa sổ sẽ tự động ẩn.'
                                : 'Phòng Đào tạo & Ban Chủ nhiệm Viện sẽ thông báo khi có quyết định phân công chính thức.'}
                        </p>
                    </div>
                ) : activeStage === 'outline' ? (
                    currentList.map((council) => (
                        <OutlineCouncilGradingCard
                            key={council.id}
                            council={council}
                            onRefreshParent={refreshCouncils}
                        />
                    ))
                ) : (
                    currentList.map((council, idx) => {
                        const members = council.members || [];
                        const chairman = members.find((m) => m.roleInCouncil === 'CHAIRMAN' || m.role === 'CHAIRMAN')?.lecturer?.fullName || 'Chưa phân công';
                        const secretary = members.find((m) => m.roleInCouncil === 'SECRETARY' || m.role === 'SECRETARY')?.lecturer?.fullName || 'Chưa phân công';
                        const reviewer = members.find((m) => m.roleInCouncil === 'REVIEWER' || m.role === 'REVIEWER')?.lecturer?.fullName || 'Chưa phân công';
                        const resolvedMyRole = council.myRole
                            || members.find((m) => m.lecturerId === currentUser?.id)?.roleInCouncil
                            || null;
                        const myRoleLabel = COUNCIL_ROLE_LABELS[resolvedMyRole] || 'Thành viên Hội đồng';

                        const candidates = council.registrations || council.candidates || [];
                        const gradedCount = candidates.filter((c) => c.defenseResult?.finalScore !== null && c.defenseResult?.finalScore !== undefined).length;

                        return (
                            <div key={council.id || idx} className="card" style={{ marginBottom: 0 }}>
                                <div className="card-head flex-wrap gap-2" style={{ background: '#F0FDFA' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="flex-wrap">
                                            <span className="card-title" style={{ color: '#0F766E' }}>
                                                {council.name || `Hội Đồng ${idx + 1}`}
                                            </span>
                                            <span className="tag teal">
                                                Vai trò: {myRoleLabel}
                                            </span>
                                        </div>
                                        <div className="card-subtitle" style={{ color: '#115E59' }}>
                                            Ngày thi: <strong>{council.defenseDate ? dayjs(council.defenseDate).format('dddd, DD/MM/YYYY') : 'Chưa xếp ngày'}</strong> · Địa điểm: <strong>{council.location || 'Chưa phân phòng'}</strong>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className="tag green">
                                            Tiến độ: {gradedCount} / {candidates.length} SV đã có điểm
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
                                                <th>Điểm trung bình khóa luận</th>
                                                <th>Trạng thái điểm</th>
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
                                                    const sCode = cand.student?.code || cand.studentCode || 'N/A';
                                                    const score = cand.defenseResult?.finalScore ?? cand.finalScore ?? null;
                                                    const hasScore = score !== null && score !== undefined;
                                                    const mentorName = cand.topic?.mentor?.fullName || cand.mentorName || 'GVHD';
                                                    const isChairman = resolvedMyRole === 'CHAIRMAN';
                                                    const isAbsent = (cand.attendanceStatus || cand.defenseResult?.attendanceStatus) === 'ABSENT';
                                                    const isLocked = Boolean(cand.isScoreBookLocked || cand.defenseResult?.scoreLocked || cand.defenseResult?.isLocked);
                                                    const lockedCount = cand.lockedScoreCount ?? (cand.memberScores?.filter((m) => m.scoreLocked || m.isLocked)?.length || 0);
                                                    const totalScorers = cand.totalScorers ?? (council.members?.filter((m) => m.isScoringMember !== false)?.length || 3);

                                                    const shiftCode = cand.defenseShift || cand.defenseSessionShift;
                                                    const shiftLabel = shiftCode === 'MORNING'
                                                        ? 'Ca Sáng (07:00–11:00)'
                                                        : shiftCode === 'AFTERNOON'
                                                        ? 'Ca Chiều (13:00–17:00)'
                                                        : 'Chưa xếp ca';
                                                    const orderNum = cand.orderInShift || cand.defenseOrderInShift;
                                                    const orderLabel = orderNum ? `#${orderNum}` : `#${cIdx + 1}`;

                                                    return (
                                                        <tr key={cand.id || cIdx}>
                                                            <td className="mono" style={{ fontSize: 12 }}>
                                                                <div className="font-bold text-slate-800">{shiftLabel}</div>
                                                                <div className="text-xs text-slate-500 font-semibold">{orderLabel}</div>
                                                                <Button
                                                                    size="small"
                                                                    type="link"
                                                                    icon={<EyeOutlined />}
                                                                    onClick={() => handleViewDossier(cand)}
                                                                    className="p-0 text-xs text-teal-700 mt-1"
                                                                >
                                                                    Tài liệu 00:00
                                                                </Button>
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
                                                                {isAbsent ? (
                                                                    <Tag color="error" className="font-bold">
                                                                        VẮNG MẶT
                                                                    </Tag>
                                                                ) : hasScore ? (
                                                                    <strong className="mono" style={{ color: 'var(--primary)', fontSize: 14 }}>
                                                                        {Number(score).toFixed(1)} / 10
                                                                    </strong>
                                                                ) : (
                                                                    <strong className="mono" style={{ color: 'var(--warning)', fontSize: 13 }}>
                                                                        Đang chấm
                                                                    </strong>
                                                                )}
                                                                <div className="text-[11px] text-slate-500 mt-1">
                                                                    Đã khóa: <strong>{lockedCount} / {totalScorers}</strong> phiếu
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {isAbsent ? (
                                                                    <Tag color="error">Đã xác nhận vắng</Tag>
                                                                ) : (
                                                                    <span className={`tag ${isLocked ? 'green' : 'yellow'}`}>
                                                                        {isLocked ? 'Đã khóa sổ điểm' : 'Chờ hoàn tất phiếu'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    {!isAbsent && (
                                                                        <Button
                                                                            size="small"
                                                                            type={hasScore ? 'default' : 'primary'}
                                                                            onClick={() => navigate(`/lecturer/grading/sheet/${cand.id}`)}
                                                                        >
                                                                            {hasScore ? 'Xem phiếu chấm' : 'Vào chấm điểm'}
                                                                        </Button>
                                                                    )}
                                                                    {isChairman && !isAbsent && !isLocked && (
                                                                        <Button
                                                                            size="small"
                                                                            danger
                                                                            icon={<CloseCircleOutlined />}
                                                                            onClick={() => handleOpenAbsentModal(cand)}
                                                                        >
                                                                            Biên bản vắng mặt
                                                                        </Button>
                                                                    )}
                                                                    {isChairman && !isLocked && (
                                                                        <Button
                                                                            size="small"
                                                                            type="primary"
                                                                            icon={<LockOutlined />}
                                                                            onClick={() => handleLockScoreBook(cand)}
                                                                            disabled={isAbsent ? !(cand.defenseResult?.absentMinutesText || cand.absentMinutesText) : lockedCount < totalScorers}
                                                                            className="bg-amber-600 hover:bg-amber-700"
                                                                        >
                                                                            Khóa sổ điểm
                                                                        </Button>
                                                                    )}
                                                                </div>
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
            </QueryPanel>

            {/* Modal Lập Biên Bản Vắng Mặt */}
            <Modal
                title={`Lập Biên bản Xác nhận Vắng mặt cho SV ${absentingReg?.student?.fullName || absentingReg?.studentName || ''}`}
                open={absentModalVisible}
                onOk={handleConfirmMarkAbsent}
                onCancel={() => {
                    setAbsentModalVisible(false);
                    setAbsentingReg(null);
                }}
                confirmLoading={submittingAbsent}
                okText="Xác nhận vắng mặt"
                okButtonProps={{ danger: true }}
                destroyOnHidden
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-600">
                        Xác nhận sinh viên vắng mặt trong buổi bảo vệ. Hệ thống sẽ ghi nhận trạng thái ABSENT, hủy các phiếu chấm nháp và cho phép Chủ tịch khóa sổ điểm không cần phiếu của các thành viên.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Nội dung biên bản xác nhận <span className="text-rose-500">*</span>
                        </label>
                        <Input.TextArea
                            rows={4}
                            value={absentMinutesText}
                            onChange={(e) => setAbsentMinutesText(e.target.value)}
                            placeholder="Nhập nội dung biên bản vắng mặt..."
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal Xem Bộ Tài Liệu Bảo Vệ Snapshot 00:00 */}
            <Modal
                title="Hồ sơ Tài liệu Bảo vệ (Snapshot lúc 00:00)"
                open={snapshotModalVisible}
                onCancel={() => {
                    setSnapshotModalVisible(false);
                    setViewingDossier(null);
                }}
                footer={[
                    <Button key="close" onClick={() => setSnapshotModalVisible(false)}>
                        Đóng
                    </Button>,
                ]}
                width={700}
                destroyOnHidden
            >
                {dossierLoading ? (
                    <div className="p-8 text-center">Đang tải hồ sơ...</div>
                ) : viewingDossier ? (
                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                            <div className="font-bold text-teal-900 text-sm">
                                {viewingDossier.topic?.title || 'Đề tài tốt nghiệp'}
                            </div>
                            <div className="text-teal-700 mt-1">
                                Sinh viên: <strong>{viewingDossier.student?.fullName}</strong> ({viewingDossier.student?.code})
                            </div>
                        </div>

                        <div className="font-bold text-slate-800 text-sm">Các tài liệu đính kèm:</div>
                        <div className="space-y-2">
                            {viewingDossier.documents?.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded">
                                    <div>
                                        <span className="font-bold text-slate-800">{doc.documentType}: </span>
                                        <span className="text-slate-600">{doc.fileName || doc.fileUrl}</span>
                                    </div>
                                    {(doc.assetId || doc.fileUrl) && (
                                        <Button
                                            size="small"
                                            type="link"
                                            icon={<FilePdfOutlined />}
                                            onClick={async () => {
                                                if (doc.assetId) {
                                                    try {
                                                        const dl = await getAssetDownloadUrl(doc.assetId);
                                                        window.open(dl.downloadUrl || dl.url, '_blank');
                                                        return;
                                                    } catch (err) {
                                                        console.error('Failed to get asset download url:', err);
                                                    }
                                                }
                                                if (doc.fileUrl) {
                                                    window.open(doc.fileUrl, '_blank');
                                                }
                                            }}
                                        >
                                            Xem tài liệu
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-center text-slate-500">Chưa có tài liệu snapshot.</div>
                )}
            </Modal>
        </section>
    );
}
