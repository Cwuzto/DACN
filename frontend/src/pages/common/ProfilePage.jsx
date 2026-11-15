import { useState, useEffect, useMemo } from 'react';
import {
    Tabs,
    message,
} from 'antd';
import {
    BankOutlined,
    BookOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import uploadService from '../../services/uploadService';
import PageHeader from '../../components/common/PageHeader';
import { queryKeys } from '../../query/queryKeys';
import { useCurrentUser } from '../../queries/userQueries';
import { useQueryClient } from '@tanstack/react-query';

import ProfileIdentityCard from '../../components/profile/ProfileIdentityCard';
import LecturerTopicList from '../../components/profile/LecturerTopicList';
import StudentThesisProgressCard from '../../components/profile/StudentThesisProgressCard';
import LecturerAcademicInfoTab from '../../components/profile/LecturerAcademicInfoTab';
import PasswordSecurityTab from '../../components/profile/PasswordSecurityTab';

function ProfilePage() {
    const { user: authUser, updateUser } = useAuthStore();
    const scope = queryKeys.scope(authUser);
    const userQuery = useCurrentUser(scope, Boolean(authUser));
    const user = userQuery.data || authUser;
    const queryClient = useQueryClient();

    const isStudent = user?.role === 'STUDENT';
    const isLecturer = user?.role === 'LECTURER';

    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [tempProfile, setTempProfile] = useState({});

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
                researchInterests: user.researchInterests || [
                    'Kỹ thuật phần mềm (Software Engineering)',
                    'Kiến trúc Microservices & Cloud',
                    'Trí tuệ nhân tạo (AI)',
                ],
            });
        }
    }, [user]);

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

    const handleFieldChange = (field, value) => {
        setTempProfile((prev) => ({ ...prev, [field]: value }));
    };

    const handleUploadAvatar = async (options) => {
        const { file, onSuccess, onError } = options;
        try {
            setUploading(true);
            const data = await uploadService.uploadFile(file, 'avatars');
            handleFieldChange('avatarUrl', data.data.url);
            onSuccess(data);
            message.success('Tải ảnh đại diện thành công. Bấm Lưu thay đổi để hoàn tất.');
        } catch (error) {
            onError(error);
            message.error(error?.message || 'Tải ảnh lên thất bại.');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveProfile = async () => {
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

    const handleCancelEdit = () => {
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
                researchInterests: user.researchInterests || [
                    'Kỹ thuật phần mềm (Software Engineering)',
                    'Kiến trúc Microservices & Cloud',
                    'Trí tuệ nhân tạo (AI)',
                ],
            });
        }
        setEditing(false);
    };

    if (!user) {
        return <div className="p-8 text-center text-slate-500">Đang tải thông tin hồ sơ...</div>;
    }

    // Role-specific Tabs Configuration
    const tabItems = isLecturer
        ? [
              {
                  key: 'teaching_info',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <BankOutlined />
                          Công tác & Chuyên môn
                      </span>
                  ),
                  children: (
                      <LecturerAcademicInfoTab
                          user={user}
                          editing={editing}
                          tempProfile={tempProfile}
                          onFieldChange={handleFieldChange}
                      />
                  ),
              },
              {
                  key: 'supervised_topics',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <BookOutlined />
                          Đề tài & Sinh viên hướng dẫn
                      </span>
                  ),
                  children: <LecturerTopicList user={user} scope={scope} />,
              },
              {
                  key: 'security_password',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <LockOutlined />
                          Bảo mật & Mật khẩu
                      </span>
                  ),
                  children: <PasswordSecurityTab />,
              },
          ]
        : isStudent
        ? [
              {
                  key: 'student_thesis',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <BookOutlined />
                          Đồ án tốt nghiệp của tôi
                      </span>
                  ),
                  children: <StudentThesisProgressCard user={user} scope={scope} />,
              },
              {
                  key: 'security_password',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <LockOutlined />
                          Bảo mật & Mật khẩu
                      </span>
                  ),
                  children: <PasswordSecurityTab />,
              },
          ]
        : [
              // Admin Experience
              {
                  key: 'admin_info',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <SafetyCertificateOutlined />
                          Quyền hạn & Quản trị
                      </span>
                  ),
                  children: (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              <SafetyCertificateOutlined className="text-red-600" />
                              Đặc quyền Quản trị hệ thống (System Administrator)
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed m-0">
                              Tài khoản quản trị viên tối cao có toàn quyền quản lý đợt đồ án, danh mục đề tài,
                              phân quyền người dùng và thiết lập tham số hệ thống cho toàn bộ Viện Công nghệ số.
                          </p>
                      </div>
                  ),
              },
              {
                  key: 'security_password',
                  label: (
                      <span className="flex items-center gap-2 font-medium">
                          <LockOutlined />
                          Bảo mật & Mật khẩu
                      </span>
                  ),
                  children: <PasswordSecurityTab />,
              },
          ];

    return (
        <div className="py-2 space-y-5">
            <PageHeader
                title="Hồ sơ cá nhân"
                subtitle="Quản lý thông tin tài khoản, danh tính học thuật và bảo mật."
            />

            {/* Two-Column Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Identity & Contact Card (~33%) */}
                <div className="lg:col-span-4 xl:col-span-4">
                    <ProfileIdentityCard
                        user={user}
                        editing={editing}
                        setEditing={setEditing}
                        tempProfile={tempProfile}
                        onFieldChange={handleFieldChange}
                        onSave={handleSaveProfile}
                        onCancel={handleCancelEdit}
                        savingProfile={savingProfile}
                        uploading={uploading}
                        onUploadAvatar={handleUploadAvatar}
                        hasChanges={hasProfileChanges}
                    />
                </div>

                {/* Right Column: Role-Specific Tabbed Panels (~67%) */}
                <div className="lg:col-span-8 xl:col-span-8 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <Tabs
                        defaultActiveKey={isLecturer ? 'supervised_topics' : isStudent ? 'student_thesis' : 'admin_info'}
                        items={tabItems}
                    />
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;
