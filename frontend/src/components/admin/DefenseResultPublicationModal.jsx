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
        label: 'Công bố chính thức đợt 1',
        icon: <SendOutlined />,
        desc: 'Ban hành kết quả chính thức cho toàn bộ sinh viên bảo vệ đợt chính.',
    },
    SUPPLEMENTARY: {
        label: 'Công bố bổ sung',
        icon: <PlusCircleOutlined />,
        desc: 'Ban hành cho các sinh viên bảo vệ đợt bổ sung hoặc phê duyệt sau.',
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

    const previousPublicationOptions = useMemo(() => {
        return history.map((pub) => {
            const typeLabel = TYPE_CONFIG[pub.type]?.label || pub.type;
            return {
                label: `#${pub.id} · ${typeLabel} · ${new Date(pub.publishedAt).toLocaleDateString('vi-VN')} · ${pub.items?.length || 0} hồ sơ`,
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
        const signature = JSON.stringify(payload);
        if (signature !== submittedPayload.current) {
            submittedPayload.current = signature;
            publicationRequestKey.current = globalThis.crypto?.randomUUID?.()
                || `result-publication-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        try {
            const res = await publishMutation.mutateAsync({ payload, idempotencyKey: publicationRequestKey.current });
            message.success(res.message || 'Đã ban hành công bố kết quả bảo vệ thành công.');
            onSuccess?.();
            onClose();
        } catch (err) {
            message.error(err?.message || 'Không thể công bố kết quả');
        }
    };

    const columns = [
        {
            title: 'Mã SV',
            dataIndex: ['registration', 'student', 'code'],
            key: 'studentCode',
            width: 115,
            render: (code) => (
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {code || '—'}
                </span>
            ),
        },
        {
            title: 'Họ tên sinh viên',
            dataIndex: ['registration', 'student', 'fullName'],
            key: 'studentName',
            width: 180,
            render: (name) => <span className="font-semibold text-slate-900 text-xs">{name || '—'}</span>,
        },
        {
            title: 'Tên đề tài',
            dataIndex: ['registration', 'topic', 'title'],
            key: 'topicTitle',
            ellipsis: true,
            render: (title) => <span className="text-xs text-slate-700">{title || '—'}</span>,
        },
        {
            title: 'Điểm chính thức',
            dataIndex: 'finalScoreSnapshot',
            key: 'score',
            width: 130,
            align: 'center',
            render: (score) => (
                <span className="font-mono tabular-nums font-bold text-[#0F766E] text-sm">
                    {score !== null && score !== undefined ? Number(score).toFixed(1) : '—'}
                </span>
            ),
        },
        {
            title: 'Kết quả bảo vệ',
            dataIndex: 'outcome',
            key: 'outcome',
            width: 130,
            align: 'center',
            render: (outcome) => {
                if (outcome === 'PASSED') {
                    return (
                        <Tag color="cyan" icon={<CheckCircleOutlined />} className="m-0 font-semibold">
                            Đạt bảo vệ
                        </Tag>
                    );
                }
                return (
                    <Tag color="error" icon={<CloseCircleOutlined />} className="m-0 font-semibold">
                        Không đạt
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
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 text-[#0F766E] grid place-items-center text-lg shrink-0">
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <h3 className="font-display text-base font-bold text-slate-900 m-0 leading-snug">
                            Công bố kết quả bảo vệ học kỳ
                        </h3>
                        <div className="text-xs text-slate-500 font-normal mt-0.5">
                            Đợt học kỳ: <strong className="text-slate-800">{semesterName || `Học kỳ #${semesterId}`}</strong>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4 mt-3">
                <ContentRefreshIndicator
                    refreshing={(Boolean(previewQuery.data) && previewQuery.isFetching) || (Boolean(historyQuery.data) && historyQuery.isFetching)}
                />
                {previewQuery.isError && (
                    <QueryErrorState
                        error={previewQuery.error}
                        onRetry={() => previewQuery.refetch()}
                        retrying={previewQuery.isFetching}
                    />
                )}
                {historyQuery.isError && (
                    <QueryErrorState
                        error={historyQuery.error}
                        onRetry={() => historyQuery.refetch()}
                        retrying={historyQuery.isFetching}
                    />
                )}
                {!previewQuery.data && previewQuery.isPending && <ContentSkeleton variant="table" />}

                {previewQuery.data && (
                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                        <div className="font-display font-semibold text-xs text-slate-700 mb-2">
                            Loại hình công bố kết quả
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
                                    <div className="py-1.5 px-1">
                                        <Space size={6}>
                                            {cfg.icon}
                                            <span className="font-semibold text-xs">{cfg.label}</span>
                                        </Space>
                                        <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                                            {cfg.desc}
                                        </div>
                                    </div>
                                ),
                            }))}
                        />
                    </div>
                )}

                <Form form={form} layout="vertical" onFinish={handleFormSubmit} disabled={!canPublish || submitting}>
                    {previewQuery.data && (
                        <>
                            {type === 'SUPPLEMENTARY' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <Form.Item
                                        name="previousPublicationId"
                                        label="Đợt công bố tiền nhiệm"
                                        rules={[{ required: true, message: 'Vui lòng chọn đợt công bố tiền nhiệm' }]}
                                    >
                                        <Select
                                            placeholder="Chọn đợt công bố đã ban hành"
                                            options={previousPublicationOptions}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="reason"
                                        label="Lý do công bố đợt bổ sung"
                                        rules={[{ required: true, message: 'Vui lòng nhập lý do công bố bổ sung' }]}
                                    >
                                        <Input placeholder="Ví dụ: Công bố cho sinh viên bảo vệ đợt bổ sung..." />
                                    </Form.Item>
                                </div>
                            )}

                            {type === 'INITIAL' && (
                                <Form.Item name="reason" label="Ghi chú đợt công bố">
                                    <Input placeholder="Ví dụ: Công bố chính thức kết quả bảo vệ đợt 1..." />
                                </Form.Item>
                            )}

                            <div className="grid grid-cols-3 gap-3 mb-3.5">
                                <div className="bg-teal-50/70 border border-teal-200/80 px-3.5 py-2.5 rounded-xl">
                                    <div className="text-[11px] text-[#0F766E] font-bold uppercase tracking-wider">
                                        Tổng hồ sơ công bố
                                    </div>
                                    <div className="text-xl font-bold text-[#0F766E] font-mono tabular-nums mt-0.5">
                                        {summaryStats.total} SV
                                    </div>
                                </div>

                                <div className="bg-emerald-50/70 border border-emerald-200/80 px-3.5 py-2.5 rounded-xl">
                                    <div className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                                        Kết quả đạt
                                    </div>
                                    <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                                        {summaryStats.passed} SV
                                    </div>
                                </div>

                                <div className="bg-rose-50/70 border border-rose-200/80 px-3.5 py-2.5 rounded-xl">
                                    <div className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">
                                        Không đạt
                                    </div>
                                    <div className="text-xl font-bold text-rose-700 font-mono tabular-nums mt-0.5">
                                        {summaryStats.failed} SV
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2">
                                    <span className="font-display font-semibold text-xs text-slate-800">
                                        Danh sách hồ sơ đủ điều kiện công bố
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                                        {eligibleList.length} hồ sơ đã phê duyệt
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

                            <Alert
                                className="mt-3.5"
                                type="info"
                                showIcon
                                icon={<ExclamationCircleOutlined />}
                                title="Cam kết bảo toàn dữ liệu kết quả"
                                description="Sau khi ban hành, bản ghi kết quả sẽ được lưu trữ cố định với đầy đủ thông tin sinh viên, đề tài, điểm chính thức và xếp loại. Sinh viên có thể tra cứu kết quả ngay lập tức và bản ghi đã công bố không thể chỉnh sửa."
                            />

                            <Divider className="my-4" />
                            <div className="flex justify-end gap-2.5">
                                <Button onClick={onClose} disabled={submitting}>
                                    Đóng
                                </Button>
                                {canPublish && (
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={submitting}
                                        disabled={
                                            summaryStats.total === 0
                                            || previewQuery.isError
                                            || historyQuery.isError
                                            || previewQuery.isFetching
                                            || historyQuery.isFetching
                                        }
                                        className="!bg-[#0F766E] hover:!bg-[#115E59] font-semibold"
                                        icon={<SafetyCertificateOutlined />}
                                    >
                                        Ký và ban hành công bố
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </Modal>
    );
}
