import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 7: Services export all required methods for defense to completion', () => {
    const councilServiceSrc = read('frontend/src/services/councilService.js');
    const evalServiceSrc = read('frontend/src/services/evaluationService.js');
    const archiveServiceSrc = read('frontend/src/services/archiveService.js');
    const rubricServiceSrc = read('frontend/src/services/rubricService.js');

    // Council service methods
    assert.match(councilServiceSrc, /publishEligibleDefenseList\s*:\s*async/);
    assert.match(councilServiceSrc, /confirmAndPublishDefenseSchedule\s*:\s*async/);
    assert.match(councilServiceSrc, /adjustStudentSchedule\s*:\s*async/);
    assert.match(councilServiceSrc, /replaceCouncilMember\s*:\s*async/);

    // Evaluation service methods
    assert.match(evalServiceSrc, /markStudentAbsent\s*:\s*async/);
    assert.match(evalServiceSrc, /lockScoreBookByChairman\s*:\s*async/);
    assert.match(evalServiceSrc, /returnScoreBook\s*:\s*async/);

    // Archive service methods
    assert.match(archiveServiceSrc, /getDefenseDossier\s*:\s*async/);
    assert.match(archiveServiceSrc, /uploadDefenseDocument\s*:\s*async/);
    assert.match(archiveServiceSrc, /reviewArchiveByMentor\s*:\s*async/);
    assert.match(archiveServiceSrc, /reviewArchiveByAcademicAffairs\s*:\s*async/);
    assert.match(archiveServiceSrc, /signClearanceCertificate\s*:\s*async/);

    // Rubric service methods
    assert.match(rubricServiceSrc, /lockRubric\s*:\s*async/);
    assert.match(rubricServiceSrc, /restoreDefault\s*:\s*async/);
});

test('Task 7: statusMap.js defines required defense & archival lifecycle statuses', () => {
    const statusMapSrc = read('frontend/src/components/common/statusMap.js');
    assert.match(statusMapSrc, /PENDING_INSTITUTE_SIGNATURE/);
    assert.match(statusMapSrc, /ARCHIVE_INCOMPLETE/);
    assert.match(statusMapSrc, /ARCHIVE_REJECTED/);
});

test('Task 7: RubricManagementPage supports cloCode, 4 level descriptions, restore default and lock rubric', () => {
    const rubricSrc = read('frontend/src/pages/admin/RubricManagementPage.jsx');
    assert.match(rubricSrc, /cloCode/);
    assert.match(rubricSrc, /descGood|descFair|descAverage|descPoor/);
    assert.match(rubricSrc, /restoreDefault/);
    assert.match(rubricSrc, /lockRubric/);
});

test('Task 7: CouncilAssignmentPage & CouncilDetailPage support ~22 capacity, publish eligible list, shifts, adjustment & member replacement', () => {
    const assignmentSrc = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');
    const detailSrc = read('frontend/src/pages/admin/CouncilDetailPage.jsx');

    // Publish eligible list button
    assert.match(assignmentSrc, /publishEligibleDefenseList/);

    // No hard 10 cap for DEFENSE_COUNCIL
    assert.ok(!/\{\s*count\s*\}\s*\/\s*10\s*SV/.test(assignmentSrc) || /OUTLINE_REVIEW/.test(assignmentSrc));

    // Shift handling & adjustment / member replacement in Detail page
    assert.match(detailSrc, /confirmAndPublishDefenseSchedule/);
    assert.match(detailSrc, /adjustStudentSchedule/);
    assert.match(detailSrc, /replaceCouncilMember/);
    assert.match(detailSrc, /MORNING/);
    assert.match(detailSrc, /AFTERNOON/);
});

test('Task 7: GradingPage & LecturerGradingSheetPage remove hardcoded slots, render snapshot, absentee handling and Rule 2.6 back button', () => {
    const gradingSrc = read('frontend/src/pages/lecturer/GradingPage.jsx');
    const sheetSrc = read('frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx');

    // Remove hardcoded session times
    assert.ok(!gradingSrc.includes("'08:00 - 08:45'"), 'Hardcoded session times array must be removed');
    assert.match(gradingSrc, /markStudentAbsent/);
    assert.match(gradingSrc, /lockScoreBookByChairman/);

    // LecturerGradingSheetPage CLO & Rule 2.6 back button
    assert.match(sheetSrc, /cloCode/);
    assert.ok(!sheetSrc.includes('← Quay lại danh sách Hội đồng'), 'Raw arrow button text must be replaced with Icon prop');
});

test('Task 7: GradingDefensePage eliminates mock scores (9.0, 8.5), mock examiners, fake Excel export, and forbids post-publication correction', () => {
    const pageSrc = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    assert.ok(!pageSrc.includes("Number(r.mentorScore).toFixed(1) : '9.0'"), 'Mock 9.0 score must be removed');
    assert.ok(!pageSrc.includes("Number(r.reviewerScore).toFixed(1) : '8.5'"), 'Mock 8.5 score must be removed');
    assert.ok(!pageSrc.includes('CorrectDefenseResultModal'), 'CorrectDefenseResultModal must be completely removed');
    assert.ok(!pageSrc.includes('handleExportExcel'), 'Unsupported Excel control must be removed');
    const publicationSrc = read('frontend/src/components/admin/DefenseResultPublicationModal.jsx');
    assert.doesNotMatch(publicationSrc, /CORRECTION|correctionItems/, 'Publication form must not offer immutable-result corrections');
    assert.doesNotMatch(publicationSrc, /['"]RESULT_PUBLISH['"]/, 'Publication form must not depend on the legacy permission');
    assert.match(pageSrc, /returnScoreBook/);
    assert.match(pageSrc, /roundedFinalScore|rawAverageScore/);
});

test('Task 7: GradeViewPage completely removes mock appeals, shows published rounded score and clearance download', () => {
    const gradeViewSrc = read('frontend/src/pages/student/GradeViewPage.jsx');

    assert.ok(!gradeViewSrc.includes('handleSubmitAppeal'), 'Mock appeal handler must be completely removed');
    assert.ok(!gradeViewSrc.includes('appealModalOpen'), 'Mock appeal modal state must be completely removed');
    assert.match(gradeViewSrc, /ClearanceCertificateModal/);
});

test('Task 7: ArchiveSubmissionModal & SubmissionPage render 4 independent upload slots, linked BM03/BM04 and closing window check', () => {
    const archiveModalSrc = read('frontend/src/components/forms/ArchiveSubmissionModal.jsx');
    const submissionPageSrc = read('frontend/src/pages/student/SubmissionPage.jsx');

    assert.match(archiveModalSrc, /REPORT_WORD/);
    assert.match(archiveModalSrc, /REPORT_PDF/);
    assert.match(archiveModalSrc, /DEMO_VIDEO/);
    assert.match(archiveModalSrc, /SLIDE_PPTX/);
    assert.match(archiveModalSrc, /BM03/);
    assert.match(archiveModalSrc, /BM04/);

    assert.match(submissionPageSrc, /REPORT_WORD|REPORT_PDF/);
});

test('Task 7: Two-stage archival review and clearance certificate signing queues in ProgressTrackingPage & ProjectOversightPage', () => {
    const progressSrc = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
    const oversightSrc = read('frontend/src/pages/admin/ProjectOversightPage.jsx');

    assert.match(progressSrc, /reviewArchiveByMentor/);
    assert.match(oversightSrc, /reviewArchiveByAcademicAffairs/);
    assert.match(oversightSrc, /signClearanceCertificate/);
});

test('Task 7: ClearanceCertificateModal displays Institute Director digital signature and effective topic title', () => {
    const modalSrc = read('frontend/src/components/forms/ClearanceCertificateModal.jsx');

    assert.match(modalSrc, /VIỆN TRƯỞNG|Viện trưởng/i);
    assert.match(modalSrc, /verificationHash/);
    assert.match(modalSrc, /effectiveTopicTitle|topicTitle/);
});

test('Task 7: Rule 2.6 Button text integrity across all modified frontend files', () => {
    const filesToCheck = [
        'frontend/src/pages/admin/RubricManagementPage.jsx',
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        'frontend/src/pages/admin/CouncilDetailPage.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
        'frontend/src/pages/admin/ProjectOversightPage.jsx',
        'frontend/src/pages/lecturer/GradingPage.jsx',
        'frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx',
        'frontend/src/pages/lecturer/ProgressTrackingPage.jsx',
        'frontend/src/pages/student/SubmissionPage.jsx',
        'frontend/src/pages/student/StudentDashboardPage.jsx',
        'frontend/src/pages/student/GradeViewPage.jsx',
        'frontend/src/components/forms/ArchiveSubmissionModal.jsx',
        'frontend/src/components/forms/ClearanceCertificateModal.jsx',
    ];

    const forbiddenSymbolsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚠️❌]/;

    filesToCheck.forEach((filePath) => {
        const fullContent = read(filePath);
        // Find all <Button ...>text</Button>
        const buttonRegex = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = buttonRegex.exec(fullContent)) !== null) {
            const innerText = match[1];
            // Remove nested tags
            const textOnly = innerText.replace(/<[^>]+>/g, '').trim();
            if (forbiddenSymbolsRegex.test(textOnly)) {
                assert.fail(`Rule 2.6 violation in ${filePath}: Button contains forbidden symbol "${textOnly}"`);
            }
        }
    });
});
