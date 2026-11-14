import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM04 & BM05 Print Sheets: Verify 4 CĐR criteria, 2 conclusions and scorebook ledger', () => {
    const files = [
        'frontend/src/components/prints/BM04PrintSheet.jsx',
        'frontend/src/components/prints/BM05PrintSheet.jsx'
    ];
    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buf = fs.readFileSync(fullPath);
        const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.strictEqual(hasBom, false, `${f} must not have BOM`);
    }

    const bm04Src = read('frontend/src/components/prints/BM04PrintSheet.jsx');
    const bm05Src = read('frontend/src/components/prints/BM05PrintSheet.jsx');

    // BM04 matches BM04.docx
    assert.match(bm04Src, /PHIẾU NHẬN XÉT/, 'BM04 must contain official title');
    assert.match(bm04Src, /Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp/, 'BM04 must contain criterion 1');
    assert.match(bm04Src, /Tổng quan tình hình NC; PP nghiên cứu; kết quả nghiên cứu/, 'BM04 must contain criterion 2');
    assert.match(bm04Src, /Tính ứng dụng và triển vọng của đề tài/, 'BM04 must contain criterion 3');
    assert.match(bm04Src, /Đánh giá về thái độ và ý thức làm việc của sinh viên/, 'BM04 must contain criterion 4');
    assert.match(bm04Src, /Đáp ứng chuẩn đầu ra của Chương trình đào tạo/, 'BM04 must contain program outcome conclusion');
    assert.match(bm04Src, /Đồng ý cho bảo vệ/, 'BM04 must contain defense recommendation');

    // BM05 matches BM05 Defense Summary Record
    assert.match(bm05Src, /BIÊN BẢN TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ ĐỒ ÁN/, 'BM05 must contain council record title');
    assert.match(bm05Src, /THƯ KÝ HỘI ĐỒNG/, 'BM05 must contain secretary signature');
    assert.match(bm05Src, /CHỦ TỊCH HỘI ĐỒNG/, 'BM05 must contain chairman signature');
});
