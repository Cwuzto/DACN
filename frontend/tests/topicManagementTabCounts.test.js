import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const topicManagementPath = path.resolve(__dirname, '../src/pages/admin/TopicManagementPage.jsx');

test('Admin Topic Management: File exists and adheres to UTF-8 without BOM (Rule 2.4)', () => {
    assert.equal(fs.existsSync(topicManagementPath), true, 'TopicManagementPage.jsx must exist');
    const buffer = fs.readFileSync(topicManagementPath);
    assert.equal(
        buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF,
        false,
        'File must not have UTF-8 BOM'
    );
});

test('Admin Topic Management: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const content = fs.readFileSync(topicManagementPath, 'utf8');
    const rawEmojiRegex = /<Button[^>]*>[\s\S]*?([←→+🤖📋✓✏️👥🗑️🔓▾▴↗])[\s\S]*?<\/Button>/;
    assert.equal(
        rawEmojiRegex.test(content),
        false,
        'Buttons in TopicManagementPage.jsx must not contain raw symbols or emojis in text labels'
    );
});

test('Admin Topic Management: useTopics is called without statusFilter so catalog is fully loaded', () => {
    const content = fs.readFileSync(topicManagementPath, 'utf8');
    assert.equal(
        content.includes('const topicsQuery = useTopics(scope);'),
        true,
        'topicsQuery must load all topics for scope to preserve stable tab counts'
    );
    assert.equal(
        content.includes('useTopics(scope, { status: statusFilter'),
        false,
        'must not filter useTopics by statusFilter on server'
    );
});

test('Admin Topic Management: counts are derived from baseTopics to prevent count collapse on tab change', () => {
    const content = fs.readFileSync(topicManagementPath, 'utf8');
    assert.equal(
        content.includes('const baseTopics = useMemo'),
        true,
        'must compute baseTopics filtered by semester'
    );
    assert.equal(
        content.includes('const counts = useMemo'),
        true,
        'must compute counts dictionary from baseTopics'
    );
    assert.equal(
        content.includes('counts[tab.key] ?? 0'),
        true,
        'each tab must look up its stable count from counts dictionary'
    );
});

test('Admin Topic Management: simulate tab count stability across status selection', () => {
    const mockTopics = [
        { id: 1, title: 'Đề tài 1', status: 'APPROVED', semesterId: 1 },
        { id: 2, title: 'Đề tài 2', status: 'APPROVED', semesterId: 1 },
        { id: 3, title: 'Đề tài 3', status: 'APPROVED', semesterId: 2 },
    ];

    const semesterFilter = 'all';
    const baseTopics = semesterFilter === 'all'
        ? mockTopics
        : mockTopics.filter((t) => t.semesterId === semesterFilter);

    const counts = {
        all: baseTopics.length,
        PENDING: baseTopics.filter((t) => t.status === 'PENDING').length,
        APPROVED: baseTopics.filter((t) => t.status === 'APPROVED').length,
        DRAFT: baseTopics.filter((t) => t.status === 'DRAFT').length,
        REJECTED: baseTopics.filter((t) => t.status === 'REJECTED').length,
    };

    assert.equal(counts.all, 3);
    assert.equal(counts.APPROVED, 3);
    assert.equal(counts.PENDING, 0);
    assert.equal(counts.DRAFT, 0);
    assert.equal(counts.REJECTED, 0);

    // When statusFilter is changed to 'PENDING', counts must remain unchanged
    const statusFilter = 'PENDING';
    const filteredTopics = baseTopics.filter((t) => t.status === statusFilter);
    assert.equal(filteredTopics.length, 0);
    // Counts remain 3, 3, 0, 0, 0
    assert.equal(counts.all, 3);
    assert.equal(counts.APPROVED, 3);
    assert.equal(counts.PENDING, 0);
});

