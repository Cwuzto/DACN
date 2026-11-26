import {
    Drawer,
    Form,
    Input,
    Select,
    Button,
    Table,
    Tag,
    Popconfirm,
    Alert,
    Space,
    message,
} from 'antd';
import {
    TeamOutlined,
    PlusOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useDelegations, useDelegationMutation } from '../../queries/delegationQueries';
import { usePublicLecturers } from '../../queries/periodQueries';
import { LECTURER_DEPARTMENT_OPTIONS } from '../../constants/academicUnits';

const DELEGATABLE_CAPABILITIES = [
    { value: 'BM02_REVIEW', label: 'Thẩm định BM02' },
    { value: 'BM03_STOP_REVIEW', label: 'Thẩm định dừng đề tài BM03' },
    { value: 'BM04_REJECTION_REVIEW', label: 'Thẩm định không bảo vệ BM04' },
    { value: 'SIGNATURE_APPEAL_REVIEW', label: 'Thẩm định khiếu nại chữ ký' },
    { value: 'TOPIC_ASSIGNMENT_DECISION_ISSUE', label: 'Ban hành QĐ giao đề tài' },
    { value: 'TITLE_ADJUSTMENT_APPENDIX_ISSUE', label: 'Ban hành phụ lục BM02-A' },
    { value: 'CLEARANCE_CERTIFICATE_SIGN', label: 'Ký giấy xác nhận hoàn thành' },
    { value: 'DEFENSE_RESULT_APPROVE', label: 'Phê duyệt kết quả bảo vệ' },
    { value: 'RESULT_PUBLICATION_PUBLISH', label: 'Công bố kết quả bảo vệ' },
];

export default function AcademicDelegationDrawer({
    open,
    onClose,
    scope,
    semesterId,
    canViewDelegations = false,
    canAssignDelegations = false,
}) {
    const [form] = Form.useForm();
    const delegationMutation = useDelegationMutation(scope);
    const delegationsQuery = useDelegations(scope, open && canViewDelegations);
    const lecturersQuery = usePublicLecturers(scope, {}, open && canAssignDelegations);

    const delegationsList = Array.isArray(delegationsQuery.data) ? delegationsQuery.data : [];
    const lecturersList = Array.isArray(lecturersQuery.data)
        ? lecturersQuery.data
        : (lecturersQuery.data?.users || []);

    const handleCreateDelegation = async (values) => {
        try {
            const payload = {
                delegateeId: values.delegateeId,
                capabilityCode: values.capabilityCode,
                semesterId: semesterId || undefined,
                department: values.department?.trim() || undefined,
                reason: values.reason?.trim() || undefined,
            };
            const key =
                globalThis.crypto?.randomUUID?.() ||
                `delegation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await delegationMutation.mutateAsync({
                action: 'createDelegation',
                args: [payload, key],
            });
            message.success('Đã tạo ủy quyền chuyên môn');
            form.resetFields();
        } catch (error) {
            message.error(error?.message || 'Không thể tạo ủy quyền chuyên môn');
        }
    };

    const handleRevokeDelegation = async (id) => {
        try {
            await delegationMutation.mutateAsync({
                action: 'revokeDelegation',
                args: [id],
            });
            message.success('Đã thu hồi ủy quyền');
        } catch (error) {
            message.error(error?.message || 'Không thể thu hồi ủy quyền');
        }
    };

    return (
        <Drawer
            open={open && canViewDelegations}
            onClose={onClose}
            size={640}
            title={
                <Space>
                    <TeamOutlined />
                    <span>Ủy quyền chuyên môn theo ngữ cảnh</span>
                </Space>
            }
        >
            <div className="space-y-6">
                {canAssignDelegations && (
                    <Form form={form} layout="vertical" onFinish={handleCreateDelegation}>
                        <Form.Item
                            name="delegateeId"
                            label="Người được ủy quyền"
                            rules={[{ required: true, message: 'Vui lòng chọn giảng viên' }]}
                        >
                            <Select
                                showSearch
                                optionFilterProp="label"
                                placeholder="Chọn giảng viên..."
                                options={lecturersList.map((u) => ({
                                    value: u.id,
                                    label: `${u.fullName || u.name} (${u.code || u.email || u.id})`,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item
                            name="capabilityCode"
                            label="Quyền nghiệp vụ"
                            rules={[{ required: true, message: 'Vui lòng chọn quyền ủy quyền' }]}
                        >
                            <Select placeholder="Chọn quyền..." options={DELEGATABLE_CAPABILITIES} />
                        </Form.Item>
                        <Form.Item name="department" label="Phạm vi bộ môn (tùy chọn)">
                            <Select
                                options={LECTURER_DEPARTMENT_OPTIONS}
                                allowClear
                                placeholder="Chọn bộ môn áp dụng"
                            />
                        </Form.Item>
                        <Form.Item name="reason" label="Lý do ủy quyền">
                            <Input placeholder="Nhập lý do..." />
                        </Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<PlusOutlined />}
                            loading={delegationMutation.isPending}
                        >
                            Cấp ủy quyền
                        </Button>
                    </Form>
                )}

                {delegationsQuery.isError && (
                    <Alert
                        type="error"
                        showIcon
                        title={delegationsQuery.error?.message || 'Không thể tải danh sách ủy quyền'}
                    />
                )}

                <Table
                    rowKey="id"
                    size="small"
                    loading={delegationsQuery.isFetching}
                    dataSource={delegationsList}
                    pagination={false}
                    columns={[
                        {
                            title: 'Người nhận',
                            key: 'delegatee',
                            render: (_, d) => d.delegatee?.fullName || d.delegateeName || `#${d.delegateeId}`,
                        },
                        {
                            title: 'Quyền',
                            dataIndex: 'capabilityCode',
                            key: 'capabilityCode',
                            render: (code) => <Tag color="blue">{code}</Tag>,
                        },
                        {
                            title: 'Trạng thái',
                            dataIndex: 'status',
                            key: 'status',
                            render: (st) => <Tag color={st === 'ACTIVE' ? 'green' : 'default'}>{st}</Tag>,
                        },
                        ...(canAssignDelegations
                            ? [
                                  {
                                      title: 'Thao tác',
                                      key: 'actions',
                                      render: (_, d) =>
                                          d.status === 'ACTIVE' ? (
                                              <Popconfirm
                                                  title="Thu hồi ủy quyền này?"
                                                  okText="Thu hồi"
                                                  cancelText="Hủy"
                                                  onConfirm={() => handleRevokeDelegation(d.id)}
                                              >
                                                  <Button danger size="small" icon={<DeleteOutlined />}>
                                                      Thu hồi
                                                  </Button>
                                              </Popconfirm>
                                          ) : null,
                                  },
                              ]
                            : []),
                    ]}
                />
            </div>
        </Drawer>
    );
}
