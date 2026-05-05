const UploadService = require('../services/uploadService');
const prisma = require('../config/database');

const normalizeFolderSegment = (value = 'unknown') => String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';

const buildSubmissionFolder = async (req) => {
    const taskId = parseInt(req.body.taskId, 10);
    if (!Number.isInteger(taskId) || taskId <= 0) {
        return 'submissions/unmapped';
    }

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, code: true } },
                    topic: {
                        include: {
                            semester: { select: { name: true } },
                            projectCatalog: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });

    if (!task) {
        const error = new Error('Task khong ton tai.');
        error.statusCode = 404;
        throw error;
    }

    if (req.user?.role === 'STUDENT' && task.registration?.studentId !== req.user.id) {
        const error = new Error('Ban khong co quyen upload file cho task nay.');
        error.statusCode = 403;
        throw error;
    }

    const semesterName = normalizeFolderSegment(task.registration?.topic?.semester?.name || `semester-${task.registration?.semesterId || 'na'}`);
    const projectName = normalizeFolderSegment(task.registration?.topic?.projectCatalog?.name || 'unknown-project');
    const studentCode = normalizeFolderSegment(task.registration?.student?.code || `student-${task.registration?.studentId || 'na'}`);
    const taskLabel = normalizeFolderSegment(`task-${taskId}`);

    return `submissions/${semesterName}/${projectName}/${studentCode}/${taskLabel}`;
};

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui long chon mot file de upload.',
            });
        }

        const requestedFolder = req.body.folder || 'general';
        const folder = requestedFolder === 'submissions'
            ? await buildSubmissionFolder(req)
            : requestedFolder;

        const result = await UploadService.uploadBuffer(
            req.file.buffer,
            folder,
            req.file.mimetype,
            req.file.originalname,
        );

        res.json({
            success: true,
            message: 'Tai file len thanh cong.',
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                bytes: result.bytes,
                bucket: result.bucket,
                folder,
                originalName: req.file.originalname,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadFile,
};
