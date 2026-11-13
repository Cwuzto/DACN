import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const espree = require(require.resolve('espree', { paths: [root] }));

function walk(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const item of fs.readdirSync(dir)) {
        if (item === '__tests__' || item === 'tests' || item === 'node_modules' || item.includes('.test.') || item.includes('.spec.')) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            files = files.concat(walk(full));
        } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

function traverse(node, visitor) {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
            child.forEach(c => traverse(c, visitor));
        } else if (child && typeof child === 'object') {
            traverse(child, visitor);
        }
    }
}

// Approved exceptions for intentional session synchronization effects only
const APPROVED_AUDIT_EXCEPTIONS = {
    'src/components/layout/AppLayout.jsx': [
        'authService.getMe', // Intentional session sync across tabs & BroadcastChannel
    ],
};

function analyzeFileEffects(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    let ast;
    try {
        ast = espree.parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
    } catch (e) {
        throw new Error(`Failed to parse ${filePath}: ${e.message}`);
    }

    const importedServices = new Set();
    traverse(ast, (node) => {
        if (node.type === 'ImportDeclaration') {
            const src = node.source.value;
            if (src.includes('services/')) {
                for (const spec of node.specifiers) {
                    importedServices.add(spec.local.name);
                }
            }
        }
    });

    if (importedServices.size === 0) return [];

    const functionBodies = new Map();
    traverse(ast, (node) => {
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
            if (node.init) {
                if (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') {
                    functionBodies.set(node.id.name, node.init);
                } else if (node.init.type === 'CallExpression' && node.init.callee.name === 'useCallback' && node.init.arguments[0]) {
                    functionBodies.set(node.id.name, node.init.arguments[0]);
                }
            }
        } else if (node.type === 'FunctionDeclaration' && node.id) {
            functionBodies.set(node.id.name, node);
        }
    });

    function nodeCallsService(targetNode, visitedFns = new Set()) {
        let calls = [];
        traverse(targetNode, (n) => {
            if (n.type === 'CallExpression') {
                if (n.callee.type === 'MemberExpression') {
                    if (n.callee.object.type === 'Identifier' && importedServices.has(n.callee.object.name)) {
                        calls.push(n.callee.object.name + '.' + (n.callee.property.name || '()'));
                    }
                } else if (n.callee.type === 'Identifier') {
                    const fnName = n.callee.name;
                    if (!visitedFns.has(fnName) && functionBodies.has(fnName)) {
                        visitedFns.add(fnName);
                        const subCalls = nodeCallsService(functionBodies.get(fnName), visitedFns);
                        calls.push(...subCalls);
                    }
                }
            }
        });
        return calls;
    }

    const fileViolations = [];
    traverse(ast, (node) => {
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'useEffect') {
            const effectCallback = node.arguments[0];
            if (effectCallback) {
                const calls = nodeCallsService(effectCallback);
                if (calls.length > 0) {
                    fileViolations.push(...calls);
                }
            }
        }
    });

    return [...new Set(fileViolations)];
}

test('Query Migration Audit: scan routed pages and child components for unapproved service calls in useEffect', () => {
    const pages = walk(path.join(root, 'src/pages'));
    const components = walk(path.join(root, 'src/components'));
    const allFiles = [...pages, ...components];

    const violations = [];

    for (const file of allFiles) {
        const relativePath = path.relative(root, file).replace(/\\/g, '/');
        const calls = analyzeFileEffects(file);
        if (calls.length === 0) continue;

        const allowedCalls = APPROVED_AUDIT_EXCEPTIONS[relativePath] || [];
        const unapprovedCalls = calls.filter((call) => !allowedCalls.includes(call));

        if (unapprovedCalls.length > 0) {
            violations.push({
                file: relativePath,
                unapprovedCalls,
            });
        }
    }

    if (violations.length > 0) {
        const summary = violations
            .map((v) => `  - ${v.file}: ${v.unapprovedCalls.join(', ')}`)
            .join('\n');
        assert.fail(`Found ${violations.length} files with unapproved manual service calls in useEffect:\n${summary}`);
    }
});
