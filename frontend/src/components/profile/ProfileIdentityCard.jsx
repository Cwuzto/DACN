import {
    Avatar,
    Button,
    Input,
    Tag,
    Upload,
    Badge,
} from 'antd';
import {
    UserOutlined,
    EditOutlined,
    SaveOutlined,
    CloseOutlined,
    CameraOutlined,
    LoadingOutlined,
    PhoneOutlined,
    MailOutlined,
    IdcardOutlined,
    BankOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { getUserDisplayRole, isInstituteDirector } from '../../utils/authRedirect';

function formatCohortDisplay(className) {
    if (!className) return 'D22 — Nhập học năm 2022';
    const match = String(className).match(/^[dD](\d{2})/);
    if (match) {
        const year = match[1];
        return `D${year} — Nhập học năm 20${year}`;
    }
    return 'D22 — Nhập học năm 2022';
}

function getAcademicTitleLabel(title) {
    switch (title) {
        case 'PHO_GIAO_SU':
            return 'PGS.TS';
        case 'GIAO_SU':
            return 'GS.TS';
        case 'TIEN_SI':
            return 'TS';
        case 'THAC_SI':
            return 'ThS';
        default:
            return null;
    }
}

function ProfileIdentityCard({
    user,
    editing,
    setEditing,
    tempProfile,
    onFieldChange,
    onSave,
    onCancel,
    savingProfile,
    uploading,
    onUploadAvatar,
    hasChanges,
}) {
    const isStudent = user?.role === 'STUDENT';
    const roleName = getUserDisplayRole(user);
    const roleColor = isInstituteDirector(user)
        ? 'purple'
        : user?.role === 'ADMIN'
        ? 'red'
        : user?.role === 'LECTURER'
        ? 'blue'
        : 'green';

    const academicTitleText = getAcademicTitleLabel(user?.academicTitle);
    const isBusy = savingProfile || uploading;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Profile Avatar & Primary Info */}
            <div className="p-6 relative flex flex-col">
                <div className="flex items-end justify-between gap-3">
                    <div className="relative inline-block">
                        <Avatar
                            size={96}
                            icon={!tempProfile.avatarUrl && <UserOutlined />}
                            src={tempProfile.avatarUrl}
                            className="bg-blue-600 text-white ring-4 ring-slate-100 shadow-sm text-3xl"
                        />
                        {editing && (
                            <Upload customRequest={onUploadAvatar} showUploadList={false} accept="image/*">
                                <Button
                                    type="primary"
                                    shape="circle"
                                    size="small"
                                    icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
                                    className="absolute bottom-0 right-0 shadow-md"
                                    disabled={uploading}
                                />
                            </Upload>
                        )}
                    </div>

                    <div className="pb-1">
                        {!editing ? (
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                onClick={() => setEditing(true)}
                                disabled={isBusy}
                                className="rounded-lg font-medium shadow-sm"
                            >
                                Chỉnh sửa hồ sơ
                            </Button>
                        ) : (
                            <div className="flex gap-1.5">
                                <Button
                                    icon={<CloseOutlined />}
                                    onClick={onCancel}
                                    disabled={isBusy}
                                    className="rounded-lg font-medium"
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    onClick={onSave}
                                    loading={savingProfile}
                                    disabled={!hasChanges || isBusy}
                                    className="rounded-lg font-medium shadow-sm"
                                >
                                    Lưu thay đổi
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Name & Academic Rank */}
                <div className="mt-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900 m-0">
                            {tempProfile.name || user?.fullName || 'Người dùng'}
                        </h2>
                        {academicTitleText && (
                            <Tag color="cyan" className="font-semibold text-xs m-0">
                                {academicTitleText}
                            </Tag>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <Tag color={roleColor} className="px-2 py-0.5 rounded-full text-xs font-semibold m-0">
                            {roleName}
                        </Tag>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Badge status="success" />
                            Đang hoạt động
                        </span>
                    </div>
                </div>

                {/* Academic Institution Line */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                        <BankOutlined className="text-blue-600 text-sm flex-shrink-0" />
                        <span className="font-medium text-slate-800">Trường Đại học Thủ Dầu Một</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                        <BankOutlined className="text-indigo-600 text-sm flex-shrink-0" />
                        <span className="font-medium text-slate-800">Viện Công nghệ số</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 font-mono">
                        <IdcardOutlined className="text-slate-400 text-sm flex-shrink-0" />
                        <span className="text-slate-500">{isStudent ? 'MSSV:' : 'Mã CB:'}</span>
                        <strong className="text-slate-800">{tempProfile.employeeId || user?.code}</strong>
                    </div>

                    {isStudent ? (
                        <>
                            <div className="flex items-center gap-2 text-slate-600">
                                <SafetyCertificateOutlined className="text-slate-400 text-sm flex-shrink-0" />
                                <span className="text-slate-500">Ngành:</span>
                                <span className="font-semibold text-slate-800">{tempProfile.major || 'Công nghệ thông tin'}</span>
                            </div>

                            <div className="flex items-center gap-2 text-slate-600">
                                <SafetyCertificateOutlined className="text-slate-400 text-sm flex-shrink-0" />
                                <span className="text-slate-500">Khóa:</span>
                                <span className="font-semibold text-slate-800">{formatCohortDisplay(tempProfile.className)}</span>
                            </div>

                            <div className="flex items-center gap-2 text-slate-600 font-mono">
                                <SafetyCertificateOutlined className="text-slate-400 text-sm flex-shrink-0" />
                                <span className="text-slate-500">Lớp hành chính:</span>
                                <span className="font-semibold text-slate-800">{tempProfile.className || 'D22CNTT01'}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-start gap-2 text-slate-600">
                            <SafetyCertificateOutlined className="text-slate-400 text-sm flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="text-slate-500">Bộ môn: </span>
                                {editing ? (
                                    <Input
                                        size="small"
                                        value={tempProfile.department}
                                        onChange={(e) => onFieldChange('department', e.target.value)}
                                        placeholder="Nhập tên bộ môn"
                                        className="mt-1 text-xs"
                                        disabled={isBusy}
                                    />
                                ) : (
                                    <span className="font-semibold text-slate-800">
                                        {tempProfile.department || 'Chưa cập nhật bộ môn'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contact Information Section */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                    <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-400 mb-1">
                        Thông tin liên hệ
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 truncate">
                            <MailOutlined className="text-slate-400 text-sm flex-shrink-0" />
                            <span className="text-slate-700 truncate font-mono text-xs">{tempProfile.email}</span>
                        </div>
                        <Tag color="cyan" className="m-0 text-[10px] flex-shrink-0 font-medium">Trường cấp</Tag>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-[11px] text-slate-500 font-medium">
                            Số điện thoại {editing && <span className="text-blue-600">(Có thể sửa)</span>}
                        </label>
                        {editing ? (
                            <Input
                                size="middle"
                                prefix={<PhoneOutlined className="text-slate-400" />}
                                value={tempProfile.phone}
                                onChange={(e) => onFieldChange('phone', e.target.value)}
                                placeholder="VD: 0901234567"
                                className="rounded-lg text-xs"
                                disabled={isBusy}
                            />
                        ) : (
                            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-800 font-mono text-xs">
                                <PhoneOutlined className="text-slate-400 text-sm flex-shrink-0" />
                                <span>{tempProfile.phone || 'Chưa cập nhật SĐT'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileIdentityCard;

