import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Tag, message, Popconfirm } from 'antd';
import {
    ArrowLeftOutlined,
    BulbOutlined,
    QuestionCircleOutlined,
    CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import evaluationService from '../../services/evaluationService';
import aiService from '../../services/aiService';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useScoreSheet, useScoreSheetMutation } from '../../queries/gradingQueries';
import QueryPanel from '../../components/common/QueryPanel';

const ROLE_LABELS = {
    CHAIRMAN: 'Chủ tịch',
    SECRETARY: 'Thư ký',
    REVIEWER: 'Ủy viên phản biện',
    MEMBER: 'Ủy viên',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const LEVEL_CONFIG = {
    FOUNDATION: {
        label: 'Kiến thức nền tảng',
        color: 'blue',
    },
    TECHNICAL_CHALLENGE: {
        label: 'Thách thức kỹ thuật',
        color: 'orange',
    },
    FUTURE_EXPANSION: {
        label: 'Hướng phát triển & Ứng dụng',
        color: 'purple',
    },
};

const getGradeClassification = (score) => {
    if (score >= 9.0) return { label: 'XUẤT SẮC (A+)', color: 'var(--success)' };
    if (score >= 8.5) return { label: 'GIỎI (A)', color: '#0F766E' };
    if (score >= 8.0) return { label: 'KHÁ GIỎI (B+)', color: 'var(--accent)' };
    if (score >= 7.0) return { label: 'KHÁ (B)', color: 'var(--accent)' };
    if (score >= 6.0) return { label: 'TRUNG BÌNH KHÁ (C+)', color: 'var(--warning)' };
    if (score >= 5.0) return { label: 'TRUNG BÌNH (C)', color: 'var(--warning)' };
    if (score >= 4.0) return { label: 'YẾU (D)', color: '#EA580C' };
    return { label: 'KÉM / KHÔNG ĐẠT (F)', color: 'var(--danger)' };
};

export default function LecturerGradingSheetPage() {
    const { registrationId } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((s) => s.user);
    const scope = useMemo(() => queryKeys.scope(currentUser), [currentUser]);

    const scoreSheetQuery = useScoreSheet(scope, registrationId);
    const scoreSheetMutation = useScoreSheetMutation(scope, registrationId);

    const [saving, setSaving] = useState(false);
    const [locking, setLocking] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [scoreLocked, setScoreLocked] = useState(false);
    const [registration, setRegistration] = useState(null);
    const [currentEvaluator, setCurrentEvaluator] = useState(null);
    const [rubricInfo, setRubricInfo] = useState(null);
    const [categories, setCategories] = useState([]);
    const [scoresMap, setScoresMap] = useState({});
    const [commentsMap, setCommentsMap] = useState({});
    const [generalComment, setGeneralComment] = useState('');
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
    const [aiQuestionsLoading, setAiQuestionsLoading] = useState(false);
    const [defenseQuestions, setDefenseQuestions] = useState([]);

    const initializedRef = useRef(false);

    useEffect(() => {
        initializedRef.current = false;
    }, [registrationId]);

    useEffect(() => {
        if (!scoreSheetQuery.data) return;
        if (initializedRef.current) return;
        initializedRef.current = true;

        const payload = scoreSheetQuery.data;
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

        let rawCategories = rubric.categories || [];
        if (!rawCategories.length && rubric.criteria?.length) {
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
    }, [scoreSheetQuery.data]);

    const allCriteria = useMemo(() => {
        return categories.flatMap((cat) => cat.criteria || []);
    }, [categories]);

    const handleScoreChange = (criterionCode, value, maxScore) => {
        if (scoreLocked) return;
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

    const handleCommentChange = (criterionCode, value) => {
        if (scoreLocked) return;
        setCommentsMap((prev) => ({ ...prev, [criterionCode]: value }));
    };

    const totalScore = useMemo(() => {
        const sum = allCriteria.reduce((acc, cri) => {
            const val = scoresMap[cri.code];
            return acc + (Number.isFinite(Number(val)) ? Number(val) : 0);
        }, 0);
        return round2(sum);
    }, [allCriteria, scoresMap]);

    const isCompleted = useMemo(() => {
        if (!allCriteria.length) return false;
        return allCriteria.every((cri) => {
            const val = scoresMap[cri.code];
            return val !== null && val !== undefined && Number.isFinite(Number(val));
        });
    }, [allCriteria, scoresMap]);

    const gradeInfo = useMemo(() => getGradeClassification(totalScore), [totalScore]);

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

            await scoreSheetMutation.mutateAsync({
                action: 'saveScoreSheet',
                args: [registrationId, payload],
            });
            message.success('Đã lưu điểm đánh giá (' + totalScore + 'đ) và ký số biên bản điện tử thành công!');
        } catch (e) {
            message.error(e.message || 'Lưu phiếu chấm thất bại');
        } finally {
            setSaving(false);
        }
    };

    const handleLockMemberScore = async () => {
        if (!isCompleted) {
            message.warning('Vui lòng nhập đầy đủ điểm cho tất cả các tiêu chí trong barem trước khi khóa.');
            return;
        }

        try {
            setLocking(true);
            const payload = {
                registrationId: Number(registrationId),
                scores: allCriteria.map((cri) => ({
                    criterionCode: cri.code,
                    score: Number(scoresMap[cri.code] || 0),
                    comment: commentsMap[cri.code] || null,
                })),
                generalComment: generalComment ? generalComment.trim() : '',
                targetRubricVersion: rubricInfo?.version || 'v1',
            };

            await scoreSheetMutation.mutateAsync({
                action: 'lockMemberScoreSheet',
                args: [payload],
            });
            setScoreLocked(true);
            message.success('Đã nộp và khóa phiếu chấm cá nhân thành công!');
        } catch (e) {
            message.error(e.message || 'Khóa phiếu chấm thất bại');
        } finally {
            setLocking(false);
        }
    };

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

    const handleGenerateFeedback = async () => {
        try {
            setAiFeedbackLoading(true);
            const scoresObj = {};
            allCriteria.forEach((c) => {
                if (scoresMap[c.code] !== null && scoresMap[c.code] !== undefined) {
                    scoresObj[c.code] = scoresMap[c.code];
                }
            });
            scoresObj.totalScore = totalScore;
            scoresObj.gradeClassification = gradeInfo.label;

            const res = await aiService.generateFeedback({
                contextType: 'DEFENSE',
                topicTitle: registration?.topic?.title,
                studentName: registration?.student?.fullName,
                scores: scoresObj,
                notes: generalComment,
            });

            const feedbackText = res?.data?.feedback || res?.feedback || (typeof res?.data === 'string' ? res?.data : '');
            if (feedbackText) {
                setGeneralComment(feedbackText);
                message.success('AI đã gợi ý nhận xét thành công!');
            } else {
                message.warning('Không nhận được gợi ý nhận xét từ AI.');
            }
        } catch (error) {
            message.error(error.message || 'Không thể tạo gợi ý nhận xét với AI');
        } finally {
            setAiFeedbackLoading(false);
        }
    };

    const handleGenerateQuestions = async () => {
        try {
            setAiQuestionsLoading(true);
            const res = await aiService.generateDefenseQuestions({
                topicTitle: registration?.topic?.title || 'Đồ án tốt nghiệp',
                description: registration?.topic?.description || '',
                technologies: registration?.topic?.technology || '',
                major: registration?.student?.major || 'Công nghệ thông tin',
            });

            const questions = res?.data?.questions || res?.questions || [];
            if (Array.isArray(questions) && questions.length > 0) {
                setDefenseQuestions(questions);
                message.success('Đã tạo bộ câu hỏi phản biện AI thành công!');
            } else {
                message.warning('Không nhận được danh sách câu hỏi từ AI.');
            }
        } catch (error) {
            message.error(error.message || 'Không thể tạo câu hỏi phản biện với AI');
        } finally {
            setAiQuestionsLoading(false);
        }
    };

    const copyQuestion = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        message.success('Đã sao chép câu hỏi vào clipboard!');
    };

    return (
        <QueryPanel query={scoreSheetQuery}>
            <section id="view-grading-sheet" className="view-pane active">
            {/* Top Back Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/lecturer/grading')}
                >
                    Quay lại danh sách Hội đồng
                </Button>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsPrintModalOpen(true)}
                        type="button"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        In Phiếu Chấm Cá Nhân
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleExportPdf}
                        disabled={exporting}
                        type="button"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        {exporting ? 'Đang xuất PDF...' : 'Xuất PDF'}
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleSave}
                        disabled={saving || scoreLocked}
                        type="button"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        {saving ? 'Đang lưu...' : 'Lưu Điểm Nháp'}
                    </button>
                    <Popconfirm
                        title="Khóa phiếu chấm cá nhân"
                        description="Sau khi khóa phiếu, điểm số cá nhân của bạn sẽ được chốt và nộp vào hội đồng. Bạn sẽ không thể chỉnh sửa thêm. Bạn có chắc chắn muốn nộp và khóa phiếu?"
                        onConfirm={handleLockMemberScore}
                        okText="Xác nhận khóa"
                        cancelText="Hủy"
                        disabled={scoreLocked || !isCompleted || locking}
                    >
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={scoreLocked || !isCompleted || locking}
                            type="button"
                            title={!isCompleted ? 'Vui lòng chấm đủ tất cả các tiêu chí trước khi khóa' : undefined}
                            style={{ background: scoreLocked ? undefined : '#0F766E', borderColor: scoreLocked ? undefined : '#0F766E' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            {locking ? 'Đang khóa...' : 'Nộp & Khóa phiếu cá nhân'}
                        </button>
                    </Popconfirm>
                </div>
            </div>

            {/* Locked Warning */}
            {scoreLocked && (
                <div style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#B45309'
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <div>
                        <strong>Đã nộp và khóa phiếu chấm cá nhân:</strong> Điểm số đã nộp vào biên bản Hội đồng và không thể thay đổi trực tiếp.
                    </div>
                </div>
            )}

            {/* Student & Topic Banner */}
            <div className="card" style={{ background: 'white', borderLeft: '4px solid var(--primary)', marginBottom: 20 }}>
                <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: 18, margin: 0 }} id="sheet-student-name">
                                {registration?.student?.fullName || 'Sinh viên'}
                            </h2>
                            <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }} id="sheet-student-mssv">
                                MSSV: {registration?.student?.code || '—'}
                            </span>
                            <span className="tag blue">
                                {registration?.council?.name || 'Hội đồng Bảo vệ'} · {registration?.council?.defenseLocation || 'Phòng P.402'}
                            </span>
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)', marginTop: 4 }} id="sheet-topic-title">
                            {registration?.topic?.title || 'Chưa có tên đề tài'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            Vai trò của bạn: <strong style={{ color: 'var(--primary)' }}>{ROLE_LABELS[currentEvaluator?.roleInCouncil] || currentEvaluator?.roleInCouncil || 'Thành viên'}</strong>
                            {registration?.topic?.mentor?.fullName && (
                                <span> · Giảng viên hướng dẫn: <strong>{registration.topic.mentor.fullName}</strong></span>
                            )}
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', background: '#F0FDFA', padding: '10px 18px', borderRadius: 'var(--radius)', border: '1px solid #CCFBF1', minWidth: 160 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0F766E', textTransform: 'uppercase' }}>Tổng Điểm Đánh Giá</div>
                        <div className="mono" style={{ fontSize: 28, fontWeight: 900, color: '#0F766E' }} id="sheet-total-score">
                            {totalScore.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: gradeInfo.color }} id="sheet-grade-text">
                            XẾP LOẠI: {gradeInfo.label}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tiêu Chí Đánh Giá Khóa Luận */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <div className="card-title">Phiếu Đánh Giá Điểm Bảo Vệ Theo Tiêu Chí</div>
                        <div className="card-subtitle">Kéo thanh trượt hoặc nhập điểm trực tiếp cho từng tiêu chí thành phần</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="tag teal" id="rubric-total-scale-tag">
                            Thang điểm chuẩn Viện: {rubricInfo?.totalMaxScore || 10.0}đ
                        </span>
                        <span className="tag" style={{ background: '#F8FAFC', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Tiêu chí chuẩn do Quản trị viên ban hành
                        </span>
                    </div>
                </div>

                <div style={{ padding: 20 }}>
                    <div id="rubric-groups-container">
                        {categories.map((group, gIdx) => {
                            const groupCriteria = group.criteria || [];
                            const groupMax = groupCriteria.reduce((sum, c) => sum + (parseFloat(c.maxScore) || 0), 0);
                            const groupScore = groupCriteria.reduce((sum, c) => sum + (parseFloat(scoresMap[c.code]) || 0), 0);

                            return (
                                <div className="rubric-group" key={group.code || gIdx}>
                                    <div className="rubric-group-title">
                                        <span>{group.name} — Tối đa {groupMax.toFixed(2)} điểm</span>
                                        <span className="mono" style={{ color: 'var(--primary)' }}>
                                            {groupScore.toFixed(2)} / {groupMax.toFixed(2)}đ
                                        </span>
                                    </div>
                                    <div>
                                        {groupCriteria.map((c) => {
                                            const currentVal = scoresMap[c.code];
                                            const max = Number(c.maxScore) || 1.0;
                                            return (
                                                <div className="rubric-row" key={c.code} style={{ alignItems: 'start' }}>
                                                    <div>
                                                        <div className="rubric-name">{c.name || c.label}</div>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {c.cloCode && <Tag color="blue" className="font-mono text-[10px]">{c.cloCode}</Tag>}
                                                            <span className="rubric-desc text-xs text-slate-500">{c.description || 'Tiêu chí đánh giá chất lượng khóa luận'}</span>
                                                        </div>
                                                        {(c.descGood || c.descFair || c.descAverage || c.descPoor) && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6, fontSize: '11px', background: '#f8fafc', padding: 6, borderRadius: 4 }}>
                                                                <div style={{ color: '#16a34a' }}><strong>Tốt:</strong> {c.descGood || '---'}</div>
                                                                <div style={{ color: '#0284c7' }}><strong>Khá:</strong> {c.descFair || '---'}</div>
                                                                <div style={{ color: '#d97706' }}><strong>TB:</strong> {c.descAverage || '---'}</div>
                                                                <div style={{ color: '#dc2626' }}><strong>Kém:</strong> {c.descPoor || '---'}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="rubric-max-badge" style={{ marginTop: 4 }}>
                                                        Tối đa: <span className="mono">{max.toFixed(2)}</span>đ
                                                    </div>
                                                    <input
                                                        type="range"
                                                        className="rubric-slider"
                                                        min="0"
                                                        max={max}
                                                        step={c.step || 0.05}
                                                        value={currentVal !== null && currentVal !== undefined ? currentVal : 0}
                                                        disabled={scoreLocked}
                                                        onChange={(e) => handleScoreChange(c.code, e.target.value, max)}
                                                    />
                                                    <input
                                                        type="number"
                                                        className="rubric-input r-val mono"
                                                        min="0"
                                                        max={max}
                                                        step={c.step || 0.05}
                                                        value={currentVal !== null && currentVal !== undefined ? currentVal : ''}
                                                        placeholder="0.00"
                                                        disabled={scoreLocked}
                                                        onChange={(e) => handleScoreChange(c.code, e.target.value, max)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* General Comment */}
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, margin: 0 }}>
                                Nhận xét chung của Giám khảo đối với Khóa luận & Buổi bảo vệ:
                            </label>
                            <Button
                                type="dashed"
                                size="small"
                                icon={<BulbOutlined />}
                                onClick={handleGenerateFeedback}
                                loading={aiFeedbackLoading}
                                disabled={scoreLocked}
                                className="text-amber-700 border-amber-400 hover:border-amber-600"
                            >
                                AI Gợi ý nhận xét
                            </Button>
                        </div>
                        <textarea
                            className="input-field"
                            rows={3}
                            style={{ width: '100%', resize: 'vertical' }}
                            placeholder="Nhập nhận xét về tính thực tiễn, ưu nhược điểm, phong cách thuyết trình..."
                            value={generalComment}
                            disabled={scoreLocked}
                            onChange={(e) => setGeneralComment(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Gợi ý câu hỏi phản biện AI */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <div className="card-title">Gợi ý câu hỏi phản biện AI</div>
                        <div className="card-subtitle">Hỗ trợ Cán bộ chấm thi đặt câu hỏi chất vấn sinh viên theo 3 cấp độ tư duy</div>
                    </div>
                    <Button
                        size="small"
                        icon={<QuestionCircleOutlined />}
                        onClick={handleGenerateQuestions}
                        loading={aiQuestionsLoading}
                        className="text-teal-700 border-teal-500 hover:border-teal-700"
                    >
                        Tạo câu hỏi phản biện AI
                    </Button>
                </div>

                <div style={{ padding: 20 }}>
                    {defenseQuestions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>
                            Chưa có câu hỏi phản biện. Bấm <strong>Tạo câu hỏi phản biện AI</strong> để nhận gợi ý câu hỏi chất vấn theo đề tài.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                            {defenseQuestions.map((q, idx) => {
                                const conf = LEVEL_CONFIG[q.level] || {
                                    label: q.levelLabel || q.level,
                                    color: 'default',
                                };
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            border: '1px solid #E2E8F0',
                                            borderRadius: 8,
                                            padding: 16,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            background: '#FAFAFA',
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <Tag color={conf.color}>{q.levelLabel || conf.label}</Tag>
                                                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                    {q.level === 'FOUNDATION' && 'Cấp 1: Nền tảng (FOUNDATION)'}
                                                    {q.level === 'TECHNICAL_CHALLENGE' && 'Cấp 2: Kỹ thuật (TECHNICAL_CHALLENGE)'}
                                                    {q.level === 'FUTURE_EXPANSION' && 'Cấp 3: Mở rộng (FUTURE_EXPANSION)'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 8, lineHeight: 1.45 }}>
                                                "{q.question}"
                                            </div>
                                            {q.purpose && (
                                                <div style={{ fontSize: 11.5, color: '#64748B', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.4 }}>
                                                    <span style={{ fontWeight: 600 }}>Mục đích:</span> {q.purpose}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px dashed #E2E8F0' }}>
                                            <Button
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={() => copyQuestion(q.question)}
                                            >
                                                Sao chép câu hỏi
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: In Phiếu Chấm Cá Nhân (A4) */}
            {isPrintModalOpen && (
                <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setIsPrintModalOpen(false); }}>
                    <div className="modal-box" style={{ maxWidth: 720 }}>
                        <div className="modal-head">
                            <div className="modal-title">Phiếu Chấm Điểm Cá Nhân Của Thành Viên Hội Đồng</div>
                            <button className="modal-close" onClick={() => setIsPrintModalOpen(false)} type="button">×</button>
                        </div>
                        <div className="modal-body" style={{ background: '#FAFAFA', padding: 20 }}>
                            <div style={{ background: 'white', border: '1px solid var(--border)', padding: 24, fontSize: '12.5px', lineHeight: 1.5 }}>
                                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                                    <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT · KHOA CÔNG NGHỆ THÔNG TIN</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0F766E', marginTop: 4, textTransform: 'uppercase' }}>
                                        PHIẾU ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP ĐẠI HỌC
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Dành cho Thành viên Hội đồng chấm bảo vệ</div>
                                </div>

                                <div style={{ marginBottom: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                                    <p style={{ margin: '4px 0' }}>Họ tên sinh viên: <strong>{registration?.student?.fullName?.toUpperCase() || '—'}</strong> · MSSV: <strong className="mono">{registration?.student?.code || '—'}</strong></p>
                                    <p style={{ margin: '4px 0' }}>Tên đề tài: <strong>{registration?.topic?.title || '—'}</strong></p>
                                    <p style={{ margin: '4px 0' }}>Hội đồng chấm: <strong>{registration?.council?.name || 'Hội đồng Khoá luận'}</strong> · Phòng thi: <strong>{registration?.council?.defenseLocation || 'P.402'}</strong></p>
                                    <p style={{ margin: '4px 0' }}>Họ tên Giám khảo chấm: <strong>{currentEvaluator?.fullName || '—'}</strong> · Vai trò: <strong>{ROLE_LABELS[currentEvaluator?.roleInCouncil] || currentEvaluator?.roleInCouncil || 'Thành viên'}</strong></p>
                                </div>

                                <div style={{ marginBottom: 14 }}>
                                    <table style={{ width: '100%', border: '1px solid #CBD5E1', fontSize: 12, borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#F1F5F9' }}>
                                            <tr>
                                                <th style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'left' }}>Nội dung đánh giá</th>
                                                <th style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center', width: 90 }}>Điểm tối đa</th>
                                                <th style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center', width: 90 }}>Điểm chấm</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categories.map((g, idx) => {
                                                const gCriteria = g.criteria || [];
                                                const gMax = gCriteria.reduce((sum, c) => sum + (parseFloat(c.maxScore) || 0), 0);
                                                const gScore = gCriteria.reduce((sum, c) => sum + (parseFloat(scoresMap[c.code]) || 0), 0);
                                                return (
                                                    <tr key={g.code || idx}>
                                                        <td style={{ border: '1px solid #CBD5E1', padding: 6 }}>{g.name}</td>
                                                        <td style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center' }}>{gMax.toFixed(2)}</td>
                                                        <td style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center', fontWeight: 700 }}>{gScore.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ background: '#F0FDFA', fontWeight: 700 }}>
                                                <td style={{ border: '1px solid #CBD5E1', padding: 6, color: '#0F766E' }}>TỔNG ĐIỂM ĐÁNH GIÁ (HỆ 10)</td>
                                                <td style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center', color: '#0F766E' }}>{rubricInfo?.totalMaxScore || 10.0}</td>
                                                <td style={{ border: '1px solid #CBD5E1', padding: 6, textAlign: 'center', color: '#0F766E', fontSize: 14 }}>{totalScore.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {generalComment && (
                                    <div style={{ marginBottom: 14, fontSize: 12 }}>
                                        <strong>Nhận xét chung:</strong>
                                        <p style={{ margin: '4px 0', fontStyle: 'italic', color: '#334155' }}>{generalComment}</p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div><em>Bình Dương, ngày {dayjs().format('DD')} tháng {dayjs().format('MM')} năm {dayjs().format('YYYY')}</em></div>
                                        <div style={{ fontWeight: 700, marginTop: 2 }}>GIÁM KHẢO CHẤM ĐIỂM</div>
                                        <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'cursive', color: '#0F766E', fontSize: 15 }}>
                                            {currentEvaluator?.fullName || 'Cán bộ chấm thi'}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: 'var(--success)', fontWeight: 600 }}>Đã xác thực chữ ký điện tử</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-foot">
                            <button className="btn btn-secondary" onClick={() => setIsPrintModalOpen(false)} type="button">Đóng</button>
                            <button className="btn btn-primary" onClick={() => window.print()} type="button">In Phiếu Điểm</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    </QueryPanel>
    );
}
