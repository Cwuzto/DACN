const prisma = require('../config/database');
const { createExcelBuffer } = require('../utils/excelHelper');
const {
    resolveReportReadScope,
    buildRegistrationDepartmentWhere,
    matchesReportDepartment,
} = require('../auth/reportReadScope');

const requireReportScope = async (req, res) => {
    const scope = await resolveReportReadScope({ actor: req.user, db: prisma });
    if (!scope) {
        res.status(403).json({
            success: false,
            error: 'REPORT_SCOPE_FORBIDDEN',
            message: 'Không xác định được phạm vi xem báo cáo học vụ hợp lệ.',
        });
        return null;
    }
    return scope;
};

const PUBLISHED_TYPES = new Set(['INITIAL', 'SUPPLEMENTARY', 'CORRECTION']);

/**
 * Tìm bản ghi công bố kết quả bảo vệ hợp lệ của đăng ký
 */
const getPublishedPublicationItem = (reg) => {
    const items = reg?.resultPublicationItems;
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        items.find((item) => {
            const pub = item?.publication;
            if (!pub || !PUBLISHED_TYPES.has(pub.type)) return false;
            return !reg.semesterId || !pub.semesterId || reg.semesterId === pub.semesterId;
        }) || null
    );
};

/**
 * Helper trích xuất điểm số BM05 chính thức của sinh viên đã được công bố.
 * Chỉ dùng snapshot của bản công bố (`ResultPublicationItem.finalScoreSnapshot`),
 * không fallback sang `defenseResult` hay BM04 và không làm lộ điểm chưa công bố.
 */
const getOfficialPublishedScore = (reg) => {
    const publishedItem = getPublishedPublicationItem(reg);
    if (!publishedItem) return null;

    if (
        publishedItem.finalScoreSnapshot !== undefined &&
        publishedItem.finalScoreSnapshot !== null &&
        publishedItem.finalScoreSnapshot !== '' &&
        Number.isFinite(Number(publishedItem.finalScoreSnapshot))
    ) {
        return Number(publishedItem.finalScoreSnapshot);
    }
    return null;
};

/**
 * Helper trích xuất trạng thái nhận xét định tính BM04 của GVHD
 */
const getBm04QualitativeLabel = (reg) => {
    const bm04 = reg?.bm04Evaluation;
    if (!bm04) return 'Chưa đánh giá';
    if (bm04.conclusion === 'AGREED_FOR_DEFENSE') return 'Đồng ý cho bảo vệ';
    if (bm04.conclusion === 'NOT_AGREED_FOR_DEFENSE') return 'Không đồng ý bảo vệ';
    if (bm04.status === 'SIGNED') return 'Đã ký nhận xét';
    return 'Đã lập nhận xét';
};

/**
 * Tìm học kỳ mục tiêu
 */
const resolveTargetSemester = async (semesterId) => {
    if (semesterId) {
        const id = parseInt(semesterId, 10);
        if (Number.isInteger(id)) {
            const sem = await prisma.semester.findUnique({ where: { id } });
            if (sem) return sem;
        }
    }

    const now = new Date();
    const activeSem = await prisma.semester.findFirst({
        where: {
            OR: [
                { status: 'ONGOING' },
                { startDate: { lte: now }, endDate: { gte: now } },
            ],
        },
        orderBy: { startDate: 'desc' },
    });

    if (activeSem) return activeSem;

    return await prisma.semester.findFirst({
        orderBy: { endDate: 'desc' },
    });
};

const BM01_PASSED_SET = new Set([
    'BM01_PASSED',
    'BM02_OPEN',
    'BM02_SUBMITTED',
    'BM02_NEEDS_REVISION',
    'BM02_REVISION_REQUIRED',
    'BM02_RESUBMITTED',
    'BM02_APPROVED',
    'BM02_EXCEPTION_REVIEW',
    'DECISION_ISSUED',
    'IN_PROGRESS',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENSE_PASSED',
    'PENDING_INSTITUTE_SIGNATURE',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'SUBMITTED',
    'DEFENDED',
    'COMPLETED',
]);

const DECISION_ISSUED_SET = new Set([
    'DECISION_ISSUED',
    'IN_PROGRESS',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENSE_PASSED',
    'PENDING_INSTITUTE_SIGNATURE',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'SUBMITTED',
    'DEFENDED',
    'COMPLETED',
]);

const BM03_PASSED_SET = new Set([
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENSE_PASSED',
    'PENDING_INSTITUTE_SIGNATURE',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'SUBMITTED',
    'DEFENDED',
    'COMPLETED',
]);

const DEFENSE_READY_SET = new Set([
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENSE_PASSED',
    'PENDING_INSTITUTE_SIGNATURE',
    'ARCHIVE_INCOMPLETE',
    'ARCHIVE_REJECTED',
    'SUBMITTED',
    'DEFENDED',
    'COMPLETED',
]);

const COMPLETED_SET = new Set(['COMPLETED']);

/**
 * GET /api/reports/overview
 */
const getOverviewReport = async (req, res, next) => {
    try {
        const scope = await requireReportScope(req, res);
        if (!scope) return;

        const { semesterId, major } = req.query;
        const targetSemester = await resolveTargetSemester(semesterId);

        if (!targetSemester) {
            return res.status(200).json({
                success: true,
                data: {
                    semester: null,
                    kpis: {
                        totalStudents: 0,
                        completedCount: 0,
                        completionRate: 0,
                        averageScore: 0,
                        maxScore: 0,
                        minScore: 0,
                    },
                    gradeDistribution: [],
                    funnel: [],
                    majors: [],
                },
            });
        }

        const where = {
            semesterId: targetSemester.id,
            ...(!scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {}),
        };

        let registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { include: { studentProfile: true } },
                topic: { include: { mentor: true } },
                bm04Evaluation: true,
                defenseResult: true,
                resultPublicationItems: {
                    include: {
                        publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!scope.global) {
            registrations = registrations.filter((reg) => matchesReportDepartment(reg, scope.departments));
        }

        // Lọc chuyên ngành nếu có
        if (major && String(major).trim() !== '') {
            const cleanMajor = String(major).trim().toLowerCase();
            registrations = registrations.filter((reg) => {
                const regMajor = (reg.student?.studentProfile?.major || reg.topic?.targetMajor || '').toLowerCase();
                return regMajor.includes(cleanMajor);
            });
        }

        const totalStudents = registrations.length;
        const completedCount = registrations.filter((r) => COMPLETED_SET.has(r.status)).length;
        const completionRate = totalStudents > 0
            ? Math.round((completedCount / totalStudents) * 1000) / 10
            : 0;

        // Phổ điểm và điểm trung bình
        const scoredList = registrations
            .map((r) => getOfficialPublishedScore(r))
            .filter((score) => score !== null);

        const averageScore = scoredList.length > 0
            ? Math.round((scoredList.reduce((sum, s) => sum + s, 0) / scoredList.length) * 100) / 100
            : 0;
        const maxScore = scoredList.length > 0 ? Math.max(...scoredList) : 0;
        const minScore = scoredList.length > 0 ? Math.min(...scoredList) : 0;

        let excellentCount = 0;
        let goodCount = 0;
        let fairCount = 0;
        let averageGradeCount = 0;
        let failedCount = 0;
        let ungradedCount = 0;

        for (const reg of registrations) {
            const score = getOfficialPublishedScore(reg);
            if (score !== null) {
                if (score >= 8.5) excellentCount++;
                else if (score >= 7.0) goodCount++;
                else if (score >= 5.5) fairCount++;
                else if (score >= 4.0) averageGradeCount++;
                else failedCount++;
            } else {
                ungradedCount++;
            }
        }

        const gradeDistribution = [
            {
                grade: 'EXCELLENT',
                label: 'Xuất sắc (8.5 - 10)',
                count: excellentCount,
                percent: totalStudents > 0 ? Math.round((excellentCount / totalStudents) * 1000) / 10 : 0,
                color: '#10B981',
            },
            {
                grade: 'GOOD',
                label: 'Giỏi (7.0 - 8.4)',
                count: goodCount,
                percent: totalStudents > 0 ? Math.round((goodCount / totalStudents) * 1000) / 10 : 0,
                color: '#0F766E',
            },
            {
                grade: 'FAIR',
                label: 'Khá (5.5 - 6.9)',
                count: fairCount,
                percent: totalStudents > 0 ? Math.round((fairCount / totalStudents) * 1000) / 10 : 0,
                color: '#F59E0B',
            },
            {
                grade: 'AVERAGE',
                label: 'Trung bình (4.0 - 5.4)',
                count: averageGradeCount,
                percent: totalStudents > 0 ? Math.round((averageGradeCount / totalStudents) * 1000) / 10 : 0,
                color: '#64748B',
            },
            {
                grade: 'FAILED',
                label: 'Chưa đạt (< 4.0)',
                count: failedCount,
                percent: totalStudents > 0 ? Math.round((failedCount / totalStudents) * 1000) / 10 : 0,
                color: '#EF4444',
            },
            {
                grade: 'UNGRADED',
                label: 'Chưa có kết quả',
                count: ungradedCount,
                percent: totalStudents > 0 ? Math.round((ungradedCount / totalStudents) * 1000) / 10 : 0,
                color: '#94A3B8',
            },
        ];

        // Phễu tiến độ học vụ 6 mốc
        const bm01PassedCount = registrations.filter((r) => BM01_PASSED_SET.has(r.status)).length;
        const decisionIssuedCount = registrations.filter((r) => DECISION_ISSUED_SET.has(r.status) || Boolean(r.decisionNumber)).length;
        const bm03PassedCount = registrations.filter((r) => BM03_PASSED_SET.has(r.status)).length;
        const defenseReadyCount = registrations.filter((r) => DEFENSE_READY_SET.has(r.status)).length;
        const finalCompletedCount = completedCount;

        const funnel = [
            {
                step: 'ENROLLED',
                label: 'Đăng ký đề tài',
                count: totalStudents,
                rate: totalStudents > 0 ? 100 : 0,
            },
            {
                step: 'BM01_PASSED',
                label: 'Đề cương Đạt',
                count: bm01PassedCount,
                rate: totalStudents > 0 ? Math.round((bm01PassedCount / totalStudents) * 1000) / 10 : 0,
            },
            {
                step: 'DECISION_ISSUED',
                label: 'Giao đề tài chính thức',
                count: decisionIssuedCount,
                rate: totalStudents > 0 ? Math.round((decisionIssuedCount / totalStudents) * 1000) / 10 : 0,
            },
            {
                step: 'BM03_PASSED',
                label: 'Hoàn thành tiến độ BM03',
                count: bm03PassedCount,
                rate: totalStudents > 0 ? Math.round((bm03PassedCount / totalStudents) * 1000) / 10 : 0,
            },
            {
                step: 'DEFENSE_READY',
                label: 'Đủ điều kiện bảo vệ',
                count: defenseReadyCount,
                rate: totalStudents > 0 ? Math.round((defenseReadyCount / totalStudents) * 1000) / 10 : 0,
            },
            {
                step: 'COMPLETED',
                label: 'Bảo vệ & Lưu chiểu thành công',
                count: finalCompletedCount,
                rate: totalStudents > 0 ? Math.round((finalCompletedCount / totalStudents) * 1000) / 10 : 0,
            },
        ];

        // So sánh theo Chuyên ngành
        const majorMap = new Map();
        for (const reg of registrations) {
            const m = reg.student?.studentProfile?.major || reg.topic?.targetMajor || 'Khác';
            if (!majorMap.has(m)) {
                majorMap.set(m, { major: m, studentCount: 0, completedCount: 0, scores: [] });
            }
            const item = majorMap.get(m);
            item.studentCount++;
            if (COMPLETED_SET.has(reg.status)) {
                item.completedCount++;
            }
            const s = getOfficialPublishedScore(reg);
            if (s !== null) {
                item.scores.push(s);
            }
        }

        const majors = Array.from(majorMap.values()).map((item) => ({
            major: item.major,
            studentCount: item.studentCount,
            completedCount: item.completedCount,
            avgScore: item.scores.length > 0
                ? Math.round((item.scores.reduce((a, b) => a + b, 0) / item.scores.length) * 100) / 100
                : 0,
        })).sort((a, b) => b.studentCount - a.studentCount);

        return res.status(200).json({
            success: true,
            data: {
                semester: {
                    id: targetSemester.id,
                    name: targetSemester.name,
                    code: targetSemester.code,
                },
                kpis: {
                    totalStudents,
                    completedCount,
                    completionRate,
                    averageScore,
                    maxScore,
                    minScore,
                },
                gradeDistribution,
                funnel,
                majors,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/lecturer-workload
 */
const getLecturerWorkloadReport = async (req, res, next) => {
    try {
        const scope = await requireReportScope(req, res);
        if (!scope) return;

        const { semesterId } = req.query;
        const targetSemester = await resolveTargetSemester(semesterId);

        if (!targetSemester) {
            return res.status(200).json({ success: true, data: [] });
        }

        const where = {
            semesterId: targetSemester.id,
            ...(!scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {}),
        };

        let registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                topic: { include: { mentor: true } },
                bm04Evaluation: true,
                defenseResult: true,
                resultPublicationItems: {
                    include: {
                        publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!scope.global) {
            registrations = registrations.filter((reg) => matchesReportDepartment(reg, scope.departments));
        }

        const lecturerMap = new Map();

        for (const reg of registrations) {
            const mentor = reg.topic?.mentor;
            if (!mentor || !mentor.id) continue;

            if (!lecturerMap.has(mentor.id)) {
                lecturerMap.set(mentor.id, {
                    lecturerId: mentor.id,
                    fullName: mentor.fullName || '',
                    email: mentor.email || '',
                    department: mentor.department || 'N/A',
                    assignedCount: 0,
                    completedCount: 0,
                    bm04ReviewedCount: 0,
                    bm04AgreedCount: 0,
                    councilScores: [],
                });
            }

            const item = lecturerMap.get(mentor.id);
            item.assignedCount++;
            if (COMPLETED_SET.has(reg.status)) {
                item.completedCount++;
            }

            if (reg.bm04Evaluation) {
                item.bm04ReviewedCount++;
                if (reg.bm04Evaluation.conclusion === 'AGREED_FOR_DEFENSE') {
                    item.bm04AgreedCount++;
                }
            }

            const cScore = getOfficialPublishedScore(reg);
            if (cScore !== null) {
                item.councilScores.push(cScore);
            }
        }

        const lecturers = Array.from(lecturerMap.values()).map((item) => {
            const completionRate = item.assignedCount > 0
                ? Math.round((item.completedCount / item.assignedCount) * 1000) / 10
                : 0;

            const avgCouncilScore = item.councilScores.length > 0
                ? Math.round((item.councilScores.reduce((a, b) => a + b, 0) / item.councilScores.length) * 100) / 100
                : null;

            return {
                lecturerId: item.lecturerId,
                fullName: item.fullName,
                email: item.email,
                department: item.department,
                assignedCount: item.assignedCount,
                completedCount: item.completedCount,
                completionRate,
                bm04ReviewedCount: item.bm04ReviewedCount,
                bm04AgreedCount: item.bm04AgreedCount,
                avgCouncilScore,
            };
        }).sort((a, b) => b.assignedCount - a.assignedCount || a.fullName.localeCompare(b.fullName));

        return res.status(200).json({ success: true, data: lecturers });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/reports/export-excel
 */
const exportAcademicSummaryExcel = async (req, res, next) => {
    try {
        const scope = await requireReportScope(req, res);
        if (!scope) return;

        const { semesterId, major } = req.query;
        const targetSemester = await resolveTargetSemester(semesterId);

        if (!targetSemester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy học kỳ yêu cầu.' });
        }

        const where = {
            semesterId: targetSemester.id,
            ...(!scope.global ? buildRegistrationDepartmentWhere(scope.departments) : {}),
        };

        let registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { include: { studentProfile: true } },
                topic: { include: { mentor: true } },
                bm04Evaluation: true,
                defenseResult: true,
                resultPublicationItems: {
                    include: {
                        publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!scope.global) {
            registrations = registrations.filter((reg) => matchesReportDepartment(reg, scope.departments));
        }

        if (major && String(major).trim() !== '') {
            const cleanMajor = String(major).trim().toLowerCase();
            registrations = registrations.filter((reg) => {
                const regMajor = (reg.student?.studentProfile?.major || reg.topic?.targetMajor || '').toLowerCase();
                return regMajor.includes(cleanMajor);
            });
        }

        const rows = registrations.map((reg, index) => {
            const bm04StatusLabel = getBm04QualitativeLabel(reg);
            const councilScore = getOfficialPublishedScore(reg);
            const finalScore = councilScore;

            let gradeLabel = 'Chưa có điểm';
            if (finalScore !== null) {
                if (finalScore >= 8.5) gradeLabel = 'Xuất sắc';
                else if (finalScore >= 7.0) gradeLabel = 'Giỏi';
                else if (finalScore >= 5.5) gradeLabel = 'Khá';
                else if (finalScore >= 4.0) gradeLabel = 'Trung bình';
                else gradeLabel = 'Chưa đạt';
            }

            return {
                'STT': index + 1,
                'Mã SV': reg.student?.code || '',
                'Họ và tên': reg.student?.fullName || '',
                'Chuyên ngành': reg.student?.studentProfile?.major || reg.topic?.targetMajor || '',
                'Tên đề tài': reg.adjustedTitle || reg.bm01ApprovedTitleSnapshot || reg.topic?.title || '',
                'GVHD': reg.topic?.mentor?.fullName || '',
                'Đánh giá BM04': bm04StatusLabel,
                'Điểm Hội đồng (BM05)': councilScore !== null ? councilScore : '',
                'Điểm Tổng kết': finalScore !== null ? finalScore : '',
                'Xếp loại': gradeLabel,
                'Trạng thái': reg.status || '',
            };
        });

        const colWidths = [
            { wch: 6 },
            { wch: 14 },
            { wch: 24 },
            { wch: 22 },
            { wch: 36 },
            { wch: 24 },
            { wch: 22 },
            { wch: 16 },
            { wch: 16 },
            { wch: 14 },
            { wch: 18 },
        ];

        const defaultHeaders = [
            'STT',
            'Mã SV',
            'Họ và tên',
            'Chuyên ngành',
            'Tên đề tài',
            'GVHD',
            'Đánh giá BM04',
            'Điểm Hội đồng (BM05)',
            'Điểm Tổng kết',
            'Xếp loại',
            'Trạng thái',
        ];

        const buffer = createExcelBuffer('KetQuaTotNghiep', rows, colWidths, defaultHeaders);

        const semesterCode = targetSemester.code || targetSemester.name || 'HocKy';
        const rawFilename = `Bang_Tong_Hop_Ket_Qua_Tot_Nghiep_${semesterCode}.xlsx`;
        const safeAscii = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const utf8Filename = encodeURIComponent(rawFilename);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8Filename}`);
        return res.send(buffer);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getOverviewReport,
    getLecturerWorkloadReport,
    exportAcademicSummaryExcel,
};
