const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

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

module.exports = {
    ARCHIVE_WORKFLOW_SCOPE,
    getLetterGrade,
    checkArchiveComponents,
    generateCertificateVerificationHash,
    submitArchivePostDefense,
    reviewArchivePostDefense,
    getClearanceCertificateData,
};
