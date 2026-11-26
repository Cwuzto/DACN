import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Table } from 'antd';
import { CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';

/**
 * Modal hiển thị danh sách người dùng khả dụng với checkbox (mặc định chọn tất cả).
 * Admin có thể tìm kiếm và bỏ tick những người không muốn gán trước khi xác nhận.
 */
export default function BulkAssignRosterModal({
    open,
    onCancel,
    title,
    subtitle,
    items = [],
    columns = [],
    loading = false,
    submitting = false,
    searchPlaceholder = 'Tìm theo mã số, họ tên, email...',
    extraHeader = null,
    onConfirm,
}) {
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (open) {
            setSelectedRowKeys(items.map((item) => item.id));
            setSearchText('');
        }
    }, [open, items]);

    const filteredItems = useMemo(() => {
        const kw = searchText.trim().toLowerCase();
        if (!kw) return items;
        return items.filter((item) =>
            [item.code, item.fullName, item.email, item.department, item.studentProfile?.major]
                .filter(Boolean)
                .some((val) => String(val).toLowerCase().includes(kw))
        );
    }, [items, searchText]);

    const allIds = useMemo(() => items.map((i) => i.id), [items]);

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onCancel}
            width={820}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onCancel} disabled={submitting}>
                    Hủy
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={submitting}
                    disabled={selectedRowKeys.length === 0 || loading}
                    onClick={() => onConfirm?.(selectedRowKeys)}
                    className="!bg-[#0F766E] hover:!bg-[#115E59]"
                >
                    Xác nhận gán ({selectedRowKeys.length})
                </Button>,
            ]}
        >
            <div className="space-y-3 pt-2">
                {subtitle && <p className="text-xs text-slate-600 m-0">{subtitle}</p>}

                {extraHeader}

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Input
                        allowClear
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder={searchPlaceholder}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ maxWidth: 320 }}
                    />
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 font-medium">
                            Đã chọn: <strong className="text-teal-700">{selectedRowKeys.length}</strong> / {items.length}
                        </span>
                        <Button
                            type="link"
                            size="small"
                            className="p-0 h-auto text-xs font-semibold"
                            disabled={items.length === 0 || selectedRowKeys.length === items.length}
                            onClick={() => setSelectedRowKeys(allIds)}
                        >
                            Chọn tất cả
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            danger
                            className="p-0 h-auto text-xs font-semibold"
                            disabled={selectedRowKeys.length === 0}
                            onClick={() => setSelectedRowKeys([])}
                        >
                            Bỏ chọn tất cả
                        </Button>
                    </div>
                </div>

                <Table
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={filteredItems}
                    columns={columns}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ y: 340 }}
                    rowSelection={{
                        selectedRowKeys,
                        preserveSelectedRowKeys: true,
                        onChange: (keys) => setSelectedRowKeys(keys),
                    }}
                    locale={{
                        emptyText: (
                            <div className="py-6 text-center text-xs text-slate-500">
                                Không có người dùng khả dụng phù hợp.
                            </div>
                        ),
                    }}
                />
            </div>
        </Modal>
    );
}

