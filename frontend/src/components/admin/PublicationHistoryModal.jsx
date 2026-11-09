import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    Card,
    Tag,
    Table,
    Space,
    Typography,
    Divider,
    Button,
    Empty,
    Spin,
    Badge,
    Tooltip,
} from 'antd';
import {
    HistoryOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SwapOutlined,
    FileTextOutlined,
    UserOutlined,
    CalendarOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { Text, Title } = Typography;

const TYPE_TAG_PROPS = {
    INITIAL: { color: 'cyan', text: 'CÔNG BỐ CHÍNH THỨC ĐỢT 1' },
    SUPPLEMENTARY: { color: 'blue', text: 'CÔNG BỐ BỔ SUNG' },
    CORRECTION: { color: 'orange', text: 'CÔNG BỐ ĐÍNH CHÍNH' },
};

export default function PublicationHistoryModal({
    open,
    onClose,
    semesterId,
    semesterName,
}) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [selectedPublication, setSelectedPublication] = useState(null);

    const loadHistory = useCallback(async () => {
        if (!semesterId) return;
        try {
            setLoading(true);
            const res = await evaluationService.getResultPublicationHistory(semesterId);
            if (res.success) {
                const list = res.data || [];
                setHistory(list);
                if (list.length > 0) {
                    setSelectedPublication(list[0]);
                } else {
                    setSelectedPublication(null);
                }
            }
        } catch {
            setHistory([]);
            setSelectedPublication(null);
        } finally {
            setLoading(false);
        }
    }, [semesterId]);

    useEffect(() => {
        if (open) {
            loadHistory();
        }
    }, [open, loadHistory]);

    const itemColumns = [
        {
            title: 'Mã SV',
            dataIndex: 'studentCodeSnapshot',
            key: 'code',
            width: 110,
            render: (code) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {code || '—'}
                </span>
            ),
        },
        {
            title: 'Họ tên Sinh viên',
            dataIndex: 'studentNameSnapshot',
            key: 'name',
            width: 170,
            render: (name) => <span style={{ fontWeight: 600 }}>{name || '—'}</span>,
        },
        {
            title: 'Tên Đề tài',
            dataIndex: 'topicTitleSnapshot',
            key: 'topic',
            ellipsis: true,
        },
        {
            title: 'Điểm Niêm Phong',
            dataIndex: 'finalScoreSnapshot',
            key: 'score',
            width: 130,
            align: 'center',
            render: (score) => (
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--institutional)',
                        fontSize: 14,
                    }}
                >
                    {score !== null && score !== undefined ? Number(score).toFixed(2) : '—'}
                </span>
            ),
        },
        {
            title: 'Kết quả Chính thức',
            dataIndex: 'outcomeSnapshot',
            key: 'outcome',
            width: 130,
            align: 'center',
            render: (outcome) => {
                if (outcome === 'PASSED') {
                    return (
                        <Tag color="cyan" icon={<CheckCircleOutlined />}>
                            ĐẠT BẢO VỆ
                        </Tag>
                    );
                }
                return (
                    <Tag color="error" icon={<CloseCircleOutlined />}>
                        KHÔNG ĐẠT
                    </Tag>
                );
            },
        },
        {
            title: 'Đối ứng đính chính',
            dataIndex: 'replacesPublicationItemId',
            key: 'replace',
            width: 160,
            render: (id) =>
                id ? (
                    <Tag color="volcano" icon={<SwapOutlined />}>
                        Thay item #{id}
                    </Tag>
                ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            destroyOnClose
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginRight: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--radius)',
                                background: '#F0FDFA',
                                color: '#0F766E',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 18,
                            }}
                        >
                            <HistoryOutlined />
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Sổ Lưu Chiểu Snapshot & Lịch Sử Công Bố Kết Quả
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
                                Học kỳ: <strong style={{ color: 'var(--fg)' }}>{semesterName || `ID #${semesterId}`}</strong>
                            </div>
                        </div>
                    </div>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={loadHistory}
                        loading={loading}
                    >
                        Làm mới
                    </Button>
                </div>
            }
        >
            <Spin spinning={loading}>
                {history.length === 0 ? (
                    <Empty
                        style={{ padding: '40px 0' }}
                        description="Chưa có phiên công bố kết quả nào được ban hành trong học kỳ này."
                    />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 12 }}>
                        {/* Cột trái: Danh sách các phiên công bố */}
                        <div
                            style={{
                                borderRight: '1px solid var(--border)',
                                paddingRight: 14,
                                maxHeight: 520,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                            }}
                        >
                            {history.map((pub) => {
                                const isSelected = selectedPublication?.id === pub.id;
                                const tagInfo = TYPE_TAG_PROPS[pub.type] || { color: 'default', text: pub.type };

                                return (
                                    <div
                                        key={pub.id}
                                        onClick={() => setSelectedPublication(pub)}
                                        style={{
                                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                            background: isSelected ? 'var(--primary-light)' : '#FFFFFF',
                                            borderRadius: 'var(--radius)',
                                            padding: '12px 14px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                                                VĂN BẢN #{pub.id}
                                            </span>
                                            <Tag color={tagInfo.color} style={{ fontSize: 10, margin: 0 }}>
                                                {tagInfo.text}
                                            </Tag>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                            <CalendarOutlined style={{ fontSize: 11 }} />
                                            <span>
                                                {new Date(pub.publishedAt).toLocaleString('vi-VN', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                            <UserOutlined style={{ fontSize: 11 }} />
                                            <span>Ký duyệt: <strong>{pub.publishedBy?.fullName || 'Viện trưởng'}</strong></span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Quy mô hồ sơ:</span>
                                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                                                {pub.items?.length || 0} Sinh viên
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Cột phải: Chi tiết phiên công bố đã chọn */}
                        {selectedPublication ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', padding: 14, borderRadius: 'var(--radius)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                                                    Snapshot Niêm Phong Đợt #{selectedPublication.id}
                                                </span>
                                                <Tag color={TYPE_TAG_PROPS[selectedPublication.type]?.color || 'default'}>
                                                    {TYPE_TAG_PROPS[selectedPublication.type]?.text || selectedPublication.type}
                                                </Tag>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                                Người ký ban hành: <strong>{selectedPublication.publishedBy?.fullName || 'Viện trưởng'}</strong> · Thời điểm: {new Date(selectedPublication.publishedAt).toLocaleString('vi-VN')}
                                            </div>
                                        </div>
                                        <Badge count={`${selectedPublication.items?.length || 0} hồ sơ`} style={{ backgroundColor: '#0F766E' }} />
                                    </div>

                                    {selectedPublication.previousPublication && (
                                        <div style={{ marginTop: 8, fontSize: 12, color: '#D97706' }}>
                                            <SwapOutlined style={{ marginRight: 4 }} />
                                            Đính chính cho đợt công bố: <strong>#{selectedPublication.previousPublication.id} - {TYPE_TAG_PROPS[selectedPublication.previousPublication.type]?.text || selectedPublication.previousPublication.type}</strong> lúc {new Date(selectedPublication.previousPublication.publishedAt).toLocaleDateString('vi-VN')}
                                        </div>
                                    )}

                                    {selectedPublication.reason && (
                                        <div style={{ marginTop: 10, background: '#FFFFFF', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 12.5 }}>
                                            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Căn cứ văn bản: </span>
                                            <span style={{ color: 'var(--fg)' }}>{selectedPublication.reason}</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        columns={itemColumns}
                                        dataSource={selectedPublication.items || []}
                                        pagination={{ pageSize: 6 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <Empty description="Chọn một đợt công bố để xem chi tiết" />
                        )}
                    </div>
                )}
            </Spin>
        </Modal>
    );
}
