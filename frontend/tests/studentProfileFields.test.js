import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('UserManagementPage exposes optional academicYear and placeOfBirth fields for STUDENT', () => {
    const source = read('src/pages/admin/UserManagementPage.jsx');

    assert.ok(source.includes('name="academicYear"'), 'Form must include academicYear field');
    assert.ok(source.includes('Khóa đào tạo'), 'Form/drawer must label academicYear as Khóa đào tạo');
    assert.ok(source.includes('name="placeOfBirth"'), 'Form must include placeOfBirth field');
    assert.ok(source.includes('Nơi sinh'), 'Form/drawer must label placeOfBirth as Nơi sinh');

    assert.ok(
        source.includes('initial.academicYear') && source.includes('initial.placeOfBirth'),
        'checkUserFormChanged must track academicYear and placeOfBirth'
    );
    assert.ok(
        source.includes('record.studentProfile?.academicYear') && source.includes('record.studentProfile?.placeOfBirth'),
        'handleEdit must populate academicYear and placeOfBirth from studentProfile'
    );

    const academicYearBlock = source.slice(
        source.indexOf('name="academicYear"'),
        source.indexOf('name="academicYear"') + 260
    );
    const placeOfBirthBlock = source.slice(
        source.indexOf('name="placeOfBirth"'),
        source.indexOf('name="placeOfBirth"') + 260
    );
    assert.ok(!academicYearBlock.includes('required: true'), 'academicYear must be optional');
    assert.ok(!placeOfBirthBlock.includes('required: true'), 'placeOfBirth must be optional');
});
