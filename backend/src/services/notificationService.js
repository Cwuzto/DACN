const prisma = require('../config/database');

const isStudentRecipient = async (userId) => {
    if (!userId || !prisma.user?.findUnique) return false;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        return user?.role === 'STUDENT';
    } catch (_) {
        return false;
    }
};

const containsUnpromulgatedDefenseScore = (data) => {
    if (data?.isPromulgated) return false;
    if (data?.type === 'DEFENSE') {
        const text = `${data.title || ''} ${data.content || ''}`;
        if (/(?:điểm|diem|score|\b\d+[.,]\d+\b)/i.test(text)) {
            return true;
        }
    }
    return false;
};

const safeNotify = async (data, context = 'unknown') => {
    try {
        if (!data?.userId || !data?.title || !data?.content) {
            return { ok: false, skipped: true, reason: 'invalid_payload' };
        }

        // SEC-12: Block leaking unpromulgated defense scores to students via notifications
        if (containsUnpromulgatedDefenseScore(data)) {
            const isStudent = data.isStudent ?? (await isStudentRecipient(data.userId));
            if (isStudent) {
                console.warn(`[SEC-12] Blocked attempt to send unpromulgated defense score notification to student ${data.userId} (${context})`);
                return { ok: false, skipped: true, reason: 'UNPROMULGATED_DEFENSE_SCORE_BLOCKED' };
            }
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

        const validRows = [];
        for (const row of rows) {
            if (!row?.userId || !row?.title || !row?.content) continue;

            if (containsUnpromulgatedDefenseScore(row)) {
                const isStudent = row.isStudent ?? (await isStudentRecipient(row.userId));
                if (isStudent) {
                    console.warn(`[SEC-12] Blocked attempt to send unpromulgated defense score notification to student ${row.userId} in batch (${context})`);
                    continue;
                }
            }
            validRows.push(row);
        }

        if (validRows.length === 0) {
            return { ok: false, skipped: true, reason: 'all_payloads_skipped_or_invalid' };
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
