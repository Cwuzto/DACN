const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * POST /api/auth/login
 * Đăng nhập bằng email + password, trả về JWT token
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

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

        // 5. Tạo JWT token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // 6. Trả kết quả (không trả passwordHash)
        res.json({
            success: true,
            message: 'Đăng nhập thành công.',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    code: user.code,
                    role: user.role,
                    department: user.department,
                    avatarUrl: user.avatarUrl,
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
        res.json({
            success: true,
            data: req.user,
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
        const { avatarUrl, phone, department } = req.body;

        // Chỉ cho phép cập nhật các trường an toàn
        const updateData = {};
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (phone !== undefined) updateData.phone = phone;
        if (department !== undefined) updateData.department = department;

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
                phone: true,
            }
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
