import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Alert, message, Steps, Tag, Descriptions, Button, Divider, Spin } from 'antd';
import {
    EditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SendOutlined,
    FileDoneOutlined,
    UserOutlined,
    AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import bm02aService from '../../services/bm02aService';
import useAuthStore from '../../stores/authStore';

const { TextArea } = Input;

export default function TitleAdjustmentModal({
    open,
    onClose,
    onSuccess,
    registration,
    registrationId: propRegId,
    currentTitle: propCurrentTitle,
    decisionDate: propDecisionDate,
    decisionPublishedAt: propDecisionPublishedAt,
}) {
    const { user: currentUser } = useAuthStore();
    const [form] = Form.useForm();
    const [revisionForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [bm02aRequests, setBm02aRequests] = useState([]);

    const regId = registration?.id || propRegId;
    const studentInfo = registration?.student || currentUser || {};
    const studentProfile = studentInfo?.studentProfile || {};

    const publishedAt = registration?.decisionPublishedAt
        || propDecisionPublishedAt
        || registration?.decisionDate
        || propDecisionDate;

    const adjustmentDeadline = useMemo(() => {
        if (!publishedAt) return null;
        return dayjs(publishedAt).add(168, 'hour');
    }, [publishedAt]);

    const isExpired = adjustmentDeadline ? dayjs().isAfter(adjustmentDeadline) : false;

    const remainingHours = adjustmentDeadline
        ? Math.max(0, adjustmentDeadline.diff(dayjs(), 'hour'))
        : null;

    const remainingDays = remainingHours !== null ? Math.floor(remainingHours / 24) : null;
    const remainingHoursMod = remainingHours !== null ? remainingHours % 24 : null;

    const fetchRequests = async () => {
        if (!regId) return;
        try {
            setLoading(true);
            const res = await bm02aService.getRequestsByRegistration(regId);
            if (res.success && Array.isArray(res.data)) {
                setBm02aRequests(res.data);
            }
        } catch {
            // Non-blocking fallback
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && regId) {
            fetchRequests();
            form.resetFields();
            revisionForm.resetFields();
        }
    }, [open, regId]);

    const latestRequest = useMemo(() => {
        if (!bm02aRequests || bm02aRequests.length === 0) return null;
        return bm02aRequests[0];
    }, [bm02aRequests]);

    const currentVersion = useMemo(() => {
        if (!latestRequest || !latestRequest.versions) return null;
        return latestRequest.versions.find((v) => v.versionNumber === latestRequest.currentVersionNumber)
            || latestRequest.versions[0];
    }, [latestRequest]);

    const registeredTitle = registration?.topic?.title
        || propCurrentTitle
        || currentVersion?.registeredTitleSnapshot
        || 'Chưa xác định';

    // 3-signature step status calculation
    const getStepStatus = () => {
        if (!latestRequest) return { current: 0, stuStatus: 'wait', advStatus: 'wait', deptStatus: 'wait' };
        const status = latestRequest.status;

        if (status === 'STUDENT_PREPARING') {
            return { current: 0, stuStatus: 'process', advStatus: 'wait', deptStatus: 'wait' };
        }
        if (status === 'PENDING_ADVISOR') {
            return { current: 1, stuStatus: 'finish', advStatus: 'process', deptStatus: 'wait' };
        }
        if (status === 'RETURNED_FOR_CORRECTION') {
            return { current: 1, stuStatus: 'finish', advStatus: 'error', deptStatus: 'wait' };
        }
        if (status === 'PENDING_DEPARTMENT_APPROVAL') {
            return { current: 2, stuStatus: 'finish', advStatus: 'finish', deptStatus: 'process' };
        }
        if (status === 'REJECTED_FINAL') {
            return { current: 2, stuStatus: 'finish', advStatus: 'finish', deptStatus: 'error' };
        }
        if (['APPROVED_PENDING_APPENDIX', 'ASSIGNED_TO_APPENDIX', 'ADJUSTMENT_ISSUED'].includes(status)) {
            return { current: 3, stuStatus: 'finish', advStatus: 'finish', deptStatus: 'finish' };
        }
        return { current: 0, stuStatus: 'wait', advStatus: 'wait', deptStatus: 'wait' };
    };

    const stepInfo = getStepStatus();

    // Initial submission of BM02-A
    const handleInitialSubmit = async (values) => {
        if (!regId) return;
        try {
            setSubmitting(true);
            const createRes = await bm02aService.createRequest({
                registrationId: regId,
                proposedTitle: values.proposedTitle.trim(),
                reason: values.reason.trim(),
            });

            const createdReq = createRes.data?.request || createRes.data;
            const reqId = createdReq?.id;
            const v1PayloadHash = createRes.data?.version?.payloadHash
                || createdReq?.versions?.[0]?.payloadHash;

            if (createRes.success && reqId) {
                // Student signs and submits
                await bm02aService.studentSignSubmit(reqId, {
                    payloadHash: v1PayloadHash,
                    signatureImageId: null,
                });

                message.success('Đã nộp phiếu đề nghị điều chỉnh tên đề tài BM02-A thành công!');
                form.resetFields();
                await fetchRequests();
                onSuccess?.();
            } else {
                message.error(createRes.message || 'Không thể tạo đơn điều chỉnh.');
            }
        } catch (error) {
            message.error(error.message || 'Đã có lỗi xảy ra khi nộp đơn BM02-A.');
        } finally {
            setSubmitting(false);
        }
    };

    // Revision submission of BM02-A (v2)
    const handleRevisionSubmit = async (values) => {
        if (!latestRequest?.id) return;
        try {
            setSubmitting(true);
            const revRes = await bm02aService.reviseRequest(latestRequest.id, {
                proposedTitle: values.proposedTitle.trim(),
                reason: values.reason.trim(),
            });

            const revisedReq = revRes.data?.request || revRes.data;
            const reqId = revisedReq?.id || latestRequest?.id;
            const v2PayloadHash = revRes.data?.version?.payloadHash
                || revRes.data?.newVersion?.payloadHash
                || revisedReq?.versions?.find((v) => v.versionNumber === 2)?.payloadHash
                || revisedReq?.versions?.[0]?.payloadHash;

            if (revRes.success && reqId) {
                await bm02aService.studentSignSubmit(reqId, {
                    payloadHash: v2PayloadHash,
                    signatureImageId: null,
                });

                message.success('Đã nộp lại phiếu BM02-A phiên bản v2 thành công!');
                revisionForm.resetFields();
                await fetchRequests();
                onSuccess?.();
            } else {
                message.error(revRes.message || 'Không thể nộp lại bản sửa.');
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi nộp lại bản sửa BM02-A.');
        } finally {
            setSubmitting(false);
        }
    };

    const isReturned = latestRequest?.status === 'RETURNED_FOR_CORRECTION';
    const canRevise = isReturned && latestRequest?.revisionCount === 0 && !isExpired;

    return (
        <Modal
            title={(
                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <AuditOutlined className="text-[#0052a3]" />
                    <span>Phiếu đề nghị điều chỉnh tên đề tài (BM02-A)</span>
                </div>
            )}
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width={720}
        >
            <Spin spinning={loading}>
                <div className="space-y-4 pt-2">
                    {/* 168h Countdown Notice */}
                    <Alert
                        showIcon
                        type={isExpired ? 'error' : 'info'}
                        icon={<ClockCircleOutlined />}
                        message={
                            isExpired
                                ? 'Cửa sổ 168 giờ đã kết thúc'
                                : `Cửa sổ điều chỉnh tên (168 giờ): còn ${remainingDays} ngày ${remainingHoursMod} giờ`
                        }
                        description={
                            adjustmentDeadline
                                ? `Thời hạn nộp BM02-A: đến hết ${adjustmentDeadline.format('DD/MM/YYYY HH:mm')}. Phiếu gồm chuỗi 3 chữ ký điện tử nội bộ (Sinh viên -> GVHD -> Phụ trách bộ môn).`
                                : 'Chưa xác định thời điểm công bố Quyết định giao đề tài.'
                        }
                    />

                    {/* Stepper: 3-Signature Process */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs uppercase font-bold text-slate-600">
                                Quy trình 3 chữ ký điện tử nội bộ
                            </span>
                            {latestRequest && (
                                <Tag color={latestRequest.currentVersionNumber === 2 ? 'volcano' : 'blue'}>
                                    Phiên bản v{latestRequest.currentVersionNumber || 1}
                                </Tag>
                            )}
                        </div>
                        <Steps
                            size="small"
                            current={stepInfo.current}
                            items={[
                                { title: 'Sinh viên', description: 'Chữ ký Sinh viên', status: stepInfo.stuStatus },
                                { title: 'GVHD', description: 'Chữ ký GVHD', status: stepInfo.advStatus },
                                { title: 'Phụ trách bộ môn', description: 'Chữ ký Phụ trách bộ môn', status: stepInfo.deptStatus },
                            ]}
                        />
                    </div>

                    {/* Student Snapshot Personal Info */}
                    <Descriptions
                        size="small"
                        bordered
                        column={2}
                        className="bg-white rounded-lg overflow-hidden border border-slate-200"
                    >
                        <Descriptions.Item label="Họ và tên" span={1}>
                            <strong>{studentInfo?.fullName || 'Chưa cập nhật'}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Mã sinh viên" span={1}>
                            <span className="font-mono">{studentInfo?.code || 'Chưa cập nhật'}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Lớp">
                            {studentProfile?.className || studentInfo?.class || 'Chưa cập nhật'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Khóa đào tạo">
                            {studentProfile?.cohort || 'Khóa 2022'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Chuyên ngành" span={2}>
                            {studentProfile?.major || 'Công nghệ thông tin'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Tên đề tài hiện tại" span={2}>
                            <span className="text-slate-800 font-medium">{registeredTitle}</span>
                        </Descriptions.Item>
                    </Descriptions>

                    {/* Case 1: Returned for correction - single revision form */}
                    {isReturned ? (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                            <Alert
                                type="warning"
                                showIcon
                                message="Yêu cầu chỉnh sửa phiếu BM02-A"
                                description={
                                    <div>
                                        <div><strong>Người trả:</strong> {currentVersion?.returnedByRole || 'GVHD'}</div>
                                        <div><strong>Lý do trả lại:</strong> {currentVersion?.returnReason || 'Cần bổ sung/sửa đổi thông tin theo yêu cầu.'}</div>
                                    </div>
                                }
                            />

                            {canRevise ? (
                                <Form
                                    form={revisionForm}
                                    layout="vertical"
                                    onFinish={handleRevisionSubmit}
                                    initialValues={{
                                        proposedTitle: currentVersion?.proposedTitle || '',
                                        reason: currentVersion?.reason || '',
                                    }}
                                >
                                    <div className="text-xs font-semibold text-slate-700 mb-2">
                                        Nộp lại bản sửa đổi v2 (chỉ được nộp lại đúng 01 lần duy nhất):
                                    </div>
                                    <Form.Item
                                        name="proposedTitle"
                                        label="Tên đề tài mới đề xuất (v2)"
                                        rules={[{ required: true, message: 'Vui lòng nhập tên đề tài đề xuất mới.' }]}
                                    >
                                        <Input placeholder="Nhập tên đề tài mới chính xác..." />
                                    </Form.Item>

                                    <Form.Item
                                        name="reason"
                                        label="Lý do điều chỉnh (giải trình tiếp thu)"
                                        rules={[{ required: true, message: 'Vui lòng nêu rõ lý do điều chỉnh.' }]}
                                    >
                                        <TextArea rows={3} placeholder="Nêu rõ lý do và nội dung tiếp thu..." />
                                    </Form.Item>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button icon={<CloseCircleOutlined />} onClick={onClose}>
                                            Đóng
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={submitting}
                                            icon={<SendOutlined />}
                                            className="!bg-[#0052a3]"
                                        >
                                            Nộp lại bản sửa v2
                                        </Button>
                                    </div>
                                </Form>
                            ) : (
                                <Alert
                                    type="error"
                                    showIcon
                                    message="Không thể gửi lại phiếu BM02-A"
                                    description={
                                        isExpired
                                            ? 'Cửa sổ 168 giờ đã kết thúc. Bạn không thể gửi lại bản sửa đổi.'
                                            : 'Bạn đã sử dụng hết số lần sửa đổi cho phép (tối đa 1 lần).'
                                    }
                                />
                            )}
                        </div>
                    ) : latestRequest ? (
                        /* Case 2: Request already exists and in workflow */
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">Thông tin phiếu BM02-A hiện hành:</span>
                                <Tag color="blue">Phiên bản v{latestRequest.currentVersionNumber || 1}</Tag>
                            </div>
                            <div className="text-sm">
                                <div><strong>Tên đề xuất mới:</strong> {currentVersion?.proposedTitle}</div>
                                <div className="mt-1 text-slate-600"><strong>Lý do:</strong> {currentVersion?.reason}</div>
                            </div>
                            {latestRequest.finalPdfFileUrl && (
                                <div className="pt-2">
                                    <a
                                        href={latestRequest.finalPdfFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-xs"
                                    >
                                        Xem tệp PDF BM02-A đã hoàn tất 3 chữ ký
                                    </a>
                                </div>
                            )}
                            <div className="flex justify-end pt-2">
                                <Button icon={<CloseCircleOutlined />} onClick={onClose}>
                                    Đóng
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Case 3: Initial BM02-A form */
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleInitialSubmit}
                            requiredMark="optional"
                        >
                            <Form.Item
                                name="proposedTitle"
                                label="Tên đề tài mới xin điều chỉnh"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập tên đề tài mới.' },
                                    { min: 10, message: 'Tên đề tài phải có ít nhất 10 ký tự.' },
                                ]}
                            >
                                <Input placeholder="Nhập tên đề tài mới chính xác và đầy đủ..." size="large" />
                            </Form.Item>

                            <Form.Item
                                name="reason"
                                label="Lý do điều chỉnh tên đề tài"
                                rules={[
                                    { required: true, message: 'Vui lòng nêu rõ lý do xin điều chỉnh.' },
                                    { min: 15, message: 'Lý do giải trình cần chi tiết hơn (ít nhất 15 ký tự).' },
                                ]}
                            >
                                <TextArea
                                    rows={4}
                                    placeholder="Giải trình cụ thể lý do thay đổi (ví dụ: thu hẹp phạm vi nghiên cứu, cập nhật công nghệ mới)..."
                                />
                            </Form.Item>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button icon={<CloseCircleOutlined />} onClick={onClose} disabled={submitting}>
                                    Hủy bỏ
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={submitting}
                                    disabled={isExpired || !regId}
                                    icon={<FileDoneOutlined />}
                                    className="!bg-[#0052a3] hover:!bg-[#004080]"
                                >
                                    Ký số và nộp đơn
                                </Button>
                            </div>
                        </Form>
                    )}
                </div>
            </Spin>
        </Modal>
    );
}
