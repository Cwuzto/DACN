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

/**
 * Formats a Date or date string to ISO string, or returns null if invalid/empty.
 * @param {Date | string | null | undefined} value
 * @returns {string | null}
 */
function toIsoOrNull(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Builds a unified archive deadline & completeness (X/4) summary
 * for a TopicRegistration and its ProjectArchive.
 *
 * @param {object | null | undefined} registration
 * @param {object | null | undefined} archive
 * @param {Date} [now]
 */
function buildArchiveDeadlineSummary(registration, archive, now = new Date()) {
    const currentNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    const rawDefenseDate =
        registration?.defenseCouncil?.defenseDate
        || registration?.council?.defenseDate
        || registration?.semester?.defenseDate
        || registration?.topic?.semester?.defenseDate
        || null;

    const defenseDate = toIsoOrNull(rawDefenseDate);
    const computedWindows = defenseDate ? computeDefenseTimeWindows(defenseDate) : null;

    const softPreparationDeadlineAt = toIsoOrNull(
        archive?.softPreparationDeadlineAt || computedWindows?.softPreparationDeadlineAt || null
    );
    const defenseSnapshotAt = toIsoOrNull(
        archive?.defenseSnapshotAt || computedWindows?.defenseSnapshotAt || null
    );
    const windowClosesAt = toIsoOrNull(
        archive?.windowClosesAt || computedWindows?.windowClosesAt || null
    );
    const windowClosedAt = toIsoOrNull(archive?.windowClosedAt || null);

    const isSoftDeadlinePast = Boolean(
        softPreparationDeadlineAt && currentNow >= new Date(softPreparationDeadlineAt)
    );
    const isWindowClosed = Boolean(windowClosedAt)
        || Boolean(windowClosesAt && currentNow >= new Date(windowClosesAt));

    const docVersions = Array.isArray(archive?.documentVersions)
        ? archive.documentVersions
        : (Array.isArray(registration?.documentVersions) ? registration.documentVersions : []);

    const presentDocTypes = new Set(
        docVersions
            .map((doc) => doc?.documentType || doc?.docType)
            .filter(Boolean)
    );

    const requiredChecks = [
        {
            type: 'REPORT_WORD',
            present: Boolean(archive?.reportWordFileUrl) || presentDocTypes.has('REPORT_WORD'),
        },
        {
            type: 'REPORT_PDF',
            present: Boolean(archive?.reportPdfFileUrl || archive?.reportFileUrl) || presentDocTypes.has('REPORT_PDF'),
        },
        {
            type: 'DEMO_VIDEO',
            present: Boolean(archive?.demoVideoUrl) || presentDocTypes.has('DEMO_VIDEO'),
        },
        {
            type: 'SLIDE_PPTX',
            present: Boolean(archive?.slideFileUrl) || presentDocTypes.has('SLIDE_PPTX'),
        },
    ];

    const missingTypes = requiredChecks.filter((item) => !item.present).map((item) => item.type);
    const submittedCount = requiredChecks.length - missingTypes.length;

    return {
        submittedCount,
        totalRequired: 4,
        isComplete: submittedCount === 4,
        missingTypes,
        timeWindows: {
            defenseDate,
            softPreparationDeadlineAt,
            defenseSnapshotAt,
            windowClosesAt,
            windowClosedAt,
        },
        isSoftDeadlinePast,
        isWindowClosed,
    };
}

module.exports = {
    VN_TIMEZONE,
    toVietnamDateYmd,
    createVietnamMidnightDate,
    computeDefenseTimeWindows,
    roundDefenseScoreOneDecimal,
    buildArchiveDeadlineSummary,
};
