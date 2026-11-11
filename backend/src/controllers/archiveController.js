const prisma = require('../config/database');
const { PERMISSIONS } = require('../constants/permissions');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const defenseDossierService = require('../services/defenseDossierService');
const archivalWorkflowService = require('../services/archivalWorkflowService');
const defenseAndArchivalSweepService = require('../services/defenseAndArchivalSweepService');
const { WorkflowTransitionError } = require('../services/registrationTransitionService');

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

const hasPermission = (user, permissionCode) => (user.permissions || []).includes(permissionCode);

const hasInstituteArchiveScope = (user) => (
    hasPermission(user, PERMISSIONS.FINAL_DOCUMENT_REVIEW)
    && hasPermission(user, PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH)
);

const canAccessRegistrationArchive = (user, registration) => {
    const registrationStudentId = registration.studentId ?? registration.student?.id;
    const isOwner = user.role === 'STUDENT' && registrationStudentId === user.id;
    const isMentor = registration.topic?.mentorId === user.id
        && hasPermission(user, PERMISSIONS.FINAL_DOCUMENT_REVIEW);
    return isOwner || isMentor || hasInstituteArchiveScope(user);
};

const isResultPublished = async (registration) => {
    if (Array.isArray(registration.resultPublicationItems) && registration.resultPublicationItems.length > 0) {
        return registration.resultPublicationItems.some((item) => {
            const pub = item.publication;
            if (!pub) return false;
            const validSemester = !registration.semesterId || !pub.semesterId || registration.semesterId === pub.semesterId;
            const validType = ['INITIAL', 'SUPPLEMENTARY', 'CORRECTION'].includes(pub.type);
            return validSemester && validType;
        });
    }

    if (prisma.resultPublicationItem?.findFirst) {
        try {
            const item = await prisma.resultPublicationItem.findFirst({
                where: {
                    registrationId: registration.id,
                    publication: {
                        type: { in: ['INITIAL', 'SUPPLEMENTARY', 'CORRECTION'] },
                    },
                },
                include: { publication: true },
            });
            if (item && item.publication) {
                const validSemester = !registration.semesterId || !item.publication.semesterId || registration.semesterId === item.publication.semesterId;
                const validType = ['INITIAL', 'SUPPLEMENTARY', 'CORRECTION'].includes(item.publication.type);
                return validSemester && validType;
            }
        } catch (_) {
            return false;
        }
    }

    return false;
};

// 1. Lay thong tin ho so luu chieu cua 1 de tai
const getArchiveByRegistration = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
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
                        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
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
                resultPublicationItems: {
                    include: {
                        publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        if (!canAccessRegistrationArchive(req.user, registration)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập hồ sơ lưu chiểu này.' });
        }

        const registrationStudentId = registration.studentId ?? registration.student?.id;
        const isOwner = req.user.role === 'STUDENT' && registrationStudentId === req.user.id;

        // C04, SEC-12: Mask defenseResult for student until result is officially promulgated
        const responseRegistration = { ...registration };
        if (isOwner) {
            const published = await isResultPublished(registration);
            if (!published) {
                responseRegistration.defenseResult = null;
            }
        }
        delete responseRegistration.resultPublicationItems;

        const archiveData = registration.archive;
        const phase = archiveData?.phase || (archiveData ? 'POST_DEFENSE' : null);
        const preDefenseDocuments = archiveData ? {
            reportFileUrl: archiveData.reportFileUrl || null,
            reportFileName: archiveData.reportFileName || null,
            slideFileUrl: archiveData.slideFileUrl || null,
            slideFileName: archiveData.slideFileName || null,
            sourceCodeUrl: archiveData.sourceCodeUrl || null,
            notes: archiveData.summary || null,
        } : null;
        const postDefenseDocuments = archiveData?.phase === 'POST_DEFENSE' ? {
            reportFileUrl: archiveData.reportFileUrl || null,
            reportFileName: archiveData.reportFileName || null,
            slideFileUrl: archiveData.slideFileUrl || null,
            slideFileName: archiveData.slideFileName || null,
            sourceCodeUrl: archiveData.sourceCodeUrl || null,
            demoVideoUrl: archiveData.demoVideoUrl || null,
            bm03FileUrl: archiveData.bm03FileUrl || null,
            bm04FileUrl: archiveData.bm04FileUrl || null,
            summary: archiveData.summary || null,
        } : null;

        res.json({
            success: true,
            data: {
                registration: responseRegistration,
                archive: archiveData ? {
                    ...archiveData,
                    phase,
                } : null,
                phase,
                preDefenseDocuments,
                postDefenseDocuments,
            },
        });
    } catch (error) {
        next(error);
    }
};

// 2. Sinh vien nop hoac cap nhat ho so luu chieu
const submitArchive = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
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

        if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Chỉ sinh viên sở hữu đề tài mới được nộp hồ sơ lưu chiểu.' });
        }

        // Điểm khóa không phải là kết quả chính thức; chỉ outcome đã duyệt đạt
        // (hoặc bản ghi legacy DEFENDED) mới được nộp lưu chiểu.
        const hasPassedDefense = ['DEFENSE_PASSED', 'DEFENDED', 'COMPLETED'].includes(registration.status);

        if (!hasPassedDefense) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa có kết quả bảo vệ ĐẠT đã được phê duyệt để nộp hồ sơ lưu chiểu.',
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
                phase: 'POST_DEFENSE',
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
                phase: 'POST_DEFENSE',
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
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
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
                defenseResult: true,
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }

        if (!registration.archive) {
            return res.status(400).json({ success: false, message: 'Sinh viên chưa nộp hồ sơ lưu chiểu.' });
        }

        const { id: userId } = req.user;
        const isMentor = registration.topic?.mentorId === userId;
        const isInstituteReviewer = hasInstituteArchiveScope(req.user);

        if (!isMentor && !isInstituteReviewer) {
            return res.status(403).json({ success: false, message: 'Chỉ GVHD hoặc Admin mới có quyền nghiệm thu hồ sơ lưu chiểu.' });
        }

        const isApproved = decision === 'APPROVED';

        if (isApproved) {
            // C02: Nghiêm cấm nghiệm thu và chuyển sang COMPLETED khi hồ sơ không ở DEFENSE_PASSED
            if (registration.status !== 'DEFENSE_PASSED') {
                return res.status(403).json({
                    success: false,
                    code: 'CANNOT_COMPLETE_FAILED_DEFENSE',
                    message: 'Chỉ hồ sơ bảo vệ thành công (DEFENSE_PASSED) mới được nghiệm thu và hoàn thành đề tài.',
                });
            }

            // INV-06: Không chuyển đề tài bảo vệ không đạt (điểm < 5.0) sang COMPLETED
            const finalScore = registration.defenseResult?.finalScore;
            if (finalScore !== null && finalScore !== undefined && Number(finalScore) < 5.0) {
                return res.status(403).json({
                    success: false,
                    code: 'CANNOT_COMPLETE_FAILED_DEFENSE',
                    message: 'Đề tài có điểm bảo vệ dưới 5.0 (không đạt), không thể nghiệm thu hoàn tất đồ án.',
                });
            }
        }

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
                if (tx.topicRegistration.update) {
                    await tx.topicRegistration.update({
                        where: { id: registrationId },
                        data: {
                            status: 'COMPLETED',
                            ...(registration.stateVersion !== undefined ? { stateVersion: { increment: 1 } } : {}),
                        },
                    });
                }
                if (tx.registrationStateHistory?.create) {
                    await tx.registrationStateHistory.create({
                        data: {
                            registrationId,
                            fromStatus: registration.status,
                            toStatus: 'COMPLETED',
                            fromStateVersion: registration.stateVersion || 0,
                            toStateVersion: (registration.stateVersion || 0) + 1,
                            actorId: userId,
                            reason: 'Nghiệm thu hồ sơ lưu chiểu số thành công - Hoàn tất đồ án tốt nghiệp',
                        },
                    });
                }
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
        if (!hasInstituteArchiveScope(req.user)) {
            registrationWhere.topic = { mentorId: req.user.id };
        }
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
                                    semester: { select: { id: true, name: true, startDate: true, endDate: true } },
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
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
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
                        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
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

        if (!canAccessRegistrationArchive(req.user, registration)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập giấy xác nhận này.' });
        }

        const archive = registration.archive;
        const isApproved = archive?.status === 'APPROVED' || registration.status === 'COMPLETED';

        if (!isApproved) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa được nghiệm thu hồ sơ lưu chiểu chính thức để cấp Giấy xác nhận.',
            });
        }

        const { generateCertificateVerificationHash } = require('../services/archivalWorkflowService');
        const finalScore = registration.defenseResult?.finalScore ?? null;
        const gradeInfo = getLetterGrade(finalScore);
        const year = new Date().getFullYear();
        const certCode = `TDMU-DA-CERT-${year}-${String(registration.id).padStart(5, '0')}`;
        const issueDate = archive?.reviewedAt || new Date();
        const verificationHash = generateCertificateVerificationHash({
            certificateNumber: certCode,
            studentCode: registration.student?.code,
            topicTitle: registration.topic?.title,
            finalScore: finalScore ?? '0',
            issueDate: new Date(issueDate).toISOString().split('T')[0],
        });

        res.json({
            success: true,
            data: {
                certificateNumber: certCode,
                verificationHash,
                issueDate,
                student: {
                    fullName: registration.student?.fullName,
                    code: registration.student?.code,
                    department: registration.student?.department || 'Khoa Công Nghệ Thông Tin',
                },
                topic: {
                    title: registration.topic?.title,
                    courseName: registration.topic?.projectCatalog?.name || 'Khóa luận tốt nghiệp',
                    semester: registration.topic?.semester?.name,
                    academicYear: (registration.topic?.semester?.startDate && registration.topic?.semester?.endDate)
                        ? `${new Date(registration.topic.semester.startDate).getFullYear()} - ${new Date(registration.topic.semester.endDate).getFullYear()}`
                        : registration.topic?.semester?.name || `${year} - ${year + 1}`,
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
        if (!hasInstituteArchiveScope(req.user)) whereBase.topic = { mentorId: req.user.id };

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
                registration: {
                    ...(parsedSemesterId ? { semesterId: parsedSemesterId } : {}),
                    ...(!hasInstituteArchiveScope(req.user) ? { topic: { mentorId: req.user.id } } : {}),
                },
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

// Sinh vien nop ho so luu chieu so bo truoc bao ve (Pre-defense)
const submitPreDefenseArchive = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId || req.body.registrationId);

        let registration;
        if (registrationId) {
            registration = await prisma.topicRegistration.findUnique({
                where: { id: registrationId },
                include: { topic: true },
            });
        } else {
            registration = await prisma.topicRegistration.findFirst({
                where: {
                    studentId: req.user.id,
                    status: 'BM03_PASSED',
                },
                include: { topic: true },
                orderBy: { id: 'desc' },
            });
        }

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        const { role, id: userId } = req.user;
        const isOwner = role === 'STUDENT' && registration.studentId === userId;

        if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Chỉ sinh viên sở hữu đề tài mới được nộp hồ sơ lưu chiểu sơ bộ.' });
        }

        if (registration.status !== 'BM03_PASSED') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ hồ sơ ở trạng thái hoàn thành tiến độ (BM03_PASSED) mới được nộp hồ sơ lưu chiểu sơ bộ trước bảo vệ.',
            });
        }

        const {
            reportFileUrl,
            reportFileName,
            slideFileUrl,
            slideFileName,
            sourceCodeUrl,
            demoVideoUrl,
            notes,
            summary,
        } = req.body;

        if (!reportFileUrl && !slideFileUrl && !sourceCodeUrl && !demoVideoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ít nhất tệp báo cáo toàn văn, slide thuyết trình hoặc link mã nguồn.',
            });
        }

        const notesContent = notes !== undefined ? notes : summary;

        const archive = await prisma.projectArchive.upsert({
            where: { registrationId: registration.id },
            update: {
                phase: 'PRE_DEFENSE',
                status: 'SUBMITTED',
                reportFileUrl: reportFileUrl || undefined,
                reportFileName: reportFileName || undefined,
                slideFileUrl: slideFileUrl || undefined,
                slideFileName: slideFileName || undefined,
                sourceCodeUrl: sourceCodeUrl || undefined,
                demoVideoUrl: demoVideoUrl || undefined,
                summary: notesContent !== undefined ? notesContent : undefined,
                submittedAt: new Date(),
                reviewerNotes: null,
            },
            create: {
                registrationId: registration.id,
                phase: 'PRE_DEFENSE',
                status: 'SUBMITTED',
                reportFileUrl: reportFileUrl || null,
                reportFileName: reportFileName || null,
                slideFileUrl: slideFileUrl || null,
                slideFileName: slideFileName || null,
                sourceCodeUrl: sourceCodeUrl || null,
                demoVideoUrl: demoVideoUrl || null,
                summary: notesContent || null,
                submittedAt: new Date(),
            },
            include: {
                reviewer: { select: { id: true, fullName: true, role: true } },
            },
        });

        // Thong bao an toan cho GVHD
        if (registration.topic?.mentorId) {
            await safeNotify({
                userId: registration.topic.mentorId,
                type: 'SUBMISSION',
                title: 'Sinh viên đã nộp hồ sơ lưu chiểu sơ bộ (Pre-defense)',
                content: `Sinh viên đã nộp tài liệu lưu chiểu sơ bộ cho đề tài "${registration.topic.title}". Vui lòng kiểm tra và thẩm định BM04.`,
                referenceUrl: '/lecturer/progress-tracking',
            }, 'archive_pre_defense_submit');
        }

        await auditLog(
            userId,
            'SUBMIT_PRE_DEFENSE_ARCHIVE',
            'PROJECT_ARCHIVE',
            archive.id,
            {
                registrationId: registration.id,
                phase: 'PRE_DEFENSE',
                hasReport: !!archive.reportFileUrl,
                hasSlide: !!archive.slideFileUrl,
                hasSourceCode: !!archive.sourceCodeUrl,
            },
            req.ip
        );

        res.json({
            success: true,
            message: 'Đã nộp hồ sơ lưu chiểu sơ bộ (Pre-defense) thành công! Hồ sơ đã sẵn sàng để Giảng viên hướng dẫn thẩm định BM04.',
            data: archive,
        });
    } catch (error) {
        next(error);
    }
};

// 7. Tải lên 1 trong 4 loại tài liệu theo phiên bản (Multi-version upload)
const uploadDocumentVersion = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, code: 'INVALID_REGISTRATION_ID', message: 'registrationId không hợp lệ.' });
        }

        const { documentType, fileUrl, fileName, fileSizeBytes, checksum, now } = req.body;
        const actorId = req.user.id;

        const result = await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId,
            documentType,
            fileUrl,
            fileName,
            fileSizeBytes,
            checksum,
            actorId,
            now: now ? new Date(now) : new Date(),
        });

        await auditLog(
            actorId,
            'UPLOAD_DEFENSE_DOCUMENT_VERSION',
            'DEFENSE_DOCUMENT_VERSION',
            result.version.id,
            {
                registrationId,
                documentType,
                versionNumber: result.version.versionNumber,
                isLatePreDefense: result.version.isLatePreDefense,
            },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Tải lên phiên bản tài liệu thành công.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'UPLOAD_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 8. Lấy hồ sơ 6 tài liệu bảo vệ & lưu chiểu
const getDefenseDossier = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.query.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, code: 'INVALID_REGISTRATION_ID', message: 'registrationId không hợp lệ.' });
        }

        const now = req.query.now ? new Date(req.query.now) : new Date();
        const dossier = await defenseDossierService.getDefenseDossier(registrationId, { now });

        res.json({
            success: true,
            data: dossier,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'DOSSIER_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 9. Chụp snapshot bất biến lúc 00:00 ngày bảo vệ
const captureDefenseZeroHourSnapshot = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, code: 'INVALID_REGISTRATION_ID', message: 'registrationId không hợp lệ.' });
        }

        const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt) : undefined;
        const snapshot = await defenseDossierService.captureDefenseZeroHourSnapshot(registrationId, { capturedAt });

        await auditLog(
            req.user.id,
            'CAPTURE_DEFENSE_ZERO_HOUR_SNAPSHOT',
            'DEFENSE_DOCUMENT_SNAPSHOT',
            snapshot.id,
            { registrationId, snapshotType: snapshot.snapshotType },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Đã lưu snapshot bất biến lúc 00:00 ngày bảo vệ.',
            data: snapshot,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'SNAPSHOT_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 10. Đóng cửa sổ nộp lưu chiểu lúc 00:00 ngày thứ 15
const closeArchiveWindow = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, code: 'INVALID_REGISTRATION_ID', message: 'registrationId không hợp lệ.' });
        }

        const closedAt = req.body.closedAt ? new Date(req.body.closedAt) : undefined;
        const result = await defenseDossierService.closeArchiveWindowAtDay15(registrationId, { closedAt });

        await auditLog(
            req.user.id,
            'CLOSE_ARCHIVE_WINDOW_DAY_15',
            'DEFENSE_DOCUMENT_SNAPSHOT',
            result.snapshot?.id,
            { registrationId, transitionedStatus: result.transitionedStatus },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Đã đóng cửa sổ lưu chiểu lúc 00:00 ngày thứ 15 sau bảo vệ.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'CLOSE_WINDOW_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 11. GVHD duyệt chuyên môn/nội dung lưu chiểu (Tầng 1)
const mentorReviewArchive = async (req, res, next) => {
    try {
        const archiveId = parsePositiveInt(req.params.id) || parsePositiveInt(req.params.archiveId) || parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.archiveId) || parsePositiveInt(req.body.registrationId);
        if (!archiveId) {
            return res.status(400).json({ success: false, code: 'INVALID_ARCHIVE_ID', message: 'archiveId không hợp lệ.' });
        }

        const { status, notes, versionFeedbacks, idempotencyKey } = req.body;
        const result = await archivalWorkflowService.reviewArchiveByMentor({
            archiveId,
            mentorId: req.user.id,
            status,
            notes,
            versionFeedbacks,
            idempotencyKey,
        });

        await auditLog(
            req.user.id,
            'ARCHIVE_MENTOR_REVIEW',
            'PROJECT_ARCHIVE',
            result.id,
            { status, mentorReviewStatus: result.mentorReviewStatus, archiveStatus: result.status },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Đánh giá chuyên môn lưu chiểu thành công.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'REVIEW_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 12. Giáo vụ duyệt thủ tục/thành phần hồ sơ lưu chiểu (Tầng 2)
const academicAffairsReviewArchive = async (req, res, next) => {
    try {
        const archiveId = parsePositiveInt(req.params.id) || parsePositiveInt(req.params.archiveId) || parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.archiveId) || parsePositiveInt(req.body.registrationId);
        if (!archiveId) {
            return res.status(400).json({ success: false, code: 'INVALID_ARCHIVE_ID', message: 'archiveId không hợp lệ.' });
        }

        const { status, notes, versionFeedbacks, idempotencyKey } = req.body;
        const result = await archivalWorkflowService.reviewArchiveByAcademicAffairs({
            archiveId,
            reviewerId: req.user.id,
            status,
            notes,
            versionFeedbacks,
            idempotencyKey,
        });

        await auditLog(
            req.user.id,
            'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW',
            'PROJECT_ARCHIVE',
            result.id,
            { status, academicAffairsReviewStatus: result.academicAffairsReviewStatus, archiveStatus: result.status },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Đánh giá thủ tục lưu chiểu thành công.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'REVIEW_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 13. Viện trưởng ký Giấy xác nhận hoàn thành đồ án
const signClearanceCertificate = async (req, res, next) => {
    try {
        const archiveId = parsePositiveInt(req.params.id) || parsePositiveInt(req.params.archiveId) || parsePositiveInt(req.params.registrationId) || parsePositiveInt(req.body.archiveId) || parsePositiveInt(req.body.registrationId);
        if (!archiveId) {
            return res.status(400).json({ success: false, code: 'INVALID_ARCHIVE_ID', message: 'archiveId không hợp lệ.' });
        }

        const { expectedPayloadHash, idempotencyKey } = req.body;
        const result = await archivalWorkflowService.signClearanceCertificateByInstituteDirector({
            archiveId,
            directorUser: req.user,
            expectedPayloadHash,
            idempotencyKey,
        });

        await auditLog(
            req.user.id,
            'SIGN_CLEARANCE_CERTIFICATE',
            'PROJECT_ARCHIVE',
            result.archive.id,
            {
                certificateNumber: result.archive.certificateNumber,
                registrationId: result.registration.id,
                signatureEventId: result.signatureEvent?.id,
            },
            req.ip,
        );

        res.json({
            success: true,
            message: 'Viện trưởng ký số Giấy xác nhận hoàn thành đồ án thành công.',
            data: result,
        });
    } catch (error) {
        if (error instanceof WorkflowTransitionError || error.code || error.status) {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code || 'SIGN_CERTIFICATE_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

// 14. Trigger sweep job an toan
const runSweepJob = async (req, res, next) => {
    try {
        const now = req.body.now ? new Date(req.body.now) : new Date();
        const result = await defenseAndArchivalSweepService.runDefenseAndArchivalSweep({ now });

        await auditLog(
            req.user.id,
            'RUN_DEFENSE_AND_ARCHIVAL_SWEEP',
            'SYSTEM_JOB',
            'defense-archival-sweep',
            result,
            req.ip,
        );

        res.json({
            success: true,
            message: 'Chạy quét tự động lịch bảo vệ và lưu chiểu thành công.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getArchiveByRegistration,
    getRegistrationArchive: getArchiveByRegistration,
    submitArchive,
    submitPreDefenseArchive,
    reviewArchive,
    getAllArchives,
    getClearanceCertificate,
    getHealthRadarStats,
    uploadDocumentVersion,
    getDefenseDossier,
    captureDefenseZeroHourSnapshot,
    closeArchiveWindow,
    mentorReviewArchive,
    academicAffairsReviewArchive,
    signClearanceCertificate,
    runSweepJob,
};
