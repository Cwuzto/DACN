const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '../../../frontend/src/pages/lecturer/phieu_cham.html');

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const roleLabelMap = {
    CHAIRMAN: 'Chủ tịch',
    SECRETARY: 'Thư ký',
    REVIEWER: 'Ủy viên',
};

const buildA4ScoreSheetHtml = ({ registration, defenseResult, scorerInfo = {} }) => {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const criteria = defenseResult.criterionScores || [];
    const totalRaw = criteria.reduce((sum, row) => sum + (Number(row.score) || 0), 0);

    let html = template;
    const tokenMap = {
        EVALUATOR_NAME: scorerInfo.name || '',
        COUNCIL_ROLE: roleLabelMap[scorerInfo.roleInCouncil] || scorerInfo.roleInCouncil || '',
        STUDENT_NAME: registration?.student?.fullName || '',
        STUDENT_CODE: registration?.student?.code || '',
        STUDENT_CLASS: registration?.student?.className || registration?.student?.class || '',
        STUDENT_COHORT: registration?.student?.course || registration?.student?.cohort || '',
        STUDENT_DEPARTMENT: registration?.student?.department || '',
        TOPIC_TITLE: registration?.topic?.title || '',
    };
    for (const [key, value] of Object.entries(tokenMap)) {
        html = html.split(`{{${key}}}`).join(escapeHtml(value));
    }

    let scoreIdx = 0;
    html = html.replace(/<td><\/td>/g, () => {
        if (scoreIdx < criteria.length) {
            const value = criteria[scoreIdx]?.score;
            scoreIdx += 1;
            return `<td class=\"text-center\">${escapeHtml(value ?? '')}</td>`;
        }
        return `<td class=\"text-center\"><strong>${totalRaw.toFixed(2)}</strong></td>`;
    });

    // Keep side white margins when rendering PDF via print mode.
    html = html.replace(
        '</head>',
        `<style>
            @page { size: A4; margin: 10mm 12mm; }
            @media print {
                body {
                    background: #fff !important;
                    display: block !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .page {
                    width: auto !important;
                    min-height: auto !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                }
                thead { display: table-row-group !important; }
                tr, td, th { break-inside: avoid; page-break-inside: avoid; }
                .footer-note, .signature-section {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
            }
        </style></head>`,
    );

    return html;
};

const generateByPuppeteer = async (html) => {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        });
    } finally {
        await browser.close();
    }
};

const generateScoreSheetPdfBuffer = async (params) => generateByPuppeteer(buildA4ScoreSheetHtml(params));

module.exports = {
    buildA4ScoreSheetHtml,
    generateScoreSheetPdfBuffer,
};
