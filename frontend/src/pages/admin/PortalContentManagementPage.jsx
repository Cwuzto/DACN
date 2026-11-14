import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Button,
    Card,
    Form,
    List,
    Modal,
    Popconfirm,
    Space,
    Tabs,
    Tag,
    Typography,
    message,
} from 'antd';
import {
    EyeOutlined,
    FileAddOutlined,
    SaveOutlined,
    SendOutlined,
    FileTextOutlined,
    NotificationOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import portalContentService from '../../services/portalContentService';
import ConfigurationForm from './portal/ConfigurationForm';
import LinkManager from './portal/LinkManager';
import TemplateManager from './portal/TemplateManager';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { getPortalEmptyState, selectEditableRevision } from './portal/portalContentUtils';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { usePortalResources, usePortalMutation } from '../../queries/portalQueries';
import QueryPanel from '../../components/common/QueryPanel';

const RESOURCE_TABS = [
    { key: 'CONFIGURATION', label: 'Nhận diện & Hero' },
    { key: 'TEMPLATE', label: 'Biểu mẫu BM01–BM05' },
    { key: 'LINK', label: 'Liên kết & Footer' },
];

const initialPayload = (type) => {
    if (type === 'CONFIGURATION') {
        return {
            siteTitle: 'Hệ thống Quản lý Đồ án',
            institutionName: 'Viện Công nghệ Số',
            heroTitle: 'Khởi đầu Đồ án Tốt nghiệp với Quy chuẩn Học thuật Số',
            heroDescription: 'Cổng thông tin chính thức dành cho sinh viên thực hiện Khóa luận và Đồ án Chuyên ngành.',
            primaryCtaLabel: 'Tra cứu Giảng viên & Hướng NC',
            primaryCtaHref: '#faculty',
            copyrightText: '© 2026 Hệ thống Quản lý Đồ án',
        };
    }
    if (type === 'TEMPLATE') {
        return { version: '1.0', sortOrder: 0 };
    }
    if (type === 'LINK') {
        return { group: 'QUICK_LINK', sortOrder: 0 };
    }
    return {};
};

export default function PortalContentManagementPage() {
    const user = useAuthStore((state) => state.user);
    const scope = queryKeys.scope(user);

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeType, setActiveType] = useState(() => {
        if (tabParam && RESOURCE_TABS.some((t) => t.key === tabParam)) {
            return tabParam;
        }
        return 'CONFIGURATION';
    });

    const handleTabChange = (key) => {
        setActiveType(key);
        setSearchParams({ tab: key });
    };

    const resourcesQuery = usePortalResources(scope, activeType);
    const portalMutation = usePortalMutation(scope);
    const resources = resourcesQuery.data || [];
    const emptyState = useMemo(() => getPortalEmptyState(activeType), [activeType]);

    const [saving, setSaving] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [form] = Form.useForm();

    const openEditor = (resource) => {
        const revision = selectEditableRevision(resource);
        const payload = revision?.payload || initialPayload(activeType);
        setEditing({ resource, revision });
        form.setFieldsValue({ ...initialPayload(activeType), ...payload });
        setEditorOpen(true);
    };

    const createAndEdit = async () => {
        try {
            const response = await portalMutation.mutateAsync({
                action: 'createResource',
                args: [activeType],
            });
            const resource = response.data;
            openEditor(resource);
        } catch (error) {
            message.error(error?.message || 'Không thể tạo nội dung Portal.');
        }
    };

    const saveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const response = await portalMutation.mutateAsync({
                action: 'createDraft',
                args: [activeType, editing.resource.id, values],
            });
            setEditing((current) => ({ ...current, revision: response.data }));
            message.success('Đã lưu bản nháp. Bạn có thể xem trước hoặc công bố khi sẵn sàng.');
        } catch (error) {
            if (error?.errorFields) return;
            message.error(error?.message || 'Không thể lưu bản nháp.');
        } finally {
            setSaving(false);
        }
    };

    const publish = async () => {
        if (!editing?.revision?.id) {
            message.info('Hãy lưu bản nháp trước khi công bố.');
            return;
        }
        try {
            setSaving(true);
            await portalMutation.mutateAsync({
                action: 'publishDraft',
                args: [activeType, editing.resource.id, editing.revision.id],
            });
            message.success('Đã công bố nội dung Portal.');
            setEditorOpen(false);
        } catch (error) {
            message.error(error?.message || 'Không thể công bố nội dung.');
        } finally {
            setSaving(false);
        }
    };

    const archive = async (resource) => {
        try {
            await portalMutation.mutateAsync({
                action: 'archive',
                args: [activeType, resource.id],
            });
            message.success('Đã ẩn nội dung khỏi Portal công khai.');
        } catch (error) {
            message.error(error?.message || 'Không thể lưu trạng thái archive.');
        }
    };

    const renderForm = () => {
        if (activeType === 'CONFIGURATION') return <ConfigurationForm form={form} />;
        if (activeType === 'LINK') return <LinkManager form={form} />;
        return <TemplateManager form={form} />;
    };

    const getEditorTitle = () => {
        if (activeType === 'CONFIGURATION') return 'Biên tập Nhận diện & Hero Portal';
        if (activeType === 'TEMPLATE') return 'Biên tập Biểu mẫu BM01–BM05';
        return 'Biên tập Liên kết Ngoài & Footer';
    };

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">PORTAL CMS • CẤU HÌNH GIAO DIỆN &amp; TÀI NGUYÊN</p>
                    <h1 className="h1">Cấu Hình Giao Diện &amp; Tài Nguyên Portal</h1>
                    <Typography.Text type="secondary">
                        Cấu hình banner trang chủ, biểu mẫu chuẩn BM01-BM05 và liên kết ngoài của Cổng thông tin.
                    </Typography.Text>
                </div>
                {activeType !== 'CONFIGURATION' || resources.length === 0 ? (
                    <Button type="primary" icon={<FileAddOutlined />} onClick={createAndEdit}>
                        Tạo {activeType === 'TEMPLATE' ? 'biểu mẫu mới' : 'liên kết mới'}
                    </Button>
                ) : null}
            </div>

            {/* Information Alert directing to Centralized Announcements */}
            <Alert
                type="info"
                showIcon
                icon={<NotificationOutlined className="text-blue-600" />}
                message={
                    <span className="font-semibold text-slate-800">
                        Quản lý tin tức &amp; thông báo văn bản học vụ đã được chuyển sang trang riêng
                    </span>
                }
                description={
                    <div className="text-slate-600 text-xs sm:text-sm mt-0.5">
                        Để đăng tin tức, văn bản học vụ hoặc thông báo đính kèm file PDF/Word lên Portal, vui lòng sử dụng mục{' '}
                        <Link
                            to="/admin/announcements"
                            className="font-semibold text-blue-600 hover:text-blue-700 underline"
                        >
                            Bản tin &amp; Quyết định Portal
                        </Link>
                        . Trang CMS này chỉ dành riêng cho cấu hình Giao diện, Biểu mẫu chuẩn BM01–BM05 và Liên kết chân trang.
                    </div>
                }
                className="border-blue-200 bg-blue-50/70 rounded-xl"
            />

            {/* Content Tabs & List */}
            <Card className="rounded-xl shadow-xs">
                <Tabs
                    activeKey={activeType}
                    onChange={handleTabChange}
                    items={RESOURCE_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
                    className="mb-4"
                />

                <QueryPanel
                    query={resourcesQuery}
                    empty={resources.length === 0}
                    emptyDescription={
                        <span>
                            <b>{emptyState.title}</b>
                            <br />
                            {emptyState.description}
                        </span>
                    }
                >
                    <List
                        dataSource={resources}
                        renderItem={(resource) => {
                            const revision = selectEditableRevision(resource);
                            const payload = revision?.payload || {};
                            const publicRevision = resource.revisions?.find(
                                (item) => item.status === 'PUBLISHED'
                            );

                            let itemTitle = payload?.title || payload?.siteTitle || `Nội dung #${resource.id}`;
                            let extraMeta = null;

                            if (activeType === 'TEMPLATE') {
                                itemTitle = (
                                    <Space size="small">
                                        {payload.code && <Tag color="blue" className="font-semibold">{payload.code}</Tag>}
                                        <span className="font-medium text-slate-900">{payload.title || 'Biểu mẫu chưa đặt tên'}</span>
                                        {payload.version && <Tag className="text-xs">v{payload.version}</Tag>}
                                    </Space>
                                );
                                extraMeta = payload.fileName ? (
                                    <span className="text-xs text-slate-500 flex orientation-horizontal items-center gap-1">
                                        <FileTextOutlined /> {payload.fileName}
                                    </span>
                                ) : null;
                            } else if (activeType === 'LINK') {
                                itemTitle = (
                                    <Space size="small">
                                        {payload.group && <Tag color="cyan">{payload.group}</Tag>}
                                        <span className="font-medium text-slate-900">{payload.label || 'Liên kết'}</span>
                                    </Space>
                                );
                                extraMeta = payload.href ? (
                                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 truncate max-w-sm">
                                        <LinkOutlined /> {payload.href}
                                    </span>
                                ) : null;
                            }

                            return (
                                <List.Item
                                    className="hover:bg-slate-50/80 transition-colors rounded-lg px-3"
                                    actions={[
                                        <Button
                                            key="edit"
                                            type="link"
                                            onClick={() => openEditor(resource)}
                                        >
                                            Biên tập
                                        </Button>,
                                        <Popconfirm
                                            key="archive"
                                            title="Ẩn nội dung này khỏi Portal công khai?"
                                            onConfirm={() => archive(resource)}
                                        >
                                            <Button danger type="link" disabled={!publicRevision}>
                                                Gỡ xuất bản
                                            </Button>
                                        </Popconfirm>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={itemTitle}
                                        description={
                                            <Space size="middle" className="flex-wrap items-center mt-1">
                                                <Tag color={publicRevision ? 'green' : 'default'}>
                                                    {publicRevision ? 'Đã công bố' : 'Bản nháp'}
                                                </Tag>
                                                <span className="text-xs text-slate-400">
                                                    {resource.revisions?.length || 0} phiên bản
                                                </span>
                                                {extraMeta}
                                            </Space>
                                        }
                                    />
                                </List.Item>
                            );
                        }}
                    />
                </QueryPanel>
            </Card>

            {/* Edit / Draft Modal */}
            <Modal
                open={editorOpen}
                onCancel={() => setEditorOpen(false)}
                title={getEditorTitle()}
                width={820}
                destroyOnClose
                footer={
                    <Space>
                        <Button onClick={() => setEditorOpen(false)}>Đóng</Button>
                        <Button
                            icon={<EyeOutlined />}
                            onClick={() => {
                                const url = form.getFieldValue('fileUrl');
                                if (url) {
                                    setPreviewUrl(url);
                                } else {
                                    message.info('Vui lòng tải lên tệp đính kèm để xem trước.');
                                }
                            }}
                        >
                            Xem trước tệp
                        </Button>
                        <Button
                            icon={<SaveOutlined />}
                            loading={saving}
                            onClick={saveDraft}
                        >
                            Lưu nháp
                        </Button>
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            loading={saving}
                            onClick={publish}
                        >
                            Công bố
                        </Button>
                    </Space>
                }
            >
                <div className="py-2">{renderForm()}</div>
            </Modal>

            {/* PDF Preview Modal */}
            <PdfPreviewModal
                open={Boolean(previewUrl)}
                onCancel={() => setPreviewUrl(null)}
                url={previewUrl}
            />
        </div>
    );
}
