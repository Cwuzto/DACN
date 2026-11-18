import { useMemo, useState } from 'react';
import { Button, Tag, message } from 'antd';
import {
    DEFAULT_RUBRIC_LEVEL_POLICY,
    RUBRIC_LEVELS,
    RUBRIC_LEVEL_LABELS,
    fillEmptyCriteria,
    getLevelForScore,
    getSuggestedScore,
    isScoredValue,
    resolveRubricLevelPolicy,
    roundScore2,
} from '../../utils/rubricLevelPolicy';

export default function RubricQuickScore({
    categories = [],
    policy = DEFAULT_RUBRIC_LEVEL_POLICY,
    scoresMap = {},
    commentsMap = {},
    disabled = false,
    onScoresChange,
    onCommentChange,
    onGroupFill,
    showCriterionComments = false,
}) {
    const [groupFeedback, setGroupFeedback] = useState({});
    const [draftInputs, setDraftInputs] = useState({});

    const resolvedPolicy = useMemo(() => resolveRubricLevelPolicy(policy), [policy]);

    const allCriteria = useMemo(
        () => (categories || []).flatMap((group) => group.criteria || []),
        [categories]
    );

    const summary = useMemo(() => {
        let scoredCount = 0;
        let totalScore = 0;
        let totalMax = 0;

        for (const cri of allCriteria) {
            totalMax += Number(cri.maxScore) || 0;
            const val = scoresMap?.[cri.code];
            if (isScoredValue(val)) {
                scoredCount += 1;
                totalScore += Number(val);
            }
        }

        return {
            scoredCount,
            totalCount: allCriteria.length,
            totalScore: roundScore2(totalScore),
            totalMax: roundScore2(totalMax),
        };
    }, [allCriteria, scoresMap]);

    const handleSelectLevel = (criterion, levelCode) => {
        if (disabled || !criterion?.code) return;
        const max = Number(criterion.maxScore) || 0;
        if (max <= 0) return;

        const suggested = getSuggestedScore(max, levelCode, resolvedPolicy);
        setDraftInputs((prev) => {
            if (!(criterion.code in prev)) return prev;
            const next = { ...prev };
            delete next[criterion.code];
            return next;
        });
        onScoresChange?.({
            ...(scoresMap || {}),
            [criterion.code]: suggested,
        });
    };

    const handleNumericFocus = (criterion) => {
        if (disabled || !criterion?.code) return;
        const val = scoresMap?.[criterion.code];
        setDraftInputs((prev) => ({
            ...prev,
            [criterion.code]: isScoredValue(val) ? String(val) : '',
        }));
    };

    const handleNumericChange = (criterion, event) => {
        if (disabled || !criterion?.code) return;
        const raw = event.target.value;
        const badInput = Boolean(event.target.validity?.badInput);

        setDraftInputs((prev) => ({
            ...prev,
            [criterion.code]: raw,
        }));

        if (raw === '') {
            if (!badInput) {
                onScoresChange?.({
                    ...(scoresMap || {}),
                    [criterion.code]: null,
                });
            }
            return;
        }

        const num = Number(raw);
        if (!Number.isFinite(num)) return;

        const max = Number(criterion.maxScore) || 0;
        let clamped = num;
        if (clamped < 0) clamped = 0;
        if (max > 0 && clamped > max) clamped = max;

        onScoresChange?.({
            ...(scoresMap || {}),
            [criterion.code]: roundScore2(clamped),
        });
    };

    const handleNumericBlur = (criterion) => {
        if (!criterion?.code) return;
        setDraftInputs((prev) => {
            if (!(criterion.code in prev)) return prev;
            const next = { ...prev };
            delete next[criterion.code];
            return next;
        });
    };

    const handleGroupQuickFill = (group, groupKey, levelCode) => {
        if (disabled) return;
        const groupCriteria = group.criteria || [];
        const { nextScoresMap, filledCount, keptCount } = fillEmptyCriteria(
            groupCriteria,
            scoresMap,
            levelCode,
            resolvedPolicy
        );

        setDraftInputs((prev) => {
            const next = { ...prev };
            for (const cri of groupCriteria) {
                if (cri?.code && !isScoredValue(scoresMap?.[cri.code])) {
                    delete next[cri.code];
                }
            }
            return next;
        });

        onScoresChange?.(nextScoresMap);

        const levelLabel = RUBRIC_LEVEL_LABELS[levelCode] || levelCode;
        const feedbackText = filledCount > 0
            ? `Đã điền ${filledCount} mục trống (${levelLabel}), giữ nguyên ${keptCount} mục đã chấm.`
            : `Không có mục trống để điền (đã giữ nguyên ${keptCount} mục đã chấm).`;

        setGroupFeedback((prev) => ({
            ...prev,
            [groupKey]: {
                levelCode,
                filledCount,
                keptCount,
                text: feedbackText,
            },
        }));

        message.info(feedbackText);
        onGroupFill?.({
            group,
            levelCode,
            filledCount,
            keptCount,
            nextScoresMap,
        });
    };

    if (!categories?.length) {
        return (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted, #64748B)', fontSize: 13 }}>
                Chưa có tiêu chí rubric để chấm điểm.
            </div>
        );
    }

    return (
        <div className="rubric-quick-score" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* Overall progress bar */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    marginBottom: 16,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                }}
            >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }} data-testid="rubric-progress-text">
                    Tiến độ chấm: <span className="mono">{summary.scoredCount}/{summary.totalCount}</span> mục đã chấm
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F766E' }} data-testid="rubric-total-preview">
                    Tổng tạm tính: <span className="mono">{summary.totalScore.toFixed(2)} / {summary.totalMax.toFixed(2)}đ</span>
                </div>
            </div>

            <div id="rubric-groups-container">
                {categories.map((group, gIdx) => {
                    const groupKey = group.code || `group-${gIdx}`;
                    const groupCriteria = group.criteria || [];
                    const groupMax = roundScore2(
                        groupCriteria.reduce((sum, c) => sum + (Number(c.maxScore) || 0), 0)
                    );
                    const groupScore = roundScore2(
                        groupCriteria.reduce(
                            (sum, c) => sum + (isScoredValue(scoresMap?.[c.code]) ? Number(scoresMap[c.code]) : 0),
                            0
                        )
                    );
                    const groupScoredCount = groupCriteria.filter((c) => isScoredValue(scoresMap?.[c.code])).length;
                    const feedback = groupFeedback[groupKey];

                    return (
                        <div className="rubric-group" key={groupKey} style={{ boxSizing: 'border-box', maxWidth: '100%' }}>
                            <div
                                className="rubric-group-title"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <span>
                                    {group.name} — Tối đa {groupMax.toFixed(2)} điểm
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                                        {groupScoredCount}/{groupCriteria.length} mục
                                    </span>
                                    <span className="mono" style={{ color: 'var(--primary, #0F766E)' }} data-testid={`rubric-group-subtotal-${groupKey}`}>
                                        {groupScore.toFixed(2)} / {groupMax.toFixed(2)}đ
                                    </span>
                                </div>
                            </div>

                            {/* Per-group quick-fill bar */}
                            <div
                                role="group"
                                aria-label={`Chọn mức cho các mục chưa chấm — ${group.name}`}
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    padding: '8px 10px',
                                    marginBottom: 12,
                                    background: '#F8FAFC',
                                    borderRadius: 6,
                                    border: '1px solid #E2E8F0',
                                }}
                            >
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                    Chọn mức cho các mục chưa chấm:
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {RUBRIC_LEVELS.map((lvl) => (
                                        <Button
                                            key={lvl.code}
                                            size="small"
                                            disabled={disabled}
                                            onClick={() => handleGroupQuickFill(group, groupKey, lvl.code)}
                                            aria-label={`Điền mục chưa chấm mức ${lvl.label} cho nhóm ${group.name}`}
                                            style={{
                                                borderColor: lvl.borderColor,
                                                color: disabled ? undefined : lvl.accentColor,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {lvl.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {feedback && (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    style={{
                                        fontSize: 12,
                                        color: '#0F766E',
                                        background: '#F0FDFA',
                                        border: '1px solid #CCFBF1',
                                        borderRadius: 6,
                                        padding: '6px 10px',
                                        marginBottom: 12,
                                    }}
                                >
                                    {feedback.text}
                                </div>
                            )}

                            <div>
                                {groupCriteria.map((c) => {
                                    const currentVal = scoresMap?.[c.code];
                                    const isScored = isScoredValue(currentVal);
                                    const max = Number(c.maxScore) || 1.0;
                                    const activeLevel = getLevelForScore(currentVal, max, resolvedPolicy);
                                    const criterionLabel = c.name || c.label || c.code;
                                    const displayInputValue = c.code in draftInputs
                                        ? draftInputs[c.code]
                                        : (isScored ? String(currentVal) : '');

                                    return (
                                        <div
                                            key={c.code}
                                            data-testid={`criterion-row-${c.code}`}
                                            style={{
                                                padding: '12px 0',
                                                borderBottom: '1px dashed #E2E8F0',
                                                minWidth: 0,
                                            }}
                                        >
                                            {/* Criterion header + score input */}
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    gap: 10,
                                                }}
                                            >
                                                <div style={{ flex: '1 1 210px', minWidth: 0 }}>
                                                    <div className="rubric-name">{criterionLabel}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                                        {c.cloCode && (
                                                            <Tag color="blue" className="font-mono text-[10px]" style={{ margin: 0 }}>
                                                                {c.cloCode}
                                                            </Tag>
                                                        )}
                                                        <span className="rubric-desc" style={{ marginTop: 0 }}>
                                                            {c.description || 'Tiêu chí đánh giá chất lượng khóa luận'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        flexShrink: 0,
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <div className="rubric-max-badge">
                                                        Tối đa: <span className="mono">{max.toFixed(2)}</span>đ
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="rubric-input r-val mono"
                                                        min="0"
                                                        max={max}
                                                        step="0.01"
                                                        value={displayInputValue}
                                                        placeholder="0.00"
                                                        disabled={disabled}
                                                        aria-label={`Điểm ${criterionLabel}`}
                                                        onFocus={() => handleNumericFocus(c)}
                                                        onChange={(e) => handleNumericChange(c, e)}
                                                        onBlur={() => handleNumericBlur(c)}
                                                    />
                                                </div>
                                            </div>

                                            {/* 4 clickable level radios */}
                                            <div
                                                role="radiogroup"
                                                aria-label={`Mức đánh giá ${criterionLabel}`}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                                                    gap: 8,
                                                    marginTop: 10,
                                                }}
                                            >
                                                {RUBRIC_LEVELS.map((lvl) => {
                                                    const isSelected = activeLevel === lvl.code;
                                                    const suggested = max > 0 ? getSuggestedScore(max, lvl.code, resolvedPolicy) : 0;
                                                    const band = resolvedPolicy[lvl.code];
                                                    const levelDesc = c[lvl.descKey] || c[lvl.legacyDescKey] || '';

                                                    return (
                                                        <label
                                                            key={lvl.code}
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 4,
                                                                padding: '8px 10px',
                                                                borderRadius: 6,
                                                                border: `1.5px solid ${isSelected ? lvl.accentColor : '#E2E8F0'}`,
                                                                background: isSelected ? lvl.softBg : '#FFFFFF',
                                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                                                opacity: disabled && !isSelected ? 0.65 : 1,
                                                                minWidth: 0,
                                                                boxSizing: 'border-box',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: isSelected ? lvl.accentColor : '#1E293B' }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`rubric-level-${c.code}`}
                                                                        value={lvl.code}
                                                                        checked={isSelected}
                                                                        disabled={disabled}
                                                                        aria-label={`${criterionLabel} - ${lvl.label}`}
                                                                        onChange={() => handleSelectLevel(c, lvl.code)}
                                                                    />
                                                                    <span>{lvl.label}</span>
                                                                </span>
                                                                <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: lvl.accentColor }}>
                                                                    {suggested.toFixed(2)}đ
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.35, wordBreak: 'break-word' }}>
                                                                {levelDesc || `${band.minPercent}%–${band.maxPercent}%`}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                            {showCriterionComments && typeof onCommentChange === 'function' && (
                                                <div style={{ marginTop: 8 }}>
                                                    <input
                                                        type="text"
                                                        className="input-field"
                                                        style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                                                        placeholder="Nhận xét riêng cho tiêu chí (tùy chọn)..."
                                                        value={commentsMap?.[c.code] || ''}
                                                        disabled={disabled}
                                                        aria-label={`Nhận xét ${criterionLabel}`}
                                                        onChange={(e) => onCommentChange(c.code, e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
