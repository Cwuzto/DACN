const NETWORK_CODES = new Set([
    'ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE',
]);

const isCancellation = (error) => error?.code === 'ERR_CANCELED'
    || error?.__CANCEL__ === true
    || error?.name === 'AbortError'
    || error?.name === 'CanceledError';

export const getErrorStatus = (error) => {
    const status = error?.response?.status ?? error?.status;
    return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
};

export const normalizeApiError = (error) => {
    const data = error?.response ? error.response.data : error;
    // Keep backend envelope fields used by existing callers, without leaking Axios internals.
    const payload = data && typeof data === 'object' && !(data instanceof Error)
        && (error?.response || !error?.request) ? data : {};
    const status = getErrorStatus(error);
    const code = isCancellation(error) ? 'ERR_CANCELED'
        : payload.code ?? (typeof payload.error === 'string' ? payload.error : undefined)
            ?? error?.code ?? (error?.request && !error?.response ? 'ERR_NETWORK' : undefined);
    const metadata = {};
    for (const field of ['details', 'errors', 'requiresUserConfirmation']) {
        const value = payload[field] !== undefined ? payload[field] : error?.[field];
        if (value !== undefined) metadata[field] = value;
    }

    return {
        ...payload,
        ...metadata,
        success: false,
        message: payload.message || error?.message
            || (typeof error === 'string' && error) || 'Đã xảy ra lỗi. Vui lòng thử lại.',
        ...(status !== undefined ? { status } : {}),
        ...(code !== undefined ? { code } : {}),
    };
};

export const shouldRetryQuery = (failureCount, error) => {
    const normalized = normalizeApiError(error);
    if (failureCount >= 1 || normalized.code === 'ERR_CANCELED' || normalized.requiresUserConfirmation) {
        return false;
    }
    const status = getErrorStatus(normalized);
    if (status !== undefined) return status >= 500 && status < 600;
    return NETWORK_CODES.has(normalized.code);
};
