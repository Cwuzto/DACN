const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { resolveUserCapabilities } = require('../auth/capabilityResolver');

/**
 * POST /api/auth/login
 * Đăng nhập bằng email + password, trả về JWT token
 */
const login = async (req, res, next) => {
    try {
        const { email, password, remember } = req.body;

        // 1. Kiểm tra đầu vào
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email và mật khẩu.',
            });
        }

        // 2. Tìm user theo email
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, passwordHash: true, isActive: true },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không chính xác.',
            });
        }

        // 3. Kiểm tra tài khoản có active không
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ Quản trị viên.',
            });
        }

        // 4. So sánh mật khẩu
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không chính xác.',
            });
        }

        // 5. Phân giải capabilities thống nhất qua capabilityResolver
        const identity = await resolveUserCapabilities({ userId: user.id, db: prisma });
        if (!identity) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hoá.',
            });
        }

        // 6. Tạo JWT token với thời hạn linh hoạt theo lựa chọn Ghi nhớ
        const isRemembered = Boolean(remember);
        const expiresIn = isRemembered
            ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d')
            : (process.env.JWT_EXPIRES_IN || '1d');

        const tokenPayload = { userId: identity.id, role: identity.role };
        if (typeof identity.permissionVersion === 'number') {
            tokenPayload.permissionVersion = identity.permissionVersion;
        }
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn }
        );

        // 7. Trả kết quả (không trả passwordHash)
        res.json({
            success: true,
            message: 'Đăng nhập thành công.',
            data: {
                token,
                user: {
                    id: identity.id,
                    email: identity.email,
                    fullName: identity.fullName,
                    code: identity.code,
                    role: identity.role,
                    department: identity.department,
                    avatarUrl: identity.avatarUrl,
                    permissionGroups: identity.permissionGroups,
                    permissions: identity.permissions,
                    hasDefenseCouncilAssignment: identity.hasDefenseCouncilAssignment,
                    hasOutlineCouncilAssignment: identity.hasOutlineCouncilAssignment,
                    permissionVersion: identity.permissionVersion,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại (cần authenticate trước)
 */
const getMe = async (req, res, next) => {
    try {
        const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
        const tokenPayload = { userId: req.user.id, role: req.user.role };
        if (typeof req.user.permissionVersion === 'number') {
            tokenPayload.permissionVersion = req.user.permissionVersion;
        }
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn }
        );

        res.json({
            success: true,
            data: req.user,
            token,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/change-password
 * Đổi mật khẩu
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
            });
        }

        // Lấy user đầy đủ (có passwordHash)
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu hiện tại không chính xác.',
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash: hashedPassword },
        });

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/profile
 * Cập nhật thông tin profile hiện tại (bao gồm avatarUrl)
 */
const updateProfile = async (req, res, next) => {
    try {
        const { avatarUrl, avatar, avatarAssetId, phone, department } = req.body;

        // Chỉ cho phép cập nhật các trường an toàn
        const updateData = {};
        const resolvedAvatar = avatarUrl !== undefined ? avatarUrl : avatar;
        if (resolvedAvatar !== undefined) {
            updateData.avatarUrl = resolvedAvatar;
        }

        if (avatarAssetId !== undefined && avatarAssetId !== null) {
            updateData.avatarAssetId = avatarAssetId;
            updateData.avatarUrl = `/api/assets/${avatarAssetId}/download`;

            const currentUser = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, avatarAssetId: true },
            });

            if (currentUser?.avatarAssetId && currentUser.avatarAssetId !== avatarAssetId) {
                const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await prisma.storedAsset.updateMany({
                    where: { id: currentUser.avatarAssetId },
                    data: {
                        status: 'REPLACED',
                        replacedById: avatarAssetId,
                        retentionUntil: sevenDaysLater,
                    },
                });
            }
        }

        if (phone !== undefined) {
            updateData.phone = phone;
        }

        // Sinh viên tuyệt đối không thể tự đổi department hay thông tin học vụ
        if (req.user?.role !== 'STUDENT' && department !== undefined) {
            updateData.department = department;
        }

        const isStudent = req.user?.role === 'STUDENT';

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                avatarUrl: true,
                avatarAssetId: true,
                phone: true,
                ...(isStudent ? {
                    studentProfile: {
                        select: {
                            studentId: true,
                            gender: true,
                            dateOfBirth: true,
                            className: true,
                            major: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },
                } : {}),
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công.',
            data: updatedUser,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { login, getMe, changePassword, updateProfile };
