const prisma = require('../config/database');
const { auditLog } = require('./auditLogService');
const {
  PERMISSION_CATALOG,
  DEFAULT_GROUPS,
  STUDENT_BASE_PERMISSIONS,
  ACADEMIC_PROTECTED_PERMISSIONS,
  TECHNICAL_PERMISSIONS,
  GRANTABLE_PERMISSION_CODES,
  CANONICAL_ALIAS_MAP,
} = require('../constants/permissions');
const { clearAuthCache } = require('../middlewares/auth');
const { normalizePermissionCode } = require('../auth/permissionCatalog');
const {
  assertPermissionMutationAuthority,
  invalidatePermissions,
} = require('./permissionInvalidationService');

const getRequestIp = (req) => req?.ip || req?.headers?.['x-forwarded-for'] || null;

const listPermissions = async () =>
  prisma.permission.findMany({
    where: {
      code: { notIn: Array.from(STUDENT_BASE_PERMISSIONS) },
      module: { not: 'STUDENT' },
    },
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
  });

const listGroups = async () =>
  prisma.permissionGroup.findMany({
    where: { code: { not: 'SYSTEM_STUDENT_BASE' } },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { id: 'asc' },
  });

const getGroupById = async (id) =>
  prisma.permissionGroup.findUnique({
    where: { id: parseInt(id, 10) },
    include: { permissions: { include: { permission: true } } },
  });

const createGroup = async (data, actor) => {
  const { code, name, description, permissionCodes = [] } = data;

  assertPermissionMutationAuthority({ actor, addedCodes: permissionCodes });

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.permissionGroup.create({
      data: { code, name, description, permissions: { create: await mapPermissions(tx, permissionCodes) } },
    });
    return group;
  });
  await auditLog(actor?.id, 'CREATE_PERMISSION_GROUP', 'PermissionGroup', result.id, { code, name }, getRequestIp(actor));
  return result;
};

const updateGroup = async (id, data, actor) => {
  const idInt = parseInt(id, 10);
  const { name, description, permissionCodes } = data;
  const result = await prisma.$transaction(async (tx) => {
    const existingGroup = await tx.permissionGroup.findUnique({
      where: { id: idInt },
      include: { permissions: { include: { permission: true } } },
    });
    if (!existingGroup) {
      const error = new Error('Không tìm thấy nhóm quyền.');
      error.statusCode = 404;
      throw error;
    }

    if (existingGroup.isSystem) {
      if (data.code !== undefined && data.code !== existingGroup.code) {
        const error = new Error('Không được phép sửa mã của nhóm quyền hệ thống.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN_SYSTEM_GROUP_CODE_MODIFICATION';
        throw error;
      }
      if (data.isSystem !== undefined && !data.isSystem) {
        const error = new Error('Không được phép hạ cờ hệ thống của nhóm quyền.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN_SYSTEM_GROUP_FLAG_MODIFICATION';
        throw error;
      }
    }

    if (permissionCodes !== undefined) {
      const currentCodes = (existingGroup.permissions || [])
        .map((p) => p.permission?.code || p.code)
        .filter(Boolean);
      const nextCodes = Array.isArray(permissionCodes) ? permissionCodes : [];
      const addedCodes = nextCodes.filter((c) => !currentCodes.includes(c));
      const removedCodes = currentCodes.filter((c) => !nextCodes.includes(c));

      assertPermissionMutationAuthority({
        actor,
        addedCodes,
        removedCodes,
        targetGroups: [existingGroup],
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissionCodes !== undefined) {
      await tx.permissionGroupPermission.deleteMany({ where: { permissionGroupId: idInt } });
      updateData.permissions = { create: await mapPermissions(tx, permissionCodes) };

      if (tx.userPermissionGroup?.findMany) {
        const affectedUserGroups = await tx.userPermissionGroup.findMany({
          where: { permissionGroupId: idInt },
          select: { userId: true },
        });
        const affectedUserIds = [...new Set(affectedUserGroups.map((ug) => ug.userId))];
        await invalidatePermissions({ userIds: affectedUserIds, actor, reason: 'UPDATE_PERMISSION_GROUP', tx });
      }
    }
    return tx.permissionGroup.update({ where: { id: idInt }, data: updateData });
  });
  clearAuthCache();
  await auditLog(actor?.id, 'UPDATE_PERMISSION_GROUP', 'PermissionGroup', idInt, { name, description }, getRequestIp(actor));
  return result;
};

const deleteGroup = async (id, actor) => {
  const idInt = parseInt(id, 10);
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.permissionGroup.findUnique({
      where: { id: idInt },
      include: { permissions: { include: { permission: true } } },
    });
    if (!existing) {
      const error = new Error('Không tìm thấy nhóm quyền.');
      error.statusCode = 404;
      throw error;
    }
    if (existing.isSystem) {
      const error = new Error('Không được phép xóa nhóm quyền hệ thống.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_SYSTEM_GROUP_DELETION';
      throw error;
    }

    assertPermissionMutationAuthority({ actor, targetGroups: [existing] });

    if (tx.userPermissionGroup?.findMany) {
      const affectedUserGroups = await tx.userPermissionGroup.findMany({
        where: { permissionGroupId: idInt },
        select: { userId: true },
      });
      const affectedUserIds = [...new Set(affectedUserGroups.map((ug) => ug.userId))];
      await invalidatePermissions({ userIds: affectedUserIds, actor, reason: 'DELETE_PERMISSION_GROUP', tx });
    }

    return tx.permissionGroup.delete({ where: { id: idInt } });
  });
  await auditLog(actor?.id, 'DELETE_PERMISSION_GROUP', 'PermissionGroup', idInt, { code: deleted.code }, getRequestIp(actor));
  return deleted;
};

const mapPermissions = async (tx, codes) => {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  const permissions = await tx.permission.findMany({ where: { code: { in: codes } } });
  return permissions.map((permission) => ({ permissionId: permission.id }));
};

const setUserGroups = async (userId, groupIds, actor) => {
  const userIdInt = parseInt(userId, 10);
  const groupIdsInt = Array.isArray(groupIds) ? [...new Set(groupIds.map((value) => parseInt(value, 10)).filter((v) => !isNaN(v)))] : [];

  if (actor?.id && userIdInt === actor.id) {
    const error = new Error('Không thể tự gán nhóm quyền cho chính mình.');
    error.statusCode = 403;
    error.code = 'CANNOT_ASSIGN_PERMISSIONS_TO_SELF';
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: userIdInt },
      include: {
        permissionGroups: {
          include: {
            permissionGroup: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!targetUser) {
      const error = new Error('Không tìm thấy người dùng.');
      error.statusCode = 404;
      throw error;
    }

    const currentPermCodes = new Set();
    (targetUser.permissionGroups || []).forEach((pg) => {
      (pg.permissionGroup?.permissions || []).forEach((p) => {
        if (p.permission?.code) currentPermCodes.add(p.permission.code);
      });
    });

    const selectedGroups = await tx.permissionGroup.findMany({
      where: { id: { in: groupIdsInt } },
      include: { permissions: { include: { permission: true } } },
    });

    const nextPermCodes = new Set();
    selectedGroups.forEach((g) => {
      (g.permissions || []).forEach((p) => {
        if (p.permission?.code) nextPermCodes.add(p.permission.code);
      });
    });

    const addedCodes = [...nextPermCodes].filter((c) => !currentPermCodes.has(c));
    const removedCodes = [...currentPermCodes].filter((c) => !nextPermCodes.has(c));

    assertPermissionMutationAuthority({
      actor,
      addedCodes,
      removedCodes,
      targetGroups: selectedGroups,
    });

    await tx.userPermissionGroup.deleteMany({ where: { userId: userIdInt } });
    if (groupIdsInt.length) {
      await tx.userPermissionGroup.createMany({
        data: groupIdsInt.map((permissionGroupId) => ({ userId: userIdInt, permissionGroupId })),
      });
    }

    await invalidatePermissions({ userIds: [userIdInt], actor, reason: 'SET_USER_PERMISSION_GROUPS', tx });
  });
  clearAuthCache(userIdInt);
  await auditLog(actor?.id, 'SET_USER_PERMISSION_GROUPS', 'User', userIdInt, { groupIds: groupIdsInt }, getRequestIp(actor));
  return result;
};

const getUserPermissions = async (userId) => {
  const groups = await prisma.permissionGroup.findMany({
    where: { users: { some: { userId: parseInt(userId, 10) } } },
    include: { permissions: { include: { permission: true } } },
  });
  const permissionSet = new Set();
  groups.forEach((group) => group.permissions.forEach((item) => permissionSet.add(item.permission.code)));
  return { groups, permissions: [...permissionSet] };
};

const hasPermission = async (userId, permissionCode) => {
  const count = await prisma.userPermissionGroup.count({
    where: {
      userId: parseInt(userId, 10),
      permissionGroup: { permissions: { some: { permission: { code: permissionCode } } } },
    },
  });
  return count > 0;
};

const seedPermissionCatalog = async (db = prisma) => {
  const catalogCodes = PERMISSION_CATALOG.map((item) => item.code);
  await db.permissionGroupPermission.deleteMany({
    where: { permission: { code: { notIn: catalogCodes } } },
  });
  await db.permission.deleteMany({
    where: { code: { notIn: catalogCodes } },
  });
  for (const item of PERMISSION_CATALOG) {
    await db.permission.upsert({
      where: { code: item.code },
      update: { label: item.label, module: item.module },
      create: { code: item.code, label: item.label, module: item.module },
    });
  }
  for (const group of DEFAULT_GROUPS) {
    const existing = await db.permissionGroup.findUnique({ where: { code: group.code } });
    const canonicalCodes = [...new Set((group.permissions || []).map((code) => normalizePermissionCode(code) || code))];
    const permissionIds = await db.permission.findMany({
      where: { code: { in: canonicalCodes } },
      select: { id: true },
    });
    const isSystem = group.isSystem ?? true;
    if (existing) {
      await db.permissionGroupPermission.deleteMany({ where: { permissionGroupId: existing.id } });
      await db.permissionGroup.update({
        where: { id: existing.id },
        data: {
          name: group.name,
          description: group.description,
          isSystem,
          permissions: { create: permissionIds.map((permission) => ({ permissionId: permission.id })) },
        },
      });
    } else {
      await db.permissionGroup.create({
        data: {
          code: group.code,
          name: group.name,
          description: group.description,
          isSystem,
          permissions: { create: permissionIds.map((permission) => ({ permissionId: permission.id })) },
        },
      });
    }
  }
};

const getPermissionMatrix = async () => {
  const [groups, permissions, groupPermissions] = await Promise.all([
    prisma.permissionGroup.findMany({
      where: { code: { not: 'SYSTEM_STUDENT_BASE' } },
      orderBy: { id: 'asc' },
      select: { id: true, code: true, name: true, description: true, isSystem: true },
    }),
    prisma.permission.findMany({
      where: {
        code: { notIn: Array.from(STUDENT_BASE_PERMISSIONS) },
        module: { not: 'STUDENT' },
      },
      orderBy: [{ module: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, label: true, module: true },
    }),
    prisma.permissionGroupPermission.findMany({
      select: { permissionGroupId: true, permissionId: true },
    }),
  ]);

  const moduleMap = new Map();
  for (const perm of permissions) {
    if (!moduleMap.has(perm.module)) {
      moduleMap.set(perm.module, []);
    }
    moduleMap.get(perm.module).push(perm);
  }

  const modules = Array.from(moduleMap.entries()).map(([moduleName, perms]) => ({
    module_name: moduleName,
    permissions: perms,
  }));

  const rolePermissions = {};
  for (const g of groups) {
    rolePermissions[String(g.id)] = [];
  }
  for (const gp of groupPermissions) {
    const key = String(gp.permissionGroupId);
    if (!rolePermissions[key]) {
      rolePermissions[key] = [];
    }
    rolePermissions[key].push(gp.permissionId);
  }

  return {
    roles: groups,
    modules,
    role_permissions: rolePermissions,
    protected_permissions: ACADEMIC_PROTECTED_PERMISSIONS,
    technical_permissions: TECHNICAL_PERMISSIONS,
    grantable_permissions: GRANTABLE_PERMISSION_CODES,
    aliases: CANONICAL_ALIAS_MAP,
  };
};

const createMatrixError = (statusCode, message, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const requirePositiveInteger = (value, fieldName) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw createMatrixError(400, `${fieldName} phải là số nguyên dương.`);
  }
  return value;
};

const normalizePermissionMatrixPayload = (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw createMatrixError(400, 'Dữ liệu cập nhật ma trận phải là một mảng không rỗng.');
  }

  const seenGroupIds = new Set();
  const updates = payload.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createMatrixError(400, `Phần tử ma trận tại vị trí ${index} không hợp lệ.`);
    }

    const groupId = requirePositiveInteger(item.role_id ?? item.groupId, `role_id tại vị trí ${index}`);
    if (seenGroupIds.has(groupId)) {
      throw createMatrixError(400, `role_id ${groupId} bị trùng trong payload.`);
    }
    seenGroupIds.add(groupId);

    if (!Array.isArray(item.permission_ids)) {
      throw createMatrixError(400, `permission_ids của role_id ${groupId} phải là một mảng.`);
    }

    const seenPermissionIds = new Set();
    const permissionIds = item.permission_ids.map((value, permissionIndex) => {
      const permissionId = requirePositiveInteger(
        value,
        `permission_ids[${permissionIndex}] của role_id ${groupId}`,
      );
      if (seenPermissionIds.has(permissionId)) {
        throw createMatrixError(400, `permission_id ${permissionId} bị trùng trong role_id ${groupId}.`);
      }
      seenPermissionIds.add(permissionId);
      return permissionId;
    });

    return { groupId, permissionIds };
  });

  return updates.sort((left, right) => left.groupId - right.groupId);
};

const bulkUpdatePermissionMatrix = async (payload, actor) => {
  const updates = normalizePermissionMatrixPayload(payload);
  const actorId = requirePositiveInteger(actor?.id, 'actor.id');
  const groupIds = updates.map(({ groupId }) => groupId);
  const permissionIds = [...new Set(updates.flatMap(({ permissionIds: ids }) => ids))];

  await prisma.$transaction(async (tx) => {
    const [existingGroups, existingPermissions, managePermission] = await Promise.all([
      tx.permissionGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, code: true, name: true, isSystem: true },
      }),
      permissionIds.length > 0
        ? tx.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { id: true },
        })
        : Promise.resolve([]),
      tx.permission.findUnique({
        where: { code: 'PERMISSION_GROUP_MANAGE' },
        select: { id: true },
      }),
    ]);

    const existingGroupIds = new Set(existingGroups.map(({ id }) => id));
    const missingGroupIds = groupIds.filter((id) => !existingGroupIds.has(id));
    if (missingGroupIds.length > 0) {
      throw createMatrixError(400, `Nhóm quyền không tồn tại: ${missingGroupIds.join(', ')}.`);
    }

    const existingPermissionIds = new Set(existingPermissions.map(({ id }) => id));
    const missingPermissionIds = permissionIds.filter((id) => !existingPermissionIds.has(id));
    if (missingPermissionIds.length > 0) {
      throw createMatrixError(400, `Quyền không tồn tại: ${missingPermissionIds.join(', ')}.`);
    }

    if (!managePermission) {
      throw createMatrixError(409, 'Catalog thiếu quyền tối quan trọng PERMISSION_GROUP_MANAGE.');
    }

    const currentGroupPerms = await tx.permissionGroupPermission.findMany({
      where: { permissionGroupId: { in: groupIds } },
      include: { permission: { select: { id: true, code: true } } },
    });

    const currentGroupCodesMap = new Map();
    groupIds.forEach((gid) => currentGroupCodesMap.set(gid, new Set()));
    (currentGroupPerms || []).forEach((gp) => {
      const code = gp.permission?.code || gp.code;
      if (code && currentGroupCodesMap.has(gp.permissionGroupId)) {
        currentGroupCodesMap.get(gp.permissionGroupId).add(code);
      }
    });

    const allPermsInDb = await tx.permission.findMany({ select: { id: true, code: true } });
    const permIdToCode = new Map((allPermsInDb || []).map((p) => [p.id, p.code]).filter(([, code]) => Boolean(code)));

    const allAddedCodes = [];
    const allRemovedCodes = [];
    for (const { groupId, permissionIds: nextPermissionIds } of updates) {
      const currentCodes = currentGroupCodesMap.get(groupId) || new Set();
      const nextCodes = new Set((nextPermissionIds || []).map((id) => permIdToCode.get(id)).filter(Boolean));

      const added = [...nextCodes].filter((code) => !currentCodes.has(code));
      const removed = [...currentCodes].filter((code) => !nextCodes.has(code));
      allAddedCodes.push(...added);
      allRemovedCodes.push(...removed);
    }

    assertPermissionMutationAuthority({
      actor,
      addedCodes: allAddedCodes,
      removedCodes: allRemovedCodes,
      targetGroups: existingGroups,
    });

    for (const { groupId, permissionIds: nextPermissionIds } of updates) {
      await tx.permissionGroupPermission.deleteMany({
        where: { permissionGroupId: groupId },
      });

      if (nextPermissionIds.length > 0) {
        await tx.permissionGroupPermission.createMany({
          data: nextPermissionIds.map((permissionId) => ({
            permissionGroupId: groupId,
            permissionId,
          })),
        });
      }
    }

    const managerGroupCount = await tx.permissionGroupPermission.count({
      where: { permissionId: managePermission.id },
    });
    if (managerGroupCount < 1) {
      throw createMatrixError(
        409,
        'Không thể gỡ PERMISSION_GROUP_MANAGE khỏi tất cả nhóm quyền.',
      );
    }

    if (tx.userPermissionGroup?.findMany) {
      const affectedUsers = await tx.userPermissionGroup.findMany({
        where: { permissionGroupId: { in: groupIds } },
        select: { userId: true },
      });
      const affectedUserIds = [...new Set(affectedUsers.map((u) => u.userId))];
      await invalidatePermissions({ userIds: affectedUserIds, actor, reason: 'BULK_UPDATE_PERMISSION_MATRIX', tx });
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'BULK_UPDATE_PERMISSION_MATRIX',
        entityType: 'PermissionMatrix',
        entityId: null,
        details: {
          updatedGroupsCount: updates.length,
        },
        ipAddress: getRequestIp(actor),
      },
    });
  }, {
    isolationLevel: 'Serializable',
  });

  clearAuthCache();
  return { success: true, message: 'Cập nhật ma trận phân quyền thành công.' };
};

module.exports = {
  PERMISSION_CATALOG,
  DEFAULT_GROUPS,
  listPermissions,
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  setUserGroups,
  getUserPermissions,
  hasPermission,
  seedPermissionCatalog,
  getPermissionMatrix,
  bulkUpdatePermissionMatrix,
};
