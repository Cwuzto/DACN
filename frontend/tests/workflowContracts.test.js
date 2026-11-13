import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('student title adjustment modal receives its required workflow props', () => {
    const source = read('src/pages/student/StudentDashboardPage.jsx');
    assert.match(source, /registrationId=\{currentRegistration\?\.id\}/);
    assert.match(source, /currentTitle=\{/);
    assert.match(source, /decisionDate=\{currentRegistration\?\.decisionDate\}/);
    assert.doesNotMatch(source, /<TitleAdjustmentModal[\s\S]*?registration=\{currentRegistration\}/);
});

test('BM04 modal uses the open prop and the backend conclusion enum', () => {
    const page = read('src/pages/lecturer/ProgressTrackingPage.jsx');
    const modal = read('src/components/lecturer/BM04EvaluationModal.jsx');
    assert.match(page, /<BM04EvaluationModal[\s\S]*?open=\{bm04ModalOpen\}/);
    assert.doesNotMatch(page, /<BM04EvaluationModal[\s\S]*?visible=\{bm04ModalOpen\}/);
    assert.match(modal, /Radio value="NOT_AGREED_FOR_DEFENSE"/);
    assert.doesNotMatch(modal, /Radio value="NOT_AGREED"/);
});

test('lecturer dashboard connects both pending workflow queues to real services', () => {
    const source = read('src/pages/lecturer/LecturerDashboardPage.jsx');
    assert.match(source, /getPendingTitleAdjustments\(\)/);
    assert.match(source, /approveResubmittedBM01\(registrationId/);
    assert.match(source, /reviewTitleAdjustment\(adjustmentId/);
});

test('defense council candidate UI is restricted to DEFENSE_READY', () => {
    const source = read('src/pages/admin/CouncilAssignmentPage.jsx');
    assert.match(source, /councilTypeFilter === 'DEFENSE_COUNCIL'\) return r\.status === 'DEFENSE_READY'/);
});

test('defense grading ledger connects publication and history modals, forbidding post-publication correction', () => {
    const page = read('src/pages/admin/GradingDefensePage.jsx');
    const pubModal = read('src/components/admin/DefenseResultPublicationModal.jsx');
    const correctModal = read('src/components/admin/CorrectDefenseResultModal.jsx');
    const service = read('src/services/evaluationService.js');

    assert.match(page, /<DefenseResultPublicationModal[\s\S]*?open=\{publishModalOpen && Boolean\(selectedSemesterId\)\}/);
    assert.match(page, /<PublicationHistoryModal[\s\S]*?open=\{historyModalOpen && Boolean\(selectedSemesterId\)\}/);
    assert.doesNotMatch(page, /<CorrectDefenseResultModal/);

    assert.match(pubModal, /INITIAL/);
    assert.match(pubModal, /SUPPLEMENTARY/);
    assert.doesNotMatch(pubModal, /CORRECTION|correctionItems/);
    assert.match(pubModal, /usePublishDefenseResults/);
    // Predecessor validation and retained idempotency keys are runtime contracts.
    assert.match(service, /publishDefenseResults:\s*async \(semesterId, data, idempotencyKey\)/);

    assert.match(correctModal, /correctDefenseResult/);
    assert.match(service, /correctDefenseResult:\s*async/);
});

test('student grade view only derives official totals from published snapshots', () => {
    const page = read('src/pages/student/GradeViewPage.jsx');
    assert.match(page, /const compositeScore = hasScore \? Number\(finalScore\)\.toFixed\(1\) : '—';/);
    assert.match(page, /Không công bố riêng lẻ/);
    assert.doesNotMatch(page, /validScores\.reduce/);
});

