const {
    DEFAULT_RUBRIC_LEVEL_POLICY,
    normalizeRubricLevelPolicy,
    validateRubricLevelPolicy,
    suggestCriterionScore,
    getCriterionLevel,
} = require('../../src/services/rubricLevelPolicy');

describe('rubricLevelPolicy service', () => {
    test('exports expected DEFAULT_RUBRIC_LEVEL_POLICY thresholds and suggestions', () => {
        expect(DEFAULT_RUBRIC_LEVEL_POLICY).toEqual({
            good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
            fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
            average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
            poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
        });
    });

    describe('normalizeRubricLevelPolicy', () => {
        test('falls back to a copy of DEFAULT_RUBRIC_LEVEL_POLICY for null or undefined', () => {
            const fromUndefined = normalizeRubricLevelPolicy(undefined);
            const fromNull = normalizeRubricLevelPolicy(null);

            expect(fromUndefined).toEqual(DEFAULT_RUBRIC_LEVEL_POLICY);
            expect(fromNull).toEqual(DEFAULT_RUBRIC_LEVEL_POLICY);
            expect(fromUndefined).not.toBe(DEFAULT_RUBRIC_LEVEL_POLICY);
        });

        test('normalizes numeric strings and strips unexpected keys', () => {
            const normalized = normalizeRubricLevelPolicy({
                good: { minPercent: '85', maxPercent: '100', suggestedPercent: '90', extra: 1 },
                fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
                average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
                poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
                unknown: { minPercent: 0, maxPercent: 0, suggestedPercent: 0 },
            });

            expect(normalized).toEqual(DEFAULT_RUBRIC_LEVEL_POLICY);
        });

        test('throws when structure is invalid or levels are missing', () => {
            expect(() => normalizeRubricLevelPolicy('invalid')).toThrow();
            expect(() => normalizeRubricLevelPolicy([])).toThrow();
            expect(() => normalizeRubricLevelPolicy({ good: DEFAULT_RUBRIC_LEVEL_POLICY.good })).toThrow();
            expect(() => normalizeRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                poor: { minPercent: '', maxPercent: 50, suggestedPercent: 30 },
            })).toThrow();
        });
    });

    describe('getCriterionLevel', () => {
        test('returns null for blank/invalid scores and treats 0 as poor', () => {
            expect(getCriterionLevel(null, 1)).toBeNull();
            expect(getCriterionLevel(undefined, 1)).toBeNull();
            expect(getCriterionLevel('', 1)).toBeNull();
            expect(getCriterionLevel(Number.NaN, 1)).toBeNull();
            expect(getCriterionLevel(-0.01, 1)).toBeNull();
            expect(getCriterionLevel(1.01, 1)).toBeNull();
            expect(getCriterionLevel(0.5, 0)).toBeNull();
            expect(getCriterionLevel(0, 1)).toBe('poor');
        });

        test('maps exact boundaries 0/50/70/85/100 accurately for maxScore = 1', () => {
            expect(getCriterionLevel(0, 1)).toBe('poor');
            expect(getCriterionLevel(0.49, 1)).toBe('poor');
            expect(getCriterionLevel(0.5, 1)).toBe('average');
            expect(getCriterionLevel(0.69, 1)).toBe('average');
            expect(getCriterionLevel(0.7, 1)).toBe('fair');
            expect(getCriterionLevel(0.84, 1)).toBe('fair');
            expect(getCriterionLevel(0.85, 1)).toBe('good');
            expect(getCriterionLevel(1, 1)).toBe('good');
        });

        test('avoids binary-float boundary drift on fractional maxScore values', () => {
            // In JS float, (1.19 / 1.4) * 100 === 84.99999999999999
            expect(getCriterionLevel(1.19, 1.4)).toBe('good');
            expect(getCriterionLevel(0.17, 0.2)).toBe('good');
            expect(getCriterionLevel(0.35, 0.5)).toBe('fair');
            expect(getCriterionLevel(0.25, 0.5)).toBe('average');
            expect(getCriterionLevel(0.21, 0.3)).toBe('fair');
        });
    });

    describe('suggestCriterionScore', () => {
        test('returns expected suggestions for maxScore = 1', () => {
            expect(suggestCriterionScore(1, 'poor')).toBe(0.3);
            expect(suggestCriterionScore(1, 'average')).toBe(0.6);
            expect(suggestCriterionScore(1, 'fair')).toBe(0.75);
            expect(suggestCriterionScore(1, 'good')).toBe(0.9);
        });

        test('rounds suggestions to 0.01 precision and clamps within [0, maxScore]', () => {
            expect(suggestCriterionScore(0.25, 'good')).toBe(0.23);
            expect(suggestCriterionScore(0.25, 'fair')).toBe(0.19);
            expect(suggestCriterionScore(0.25, 'average')).toBe(0.15);
            expect(suggestCriterionScore(0.25, 'poor')).toBe(0.08);
            expect(suggestCriterionScore(2.5, 'fair')).toBe(1.88);
        });

        test('throws on non-finite/non-positive maxScore or unknown levelCode', () => {
            expect(() => suggestCriterionScore(0, 'good')).toThrow();
            expect(() => suggestCriterionScore(-1, 'good')).toThrow();
            expect(() => suggestCriterionScore(Number.NaN, 'good')).toThrow();
            expect(() => suggestCriterionScore(null, 'good')).toThrow();
            expect(() => suggestCriterionScore(1, 'excellent')).toThrow();
        });
    });

    describe('validateRubricLevelPolicy', () => {
        test('accepts default policy with standard rubric criteria', () => {
            const result = validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [
                { code: 'C1', maxScore: 0.25 },
                { code: 'C2', maxScore: 0.5 },
                { code: 'C3', maxScore: 1.0 },
                { code: 'C4', maxScore: 2.5 },
            ]);

            expect(result.ok).toBe(true);
            expect(result.policy).toEqual(DEFAULT_RUBRIC_LEVEL_POLICY);
        });

        test('rejects missing levels, gaps, overlaps, and out-of-range boundaries', () => {
            expect(validateRubricLevelPolicy(null).ok).toBe(false);
            expect(validateRubricLevelPolicy({ good: DEFAULT_RUBRIC_LEVEL_POLICY.good }).ok).toBe(false);

            // Gap between poor (0..45) and average (50..70)
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                poor: { minPercent: 0, maxPercent: 45, suggestedPercent: 30 },
            }).ok).toBe(false);

            // Overlap between poor (0..55) and average (50..70)
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                poor: { minPercent: 0, maxPercent: 55, suggestedPercent: 30 },
            }).ok).toBe(false);

            // Does not start at 0 or end at 100
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                poor: { minPercent: 5, maxPercent: 50, suggestedPercent: 30 },
            }).ok).toBe(false);
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                good: { minPercent: 85, maxPercent: 99, suggestedPercent: 90 },
            }).ok).toBe(false);
        });

        test('enforces half-open upper bound on suggestedPercent except good includes 100', () => {
            // fair upper boundary 85 is exclusive
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 85 },
            }).ok).toBe(false);

            // poor lower boundary 0 and good upper boundary 100 are inclusive
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 0 },
                good: { minPercent: 85, maxPercent: 100, suggestedPercent: 100 },
            }).ok).toBe(true);

            // good suggestedPercent below minPercent
            expect(validateRubricLevelPolicy({
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                good: { minPercent: 85, maxPercent: 100, suggestedPercent: 84 },
            }).ok).toBe(false);
        });

        test('rejects invalid criterion maxScore or unrepresentable small maxScore at 0.01 resolution', () => {
            expect(validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [{ maxScore: 0 }]).ok).toBe(false);
            expect(validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [{ maxScore: -1 }]).ok).toBe(false);
            expect(validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [{ maxScore: Number.NaN }]).ok).toBe(false);

            // maxScore = 0.02: fair (75%) -> 0.015 -> 0.02 (100% => good, out of fair band)
            expect(validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [{ code: 'TINY', maxScore: 0.02 }]).ok).toBe(false);

            // maxScore = 0.03: fair (75%) -> 0.0225 -> 0.02 (66.67% => average, out of fair band)
            expect(validateRubricLevelPolicy(DEFAULT_RUBRIC_LEVEL_POLICY, [{ code: 'SMALL', maxScore: 0.03 }]).ok).toBe(false);

            // maxScore = 0.05 with good suggestedPercent = 85: 0.0425 -> 0.04 (80% => fair)
            const strictGoodPolicy = {
                ...DEFAULT_RUBRIC_LEVEL_POLICY,
                good: { minPercent: 85, maxPercent: 100, suggestedPercent: 85 },
            };
            expect(validateRubricLevelPolicy(strictGoodPolicy, [{ code: 'EDGE', maxScore: 0.05 }]).ok).toBe(false);
        });
    });
});
