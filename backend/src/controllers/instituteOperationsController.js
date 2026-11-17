const {
    getInstituteOperations,
    InstituteOperationsError,
} = require('../services/instituteOperationsService');

const getOperations = async (req, res, next) => {
    try {
        const {
            tab = 'review',
            semesterId,
            status,
            page,
            pageSize,
        } = req.query;

        const data = await getInstituteOperations({
            actor: req.user,
            tab,
            semesterId,
            status,
            page,
            pageSize,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        if (error instanceof InstituteOperationsError) {
            return res.status(error.statusCode).json({
                success: false,
                code: error.code,
                message: error.message,
            });
        }
        return next(error);
    }
};

module.exports = {
    getOperations,
};
