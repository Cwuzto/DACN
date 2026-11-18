import { useState } from 'react';
import {
    Table,
    Tag,
    Button,
    Space,
    Modal,
    Radio,
    Popconfirm,
    Typography,
    message,
} from 'antd';
import {
    CheckCircleOutlined,
    FileDoneOutlined,
    FileProtectOutlined,
    SafetyCertificateOutlined,
    PlusOutlined,
    EyeOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import ClearanceCertificateModal from '../forms/ClearanceCertificateModal';
import { invalidateInstituteOperations } from '../../queries/instituteOperationsQueries';
import { useApproveDefenseResult } from '../../queries/gradingQueries';
import { oversightKeys } from '../../queries/oversightQueries';
import { bm02aKeys } from '../../queries/bm02aQueries';
import { queryKeys } from '../../query/queryKeys';
import { semesterService } from '../../services/semesterService';
import registrationService from '../../services/registrationService';
import bm02aService from '../../services/bm02aService';
import archiveService from '../../services/archiveService';

const { Text } = Typography;

const KIND_LABELS = {
    ASSIGNMENT_DECISION: { text: 'Quyết định giao đề tài', color: 'blue' },
    TITLE_ADJUSTMENT_APPENDIX: { text: 'Phụ lục điều chỉnh BM02-A', color: 'cyan' },
    CLEARANCE_CERTIFICATE: { text: 'Giấy xác nhận lưu chiểu', color: 'purple' },
    DEFENSE_RESULT_APPROVAL: { text: 'Phê duyệt kết quả bảo vệ', color: 'green' },
};

const STATUS_LABELS = {
    BM02_APPROVED: { text: 'Chờ lập QĐ', color: 'gold' },
    DRAFT: { text: 'Dự thảo', color: 'default' },
    PENDING_DEPARTMENT_APPROVAL: { text: 'Chờ duyệt BM02-A', color: 'orange' },
    APPROVED_PENDING_APPENDIX: { text: 'Chờ lập phụ lục', color: 'blue' },
    AWAITING_FINAL_APPROVAL: { text: 'Chờ phê duyệt kết quả', color: 'gold' },
};

export default function DecisionQueue({
    scope,
    semesterId,
    items = [],
    loading = false,
    pagination,
    onPageChange,
    selectedKind,
    selectedResourceId,
}) {
    const queryClient = useQueryClient();
    const approveDefenseMutation = useApproveDefenseResult(scope, semesterId);

    const [busyId, setBusyId] = useState(null);
    const [certModalOpen, setCertModalOpen] = useState(false);
    const [certData, setCertData] = useState(null);

    // Defense result approval modal
    const [approvalModal, setApprovalModal] = useState({ open: false, item: null });
    const [approvalOutcome, setApprovalOutcome] = useState('PASSED');

    const refreshDecisionCaches = async () => {
        await Promise.all([
            invalidateInstituteOperations(queryClient, scope),
            queryClient.invalidateQueries({ queryKey: queryKeys.semesters.list(scope) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.lists(scope) }),
            queryClient.invalidateQueries({ queryKey: bm02aKeys.queue(scope) }),
            queryClient.invalidateQueries({ queryKey: oversightKeys.archivesList(scope) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.grading.all(scope) }),
        ]);
    };

    const runAction = async (itemId, fn, successMessage) => {
        try {
            setBusyId(itemId);
            const res = await fn();
            if (res && res.success === false) {
                throw res;
            }
            message.success(successMessage);
            await refreshDecisionCaches();
        } catch (error) {
            message.error(error?.message || 'Thao tác không thành công');
        } finally {
            setBusyId(null);
        }
    };

    const handleOpenCertificate = async (item) => {
        if (!item.registrationId) return;
        try {
            setBusyId(item.id);
            const res = await archiveService.getClearanceCertificate(item.registrationId);
            if (res?.success) {
                setCertData(res.data);
                setCertModalOpen(true);
            }
        } catch (error) {
            message.error(error?.message || 'Không thể tải Giấy xác nhận');
        } finally {
            setBusyId(null);
        }
    };

    const handleApproveResultSubmit = async () => {
        const item = approvalModal.item;
        if (!item?.registrationId) return;
        try {
            await approveDefenseMutation.mutateAsync({
                registrationId: item.registrationId,
                outcome: approvalOutcome,
            });
            message.success('Đã phê duyệt kết quả bảo vệ thành công');
            setApprovalModal({ open: false, item: null });
            await refreshDecisionCaches();
        } catch (error) {
            message.error(error?.message || 'Không thể phê duyệt kết quả bảo vệ');
        }
    };

    const columns = [
        {
            title: 'Loại nghiệp vụ',
            dataIndex: 'kind',
            key: 'kind',
            width: 200,
            render: (kind) => {
                const cfg = KIND_LABELS[kind] || { text: kind, color: 'default' };
                return <Tag color={cfg.color}>{cfg.text}</Tag>;
            },
        },
        {
            title: 'Hồ sơ / Nội dung',
            key: 'title',
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{record.title}</div>
                    {record.subtitle && (
                        <Text type="secondary" className="text-xs">
                            {record.subtitle}
                        </Text>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                        {record.department && <Tag>{record.department}</Tag>}
                        {record.councilName && <Tag color="geekblue">{record.councilName}</Tag>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Hạn xử lý',
            dataIndex: 'dueAt',
            key: 'dueAt',
            width: 150,
            render: (dueAt) => {
                if (!dueAt) return <Text type="secondary">Không giới hạn</Text>;
                const parsed = dayjs(dueAt);
                const isOverdue = parsed.isValid() && parsed.isBefore(dayjs());
                return (
                    <Space size={4}>
                        <ClockCircleOutlined className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                        <Text type={isOverdue ? 'danger' : undefined}>
                            {parsed.isValid() ? parsed.format('DD/MM/YYYY') : dueAt}
                        </Text>
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
            width: 280,
            render: (_, record) => {
                const actions = Array.isArray(record.allowedActions) ? record.allowedActions : [];
                const isBusy = busyId === record.id;

                return (
                    <Space wrap size="small">
                        {record.kind === 'CLEARANCE_CERTIFICATE' && record.registrationId && (
                            <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => handleOpenCertificate(record)}
                            >
                                Xem giấy
                            </Button>
                        )}

                        {actions.includes('ISSUE_TOPIC_DECISION') && (
                            <Popconfirm
                                title="Lập Quyết định giao đề tài cho hồ sơ này?"
                                okText="Lập quyết định"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () =>
                                            semesterService.issuePeriodDecision(semesterId, {
                                                registrationIds: [record.registrationId],
                                            }),
                                        'Đã lập Quyết định giao đề tài'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<FileDoneOutlined />}
                                    loading={isBusy}
                                >
                                    Lập QĐ giao đề tài
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('PUBLISH_TOPIC_DECISION') && (
                            <Popconfirm
                                title="Ban hành Quyết định giao đề tài?"
                                okText="Ban hành"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () =>
                                            registrationService.publishTopicDecision(record.resourceId, {
                                                publishedAt: new Date().toISOString(),
                                            }),
                                        'Đã ban hành Quyết định giao đề tài'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    loading={isBusy}
                                >
                                    Ban hành QĐ
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('APPROVE_BM02A_DEPARTMENT') && (
                            <Popconfirm
                                title="Phê duyệt đơn điều chỉnh tên đề tài BM02-A?"
                                okText="Phê duyệt"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () => bm02aService.departmentSign(record.resourceId, { decision: 'APPROVED' }),
                                        'Đã phê duyệt BM02-A'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    loading={isBusy}
                                >
                                    Duyệt BM02-A
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('CREATE_APPENDIX_DRAFT') && (
                            <Popconfirm
                                title="Tạo dự thảo phụ lục điều chỉnh tên đề tài?"
                                okText="Tạo dự thảo"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () =>
                                            bm02aService.createAppendix({
                                                decisionId: record.decisionId,
                                                appendixNumber: record.appendixNumber || `PL-${record.resourceId}`,
                                                bm02aRequestIds: [record.resourceId],
                                                signedDate: new Date().toISOString(),
                                            }),
                                        'Đã tạo dự thảo phụ lục'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    loading={isBusy}
                                >
                                    Tạo dự thảo phụ lục
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('ISSUE_APPENDIX') && (
                            <Popconfirm
                                title="Ban hành Phụ lục điều chỉnh tên đề tài?"
                                okText="Ban hành"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () =>
                                            bm02aService.issueAppendix(record.resourceId, {
                                                signedDate: new Date().toISOString(),
                                            }),
                                        'Đã ban hành phụ lục điều chỉnh'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<FileProtectOutlined />}
                                    loading={isBusy}
                                >
                                    Ban hành phụ lục
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('SIGN_CLEARANCE_CERTIFICATE') && (
                            <Popconfirm
                                title="Ký số Giấy xác nhận hoàn thành đồ án?"
                                okText="Ký xác nhận"
                                cancelText="Hủy"
                                onConfirm={() =>
                                    runAction(
                                        record.id,
                                        () => archiveService.signClearanceCertificate(record.resourceId),
                                        'Đã ký Giấy xác nhận hoàn thành'
                                    )
                                }
                            >
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<SafetyCertificateOutlined />}
                                    loading={isBusy}
                                >
                                    Ký giấy xác nhận
                                </Button>
                            </Popconfirm>
                        )}

                        {actions.includes('APPROVE_DEFENSE_RESULT') && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => {
                                    setApprovalOutcome('PASSED');
                                    setApprovalModal({ open: true, item: record });
                                }}
                            >
                                Phê duyệt kết quả
                            </Button>
                        )}

                        {actions.length === 0 && record.kind !== 'CLEARANCE_CERTIFICATE' && (
                            <Text type="secondary">Chỉ xem</Text>
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

            <ClearanceCertificateModal
                open={certModalOpen}
                onClose={() => {
                    setCertModalOpen(false);
                    setCertData(null);
                }}
                certificateData={certData}
            />

            <Modal
                open={approvalModal.open}
                title="Phê duyệt kết quả bảo vệ"
                onCancel={() => setApprovalModal({ open: false, item: null })}
                onOk={handleApproveResultSubmit}
                okText="Xác nhận phê duyệt"
                cancelText="Hủy"
                confirmLoading={approveDefenseMutation.isPending}
            >
                <div className="space-y-4">
                    <Text strong>{approvalModal.item?.title}</Text>
                    <div>
                        <Radio.Group
                            value={approvalOutcome}
                            onChange={(e) => setApprovalOutcome(e.target.value)}
                        >
                            <Space direction="vertical">
                                <Radio value="PASSED">Đạt (PASSED)</Radio>
                                <Radio value="FAILED">Không đạt (FAILED)</Radio>
                            </Space>
                        </Radio.Group>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
