import { useState } from 'react';
import {
    Table,
    Tag,
    Button,
    Space,
    Modal,
    Input,
    Radio,
    Typography,
    message,
} from 'antd';
import {
    CheckCircleOutlined,
    InfoCircleOutlined,
    FileTextOutlined,
    SafetyCertificateOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import BM02ReviewDrawer from '../admin/BM02ReviewDrawer';
import CheckpointAppealReviewModal from '../admin/CheckpointAppealReviewModal';
import { useManualReviewMutation, manualReviewKeys } from '../../queries/manualReviewQueries';
import { invalidateInstituteOperations } from '../../queries/instituteOperationsQueries';
import { queryKeys } from '../../query/queryKeys';
import registrationService from '../../services/registrationService';

const { Text } = Typography;
const { TextArea } = Input;

const KIND_LABELS = {
    BM02_REVIEW: { text: 'Thẩm định BM02', color: 'cyan' },
    BM03_STOP_REVIEW: { text: 'Dừng đề tài BM03', color: 'orange' },
    BM04_REJECTION_REVIEW: { text: 'Đề nghị không bảo vệ BM04', color: 'red' },
    SIGNATURE_APPEAL_REVIEW: { text: 'Khiếu nại chữ ký', color: 'purple' },
};

const STATUS_LABELS = {
    PENDING_REVIEW: { text: 'Chờ thẩm định', color: 'gold' },
    EXCEPTION_REVIEW: { text: 'Chờ ngoại lệ', color: 'volcano' },
    STOP_REVIEW_PENDING: { text: 'Chờ quyết định dừng', color: 'orange' },
    MORE_INFO_REQUIRED: { text: 'Chờ bổ sung thông tin', color: 'blue' },
    PENDING: { text: 'Chờ xử lý', color: 'gold' },
    SUBMITTED: { text: 'Đã nộp khiếu nại', color: 'gold' },
};

export default function ReviewQueue({
    scope,
    items = [],
    loading = false,
    pagination,
    onPageChange,
    selectedKind,
    selectedResourceId,
}) {
    const queryClient = useQueryClient();
    const manualReviewMutation = useManualReviewMutation(scope);

    // BM02 Drawer state
    const [bm02DrawerOpen, setBm02DrawerOpen] = useState(false);
    const [selectedBm02Reg, setSelectedBm02Reg] = useState(null);
    const [loadingBm02Id, setLoadingBm02Id] = useState(null);

    // Appeal Modal state
    const [appealModalOpen, setAppealModalOpen] = useState(false);
    const [selectedAppeal, setSelectedAppeal] = useState(null);

    // BM03/BM04 More Info Modal state
    const [moreInfoModal, setMoreInfoModal] = useState({ open: false, item: null, mode: null });
    const [moreInfoNote, setMoreInfoNote] = useState('');

    // BM03/BM04 Decision Modal state
    const [decisionModal, setDecisionModal] = useState({ open: false, item: null, mode: null });
    const [decisionType, setDecisionType] = useState('');
    const [decisionReason, setDecisionReason] = useState('');

    const refreshAllReviewCaches = async () => {
        await Promise.all([
            invalidateInstituteOperations(queryClient, scope),
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all(scope) }),
            queryClient.invalidateQueries({ queryKey: manualReviewKeys.all(scope) }),
        ]);
    };

    const handleOpenBm02 = async (item) => {
        const fallbackReg = {
            id: item.registrationId,
            status: item.status,
            attemptNo: item.attemptNo || 1,
            topic: { title: item.subtitle },
            currentBM02Submission: {
                id: item.resourceId,
                attemptNo: item.attemptNo || 1,
            },
        };

        if (!item.registrationId) {
            setSelectedBm02Reg(fallbackReg);
            setBm02DrawerOpen(true);
            return;
        }

        try {
            setLoadingBm02Id(item.id);
            const res = await registrationService.getRegistrationById(item.registrationId);
            setSelectedBm02Reg(res?.data || res || fallbackReg);
        } catch {
            setSelectedBm02Reg(fallbackReg);
        } finally {
            setLoadingBm02Id(null);
            setBm02DrawerOpen(true);
        }
    };

    const handleOpenAppeal = (item) => {
        setSelectedAppeal({
            id: item.resourceId,
            registrationId: item.registrationId,
            status: item.status,
            topicTitle: item.subtitle,
            submittedAt: item.submittedAt,
            appealDeadlineAt: item.dueAt,
        });
        setAppealModalOpen(true);
    };

    const openMoreInfoModal = (item, mode) => {
        setMoreInfoNote('');
        setMoreInfoModal({ open: true, item, mode });
    };

    const handleSubmitMoreInfo = async () => {
        const { item, mode } = moreInfoModal;
        if (!item) return;
        const action = mode === 'BM03' ? 'requestMoreInfoForStopReview' : 'requestMoreInfoForDefenseReview';
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action,
                args: [item.resourceId, { note: moreInfoNote.trim() }],
            });
            message.success('Đã gửi yêu cầu bổ sung thông tin');
            setMoreInfoModal({ open: false, item: null, mode: null });
            setMoreInfoNote('');
            await refreshAllReviewCaches();
        } catch (error) {
            message.error(error?.message || 'Không thể gửi yêu cầu bổ sung');
        }
    };

    const openDecisionModal = (item, mode) => {
        setDecisionType(mode === 'BM03' ? 'APPROVE_STOP' : 'APPROVE_NOT_ELIGIBLE');
        setDecisionReason('');
        setDecisionModal({ open: true, item, mode });
    };

    const handleSubmitDecision = async () => {
        const { item, mode } = decisionModal;
        if (!item) return;
        const action = mode === 'BM03' ? 'decideStopReview' : 'decideDefenseReview';
        try {
            await manualReviewMutation.mutateAsync({
                targetService: 'evaluation',
                action,
                args: [item.resourceId, { decision: decisionType, reason: decisionReason.trim() }],
            });
            message.success('Đã cập nhật quyết định thẩm định');
            setDecisionModal({ open: false, item: null, mode: null });
            setDecisionReason('');
            await refreshAllReviewCaches();
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật quyết định thẩm định');
        }
    };

    const columns = [
        {
            title: 'Loại hồ sơ',
            dataIndex: 'kind',
            key: 'kind',
            width: 190,
            render: (kind) => {
                const cfg = KIND_LABELS[kind] || { text: kind, color: 'default' };
                return <Tag color={cfg.color}>{cfg.text}</Tag>;
            },
        },
        {
            title: 'Hồ sơ / Đề tài',
            key: 'title',
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{record.title}</div>
                    {record.subtitle && (
                        <Text type="secondary" className="text-xs">
                            {record.subtitle}
                        </Text>
                    )}
                    {record.department && (
                        <div className="mt-1">
                            <Tag>{record.department}</Tag>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Hạn xử lý',
            dataIndex: 'dueAt',
            key: 'dueAt',
            width: 160,
            render: (dueAt) => {
                if (!dueAt) {
                    return <Text type="secondary">Không giới hạn</Text>;
                }
                const parsed = dayjs(dueAt);
                const isOverdue = parsed.isValid() && parsed.isBefore(dayjs());
                return (
                    <Space size={4}>
                        <ClockCircleOutlined className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                        <Text type={isOverdue ? 'danger' : undefined}>
                            {parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : dueAt}
                        </Text>
                        {isOverdue && <Tag color="red">Quá hạn</Tag>}
                    </Space>
                );
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 170,
            render: (status) => {
                const cfg = STATUS_LABELS[status] || { text: status, color: 'default' };
                return <Tag color={cfg.color}>{cfg.text}</Tag>;
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 260,
            render: (_, record) => {
                const actions = Array.isArray(record.allowedActions) ? record.allowedActions : [];
                if (actions.length === 0) {
                    return <Text type="secondary">Chỉ xem</Text>;
                }

                return (
                    <Space wrap size="small">
                        {record.kind === 'BM02_REVIEW' &&
                            (actions.includes('APPROVE_BM02') ||
                                actions.includes('REQUEST_BM02_REVISION') ||
                                actions.includes('MARK_BM02_EXCEPTION') ||
                                actions.includes('REVIEW_BM02')) && (
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<FileTextOutlined />}
                                    loading={loadingBm02Id === record.id}
                                    onClick={() => handleOpenBm02(record)}
                                >
                                    Thẩm định BM02
                                </Button>
                            )}

                        {record.kind === 'BM03_STOP_REVIEW' && actions.includes('REQUEST_MORE_INFO') && (
                            <Button
                                size="small"
                                icon={<InfoCircleOutlined />}
                                onClick={() => openMoreInfoModal(record, 'BM03')}
                            >
                                Yêu cầu bổ sung
                            </Button>
                        )}
                        {record.kind === 'BM03_STOP_REVIEW' && actions.includes('DECIDE_STOP_REVIEW') && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => openDecisionModal(record, 'BM03')}
                            >
                                Quyết định dừng
                            </Button>
                        )}

                        {record.kind === 'BM04_REJECTION_REVIEW' && actions.includes('REQUEST_MORE_INFO') && (
                            <Button
                                size="small"
                                icon={<InfoCircleOutlined />}
                                onClick={() => openMoreInfoModal(record, 'BM04')}
                            >
                                Yêu cầu bổ sung
                            </Button>
                        )}
                        {record.kind === 'BM04_REJECTION_REVIEW' && actions.includes('DECIDE_DEFENSE_REVIEW') && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => openDecisionModal(record, 'BM04')}
                            >
                                Quyết định bảo vệ
                            </Button>
                        )}

                        {record.kind === 'SIGNATURE_APPEAL_REVIEW' && actions.includes('REVIEW_SIGNATURE_APPEAL') && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<SafetyCertificateOutlined />}
                                onClick={() => handleOpenAppeal(record)}
                            >
                                Thẩm định khiếu nại
                            </Button>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div>
            <Table
                rowKey="id"
                columns={columns}
                dataSource={items}
                loading={loading}
                rowClassName={(record) =>
                    selectedKind &&
                    selectedResourceId &&
                    record.kind === selectedKind &&
                    String(record.resourceId) === String(selectedResourceId)
                        ? 'bg-amber-50'
                        : ''
                }
                pagination={
                    pagination
                        ? {
                              current: pagination.page,
                              pageSize: pagination.pageSize,
                              total: pagination.total,
                              onChange: onPageChange,
                              showSizeChanger: false,
                          }
                        : false
                }
            />

            <BM02ReviewDrawer
                open={bm02DrawerOpen}
                onClose={() => {
                    setBm02DrawerOpen(false);
                    setSelectedBm02Reg(null);
                }}
                registration={selectedBm02Reg}
                onSuccess={refreshAllReviewCaches}
            />

            <CheckpointAppealReviewModal
                open={appealModalOpen}
                onClose={() => {
                    setAppealModalOpen(false);
                    setSelectedAppeal(null);
                }}
                appeal={selectedAppeal}
                onSuccess={refreshAllReviewCaches}
            />

            <Modal
                open={moreInfoModal.open}
                title="Yêu cầu bổ sung thông tin"
                onCancel={() => setMoreInfoModal({ open: false, item: null, mode: null })}
                onOk={handleSubmitMoreInfo}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
                confirmLoading={manualReviewMutation.isPending}
            >
                <div className="space-y-3">
                    <Text>{moreInfoModal.item?.title}</Text>
                    <TextArea
                        rows={4}
                        placeholder="Nhập nội dung cần bổ sung..."
                        value={moreInfoNote}
                        onChange={(e) => setMoreInfoNote(e.target.value)}
                    />
                </div>
            </Modal>

            <Modal
                open={decisionModal.open}
                title={
                    decisionModal.mode === 'BM03'
                        ? 'Quyết định thẩm định dừng đề tài (BM03)'
                        : 'Quyết định thẩm định điều kiện bảo vệ (BM04)'
                }
                onCancel={() => setDecisionModal({ open: false, item: null, mode: null })}
                onOk={handleSubmitDecision}
                okText="Xác nhận quyết định"
                cancelText="Hủy"
                confirmLoading={manualReviewMutation.isPending}
            >
                <div className="space-y-4">
                    <Text strong>{decisionModal.item?.title}</Text>
                    <div>
                        <Radio.Group
                            value={decisionType}
                            onChange={(e) => setDecisionType(e.target.value)}
                        >
                            <Space direction="vertical">
                                {decisionModal.mode === 'BM03' ? (
                                    <>
                                        <Radio value="APPROVE_STOP">Chấp thuận dừng thực hiện đề tài</Radio>
                                        <Radio value="REJECT_STOP">Bác bỏ đề xuất, tiếp tục thực hiện</Radio>
                                    </>
                                ) : (
                                    <>
                                        <Radio value="APPROVE_NOT_ELIGIBLE">Đồng ý không cho bảo vệ</Radio>
                                        <Radio value="ALLOW_DEFENSE">Cho phép ra bảo vệ</Radio>
                                    </>
                                )}
                            </Space>
                        </Radio.Group>
                    </div>
                    <TextArea
                        rows={3}
                        placeholder="Lý do / ghi chú quyết định..."
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
}
