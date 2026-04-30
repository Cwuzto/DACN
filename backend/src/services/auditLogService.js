const prisma = require('../config/database');

const auditLog = async (userId, action, entityType, entityId, details = null, ipAddress = null) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId: entityId !== undefined && entityId !== null ? String(entityId) : null,
                details: details || undefined,
                ipAddress: ipAddress || null,
            },
        });
    } catch (error) {
        console.error('[audit] Failed to write audit log:', error?.message || error);
    }
};

module.exports = {
    auditLog,
};
