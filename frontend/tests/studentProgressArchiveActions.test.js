import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 3 files exist and adhere strictly to UTF-8 without BOM', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentProgressActions.jsx',
        'src/components/student/work/StudentArchiveActions.jsx',
        'src/services/archiveService.js',
        'src/services/evaluationService.js',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must NOT have UTF-8 BOM`);
    }
});

test('Rule 2.1 compliance: No group/groupMember/groupId in progress and archive action components', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentProgressActions.jsx',
        'src/components/student/work/StudentArchiveActions.jsx',
    ];

    for (const file of files) {
        const src = read(file);
        assert.doesNotMatch(src, /\bgroupMember\b/i, `${file} must not reference groupMember`);
        assert.doesNotMatch(src, /\bgroupMembers\b/i, `${file} must not reference groupMembers`);
        assert.doesNotMatch(src, /\bgroupId\b/i, `${file} must not reference groupId`);
    }
});

test('Rule 2.6 compliance: Strict button icons and Vietnamese labels without raw emojis', () => {
    const files = [
        'src/components/student/work/StudentWorkActions.jsx',
        'src/components/student/work/StudentProgressActions.jsx',
        'src/components/student/work/StudentArchiveActions.jsx',
    ];

    const forbidden = /[🤖←→+📋✓✏️👥🗑️🔓▾▴↗✕🖨️⚠️]/;

    for (const f of files) {
        const src = read(f);
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} Button label "${label}" contains forbidden symbol/emoji`);
        }

        const htmlBtnRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
        while ((match = htmlBtnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} HTML button label "${label}" contains forbidden symbol/emoji`);
        }
    }
});

test('StudentWorkActions delegates BM03, BM04, checkpoints to StudentProgressActions and archive items to StudentArchiveActions', () => {
    const src = read('src/components/student/work/StudentWorkActions.jsx');

    // Subagent imports
    assert.match(src, /import\s+StudentProgressActions\s+from\s+['"]\.\/StudentProgressActions['"]/, 'StudentWorkActions must import StudentProgressActions');
    assert.match(src, /import\s+StudentArchiveActions\s+from\s+['"]\.\/StudentArchiveActions['"]/, 'StudentWorkActions must import StudentArchiveActions');

    // Progress kinds
    assert.match(src, /BM03_ACK/, 'Must handle BM03_ACK');
    assert.match(src, /BM03_VIEW|BM03\b/, 'Must handle BM03_VIEW/BM03');
    assert.match(src, /BM03_APPEAL/, 'Must handle BM03_APPEAL');
    assert.match(src, /BM04_VIEW|BM04\b/, 'Must handle BM04_VIEW/BM04');
    assert.match(src, /CHECKPOINT_SUBMIT|CHECKPOINT_VIEW|CHECKPOINT_SIGN/, 'Must handle CHECKPOINT actions');

    // Archive kinds
    assert.match(src, /PRE_DEFENSE_SUBMIT|PRE_DEFENSE/, 'Must handle PRE_DEFENSE');
    assert.match(src, /SUBMIT_ARCHIVE|ARCHIVE_VIEW|ARCHIVE\b/, 'Must handle SUBMIT_ARCHIVE');
    assert.match(src, /VIEW_GRADES_CERTIFICATE/, 'Must handle VIEW_GRADES_CERTIFICATE');

    // Prop forwarding
    assert.match(src, /<StudentProgressActions[\s\S]*item=\{item\}/, 'Must forward item to StudentProgressActions');
    assert.match(src, /<StudentProgressActions[\s\S]*registration=\{registration\}/, 'Must forward registration to StudentProgressActions');
    assert.match(src, /<StudentProgressActions[\s\S]*sources=\{sources\}/, 'Must forward sources to StudentProgressActions');
    assert.match(src, /<StudentProgressActions[\s\S]*onCompleted=\{onCompleted\}/, 'Must forward onCompleted to StudentProgressActions');

    assert.match(src, /<StudentArchiveActions[\s\S]*item=\{item\}/, 'Must forward item to StudentArchiveActions');
    assert.match(src, /<StudentArchiveActions[\s\S]*registration=\{registration\}/, 'Must forward registration to StudentArchiveActions');
    assert.match(src, /<StudentArchiveActions[\s\S]*sources=\{sources\}/, 'Must forward sources to StudentArchiveActions');
    assert.match(src, /<StudentArchiveActions[\s\S]*onCompleted=\{onCompleted\}/, 'Must forward onCompleted to StudentArchiveActions');
});

test('StudentProgressActions implements BM03 48h acknowledgement with 3 feedback modes and required reason on decline', () => {
    const src = read('src/components/student/work/StudentProgressActions.jsx');

    // Service call
    assert.match(src, /evaluationService\.studentAcknowledgeBM03/, 'Must call evaluationService.studentAcknowledgeBM03');

    // 3 modes
    assert.match(src, /ACKNOWLEDGED/, 'Must handle ACKNOWLEDGED');
    assert.match(src, /ACKNOWLEDGED_WITH_COMMENT/, 'Must handle ACKNOWLEDGED_WITH_COMMENT');
    assert.match(src, /DECLINED_TO_ACKNOWLEDGE/, 'Must handle DECLINED_TO_ACKNOWLEDGE');

    // Reason validation
    assert.match(src, /Bắt buộc nhập lý do khi từ chối ký xác nhận/, 'Must enforce required comment on DECLINED_TO_ACKNOWLEDGE');

    // 48h alert
    assert.match(src, /48\s*giờ/i, 'Must display 48-hour deadline notification');

    // Payload structure
    assert.match(src, /action,\s*comment:\s*bm03AckComment/, 'Must build payload with action and comment');
});

test('StudentProgressActions enforces BM04 security guards: blocks unsigned viewing/printing and hides unpublished scores', () => {
    const src = read('src/components/student/work/StudentProgressActions.jsx');

    // Signed condition check
    assert.match(src, /signedAt|status\s*===\s*['"]COMPLETED['"]/, 'Must check signedAt or status === COMPLETED');
    assert.match(src, /Phiếu nhận xét BM04 chưa được giảng viên hướng dẫn ký duyệt hoàn tất/, 'Must inform student when BM04 is not yet signed');

    // Print guard
    assert.match(src, /BM04PrintSheet/, 'Must import BM04PrintSheet');
    assert.match(src, /AcademicFormPrintModal/, 'Must import AcademicFormPrintModal');
    assert.match(src, /printConfig\.type\s*===\s*['"]BM04['"]\s*&&\s*isBm04Signed/, 'AcademicFormPrintModal must only mount BM04 when signed');

    // Unpublished defense scores privacy guard
    assert.match(src, /isDefensePublished/, 'Must check defense publication status');
    assert.match(src, /Điểm đánh giá chi tiết của hội đồng bảo vệ sẽ hiển thị sau khi Viện công bố kết quả chính thức/, 'Must show notice and protect unpublished defense scores');
});

test('StudentProgressActions integrates CheckpointSignModal for checkpoint signing and appeal', () => {
    const src = read('src/components/student/work/StudentProgressActions.jsx');

    assert.match(src, /import\s+CheckpointSignModal\s+from\s+['"].*CheckpointSignModal['"]/, 'Must import CheckpointSignModal');
    assert.match(src, /<CheckpointSignModal/, 'Must render CheckpointSignModal conditionally');
    assert.match(src, /Gửi giải trình checkpoint|Ký biên bản checkpoint/, 'Must offer checkpoint action button');
});

test('StudentArchiveActions implements pre-defense dossier submission with validation and checklist notice', () => {
    const src = read('src/components/student/work/StudentArchiveActions.jsx');

    // Service call
    assert.match(src, /archiveService\.submitPreDefenseArchive/, 'Must call archiveService.submitPreDefenseArchive');

    // Mandatory checklist notice matching checkpointAppealUiContracts test
    assert.match(src, /Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt Phiếu nhận xét/, 'Must display mandatory checklist alert');

    // Payload validation
    assert.match(src, /Vui lòng cung cấp ít nhất link bản thảo báo cáo, slide thuyết trình hoặc link mã nguồn/, 'Must validate at least 1 document provided');

    // Payload properties
    assert.match(src, /reportFileUrl/, 'Must send reportFileUrl');
    assert.match(src, /slideFileUrl/, 'Must send slideFileUrl');
    assert.match(src, /sourceCodeUrl/, 'Must send sourceCodeUrl');
});

test('StudentArchiveActions manages 4 final archive slots and clearance certificate modal', () => {
    const src = read('src/components/student/work/StudentArchiveActions.jsx');

    // Final archive service call
    assert.match(src, /archiveService\.submitFinalArchive/, 'Must call archiveService.submitFinalArchive');

    // 4 files notice & form
    assert.match(src, /4\s*Tệp Bắt Buộc|4\s*thành phần/i, 'Must manage 4 final archive slots');
    assert.match(src, /Báo cáo toàn văn hoàn chỉnh/, 'Must have report slot');
    assert.match(src, /Mã nguồn toàn bộ hệ thống/, 'Must have source code slot');
    assert.match(src, /Slide báo cáo bảo vệ/, 'Must have slide slot');
    assert.match(src, /Video demo vận hành sản phẩm/, 'Must have demo video slot');

    // Modals integration
    assert.match(src, /ArchiveSubmissionModal/, 'Must integrate ArchiveSubmissionModal');
    assert.match(src, /ClearanceCertificateModal/, 'Must integrate ClearanceCertificateModal');
    assert.match(src, /archiveService\.getClearanceCertificate/, 'Must call archiveService.getClearanceCertificate');
});

test('Service export verification: archiveService exports submitFinalArchive and evaluationService supports studentAcknowledgeBM03 payload', () => {
    const archiveSrc = read('src/services/archiveService.js');
    assert.match(archiveSrc, /submitFinalArchive\s*:\s*async/, 'archiveService must export submitFinalArchive');
    assert.match(archiveSrc, /submitPreDefenseArchive\s*:\s*async/, 'archiveService must export submitPreDefenseArchive');

    const evalSrc = read('src/services/evaluationService.js');
    assert.match(evalSrc, /studentAcknowledgeBM03\s*:\s*async/, 'evaluationService must export studentAcknowledgeBM03');
    assert.match(evalSrc, /studentNote/, 'evaluationService must accept studentNote in payload or argument');
});
