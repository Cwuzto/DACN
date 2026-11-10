const prisma = require('../config/database');

/**
 * Resolves the effective topic title for a topic registration at a given point in time.
 * Invariant priority:
 * 1. Latest TitleAdjustmentAppendixItem from an ISSUED appendix where signedDate <= atTime.
 * 2. TopicAssignmentDecisionItem from a PUBLISHED decision where decisionPublishedAt/decisionDate <= atTime.
 * 3. BM02Submission approved title if registration is in BM02_APPROVED state (pre-decision).
 * 4. Initial title (bm01ApprovedTitleSnapshot or topic.title).
 *
 * Strict invariant: Never use pending BM02-A titles or draft titles as the official title.
 *
 * @param {number} registrationId
 * @param {Date} [atTime=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<{ title: string, source: 'APPENDIX' | 'DECISION' | 'BM02_APPROVED' | 'TOPIC_INITIAL', effectiveDate: Date | null, referenceNumber: string | null }>}
 */
async function resolveEffectiveTopicTitle(registrationId, atTime = new Date(), options = {}) {
  const db = options.tx || options.prisma || prisma;
  const targetTime = atTime ? new Date(atTime) : new Date();
  const regId = Number(registrationId);

  // 1. Check TitleAdjustmentAppendixItem
  const appendixItem = await db.titleAdjustmentAppendixItem.findFirst({
    where: {
      registrationId: regId,
      appendix: {
        status: 'ISSUED',
        signedDate: { lte: targetTime },
      },
    },
    include: {
      appendix: {
        select: {
          id: true,
          appendixNumber: true,
          sequenceNo: true,
          signedDate: true,
          status: true,
        },
      },
    },
    orderBy: [
      { appendix: { signedDate: 'desc' } },
      { appendix: { sequenceNo: 'desc' } },
      { id: 'desc' },
    ],
  });

  if (appendixItem && appendixItem.newTitle) {
    return {
      title: appendixItem.newTitle,
      source: 'APPENDIX',
      effectiveDate: appendixItem.appendix.signedDate,
      referenceNumber: appendixItem.appendix.appendixNumber,
    };
  }

  // 2. Check TopicAssignmentDecisionItem (New decision model)
  const decisionItem = await db.topicAssignmentDecisionItem.findFirst({
    where: {
      registrationId: regId,
      decision: {
        status: 'PUBLISHED',
        OR: [
          { decisionPublishedAt: { lte: targetTime } },
          { decisionPublishedAt: null, decisionDate: { lte: targetTime } },
        ],
      },
    },
    include: {
      decision: {
        select: {
          id: true,
          decisionNumber: true,
          decisionDate: true,
          decisionPublishedAt: true,
          status: true,
        },
      },
    },
    orderBy: [
      { decision: { decisionDate: 'desc' } },
      { id: 'desc' },
    ],
  });

  if (decisionItem && decisionItem.approvedTitleSnapshot) {
    return {
      title: decisionItem.approvedTitleSnapshot,
      source: 'DECISION',
      effectiveDate: decisionItem.decision.decisionPublishedAt || decisionItem.decision.decisionDate,
      referenceNumber: decisionItem.decision.decisionNumber,
    };
  }

  // Fetch registration for legacy decision fallback and pre-decision stages
  const registration = await db.topicRegistration.findUnique({
    where: { id: regId },
    include: {
      topic: { select: { title: true } },
      currentBM02Submission: {
        select: {
          id: true,
          outcome: true,
          bm02ProposedTitle: true,
          bm01ApprovedTitle: true,
          reviewedAt: true,
        },
      },
      assignmentDecisions: {
        where: { issuedAt: { lte: targetTime } },
        orderBy: { issuedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!registration) {
    throw new Error(`REGISTRATION_NOT_FOUND: Topic registration with id ${registrationId} not found`);
  }

  // Legacy AssignmentDecision check
  if (registration.assignmentDecisions && registration.assignmentDecisions.length > 0) {
    const legacyDecision = registration.assignmentDecisions[0];
    return {
      title: registration.adjustedTitle || registration.bm01ApprovedTitleSnapshot || registration.topic?.title || 'Chưa xác định',
      source: 'DECISION',
      effectiveDate: legacyDecision.issuedAt || registration.decisionDate,
      referenceNumber: legacyDecision.decisionNumber || registration.decisionNumber,
    };
  }

  // Direct decision field on TopicRegistration
  if (registration.decisionNumber && registration.decisionDate && new Date(registration.decisionDate) <= targetTime) {
    return {
      title: registration.adjustedTitle || registration.bm01ApprovedTitleSnapshot || registration.topic?.title || 'Chưa xác định',
      source: 'DECISION',
      effectiveDate: registration.decisionPublishedAt || registration.decisionDate,
      referenceNumber: registration.decisionNumber,
    };
  }

  // 3. BM02 Approved stage (Before formal decision publication)
  const isBm02Approved =
    registration.status === 'BM02_APPROVED' ||
    registration.currentBM02Submission?.outcome === 'APPROVED';

  if (isBm02Approved && registration.currentBM02Submission) {
    const approvedBM02Title =
      registration.currentBM02Submission.bm02ProposedTitle ||
      registration.currentBM02Submission.bm01ApprovedTitle ||
      registration.topic?.title ||
      'Chưa xác định';

    return {
      title: approvedBM02Title,
      source: 'BM02_APPROVED',
      effectiveDate: registration.currentBM02Submission.reviewedAt || null,
      referenceNumber: null,
    };
  }

  // 4. Initial Topic / BM01 Passed state
  const initialTitle =
    registration.bm01ApprovedTitleSnapshot ||
    registration.topic?.title ||
    'Chưa xác định';

  return {
    title: initialTitle,
    source: 'TOPIC_INITIAL',
    effectiveDate: registration.effectiveAt || registration.createdAt || null,
    referenceNumber: null,
  };
}

module.exports = {
  resolveEffectiveTopicTitle,
};
