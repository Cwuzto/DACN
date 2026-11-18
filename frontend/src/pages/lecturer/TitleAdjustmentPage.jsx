import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message, Tag, Button, Modal, Input, Descriptions, Alert, Space } from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    FileDoneOutlined,
    CloseCircleOutlined,
    SearchOutlined,
    HistoryOutlined,
    ArrowLeftOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileProtectOutlined,
    PrinterOutlined,
} from '@ant-design/icons';
import bm02aService from '../../services/bm02aService';
import RegistrationTimelineDrawer from '../../components/common/RegistrationTimelineDrawer';
import BM02APrintSheet from '../../components/prints/BM02APrintSheet';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useBm02aQueue, useBm02aMutation, bm02aKeys } from '../../queries/bm02aQueries';
import { requireSuccess } from '../../queries/semesterQueries';
import { getEffectivePermissions } from '../../auth/policyEvaluator';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import EmptyState from '../../components/common/EmptyState';

const { TextArea } = Input;

const BM02A_STATUS_CONFIG = {
    STUDENT_PREPARING: { label: 'Sinh viên đang soạn', color: 'default' },
    PENDING_ADVISOR: { label: 'Chờ GVHD ký xác nhận', color: 'processing' },
    RETURNED_FOR_CORRECTION: { label: 'Trả lại chỉnh sửa', color: 'warning' },
    RETURNED_FOR_REVISION: { label: 'Trả lại chỉnh sửa', color: 'warning' },
    PENDING_DEPARTMENT_APPROVAL: { label: 'Chờ Phụ trách bộ môn duyệt', color: 'purple' },
    APPROVED_PENDING_APPENDIX: { label: 'Đã duyệt (chờ lập phụ lục)', color: 'blue' },
    APPROVED: { label: 'Đã duyệt (chờ lập phụ lục)', color: 'blue' },
    ASSIGNED_TO_APPENDIX: { label: 'Đã đưa vào dự thảo phụ lục', color: 'cyan' },
    ADJUSTMENT_ISSUED: { label: 'Đã ban hành phụ lục', color: 'success' },
    REJECTED_FINAL: { label: 'Từ chối', color: 'error' },
    REJECTED: { label: 'Từ chối', color: 'error' },
    EXPIRED: { label: 'Hết hạn', color: 'default' },
};

const getBm02aStatusTag = (status) => {
    return BM02A_STATUS_CONFIG[status] || { label: status || 'Không xác định', color: 'default' };
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('vi-VN');
};

/**
 * TitleAdjustmentPage
 * Trang xử lý phiếu điều chỉnh tên đề tài BM02-A (/lecturer/title-adjustments?requestId=<id>)
 * - Hiển thị hàng đợi phiếu BM02-A theo phạm vi quyền của actor
 * - Hỗ trợ deep link trực tiếp tới 1 phiếu cụ thể qua ?requestId=<id>
 */
export default function TitleAdjustmentPage() {
    const { user: currentUser } = useAuthStore();
    const scope = queryKeys.scope(currentUser);
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const rawRequestId = searchParams.get('requestId');
    const parsedRequestId = rawRequestId ? Number(rawRequestId) : null;
    const hasValidRequestId = Boolean(parsedRequestId && Number.isInteger(parsedRequestId) && parsedRequestId > 0);

    const effectivePerms = useMemo(() => getEffectivePermissions(currentUser), [currentUser]);
    const canAdvisorSign = effectivePerms.has('BM02A_ADVISOR_SIGN');
    const canDepartmentApprove = effectivePerms.has('BM02A_FINAL_APPROVE');
    const canIssueAppendix = effectivePerms.has('TITLE_ADJUSTMENT_APPENDIX_ISSUE');
    const [printSheetRequest, setPrintSheetRequest] = useState(null);

    const bm02aQueueQuery = useBm02aQueue(scope);
    const bm02aRequests = bm02aQueueQuery.data || [];

    const detailQueryKey = useMemo(
        () => [...scope, 'bm02a', 'detail', parsedRequestId],
        [scope, parsedRequestId],
    );

    const detailQuery = useQuery({
        queryKey: detailQueryKey,
        queryFn: async () => requireSuccess(await bm02aService.getRequestById(parsedRequestId)).data,
        enabled: hasValidRequestId,
    });

    const bm02aMutation = useBm02aMutation(scope);

    // Return Modal State
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [returningRequest, setReturningRequest] = useState(null);
    const [returningRole, setReturningRole] = useState('ADVISOR');
    const [returnReason, setReturnReason] = useState('');
    const [submittingBm02a, setSubmittingBm02a] = useState(false);

    // Registration Timeline Drawer State
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineRegistration, setTimelineRegistration] = useState(null);

    const handleSelectRequest = (reqId) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('requestId', String(reqId));
        setSearchParams(nextParams);
    };

    const handleClearSelection = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('requestId');
        setSearchParams(nextParams);
    };

    const refreshBm02aData = async (requestId) => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: bm02aKeys.queue(scope) }),
            requestId
                ? queryClient.invalidateQueries({ queryKey: [...scope, 'bm02a', 'detail', requestId] })
                : Promise.resolve(),
        ]);
    };

    const handleAdvisorSign = async (request) => {
        try {
            setSubmittingBm02a(true);
            const currentVersion = request.versions?.find((v) => v.versionNumber === request.currentVersionNumber)
                || request.versions?.[0];
            const payloadHash = currentVersion?.payloadHash;

            await bm02aMutation.mutateAsync({
                action: 'advisorSign',
                args: [request.id, {
                    payloadHash,
                    signatureImageId: null,
                }],
            });
            await refreshBm02aData(request.id);
            message.success('GVHD đã ký duyệt xác nhận đơn điều chỉnh tên BM02-A thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi GVHD ký duyệt đơn BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const handleDepartmentSign = async (request) => {
        try {
            setSubmittingBm02a(true);
            const currentVersion = request.versions?.find((v) => v.versionNumber === request.currentVersionNumber)
                || request.versions?.[0];
            const payloadHash = currentVersion?.payloadHash;

            await bm02aMutation.mutateAsync({
                action: 'departmentSign',
                args: [request.id, {
                    payloadHash,
                    signatureImageId: null,
                }],
            });
            await refreshBm02aData(request.id);
            message.success('Phụ trách bộ môn đã phê duyệt và ký số hoàn tất đơn BM02-A!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi Phụ trách bộ môn ký duyệt đơn BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const handleCreateAppendix = async (request) => {
        try {
            setSubmittingBm02a(true);
            const decisionId = request.decisionId || request.registration?.assignmentDecisions?.[0]?.id;
            await bm02aMutation.mutateAsync({
                action: 'createAppendix',
                args: [{
                    decisionId,
                    appendixNumber: `PL-${request.id}`,
                    bm02aRequestIds: [request.id],
                    signedDate: new Date().toISOString(),
                }],
            });
            await refreshBm02aData(request.id);
            message.success('Đã lập dự thảo phụ lục điều chỉnh tên đề tài thành công!');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi lập dự thảo phụ lục');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const openReturnModal = (request, role) => {
        setReturningRequest(request);
        setReturningRole(role);
        setReturnReason('');
        setReturnModalOpen(true);
    };

    const handleReturnSubmit = async () => {
        if (!returningRequest) return;
        if (!returnReason.trim()) {
            message.warning('Vui lòng nhập lý do trả lại / từ chối.');
            return;
        }

        try {
            setSubmittingBm02a(true);
            await bm02aMutation.mutateAsync({
                action: 'returnRequest',
                args: [returningRequest.id, {
                    reason: returnReason.trim(),
                    actorRole: returningRole,
                }],
            });
            await refreshBm02aData(returningRequest.id);
            message.success('Đã trả lại yêu cầu điều chỉnh tên đề tài BM02-A.');
            setReturnModalOpen(false);
            setReturningRequest(null);
            setReturnReason('');
        } catch (error) {
            message.error(error?.message || 'Lỗi khi trả lại yêu cầu BM02-A');
        } finally {
            setSubmittingBm02a(false);
        }
    };

    const renderSignatureStatus = (signed, pendingText, unsignedText = 'Chưa ký') => {
        if (signed) {
            return (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                    Đã ký
                </Tag>
            );
        }
        if (pendingText) {
            return (
                <Tag color="processing" icon={<ClockCircleOutlined />}>
                    {pendingText}
                </Tag>
            );
        }
        return <Tag color="default">{unsignedText}</Tag>;
    };

    const renderRequestDetail = (req) => {
        if (!req) {
            return <EmptyState description="Không tìm thấy thông tin phiếu điều chỉnh tên đề tài BM02-A." />;
        }

        const reg = req.registration;
        const student = reg?.student;
        const topic = reg?.topic;
        const currentVersion = req.versions?.find((v) => v.versionNumber === req.currentVersionNumber)
            || req.versions?.[req.versions.length - 1]
            || req.versions?.[0];
        const statusConfig = getBm02aStatusTag(req.status);
        const isPendingAdvisor = req.status === 'PENDING_ADVISOR';
        const isPendingDept = req.status === 'PENDING_DEPARTMENT_APPROVAL';
        const registrationId = req.registrationId || reg?.id;

        return (
            <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ padding: '18px 20px' }}>
                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}
                        className="flex-wrap gap-3"
                    >
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
                                Phiếu BM02-A #{req.id} — {student?.fullName || 'Sinh viên'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                                MSSV: <span className="mono">{student?.code || '-'}</span>
                                {' · '}
                                GVHD: <strong>{topic?.mentor?.fullName || 'Chưa phân công'}</strong>
                            </div>
                        </div>
                        <Space wrap>
                            <Tag color={req.currentVersionNumber === 2 ? 'volcano' : 'blue'}>
                                Phiên bản v{req.currentVersionNumber || 1}
                            </Tag>
                            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                        </Space>
                    </div>

                    <Descriptions size="small" bordered column={1} className="my-3 bg-slate-50/50">
                        <Descriptions.Item label="Tên đề tài đã giao">
                            <span className="text-slate-700">{currentVersion?.registeredTitleSnapshot || topic?.title || '—'}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Tên đề tài mới xin đổi">
                            <strong className="text-blue-700">{currentVersion?.proposedTitle || '—'}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Lý do điều chỉnh">
                            <span className="text-slate-600 italic">{currentVersion?.reason || '—'}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Hạn điều chỉnh">
                            <span className="mono text-xs">{formatDateTime(req.titleAdjustmentDeadline)}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái chữ ký">
                            <Space wrap size={[8, 8]}>
                                <span>
                                    Sinh viên:{' '}
                                    {renderSignatureStatus(Boolean(currentVersion?.studentSignatureEventId), null)}
                                </span>
                                <span>
                                    GVHD:{' '}
                                    {renderSignatureStatus(
                                        Boolean(currentVersion?.advisorSignatureEventId),
                                        isPendingAdvisor ? 'Đang chờ GVHD ký' : null,
                                    )}
                                </span>
                                <span>
                                    Bộ môn:{' '}
                                    {renderSignatureStatus(
                                        Boolean(currentVersion?.departmentSignatureEventId),
                                        isPendingDept ? 'Đang chờ Bộ môn duyệt' : null,
                                    )}
                                </span>
                            </Space>
                        </Descriptions.Item>
                        {currentVersion?.returnReason && (
                            <Descriptions.Item label="Thông tin trả lại">
                                <div className="text-rose-700 text-xs">
                                    <strong>{currentVersion.returnedByRole || 'Người duyệt'}:</strong> {currentVersion.returnReason}
                                    {currentVersion.returnedAt ? ` (${formatDateTime(currentVersion.returnedAt)})` : ''}
                                </div>
                            </Descriptions.Item>
                        )}
                    </Descriptions>

                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}
                        className="flex-wrap gap-2"
                    >
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={handleClearSelection}
                            className="lg:hidden"
                        >
                            Danh sách phiếu
                        </Button>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginLeft: 'auto' }} className="flex-wrap">
                            {registrationId && (
                                <Button
                                    icon={<HistoryOutlined />}
                                    onClick={() => {
                                        setTimelineRegistration({
                                            id: registrationId,
                                            topic,
                                            student,
                                        });
                                        setTimelineOpen(true);
                                    }}
                                >
                                    Lịch sử tiến trình
                                </Button>
                            )}

                            {isPendingAdvisor && canAdvisorSign && (
                                <>
                                    <Button
                                        danger
                                        icon={<CloseCircleOutlined />}
                                        disabled={submittingBm02a}
                                        onClick={() => openReturnModal(req, 'ADVISOR')}
                                    >
                                        Trả lại chỉnh sửa
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<FileDoneOutlined />}
                                        loading={submittingBm02a}
                                        className="!bg-[#0052a3]"
                                        onClick={() => handleAdvisorSign(req)}
                                    >
                                        Ký xác nhận
                                    </Button>
                                </>
                            )}

                            {isPendingDept && canDepartmentApprove && (
                                <>
                                    <Button
                                        danger
                                        icon={<CloseCircleOutlined />}
                                        disabled={submittingBm02a}
                                        onClick={() => openReturnModal(req, 'DEPARTMENT_HEAD')}
                                    >
                                        Từ chối phê duyệt
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<FileDoneOutlined />}
                                        loading={submittingBm02a}
                                        className="!bg-purple-600 hover:!bg-purple-700"
                                        onClick={() => handleDepartmentSign(req)}
                                    >
                                        Phê duyệt và ký số
                                    </Button>
                                </>
                            )}

                            {req.status === 'APPROVED_PENDING_APPENDIX' && canIssueAppendix && (
                                <Button
                                    type="primary"
                                    icon={<FileProtectOutlined />}
                                    loading={submittingBm02a}
                                    onClick={() => handleCreateAppendix(req)}
                                >
                                    Lập dự thảo phụ lục
                                </Button>
                            )}

                            <Button
                                icon={<PrinterOutlined />}
                                onClick={() => setPrintSheetRequest(req)}
                            >
                                Xem biểu mẫu in
                            </Button>

                            {req.finalPdfFileUrl && (
                                <Button
                                    icon={<SearchOutlined />}
                                    href={req.finalPdfFileUrl}
                                    target="_blank"
                                >
                                    Xem bản PDF đã duyệt
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (bm02aQueueQuery.isPending && !bm02aQueueQuery.data && !hasValidRequestId) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-title-adjustments" className="view-pane active" style={{ display: 'block' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="flex-wrap gap-3">
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }} className="font-display text-slate-900">
                        Xử lý điều chỉnh tên đề tài (BM02-A)
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        Xem xét, ký xác nhận và phê duyệt các phiếu đề nghị điều chỉnh tên đề tài theo quy trình 3 chữ ký.
                    </p>
                </div>
                <span className="tag teal" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Hàng đợi xử lý: {bm02aRequests.length} phiếu
                </span>
            </div>

            <div
                style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 'var(--radius)', border: '1px solid #BBF7D0', fontSize: 13, color: '#166534', marginBottom: 18 }}
            >
                <strong>Quy trình ký duyệt BM02-A:</strong> Sau khi sinh viên ký nộp, GVHD ký xác nhận, tiếp đó Phụ trách bộ môn phê duyệt và ký số để hoàn tất hồ sơ đưa vào Phụ lục điều chỉnh.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Danh sách phiếu BM02-A */}
                <div className="lg:col-span-5">
                    <QueryPanel
                        query={bm02aQueueQuery}
                        empty={bm02aRequests.length === 0}
                        emptyDescription="Hiện không có phiếu điều chỉnh tên đề tài BM02-A nào trong hàng đợi."
                        variant="list"
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {bm02aRequests.map((req) => {
                                const student = req.registration?.student;
                                const currentVersion = req.versions?.find((v) => v.versionNumber === req.currentVersionNumber)
                                    || req.versions?.[0];
                                const isSelected = hasValidRequestId && req.id === parsedRequestId;
                                const statusConfig = getBm02aStatusTag(req.status);

                                return (
                                    <button
                                        key={req.id}
                                        type="button"
                                        onClick={() => handleSelectRequest(req.id)}
                                        className="card text-left w-full transition-colors"
                                        style={{
                                            marginBottom: 0,
                                            padding: '14px 16px',
                                            cursor: 'pointer',
                                            borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                                            background: isSelected ? '#F0FDFA' : '#FFFFFF',
                                            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>
                                                    #{req.id} · {student?.fullName || 'Sinh viên'}
                                                </div>
                                                <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                                                    MSSV: {student?.code || '-'}
                                                </div>
                                            </div>
                                            <Tag color={statusConfig.color} style={{ marginInlineEnd: 0 }}>
                                                {statusConfig.label}
                                            </Tag>
                                        </div>
                                        <div
                                            style={{ fontSize: 12.5, color: '#1E40AF', fontWeight: 600, marginTop: 8 }}
                                            className="line-clamp-2"
                                        >
                                            {currentVersion?.proposedTitle || 'Chưa có tên đề tài đề xuất'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </QueryPanel>
                </div>

                {/* Chi tiết phiếu đang chọn */}
                <div className="lg:col-span-7">
                    {hasValidRequestId ? (
                        <QueryPanel
                            query={detailQuery}
                            empty={!detailQuery.data}
                            emptyDescription="Không tìm thấy phiếu điều chỉnh tên đề tài BM02-A."
                        >
                            {renderRequestDetail(detailQuery.data)}
                        </QueryPanel>
                    ) : (
                        <div className="card" style={{ padding: '36px 20px', marginBottom: 0 }}>
                            <EmptyState
                                description={
                                    bm02aRequests.length > 0
                                        ? 'Chọn một phiếu BM02-A từ danh sách bên trái để xem chi tiết và thực hiện ký duyệt.'
                                        : 'Không có phiếu BM02-A nào cần xử lý.'
                                }
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: TRẢ LẠI / TỪ CHỐI PHIẾU BM02-A */}
            <Modal
                title={returningRole === 'DEPARTMENT_HEAD' ? 'Từ chối phê duyệt phiếu BM02-A' : 'Trả lại yêu cầu chỉnh sửa BM02-A'}
                open={returnModalOpen}
                onCancel={() => setReturnModalOpen(false)}
                footer={[
                    <Button key="cancel" icon={<CloseOutlined />} onClick={() => setReturnModalOpen(false)}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        danger
                        loading={submittingBm02a}
                        icon={<CheckOutlined />}
                        onClick={handleReturnSubmit}
                    >
                        Xác nhận trả lại
                    </Button>,
                ]}
            >
                <div className="space-y-3 pt-2">
                    <Alert
                        type="warning"
                        showIcon
                        message="Lưu ý quy định trả lại BM02-A"
                        description={
                            returningRole === 'ADVISOR'
                                ? 'Nếu đây là phiên bản v1 và còn trong hạn 168 giờ, sinh viên sẽ được nộp lại bản sửa v2 duy nhất 01 lần.'
                                : 'Phụ trách bộ môn trả lại sẽ chuyển hồ sơ sang trạng thái từ chối hoặc yêu cầu sửa theo quy định.'
                        }
                    />
                    <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Lý do trả lại / yêu cầu chỉnh sửa:
                        </label>
                        <TextArea
                            rows={3}
                            placeholder="Nêu rõ lý do và nội dung cần điều chỉnh..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            <RegistrationTimelineDrawer
                open={timelineOpen}
                onClose={() => {
                    setTimelineOpen(false);
                    setTimelineRegistration(null);
                }}
                registrationId={timelineRegistration?.id}
                topicTitle={timelineRegistration?.topic?.title}
                studentName={timelineRegistration?.student?.fullName}
                studentCode={timelineRegistration?.student?.code}
            />

            {/* MODAL: XEM PHIẾU IN BM02-A */}
            <Modal
                title="Bản in Phiếu Đề Nghị Điều Chỉnh Tên Đề Tài (BM02-A)"
                open={Boolean(printSheetRequest)}
                onCancel={() => setPrintSheetRequest(null)}
                width={850}
                footer={[
                    <Button key="close" onClick={() => setPrintSheetRequest(null)}>
                        Đóng
                    </Button>,
                ]}
            >
                {printSheetRequest && (
                    <div className="overflow-auto max-h-[75vh] p-4 bg-slate-100/60 rounded">
                        <BM02APrintSheet adjustment={printSheetRequest} />
                    </div>
                )}
            </Modal>
        </section>
    );
}
