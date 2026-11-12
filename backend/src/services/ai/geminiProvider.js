/**
 * Gemini AI Provider
 * Communicates with Google Generative Language REST API (Gemini 2.0 Flash)
 * using native fetch with zero external npm dependencies.
 */

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Safely parse JSON response from Gemini, stripping any markdown code fences if present.
 * @param {string} rawText
 * @returns {object}
 */
function parseJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Invalid JSON: raw text is empty or not a string');
  }

  let cleaned = rawText.trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Invalid JSON response from Gemini: ${err.message}`);
  }
}

/**
 * Format prompt for BM01 Outline 5-dimensional logic analysis.
 * @param {object} outlineContent
 * @returns {string}
 */
function formatBM01Prompt(outlineContent = {}) {
  const {
    topicTitle = '',
    researchContext = '',
    objectives = '',
    scope = '',
    methodology = '',
    expectedDeliverables = '',
  } = outlineContent;

  return `Bạn là Chuyên gia Học vụ và Thẩm định Khoa học của Viện Công nghệ Số.
Hãy phân tích đề cương đồ án tốt nghiệp BM01 dưới đây trên 5 chiều logic:
1. Tính logic Tên - Mục tiêu (Tên đề tài có bao quát đúng mục tiêu cụ thể không?)
2. Tính khả thi Phương pháp (Phương pháp đề xuất có khả thi và phù hợp với mục tiêu không?)
3. Phạm vi & Dữ liệu (Phạm vi có vừa sức đồ án tốt nghiệp, dữ liệu thực nghiệm có rõ ràng không?)
4. Sản phẩm dự kiến (Sản phẩm có đo lường, nghiệm thu được kết quả của phương pháp không?)
5. Tính hoàn thiện học thuật (Định dạng, mức độ chi tiết và tính rõ ràng của toàn bộ đề cương).

Dữ liệu đề cương BM01:
- Tên đề tài: ${topicTitle}
- Bối cảnh nghiên cứu: ${researchContext}
- Mục tiêu nghiên cứu: ${objectives}
- Phạm vi đề tài: ${scope}
- Phương pháp nghiên cứu: ${methodology}
- Sản phẩm dự kiến: ${expectedDeliverables}

Yêu cầu định dạng đầu ra bắt buộc là JSON thuần túy (không kèm giải thích bên ngoài):
{
  "overallScore": number (thang điểm 10, từ 0.0 đến 10.0),
  "status": "GOOD" | "NEEDS_IMPROVEMENT" | "CRITICAL_GAPS",
  "summary": "Nhận xét tổng quan súc tích về đề cương bằng tiếng Việt",
  "dimensions": [
    { "name": "Tính logic Tên - Mục tiêu", "status": "PASS" | "WARNING" | "NEEDS_IMPROVEMENT", "feedback": "Nhận xét cụ thể" },
    { "name": "Tính khả thi Phương pháp", "status": "PASS" | "WARNING" | "NEEDS_IMPROVEMENT", "feedback": "Nhận xét cụ thể" },
    { "name": "Phạm vi & Dữ liệu", "status": "PASS" | "WARNING" | "NEEDS_IMPROVEMENT", "feedback": "Nhận xét cụ thể" },
    { "name": "Sản phẩm dự kiến", "status": "PASS" | "WARNING" | "NEEDS_IMPROVEMENT", "feedback": "Nhận xét cụ thể" },
    { "name": "Tính hoàn thiện học thuật", "status": "PASS" | "WARNING" | "NEEDS_IMPROVEMENT", "feedback": "Nhận xét cụ thể" }
  ],
  "actionableSuggestions": [
    "Gợi ý hành động cụ thể 1",
    "Gợi ý hành động cụ thể 2"
  ]
}`;
}

/**
 * Format prompt for Semantic Topic Similarity check.
 * @param {object|string} newTopic
 * @param {Array<object>} existingTopics
 * @returns {string}
 */
function formatSimilarityPrompt(newTopic = {}, existingTopics = []) {
  const title = typeof newTopic === 'string' ? newTopic : newTopic.title || '';
  const summary = typeof newTopic === 'object' ? newTopic.summary || '' : '';

  const historicalListStr = existingTopics
    .slice(0, 50)
    .map(
      (t, idx) =>
        `${idx + 1}. [ID: ${t.id}] Tên: "${t.title}" | GVHD: ${t.mentorName || 'N/A'} | Đợt/Kỳ: ${
          t.semester || 'N/A'
        } | Tóm tắt: ${t.summary || 'Không có'}`
    )
    .join('\n');

  return `Bạn là Trợ lý Thẩm định Học thuật chuyên rà soát trùng lặp đề tài đồ án tốt nghiệp.
Hãy so sánh ngữ nghĩa của đề tài mới sau đây với kho đề tài lịch sử đã lưu trữ:

ĐỀ TÀI MỚI:
- Tên đề tài: "${title}"
- Tóm tắt: "${summary}"

KHO ĐỀ TÀI LỊCH SỬ (${existingTopics.length} đề tài):
${historicalListStr || '(Chưa có đề tài nào trong kho)'}

Quy tắc phân loại rủi ro:
- maxSimilarityPercentage < 40: "NOVEL" (Tính mới cao, không trùng lặp)
- 40 <= maxSimilarityPercentage <= 70: "MODERATE_SIMILARITY" (Tương đồng về hướng tiếp cận/công nghệ, cần nêu rõ điểm khác biệt)
- maxSimilarityPercentage > 70: "HIGH_DUPLICATE_RISK" (Nguy cơ trùng lặp ý tưởng nghiêm trọng)

Đầu ra bắt buộc là JSON thuần túy:
{
  "maxSimilarityPercentage": number (0 đến 100),
  "riskLevel": "NOVEL" | "MODERATE_SIMILARITY" | "HIGH_DUPLICATE_RISK",
  "verdict": "Kết luận đánh giá tính mới / mức độ trùng lặp bằng tiếng Việt",
  "matchedTopics": [
    {
      "topicId": number | null,
      "title": "Tên đề tài lịch sử tương đồng nhất",
      "mentorName": "Tên GVHD",
      "semester": "Học kỳ",
      "similarityPercentage": number (0 đến 100),
      "similarities": "Phân tích điểm giống nhau về bài toán/công nghệ",
      "differences": "Phân tích điểm khác biệt và cải tiến của đề tài mới"
    }
  ],
  "refinedTitleSuggestions": [
    "Tên đề tài gợi ý tối ưu 1 (khoa học, chuyên sâu, phân biệt rõ)",
    "Tên đề tài gợi ý tối ưu 2",
    "Tên đề tài gợi ý tối ưu 3"
  ]
}`;
}

/**
 * Format prompt for Archival Dossier Cross-Check.
 * @param {object} registrationData
 * @param {Array<object>} dossierFiles
 * @returns {string}
 */
function formatCrossCheckPrompt(registrationData = {}, dossierFiles = []) {
  const {
    effectiveOfficialTitle = '',
    studentCode = '',
    studentName = '',
    mentorName = '',
  } = registrationData;

  const filesSummary = (dossierFiles || [])
    .map(
      (f, idx) =>
        `${idx + 1}. [Loại: ${f.type || 'UNKNOWN'}] Tên tệp: ${f.fileName || 'N/A'} | Tên trích xuất: "${
          f.extractedTitle || 'N/A'
        }" | MSSV: "${f.extractedStudentCode || 'N/A'}" | SV: "${
          f.extractedStudentName || 'N/A'
        }" | GVHD: "${f.extractedMentorName || 'N/A'}"`
    )
    .join('\n');

  return `Bạn là Chuyên viên Quản lý Đào tạo và Lưu chiểu Hồ sơ Tốt nghiệp.
Hãy đối soát thông tin trích xuất từ các tệp nộp lưu chiểu với Thông tin Pháp lý Chính thức của sinh viên:

THÔNG TIN PHÁP LÝ CHÍNH THỨC:
- Tên đề tài chính thức có hiệu lực (từ QĐ giao đề tài hoặc Phụ lục BM02-A): "${effectiveOfficialTitle}"
- Mã số sinh viên (MSSV): "${studentCode}"
- Họ tên sinh viên: "${studentName}"
- Giảng viên hướng dẫn: "${mentorName}"

THÔNG TIN TRÍCH XUẤT TỪ CÁC TỆP NỘP:
${filesSummary || '(Chưa có thông tin tệp)'}

Quy tắc đối soát:
- Nếu tên đề tài trên bìa tệp khác với Tên đề tài chính thức có hiệu lực, đánh dấu MISMATCH.
- Nếu MSSV, Họ tên SV, Họ tên GVHD không khớp, đánh dấu MISMATCH.
- Kiểm tra tính đồng bộ nội dung giữa các tệp nộp.

Đầu ra bắt buộc là JSON thuần túy:
{
  "overallStatus": "MATCHED" | "DISCREPANCY_FOUND",
  "effectiveOfficialTitle": "${effectiveOfficialTitle}",
  "checklist": [
    { "field": "Tên đề tài trên bìa Báo cáo", "expected": "${effectiveOfficialTitle}", "extracted": "...", "status": "EXACT_MATCH" | "MISMATCH" },
    { "field": "Mã số sinh viên (MSSV)", "expected": "${studentCode}", "extracted": "...", "status": "EXACT_MATCH" | "MISMATCH" },
    { "field": "Họ tên sinh viên", "expected": "${studentName}", "extracted": "...", "status": "EXACT_MATCH" | "MISMATCH" },
    { "field": "Họ tên Giảng viên hướng dẫn", "expected": "${mentorName}", "extracted": "...", "status": "EXACT_MATCH" | "MISMATCH" },
    { "field": "Tính đồng bộ giữa các tệp hồ sơ", "status": "CONSISTENT" | "INCONSISTENT", "notes": "..." }
  ],
  "discrepancies": [
    "Mô tả sai lệch nếu có"
  ],
  "academicAffairsGuidance": "Hướng dẫn cụ thể cho Giáo vụ Viện (Đạt để duyệt hoặc Yêu cầu SV nộp lại kèm lý do)"
}`;
}

/**
 * Invoke Google Generative Language REST API
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<object>}
 */
async function callGeminiApi(prompt, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const fetchFn = options.fetchFn || globalThis.fetch;
  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  };

  let timeoutId;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = options.signal || (controller ? controller.signal : undefined);

  if (controller && !options.signal) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Gemini API call failed with status ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!candidateText) {
      throw new Error('Empty response content received from Gemini API');
    }

    const parsed = parseJsonResponse(candidateText);
    return {
      ...parsed,
      provider: model,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Analyze BM01 outline using Gemini
 */
async function analyzeBM01Outline(outlineContent, options = {}) {
  const prompt = formatBM01Prompt(outlineContent);
  return callGeminiApi(prompt, options);
}

/**
 * Check semantic topic similarity using Gemini
 */
async function checkTopicSimilarity(newTopic, existingTopics = [], options = {}) {
  const prompt = formatSimilarityPrompt(newTopic, existingTopics);
  return callGeminiApi(prompt, options);
}

/**
 * Cross-check archival dossier metadata using Gemini
 */
async function crossCheckArchivalDossier(registrationData, dossierFiles = [], options = {}) {
  const prompt = formatCrossCheckPrompt(registrationData, dossierFiles);
  return callGeminiApi(prompt, options);
}

module.exports = {
  parseJsonResponse,
  formatBM01Prompt,
  formatSimilarityPrompt,
  formatCrossCheckPrompt,
  callGeminiApi,
  analyzeBM01Outline,
  checkTopicSimilarity,
  crossCheckArchivalDossier,
};
