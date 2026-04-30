const PDFDocument = require('pdfkit');

const fmtDateTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('vi-VN');
};

const drawRow = (doc, cols, y, heights = 22) => {
    let x = 50;
    for (const col of cols) {
        doc.rect(x, y, col.width, heights).stroke();
        doc.fontSize(col.fontSize || 10).text(String(col.text ?? ''), x + 4, y + 6, {
            width: col.width - 8,
            align: col.align || 'left',
        });
        x += col.width;
    }
};

const generateScoreSheetPdfBuffer = async ({ registration, defenseResult, rubricVersion = 'v1' }) => new Promise((resolve, reject) => {
    try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const criteria = defenseResult.criterionScores || [];
        const totalRaw = criteria.reduce((sum, row) => sum + (row.score || 0), 0);

        doc.fontSize(14).font('Helvetica-Bold').text('PHIẾU CHẤM BẢO VỆ ĐỒ ÁN', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Rubric: ${rubricVersion}`);
        doc.text(`Thời gian xuất: ${fmtDateTime(new Date())}`);
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').text('Thông tin sinh viên / đề tài');
        doc.font('Helvetica');
        doc.text(`Sinh viên: ${registration.student?.fullName || 'N/A'} (${registration.student?.code || 'N/A'})`);
        doc.text(`Đề tài: ${registration.topic?.title || 'N/A'}`);
        doc.text(`Hội đồng: ${registration.council?.name || 'N/A'}`);
        doc.text(`Ngày bảo vệ: ${registration.council?.defenseDate ? fmtDateTime(registration.council.defenseDate) : 'N/A'}`);
        doc.moveDown(0.8);

        doc.font('Helvetica-Bold').text('Bảng điểm chi tiết');
        let y = doc.y + 6;
        drawRow(doc, [
            { text: 'Tiêu chí', width: 210, align: 'left' },
            { text: 'Điểm tối đa', width: 90, align: 'center' },
            { text: 'Điểm đạt', width: 80, align: 'center' },
            { text: 'Nhận xét', width: 115, align: 'left' },
        ], y, 24);

        y += 24;
        for (const row of criteria) {
            drawRow(doc, [
                { text: row.criterionLabel || row.criterionCode, width: 210 },
                { text: row.maxScore, width: 90, align: 'center' },
                { text: row.score, width: 80, align: 'center' },
                { text: row.comment || '', width: 115 },
            ], y, 28);
            y += 28;
        }

        y += 8;
        doc.font('Helvetica-Bold').text(`Tổng điểm hệ 100: ${totalRaw}`, 50, y);
        doc.text(`Tổng điểm hệ 10: ${defenseResult.finalScore ?? 'N/A'}`, 50, y + 18);

        y += 44;
        doc.font('Helvetica').text(`Nhận xét chung: ${defenseResult.comments || 'N/A'}`, 50, y, { width: 495 });

        y += 48;
        doc.text(`Người khóa điểm: ${defenseResult.lockedByUser?.fullName || 'N/A'}`);
        doc.text(`Thời gian khóa: ${fmtDateTime(defenseResult.lockedAt)}`);
        doc.text(`Cập nhật bởi: ${defenseResult.evaluator?.fullName || 'N/A'}`);

        doc.end();
    } catch (error) {
        reject(error);
    }
});

module.exports = {
    generateScoreSheetPdfBuffer,
};
