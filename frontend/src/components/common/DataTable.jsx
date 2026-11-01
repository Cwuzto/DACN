import React, { useMemo } from 'react';

/**
 * DataTable - Enterprise OpenDesign Data Table Component
 * Features:
 * - Segmented status tabs with pill badges
 * - Search bar with instant filter & clear button
 * - Faceted dropdown filters
 * - Header action buttons (Export, Create, Refresh)
 * - Row multi-selection with checkboxes
 * - Sticky bottom batch action bar when rows are selected
 * - Sorting, empty states, and responsive pagination
 */
export default function DataTable({
    columns = [],
    data = [],
    rowKey = 'id',
    loading = false,
    
    // Status tabs
    statusTabs = null,
    activeTab = 'ALL',
    onTabChange = () => {},
    
    // Search
    searchQuery = '',
    onSearchChange = () => {},
    searchPlaceholder = 'Tìm kiếm nhanh...',
    
    // Faceted filters
    filters = [],
    
    // Header actions
    actions = null,
    
    // Selection
    selectable = false,
    selectedRowKeys = [],
    onSelectRow = () => {},
    onSelectAll = () => {},
    
    // Batch actions (shown when selectedRowKeys.length > 0)
    batchActions = [],
    
    // Pagination
    pagination = null, // { page, pageSize, total, totalPages, onPageChange }
    
    // Empty state
    emptyTitle = 'Không tìm thấy dữ liệu',
    emptyDescription = 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm để xem kết quả.',
    
    className = '',
}) {
    const isAllSelected = useMemo(() => {
        if (!data || data.length === 0) return false;
        return data.every((row) => selectedRowKeys.includes(row[rowKey]));
    }, [data, selectedRowKeys, rowKey]);

    const isSomeSelected = useMemo(() => {
        if (!data || data.length === 0) return false;
        return data.some((row) => selectedRowKeys.includes(row[rowKey])) && !isAllSelected;
    }, [data, selectedRowKeys, isAllSelected, rowKey]);

    const handleSelectAll = (e) => {
        const checked = e.target.checked;
        if (checked) {
            const allKeys = data.map((row) => row[rowKey]);
            onSelectAll(allKeys);
        } else {
            onSelectAll([]);
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* 1. STATUS TABS (Segmented Control) */}
            {statusTabs && statusTabs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit max-w-full overflow-x-auto">
                    {statusTabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => onTabChange(tab.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 whitespace-nowrap ${
                                    isActive
                                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                                            isActive
                                                ? 'bg-teal-50 text-teal-700'
                                                : 'bg-slate-200/70 text-slate-600'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 2. FILTER & TOOLBAR HEADER */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                {/* Left: Search input + Faceted dropdowns */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    {/* Search box */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                            search
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-all placeholder:text-slate-400 text-slate-800"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>

                    {/* Faceted dropdown filters */}
                    {filters.map((filter) => (
                        <select
                            key={filter.key}
                            value={filter.value}
                            onChange={(e) => filter.onChange(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                        >
                            {filter.label && <option value="">{filter.label}</option>}
                            {filter.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    ))}
                </div>

                {/* Right: Custom actions (Export, Add button, etc.) */}
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>

            {/* 3. TABLE BODY */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 text-xs font-semibold text-slate-700">
                            <span className="material-symbols-outlined animate-spin text-teal-600 text-base">
                                progress_activity
                            </span>
                            Đang tải dữ liệu...
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                {selectable && (
                                    <th className="py-3 px-3.5 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={(input) => {
                                                if (input) input.indeterminate = isSomeSelected;
                                            }}
                                            onChange={handleSelectAll}
                                            className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                        />
                                    </th>
                                )}
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        style={{ width: col.width }}
                                        className={`py-3 px-3.5 select-none ${
                                            col.align === 'center'
                                                ? 'text-center'
                                                : col.align === 'right'
                                                ? 'text-right'
                                                : 'text-left'
                                        } ${col.className || ''}`}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (selectable ? 1 : 0)}
                                        className="py-12 text-center"
                                    >
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                                                <span className="material-symbols-outlined text-xl">
                                                    inbox
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {emptyTitle}
                                            </p>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {emptyDescription}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, index) => {
                                    const key = row[rowKey] || index;
                                    const isSelected = selectedRowKeys.includes(key);

                                    return (
                                        <tr
                                            key={key}
                                            className={`transition-colors duration-100 ${
                                                isSelected
                                                    ? 'bg-teal-50/50 hover:bg-teal-50'
                                                    : 'hover:bg-slate-50/80'
                                            }`}
                                        >
                                            {selectable && (
                                                <td className="py-3 px-3.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => onSelectRow(key)}
                                                        className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            {columns.map((col) => (
                                                <td
                                                    key={col.key}
                                                    className={`py-3 px-3.5 align-middle ${
                                                        col.align === 'center'
                                                            ? 'text-center'
                                                            : col.align === 'right'
                                                            ? 'text-right'
                                                            : 'text-left'
                                                    } ${col.cellClassName || ''}`}
                                                >
                                                    {col.render
                                                        ? col.render(row[col.key], row, index)
                                                        : row[col.key] ?? '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {pagination && pagination.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
                        <div>
                            Hiển thị{' '}
                            <span className="font-semibold text-slate-900">
                                {Math.min(
                                    pagination.total,
                                    (pagination.page - 1) * pagination.pageSize + 1
                                )}
                            </span>{' '}
                            -{' '}
                            <span className="font-semibold text-slate-900">
                                {Math.min(pagination.total, pagination.page * pagination.pageSize)}
                            </span>{' '}
                            trên tổng số{' '}
                            <span className="font-semibold text-slate-900">{pagination.total}</span> bản ghi
                        </div>

                        {pagination.totalPages > 1 && (
                            <div className="inline-flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={pagination.page <= 1}
                                    onClick={() => pagination.onPageChange(pagination.page - 1)}
                                    className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                                </button>
                                <span className="px-2 font-medium">
                                    Trang {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => pagination.onPageChange(pagination.page + 1)}
                                    className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 4. STICKY BATCH FLOATING BAR */}
            {selectable && selectedRowKeys.length > 0 && batchActions.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
                    <div className="text-xs font-semibold flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-slate-900 font-bold text-[11px]">
                            {selectedRowKeys.length}
                        </span>
                        <span>Đã chọn</span>
                    </div>

                    <div className="h-4 w-px bg-slate-700" />

                    <div className="flex items-center gap-2">
                        {batchActions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                onClick={() => action.onClick(selectedRowKeys)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                    action.variant === 'danger'
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                        : action.variant === 'primary'
                                        ? 'bg-teal-600 hover:bg-teal-500 text-white'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                            >
                                {action.icon && (
                                    <span className="material-symbols-outlined text-sm">
                                        {action.icon}
                                    </span>
                                )}
                                <span>{action.label}</span>
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => onSelectAll([])}
                            className="text-xs text-slate-400 hover:text-white px-2 py-1 underline underline-offset-2 ml-1"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
