const { StudentGender } = require('@prisma/client');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{8,20}$/;
const DD_MM_YYYY_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Maps raw gender string to StudentGender enum (MALE, FEMALE, OTHER).
 * Returns null if unrecognized.
 */
const mapGender = (rawGender) => {
    if (!rawGender || typeof rawGender !== 'string') return null;
    const normalized = rawGender.trim().toLowerCase();

    if (['nam', 'male'].includes(normalized)) {
        return StudentGender.MALE || 'MALE';
    }
    if (['nữ', 'nu', 'female'].includes(normalized)) {
        return StudentGender.FEMALE || 'FEMALE';
    }
    if (['khác', 'khac', 'other'].includes(normalized)) {
        return StudentGender.OTHER || 'OTHER';
    }
    return null;
};

/**
 * Parses strict DD/MM/YYYY string, numeric Excel serial date, or Date object.
 * Returns { date: Date | null, isFuture: boolean, isInvalid: boolean, isMissing: boolean }.
 */
const parseDateOfBirth = (rawDate) => {
    if (rawDate === undefined || rawDate === null || rawDate === '') {
        return { date: null, isFuture: false, isInvalid: false, isMissing: true };
    }

    let parsedDate = null;

    if (rawDate instanceof Date) {
        if (isNaN(rawDate.getTime())) {
            return { date: null, isFuture: false, isInvalid: true, isMissing: false };
        }
        parsedDate = rawDate;
    } else if (typeof rawDate === 'number') {
        // Excel serial date support
        if (rawDate > 0) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            parsedDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
        } else {
            return { date: null, isFuture: false, isInvalid: true, isMissing: false };
        }
    } else if (typeof rawDate === 'string') {
        const trimmed = rawDate.trim();
        if (trimmed === '') {
            return { date: null, isFuture: false, isInvalid: false, isMissing: true };
        }

        const match = trimmed.match(DD_MM_YYYY_REGEX);
        if (!match) {
            // Excel serial date as numeric string (e.g. "38214")
            const num = Number(trimmed);
            if (!isNaN(num) && num > 1000 && num < 100000 && !trimmed.includes('/')) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                parsedDate = new Date(excelEpoch.getTime() + num * 86400000);
            } else {
                return { date: null, isFuture: false, isInvalid: true, isMissing: false };
            }
        } else {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const year = parseInt(match[3], 10);

            if (month < 1 || month > 12 || year < 1900) {
                return { date: null, isFuture: false, isInvalid: true, isMissing: false };
            }

            const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

            if (day < 1 || day > daysInMonth[month - 1]) {
                return { date: null, isFuture: false, isInvalid: true, isMissing: false };
            }

            parsedDate = new Date(Date.UTC(year, month - 1, day));
        }
    } else {
        return { date: null, isFuture: false, isInvalid: true, isMissing: false };
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
        return { date: null, isFuture: false, isInvalid: true, isMissing: false };
    }

    const now = new Date();
    if (parsedDate >= now) {
        return { date: parsedDate, isFuture: true, isInvalid: false, isMissing: false };
    }

    return { date: parsedDate, isFuture: false, isInvalid: false, isMissing: false };
};

/**
 * Normalizes student payload fields and resolves aliases.
 */
const normalizeStudentPayload = (input = {}) => {
    const rawCode = input.code || input.mssv || input.MSSV
        || input['MSSV (*)'] || input['MSSV'] || input['Mã SV (*)'] || input['Mã SV'] || input['Mã số'] || '';
    const code = String(rawCode).trim().toUpperCase();

    const rawFullName = input.fullName || input.hoTen || input.name
        || input['Họ và tên (*)'] || input['Họ và tên'] || input['Họ tên'] || '';
    const fullName = String(rawFullName).trim();

    const rawEmail = input.email || input['Email (*)'] || input['Email'] || '';
    const email = String(rawEmail).trim().toLowerCase();

    const rawPhone = input.phone || input.soDienThoai || input.sdt
        || input['Số điện thoại (*)'] || input['Số điện thoại'] || input['SĐT'] || '';
    const phone = String(rawPhone).trim();

    const rawGender = input.gender || input.gioiTinh
        || input['Giới tính (*)'] || input['Giới tính'] || '';
    const gender = mapGender(rawGender);

    const rawDob = input.dateOfBirth !== undefined ? input.dateOfBirth
        : input.ngaySinh !== undefined ? input.ngaySinh
        : input.dob !== undefined ? input.dob
        : input.DOB !== undefined ? input.DOB
        : input['Ngày sinh (*)'] !== undefined ? input['Ngày sinh (*)']
        : input['Ngày sinh'];
    const dobResult = parseDateOfBirth(rawDob);
    const dateOfBirth = dobResult.date;

    const rawClassName = input.className || input.lop || input.class
        || input['Lớp (*)'] || input['Lớp'] || '';
    const className = String(rawClassName).trim();

    const rawMajor = input.major || input.nganh || input.chuyenNganh
        || input['Ngành (*)'] || input['Ngành'] || '';
    const major = String(rawMajor).trim();

    return {
        user: {
            code,
            fullName,
            email,
            phone,
            role: 'STUDENT',
            department: null,
        },
        studentProfile: {
            gender,
            dateOfBirth,
            className,
            major,
        },
        code,
        fullName,
        email,
        phone,
        gender,
        dateOfBirth,
        className,
        major,
        _rawDob: rawDob,
        _dobResult: dobResult,
        _rawGender: rawGender,
    };
};

/**
 * Validates student payload against required academic rules.
 * Throws on error unless options.throwOnError === false.
 */
const validateStudentPayload = (input = {}, options = {}) => {
    const throwOnError = options.throwOnError !== false;
    const normalized = normalizeStudentPayload(input);
    const errors = [];

    // 1. Student code (MSSV)
    if (!normalized.code) {
        errors.push('Mã số sinh viên là bắt buộc.');
    }

    // 2. Full name
    if (!normalized.fullName) {
        errors.push('Họ và tên là bắt buộc.');
    }

    // 3. Email
    if (!normalized.email) {
        errors.push('Email là bắt buộc.');
    } else if (!EMAIL_REGEX.test(normalized.email)) {
        errors.push('Email không hợp lệ.');
    }

    // 4. Phone
    if (!normalized.phone) {
        errors.push('Số điện thoại là bắt buộc.');
    } else if (!PHONE_REGEX.test(normalized.phone)) {
        errors.push('Số điện thoại không hợp lệ.');
    }

    // 5. Gender
    if (!normalized._rawGender || String(normalized._rawGender).trim() === '') {
        errors.push('Giới tính là bắt buộc.');
    } else if (!normalized.studentProfile.gender) {
        errors.push('Giới tính không hợp lệ.');
    }

    // 6. Date of birth
    if (normalized._dobResult.isMissing) {
        errors.push('Ngày sinh là bắt buộc.');
    } else if (normalized._dobResult.isInvalid) {
        errors.push('Ngày sinh không hợp lệ.');
    } else if (normalized._dobResult.isFuture) {
        errors.push('Ngày sinh phải là ngày trong quá khứ.');
    }

    // 7. Class name
    if (!normalized.studentProfile.className) {
        errors.push('Lớp là bắt buộc.');
    }

    // 8. Major
    if (!normalized.studentProfile.major) {
        errors.push('Ngành là bắt buộc.');
    }

    if (errors.length > 0) {
        if (throwOnError) {
            const error = new Error(errors[0]);
            error.errors = errors;
            error.statusCode = 400;
            throw error;
        }
        return {
            isValid: false,
            errors,
            data: null,
            normalized,
        };
    }

    const result = {
        user: normalized.user,
        studentProfile: normalized.studentProfile,
    };

    if (!throwOnError) {
        return {
            isValid: true,
            errors: [],
            data: result,
            normalized,
        };
    }

    return result;
};

module.exports = {
    mapGender,
    parseDateOfBirth,
    normalizeStudentPayload,
    validateStudentPayload,
};
