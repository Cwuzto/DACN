import { useState, useEffect } from 'react';
import {
    Card, Typography, Flex, Button, Input, Avatar, Row, Col, Divider,
    Upload, Tag, Space, message
} from 'antd';
import {
    UserOutlined, MailOutlined, PhoneOutlined, IdcardOutlined,
    EditOutlined, SaveOutlined, CameraOutlined, BankOutlined,
    LockOutlined, KeyOutlined, LoadingOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import uploadService from '../../services/uploadService';

const { Title, Text } = Typography;

function ProfilePage() {
    const { user, updateUser } = useAuthStore();

    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form state for profile
    const [tempProfile, setTempProfile] = useState({});

    // Form state for password
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
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
                avatarUrl: user.avatarUrl || ''
            });
        }
    }, [user]);

    const handleChange = (field, value) => {
        setTempProfile(prev => ({ ...prev, [field]: value }));
    };

    const handlePasswordChange = (field, value) => {
        setPasswords(prev => ({ ...prev, [field]: value }));
    };

    const handleUploadAvatar = async (options) => {
        const { file, onSuccess, onError } = options;
        try {
            setUploading(true);
            const data = await uploadService.uploadFile(file, 'avatars');
            handleChange('avatarUrl', data.data.url);
            onSuccess(data);
            message.success('Tải ảnh lên thành công. Vui lòng bấm "Lưu thay đổi" để cập nhật!');
        } catch (error) {
            console.error(error);
            onError(error);
            message.error(error.response?.data?.message || 'Tải ảnh lên thất bại!');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const res = await authService.updateProfile({
                avatarUrl: tempProfile.avatarUrl,
                phone: tempProfile.phone,
                department: tempProfile.department // Chỉ cho user cập nhật các trường được phép
            });
            updateUser({ ...user, ...res.data.data }); // update global store
            setEditing(false);
            message.success('Cập nhật thông tin thành công!');
        } catch (error) {
            message.error(error.response?.data?.message || 'Cập nhật thất bại.');
        } finally {
            setLoading(false);
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
            avatarUrl: user.avatarUrl || ''
        });
        setEditing(false);
    };

    const handleUpdatePassword = async () => {
        try {
            if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
                return message.warning('Vui lòng nhập đủ các trường mật khẩu!');
            }
            if (passwords.newPassword !== passwords.confirmPassword) {
                return message.error('Mật khẩu xác nhận không khớp!');
            }
            setLoading(true);
            await authService.changePassword(passwords.currentPassword, passwords.newPassword);
            message.success('Đổi mật khẩu thành công!');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            message.error(error.response?.data?.message || 'Đổi mật khẩu thất bại.');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div style={{ padding: 24 }}>Đang tải thông tin...</div>;

    const roleName = user.role === 'ADMIN' ? 'Quản trị viên' : user.role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên';
    const roleColor = user.role === 'ADMIN' ? 'red' : user.role === 'LECTURER' ? 'blue' : 'green';

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Hồ sơ Cá nhân</Title>
                {!editing ? (
                    <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Chỉnh sửa</Button>
                ) : (
                    <Space>
                        <Button onClick={handleCancel} disabled={loading}>Hủy</Button>
                        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>Lưu thay đổi</Button>
                    </Space>
                )}
            </Flex>

            <Row gutter={[24, 24]}>
                {/* Left: Avatar + Quick Info */}
                <Col xs={24} md={8}>
                    <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                            <Avatar
                                size={120}
                                icon={!tempProfile.avatarUrl && <UserOutlined />}
                                src={tempProfile.avatarUrl}
                                style={{ background: '#1677FF', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            />
                            {editing && (
                                <Upload
                                    customRequest={handleUploadAvatar}
                                    showUploadList={false}
                                    accept="image/*"
                                >
                                    <Button
                                        type="primary"
                                        shape="circle"
                                        size="middle"
                                        icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
                                        style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                        }}
                                        disabled={uploading}
                                    />
                                </Upload>
                            )}
                        </div>
                        <Title level={5} style={{ margin: '8px 0 4px' }}>{tempProfile.name}</Title>
                        <Tag color={roleColor}>{roleName}</Tag>
                        <Divider />
                        <Flex vertical gap={12} align="flex-start">
                            <Flex gap={8} align="center">
                                <MailOutlined style={{ color: '#8c8c8c' }} />
                                <Text style={{ fontSize: 13 }}>{tempProfile.email}</Text>
                            </Flex>
                            <Flex gap={8} align="center">
                                <PhoneOutlined style={{ color: '#8c8c8c' }} />
                                <Text style={{ fontSize: 13 }}>{tempProfile.phone || 'Chưa cập nhật'}</Text>
                            </Flex>
                            <Flex gap={8} align="center">
                                <IdcardOutlined style={{ color: '#8c8c8c' }} />
                                <Text style={{ fontSize: 13 }}>{tempProfile.employeeId}</Text>
                            </Flex>
                        </Flex>
                    </Card>
                </Col>

                {/* Right: Detail Info */}
                <Col xs={24} md={16}>
                    <Card title="Thông tin chi tiết" style={{ borderRadius: 10, marginBottom: 16 }}>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Họ và tên <Text type="danger">*</Text></Text>
                                <div><Text strong>{tempProfile.name}</Text></div>
                                <Text type="secondary" style={{ fontSize: 11 }}>Chỉ Admin mới có thể sửa Tên.</Text>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
                                <div><Text strong>{tempProfile.email}</Text></div>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Số điện thoại</Text>
                                {editing ? (
                                    <Input value={tempProfile.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="0901234567" />
                                ) : (
                                    <div><Text strong>{tempProfile.phone || '---'}</Text></div>
                                )}
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Mã nhân viên / MSSV</Text>
                                <div><Text strong>{tempProfile.employeeId}</Text></div>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Đơn vị / Khoa</Text>
                                {editing ? (
                                    <Input value={tempProfile.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="Khoa CNTT" />
                                ) : (
                                    <div>
                                        <Flex align="center" gap={6}>
                                            <BankOutlined style={{ color: '#8c8c8c' }} />
                                            <Text strong>{tempProfile.department || '---'}</Text>
                                        </Flex>
                                    </div>
                                )}
                            </Col>
                        </Row>
                    </Card>

                    {/* Password Change */}
                    <Card title={<><LockOutlined /> Đổi mật khẩu</>} style={{ borderRadius: 10 }}>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Mật khẩu hiện tại</Text>
                                <Input.Password
                                    placeholder="Nhập mật khẩu cũ"
                                    value={passwords.currentPassword}
                                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                />
                            </Col>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Mật khẩu mới</Text>
                                <Input.Password
                                    placeholder="Nhập mật khẩu mới"
                                    value={passwords.newPassword}
                                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                />
                            </Col>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Xác nhận mật khẩu</Text>
                                <Input.Password
                                    placeholder="Nhập lại mật khẩu mới"
                                    value={passwords.confirmPassword}
                                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                />
                            </Col>
                        </Row>
                        <Flex justify="flex-end" style={{ marginTop: 16 }}>
                            <Button
                                type="primary"
                                icon={<KeyOutlined />}
                                onClick={handleUpdatePassword}
                                loading={loading && passwords.currentPassword}
                            >
                                Cập nhật mật khẩu
                            </Button>
                        </Flex>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default ProfilePage;