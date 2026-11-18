/**
 * Service chuẩn hóa và kiểm tra chuyên môn giảng viên
 */

function normalizeExpertiseAreas(input) {
  if (!input) return [];
  let rawList = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === 'string') {
    rawList = input.split(';');
  } else {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const lowerKey = trimmed.toLowerCase();
    if (!seen.has(lowerKey)) {
      seen.add(lowerKey);
      normalized.push(trimmed);
    }
  }

  return normalized;
}

function assertLecturerExpertise(areas) {
  const normalized = normalizeExpertiseAreas(areas);
  if (normalized.length === 0) {
    const error = new Error('Chuyên môn giảng viên không được để trống');
    error.status = 400;
    error.code = 'LECTURER_EXPERTISE_REQUIRED';
    throw error;
  }
  return normalized;
}

module.exports = {
  normalizeExpertiseAreas,
  assertLecturerExpertise,
};
