import React, { useState } from 'react';
import { Modal, Button, Space, Tag, Tooltip } from 'antd';
import {
    PrinterOutlined,
    CloseOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    UndoOutlined,
} from '@ant-design/icons';

/**
 * AcademicFormPrintModal
 * Unified Modal Dialog for Previewing & Printing Standardized A4 Academic Forms.
 * Strictly adheres to AGENTS.md Rule 2.4 (UTF-8 no BOM) and Rule 2.6 (Button UI standards).
 */
export default function AcademicFormPrintModal({
    open,
    onClose,
    title = 'Bản In Văn Bản Học Thuật',
    documentCode = 'A4',
    children,
    onPrint,
}) {
    const [zoomScale, setZoomScale] = useState(1);

    const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 0.1, 1.4));
    const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 0.1, 0.7));
    const handleZoomReset = () => setZoomScale(1);

    const handlePrintClick = () => {
        if (typeof onPrint === 'function') {
            onPrint();
        } else {
            window.print();
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={1020}
            destroyOnHidden
            title={
                <div className="flex items-center justify-between pr-8 no-print">
                    <div className="flex items-center gap-2">
                        <Tag color="cyan" className="font-semibold px-2 py-0.5 text-xs m-0">
                            {documentCode}
                        </Tag>
                        <span className="font-semibold text-slate-800 text-sm sm:text-base">
                            {title}
                        </span>
                    </div>
                    {/* Zoom toolbar */}
                    <Space size="small">
                        <Tooltip title="Thu nhỏ">
                            <Button
                                size="small"
                                icon={<ZoomOutOutlined />}
                                onClick={handleZoomOut}
                                disabled={zoomScale <= 0.7}
                            >
                                Thu nhỏ
                            </Button>
                        </Tooltip>
                        <Tooltip title="Tỷ lệ thực tế 100%">
                            <Button size="small" icon={<UndoOutlined />} onClick={handleZoomReset}>
                                {Math.round(zoomScale * 100)}%
                            </Button>
                        </Tooltip>
                        <Tooltip title="Phóng to">
                            <Button
                                size="small"
                                icon={<ZoomInOutlined />}
                                onClick={handleZoomIn}
                                disabled={zoomScale >= 1.4}
                            >
                                Phóng to
                            </Button>
                        </Tooltip>
                    </Space>
                </div>
            }
            footer={
                <div className="flex justify-between items-center no-print">
                    <span className="text-xs text-slate-500 italic">
                        Mẹo: Trong hộp thoại in, chọn "Lưu dưới dạng PDF" (Save as PDF) để xuất tệp lưu trữ.
                    </span>
                    <Space>
                        <Button icon={<CloseOutlined />} onClick={onClose}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrintClick}
                            className="bg-teal-700 hover:bg-teal-800 border-teal-700"
                        >
                            In văn bản
                        </Button>
                    </Space>
                </div>
            }
            styles={{
                body: {
                    backgroundColor: '#e2e8f0',
                    padding: '24px 16px',
                    maxHeight: '75vh',
                    overflowY: 'auto',
                },
            }}
        >
            <div
                style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                }}
            >
                {children}
            </div>
        </Modal>
    );
}
