/**
 * Markdown Knowledge Base Parser (knowledgeParser.js)
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án Tốt nghiệp
 *
 * Implements Single Source of Truth architecture:
 * Parses human-readable Markdown files in `docs/` into semantic chunks
 * with metadata (id, title, stage, roleScope, text).
 *
 * UTF-8 (no BOM)
 */

const fs = require('fs');
const path = require('path');

function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const REGULATIONS_DIR = path.resolve(__dirname, 'regulations');
const DOCS_DIR = fs.existsSync(REGULATIONS_DIR) ? REGULATIONS_DIR : path.resolve(__dirname, 'docs');

let inMemoryChunksCache = null;
const inMemoryRoleTextCache = new Map();

/**
 * Clear in-memory caches (useful for testing or after editing markdown files).
 */
function clearCache() {
  inMemoryChunksCache = null;
  inMemoryRoleTextCache.clear();
}

/**
 * Parse metadata attributes from HTML comment tag like:
 * <!-- chunk: id="student_core_rules" stage="1" role="STUDENT" -->
 * or <!-- metadata: id="foo" stage="2" role="LECTURER" -->
 *
 * @param {string} commentLine
 * @returns {object} Extracted key-value pairs
 */
function parseMetadataComment(commentLine) {
  if (!commentLine) return {};
  const meta = {};
  const regex = /(\w+)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(commentLine)) !== null) {
    meta[match[1]] = match[2];
  }
  return meta;
}

/**
 * Parse a raw Markdown string into structured semantic chunks.
 *
 * @param {string} markdown
 * @param {string} [defaultRole='STUDENT']
 * @returns {Array<{ id: string, title: string, stage: number, roleScope: string, text: string }>}
 */
function parseMarkdownChunks(markdown, defaultRole = 'STUDENT') {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const chunks = [];

  let currentHeading = null;
  let currentMeta = {};
  let currentContentLines = [];

  function commitCurrentSection() {
    if (!currentHeading) return;

    const rawText = currentContentLines.join('\n').trim();
    if (!rawText) return;

    // Remove any leftover HTML comments from the text body
    const cleanedText = rawText.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!cleanedText) return;

    const id = currentMeta.id || slugify(currentHeading);
    const stage = currentMeta.stage !== undefined ? parseInt(currentMeta.stage, 10) : 1;
    const roleScope = currentMeta.role || currentMeta.roleScope || defaultRole;

    chunks.push({
      id,
      title: currentHeading,
      stage: Number.isNaN(stage) ? 1 : stage,
      roleScope: roleScope.toUpperCase(),
      text: cleanedText,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for level 2 heading "## " (section divider for chunks)
    if (trimmed.startsWith('## ')) {
      commitCurrentSection();

      currentHeading = trimmed.substring(3).trim();
      currentMeta = {};
      currentContentLines = [];

      // Check if next line contains chunk metadata comment
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('<!--') && (nextLine.includes('chunk:') || nextLine.includes('metadata:'))) {
          currentMeta = parseMetadataComment(nextLine);
          i++; // Skip the metadata line from body text
        }
      }
    } else if (currentHeading) {
      currentContentLines.push(line);
    }
  }

  // Commit final section
  commitCurrentSection();

  return chunks;
}

/**
 * Determine default role from filename.
 * @param {string} filename
 * @returns {'STUDENT'|'LECTURER'|'ADMIN'}
 */
function getRoleFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.includes('lecturer')) return 'LECTURER';
  if (lower.includes('admin')) return 'ADMIN';
  return 'STUDENT';
}

/**
 * Load all knowledge chunks from docs directory.
 * Caches in memory after first load.
 *
 * @param {string} [docsDir=DOCS_DIR]
 * @returns {Array<{ id: string, title: string, stage: number, roleScope: string, text: string }>}
 */
function loadChunksFromDocs(docsDir = DOCS_DIR) {
  if (inMemoryChunksCache && docsDir === DOCS_DIR) {
    return inMemoryChunksCache;
  }

  if (!fs.existsSync(docsDir)) {
    return [];
  }

  const entries = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();

  // Enforce consistent order: student -> lecturer -> admin
  const order = ['student', 'lecturer', 'admin'];
  entries.sort((a, b) => {
    const idxA = order.findIndex((key) => a.toLowerCase().includes(key));
    const idxB = order.findIndex((key) => b.toLowerCase().includes(key));
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  const allChunks = [];

  for (const filename of entries) {
    const filePath = path.join(docsDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const defaultRole = getRoleFromFilename(filename);
    const fileChunks = parseMarkdownChunks(content, defaultRole);
    allChunks.push(...fileChunks);
  }

  if (docsDir === DOCS_DIR) {
    inMemoryChunksCache = allChunks;
  }

  return allChunks;
}

/**
 * Load full documentation text for a given role from docs.
 *
 * @param {'STUDENT'|'LECTURER'|'ADMIN'} role
 * @param {string} [docsDir=DOCS_DIR]
 * @returns {string}
 */
function loadKnowledgeTextByRole(role = 'STUDENT', docsDir = DOCS_DIR) {
  const normalizedRole = String(role || 'STUDENT').toUpperCase();

  if (inMemoryRoleTextCache.has(normalizedRole) && docsDir === DOCS_DIR) {
    return inMemoryRoleTextCache.get(normalizedRole);
  }

  let filename = 'student_regulations.md';
  if (normalizedRole === 'LECTURER') {
    filename = 'lecturer_regulations.md';
  } else if (normalizedRole === 'ADMIN') {
    filename = 'admin_regulations.md';
  }

  const filePath = path.join(docsDir, filename);
  let text = '';

  if (fs.existsSync(filePath)) {
    text = fs.readFileSync(filePath, 'utf8');
  }

  if (docsDir === DOCS_DIR && text) {
    inMemoryRoleTextCache.set(normalizedRole, text);
  }

  return text;
}

module.exports = {
  DOCS_DIR,
  REGULATIONS_DIR,
  clearCache,
  parseMetadataComment,
  parseMarkdownChunks,
  getRoleFromFilename,
  loadChunksFromDocs,
  loadKnowledgeTextByRole,
};
