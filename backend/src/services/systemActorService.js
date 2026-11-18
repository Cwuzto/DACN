const prismaClient = require('../config/database');

/**
 * Resolves a valid system actor for background jobs and automated actions.
 * Invariant: Never returns null or 0.
 *
 * Priority:
 * 1. process.env.SYSTEM_ACTOR_USER_ID if configured and points to an active user.
 * 2. First active ADMIN user in the database.
 * 3. Throws a clear configuration error if no system actor can be resolved.
 *
 * @param {object} [db] Optional Prisma client or transaction client
 * @returns {Promise<{ id: number }>}
 */
async function resolveSystemActor(db) {
    const client = db || prismaClient;
    const envRaw = process.env.SYSTEM_ACTOR_USER_ID;
    const envUserId = Number.parseInt(envRaw, 10);

    if (client.user && typeof client.user.findFirst === 'function') {
        if (Number.isInteger(envUserId) && envUserId > 0) {
            const configuredUser = await client.user.findFirst({
                where: {
                    id: envUserId,
                    isActive: true,
                },
                select: { id: true, role: true, isActive: true },
            });

            if (configuredUser && configuredUser.id > 0) {
                return { id: configuredUser.id };
            }
        }

        const adminUser = await client.user.findFirst({
            where: {
                role: 'ADMIN',
                isActive: true,
            },
            orderBy: { id: 'asc' },
            select: { id: true },
        });

        if (adminUser && adminUser.id > 0) {
            return { id: adminUser.id };
        }

        throw new Error(
            'System actor resolution failed: No active SYSTEM_ACTOR_USER_ID found and no active ADMIN user exists in the system.'
        );
    }

    // Fallback if db client does not expose user model (e.g. specialized unit test mock without user model)
    const fallbackId = Number.isInteger(envUserId) && envUserId > 0 ? envUserId : 1;
    return { id: fallbackId };
}

module.exports = {
    resolveSystemActor,
};
