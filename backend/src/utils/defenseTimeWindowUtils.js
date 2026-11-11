/**
 * Defense Time Window Utils
 * Handles Asia/Ho_Chi_Minh (UTC+7) time boundary calculations and half-up score rounding.
 */

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Formats a Date or date string to YYYY-MM-DD in Asia/Ho_Chi_Minh time.
 * @param {Date | string} dateInput
 * @returns {string} YYYY-MM-DD
 */
function toVietnamDateYmd(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date input: ${dateInput}`);
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: VN_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(d);
}

/**
 * Creates a Date object representing 00:00:00 in Asia/Ho_Chi_Minh for (ymd + dayOffset).
 * @param {string} ymd - "YYYY-MM-DD"
 * @param {number} dayOffset - relative days (+ or -)
 * @returns {Date}
 */
function createVietnamMidnightDate(ymd, dayOffset = 0) {
    const [year, month, day] = ymd.split('-').map(Number);
    // Date.UTC at 00:00 UTC minus 7 hours gives 00:00:00 in UTC+7
    const utcMidnightTimestamp = Date.UTC(year, month - 1, day + dayOffset, 0, 0, 0);
    return new Date(utcMidnightTimestamp - VN_OFFSET_MS);
}

/**
 * Computes all defense time windows and reminder milestones based on defense date.
 * All boundaries are anchored to 00:00:00 Asia/Ho_Chi_Minh (UTC+7).
 *
 * @param {Date | string} defenseDateInput
 * @returns {{
 *   defenseDateYmd: string,
 *   softPreparationDeadlineAt: Date,
 *   defenseSnapshotAt: Date,
 *   windowClosesAt: Date,
 *   reminder7dAt: Date,
 *   reminder3dAt: Date,
 *   reminder24hAt: Date
 * }}
 */
function computeDefenseTimeWindows(defenseDateInput) {
    const defenseDateYmd = toVietnamDateYmd(defenseDateInput);

    // Soft deadline: 00:00:00 on Day D - 3 (3 days before defense date)
    const softPreparationDeadlineAt = createVietnamMidnightDate(defenseDateYmd, -3);

    // Defense Snapshot: 00:00:00 on Day D (the defense date itself)
    const defenseSnapshotAt = createVietnamMidnightDate(defenseDateYmd, 0);

    // Window closure: 00:00:00 on Day D + 15 (end of day 14 post defense)
    const windowClosesAt = createVietnamMidnightDate(defenseDateYmd, 15);

    // Reminders relative to windowClosesAt (Day D + 15)
    // 7 days before closure: Day D + 8 (15 - 7)
    const reminder7dAt = createVietnamMidnightDate(defenseDateYmd, 8);
    // 3 days before closure: Day D + 12 (15 - 3)
    const reminder3dAt = createVietnamMidnightDate(defenseDateYmd, 12);
    // 24 hours (1 day) before closure: Day D + 14 (15 - 1)
    const reminder24hAt = createVietnamMidnightDate(defenseDateYmd, 14);

    return {
        defenseDateYmd,
        softPreparationDeadlineAt,
        defenseSnapshotAt,
        windowClosesAt,
        reminder7dAt,
        reminder3dAt,
        reminder24hAt,
    };
}

/**
 * Deterministic half-up rounding to 1 decimal place.
 * E.g. 4.95 -> 5.0, 4.949 -> 4.9, 8.3333333 -> 8.3
 *
 * @param {number} rawScore
 * @returns {number | null}
 */
function roundDefenseScoreOneDecimal(rawScore) {
    if (rawScore === null || rawScore === undefined || isNaN(rawScore)) {
        return null;
    }
    // Half-up rounding with epsilon guard against floating point inaccuracies
    const rounded = Math.floor(rawScore * 10 + 0.5 + 1e-9) / 10;
    return Number(rounded.toFixed(1));
}

module.exports = {
    VN_TIMEZONE,
    toVietnamDateYmd,
    createVietnamMidnightDate,
    computeDefenseTimeWindows,
    roundDefenseScoreOneDecimal,
};
