import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM01 & BM02 Print Sheets: Adhere to Rule 2.4 and contain required institutional text', () => {
    const files = [
        'frontend/src/components/prints/BM01PrintSheet.jsx',
        'frontend/src/components/prints/BM02PrintSheet.jsx'
    ];
    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buf = fs.readFileSync(fullPath);
        const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.strictEqual(hasBom, false, `${f} must not have BOM`);
    }

    const bm01Src = read('frontend/src/components/prints/BM01PrintSheet.jsx');
    const bm02Src = read('frontend/src/components/prints/BM02PrintSheet.jsx');

    // BM01 matches BM01.docx
    assert.match(bm01Src, /TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT/, 'BM01 must contain TDMU university header');
    assert.match(bm01Src, /VIỆN CÔNG NGHỆ SỐ/, 'BM01 must contain institute header');
    assert.match(bm01Src, /ĐỀ CƯƠNG ĐỀ TÀI BÁO CÁO TỐT NGHIỆP/, 'BM01 must contain official title');
    assert.match(bm01Src, /Mục tiêu nghiên cứu/, 'BM01 must have research objectives');
    assert.match(bm01Src, /Kế hoạch thực hiện/, 'BM01 must have weekly schedule');
    assert.match(bm01Src, /GIẢNG VIÊN HƯỚNG DẪN/, 'BM01 must have mentor signature block');
    assert.match(bm01Src, /SINH VIÊN THỰC HIỆN/, 'BM01 must have student signature block');

    // BM02 matches BM02.docx
    assert.match(bm02Src, /PHIẾU ĐĂNG KÝ ĐỀ TÀI/, 'BM02 must contain official title');
    assert.match(bm02Src, /BỘ MÔN CÔNG NGHỆ THÔNG TIN/, 'BM02 must have department header');
    assert.match(bm02Src, /PHỤ TRÁCH BỘ MÔN/, 'BM02 must have head of department signature block');
});

