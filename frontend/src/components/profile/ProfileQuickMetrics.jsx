import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Tag, Progress } from 'antd';
import {
    CheckCircleOutlined,
    BankOutlined,
    SafetyCertificateOutlined,
    IdcardOutlined,
} from '@ant-design/icons';

function ProfileQuickMetrics({ user, roleName, isStudent }) {
    const completeness = useMemo(() => {
        if (!user) return { percent: 0, statusText: 'Chưa cập nhật' };
        let points = 40; // Base: email, fullName, code exist
        if (user.phone) points += 20;
        if (user.avatarUrl) points += 20;
        if (isStudent) {
            if (user.studentProfile?.className || user.className) points += 10;
            if (user.studentProfile?.major || user.major) points += 10;
        } else {
            if (user.department) points += 20;
        }
        return {
            percent: Math.min(100, points),
            statusText: points >= 80 ? 'Hồ sơ đầy đủ' : 'Cần bổ sung',
        };
    }, [user, isStudent]);

    const academicTitle = isStudent ? 'Định danh học vụ' : 'Đơn vị công tác';
    const academicPrimary = isStudent
        ? (user?.studentProfile?.className || user?.className || 'Lớp sinh hoạt')
        : (user?.department || 'Viện Công nghệ Số');
    const academicSecondary = isStudent
        ? (user?.studentProfile?.major || user?.major || 'Chuyên ngành Đào tạo')
        : (roleName || 'Cán bộ phụ trách');

    const permissionsCount = (user?.permissions || []).length;
    const groupsCount = (user?.permissionGroups || []).length || 1;
    const councilAssignmentText = user?.hasDefenseCouncilAssignment
        ? 'Hội đồng Bảo vệ'
        : user?.hasOutlineCouncilAssignment
        ? 'Hội đồng Đề cương'
        : `${groupsCount} nhóm quyền`;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Account Status */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5 transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xl border border-emerald-100">
                    <CheckCircleOutlined />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Trạng thái tài khoản
                    </div>
                    <div className="text-base font-bold text-slate-900 truncate mt-0.5">
                        {user?.isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                    </div>
                    <div className="mt-1">
                        <Tag color="success" className="m-0 text-xs px-2 py-0.5 rounded-full font-medium">
                            Đã xác thực
                        </Tag>
                    </div>
                </div>
            </div>

            {/* Card 2: Academic Identity */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5 transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-xl border border-blue-100">
                    <BankOutlined />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate" title={academicTitle}>
                        {academicTitle}
                    </div>
                    <div className="text-base font-bold text-slate-900 truncate mt-0.5" title={academicPrimary}>
                        {academicPrimary}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-1" title={academicSecondary}>
                        {academicSecondary}
                    </div>
                </div>
            </div>

            {/* Card 3: Capabilities & Roles */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5 transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 text-xl border border-purple-100">
                    <SafetyCertificateOutlined />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quyền hạn học vụ
                    </div>
                    <div className="text-base font-bold text-slate-900 truncate mt-0.5">
                        {permissionsCount > 0 ? `${permissionsCount} quyền năng` : `${groupsCount} nhóm quyền`}
                    </div>
                    <div className="mt-1">
                        <Tag color="purple" className="m-0 text-xs px-2 py-0.5 rounded-full font-medium truncate max-w-full">
                            {councilAssignmentText}
                        </Tag>
                    </div>
                </div>
            </div>

            {/* Card 4: Completeness */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5 transition-all hover:shadow-md">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-xl border border-amber-100">
                    <IdcardOutlined />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Mức độ hoàn thiện
                    </div>
                    <div className="text-base font-bold text-slate-900 truncate mt-0.5">
                        {completeness.percent}%
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                        <Progress
                            percent={completeness.percent}
                            size="small"
                            showInfo={false}
                            strokeColor="#f59e0b"
                            className="m-0 flex-1"
                        />
                        <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                            {completeness.statusText}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

ProfileQuickMetrics.propTypes = {
    user: PropTypes.object,
    roleName: PropTypes.string,
    roleColor: PropTypes.string,
    isStudent: PropTypes.bool,
};

export default ProfileQuickMetrics;
