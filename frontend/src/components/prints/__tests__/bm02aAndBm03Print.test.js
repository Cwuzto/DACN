import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM02-A & BM03 Print Sheets: Adhere to Rule 2.4 and contain required institutional sections', () => {
    const files = [
        'frontend/src/components/prints/BM02APrintSheet.jsx',
        'frontend/src/components/prints/BM03PrintSheet.jsx'
    ];
    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buf = fs.readFileSync(fullPath);
        const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.strictEqual(hasBom, false, `${f} must not have BOM`);
    }

    const bm02aSrc = read('frontend/src/components/prints/BM02APrintSheet.jsx');
    const bm03Src = read('frontend/src/components/prints/BM03PrintSheet.jsx');

    // BM02-A matches BM02-A.docx
    assert.match(bm02aSrc, /PHIẾU ĐỀ NGHỊ ĐIỀU CHỈNH TÊN ĐỀ TÀI/, 'BM02-A must contain official title');
    assert.match(bm02aSrc, /Tên đề tài đã đăng ký/, 'BM02-A must have old registered title field');
    assert.match(bm02aSrc, /Tên đề tài xin điều chỉnh/, 'BM02-A must have new adjusted title field');
    assert.match(bm02aSrc, /Lý do điều chỉnh/, 'BM02-A must have reason field');
    assert.match(bm02aSrc, /PHỤ TRÁCH BỘ MÔN/, 'BM02-A must have department signature block');

    // BM03 matches BM03.docx
    assert.match(bm03Src, /PHIẾU THEO DÕI TIẾN ĐỘ/, 'BM03 must contain official title');
    assert.match(bm03Src, /Tuần thứ/, 'BM03 must have week column');
    assert.match(bm03Src, /Kế hoạch thực hiện/, 'BM03 must have plan column');
    assert.match(bm03Src, /Được tiếp tục/, 'BM03 must have Checkpoint continue checkbox');
    assert.match(bm03Src, /Không tiếp tục/, 'BM03 must have Checkpoint discontinue checkbox');
});

