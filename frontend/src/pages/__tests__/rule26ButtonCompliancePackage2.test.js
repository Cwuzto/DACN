import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 6.1: OutlineReviewModal adheres to Rule 2.6 button and icon standards', () => {
    const src = read('frontend/src/components/lecturer/OutlineReviewModal.jsx');

    // Must not contain raw symbols in button labels
    assert.ok(
        !src.includes('✓ Xác Nhận Duyệt ĐẠT'),
        'OutlineReviewModal must not contain "✓ Xác Nhận Duyệt ĐẠT"'
    );
    assert.ok(
        !src.includes('⚠ Gửi Yêu Cầu Chỉnh Sửa'),
        'OutlineReviewModal must not contain "⚠ Gửi Yêu Cầu Chỉnh Sửa"'
    );

    // Must import CheckOutlined and ExclamationCircleOutlined
    assert.match(
        src,
        /CheckOutlined/,
        'OutlineReviewModal must import CheckOutlined'
    );
    assert.match(
        src,
        /ExclamationCircleOutlined/,
        'OutlineReviewModal must import ExclamationCircleOutlined'
    );

    // Button must use icon prop and clean Vietnamese text
    assert.match(
        src,
        /icon=\{selectedDecision === 'PASSED' \? <CheckOutlined \/> : <ExclamationCircleOutlined \/>\}/,
        'OutlineReviewModal must use prop icon with Ant Design icon components'
    );
    assert.match(
        src,
        /\{selectedDecision === 'PASSED' \? 'Xác nhận duyệt Đạt' : 'Gửi yêu cầu chỉnh sửa'\}/,
        'OutlineReviewModal must use clean Vietnamese text in button label'
    );
});

test('Task 6.2: TopicManagementPage removes raw "+" symbol from button label and modal title', () => {
    const src = read('frontend/src/pages/admin/TopicManagementPage.jsx');

    // Must not contain duplicate raw "+" in button text
    assert.ok(
        !src.includes('+ Thêm đề tài mới'),
        'TopicManagementPage must not contain "+ Thêm đề tài mới"'
    );

    // Button must have pure Vietnamese text
    assert.match(
        src,
        /<Button[\s\S]*?icon=\{<PlusOutlined \/>\}[\s\S]*?>\s*Thêm đề tài mới\s*<\/Button>/,
        'TopicManagementPage button must use icon={<PlusOutlined />} and pure text "Thêm đề tài mới"'
    );

    // Modal title must be clean
    assert.match(
        src,
        /title=\{editingTopic \? 'Chỉnh sửa đề tài' : 'Thêm đề tài mới'\}/,
        'TopicManagementPage modal title must not contain "+"'
    );
});

test('Task 6.3: RubricManagementPage replaces raw gear icon with SettingOutlined and complies with Rule 2.6', () => {
    const src = read('frontend/src/pages/admin/RubricManagementPage.jsx');

    // Import SettingOutlined
    assert.match(
        src,
        /SettingOutlined/,
        'RubricManagementPage must import SettingOutlined from @ant-design/icons'
    );

    // Must not contain raw ⚙ in decoration div
    assert.ok(
        !src.includes('⚙'),
        'RubricManagementPage must not contain raw gear character ⚙'
    );

    // Must use SettingOutlined component inside decoration div
    assert.match(
        src,
        /<SettingOutlined\s+style=\{\{\s*color:\s*'#0F766E',\s*fontSize:\s*18\s*\}\}\s*\/>/,
        'RubricManagementPage must use <SettingOutlined style={{ color: \'#0F766E\', fontSize: 18 }} />'
    );
});

test('Task 6.4: GradingDefensePage complies with Rule 2.6 button standards', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    // Verify Ant Design buttons use proper icon props and clean labels
    assert.match(
        src,
        /<Button[\s\S]*?icon=\{<SettingOutlined \/>\}[\s\S]*?>/,
        'GradingDefensePage admin rubric edit button uses SettingOutlined icon'
    );
    assert.match(
        src,
        /<Button[\s\S]*?icon=\{<CheckOutlined \/>\}[\s\S]*?>\s*Hoàn tất\s*<\/Button>/,
        'GradingDefensePage complete button uses pure text "Hoàn tất"'
    );
    assert.match(
        src,
        /<Button[\s\S]*?icon=\{<RollbackOutlined \/>\}[\s\S]*?>\s*Trả sổ về Hội đồng\s*<\/Button>/,
        'GradingDefensePage return scorebook button uses RollbackOutlined and pure text'
    );
    assert.match(
        src,
        /<Button[\s\S]*?icon=\{<PrinterOutlined \/>\}[\s\S]*?>\s*In Biên Bản BM05\s*<\/Button>/,
        'GradingDefensePage print BM05 button uses PrinterOutlined and pure text'
    );
});

test('Task 6.5: Full Sweep across all 4 target files for Rule 2.6 button label violations', () => {
    const targetFiles = [
        'frontend/src/components/lecturer/OutlineReviewModal.jsx',
        'frontend/src/pages/admin/TopicManagementPage.jsx',
        'frontend/src/pages/admin/RubricManagementPage.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
    ];

    const prohibitedSymbols = ['←', '→', '✓', '🗑', '✏', '⚙', '🤖', '📋', '▾', '▴', '↗', '⚠', '👥', '🔓'];

    for (const relativePath of targetFiles) {
        const src = read(relativePath);
        const lines = src.split('\n');

        lines.forEach((line, lineIndex) => {
            // Find Button or button lines with content
            if (/<(?:Button|button)[^>]*>[^<]+<\/(?:Button|button)>/i.test(line)) {
                for (const sym of prohibitedSymbols) {
                    assert.ok(
                        !line.includes(sym),
                        `File ${relativePath}:${lineIndex + 1} contains prohibited symbol "${sym}" inside button label: ${line.trim()}`
                    );
                }
                // Also ensure no leading "+ " in button label text
                assert.ok(
                    !/>\s*\+\s+\S/.test(line),
                    `File ${relativePath}:${lineIndex + 1} contains "+ " inside button label: ${line.trim()}`
                );
            }
        });
    }
});
