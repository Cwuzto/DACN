import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    Tag,
    Button,
    Space,
    Popconfirm,
    Typography,
    message,
} from 'antd';
import {
    SendOutlined,
    HistoryOutlined,
    EyeOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import DefenseResultPublicationModal from '../admin/DefenseResultPublicationModal';
import PublicationHistoryModal from '../admin/PublicationHistoryModal';
import { useCouncilMutation } from '../../queries/councilQueries';
import { invalidateInstituteOperations } from '../../queries/instituteOperationsQueries';
import { queryKeys } from '../../query/queryKeys';

const { Text } = Typography;

const KIND_LABELS = {
    DEFENSE_ELIGIBLE_LIST_PUBLICATION: { text: 'Danh sách đủ điều kiện bảo vệ', color: 'blue' },
    RESULT_PUBLICATION: { text: 'Kết quả bảo vệ chính thức', color: 'cyan' },
};

const STATUS_LABELS = {
    READY_TO_PUBLISH: { text: 'Sẵn sàng công bố', color: 'gold' },
    RUBRIC_NOT_LOCKED: { text: 'Chưa khóa tiêu chí chấm', color: 'default' },
    APPROVED_PENDING_PUBLICATION: { text: 'Chờ công bố', color: 'gold' },
    EVIDENCE_STALE: { text: 'Minh chứng chưa đồng bộ', color: 'red' },
    PUBLISHED: { text: 'Đã công bố', color: 'green' },
};

export default function PublicationQueue({
    scope,
    semesterId,
    semesterName,
    items = [],
    loading = false,
    pagination,
    onPageChange,
    selectedKind,
    selectedResourceId,
    canViewPublications = false,
    canPublishResults = false,
}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const councilMutation = useCouncilMutation(scope, semesterId);

    const [publicationModalOpen, setPublicationModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [publishingEligible, setPublishingEligible] = useState(false);

    const refreshPublishCaches = async () => {
        await Promise.all([
            invalidateInstituteOperations(queryClient, scope),
            queryClient.invalidateQueries({ queryKey: queryKeys.councils.lists(scope) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.grading.all(scope) }),
        ]);
    };

    const handlePublishEligibleList = async () => {
        if (!semesterId) return;
        try {
            setPublishingEligible(true);
            await councilMutation.mutateAsync({
                action: 'publishEligibleDefenseList',
                args: [semesterId],
            });
            message.success('Đã công bố danh sách sinh viên đủ điều kiện bảo vệ');
            await refreshPublishCaches();
        } catch (error) {
            message.error(error?.message || 'Không thể công bố danh sách đủ điều kiện');
        } finally {
            setPublishingEligible(false);
        }
    };

    const columns = [
        {
            title: 'Loại công bố',
            dataIndex: 'kind',
            key: 'kind',
            width: 230,
            render: (kind) => {
                const cfg = KIND_LABELS[kind] || { text: kind, color: 'default' };
                return <Tag color={cfg.color}>{cfg.text}</Tag>;
            },
        },
        {
            title: 'Nội dung',
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
            title: 'Thời điểm',
            key: 'time',
            width: 170,
            render: (_, record) => {
                const ts = record.publishedAt || record.approvedAt;
                if (!ts) return <Text type="secondary">—</Text>;
                const parsed = dayjs(ts);
                return <Text>{parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : ts}</Text>;
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 190,
            render: (status) => {
                const cfg = STATUS_LABELS[status] || { text: status, color: 'default' };
                return <Tag color={cfg.color}>{cfg.text}</Tag>;
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 240,
            render: (_, record) => {
                const actions = Array.isArray(record.allowedActions) ? record.allowedActions : [];
                if (actions.length === 0) {
                    if (record.kind === 'RESULT_PUBLICATION' && canViewPublications) {
                        return (
                            <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => setPublicationModalOpen(true)}
                            >
                                Xem trước công bố
                            </Button>
                        );
                    }
                    return <Text type="secondary">Chỉ xem</Text>;
                }

                return (
                    <Space wrap size="small">
                        {record.kind === 'DEFENSE_ELIGIBLE_LIST_PUBLICATION' &&
                            actions.includes('PUBLISH_DEFENSE_ELIGIBLE_LIST') && (
                                <Popconfirm
                                    title="Công bố danh sách sinh viên đủ điều kiện bảo vệ?"
                                    okText="Công bố"
                                    cancelText="Hủy"
                                    onConfirm={handlePublishEligibleList}
                                >
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<CheckCircleOutlined />}
                                        loading={publishingEligible}
                                    >
                                        Công bố DS đủ ĐK
                                    </Button>
                                </Popconfirm>
                            )}

                        {record.kind === 'RESULT_PUBLICATION' &&
                            actions.includes('PUBLISH_DEFENSE_RESULTS') && (
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<SendOutlined />}
                                    onClick={() => setPublicationModalOpen(true)}
                                >
                                    Công bố kết quả
                                </Button>
                            )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">
            {canViewPublications && (
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        icon={<HistoryOutlined />}
                        onClick={() => setHistoryModalOpen(true)}
                    >
                        Lịch sử công bố
                    </Button>
                    <Button
                        type={canPublishResults ? 'primary' : 'default'}
                        icon={canPublishResults ? <SendOutlined /> : <EyeOutlined />}
                        onClick={() => navigate('/admin/grading?tab=publish')}
                    >
                        {canPublishResults ? 'Mở bảng công bố kết quả' : 'Xem trước công bố'}
                    </Button>
                </div>
            )}

            <Table
                rowKey="id"
                columns={columns}
                dataSource={items}
                loading={loading}
                locale={{ emptyText: 'Không có hồ sơ nào cần xử lý trong hàng đợi.' }}
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

            <DefenseResultPublicationModal
                open={publicationModalOpen}
                onClose={() => setPublicationModalOpen(false)}
                semesterId={semesterId}
                semesterName={semesterName}
                onSuccess={refreshPublishCaches}
            />

            <PublicationHistoryModal
                open={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                semesterId={semesterId}
                semesterName={semesterName}
            />
        </div>
    );
}
