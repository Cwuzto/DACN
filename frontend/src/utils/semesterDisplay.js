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
    return `Học kỳ ${term} - Năm học ${academicYear}`;
};
