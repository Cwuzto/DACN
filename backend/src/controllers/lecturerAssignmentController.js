const prisma = require('../config/database');
const { validatePlannedQuotaSweep, calculateMentorPeakWorkload } = require('../utils/workloadSweep');
const { getDefaultSemester } = require('../utils/semesterResolver');

const INACTIVE_REGISTRATION_STATUSES = [
    'DROPPED',
    'WITHDRAWN',
    'REJECTED',
    'TERMINATED_BM01',
    'TERMINATED_BM02',
    'TERMINATED_FAILED_PROGRESS',
    'TERMINATED_BM04',
];

/**
 * GET /api/lecturer-assignments
 * Query lecturer assignments with workload metrics
 */
const listLecturerAssignments = async (req, res, next) => {
    try {
        const { semesterId, projectCatalogId, lecturerId, status } = req.query;

        const where = {};
        if (semesterId) where.semesterId = Number(semesterId);
        if (projectCatalogId) where.projectCatalogId = Number(projectCatalogId);
        if (lecturerId) where.lecturerId = Number(lecturerId);
        if (status) where.status = status;

        const assignments = await prisma.lecturerProjectAssignment.findMany({
            where,
            include: {
                lecturer: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        email: true,
                        department: true,
                        academicTitle: true,
                    },
                },
                semester: {
                    select: {
                        id: true,
                        name: true,
                        startDate: true,
                        endDate: true,
                        status: true,
                    },
                },
                projectCatalog: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                assignedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                    },
                },
            },
            orderBy: [{ semesterId: 'desc' }, { lecturerId: 'asc' }],
        });

        if (assignments.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const uniqueLecturerIds = Array.from(new Set(assignments.map((a) => a.lecturerId)));

        const registrations = await prisma.topicRegistration.findMany({
            where: {
                topic: { mentorId: { in: uniqueLecturerIds } },
                status: { notIn: INACTIVE_REGISTRATION_STATUSES },
            },
            include: {
                topic: {
                    select: {
                        id: true,
                        mentorId: true,
                        projectCatalogId: true,
                        semester: {
                            select: { id: true, name: true, startDate: true, endDate: true },
                        },
                    },
                },
            },
        });

        // Group registrations by mentorId
        const regsByMentor = new Map();
        for (const reg of registrations) {
            const mId = reg.topic?.mentorId;
            if (!mId) continue;
            if (!regsByMentor.has(mId)) {
                regsByMentor.set(mId, []);
            }
            regsByMentor.get(mId).push(reg);
        }

        // Compute metrics per assignment
        const now = new Date();
        const data = assignments.map((assignment) => {
            const lecturerRegs = regsByMentor.get(assignment.lecturerId) || [];

            // Active registrations in this specific semester
            const currentRoundLoad = lecturerRegs.filter(
                (r) => r.semesterId === assignment.semesterId && (r.assignmentStatus || 'ACTIVE') === 'ACTIVE'
            ).length;

            const workload = calculateMentorPeakWorkload({
                existingRegistrations: lecturerRegs,
                now,
            });

            return {
                ...assignment,
                currentRoundLoad,
                activeTodayLoad: workload.currentLoad,
                peakConcurrentLoad: workload.peakLoad,
                peakInterval: workload.peakInterval,
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/lecturer-assignments
 * Create or upsert lecturer assignment with sweep validation
 */
const createLecturerAssignment = async (req, res, next) => {
    try {
        const { lecturerId, semesterId, projectCatalogId, plannedQuota, status } = req.body;

        const targetSemester = await prisma.semester.findUnique({
            where: { id: Number(semesterId) },
        });
        if (!targetSemester) {
            return res.status(404).json({ success: false, message: 'Đợt đồ án không tồn tại.' });
        }

        const lecturer = await prisma.user.findUnique({
            where: { id: Number(lecturerId) },
        });
        if (!lecturer) {
            return res.status(404).json({ success: false, message: 'Giảng viên không tồn tại.' });
        }

        const existingAssignments = await prisma.lecturerProjectAssignment.findMany({
            where: { lecturerId: Number(lecturerId) },
            include: {
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
            },
        });

        const existingSame = existingAssignments.find(
            (a) => a.semesterId === Number(semesterId) && a.projectCatalogId === Number(projectCatalogId)
        );

        const proposedQuota = plannedQuota !== undefined ? Number(plannedQuota) : 10;
        const proposedStatus = status || 'ACTIVE';

        const validation = validatePlannedQuotaSweep({
            existingAssignments,
            newAssignment: {
                id: existingSame?.id,
                plannedQuota: proposedQuota,
                status: proposedStatus,
                semester: targetSemester,
            },
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.message,
                data: {
                    peakQuota: validation.peakQuota,
                    conflictingRounds: validation.conflictingRounds,
                    peakInterval: validation.peakInterval,
                },
            });
        }

        const assignment = await prisma.lecturerProjectAssignment.upsert({
            where: {
                lecturerId_semesterId_projectCatalogId: {
                    lecturerId: Number(lecturerId),
                    semesterId: Number(semesterId),
                    projectCatalogId: Number(projectCatalogId),
                },
            },
            create: {
                lecturerId: Number(lecturerId),
                semesterId: Number(semesterId),
                projectCatalogId: Number(projectCatalogId),
                plannedQuota: proposedQuota,
                status: proposedStatus,
                assignedById: req.user.id,
            },
            update: {
                plannedQuota: proposedQuota,
                status: proposedStatus,
                assignedById: req.user.id,
            },
            include: {
                lecturer: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        email: true,
                        department: true,
                        academicTitle: true,
                    },
                },
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
                projectCatalog: {
                    select: { id: true, name: true, code: true },
                },
            },
        });

        return res.status(201).json({ success: true, data: assignment });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/lecturer-assignments/:id
 * Update lecturer assignment plannedQuota or status
 */
const updateLecturerAssignment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { plannedQuota, status } = req.body;

        const assignment = await prisma.lecturerProjectAssignment.findUnique({
            where: { id },
            include: {
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
            },
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Phân công không tồn tại.' });
        }

        const newQuota = plannedQuota !== undefined ? Number(plannedQuota) : assignment.plannedQuota;
        const newStatus = status !== undefined ? status : assignment.status;

        // If plannedQuota or status changes, re-validate sweep
        if (plannedQuota !== undefined || status !== undefined) {
            const existingAssignments = await prisma.lecturerProjectAssignment.findMany({
                where: { lecturerId: assignment.lecturerId },
                include: {
                    semester: {
                        select: { id: true, name: true, startDate: true, endDate: true },
                    },
                },
            });

            const validation = validatePlannedQuotaSweep({
                existingAssignments,
                newAssignment: {
                    id: assignment.id,
                    plannedQuota: newQuota,
                    status: newStatus,
                    semester: assignment.semester,
                },
            });

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                    data: {
                        peakQuota: validation.peakQuota,
                        conflictingRounds: validation.conflictingRounds,
                        peakInterval: validation.peakInterval,
                    },
                });
            }
        }

        const updated = await prisma.lecturerProjectAssignment.update({
            where: { id },
            data: {
                ...(plannedQuota !== undefined && { plannedQuota: newQuota }),
                ...(status !== undefined && { status: newStatus }),
                assignedById: req.user.id,
            },
            include: {
                lecturer: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        email: true,
                        department: true,
                        academicTitle: true,
                    },
                },
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
                projectCatalog: {
                    select: { id: true, name: true, code: true },
                },
            },
        });

        return res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/lecturer-assignments/:id
 * Delete or close lecturer assignment
 */
const deleteLecturerAssignment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        const assignment = await prisma.lecturerProjectAssignment.findUnique({
            where: { id },
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Phân công không tồn tại.' });
        }

        const activeRegistrationsCount = await prisma.topicRegistration.count({
            where: {
                semesterId: assignment.semesterId,
                topic: { mentorId: assignment.lecturerId },
                status: { notIn: INACTIVE_REGISTRATION_STATUSES },
                assignmentStatus: 'ACTIVE',
            },
        });

        if (activeRegistrationsCount > 0) {
            if (req.query.closeIfActive === 'true' || req.query.close === 'true') {
                const updated = await prisma.lecturerProjectAssignment.update({
                    where: { id },
                    data: { status: 'CLOSED' },
                });
                return res.json({
                    success: true,
                    message: 'Đã đóng phân công do có sinh viên đang thực hiện.',
                    data: updated,
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Không thể xoá phân công vì giảng viên đã có sinh viên đăng ký trong đợt này.',
            });
        }

        await prisma.lecturerProjectAssignment.delete({
            where: { id },
        });

        return res.json({ success: true, message: 'Đã xoá phân công giảng viên.' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/lecturer-assignments/bulk-upsert
 * Batch upsert lecturer assignments
 */
const bulkUpsertLecturerAssignments = async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items phải là mảng không rỗng.' });
        }

        const normalized = items.map((item) => ({
            lecturerId: Number(item.lecturerId),
            semesterId: Number(item.semesterId),
            projectCatalogId: Number(item.projectCatalogId),
            plannedQuota: item.plannedQuota !== undefined ? Number(item.plannedQuota) : 10,
            status: item.status === 'CLOSED' || item.status === 'DRAFT' ? item.status : 'ACTIVE',
        }));

        if (normalized.some((row) => !row.lecturerId || !row.semesterId || !row.projectCatalogId)) {
            return res.status(400).json({
                success: false,
                message: 'Mỗi item phải có lecturerId, semesterId, projectCatalogId hợp lệ.',
            });
        }

        // Validate sweep capacity for each item
        for (const row of normalized) {
            const targetSemester = await prisma.semester.findUnique({
                where: { id: row.semesterId },
            });
            if (!targetSemester) {
                return res.status(400).json({
                    success: false,
                    message: `Đợt đồ án ${row.semesterId} không tồn tại.`,
                });
            }

            const existingAssignments = await prisma.lecturerProjectAssignment.findMany({
                where: { lecturerId: row.lecturerId },
                include: {
                    semester: {
                        select: { id: true, name: true, startDate: true, endDate: true },
                    },
                },
            });

            const existingSame = existingAssignments.find(
                (a) => a.semesterId === row.semesterId && a.projectCatalogId === row.projectCatalogId
            );

            const validation = validatePlannedQuotaSweep({
                existingAssignments,
                newAssignment: {
                    id: existingSame?.id,
                    plannedQuota: row.plannedQuota,
                    status: row.status,
                    semester: targetSemester,
                },
            });

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: `Giảng viên ID ${row.lecturerId}: ${validation.message}`,
                    data: {
                        lecturerId: row.lecturerId,
                        peakQuota: validation.peakQuota,
                        conflictingRounds: validation.conflictingRounds,
                    },
                });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            let created = 0;
            let updated = 0;

            for (const row of normalized) {
                const existing = await tx.lecturerProjectAssignment.findUnique({
                    where: {
                        lecturerId_semesterId_projectCatalogId: {
                            lecturerId: row.lecturerId,
                            semesterId: row.semesterId,
                            projectCatalogId: row.projectCatalogId,
                        },
                    },
                    select: { id: true },
                });

                if (existing) {
                    await tx.lecturerProjectAssignment.update({
                        where: { id: existing.id },
                        data: {
                            plannedQuota: row.plannedQuota,
                            status: row.status,
                            assignedById: req.user.id,
                        },
                    });
                    updated++;
                } else {
                    await tx.lecturerProjectAssignment.create({
                        data: {
                            lecturerId: row.lecturerId,
                            semesterId: row.semesterId,
                            projectCatalogId: row.projectCatalogId,
                            plannedQuota: row.plannedQuota,
                            status: row.status,
                            assignedById: req.user.id,
                        },
                    });
                    created++;
                }
            }

            return { created, updated };
        });

        return res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/lecturer-assignments/overview
 * Get coordination overview metrics for a round
 */
const getRoundCoordinationOverview = async (req, res, next) => {
    try {
        const { semesterId, projectCatalogId } = req.query;

        let targetSemester = null;
        if (semesterId) {
            targetSemester = await prisma.semester.findUnique({
                where: { id: Number(semesterId) },
            });
        } else {
            targetSemester = await getDefaultSemester({
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
            });
        }

        if (!targetSemester) {
            return res.json({
                success: true,
                data: null,
                message: 'Chưa có học kỳ để thống kê.',
            });
        }

        const semId = targetSemester.id;
        const catId = projectCatalogId ? Number(projectCatalogId) : undefined;

        // 1. Total enrolled students
        const totalEnrolledStudents = await prisma.studentProjectEnrollment.count({
            where: {
                semesterId: semId,
                status: 'ACTIVE',
                ...(catId && { projectCatalogId: catId }),
            },
        });

        // 2. Total assigned students in this round
        const totalAssignedStudents = await prisma.topicRegistration.count({
            where: {
                semesterId: semId,
                status: { notIn: INACTIVE_REGISTRATION_STATUSES },
                assignmentStatus: 'ACTIVE',
                ...(catId && { topic: { projectCatalogId: catId } }),
            },
        });

        // 3. Lecturer assignments for this round
        const assignments = await prisma.lecturerProjectAssignment.findMany({
            where: {
                semesterId: semId,
                status: { not: 'CLOSED' },
                ...(catId && { projectCatalogId: catId }),
            },
            include: {
                lecturer: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        email: true,
                        department: true,
                        academicTitle: true,
                    },
                },
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
            },
        });

        const uniqueLecturersMap = new Map();
        for (const a of assignments) {
            if (!uniqueLecturersMap.has(a.lecturerId) && a.lecturer) {
                uniqueLecturersMap.set(a.lecturerId, a.lecturer);
            }
        }
        const totalAssignedLecturers = uniqueLecturersMap.size;

        const totalPlannedSlots = assignments.reduce((sum, a) => sum + (Number(a.plannedQuota) || 0), 0);

        const capacityUtilization =
            totalPlannedSlots > 0 ? Number(((totalAssignedStudents / totalPlannedSlots) * 100).toFixed(1)) : 0;

        const unassignedStudents = Math.max(0, totalEnrolledStudents - totalAssignedStudents);

        // 4. Calculate overload warning alerts for all assigned lecturers
        const now = new Date();
        const overloadAlerts = [];

        for (const [lecturerId, lecturer] of uniqueLecturersMap.entries()) {
            const lecturerRegs = await prisma.topicRegistration.findMany({
                where: {
                    topic: { mentorId: lecturerId },
                    status: { notIn: INACTIVE_REGISTRATION_STATUSES },
                },
                include: {
                    topic: {
                        select: {
                            id: true,
                            mentorId: true,
                            semester: {
                                select: { id: true, name: true, startDate: true, endDate: true },
                            },
                        },
                    },
                },
            });

            const workload = calculateMentorPeakWorkload({
                existingRegistrations: lecturerRegs,
                now,
            });

            if (workload.peakLoad >= 8) {
                const currentRoundLoad = lecturerRegs.filter(
                    (r) => r.semesterId === semId && (r.assignmentStatus || 'ACTIVE') === 'ACTIVE'
                ).length;

                overloadAlerts.push({
                    lecturerId,
                    lecturerName: lecturer.fullName,
                    lecturerCode: lecturer.code,
                    department: lecturer.department,
                    currentRoundLoad,
                    activeTodayLoad: workload.currentLoad,
                    peakConcurrentLoad: workload.peakLoad,
                    peakInterval: workload.peakInterval,
                    severity: workload.peakLoad >= 10 ? 'CRITICAL' : 'WARNING',
                });
            }
        }

        // Sort alerts: CRITICAL first, then peakConcurrentLoad desc
        overloadAlerts.sort((a, b) => {
            if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
            if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
            return b.peakConcurrentLoad - a.peakConcurrentLoad;
        });

        return res.json({
            success: true,
            data: {
                semester: targetSemester,
                totalEnrolledStudents,
                totalAssignedStudents,
                unassignedStudents,
                totalAssignedLecturers,
                totalPlannedSlots,
                capacityUtilization,
                overloadAlerts,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/lecturer-assignments/available-lecturers
 * Query lecturers who are available to be assigned to the given semester & projectCatalog.
 * A lecturer is available if:
 * 1. They are active lecturers.
 * 2. They do NOT already have an active assignment in this semester (and projectCatalogId if specified).
 * 3. Their current peak load across overlapping rounds allows taking at least 1 student (sweep validation valid for quota = 1).
 */
const getAvailableLecturers = async (req, res, next) => {
    try {
        const semesterId = Number(req.query.semesterId);
        const projectCatalogId = req.query.projectCatalogId ? Number(req.query.projectCatalogId) : undefined;

        if (!semesterId) {
            return res.status(400).json({ success: false, message: 'semesterId là bắt buộc.' });
        }

        const targetSemester = await prisma.semester.findUnique({
            where: { id: semesterId },
        });

        if (!targetSemester) {
            return res.status(404).json({ success: false, message: 'Đợt đồ án không tồn tại.' });
        }

        // 1. All active lecturers
        const allLecturers = await prisma.user.findMany({
            where: {
                role: 'LECTURER',
                isActive: true,
            },
            select: {
                id: true,
                fullName: true,
                code: true,
                email: true,
                department: true,
                academicTitle: true,
            },
            orderBy: [{ fullName: 'asc' }],
        });

        if (allLecturers.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. Already assigned in this round (for the target catalog if provided, or all in semester if not)
        const roundAssignments = await prisma.lecturerProjectAssignment.findMany({
            where: {
                semesterId,
                status: { not: 'CLOSED' },
                ...(projectCatalogId ? { projectCatalogId } : {}),
            },
            select: {
                lecturerId: true,
                projectCatalogId: true,
            },
        });

        const assignedLecturerIds = new Set(roundAssignments.map((a) => a.lecturerId));

        // Filter out lecturers already assigned in this round (with this catalog)
        const unassignedLecturers = allLecturers.filter((l) => !assignedLecturerIds.has(l.id));

        if (unassignedLecturers.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const candidateIds = unassignedLecturers.map((l) => l.id);

        // 3. Fetch all other active assignments for candidate lecturers to compute sweep workload
        const otherAssignments = await prisma.lecturerProjectAssignment.findMany({
            where: {
                lecturerId: { in: candidateIds },
                status: { not: 'CLOSED' },
            },
            include: {
                semester: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
            },
        });

        const assignmentsByLecturer = new Map();
        for (const a of otherAssignments) {
            if (!assignmentsByLecturer.has(a.lecturerId)) {
                assignmentsByLecturer.set(a.lecturerId, []);
            }
            assignmentsByLecturer.get(a.lecturerId).push(a);
        }

        // 4. Validate capacity sweep for each candidate lecturer
        const availableLecturers = [];

        for (const lecturer of unassignedLecturers) {
            const existingAssignments = assignmentsByLecturer.get(lecturer.id) || [];

            // Sweep test for plannedQuota: 1 (minimum to be available)
            const minTest = validatePlannedQuotaSweep({
                existingAssignments,
                newAssignment: {
                    plannedQuota: 1,
                    status: 'ACTIVE',
                    semester: targetSemester,
                },
            });

            if (minTest.valid) {
                // Calculate max available quota they can take (up to 10)
                const fullTest = validatePlannedQuotaSweep({
                    existingAssignments,
                    newAssignment: {
                        plannedQuota: 10,
                        status: 'ACTIVE',
                        semester: targetSemester,
                    },
                });

                let availableQuota = 10;
                if (!fullTest.valid) {
                    availableQuota = Math.max(1, 10 - (fullTest.peakQuota - 10));
                }

                availableLecturers.push({
                    ...lecturer,
                    availableQuota,
                });
            }
        }

        return res.json({ success: true, data: availableLecturers });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listLecturerAssignments,
    createLecturerAssignment,
    updateLecturerAssignment,
    deleteLecturerAssignment,
    bulkUpsertLecturerAssignments,
    getRoundCoordinationOverview,
    getAvailableLecturers,
};
