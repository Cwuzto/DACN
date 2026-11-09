const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { clearAuthCache } = require('../middlewares/auth');
const { COMPLETED_GRADUATION_STATUSES } = require('../utils/studentAccountRestriction');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const { validateStudentPayload, normalizeStudentPayload } = require('../services/studentProfileService');

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
        const { role, search, status, accountRestricted, page = 1, limit = 10 } = req.query;
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

        const parsedAccountRestricted =
            accountRestricted === 'true' ? true : accountRestricted === 'false' ? false : null;
        const shouldFilterByAccountRestricted = parsedAccountRestricted !== null;
        const canApplyRestrictedFilter = !role || role === 'STUDENT';
        if (shouldFilterByAccountRestricted && canApplyRestrictedFilter) {
            conditions.push(
                parsedAccountRestricted
                    ? {
                          registrations: {
                              some: {
                                  status: { in: COMPLETED_GRADUATION_STATUSES },
                              },
                          },
                      }
                    : {
                          registrations: {
                              none: {
                                  status: { in: COMPLETED_GRADUATION_STATUSES },
                              },
                          },
                      }
            );
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
                    permissionGroups: {
                        include: { permissionGroup: { select: { code: true, name: true } } },
                    },
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
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        let usersWithFlags = users.map((u) => ({
            ...u,
            permissionGroups: u.permissionGroups.map(({ permissionGroup }) => permissionGroup),
            accountRestricted: false,
        }));
        if (users.length > 0) {
            const studentIds = users.filter((u) => u.role === 'STUDENT').map((u) => u.id);
            if (studentIds.length > 0) {
                const completedRegs = await prisma.topicRegistration.findMany({
                    where: {
                        studentId: { in: studentIds },
                        status: { in: COMPLETED_GRADUATION_STATUSES },
                    },
                    select: { studentId: true },
                    distinct: ['studentId'],
                });
                const completedStudentSet = new Set(completedRegs.map((row) => row.studentId));
                usersWithFlags = usersWithFlags.map((u) => ({
                    ...u,
                    accountRestricted: u.role === 'STUDENT' ? completedStudentSet.has(u.id) : false,
                }));
            }
        }

        res.json({
            success: true,
            data: usersWithFlags,
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
 * GET /api/users/:id
 * Lấy chi tiết một người dùng kèm studentProfile
 */
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
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
                permissionGroups: {
                    include: { permissionGroup: { select: { code: true, name: true } } },
                },
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
            },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        const userDto = {
            ...user,
            permissionGroups: (user.permissionGroups || []).map(({ permissionGroup }) => permissionGroup),
        };

        res.json({
            success: true,
            data: userDto,
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

        if (role === 'STUDENT') {
            let validated;
            try {
                validated = validateStudentPayload(req.body);
            } catch (validationErr) {
                return res.status(400).json({
                    success: false,
                    message: validationErr.message,
                    errors: validationErr.errors || [validationErr.message],
                });
            }

            // Kiểm tra email trùng
            const existingEmail = await prisma.user.findUnique({ where: { email: validated.user.email } });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email này đã tồn tại trong hệ thống.',
                });
            }

            // Kiểm tra MSSV trùng
            const existingCode = await prisma.user.findUnique({ where: { code: validated.user.code } });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Mã số sinh viên này đã tồn tại trong hệ thống.',
                });
            }

            const code = validated.user.code;
            const hashedPassword = await bcrypt.hash(code, 10);

            // Gói tạo User + StudentProfile trong một transaction duy nhất (fail-closed rollback)
            const created = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: validated.user.email,
                        fullName: validated.user.fullName,
                        code: validated.user.code,
                        role: 'STUDENT',
                        department: null,
                        academicTitle: null,
                        phone: validated.user.phone,
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

                const studentProfile = await tx.studentProfile.create({
                    data: {
                        studentId: user.id,
                        gender: validated.studentProfile.gender,
                        dateOfBirth: validated.studentProfile.dateOfBirth,
                        className: validated.studentProfile.className,
                        major: validated.studentProfile.major,
                    },
                    select: {
                        studentId: true,
                        gender: true,
                        dateOfBirth: true,
                        className: true,
                        major: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });

                return {
                    ...user,
                    studentProfile,
                };
            });

            return res.status(201).json({
                success: true,
                message: `Tạo người dùng thành công. Mật khẩu mặc định là mã số: ${code}`,
                data: created,
            });
        }

        // Non-student creation
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

        let code = req.body.code ? req.body.code.trim() : null;
        if (code) {
            const existingCode = await prisma.user.findUnique({ where: { code } });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Mã số này đã tồn tại trong hệ thống.',
                });
            }
        } else {
            code = await generateUserCode(role);
        }

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

        const existing = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: { studentProfile: true },
        });
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

        const effectiveRole = role || existing.role;

        if (effectiveRole === 'STUDENT') {
            const mergedPayload = {
                code: code !== undefined ? code : existing.code,
                fullName: fullName !== undefined ? fullName : existing.fullName,
                email: email !== undefined ? email : existing.email,
                phone: phone !== undefined ? phone : (existing.phone || ''),
                gender: req.body.gender !== undefined ? req.body.gender : existing.studentProfile?.gender,
                dateOfBirth: req.body.dateOfBirth !== undefined ? req.body.dateOfBirth : existing.studentProfile?.dateOfBirth,
                className: (req.body.className || req.body.lop) !== undefined
                    ? (req.body.className || req.body.lop)
                    : existing.studentProfile?.className,
                major: (req.body.major || req.body.nganh) !== undefined
                    ? (req.body.major || req.body.nganh)
                    : existing.studentProfile?.major,
            };

            let validated;
            try {
                validated = validateStudentPayload(mergedPayload);
            } catch (validationErr) {
                return res.status(400).json({
                    success: false,
                    message: validationErr.message,
                    errors: validationErr.errors || [validationErr.message],
                });
            }

            const updated = await prisma.$transaction(async (tx) => {
                const user = await tx.user.update({
                    where: { id: existing.id },
                    data: {
                        fullName: validated.user.fullName,
                        email: validated.user.email,
                        code: validated.user.code,
                        role: 'STUDENT',
                        department: null,
                        academicTitle: null,
                        phone: validated.user.phone,
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

                const studentProfile = await tx.studentProfile.upsert({
                    where: { studentId: existing.id },
                    create: {
                        studentId: existing.id,
                        gender: validated.studentProfile.gender,
                        dateOfBirth: validated.studentProfile.dateOfBirth,
                        className: validated.studentProfile.className,
                        major: validated.studentProfile.major,
                    },
                    update: {
                        gender: validated.studentProfile.gender,
                        dateOfBirth: validated.studentProfile.dateOfBirth,
                        className: validated.studentProfile.className,
                        major: validated.studentProfile.major,
                    },
                    select: {
                        studentId: true,
                        gender: true,
                        dateOfBirth: true,
                        className: true,
                        major: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });

                return {
                    ...user,
                    studentProfile,
                };
            });

            return res.json({ success: true, message: 'Cập nhật người dùng thành công.', data: updated });
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

/**
 * GET /api/users/:id/permissions
 * Xem nhóm quyền + permission của user
 */
const getUserPermissions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        const { setUserGroups, getUserPermissions: fetchPermissions } = require('../services/permissionService');
        const data = await fetchPermissions(id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/users/:id/permission-groups
 * Gán nhóm quyền cho user (thay thế toàn bộ)
 */
const updateUserPermissionGroups = async (req, res, next) => {
    try {
        const { id } = req.params;
        const targetUserId = parseInt(id, 10);
        const { groupIds } = req.body;

        const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }

        if (targetUserId === req.user?.id) {
            return res.status(403).json({
                success: false,
                error: 'CANNOT_ASSIGN_PERMISSIONS_TO_SELF',
                message: 'Không thể tự gán nhóm quyền cho chính mình.',
            });
        }

        if (!Array.isArray(groupIds)) {
            return res.status(400).json({ success: false, message: 'groupIds phải là mảng.' });
        }

        const groupIdsInt = [...new Set(groupIds.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v)))];
        const selectedGroups = await prisma.permissionGroup.findMany({
            where: { id: { in: groupIdsInt } },
            select: { id: true, code: true, isSystem: true },
        });

        const hasAcademicDelegation = (req.user?.permissions || []).includes('PERMISSION_ASSIGN_ACADEMIC');
        const hasAcademicGroup = selectedGroups.some((g) => ['VIEN_TRUONG', 'GVHD'].includes(g.code));

        if (hasAcademicGroup && !hasAcademicDelegation) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN_ACADEMIC_GROUP_ASSIGNMENT',
                message: 'Quản trị viên kỹ thuật không được phép gán nhóm quyền học thuật (VIEN_TRUONG, GVHD).',
            });
        }

        const { setUserGroups } = require('../services/permissionService');
        await setUserGroups(targetUserId, groupIdsInt, req.user);
        clearAuthCache(targetUserId);

        res.json({ success: true, message: 'Cập nhật nhóm quyền thành công.' });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.code,
                message: error.message,
            });
        }
        next(error);
    }
};

/**
 * GET /api/users/template
 * Tải file mẫu Excel cho Sinh viên hoặc Giảng viên
 */
const downloadUserTemplate = async (req, res, next) => {
    try {
        const { role = 'STUDENT' } = req.query;
        const { generateStudentTemplateBuffer, generateLecturerTemplateBuffer } = require('../utils/excelHelper');

        if (role === 'LECTURER') {
            const buffer = generateLecturerTemplateBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Mau_Import_Giang_Vien.xlsx"');
            return res.send(buffer);
        }

        const buffer = generateStudentTemplateBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Mau_Import_Sinh_Vien.xlsx"');
        return res.send(buffer);
    } catch (error) {
        next(error);
    }
};

const normalizeAcademicTitle = (title) => {
    if (!title) return null;
    const str = String(title).trim().toUpperCase();
    if (str.includes('PHO_GIAO_SU') || str.includes('PHÓ GIÁO SƯ') || str.includes('PGS')) return 'PHO_GIAO_SU';
    if (str.includes('TIEN_SI') || str.includes('TIẾN SĨ') || str.includes('TS')) return 'TIEN_SI';
    if (str.includes('THAC_SI') || str.includes('THẠC SĨ') || str.includes('THS')) return 'THAC_SI';
    return 'THAC_SI';
};

/**
 * POST /api/users/import-excel
 * Import người dùng từ danh sách đã parse
 * Body: { role: 'STUDENT'|'LECTURER', items: [...], onDuplicate: 'SKIP'|'UPDATE' }
 */
const importUsersExcel = async (req, res, next) => {
    try {
        const { role = 'STUDENT', items, onDuplicate = 'SKIP' } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách import không được để trống.' });
        }

        const validRole = ['STUDENT', 'LECTURER', 'ADMIN'].includes(role) ? role : 'STUDENT';

        if (validRole === 'STUDENT') {
            const errorRows = [];
            const parsedStudentRows = [];

            // 1. Validate each student row using studentProfileService
            items.forEach((item, index) => {
                const rowIdx = index + 1;
                const result = validateStudentPayload(item, { throwOnError: false });

                if (!result.isValid) {
                    result.errors.forEach((err) => {
                        errorRows.push({
                            row: rowIdx,
                            code: result.normalized.code || '',
                            mssv: result.normalized.code || '',
                            message: err,
                        });
                    });
                } else {
                    parsedStudentRows.push({
                        rowIdx,
                        data: result.data,
                        normalized: result.normalized,
                    });
                }
            });

            // 2. In-file duplicate checks for MSSV and Email
            const seenCodes = new Map();
            const seenEmails = new Map();

            items.forEach((item, index) => {
                const rowIdx = index + 1;
                const normalized = normalizeStudentPayload(item);
                const code = normalized.code;
                const email = normalized.email;

                if (code) {
                    if (seenCodes.has(code)) {
                        errorRows.push({
                            row: rowIdx,
                            code,
                            mssv: code,
                            message: 'Mã số sinh viên bị trùng lặp trong file import',
                        });
                    } else {
                        seenCodes.set(code, rowIdx);
                    }
                }

                if (email) {
                    if (seenEmails.has(email)) {
                        errorRows.push({
                            row: rowIdx,
                            code: code || '',
                            mssv: code || '',
                            message: 'Email bị trùng lặp trong file import',
                        });
                    } else {
                        seenEmails.set(email, rowIdx);
                    }
                }
            });

            // 3. Database collision checks
            const allCodes = Array.from(seenCodes.keys());
            const allEmails = Array.from(seenEmails.keys());

            const existingUsers = (allCodes.length > 0 || allEmails.length > 0)
                ? await prisma.user.findMany({
                      where: {
                          OR: [
                              ...(allCodes.length > 0 ? [{ code: { in: allCodes } }] : []),
                              ...(allEmails.length > 0 ? [{ email: { in: allEmails } }] : []),
                          ],
                      },
                      select: { id: true, code: true, email: true },
                  })
                : [];

            const existingByCodeMap = new Map();
            const existingByEmailMap = new Map();
            existingUsers.forEach((u) => {
                if (u.code) existingByCodeMap.set(u.code, u);
                if (u.email) existingByEmailMap.set(u.email.toLowerCase(), u);
            });

            items.forEach((item, index) => {
                const rowIdx = index + 1;
                const normalized = normalizeStudentPayload(item);
                const code = normalized.code;
                const email = normalized.email;

                const userByCode = code ? existingByCodeMap.get(code) : null;
                const userByEmail = email ? existingByEmailMap.get(email) : null;

                if (onDuplicate === 'UPDATE') {
                    if (userByCode && userByEmail && userByCode.id !== userByEmail.id) {
                        errorRows.push({
                            row: rowIdx,
                            code: code || '',
                            mssv: code || '',
                            message: 'Mã số sinh viên và email thuộc hai tài khoản khác nhau trong hệ thống',
                        });
                    }
                } else {
                    if (userByCode) {
                        errorRows.push({
                            row: rowIdx,
                            code: code || '',
                            mssv: code || '',
                            message: 'Mã số sinh viên đã tồn tại trong hệ thống',
                        });
                    }
                    if (userByEmail) {
                        errorRows.push({
                            row: rowIdx,
                            code: code || '',
                            mssv: code || '',
                            message: 'Email đã tồn tại trong hệ thống',
                        });
                    }
                }
            });

            // ALL-OR-NOTHING: ZERO database writes if ANY row is invalid
            if (errorRows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Dữ liệu import không hợp lệ. Vui lòng kiểm tra lại các dòng lỗi.',
                    errors: errorRows,
                });
            }

            // 100% valid: Commit all Users and StudentProfiles atomically
            let createdCount = 0;
            let updatedCount = 0;

            await prisma.$transaction(async (tx) => {
                for (const row of parsedStudentRows) {
                    const { user, studentProfile } = row.data;
                    const existing = existingByCodeMap.get(user.code) || existingByEmailMap.get(user.email);

                    if (existing && onDuplicate === 'UPDATE') {
                        await tx.user.update({
                            where: { id: existing.id },
                            data: {
                                fullName: user.fullName,
                                email: user.email,
                                code: user.code,
                                role: 'STUDENT',
                                department: null,
                                academicTitle: null,
                                phone: user.phone,
                            },
                        });

                        await tx.studentProfile.upsert({
                            where: { studentId: existing.id },
                            create: {
                                studentId: existing.id,
                                gender: studentProfile.gender,
                                dateOfBirth: studentProfile.dateOfBirth,
                                className: studentProfile.className,
                                major: studentProfile.major,
                            },
                            update: {
                                gender: studentProfile.gender,
                                dateOfBirth: studentProfile.dateOfBirth,
                                className: studentProfile.className,
                                major: studentProfile.major,
                            },
                        });

                        updatedCount++;
                    } else {
                        const passwordHash = await bcrypt.hash(user.code, 10);
                        const newUser = await tx.user.create({
                            data: {
                                code: user.code,
                                fullName: user.fullName,
                                email: user.email,
                                phone: user.phone,
                                role: 'STUDENT',
                                department: null,
                                academicTitle: null,
                                passwordHash,
                                isActive: true,
                            },
                        });

                        await tx.studentProfile.create({
                            data: {
                                studentId: newUser.id,
                                gender: studentProfile.gender,
                                dateOfBirth: studentProfile.dateOfBirth,
                                className: studentProfile.className,
                                major: studentProfile.major,
                            },
                        });

                        createdCount++;
                    }
                }
            });

            return res.json({
                success: true,
                message: `Import hoàn tất: Tạo mới ${createdCount}, Cập nhật ${updatedCount}, Bỏ qua 0, Lỗi 0`,
                data: {
                    total: items.length,
                    createdCount,
                    updatedCount,
                    skippedCount: 0,
                    errors: [],
                },
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const errorRows = [];
        const validatedItems = [];

        items.forEach((item, index) => {
            const rowIdx = index + 1;
            const code = item.code || item['Mã SV (*)'] || item['Mã GV (*)'] || item['Mã SV'] || item['Mã GV'] || item['Mã số'];
            const fullName = item.fullName || item['Họ và tên (*)'] || item['Họ và tên'] || item['Họ tên'];
            const email = item.email || item['Email (*)'] || item['Email'];
            const phone = item.phone || item['Số điện thoại'] || item['SĐT'] || null;
            const department = item.department || item['Bộ môn / Khoa'] || item['Bộ môn'] || item['Khoa'] || null;
            const rawTitle = item.academicTitle || item['Học vị (*)'] || item['Học vị'] || null;

            if (!code || !String(code).trim()) {
                errorRows.push({ row: rowIdx, code: '', message: 'Thiếu mã số (code)' });
                return;
            }

            if (!fullName || !String(fullName).trim()) {
                errorRows.push({ row: rowIdx, code: String(code), message: 'Thiếu họ và tên' });
                return;
            }

            if (!email || !emailRegex.test(String(email).trim())) {
                errorRows.push({ row: rowIdx, code: String(code), message: 'Email không hợp lệ' });
                return;
            }

            const cleanCode = String(code).trim().toUpperCase();
            const cleanEmail = String(email).trim().toLowerCase();
            const cleanFullName = String(fullName).trim();
            const cleanPhone = phone ? String(phone).trim() : null;
            const cleanDept = department ? String(department).trim() : null;
            const academicTitle = validRole === 'LECTURER' ? normalizeAcademicTitle(rawTitle) : null;

            validatedItems.push({
                rowIdx,
                code: cleanCode,
                email: cleanEmail,
                fullName: cleanFullName,
                phone: cleanPhone,
                department: cleanDept,
                academicTitle,
            });
        });

        // Kiểm tra trùng lặp trong nội bộ file
        const seenCodes = new Set();
        const seenEmails = new Set();
        const nonDuplicateItems = [];

        for (const row of validatedItems) {
            if (seenCodes.has(row.code)) {
                errorRows.push({ row: row.rowIdx, code: row.code, message: 'Mã số bị trùng lặp trong file import' });
                continue;
            }
            if (seenEmails.has(row.email)) {
                errorRows.push({ row: row.rowIdx, code: row.code, message: 'Email bị trùng lặp trong file import' });
                continue;
            }
            seenCodes.add(row.code);
            seenEmails.add(row.email);
            nonDuplicateItems.push(row);
        }

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        await prisma.$transaction(async (tx) => {
            for (const row of nonDuplicateItems) {
                // Kiểm tra xem user đã tồn tại theo code hoặc email
                const existing = await tx.user.findFirst({
                    where: {
                        OR: [
                            { code: row.code },
                            { email: row.email },
                        ],
                    },
                });

                if (existing) {
                    if (onDuplicate === 'UPDATE') {
                        await tx.user.update({
                            where: { id: existing.id },
                            data: {
                                fullName: row.fullName,
                                phone: row.phone || existing.phone,
                                department: row.department || existing.department,
                                ...(validRole === 'LECTURER' && row.academicTitle ? { academicTitle: row.academicTitle } : {}),
                            },
                        });
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    const passwordHash = await bcrypt.hash(row.code, 10);
                    await tx.user.create({
                        data: {
                            email: row.email,
                            fullName: row.fullName,
                            code: row.code,
                            role: validRole,
                            phone: row.phone,
                            department: row.department,
                            academicTitle: row.academicTitle,
                            passwordHash,
                            isActive: true,
                        },
                    });
                    createdCount++;
                }
            }
        });

        res.json({
            success: true,
            message: `Import hoàn tất: Tạo mới ${createdCount}, Cập nhật ${updatedCount}, Bỏ qua ${skippedCount}, Lỗi ${errorRows.length}`,
            data: {
                total: items.length,
                createdCount,
                updatedCount,
                skippedCount,
                errors: errorRows,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/users/export-excel
 * Xuất danh sách người dùng ra file Excel
 */
const exportUsersExcel = async (req, res, next) => {
    try {
        const { role, department, status, search } = req.query;
        const { createExcelBuffer } = require('../utils/excelHelper');

        const conditions = [];
        if (role) conditions.push({ role });
        if (department) conditions.push({ department: { contains: department, mode: 'insensitive' } });
        if (status === 'active') conditions.push({ isActive: true });
        if (status === 'locked') conditions.push({ isActive: false });
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

        const users = await prisma.user.findMany({
            where,
            include: {
                studentProfile: true,
            },
            orderBy: [{ role: 'asc' }, { code: 'asc' }],
        });

        if (role === 'STUDENT') {
            const rows = users.map((u) => {
                let genderStr = '';
                if (u.studentProfile?.gender === 'MALE') genderStr = 'Nam';
                else if (u.studentProfile?.gender === 'FEMALE') genderStr = 'Nữ';
                else if (u.studentProfile?.gender === 'OTHER') genderStr = 'Khác';

                let dobStr = '';
                if (u.studentProfile?.dateOfBirth) {
                    const dob = new Date(u.studentProfile.dateOfBirth);
                    const day = String(dob.getUTCDate()).padStart(2, '0');
                    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
                    const year = dob.getUTCFullYear();
                    dobStr = `${day}/${month}/${year}`;
                }

                return {
                    'MSSV (*)': u.code,
                    'Họ và tên (*)': u.fullName,
                    'Giới tính (*)': genderStr,
                    'Ngày sinh (*)': dobStr,
                    'Số điện thoại (*)': u.phone || '',
                    'Lớp (*)': u.studentProfile?.className || '',
                    'Email (*)': u.email,
                    'Ngành (*)': u.studentProfile?.major || '',
                };
            });

            const colWidths = [
                { wch: 16 },
                { wch: 26 },
                { wch: 14 },
                { wch: 16 },
                { wch: 16 },
                { wch: 16 },
                { wch: 34 },
                { wch: 26 },
            ];

            const buffer = createExcelBuffer('Danh_Sach_Sinh_Vien', rows, colWidths);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_sinh_vien_${Date.now()}.xlsx"`);
            return res.send(buffer);
        }

        const rows = users.map((u) => {
            let titleStr = '';
            if (u.academicTitle === 'PHO_GIAO_SU') titleStr = 'Phó Giáo sư';
            else if (u.academicTitle === 'TIEN_SI') titleStr = 'Tiến sĩ';
            else if (u.academicTitle === 'THAC_SI') titleStr = 'Thạc sĩ';

            let roleStr = 'Sinh viên';
            if (u.role === 'LECTURER') roleStr = 'Giảng viên';
            if (u.role === 'ADMIN') roleStr = 'Quản trị viên';

            return {
                'Mã số': u.code,
                'Họ và tên': u.fullName,
                'Email': u.email,
                'Vai trò': roleStr,
                'Bộ môn / Khoa': u.role === 'STUDENT' ? (u.studentProfile?.major || '') : (u.department || ''),
                'Số điện thoại': u.phone || '',
                'Học vị': titleStr,
                'Trạng thái': u.isActive ? 'Hoạt động' : 'Bị khóa',
                'Ngày tạo': u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '',
            };
        });

        const colWidths = [
            { wch: 14 },
            { wch: 26 },
            { wch: 32 },
            { wch: 16 },
            { wch: 30 },
            { wch: 16 },
            { wch: 16 },
            { wch: 14 },
            { wch: 16 },
        ];

        const buffer = createExcelBuffer('Danh_Sach_Nguoi_Dung', rows, colWidths);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_nguoi_dung_${Date.now()}.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/users/public-lecturers
 * Lấy danh sách giảng viên công khai (không cần login) để hiển thị trên Homepage
 */
const getPublicLecturers = async (req, res, next) => {
    try {
        const { search, department } = req.query;
        const where = {
            role: 'LECTURER',
            isActive: true,
        };

        if (department && department !== 'ALL') {
            where.department = { contains: department, mode: 'insensitive' };
        }

        if (search && search.trim()) {
            const keyword = search.trim();
            where.OR = [
                { fullName: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
                { department: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        const lecturers = await prisma.user.findMany({
            where,
            select: {
                id: true,
                fullName: true,
                code: true,
                academicTitle: true,
                department: true,
                avatarUrl: true,
                email: true,
                mentoredTopics: {
                    where: { status: 'APPROVED' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                    },
                    take: 6,
                },
                _count: {
                    select: {
                        mentoredTopics: true,
                    },
                },
            },
            orderBy: [{ academicTitle: 'desc' }, { fullName: 'asc' }],
        });

        const data = lecturers.map((lec) => ({
            ...lec,
            maxSlots: getMentorMaxSlots(lec.academicTitle),
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    getPublicLecturers,
    createUser,
    updateUser,
    toggleActive,
    deleteUser,
    resetPassword,
    getUserPermissions,
    updateUserPermissionGroups,
    downloadUserTemplate,
    importUsersExcel,
    exportUsersExcel,
};

