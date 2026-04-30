require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { startScheduledJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================
// MIDDLEWARE CƠ BẢN
// ============================

// Cho phép Frontend gọi API (Cross-Origin)
app.use(cors({
    origin: (origin, callback) => {
        if (process.env.NODE_ENV === 'production') {
            const allowedOrigin = 'https://your-frontend-domain.com';
            if (!origin || origin === allowedOrigin) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        }

        // Dev: cho phep localhost/127.0.0.1 o moi cong de tranh loi khi Vite doi port.
        if (!origin) return callback(null, true);
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        return callback(isLocalhost ? null : new Error('Not allowed by CORS'), isLocalhost);
    },
    credentials: true,
}));

// Parse JSON body
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded body (cho form submit)
app.use(express.urlencoded({ extended: true }));

// ============================
// ROUTES
// ============================

// Tất cả API bắt đầu bằng /api
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🎓 Hệ thống Quản lý Đồ án - Viện Công nghệ Số',
        version: '1.0.0',
        docs: '/api/health',
    });
});

// ============================
// ERROR HANDLER (phải đặt SAU tất cả routes)
// ============================
app.use(errorHandler);

// ============================
// KHỞI ĐỘNG SERVER
// ============================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
        console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
    startScheduledJobs();
}

module.exports = app;
