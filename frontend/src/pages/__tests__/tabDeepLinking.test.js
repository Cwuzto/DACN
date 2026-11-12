import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('TopicApprovalPage: Synchronizes activeTab with ?tab=bm01 or ?tab=bm02a query params', () => {
    const src = read('frontend/src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(src, /useSearchParams/, 'TopicApprovalPage must import and use useSearchParams');
    assert.match(src, /bm01/, 'Must handle bm01 tab');
    assert.match(src, /bm02a/, 'Must handle bm02a tab');
    assert.match(src, /setSearchParams/, 'Must update search params when tab changes');
    assert.match(src, /handleTabChange/, 'Must have tab switch handler');
});

test('ProgressTrackingPage: Synchronizes activeTab with ?tab=bm04 query param', () => {
    const src = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
    assert.match(src, /tabParam === ['"]bm04['"]|searchParams\.get\(['"]tab['"]\)/, 'ProgressTrackingPage must read tab parameter');
    assert.match(src, /setSearchParams/, 'Must update search params on tab change');
    assert.match(src, /handleTabChange/, 'Must have tab switch handler');
});

test('ProjectPeriodPage: Handles tab=decisions query param gracefully', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    assert.match(src, /tabParam === ['"]decisions['"]|params\.get\(['"]tab['"]\) === ['"]decisions['"]/, 'ProjectPeriodPage must handle decisions tab');
    assert.match(src, /handleOpenDecisionList/, 'Must trigger handleOpenDecisionList for decisions tab');
});
