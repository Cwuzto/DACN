import { useState } from 'react';
import {
    Input,
    Button,
    message,
} from 'antd';
import {
    LockOutlined,
    KeyOutlined,
    SafetyOutlined,
    CheckCircleOutlined,
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
    );
}

export default PasswordSecurityTab;

