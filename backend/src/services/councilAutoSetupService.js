const prisma = require('../config/database');
const { MAX_STUDENTS_PER_COUNCIL } = require('../constants/councilLimits');

const ROLE_ORDER = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
const COUNCIL_NAME_PREFIX = 'Há»™i Ä‘á»“ng';
const DEFAULT_LOOKAHEAD_DAYS = 14;
const DEFENSE_ASSIGNMENT_STATUSES = ['SUBMITTED', 'DEFENDED', 'COMPLETED'];

const isValidCouncilComposition = (members = []) => {
    if (!Array.isArray(members) || members.length !== 3) return false;
    const roleSet = new Set(members.map((member) => member.roleInCouncil));
    return ROLE_ORDER.every((role) => roleSet.has(role)) && roleSet.size === 3;
};

const getNextCouncilIndex = (councils = []) => {
    const regex = /^Há»™i Ä‘á»“ng\s+(\d+)$/i;
    const maxIndex = councils.reduce((max, council) => {
        const match = `${council.name || ''}`.trim().match(regex);
        if (!match) return max;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isInteger(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxIndex + 1;
};

const pickThreeLecturers = (lecturers, excludedMentorIds, lecturerLoads) => {
    const excludedSet = new Set(excludedMentorIds || []);
    const candidates = lecturers
        .filter((lecturer) => !excludedSet.has(lecturer.id))
        .sort((a, b) => {
            const loadDiff = (lecturerLoads.get(a.id) || 0) - (lecturerLoads.get(b.id) || 0);
            if (loadDiff !== 0) return loadDiff;
            return a.id - b.id;
        });

    if (candidates.length < 3) return null;
    return candidates.slice(0, 3);
};

const ensureCouncilsForSemester = async (tx, semester, councilCountTarget) => {
    const existingCouncils = await tx.council.findMany({
        where: { semesterId: semester.id },
        orderBy: { id: 'asc' },
    });

    if (existingCouncils.length >= councilCountTarget) return existingCouncils;

    let nextIndex = getNextCouncilIndex(existingCouncils);
    const createCount = councilCountTarget - existingCouncils.length;
    for (let i = 0; i < createCount; i += 1) {
        await tx.council.create({
            data: {
                semesterId: semester.id,
                name: `${COUNCIL_NAME_PREFIX} ${nextIndex}`,
                location: null,
                defenseDate: semester.defenseDate || null,
            },
        });
        nextIndex += 1;
    }

    return tx.council.findMany({
        where: { semesterId: semester.id },
        orderBy: { id: 'asc' },
    });
};

const assignMembersForSemesterCouncils = async (tx, semesterId, lecturers) => {
    const councils = await tx.council.findMany({
        where: { semesterId },
        include: {
            members: true,
            registrations: {
                include: {
                    topic: { select: { mentorId: true } },
                },
            },
        },
        orderBy: { id: 'asc' },
    });

    const lecturerLoads = new Map();
    councils.forEach((council) => {
        council.members.forEach((member) => {
            lecturerLoads.set(member.lecturerId, (lecturerLoads.get(member.lecturerId) || 0) + 1);
        });
    });

    let updatedCouncils = 0;
    const memberWarnings = [];

    for (const council of councils) {
        if (isValidCouncilComposition(council.members)) continue;

        const mentorIds = council.registrations
            .map((registration) => registration.topic?.mentorId)
            .filter((mentorId) => Number.isInteger(mentorId));

        const selected = pickThreeLecturers(lecturers, mentorIds, lecturerLoads);
        if (!selected) {
            memberWarnings.push(`Council ${council.id} does not have enough eligible lecturers.`);
            continue;
        }

        await tx.councilMember.deleteMany({ where: { councilId: council.id } });
        await tx.councilMember.createMany({
            data: selected.map((lecturer, index) => ({
                councilId: council.id,
                lecturerId: lecturer.id,
                roleInCouncil: ROLE_ORDER[index],
            })),
        });

        selected.forEach((lecturer) => {
            lecturerLoads.set(lecturer.id, (lecturerLoads.get(lecturer.id) || 0) + 1);
        });

        updatedCouncils += 1;
    }

    return { updatedCouncils, memberWarnings };
};

const autoAssignRegistrationsForSemester = async (tx, semesterId) => {
    const councils = await tx.council.findMany({
        where: { semesterId },
        include: {
            members: { select: { lecturerId: true, roleInCouncil: true } },
            registrations: { select: { id: true } },
        },
        orderBy: { id: 'asc' },
    });

    const usableCouncils = councils
        .filter((council) => isValidCouncilComposition(council.members))
        .map((council) => ({
            id: council.id,
            currentCount: council.registrations.length,
            memberLecturerIds: new Set(council.members.map((member) => member.lecturerId)),
        }));

    if (!usableCouncils.length) {
        return { totalUnassigned: 0, assigned: 0, skipped: [], warnings: ['No usable council with valid composition.'] };
    }

    const unassigned = await tx.topicRegistration.findMany({
        where: {
            semesterId,
            councilId: null,
            status: { in: DEFENSE_ASSIGNMENT_STATUSES },
        },
        include: {
            student: { select: { fullName: true, code: true } },
            topic: { select: { title: true, mentorId: true } },
        },
        orderBy: { id: 'asc' },
    });

    let assigned = 0;
    const skipped = [];

    for (const registration of unassigned) {
        usableCouncils.sort((a, b) => a.currentCount - b.currentCount || a.id - b.id);
        let placed = false;

        for (const council of usableCouncils) {
            if (council.currentCount >= MAX_STUDENTS_PER_COUNCIL) continue;
            if (council.memberLecturerIds.has(registration.topic?.mentorId)) continue;

            await tx.topicRegistration.update({
                where: { id: registration.id },
                data: { councilId: council.id },
            });
            council.currentCount += 1;
            assigned += 1;
            placed = true;
            break;
        }

        if (!placed) {
            skipped.push({
                registrationId: registration.id,
                student: registration.student?.fullName || null,
                code: registration.student?.code || null,
                topic: registration.topic?.title || null,
                reason: 'No eligible council slot (capacity/conflict).',
            });
        }
    }

    return {
        totalUnassigned: unassigned.length,
        assigned,
        skipped,
        warnings: [],
    };
};

const runAutoCouncilSetupForSemester = async (semesterId) => prisma.$transaction(async (tx) => {
    const semester = await tx.semester.findUnique({
        where: { id: semesterId },
        select: { id: true, defenseDate: true },
    });
    if (!semester) {
        return {
            semesterId,
            createdCouncils: 0,
            updatedCouncils: 0,
            totalUnassigned: 0,
            assigned: 0,
            skipped: [],
            warnings: ['Semester not found.'],
        };
    }

    const registrationsCount = await tx.topicRegistration.count({
        where: {
            semesterId,
            status: { in: DEFENSE_ASSIGNMENT_STATUSES },
        },
    });
    const targetCouncils = registrationsCount > 0
        ? Math.ceil(registrationsCount / MAX_STUDENTS_PER_COUNCIL)
        : 0;

    const existingBefore = await tx.council.count({ where: { semesterId } });
    if (targetCouncils > 0) {
        await ensureCouncilsForSemester(tx, semester, targetCouncils);
    }
    const existingAfter = await tx.council.count({ where: { semesterId } });

    const lecturers = await tx.user.findMany({
        where: { role: 'LECTURER', isActive: true },
        select: { id: true },
    });

    const memberResult = await assignMembersForSemesterCouncils(tx, semesterId, lecturers);
    const assignResult = await autoAssignRegistrationsForSemester(tx, semesterId);

    return {
        semesterId,
        createdCouncils: Math.max(0, existingAfter - existingBefore),
        updatedCouncils: memberResult.updatedCouncils,
        totalUnassigned: assignResult.totalUnassigned,
        assigned: assignResult.assigned,
        skipped: assignResult.skipped,
        warnings: [...memberResult.memberWarnings, ...assignResult.warnings],
    };
});

const runAutoCouncilSetupForDueSemesters = async (lookaheadDays = DEFAULT_LOOKAHEAD_DAYS) => {
    const now = new Date();
    const upper = new Date(now);
    upper.setDate(upper.getDate() + lookaheadDays);

    const dueSemesters = await prisma.semester.findMany({
        where: {
            defenseDate: {
                gte: now,
                lte: upper,
            },
        },
        select: { id: true },
        orderBy: { defenseDate: 'asc' },
    });

    const results = [];
    for (const semester of dueSemesters) {
        const result = await runAutoCouncilSetupForSemester(semester.id);
        results.push(result);
    }

    return {
        lookedAheadDays: lookaheadDays,
        semesterCount: dueSemesters.length,
        results,
    };
};

module.exports = {
    runAutoCouncilSetupForSemester,
    runAutoCouncilSetupForDueSemesters,
};

