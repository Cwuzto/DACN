import React from 'react';
import OpenModal from './OpenModal';

/**
 * SimulatedDocumentViewer - Reusable Academic A4 Simulated Paper Viewer
 * Renders official Vietnamese administrative documents (BM01, BM02, BM03, BM04, BM05, Decisions, Certificates)
 * with digital signature verification seal, SHA-256 hash stamp, print & download capabilities.
 */
export default function SimulatedDocumentViewer({
    open,
    onClose,
    documentData,
    onDownload,
}) {
    if (!open || !documentData) return null;

    const doc = documentData.doc || documentData;
    const fileName = documentData.fileName || documentData.title || 'van_ban_hoc_vu.pdf';

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        if (onDownload) {
            onDownload(documentData);
        } else {
            alert(`Đang tải tệp: ${fileName}`);
        }
    };

    return (
        <OpenModal
            open={open}
            onClose={onClose}
            maxWidth="880px"
            ariaLabel={`Xem văn bản: ${doc.title || fileName}`}
        >
            <div className="simulated-doc-container">
                {/* Document Action Bar */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-teal-50 text-teal-700 rounded-md">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                        </span>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 truncate max-w-sm">
                                {fileName}
                            </h3>
                            <span className="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Dấu mộc số & Ký SHA-256
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                            </svg>
                            In A4
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-md hover:bg-teal-800 transition-colors shadow-xs"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Tải file
                        </button>
                    </div>
                </div>

                {/* Simulated A4 Paper */}
                <div className="bg-white p-8 sm:p-12 border border-slate-200 rounded-lg shadow-sm text-slate-900 font-serif leading-relaxed text-[13.5px] max-h-[75vh] overflow-y-auto">
                    {/* Official National Header */}
                    <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-300 text-xs">
                        <div>
                            <div className="font-semibold uppercase tracking-wider text-slate-700">TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT</div>
                            <div className="font-bold uppercase tracking-wider text-teal-800">VIỆN CÔNG NGHỆ SỐ</div>
                            <div className="text-slate-500 font-mono mt-1">Số: {doc.docNumber || '142/TB-DACN-ĐT'}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                            <div className="font-semibold border-b border-slate-800 inline-block pb-0.5">Độc lập - Tự do - Hạnh phúc</div>
                            <div className="italic text-slate-500 mt-1">
                                {doc.issuedPlace || 'Bình Dương'}, ngày {doc.issuedDate || '14/10/2026'}
                            </div>
                        </div>
                    </div>

                    {/* Document Title */}
                    <div className="text-center my-6">
                        <h2 className="text-base sm:text-lg font-bold uppercase text-slate-900 tracking-wide">
                            {doc.title || documentData.title}
                        </h2>
                        {doc.subtitle && (
                            <p className="text-xs italic text-slate-600 mt-1">{doc.subtitle}</p>
                        )}
                    </div>

                    {/* Document Preamble & Body */}
                    <div className="space-y-4 text-justify">
                        {doc.preamble && (
                            <p className="italic text-slate-700">{doc.preamble}</p>
                        )}

                        {Array.isArray(doc.articles) && doc.articles.map((article, idx) => (
                            <div key={idx} className="space-y-1">
                                <strong className="text-slate-900">{article.title}</strong>
                                <div className="text-slate-800 pl-3 border-l-2 border-slate-200">
                                    {article.content}
                                </div>
                            </div>
                        ))}

                        {doc.content && typeof doc.content === 'string' && (
                            <div className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {doc.content}
                            </div>
                        )}
                    </div>

                    {/* Document Signatures & Digital Seal */}
                    <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-dashed border-slate-300 text-xs">
                        <div>
                            <strong className="block mb-1 text-slate-700">Nơi nhận:</strong>
                            <ul className="text-slate-600 space-y-0.5 list-disc list-inside">
                                {Array.isArray(doc.recipients) ? (
                                    doc.recipients.map((r, i) => <li key={i}>{r}</li>)
                                ) : (
                                    <>
                                        <li>Ban Giám hiệu (để b/c);</li>
                                        <li>Giảng viên hướng dẫn;</li>
                                        <li>Sinh viên thực hiện;</li>
                                        <li>Lưu: VT, Cổng Học vụ DACN.</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        <div className="text-center flex flex-col items-center">
                            <div className="font-bold uppercase text-slate-900">{doc.signerRole || 'KT. VIỆN TRƯỞNG'}</div>
                            <div className="text-slate-500 text-[11px] mb-2">{doc.signerDelegate || 'PHÓ VIỆN TRƯỞNG'}</div>

                            {/* Digital Signature Seal */}
                            <div className="border border-rose-300 bg-rose-50/80 text-rose-800 px-3 py-1.5 rounded text-[10.5px] font-mono text-left my-2 shadow-xs">
                                <div className="font-bold flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    ĐÃ KÝ SỐ ĐIỆN TỬ
                                </div>
                                <div>ĐẠI HỌC THỦ DẦU MỘT</div>
                                <div>Thời gian: {doc.issuedDate || '14/10/2026'} 09:30:00</div>
                            </div>

                            <div className="font-bold mt-2 text-slate-900">{doc.signerName || 'TS. Lê Quang Dũng'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </OpenModal>
    );
}
