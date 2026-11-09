import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Modal,
    Segmented,
    Form,
    Input,
    Select,
    Table,
    Tag,
    Alert,
    Button,
    Space,
    Typography,
    Divider,
    message,
    Tooltip,
    Badge,
} from 'antd';
import {
    SendOutlined,
    PlusCircleOutlined,
    EditOutlined,
    SafetyCertificateOutlined,
    InfoCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileTextOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import evaluationService from '../../services/evaluationService';

const { Text, Paragraph } = Typography;

const TYPE_CONFIG = {
    INITIAL: {
        label: 'Công bố Chính thức đợt 1',
        icon: <SendOutlined />,
        desc: 'Ban hành kết quả chính thức cho toàn bộ sinh viên bảo vệ đợt chính.',
        badgeColor: '#0F766E',
    },
    SUPPLEMENTARY: {
        label: 'Công bố Bổ sung',
        icon: <PlusCircleOutlined />,
        desc: 'Ban hành cho các sinh viên bảo vệ đợt bổ sung hoặc duyệt trễ.',
        badgeColor: '#0284C7',
    },
    CORRECTION: {
        label: 'Công bố Đính chính',
        icon: <EditOutlined />,
        desc: 'Đính chính kết quả đã ban hành do phúc khảo hoặc quyết định điều chỉnh.',
        badgeColor: '#D97706',
    },
};

export default function DefenseResultPublicationModal({
    open,
    onClose,
    semesterId,
    semesterName,
    onSuccess,
}) {
    const [form] = Form.useForm();
    const [type, setType] = useState('INITIAL');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [history, setHistory] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const publicationRequestKey = useRef(null);

    // Dành cho CORRECTION: Chọn đợt công bố tiền nhiệm và danh sách đính chính
    const [selectedPreviousPubId, setSelectedPreviousPubId] = useState(null);
    const [correctionSelections, setCorrectionSelections] = useState({}); // { [registrationId]: replacesPublicationItemId }

    const loadData = useCallback(async () => {
        if (!semesterId) return;
        try {
            setPreviewLoading(true);
            const [previewRes, historyRes] = await Promise.all([
                evaluationService.previewResultPublication(semesterId),
                evaluationService.getResultPublicationHistory(semesterId),
            ]);

            if (previewRes.success) {
                setPreviewData(previewRes.data);
            }
            if (historyRes.success) {
                setHistory(historyRes.data || []);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể tải dữ liệu chuẩn bị công bố');
        } finally {
            setPreviewLoading(false);
        }
    }, [semesterId]);

    useEffect(() => {
        if (open) {
            loadData();
            form.resetFields();
            setType('INITIAL');
            setSelectedPreviousPubId(null);
            setCorrectionSelections({});
            publicationRequestKey.current = null;
        }
    }, [open, loadData, form]);

    // Các ấn phẩm trước có thể dùng làm tiền nhiệm cho CORRECTION
    const previousPublicationOptions = useMemo(() => {
        return history.map((pub) => {
            const typeLabel = TYPE_CONFIG[pub.type]?.label || pub.type;
            return {
                label: `#${pub.id} · ${typeLabel} · ${new Date(pub.publishedAt).toLocaleDateString('vi-VN')} (${pub.items?.length || 0} hồ sơ)`,
                value: pub.id,
                items: pub.items || [],
            };
        });
    }, [history]);

    // Lấy items của đợt công bố tiền nhiệm đã chọn
    const previousPublicationItems = useMemo(() => {
        if (!selectedPreviousPubId) return [];
        const pub = history.find((p) => p.id === selectedPreviousPubId);
        return pub?.items || [];
    }, [selectedPreviousPubId, history]);

    // Danh sách hồ sơ đủ điều kiện để công bố
    const eligibleList = useMemo(() => {
        return type === 'CORRECTION'
            ? previewData?.correctionEligible || []
            : previewData?.eligible || [];
    }, [previewData, type]);

    // Thống kê nhanh danh sách sẽ công bố
    const summaryStats = useMemo(() => {
        let targetList = [];
        if (type !== 'CORRECTION') {
            targetList = eligibleList;
        } else {
            const selectedRegIds = Object.keys(correctionSelections).filter(
                (k) => correctionSelections[k]
            );
            targetList = eligibleList.filter((a) =>
                selectedRegIds.includes(String(a.registrationId))
            );
        }

        const total = targetList.length;
        const passed = targetList.filter((a) => a.outcome === 'PASSED').length;
        const failed = targetList.filter((a) => a.outcome === 'FAILED').length;
        return { total, passed, failed, targetList };
    }, [type, eligibleList, correctionSelections]);

    const handleFormSubmit = async (values) => {
        if (type !== 'CORRECTION' && summaryStats.total === 0) {
            message.warning('Không có hồ sơ hợp lệ nào để công bố.');
            return;
        }

        if (type !== 'INITIAL' && !values.previousPublicationId) {
            message.warning('Vui lòng chọn đợt công bố tiền nhiệm.');
            return;
        }

        if (type === 'CORRECTION') {
            const correctionItems = Object.entries(correctionSelections)
                .filter(([, replacesItemId]) => replacesItemId)
                .map(([regId, replacesItemId]) => ({
                    registrationId: Number(regId),
                    replacesPublicationItemId: Number(replacesItemId),
                }));

            if (!correctionItems.length) {
                message.warning('Vui lòng chọn ít nhất một hồ sơ đối ứng cần đính chính.');
                return;
            }
        }

        try {
            setSubmitting(true);
            publicationRequestKey.current ||= globalThis.crypto?.randomUUID?.()
                || `result-publication-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const payload = {
                type,
                reason: values.reason?.trim() || undefined,
                previousPublicationId:
                    type !== 'INITIAL' ? values.previousPublicationId : undefined,
                correctionItems:
                    type === 'CORRECTION'
                        ? Object.entries(correctionSelections)
                              .filter(([, replacesItemId]) => replacesItemId)
                              .map(([regId, replacesItemId]) => ({
                                  registrationId: Number(regId),
                                  replacesPublicationItemId: Number(replacesItemId),
                              }))
                        : undefined,
            };

            const res = await evaluationService.publishDefenseResults(semesterId, payload, publicationRequestKey.current);
            if (res.success) {
                message.success(res.message || 'Đã ban hành snapshot công bố kết quả thành công!');
                onSuccess?.();
                onClose();
            }
        } catch (err) {
            message.error(err?.message || 'Không thể công bố kết quả');
        } finally {
            setSubmitting(false);
        }
    };

    // Columns cho Table Preview
    const columns = [
        {
            title: 'Mã SV',
            dataIndex: ['registration', 'student', 'code'],
            key: 'studentCode',
            width: 110,
            render: (code) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {code || '—'}
                </span>
            ),
        },
        {
            title: 'Họ tên Sinh viên',
            dataIndex: ['registration', 'student', 'fullName'],
            key: 'studentName',
            width: 170,
            render: (name) => <span style={{ fontWeight: 600 }}>{name || '—'}</span>,
        },
        {
            title: 'Tên Đề tài',
            dataIndex: ['registration', 'topic', 'title'],
            key: 'topicTitle',
            ellipsis: true,
        },
        {
            title: 'Điểm Snapshot',
            dataIndex: 'finalScoreSnapshot',
            key: 'score',
            width: 120,
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
            title: 'Kết quả Bảo vệ',
            dataIndex: 'outcome',
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
    ];

    // Cột bổ sung nếu là CORRECTION để map replacesPublicationItemId
    if (type === 'CORRECTION') {
        columns.push({
            title: 'Bản ghi cũ cần thay thế',
            key: 'replaceItem',
            width: 220,
            render: (_, record) => {
                const regId = record.registrationId;
                const matchItem = previousPublicationItems.find(
                    (item) => item.registrationId === regId
                );

                return (
                    <Select
                        placeholder="Chọn bản ghi cũ..."
                        style={{ width: '100%' }}
                        allowClear
                        value={correctionSelections[regId] || (matchItem ? matchItem.id : undefined)}
                        onChange={(val) => {
                            setCorrectionSelections((prev) => ({
                                ...prev,
                                [regId]: val,
                            }));
                        }}
                        options={previousPublicationItems.map((item) => ({
                            label: `${item.studentCodeSnapshot} - ${item.outcomeSnapshot} (${item.finalScoreSnapshot}đ)`,
                            value: item.id,
                        }))}
                    />
                );
            },
        });
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={940}
            destroyOnClose
            title={
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
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                            Ban Hành Snapshot Công Bố Kết Quả Bảo Vệ
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
                            Học kỳ: <strong style={{ color: 'var(--fg)' }}>{semesterName || `ID #${semesterId}`}</strong> · Quyền hạn: <Tag color="geekblue">RESULT_PUBLISH</Tag>
                        </div>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
                {/* 1. Chọn loại hình công bố */}
                <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--fg)' }}>
                        Loại hình công bố kết quả:
                    </div>
                    <Segmented
                        block
                        value={type}
                        onChange={(val) => {
                            setType(val);
                            form.setFieldsValue({ reason: undefined, previousPublicationId: undefined });
                            setSelectedPreviousPubId(null);
                            setCorrectionSelections({});
                            publicationRequestKey.current = null;
                        }}
                        options={Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({
                            value: key,
                            label: (
                                <div style={{ padding: '6px 4px' }}>
                                    <Space orientation="horizontal" size={6}>
                                        {cfg.icon}
                                        <span style={{ fontWeight: 600 }}>{cfg.label}</span>
                                    </Space>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontWeight: 400 }}>
                                        {cfg.desc}
                                    </div>
                                </div>
                            ),
                        }))}
                    />
                </div>

                {/* 2. Cấu hình Form phụ trợ (Lý do & Tiền nhiệm) */}
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    {type === 'CORRECTION' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <Form.Item
                                name="previousPublicationId"
                                label="Văn bản công bố tiền nhiệm cần đính chính"
                                rules={[{ required: true, message: 'Vui lòng chọn đợt công bố cần đính chính' }]}
                            >
                                <Select
                                    placeholder="Chọn đợt công bố..."
                                    options={previousPublicationOptions}
                                    onChange={(val) => {
                                        setSelectedPreviousPubId(val);
                                        // Tự động gợi ý map các sinh viên trùng registrationId
                                        const pub = history.find((p) => p.id === val);
                                        if (pub?.items) {
                                            const autoMap = {};
                                            eligibleList.forEach((el) => {
                                                const found = pub.items.find(
                                                    (it) => it.registrationId === el.registrationId
                                                );
                                                if (found) {
                                                    autoMap[el.registrationId] = found.id;
                                                }
                                            });
                                            setCorrectionSelections(autoMap);
                                        }
                                    }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="reason"
                                label="Căn cứ / Quyết định đính chính (Bắt buộc)"
                                rules={[{ required: true, message: 'Vui lòng nhập lý do/căn cứ đính chính' }]}
                            >
                                <Input placeholder="Ví dụ: Theo Kết luận Hội đồng Phúc khảo số 12/KL-ĐH..." />
                            </Form.Item>
                        </div>
                    )}

                    {type === 'SUPPLEMENTARY' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <Form.Item
                                name="previousPublicationId"
                                label="Đợt công bố tiền nhiệm"
                                rules={[{ required: true, message: 'Vui lòng chọn đợt công bố tiền nhiệm' }]}
                            >
                                <Select
                                    placeholder="Chọn đợt công bố đã ban hành..."
                                    options={previousPublicationOptions}
                                />
                            </Form.Item>
                            <Form.Item
                                name="reason"
                                label="Lý do công bố đợt bổ sung (Bắt buộc)"
                                rules={[{ required: true, message: 'Vui lòng nhập lý do công bố bổ sung' }]}
                            >
                                <Input placeholder="Ví dụ: Công bố cho sinh viên bảo vệ đợt bổ sung ngày..." />
                            </Form.Item>
                        </div>
                    )}

                    {type === 'INITIAL' && (
                        <Form.Item name="reason" label="Ghi chú đợt công bố (Tùy chọn)">
                            <Input placeholder="Ví dụ: Công bố chính thức đợt 1..." />
                        </Form.Item>
                    )}

                    {/* 3. Thẻ KPI Preview */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: 11, color: '#0F766E', fontWeight: 600, textTransform: 'uppercase' }}>
                                Tổng Hồ Sơ Công Bố
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#0F766E', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {summaryStats.total} SV
                            </div>
                        </div>

                        <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, textTransform: 'uppercase' }}>
                                Kết Quả Đạt
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#16A34A', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {summaryStats.passed} SV
                            </div>
                        </div>

                        <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, textTransform: 'uppercase' }}>
                                Không Đạt / Dừng
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {summaryStats.failed} SV
                            </div>
                        </div>
                    </div>

                    {/* 4. Bảng Preview Danh Sách Sinh Viên */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div
                            style={{
                                padding: '10px 14px',
                                background: '#F8FAFC',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                                Danh sách hồ sơ sẽ tạo snapshot niêm phong:
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {eligibleList.length} hồ sơ đã được phê duyệt hợp lệ
                            </span>
                        </div>
                        <Table
                            rowKey="id"
                            size="small"
                            columns={columns}
                            dataSource={eligibleList}
                            loading={previewLoading}
                            pagination={{ pageSize: 5 }}
                            locale={{ emptyText: 'Không có hồ sơ nào chờ công bố trong học kỳ này' }}
                        />
                    </div>

                    {/* 5. Cảnh báo bảo toàn dữ liệu */}
                    <Alert
                        style={{ marginTop: 14 }}
                        type="info"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message="Cam kết bảo toàn dữ liệu vĩnh viễn"
                        description="Sau khi ban hành, bản ghi kết quả này sẽ được niêm phong vĩnh viễn (sao chép đầy đủ họ tên, điểm, đề tài, kết quả). Sinh viên sẽ tra cứu được kết quả chính thức ngay lập tức. Mọi điều chỉnh sau này bắt buộc phải tạo văn bản công bố đính chính."
                    />

                    {/* 6. Footer Buttons */}
                    <Divider style={{ margin: '16px 0 12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Button onClick={onClose} disabled={submitting}>
                            Hủy bỏ
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={submitting}
                            disabled={summaryStats.total === 0}
                            style={{
                                background: 'var(--primary)',
                                borderColor: 'var(--primary)',
                                fontWeight: 600,
                            }}
                            icon={<SafetyCertificateOutlined />}
                        >
                            Ký & Ban Hành Công Bố
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
