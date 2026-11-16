import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('UTF-8 without BOM verification (Rule 2.4)', () => {
    const files = [
        'src/components/common/statusMap.js',
        'src/pages/admin/ProjectPeriodPage.jsx',
        'src/pages/lecturer/TopicApprovalPage.jsx',
    ];
    for (const rel of files) {
        const full = path.join(root, rel);
        const buf = fs.readFileSync(full);
        assert.ok(
            buf.length < 3 || buf[0] !== 0xef || buf[1] !== 0xbb || buf[2] !== 0xbf,
            `${rel} must not contain UTF-8 BOM`
        );
    }
});

test('statusMap.js exports getStatusTagConfig and maps IN_PROGRESS_BM03 to standard Vietnamese label', async () => {
    const statusMapModule = await import('../src/components/common/statusMap.js');
    assert.ok(typeof statusMapModule.getStatusTagConfig === 'function', 'getStatusTagConfig must be a function');
    
    // Check IN_PROGRESS_BM03
    const inProgressBm03 = statusMapModule.getStatusTagConfig('IN_PROGRESS_BM03');
    assert.equal(inProgressBm03.label, 'Đang thực hiện đồ án');
    assert.equal(inProgressBm03.color, 'cyan');

    // Check DECISION_ISSUED
    const decIssued = statusMapModule.getStatusTagConfig('DECISION_ISSUED');
    assert.equal(decIssued.label, 'Đã ban hành QĐ');
    assert.equal(decIssued.color, 'purple');

    // Check BM03_PASSED
    const bm03Passed = statusMapModule.getStatusTagConfig('BM03_PASSED');
    assert.equal(bm03Passed.label, 'Đạt đánh giá tiến độ');
    assert.equal(bm03Passed.color, 'green');

    // Check DEFENSE_READY
    const defenseReady = statusMapModule.getStatusTagConfig('DEFENSE_READY');
    assert.equal(defenseReady.label, 'Sẵn sàng bảo vệ');

    // Check fallback for unknown status
    const unknown = statusMapModule.getStatusTagConfig('CUSTOM_STATUS');
    assert.equal(unknown.label, 'CUSTOM STATUS');
});

test('ProjectPeriodPage uses getStatusTagConfig in Decision List table and BM02 queue without raw database enums', () => {
    const pageSrc = read('src/pages/admin/ProjectPeriodPage.jsx');
    
    // Import check
    assert.match(pageSrc, /import\s*\{\s*[^}]*getStatusTagConfig[^}]*\}\s*from\s*['"][^'"]*statusMap['"]/);

    // Decision List table status column
    assert.doesNotMatch(
        pageSrc,
        /statusValue === 'DECISION_ISSUED' \? 'Đã ban hành QĐ' : String\(statusValue \|\| ''\)/,
        'ProjectPeriodPage must not fallback to raw String(statusValue) in decision list'
    );
    assert.match(
        pageSrc,
        /getStatusTagConfig\(statusValue\)/,
        'ProjectPeriodPage must invoke getStatusTagConfig for decision table status column'
    );
});

test('TopicApprovalPage uses getStatusTagConfig to avoid leaking raw database keywords', () => {
    const approvalSrc = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(approvalSrc, /getStatusTagConfig/);
    assert.doesNotMatch(
        approvalSrc,
        /isPendingReview \? 'Chờ thẩm định' : record\.status\b/,
        'TopicApprovalPage must not render raw record.status'
    );
});
