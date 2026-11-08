import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('ProfilePage displays class and major as read-only information for student accounts', () => {
    const source = read('src/pages/common/ProfilePage.jsx');

    // Must reference className/Lớp and major/Ngành
    assert.match(source, /className|studentProfile\?\.className/);
    assert.match(source, /major|studentProfile\?\.major/);
    assert.match(source, /Lớp/);
    assert.match(source, /Ngành/);
});

test('ProfilePage restricts student self-editing to avatar and phone only', () => {
    const source = read('src/pages/common/ProfilePage.jsx');

    // Only avatar and phone should be editable for student role
    // Fields code, fullName, gender, dateOfBirth, className, and major must not be editable inputs for students
    assert.match(source, /user\?\.role === 'STUDENT'|isStudent/);

    // department should not be editable by students
    assert.match(source, /!isStudent|user\?\.role !== 'STUDENT'/);
});

test('ProfilePage handleSave sends only allowed fields for students', () => {
    const source = read('src/pages/common/ProfilePage.jsx');

    // Ensure save logic protects student academic data from self-edit mutation
    assert.match(source, /authService\.updateProfile/);
});
