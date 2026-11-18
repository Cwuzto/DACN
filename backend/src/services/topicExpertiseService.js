/**
 * Service quản lý và tra cứu chuyên môn đề tài
 */
const prisma = require('../config/database');

async function getAcceptedExpertise(topicId, { db = prisma } = {}) {
  if (!topicId) return null;

  try {
    const assessment = await db.topicExpertiseAssessment.findUnique({
      where: { topicId: Number(topicId) },
    });

    if (assessment && ['AUTO_ACCEPTED', 'APPROVED'].includes(assessment.status)) {
      if (Array.isArray(assessment.acceptedAreas) && assessment.acceptedAreas.length > 0) {
        return assessment.acceptedAreas;
      }
    }

    return null;
  } catch (error) {
    console.error('Error in getAcceptedExpertise:', error);
    return null;
  }
}

module.exports = {
  getAcceptedExpertise,
};
