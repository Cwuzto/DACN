import { useState, useEffect, useMemo, useRef } from 'react';
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
    Divider,
    message,
} from 'antd';
import {
    SendOutlined,
    PlusCircleOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { usePublicationHistory, usePublicationPreview, usePublishDefenseResults } from '../../queries/gradingQueries';
import ContentSkeleton from '../common/ContentSkeleton';
import QueryErrorState from '../common/QueryErrorState';
import ContentRefreshIndicator from '../common/ContentRefreshIndicator';

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
    const user = useAuthStore((state) => state.user);
    const canPublish = Boolean(user?.permissions?.includes('RESULT_PUBLICATION_PUBLISH'));
    const canRead = canPublish || Boolean(user?.permissions?.includes('VIEW_RESULT_PUBLICATIONS'));
    const scope = queryKeys.scope(user);
    const previewQuery = usePublicationPreview(scope, semesterId, { enabled: open && canRead });
    const historyQuery = usePublicationHistory(scope, semesterId, { enabled: open && canRead });
    const publishMutation = usePublishDefenseResults(scope, semesterId);
    const previewData = previewQuery.data?.data;
    const history = historyQuery.data?.data || [];
    const submitting = publishMutation.isPending;
    const publicationRequestKey = useRef(null);
    const submittedPayload = useRef(null);

    useEffect(() => {
        if (open) {
            form.resetFields();
            setType('INITIAL');
            publicationRequestKey.current = null;
            submittedPayload.current = null;
        }
    }, [open, semesterId, form]);

    // Các đợt công bố trước có thể dùng làm tiền nhiệm cho đợt bổ sung
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

    const eligibleList = previewData?.eligible || [];
    const summaryStats = useMemo(() => ({
        total: eligibleList.length,
        passed: eligibleList.filter((row) => row.outcome === 'PASSED').length,
        failed: eligibleList.filter((row) => row.outcome === 'FAILED').length,
    }), [eligibleList]);

    const handleFormSubmit = async (values) => {
        if (!canPublish || !previewQuery.data || previewQuery.isError || historyQuery.isError) return;
        if (summaryStats.total === 0) {
            message.warning('Không có hồ sơ hợp lệ nào để công bố.');
            return;
        }
        if (type === 'SUPPLEMENTARY' && !values.previousPublicationId) {
            message.warning('Vui lòng chọn đợt công bố tiền nhiệm.');
            return;
        }
        const payload = {
            type,
            reason: values.reason?.trim() || undefined,
            previousPublicationId: type === 'SUPPLEMENTARY' ? values.previousPublicationId : undefined,
        };
        // Keep the same request key on a failed retry, and start a new command
        // if the user edits the payload after that failure.
        const signature = JSON.stringify(payload);
        if (signature !== submittedPayload.current) {
            submittedPayload.current = signature;
            publicationRequestKey.current = globalThis.crypto?.randomUUID?.()
                || `result-publication-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        try {
            const res = await publishMutation.mutateAsync({ payload, idempotencyKey: publicationRequestKey.current });
            message.success(res.message || 'Đã ban hành snapshot công bố kết quả thành công!');
            onSuccess?.();
            onClose();
        } catch (err) {
            message.error(err?.message || 'Không thể công bố kết quả');
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

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={940}
            destroyOnHidden
            forceRender
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
                            Học kỳ: <strong style={{ color: 'var(--fg)' }}>{semesterName || `ID #${semesterId}`}</strong>
                        </div>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
                <ContentRefreshIndicator refreshing={(Boolean(previewQuery.data) && previewQuery.isFetching) || (Boolean(historyQuery.data) && historyQuery.isFetching)} />
                {previewQuery.isError && <QueryErrorState error={previewQuery.error} onRetry={() => previewQuery.refetch()} retrying={previewQuery.isFetching} />}
                {historyQuery.isError && <QueryErrorState error={historyQuery.error} onRetry={() => historyQuery.refetch()} retrying={historyQuery.isFetching} />}
                {!previewQuery.data && previewQuery.isPending && <ContentSkeleton variant="table" />}
                {/* 1. Chọn loại hình công bố */}
                {previewQuery.data && (
                <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--fg)' }}>
                        Loại hình công bố kết quả:
                    </div>
                    <Segmented
                        block
                        disabled={!canPublish || submitting}
                        value={type}
                        onChange={(val) => {
                            setType(val);
                            form.setFieldsValue({ reason: undefined, previousPublicationId: undefined });
                            publicationRequestKey.current = null;
                            submittedPayload.current = null;
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
                )}

                {/* 2. Cấu hình Form phụ trợ (Lý do & Tiền nhiệm) */}
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} disabled={!canPublish || submitting}>
                    {previewQuery.data && <>
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
                            rowKey="registrationId"
                            size="small"
                            columns={columns}
                            dataSource={eligibleList}
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
                        title="Cam kết bảo toàn dữ liệu vĩnh viễn"
                        description="Sau khi ban hành, bản ghi kết quả này sẽ được niêm phong vĩnh viễn (sao chép đầy đủ họ tên, điểm, đề tài, kết quả). Sinh viên sẽ tra cứu được kết quả chính thức ngay lập tức. Kết quả đã công bố không được điều chỉnh hoặc đính chính."
                    />

                    {/* 6. Footer Buttons */}
                    <Divider style={{ margin: '16px 0 12px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Button onClick={onClose} disabled={submitting}>
                            Đóng
                        </Button>
                        {canPublish && <Button
                            type="primary"
                            htmlType="submit"
                            loading={submitting}
                            disabled={summaryStats.total === 0 || previewQuery.isError || historyQuery.isError || previewQuery.isFetching || historyQuery.isFetching}
                            style={{
                                background: 'var(--primary)',
                                borderColor: 'var(--primary)',
                                fontWeight: 600,
                            }}
                            icon={<SafetyCertificateOutlined />}
                        >
                            Ký & Ban Hành Công Bố
                        </Button>}
                    </div>
                </>}
                </Form>
            </div>
        </Modal>
    );
}
