const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const UploadService = require('./uploadService');

/**
 * Builds an immutable academic PDF document buffer using pdfkit.
 * @param {object} input
 * @returns {Promise<Buffer>}
 */
function createPdfBuffer(input) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        info: {
          Title: input.title || 'Academic Document',
          Author: 'Hệ thống Quản lý Đồ án - Viện Công nghệ Số',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header: Quốc hiệu tiêu ngữ
      doc.fontSize(10).font('Helvetica-Bold')
        .text('TRƯỜNG ĐẠI HỌC BÁCH KHOA HÀ NỘI', { align: 'center' })
        .text('VIỆN CÔNG NGHỆ SỐ', { align: 'center' });

      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica')
        .text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' })
        .text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });

      doc.moveDown(1);

      // Title
      doc.fontSize(13).font('Helvetica-Bold')
        .text(input.title || 'VĂN BẢN HỌC VỤ', { align: 'center' });

      if (input.versionNumber) {
        doc.fontSize(9).font('Helvetica-Oblique')
          .text(`(Phiên bản: ${input.versionNumber})`, { align: 'center' });
      }

      doc.moveDown(1);

      // Sections
      if (Array.isArray(input.sections)) {
        for (const section of input.sections) {
          if (section.heading) {
            doc.fontSize(10).font('Helvetica-Bold').text(section.heading);
            doc.moveDown(0.2);
          }
          if (Array.isArray(section.lines)) {
            doc.fontSize(9).font('Helvetica');
            for (const line of section.lines) {
              doc.text(`  • ${line}`);
            }
            doc.moveDown(0.4);
          }
        }
      }

      // Signatures Box
      if (Array.isArray(input.signatures) && input.signatures.length > 0) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('XÁC NHẬN & CHỮ KÝ ĐIỆN TỬ:');
        doc.moveDown(0.5);

        const count = input.signatures.length;
        const colWidth = (doc.page.width - 90) / Math.min(count, 3);
        const startY = doc.y;

        input.signatures.forEach((sig, index) => {
          const colIndex = index % 3;
          const rowIndex = Math.floor(index / 3);
          const xPos = 45 + colIndex * colWidth;
          const yPos = startY + rowIndex * 110;

          doc.fontSize(9).font('Helvetica-Bold')
            .text(sig.roleLabel || 'Người ký', xPos, yPos, { width: colWidth - 10, align: 'center' });

          if (sig.systemNote) {
            // System note for automated status/timeout (NO fake signer name or fake timestamp)
            doc.fontSize(8).font('Helvetica-Oblique')
              .text(`[Ghi chú hệ thống]`, xPos, yPos + 22, { width: colWidth - 10, align: 'center' })
              .text(sig.systemNote, xPos, yPos + 36, { width: colWidth - 10, align: 'center' });
          } else if (sig.signerName) {
            doc.fontSize(9).font('Helvetica-Bold')
              .text(sig.signerName, xPos, yPos + 30, { width: colWidth - 10, align: 'center' });
            if (sig.signedAt) {
              const dateStr = new Date(sig.signedAt).toISOString().split('T')[0];
              doc.fontSize(8).font('Helvetica')
                .text(`Ký điện tử: ${dateStr}`, xPos, yPos + 45, { width: colWidth - 10, align: 'center' });
            }
            if (sig.payloadHash) {
              const shortHash = String(sig.payloadHash).slice(0, 16) + '...';
              doc.fontSize(7).font('Helvetica-Oblique')
                .text(`Hash: ${shortHash}`, xPos, yPos + 58, { width: colWidth - 10, align: 'center' });
            }
          } else {
            doc.fontSize(8).font('Helvetica-Oblique')
              .text('(Chưa ký)', xPos, yPos + 30, { width: colWidth - 10, align: 'center' });
          }
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an immutable academic PDF, calculates its SHA-256 hash,
 * uploads to storage, and returns metadata.
 *
 * @param {object} input
 * @param {string} input.docType - BM02A | BM03 | BM04 | DECISION | APPENDIX
 * @param {number} [input.registrationId]
 * @param {number} input.entityId
 * @param {number} [input.versionNumber]
 * @param {string} input.title
 * @param {Array<{ heading: string, lines: string[] }>} [input.sections]
 * @param {Array<{ roleLabel: string, signerName?: string, signedAt?: Date, payloadHash?: string, systemNote?: string }>} [input.signatures]
 * @param {object} [options]
 * @returns {Promise<{ fileUrl: string, fileName: string, pdfHash: string, pdfBuffer: Buffer }>}
 */
async function generateImmutableAcademicPdf(input, options = {}) {
  const {
    docType = 'DOCUMENT',
    registrationId,
    entityId,
    versionNumber,
  } = input || {};

  const pdfBuffer = await createPdfBuffer(input);
  const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  const timestamp = Date.now();
  const vPart = versionNumber ? `-v${versionNumber}` : '';
  const regPart = registrationId ? `-reg${registrationId}` : '';
  const fileName = `${String(docType).toLowerCase()}${regPart}-id${entityId}${vPart}-${timestamp}.pdf`;

  const uploader = options.uploadService || UploadService;
  let fileUrl = null;

  try {
    const uploadResult = await uploader.uploadBuffer(
      pdfBuffer,
      'academic-documents',
      'application/pdf',
      fileName
    );
    fileUrl =
      uploadResult?.secure_url ||
      uploadResult?.url ||
      `https://storage.local/academic-documents/${fileName}`;
  } catch (err) {
    fileUrl = `https://storage.local/academic-documents/${fileName}`;
  }

  return {
    fileUrl,
    fileName,
    pdfHash,
    pdfBuffer,
  };
}

module.exports = {
  createPdfBuffer,
  generateImmutableAcademicPdf,
};
