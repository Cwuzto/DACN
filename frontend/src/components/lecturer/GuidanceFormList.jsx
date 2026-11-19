import React from 'react';
import { Button, Dropdown, Tag } from 'antd';
import {
    CheckSquareOutlined,
    ClockCircleOutlined,
    EyeOutlined,
    FileTextOutlined,
    MoreOutlined,
    PrinterOutlined,
    ScheduleOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStatusTagConfig } from '../common/statusMap';

const FORM_TITLE_FALLBACKS = {
    BM01: 'Đề cương nghiên cứu chi tiết',
    BM02: 'Giao nhiệm vụ khóa luận',
    'BM02-A': 'Đơn đề nghị điều chỉnh tên đề tài',
    BM03: 'Sổ theo dõi tiến độ & hướng dẫn',
    BM04: 'Phiếu nhận xét của người hướng dẫn',
    BM05: 'Biên bản tổng hợp chấm bảo vệ',
};

const FORM_STATUS_LABELS = {
    NOT_STARTED: { label: 'Chưa bắt đầu', color: 'default' },
    NOT_SUBMITTED: { label: 'Chưa nộp', color: 'default' },
    SUBMITTED: { label: 'Đã nộp', color: 'blue' },
    PENDING_REVIEW: { label: 'Chờ thẩm định', color: 'blue' },
    NEEDS_REVISION: { label: 'Cần chỉnh sửa', color: 'orange' },
    APPROVED: { label: 'Đã duyệt', color: 'green' },
    IN_PROGRESS: { label: 'Đang ghi nhận', color: 'cyan' },
    FINALIZED: { label: 'Đã chốt', color: 'green' },
    DRAFT: { label: 'Bản nháp', color: 'default' },
    PENDING_SIGNATURE: { label: 'Chờ ký', color: 'orange' },
    SIGNED: { label: 'Đã ký / khóa', color: 'green' },
    NOT_CREATED: { label: 'Chưa lập', color: 'default' },
    NO_RESULT: { label: 'Chưa có kết quả', color: 'default' },
    PROCESSING: { label: 'Đang xử lý', color: 'blue' },
    PUBLISHED: { label: 'Đã công bố', color: 'green' },
};

const ACTION_CONFIG = {
    VIEW: { label: 'Xem chi tiết', icon: <EyeOutlined aria-hidden="true" />, type: 'default' },
    VIEW_PRINT: { label: 'Xem / In', icon: <PrinterOutlined aria-hidden="true" />, type: 'default' },
    REVIEW: { label: 'Xử lý / Duyệt', icon: <CheckSquareOutlined aria-hidden="true" />, type: 'primary' },
    OPEN_PROGRESS: { label: 'Theo dõi tiến độ', icon: <ScheduleOutlined aria-hidden="true" />, type: 'default' },
};

const getFormStatusBadge = (form) => {
    if (form?.statusLabel) {
        const mapped = FORM_STATUS_LABELS[form.status] || getStatusTagConfig(form.status);
        return { label: form.statusLabel, color: mapped?.color || 'default' };
    }
    if (FORM_STATUS_LABELS[form?.status]) {
        return FORM_STATUS_LABELS[form.status];
    }
    return getStatusTagConfig(form?.status);
};

const formatUpdatedAt = (value) => {
    if (!value) return null;
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : null;
};

/**
 * Danh sách biểu mẫu học vụ của sinh viên theo đúng thứ tự và quyền từ backend.
 * Không tự sinh nút nghiệp vụ theo role hoặc tự chèn BM02-A khi chưa có yêu cầu.
 */
export default function GuidanceFormList({ forms = [], onAction }) {
    if (!Array.isArray(forms) || forms.length === 0) {
        return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Chưa có dữ liệu biểu mẫu cho hồ sơ này.
            </div>
        );
    }

    return (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white" aria-label="Danh sách biểu mẫu học vụ">
            {forms.map((form) => {
                const statusBadge = getFormStatusBadge(form);
                const updatedAtText = formatUpdatedAt(form.updatedAt);
                const actions = Array.isArray(form.actions) ? form.actions : [];
                const directActions = actions.slice(0, 2);
                const overflowActions = actions.slice(2);

                const overflowMenuItems = overflowActions.map((action, index) => {
                    const meta = ACTION_CONFIG[action.code] || ACTION_CONFIG.VIEW;
                    return {
                        key: `${action.code}-${index}`,
                        label: action.label || meta.label,
                        icon: meta.icon,
                    };
                });

                const handleOverflowClick = ({ key }) => {
                    const index = Number(String(key).split('-').pop());
                    const selected = overflowActions[index];
                    if (selected && typeof onAction === 'function') {
                        onAction(selected, form);
                    }
                };

                return (
                    <li
                        key={form.code}
                        className="flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                                    <FileTextOutlined aria-hidden="true" />
                                    {form.code}
                                </span>
                                <h3 className="m-0 text-sm font-semibold text-slate-900 sm:text-base">
                                    {form.title || FORM_TITLE_FALLBACKS[form.code] || form.code}
                                </h3>
                                <Tag color={statusBadge.color} className="m-0 font-medium">
                                    {statusBadge.label}
                                </Tag>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <ClockCircleOutlined aria-hidden="true" />
                                    {updatedAtText ? `Cập nhật: ${updatedAtText}` : 'Chưa có cập nhật'}
                                </span>
                                {form.nextActor && (
                                    <span className="inline-flex items-center gap-1 text-slate-600">
                                        <UserOutlined aria-hidden="true" />
                                        Bước kế tiếp: {form.nextActorLabel || form.nextActor}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                            {directActions.map((action, index) => {
                                const meta = ACTION_CONFIG[action.code] || ACTION_CONFIG.VIEW;
                                const buttonLabel = action.label || meta.label;
                                return (
                                    <Button
                                        key={`${form.code}-${action.code}-${index}`}
                                        type={meta.type}
                                        size="small"
                                        icon={meta.icon}
                                        onClick={() => onAction?.(action, form)}
                                    >
                                        {buttonLabel}
                                    </Button>
                                );
                            })}

                            {overflowActions.length > 0 && (
                                <Dropdown
                                    menu={{ items: overflowMenuItems, onClick: handleOverflowClick }}
                                    trigger={['click']}
                                >
                                    <Button size="small" icon={<MoreOutlined aria-hidden="true" />}>
                                        Thao tác khác
                                    </Button>
                                </Dropdown>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
