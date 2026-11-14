import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readBuffer = (relativePath) => fs.readFileSync(path.join(root, relativePath));

const TARGET_FILES = [
    'src/pages/common/ProfilePage.jsx',
    'src/components/profile/PasswordStrengthMeter.jsx',
    'src/components/profile/ProfileQuickMetrics.jsx',
];

test('Profile Redesign: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        assert.ok(fs.existsSync(fullPath), `Tệp ${filePath} phải tồn tại`);
        const buffer = readBuffer(filePath);
        const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.strictEqual(hasBom, false, `Tệp ${filePath} không được chứa BOM`);
    });
});

test('Profile Redesign: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const rawEmojiPattern = /<Button\b[^>]*>[\s\S]*?[^\x00-\x7F\u00C0-\u024F\u1EA0-\u1EF9\s,.:;()\/_'"\-\[\]{}0-9a-zA-Z]/g;
    const forbiddenSymbols = ['←', '→', '+', '🤖', '📋', '✓', '✏️', '👥', '🗑️', '🔓', '▾', '▴', '↗', '⚡', '🔐', '🛡️', '📊'];

    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        if (!fs.existsSync(fullPath)) return;
        const source = read(filePath);
        const buttonMatches = source.match(/<Button\b[^>]*>[\s\S]*?<\/Button>/g) || [];
        buttonMatches.forEach((btn) => {
            forbiddenSymbols.forEach((sym) => {
                assert.ok(
                    !btn.includes(sym),
                    `Nút bấm trong ${filePath} chứa ký tự thô/emoji cấm '${sym}': ${btn}`
                );
            });
        });
    });
});

test('Profile Redesign: Hero Profile Banner renders cover banner, avatar ring, and institutional badge', () => {
    const source = read('src/pages/common/ProfilePage.jsx');

    // Cover banner and avatar ring
    assert.match(source, /from-blue-600|bg-gradient-to-r|cover/i, 'Hero banner phải có gradient bìa học thuật');
    assert.match(source, /ring-|border-white|shadow/i, 'Avatar phải có hiệu ứng viền nổi');
    assert.match(source, /Viện CNS|Viện Công nghệ Số|Định danh chính thức/i, 'Phải có huy hiệu định danh Viện CNS');
    assert.match(source, /Badge\s+status="success"|Badge\s+status='success'|Đang hoạt động/i, 'Phải có chỉ báo trạng thái hoạt động trực tuyến');
});

test('Profile Redesign: Integrates ProfileQuickMetrics with 4 academic KPI cards', () => {
    const source = read('src/pages/common/ProfilePage.jsx');
    assert.match(source, /ProfileQuickMetrics/, 'ProfilePage phải tích hợp ProfileQuickMetrics');

    const metricsSource = read('src/components/profile/ProfileQuickMetrics.jsx');
    assert.match(metricsSource, /Trạng thái tài khoản|Tài khoản/i);
    assert.match(metricsSource, /Định danh học vụ|Chuyên ngành|Đơn vị/i);
    assert.match(metricsSource, /Quyền hạn|Nhóm quyền/i);
    assert.match(metricsSource, /Hoàn thiện hồ sơ|Mức độ hoàn thiện/i);
});

test('Profile Redesign: Defines 3 specialized tabs (personal_academic, security_password, roles_permissions)', () => {
    const source = read('src/pages/common/ProfilePage.jsx');
    assert.match(source, /personal_academic/, 'Phải có tab personal_academic');
    assert.match(source, /security_password/, 'Phải có tab security_password');
    assert.match(source, /roles_permissions/, 'Phải có tab roles_permissions');
    assert.match(source, /Thông tin cá nhân & Học vụ|Thông tin cá nhân/i);
    assert.match(source, /Bảo mật & Quản lý phiên|Bảo mật & Mật khẩu/i);
    assert.match(source, /Vai trò & Quyền hạn/i);
});

test('Profile Redesign: Tab 1 separates read-only academic data from editable contact data', () => {
    const source = read('src/pages/common/ProfilePage.jsx');
    // Institutional notice for academic data
    assert.match(source, /đồng bộ|Quản lý Đào tạo|CSDL Nhà trường/i, 'Phải có chú thích dữ liệu đồng bộ từ CSDL Nhà trường');
    // Class and major read-only references
    assert.match(source, /className|studentProfile\?\.className/);
    assert.match(source, /major|studentProfile\?\.major/);
    assert.match(source, /Lớp/);
    assert.match(source, /Ngành/);
    // Student edit boundary
    assert.match(source, /isStudent|user\?\.role === 'STUDENT'/);
    assert.match(source, /!isStudent|user\?\.role !== 'STUDENT'/);
});

test('Profile Redesign: Tab 2 integrates PasswordStrengthMeter and session information', () => {
    const source = read('src/pages/common/ProfilePage.jsx');
    assert.match(source, /PasswordStrengthMeter/, 'ProfilePage phải tích hợp PasswordStrengthMeter');
    assert.match(source, /Phiên làm việc|JWT|Thời hạn phiên|Ghi nhớ/i, 'Tab 2 phải có thông tin phiên làm việc');

    const meterSource = read('src/components/profile/PasswordStrengthMeter.jsx');
    assert.match(meterSource, /Yếu|Trung bình|Mạnh/i, 'PasswordStrengthMeter phải hiển thị 3 cấp độ độ mạnh');
    assert.match(meterSource, /Progress/, 'PasswordStrengthMeter phải dùng Progress bar');
});

test('Profile Redesign: Tab 3 renders permission groups and council assignment status', () => {
    const source = read('src/pages/common/ProfilePage.jsx');
    assert.match(source, /permissionGroups/, 'Tab 3 phải hiển thị permissionGroups');
    assert.match(source, /hasOutlineCouncilAssignment|OUTLINE_REVIEW/i, 'Tab 3 phải hiển thị trạng thái HĐ Đề cương');
    assert.match(source, /hasDefenseCouncilAssignment|DEFENSE_COUNCIL/i, 'Tab 3 phải hiển thị trạng thái HĐ Bảo vệ');
});
