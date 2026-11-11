const rubricService = require('../services/rubricService');

const getRubrics = async (req, res, next) => {
    try {
        const data = await rubricService.getRubricVersions();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getActiveRubric = async (req, res, next) => {
    try {
        const data = await rubricService.getActiveRubric();
        if (!data) {
            return res.status(404).json({ success: false, message: 'Chưa có barem điểm ACTIVE nào trên hệ thống.' });
        }
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getRubricById = async (req, res, next) => {
    try {
        const data = await rubricService.getRubricById(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiên bản Rubric.' });
        }
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createRubric = async (req, res, next) => {
    try {
        const { version, title, description, categories, cloneFromId } = req.body;
        const created = await rubricService.createRubricVersion({
            version,
            title,
            description,
            categories,
            cloneFromId,
            userId: req.user.id,
        });

        res.status(201).json({
            success: true,
            message: `Tạo phiên bản ${created.version} thành công.`,
            data: created,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateRubric = async (req, res, next) => {
    try {
        const { title, description, categories } = req.body;
        const updated = await rubricService.updateRubricVersion(req.params.id, {
            title,
            description,
            categories,
        });

        res.json({
            success: true,
            message: `Cập nhật phiên bản ${updated.version} thành công.`,
            data: updated,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const activateRubric = async (req, res, next) => {
    try {
        const activated = await rubricService.activateRubricVersion(req.params.id);
        res.json({
            success: true,
            message: `Đã kích hoạt thành công phiên bản ${activated.version} làm barem chính thức của hệ thống.`,
            data: activated,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteRubric = async (req, res, next) => {
    try {
        const result = await rubricService.deleteRubricVersion(req.params.id);
        res.json({ success: true, message: result.message });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const lockRubric = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { semesterId } = req.body;
        const locked = await rubricService.lockRubricVersion(id, {
            semesterId: semesterId ? parseInt(semesterId, 10) : undefined,
            actorId: req.user.id,
        });
        res.json({
            success: true,
            message: `Đã khóa thành công phiên bản Rubric ${locked.version}.`,
            data: locked,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

const restoreDefaultRubric = async (req, res, next) => {
    try {
        const updated = await rubricService.restoreDefaultReferenceRubric(req.params.id, req.user.id);
        res.json({
            success: true,
            message: 'Đã khôi phục barem về mẫu tham chiếu chuẩn 4 nhóm, 14 mục thành công.',
            data: updated,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const checkEditStatus = async (req, res, next) => {
    try {
        const status = await rubricService.checkCanEditRubric();
        res.json({ success: true, data: status });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getRubrics,
    getActiveRubric,
    getRubricById,
    createRubric,
    updateRubric,
    lockRubric,
    restoreDefaultRubric,
    activateRubric,
    deleteRubric,
    checkEditStatus,
};
