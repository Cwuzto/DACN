const prisma = require('../config/database');
const {
  listPermissions,
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
} = require('../services/permissionService');
const { auditLog } = require('../services/auditLogService');
const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const listAllPermissions = async (req, res, next) => {
  try {
    const permissions = await listPermissions();
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
};

const listAllGroups = async (req, res, next) => {
  try {
    const groups = await listGroups();
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
};

const getGroup = async (req, res, next) => {
  try {
    const group = await getGroupById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm quyền.' });
    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

const createNewGroup = async (req, res, next) => {
  try {
    const { code, name, description, permissionCodes } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã và tên nhóm quyền.' });
    }
    if (await prisma.permissionGroup.findUnique({ where: { code } })) {
      return res.status(400).json({ success: false, message: 'Mã nhóm quyền đã tồn tại.' });
    }
    const group = await createGroup({ code, name, description, permissionCodes }, req.user);
    res.status(201).json({ success: true, message: 'Tạo nhóm quyền thành công.', data: group });
  } catch (error) {
    next(error);
  }
};

const updateExistingGroup = async (req, res, next) => {
  try {
    const { name, description, permissionCodes } = req.body;
    const existing = await getGroupById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm quyền.' });
    }
    const group = await updateGroup(req.params.id, { name, description, permissionCodes }, req.user);
    res.json({ success: true, message: 'Cập nhật nhóm quyền thành công.', data: group });
  } catch (error) {
    next(error);
  }
};

const deleteExistingGroup = async (req, res, next) => {
  try {
    const existing = await getGroupById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm quyền.' });
    }
    if (existing.isSystem) {
      return res.status(400).json({ success: false, message: 'Không thể xóa nhóm quyền hệ thống.' });
    }
    await deleteGroup(req.params.id, req.user);
    res.json({ success: true, message: 'Xóa nhóm quyền thành công.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAllPermissions,
  listAllGroups,
  getGroup,
  createNewGroup,
  updateExistingGroup,
  deleteExistingGroup,
};
