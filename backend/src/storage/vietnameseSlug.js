const RESERVED_WINDOWS_NAMES = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
]);

const FALLBACK_SLUG = 'tai-lieu';

/**
 * Transliterate Vietnamese text into a safe, deterministic kebab-case slug.
 * Handles NFC/NFD Unicode, diacritics, path traversal, reserved names, and length limits.
 *
 * @param {string|any} input - Raw input string or value
 * @param {Object} [options]
 * @param {number} [options.maxLength=80] - Maximum length of the returned slug
 * @returns {string} Sanitized slug containing only [a-z0-9-]
 */
const toVietnameseSlug = (input, { maxLength = 80 } = {}) => {
    if (input === null || input === undefined) {
        return FALLBACK_SLUG;
    }

    let str = String(input).trim();
    if (!str) {
        return FALLBACK_SLUG;
    }

    // Replace Vietnamese d with stroke (NFC/NFD) before accent stripping
    str = str.replace(/[đĐ\u0111\u0110]/g, 'd');

    // Decompose accents
    str = str.normalize('NFD');
    str = str.replace(/[\u0300-\u036f]/g, '');

    // Normalize back to NFC
    str = str.normalize('NFC');
    str = str.replace(/[đĐ]/g, 'd');

    // Lowercase
    str = str.toLowerCase();

    // Replace directory traversal sequences and non-alphanumeric chars with hyphen
    str = str.replace(/\.{2,}/g, '-');
    str = str.replace(/[^a-z0-9]/g, '-');

    // Collapse consecutive hyphens
    str = str.replace(/-+/g, '-');

    // Trim leading/trailing hyphens
    str = str.replace(/^-+|-+$/g, '');

    if (!str) {
        return FALLBACK_SLUG;
    }

    // Guard against Windows reserved device names
    if (RESERVED_WINDOWS_NAMES.has(str)) {
        return FALLBACK_SLUG;
    }

    // Enforce maxLength
    if (str.length > maxLength) {
        str = str.slice(0, maxLength).replace(/-+$/, '');
    }

    return str || FALLBACK_SLUG;
};

module.exports = {
    toVietnameseSlug,
    FALLBACK_SLUG,
};
