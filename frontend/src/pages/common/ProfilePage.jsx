import { useState, useEffect, useMemo } from 'react';
import {
    Button,
    Input,
    Avatar,
    Upload,
    Tag,
    message,
} from 'antd';
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    IdcardOutlined,
    EditOutlined,
    SaveOutlined,
    CameraOutlined,
    BankOutlined,
    LockOutlined,
    KeyOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import uploadService from '../../services/uploadService';
import PageHeader from '../../components/common/PageHeader';

function ProfilePage() {
    const { user, updateUser } = useAuthStore();

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
            });
        }
    }, [user]);

    const isProfileBusy = savingProfile || uploading;
    const isPasswordBusy = changingPassword;

    const hasProfileChanges = useMemo(() => {
        if (!user) return false;
        return (
            (tempProfile.avatarUrl || '') !== (user.avatarUrl || '') ||
            (tempProfile.phone || '') !== (user.phone || '') ||
            (tempProfile.department || '') !== (user.department || '')
        );
    }, [tempProfile, user]);

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
            message.success('Tải ảnh lên thành công. Bấm Lưu thay đổi để cập nhật.');
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
            const res = await authService.updateProfile({
                avatarUrl: tempProfile.avatarUrl,
                phone: tempProfile.phone,
                department: tempProfile.department,
            });

            if (res?.success && res?.data) {
                updateUser({ ...user, ...res.data });
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
            name: user.fullName || '',
            email: user.email || '',
            phone: user.phone || '',
            employeeId: user.code || '',
            department: user.department || '',
            role: user.role || '',
            avatarUrl: user.avatarUrl || '',
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

    const roleName = user.role === 'ADMIN' ? 'Quản trị viên' : user.role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên';
    const roleColor = user.role === 'ADMIN' ? 'red' : user.role === 'LECTURER' ? 'blue' : 'green';

    return (
        <div className="py-2">
            <PageHeader
                title="Hồ sơ cá nhân"
                subtitle="Quản lý thông tin tài khoản và bảo mật."
                actions={
                    !editing ? (
                        <Button icon={<EditOutlined />} onClick={() => setEditing(true)} disabled={isProfileBusy}>
                            Chỉnh sửa hồ sơ
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button onClick={handleCancel} disabled={isProfileBusy}>Hủy</Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSave}
                                loading={savingProfile}
                                disabled={!hasProfileChanges || isProfileBusy}
                            >
                                Lưu thay đổi
                            </Button>
                        </div>
                    )
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - Avatar and Basic Info */}
                <div className="md:col-span-1 border border-slate-200">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
                        <div className="relative inline-block mb-4">
                            <Avatar
                                size={120}
                                icon={!tempProfile.avatarUrl && <UserOutlined />}
                                src={tempProfile.avatarUrl}
                                className="bg-primary text-white border-2 border-white shadow-md text-4xl"
                            />
                            {editing && (
                                <Upload customRequest={handleUploadAvatar} showUploadList={false} accept="image/*">
                                    <Button
                                        type="primary"
                                        shape="circle"
                                        size="middle"
                                        icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
                                        className="absolute bottom-0 right-0 shadow"
                                        disabled={uploading}
                                    />
                                </Upload>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{tempProfile.name}</h3>
                        <Tag color={roleColor} className="mt-2 mb-4 px-3 py-1 rounded-full">{roleName}</Tag>
                        
                        <div className="w-full border-t border-slate-100 my-4"></div>
                        
                        <div className="w-full flex flex-col gap-3">
                            <div className="flex items-center gap-3 text-slate-600">
                                <MailOutlined className="text-slate-400" />
                                <span className="text-sm font-medium truncate" title={tempProfile.email}>{tempProfile.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <PhoneOutlined className="text-slate-400" />
                                <span className="text-sm font-medium">{tempProfile.phone || 'Chưa cập nhật'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <IdcardOutlined className="text-slate-400" />
                                <span className="text-sm font-medium">{tempProfile.employeeId}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Detailed Info and Password */}
                <div className="md:col-span-2 flex flex-col gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <IdcardOutlined />
                                Thông tin chi tiết
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                    <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded border border-slate-200">{tempProfile.name}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                                    <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded border border-slate-200">{tempProfile.email}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số điện thoại</label>
                                    {editing ? (
                                        <Input size="large" value={tempProfile.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="0901234567" disabled={isProfileBusy} />
                                    ) : (
                                        <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded border border-transparent">{tempProfile.phone || '---'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã nhân viên / MSSV</label>
                                    <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded border border-slate-200">{tempProfile.employeeId}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Đơn vị / Khoa</label>
                                    {editing ? (
                                        <Input size="large" value={tempProfile.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="VD: Khoa CNTT" disabled={isProfileBusy} />
                                    ) : (
                                        <div className="text-sm font-medium text-slate-900 bg-slate-50 p-2.5 rounded border border-transparent flex items-center gap-2">
                                            <BankOutlined className="text-slate-400" />
                                            {tempProfile.department || '---'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <LockOutlined /> 
                                Đổi mật khẩu
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu hiện tại</label>
                                    <Input.Password size="large" placeholder="Nhập mật khẩu cũ" value={passwords.currentPassword} onChange={(e) => handlePasswordChange('currentPassword', e.target.value)} disabled={isPasswordBusy} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu mới</label>
                                    <Input.Password size="large" placeholder="Nhập mật khẩu mới" value={passwords.newPassword} onChange={(e) => handlePasswordChange('newPassword', e.target.value)} disabled={isPasswordBusy} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Xác nhận mật khẩu</label>
                                    <Input.Password size="large" placeholder="Nhập lại mật khẩu mới" value={passwords.confirmPassword} onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)} disabled={isPasswordBusy} />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <Button size="large" type="primary" icon={<KeyOutlined />} onClick={handleUpdatePassword} loading={changingPassword} disabled={isPasswordBusy}>
                                    Cập nhật mật khẩu
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;
