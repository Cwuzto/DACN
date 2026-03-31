const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const TEXT_EXTENSIONS = new Set([
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.json',
    '.md',
    '.prisma',
    '.css',
    '.html',
    '.yml',
    '.yaml',
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);

const decoder = new TextDecoder('utf-8', { fatal: true });

const shouldCheckFile = (filePath) => TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const walk = (dir, out) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
        if (entry.name.startsWith('.') && entry.name !== '.env.example') return;
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) return;
            walk(path.join(dir, entry.name), out);
            return;
        }
        const fullPath = path.join(dir, entry.name);
        if (shouldCheckFile(fullPath)) out.push(fullPath);
    });
};

const files = [];
walk(rootDir, files);

const invalidFiles = [];

files.forEach((filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        decoder.decode(buffer);
    } catch (error) {
        invalidFiles.push({
            filePath: path.relative(rootDir, filePath),
            reason: error.message,
        });
    }
});

if (invalidFiles.length > 0) {
    process.stderr.write('[FAIL] UTF-8 validation failed.\n');
    invalidFiles.forEach((item) => {
        process.stderr.write(` - ${item.filePath}: ${item.reason}\n`);
    });
    process.exit(1);
}

process.stdout.write(`[PASS] UTF-8 validation passed (${files.length} files checked).\n`);
