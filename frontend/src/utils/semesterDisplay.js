export const PROJECT_NAME = 'Đồ án tốt nghiệp';

const parseTermFromName = (name = '') => {
    const normalized = String(name);
    const match = normalized.match(/(?:HK|Học\s*kỳ)\s*([12])/i);
    return match ? Number.parseInt(match[1], 10) : null;
};

const parseAcademicYearFromName = (name = '') => {
    const match = String(name).match(/(20\d{2})\s*[-/]\s*(20\d{2})/);
    if (!match) return null;
    return `${match[1]}-${match[2]}`;
};

const deriveTermFromDate = (startDate) => {
    if (!startDate) return 1;
    const d = new Date(startDate);
    const month = d.getMonth() + 1;
    // Aug-Jan => HK1, Feb-Jul => HK2
    return month >= 8 || month === 1 ? 1 : 2;
};

const deriveAcademicYearFromDate = (startDate, term = 1) => {
    const d = startDate ? new Date(startDate) : new Date();
    const y = d.getFullYear();
    const startYear = term === 1 ? y : y - 1;
    return `${startYear}-${startYear + 1}`;
};

export const extractSemesterMeta = (semester) => {
    const term = parseTermFromName(semester?.name) || deriveTermFromDate(semester?.startDate);
    const academicYear = parseAcademicYearFromName(semester?.name)
        || deriveAcademicYearFromDate(semester?.startDate, term);

    return { term, academicYear };
};

export const buildSemesterName = ({ term, academicYear }) => {
    return `${PROJECT_NAME} - HK${term} ${academicYear}`;
};

export const buildSemesterCode = ({ projectCode = 'DATN', term = 1, academicYear = '', round = null } = {}) => {
    let yearPart = academicYear;
    const match = String(academicYear || '').match(/(20\d{2})\s*[-/–]\s*(20\d{2})/);
    if (match) {
        const startYear = match[1];
        const endYearShort = match[2].slice(-2);
        yearPart = `${startYear}-${endYearShort}`;
    }
    const base = `${projectCode}-HK${term}-${yearPart}`;
    return round ? `${base}-D${round}` : base;
};

export const formatSemesterLabel = (semester) => {
    const { term, academicYear } = extractSemesterMeta(semester);
    return `Học kỳ ${term} - ${academicYear}`;
};

export const computeSemesterClosestToNow = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return null;

    const now = new Date();
    const scored = list
        .map((semester) => {
            const start = semester.startDate ? new Date(semester.startDate) : null;
            const end = semester.endDate ? new Date(semester.endDate) : null;
            const defense = semester.defenseDate ? new Date(semester.defenseDate) : null;

            let distanceToNow = Number.POSITIVE_INFINITY;
            [start, end, defense].forEach((point) => {
                if (point && !Number.isNaN(point.getTime())) {
                    const diff = Math.abs(point.getTime() - now.getTime());
                    if (diff < distanceToNow) distanceToNow = diff;
                }
            });

            return {
                semester,
                distanceToNow,
            };
        })
        .sort((a, b) => a.distanceToNow - b.distanceToNow);

    return scored[0]?.semester?.id || null;
};

export const getClosestSemester = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const closestId = computeSemesterClosestToNow(list);
    return list.find((s) => s.id === closestId) || list[0] || null;
};

export const resolveCurrentSemester = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return null;

    try {
        const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_semester_id') : null;
        if (storedId) {
            const found = list.find((s) => String(s.id) === String(storedId));
            if (found) return found;
        }
    } catch {}

    const now = new Date();

    // 1. Semester currently active by time window (startDate <= now <= endDate) and not completed
    const currentlyRunning = list.filter((s) => {
        if (!s.startDate || !s.endDate) return false;
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return now >= start && now <= end && s.status !== 'COMPLETED';
    });

    if (currentlyRunning.length > 0) {
        // Prefer "Chính khóa" or "Đợt 1" if available
        const mainPeriod = currentlyRunning.find((s) =>
            s.name?.includes('Chính khóa') || s.name?.includes('Đợt 1') || s.code?.includes('D1')
        );
        if (mainPeriod) return mainPeriod;
        return currentlyRunning[0];
    }

    // 2. Semesters with active statuses (REGISTRATION, ONGOING, DEFENSE, IN_PROGRESS)
    const activeStatusSemesters = list.filter((s) =>
        ['REGISTRATION', 'IN_PROGRESS', 'DEFENSE', 'ONGOING'].includes(s.status)
    );
    if (activeStatusSemesters.length > 0) {
        const mainActive = activeStatusSemesters.find((s) =>
            s.name?.includes('Chính khóa') || s.name?.includes('Đợt 1') || s.code?.includes('D1')
        );
        if (mainActive) return mainActive;
        return activeStatusSemesters[0];
    }

    // 3. Fallback to closest semester or first item
    return getClosestSemester(list) || list[0] || null;
};

