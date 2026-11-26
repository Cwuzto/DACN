const { isTransientDisconnect, ResilientPgClient } = require('../../src/config/database');
const { Client } = require('pg');

describe('ResilientPgClient & Database Resilience', () => {
    describe('isTransientDisconnect', () => {
        it('identifies transient network and server pooler disconnects', () => {
            expect(isTransientDisconnect(new Error('Connection terminated unexpectedly'))).toBe(true);
            expect(isTransientDisconnect(new Error('connection terminated by server'))).toBe(true);
            expect(isTransientDisconnect(new Error('terminating connection due to administrator command'))).toBe(true);
            expect(isTransientDisconnect(new Error('query timeout'))).toBe(true);
            expect(isTransientDisconnect({ code: 'ECONNRESET' })).toBe(true);
            expect(isTransientDisconnect({ code: 'EPIPE' })).toBe(true);
            expect(isTransientDisconnect({ code: 'ETIMEDOUT' })).toBe(true);
            expect(isTransientDisconnect({ code: '57P01' })).toBe(true);
            expect(isTransientDisconnect({ code: '57P02' })).toBe(true);
            expect(isTransientDisconnect({ code: '57P03' })).toBe(true);
        });

        it('returns false for null, undefined, or permanent errors', () => {
            expect(isTransientDisconnect(null)).toBe(false);
            expect(isTransientDisconnect(undefined)).toBe(false);
            expect(isTransientDisconnect(new Error('syntax error at or near SELECT'))).toBe(false);
            expect(isTransientDisconnect({ code: '23505' })).toBe(false); // unique_violation
        });
    });

    describe('ResilientPgClient query queue serialization', () => {
        let client;

        beforeEach(() => {
            client = new ResilientPgClient({ host: 'localhost', port: 5432, database: 'test' });
        });

        it('serializes concurrent Promise-based query executions sequentially', async () => {
            const executionOrder = [];
            let inFlightCount = 0;
            let maxInFlight = 0;

            // Mock super.query behavior
            jest.spyOn(Client.prototype, 'query').mockImplementation(async (sql) => {
                inFlightCount += 1;
                if (inFlightCount > maxInFlight) maxInFlight = inFlightCount;
                executionOrder.push(`start:${sql}`);
                await new Promise((resolve) => setTimeout(resolve, 10));
                executionOrder.push(`end:${sql}`);
                inFlightCount -= 1;
                return { rows: [{ val: sql }] };
            });

            // Fire 3 queries simultaneously without await
            const p1 = client.query('Q1');
            const p2 = client.query('Q2');
            const p3 = client.query('Q3');

            const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

            expect(r1.rows[0].val).toBe('Q1');
            expect(r2.rows[0].val).toBe('Q2');
            expect(r3.rows[0].val).toBe('Q3');

            // Max in-flight on the same client socket must never exceed 1
            expect(maxInFlight).toBe(1);

            // Sequential order: Q1 must end before Q2 starts, Q2 before Q3 starts
            expect(executionOrder).toEqual([
                'start:Q1',
                'end:Q1',
                'start:Q2',
                'end:Q2',
                'start:Q3',
                'end:Q3',
            ]);
        });

        it('supports callback style and serializes safely', (done) => {
            jest.spyOn(Client.prototype, 'query').mockImplementation((sql, cb) => {
                setTimeout(() => cb(null, { rows: [{ result: sql }] }), 10);
            });

            client.query('CALLBACK_QUERY', (err, res) => {
                expect(err).toBeNull();
                expect(res.rows[0].result).toBe('CALLBACK_QUERY');
                done();
            });
        });

        it('continues processing remaining queries when an earlier query rejects', async () => {
            jest.spyOn(Client.prototype, 'query').mockImplementation(async (sql) => {
                if (sql === 'FAIL') {
                    throw new Error('Query syntax error');
                }
                return { rows: [{ ok: true }] };
            });

            const p1 = client.query('FAIL');
            const p2 = client.query('SUCCESS');

            await expect(p1).rejects.toThrow('Query syntax error');
            const res2 = await p2;
            expect(res2.rows[0].ok).toBe(true);
        });
    });
});

