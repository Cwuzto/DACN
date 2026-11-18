const { startScheduledJobs } = require('../../src/jobs');
const {
    runBm02ToBm04SweepJobs,
    startBm02ToBm04SweepScheduler,
    SWEEP_ADVISORY_LOCK_ID,
} = require('../../src/services/bm02ToBm04SweepService');
const {
    runCheckpointDeadlineOverdueJob,
    startCheckpointDeadlineOverdueScheduler,
    ADVISORY_LOCK_ID,
} = require('../../src/jobs/checkpointDeadlineOverdueJob');

describe('Task 5: Workflow Job Locking, Scheduling & Idempotency', () => {
    describe('1. Scheduler Registration & Lifecycle', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        test('startScheduledJobs registers all schedulers including BM02-BM04 sweep and checkpoint overdue', () => {
            const stopAll = startScheduledJobs();
            expect(typeof stopAll).toBe('function');

            // Timers should be active
            expect(jest.getTimerCount()).toBeGreaterThanOrEqual(2);

            // Cleanup should clear timers
            stopAll();
            expect(jest.getTimerCount()).toBe(0);
        });

        test('startBm02ToBm04SweepScheduler respects ENABLE_BM02_BM04_SWEEP_JOB=false', () => {
            const oldVal = process.env.ENABLE_BM02_BM04_SWEEP_JOB;
            process.env.ENABLE_BM02_BM04_SWEEP_JOB = 'false';

            const initialTimers = jest.getTimerCount();
            const stop = startBm02ToBm04SweepScheduler();
            expect(jest.getTimerCount()).toBe(initialTimers);
            stop();

            process.env.ENABLE_BM02_BM04_SWEEP_JOB = oldVal;
        });

        test('startCheckpointDeadlineOverdueScheduler respects ENABLE_CHECKPOINT_DEADLINE_JOB=false', () => {
            const oldVal = process.env.ENABLE_CHECKPOINT_DEADLINE_JOB;
            process.env.ENABLE_CHECKPOINT_DEADLINE_JOB = 'false';

            const initialTimers = jest.getTimerCount();
            const stop = startCheckpointDeadlineOverdueScheduler();
            expect(jest.getTimerCount()).toBe(initialTimers);
            stop();

            process.env.ENABLE_CHECKPOINT_DEADLINE_JOB = oldVal;
        });
    });

    describe('2. Advisory Lock Protection for Sweep Jobs', () => {
        test('skips execution when advisory xact lock cannot be acquired (locked by another instance)', async () => {
            const mockDb = {
                $transaction: jest.fn(async (cb) => {
                    const mockTx = {
                        $queryRawUnsafe: jest.fn().mockResolvedValue([{ locked: false }]),
                        topicAssignmentDecision: { findMany: jest.fn() },
                        bM02AAdjustmentRequest: { findMany: jest.fn() },
                        instituteStopReview: { findMany: jest.fn() },
                        checkpointEvaluation: { findMany: jest.fn() },
                        instituteDefenseReview: { findMany: jest.fn() },
                    };
                    return cb(mockTx);
                }),
            };

            const result = await runBm02ToBm04SweepJobs({}, { db: mockDb });

            expect(result.skipped).toBe(true);
            expect(result.reason).toBe('LOCKED_BY_ANOTHER_INSTANCE');
            expect(result.closedBm02AWindowsCount).toBe(0);
            expect(result.expiredBm02ARequestsCount).toBe(0);
        });

        test('executes sweep jobs normally when advisory xact lock is acquired', async () => {
            const mockDb = {
                $transaction: jest.fn(async (cb) => {
                    const mockTx = {
                        $queryRawUnsafe: jest.fn().mockImplementation((query) => {
                            if (query.includes(String(SWEEP_ADVISORY_LOCK_ID))) {
                                return Promise.resolve([{ locked: true }]);
                            }
                            return Promise.resolve([]);
                        }),
                        topicAssignmentDecision: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        bM02AAdjustmentRequest: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        instituteStopReview: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        checkpointEvaluation: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        instituteDefenseReview: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                    };
                    return cb(mockTx);
                }),
            };

            const result = await runBm02ToBm04SweepJobs({}, { db: mockDb });

            expect(result.skipped).toBeUndefined();
            expect(result.closedBm02AWindowsCount).toBe(0);
            expect(result.expiredBm02ARequestsCount).toBe(0);
        });
    });

    describe('3. Advisory Lock Protection for Checkpoint Overdue Job', () => {
        test('skips execution when advisory lock is held by another instance', async () => {
            const mockDb = {
                $queryRawUnsafe: jest.fn().mockImplementation((query) => {
                    if (query.includes(String(ADVISORY_LOCK_ID))) {
                        return Promise.resolve([{ locked: false }]);
                    }
                    return Promise.resolve([]);
                }),
                user: {
                    findFirst: jest.fn().mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true }),
                },
                topicRegistration: {
                    findMany: jest.fn(),
                },
            };

            const result = await runCheckpointDeadlineOverdueJob({ db: mockDb });

            expect(result.skipped).toBe(true);
            expect(result.reason).toBe('LOCKED_BY_ANOTHER_INSTANCE');
            expect(result.processedCount).toBe(0);
            expect(mockDb.topicRegistration.findMany).not.toHaveBeenCalled();
        });

        test('acquires and releases advisory lock properly during execution', async () => {
            const mockDb = {
                $queryRawUnsafe: jest.fn().mockImplementation((query) => {
                    if (query.includes('pg_try_advisory_xact_lock') || query.includes('pg_try_advisory_lock')) {
                        return Promise.resolve([{ locked: true }]);
                    }
                    if (query.includes('pg_advisory_unlock')) {
                        return Promise.resolve([{ unlocked: true }]);
                    }
                    return Promise.resolve([]);
                }),
                user: {
                    findFirst: jest.fn().mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true }),
                },
                topicRegistration: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
            };

            const result = await runCheckpointDeadlineOverdueJob({ db: mockDb });

            expect(result.scanned).toBe(0);
            expect(result.processedCount).toBe(0);
            // Verify lock release was called
            expect(mockDb.$queryRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining(`pg_advisory_unlock(${ADVISORY_LOCK_ID})`)
            );
        });
    });

    describe('4. Sweep Jobs Idempotency', () => {
        test('back-to-back runs yield 0 additional updates after initial pass', async () => {
            const now = new Date('2026-11-20T10:00:00Z');

            // Simulated DB table state
            let bm02Requests = [
                {
                    id: 101,
                    status: 'STUDENT_PREPARING',
                    titleAdjustmentDeadline: new Date('2026-11-19T10:00:00Z'), // Overdue
                },
            ];

            let stopReviews = [
                {
                    id: 201,
                    registrationId: 301,
                    status: 'STOP_REVIEW_PENDING',
                    stopReviewDeadline: new Date('2026-11-19T10:00:00Z'), // Overdue
                },
            ];

            const createMockDb = () => ({
                $transaction: jest.fn(async (cb) => {
                    const mockTx = {
                        $queryRawUnsafe: jest.fn().mockResolvedValue([{ locked: true }]),
                        topicAssignmentDecision: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        bM02AAdjustmentRequest: {
                            findMany: jest.fn().mockImplementation(async ({ where }) => {
                                return bm02Requests.filter((r) =>
                                    where.status.in.includes(r.status) && r.titleAdjustmentDeadline < now
                                );
                            }),
                            updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
                                const matched = bm02Requests.filter((r) => where.id.in.includes(r.id));
                                matched.forEach((r) => {
                                    r.status = data.status;
                                });
                                return { count: matched.length };
                            }),
                        },
                        instituteStopReview: {
                            findMany: jest.fn().mockImplementation(async ({ where }) => {
                                return stopReviews.filter((r) =>
                                    where.status.in.includes(r.status) && r.stopReviewDeadline < now
                                );
                            }),
                            updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
                                const matched = stopReviews.filter((r) => where.id === r.id);
                                matched.forEach((r) => {
                                    r.status = data.status;
                                });
                                return { count: matched.length };
                            }),
                        },
                        checkpointEvaluation: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        instituteDefenseReview: {
                            findMany: jest.fn().mockResolvedValue([]),
                        },
                        topicRegistration: {
                            update: jest.fn().mockResolvedValue({}),
                        },
                        bM04Evaluation: {
                            update: jest.fn().mockResolvedValue({}),
                        },
                    };
                    return cb(mockTx);
                }),
            });

            // First run: should process the overdue items
            const db1 = createMockDb();
            const result1 = await runBm02ToBm04SweepJobs({ now }, { db: db1 });

            expect(result1.expiredBm02ARequestsCount).toBe(1);
            expect(result1.autoTerminatedStopReviewsCount).toBe(1);
            expect(bm02Requests[0].status).toBe('EXPIRED');
            expect(stopReviews[0].status).toBe('AUTO_TERMINATED');

            // Second run immediately after: nothing is overdue anymore
            const db2 = createMockDb();
            const result2 = await runBm02ToBm04SweepJobs({ now }, { db: db2 });

            expect(result2.expiredBm02ARequestsCount).toBe(0);
            expect(result2.autoTerminatedStopReviewsCount).toBe(0);
            expect(result2.closedBm02AWindowsCount).toBe(0);
            expect(result2.autoCompletedStudentAcksCount).toBe(0);
            expect(result2.autoFinalizedDefenseReviewsCount).toBe(0);
        });
    });
});
