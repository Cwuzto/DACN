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
 * Format prompt for Academic Feedback generation (BM01, BM03, BM04, DEFENSE).
 * @param {object} payload
 * @returns {string}
 */
function formatFeedbackPrompt(payload = {}) {
  const {
    contextType = 'DEFENSE',
    topicTitle = '',
    studentName = '',
    scores = {},
    notes = '',
  } = payload;

  const scoreDetails = Object.entries(scores || {})
    .filter(([_, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => `- ${key}: ${val}`)
    .join('\n');

  return `Bạn là Chuyên gia Học vụ và Thành viên Hội đồng Đánh giá Đồ án tốt nghiệp tại Viện Công nghệ Số.
Nhiệm vụ của bạn là soạn thảo đoạn văn nhận xét học thuật chuẩn mực, mang tính sư phạm và xây dựng cao dựa trên dữ liệu đánh giá:

THÔNG TIN ĐÁNH GIÁ:
- Cột mốc đánh giá (contextType): ${contextType} (BM01: Đề cương, BM03: Tiến độ, BM04: Phiếu nhận xét GVHD/Phản biện, DEFENSE: Bảo vệ Hội đồng)
- Tên đề tài: ${topicTitle}
- Họ tên sinh viên: ${studentName || 'Sinh viên'}
- Điểm số chi tiết:
${scoreDetails || '(Chưa có điểm chi tiết cụ thể)'}
- Ghi chú nhanh của Giảng viên/Hội đồng: ${notes || '(Không có ghi chú thêm)'}

YÊU CẦU ĐẦU RA:
- Đoạn nhận xét (feedback): Viết bằng tiếng Việt trang trọng, chuẩn mực học thuật, phân tích thỏa đáng các tiêu chí đánh giá phù hợp với cột mốc ${contextType}.
- Danh sách ưu điểm nổi bật (strengths): Mảng các chuỗi ngắn gọn.
- Danh sách điểm cần hoàn thiện/khắc phục (improvements): Mảng các chuỗi mang tính hành động cụ thể.

Định dạng JSON thuần túy bắt buộc:
{
  "feedback": "Nhận xét tổng quan và chi tiết...",
  "strengths": ["Ưu điểm 1", "Ưu điểm 2"],
  "improvements": ["Điểm cần hoàn thiện 1", "Điểm cần hoàn thiện 2"]
}`;
}

/**
 * Format prompt for Defense Questions generation (3-tiered).
 * @param {object} payload
 * @returns {string}
 */
function formatDefenseQuestionsPrompt(payload = {}) {
  const {
    topicTitle = '',
    description = '',
    technologies = '',
    major = '',
  } = payload;

  return `Bạn là Thành viên Hội đồng Thẩm định & Bảo vệ Đồ án tốt nghiệp tại Viện Công nghệ Số.
Hãy tạo đúng 3 câu hỏi phản biện chuyên sâu và xác đáng cho sinh viên bảo vệ đồ án tốt nghiệp, phân theo 3 cấp độ:
1. FOUNDATION (Kiến thức nền tảng): Kiểm tra mức độ nắm bắt bản chất lý thuyết, cơ sở lựa chọn thuật toán/mô hình/kiến trúc.
2. TECHNICAL_CHALLENGE (Thách thức kỹ thuật): Kiểm tra khả năng giải quyết vấn đề khó, xử lý dữ liệu ngoại lệ, tối ưu hóa hiệu năng, độ trễ hoặc bài toán nghẽn cổ chai.
3. FUTURE_EXPANSION (Hướng phát triển & Ứng dụng): Kiểm tra tầm nhìn mở rộng hệ thống, khả năng triển khai thực tế trên diện rộng hoặc tích hợp liên thông.

THÔNG TIN ĐỀ TÀI:
- Tên đề tài: ${topicTitle}
- Tóm tắt nội dung: ${description || '(Chưa có mô tả)'}
- Công nghệ & Kỹ thuật sử dụng: ${technologies || '(Chưa có thông tin công nghệ)'}
- Chuyên ngành: ${major || 'Công nghệ Thông tin'}

Định dạng JSON thuần túy bắt buộc:
{
  "questions": [
    {
      "level": "FOUNDATION",
      "levelLabel": "Kiến thức nền tảng",
      "question": "Nội dung câu hỏi...",
      "purpose": "Mục đích đánh giá của câu hỏi..."
    },
    {
      "level": "TECHNICAL_CHALLENGE",
      "levelLabel": "Thách thức kỹ thuật",
      "question": "Nội dung câu hỏi...",
      "purpose": "Mục đích đánh giá của câu hỏi..."
    },
    {
      "level": "FUTURE_EXPANSION",
      "levelLabel": "Hướng phát triển & Ứng dụng",
      "question": "Nội dung câu hỏi...",
      "purpose": "Mục đích đánh giá của câu hỏi..."
    }
  ]
}`;
}

/**
 * Format prompt for Academic Regulation Chatbot.
 * @param {object} payload
 * @returns {string}
 */
function formatRegulationChatPrompt(payload = {}) {
  const { message = '', history = [] } = payload;

  const historyStr = (history || [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Sinh viên' : 'Trợ lý'}: ${h.content}`)
    .join('\n');

  return `Bạn là Trợ lý Học vụ AI thông minh của Viện Công nghệ Số.
Nhiệm vụ của bạn là giải đáp chính xác, súc tích và thân thiện các thắc mắc về Quy chế Đồ án / Khóa luận Tốt nghiệp dựa trên 6 giai đoạn chuẩn của Viện:

KIẾN THỨC QUY CHẾ HỌC VỤ (Quy chế học vụ 6 giai đoạn chuẩn của Viện):
1. Giai đoạn 1 (Đăng ký & Phê duyệt đề tài):
   - Mô hình: 1 Sinh viên / 1 Đề tài (maxStudents = 1), 1 Giảng viên hướng dẫn tối đa 10 sinh viên.
   - Biểu mẫu BM01 (Đề cương chi tiết đồ án).
   - Quy tắc nộp lại v2 duy nhất: Nếu đề cương v1 bị Hội đồng đánh giá 'Cần chỉnh sửa', sinh viên chỉ được phép nộp lại duy nhất 01 lần (bản v2) trong thời hạn quy định. Nếu bản v2 vẫn không đạt yêu cầu, sinh viên sẽ bị DỪNG ĐỀ TÀI trong học kỳ đó.
2. Giai đoạn 2 (Báo cáo tiến độ BM03):
   - Sinh viên phải tham gia tối thiểu 4-6 buổi gặp gỡ và hướng dẫn với GVHD.
   - Báo cáo tiến độ định kỳ BM03 ghi nhận khối lượng công việc hoàn thành. Sinh viên không nộp báo cáo hoặc tiến độ dưới 50% sẽ bị cảnh báo hoặc đình chỉ bảo vệ.
3. Giai đoạn 3 (Đánh giá GVHD & Phản biện BM04):
   - Điểm đánh giá của GVHD và Điểm đánh giá của Giảng viên Phản biện phải độc lập và đều đạt từ 5.0/10 trở lên mới đủ điều kiện được đưa ra Hội đồng bảo vệ.
4. Giai đoạn 4 (Thành lập Hội đồng & Lịch bảo vệ):
   - Hội đồng gồm 3 đến 5 thành viên (Chủ tịch, Thư ký, Phản biện và các Ủy viên).
   - Sinh viên hoàn thiện quyển báo cáo theo định dạng quy chuẩn của Viện và nộp trước ngày bảo vệ.
5. Giai đoạn 5 (Chấm điểm bảo vệ đồ án):
   - Hội đồng chấm điểm theo thang điểm 10, tính điểm trung bình công khai của các thành viên.
   - Biên bản chấm bảo vệ được lập và ký xác nhận ngay sau phiên bảo vệ.
6. Giai đoạn 6 (Nộp lưu chiểu & Hoàn tất tốt nghiệp):
   - Thời hạn nộp lưu chiểu bắt buộc: Trong vòng đúng 14 ngày làm việc kể từ ngày bảo vệ thành công.
   - Hồ sơ lưu chiểu gồm: File PDF báo cáo toàn văn đã chỉnh sửa theo góp ý của Hội đồng, mã nguồn/sản phẩm phần mềm, và phụ lục giải trình.
   - Đối soát pháp lý: Tên đề tài trên bìa báo cáo lưu chiểu phải trùng khớp 100% với Tên đề tài chính thức có hiệu lực trên Quyết định giao đề tài hoặc Phụ lục BM02-A đã được phê duyệt.

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${historyStr || '(Chưa có hội thoại trước)'}

CÂU HỎI HIỆN TẠI CỦA SINH VIÊN:
"${message}"

YÊU CẦU ĐẦU RA:
- Trả lời đúng trọng tâm quy chế, dễ hiểu, dẫn chiếu biểu mẫu hoặc giai đoạn liên quan.
- Đề xuất 2-3 câu hỏi nhanh kế tiếp mà sinh viên thường quan tâm để người dùng có thể bấm hỏi ngay.

Định dạng JSON thuần túy bắt buộc:
{
  "reply": "Câu trả lời chi tiết và súc tích bằng tiếng Việt...",
  "relatedRegulations": ["Tên quy chế / biểu mẫu liên quan 1", "Quy chế 2"],
  "suggestedQuickQuestions": ["Câu hỏi gợi ý 1", "Câu hỏi gợi ý 2", "Câu hỏi gợi ý 3"]
}`;
}

/**
 * Generate academic feedback using Gemini
 */
async function generateAcademicFeedback(payload, options = {}) {
  const prompt = formatFeedbackPrompt(payload);
  const result = await callGeminiApi(prompt, options);
  return {
    feedback: result.feedback || '',
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    improvements: Array.isArray(result.improvements) ? result.improvements : [],
    provider: result.provider || DEFAULT_MODEL,
  };
}

/**
 * Generate 3-tiered defense questions using Gemini
 */
async function generateDefenseQuestions(payload, options = {}) {
  const prompt = formatDefenseQuestionsPrompt(payload);
  const result = await callGeminiApi(prompt, options);
  return {
    questions: Array.isArray(result.questions) ? result.questions : [],
    provider: result.provider || DEFAULT_MODEL,
  };
}

/**
 * Answer academic regulation chat using Gemini
 */
async function answerRegulationChat(payload, options = {}) {
  const prompt = formatRegulationChatPrompt(payload);
  const result = await callGeminiApi(prompt, options);
  return {
    reply: result.reply || '',
    relatedRegulations: Array.isArray(result.relatedRegulations) ? result.relatedRegulations : [],
    suggestedQuickQuestions: Array.isArray(result.suggestedQuickQuestions) ? result.suggestedQuickQuestions : [],
    provider: result.provider || DEFAULT_MODEL,
  };
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
  formatFeedbackPrompt,
  formatDefenseQuestionsPrompt,
  formatRegulationChatPrompt,
  callGeminiApi,
  analyzeBM01Outline,
  checkTopicSimilarity,
  crossCheckArchivalDossier,
  generateAcademicFeedback,
  generateDefenseQuestions,
  answerRegulationChat,
};
