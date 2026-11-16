import React from 'react';
import { Tooltip } from 'antd';
import useAuthStore from '../../stores/authStore';
import { canPerformFeatureAction } from '../../auth/policyEvaluator';

/**
 * Component phân quyền hành động (Action-Level Authorization) trên giao diện.
 * Tiêu thụ canPerformFeatureAction từ feature policy manifest.
 *
 * @param {object} props
 * @param {string} props.feature - Khóa tính năng (vd: 'users', 'announcements', 'all-topics')
 * @param {string} props.action - Khóa hành động (vd: 'create', 'edit', 'delete', 'import', 'manage')
 * @param {object} [props.context] - Ngữ cảnh lọc UI ({ semesterId, department })
 * @param {'hide' | 'disable'} [props.mode='hide'] - 'hide': ẩn hoàn toàn; 'disable': vô hiệu hóa kèm tooltip
 * @param {React.ReactNode} props.children - Phần tử con cần phân quyền
 * @param {string} [props.reason='Bạn không có quyền thực hiện thao tác này'] - Lý do giải thích bằng tiếng Việt
 */
export default function AuthorizedAction({
    feature,
    action,
    context = {},
    mode = 'hide',
    children,
    reason = 'Bạn không có quyền thực hiện thao tác này',
}) {
    const user = useAuthStore((state) => state.user);
    const isAllowed = canPerformFeatureAction(user, feature, action, context);

    if (isAllowed) {
        return <>{children}</>;
    }

    if (mode === 'hide') {
        return null;
    }

    // mode === 'disable': Vô hiệu hóa phần tử và hiển thị Tooltip giải thích
    if (React.isValidElement(children)) {
        const disabledChild = React.cloneElement(children, {
            disabled: true,
            style: { ...children.props?.style, pointerEvents: 'none' },
        });

        return (
            <Tooltip title={reason}>
                <span className="inline-block cursor-not-allowed">
                    {disabledChild}
                </span>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={reason}>
            <span className="inline-block cursor-not-allowed text-slate-400">
                {children}
            </span>
        </Tooltip>
    );
}
