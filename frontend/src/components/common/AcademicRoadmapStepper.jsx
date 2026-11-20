import React from 'react';
import {
    ClockCircleOutlined,
    CheckCircleOutlined,
    CheckOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import './academic-roadmap.css';

/**
 * AcademicRoadmapStepper - Lộ trình 6 mốc quy trình đồ án tốt nghiệp chuẩn Viện Công nghệ Số
 * Dùng chung cho 3 phân hệ: Sinh viên (STUDENT), Giảng viên (LECTURER), Quản trị viên (ADMIN)
 *
 * @param {Object} props
 * @param {'STUDENT' | 'LECTURER' | 'ADMIN'} [props.role='STUDENT'] Vai trò phân hệ
 * @param {string} [props.title] Tiêu đề khối lộ trình
 * @param {string} [props.subtitle] Phụ đề giải thích
 * @param {string} [props.badgeLabel] Nhãn nổi bật góc trên bên phải
 * @param {number} [props.progressPercent=0] Phần trăm tiến độ hoàn thành (0 - 100)
 * @param {Array<Object>} [props.milestones=[]] Danh sách các mốc quy trình
 * @param {string} [props.className] Tùy biến lớp CSS bổ sung
 */
export default function AcademicRoadmapStepper({
    role = 'STUDENT',
    title = 'Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)',
    subtitle = 'Theo dõi trạng thái từng giai đoạn và mốc thời gian quan trọng của học kỳ',
    badgeLabel,
    progressPercent = 0,
    milestones = [],
    className = '',
}) {
    const numericProgress = Number(progressPercent);
    const clampedPercent = Math.min(100, Math.max(0, Number.isFinite(numericProgress) ? numericProgress : 0));
    const safeMilestones = Array.isArray(milestones) ? milestones : [];

    const displayBadgeLabel =
        badgeLabel !== undefined
            ? badgeLabel
            : role === 'STUDENT'
              ? `${clampedPercent}% Hoàn tất`
              : `${clampedPercent}%`;

    return (
        <div className={`sd-roadmap-card academic-roadmap-card ${className}`.trim()}>
            <div className="sd-roadmap-header">
                <div className="sd-roadmap-title-wrap">
                    <div className="sd-roadmap-icon-badge" aria-hidden="true">
                        <ClockCircleOutlined />
                    </div>
                    <div>
                        <h3 className="sd-roadmap-title">{title}</h3>
                        {subtitle && <div className="sd-roadmap-subtitle">{subtitle}</div>}
                    </div>
                </div>

                {displayBadgeLabel && (
                    <div className="sd-roadmap-pct-pill">
                        <CheckCircleOutlined />
                        <span>{displayBadgeLabel}</span>
                    </div>
                )}
            </div>

            <div className="sd-roadmap-body">
                <div className="sd-roadmap-stage">
                    <div className="sd-roadmap-rail" aria-hidden="true">
                        <div
                            className="sd-roadmap-fill"
                            style={{ width: `${clampedPercent}%` }}
                        />
                    </div>

                    <div className="sd-milestone-grid">
                        {safeMilestones.map((step, idx) => {
                            const stateClass =
                                step.state === 'completed'
                                    ? 'is-completed'
                                    : step.state === 'active'
                                      ? 'is-active'
                                      : 'is-pending';

                            const subText =
                                step.subText ||
                                (typeof step.count === 'number' ? `${step.count} Sinh viên` : '');

                            return (
                                <button
                                    key={step.key || `milestone-${step.stepNumber || idx + 1}`}
                                    type="button"
                                    className={`sd-milestone-node ${stateClass}`}
                                    style={step.styleVars}
                                    onClick={step.onClick}
                                >
                                    <div className="sd-milestone-orb">
                                        {step.icon}
                                        {step.state === 'completed' && (
                                            <span className="sd-milestone-check-badge" aria-hidden="true">
                                                <CheckOutlined />
                                            </span>
                                        )}
                                    </div>

                                    <div className="sd-milestone-title">{step.title}</div>

                                    {subText ? (
                                        <div className="sd-milestone-status">{subText}</div>
                                    ) : null}

                                    {step.dateText ? (
                                        <div className="sd-milestone-date">
                                            <CalendarOutlined style={{ fontSize: 10 }} />
                                            <span>{step.dateText}</span>
                                        </div>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
