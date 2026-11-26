const LECTURER_DEPARTMENTS = Object.freeze([
    'Công Nghệ Thông Tin',
    'Hệ thống Thông tin',
]);

const STUDENT_MAJORS = Object.freeze([
    'Công Nghệ Thông Tin',
    'Kỹ thuật Phần mềm',
    'Hệ thống Thông tin',
    'Trí Tuệ Nhân Tạo',
]);

const collapseSpaces = (value) => String(value).trim().replace(/\s+/g, ' ');

const normalizeLecturerDepartment = (value) => {
    if (typeof value !== 'string') return null;
    const cleaned = collapseSpaces(value)
        .toLocaleLowerCase('vi-VN')
        .replace(/^bộ\s*môn\s+/, '')
        .trim();
    if (!cleaned) return null;

    return (
        LECTURER_DEPARTMENTS.find(
            (department) => department.toLocaleLowerCase('vi-VN') === cleaned
        ) || null
    );
};

const normalizeStudentMajor = (value) => {
    if (typeof value !== 'string') return null;
    const cleaned = collapseSpaces(value).toLocaleLowerCase('vi-VN');
    if (!cleaned) return null;

    return (
        STUDENT_MAJORS.find(
            (major) => major.toLocaleLowerCase('vi-VN') === cleaned
        ) || null
    );
};

module.exports = {
    LECTURER_DEPARTMENTS,
    STUDENT_MAJORS,
    normalizeLecturerDepartment,
    normalizeStudentMajor,
};
