import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4: councilService and evaluationService export required log methods', () => {
    const councilServiceSrc = read('frontend/src/services/councilService.js');
    const evaluationServiceSrc = read('frontend/src/services/evaluationService.js');

    assert.match(
        councilServiceSrc,
        /getScheduleAdjustments\s*:\s*async/,
        'councilService must export getScheduleAdjustments method'
    );
    assert.match(
        councilServiceSrc,
        /\/councils\/\$\{councilId\}\/schedule-adjustments/,
        'councilService.getScheduleAdjustments must call /councils/${councilId}/schedule-adjustments'
    );

    assert.match(
        evaluationServiceSrc,
        /getScoreBookReturnLogs\s*:\s*async/,
        'evaluationService must export getScoreBookReturnLogs method'
    );
    assert.match(
        evaluationServiceSrc,
        /\/evaluations\/councils\/\$\{councilId\}\/return-logs/,
        'evaluationService.getScoreBookReturnLogs must call /evaluations/councils/${councilId}/return-logs'
    );
});

test('Task 4: CouncilDetailPage connects schedule adjustment logs and displays adjustments modal', () => {
    const pageSrc = read('frontend/src/pages/admin/CouncilDetailPage.jsx');

    // Button in header/toolbar
    assert.match(
        pageSrc,
        /handleOpenAdjustmentsModal/,
        'CouncilDetailPage must have handleOpenAdjustmentsModal function'
    );
    assert.match(
        pageSrc,
        /Nhật ký đổi ca/,
        'CouncilDetailPage must have "Nhật ký đổi ca" button'
    );

    // Call service
    assert.match(
        pageSrc,
        /councilService\.getScheduleAdjustments/,
        'CouncilDetailPage must call councilService.getScheduleAdjustments'
    );

    // Modal or Drawer displaying table with required columns
    assert.match(
        pageSrc,
        /item\.registration\?\.student\?\.fullName|registration\?\.student\?\.fullName|record\.registration\?\.student\?\.fullName/,
        'Must display student full name'
    );
    assert.match(
        pageSrc,
        /item\.registration\?\.topic\?\.title|registration\?\.topic\?\.title|record\.registration\?\.topic\?\.title/,
        'Must display topic title'
    );
    assert.match(
        pageSrc,
        /newShift/,
        'Must display new shift'
    );
    assert.match(
        pageSrc,
        /Chưa có lượt điều chỉnh ca thi nào/,
        'Must display empty state with "Chưa có lượt điều chỉnh ca thi nào"'
    );
});

test('Task 4: GradingDefensePage connects scorebook return logs and displays alert banner and modal', () => {
    const pageSrc = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    // Calls service when selectedCouncilId changes
    assert.match(
        pageSrc,
        /evaluationService\.getScoreBookReturnLogs/,
        'GradingDefensePage must call evaluationService.getScoreBookReturnLogs'
    );

    // Alert banner
    assert.match(
        pageSrc,
        /Hội đồng có lượt hoàn trả sổ điểm/,
        'GradingDefensePage must display alert "Hội đồng có lượt hoàn trả sổ điểm"'
    );
    assert.match(
        pageSrc,
        /Hội đồng này đã từng có sổ điểm được Giáo vụ\/Trưởng Viện hoàn trả để rà soát lại kết quả chấm/,
        'GradingDefensePage must display return description in alert'
    );

    // Return history modal button
    assert.match(
        pageSrc,
        /Xem lịch sử trả/,
        'GradingDefensePage must display button "Xem lịch sử trả"'
    );

    // Modal details
    assert.match(
        pageSrc,
        /fromLedgerVersion/,
        'GradingDefensePage modal must display ledger versions'
    );
    assert.match(
        pageSrc,
        /returnedByAdmin/,
        'GradingDefensePage modal must display returnedByAdmin'
    );
});

test('Task 4: Strict Button standards (Rule 2.6 in AGENTS.md) across modified files', () => {
    const rawSymbolRegex = />\s*[^<]*[←→+🤖✓✏️👥🗑️🔓▾▴↗📖🏛️⏰]\s*[^<]*<\/Button>/;

    const filesToCheck = [
        'frontend/src/pages/admin/CouncilDetailPage.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
    ];

    for (const relPath of filesToCheck) {
        const content = read(relPath);
        assert.ok(
            !rawSymbolRegex.test(content),
            `Rule 2.6 violation: Raw emoji or special character found in Button text in ${relPath}`
        );
    }
});
