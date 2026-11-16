import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(root, 'src/pages/admin/PermissionGroupPage.jsx');
const pageSource = fs.readFileSync(pagePath, 'utf8');

test('PermissionGroupPage complies with Rule 2.4 (UTF-8 no BOM)', () => {
    const buffer = fs.readFileSync(pagePath);
    // BOM for UTF-8 is 0xEF, 0xBB, 0xBF
    const hasBOM = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
    assert.equal(hasBOM, false, 'PermissionGroupPage.jsx must be saved in UTF-8 without BOM');
});

test('PermissionGroupPage eliminates database jargon and robotic phrases', () => {
    // Prohibited technical jargon
    const prohibitedTerms = [
        'RBAC MATRIX',
        '2-Tier Architecture',
        'Từ Điển Quyền Nguyên Tử',
        'Quyền nguyên tử',
        'Atomic',
        'mã kiểm soát catalog',
        'Mã kiểm soát catalog',
        'Chống Vượt quyền',
        'chống vượt quyền',
        'chống leo thang đặc quyền',
        'Gộp mã alias (khuyến nghị)',
    ];

    prohibitedTerms.forEach((term) => {
        assert.equal(
            pageSource.includes(term),
            false,
            `PermissionGroupPage should not contain technical jargon: "${term}"`
        );
    });
});

test('PermissionGroupPage uses clean, human-friendly educational management vocabulary', () => {
    const friendlyTerms = [
        'QUẢN TRỊ HỆ THỐNG • PHÂN QUYỀN TRUY CẬP',
        'Phân Quyền &amp; Vai Trò Người Dùng',
        'Bảng Phân Quyền Theo Vai Trò',
        'Nhóm Vai Trò &amp; Phân Cấp',
        'Danh Mục Chức Năng Hệ Thống',
        'Chức năng học vụ chuyên môn',
        'Chức năng quản trị vận hành',
        'Quy chế bảo vệ',
        'Thực hiện tác vụ',
        'Xem dữ liệu & Báo cáo',
        'Tất cả lĩnh vực công tác',
        'Lưu thay đổi',
    ];

    friendlyTerms.forEach((term) => {
        assert.ok(
            pageSource.includes(term),
            `PermissionGroupPage must contain human-friendly term: "${term}"`
        );
    });
});

test('PermissionGroupPage satisfies Rule 2.6 (no raw emojis or graphical symbols in button labels)', () => {
    // Regex matching Button components and inspecting text inside
    const buttonRegex = /<Button\b([^>]*)>([\s\S]*?)<\/Button>/g;
    let match;
    const forbiddenChars = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚡👁️🛡️⚙️💡]/;

    while ((match = buttonRegex.exec(pageSource)) !== null) {
        const innerText = match[2].trim();
        // Skip purely JSX children or icon-only buttons
        if (innerText && !innerText.startsWith('<')) {
            assert.equal(
                forbiddenChars.test(innerText),
                false,
                `Button label "${innerText}" must not contain raw graphic symbols or emojis`
            );
        }
    }
});

