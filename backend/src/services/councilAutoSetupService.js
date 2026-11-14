const prisma = require('../config/database');
const { MAX_STUDENTS_PER_COUNCIL, MAX_STUDENTS_PER_DEFENSE_COUNCIL } = require('../constants/councilLimits');

const ROLE_ORDER = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
const COUNCIL_NAME_PREFIX = 'Hội đồng';
const DEFAULT_LOOKAHEAD_DAYS = 14;
const DEFENSE_ASSIGNMENT_STATUSES = [
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'SUBMITTED',
    'DEFENDED',
    'COMPLETED',
];

const isValidCouncilComposition = (members = []) => {
    if (!Array.isArray(members) || (members.length !== 3 && members.length !== 4)) return false;
    const roleSet = new Set(members.map((member) => member.roleInCouncil));
    const hasCoreRoles = ROLE_ORDER.every((role) => roleSet.has(role));
    if (!hasCoreRoles) return false;
    if (members.length === 4) {
        return roleSet.has('MEMBER') && roleSet.size === 4;
    }
    return roleSet.size === 3;
};

const getNextCouncilIndex = (councils = []) => {
    const regex = /^Hội đồng\s+(\d+)$/i;
    const maxIndex = councils.reduce((max, council) => {
        const match = `${council.name || ''}`.trim().match(regex);
        if (!match) return max;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isInteger(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxIndex + 1;
};

const pickThreeLecturers = (lecturers, excludedMentorIds, lecturerLoads, mentorCountsInSemester = new Map()) => {
    const excludedSet = new Set(excludedMentorIds || []);
    const candidates = lecturers
        .filter((lecturer) => !excludedSet.has(lecturer.id))
        .sort((a, b) => {
            const loadDiff = (lecturerLoads.get(a.id) || 0) - (lecturerLoads.get(b.id) || 0);
            if (loadDiff !== 0) return loadDiff;
            // Prioritize lecturers who have fewer or 0 mentored students in this semester to minimize COI:
            const mentorDiff = (mentorCountsInSemester.get(a.id) || 0) - (mentorCountsInSemester.get(b.id) || 0);
            if (mentorDiff !== 0) return mentorDiff;
            return a.id - b.id;
        });

    if (candidates.length < 3) return null;
    return candidates.slice(0, 3);
};

const ensureCouncilsForSemester = async (tx, semester, councilCountTarget) => {
    const existingCouncils = await tx.council.findMany({
        where: { semesterId: semester.id, councilType: 'DEFENSE_COUNCIL' },
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
                councilType: 'DEFENSE_COUNCIL',
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
        where: { semesterId, councilType: 'DEFENSE_COUNCIL' },
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

    const mentorRegistrations = await tx.topicRegistration.findMany({
        where: { semesterId },
        select: { topic: { select: { mentorId: true } } },
    });
    const mentorCountsInSemester = new Map();
    mentorRegistrations.forEach((r) => {
        const mId = r.topic?.mentorId;
        if (mId) {
            mentorCountsInSemester.set(mId, (mentorCountsInSemester.get(mId) || 0) + 1);
        }
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

        const selected = pickThreeLecturers(lecturers, mentorIds, lecturerLoads, mentorCountsInSemester);
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
        where: { semesterId, councilType: 'DEFENSE_COUNCIL' },
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
            defenseCouncilId: null,
            status: { in: DEFENSE_ASSIGNMENT_STATUSES },
        },
        include: {
            student: { select: { fullName: true, code: true } },
            topic: { select: { title: true, mentorId: true } },
            bm04Evaluation: { select: { id: true, conclusion: true, defenseRecommendation: true, isLocked: true } },
            tasks: {
                where: { taskType: 'BM04' },
                select: { id: true, status: true },
            },
        },
        orderBy: { id: 'asc' },
    });

    let assigned = 0;
    const skipped = [];

    for (const registration of unassigned) {
        const bm04Task = registration.tasks?.[0];
        const isBm04Completed = bm04Task && bm04Task.status === 'COMPLETED';
        const isDefenseReady = ['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE'].includes(registration.status);
        const isBm04Approved = registration.bm04Evaluation?.conclusion === 'AGREED_FOR_DEFENSE'
            || registration.bm04Evaluation?.defenseRecommendation === 'APPROVE_FOR_DEFENSE';

        if (!isDefenseReady && !isBm04Approved && !isBm04Completed) {
            skipped.push({
                registrationId: registration.id,
                student: registration.student?.fullName || null,
                code: registration.student?.code || null,
                topic: registration.topic?.title || null,
                reason: 'Chưa hoàn thành biểu mẫu BM04 (chưa đủ điều kiện bảo vệ hội đồng).',
            });
            continue;
        }

        usableCouncils.sort((a, b) => a.currentCount - b.currentCount || a.id - b.id);
        let placed = false;

        for (const council of usableCouncils) {
            if (council.currentCount >= MAX_STUDENTS_PER_DEFENSE_COUNCIL) continue;
            if (council.memberLecturerIds.has(registration.topic?.mentorId)) continue;

            await tx.topicRegistration.update({
                where: { id: registration.id },
                data: {
                    councilId: council.id,
                    defenseCouncilId: council.id,
                    status: 'DEFENSE_READY',
                },
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
                reason: 'Không còn slot hội đồng hợp lệ (xung đột GVHD hoặc vượt sĩ số).',
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
    const STUDENTS_PER_DEFENSE_SESSION = 5;
    const targetCouncils = registrationsCount > 0
        ? Math.ceil(registrationsCount / STUDENTS_PER_DEFENSE_SESSION)
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

