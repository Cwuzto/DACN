import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Card,
    Tabs,
    Select,
    Space,
    Button,
    Badge,
    Empty,
    Typography,
    Result,
    Tag,
    Spin,
    message,
} from 'antd';
import {
    AuditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileDoneOutlined,
    NotificationOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { getEffectivePermissions } from '../../auth/policyEvaluator';
import { useSemesters } from '../../queries/semesterQueries';
import { useInstituteOperations } from '../../queries/instituteOperationsQueries';
import { useBm02DepartmentSignMutation, useBm02Verification } from '../../queries/bm02VerificationQueries';
import ReviewQueue from '../../components/institute/ReviewQueue';
import DecisionQueue from '../../components/institute/DecisionQueue';
import PublicationQueue from '../../components/institute/PublicationQueue';
import AcademicDelegationDrawer from '../../components/institute/AcademicDelegationDrawer';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import QueryErrorState from '../../components/common/QueryErrorState';

const { Title, Text } = Typography;

export const TAB_CAPABILITIES = {
    review: [
        'VIEW_BM02_REVIEWS',
        'BM02_REVIEW',
        'BM02_DEPARTMENT_SIGN',
        'VIEW_CHECKPOINTS',
        'BM03_STOP_REVIEW',
        'BM04_REVIEW',
        'VIEW_BM04_EVALUATIONS',
        'BM04_REJECTION_REVIEW',
        'SIGNATURE_APPEAL_REVIEW',
    ],
    decisions: [
        'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'PROJECT_ASSIGNMENT_PUBLISH',
        'TOPIC_ASSIGNMENT_DECISION_ISSUE',
        'BM02A_FINAL_APPROVE',
        'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
        'VIEW_CLEARANCE_CERTIFICATES',
        'CLEARANCE_CERTIFICATE_SIGN',
        'VIEW_DEFENSE_RESULTS_APPROVAL',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_RESULT_APPROVE',
    ],
    publish: [
        'VIEW_DEFENSE_ASSIGNMENTS',
        'VIEW_COUNCIL_ASSIGNMENTS',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_RESULT_PUBLICATIONS',
        'RESULT_PUBLICATION_PUBLISH',
    ],
};

const LEGACY_TAB_MAP = {
    bm02: 'review',
    bm02Queue: 'review',
    review: 'review',
    periods: 'decisions',
    decisions: 'decisions',
    publish: 'publish',
};

const STATUS_FILTER_OPTIONS = {
    review: [
        { value: 'ALL', label: 'Tất cả trạng thái' },
        { value: 'PENDING_REVIEW', label: 'Chờ thẩm định' },
        { value: 'EXCEPTION_REVIEW', label: 'Chờ ngoại lệ' },
        { value: 'STOP_REVIEW_PENDING', label: 'Chờ quyết định dừng' },
        { value: 'MORE_INFO_REQUIRED', label: 'Chờ bổ sung thông tin' },
        { value: 'SUBMITTED', label: 'Đã nộp khiếu nại' },
    ],
    decisions: [
        { value: 'ALL', label: 'Tất cả trạng thái' },
        { value: 'BM02_APPROVED', label: 'Chờ lập QĐ' },
        { value: 'DRAFT', label: 'Dự thảo' },
        { value: 'PENDING_DEPARTMENT_APPROVAL', label: 'Chờ duyệt BM02-A' },
        { value: 'APPROVED_PENDING_APPENDIX', label: 'Chờ lập phụ lục' },
        { value: 'AWAITING_FINAL_APPROVAL', label: 'Chờ phê duyệt kết quả' },
    ],
    publish: [
        { value: 'ALL', label: 'Tất cả trạng thái' },
        { value: 'READY_TO_PUBLISH', label: 'Sẵn sàng công bố' },
        { value: 'APPROVED_PENDING_PUBLICATION', label: 'Chờ công bố' },
        { value: 'PUBLISHED', label: 'Đã công bố' },
    ],
};

export function resolveMappedTab(rawTab) {
    if (!rawTab) return null;
    if (rawTab === 'delegations') return 'decisions';
    return LEGACY_TAB_MAP[rawTab] || null;
}

function Bm02DepartmentSignRow({ item, scope, departmentSignMutation }) {
    const verificationQuery = useBm02Verification(scope, item.resourceId, Boolean(item.resourceId));
    const verification = verificationQuery.data || null;

    const handleDepartmentSign = async () => {
        if (!item.resourceId) return;
        try {
            await departmentSignMutation.mutateAsync({
                submissionId: item.resourceId,
                expectedPayloadHash: verification?.payloadHash || null,
            });
            message.success('Phụ trách bộ môn đã ký xác nhận đơn BM02.');
        } catch (error) {
            message.error(error?.message || 'Không thể ký xác nhận bộ môn.');
        }
    };

    const renderStepTag = (label, step) => {
        if (step?.valid === true) {
            return (
                <Tag color="success" icon={<CheckCircleOutlined />} className="m-0 text-xs">
                    {label}: Đã xác thực nội bộ
                </Tag>
            );
        }
        return (
            <Tag color="default" icon={<ClockCircleOutlined />} className="m-0 text-xs">
                {label}: Chờ xác nhận
            </Tag>
        );
    };

    const canSignNow = Boolean(
        verification?.student?.valid
        && verification?.advisor?.valid
        && !verification?.department?.valid,
    );

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                        {item.title}
                    </span>
                    {item.department && (
                        <Tag color="blue" className="m-0 text-xs">
                            {item.department}
                        </Tag>
                    )}
                </div>
                {item.subtitle && (
                    <p className="text-xs text-slate-600 m-0 break-words">{item.subtitle}</p>
                )}
                {verificationQuery.isPending ? (
                    <Spin size="small" />
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {renderStepTag('Sinh viên', verification?.student)}
                        {renderStepTag('GVHD', verification?.advisor)}
                        {renderStepTag('Bộ môn', verification?.department)}
                    </div>
                )}
            </div>
            <div className="shrink-0">
                {canSignNow ? (
                    <Button
                        type="primary"
                        size="small"
                        icon={<SafetyCertificateOutlined />}
                        loading={departmentSignMutation.isPending}
                        onClick={handleDepartmentSign}
                    >
                        Ký xác nhận Bộ môn
                    </Button>
                ) : verification?.department?.valid ? (
                    <Tag color="teal" icon={<CheckCircleOutlined />} className="m-0">
                        Bộ môn đã ký
                    </Tag>
                ) : null}
            </div>
        </div>
    );
}

export default function InstituteOperationsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const semestersQuery = useSemesters(scope);
    const semesters = useMemo(
        () => (Array.isArray(semestersQuery.data) ? semestersQuery.data : []),
        [semestersQuery.data]
    );

    const urlSemesterId = searchParams.get('semesterId');
    const [selectedSemesterId, setSelectedSemesterId] = useState(() =>
        urlSemesterId ? Number(urlSemesterId) : null
    );

    useEffect(() => {
        if (urlSemesterId) {
            const parsed = Number(urlSemesterId);
            if (!Number.isNaN(parsed) && parsed !== selectedSemesterId) {
                setSelectedSemesterId(parsed);
            }
        } else if (semesters.length > 0 && !selectedSemesterId) {
            const active = semesters.find((s) => s.status === 'ACTIVE') || semesters[0];
            if (active?.id) {
                setSelectedSemesterId(active.id);
            }
        }
    }, [urlSemesterId, semesters, selectedSemesterId]);

    const effectivePermissions = useMemo(
        () => getEffectivePermissions(user, { semesterId: selectedSemesterId || undefined }),
        [user, selectedSemesterId]
    );

    const allowedTabs = useMemo(() => {
        return ['review', 'decisions', 'publish'].filter((tab) =>
            TAB_CAPABILITIES[tab].some((cap) => effectivePermissions.has(cap))
        );
    }, [effectivePermissions]);

    const canViewDelegations =
        effectivePermissions.has('VIEW_ACADEMIC_DELEGATIONS') ||
        effectivePermissions.has('PERMISSION_ASSIGN_ACADEMIC');
    const canAssignDelegations = effectivePermissions.has('PERMISSION_ASSIGN_ACADEMIC');
    const canPublishResults = effectivePermissions.has('RESULT_PUBLICATION_PUBLISH');
    const canViewPublications =
        canPublishResults || effectivePermissions.has('VIEW_RESULT_PUBLICATIONS');

    const rawTabParam = searchParams.get('tab');
    const mappedTab = resolveMappedTab(rawTabParam);
    const activeTab = useMemo(() => {
        if (mappedTab && allowedTabs.includes(mappedTab)) {
            return mappedTab;
        }
        return allowedTabs[0] || null;
    }, [mappedTab, allowedTabs]);

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [delegationsDrawerOpen, setDelegationsDrawerOpen] = useState(
        rawTabParam === 'delegations' && canViewDelegations
    );

    useEffect(() => {
        if (rawTabParam === 'delegations' && canViewDelegations) {
            setDelegationsDrawerOpen(true);
        } else if (rawTabParam !== 'delegations') {
            setDelegationsDrawerOpen(false);
        }
    }, [rawTabParam, canViewDelegations]);

    const selectedKind = searchParams.get('kind') || null;
    const selectedResourceId = searchParams.get('resourceId') || searchParams.get('registrationId') || null;

    const operationsQuery = useInstituteOperations(
        scope,
        {
            tab: activeTab || 'review',
            semesterId: selectedSemesterId,
            status: statusFilter,
            page,
            pageSize: 20,
        },
        {
            enabled:
                Boolean(activeTab) &&
                (Boolean(selectedSemesterId) || (semestersQuery.isFetched && semesters.length === 0)),
        }
    );

    const handleTabChange = (nextTab) => {
        if (!allowedTabs.includes(nextTab)) return;
        setStatusFilter('ALL');
        setPage(1);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', nextTab);
        nextParams.delete('kind');
        nextParams.delete('resourceId');
        setSearchParams(nextParams);
    };

    const handleSemesterChange = (nextSemesterId) => {
        setSelectedSemesterId(nextSemesterId);
        setStatusFilter('ALL');
        setPage(1);
        const nextParams = new URLSearchParams(searchParams);
        if (nextSemesterId) {
            nextParams.set('semesterId', String(nextSemesterId));
        } else {
            nextParams.delete('semesterId');
        }
        setSearchParams(nextParams);
    };

    const handleOpenDelegations = () => {
        if (!canViewDelegations) return;
        setDelegationsDrawerOpen(true);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', 'delegations');
        setSearchParams(nextParams);
    };

    const handleCloseDelegations = () => {
        setDelegationsDrawerOpen(false);
        if (searchParams.get('tab') === 'delegations') {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('tab', activeTab || 'decisions');
            setSearchParams(nextParams);
        }
    };

    const queueData = operationsQuery.data;
    const items = Array.isArray(queueData?.items) ? queueData.items : [];
    const counts = queueData?.counts || { review: 0, decisions: 0, publish: 0 };
    const pagination = queueData?.pagination || null;
    const currentSemester = semesters.find((s) => s.id === (queueData?.semester?.id || selectedSemesterId));
    const canDepartmentSignBm02 = effectivePermissions.has('BM02_DEPARTMENT_SIGN');
    const departmentSignMutation = useBm02DepartmentSignMutation(scope);
    const bm02ReviewItems = useMemo(
        () => (Array.isArray(queueData?.items) ? queueData.items.filter((item) => item.kind === 'BM02_REVIEW') : []),
        [queueData],
    );

    if (allowedTabs.length === 0) {
        return (
            <Result
                status="403"
                title="Không có quyền truy cập"
                subTitle="Bạn chưa được cấp quyền thao tác trên Trung tâm Điều hành học vụ."
            />
        );
    }

    const tabItems = [
        allowedTabs.includes('review') && {
            key: 'review',
            label: (
                <Space size={6}>
                    <AuditOutlined />
                    <span>Thẩm định</span>
                    <Badge count={counts.review} showZero color="#0f766e" />
                </Space>
            ),
        },
        allowedTabs.includes('decisions') && {
            key: 'decisions',
            label: (
                <Space size={6}>
                    <FileDoneOutlined />
                    <span>Quyết định</span>
                    <Badge count={counts.decisions} showZero color="#0284c7" />
                </Space>
            ),
        },
        allowedTabs.includes('publish') && {
            key: 'publish',
            label: (
                <Space size={6}>
                    <NotificationOutlined />
                    <span>Công bố</span>
                    <Badge count={counts.publish} showZero color="#7c3aed" />
                </Space>
            ),
        },
    ].filter(Boolean);

    const renderQueueBody = () => {
        if (operationsQuery.isPending) {
            return <ContentSkeleton variant="table" rows={5} />;
        }
        if (operationsQuery.isError) {
            return (
                <QueryErrorState
                    error={operationsQuery.error}
                    onRetry={() => operationsQuery.refetch()}
                    retrying={operationsQuery.isFetching}
                />
            );
        }
        if (items.length === 0) {
            return (
                <div className="py-10">
                    <Empty description="Không có hồ sơ nào cần xử lý trong hàng đợi." />
                </div>
            );
        }

        if (activeTab === 'review') {
            return (
                <ReviewQueue
                    scope={scope}
                    items={items}
                    loading={operationsQuery.isFetching}
                    pagination={pagination}
                    onPageChange={setPage}
                    selectedKind={selectedKind}
                    selectedResourceId={selectedResourceId}
                />
            );
        }

        if (activeTab === 'decisions') {
            return (
                <DecisionQueue
                    scope={scope}
                    semesterId={queueData?.semester?.id || selectedSemesterId}
                    items={items}
                    loading={operationsQuery.isFetching}
                    pagination={pagination}
                    onPageChange={setPage}
                    selectedKind={selectedKind}
                    selectedResourceId={selectedResourceId}
                />
            );
        }

        return (
            <PublicationQueue
                scope={scope}
                semesterId={queueData?.semester?.id || selectedSemesterId}
                semesterName={currentSemester?.name || queueData?.semester?.name}
                items={items}
                loading={operationsQuery.isFetching}
                pagination={pagination}
                onPageChange={setPage}
                selectedKind={selectedKind}
                selectedResourceId={selectedResourceId}
                canViewPublications={canViewPublications}
                canPublishResults={canPublishResults}
            />
        );
    };

    return (
        <div className="space-y-4">
            <Card>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Title level={3} className="!mb-1">
                            Điều hành học vụ
                        </Title>
                        <Space wrap size={12}>
                            <Text type="secondary">
                                Đợt đang xem: {currentSemester?.name || queueData?.semester?.name || 'Đang tải...'}
                            </Text>
                            {queueData?.generatedAt && (
                                <Text type="secondary">
                                    Cập nhật lúc {dayjs(queueData.generatedAt).format('HH:mm:ss DD/MM/YYYY')}
                                </Text>
                            )}
                        </Space>
                    </div>

                    <Space wrap>
                        <Select
                            aria-label="Chọn học kỳ"
                            style={{ minWidth: 220 }}
                            value={selectedSemesterId || undefined}
                            placeholder="Chọn học kỳ"
                            loading={semestersQuery.isPending}
                            onChange={handleSemesterChange}
                            options={semesters.map((s) => ({
                                value: s.id,
                                label: s.name || s.code,
                            }))}
                        />
                        <Select
                            aria-label="Lọc trạng thái"
                            style={{ minWidth: 190 }}
                            value={statusFilter}
                            onChange={(val) => {
                                setStatusFilter(val);
                                setPage(1);
                            }}
                            options={STATUS_FILTER_OPTIONS[activeTab] || STATUS_FILTER_OPTIONS.review}
                        />
                        {canViewDelegations && (
                            <Button
                                icon={<TeamOutlined />}
                                onClick={handleOpenDelegations}
                            >
                                Ủy quyền chuyên môn
                            </Button>
                        )}
                        <Button
                            icon={<ReloadOutlined />}
                            loading={operationsQuery.isFetching}
                            onClick={() => operationsQuery.refetch()}
                        >
                            Làm mới
                        </Button>
                    </Space>
                </div>
            </Card>

            <Card>
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={tabItems}
                />
                {renderQueueBody()}
            </Card>

            {activeTab === 'review' && canDepartmentSignBm02 && bm02ReviewItems.length > 0 && (
                <Card>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                            <Title level={5} style={{ margin: 0 }}>
                                Xác nhận BM02 cấp Bộ môn
                            </Title>
                            <Text type="secondary" className="text-xs">
                                Chuỗi xác nhận 3 bước: Sinh viên → GVHD → Phụ trách bộ môn
                            </Text>
                        </div>
                        <Tag color="blue" className="m-0 font-semibold">
                            {bm02ReviewItems.length} hồ sơ
                        </Tag>
                    </div>
                    <div className="space-y-2.5">
                        {bm02ReviewItems.map((item) => (
                            <Bm02DepartmentSignRow
                                key={item.id}
                                item={item}
                                scope={scope}
                                departmentSignMutation={departmentSignMutation}
                            />
                        ))}
                    </div>
                </Card>
            )}

            <AcademicDelegationDrawer
                open={delegationsDrawerOpen}
                onClose={handleCloseDelegations}
                scope={scope}
                semesterId={queueData?.semester?.id || selectedSemesterId}
                canViewDelegations={canViewDelegations}
                canAssignDelegations={canAssignDelegations}
            />
        </div>
    );
}
