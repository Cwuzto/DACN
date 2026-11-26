import { useState } from 'react';
import {
    Modal,
    Tag,
    Table,
    Button,
    Empty,
    Badge,
} from 'antd';
import {
    HistoryOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SwapOutlined,
    UserOutlined,
    CalendarOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import { usePublicationHistory } from '../../queries/gradingQueries';
import ContentSkeleton from '../common/ContentSkeleton';
import QueryErrorState from '../common/QueryErrorState';
import ContentRefreshIndicator from '../common/ContentRefreshIndicator';

const TYPE_TAG_PROPS = {
    INITIAL: { color: 'cyan', text: 'Chính thức đợt 1' },
    SUPPLEMENTARY: { color: 'blue', text: 'Công bố bổ sung' },
    CORRECTION: { color: 'orange', text: 'Công bố đính chính' },
};

export default function PublicationHistoryModal({
    open,
    onClose,
    semesterId,
    semesterName,
}) {
    const user = useAuthStore((state) => state.user);
    const canRead = user?.permissions?.some((permission) => ['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH'].includes(permission));
    const historyQuery = usePublicationHistory(queryKeys.scope(user), semesterId, { enabled: open && canRead });
    const history = historyQuery.data?.data || [];
    const [selectedPublicationId, setSelectedPublicationId] = useState(null);
    const selectedPublication = history.find((publication) => publication.id === selectedPublicationId) || history[0] || null;

    const itemColumns = [
        {
            title: 'Mã SV',
            dataIndex: 'studentCodeSnapshot',
            key: 'code',
            width: 115,
            render: (code) => (
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {code || '—'}
                </span>
            ),
        },
        {
            title: 'Họ tên sinh viên',
            dataIndex: 'studentNameSnapshot',
            key: 'name',
            width: 175,
            render: (name) => <span className="font-semibold text-slate-900 text-xs">{name || '—'}</span>,
        },
        {
            title: 'Tên đề tài',
            dataIndex: 'topicTitleSnapshot',
            key: 'topic',
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
            dataIndex: 'outcomeSnapshot',
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
        {
            title: 'Đối ứng đính chính',
            dataIndex: 'replacesPublicationItemId',
            key: 'replace',
            width: 150,
            render: (id) =>
                id ? (
                    <Tag color="volcano" icon={<SwapOutlined />} className="m-0 font-mono text-xs">
                        Thay bản ghi #{id}
                    </Tag>
                ) : (
                    <span className="text-slate-400 text-xs">—</span>
                ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={1020}
            destroyOnHidden
            title={
                <div className="flex items-center justify-between gap-3 mr-7">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 text-[#0F766E] grid place-items-center text-lg shrink-0">
                            <HistoryOutlined />
                        </div>
                        <div>
                            <h3 className="font-display text-base font-bold text-slate-900 m-0 leading-snug">
                                Lịch sử công bố kết quả
                            </h3>
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                                Đợt học kỳ: <strong className="text-slate-800">{semesterName || `Học kỳ #${semesterId}`}</strong>
                            </div>
                        </div>
                    </div>
                    <Button
                        size="small"
                        icon={<ReloadOutlined aria-hidden="true" />}
                        onClick={() => historyQuery.refetch()}
                        loading={historyQuery.isFetching}
                    >
                        Làm mới
                    </Button>
                </div>
            }
        >
            <ContentRefreshIndicator refreshing={Boolean(historyQuery.data) && historyQuery.isFetching} />
            {historyQuery.isError && (
                <QueryErrorState
                    error={historyQuery.error}
                    onRetry={() => historyQuery.refetch()}
                    retrying={historyQuery.isFetching}
                />
            )}
            {historyQuery.isPending ? (
                <ContentSkeleton variant="table" />
            ) : historyQuery.data ? (
                history.length === 0 ? (
                    <Empty
                        className="py-10"
                        description="Chưa có phiên công bố kết quả nào được ban hành trong học kỳ này."
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-4 mt-3">
                        <div className="lg:border-r lg:border-slate-200/80 lg:pr-3.5 max-h-[520px] overflow-y-auto flex flex-col gap-2.5">
                            {history.map((pub) => {
                                const isSelected = selectedPublication?.id === pub.id;
                                const tagInfo = TYPE_TAG_PROPS[pub.type] || { color: 'default', text: pub.type };

                                return (
                                    <button
                                        key={pub.id}
                                        type="button"
                                        onClick={() => setSelectedPublicationId(pub.id)}
                                        className={`text-left rounded-xl p-3.5 transition-all border cursor-pointer ${
                                            isSelected
                                                ? 'border-[#0F766E] bg-teal-50/60 ring-1 ring-[#0F766E]/20'
                                                : 'border-slate-200/80 bg-white hover:border-teal-300 hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono tabular-nums font-bold text-xs text-slate-900">
                                                ĐỢT #{pub.id}
                                            </span>
                                            <Tag color={tagInfo.color} className="m-0 text-[10.5px] font-semibold">
                                                {tagInfo.text}
                                            </Tag>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums mt-2">
                                            <CalendarOutlined className="text-[11px]" />
                                            <span>
                                                {new Date(pub.publishedAt).toLocaleString('vi-VN', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                                            <UserOutlined className="text-[11px] text-slate-400" />
                                            <span>
                                                Ký duyệt: <strong className="text-slate-800">{pub.publishedBy?.fullName || 'Lãnh đạo Viện'}</strong>
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dashed border-slate-200">
                                            <span className="text-[11.5px] text-slate-500">Quy mô hồ sơ</span>
                                            <span className="font-mono tabular-nums font-bold text-[#0F766E] text-xs">
                                                {pub.items?.length || 0} sinh viên
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedPublication ? (
                            <div className="flex flex-col gap-3.5 min-w-0">
                                <div className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-xl">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-display text-sm font-bold text-slate-900 m-0">
                                                    Đợt công bố <span className="font-mono tabular-nums">#{selectedPublication.id}</span>
                                                </h4>
                                                <Tag color={TYPE_TAG_PROPS[selectedPublication.type]?.color || 'default'} className="m-0 font-semibold">
                                                    {TYPE_TAG_PROPS[selectedPublication.type]?.text || selectedPublication.type}
                                                </Tag>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Người ký ban hành:{' '}
                                                <strong className="text-slate-800">{selectedPublication.publishedBy?.fullName || 'Lãnh đạo Viện'}</strong>
                                                {' · '}
                                                <span className="font-mono tabular-nums">
                                                    {new Date(selectedPublication.publishedAt).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                        </div>
                                        <Badge
                                            count={`${selectedPublication.items?.length || 0} hồ sơ`}
                                            style={{ backgroundColor: '#0F766E', fontFamily: 'var(--font-mono)' }}
                                        />
                                    </div>

                                    {selectedPublication.previousPublication && (
                                        <div className="mt-2 text-xs text-amber-700 flex items-center gap-1.5 flex-wrap">
                                            <SwapOutlined />
                                            <span>
                                                Đợt tiền nhiệm:{' '}
                                                <strong className="font-mono">
                                                    #{selectedPublication.previousPublication.id}
                                                </strong>
                                                {' · '}
                                                <strong>
                                                    {TYPE_TAG_PROPS[selectedPublication.previousPublication.type]?.text || selectedPublication.previousPublication.type}
                                                </strong>
                                                {' · '}
                                                <span className="font-mono tabular-nums">
                                                    {new Date(selectedPublication.previousPublication.publishedAt).toLocaleDateString('vi-VN')}
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    {selectedPublication.reason && (
                                        <div className="mt-2.5 bg-white border border-slate-200/80 px-3 py-2 rounded-lg text-xs">
                                            <span className="text-slate-500 font-semibold">Ghi chú ban hành: </span>
                                            <span className="text-slate-800">{selectedPublication.reason}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        columns={itemColumns}
                                        dataSource={selectedPublication.items || []}
                                        pagination={{ pageSize: 6 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <Empty description="Chọn một đợt công bố để xem chi tiết" />
                        )}
                    </div>
                )
            ) : null}
        </Modal>
    );
}
