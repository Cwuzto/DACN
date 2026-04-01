import { useState, useEffect, useMemo } from 'react';
import {
    Card, Typography, Flex, Button, Input, Avatar, Row, Col, Divider,
    Upload, Tag, Space, message,
} from 'antd';
import {
    UserOutlined, MailOutlined, PhoneOutlined, IdcardOutlined,
    EditOutlined, SaveOutlined, CameraOutlined, BankOutlined,
    LockOutlined, KeyOutlined, LoadingOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import { authService } from '../../services/authService';
import uploadService from '../../services/uploadService';

const { Title, Text } = Typography;

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
            message.success('Tai anh len thanh cong. Bam Luu thay doi de cap nhat.');
        } catch (error) {
            onError(error);
            message.error(error?.message || 'Tai anh len that bai.');
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
            updateUser({ ...user, ...res.data.data });
            setEditing(false);
            message.success('Cap nhat thong tin thanh cong.');
        } catch (error) {
            message.error(error?.message || 'Cap nhat that bai.');
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
                message.warning('Vui long nhap du cac truong mat khau.');
                return;
            }
            if (passwords.newPassword !== passwords.confirmPassword) {
                message.error('Mat khau xac nhan khong khop.');
                return;
            }
            setChangingPassword(true);
            await authService.changePassword(passwords.currentPassword, passwords.newPassword);
            message.success('Doi mat khau thanh cong.');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            message.error(error?.message || 'Doi mat khau that bai.');
        } finally {
            setChangingPassword(false);
        }
    };

    if (!user) return <div style={{ padding: 24 }}>Dang tai thong tin...</div>;

    const roleName = user.role === 'ADMIN' ? 'Quan tri vien' : user.role === 'LECTURER' ? 'Giang vien' : 'Sinh vien';
    const roleColor = user.role === 'ADMIN' ? 'red' : user.role === 'LECTURER' ? 'blue' : 'green';

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Ho so ca nhan</Title>
                {!editing ? (
                    <Button icon={<EditOutlined />} onClick={() => setEditing(true)} disabled={isProfileBusy}>Chinh sua</Button>
                ) : (
                    <Space>
                        <Button onClick={handleCancel} disabled={isProfileBusy}>Huy</Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={savingProfile}
                            disabled={!hasProfileChanges || isProfileBusy}
                        >
                            Luu thay doi
                        </Button>
                    </Space>
                )}
            </Flex>

            <Row gutter={[24, 24]}>
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
                                <Upload customRequest={handleUploadAvatar} showUploadList={false} accept="image/*">
                                    <Button
                                        type="primary"
                                        shape="circle"
                                        size="middle"
                                        icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
                                        style={{ position: 'absolute', bottom: 0, right: 0 }}
                                        disabled={uploading}
                                    />
                                </Upload>
                            )}
                        </div>
                        <Title level={5} style={{ margin: '8px 0 4px' }}>{tempProfile.name}</Title>
                        <Tag color={roleColor}>{roleName}</Tag>
                        <Divider />
                        <Flex vertical gap={12} align="flex-start">
                            <Flex gap={8} align="center"><MailOutlined style={{ color: '#8c8c8c' }} /><Text style={{ fontSize: 13 }}>{tempProfile.email}</Text></Flex>
                            <Flex gap={8} align="center"><PhoneOutlined style={{ color: '#8c8c8c' }} /><Text style={{ fontSize: 13 }}>{tempProfile.phone || 'Chua cap nhat'}</Text></Flex>
                            <Flex gap={8} align="center"><IdcardOutlined style={{ color: '#8c8c8c' }} /><Text style={{ fontSize: 13 }}>{tempProfile.employeeId}</Text></Flex>
                        </Flex>
                    </Card>
                </Col>

                <Col xs={24} md={16}>
                    <Card title="Thong tin chi tiet" style={{ borderRadius: 10, marginBottom: 16 }}>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Ho va ten <Text type="danger">*</Text></Text>
                                <div><Text strong>{tempProfile.name}</Text></div>
                                <Text type="secondary" style={{ fontSize: 11 }}>Chi Admin moi co the sua ten.</Text>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
                                <div><Text strong>{tempProfile.email}</Text></div>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>So dien thoai</Text>
                                {editing ? (
                                    <Input value={tempProfile.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="0901234567" disabled={isProfileBusy} />
                                ) : (
                                    <div><Text strong>{tempProfile.phone || '---'}</Text></div>
                                )}
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Ma nhan vien / MSSV</Text>
                                <div><Text strong>{tempProfile.employeeId}</Text></div>
                            </Col>
                            <Col xs={24} md={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Don vi / Khoa</Text>
                                {editing ? (
                                    <Input value={tempProfile.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="Khoa CNTT" disabled={isProfileBusy} />
                                ) : (
                                    <div><Flex align="center" gap={6}><BankOutlined style={{ color: '#8c8c8c' }} /><Text strong>{tempProfile.department || '---'}</Text></Flex></div>
                                )}
                            </Col>
                        </Row>
                    </Card>

                    <Card title={<><LockOutlined /> Doi mat khau</>} style={{ borderRadius: 10 }}>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Mat khau hien tai</Text>
                                <Input.Password placeholder="Nhap mat khau cu" value={passwords.currentPassword} onChange={(e) => handlePasswordChange('currentPassword', e.target.value)} disabled={isPasswordBusy} />
                            </Col>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Mat khau moi</Text>
                                <Input.Password placeholder="Nhap mat khau moi" value={passwords.newPassword} onChange={(e) => handlePasswordChange('newPassword', e.target.value)} disabled={isPasswordBusy} />
                            </Col>
                            <Col xs={24} md={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Xac nhan mat khau</Text>
                                <Input.Password placeholder="Nhap lai mat khau moi" value={passwords.confirmPassword} onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)} disabled={isPasswordBusy} />
                            </Col>
                        </Row>
                        <Flex justify="flex-end" style={{ marginTop: 16 }}>
                            <Button type="primary" icon={<KeyOutlined />} onClick={handleUpdatePassword} loading={changingPassword} disabled={isPasswordBusy}>
                                Cap nhat mat khau
                            </Button>
                        </Flex>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default ProfilePage;
