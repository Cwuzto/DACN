import React, { useEffect } from 'react';

/**
 * OpenDrawer - Context-Preserving Academic Side Drawer
 * Implements pure OpenDesign sliding drawer with UI/UX Pro Max standards.
 */
export default function OpenDrawer({
    open,
    onClose,
    title,
    children,
    footer,
    width = '720px',
    placement = 'right',
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

    const isLeft = placement === 'left';

    return (
        <div
            className={`drawer-overlay ${open ? 'open' : ''}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose?.();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || (typeof title === 'string' ? title : 'Bảng trượt')}
        >
            <div
                className="drawer-box"
                style={{
                    width,
                    left: isLeft ? 0 : 'auto',
                    right: isLeft ? 'auto' : 0,
                    transform: isLeft ? 'translateX(0)' : undefined,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="drawer-head">
                        <div className="drawer-title">{title}</div>
                        <button
                            type="button"
                            className="modal-close"
                            onClick={onClose}
                            aria-label="Đóng bảng trượt"
                            title="Đóng (Esc)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                )}

                <div className="drawer-body">{children}</div>

                {footer && <div className="drawer-foot">{footer}</div>}
            </div>
        </div>
    );
}
