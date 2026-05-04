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
    CHAIRMAN: 'Chu tich',
    SECRETARY: 'Thu ky',
    REVIEWER: 'Uy vien',
};

const seedReplacements = ({ registration, scorerInfo }) => ([
    ['ThS. VĂµ Quá»‘c LÆ°Æ¡ng', scorerInfo.name || ''],
    ['Chá»§ tá»‹ch', roleLabelMap[scorerInfo.roleInCouncil] || scorerInfo.roleInCouncil || ''],
    ['Tráº§n Quang Nhanh', registration?.student?.fullName || ''],
    ['2124802010474', registration?.student?.code || ''],
    ['D21CNTT01', registration?.student?.className || registration?.student?.class || ''],
    ['D21', registration?.student?.course || registration?.student?.cohort || ''],
    ['CĂ´ng nghá»‡ thĂ´ng tin', registration?.student?.department || ''],
    ['XĂ¢y dá»±ng website quáº£n lĂ½ Ä‘á» cÆ°Æ¡ng cho trÆ°á»ng Ä‘áº¡i há»c Thá»§ Dáº§u Má»™t', registration?.topic?.title || ''],
]);

const buildA4ScoreSheetHtml = ({ registration, defenseResult, scorerInfo = {} }) => {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const criteria = defenseResult.criterionScores || [];
    const totalRaw = criteria.reduce((sum, row) => sum + (Number(row.score) || 0), 0);

    let html = template;
    for (const [src, target] of seedReplacements({ registration, scorerInfo })) {
        html = html.split(src).join(escapeHtml(target));
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
