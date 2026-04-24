import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    FileDoneOutlined,
    LockOutlined,
    NotificationOutlined,
    ReloadOutlined,
    SearchOutlined,
    TeamOutlined,
    UnlockOutlined,
} from '@ant-design/icons';

import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import councilService from '../../services/councilService';
import evaluationService from '../../services/evaluationService';
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';

const TABS = [
    { key: 'PENDING_ASSIGNMENT', label: 'Chờ phân công', color: 'orange' },
    { key: 'ASSIGNED_COUNCIL', label: 'Đã phân công HĐ', color: 'blue' },
    { key: 'AWAITING_GRADING', label: 'Chờ nhập điểm', color: 'gold' },
    { key: 'COMPLETED', label: 'Hoàn tất', color: 'green' },
];

const GRADING_BADGE = {
    PENDING: { color: 'orange', text: 'Chưa chấm' },
    GRADED: { color: 'green', text: 'Đã chấm' },
};

const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
};

const fmtDateTime = (v) => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
};

function GradingDefensePage() {
    const [activeTab, setActiveTab] = useState('PENDING_ASSIGNMENT');
    const [data, setData] = useState([]);
    const [meta, setMeta] = useState({ counts: {}, targetSemester: null, total: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState(undefined);
    const [selectedCouncilId, setSelectedCouncilId] = useState(undefined);
    const [selectedMentorId, setSelectedMentorId] = useState(undefined);

    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [reminding, setReminding] = useState(false);
    const [lockingId, setLockingId] = useState(null);

    const [semesters, setSemesters] = useState([]);
    const [councils, setCouncils] = useState([]);
    const [mentors, setMentors] = useState([]);

    useEffect(() => {
        semesterService.getAll()
            .then((res) => {
                if (res.success) setSemesters(res.data || []);
            })
            .catch(() => {
                setSemesters([]);
            });

        userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 })
            .then((res) => {
                if (res.success) setMentors(res.data || []);
            })
            .catch(() => {
                setMentors([]);
            });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchText(searchText), 350);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        const params = {};
        if (selectedSemesterId) params.semesterId = selectedSemesterId;

        councilService.getCouncils(params)
            .then((res) => {
                if (res.success) setCouncils(res.data || []);
            })
            .catch(() => {
                setCouncils([]);
            });
    }, [selectedSemesterId]);

    const fetchData = useCallback(
        async (showRefresh = false) => {
            try {
                if (showRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                const params = { tab: activeTab };
                if (selectedSemesterId) params.semesterId = selectedSemesterId;
                if (selectedCouncilId) params.councilId = selectedCouncilId;
                if (selectedMentorId) params.mentorId = selectedMentorId;
                if (debouncedSearchText?.trim()) params.search = debouncedSearchText.trim();

                const res = await evaluationService.getAdminDefenseCenter(params);
                if (res.success) {
                    setData(res.data || []);
                    setMeta(res.meta || { counts: {}, targetSemester: null, total: 0 });
                    if (!selectedSemesterId && res.meta?.targetSemester?.id) {
                        setSelectedSemesterId(res.meta.targetSemester.id);
                    }
                }
            } catch (err) {
                message.error(err?.message || 'Không thể tải dữ liệu');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [activeTab, debouncedSearchText, selectedCouncilId, selectedMentorId, selectedSemesterId]
    );

    useEffect(() => {
        fetchData(false);
        setSelectedRowKeys([]);
    }, [fetchData]);

    const handleRemindGrading = async () => {
        if (!selectedRowKeys.length) {
            message.warning('Vui lòng chọn ít nhất 1 dòng');
            return;
        }

        try {
            setReminding(true);
            const res = await evaluationService.remindDefenseGrading(selectedRowKeys);
            if (res.success) {
                message.success(res.message || `Đã gửi nhắc chấm điểm cho ${res.data?.sent || 0} hồ sơ`);
                setSelectedRowKeys([]);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể gửi nhắc chấm điểm');
        } finally {
            setReminding(false);
        }
    };

    const handleScoreLock = async (registrationId, action) => {
        try {
            setLockingId(registrationId);
            const res = await evaluationService.setDefenseScoreLock(registrationId, action);
            if (res.success) {
                message.success(res.message || (action === 'LOCK' ? 'Đã khóa điểm' : 'Đã mở khóa điểm'));
                fetchData(true);
            }
        } catch (err) {
            message.error(err?.message || 'Thao tác thất bại');
        } finally {
            setLockingId(null);
        }
    };

    const columns = useMemo(() => {
        const base = [
            {
                title: 'Sinh viên',
                key: 'student',
                width: 200,
                render: (_, r) => (
                    <div>
                        <div className="font-semibold text-slate-900 leading-tight">{r.student?.fullName || '—'}</div>
                        {r.student?.code && (
                            <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                {r.student.code}
                            </code>
                        )}
                    </div>
                ),
            },
            {
                title: 'Đề tài',
                key: 'topic',
                width: 280,
                ellipsis: { showTitle: false },
                render: (_, r) => (
                    <Tooltip title={r.topic?.title}>
                        <span className="text-sm text-slate-600 line-clamp-2">{r.topic?.title || '—'}</span>
                    </Tooltip>
                ),
            },
            {
                title: 'GVHD',
                key: 'mentor',
                width: 170,
                render: (_, r) => <span className="text-sm">{r.mentor?.fullName || '—'}</span>,
            },
            {
                title: 'Hội đồng',
                key: 'council',
                width: 170,
                render: (_, r) =>
                    r.council ? (
                        <Tag color="blue">{r.council.name}</Tag>
                    ) : (
                        <span className="text-slate-400 text-xs italic">Chưa phân công</span>
                    ),
            },
            {
                title: 'Lịch bảo vệ',
                key: 'defenseDate',
                width: 130,
                render: (_, r) => (
                    <span className="text-sm">{fmtDate(r.council?.defenseDate || r.semester?.defenseDate)}</span>
                ),
            },
            {
                title: 'Trạng thái chấm',
                key: 'gradingStatus',
                width: 130,
                align: 'center',
                render: (_, r) => {
                    const badge = GRADING_BADGE[r.gradingStatus] || GRADING_BADGE.PENDING;
                    return <Tag color={badge.color}>{badge.text}</Tag>;
                },
            },
            {
                title: 'Điểm cuối',
                key: 'finalScore',
                width: 100,
                align: 'center',
                render: (_, r) =>
                    r.finalScore !== null && r.finalScore !== undefined ? (
                        <span className="font-black text-base text-primary">{r.finalScore}</span>
                    ) : (
                        <span className="text-slate-300">—</span>
                    ),
            },
            {
                title: 'Cập nhật',
                key: 'lastUpdated',
                width: 140,
                render: (_, r) => <span className="text-xs text-slate-500">{fmtDateTime(r.lastUpdatedAt)}</span>,
            },
        ];

        if (activeTab === 'AWAITING_GRADING' || activeTab === 'COMPLETED') {
            base.push({
                title: '',
                key: 'actions',
                width: 120,
                align: 'right',
                render: (_, r) => {
                    if (activeTab === 'COMPLETED') {
                        return (
                            <Button
                                size="small"
                                icon={<UnlockOutlined />}
                                loading={lockingId === r.registrationId}
                                onClick={() => handleScoreLock(r.registrationId, 'UNLOCK')}
                                className="text-xs border-orange-200 text-orange-600 bg-orange-50/50 hover:border-orange-300"
                            >
                                Mở khóa
                            </Button>
                        );
                    }

                    return r.gradingStatus === 'GRADED' ? (
                        <Button
                            size="small"
                            icon={<LockOutlined />}
                            loading={lockingId === r.registrationId}
                            onClick={() => handleScoreLock(r.registrationId, 'LOCK')}
                            className="text-xs border-green-200 text-green-700 bg-green-50/50 hover:border-green-300"
                        >
                            Khóa điểm
                        </Button>
                    ) : null;
                },
            });
        }

        return base;
    }, [activeTab, fetchData, lockingId]);

    const rowSelection = activeTab === 'AWAITING_GRADING' || activeTab === 'ASSIGNED_COUNCIL'
        ? {
            selectedRowKeys,
            onChange: setSelectedRowKeys,
        }
        : undefined;

    const tabItems = TABS.map((t) => ({
        key: t.key,
        label: (
            <span>
                {t.label}
                <Tag color={t.color} className="ml-2 rounded-full text-xs font-bold" style={{ marginInlineStart: 8 }}>
                    {meta.counts?.[t.key] ?? 0}
                </Tag>
            </span>
        ),
    }));

    const semesterOptions = useMemo(
        () => semesters.map((semester) => ({ value: semester.id, label: semester.name })),
        [semesters]
    );

    const councilOptions = useMemo(
        () => councils.map((council) => ({ value: council.id, label: council.name })),
        [councils]
    );

    const mentorOptions = useMemo(
        () => mentors.map((mentor) => ({ value: mentor.id, label: `${mentor.fullName} (${mentor.code})` })),
        [mentors]
    );

    const statsData = useMemo(
        () => [
            {
                title: 'Chờ phân công',
                value: meta.counts?.PENDING_ASSIGNMENT ?? 0,
                icon: 'hourglass_top',
                iconBg: 'bg-orange-50',
                iconColor: 'text-orange-600',
            },
            {
                title: 'Đã phân công hội đồng',
                value: meta.counts?.ASSIGNED_COUNCIL ?? 0,
                icon: 'groups',
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
            },
            {
                title: 'Chờ nhập điểm',
                value: meta.counts?.AWAITING_GRADING ?? 0,
                icon: 'rate_review',
                iconBg: 'bg-amber-50',
                iconColor: 'text-amber-600',
            },
            {
                title: 'Hoàn tất',
                value: meta.counts?.COMPLETED ?? 0,
                icon: 'task_alt',
                iconBg: 'bg-green-50',
                iconColor: 'text-green-600',
            },
        ],
        [meta.counts]
    );

    const stageDescription = useMemo(() => {
        const map = {
            PENDING_ASSIGNMENT: {
                icon: <ClockCircleOutlined className="text-orange-500" />,
                text: 'Danh sách hồ sơ đã đủ điều kiện nhưng chưa gán hội đồng.',
            },
            ASSIGNED_COUNCIL: {
                icon: <TeamOutlined className="text-blue-500" />,
                text: 'Đã có hội đồng, chờ đến lịch hoặc đang trong phiên bảo vệ.',
            },
            AWAITING_GRADING: {
                icon: <FileDoneOutlined className="text-amber-500" />,
                text: 'Đã bảo vệ xong, hội đồng cần nhập điểm và hoàn tất biên bản.',
            },
            COMPLETED: {
                icon: <CheckCircleOutlined className="text-green-600" />,
                text: 'Điểm đã hoàn tất, có thể mở khóa khi cần điều chỉnh.',
            },
        };
        return map[activeTab];
    }, [activeTab]);

    return (
        <div className="py-2">
            <PageHeader
                title="Admin Grading Defense Center"
                subtitle="Trung tâm điều phối phân công hội đồng, theo dõi chấm điểm và khóa kết quả bảo vệ theo từng workflow stage."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                {statsData.map((card) => (
                    <StatCard
                        key={card.title}
                        icon={card.icon}
                        iconBg={card.iconBg}
                        iconColor={card.iconColor}
                        label={card.title}
                        value={card.value}
                    />
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        {stageDescription.icon}
                        <span>{stageDescription.text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Tổng hồ sơ:</span>
                        <span className="font-black text-slate-800 text-sm">{meta.total ?? data.length}</span>
                    </div>
                </div>

                {meta.targetSemester && (
                    <div className="text-xs text-slate-500 mb-4">
                        Đợt hiện tại: <span className="font-bold text-slate-700">{meta.targetSemester.name}</span>
                    </div>
                )}

                <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} items={tabItems} size="large" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
                    <div className="lg:col-span-4">
                        <Input
                            placeholder="Tìm SV, mã SV hoặc đề tài..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <Select
                            className="w-full"
                            placeholder="Đợt đồ án"
                            options={semesterOptions}
                            value={selectedSemesterId}
                            onChange={(value) => {
                                setSelectedSemesterId(value);
                                setSelectedCouncilId(undefined);
                            }}
                            allowClear
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <Select
                            className="w-full"
                            placeholder="Hội đồng"
                            options={councilOptions}
                            value={selectedCouncilId}
                            onChange={setSelectedCouncilId}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <Select
                            className="w-full"
                            placeholder="GV hướng dẫn"
                            options={mentorOptions}
                            value={selectedMentorId}
                            onChange={setSelectedMentorId}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <Space>
                        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => fetchData(true)}>
                            Làm mới
                        </Button>
                    </Space>

                    {(activeTab === 'AWAITING_GRADING' || activeTab === 'ASSIGNED_COUNCIL') && (
                        <Button
                            type="primary"
                            icon={<NotificationOutlined />}
                            loading={reminding}
                            disabled={!selectedRowKeys.length}
                            onClick={handleRemindGrading}
                        >
                            Nhắc chấm điểm {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                        </Button>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-2">
                    <Table
                        loading={loading}
                        columns={columns}
                        dataSource={data}
                        rowKey="registrationId"
                        rowSelection={rowSelection}
                        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} kết quả` }}
                        size="middle"
                        scroll={{ x: 1200 }}
                    />
                </div>
            </div>
        </div>
    );
}

export default GradingDefensePage;
