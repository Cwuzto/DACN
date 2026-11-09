const prisma = require('../config/database');
const { MAX_STUDENTS_PER_OUTLINE_COUNCIL } = require('../constants/councilLimits');

const OUTLINE_COUNCIL_NAME_PREFIX = 'Hội đồng Xét duyệt Đề cương';
const OUTLINE_COUNCIL_REGEX = /^Hội đồng Xét duyệt Đề cương\s+(\d+)$/i;
const OUTLINE_ROLE_ORDER = ['CHAIRMAN', 'SECRETARY', 'MEMBER'];
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
 * Automatically creates and assigns outline review councils for eligible students
 * in a semester using mentor-clustered partitioning and balanced lecturer workloads.
 *
 * @param {number} semesterId
 * @param {object} [options]
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

        // Step 1: Filter eligible unassigned registrations
        const unassigned = await tx.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: 'BM01_SUBMITTED',
                outlineCouncilId: null,
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
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
        const skippedStudents = [];
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

        const warnings = [];
        let createdCouncils = 0;
        let assignedStudents = 0;

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
    getNextOutlineCouncilIndex,
    OUTLINE_COUNCIL_NAME_PREFIX,
    OUTLINE_ROLE_ORDER,
};
