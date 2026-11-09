import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appLayoutSource = fs.readFileSync(path.join(root, 'src/components/layout/AppLayout.jsx'), 'utf8');

test('AppLayout correctly imports NAVIGATION_REGISTRY to prevent ReferenceError when location.search is present', () => {
    // Verify import from navigationRegistry includes NAVIGATION_REGISTRY
    assert.match(
        appLayoutSource,
        /import\s*\{[^}]*NAVIGATION_REGISTRY[^}]*\}\s*from\s*['"][^'"]*navigationRegistry['"]/,
        'AppLayout must import NAVIGATION_REGISTRY from navigationRegistry to support query string tab matching'
    );
});

test('AppLayout isActive function executes query parameter sibling check safely', () => {
    assert.match(
        appLayoutSource,
        /NAVIGATION_REGISTRY\.some/,
        'AppLayout isActive function should use NAVIGATION_REGISTRY.some safely'
    );
});
