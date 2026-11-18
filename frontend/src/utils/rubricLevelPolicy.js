export const DEFAULT_RUBRIC_LEVEL_POLICY = Object.freeze({
    good: Object.freeze({ minPercent: 85, maxPercent: 100, suggestedPercent: 90 }),
    fair: Object.freeze({ minPercent: 70, maxPercent: 85, suggestedPercent: 75 }),
    average: Object.freeze({ minPercent: 50, maxPercent: 70, suggestedPercent: 60 }),
    poor: Object.freeze({ minPercent: 0, maxPercent: 50, suggestedPercent: 30 }),
});

export const RUBRIC_LEVELS = Object.freeze([
    {
        code: 'good',
        label: 'Tốt',
        descKey: 'levelGoodDesc',
        legacyDescKey: 'descGood',
        accentColor: '#15803D',
        softBg: '#F0FDF4',
        borderColor: '#86EFAC',
    },
    {
        code: 'fair',
        label: 'Khá',
        descKey: 'levelFairDesc',
        legacyDescKey: 'descFair',
        accentColor: '#0369A1',
        softBg: '#F0F9FF',
        borderColor: '#7DD3FC',
    },
    {
        code: 'average',
        label: 'Trung bình',
        descKey: 'levelAverageDesc',
        legacyDescKey: 'descAverage',
        accentColor: '#B45309',
        softBg: '#FFFBEB',
        borderColor: '#FCD34D',
    },
    {
        code: 'poor',
        label: 'Kém',
        descKey: 'levelPoorDesc',
        legacyDescKey: 'descPoor',
        accentColor: '#B91C1C',
        softBg: '#FEF2F2',
        borderColor: '#FCA5A5',
    },
]);

export const RUBRIC_LEVEL_LABELS = Object.freeze({
    good: 'Tốt',
    fair: 'Khá',
    average: 'Trung bình',
    poor: 'Kém',
});

export const isScoredValue = (value) => {
    if (value === null || value === undefined || typeof value === 'boolean') return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return Number.isFinite(Number(value));
};

export const roundScore2 = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const scaled = Math.round(num * 10000);
    const hundredths = scaled >= 0
        ? Math.floor((scaled + 50) / 100)
        : Math.ceil((scaled - 50) / 100);
    return hundredths / 100;
};

export const resolveRubricLevelPolicy = (policy) => {
    const source = policy && typeof policy === 'object' && !Array.isArray(policy)
        ? policy
        : DEFAULT_RUBRIC_LEVEL_POLICY;

    const resolved = {};
    for (const { code } of RUBRIC_LEVELS) {
        const defaults = DEFAULT_RUBRIC_LEVEL_POLICY[code];
        const band = source[code];
        if (
            band
            && typeof band === 'object'
            && Number.isFinite(Number(band.minPercent))
            && Number.isFinite(Number(band.maxPercent))
            && Number.isFinite(Number(band.suggestedPercent))
        ) {
            resolved[code] = {
                minPercent: Number(band.minPercent),
                maxPercent: Number(band.maxPercent),
                suggestedPercent: Number(band.suggestedPercent),
            };
        } else {
            resolved[code] = { ...defaults };
        }
    }
    return resolved;
};

export const getLevelForScore = (score, maxScore, policy = DEFAULT_RUBRIC_LEVEL_POLICY) => {
    if (!isScoredValue(score)) return null;
    const numScore = Number(score);
    const numMax = Number(maxScore);
    if (!Number.isFinite(numScore) || !Number.isFinite(numMax) || numMax <= 0) return null;

    const scoreScaled = Math.round(numScore * 10000);
    const maxScaled = Math.round(numMax * 10000);
    if (scoreScaled < 0 || scoreScaled > maxScaled) return null;

    const resolvedPolicy = resolveRubricLevelPolicy(policy);
    const lhs = scoreScaled * 10000;

    for (const { code } of RUBRIC_LEVELS) {
        const band = resolvedPolicy[code];
        const minRhs = maxScaled * Math.round(band.minPercent * 100);
        const maxRhs = maxScaled * Math.round(band.maxPercent * 100);
        const upperInclusive = code === 'good' || band.maxPercent >= 100;
        if (lhs >= minRhs && (upperInclusive ? lhs <= maxRhs : lhs < maxRhs)) {
            return code;
        }
    }

    return null;
};

export const getSuggestedScore = (maxScore, levelCode, policy = DEFAULT_RUBRIC_LEVEL_POLICY) => {
    const numMax = Number(maxScore);
    if (!Number.isFinite(numMax) || numMax <= 0) {
        throw new Error('maxScore phải lớn hơn 0');
    }
    const resolvedPolicy = resolveRubricLevelPolicy(policy);
    const band = resolvedPolicy[levelCode];
    if (!band) {
        throw new Error(`Mức đánh giá không hợp lệ: ${levelCode}`);
    }

    const maxScaled = Math.round(numMax * 10000);
    const pctScaled = Math.round(band.suggestedPercent * 100);
    const hundredths = Math.floor((maxScaled * pctScaled + 500000) / 1000000);
    const clampedMax = Math.round(numMax * 100) / 100;
    return Math.min(clampedMax, Math.max(0, hundredths / 100));
};

export const fillEmptyCriteria = (criteria = [], scoresMap = {}, levelCode, policy = DEFAULT_RUBRIC_LEVEL_POLICY) => {
    const nextScoresMap = { ...(scoresMap || {}) };
    let filledCount = 0;
    let keptCount = 0;

    for (const cri of criteria || []) {
        if (!cri?.code) continue;
        const existing = nextScoresMap[cri.code];
        if (isScoredValue(existing)) {
            keptCount += 1;
            continue;
        }
        nextScoresMap[cri.code] = getSuggestedScore(cri.maxScore, levelCode, policy);
        filledCount += 1;
    }

    return { nextScoresMap, filledCount, keptCount };
};
