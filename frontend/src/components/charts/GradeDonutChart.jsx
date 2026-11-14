import React, { useState } from 'react';
import { Tooltip } from 'antd';

const GRADE_COLORS = {
    EXCELLENT: '#10B981',
    GOOD: '#0F766E',
    FAIR: '#F59E0B',
    AVERAGE: '#64748B',
    FAILED: '#EF4444',
};

export default function GradeDonutChart({ data = [], totalStudents = 0 }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!data || data.length === 0) return null;

    const size = 180;
    const strokeWidth = 26;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    // Filter valid segments
    const validSegments = data.filter(d => Number(d.percent) > 0);
    const totalPercent = validSegments.reduce((sum, d) => sum + (Number(d.percent) || 0), 0) || 100;

    let accumulatedPercent = 0;

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="mb-3">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Cơ Cấu Học Lực Khóa Luận (Donut)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                    Tỷ trọng các phân khúc học lực của sinh viên
                </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto">
                {/* SVG Donut Circle */}
                <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                        {/* Background track */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke="#F1F5F9"
                            strokeWidth={strokeWidth}
                        />

                        {/* Donut Segments */}
                        {validSegments.map((item, index) => {
                            const percent = Number(item.percent) || 0;
                            const strokeDasharray = `${(percent / totalPercent) * circumference} ${circumference}`;
                            const strokeDashoffset = -((accumulatedPercent / totalPercent) * circumference);
                            accumulatedPercent += percent;

                            const isHovered = hoveredIndex === index;
                            const color = item.color || GRADE_COLORS[item.grade] || '#0F766E';

                            return (
                                <circle
                                    key={item.grade}
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke={color}
                                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    className="cursor-pointer transition-all duration-200"
                                    style={{
                                        filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                                    }}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                />
                            );
                        })}
                    </svg>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-800 leading-tight">
                            {totalStudents}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Sinh viên
                        </span>
                    </div>
                </div>

                {/* Legend List */}
                <div className="flex-1 space-y-2 w-full max-w-xs">
                    {data.map((item, index) => {
                        const isHovered = hoveredIndex === index;
                        const color = item.color || GRADE_COLORS[item.grade] || '#0F766E';
                        return (
                            <div
                                key={item.grade}
                                className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isHovered ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                                }`}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-slate-700 font-medium">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                    <span className="font-bold text-slate-900">{item.count} SV</span>
                                    <span className="text-slate-400 text-[11px] w-10 text-right">({item.percent}%)</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

