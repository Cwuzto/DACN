/**
 * Middleware xử lý lỗi tập trung (Global Error Handler)
 * Mọi lỗi throw ra từ controller/service đều chạy vào đây
 */
const errorHandler = (err, req, res, next) => {
    const isConnTerminated =
        err?.message?.includes('Connection terminated unexpectedly') ||
        err?.code === 'P2025' ||
        err?.code === 'ECONNRESET';

    if (isConnTerminated) {
        console.warn('⚠️ [DB Warning] Database connection reset by pooler. Returning 503.');
        return res.status(503).json({
            success: false,
            error: 'DATABASE_TRANSIENT_DISCONNECT',
            message: 'Kết nối cơ sở dữ liệu bị gián đoạn tạm thời. Hệ thống đang tự động tái kết nối, vui lòng thử lại sau giây lát.',
        });
    }

    console.error('❌ Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Đã xảy ra lỗi từ máy chủ.';

    res.status(statusCode).json({
        success: false,
        message,
        ...(err.details && typeof err.details === 'object' ? err.details : {}),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
