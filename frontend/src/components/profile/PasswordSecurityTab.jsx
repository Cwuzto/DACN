import { useState } from 'react';
import {
    Input,
    Button,
    message,
} from 'antd';
import {
    LockOutlined,
    KeyOutlined,
} from '@ant-design/icons';
import { authService } from '../../services/authService';
import PasswordStrengthMeter from './PasswordStrengthMeter';

function PasswordSecurityTab() {
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handlePasswordChange = (field, value) => {
        setPasswords((prev) => ({ ...prev, [field]: value }));
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

    return (
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-sm max-w-xl">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                <LockOutlined className="text-blue-600" />
                Đổi mật khẩu tài khoản
            </h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Mật khẩu hiện tại <span className="text-red-500">*</span>
                    </label>
                    <Input.Password
                        size="large"
                        placeholder="Nhập mật khẩu cũ của bạn"
                        value={passwords.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        disabled={changingPassword}
                        className="rounded-lg text-sm"
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
                        disabled={changingPassword}
                        className="rounded-lg text-sm"
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
                        disabled={changingPassword}
                        className="rounded-lg text-sm"
                    />
                </div>

                <div className="pt-2">
                    <Button
                        size="large"
                        type="primary"
                        icon={<KeyOutlined />}
                        onClick={handleUpdatePassword}
                        loading={changingPassword}
                        disabled={changingPassword}
                        className="rounded-lg font-semibold shadow-sm"
                    >
                        Cập nhật mật khẩu
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PasswordSecurityTab;
