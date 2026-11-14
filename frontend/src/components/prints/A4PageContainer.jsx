import React from 'react';

/**
 * A4PageContainer
 * Standardized A4 Academic Document Container
 * Width: 210mm, Min-Height: 297mm, Standard Academic Margin & Print Media Rules.
 * UTF-8 (no BOM)
 */
export default function A4PageContainer({ children, className = '', id = 'academic-a4-sheet', style = {} }) {
    return (
        <div
            id={id}
            className={`simulated-a4-sheet bg-white text-black shadow-lg mx-auto ${className}`}
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm 15mm 20mm 25mm',
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: '12pt',
                lineHeight: '1.35',
                color: '#000000',
                boxSizing: 'border-box',
                position: 'relative',
                ...style,
            }}
        >
            <style>{`
                @media print {
                    body {
                        background-color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Hide UI elements, overlays and modals during browser print */
                    .no-print,
                    .ant-modal-mask,
                    .ant-modal-header,
                    .ant-modal-footer,
                    .ant-modal-close,
                    .ant-drawer-mask,
                    .ant-drawer-header,
                    .ant-drawer-close,
                    .ant-tabs-nav,
                    header,
                    aside,
                    nav {
                        display: none !important;
                    }
                    .simulated-a4-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                        page-break-after: auto;
                    }
                    .page-break-always {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .page-break-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 15mm 10mm 15mm 20mm;
                    }
                }
            `}</style>
            {children}
        </div>
    );
}
