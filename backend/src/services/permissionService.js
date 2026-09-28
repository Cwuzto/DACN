const prisma = require('../config/database');
const { auditLog } = require('./auditLogService');
const getRequestIp = (req) => req?.ip || req?.headers?.['x-forwarded-for'] || null;

const PERMISSION_CATALOG = [
  { code: 'PUBLIC_ANNOUNCEMENT_VIEW', label: 'Xem tin công khai', module: 'ANNOUNCEMENT' },
  { code: 'PUBLIC_ANNOUNCEMENT_MANAGE', label: 'Quản lý tin công khai', module: 'ANNOUNCEMENT' },
  { code: 'ELIGIBILITY_VIEW_OWN', label: 'Xem điều kiện bản thân', module: 'ELIGIBILITY' },
  { code: 'ELIGIBILITY_VIEW_ALL', label: 'Xem danh sách đủ điều kiện', module: 'ELIGIBILITY' },
  { code: 'ELIGIBILITY_PUBLISH', label: 'Công bố danh sách đủ điều kiện', module: 'ELIGIBILITY' },
  { code: 'LECTURER_PROFILE_VIEW', label: 'Xem hồ sơ giảng viên', module: 'LECTURER' },
  { code: 'LECTURER_PROFILE_MANAGE', label: 'Cập nhật hồ sơ giảng viên', module: 'LECTURER' },
  { code: 'LECTURER_DIRECTORY_VIEW', label: 'Xem danh bạ giảng viên', module: 'LECTURER' },
  { code: 'LECTURER_DIRECTORY_PUBLISH', label: 'Công bố danh bạ giảng viên', module: 'LECTURER' },
  { code: 'MENTOR_REQUEST_CREATE', label: 'Gửi yêu cầu chọn GVHD', module: 'MENTOR' },
  { code: 'MENTOR_REQUEST_REVIEW', label: 'Xem/xử lý yêu cầu chọn GVHD', module: 'MENTOR' },
  { code: 'MENTOR_ASSIGN', label: 'Phân công GVHD', module: 'MENTOR' },
  { code: 'MENTOR_ASSIGNMENT_ADJUST', label: 'Điều chỉnh phân công GVHD', module: 'MENTOR' },
  { code: 'TOPIC_VIEW', label: 'Xem đề tài', module: 'TOPIC' },
  { code: 'TOPIC_CREATE', label: 'Tạo đề tài', module: 'TOPIC' },
  { code: 'TOPIC_UPDATE_OWN', label: 'Cập nhật đề tài của mình', module: 'TOPIC' },
  { code: 'TOPIC_REVIEW', label: 'Xét duyệt đề tài', module: 'TOPIC' },
  { code: 'OUTLINE_SUBMIT', label: 'Nộp đề cương BM01', module: 'OUTLINE' },
  { code: 'OUTLINE_REVIEW', label: 'Xem/góp ý đề cương', module: 'OUTLINE' },
  { code: 'OUTLINE_APPROVE', label: 'Duyệt đề cương', module: 'OUTLINE' },
  { code: 'OUTLINE_COUNCIL_MANAGE', label: 'Lập hội đồng xét duyệt đề cương', module: 'OUTLINE' },
  { code: 'BM02_SUBMIT', label: 'Nộp đơn BM02', module: 'REGISTRATION' },
  { code: 'PROJECT_ASSIGNMENT_PUBLISH', label: 'Công bố danh sách giao đề tài', module: 'REGISTRATION' },
  { code: 'BM03_SUBMIT', label: 'Theo dõi BM03', module: 'PROGRESS' },
  { code: 'BM03_REVIEW', label: 'Xem tiến độ sinh viên', module: 'PROGRESS' },
  { code: 'BM03_CHECKPOINT_DECIDE', label: 'Đánh giá checkpoint', module: 'PROGRESS' },
  { code: 'BM04_SUBMIT', label: 'Ghi BM04', module: 'PROGRESS' },
  { code: 'BM04_REVIEW', label: 'Xem BM04', module: 'PROGRESS' },
  { code: 'DEFENSE_COUNCIL_MANAGE', label: 'Lập hội đồng chấm BCTN', module: 'DEFENSE' },
  { code: 'DEFENSE_SCORE_SUBMIT', label: 'Nhập phiếu chấm cá nhân', module: 'DEFENSE' },
  { code: 'DEFENSE_SCORE_VIEW', label: 'Xem điểm hội đồng', module: 'DEFENSE' },
  { code: 'RESULT_LOCK', label: 'Khóa kết quả', module: 'DEFENSE' },
  { code: 'RESULT_PUBLISH', label: 'Công bố kết quả', module: 'DEFENSE' },
  { code: 'POST_DEFENSE_REVISION_SUBMIT', label: 'Nộp chỉnh sửa sau bảo vệ', module: 'REVISION' },
  { code: 'POST_DEFENSE_REVISION_REVIEW', label: 'Xác nhận chỉnh sửa sau bảo vệ', module: 'REVISION' },
  { code: 'FINAL_DOCUMENT_SUBMIT', label: 'Nộp quyển/file mềm/source', module: 'REVISION' },
  { code: 'REPORT_VIEW', label: 'Xem báo cáo nghiệp vụ', module: 'REPORT' },
  { code: 'USER_MANAGE', label: 'Quản lý tài khoản', module: 'ADMIN' },
  { code: 'USER_IMPORT', label: 'Import danh sách tài khoản', module: 'ADMIN' },
  { code: 'PERMISSION_GROUP_MANAGE', label: 'Quản lý nhóm quyền', module: 'ADMIN' },
  { code: 'AUDIT_LOG_VIEW', label: 'Xem audit log', module: 'ADMIN' },
  { code: 'SYSTEM_CONFIG_MANAGE', label: 'Cấu hình hệ thống', module: 'ADMIN' },
  { code: 'SEMESTER_MANAGE', label: 'Quản lý học kỳ', module: 'ADMIN' },
  { code: 'PROJECT_CATALOG_MANAGE', label: 'Quản lý danh mục đồ án', module: 'ADMIN' },
  { code: 'ENROLLMENT_MANAGE', label: 'Quản lý enrollment', module: 'ADMIN' },
];

const DEFAULT_GROUPS = [
  {
    name: 'Giảng viên hướng dẫn',
    code: 'GVHD',
    description: 'Quyền nghiệp vụ của giảng viên hướng dẫn',
    permissions: [
      'LECTURER_PROFILE_VIEW', 'LECTURER_PROFILE_MANAGE', 'TOPIC_VIEW', 'TOPIC_CREATE',
      'TOPIC_UPDATE_OWN', 'MENTOR_REQUEST_REVIEW', 'OUTLINE_REVIEW', 'BM03_SUBMIT',
      'BM03_REVIEW', 'BM03_CHECKPOINT_DECIDE', 'BM04_SUBMIT', 'DEFENSE_SCORE_SUBMIT',
      'DEFENSE_SCORE_VIEW', 'POST_DEFENSE_REVISION_SUBMIT', 'REPORT_VIEW',
    ],
  },
  {
    name: 'Viện trưởng',
    code: 'VIEN_TRUONG',
    description: 'Quyền quản lý nghiệp vụ của Viện trưởng kiêm GVHD',
    permissions: [
      'ELIGIBILITY_VIEW_ALL', 'ELIGIBILITY_PUBLISH', 'LECTURER_DIRECTORY_VIEW',
      'LECTURER_DIRECTORY_PUBLISH', 'MENTOR_ASSIGN', 'MENTOR_ASSIGNMENT_ADJUST',
      'TOPIC_VIEW', 'TOPIC_REVIEW', 'OUTLINE_REVIEW', 'OUTLINE_APPROVE',
      'OUTLINE_COUNCIL_MANAGE', 'PROJECT_ASSIGNMENT_PUBLISH', 'BM03_REVIEW',
      'BM04_REVIEW', 'DEFENSE_COUNCIL_MANAGE', 'DEFENSE_SCORE_VIEW', 'RESULT_LOCK',
      'RESULT_PUBLISH', 'POST_DEFENSE_REVISION_REVIEW', 'PUBLIC_ANNOUNCEMENT_MANAGE',
      'REPORT_VIEW', 'AUDIT_LOG_VIEW',
    ],
  },
  {
    name: 'Quản trị viên',
    code: 'QUAN_TRI_VIEN',
    description: 'Quyền quản trị hệ thống',
    permissions: [
      'USER_MANAGE', 'USER_IMPORT', 'PERMISSION_GROUP_MANAGE', 'PUBLIC_ANNOUNCEMENT_MANAGE',
      'SYSTEM_CONFIG_MANAGE', 'SEMESTER_MANAGE', 'PROJECT_CATALOG_MANAGE',
      'ENROLLMENT_MANAGE', 'AUDIT_LOG_VIEW', 'REPORT_VIEW',
    ],
  },
];

const listPermissions = async () => prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });

const listGroups = async () =>
  prisma.permissionGroup.findMany({
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
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissionCodes !== undefined) {
      await tx.permissionGroupPermission.deleteMany({ where: { permissionGroupId: idInt } });
      updateData.permissions = { create: await mapPermissions(tx, permissionCodes) };
    }
    return tx.permissionGroup.update({ where: { id: idInt }, data: updateData });
  });
  await auditLog(actor?.id, 'UPDATE_PERMISSION_GROUP', 'PermissionGroup', idInt, { name, description }, getRequestIp(actor));
  return result;
};

const deleteGroup = async (id, actor) => {
  const idInt = parseInt(id, 10);
  const deleted = await prisma.permissionGroup.delete({ where: { id: idInt } });
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
  const groupIdsInt = Array.isArray(groupIds) ? groupIds.map((value) => parseInt(value, 10)) : [];
  const result = await prisma.$transaction(async (tx) => {
    await tx.userPermissionGroup.deleteMany({ where: { userId: userIdInt } });
    if (groupIdsInt.length) {
      await tx.userPermissionGroup.createMany({
        data: groupIdsInt.map((permissionGroupId) => ({ userId: userIdInt, permissionGroupId })),
      });
    }
  });
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

const seedPermissionCatalog = async () => {
  for (const item of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: item.code },
      update: { label: item.label, module: item.module },
      create: item,
    });
  }
  for (const group of DEFAULT_GROUPS) {
    const existing = await prisma.permissionGroup.findUnique({ where: { code: group.code } });
    const permissionIds = await prisma.permission.findMany({
      where: { code: { in: group.permissions } },
      select: { id: true },
    });
    if (existing) {
      await prisma.permissionGroupPermission.deleteMany({ where: { permissionGroupId: existing.id } });
      await prisma.permissionGroup.update({
        where: { id: existing.id },
        data: {
          name: group.name,
          description: group.description,
          permissions: { create: permissionIds.map((permission) => ({ permissionId: permission.id })) },
        },
      });
    } else {
      await prisma.permissionGroup.create({
        data: {
          code: group.code,
          name: group.name,
          description: group.description,
          isSystem: true,
          permissions: { create: permissionIds.map((permission) => ({ permissionId: permission.id })) },
        },
      });
    }
  }
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
};
