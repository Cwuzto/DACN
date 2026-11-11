import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 7: evaluationService and meetingLogService export all required BM03 & BM04 methods', () => {
    const evalServiceSource = read('frontend/src/services/evaluationService.js');
    const meetingServiceSource = read('frontend/src/services/meetingLogService.js');

    // BM03 Methods
    assert.ok(
        /getBM03Record\s*:\s*async/.test(evalServiceSource) || /getBM03Record\s*:\s*async/.test(meetingServiceSource),
        'getBM03Record must be defined'
    );
    assert.ok(
        /createMeetingEntry\s*:\s*async/.test(evalServiceSource) || /createMeetingEntry\s*:\s*async/.test(meetingServiceSource),
        'createMeetingEntry must be defined'
    );
    assert.ok(
        /signMeetingEntry\s*:\s*async/.test(evalServiceSource) || /signMeetingEntry\s*:\s*async/.test(meetingServiceSource),
        'signMeetingEntry must be defined'
    );
    assert.ok(
        /submitStageEvaluation\s*:\s*async/.test(evalServiceSource) || /submitStageEvaluation\s*:\s*async/.test(meetingServiceSource),
        'submitStageEvaluation must be defined'
    );
    assert.ok(
        /advisorSignWholeBM03\s*:\s*async/.test(evalServiceSource) || /advisorSignWholeBM03\s*:\s*async/.test(meetingServiceSource),
        'advisorSignWholeBM03 must be defined'
    );
    assert.ok(
        /studentAcknowledgeBM03\s*:\s*async/.test(evalServiceSource) || /studentAcknowledgeBM03\s*:\s*async/.test(meetingServiceSource),
        'studentAcknowledgeBM03 must be defined'
    );
    assert.ok(
        /requestMoreInfoForStopReview\s*:\s*async/.test(evalServiceSource) || /requestMoreInfoForStopReview\s*:\s*async/.test(meetingServiceSource),
        'requestMoreInfoForStopReview must be defined'
    );
    assert.ok(
        /decideStopReview\s*:\s*async/.test(evalServiceSource) || /decideStopReview\s*:\s*async/.test(meetingServiceSource),
        'decideStopReview must be defined'
    );

    // BM04 Methods
    assert.match(evalServiceSource, /getBM04Record\s*:\s*async/);
    assert.match(evalServiceSource, /saveBM04Draft\s*:\s*async/);
    assert.match(evalServiceSource, /signAndSubmitBM04\s*:\s*async/);
    assert.match(evalServiceSource, /requestMoreInfoForDefenseReview\s*:\s*async/);
    assert.match(evalServiceSource, /decideDefenseReview\s*:\s*async/);
});

test('Task 7: ProgressTrackingPage and StudentProgressDetailPanel implement meeting logs with ratings and lock, stage evaluations, and whole BM03 signing', () => {
    const trackingSource = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
    const panelSource = read('frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx');

    // Progress ratings: ON_TRACK, AT_RISK, BEHIND, NO_PROGRESS
    assert.match(trackingSource, /ON_TRACK/);
    assert.match(trackingSource, /AT_RISK/);
    assert.match(trackingSource, /BEHIND/);
    assert.match(trackingSource, /NO_PROGRESS/);

    // Meeting form fields
    assert.match(trackingSource, /progressRating/);
    assert.match(trackingSource, /locationOrLink/);
    assert.match(trackingSource, /studentCompletedWork/);
    assert.match(trackingSource, /remainingIssues/);
    assert.match(trackingSource, /nextTasks/);

    // Advisor signature for meeting entry & locking
    assert.ok(
        /signMeetingEntry/.test(trackingSource) || /signMeetingEntry/.test(panelSource),
        'Meeting sign action must be hooked to signMeetingEntry'
    );
    assert.ok(
        /Ký khóa buổi hướng dẫn|Ký khóa/i.test(trackingSource) || /Ký khóa buổi hướng dẫn|Ký khóa/i.test(panelSource),
        'Advisor-only sign button must be present'
    );

    // Midterm & Final Stage Evaluation cards/modals
    assert.match(trackingSource, /submitStageEvaluation|submitMidterm|submitFinal/);
    assert.match(trackingSource, /MIDTERM/);
    assert.match(trackingSource, /FINAL/);
    assert.match(trackingSource, /CONTINUE/);
    assert.match(trackingSource, /PROPOSE_STOP/);
    assert.match(trackingSource, /CONTINUE_TO_BM04/);

    // Whole BM03 advisor sign
    assert.match(trackingSource, /advisorSignWholeBM03/);
    assert.match(trackingSource, /Ký toàn phiếu BM03|Ký xác nhận toàn phiếu/);
});

test('Task 7: BM04EvaluationModal implements effectiveTitle, 4 criteria, 2 conclusions, mismatchReason constraint, save draft, and sign/submit', () => {
    const modalSource = read('frontend/src/components/lecturer/BM04EvaluationModal.jsx');

    // Effective topic title display
    assert.match(modalSource, /effectiveTitle/);

    // 4 required criteria
    assert.match(modalSource, /thesisFormatScore/);
    assert.match(modalSource, /researchContentScore/);
    assert.match(modalSource, /applicabilityScore/);
    assert.match(modalSource, /attitudeScore/);

    // 2 conclusions: programOutcome & defenseRecommendation
    assert.match(modalSource, /programOutcome/);
    assert.match(modalSource, /MEETS_PROGRAM_OUTCOMES/);
    assert.match(modalSource, /DOES_NOT_MEET_PROGRAM_OUTCOMES/);

    assert.match(modalSource, /defenseRecommendation/);
    assert.match(modalSource, /APPROVE_FOR_DEFENSE/);
    assert.match(modalSource, /NOT_APPROVE_FOR_DEFENSE/);

    // Mismatch reason constraint
    assert.match(modalSource, /mismatchReason/);

    // 2 action buttons: save draft and sign/submit
    assert.match(modalSource, /saveBM04Draft/);
    assert.match(modalSource, /signAndSubmitBM04/);
    assert.match(modalSource, /Lưu nháp/);
    assert.match(modalSource, /Ký và nộp/);
});

test('Task 7: Student SubmissionPage and StudentDashboardPage support 48h BM03 Acknowledgement and signed PDF downloads', () => {
    const subSource = read('frontend/src/pages/student/SubmissionPage.jsx');
    const dashSource = read('frontend/src/pages/student/StudentDashboardPage.jsx');

    // 48h acknowledgement
    assert.ok(
        /studentAcknowledgeBM03/.test(subSource) || /studentAcknowledgeBM03/.test(dashSource),
        'Must call studentAcknowledgeBM03'
    );
    assert.ok(
        /Ký xác nhận đã biết/.test(subSource) || /Ký xác nhận đã biết/.test(dashSource),
        'Must have Ký xác nhận đã biết action'
    );
    assert.ok(
        /Xác nhận kèm ý kiến/.test(subSource) || /Xác nhận kèm ý kiến/.test(dashSource),
        'Must have Xác nhận kèm ý kiến action'
    );
    assert.ok(
        /Từ chối ký/.test(subSource) || /Từ chối ký/.test(dashSource),
        'Must have Từ chối ký action'
    );

    // Signed PDF downloads for BM03 & BM04
    assert.ok(
        /finalPdfFileUrl|Tải PDF BM03|BM03 PDF/i.test(subSource) || /finalPdfFileUrl|Tải PDF BM03|BM03 PDF/i.test(dashSource),
        'Must have BM03 signed PDF download'
    );
    assert.ok(
        /finalPdfFileUrl|Tải PDF BM04|BM04 PDF/i.test(subSource) || /finalPdfFileUrl|Tải PDF BM04|BM04 PDF/i.test(dashSource),
        'Must have BM04 signed PDF download'
    );
});

test('Task 7: ProjectOversightPage implements Institute review queues for BM03 Stop and BM04 Rejection', () => {
    const pageSource = read('frontend/src/pages/admin/ProjectOversightPage.jsx');

    // BM03 Stop Review
    assert.match(pageSource, /BM03.*Dừng|Đề nghị dừng BM03|Thẩm định dừng BM03/i);
    assert.match(pageSource, /requestMoreInfoForStopReview|moreInfoRequest/);
    assert.match(pageSource, /decideStopReview/);
    assert.match(pageSource, /Chấp thuận dừng/);
    assert.match(pageSource, /Bác bỏ đề xuất/);
    assert.match(pageSource, /Yêu cầu bổ sung/);

    // BM04 Rejection Review
    assert.match(pageSource, /BM04.*Bảo vệ|Không cho bảo vệ BM04|Thẩm định không cho bảo vệ BM04/i);
    assert.match(pageSource, /requestMoreInfoForDefenseReview/);
    assert.match(pageSource, /decideDefenseReview/);
    assert.match(pageSource, /Đồng ý không cho bảo vệ/);
    assert.match(pageSource, /Cho phép ra bảo vệ/);

    // SLA 168h and extension logic
    assert.match(pageSource, /168|SLA|extensionCount/);
});

test('Task 7: Strict Button standards (Rule 2.6 in AGENTS.md) in all modified files', () => {
    const files = [
        'frontend/src/pages/lecturer/ProgressTrackingPage.jsx',
        'frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx',
        'frontend/src/components/lecturer/BM04EvaluationModal.jsx',
        'frontend/src/pages/student/SubmissionPage.jsx',
        'frontend/src/pages/student/StudentDashboardPage.jsx',
        'frontend/src/pages/admin/ProjectOversightPage.jsx',
    ];

    function extractButtonTexts(content) {
        const results = [];
        const openTagRegex = /<(?:Button|button)\b/g;
        let match;
        while ((match = openTagRegex.exec(content)) !== null) {
            let i = match.index + match[0].length;
            let inCurly = 0;
            let inQuote = null;
            let openTagEnd = -1;

            while (i < content.length) {
                const ch = content[i];
                if (inQuote) {
                    if (ch === inQuote && content[i - 1] !== '\\') inQuote = null;
                } else if (ch === '"' || ch === "'") {
                    inQuote = ch;
                } else if (ch === '{') {
                    inCurly++;
                } else if (ch === '}') {
                    if (inCurly > 0) inCurly--;
                } else if (ch === '>' && inCurly === 0) {
                    openTagEnd = i;
                    break;
                }
                i++;
            }

            if (openTagEnd !== -1) {
                const rest = content.slice(openTagEnd + 1);
                const closeMatch = rest.match(/<\/(?:Button|button)>/);
                if (closeMatch) {
                    results.push(rest.slice(0, closeMatch.index));
                }
            }
        }
        return results;
    }

    for (const file of files) {
        const content = read(file);
        const buttonBodies = extractButtonTexts(content);
        for (const body of buttonBodies) {
            const textOnly = body.replace(/<[^>]+>/g, '').trim();
            if (textOnly) {
                assert.ok(
                    !/[←→🤖📋✓✏️👥🗑️🔓▾▴↗✕]/.test(textOnly) && !/^\s*\+\s*/.test(textOnly),
                    `File ${file} has button with raw symbol/emoji in text: "${textOnly}"`
                );
            }
        }
    }
});
