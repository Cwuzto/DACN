import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relPath) => fs.readFileSync(path.resolve(root, relPath), 'utf8');

test('DefenseSummaryRecordModal: exists and UTF-8 without BOM (Rule 2.4)', () => {
    const filePath = path.resolve(root, 'frontend/src/components/admin/DefenseSummaryRecordModal.jsx');
    assert.ok(fs.existsSync(filePath), 'DefenseSummaryRecordModal component must exist');

    const buf = fs.readFileSync(filePath);
    const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    assert.equal(hasBom, false, 'File must not contain UTF-8 BOM');
});

test('DefenseSummaryRecordModal: complies with AGENTS.md Rule 2.6 (no raw emoji in button labels)', () => {
    const src = read('frontend/src/components/admin/DefenseSummaryRecordModal.jsx');

    const rawEmojiRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚠️]/;
    const buttonMatches = [...src.matchAll(/<Button[^>]*>([\s\S]*?)<\/Button>/g)];
    assert.ok(buttonMatches.length > 0, 'Component must contain at least one Button');

    for (const match of buttonMatches) {
        const buttonLabel = match[1].replace(/<[^>]+>/g, '').trim();
        assert.equal(
            rawEmojiRegex.test(buttonLabel),
            false,
            `Button label "${buttonLabel}" must not contain raw emojis`,
        );
    }

    assert.match(src, /icon=\{<PrinterOutlined \/>\}/, 'Print button must use PrinterOutlined icon prop');
});

test('DefenseSummaryRecordModal: renders all 5 standard BM05 sections and legal structure', () => {
    const src = read('frontend/src/components/admin/DefenseSummaryRecordModal.jsx');

    assert.match(src, /TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT/, 'Must display university name');
    assert.match(src, /VIỆN CÔNG NGHỆ SỐ/, 'Must display institute name');
    assert.match(src, /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/, 'Must display national motto');
    assert.match(src, /BIÊN BẢN TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ ĐỒ ÁN \/ KHÓA LUẬN TỐT NGHIỆP/, 'Must display official BM05 title');
    assert.match(src, /Mẫu BM05/, 'Must cite BM05 document code');

    // 5 Sections
    assert.match(src, /I\.\s*THÔNG TIN HỘI ĐỒNG/, 'Section I: Council info');
    assert.match(src, /II\.\s*THÔNG TIN SINH VIÊN/, 'Section II: Student & Topic info');
    assert.match(src, /III\.\s*KẾT QUẢ ĐÁNH GIÁ/, 'Section III: Scores & Rubric results');
    assert.match(src, /IV\.\s*Ý KIẾN NHẬN XÉT/, 'Section IV: Comments & revisions');
    assert.match(src, /V\.\s*KÝ TÊN XÁC NHẬN/, 'Section V: Signatures');

    // Dual Signatures
    assert.match(src, /THƯ KÝ HỘI ĐỒNG/, 'Must have Secretary signature block');
    assert.match(src, /CHỦ TỊCH HỘI ĐỒNG/, 'Must have Chair signature block');
});

test('DefenseSummaryRecordModal: properly computes scores, classification and absent conditions', () => {
    const src = read('frontend/src/components/admin/DefenseSummaryRecordModal.jsx');

    assert.match(src, /rawAverageScore/, 'Must support raw average score');
    assert.match(src, /roundedFinalScore/, 'Must support rounded final score');
    assert.match(src, /isAbsent/, 'Must check for absent student status');
    assert.match(src, /absentMinutesText/, 'Must render absent minutes text when student is absent');
    assert.match(src, /getGradeLabel/, 'Must provide grade classification helper');
});

test('GradingDefensePage: integrates DefenseSummaryRecordModal cleanly complying with Rule 2.6', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    assert.match(src, /import DefenseSummaryRecordModal from '\.\.\/\.\.\/components\/admin\/DefenseSummaryRecordModal';/);
    assert.match(src, /<DefenseSummaryRecordModal[\s\S]*?open=\{summaryModalOpen\}/);
    assert.match(src, /<Button[\s\S]*?icon=\{<FileTextOutlined \/>\}[\s\S]*?>\s*Xem Biên Bản BM05\s*<\/Button>/);
    assert.match(src, /<Button[\s\S]*?icon=\{<FileTextOutlined \/>\}[\s\S]*?>\s*BM05\s*<\/Button>/);
});
