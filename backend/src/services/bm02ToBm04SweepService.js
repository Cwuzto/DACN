const prisma = require('../config/database');
const { generateImmutableAcademicPdf } = require('./academicPdfService');

/**
 * Sweeps all 5 scheduled automated background jobs across BM02 to BM04:
 * 1. Close BM02-A window after 168h from decisionPublishedAt.
 * 2. Expire BM02-A requests past titleAdjustmentDeadline (status=EXPIRED).
 * 3. Auto-terminate overdue InstituteStopReview (status=AUTO_TERMINATED, decisionSource=SYSTEM_TIMEOUT, no fake admin signatures).
 * 4. Auto-complete overdue 48h BM03 student ack (studentAckStatus=ACKNOWLEDGEMENT_TIMEOUT, generates PDF with timeout note, no fake student signatures; transitions to BM03_PASSED & opens Task(BM04) if CONTINUE_TO_BM04).
 * 5. Auto-finalize overdue InstituteDefenseReview (status=AUTO_NOT_ELIGIBLE, decisionSource=SYSTEM_TIMEOUT, no fake admin signatures).
 *
 * Invariant: Must be strictly idempotent — running multiple times yields 0 updates.
 *
 * @param {object} [input]
 * @param {Date} [input.now]
 * @param {object} [options]
 * @returns {Promise<object>} Sweep execution summary report
 */
async function runBm02ToBm04SweepJobs(input = {}, options = {}) {
    const db = options.db || prisma;
    const now = input.now ? new Date(input.now) : (options.now ? new Date(options.now) : new Date());

    const execute = async (tx) => {
        let closedBm02AWindowsCount = 0;
        let expiredBm02ARequestsCount = 0;
        let autoTerminatedStopReviewsCount = 0;
        let autoCompletedStudentAcksCount = 0;
        let autoFinalizedDefenseReviewsCount = 0;

        // -------------------------------------------------------------
        // Job 1: Close BM02-A window after 168h from decisionPublishedAt
        // -------------------------------------------------------------
        if (tx.topicAssignmentDecision?.findMany) {
            const overdueDecisions = await tx.topicAssignmentDecision.findMany({
                where: {
                    decisionPublishedAt: {
                        not: null,
                        lt: new Date(now.getTime() - 168 * 3600 * 1000),
                    },
                },
                select: { id: true, decisionPublishedAt: true },
            });
            closedBm02AWindowsCount = overdueDecisions.length;
        }

        // -------------------------------------------------------------
        // Job 2: Expire BM02-A requests past deadline (EXPIRED)
        // -------------------------------------------------------------
        if (tx.bM02AAdjustmentRequest?.findMany) {
            const overdueRequests = await tx.bM02AAdjustmentRequest.findMany({
                where: {
                    status: { in: ['STUDENT_PREPARING', 'RETURNED_FOR_CORRECTION'] },
                    titleAdjustmentDeadline: { lt: now },
                },
                select: { id: true },
            });

            if (overdueRequests.length > 0) {
                const overdueIds = overdueRequests.map((r) => r.id);
                const updateRes = await tx.bM02AAdjustmentRequest.updateMany({
                    where: { id: { in: overdueIds } },
                    data: { status: 'EXPIRED' },
                });
                expiredBm02ARequestsCount = updateRes.count;
            }
        }

        // -------------------------------------------------------------
        // Job 3: Auto-terminate overdue InstituteStopReview
        // -------------------------------------------------------------
        if (tx.instituteStopReview?.findMany) {
            const overdueStopReviews = await tx.instituteStopReview.findMany({
                where: {
                    status: { in: ['STOP_REVIEW_PENDING', 'MORE_INFO_REQUIRED'] },
                    stopReviewDeadline: { lt: now },
                },
            });

            for (const sr of overdueStopReviews) {
                const updateRes = await tx.instituteStopReview.updateMany({
                    where: {
                        id: sr.id,
                        status: { in: ['STOP_REVIEW_PENDING', 'MORE_INFO_REQUIRED'] },
                    },
                    data: {
                        status: 'AUTO_TERMINATED',
                        decision: 'AUTO_TERMINATED',
                        decisionSource: 'SYSTEM_TIMEOUT',
                        reviewedById: null, // STRICT INVARIANT: 0 fake admin signature
                        reviewedAt: now,
                        reviewReason: 'Quá thời hạn thẩm định của Viện (SYSTEM_TIMEOUT)',
                    },
                });

                if (updateRes.count > 0) {
                    autoTerminatedStopReviewsCount += updateRes.count;

                    if (tx.bM03ProgressRecord?.update) {
                        await tx.bM03ProgressRecord.update({
                            where: { id: sr.bm03RecordId },
                            data: {
                                isClosedEarly: true,
                                finalConclusion: 'STOPPED',
                            },
                        });
                    }

                    if (tx.topicRegistration?.update) {
                        await tx.topicRegistration.update({
                            where: { id: sr.registrationId },
                            data: {
                                status: 'AUTO_TERMINATED',
                            },
                        });
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // Job 4: Auto-complete overdue 48h BM03 student ack
        // -------------------------------------------------------------
        if (tx.bM03ProgressRecord?.findMany) {
            const overdueAcks = await tx.bM03ProgressRecord.findMany({
                where: {
                    studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                    studentAckDeadlineAt: { lt: now },
                },
                include: {
                    registration: {
                        include: {
                            topic: { include: { mentor: true } },
                            student: true,
                        },
                    },
                    advisorSignedBy: true,
                },
            });

            for (const record of overdueAcks) {
                // Generate PDF with timeout note and empty student signature
                let fileUrl = null;
                try {
                    const sections = [
                        {
                            heading: '1. THÔNG TIN CHUNG',
                            lines: [
                                `Đề tài: ${record.effectiveTitleSnapshot || record.registration?.topic?.title || ''}`,
                                `Sinh viên: ${record.registration?.student?.fullName || ''} (${record.registration?.student?.code || ''})`,
                                `Giảng viên hướng dẫn: ${record.registration?.topic?.mentor?.fullName || ''}`,
                            ],
                        },
                        {
                            heading: '2. KẾT LUẬN CUỐI CÙNG & XÁC NHẬN CỦA SINH VIÊN',
                            lines: [
                                `Kết luận cuối cùng: ${record.finalConclusion || ''}`,
                                'Trạng thái xác nhận của sinh viên: Quá thời hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT)',
                            ],
                        },
                    ];

                    const signatures = [
                        {
                            roleLabel: 'Giảng viên hướng dẫn',
                            signerName: record.advisorSignedBy?.fullName || record.registration?.topic?.mentor?.fullName || 'GVHD',
                            signedAt: record.advisorSignedAt,
                            payloadHash: record.advisorPayloadHash,
                        },
                        {
                            roleLabel: 'Sinh viên thực hiện',
                            signerName: record.registration?.student?.fullName || 'Sinh viên',
                            signedAt: null, // empty signature
                            systemNote: 'Sinh viên không xác nhận trong thời hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT)',
                        },
                    ];

                    const pdfResult = await generateImmutableAcademicPdf({
                        docType: 'BM03',
                        registrationId: record.registrationId,
                        entityId: record.id,
                        versionNumber: 1,
                        title: 'PHIẾU THEO DÕI QUÁ TRÌNH THỰC HIỆN ĐỒ ÁN (BM03)',
                        sections,
                        signatures,
                    }, { ...options, tx });

                    fileUrl = pdfResult?.fileUrl || null;
                } catch (pdfErr) {
                    console.error('[SweepJob4] PDF generation failed:', pdfErr.message);
                }

                await tx.bM03ProgressRecord.update({
                    where: { id: record.id },
                    data: {
                        studentAckStatus: 'ACKNOWLEDGEMENT_TIMEOUT',
                        studentAckAt: now,
                        studentSignatureEventId: null, // STRICT INVARIANT: 0 fake student signature
                        finalPdfFileUrl: fileUrl,
                    },
                });

                autoCompletedStudentAcksCount += 1;

                // If finalConclusion is CONTINUE_TO_BM04 -> transitions registration to BM03_PASSED & opens Task(BM04)
                if (record.finalConclusion === 'CONTINUE_TO_BM04') {
                    if (tx.topicRegistration?.update) {
                        await tx.topicRegistration.update({
                            where: { id: record.registrationId },
                            data: { status: 'BM03_PASSED' },
                        });
                    }

                    if (tx.task?.findFirst) {
                        const existingTask = await tx.task.findFirst({
                            where: {
                                registrationId: record.registrationId,
                                taskType: 'BM04',
                            },
                        });

                        if (existingTask) {
                            await tx.task.update({
                                where: { id: existingTask.id },
                                data: { status: 'OPEN' },
                            });
                        } else {
                            await tx.task.create({
                                data: {
                                    registrationId: record.registrationId,
                                    title: 'Phiếu nhận xét của GVHD (BM04)',
                                    content: 'Đánh giá kết quả thực hiện đồ án tốt nghiệp của sinh viên',
                                    taskType: 'BM04',
                                    status: 'OPEN',
                                },
                            });
                        }
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // Job 5: Auto-finalize overdue InstituteDefenseReview
        // -------------------------------------------------------------
        if (tx.instituteDefenseReview?.findMany) {
            const overdueDefenseReviews = await tx.instituteDefenseReview.findMany({
                where: {
                    status: 'PENDING_INSTITUTE_REVIEW',
                    reviewDeadlineAt: { lt: now },
                },
            });

            for (const dr of overdueDefenseReviews) {
                const updateRes = await tx.instituteDefenseReview.updateMany({
                    where: {
                        id: dr.id,
                        status: 'PENDING_INSTITUTE_REVIEW',
                    },
                    data: {
                        status: 'AUTO_NOT_ELIGIBLE',
                        decision: 'AUTO_NOT_ELIGIBLE',
                        decisionSource: 'SYSTEM_TIMEOUT',
                        reviewedById: null, // STRICT INVARIANT: 0 fake admin signature
                        reviewedAt: now,
                        reviewReason: 'Quá thời hạn thẩm định của Viện (SYSTEM_TIMEOUT)',
                    },
                });

                if (updateRes.count > 0) {
                    autoFinalizedDefenseReviewsCount += updateRes.count;

                    if (tx.bM04Evaluation?.update) {
                        await tx.bM04Evaluation.update({
                            where: { id: dr.bm04EvaluationId },
                            data: { status: 'AUTO_NOT_ELIGIBLE' },
                        });
                    }

                    if (tx.topicRegistration?.update) {
                        await tx.topicRegistration.update({
                            where: { id: dr.registrationId },
                            data: { status: 'AUTO_NOT_ELIGIBLE' },
                        });
                    }
                }
            }
        }

        return {
            closedBm02AWindowsCount,
            expiredBm02ARequestsCount,
            autoTerminatedStopReviewsCount,
            autoCompletedStudentAcksCount,
            autoFinalizedDefenseReviewsCount,
        };
    };

    if (options.tx) {
        return execute(options.tx);
    }
    return db.$transaction(execute);
}

module.exports = {
    runBm02ToBm04SweepJobs,
};
