const prisma = require('../config/database');
const { MAX_STUDENTS_PER_OUTLINE_COUNCIL } = require('../constants/councilLimits');

const OUTLINE_COUNCIL_NAME_PREFIX = 'Hội đồng Xét duyệt Đề cương';
const OUTLINE_COUNCIL_REGEX = /^Hội đồng Xét duyệt Đề cương\s+(\d+)$/i;
const OUTLINE_ROLE_ORDER = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
const CHUNK_SIZE = MAX_STUDENTS_PER_OUTLINE_COUNCIL || 10;

/**
 * Calculates the next sequential council index based on existing outline councils.
 *
 * @param {Array<{ name: string }>} councils
 * @returns {number}
 */
const getNextOutlineCouncilIndex = (councils = []) => {
    const maxIndex = councils.reduce((max, council) => {
        const match = `${council.name || ''}`.trim().match(OUTLINE_COUNCIL_REGEX);
        if (!match) return max;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isInteger(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxIndex + 1;
};

/**
 * Generates a preview for outline council setup without persisting any changes to the database.
 *
 * @param {number} semesterId
 * @param {object} [db] Optional prisma client
 * @returns {Promise<{
 *   proposedCouncils: Array<{
 *     tempId: string,
 *     name: string,
 *     members: Array<{ lecturerId: number, lecturerName: string, roleInCouncil: string }>,
 *     excludedMentors: Array<{ id: number, fullName: string }>,
 *     registrations: Array<{
 *       id: number,
 *       studentId: number,
 *       studentCode: string|null,
 *       studentName: string|null,
 *       topicTitle: string|null,
 *       mentorId: number|null,
 *       mentorName: string|null,
 *     }>
 *   }>,
 *   skippedStudents: Array<{ id: number, studentId: number, reason: string }>,
 *   warnings: string[],
 * }>}
 */
const previewAutoOutlineCouncilSetup = async (semesterId, db = prisma) => {
    const parsedSemesterId = Number(semesterId);
    if (!Number.isInteger(parsedSemesterId) || parsedSemesterId <= 0) {
        throw new Error('Mã học kỳ không hợp lệ.');
    }

    // Step 0: Verify semester existence
    const semester = await db.semester.findUnique({
        where: { id: parsedSemesterId },
    });

    if (!semester) {
        return {
            proposedCouncils: [],
            skippedStudents: [],
            warnings: ['Học kỳ không tồn tại.'],
        };
    }

    // Step 1: Filter eligible unassigned registrations
    const unassigned = await db.topicRegistration.findMany({
        where: {
            semesterId: parsedSemesterId,
            status: 'BM01_SUBMITTED',
            outlineCouncilId: null,
        },
        include: {
            student: { select: { id: true, fullName: true, code: true } },
            topic: {
                select: {
                    id: true,
                    title: true,
                    mentorId: true,
                    mentor: { select: { id: true, fullName: true } },
                },
            },
        },
    });

    const skippedStudents = [];
    const eligibleRegistrations = [];

    if (unassigned && unassigned.length > 0) {
        for (const reg of unassigned) {
            const mentorId = reg.topic?.mentorId;
            if (mentorId === null || mentorId === undefined) {
                skippedStudents.push({
                    id: reg.id,
                    studentId: reg.studentId,
                    reason: 'NO_MENTOR',
                });
            } else {
                eligibleRegistrations.push(reg);
            }
        }
    }

    if (eligibleRegistrations.length === 0) {
        return {
            proposedCouncils: [],
            skippedStudents,
            warnings: [],
        };
    }

    // Sort ascending by mentorId, then by registration id
    const sortedRegistrations = [...eligibleRegistrations].sort((a, b) => {
        const mentorA = a.topic.mentorId;
        const mentorB = b.topic.mentorId;
        if (mentorA !== mentorB) return mentorA - mentorB;
        return a.id - b.id;
    });

    // Step 2: Fetch existing councils to determine nextIndex and baseline lecturer loads
    const existingCouncils = await db.council.findMany({
        where: { semesterId: parsedSemesterId },
        include: {
            members: { select: { lecturerId: true } },
        },
    });

    const existingOutlineCouncils = existingCouncils.filter(
        (c) => c.councilType === 'OUTLINE_REVIEW'
    );

    let nextIndex = getNextOutlineCouncilIndex(existingOutlineCouncils);

    // Fetch active lecturers
    const lecturers = await db.user.findMany({
        where: { role: 'LECTURER', isActive: true },
        select: { id: true, fullName: true },
    });

    // Calculate initial lecturer workloads across all councils in this semester
    const lecturerLoads = new Map();
    lecturers.forEach((l) => lecturerLoads.set(l.id, 0));
    existingCouncils.forEach((council) => {
        (council.members || []).forEach((member) => {
            lecturerLoads.set(
                member.lecturerId,
                (lecturerLoads.get(member.lecturerId) || 0) + 1
            );
        });
    });

    // Chunking by <= 10 students
    const chunks = [];
    for (let i = 0; i < sortedRegistrations.length; i += CHUNK_SIZE) {
        chunks.push(sortedRegistrations.slice(i, i + CHUNK_SIZE));
    }

    const proposedCouncils = [];
    const warnings = [];

    chunks.forEach((chunk, chunkIndex) => {
        const councilName = `${OUTLINE_COUNCIL_NAME_PREFIX} ${nextIndex}`;
        nextIndex += 1;

        // Determine excluded mentors for chunk
        const mentorMap = new Map();
        chunk.forEach((s) => {
            if (s.topic?.mentorId) {
                mentorMap.set(
                    s.topic.mentorId,
                    s.topic.mentor?.fullName || `GV #${s.topic.mentorId}`
                );
            }
        });

        const excludedMentors = Array.from(mentorMap.entries()).map(([id, fullName]) => ({
            id,
            fullName,
        }));
        const excludedMentorIds = new Set(mentorMap.keys());

        // Select 3 candidate lecturers with lowest load who are not in excludedMentors
        const candidates = lecturers
            .filter((l) => !excludedMentorIds.has(l.id))
            .sort((a, b) => {
                const loadDiff = (lecturerLoads.get(a.id) || 0) - (lecturerLoads.get(b.id) || 0);
                if (loadDiff !== 0) return loadDiff;
                return a.id - b.id;
            });

        let proposedMembers = [];
        if (candidates.length < 3) {
            warnings.push(`Council "${councilName}" does not have enough eligible non-conflict lecturers.`);
        } else {
            const selected = candidates.slice(0, 3);
            proposedMembers = selected.map((lecturer, idx) => ({
                lecturerId: lecturer.id,
                lecturerName: lecturer.fullName,
                roleInCouncil: OUTLINE_ROLE_ORDER[idx],
            }));

            selected.forEach((lecturer) => {
                lecturerLoads.set(lecturer.id, (lecturerLoads.get(lecturer.id) || 0) + 1);
            });
        }

        const chunkRegistrations = chunk.map((r) => ({
            id: r.id,
            studentId: r.studentId,
            studentCode: r.student?.code || null,
            studentName: r.student?.fullName || null,
            topicTitle: r.topic?.title || null,
            mentorId: r.topic?.mentorId || null,
            mentorName: r.topic?.mentor?.fullName || null,
        }));

        proposedCouncils.push({
            tempId: `temp-${chunkIndex + 1}`,
            name: councilName,
            members: proposedMembers,
            excludedMentors,
            registrations: chunkRegistrations,
        });
    });

    return {
        proposedCouncils,
        skippedStudents,
        warnings,
    };
};

/**
 * Automatically creates and assigns outline review councils for eligible students
 * in a semester using mentor-clustered partitioning and balanced lecturer workloads.
 * Supports passing options.proposedCouncils to persist a user-reviewed or custom plan.
 *
 * @param {number} semesterId
 * @param {object} [options]
 * @param {Array<object>} [options.proposedCouncils] Custom or previewed proposed councils to persist
 * @param {Array<object>} [options.skippedStudents]
 * @param {number} [options.actorId]
 * @param {number} [options.userId]
 * @param {string} [options.ipAddress]
 * @param {object} [db] Optional prisma client or transaction handle
 * @returns {Promise<{ createdCouncils: number, assignedStudents: number, skippedStudents: any[], warnings: string[] }>}
 */
const runAutoOutlineCouncilSetupForSemester = async (semesterId, options = {}, db = prisma) => {
    const parsedSemesterId = Number(semesterId);
    if (!Number.isInteger(parsedSemesterId) || parsedSemesterId <= 0) {
        throw new Error('Mã học kỳ không hợp lệ.');
    }

    return db.$transaction(async (tx) => {
        // Step 0: Verify semester existence
        const semester = await tx.semester.findUnique({
            where: { id: parsedSemesterId },
        });

        if (!semester) {
            return {
                createdCouncils: 0,
                assignedStudents: 0,
                skippedStudents: [],
                warnings: ['Học kỳ không tồn tại.'],
            };
        }

        let createdCouncils = 0;
        let assignedStudents = 0;
        let skippedStudents = [];
        const warnings = [];

        // Check if options.proposedCouncils is provided
        if (Array.isArray(options.proposedCouncils)) {
            if (options.proposedCouncils.length === 0) {
                return {
                    createdCouncils: 0,
                    assignedStudents: 0,
                    skippedStudents: [],
                    warnings: [],
                };
            }

            const existingCouncils = await tx.council.findMany({
                where: { semesterId: parsedSemesterId },
            });
            const existingOutlineCouncils = existingCouncils.filter(
                (c) => c.councilType === 'OUTLINE_REVIEW'
            );
            let nextIndex = getNextOutlineCouncilIndex(existingOutlineCouncils);

            for (const item of options.proposedCouncils) {
                // Validate that members has exactly 3 elements with distinct lecturerIds and roles matching ['CHAIRMAN', 'SECRETARY', 'REVIEWER']
                if (!Array.isArray(item.members) || item.members.length !== 3) {
                    const error = new Error('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
                    error.statusCode = 400;
                    throw error;
                }

                const lecturerIds = item.members.map((m) => Number(m.lecturerId));
                const uniqueLecturers = new Set(lecturerIds);
                if (uniqueLecturers.size !== 3 || lecturerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
                    const error = new Error('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
                    error.statusCode = 400;
                    throw error;
                }

                const roles = new Set(item.members.map((m) => m.roleInCouncil));
                const expectedRoles = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
                const hasAllRoles = expectedRoles.every((role) => roles.has(role));
                if (!hasAllRoles || roles.size !== 3) {
                    const error = new Error('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
                    error.statusCode = 400;
                    throw error;
                }

                // Create Council record
                const councilName = item.name || `${OUTLINE_COUNCIL_NAME_PREFIX} ${nextIndex++}`;
                const council = await tx.council.create({
                    data: {
                        semesterId: parsedSemesterId,
                        name: councilName,
                        councilType: 'OUTLINE_REVIEW',
                        defenseDate: item.defenseDate ? new Date(item.defenseDate) : (semester.defenseDate || null),
                        location: item.location || null,
                        meetingMode: item.meetingMode || 'IN_PERSON',
                    },
                });
                createdCouncils += 1;

                // Determine registration IDs to assign
                const rawRegIds = Array.isArray(item.registrationIds)
                    ? item.registrationIds
                    : (Array.isArray(item.registrations)
                        ? item.registrations.map((r) => (typeof r === 'object' && r !== null ? r.id : r)).filter((id) => id !== undefined && id !== null)
                        : []);

                const regIds = rawRegIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);

                if (regIds.length > 0) {
                    await tx.topicRegistration.updateMany({
                        where: { id: { in: regIds } },
                        data: { outlineCouncilId: council.id },
                    });
                    assignedStudents += regIds.length;
                }

                // Create members
                await tx.councilMember.createMany({
                    data: item.members.map((m) => ({
                        councilId: council.id,
                        lecturerId: Number(m.lecturerId),
                        roleInCouncil: m.roleInCouncil,
                    })),
                });
            }

            skippedStudents = Array.isArray(options.skippedStudents) ? options.skippedStudents : [];
        } else {
            // Step 1: Filter eligible unassigned registrations
            const unassigned = await tx.topicRegistration.findMany({
                where: {
                    semesterId: parsedSemesterId,
                    status: 'BM01_SUBMITTED',
                    outlineCouncilId: null,
                },
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        select: {
                            id: true,
                            title: true,
                            mentorId: true,
                            mentor: { select: { id: true, fullName: true } },
                        },
                    },
                },
            });

            if (!unassigned || unassigned.length === 0) {
                return {
                    createdCouncils: 0,
                    assignedStudents: 0,
                    skippedStudents: [],
                    warnings: [],
                };
            }

            // Step 2: Mentor clustering
            const eligibleRegistrations = [];

            for (const reg of unassigned) {
                const mentorId = reg.topic?.mentorId;
                if (mentorId === null || mentorId === undefined) {
                    skippedStudents.push({
                        id: reg.id,
                        studentId: reg.studentId,
                        reason: 'NO_MENTOR',
                    });
                } else {
                    eligibleRegistrations.push(reg);
                }
            }

            if (eligibleRegistrations.length === 0) {
                return {
                    createdCouncils: 0,
                    assignedStudents: 0,
                    skippedStudents,
                    warnings: [],
                };
            }

            // Sort ascending by mentorId, then by registration id
            const sortedRegistrations = [...eligibleRegistrations].sort((a, b) => {
                const mentorA = a.topic.mentorId;
                const mentorB = b.topic.mentorId;
                if (mentorA !== mentorB) return mentorA - mentorB;
                return a.id - b.id;
            });

            // Step 3: Fetch existing councils to determine nextIndex and baseline lecturer loads
            const existingCouncils = await tx.council.findMany({
                where: { semesterId: parsedSemesterId },
                include: {
                    members: { select: { lecturerId: true } },
                },
            });

            const existingOutlineCouncils = existingCouncils.filter(
                (c) => c.councilType === 'OUTLINE_REVIEW'
            );

            let nextIndex = getNextOutlineCouncilIndex(existingOutlineCouncils);

            // Fetch active lecturers
            const lecturers = await tx.user.findMany({
                where: { role: 'LECTURER', isActive: true },
                select: { id: true, fullName: true },
            });

            // Calculate initial lecturer workloads across all councils in this semester
            const lecturerLoads = new Map();
            lecturers.forEach((l) => lecturerLoads.set(l.id, 0));
            existingCouncils.forEach((council) => {
                (council.members || []).forEach((member) => {
                    lecturerLoads.set(
                        member.lecturerId,
                        (lecturerLoads.get(member.lecturerId) || 0) + 1
                    );
                });
            });

            // Chunking by <= 10 students
            const chunks = [];
            for (let i = 0; i < sortedRegistrations.length; i += CHUNK_SIZE) {
                chunks.push(sortedRegistrations.slice(i, i + CHUNK_SIZE));
            }

            for (const chunk of chunks) {
                // Create Council record
                const council = await tx.council.create({
                    data: {
                        semesterId: parsedSemesterId,
                        name: `${OUTLINE_COUNCIL_NAME_PREFIX} ${nextIndex}`,
                        councilType: 'OUTLINE_REVIEW',
                        defenseDate: semester.defenseDate || null,
                        location: null,
                        meetingMode: 'IN_PERSON',
                    },
                });
                nextIndex += 1;
                createdCouncils += 1;

                // Assign outlineCouncilId for all students in chunk
                const chunkRegistrationIds = chunk.map((r) => r.id);
                await tx.topicRegistration.updateMany({
                    where: { id: { in: chunkRegistrationIds } },
                    data: { outlineCouncilId: council.id },
                });
                assignedStudents += chunkRegistrationIds.length;

                // Step 4: Conflict-free member assignment
                const excludedMentorIds = new Set(
                    chunk
                        .map((s) => s.topic?.mentorId)
                        .filter((id) => id !== null && id !== undefined)
                );

                const candidates = lecturers
                    .filter((l) => !excludedMentorIds.has(l.id))
                    .sort((a, b) => {
                        const loadDiff = (lecturerLoads.get(a.id) || 0) - (lecturerLoads.get(b.id) || 0);
                        if (loadDiff !== 0) return loadDiff;
                        return a.id - b.id;
                    });

                if (candidates.length < 3) {
                    warnings.push(`Council ${council.id} does not have enough eligible non-conflict lecturers.`);
                    continue;
                }

                const selected = candidates.slice(0, 3);

                await tx.councilMember.deleteMany({ where: { councilId: council.id } });
                await tx.councilMember.createMany({
                    data: selected.map((lecturer, index) => ({
                        councilId: council.id,
                        lecturerId: lecturer.id,
                        roleInCouncil: OUTLINE_ROLE_ORDER[index],
                    })),
                });

                selected.forEach((lecturer) => {
                    lecturerLoads.set(lecturer.id, (lecturerLoads.get(lecturer.id) || 0) + 1);
                });
            }
        }

        // Step 5: Audit Log & Return
        const actorId = options?.actorId || options?.userId;
        if (actorId) {
            try {
                await tx.auditLog.create({
                    data: {
                        userId: actorId,
                        action: 'AUTO_ASSIGN_OUTLINE_COUNCILS',
                        entityType: 'Council',
                        entityId: String(parsedSemesterId),
                        details: {
                            createdCouncils,
                            assignedStudents,
                            skippedCount: skippedStudents.length,
                            warningCount: warnings.length,
                        },
                        ipAddress: options?.ipAddress || null,
                    },
                });
            } catch (auditErr) {
                console.error('[outlineAutoSetup] Audit log creation failed:', auditErr?.message || auditErr);
            }
        }

        return {
            createdCouncils,
            assignedStudents,
            skippedStudents,
            warnings,
        };
    });
};

module.exports = {
    runAutoOutlineCouncilSetupForSemester,
    previewAutoOutlineCouncilSetup,
    getNextOutlineCouncilIndex,
    OUTLINE_COUNCIL_NAME_PREFIX,
    OUTLINE_ROLE_ORDER,
};
