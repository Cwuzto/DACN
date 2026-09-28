const prisma = require('../config/database');

const parsePositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getLetterGrade = (score) => {
    if (score === null || score === undefined) return { letter: 'N/A', text: 'Chưa có điểm' };
    const num = Number(score);
    if (num >= 8.5) return { letter: 'A', text: 'Xuất sắc / Giỏi' };
    if (num >= 7.0) return { letter: 'B', text: 'Khá' };
    if (num >= 5.5) return { letter: 'C', text: 'Trung bình' };
    if (num >= 4.0) return { letter: 'D', text: 'Đạt' };
    return { letter: 'F', text: 'Không đạt' };
};

// 1. Lay thong tin ho so luu chieu cua 1 de tai
const getArchiveByRegistration = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, code: true, email: true, academicTitle: true } },
                        semester: { select: { id: true, name: true, academicYear: true } },
                        projectCatalog: { select: { id: true, name: true } },
                    },
                },
                defenseResult: true,
                defenseCouncil: { select: { id: true, name: true, defenseDate: true, location: true } },
                archive: {
                    include: {
                        reviewer: { select: { id: true, fullName: true, code: true, role: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        // Kiem tra quyen truy cap: SV so huu, GVHD de tai hoac Admin
        const { role, id: userId } = req.user;
        const isOwner = role === 'STUDENT' && registration.studentId === userId;
        const isMentor = role === 'LECTURER' && registration.topic?.mentorId === userId;
        const isAdmin = role === 'ADMIN';

        if (!isOwner && !isMentor && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập hồ sơ lưu chiểu này.' });
        }

        res.json({
            success: true,
            data: {
                registration,
                archive: registration.archive || null,
            },
        });
    } catch (error) {
        next(error);
    }
};

// 2. Sinh vien nop hoac cap nhat ho so luu chieu
const submitArchive = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                defenseResult: true,
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }

        const { role, id: userId } = req.user;
        const isOwner = role === 'STUDENT' && registration.studentId === userId;
        const isAdmin = role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Chỉ sinh viên sở hữu đề tài mới được nộp hồ sơ lưu chiểu.' });
        }

        // Kiem tra dieu kien: Sinh vien phai da bao ve dat ket qua
        const finalScore = registration.defenseResult?.finalScore;
        const hasPassedDefense = (finalScore !== null && finalScore !== undefined && Number(finalScore) >= 5.0)
            || ['DEFENDED', 'COMPLETED'].includes(registration.status);

        if (!hasPassedDefense) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa hoàn tất bảo vệ đạt yêu cầu (Điểm TB >= 5.0) để nộp hồ sơ lưu chiểu.',
            });
        }

        const {
            reportFileUrl,
            reportFileName,
            slideFileUrl,
            slideFileName,
            sourceCodeUrl,
            demoVideoUrl,
            bm03FileUrl,
            bm04FileUrl,
            summary,
        } = req.body;

        if (!reportFileUrl && !sourceCodeUrl && !demoVideoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ít nhất tệp báo cáo toàn văn, link mã nguồn hoặc link video demo.',
            });
        }

        const archive = await prisma.projectArchive.upsert({
            where: { registrationId },
            update: {
                reportFileUrl: reportFileUrl || undefined,
                reportFileName: reportFileName || undefined,
                slideFileUrl: slideFileUrl || undefined,
                slideFileName: slideFileName || undefined,
                sourceCodeUrl: sourceCodeUrl || undefined,
                demoVideoUrl: demoVideoUrl || undefined,
                bm03FileUrl: bm03FileUrl || undefined,
                bm04FileUrl: bm04FileUrl || undefined,
                summary: summary !== undefined ? summary : undefined,
                status: 'SUBMITTED',
                submittedAt: new Date(),
                reviewerNotes: null,
            },
            create: {
                registrationId,
                reportFileUrl,
                reportFileName,
                slideFileUrl,
                slideFileName,
                sourceCodeUrl,
                demoVideoUrl,
                bm03FileUrl,
                bm04FileUrl,
                summary,
                status: 'SUBMITTED',
                submittedAt: new Date(),
            },
            include: {
                reviewer: { select: { id: true, fullName: true, role: true } },
            },
        });

        // Tao thong bao cho GVHD
        if (registration.topic?.mentorId) {
            await prisma.notification.create({
                data: {
                    userId: registration.topic.mentorId,
                    type: 'SUBMISSION',
                    title: 'Sinh viên đã nộp hồ sơ lưu chiểu',
                    message: `Sinh viên đã nộp hồ sơ lưu chiểu cho đề tài "${registration.topic.title}". Vui lòng kiểm tra và nghiệm thu.`,
                    link: `/lecturer/progress-tracking`,
                },
            }).catch(() => {});
        }

        res.json({
            success: true,
            message: 'Đã nộp hồ sơ lưu chiểu thành công! Hồ sơ đang chờ Giảng viên hướng dẫn nghiệm thu.',
            data: archive,
        });
    } catch (error) {
        next(error);
    }
};

// 3. GVHD hoac Admin nghiem thu ho so luu chieu
const reviewArchive = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const { decision, reviewerNotes } = req.body;
        if (!['APPROVED', 'REVISION_REQUIRED'].includes(decision)) {
            return res.status(400).json({ success: false, message: 'Quyết định nghiệm thu phải là APPROVED hoặc REVISION_REQUIRED.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                archive: true,
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }

        if (!registration.archive) {
            return res.status(400).json({ success: false, message: 'Sinh viên chưa nộp hồ sơ lưu chiểu.' });
        }

        const { role, id: userId } = req.user;
        const isMentor = role === 'LECTURER' && registration.topic?.mentorId === userId;
        const isAdmin = role === 'ADMIN';

        if (!isMentor && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Chỉ GVHD hoặc Admin mới có quyền nghiệm thu hồ sơ lưu chiểu.' });
        }

        const isApproved = decision === 'APPROVED';

        const updatedArchive = await prisma.$transaction(async (tx) => {
            const archive = await tx.projectArchive.update({
                where: { registrationId },
                data: {
                    status: decision,
                    reviewedBy: userId,
                    reviewedAt: new Date(),
                    reviewerNotes: reviewerNotes || null,
                },
                include: {
                    reviewer: { select: { id: true, fullName: true, code: true, role: true } },
                },
            });

            // Neu nghiem thu thanh cong -> TopicRegistration chuyen COMPLETED
            if (isApproved) {
                await tx.topicRegistration.update({
                    where: { id: registrationId },
                    data: { status: 'COMPLETED' },
                });
            }

            return archive;
        });

        // Gui thong bao cho sinh vien
        await prisma.notification.create({
            data: {
                userId: registration.studentId,
                type: 'APPROVAL',
                title: isApproved ? 'Hồ sơ lưu chiểu đã được nghiệm thu' : 'Yêu cầu chỉnh sửa hồ sơ lưu chiểu',
                message: isApproved
                    ? `Chúc mừng! Hồ sơ lưu chiểu đề tài "${registration.topic.title}" đã được nghiệm thu chính thức. Bạn đã hoàn tất học phần đồ án tốt nghiệp.`
                    : `Hồ sơ lưu chiểu đề tài "${registration.topic.title}" cần chỉnh sửa: ${reviewerNotes || 'Vui lòng cập nhật lại tài liệu theo dặn dò của GVHD.'}`,
                link: `/student/grades`,
            },
        }).catch(() => {});

        res.json({
            success: true,
            message: isApproved
                ? 'Đã nghiệm thu hồ sơ lưu chiểu thành công! Đề tài đã chính thức HOÀN TẤT (COMPLETED).'
                : 'Đã gửi yêu cầu chỉnh sửa hồ sơ lưu chiểu cho sinh viên.',
            data: updatedArchive,
        });
    } catch (error) {
        next(error);
    }
};

// 4. Danh sach Kho luu chieu toan khoa (Archive Repository)
const getAllArchives = async (req, res, next) => {
    try {
        const {
            semesterId,
            status,
            search,
            page = 1,
            limit = 20,
        } = req.query;

        const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }

        const registrationWhere = {};
        const parsedSemesterId = parsePositiveInt(semesterId);
        if (parsedSemesterId) {
            registrationWhere.semesterId = parsedSemesterId;
        }

        if (search && search.trim()) {
            const keyword = search.trim();
            registrationWhere.OR = [
                { student: { fullName: { contains: keyword, mode: 'insensitive' } } },
                { student: { code: { contains: keyword, mode: 'insensitive' } } },
                { topic: { title: { contains: keyword, mode: 'insensitive' } } },
                { topic: { mentor: { fullName: { contains: keyword, mode: 'insensitive' } } } },
            ];
        }

        where.registration = registrationWhere;

        const [total, archives] = await Promise.all([
            prisma.projectArchive.count({ where }),
            prisma.projectArchive.findMany({
                where,
                skip,
                take,
                orderBy: { submittedAt: 'desc' },
                include: {
                    reviewer: { select: { id: true, fullName: true, code: true, role: true } },
                    registration: {
                        include: {
                            student: { select: { id: true, fullName: true, code: true, department: true } },
                            topic: {
                                include: {
                                    mentor: { select: { id: true, fullName: true, code: true, academicTitle: true } },
                                    semester: { select: { id: true, name: true, academicYear: true } },
                                    projectCatalog: { select: { id: true, name: true } },
                                },
                            },
                            defenseResult: { select: { finalScore: true, comments: true } },
                            defenseCouncil: { select: { id: true, name: true, defenseDate: true } },
                        },
                    },
                },
            }),
        ]);

        res.json({
            success: true,
            data: {
                total,
                page: Math.max(parseInt(page, 10) || 1, 1),
                limit: take,
                totalPages: Math.ceil(total / take),
                items: archives,
            },
        });
    } catch (error) {
        next(error);
    }
};

// 5. Trich xuat Giay Xac Nhan Hoan Thanh Do An (Clearance Certificate)
const getClearanceCertificate = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true, department: true, email: true } },
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, code: true, academicTitle: true } },
                        semester: { select: { id: true, name: true, academicYear: true } },
                        projectCatalog: { select: { id: true, name: true } },
                    },
                },
                defenseResult: true,
                defenseCouncil: {
                    include: {
                        members: {
                            include: { lecturer: { select: { fullName: true, academicTitle: true } } },
                        },
                    },
                },
                archive: {
                    include: {
                        reviewer: { select: { fullName: true, code: true, academicTitle: true, role: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đăng ký.' });
        }

        const archive = registration.archive;
        const isApproved = archive?.status === 'APPROVED' || registration.status === 'COMPLETED';

        if (!isApproved) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa được nghiệm thu hồ sơ lưu chiểu chính thức để cấp Giấy xác nhận.',
            });
        }

        const finalScore = registration.defenseResult?.finalScore ?? null;
        const gradeInfo = getLetterGrade(finalScore);
        const year = new Date().getFullYear();
        const certCode = `TDMU-DA-CERT-${year}-${String(registration.id).padStart(5, '0')}`;

        res.json({
            success: true,
            data: {
                certificateNumber: certCode,
                issueDate: archive?.reviewedAt || new Date(),
                student: {
                    fullName: registration.student?.fullName,
                    code: registration.student?.code,
                    department: registration.student?.department || 'Khoa Công Nghệ Thông Tin',
                },
                topic: {
                    title: registration.topic?.title,
                    courseName: registration.topic?.projectCatalog?.name || 'Khóa luận tốt nghiệp',
                    semester: registration.topic?.semester?.name,
                    academicYear: registration.topic?.semester?.academicYear,
                },
                mentor: {
                    fullName: registration.topic?.mentor?.fullName,
                    academicTitle: registration.topic?.mentor?.academicTitle,
                },
                council: {
                    name: registration.defenseCouncil?.name,
                    defenseDate: registration.defenseCouncil?.defenseDate,
                },
                evaluation: {
                    finalScore,
                    letterGrade: gradeInfo.letter,
                    rankingText: gradeInfo.text,
                },
                archive: {
                    submittedAt: archive?.submittedAt,
                    reviewedAt: archive?.reviewedAt,
                    reviewerName: archive?.reviewer?.fullName,
                    reviewerTitle: archive?.reviewer?.academicTitle,
                    reportFileUrl: archive?.reportFileUrl,
                    demoVideoUrl: archive?.demoVideoUrl,
                    sourceCodeUrl: archive?.sourceCodeUrl,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// 6. Health Radar: Thong ke canh bao som tien do & luu chieu
const getHealthRadarStats = async (req, res, next) => {
    try {
        const { semesterId } = req.query;
        const parsedSemesterId = parsePositiveInt(semesterId);

        const whereBase = {};
        if (parsedSemesterId) whereBase.semesterId = parsedSemesterId;

        const now = new Date();
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

        // 1. Sinh vien da bao ve (DEFENDED) nhung chua nop luu chieu hoac bi cham qua 14 ngay
        const defendedRegistrations = await prisma.topicRegistration.findMany({
            where: {
                ...whereBase,
                status: 'DEFENDED',
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { title: true, mentor: { select: { fullName: true } } } },
                defenseCouncil: { select: { defenseDate: true } },
                archive: { select: { status: true, submittedAt: true } },
            },
        });

        const overdueArchiveStudents = defendedRegistrations.filter((r) => {
            const hasArchive = !!r.archive;
            const defenseDate = r.defenseCouncil?.defenseDate || r.updatedAt;
            const isOver14Days = new Date(defenseDate) < fourteenDaysAgo;
            return !hasArchive || (r.archive.status === 'REVISION_REQUIRED' && isOver14Days);
        });

        // 2. Ho so luu chieu dang cho nghiem thu
        const pendingArchiveReviewCount = await prisma.projectArchive.count({
            where: {
                status: 'SUBMITTED',
                ...(parsedSemesterId ? { registration: { semesterId: parsedSemesterId } } : {}),
            },
        });

        // 3. Sinh vien dang thuc hien (IN_PROGRESS) qua 21 ngay khong co buoi gap BM03
        const inProgressRegistrations = await prisma.topicRegistration.findMany({
            where: {
                ...whereBase,
                status: 'IN_PROGRESS',
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { title: true, mentor: { select: { fullName: true } } } },
                meetingLogs: {
                    orderBy: { meetingDate: 'desc' },
                    take: 1,
                },
            },
        });

        const atRiskInactiveStudents = inProgressRegistrations.filter((r) => {
            const lastMeeting = r.meetingLogs?.[0];
            if (!lastMeeting) {
                // Chua bao gio gap GVHD va da dang ky qua 21 ngay
                return new Date(r.createdAt) < twentyOneDaysAgo;
            }
            return new Date(lastMeeting.meetingDate) < twentyOneDaysAgo;
        });

        res.json({
            success: true,
            data: {
                overdueArchiveCount: overdueArchiveStudents.length,
                pendingArchiveReviewCount,
                atRiskInactiveCount: atRiskInactiveStudents.length,
                overdueArchiveStudents: overdueArchiveStudents.map((r) => ({
                    registrationId: r.id,
                    studentName: r.student?.fullName,
                    studentCode: r.student?.code,
                    topicTitle: r.topic?.title,
                    mentorName: r.topic?.mentor?.fullName,
                    archiveStatus: r.archive?.status || 'NOT_SUBMITTED',
                })),
                atRiskInactiveStudents: atRiskInactiveStudents.map((r) => ({
                    registrationId: r.id,
                    studentName: r.student?.fullName,
                    studentCode: r.student?.code,
                    topicTitle: r.topic?.title,
                    mentorName: r.topic?.mentor?.fullName,
                    lastMeetingDate: r.meetingLogs?.[0]?.meetingDate || null,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getArchiveByRegistration,
    submitArchive,
    reviewArchive,
    getAllArchives,
    getClearanceCertificate,
    getHealthRadarStats,
};
