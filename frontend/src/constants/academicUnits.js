export const LECTURER_DEPARTMENTS = [
    'Công Nghệ Thông Tin',
    'Hệ thống Thông tin',
];

export const STUDENT_MAJORS = [
    'Công Nghệ Thông Tin',
    'Kỹ thuật Phần mềm',
    'Hệ thống Thông tin',
    'Trí Tuệ Nhân Tạo',
];

export const LECTURER_DEPARTMENT_OPTIONS = LECTURER_DEPARTMENTS.map((dept) => ({
    value: dept,
    label: dept,
}));

export const STUDENT_MAJOR_OPTIONS = STUDENT_MAJORS.map((major) => ({
    value: major,
    label: major,
}));
