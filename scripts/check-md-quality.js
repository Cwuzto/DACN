const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.agent']);
const TARGET_EXT = '.md';

const MOJIBAKE_PATTERNS = [
  /Ã./g,
  /Â./g,
  /Ä./g,
  /áº/g,
  /á»/g,
  /Æ°/g,
  /â€/g,
  /ðŸ/g,
  /�/g,
];

const NON_DIACRITIC_PHRASES = [
  'dang ky',
  'hoc ky',
  'de tai',
  'bao cao',
  'sinh vien',
  'giang vien',
  'hoi dong',
  'quan ly',
  'thanh cong',
  'khong the',
  'khong duoc',
  'cap nhat',
  'tien do',
  'nguoi dung',
  'du lieu',
  'u tiên',
];

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

const walk = (dir, out) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.vscode' && entry.name !== '.docs') continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }

    if (path.extname(entry.name).toLowerCase() !== TARGET_EXT) continue;
    out.push(path.join(dir, entry.name));
  }
};

const files = [];
walk(rootDir, files);

const issues = [];

for (const filePath of files) {
  const raw = fs.readFileSync(filePath, 'utf8');

  for (const pattern of MOJIBAKE_PATTERNS) {
    const hit = raw.match(pattern);
    if (hit && hit.length > 0) {
      issues.push({
        file: path.relative(rootDir, filePath),
        type: 'mojibake',
        detail: `Phát hiện mẫu nghi ngờ: ${pattern}`,
      });
      break;
    }
  }

  const textWithoutCode = raw.replace(CODE_BLOCK_REGEX, '');
  const lowered = textWithoutCode.toLowerCase();

  const phraseHits = NON_DIACRITIC_PHRASES.filter((phrase) => lowered.includes(phrase));
  if (phraseHits.length >= 3) {
    issues.push({
      file: path.relative(rootDir, filePath),
      type: 'non_diacritic_vi',
      detail: `Nhiều cụm tiếng Việt không dấu: ${phraseHits.slice(0, 6).join(', ')}`,
    });
  }
}

if (issues.length > 0) {
  console.error('[FAIL] Markdown text-quality check failed.');
  for (const issue of issues) {
    console.error(` - ${issue.file} [${issue.type}] ${issue.detail}`);
  }
  process.exit(1);
}

console.log(`[PASS] Markdown text-quality passed (${files.length} file .md checked).`);
