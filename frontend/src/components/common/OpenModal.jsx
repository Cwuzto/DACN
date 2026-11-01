import React, { useEffect } from 'react';

/**
 * OpenModal - Academic Enterprise Modal Dialog
 * Implements pure OpenDesign styling with UI/UX Pro Max accessibility standards.
 */
export default function OpenModal({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = '650px',
    ariaLabel,
}) {
    // Escape key listener & body scroll lock
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className={`modal-overlay ${open ? 'open' : ''}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose?.();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || (typeof title === 'string' ? title : 'Hộp thoại')}
        >
            <div
                className="modal-box"
                style={{
                    maxWidth,
                    borderRadius: 'var(--radius-xl, 20px)',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="modal-head">
                        <div className="modal-title">{title}</div>
                        <button
                            type="button"
                            className="modal-close"
                            onClick={onClose}
                            aria-label="Đóng hộp thoại"
                            title="Đóng (Esc)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                )}

                <div className="modal-body">{children}</div>

                {footer && <div className="modal-foot">{footer}</div>}
            </div>
        </div>
    );
}
