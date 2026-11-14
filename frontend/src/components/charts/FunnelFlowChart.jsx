import React from 'react';
import { Tag, Tooltip } from 'antd';
import { FallOutlined, RiseOutlined } from '@ant-design/icons';

export default function FunnelFlowChart({ data = [] }) {
    if (!data || data.length === 0) return null;

    const baseCount = data[0]?.count || 1;

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Dòng Chảy Tiến Độ Học Vụ 6 Giai Đoạn (Conversion Funnel)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Tỷ lệ sinh viên chuyển tiếp thành công qua từng mốc kiểm soát đồ án
                    </p>
                </div>
                <Tag color="cyan" className="font-semibold">
                    6 Mốc Chuẩn Hóa
                </Tag>
            </div>

            {/* Horizontal Flow Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                {data.map((stage, index) => {
                    const prev = index > 0 ? data[index - 1] : null;
                    const dropCount = prev ? prev.count - stage.count : 0;
                    const dropRate = prev && prev.count > 0
                        ? Math.round((dropCount / prev.count) * 1000) / 10
                        : 0;

                    const widthPercentage = Math.max(20, Math.min(100, Math.round((stage.count / baseCount) * 100)));
                    const isFinal = index === data.length - 1;

                    return (
                        <div
                            key={stage.step}
                            className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                                isFinal
                                    ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-500 shadow-xs'
                                    : 'bg-slate-50 border-slate-200 hover:border-teal-400'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <span>Mốc {index + 1}</span>
                                    <Tag color={isFinal ? 'green' : 'blue'} className="text-[10px] px-1 py-0 mr-0">
                                        {stage.step}
                                    </Tag>
                                </div>
                                <h5 className="font-bold text-slate-800 text-xs mt-1.5 line-clamp-2 min-h-[32px]">
                                    {stage.label}
                                </h5>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200/80">
                                <div className="flex items-baseline justify-between mb-1.5">
                                    <span className="text-lg font-black text-slate-900">
                                        {stage.count} <span className="text-[10px] font-normal text-slate-500">SV</span>
                                    </span>
                                    <span className={`text-xs font-bold ${isFinal ? 'text-emerald-700' : 'text-teal-700'}`}>
                                        {stage.rate}%
                                    </span>
                                </div>

                                {/* Flow Gauge bar */}
                                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            isFinal
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                                : 'bg-gradient-to-r from-teal-600 to-teal-500'
                                        }`}
                                        style={{ width: `${widthPercentage}%` }}
                                    />
                                </div>

                                {/* Drop-off indicator */}
                                {index > 0 && (
                                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                                        <span>So với trước:</span>
                                        {dropCount > 0 ? (
                                            <span className="text-red-500 font-semibold flex items-center gap-0.5">
                                                <FallOutlined /> -{dropCount} (-{dropRate}%)
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                                <RiseOutlined /> 100%
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

