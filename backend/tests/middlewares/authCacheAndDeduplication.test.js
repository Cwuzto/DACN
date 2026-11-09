jest.mock('../../src/config/database', () => {
    const mockPrisma = {
        user: { findUnique: jest.fn() },
        academicDelegation: { findMany: jest.fn() },
    };
    return mockPrisma;
});

const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const { authenticate, clearAuthCache, getAuthCacheStats } = require('../../src/middlewares/auth');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('Auth Middleware Cache & Single-Flight Deduplication', () => {
    const JWT_SECRET = 'unit-test-secret-cache';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = JWT_SECRET;
        if (typeof clearAuthCache === 'function') {
            clearAuthCache();
        }
    });

    test('coalesces 4 concurrent authenticate requests into a single database query (single-flight)', async () => {
        const token = jwt.sign({ userId: 10, permissionVersion: 1 }, JWT_SECRET);
        prisma.user.findUnique.mockImplementation(() => new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    id: 10,
                    email: 'test@university.edu.vn',
                    isActive: true,
                    permissionVersion: 1,
                    role: 'ADMIN',
                    permissionGroups: [],
                    studentProfile: null,
                    councilMembers: [],
                });
            }, 20);
        }));
        prisma.academicDelegation.findMany.mockResolvedValue([]);

        const reqs = Array.from({ length: 4 }, () => createMockReq({ headers: { authorization: `Bearer ${token}` } }));
        const resList = reqs.map(() => createMockRes());
        const nextList = reqs.map(() => createNext());

        await Promise.all(reqs.map((req, i) => authenticate(req, resList[i], nextList[i])));

        nextList.forEach((n) => expect(n).toHaveBeenCalled());
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    test('serves subsequent request within TTL from cache without re-querying database', async () => {
        const token = jwt.sign({ userId: 10, permissionVersion: 1 }, JWT_SECRET);
        prisma.user.findUnique.mockResolvedValue({
            id: 10,
            email: 'test@university.edu.vn',
            isActive: true,
            permissionVersion: 1,
            role: 'ADMIN',
            permissionGroups: [],
            studentProfile: null,
            councilMembers: [],
        });
        prisma.academicDelegation.findMany.mockResolvedValue([]);

        // Request 1: cold cache -> hits DB
        const req1 = createMockReq({ headers: { authorization: `Bearer ${token}` } });
        const res1 = createMockRes();
        const next1 = createNext();
        await authenticate(req1, res1, next1);
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

        // Request 2: warm cache -> hits RAM
        const req2 = createMockReq({ headers: { authorization: `Bearer ${token}` } });
        const res2 = createMockRes();
        const next2 = createNext();
        await authenticate(req2, res2, next2);
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
        expect(req2.user.email).toBe('test@university.edu.vn');
    });

    test('invalidates cache when clearAuthCache is called', async () => {
        const token = jwt.sign({ userId: 10, permissionVersion: 1 }, JWT_SECRET);
        prisma.user.findUnique.mockResolvedValue({
            id: 10,
            email: 'test@university.edu.vn',
            isActive: true,
            permissionVersion: 1,
            role: 'ADMIN',
            permissionGroups: [],
            studentProfile: null,
            councilMembers: [],
        });
        prisma.academicDelegation.findMany.mockResolvedValue([]);

        const req1 = createMockReq({ headers: { authorization: `Bearer ${token}` } });
        await authenticate(req1, createMockRes(), createNext());
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

        clearAuthCache(10);

        const req2 = createMockReq({ headers: { authorization: `Bearer ${token}` } });
        await authenticate(req2, createMockRes(), createNext());
        expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    test('stale version guard still rejects with 409 if token.permissionVersion < cached user.permissionVersion', async () => {
        const oldToken = jwt.sign({ userId: 10, permissionVersion: 1 }, JWT_SECRET);
        prisma.user.findUnique.mockResolvedValue({
            id: 10,
            email: 'test@university.edu.vn',
            isActive: true,
            permissionVersion: 2,
            role: 'ADMIN',
            permissionGroups: [],
            studentProfile: null,
            councilMembers: [],
        });
        prisma.academicDelegation.findMany.mockResolvedValue([]);

        const req = createMockReq({
            method: 'POST',
            originalUrl: '/api/topics',
            headers: { authorization: `Bearer ${oldToken}` },
        });
        const res = createMockRes();
        const next = createNext();

        await authenticate(req, res, next);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'PERMISSION_VERSION_STALE' }));
    });
});
