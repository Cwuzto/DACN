const prismaDefault = require('../config/database');

/**
 * Phân giải scope có thẩm quyền của tài nguyên trực tiếp từ cơ sở dữ liệu.
 * Không tin cậy vào client-supplied scope hints (headers, query, body).
 *
 * @param {Object} options
 * @param {string} options.resourceType - Loại tài nguyên ('TOPIC', 'REGISTRATION', 'COUNCIL', 'DELEGATION', 'SEMESTER', 'SUBMISSION', 'BM01', 'ARCHIVE')
 * @param {number|string} options.resourceId - ID của tài nguyên
 * @param {Object} [options.db] - Prisma client instance
 * @returns {Promise<{ semesterId?: number, department?: string, ownerId?: number, mentorId?: number, councilMemberIds?: number[] } | null>}
 */
const resolveResourceScope = async ({
    resourceType,
    resourceId,
    db = prismaDefault,
} = {}) => {
    if (!resourceType || resourceId === undefined || resourceId === null) {
        return null;
    }

    const id = parseInt(resourceId, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const normalizedType = String(resourceType).trim().toUpperCase();

    switch (normalizedType) {
        case 'TOPIC': {
            if (!db.topic?.findUnique) return null;
            const topic = await db.topic.findUnique({
                where: { id },
                include: {
                    mentor: { select: { id: true, department: true } },
                    proposedBy: { select: { id: true, department: true } },
                },
            });
            if (!topic) return null;
            return {
                semesterId: topic.semesterId,
                department: topic.mentor?.department || topic.proposedBy?.department || null,
                ownerId: topic.proposedById,
                mentorId: topic.mentorId,
            };
        }

        case 'REGISTRATION':
        case 'TOPIC_REGISTRATION': {
            if (!db.topicRegistration?.findUnique) return null;
            const reg = await db.topicRegistration.findUnique({
                where: { id },
                include: {
                    topic: {
                        include: {
                            mentor: { select: { id: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                    council: { include: { members: { select: { lecturerId: true } } } },
                    outlineCouncil: { include: { members: { select: { lecturerId: true } } } },
                    defenseCouncil: { include: { members: { select: { lecturerId: true } } } },
                },
            });
            if (!reg) return null;

            const memberSet = new Set();
            (reg.council?.members || []).forEach((m) => memberSet.add(m.lecturerId));
            (reg.outlineCouncil?.members || []).forEach((m) => memberSet.add(m.lecturerId));
            (reg.defenseCouncil?.members || []).forEach((m) => memberSet.add(m.lecturerId));

            return {
                semesterId: reg.semesterId || reg.topic?.semesterId,
                department: reg.topic?.mentor?.department || reg.topic?.proposedBy?.department || null,
                ownerId: reg.studentId,
                mentorId: reg.topic?.mentorId,
                councilMemberIds: Array.from(memberSet),
            };
        }

        case 'COUNCIL': {
            if (!db.council?.findUnique) return null;
            const council = await db.council.findUnique({
                where: { id },
                include: {
                    members: {
                        include: {
                            lecturer: { select: { id: true, department: true } },
                        },
                    },
                },
            });
            if (!council) return null;

            const memberDept = council.members?.find((m) => m.lecturer?.department)?.lecturer?.department || null;
            const councilMemberIds = (council.members || []).map((m) => m.lecturerId);

            return {
                semesterId: council.semesterId,
                department: memberDept,
                councilMemberIds,
            };
        }

        case 'DELEGATION':
        case 'ACADEMIC_DELEGATION': {
            if (!db.academicDelegation?.findUnique) return null;
            const delegation = await db.academicDelegation.findUnique({
                where: { id },
            });
            if (!delegation) return null;
            return {
                semesterId: delegation.semesterId,
                department: delegation.department,
                ownerId: delegation.delegatorId,
                delegateeId: delegation.delegateeId,
            };
        }

        case 'SEMESTER': {
            if (!db.semester?.findUnique) return null;
            const semester = await db.semester.findUnique({
                where: { id },
            });
            if (!semester) return null;
            return {
                semesterId: semester.id,
            };
        }

        case 'SUBMISSION': {
            if (!db.submission?.findUnique) return null;
            const submission = await db.submission.findUnique({
                where: { id },
                include: {
                    registration: {
                        include: {
                            topic: {
                                include: {
                                    mentor: { select: { id: true, department: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (!submission) return null;
            return {
                semesterId: submission.registration?.semesterId,
                department: submission.registration?.topic?.mentor?.department || null,
                ownerId: submission.submittedBy || submission.registration?.studentId,
                mentorId: submission.registration?.topic?.mentorId,
            };
        }

        case 'BM01':
        case 'BM01_EVALUATION': {
            if (!db.bM01Evaluation?.findUnique) return null;
            const bm01 = await db.bM01Evaluation.findUnique({
                where: { id },
                include: {
                    registration: {
                        include: {
                            topic: {
                                include: {
                                    mentor: { select: { id: true, department: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (!bm01) return null;
            return {
                semesterId: bm01.registration?.semesterId,
                department: bm01.registration?.topic?.mentor?.department || null,
                ownerId: bm01.registration?.studentId,
                mentorId: bm01.registration?.topic?.mentorId,
            };
        }

        case 'ARCHIVE':
        case 'PROJECT_ARCHIVE': {
            if (!db.projectArchive?.findUnique) return null;
            let archive = await db.projectArchive.findUnique({
                where: { id },
                include: {
                    registration: {
                        include: {
                            topic: {
                                include: {
                                    mentor: { select: { id: true, department: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (!archive && db.projectArchive.findFirst) {
                archive = await db.projectArchive.findFirst({
                    where: { registrationId: id },
                    include: {
                        registration: {
                            include: {
                                topic: {
                                    include: {
                                        mentor: { select: { id: true, department: true } },
                                    },
                                },
                            },
                        },
                    },
                });
            }
            if (!archive) return null;
            return {
                semesterId: archive.registration?.semesterId,
                department: archive.registration?.topic?.mentor?.department || null,
                ownerId: archive.registration?.studentId,
                mentorId: archive.registration?.topic?.mentorId,
            };
        }

        default:
            return null;
    }
};

module.exports = {
    resolveResourceScope,
};
