import React, { useState } from 'react';
import { Tooltip } from 'antd';

const GRADE_BAND_COLORS = {
    EXCELLENT: { main: '#10B981', light: '#D1FAE5' },
    GOOD: { main: '#0F766E', light: '#CCFBF1' },
    FAIR: { main: '#F59E0B', light: '#FEF3C7' },
    AVERAGE: { main: '#64748B', light: '#F1F5F9' },
    FAILED: { main: '#EF4444', light: '#FEE2E2' },
};

const GRADE_RANGES = {
    EXCELLENT: '8.5 - 10.0',
    GOOD: '7.0 - 8.4',
    FAIR: '5.5 - 6.9',
    AVERAGE: '4.0 - 5.4',
    FAILED: '< 4.0 / Vắng',
};

export default function GradeDistributionBarChart({ data = [] }) {
    const [hoveredGrade, setHoveredGrade] = useState(null);

    if (!data || data.length === 0) return null;

    const maxPercent = Math.max(...data.map(d => Number(d.percent) || 0), 10);
    // Round max scale up to nearest 10 or 20
    const scaleMax = Math.min(100, Math.ceil(maxPercent / 10) * 10 + 5);

    const chartHeight = 180;
    const chartWidth = 560;
    const paddingX = 40;
    const paddingBottom = 30;
    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingBottom;

    const barWidth = Math.min(48, Math.floor(usableWidth / data.length) - 20);
    const stepX = usableWidth / data.length;

    const gridLines = [0, 25, 50, 75, 100].filter(v => v <= scaleMax);

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Phổ Điểm Khóa Luận (Histogram Xếp Loại)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Phân bố sinh viên theo các chuẩn kiểm định AUN-QA
                    </p>
                </div>
                <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                    Thang chuẩn: 0% – {scaleMax}%
                </div>
            </div>

            <div className="w-full overflow-x-auto">
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight + 10}`}
                    className="w-full max-w-2xl mx-auto block"
                    style={{ minWidth: '400px', height: '220px' }}
                >
                    <defs>
                        {data.map((item) => {
                            const colors = GRADE_BAND_COLORS[item.grade] || { main: '#0F766E', light: '#CCFBF1' };
                            return (
                                <linearGradient key={item.grade} id={`grad-${item.grade}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={colors.main} stopOpacity="1" />
                                    <stop offset="100%" stopColor={colors.main} stopOpacity="0.75" />
                                </linearGradient>
                            );
                        })}
                    </defs>

                    {/* Y-axis gridlines */}
                    {gridLines.map((val) => {
                        const y = usableHeight - (val / scaleMax) * usableHeight;
                        return (
                            <g key={val}>
                                <line
                                    x1={paddingX - 5}
                                    y1={y}
                                    x2={chartWidth - paddingX + 5}
                                    y2={y}
                                    stroke="#E2E8F0"
                                    strokeDasharray="3 3"
                                    strokeWidth="1"
                                />
                                <text
                                    x={paddingX - 10}
                                    y={y + 3}
                                    textAnchor="end"
                                    fontSize="10"
                                    fill="#94A3B8"
                                    fontWeight="500"
                                    fontFamily="monospace"
                                >
                                    {val}%
                                </text>
                            </g>
                        );
                    })}

                    {/* Baseline */}
                    <line
                        x1={paddingX}
                        y1={usableHeight}
                        x2={chartWidth - paddingX}
                        y2={usableHeight}
                        stroke="#CBD5E1"
                        strokeWidth="1.5"
                    />

                    {/* Bars */}
                    {data.map((item, index) => {
                        const percent = Number(item.percent) || 0;
                        const barHeight = Math.max(4, (percent / scaleMax) * usableHeight);
                        const x = paddingX + index * stepX + (stepX - barWidth) / 2;
                        const y = usableHeight - barHeight;
                        const isHovered = hoveredGrade === item.grade;
                        const colors = GRADE_BAND_COLORS[item.grade] || { main: '#0F766E' };

                        return (
                            <Tooltip
                                key={item.grade}
                                title={(
                                    <div className="text-xs">
                                        <div className="font-bold">{item.label}</div>
                                        <div>Khoảng điểm: {GRADE_RANGES[item.grade] || '—'}</div>
                                        <div>Số lượng: <b>{item.count} sinh viên</b></div>
                                        <div>Tỷ lệ: <b>{item.percent}%</b></div>
                                    </div>
                                )}
                            >
                                <g
                                    className="cursor-pointer transition-all duration-200"
                                    onMouseEnter={() => setHoveredGrade(item.grade)}
                                    onMouseLeave={() => setHoveredGrade(null)}
                                >
                                    {/* Bar Background highlight on hover */}
                                    {isHovered && (
                                        <rect
                                            x={x - 4}
                                            y={0}
                                            width={barWidth + 8}
                                            height={usableHeight}
                                            fill="#F8FAFC"
                                            rx="4"
                                        />
                                    )}

                                    {/* Bar Column */}
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={`url(#grad-${item.grade})`}
                                        rx="6"
                                        opacity={isHovered ? 1 : 0.92}
                                        style={{
                                            filter: isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none',
                                            transition: 'all 0.2s ease',
                                        }}
                                    />

                                    {/* Count & % above bar */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={Math.max(14, y - 6)}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight="700"
                                        fill={colors.main}
                                    >
                                        {percent > 0 ? `${percent}%` : '0%'}
                                    </text>

                                    {/* X-axis label */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={usableHeight + 16}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight={isHovered ? '700' : '600'}
                                        fill={isHovered ? colors.main : '#334155'}
                                    >
                                        {item.label}
                                    </text>

                                    {/* Subtitle / Range below */}
                                    <text
                                        x={x + barWidth / 2}
                                        y={usableHeight + 28}
                                        textAnchor="middle"
                                        fontSize="9"
                                        fill="#64748B"
                                        fontFamily="monospace"
                                    >
                                        {item.count} SV
                                    </text>
                                </g>
                            </Tooltip>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

