import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Input, Select, Tag, Space, Tooltip, Empty, message } from 'antd';
import {
    CheckSquareOutlined,
    EyeOutlined,
    ReloadOutlined,
    SearchOutlined,
    RobotOutlined,
    FileTextOutlined,
    TeamOutlined,
    ScheduleOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    PrinterOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { useRegistrations } from '../../queries/registrationQueries';
import { getStatusTagConfig } from '../../components/common/statusMap';
import QueryPanel from '../../components/common/QueryPanel';
import ContentSkeleton from '../../components/common/ContentSkeleton';
import AcademicFormPrintModal from '../../components/prints/AcademicFormPrintModal';
import BM01PrintSheet from '../../components/prints/BM01PrintSheet';
import BM01CopilotDrawer from '../../components/student/BM01CopilotDrawer';
import OutlineReviewModal from '../../components/lecturer/OutlineReviewModal';
import aiService from '../../services/aiService';
import './outline-review.css';

const { Option } = Select;

/**
 * OutlineReviewPage
 * Không gian làm việc chuyên sâu cho Hội đồng xét duyệt đề cương học thuật (BM01).
 * Tuân thủ AGENTS.md Rule 2.1 (TopicRegistration 1 SV/1 đề tài), Rule 2.4 (UTF-8 no BOM),
 * Rule 2.6 (Ant Design Button icons, tiếng Việt thuần túy, không có ký tự đồ họa thô/emoji).
 */
export default function OutlineReviewPage() {
    const { user: currentUser } = useAuthStore();
    const scope = queryKeys.scope(currentUser);
    const [searchParams] = useSearchParams();
    const targetRegistrationId = searchParams.get('registrationId');

    // Truy vấn danh sách đề tài phân công cho hội đồng
    const councilRegistrationsQuery = useRegistrations(scope, { asCouncilMember: 'true' });
    const registrations = councilRegistrationsQuery.data || [];

    // Bộ lọc và tìm kiếm
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Trạng thái mở Modals
    const [selectedRecordForReview, setSelectedRecordForReview] = useState(null);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);

    const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
    const [printModalOpen, setPrintModalOpen] = useState(false);

    const [copilotOpen, setCopilotOpen] = useState(false);
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [copilotData, setCopilotData] = useState(null);

    // Nhận diện thông tin Hội đồng & Vai trò người dùng trong hội đồng
    const activeCouncil = useMemo(() => {
        for (const reg of registrations) {
            if (reg.outlineCouncil) return reg.outlineCouncil;
        }
        return null;
    }, [registrations]);

    const councilMembers = useMemo(() => {
        return activeCouncil?.members || [];
    }, [activeCouncil]);

    const currentMembership = useMemo(() => {
        if (!councilMembers.length || !currentUser?.id) return null;
        return councilMembers.find(
            (m) => m.lecturerId === currentUser.id || m.lecturer?.id === currentUser.id
        );
    }, [councilMembers, currentUser]);

    // Phân định vai trò: CHAIRMAN, SECRETARY, hoặc MEMBER
    const currentRoleInCouncil = useMemo(() => {
        if (currentMembership?.roleInCouncil) {
            return currentMembership.roleInCouncil;
        }
        if (currentUser?.isCouncilChairman) {
            return 'CHAIRMAN';
        }
        return 'MEMBER';
    }, [currentMembership, currentUser]);

    const isChairman = currentRoleInCouncil === 'CHAIRMAN';
    const isSecretary = currentRoleInCouncil === 'SECRETARY';
    const isChairmanOrSecretary = isChairman || isSecretary;
    const isMember = !isChairmanOrSecretary;

    // Deep link tự động mở modal khi có registrationId trên URL
    useEffect(() => {
        if (targetRegistrationId && registrations.length > 0) {
            const target = registrations.find((r) => String(r.id) === String(targetRegistrationId));
            if (target) {
                setSelectedRecordForReview(target);
                setReviewModalOpen(true);
            }
        }
    }, [targetRegistrationId, registrations]);

    // Thống kê 4 chỉ số KPI
    const kpiStats = useMemo(() => {
        const total = registrations.length;
        const pending = registrations.filter((r) => r.status === 'BM01_SUBMITTED').length;
        const passed = registrations.filter((r) => r.status === 'BM01_PASSED' || r.status === 'APPROVED').length;
        const revision = registrations.filter((r) => r.status === 'BM01_NEEDS_REVISION').length;
        return { total, pending, passed, revision };
    }, [registrations]);

    // Lọc danh sách theo từ khóa tìm kiếm và trạng thái
    const filteredRegistrations = useMemo(() => {
        return registrations.filter((record) => {
            const studentName = record.student?.fullName || '';
            const studentCode = record.student?.code || '';
            const topicTitle = record.topic?.title || record.customTopicTitle || '';

            const matchesSearch =
                !searchText.trim() ||
                studentName.toLowerCase().includes(searchText.toLowerCase()) ||
                studentCode.toLowerCase().includes(searchText.toLowerCase()) ||
                topicTitle.toLowerCase().includes(searchText.toLowerCase());

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'BM01_SUBMITTED' && record.status === 'BM01_SUBMITTED') ||
                (statusFilter === 'BM01_PASSED' && (record.status === 'BM01_PASSED' || record.status === 'APPROVED')) ||
                (statusFilter === 'BM01_NEEDS_REVISION' && record.status === 'BM01_NEEDS_REVISION');

            return matchesSearch && matchesStatus;
        });
    }, [registrations, searchText, statusFilter]);

    // Xử lý mở Modal xem bản in BM01
    const handleOpenPrintModal = (record) => {
        setSelectedRecordForPrint(record);
        setPrintModalOpen(true);
    };

    // Xử lý mở Modal Thẩm định đề cương (hoặc Xem & Góp ý)
    const handleOpenReviewModal = (record) => {
        setSelectedRecordForReview(record);
        setReviewModalOpen(true);
    };

    // Xử lý mở trợ lý AI Copilot rà soát đề cương
    const handleOpenCopilot = async (record) => {
        try {
            setCopilotLoading(true);
            setCopilotOpen(true);
            const payload = {
                topicTitle: record?.topic?.title || record?.customTopicTitle || '',
                studentName: record?.student?.fullName || '',
                registrationId: record?.id,
                outlineContent: record?.submissions?.[0]?.content || record?.studentNote || '',
                fileUrl: record?.submissions?.[0]?.fileUrl || record?.outlineFileUrl || '',
            };
            const res = await aiService.analyzeBM01(payload);
            if (res?.success) {
                setCopilotData(res.data);
            } else {
                setCopilotData(res?.data || null);
            }
        } catch (error) {
            message.error(error.message || 'Không thể kết nối trợ lý AI Copilot');
        } finally {
            setCopilotLoading(false);
        }
    };

    // Cấu hình các cột hiển thị trong bảng đề tài BM01
    const columns = [
        {
            title: 'Mã Đề Tài',
            key: 'topicCode',
            width: 110,
            render: (_, record) => {
                const code = record.topic?.id
                    ? `DT-${String(record.topic.id).padStart(3, '0')}`
                    : `REG-${record.id}`;
                return <span className="font-mono text-xs font-semibold text-slate-700">{code}</span>;
            },
        },
        {
            title: 'Tên Đề Tài & Sinh Viên Thực Hiện',
            key: 'topicAndStudent',
            render: (_, record) => {
                const title = record.topic?.title || record.customTopicTitle || 'Chưa cập nhật tên đề tài';
                const student = record.student;
                const className = student?.studentProfile?.className || student?.class || '';
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-slate-900 text-sm leading-snug">
                            {title}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-700">
                                {student?.fullName || 'Sinh viên'}
                            </span>
                            <span>·</span>
                            <span className="font-mono text-slate-600">{student?.code || '-'}</span>
                            {className && (
                                <>
                                    <span>·</span>
                                    <span className="text-slate-500">Lớp: {className}</span>
                                </>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'GVHD',
            key: 'mentor',
            width: 170,
            render: (_, record) => (
                <span className="text-xs font-medium text-slate-800">
                    {record.topic?.mentor?.fullName || 'Chưa phân công'}
                </span>
            ),
        },
        {
            title: 'Đợt Nộp',
            key: 'submissionRound',
            width: 110,
            render: (_, record) => {
                const submissionCount = record._count?.submissions || record.submissions?.length || 1;
                const isResubmission = submissionCount > 1 || record.status === 'BM01_NEEDS_REVISION';
                return isResubmission ? (
                    <Tag color="purple" className="text-xs">
                        Lần 2 (Sửa lại)
                    </Tag>
                ) : (
                    <Tag color="blue" className="text-xs">
                        Lần đầu
                    </Tag>
                );
            },
        },
        {
            title: 'Trạng Thái',
            key: 'status',
            width: 150,
            render: (_, record) => {
                const cfg = getStatusTagConfig(record.status);
                return (
                    <Tag color={cfg.color} className="text-xs">
                        {cfg.label}
                    </Tag>
                );
            },
        },
        {
            title: 'Thao Tác Thẩm Định',
            key: 'actions',
            width: 280,
            render: (_, record) => (
                <Space size="small" wrap>
                    <Tooltip title="Xem toàn văn bản in đề cương học thuật (BM01)">
                        <Button
                            size="small"
                            icon={<PrinterOutlined />}
                            onClick={() => handleOpenPrintModal(record)}
                        >
                            Xem đề cương
                        </Button>
                    </Tooltip>

                    <Tooltip title="Rà soát tính khả thi và phạm vi với AI Copilot">
                        <Button
                            size="small"
                            icon={<RobotOutlined />}
                            onClick={() => handleOpenCopilot(record)}
                        >
                            AI Copilot
                        </Button>
                    </Tooltip>

                    {isChairmanOrSecretary ? (
                        <Button
                            type="primary"
                            size="small"
                            icon={<CheckSquareOutlined />}
                            onClick={() => handleOpenReviewModal(record)}
                        >
                            Thẩm định đề cương
                        </Button>
                    ) : (
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleOpenReviewModal(record)}
                        >
                            Xem & Góp ý
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const isInitialPending = councilRegistrationsQuery.isPending && !councilRegistrationsQuery.data;

    if (isInitialPending) {
        return <ContentSkeleton variant="table" />;
    }

    return (
        <section id="view-outline-evaluations" className="outline-review-pane">
            {/* ==================================================================
                Khối 1: Bento Header nhận diện Hội đồng Thẩm định Đề cương
                ================================================================== */}
            <div className="bento-council-header">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <div className="bento-council-title">
                            <SafetyCertificateOutlined className="text-blue-400" />
                            <span>
                                {activeCouncil?.name || 'Hội đồng Thẩm định Đề cương Đồ án Tốt nghiệp'}
                            </span>
                        </div>
                        <div className="bento-council-meta">
                            <span>
                                Quyết định số: 128/QĐ-ĐHTDM của Viện Công nghệ Số (Ban hành ngày 15/09/2026)
                            </span>
                            {activeCouncil?.location && (
                                <span>· Địa điểm: {activeCouncil.location}</span>
                            )}
                            {activeCouncil?.meetingMode && (
                                <span>· Hình thức: {activeCouncil.meetingMode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isChairman && (
                            <span className="role-badge-chairman">
                                Vai trò của bạn: Chủ tịch Hội đồng
                            </span>
                        )}
                        {isSecretary && (
                            <span className="role-badge-secretary">
                                Vai trò của bạn: Thư ký Hội đồng
                            </span>
                        )}
                        {isMember && (
                            <span className="role-badge-member">
                                Vai trò của bạn: Ủy viên Hội đồng
                            </span>
                        )}
                        <Button
                            icon={<ReloadOutlined />}
                            loading={councilRegistrationsQuery.isFetching}
                            onClick={() => councilRegistrationsQuery.refetch()}
                            className="text-white border-white/30 hover:border-white bg-white/10"
                        >
                            Làm mới
                        </Button>
                    </div>
                </div>

                {/* Danh sách thành viên Hội đồng */}
                <div className="bento-council-roster">
                    {councilMembers.length > 0 ? (
                        councilMembers.map((member) => {
                            const roleTitle =
                                member.roleInCouncil === 'CHAIRMAN'
                                    ? 'Chủ tịch Hội đồng'
                                    : (member.roleInCouncil === 'SECRETARY'
                                        ? 'Thư ký Hội đồng'
                                        : 'Ủy viên Hội đồng');
                            const isCurrent =
                                member.lecturerId === currentUser?.id ||
                                member.lecturer?.id === currentUser?.id;

                            return (
                                <div key={member.id || member.lecturerId} className="council-member-chip">
                                    <div className="text-xs">
                                        <div className="text-blue-200 font-semibold">{roleTitle}</div>
                                        <div className="font-medium text-white">
                                            {member.lecturer?.fullName || 'Giảng viên'}
                                            {isCurrent ? ' (Bạn)' : ''}
                                        </div>
                                    </div>
                                    <TeamOutlined className="text-blue-300 text-sm" />
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-xs text-blue-200 italic">
                            Chưa có danh sách thành viên cụ thể. Thẩm quyền xét duyệt căn cứ theo phân công học vụ của Viện.
                        </div>
                    )}
                </div>
            </div>

            {/* ==================================================================
                Khối 2: Dãy 4 thẻ đo lường KPI tiến độ thẩm định
                ================================================================== */}
            <div className="outline-kpi-grid">
                <div className="kpi-card kpi-card-total">
                    <span className="kpi-card-label">Tổng số đề tài được giao</span>
                    <div className="kpi-card-value">{kpiStats.total}</div>
                    <span className="kpi-card-hint">Hồ sơ phân công cho hội đồng</span>
                </div>

                <div className="kpi-card kpi-card-pending">
                    <span className="kpi-card-label">Chờ thẩm định</span>
                    <div className="kpi-card-value">{kpiStats.pending}</div>
                    <span className="kpi-card-hint">Đề cương BM01 đang chờ xem xét</span>
                </div>

                <div className="kpi-card kpi-card-passed">
                    <span className="kpi-card-label">Đã thông qua</span>
                    <div className="kpi-card-value">{kpiStats.passed}</div>
                    <span className="kpi-card-hint">Đề cương đạt chuẩn yêu cầu</span>
                </div>

                <div className="kpi-card kpi-card-revision">
                    <span className="kpi-card-label">Yêu cầu chỉnh sửa lần 2</span>
                    <div className="kpi-card-value">{kpiStats.revision}</div>
                    <span className="kpi-card-hint">Cần sinh viên bổ sung hoàn thiện</span>
                </div>
            </div>

            {/* ==================================================================
                Khối 3: Bảng danh sách đề tài & Không gian thẩm định
                ================================================================== */}
            <div className="outline-workspace-card">
                <div className="outline-table-toolbar">
                    <div className="outline-search-group">
                        <Input
                            placeholder="Tìm kiếm theo tên sinh viên, MSSV hoặc tên đề tài..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                            style={{ maxWidth: 360 }}
                        />
                        <Select
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 200 }}
                        >
                            <Option value="ALL">Tất cả trạng thái</Option>
                            <Option value="BM01_SUBMITTED">Chờ thẩm định</Option>
                            <Option value="BM01_PASSED">Đã thông qua</Option>
                            <Option value="BM01_NEEDS_REVISION">Cần chỉnh sửa</Option>
                        </Select>
                    </div>

                    <div className="text-xs text-slate-500">
                        Hiển thị <b>{filteredRegistrations.length}</b> / {registrations.length} đề tài
                    </div>
                </div>

                <QueryPanel query={councilRegistrationsQuery}>
                    <Table
                        columns={columns}
                        dataSource={filteredRegistrations}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `Tổng cộng ${total} đề tài`,
                        }}
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="Không có đề tài nào phù hợp với bộ lọc hiện tại."
                                />
                            ),
                        }}
                    />
                </QueryPanel>
            </div>

            {/* ==================================================================
                Khối 4: Cửa sổ thẩm định đề cương (OutlineReviewModal)
                ================================================================== */}
            {reviewModalOpen && selectedRecordForReview && (
                <OutlineReviewModal
                    open={reviewModalOpen}
                    onClose={() => {
                        setReviewModalOpen(false);
                        setSelectedRecordForReview(null);
                    }}
                    onSuccess={() => {
                        councilRegistrationsQuery.refetch();
                    }}
                    registration={selectedRecordForReview}
                    currentRoleInCouncil={currentRoleInCouncil}
                    readOnly={isMember}
                />
            )}

            {/* ==================================================================
                Khối 5: Modal xem bản in toàn văn Đề cương BM01
                ================================================================== */}
            {printModalOpen && selectedRecordForPrint && (
                <AcademicFormPrintModal
                    open={printModalOpen}
                    onClose={() => {
                        setPrintModalOpen(false);
                        setSelectedRecordForPrint(null);
                    }}
                    title="Bản In Đề Cương Đề Tài Nghiên Cứu Chi Tiết (BM01)"
                    documentCode="BM01"
                >
                    <BM01PrintSheet
                        registration={selectedRecordForPrint}
                        student={selectedRecordForPrint.student}
                        mentor={selectedRecordForPrint.topic?.mentor}
                    />
                </AcademicFormPrintModal>
            )}

            {/* ==================================================================
                Khối 6: Trợ lý AI Copilot rà soát đề cương (BM01CopilotDrawer)
                ================================================================== */}
            <BM01CopilotDrawer
                open={copilotOpen}
                onClose={() => {
                    setCopilotOpen(false);
                    setCopilotData(null);
                }}
                data={copilotData}
                loading={copilotLoading}
            />
        </section>
    );
}
