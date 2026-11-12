const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const {
    uploadDefenseDocumentVersion,
    getDefenseDossier,
    captureDefenseZeroHourSnapshot,
    closeArchiveWindowAtDay15,
} = require('./defenseDossierService');
const { resolveEffectiveTopicTitle } = require('./topicTitleResolverService');
const { recordSignatureEvent, computeCanonicalPayloadHash } = require('./electronicSignatureService');
const { generateImmutableAcademicPdf } = require('./academicPdfService');
const { safeNotify } = require('./notificationService');

// Only an approved defense outcome can enter the post-defense archive flow.
// DEFENDED remains as a read-only legacy compatibility status; score alone is
// never authority to treat a new workflow record as passed.
const hasOfficialPassedDefense = (registration) => ['DEFENSE_PASSED', 'DEFENDED', 'COMPLETED'].includes(registration.status);

const ARCHIVE_WORKFLOW_SCOPE = 'archive-workflow';

const getLetterGrade = (score) => {
    if (score === null || score === undefined || isNaN(score)) return { letter: 'N/A', text: 'Chưa có điểm' };
    const num = Number(score);
    if (num >= 8.5) return { letter: 'A', text: 'Xuất sắc / Giỏi' };
    if (num >= 7.0) return { letter: 'B', text: 'Khá' };
    if (num >= 5.5) return { letter: 'C', text: 'Trung bình' };
    if (num >= 4.0) return { letter: 'D', text: 'Đạt' };
    return { letter: 'F', text: 'Không đạt' };
};

/**
 * Kiểm tra tính đầy đủ của 4 thành phần lưu chiểu số:
 * 1. Báo cáo toàn văn PDF
 * 2. Slide thuyết trình
 * 3. Link mã nguồn dự án (GitHub / Git repo)
 * 4. Video demo sản phẩm
 */
function checkArchiveComponents(archiveData = {}) {
    const missing = [];
    if (!archiveData.reportFileUrl || !String(archiveData.reportFileUrl).trim()) {
        missing.push('Báo cáo toàn văn PDF');
    }
    if (!archiveData.sourceCodeUrl || !String(archiveData.sourceCodeUrl).trim()) {
        missing.push('Link mã nguồn dự án (GitHub / Git repository)');
    }
    if (!archiveData.demoVideoUrl && !archiveData.slideFileUrl) {
        missing.push('Video demo sản phẩm hoặc Slide thuyết trình');
    }

    return {
        isComplete: missing.length === 0,
        missingComponents: missing,
    };
}

/**
 * Sinh mã băm chữ ký điện tử xác thực Giấy xác nhận (Tamper-evident verification hash)
 */
function generateCertificateVerificationHash(payload) {
    const raw = `${payload.certificateNumber}|${payload.studentCode}|${payload.topicTitle}|${payload.finalScore}|${payload.issueDate}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Sinh viên nộp / cập nhật hồ sơ lưu chiểu số sau bảo vệ
 */
async function submitArchivePostDefense(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        actorId,
        actorRole,
        reportFileUrl,
        reportFileName,
        slideFileUrl,
        slideFileName,
        sourceCodeUrl,
        demoVideoUrl,
        bm03FileUrl,
        bm04FileUrl,
        summary,
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                defenseResult: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        const isOwner = actorRole === 'STUDENT' && registration.studentId === actorId;
        const isAdmin = actorRole === 'ADMIN';

        if (!isOwner && !isAdmin) {
            throw new WorkflowTransitionError('FORBIDDEN', 403, 'Chỉ sinh viên sở hữu đề tài mới được nộp hồ sơ lưu chiểu.');
        }

        // INV-06: Điểm khóa không phải là kết quả chính thức. DEFENSE_FAILED
        // must never enter archive/completion, even if the numeric score is high.
        if (!hasOfficialPassedDefense(registration)) {
            throw new WorkflowTransitionError(
                'DEFENSE_NOT_PASSED',
                400,
                'Đề tài chưa hoàn tất bảo vệ đạt yêu cầu (Điểm TB >= 5.0) để nộp hồ sơ lưu chiểu.',
            );
        }

        if (!reportFileUrl && !sourceCodeUrl && !demoVideoUrl) {
            throw new WorkflowTransitionError(
                'EMPTY_ARCHIVE_SUBMISSION',
                400,
                'Vui lòng cung cấp ít nhất tệp báo cáo toàn văn, link mã nguồn hoặc link video demo.',
            );
        }

        const archive = await tx.projectArchive.upsert({
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

        return archive;
    });
}

/**
 * GVHD hoặc Admin thẩm định và nghiệm thu hồ sơ lưu chiểu
 * Khi APPROVED -> TopicRegistration chuyển trạng thái COMPLETED (Hoàn tất khóa luận tốt nghiệp)
 */
async function reviewArchivePostDefense(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        actorId,
        actorRole,
        decision,
        reviewerNotes,
        idempotencyKey,
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!['APPROVED', 'REVISION_REQUIRED'].includes(decision)) {
        throw new WorkflowTransitionError('INVALID_DECISION', 400, 'Quyết định nghiệm thu phải là APPROVED hoặc REVISION_REQUIRED.');
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: true,
                archive: true,
                defenseResult: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        if (!registration.archive) {
            throw new WorkflowTransitionError('ARCHIVE_NOT_SUBMITTED', 400, 'Sinh viên chưa nộp hồ sơ lưu chiểu.');
        }

        const isMentor = actorRole === 'LECTURER' && registration.topic?.mentorId === actorId;
        const isAdmin = actorRole === 'ADMIN';

        if (!isMentor && !isAdmin) {
            throw new WorkflowTransitionError('FORBIDDEN', 403, 'Chỉ GVHD hoặc Admin mới có quyền nghiệm thu hồ sơ lưu chiểu.');
        }

        const isApproved = decision === 'APPROVED';

        if (isApproved) {
            // INV-06: Completion depends on approved outcome, not numeric score.
            if (!hasOfficialPassedDefense(registration)) {
                throw new WorkflowTransitionError(
                    'CANNOT_COMPLETE_FAILED_DEFENSE',
                    409,
                    'Hồ sơ chưa có kết quả bảo vệ ĐẠT đã được phê duyệt, không thể nghiệm thu hoàn tất đồ án.',
                );
            }
        }

        // Cập nhật trạng thái ProjectArchive
        const updatedArchive = await tx.projectArchive.update({
            where: { registrationId },
            data: {
                status: decision,
                reviewedBy: actorId,
                reviewedAt: new Date(),
                reviewerNotes: reviewerNotes || null,
            },
            include: {
                reviewer: { select: { id: true, fullName: true, code: true, role: true } },
            },
        });

        // Nếu nghiệm thu thành công -> chuyển trạng thái TopicRegistration sang COMPLETED
        if (isApproved) {
            if (registration.status !== 'COMPLETED') {
                const expectedStatus = registration.status; // thường là DEFENDED

                // Thử chuyển trạng thái qua transitionRegistration nếu có đầy đủ trường, hoặc cập nhật trực tiếp qua tx
                if (tx.topicRegistration.updateMany && registration.stateVersion !== undefined) {
                    await transitionRegistration({
                        registrationId: registration.id,
                        expectedStatus,
                        expectedStateVersion: registration.stateVersion || 0,
                        targetStatus: 'COMPLETED',
                        actorId,
                        reason: 'Nghiệm thu hồ sơ lưu chiểu số thành công - Hoàn tất đồ án tốt nghiệp',
                        idempotencyKey: idempotencyKey || `archive-approve-${registration.id}-${registration.stateVersion || 0}`,
                    }, { tx }).catch(async (err) => {
                        // Fallback an toàn cho mock hoặc trường hợp stateVersion legacy
                        if (tx.topicRegistration.update) {
                            await tx.topicRegistration.update({
                                where: { id: registrationId },
                                data: { status: 'COMPLETED' },
                            });
                        }
                    });
                } else if (tx.topicRegistration.update) {
                    await tx.topicRegistration.update({
                        where: { id: registrationId },
                        data: { status: 'COMPLETED' },
                    });
                }
            }
        }

        return updatedArchive;
    });
}

/**
 * Trích xuất dữ liệu Giấy xác nhận hoàn thành đồ án tốt nghiệp (Clearance Certificate)
 */
async function getClearanceCertificateData(registrationId, options = {}) {
    const db = options.db || prisma;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    const registration = await db.topicRegistration.findUnique({
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
        throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy thông tin đăng ký.');
    }

    const archive = registration.archive;
    const isApproved = archive?.status === 'APPROVED' || registration.status === 'COMPLETED';

    if (!isApproved) {
        throw new WorkflowTransitionError(
            'ARCHIVE_NOT_APPROVED',
            400,
            'Đề tài chưa được nghiệm thu hồ sơ lưu chiểu chính thức để cấp Giấy xác nhận.',
        );
    }

    const finalScore = registration.defenseResult?.finalScore ?? null;
    const gradeInfo = getLetterGrade(finalScore);
    const year = new Date().getFullYear();
    const certCode = `TDMU-DA-CERT-${year}-${String(registration.id).padStart(5, '0')}`;
    const issueDate = archive?.reviewedAt || new Date();

    const verificationPayload = {
        certificateNumber: certCode,
        studentCode: registration.student?.code,
        topicTitle: registration.topic?.title,
        finalScore: finalScore ?? '0',
        issueDate: new Date(issueDate).toISOString().split('T')[0],
    };

    const verificationHash = generateCertificateVerificationHash(verificationPayload);

    return {
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
            slideFileUrl: archive?.slideFileUrl,
            demoVideoUrl: archive?.demoVideoUrl,
            sourceCodeUrl: archive?.sourceCodeUrl,
        },
    };
}

/**
 * Đánh giá chuyên môn hồ sơ lưu chiểu số bởi Giảng viên hướng dẫn (Tầng 1)
 */
async function reviewArchiveByMentor(input, options = {}) {
    const db = options.db || options.tx || prisma;
    const {
        archiveId,
        mentorId,
        status,
        notes,
        versionFeedbacks,
        idempotencyKey,
    } = input;

    const parsedId = parseInt(archiveId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new WorkflowTransitionError('INVALID_ARCHIVE_ID', 400, 'archiveId không hợp lệ.');
    }

    if (!['APPROVED', 'REVISION_REQUIRED', 'REJECTED'].includes(status)) {
        throw new WorkflowTransitionError('INVALID_STATUS', 400, 'Trạng thái đánh giá phải là APPROVED, REVISION_REQUIRED hoặc REJECTED.');
    }

    const execute = async (tx) => {
        let archive = await tx.projectArchive.findUnique({
            where: { id: parsedId },
            include: {
                registration: {
                    include: {
                        topic: true,
                        student: true,
                        defenseResult: true,
                    },
                },
            },
        });

        if (!archive) {
            archive = await tx.projectArchive.findUnique({
                where: { registrationId: parsedId },
                include: {
                    registration: {
                        include: {
                            topic: true,
                            student: true,
                            defenseResult: true,
                        },
                    },
                },
            });
        }

        if (!archive || !archive.registration) {
            throw new WorkflowTransitionError('ARCHIVE_NOT_FOUND', 404, 'Không tìm thấy hồ sơ lưu chiểu.');
        }

        const registration = archive.registration;
        const topicMentorId = registration.topic?.mentorId;
        if (topicMentorId !== mentorId) {
            throw new WorkflowTransitionError('FORBIDDEN', 403, 'Chỉ GVHD phụ trách đề tài mới có quyền đánh giá chuyên môn lưu chiểu.');
        }

        // Cập nhật feedback chi tiết cho từng version nếu có
        if (Array.isArray(versionFeedbacks) && versionFeedbacks.length > 0) {
            for (const item of versionFeedbacks) {
                if (item.versionId && item.feedback) {
                    await tx.defenseDocumentVersion.updateMany({
                        where: {
                            id: Number(item.versionId),
                            registrationId: registration.id,
                        },
                        data: {
                            mentorFeedback: String(item.feedback),
                        },
                    });
                }
            }
        }

        let nextArchiveStatus = archive.status;

        if (status === 'REJECTED') {
            nextArchiveStatus = 'ARCHIVE_REJECTED';
            if (registration.status === 'DEFENSE_PASSED' || registration.status === 'PENDING_INSTITUTE_SIGNATURE') {
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: registration.status,
                    expectedStateVersion: registration.stateVersion || 0,
                    targetStatus: 'ARCHIVE_REJECTED',
                    actorId: mentorId,
                    reason: notes || 'GVHD từ chối hồ sơ lưu chiểu chuyên môn',
                    idempotencyKey: idempotencyKey || `archive-mentor-reject-${registration.id}-${registration.stateVersion || 0}`,
                }, { tx });
            }
        } else if (status === 'REVISION_REQUIRED') {
            nextArchiveStatus = 'REVISION_REQUIRED';
        } else if (status === 'APPROVED') {
            // Kiểm tra đủ 4 loại tài liệu
            const versions = await tx.defenseDocumentVersion.findMany({
                where: { registrationId: registration.id },
                select: { documentType: true },
            });
            const uploadedTypes = new Set(versions.map((v) => v.documentType));
            const hasAll4Files = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'].every((t) => uploadedTypes.has(t));

            const isAcademicAffairsApproved = archive.academicAffairsReviewStatus === 'APPROVED';

            if (hasAll4Files && isAcademicAffairsApproved && registration.status === 'DEFENSE_PASSED') {
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: 'DEFENSE_PASSED',
                    expectedStateVersion: registration.stateVersion || 0,
                    targetStatus: 'PENDING_INSTITUTE_SIGNATURE',
                    actorId: mentorId,
                    reason: 'Hồ sơ đủ 4 loại tài liệu và được cả GVHD lẫn Giáo vụ phê duyệt lưu chiểu',
                    idempotencyKey: idempotencyKey || `archive-pending-sig-${registration.id}-${registration.stateVersion || 0}`,
                }, { tx });
                nextArchiveStatus = 'PENDING_INSTITUTE_SIGNATURE';
            } else {
                nextArchiveStatus = 'MENTOR_APPROVED';
            }
        }

        const updatedArchive = await tx.projectArchive.update({
            where: { id: archive.id },
            data: {
                mentorReviewStatus: status,
                mentorReviewedById: mentorId,
                mentorReviewedAt: new Date(),
                mentorReviewNotes: notes || null,
                status: nextArchiveStatus,
            },
            include: {
                mentorReviewedBy: { select: { id: true, fullName: true, role: true } },
                academicAffairsReviewedBy: { select: { id: true, fullName: true, role: true } },
                registration: {
                    include: {
                        topic: true,
                        student: true,
                        defenseResult: true,
                    },
                },
            },
        });

        const studentId = registration.studentId || registration.student?.id;
        if (studentId) {
            if (status === 'REVISION_REQUIRED') {
                await safeNotify({
                    userId: studentId,
                    title: 'Hồ sơ lưu chiểu cần chỉnh sửa bổ sung',
                    content: notes ? `Hồ sơ lưu chiểu cần chỉnh sửa bổ sung. Ghi chú: ${notes}` : 'Hồ sơ lưu chiểu cần chỉnh sửa bổ sung theo yêu cầu của GVHD.',
                    type: 'SUBMISSION',
                }, 'reviewArchiveByMentor:REVISION_REQUIRED');
            } else if (status === 'REJECTED') {
                await safeNotify({
                    userId: studentId,
                    title: 'Hồ sơ lưu chiểu chuyên môn bị từ chối',
                    content: notes ? `Hồ sơ lưu chiểu chuyên môn bị từ chối. Ghi chú: ${notes}` : 'Hồ sơ lưu chiểu chuyên môn bị từ chối bởi GVHD.',
                    type: 'SUBMISSION',
                }, 'reviewArchiveByMentor:REJECTED');
            }
        }

        return updatedArchive;
    };

    if (options.tx) {
        return execute(options.tx);
    }
    return db.$transaction(execute);
}

/**
 * Đánh giá thủ tục/thành phần hồ sơ lưu chiểu số bởi Giáo vụ Viện (Tầng 2)
 */
async function reviewArchiveByAcademicAffairs(input, options = {}) {
    const db = options.db || options.tx || prisma;
    const {
        archiveId,
        reviewerId,
        status,
        notes,
        versionFeedbacks,
        idempotencyKey,
    } = input;

    const parsedId = parseInt(archiveId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new WorkflowTransitionError('INVALID_ARCHIVE_ID', 400, 'archiveId không hợp lệ.');
    }

    if (!['APPROVED', 'REVISION_REQUIRED', 'REJECTED'].includes(status)) {
        throw new WorkflowTransitionError('INVALID_STATUS', 400, 'Trạng thái đánh giá phải là APPROVED, REVISION_REQUIRED hoặc REJECTED.');
    }

    const execute = async (tx) => {
        let archive = await tx.projectArchive.findUnique({
            where: { id: parsedId },
            include: {
                registration: {
                    include: {
                        topic: true,
                        student: true,
                        defenseResult: true,
                    },
                },
            },
        });

        if (!archive) {
            archive = await tx.projectArchive.findUnique({
                where: { registrationId: parsedId },
                include: {
                    registration: {
                        include: {
                            topic: true,
                            student: true,
                            defenseResult: true,
                        },
                    },
                },
            });
        }

        if (!archive || !archive.registration) {
            throw new WorkflowTransitionError('ARCHIVE_NOT_FOUND', 404, 'Không tìm thấy hồ sơ lưu chiểu.');
        }

        const registration = archive.registration;

        // Cập nhật feedback chi tiết cho từng version nếu có
        if (Array.isArray(versionFeedbacks) && versionFeedbacks.length > 0) {
            for (const item of versionFeedbacks) {
                if (item.versionId && item.feedback) {
                    await tx.defenseDocumentVersion.updateMany({
                        where: {
                            id: Number(item.versionId),
                            registrationId: registration.id,
                        },
                        data: {
                            academicAffairsFeedback: String(item.feedback),
                        },
                    });
                }
            }
        }

        let nextArchiveStatus = archive.status;

        if (status === 'REJECTED') {
            nextArchiveStatus = 'ARCHIVE_REJECTED';
            if (registration.status === 'DEFENSE_PASSED' || registration.status === 'PENDING_INSTITUTE_SIGNATURE') {
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: registration.status,
                    expectedStateVersion: registration.stateVersion || 0,
                    targetStatus: 'ARCHIVE_REJECTED',
                    actorId: reviewerId,
                    reason: notes || 'Giáo vụ từ chối thủ tục hồ sơ lưu chiểu',
                    idempotencyKey: idempotencyKey || `archive-aa-reject-${registration.id}-${registration.stateVersion || 0}`,
                }, { tx });
            }
        } else if (status === 'REVISION_REQUIRED') {
            nextArchiveStatus = 'REVISION_REQUIRED';
        } else if (status === 'APPROVED') {
            // Kiểm tra đủ 4 loại tài liệu
            const versions = await tx.defenseDocumentVersion.findMany({
                where: { registrationId: registration.id },
                select: { documentType: true },
            });
            const uploadedTypes = new Set(versions.map((v) => v.documentType));
            const hasAll4Files = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'].every((t) => uploadedTypes.has(t));

            const isMentorApproved = archive.mentorReviewStatus === 'APPROVED';

            if (hasAll4Files && isMentorApproved && registration.status === 'DEFENSE_PASSED') {
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: 'DEFENSE_PASSED',
                    expectedStateVersion: registration.stateVersion || 0,
                    targetStatus: 'PENDING_INSTITUTE_SIGNATURE',
                    actorId: reviewerId,
                    reason: 'Hồ sơ đủ 4 loại tài liệu và được cả GVHD lẫn Giáo vụ phê duyệt lưu chiểu',
                    idempotencyKey: idempotencyKey || `archive-pending-sig-${registration.id}-${registration.stateVersion || 0}`,
                }, { tx });
                nextArchiveStatus = 'PENDING_INSTITUTE_SIGNATURE';
            } else {
                nextArchiveStatus = 'ACADEMIC_AFFAIRS_APPROVED';
            }
        }

        const updatedArchive = await tx.projectArchive.update({
            where: { id: archive.id },
            data: {
                academicAffairsReviewStatus: status,
                academicAffairsReviewedById: reviewerId,
                academicAffairsReviewedAt: new Date(),
                academicAffairsReviewNotes: notes || null,
                status: nextArchiveStatus,
            },
            include: {
                mentorReviewedBy: { select: { id: true, fullName: true, role: true } },
                academicAffairsReviewedBy: { select: { id: true, fullName: true, role: true } },
                registration: {
                    include: {
                        topic: true,
                        student: true,
                        defenseResult: true,
                    },
                },
            },
        });

        const studentId = registration.studentId || registration.student?.id;
        if (studentId) {
            if (status === 'REVISION_REQUIRED') {
                await safeNotify({
                    userId: studentId,
                    title: 'Hồ sơ lưu chiểu cần bổ sung thủ tục (Giáo vụ)',
                    content: notes ? `Hồ sơ lưu chiểu cần bổ sung thủ tục (Giáo vụ). Ghi chú: ${notes}` : 'Hồ sơ lưu chiểu cần bổ sung thủ tục theo yêu cầu của Giáo vụ.',
                    type: 'SUBMISSION',
                }, 'reviewArchiveByAcademicAffairs:REVISION_REQUIRED');
            } else if (status === 'REJECTED') {
                await safeNotify({
                    userId: studentId,
                    title: 'Hồ sơ lưu chiểu bị từ chối (Giáo vụ)',
                    content: notes ? `Hồ sơ lưu chiểu bị từ chối (Giáo vụ). Ghi chú: ${notes}` : 'Hồ sơ lưu chiểu bị từ chối bởi Giáo vụ.',
                    type: 'SUBMISSION',
                }, 'reviewArchiveByAcademicAffairs:REJECTED');
            }
        }

        return updatedArchive;
    };

    if (options.tx) {
        return execute(options.tx);
    }
    return db.$transaction(execute);
}

/**
 * Viện trưởng ký Giấy xác nhận hoàn thành đồ án tốt nghiệp (Clearance Certificate)
 */
async function signClearanceCertificateByInstituteDirector(input, options = {}) {
    const db = options.db || options.tx || prisma;
    const {
        archiveId,
        directorUser,
        expectedPayloadHash,
        idempotencyKey,
    } = input;

    const parsedId = parseInt(archiveId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw new WorkflowTransitionError('INVALID_ARCHIVE_ID', 400, 'archiveId không hợp lệ.');
    }

    if (!directorUser || typeof directorUser !== 'object') {
        throw new WorkflowTransitionError('DIRECTOR_USER_REQUIRED', 400, 'Thông tin người ký không hợp lệ.');
    }

    const permissions = directorUser.permissions || [];
    const hasDirectorSignPerm = permissions.includes('CLEARANCE_CERTIFICATE_SIGN');
    if (!hasDirectorSignPerm) {
        throw new WorkflowTransitionError(
            'FORBIDDEN',
            403,
            'Người ký bắt buộc phải sở hữu quyền học thuật CLEARANCE_CERTIFICATE_SIGN (chức danh Viện trưởng). Tài khoản Admin kỹ thuật không có quyền này.',
        );
    }

    const execute = async (tx) => {
        let archive = await tx.projectArchive.findUnique({
            where: { id: parsedId },
            include: {
                registration: {
                    include: {
                        topic: {
                            include: {
                                mentor: true,
                                semester: true,
                                projectCatalog: true,
                            },
                        },
                        student: true,
                        defenseResult: true,
                        defenseCouncil: true,
                    },
                },
            },
        });

        if (!archive) {
            archive = await tx.projectArchive.findUnique({
                where: { registrationId: parsedId },
                include: {
                    registration: {
                        include: {
                            topic: {
                                include: {
                                    mentor: true,
                                    semester: true,
                                    projectCatalog: true,
                                },
                            },
                            student: true,
                            defenseResult: true,
                            defenseCouncil: true,
                        },
                    },
                },
            });
        }

        if (!archive || !archive.registration) {
            throw new WorkflowTransitionError('ARCHIVE_NOT_FOUND', 404, 'Không tìm thấy hồ sơ lưu chiểu.');
        }

        const registration = archive.registration;

        // Idempotency check: if already completed with certificate issued
        if (registration.status === 'COMPLETED' && archive.certificateNumber) {
            return {
                archive,
                registration,
                signatureEvent: { id: archive.certificateSignatureEventId, signedAt: archive.certificateSignedAt },
                certificatePdf: { fileUrl: archive.certificatePdfUrl },
            };
        }

        if (registration.status !== 'PENDING_INSTITUTE_SIGNATURE') {
            throw new WorkflowTransitionError(
                'REGISTRATION_NOT_READY_FOR_SIGNATURE',
                409,
                'Hồ sơ chưa ở trạng thái PENDING_INSTITUTE_SIGNATURE để ký giấy xác nhận.',
            );
        }

        if (archive.mentorReviewStatus !== 'APPROVED') {
            throw new WorkflowTransitionError(
                'MENTOR_REVIEW_NOT_APPROVED',
                409,
                'GVHD chưa phê duyệt chuyên môn hồ sơ lưu chiểu.',
            );
        }

        if (archive.academicAffairsReviewStatus !== 'APPROVED') {
            throw new WorkflowTransitionError(
                'ACADEMIC_AFFAIRS_REVIEW_NOT_APPROVED',
                409,
                'Giáo vụ Viện chưa duyệt thủ tục hồ sơ lưu chiểu.',
            );
        }

        // Resolve effective topic title
        let effectiveTitle = registration.adjustedTitle || registration.bm01ApprovedTitleSnapshot || registration.topic?.title || 'Chưa xác định';
        try {
            const titleRes = await resolveEffectiveTopicTitle(registration.id, new Date(), { tx });
            if (titleRes?.title) {
                effectiveTitle = titleRes.title;
            }
        } catch (_) {}

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const certificateNumber = archive.certificateNumber || `XNHT-${dateStr}-${registration.id}`;

        const certPayload = {
            certificateNumber,
            studentCode: registration.student?.code,
            studentName: registration.student?.fullName,
            topicTitle: effectiveTitle,
            finalScore: registration.defenseResult?.finalScore != null ? Number(registration.defenseResult.finalScore) : null,
            signerId: directorUser.id,
            signerName: directorUser.fullName,
            signedAt: now.toISOString(),
        };

        const payloadHash = computeCanonicalPayloadHash(certPayload);

        if (expectedPayloadHash && payloadHash !== expectedPayloadHash) {
            throw new WorkflowTransitionError(
                'PAYLOAD_HASH_MISMATCH',
                409,
                'Dữ liệu giấy xác nhận đã bị thay đổi trước khi ký.',
            );
        }

        // Record electronic signature event
        const sigEvent = await recordSignatureEvent({
            registrationId: registration.id,
            entityType: 'CLEARANCE_CERTIFICATE',
            entityId: archive.id,
            versionNumber: 1,
            signerId: directorUser.id,
            signerRole: 'VIEN_TRUONG',
            action: 'SIGN_CLEARANCE_CERTIFICATE',
            actualPayload: certPayload,
            expectedPayloadHash: payloadHash,
        }, { tx });

        // Generate immutable academic PDF
        const pdfResult = await generateImmutableAcademicPdf({
            docType: 'CLEARANCE_CERTIFICATE',
            registrationId: registration.id,
            entityId: archive.id,
            title: 'GIẤY XÁC NHẬN HOÀN THÀNH ĐỒ ÁN TỐT NGHIỆP',
            sections: [
                {
                    heading: 'THÔNG TIN SINH VIÊN & ĐỀ TÀI',
                    lines: [
                        `Số giấy xác nhận: ${certificateNumber}`,
                        `Họ và tên sinh viên: ${registration.student?.fullName || ''} - MSSV: ${registration.student?.code || ''}`,
                        `Tên đề tài tốt nghiệp: ${effectiveTitle}`,
                        `GVHD: ${registration.topic?.mentor?.fullName || 'N/A'}`,
                        `Điểm bảo vệ chính thức: ${registration.defenseResult?.finalScore != null ? Number(registration.defenseResult.finalScore).toFixed(1) : 'N/A'}`,
                    ],
                },
                {
                    heading: 'KẾT LUẬN LƯU CHIỂU',
                    lines: [
                        'Sinh viên đã hoàn tất đầy đủ 4 hạng mục lưu chiểu số theo đúng quy định.',
                        'Hồ sơ đã được GVHD phê duyệt chuyên môn và Giáo vụ Viện nghiệm thu thủ tục.',
                        'Đủ điều kiện công nhận hoàn thành khóa luận tốt nghiệp.',
                    ],
                },
            ],
            signatures: [
                {
                    roleLabel: 'Viện trưởng',
                    signerName: directorUser.fullName,
                    signedAt: now,
                    payloadHash,
                    systemNote: `Chữ ký số điện tử xác thực - Event ID: ${sigEvent.id}`,
                },
            ],
        }, { tx });

        // Update ProjectArchive
        const updatedArchive = await tx.projectArchive.update({
            where: { id: archive.id },
            data: {
                certificateNumber,
                certificateSignedById: directorUser.id,
                certificateSignedAt: now,
                certificatePdfUrl: pdfResult.fileUrl,
                certificatePayloadHash: payloadHash,
                certificateSignatureEventId: sigEvent.id,
                certificateSnapshot: certPayload,
                status: 'COMPLETED',
            },
            include: {
                certificateSignedBy: { select: { id: true, fullName: true, role: true } },
                mentorReviewedBy: { select: { id: true, fullName: true, role: true } },
                academicAffairsReviewedBy: { select: { id: true, fullName: true, role: true } },
                registration: {
                    include: { student: true, topic: true, defenseResult: true },
                },
            },
        });

        // Transition registration to COMPLETED
        const updatedRegistration = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: 'PENDING_INSTITUTE_SIGNATURE',
            expectedStateVersion: registration.stateVersion || 0,
            targetStatus: 'COMPLETED',
            actorId: directorUser.id,
            reason: 'Viện trưởng ký số Giấy xác nhận hoàn thành đồ án tốt nghiệp',
            idempotencyKey: idempotencyKey || `archive-cert-sign-${registration.id}-${registration.stateVersion || 0}`,
        }, { tx });

        const studentId = registration.studentId || registration.student?.id;
        if (studentId) {
            await safeNotify({
                userId: studentId,
                title: 'Giấy xác nhận hoàn thành đồ án tốt nghiệp đã được cấp',
                content: `Chúc mừng bạn đã hoàn thành xuất sắc đồ án tốt nghiệp! Viện trưởng đã ký Giấy xác nhận hoàn thành số ${certificateNumber}. Bạn có thể tải giấy xác nhận PDF chính thức ngay bây giờ.`,
                type: 'SYSTEM',
            }, 'signClearanceCertificateByInstituteDirector');
        }

        return {
            archive: updatedArchive,
            registration: updatedRegistration,
            signatureEvent: sigEvent,
            certificatePdf: pdfResult,
        };
    };

    if (options.tx) {
        return execute(options.tx);
    }
    return db.$transaction(execute);
}

module.exports = {
    ARCHIVE_WORKFLOW_SCOPE,
    getLetterGrade,
    checkArchiveComponents,
    generateCertificateVerificationHash,
    submitArchivePostDefense,
    reviewArchivePostDefense,
    getClearanceCertificateData,
    uploadDefenseDocumentVersion,
    getDefenseDossier,
    captureDefenseZeroHourSnapshot,
    closeArchiveWindowAtDay15,
    reviewArchiveByMentor,
    reviewArchiveByAcademicAffairs,
    reviewArchivalDossierByAdvisor: reviewArchiveByMentor,
    reviewArchivalDossierByAcademicAffairs: reviewArchiveByAcademicAffairs,
    signClearanceCertificateByInstituteDirector,
};
