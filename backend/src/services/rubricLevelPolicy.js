const LEVEL_CODES = ['good', 'fair', 'average', 'poor'];
const ASCENDING_LEVEL_CODES = ['poor', 'average', 'fair', 'good'];

const DEFAULT_RUBRIC_LEVEL_POLICY = Object.freeze({
    good: Object.freeze({ minPercent: 85, maxPercent: 100, suggestedPercent: 90 }),
    fair: Object.freeze({ minPercent: 70, maxPercent: 85, suggestedPercent: 75 }),
    average: Object.freeze({ minPercent: 50, maxPercent: 70, suggestedPercent: 60 }),
    poor: Object.freeze({ minPercent: 0, maxPercent: 50, suggestedPercent: 30 }),
});

const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const parseFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
        return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const cloneDefaultPolicy = () => ({
    good: { ...DEFAULT_RUBRIC_LEVEL_POLICY.good },
    fair: { ...DEFAULT_RUBRIC_LEVEL_POLICY.fair },
    average: { ...DEFAULT_RUBRIC_LEVEL_POLICY.average },
    poor: { ...DEFAULT_RUBRIC_LEVEL_POLICY.poor },
});

/**
 * Chuẩn hóa cấu trúc chính sách 4 mức điểm của phiên bản rubric.
 * Nếu input là null/undefined thì trả về bản sao của DEFAULT_RUBRIC_LEVEL_POLICY.
 * @param {object|null|undefined} input
 * @returns {{good: object, fair: object, average: object, poor: object}}
 */
function normalizeRubricLevelPolicy(input) {
    if (input === null || input === undefined) {
        return cloneDefaultPolicy();
    }
    if (!isPlainObject(input)) {
        throw new Error('Chính sách mức điểm phải là một đối tượng hợp lệ.');
    }

    const normalized = {};
    for (const code of LEVEL_CODES) {
        const level = input[code];
        if (!isPlainObject(level)) {
            throw new Error(`Thiếu cấu hình mức điểm "${code}".`);
        }

        const minPercent = parseFiniteNumber(level.minPercent);
        const maxPercent = parseFiniteNumber(level.maxPercent);
        const suggestedPercent = parseFiniteNumber(level.suggestedPercent);

        if (minPercent === null || maxPercent === null || suggestedPercent === null) {
            throw new Error(`Các tỷ lệ phần trăm của mức "${code}" phải là số hữu hạn.`);
        }

        normalized[code] = {
            minPercent,
            maxPercent,
            suggestedPercent,
        };
    }

    return normalized;
}

/**
 * Tính điểm gợi ý theo 0.01 cho một tiêu chí dựa trên mức điểm và chính sách rubric.
 * @param {number|string} maxScore
 * @param {'good'|'fair'|'average'|'poor'} levelCode
 * @param {object|null|undefined} policy
 * @returns {number}
 */
function suggestCriterionScore(maxScore, levelCode, policy = DEFAULT_RUBRIC_LEVEL_POLICY) {
    const numMax = parseFiniteNumber(maxScore);
    if (numMax === null || numMax <= 0) {
        throw new Error('maxScore của tiêu chí phải là số dương hữu hạn.');
    }
    if (!LEVEL_CODES.includes(levelCode)) {
        throw new Error(`Mã mức điểm không hợp lệ: "${levelCode}".`);
    }

    const normalized = normalizeRubricLevelPolicy(policy);
    const { suggestedPercent } = normalized[levelCode];
    if (suggestedPercent < 0 || suggestedPercent > 100) {
        throw new Error(`suggestedPercent của mức "${levelCode}" phải nằm trong [0, 100].`);
    }

    // Nhân theo số nguyên phần vạn để tránh sai số dấu phẩy động ở ranh giới .5 (ví dụ 0.015, 0.225).
    const maxTenThousandths = Math.round(numMax * 10000);
    const pctBasisPoints = Math.round(suggestedPercent * 100);
    const hundredths = Math.round((maxTenThousandths * pctBasisPoints) / 1000000);
    const rounded = hundredths / 100;

    return Math.min(numMax, Math.max(0, rounded));
}

/**
 * Suy ra mức điểm ('good'|'fair'|'average'|'poor'|null) từ điểm hiện tại và chính sách rubric.
 * Điểm 0 thuộc mức 'poor'; null/undefined/chuỗi rỗng/NaN trả về null.
 * @param {number|string|null|undefined} score
 * @param {number|string} maxScore
 * @param {object|null|undefined} policy
 * @returns {'good'|'fair'|'average'|'poor'|null}
 */
function getCriterionLevel(score, maxScore, policy = DEFAULT_RUBRIC_LEVEL_POLICY) {
    const numScore = parseFiniteNumber(score);
    const numMax = parseFiniteNumber(maxScore);
    if (numScore === null || numMax === null || numMax <= 0) {
        return null;
    }
    if (numScore < 0 || numScore > numMax) {
        return null;
    }

    const normalized = normalizeRubricLevelPolicy(policy);
    const scoreTenThousandths = Math.round(numScore * 10000);
    const maxTenThousandths = Math.round(numMax * 10000);

    for (const code of LEVEL_CODES) {
        const { minPercent, maxPercent } = normalized[code];
        const minPctBasisPoints = Math.round(minPercent * 100);
        const maxPctBasisPoints = Math.round(maxPercent * 100);

        if (maxTenThousandths > 0) {
            const lhs = scoreTenThousandths * 10000;
            const lowerBound = minPctBasisPoints * maxTenThousandths;
            const upperBound = maxPctBasisPoints * maxTenThousandths;
            const inUpper = code === 'good' ? lhs <= upperBound : lhs < upperBound;
            if (lhs >= lowerBound && inUpper) {
                return code;
            }
        } else {
            const ratioPercent = (numScore / numMax) * 100;
            const inUpper = code === 'good' ? ratioPercent <= maxPercent : ratioPercent < maxPercent;
            if (ratioPercent >= minPercent && inUpper) {
                return code;
            }
        }
    }

    return null;
}

/**
 * Kiểm tra tính hợp lệ của chính sách 4 mức điểm và khả năng biểu diễn ở độ phân giải 0.01
 * cho toàn bộ danh sách tiêu chí.
 * @param {object} policy
 * @param {Array<{code?: string, label?: string, maxScore: number}>} criteria
 * @returns {{ok: boolean, message: string, policy?: object}}
 */
function validateRubricLevelPolicy(policy, criteria = []) {
    if (!isPlainObject(policy)) {
        return { ok: false, message: 'Chính sách mức điểm phải là một đối tượng hợp lệ.' };
    }

    let normalized;
    try {
        normalized = normalizeRubricLevelPolicy(policy);
    } catch (error) {
        return { ok: false, message: error.message };
    }

    for (const code of ASCENDING_LEVEL_CODES) {
        const { minPercent, maxPercent, suggestedPercent } = normalized[code];
        if (
            minPercent < 0 || minPercent > 100
            || maxPercent < 0 || maxPercent > 100
            || suggestedPercent < 0 || suggestedPercent > 100
        ) {
            return {
                ok: false,
                message: `Tỷ lệ phần trăm của mức "${code}" phải nằm trong khoảng [0, 100].`,
            };
        }
        if (minPercent >= maxPercent) {
            return {
                ok: false,
                message: `Ngưỡng dưới của mức "${code}" phải nhỏ hơn ngưỡng trên.`,
            };
        }

        const validSuggestion = code === 'good'
            ? (suggestedPercent >= minPercent && suggestedPercent <= maxPercent)
            : (suggestedPercent >= minPercent && suggestedPercent < maxPercent);
        if (!validSuggestion) {
            return {
                ok: false,
                message: `Điểm gợi ý của mức "${code}" phải nằm trong khoảng phần trăm của mức này.`,
            };
        }
    }

    if (
        normalized.poor.minPercent !== 0
        || normalized.poor.maxPercent !== normalized.average.minPercent
        || normalized.average.maxPercent !== normalized.fair.minPercent
        || normalized.fair.maxPercent !== normalized.good.minPercent
        || normalized.good.maxPercent !== 100
    ) {
        return {
            ok: false,
            message: 'Bốn mức điểm phải phủ liên tục từ 0% đến 100%, không có khoảng trống hoặc chồng lấn.',
        };
    }

    if (criteria !== undefined && criteria !== null && !Array.isArray(criteria)) {
        return { ok: false, message: 'Danh sách tiêu chí kiểm tra chính sách không hợp lệ.' };
    }

    for (const criterion of criteria || []) {
        const maxScore = parseFiniteNumber(criterion?.maxScore);
        const criterionName = criterion?.code || criterion?.label || 'tiêu chí';
        if (maxScore === null || maxScore <= 0) {
            return {
                ok: false,
                message: `Điểm tối đa của ${criterionName} phải là số dương hữu hạn.`,
            };
        }

        for (const code of ASCENDING_LEVEL_CODES) {
            const suggested = suggestCriterionScore(maxScore, code, normalized);
            const mappedLevel = getCriterionLevel(suggested, maxScore, normalized);
            if (mappedLevel !== code) {
                return {
                    ok: false,
                    message: `Tiêu chí ${criterionName} (maxScore=${maxScore}) không thể biểu diễn chính xác mức "${code}" ở độ phân giải 0.01 (điểm gợi ý ${suggested} bị ánh xạ sang "${mappedLevel || 'none'}").`,
                };
            }
        }
    }

    return {
        ok: true,
        message: 'Chính sách mức điểm hợp lệ.',
        policy: normalized,
    };
}

module.exports = {
    DEFAULT_RUBRIC_LEVEL_POLICY,
    normalizeRubricLevelPolicy,
    validateRubricLevelPolicy,
    suggestCriterionScore,
    getCriterionLevel,
};
