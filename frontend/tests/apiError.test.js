import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiError, getErrorStatus, shouldRetryQuery } from '../src/utils/apiError.js';

test('normalization retains HTTP and backend metadata, including legacy error fields', () => {
    for (const status of [403, 409, 500]) {
        const error = normalizeApiError({
            message: 'Axios message',
            code: 'ERR_BAD_RESPONSE',
            request: {},
            response: {
                status,
                data: { message: 'Backend message', error: 'DOMAIN_ERROR', details: { id: 'r1' }, errors: ['invalid'] },
            },
        });
        assert.deepEqual(error, {
            success: false, message: 'Backend message', status, code: 'DOMAIN_ERROR',
            error: 'DOMAIN_ERROR', details: { id: 'r1' }, errors: ['invalid'],
        });
        assert.equal(getErrorStatus(error), status);
        assert.deepEqual(normalizeApiError(error), error);
    }
});

test('normalization retains network codes and already normalized confirmation envelopes', () => {
    assert.deepEqual(normalizeApiError(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })), {
        success: false, message: 'Network Error', code: 'ERR_NETWORK',
    });
    const error = { success: false, message: 'Confirm', status: 409, requiresUserConfirmation: true };
    assert.deepEqual(normalizeApiError(error), error);
    assert.equal(typeof normalizeApiError(null).message, 'string');
    assert.equal(normalizeApiError(null).success, false);
    const transportError = Object.assign(new Error('Offline'), { request: {}, config: { url: '/offline' } });
    assert.deepEqual(normalizeApiError(transportError), { success: false, message: 'Offline', code: 'ERR_NETWORK' });
});

test('getErrorStatus handles Axios and normalized errors without inventing status', () => {
    assert.equal(getErrorStatus({ response: { status: 422 } }), 422);
    assert.equal(getErrorStatus({ status: 403 }), 403);
    assert.equal(getErrorStatus({ code: 'ERR_NETWORK' }), undefined);
    assert.equal(getErrorStatus({ status: NaN }), undefined);
    assert.equal(getErrorStatus(null), undefined);
});

test('query retries once only for network errors and server failures', () => {
    for (const error of [
        { code: 'ERR_NETWORK' }, { code: 'ECONNABORTED' }, { code: 'ETIMEDOUT' },
        { request: {}, message: 'Connection failed' },
        { status: 500 }, { response: { status: 503 } }, { status: 599 },
    ]) {
        assert.equal(shouldRetryQuery(0, error), true);
        assert.equal(shouldRetryQuery(1, error), false);
        assert.equal(shouldRetryQuery(2, normalizeApiError(error)), false);
        assert.equal(shouldRetryQuery(0, normalizeApiError(error)), true);
    }
});

test('query never retries cancellation, client failures, confirmation, or unknown application failures', () => {
    for (const error of [
        ...[400, 401, 403, 404, 409, 422, 429].map((status) => ({ status })),
        { code: 'ERR_CANCELED' }, { name: 'AbortError' }, { __CANCEL__: true },
        { name: 'CanceledError', code: 'ERR_NETWORK' },
        { status: 503, requiresUserConfirmation: true },
        { success: false, message: 'Business rule failed' }, new Error('Programming error'), null,
    ]) {
        assert.equal(shouldRetryQuery(0, error), false);
        assert.equal(shouldRetryQuery(0, normalizeApiError(error)), false);
    }
});
