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
