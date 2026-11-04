import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('GradeViewPage source code has no undefined score identifiers causing runtime crash', () => {
  const filePath = path.resolve(__dirname, '../src/pages/student/GradeViewPage.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify that the 6 undefined variables are removed or properly handled
  assert.equal(
    content.includes('councilScore'),
    false,
    'councilScore undefined identifier must be removed from GradeViewPage'
  );
  assert.equal(
    content.includes('reviewerScore'),
    false,
    'reviewerScore undefined identifier must be removed from GradeViewPage'
  );
  assert.equal(
    content.includes('mentorScore'),
    false,
    'mentorScore undefined identifier must be removed from GradeViewPage'
  );
});

test('GradeViewPage removes fake hardcoded CLO score table and fake student data', () => {
  const filePath = path.resolve(__dirname, '../src/pages/student/GradeViewPage.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Mock CLO scores
  assert.equal(
    content.includes('9.0 / 10'),
    false,
    'Mock CLO-1 score 9.0 / 10 must be removed'
  );
  assert.equal(
    content.includes('9.2 / 10'),
    false,
    'Mock CLO-2 score 9.2 / 10 must be removed'
  );
  assert.equal(
    content.includes('8.5 / 10'),
    false,
    'Mock CLO-3 score 8.5 / 10 must be removed'
  );
  assert.equal(
    content.includes('8.8 / 10'),
    false,
    'Mock CLO-4 score 8.8 / 10 must be removed'
  );

  // Hardcoded mock student name/code
  assert.equal(
    content.includes('Nguyễn Trường An (21120489)'),
    false,
    'Hardcoded mock student Nguyễn Trường An (21120489) must be replaced with dynamic data'
  );
});
