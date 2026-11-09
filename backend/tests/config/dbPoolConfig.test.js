const { DEFAULT_DB_POOL_MAX, DEFAULT_DB_POOL_CONNECTION_TIMEOUT, readPositiveInt } = require('../../src/config/database');

describe('Database Pool Configuration', () => {
    describe('DEFAULT_DB_POOL_MAX', () => {
        it('should export DEFAULT_DB_POOL_MAX equal to 8', () => {
            expect(DEFAULT_DB_POOL_MAX).toBe(8);
        });
    });

    describe('DEFAULT_DB_POOL_CONNECTION_TIMEOUT', () => {
        it('should export DEFAULT_DB_POOL_CONNECTION_TIMEOUT equal to 15000', () => {
            expect(DEFAULT_DB_POOL_CONNECTION_TIMEOUT).toBe(15000);
        });
    });

    describe('readPositiveInt', () => {
        it('should correctly parse valid positive integer strings', () => {
            expect(readPositiveInt('8', 2)).toBe(8);
            expect(readPositiveInt('15', 10)).toBe(15);
            expect(readPositiveInt(10, 2)).toBe(10);
        });

        it('should return fallback when value is undefined, null, or empty', () => {
            expect(readPositiveInt(undefined, 8)).toBe(8);
            expect(readPositiveInt(null, 8)).toBe(8);
            expect(readPositiveInt('', 8)).toBe(8);
        });

        it('should return fallback when value is zero, negative, or not a positive integer', () => {
            expect(readPositiveInt('0', 8)).toBe(8);
            expect(readPositiveInt('-5', 8)).toBe(8);
            expect(readPositiveInt('abc', 8)).toBe(8);
            expect(readPositiveInt(NaN, 8)).toBe(8);
        });
    });
});
