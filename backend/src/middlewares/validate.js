const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    return res.status(400).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ.',
        errors: errors.array().map((error) => ({
            field: error.path,
            message: error.msg,
            value: error.value,
        })),
    });
};

module.exports = { validateRequest };

