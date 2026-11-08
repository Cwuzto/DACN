const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{8,20}$/;
const DD_MM_YYYY_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export const CANONICAL_STUDENT_COLUMNS = [
    'MSSV (*)',
    'Họ và tên (*)',
    'Giới tính (*)',
    'Ngày sinh (*)',
    'Số điện thoại (*)',
    'Lớp (*)',
    'Email (*)',
    'Ngành (*)',
];

export const STUDENT_SAMPLE_ROWS = [
    {
        'MSSV (*)': 'SV20260001',
        'Họ và tên (*)': 'Nguyễn Văn An',
        'Giới tính (*)': 'Nam',
        'Ngày sinh (*)': '15/08/2004',
        'Số điện thoại (*)': '0901234567',
        'Lớp (*)': 'D20CNTT01',
        'Email (*)': 'sv20260001@student.tdmu.edu.vn',
        'Ngành (*)': 'Kỹ thuật Phần mềm',
    },
    {
        'MSSV (*)': 'SV20260002',
        'Họ và tên (*)': 'Trần Thị Bình',
        'Giới tính (*)': 'Nữ',
        'Ngày sinh (*)': '20/11/2004',
        'Số điện thoại (*)': '0909876543',
        'Lớp (*)': 'D20CNTT02',
        'Email (*)': 'sv20260002@student.tdmu.edu.vn',
        'Ngành (*)': 'Hệ thống Thông tin',
    },
    {
        'MSSV (*)': 'SV20260003',
        'Họ và tên (*)': 'Lê Hoàng Cường',
        'Giới tính (*)': 'Nam',
        'Ngày sinh (*)': '05/03/2003',
        'Số điện thoại (*)': '0912345678',
        'Lớp (*)': 'D20HTTT01',
        'Email (*)': 'sv20260003@student.tdmu.edu.vn',
        'Ngành (*)': 'Công nghệ Thông tin',
    },
    {
        'MSSV (*)': 'SV20260004',
        'Họ và tên (*)': 'Phạm Minh Đức',
        'Giới tính (*)': 'Nam',
        'Ngày sinh (*)': '12/09/2004',
        'Số điện thoại (*)': '0987654321',
        'Lớp (*)': 'D20KTPM01',
        'Email (*)': 'sv20260004@student.tdmu.edu.vn',
        'Ngành (*)': 'Kỹ thuật Phần mềm',
    },
    {
        'MSSV (*)': 'SV20260005',
        'Họ và tên (*)': 'Võ Thị Ánh Nguyệt',
        'Giới tính (*)': 'Nữ',
        'Ngày sinh (*)': '28/02/2003',
        'Số điện thoại (*)': '0933456789',
        'Lớp (*)': 'D20KTPM02',
        'Email (*)': 'sv20260005@student.tdmu.edu.vn',
        'Ngành (*)': 'Khoa học Máy tính',
    },
];

/**
 * Maps raw gender string to display/contract gender ('Nam', 'Nữ', 'Khác')
 */
export const normalizeGender = (rawGender) => {
    if (!rawGender || typeof rawGender !== 'string') return null;
    const lower = rawGender.trim().toLowerCase();
    if (['nam', 'male', 'm'].includes(lower)) return 'Nam';
    if (['nữ', 'nu', 'female', 'f'].includes(lower)) return 'Nữ';
    if (['khác', 'khac', 'other'].includes(lower)) return 'Khác';
    return null;
};

/**
 * Parses and formats date of birth to strict DD/MM/YYYY.
 * Returns { formatted: string, isValid: boolean, error?: string }
 */
export const parseAndValidateDateOfBirth = (rawDate) => {
    if (rawDate === undefined || rawDate === null || rawDate === '') {
        return { formatted: '', isValid: false, error: 'Thiếu ngày sinh' };
    }

    let day;
    let month;
    let year;

    if (rawDate instanceof Date) {
        if (isNaN(rawDate.getTime())) {
            return { formatted: '', isValid: false, error: 'Ngày sinh không hợp lệ' };
        }
        day = rawDate.getUTCDate();
        month = rawDate.getUTCMonth() + 1;
        year = rawDate.getUTCFullYear();
    } else if (typeof rawDate === 'number') {
        if (rawDate <= 0) {
            return { formatted: '', isValid: false, error: 'Ngày sinh không hợp lệ' };
        }
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const dateObj = new Date(excelEpoch.getTime() + rawDate * 86400000);
        day = dateObj.getUTCDate();
        month = dateObj.getUTCMonth() + 1;
        year = dateObj.getUTCFullYear();
    } else if (typeof rawDate === 'string') {
        const trimmed = rawDate.trim();
        if (!trimmed) {
            return { formatted: '', isValid: false, error: 'Thiếu ngày sinh' };
        }

        const match = trimmed.match(DD_MM_YYYY_REGEX);
        if (!match) {
            // Check numeric string representing Excel serial
            const num = Number(trimmed);
            if (!isNaN(num) && num > 1000 && num < 100000 && !trimmed.includes('/')) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const dateObj = new Date(excelEpoch.getTime() + num * 86400000);
                day = dateObj.getUTCDate();
                month = dateObj.getUTCMonth() + 1;
                year = dateObj.getUTCFullYear();
            } else {
                return { formatted: trimmed, isValid: false, error: 'Ngày sinh phải có định dạng DD/MM/YYYY' };
            }
        } else {
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            year = parseInt(match[3], 10);
        }
    } else {
        return { formatted: '', isValid: false, error: 'Ngày sinh không hợp lệ' };
    }

    if (month < 1 || month > 12 || year < 1900) {
        return { formatted: '', isValid: false, error: 'Ngày sinh không hợp lệ' };
    }

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (day < 1 || day > daysInMonth[month - 1]) {
        return { formatted: '', isValid: false, error: 'Ngày sinh không hợp lệ' };
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate >= new Date()) {
        return {
            formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
            isValid: false,
            error: 'Ngày sinh phải là ngày trong quá khứ',
        };
    }

    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    return { formatted, isValid: true };
};

/**
 * Validates a single student row
 */
export const validateStudentRow = (row, seenCodes = new Set(), seenEmails = new Set()) => {
    const errors = [];

    // 1. MSSV (code)
    const code = String(row.code || '').trim().toUpperCase();
    if (!code) {
        errors.push('Thiếu MSSV');
    } else if (seenCodes.has(code)) {
        errors.push('Mã số sinh viên bị trùng lặp trong file');
    }

    // 2. Full Name
    const fullName = String(row.fullName || '').trim();
    if (!fullName) {
        errors.push('Thiếu họ và tên');
    }

    // 3. Gender
    const rawGender = String(row.gender || '').trim();
    if (!rawGender) {
        errors.push('Thiếu giới tính');
    } else {
        const normalizedGender = normalizeGender(rawGender);
        if (!normalizedGender) {
            errors.push('Giới tính không hợp lệ (phải là Nam, Nữ hoặc Khác)');
        }
    }

    // 4. Date of birth
    const rawDob = row.dateOfBirth;
    const dobResult = parseAndValidateDateOfBirth(rawDob);
    if (!dobResult.isValid) {
        errors.push(dobResult.error || 'Ngày sinh không đúng định dạng DD/MM/YYYY');
    }

    // 5. Phone
    const phone = String(row.phone || '').trim();
    if (!phone) {
        errors.push('Thiếu số điện thoại');
    } else if (!PHONE_REGEX.test(phone)) {
        errors.push('Số điện thoại không đúng định dạng');
    }

    // 6. Class name
    const className = String(row.className || '').trim();
    if (!className) {
        errors.push('Thiếu lớp');
    }

    // 7. Email
    const email = String(row.email || '').trim().toLowerCase();
    if (!email) {
        errors.push('Thiếu email');
    } else if (!EMAIL_REGEX.test(email)) {
        errors.push('Email không đúng định dạng');
    } else if (seenEmails.has(email)) {
        errors.push('Email bị trùng lặp trong file');
    }

    // 8. Major
    const major = String(row.major || '').trim();
    if (!major) {
        errors.push('Thiếu ngành');
    }

    return errors;
};
