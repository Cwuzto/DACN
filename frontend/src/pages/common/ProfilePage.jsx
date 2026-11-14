import { useState, useEffect, useMemo } from 'react';
import {
    Button,
    Input,
    Avatar,
    Upload,
    Tag,
    Badge,
    Tabs,
    Alert,
    message,
} from 'antd';
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    IdcardOutlined,
    EditOutlined,
    SaveOutlined,
    CloseOutlined,
    CameraOutlined,
    BankOutlined,
    LockOutlined,
    KeyOutlined,
    LoadingOutlined,
    CheckCircleOutlined,
    SafetyCertificateOutlined,
    SafetyOutlined,
    TeamOutlined,
    ScheduleOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import uploadService from '../../services/uploadService';
import { getUserDisplayRole, isInstituteDirector } from '../../utils/authRedirect';
import PageHeader from '../../components/common/PageHeader';
import { queryKeys } from '../../query/queryKeys';
import { useCurrentUser } from '../../queries/userQueries';
import { useQueryClient } from '@tanstack/react-query';
import PasswordStrengthMeter from '../../components/profile/PasswordStrengthMeter';
import ProfileQuickMetrics from '../../components/profile/ProfileQuickMetrics';

function formatCohortDisplay(className) {
    if (!className) return 'D22 — Nhập học năm 2022';
    const match = String(className).match(/^[dD](\d{2})/);
    if (match) {
        const year = match[1];
        return `D${year} — Nhập học năm 20${year}`;
    }
    return 'D22 — Nhập học năm 2022';
}

function ProfilePage() {
    const { user: authUser, updateUser } = useAuthStore();
    const scope = queryKeys.scope(authUser);
    const userQuery = useCurrentUser(scope, Boolean(authUser));
    const user = userQuery.data || authUser;
    const queryClient = useQueryClient();
    const isStudent = user?.role === 'STUDENT';

    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [tempProfile, setTempProfile] = useState({});
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        if (user) {
            setTempProfile({
                name: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                employeeId: user.code || '',
                department: user.department || '',
                role: user.role || '',
                avatarUrl: user.avatarUrl || '',
                className: user.studentProfile?.className || user.className || '',
                major: user.studentProfile?.major || user.major || '',
            });
        }
    }, [user]);

    const isProfileBusy = savingProfile || uploading;
    const isPasswordBusy = changingPassword;

    const hasProfileChanges = useMemo(() => {
        if (!user) return false;
        if (isStudent) {
            return (
                (tempProfile.avatarUrl || '') !== (user.avatarUrl || '') ||
                (tempProfile.phone || '') !== (user.phone || '')
            );
        }
        return (
            (tempProfile.avatarUrl || '') !== (user.avatarUrl || '') ||
            (tempProfile.phone || '') !== (user.phone || '') ||
            (tempProfile.department || '') !== (user.department || '')
        );
    }, [tempProfile, user, isStudent]);

    const handleChange = (field, value) => {
        setTempProfile((prev) => ({ ...prev, [field]: value }));
    };

    const handlePasswordChange = (field, value) => {
        setPasswords((prev) => ({ ...prev, [field]: value }));
    };

    const handleUploadAvatar = async (options) => {
        const { file, onSuccess, onError } = options;
        try {
            setUploading(true);
            const data = await uploadService.uploadFile(file, 'avatars');
            handleChange('avatarUrl', data.data.url);
            onSuccess(data);
            message.success('Tải ảnh lên thành công. Bấm Lưu thay đổi để hoàn tất.');
        } catch (error) {
            onError(error);
            message.error(error?.message || 'Tải ảnh lên thất bại.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSavingProfile(true);
            const updatePayload = {
                avatarUrl: tempProfile.avatarUrl,
                phone: tempProfile.phone,
            };
            if (!isStudent) {
                updatePayload.department = tempProfile.department;
            }

            const res = await authService.updateProfile(updatePayload);

            if (res?.success && res?.data) {
                updateUser({ ...user, ...res.data });
                queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(scope, 'me') });
                setEditing(false);
                message.success('Cập nhật thông tin thành công.');
                return;
            }

            message.error(res?.message || 'Cập nhật thất bại.');
        } catch (error) {
            message.error(error?.message || 'Cập nhật thất bại.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCancel = () => {
        setTempProfile({
            name: user?.fullName || '',
            email: user?.email || '',
            phone: user?.phone || '',
            employeeId: user?.code || '',
            department: user?.department || '',
            role: user?.role || '',
            avatarUrl: user?.avatarUrl || '',
            className: user?.studentProfile?.className || user?.className || '',
            major: user?.studentProfile?.major || user?.major || '',
        });
        setEditing(false);
    };

    const handleUpdatePassword = async () => {
        try {
            if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
                message.warning('Vui lòng nhập đủ các trường mật khẩu.');
                return;
            }

            if (passwords.newPassword.length < 6) {
                message.warning('Mật khẩu mới phải có ít nhất 6 ký tự.');
                return;
            }

            if (passwords.newPassword !== passwords.confirmPassword) {
                message.error('Mật khẩu xác nhận không khớp.');
                return;
            }

            setChangingPassword(true);
            await authService.changePassword(passwords.currentPassword, passwords.newPassword);
            message.success('Đổi mật khẩu thành công.');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            message.error(error?.message || 'Đổi mật khẩu thất bại.');
        } finally {
            setChangingPassword(false);
        }
    };

    if (!user) return <div className="p-6 text-slate-500">Đang tải thông tin...</div>;

    const roleName = getUserDisplayRole(user);
    const roleColor = isInstituteDirector(user) ? 'purple' : user.role === 'ADMIN' ? 'red' : user.role === 'LECTURER' ? 'blue' : 'green';

    const tabItems = [
        {
            key: 'personal_academic',
            label: (
                <span className="flex items-center gap-2">
                    <IdcardOutlined />
                    Thông tin cá nhân & Học vụ
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <Alert
                        type="info"
                        showIcon
                        message="Thông tin học vụ chính thức"
                        description="Mã số định danh, họ tên, lớp sinh hoạt và chuyên ngành được bảo trợ và đồng bộ trực tiếp từ Cơ sở dữ liệu Quản lý Đào tạo của Nhà trường. Sinh viên và cán bộ không thể tự ý sửa đổi dữ liệu này để đảm bảo tính toàn vẹn học vụ."
                        className="rounded-xl border-blue-200 bg-blue-50/70"
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Section A: Read-Only Academic Identity */}
                        <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                                <IdcardOutlined className="text-blue-600" />
                                Thông tin học vụ định danh (Chỉ đọc)
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Trường
                                    </label>
                                    <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                        <BankOutlined className="text-blue-600" />
                                        Trường Đại học Thủ Dầu Một
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        {isStudent ? 'Đơn vị quản lý' : 'Đơn vị công tác'}
                                    </label>
                                    <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                        <BankOutlined className="text-indigo-600" />
                                        Viện Công nghệ số
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Họ và tên
                                    </label>
                                    <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                                        {tempProfile.name}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        {isStudent ? 'Mã số sinh viên (MSSV)' : 'Mã nhân viên / Giảng viên'}
                                    </label>
                                    <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                                        {tempProfile.employeeId}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Vai trò hệ thống
                                    </label>
                                    <div className="text-sm font-medium text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                        <Tag color={roleColor} className="m-0 font-semibold">{roleName}</Tag>
                                    </div>
                                </div>

                                {isStudent ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Ngành học (Ngành)
                                            </label>
                                            <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                                                {tempProfile.major || 'Công nghệ thông tin'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Khóa
                                            </label>
                                            <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                                                {formatCohortDisplay(tempProfile.className)}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Lớp hành chính (Lớp)
                                            </label>
                                            <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 font-mono">
                                                {tempProfile.className || 'D22CNTT01'}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            Bộ môn
                                        </label>
                                        <div className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                                            {tempProfile.department || 'Kỹ thuật phần mềm & Hệ thống thông tin'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section B: Editable Contact Information */}
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                                <MailOutlined className="text-blue-600" />
                                Thông tin liên lạc & Công tác {editing ? '(Đang chỉnh sửa)' : ''}
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Email công vụ (Tài khoản)
                                    </label>
                                    <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2 truncate">
                                            <MailOutlined className="text-slate-400" />
                                            <span className="truncate">{tempProfile.email}</span>
                                        </div>
                                        <Tag color="cyan" className="m-0 text-[11px]">Email trường cấp</Tag>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Số điện thoại liên lạc {editing && <span className="text-blue-600 font-normal">(Có thể sửa)</span>}
                                    </label>
                                    {editing ? (
                                        <Input
                                            size="large"
                                            prefix={<PhoneOutlined className="text-slate-400" />}
                                            value={tempProfile.phone}
                                            onChange={(e) => handleChange('phone', e.target.value)}
                                            placeholder="Nhập số điện thoại di động (VD: 0901234567)"
                                            disabled={isProfileBusy}
                                            className="rounded-lg"
                                        />
                                    ) : (
                                        <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                            <PhoneOutlined className="text-slate-400" />
                                            <span>{tempProfile.phone || 'Chưa cập nhật số điện thoại'}</span>
                                        </div>
                                    )}
                                </div>

                                {!isStudent && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            Bộ môn {editing && <span className="text-blue-600 font-normal">(Có thể sửa)</span>}
                                        </label>
                                        {editing ? (
                                            <Input
                                                size="large"
                                                prefix={<BankOutlined className="text-slate-400" />}
                                                value={tempProfile.department}
                                                onChange={(e) => handleChange('department', e.target.value)}
                                                placeholder="VD: Kỹ thuật phần mềm & Hệ thống thông tin"
                                                disabled={isProfileBusy}
                                                className="rounded-lg"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
                                                <BankOutlined className="text-slate-400" />
                                                <span>{tempProfile.department || 'Kỹ thuật phần mềm & Hệ thống thông tin'}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                                        💡 <strong>Mẹo cập nhật</strong>: {isStudent
                                            ? 'Sinh viên chỉ có thể cập nhật số điện thoại và ảnh đại diện để nhận thông báo khẩn cấp từ Giảng viên hướng dẫn.'
                                            : 'Giảng viên có thể cập nhật số điện thoại, ảnh đại diện và đơn vị/bộ môn công tác trực thuộc.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'security_password',
            label: (
                <span className="flex items-center gap-2">
                    <LockOutlined />
                    Bảo mật & Quản lý phiên
                </span>
            ),
            children: (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Password Form (2 cols) */}
                    <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                            <LockOutlined className="text-blue-600" />
                            Đổi mật khẩu tài khoản
                        </h4>
                        <div className="space-y-4 max-w-xl">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                                </label>
                                <Input.Password
                                    size="large"
                                    placeholder="Nhập mật khẩu cũ của bạn"
                                    value={passwords.currentPassword}
                                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                    disabled={isPasswordBusy}
                                    className="rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <Input.Password
                                    size="large"
                                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                    value={passwords.newPassword}
                                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                    disabled={isPasswordBusy}
                                    className="rounded-lg"
                                />
                                <PasswordStrengthMeter password={passwords.newPassword} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <Input.Password
                                    size="large"
                                    placeholder="Nhập lại chính xác mật khẩu mới"
                                    value={passwords.confirmPassword}
                                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                    disabled={isPasswordBusy}
                                    className="rounded-lg"
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    size="large"
                                    type="primary"
                                    icon={<KeyOutlined />}
                                    onClick={handleUpdatePassword}
                                    loading={changingPassword}
                                    disabled={isPasswordBusy}
                                    className="rounded-lg font-semibold"
                                >
                                    Cập nhật mật khẩu
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Session & Guidelines (1 col) */}
                    <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                                <SafetyOutlined className="text-blue-600" />
                                Quản lý phiên làm việc & An toàn
                            </h4>
                            <div className="space-y-3 text-xs text-slate-600">
                                <div className="p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                                        <CheckCircleOutlined className="text-emerald-500" />
                                        Phiên làm việc JWT an toàn
                                    </div>
                                    <p className="text-slate-500 m-0">
                                        Thời hạn phiên làm việc tiêu chuẩn: 24 giờ. Nếu chọn tùy chọn &quot;Ghi nhớ đăng nhập&quot;, thời hạn phiên kéo dài 30 ngày an toàn.
                                    </p>
                                </div>

                                <div className="p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="font-semibold text-slate-800 mb-1">
                                        Nguyên tắc an toàn học vụ
                                    </div>
                                    <ul className="list-disc pl-4 space-y-1 text-slate-500 m-0">
                                        <li>Tuyệt đối không chia sẻ mật khẩu tài khoản học vụ cho người khác.</li>
                                        <li>Luôn đăng xuất sau khi sử dụng máy tính tại phòng Lab hoặc thư viện.</li>
                                        <li>Nên đặt mật khẩu có kết hợp chữ hoa, chữ số và ký tự đặc biệt.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400">
                            Hệ thống tự động đồng bộ và thu hồi phiên làm việc khi có cập nhật phân quyền quản trị.
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'roles_permissions',
            label: (
                <span className="flex items-center gap-2">
                    <SafetyCertificateOutlined />
                    Vai trò & Quyền hạn
                </span>
            ),
            children: (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Permission Groups */}
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                                <TeamOutlined className="text-blue-600" />
                                Nhóm quyền học vụ (Permission Groups)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {(user?.permissionGroups || []).length > 0 ? (
                                    user.permissionGroups.map((group, idx) => (
                                        <Tag key={idx} color="purple" className="px-3 py-1 rounded-full text-xs font-semibold">
                                            {typeof group === 'string' ? group : group?.code || 'NHOM_QUYEN'}
                                        </Tag>
                                    ))
                                ) : (
                                    <Tag color="default" className="px-3 py-1 rounded-full text-xs">
                                        {isStudent ? 'SYSTEM_STUDENT_BASE' : 'GVHD'}
                                    </Tag>
                                )}
                            </div>
                        </div>

                        {/* Council Assignments */}
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                                <ScheduleOutlined className="text-blue-600" />
                                Phân công Hội đồng học vụ
                            </h4>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                                    <span className="font-medium text-slate-700">Hội đồng Xét duyệt Đề cương (BM01)</span>
                                    {user?.hasOutlineCouncilAssignment ? (
                                        <Tag color="success" className="m-0">Đã được phân công</Tag>
                                    ) : (
                                        <Tag color="default" className="m-0">Chưa phân công</Tag>
                                    )}
                                </div>
                                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                                    <span className="font-medium text-slate-700">Hội đồng Chấm Bảo vệ Khóa luận (BM05)</span>
                                    {user?.hasDefenseCouncilAssignment ? (
                                        <Tag color="success" className="m-0">Đã được phân công</Tag>
                                    ) : (
                                        <Tag color="default" className="m-0">Chưa phân công</Tag>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Capabilities */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                            <SafetyCertificateOutlined className="text-blue-600" />
                            Danh mục quyền hạn chi tiết trên hệ thống (Capabilities)
                        </h4>
                        <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                            {(user?.permissions || []).length > 0 ? (
                                user.permissions.map((perm, idx) => (
                                    <Tag key={idx} color="blue" className="text-[11px] font-mono rounded m-0.5">
                                        {perm}
                                    </Tag>
                                ))
                            ) : (
                                <span className="text-xs text-slate-500 p-2">
                                    Áp dụng bộ quyền cơ sở mặc định của vai trò {roleName}.
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="py-2">
            <PageHeader
                title="Hồ sơ cá nhân"
                subtitle="Quản lý thông tin tài khoản, danh tính học thuật và bảo mật."
            />

            {/* Academic Hero Profile Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm mb-6">
                {/* Gradient Cover Banner */}
                <div className="h-36 sm:h-44 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                </div>

                {/* Profile Identity Bar */}
                <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-14 sm:-mt-16">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                        {/* Avatar Ring & Upload Button */}
                        <div className="relative inline-block">
                            <Avatar
                                size={112}
                                icon={!tempProfile.avatarUrl && <UserOutlined />}
                                src={tempProfile.avatarUrl}
                                className="bg-blue-600 text-white ring-4 ring-white shadow-lg text-4xl"
                            />
                            {editing && (
                                <Upload customRequest={handleUploadAvatar} showUploadList={false} accept="image/*">
                                    <Button
                                        type="primary"
                                        shape="circle"
                                        size="middle"
                                        icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
                                        className="absolute bottom-0 right-0 shadow-md"
                                        disabled={uploading}
                                    />
                                </Upload>
                            )}
                        </div>

                        {/* Name & Academic Tags */}
                        <div className="space-y-1.5 pb-1">
                            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                                {tempProfile.name || 'Người dùng'}
                            </h2>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                <Tag color={roleColor} className="px-2.5 py-0.5 rounded-full font-semibold">
                                    {roleName}
                                </Tag>
                                <Tag color="blue" icon={<CheckCircleOutlined />} className="px-2.5 py-0.5 rounded-full">
                                    Đại học Thủ Dầu Một — Viện Công nghệ số
                                </Tag>
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                    <Badge status="success" />
                                    Đang hoạt động
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-0.5">
                                <span className="flex items-center gap-1">
                                    <IdcardOutlined className="text-slate-400" />
                                    {isStudent ? 'MSSV' : 'Mã CB'}: <strong className="text-slate-700">{tempProfile.employeeId}</strong>
                                </span>
                                <span className="flex items-center gap-1">
                                    <MailOutlined className="text-slate-400" />
                                    <span className="text-slate-700">{tempProfile.email}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center justify-center md:justify-end gap-2 pb-1">
                        {!editing ? (
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                onClick={() => setEditing(true)}
                                disabled={isProfileBusy}
                                className="rounded-lg font-medium shadow-sm"
                            >
                                Chỉnh sửa hồ sơ
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    icon={<CloseOutlined />}
                                    onClick={handleCancel}
                                    disabled={isProfileBusy}
                                    className="rounded-lg font-medium"
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    onClick={handleSave}
                                    loading={savingProfile}
                                    disabled={!hasProfileChanges || isProfileBusy}
                                    className="rounded-lg font-medium shadow-sm"
                                >
                                    Lưu thay đổi
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick KPI Metrics Bar */}
            <ProfileQuickMetrics
                user={user}
                roleName={roleName}
                roleColor={roleColor}
                isStudent={isStudent}
            />

            {/* 3 Specialized Tabs */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <Tabs
                    defaultActiveKey="personal_academic"
                    items={tabItems}
                />
            </div>
        </div>
    );
}

export default ProfilePage;
