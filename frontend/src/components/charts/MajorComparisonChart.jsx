import React from 'react';
import { Tag, Tooltip } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';

export default function MajorComparisonChart({ data = [] }) {
    if (!data || data.length === 0) return null;

    // Find major with highest average score
    const highestScoreMajor = data.reduce((prev, current) => {
        const prevScore = Number(prev?.averageScore) || 0;
        const currScore = Number(current?.averageScore) || 0;
        return currScore > prevScore ? current : prev;
    }, data[0]);

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Đối Sánh Chỉ Số Giữa Các Chuyên Ngành
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        So sánh tương quan giữa Điểm trung bình và Tỷ lệ hoàn thành
                    </p>
                </div>
                {highestScoreMajor && (
                    <Tag color="gold" className="flex items-center gap-1 font-semibold px-2 py-0.5">
                        <TrophyOutlined /> Dẫn đầu điểm: {highestScoreMajor.major} ({highestScoreMajor.averageScore}đ)
                    </Tag>
                )}
            </div>

            <div className="space-y-4">
                {data.map((item, idx) => {
                    const avgScore = Number(item.averageScore) || 0;
                    const completionRate = Number(item.completionRate) || 0;
                    const scorePercent = (avgScore / 10) * 100;
                    const isTop = item.major === highestScoreMajor?.major;

                    return (
                        <div
                            key={item.major || idx}
                            className={`p-3.5 rounded-xl border transition-all ${
                                isTop ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-teal-800 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                    <span className="font-bold text-slate-800 text-sm">
                                        {item.major}
                                    </span>
                                    {isTop && (
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                            Top Điểm
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-slate-600">
                                        Quy mô: <b>{item.studentCount} SV</b>
                                    </span>
                                    <span className="text-teal-800">
                                        Hoàn thành: <b>{item.completedCount}/{item.studentCount}</b> ({completionRate}%)
                                    </span>
                                </div>
                            </div>

                            {/* Dual Comparison Bars */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* Bar 1: Điểm Trung Bình (Thang 10) */}
                                <div>
                                    <div className="flex justify-between items-center text-[11px] mb-1">
                                        <span className="font-medium text-slate-600">Điểm trung bình khóa luận</span>
                                        <span className="font-bold text-teal-800 font-mono">{avgScore.toFixed(2)} / 10</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-teal-700 to-teal-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, scorePercent)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Bar 2: Tỷ Lệ Hoàn Thành (%) */}
                                <div>
                                    <div className="flex justify-between items-center text-[11px] mb-1">
                                        <span className="font-medium text-slate-600">Tỷ lệ sinh viên hoàn thành</span>
                                        <span className="font-bold text-emerald-700 font-mono">{completionRate}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                                            style={{ width: `${Math.min(100, completionRate)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

