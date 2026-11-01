const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => sanitizeHtml(String(html || ''), {
  allowedTags: ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'blockquote', 'br', 'img'],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowedIframeHostnames: [],
  disallowedTagsMode: 'discard',
});

module.exports = {
  sanitizeRichText,
};
