const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => sanitizeHtml(String(html || ''), {
  allowedTags: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'strong', 'b', 'em', 'i', 'u',
    'blockquote', 'br', 'hr', 'img', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  nonTextTags: [
    'style', 'script', 'textarea', 'option', 'noscript', 'noembed',
    'iframe', 'object', 'embed', 'svg', 'form', 'math',
  ],
  disallowedTagsMode: 'discard',
});

module.exports = {
  sanitizeRichText,
};
