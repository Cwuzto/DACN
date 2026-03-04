/**
 * Middleware xử lý lỗi tập trung (Global Error Handler)
 * Mọi lỗi throw ra từ controller/service đều chạy vào đây
 */
const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Đã xảy ra lỗi từ máy chủ.';

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
