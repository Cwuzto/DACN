import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('ErrorBoundary: component exists, handles errors, and adheres to Rule 2.6', () => {
    const src = read('frontend/src/components/common/ErrorBoundary.jsx');
    assert.match(src, /class ErrorBoundary extends React\.Component|class ErrorBoundary extends Component/, 'Must be a class component');
    assert.match(src, /getDerivedStateFromError/, 'Must implement getDerivedStateFromError');
    assert.match(src, /componentDidCatch/, 'Must implement componentDidCatch');
    assert.match(src, /ReloadOutlined|HomeOutlined/, 'Must use Ant Design icon components');
    assert.ok(!/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/.test(src), 'Must strictly adhere to Rule 2.6 (no raw symbols in buttons)');
});

test('AppLayout & App: Integrates ErrorBoundary around routes and outlets', () => {
    const appSrc = read('frontend/src/App.jsx');
    const layoutSrc = read('frontend/src/components/layout/AppLayout.jsx');
    assert.match(appSrc, /ErrorBoundary/, 'App.jsx must import and use ErrorBoundary');
    assert.match(layoutSrc, /ErrorBoundary/, 'AppLayout.jsx must import and wrap outlet with ErrorBoundary');
});
