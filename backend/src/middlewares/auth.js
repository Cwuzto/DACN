const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * Middleware xác thực JWT Token
 * Kiểm tra token trong header Authorization: Bearer <token>
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không tìm thấy token xác thực. Vui lòng đăng nhập.',
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tìm user trong DB để đảm bảo tài khoản vẫn tồn tại và active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                isActive: true,
                permissionGroups: {
                    include: {
                        permissionGroup: {
                            include: { permissions: { include: { permission: true } } },
                        },
                    },
                },
            },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hoá.',
            });
        }

        const permissionSet = new Set();
        (user.permissionGroups || []).forEach(({ permissionGroup }) => {
            (permissionGroup?.permissions || []).forEach(({ permission }) => {
                if (permission?.code) permissionSet.add(permission.code);
            });
        });
        req.user = {
            ...user,
            permissionGroups: (user.permissionGroups || [])
                .map(({ permissionGroup }) => permissionGroup?.code)
                .filter(Boolean),
            permissions: [...permissionSet],
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ.',
        });
    }
};

/**
 * Middleware phân quyền - kiểm tra xem user có đúng role được phép không
 * Sử dụng: authorize('ADMIN', 'LECTURER')
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Chưa xác thực.',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập chức năng này.',
            });
        }

        next();
    };
};

const authorizePermission = (...permissionCodes) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
        }
        const permissions = req.user.permissions || [];
        if (!permissionCodes.some((code) => permissions.includes(code))) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        }
        next();
    };
};

const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                isActive: true,
                permissionGroups: {
                    include: {
                        permissionGroup: {
                            include: { permissions: { include: { permission: true } } },
                        },
                    },
                },
            },
        });
        if (user && user.isActive) {
            const permissionSet = new Set();
            user.permissionGroups.forEach(({ permissionGroup }) => {
                permissionGroup.permissions.forEach(({ permission }) => permissionSet.add(permission.code));
            });
            req.user = {
                ...user,
                permissionGroups: user.permissionGroups.map(({ permissionGroup }) => permissionGroup.code),
                permissions: [...permissionSet],
            };
        }
        next();
    } catch {
        next();
    }
};

module.exports = { authenticate, optionalAuthenticate, authorize, authorizePermission };

