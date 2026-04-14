const prisma = require('../config/database');

const safeNotify = async (data, context = 'unknown') => {
    try {
        if (!data?.userId || !data?.title || !data?.content) {
            return { ok: false, skipped: true, reason: 'invalid_payload' };
        }

        const created = await prisma.notification.create({ data });
        return { ok: true, created };
    } catch (error) {
        console.error(`[notify] safeNotify failed (${context}):`, error?.message || error);
        return { ok: false, error: error?.message || 'unknown_error' };
    }
};

const safeNotifyMany = async (rows, context = 'unknown') => {
    try {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { ok: true, count: 0 };
        }

        const validRows = rows.filter((row) => row?.userId && row?.title && row?.content);
        if (validRows.length === 0) {
            return { ok: false, skipped: true, reason: 'invalid_payload' };
        }

        const result = await prisma.notification.createMany({ data: validRows });
        return { ok: true, count: result?.count || 0 };
    } catch (error) {
        console.error(`[notify] safeNotifyMany failed (${context}):`, error?.message || error);
        return { ok: false, error: error?.message || 'unknown_error' };
    }
};

module.exports = {
    safeNotify,
    safeNotifyMany,
};
