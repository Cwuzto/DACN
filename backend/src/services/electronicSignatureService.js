const crypto = require('crypto');
const prisma = require('../config/database');

/**
 * Recursively canonicalize value so JSON stringify has key-sorted objects.
 */
function canonicalize(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const result = {};
    for (const key of sortedKeys) {
      if (value[key] !== undefined) {
        result[key] = canonicalize(value[key]);
      }
    }
    return result;
  }
  return value;
}

/**
 * Computes canonical SHA-256 payload hash of an arbitrary object.
 * @param {object} payload
 * @returns {string} SHA-256 hex digest
 */
function computeCanonicalPayloadHash(payload) {
  const canonicalObj = canonicalize(payload);
  const serialized = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Records an electronic signature event into the database.
 * Verifies that the actual payload matches expectedPayloadHash if provided.
 */
async function recordSignatureEvent(input, options = {}) {
  const db = options.tx || options.prisma || prisma;
  const {
    registrationId,
    entityType,
    entityId,
    versionNumber = 1,
    signerId,
    signerRole,
    action,
    expectedPayloadHash,
    actualPayload,
    signatureImageId = null,
    ipAddress = null,
    userAgent = null,
    rejectionOrReturnReason = null,
  } = input || {};

  if (!registrationId) throw new Error('MISSING_REGISTRATION_ID');
  if (!entityType) throw new Error('MISSING_ENTITY_TYPE');
  if (!entityId) throw new Error('MISSING_ENTITY_ID');
  if (!signerId) throw new Error('MISSING_SIGNER_ID');
  if (!signerRole) throw new Error('MISSING_SIGNER_ROLE');
  if (!action) throw new Error('MISSING_ACTION');

  let computedHash = null;
  if (actualPayload !== undefined && actualPayload !== null) {
    computedHash = computeCanonicalPayloadHash(actualPayload);
    if (expectedPayloadHash && computedHash !== expectedPayloadHash) {
      const err = new Error('PAYLOAD_HASH_MISMATCH: Payload data has been modified since signature was prepared');
      err.code = 'PAYLOAD_HASH_MISMATCH';
      err.status = 409;
      throw err;
    }
  } else if (expectedPayloadHash) {
    computedHash = expectedPayloadHash;
  } else {
    throw new Error('MISSING_PAYLOAD_OR_HASH');
  }

  const created = await db.electronicSignatureEvent.create({
    data: {
      registrationId: Number(registrationId),
      entityType: String(entityType),
      entityId: Number(entityId),
      versionNumber: Number(versionNumber || 1),
      signerId: Number(signerId),
      signerRole: String(signerRole),
      action: String(action),
      signedAt: new Date(),
      signatureImageId: signatureImageId ? String(signatureImageId) : null,
      payloadHash: computedHash,
      ipAddress: ipAddress ? String(ipAddress) : null,
      userAgent: userAgent ? String(userAgent) : null,
      rejectionOrReturnReason: rejectionOrReturnReason ? String(rejectionOrReturnReason) : null,
    },
  });

  return created;
}

module.exports = {
  canonicalize,
  computeCanonicalPayloadHash,
  recordSignatureEvent,
};
