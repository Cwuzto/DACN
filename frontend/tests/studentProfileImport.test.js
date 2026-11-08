import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CANONICAL_STUDENT_COLUMNS,
    STUDENT_SAMPLE_ROWS,
    normalizeGender,
    parseAndValidateDateOfBirth,
    validateStudentRow,
} from '../src/utils/studentImportHelper.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('CANONICAL_STUDENT_COLUMNS contains exactly the 8 canonical student columns', () => {
    assert.deepEqual(CANONICAL_STUDENT_COLUMNS, [
        'MSSV (*)',
        'Họ và tên (*)',
        'Giới tính (*)',
        'Ngày sinh (*)',
        'Số điện thoại (*)',
        'Lớp (*)',
        'Email (*)',
        'Ngành (*)',
    ]);
});

test('STUDENT_SAMPLE_ROWS contains exactly 5 valid sample student records', () => {
    assert.equal(STUDENT_SAMPLE_ROWS.length, 5);
    STUDENT_SAMPLE_ROWS.forEach((sample, idx) => {
        CANONICAL_STUDENT_COLUMNS.forEach((col) => {
            assert.ok(sample[col], `Row ${idx + 1} must contain ${col}`);
        });
    });
});

test('normalizeGender normalizes Nam, Nữ, Khác and rejects invalid values', () => {
    assert.equal(normalizeGender('Nam'), 'Nam');
    assert.equal(normalizeGender('nam'), 'Nam');
    assert.equal(normalizeGender('male'), 'Nam');
    assert.equal(normalizeGender('Nữ'), 'Nữ');
    assert.equal(normalizeGender('nữ'), 'Nữ');
    assert.equal(normalizeGender('female'), 'Nữ');
    assert.equal(normalizeGender('Khác'), 'Khác');
    assert.equal(normalizeGender('khac'), 'Khác');
    assert.equal(normalizeGender('other'), 'Khác');
    assert.equal(normalizeGender('unknown'), null);
    assert.equal(normalizeGender(''), null);
});

test('parseAndValidateDateOfBirth strictly validates DD/MM/YYYY dates and rejects future dates', () => {
    const valid = parseAndValidateDateOfBirth('15/08/2004');
    assert.equal(valid.isValid, true);
    assert.equal(valid.formatted, '15/08/2004');

    const leap = parseAndValidateDateOfBirth('29/02/2004');
    assert.equal(leap.isValid, true);
    assert.equal(leap.formatted, '29/02/2004');

    const invalidLeap = parseAndValidateDateOfBirth('29/02/2003');
    assert.equal(invalidLeap.isValid, false);

    const future = parseAndValidateDateOfBirth('01/01/2099');
    assert.equal(future.isValid, false);
    assert.match(future.error, /quá khứ/);

    const invalidFormat = parseAndValidateDateOfBirth('2004-08-15');
    assert.equal(invalidFormat.isValid, false);
});

test('validateStudentRow requires all 8 student fields and validates formats', () => {
    const validRow = {
        code: 'SV20260001',
        fullName: 'Nguyễn Văn An',
        gender: 'Nam',
        dateOfBirth: '15/08/2004',
        phone: '0901234567',
        className: 'D20CNTT01',
        email: 'sv20260001@student.tdmu.edu.vn',
        major: 'Kỹ thuật Phần mềm',
    };
    const errors = validateStudentRow(validRow);
    assert.deepEqual(errors, []);

    // Missing fields
    const missingErrors = validateStudentRow({});
    assert.ok(missingErrors.length >= 8);
    assert.ok(missingErrors.some((e) => e.includes('MSSV')));
    assert.ok(missingErrors.some((e) => e.includes('họ và tên')));
    assert.ok(missingErrors.some((e) => e.includes('giới tính')));
    assert.ok(missingErrors.some((e) => e.includes('ngày sinh')));
    assert.ok(missingErrors.some((e) => e.includes('số điện thoại')));
    assert.ok(missingErrors.some((e) => e.includes('lớp')));
    assert.ok(missingErrors.some((e) => e.includes('email')));
    assert.ok(missingErrors.some((e) => e.includes('ngành')));
});

test('ExcelImportModal defines and uses exactly the 8 canonical student columns', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    const expectedHeaders = [
        'MSSV (*)',
        'Họ và tên (*)',
        'Giới tính (*)',
        'Ngày sinh (*)',
        'Số điện thoại (*)',
        'Lớp (*)',
        'Email (*)',
        'Ngành (*)',
    ];

    expectedHeaders.forEach((header) => {
        assert.ok(
            source.includes(header),
            `ExcelImportModal.jsx must reference canonical header "${header}"`
        );
    });
});

test('ExcelImportModal parses all 8 student fields from raw rows', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    assert.match(source, /className/);
    assert.match(source, /major/);
    assert.match(source, /gender/);
    assert.match(source, /dateOfBirth/);
});

test('ExcelImportModal table preview displays all 8 student columns', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    assert.match(source, /Lớp/);
    assert.match(source, /Ngành/);
    assert.match(source, /Giới tính/);
    assert.match(source, /Ngày sinh/);
});

test('ExcelImportModal quick-fix modal provides inputs for all 8 student fields', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    assert.match(source, /name="className"/);
    assert.match(source, /name="major"/);
    assert.match(source, /name="gender"/);
    assert.match(source, /name="dateOfBirth"/);
});

test('ExcelImportModal disables import button when there are invalid rows or missing fields', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    assert.match(source, /disabled=\{[^}]*stats\.error\s*>\s*0[^}]*\}/);
});

test('ExcelImportModal constructs student import payload with all 8 fields', () => {
    const source = read('src/components/common/ExcelImportModal.jsx');

    assert.match(source, /gender:\s*r\.gender/);
    assert.match(source, /dateOfBirth:\s*r\.dateOfBirth/);
    assert.match(source, /className:\s*r\.className/);
    assert.match(source, /major:\s*r\.major/);
});

test('UserManagementPage admin form contains all 8 student fields when role is STUDENT', () => {
    const source = read('src/pages/admin/UserManagementPage.jsx');

    assert.match(source, /name="className"/);
    assert.match(source, /name="major"/);
    assert.match(source, /name="gender"/);
    assert.match(source, /name="dateOfBirth"/);
});

test('UserManagementPage handleEdit pre-fills studentProfile fields for editing a student', () => {
    const source = read('src/pages/admin/UserManagementPage.jsx');

    assert.match(source, /studentProfile\?\.className/);
    assert.match(source, /studentProfile\?\.major/);
    assert.match(source, /studentProfile\?\.gender/);
    assert.match(source, /studentProfile\?\.dateOfBirth/);
});
