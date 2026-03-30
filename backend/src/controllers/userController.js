const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

const generateUserCode = async (role) => {
    let prefix = 'US';
    let length = 4;

    if (role === 'ADMIN') {
        prefix = 'AD';
        length = 4;
    } else if (role === 'LECTURER') {
        prefix = 'GV';
        length = 6;
    } else if (role === 'STUDENT') {
        prefix = 'SV';
        length = 8; // VD: SV + 8 digits = SV20261234
    }

    let isUnique = false;
    let code = '';

    while (!isUnique) {
        // Generate random digits
        let randomNum = '';
        for (let i = 0; i < length; i++) {
            randomNum += Math.floor(Math.random() * 10);
        }

        code = `${prefix}${randomNum}`;

        // Kiểm tra xem mã này đã tồn tại chưa
        const existing = await prisma.user.findUnique({ where: { code } });
        if (!existing) {
            isUnique = true;
        }
    }

    return code;
};

// ============================
// USER CONTROLLER (Admin Only)
// CRUD + Lock/Unlock
// ============================

/**
 * GET /api/users
 * Lấy danh sách người dùng (Admin only)
 * Query: ?role=STUDENT&search=keyword&status=active&page=1&limit=10
 */
const getAllUsers = async (req, res, next) => {
    try {
        const { role, search, status, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const conditions = [];

        if (role) {
            conditions.push({ role });
        }

        if (status === 'active') {
            conditions.push({ isActive: true });
        } else if (status === 'locked') {
            conditions.push({ isActive: false });
        }

        if (search) {
            conditions.push({
                OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                ],
            });
        }

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    code: true,
                    role: true,
                    department: true,
                    academicTitle: true,
                    phone: true,
                    avatarUrl: true,
                    isActive: true,
                    createdAt: true,
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/users
 * Admin tạo người dùng mới
 */
const createUser = async (req, res, next) => {
    try {
        const { email, fullName, role, department, phone, academicTitle } = req.body;

        if (!email || !fullName || !role) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ: email, họ tên, vai trò.',
            });
        }

        // Kiểm tra email trùng
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email này đã tồn tại trong hệ thống.',
            });
        }

        const code = await generateUserCode(role);

        // Mật khẩu mặc định = mã số
        const hashedPassword = await bcrypt.hash(code, 10);

        const user = await prisma.user.create({
            data: {
                email,
                fullName,
                code,
                role,
                department: department || null,
                academicTitle: role === 'LECTURER' ? academicTitle : null,
                phone: phone || null,
                passwordHash: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                academicTitle: true,
                phone: true,
                isActive: true,
                createdAt: true,
            },
        });

        res.status(201).json({
            success: true,
            message: `Tạo người dùng thành công. Mật khẩu mặc định là mã số: ${code}`,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/users/:id
 * Admin chỉnh sửa thông tin người dùng
 */
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fullName, email, code, role, department, phone, academicTitle } = req.body;

        const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        // Kiểm tra email trùng (nếu đổi email)
        if (email && email !== existing.email) {
            const dup = await prisma.user.findUnique({ where: { email } });
            if (dup) {
                return res.status(400).json({ success: false, message: 'Email này đã tồn tại.' });
            }
        }

        // Kiểm tra code trùng (nếu đổi code)
        if (code && code !== existing.code) {
            const dup = await prisma.user.findUnique({ where: { code } });
            if (dup) {
                return res.status(400).json({ success: false, message: 'Mã số này đã tồn tại.' });
            }
        }

        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (email) updateData.email = email;
        if (code) updateData.code = code;
        if (role) updateData.role = role;
        if (department !== undefined) updateData.department = department;
        if (phone !== undefined) updateData.phone = phone;
        if (role === 'LECTURER' && academicTitle !== undefined) updateData.academicTitle = academicTitle;
        if (role !== 'LECTURER') updateData.academicTitle = null;

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true, email: true, fullName: true, code: true,
                role: true, department: true, academicTitle: true, phone: true, isActive: true, createdAt: true,
            },
        });

        res.json({ success: true, message: 'Cập nhật người dùng thành công.', data: user });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/users/:id/toggle-active
 * Admin khóa / mở khóa tài khoản
 */
const toggleActive = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        // Không cho khóa chính mình
        if (existing.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Bạn không thể khóa chính tài khoản của mình.' });
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { isActive: !existing.isActive },
            select: { id: true, fullName: true, isActive: true },
        });

        res.json({
            success: true,
            message: user.isActive ? `Đã mở khóa tài khoản ${user.fullName}.` : `Đã khóa tài khoản ${user.fullName}.`,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/users/:id
 * Admin xóa người dùng
 */
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        // Không cho xóa chính mình
        if (existing.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Bạn không thể xóa chính tài khoản của mình.' });
        }

        await prisma.user.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: `Đã xóa người dùng: ${existing.fullName}.` });
    } catch (error) {
        // Foreign key constraint
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa người dùng này vì đã có dữ liệu liên kết (nhóm, đề tài, ...). Hãy thử khóa tài khoản thay vì xóa.',
            });
        }
        next(error);
    }
};

/**
 * POST /api/users/:id/reset-password
 * Admin reset mật khẩu về mã số
 */
const resetPassword = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        const hashedPassword = await bcrypt.hash(existing.code, 10);
        await prisma.user.update({
            where: { id: parseInt(id) },
            data: { passwordHash: hashedPassword },
        });

        res.json({
            success: true,
            message: `Đã reset mật khẩu của ${existing.fullName} về mã số: ${existing.code}`,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    toggleActive,
    deleteUser,
    resetPassword,
};
