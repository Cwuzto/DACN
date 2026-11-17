import React from 'react';
import { Button, Card, Empty, Tag } from 'antd';
import {
    CalendarOutlined,
    FolderOpenOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStatusTagConfig } from '../common/statusMap';

/**
 * Danh sách sinh viên do giảng viên hiện tại hướng dẫn trong học kỳ đang xem.
 */
export default function SupervisedStudentList({
    students = [],
    onOpenDossier,
    onOpenMeetingModal,
}) {
    return (
        <Card
            className="rounded-xl border border-slate-200 shadow-sm h-full"
            styles={{ body: { padding: '16px 18px' } }}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                    <h2 className="text-base font-bold text-slate-900 m-0">
                        Sinh viên đang hướng dẫn
                    </h2>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                        Chỉ hiển thị hồ sơ thuộc phạm vi hướng dẫn của bạn trong đợt
                    </p>
                </div>
                <Tag color="teal" className="m-0 font-semibold">
                    {students.length} sinh viên
                </Tag>
            </div>

            {students.length === 0 ? (
                <div className="py-8">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có sinh viên trong đợt"
                    />
                </div>
            ) : (
                <ul className="space-y-2.5 m-0 p-0 list-none">
                    {students.map((student) => {
                        const statusCfg = getStatusTagConfig(student.status);
                        return (
                            <li
                                key={student.registrationId}
                                className="rounded-lg border border-slate-200 bg-white p-3"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                                <UserOutlined className="text-teal-600" />
                                                {student.studentName}
                                            </span>
                                            {student.studentCode && (
                                                <span className="text-xs font-mono text-slate-500">
                                                    {student.studentCode}
                                                </span>
                                            )}
                                            <Tag color={statusCfg.color} className="m-0 text-xs">
                                                {statusCfg.label}
                                            </Tag>
                                        </div>

                                        <p className="text-xs text-slate-700 m-0 mt-1 break-words">
                                            {student.topicTitle || 'Chưa cập nhật đề tài'}
                                        </p>

                                        {student.nextMilestone && (
                                            <p className="text-xs text-slate-500 m-0 mt-1">
                                                Mốc kế tiếp: {student.nextMilestone}
                                                {student.nextMilestoneAt
                                                    ? ` (${dayjs(student.nextMilestoneAt).format('DD/MM/YYYY')})`
                                                    : ''}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                        <Button
                                            size="small"
                                            icon={<FolderOpenOutlined />}
                                            onClick={() => onOpenDossier?.(student)}
                                        >
                                            Hồ sơ
                                        </Button>
                                        <Button
                                            size="small"
                                            icon={<CalendarOutlined />}
                                            onClick={() => onOpenMeetingModal?.(student)}
                                        >
                                            Ghi nhật ký
                                        </Button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
