const { sanitizeRichText } = require('../../src/services/portalContentSanitizer');

describe('portal rich text sanitization', () => {
  test('removes executable markup while preserving allowed announcement content', () => {
    expect(sanitizeRichText('<p onclick="alert(1)">Thông báo <strong>quan trọng</strong></p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'))
      .toBe('<p>Thông báo <strong>quan trọng</strong></p><a>x</a>');
  });
});
