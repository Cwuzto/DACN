const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { resolveEffectiveTopicTitle } = require('./topicTitleResolverService');
const { computeCanonicalPayloadHash, recordSignatureEvent } = require('./electronicSignatureService');
const { generateImmutableAcademicPdf } = require('./academicPdfService');
const { validateAcademicScope } = require('./academicScopeService');

const BM04_SUBMIT_SCOPE = 'bm04-submit-command';

class BM04WorkflowError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = 'BM04WorkflowError';
        this.code = code;
        this.status = statusCode;
        this.statusCode = statusCode;
    }
}

function requireCommandKey(prefix, key) {
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    return `${prefix}:${key.trim()}`;
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

async function findReceipt(tx, scope, key, hash) {
    if (!tx.idempotencyRecord?.findUnique) return null;
    const receipt = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key } },
    });
    if (!receipt) return null;
    if (receipt.commandHash !== hash) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
    }
    return { ...receipt.response, idempotent: true };
}

async function saveReceipt(tx, { scope, key, hash, registrationId, response }) {
    if (!tx.idempotencyRecord?.create) return;
    await tx.idempotencyRecord.create({
        data: {
            scope,
            key,
            commandHash: hash,
            registrationId,
            response: jsonValue(response),
        },
    });
}

/**
 * Pure read-only lookup for a BM04Evaluation record.
 * STRICT INVARIANT: MUST NOT write or mutate DB on GET.
 * If no record exists yet, returns a read-only projection without DB write.
 */
async function getBM04Record(registrationId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const regId = Number(registrationId);
    const now = options.now ? new Date(options.now) : new Date();

    const record = await db.bM04Evaluation.findUnique({
        where: { registrationId: regId },
        include: {
            registration: {
                include: {
                    topic: { include: { mentor: { select: { id: true, fullName: true, department: true } } } },
                    student: { select: { id: true, fullName: true, code: true, studentProfile: { select: { className: true } } } },
                },
            },
            instituteDefenseReview: {
                include: {
                    reviewedBy: { select: { id: true, fullName: true } },
                    moreInfoRequestedBy: { select: { id: true, fullName: true } },
                },
            },
        },
    });

    if (record) {
        return record;
    }

    const registration = await db.topicRegistration.findUnique({
        where: { id: regId },
        include: {
            topic: { include: { mentor: { select: { id: true, fullName: true, department: true } } } },
            student: { select: { id: true, fullName: true, code: true, studentProfile: { select: { className: true } } } },
        },
    });

    if (!registration) {
        throw new BM04WorkflowError('Không tìm thấy hồ sơ đăng ký đề tài.', 'REGISTRATION_NOT_FOUND', 404);
    }

    let titleInfo;
    try {
        titleInfo = await resolveEffectiveTopicTitle(regId, now, options);
    } catch (e) {
        titleInfo = null;
    }

    const effectiveTitle = titleInfo?.title || registration.topic?.title || '';

    return {
        id: null,
        registrationId: regId,
        status: 'DRAFT',
        isLocked: false,
        effectiveTitleSnapshot: effectiveTitle,
        studentClassSnapshot: registration.student?.class || registration.student?.studentProfile?.className || null,
        thesisFormatScore: '',
        researchContentScore: '',
        applicabilityScore: '',
        attitudeScore: '',
        conclusion: 'AGREED_FOR_DEFENSE',
        programOutcome: null,
        defenseRecommendation: null,
        mismatchReason: null,
        generalNotes: null,
        lecturerSignature: null,
        signedAt: null,
        finalPdfFileUrl: null,
        instituteDefenseReview: null,
        registration,
    };
}

/**
 * Saves an unlocked draft of BM04 (status = 'DRAFT', isLocked = false).
 */
async function saveBM04Draft(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const {
        registrationId,
        advisorId,
        thesisFormatScore,
        researchContentScore,
        applicabilityScore,
        attitudeScore,
        programOutcome,
        defenseRecommendation,
        mismatchReason,
        generalNotes,
    } = input || {};

    const regId = Number(registrationId);
    const advId = Number(advisorId);
    const now = options.now ? new Date(options.now) : new Date();

    const execute = async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
            include: {
                topic: { include: { mentor: true } },
                student: true,
                bm04Evaluation: true,
            },
        });

        if (!registration) {
            throw new BM04WorkflowError('Không tìm thấy hồ sơ đăng ký đề tài.', 'REGISTRATION_NOT_FOUND', 404);
        }

        if (registration.topic?.mentorId !== advId) {
            throw new BM04WorkflowError('Chỉ giảng viên hướng dẫn của đề tài này mới có quyền lưu nháp phiếu BM04.', 'ONLY_CURRENT_MENTOR_ALLOWED', 403);
        }

        const existing = registration.bm04Evaluation || (await tx.bM04Evaluation.findUnique({ where: { registrationId: regId } }));
        if (existing?.isLocked) {
            throw new BM04WorkflowError('Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn, không thể cập nhật lại.', 'BM04_ALREADY_LOCKED', 400);
        }

        let titleInfo;
        try {
            titleInfo = await resolveEffectiveTopicTitle(regId, now, { ...options, tx });
        } catch (e) {
            titleInfo = null;
        }
        const effectiveTitle = titleInfo?.title || registration.topic?.title || '';
        const studentClass = registration.student?.class || registration.student?.studentProfile?.className || null;

        const conclusion = defenseRecommendation === 'NOT_APPROVE_FOR_DEFENSE' ? 'NOT_AGREED_FOR_DEFENSE' : 'AGREED_FOR_DEFENSE';

        const draft = await tx.bM04Evaluation.upsert({
            where: { registrationId: regId },
            create: {
                registrationId: regId,
                semesterId: registration.semesterId,
                studentId: registration.studentId,
                lecturerId: advId,
                thesisFormatScore: thesisFormatScore ? String(thesisFormatScore).trim() : '',
                researchContentScore: researchContentScore ? String(researchContentScore).trim() : '',
                applicabilityScore: applicabilityScore ? String(applicabilityScore).trim() : '',
                attitudeScore: attitudeScore ? String(attitudeScore).trim() : '',
                conclusion,
                programOutcome: programOutcome || null,
                defenseRecommendation: defenseRecommendation || null,
                mismatchReason: mismatchReason ? String(mismatchReason).trim() : null,
                generalNotes: generalNotes ? String(generalNotes).trim() : null,
                status: 'DRAFT',
                isLocked: false,
                effectiveTitleSnapshot: effectiveTitle,
                studentClassSnapshot: studentClass,
                lecturerSignature: '',
                policyVersionId: registration.periodPolicyVersionId,
            },
            update: {
                thesisFormatScore: thesisFormatScore !== undefined ? String(thesisFormatScore).trim() : undefined,
                researchContentScore: researchContentScore !== undefined ? String(researchContentScore).trim() : undefined,
                applicabilityScore: applicabilityScore !== undefined ? String(applicabilityScore).trim() : undefined,
                attitudeScore: attitudeScore !== undefined ? String(attitudeScore).trim() : undefined,
                conclusion,
                programOutcome: programOutcome !== undefined ? programOutcome : undefined,
                defenseRecommendation: defenseRecommendation !== undefined ? defenseRecommendation : undefined,
                mismatchReason: mismatchReason !== undefined ? (mismatchReason ? String(mismatchReason).trim() : null) : undefined,
                generalNotes: generalNotes !== undefined ? (generalNotes ? String(generalNotes).trim() : null) : undefined,
                status: 'DRAFT',
                isLocked: false,
                effectiveTitleSnapshot: effectiveTitle,
                studentClassSnapshot: studentClass,
            },
        });

        return draft;
    };

    if (options.tx) return execute(options.tx);
    return db.$transaction(execute);
}

/**
 * Signs and submits BM04 evaluation:
 * - Validates 4 criteria + 2 conclusions.
 * - Enforces conclusion compatibility and mismatch reason.
 * - Branches:
 *   Branch A (APPROVE_FOR_DEFENSE): SIGNED_APPROVED -> DEFENSE_READY -> Task(BM04) COMPLETED
 *   Branch B (NOT_APPROVE_FOR_DEFENSE): PENDING_INSTITUTE_REVIEW -> InstituteDefenseReview (168h SLA)
 */
async function signAndSubmitBM04(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const {
        registrationId,
        advisorId,
        thesisFormatScore,
        researchContentScore,
        applicabilityScore,
        attitudeScore,
        programOutcome,
        defenseRecommendation,
        mismatchReason,
        generalNotes,
        lecturerSignature,
        signatureImageId,
        ipAddress,
        userAgent,
    } = input || {};

    const regId = Number(registrationId);
    const advId = Number(advisorId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!thesisFormatScore || !researchContentScore || !applicabilityScore || !attitudeScore) {
        throw new BM04WorkflowError('Vui lòng điền đầy đủ nhận xét cho cả 4 tiêu chí đánh giá bắt buộc.', 'MISSING_CRITERIA_FEEDBACK', 400);
    }

    if (!programOutcome || !['MEETS_PROGRAM_OUTCOMES', 'DOES_NOT_MEET_PROGRAM_OUTCOMES'].includes(programOutcome)) {
        throw new BM04WorkflowError('Kết luận chuẩn đầu ra không hợp lệ.', 'INVALID_BM04_CONCLUSION', 400);
    }

    if (!defenseRecommendation || !['APPROVE_FOR_DEFENSE', 'NOT_APPROVE_FOR_DEFENSE'].includes(defenseRecommendation)) {
        throw new BM04WorkflowError('Đề nghị bảo vệ không hợp lệ.', 'INVALID_BM04_CONCLUSION', 400);
    }

    if (programOutcome === 'DOES_NOT_MEET_PROGRAM_OUTCOMES' && defenseRecommendation === 'APPROVE_FOR_DEFENSE') {
        throw new BM04WorkflowError('Không thể đề nghị cho bảo vệ khi không đạt chuẩn đầu ra.', 'INVALID_BM04_CONCLUSION_COMBINATION', 400);
    }

    if (programOutcome === 'MEETS_PROGRAM_OUTCOMES' && defenseRecommendation === 'NOT_APPROVE_FOR_DEFENSE') {
        if (!mismatchReason || !String(mismatchReason).trim()) {
            throw new BM04WorkflowError('Phải giải trình rõ lý do không cho bảo vệ khi sinh viên đã đạt chuẩn đầu ra.', 'MISMATCH_REASON_REQUIRED', 400);
        }
    }

    if (!lecturerSignature || !String(lecturerSignature).trim()) {
        throw new BM04WorkflowError('Chữ ký xác nhận của GVHD là bắt buộc.', 'LECTURER_SIGNATURE_REQUIRED', 400);
    }

    const isApprove = defenseRecommendation === 'APPROVE_FOR_DEFENSE';

    const execute = async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
            include: {
                topic: { include: { mentor: true } },
                student: true,
                archive: true,
                bm04Evaluation: true,
            },
        });

        if (!registration) {
            throw new BM04WorkflowError('Không tìm thấy hồ sơ đăng ký đề tài.', 'REGISTRATION_NOT_FOUND', 404);
        }

        if (registration.topic?.mentorId !== advId) {
            throw new BM04WorkflowError('Chỉ giảng viên hướng dẫn của đề tài này mới có quyền lập và ký phiếu BM04.', 'ONLY_CURRENT_MENTOR_ALLOWED', 403);
        }

        const existing = registration.bm04Evaluation || (await tx.bM04Evaluation.findUnique({ where: { registrationId: regId } }));
        if (existing?.isLocked) {
            throw new BM04WorkflowError('Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn, không thể cập nhật lại.', 'BM04_ALREADY_LOCKED', 400);
        }

        if (!['BM03_PASSED', 'BM04_REVIEW'].includes(registration.status)) {
            throw new BM04WorkflowError('Chỉ được lập BM04 khi hồ sơ đang ở trạng thái BM03_PASSED.', 'INVALID_TRANSITION', 409);
        }

        if (isApprove) {
            const archive = registration.archive;
            const hasValidPreDefenseArchive = Boolean(
                archive &&
                (archive.phase === 'PRE_DEFENSE' || (!archive.phase && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.status === 'SUBMITTED' || (!archive.status && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.reportFileUrl || archive.sourceCodeUrl || archive.slideFileUrl || archive.demoVideoUrl),
            );

            if (!hasValidPreDefenseArchive) {
                throw new BM04WorkflowError(
                    'Sinh viên chưa nộp tài liệu lưu chiểu sơ bộ trước bảo vệ (bản thảo báo cáo/slide/mã nguồn). Không thể ký duyệt BM04 cho phép bảo vệ.',
                    'PRE_DEFENSE_ARCHIVE_REQUIRED',
                    400,
                );
            }
        }

        let titleInfo;
        try {
            titleInfo = await resolveEffectiveTopicTitle(regId, now, { ...options, tx });
        } catch (e) {
            titleInfo = null;
        }
        const effectiveTitle = titleInfo?.title || registration.topic?.title || '';
        const studentClass = registration.student?.class || registration.student?.studentProfile?.className || null;

        const conclusion = isApprove ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE';
        const evalStatus = isApprove ? 'SIGNED_APPROVED' : 'PENDING_INSTITUTE_REVIEW';

        const payload = {
            registrationId: regId,
            effectiveTitleSnapshot: effectiveTitle,
            thesisFormatScore: String(thesisFormatScore).trim(),
            researchContentScore: String(researchContentScore).trim(),
            applicabilityScore: String(applicabilityScore).trim(),
            attitudeScore: String(attitudeScore).trim(),
            programOutcome,
            defenseRecommendation,
            mismatchReason: mismatchReason ? String(mismatchReason).trim() : null,
            generalNotes: generalNotes ? String(generalNotes).trim() : null,
            advisorId: advId,
        };
        const payloadHash = computeCanonicalPayloadHash(payload);

        // Pre-create or upsert BM04 evaluation
        const initialEvaluation = await tx.bM04Evaluation.upsert({
            where: { registrationId: regId },
            create: {
                registrationId: regId,
                semesterId: registration.semesterId,
                studentId: registration.studentId,
                lecturerId: advId,
                thesisFormatScore: String(thesisFormatScore).trim(),
                researchContentScore: String(researchContentScore).trim(),
                applicabilityScore: String(applicabilityScore).trim(),
                attitudeScore: String(attitudeScore).trim(),
                conclusion,
                programOutcome,
                defenseRecommendation,
                mismatchReason: mismatchReason ? String(mismatchReason).trim() : null,
                generalNotes: generalNotes ? String(generalNotes).trim() : null,
                lecturerSignature: String(lecturerSignature).trim(),
                status: evalStatus,
                isLocked: true,
                effectiveTitleSnapshot: effectiveTitle,
                studentClassSnapshot: studentClass,
                signedAt: now,
                policyVersionId: registration.periodPolicyVersionId,
            },
            update: {
                thesisFormatScore: String(thesisFormatScore).trim(),
                researchContentScore: String(researchContentScore).trim(),
                applicabilityScore: String(applicabilityScore).trim(),
                attitudeScore: String(attitudeScore).trim(),
                conclusion,
                programOutcome,
                defenseRecommendation,
                mismatchReason: mismatchReason ? String(mismatchReason).trim() : null,
                generalNotes: generalNotes ? String(generalNotes).trim() : null,
                lecturerSignature: String(lecturerSignature).trim(),
                status: evalStatus,
                isLocked: true,
                effectiveTitleSnapshot: effectiveTitle,
                studentClassSnapshot: studentClass,
                signedAt: now,
            },
        });

        // Record signature event
        const sigEvent = await recordSignatureEvent({
            registrationId: regId,
            entityType: 'BM04_EVALUATION',
            entityId: initialEvaluation.id,
            versionNumber: 1,
            signerId: advId,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            expectedPayloadHash: payloadHash,
            signatureImageId,
            ipAddress,
            userAgent,
        }, { ...options, tx });

        // Generate immutable academic PDF
        let finalPdfFileUrl = null;
        try {
            const sections = [
                {
                    heading: '1. THÔNG TIN CHUNG',
                    lines: [
                        `Tên đề tài: ${effectiveTitle}`,
                        `Sinh viên thực hiện: ${registration.student?.fullName || ''} (MSSV: ${registration.student?.code || ''})`,
                        `Lớp: ${studentClass || 'N/A'}`,
                        `Giảng viên hướng dẫn: ${registration.topic?.mentor?.fullName || ''}`,
                    ],
                },
                {
                    heading: '2. ĐÁNH GIÁ 4 TIÊU CHÍ BẮT BUỘC',
                    lines: [
                        `Hình thức & Trình bày: ${thesisFormatScore}`,
                        `Nội dung nghiên cứu: ${researchContentScore}`,
                        `Tính ứng dụng / thực tiễn: ${applicabilityScore}`,
                        `Thái độ & Tinh thần làm việc: ${attitudeScore}`,
                    ],
                },
                {
                    heading: '3. KẾT LUẬN & ĐỀ NGHỊ',
                    lines: [
                        `Chuẩn đầu ra: ${programOutcome === 'MEETS_PROGRAM_OUTCOMES' ? 'Đạt chuẩn đầu ra' : 'Không đạt chuẩn đầu ra'}`,
                        `Đề nghị bảo vệ: ${defenseRecommendation === 'APPROVE_FOR_DEFENSE' ? 'Đồng ý cho ra bảo vệ' : 'Không đồng ý cho ra bảo vệ'}`,
                        mismatchReason ? `Lý do giải trình: ${mismatchReason}` : '',
                        generalNotes ? `Nhận xét chung: ${generalNotes}` : '',
                    ].filter(Boolean),
                },
            ];

            const signatures = [
                {
                    roleLabel: 'Giảng viên hướng dẫn',
                    signerName: registration.topic?.mentor?.fullName || 'GVHD',
                    signedAt: now,
                    payloadHash,
                },
            ];

            const pdfResult = await generateImmutableAcademicPdf({
                docType: 'BM04',
                registrationId: regId,
                entityId: initialEvaluation.id,
                versionNumber: 1,
                title: 'PHIẾU NHẬN XÉT ĐỒ ÁN TỐT NGHIỆP CỦA GVHD (BM04)',
                sections,
                signatures,
            }, { ...options, tx });

            finalPdfFileUrl = pdfResult?.fileUrl || null;
        } catch (pdfErr) {
            console.error('[signAndSubmitBM04] PDF generation error:', pdfErr.message);
        }

        const updatedEvaluation = await tx.bM04Evaluation.update?.({
            where: { id: initialEvaluation.id },
            data: {
                status: evalStatus,
                conclusion,
                isLocked: true,
                payloadHash,
                signatureEventId: sigEvent?.id || null,
                finalPdfFileUrl,
            },
        });

        const evaluation = updatedEvaluation || {
            ...initialEvaluation,
            status: evalStatus,
            conclusion,
            isLocked: true,
            payloadHash,
            signatureEventId: sigEvent?.id || null,
            finalPdfFileUrl,
        };

        if (isApprove) {
            // Branch A: APPROVE_FOR_DEFENSE
            await tx.topicRegistration.updateMany({
                where: { id: regId },
                data: {
                    status: 'DEFENSE_READY',
                    stateVersion: { increment: 1 },
                },
            });

            if (tx.task?.updateMany) {
                await tx.task.updateMany({
                    where: { registrationId: regId, taskType: 'BM04' },
                    data: { status: 'COMPLETED' },
                });
            }
        } else {
            // Branch B: NOT_APPROVE_FOR_DEFENSE
            const reviewDeadlineAt = new Date(now.getTime() + 168 * 3600 * 1000);
            await tx.instituteDefenseReview.create({
                data: {
                    bm04EvaluationId: evaluation.id,
                    registrationId: regId,
                    status: 'PENDING_INSTITUTE_REVIEW',
                    submittedAt: now,
                    reviewDeadlineAt,
                    extensionCount: 0,
                },
            });

            await tx.topicRegistration.updateMany({
                where: { id: regId },
                data: {
                    status: 'BM04_REVIEW',
                    stateVersion: { increment: 1 },
                },
            });
        }

        return evaluation;
    };

    if (options.tx) return execute(options.tx);
    return db.$transaction(execute);
}

/**
 * Institute requests more info on a defense review (+72h SLA extension, max 1 time).
 */
async function requestMoreInfoForDefenseReview(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { reviewId, reviewerId, note } = input || {};
    const revId = Number(reviewId);
    const userId = Number(reviewerId);
    const now = options.now ? new Date(options.now) : new Date();

    const execute = async (tx) => {
        const review = await tx.instituteDefenseReview.findUnique({
            where: { id: revId },
        });

        if (!review) {
            throw new BM04WorkflowError('Đề nghị thẩm định bảo vệ không tồn tại.', 'DEFENSE_REVIEW_NOT_FOUND', 404);
        }

        if (review.extensionCount > 0) {
            throw new BM04WorkflowError('Chỉ được yêu cầu bổ sung thông tin và gia hạn duy nhất 1 lần.', 'EXTENSION_QUOTA_EXHAUSTED', 409);
        }

        if (review.status !== 'PENDING_INSTITUTE_REVIEW') {
            throw new BM04WorkflowError('Đề nghị thẩm định bảo vệ không ở trạng thái chờ thẩm định.', 'INVALID_DEFENSE_REVIEW_STATUS', 409);
        }

        if (now.getTime() > review.reviewDeadlineAt.getTime()) {
            throw new BM04WorkflowError('Đã quá thời hạn thẩm định của Viện.', 'DEFENSE_REVIEW_DEADLINE_EXPIRED', 409);
        }

        if (validateAcademicScope) {
            await validateAcademicScope(tx, {
                actorId: userId,
                registrationId: review.registrationId,
                capabilityCode: 'BM04_REJECTION_REVIEW',
                now,
            });
        }

        const newDeadline = new Date(review.reviewDeadlineAt.getTime() + 72 * 3600 * 1000);

        const updateRes = await tx.instituteDefenseReview.updateMany({
            where: {
                id: revId,
                extensionCount: 0,
                status: 'PENDING_INSTITUTE_REVIEW',
            },
            data: {
                extensionCount: 1,
                extendedAt: now,
                reviewDeadlineAt: newDeadline,
                moreInfoRequestedById: userId,
                moreInfoRequestNote: note ? String(note).trim() : null,
                decision: 'REQUEST_MORE_INFO',
            },
        });

        if (updateRes.count === 0) {
            throw new BM04WorkflowError('Yêu cầu bổ sung thông tin không thể thực hiện.', 'EXTENSION_QUOTA_EXHAUSTED', 409);
        }

        return await tx.instituteDefenseReview.findUnique({ where: { id: revId } });
    };

    if (options.tx) return execute(options.tx);
    return db.$transaction(execute);
}

/**
 * Institute decides defense review:
 * - APPROVE_NOT_ELIGIBLE: marks NOT_ELIGIBLE_FOR_DEFENSE
 * - OVERRIDE_ELIGIBLE: marks DEFENSE_READY & ELIGIBLE_BY_INSTITUTE (without altering advisor's signed BM04)
 */
async function decideDefenseReview(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { reviewId, reviewerId, decision, reason, idempotencyKey } = input || {};
    const revId = Number(reviewId);
    const userId = Number(reviewerId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!['APPROVE_NOT_ELIGIBLE', 'OVERRIDE_ELIGIBLE'].includes(decision)) {
        throw new BM04WorkflowError('Quyết định thẩm định phải là APPROVE_NOT_ELIGIBLE hoặc OVERRIDE_ELIGIBLE.', 'INVALID_DECISION', 400);
    }

    const execute = async (tx) => {
        const review = await tx.instituteDefenseReview.findUnique({
            where: { id: revId },
        });

        if (!review) {
            throw new BM04WorkflowError('Đề nghị thẩm định bảo vệ không tồn tại.', 'DEFENSE_REVIEW_NOT_FOUND', 404);
        }

        if (review.status !== 'PENDING_INSTITUTE_REVIEW') {
            throw new BM04WorkflowError('Đề nghị thẩm định bảo vệ đã có quyết định hoặc không ở trạng thái thẩm định.', 'INVALID_DEFENSE_REVIEW_STATUS', 409);
        }

        if (validateAcademicScope) {
            await validateAcademicScope(tx, {
                actorId: userId,
                registrationId: review.registrationId,
                capabilityCode: 'BM04_REJECTION_REVIEW',
                now,
            });
        }

        const targetStatus = decision === 'APPROVE_NOT_ELIGIBLE' ? 'NOT_ELIGIBLE_FOR_DEFENSE' : 'ELIGIBLE_BY_INSTITUTE';

        const updateRes = await tx.instituteDefenseReview.updateMany({
            where: {
                id: revId,
                status: 'PENDING_INSTITUTE_REVIEW',
            },
            data: {
                status: targetStatus,
                decision,
                decisionSource: 'INSTITUTE_REVIEWER',
                reviewedById: userId,
                reviewedAt: now,
                reviewReason: reason ? String(reason).trim() : null,
                idempotencyKey: idempotencyKey || null,
            },
        });

        if (updateRes.count === 0) {
            throw new BM04WorkflowError('Đề xuất thẩm định bảo vệ đã được xử lý bởi phiên làm việc khác.', 'CONCURRENT_UPDATE_CONFLICT', 409);
        }

        // Update BM04 evaluation status without modifying scores or conclusion
        await tx.bM04Evaluation.update({
            where: { id: review.bm04EvaluationId },
            data: { status: targetStatus },
        });

        // Update registration
        if (decision === 'APPROVE_NOT_ELIGIBLE') {
            await tx.topicRegistration.update({
                where: { id: review.registrationId },
                data: { status: 'NOT_ELIGIBLE_FOR_DEFENSE' },
            });
        } else {
            // OVERRIDE_ELIGIBLE: marks DEFENSE_READY + completes Task(BM04)
            await tx.topicRegistration.update({
                where: { id: review.registrationId },
                data: { status: 'DEFENSE_READY' },
            });

            if (tx.task?.updateMany) {
                await tx.task.updateMany({
                    where: { registrationId: review.registrationId, taskType: 'BM04' },
                    data: { status: 'COMPLETED' },
                });
            }
        }

        return await tx.instituteDefenseReview.findUnique({ where: { id: revId } });
    };

    if (options.tx) return execute(options.tx);
    return db.$transaction(execute);
}

/**
 * Backward-compatible submitBM04 for existing tests and endpoints.
 */
async function submitBM04(firstArg, secondArg, thirdArg, fourthArg) {
    let input;
    let options;

    if (typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg)) {
        input = { ...firstArg };
        options = secondArg || {};
    } else {
        const registrationId = parseInt(firstArg, 10);
        const mentorId = parseInt(secondArg, 10);
        const payload = thirdArg || {};
        options = fourthArg || {};
        input = {
            registrationId,
            actorId: mentorId,
            ...payload,
        };
    }

    const db = options.db || prisma;
    const now = options.now || new Date();

    const rawKey = input.idempotencyKey || options.idempotencyKey || `bm04-${input.registrationId}-${input.actorId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const key = requireCommandKey('bm04-submit', rawKey);

    const commandHash = fingerprint({
        registrationId: input.registrationId,
        thesisFormatScore: input.thesisFormatScore,
        researchContentScore: input.researchContentScore,
        applicabilityScore: input.applicabilityScore,
        attitudeScore: input.attitudeScore,
        conclusion: input.conclusion,
        generalNotes: input.generalNotes || null,
        lecturerSignature: input.lecturerSignature,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, BM04_SUBMIT_SCOPE, key, commandHash);
        if (retry) return retry;

        const registration = await tx.topicRegistration.findUnique({
            where: { id: input.registrationId },
            include: {
                topic: true,
                student: true,
                bm04Evaluation: true,
                archive: true,
                periodPolicyVersion: true,
            },
        });
        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký đề tài.');
        }

        if (registration.topic?.mentorId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_CURRENT_MENTOR_ALLOWED', 403, 'Chỉ giảng viên hướng dẫn của đề tài này mới có quyền lập và ký phiếu BM04.');
        }

        if (registration.bm04Evaluation && registration.bm04Evaluation.isLocked) {
            throw new WorkflowTransitionError('BM04_ALREADY_LOCKED', 400, 'Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn, không thể cập nhật lại.');
        }

        if (registration.status !== 'BM03_PASSED') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409, 'Chỉ được lập BM04 khi hồ sơ đang ở trạng thái BM03_PASSED.');
        }

        if (!['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE', 'NOT_AGREED'].includes(input.conclusion)) {
            throw new WorkflowTransitionError('INVALID_BM04_CONCLUSION', 400, 'Kết luận BM04 bắt buộc phải là AGREED_FOR_DEFENSE hoặc NOT_AGREED_FOR_DEFENSE.');
        }

        if (!input.thesisFormatScore || !input.researchContentScore || !input.applicabilityScore || !input.attitudeScore) {
            throw new WorkflowTransitionError('MISSING_CRITERIA_FEEDBACK', 400, 'Vui lòng điền đầy đủ nhận xét cho cả 4 tiêu chí đánh giá bắt buộc.');
        }

        if (!input.lecturerSignature || !String(input.lecturerSignature).trim()) {
            throw new WorkflowTransitionError('LECTURER_SIGNATURE_REQUIRED', 400, 'Chữ ký xác nhận của GVHD là bắt buộc.');
        }

        const isAgreed = input.conclusion === 'AGREED_FOR_DEFENSE';

        if (isAgreed) {
            const archive = registration.archive;
            const hasValidPreDefenseArchive = Boolean(
                archive &&
                (archive.phase === 'PRE_DEFENSE' || (!archive.phase && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.status === 'SUBMITTED' || (!archive.status && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.reportFileUrl || archive.sourceCodeUrl || archive.slideFileUrl || archive.demoVideoUrl),
            );

            if (!hasValidPreDefenseArchive) {
                throw new WorkflowTransitionError(
                    'PRE_DEFENSE_ARCHIVE_REQUIRED',
                    400,
                    'Sinh viên chưa nộp tài liệu lưu chiểu sơ bộ trước bảo vệ (bản thảo báo cáo/slide/mã nguồn). Không thể ký duyệt BM04 cho phép bảo vệ.',
                );
            }
        }

        const targetStatus = isAgreed ? 'DEFENSE_READY' : 'TERMINATED_BM04';

        const evaluation = await tx.bM04Evaluation.upsert({
            where: { registrationId: registration.id },
            create: {
                registrationId: registration.id,
                semesterId: registration.semesterId,
                studentId: registration.studentId,
                lecturerId: input.actorId,
                thesisFormatScore: String(input.thesisFormatScore).trim(),
                researchContentScore: String(input.researchContentScore).trim(),
                applicabilityScore: String(input.applicabilityScore).trim(),
                attitudeScore: String(input.attitudeScore).trim(),
                conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                generalNotes: input.generalNotes ? String(input.generalNotes).trim() : null,
                lecturerSignature: String(input.lecturerSignature).trim(),
                signedAt: now,
                isLocked: true,
                policyVersionId: registration.periodPolicyVersionId,
            },
            update: {
                thesisFormatScore: String(input.thesisFormatScore).trim(),
                researchContentScore: String(input.researchContentScore).trim(),
                applicabilityScore: String(input.applicabilityScore).trim(),
                attitudeScore: String(input.attitudeScore).trim(),
                conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                generalNotes: input.generalNotes ? String(input.generalNotes).trim() : null,
                lecturerSignature: String(input.lecturerSignature).trim(),
                signedAt: now,
                isLocked: true,
                policyVersionId: registration.periodPolicyVersionId,
            },
        });

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion ?? 0,
            targetStatus,
            actorId: input.actorId,
            reason: isAgreed
                ? 'GVHD ký khóa BM04 ĐỒNG Ý cho ra bảo vệ'
                : 'GVHD ký khóa BM04 KHÔNG ĐỒNG Ý cho ra bảo vệ (dừng đồ án)',
            idempotencyKey: `${key}:transition`,
        }, { tx });

        if (tx.task?.updateMany) {
            await tx.task.updateMany({
                where: { registrationId: registration.id, taskType: 'BM04' },
                data: { status: 'COMPLETED' },
            });
        }

        if (tx.auditLog?.create) {
            await tx.auditLog.create({
                data: {
                    userId: input.actorId,
                    action: 'SUBMIT_BM04_EVALUATION',
                    entityType: 'BM04Evaluation',
                    entityId: String(evaluation.id),
                    details: { registrationId: registration.id, conclusion: evaluation.conclusion, isLocked: true },
                },
            });
        }

        const response = {
            ...evaluation,
            id: evaluation.id,
            evaluationId: evaluation.id,
            registrationId: registration.id,
            conclusion: evaluation.conclusion,
            isLocked: evaluation.isLocked,
            signedAt: evaluation.signedAt,
            targetStatus,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: BM04_SUBMIT_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

/**
 * List institute defense reviews.
 */
async function listDefenseReviews(query = {}) {
    const where = {};
    if (query.status && query.status !== 'ALL') {
        where.status = query.status;
    }
    return prisma.instituteDefenseReview.findMany({
        where,
        include: {
            registration: {
                include: {
                    student: true,
                    topic: {
                        include: {
                            mentor: true,
                        },
                    },
                },
            },
            bm04Evaluation: true,
            moreInfoRequestedBy: true,
            reviewedBy: true,
        },
        orderBy: { submittedAt: 'desc' },
    });
}

module.exports = {
    BM04_SUBMIT_SCOPE,
    BM04WorkflowError,
    getBM04Record,
    saveBM04Draft,
    signAndSubmitBM04,
    requestMoreInfoForDefenseReview,
    decideDefenseReview,
    submitBM04,
    listDefenseReviews,
};
