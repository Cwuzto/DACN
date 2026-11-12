/**
 * Local Fallback AI Provider
 * Operates 100% offline with zero external network or library dependencies.
 * Uses rule-based heuristics, Jaccard n-gram similarity, and metadata cross-checking.
 */

const VIETNAMESE_STOP_WORDS = new Set([
  'và', 'của', 'các', 'cho', 'trong', 'với', 'về', 'những', 'để', 'một',
  'khi', 'tại', 'theo', 'là', 'được', 'có', 'ở', 'từ', 'trên', 'sử', 'dụng'
]);

/**
 * Normalize and tokenize text into words, stripping punctuation and stop words.
 * @param {string} text
 * @returns {Array<string>}
 */
function tokenize(text = '') {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !VIETNAMESE_STOP_WORDS.has(w));
}

/**
 * Calculate Jaccard similarity between two token arrays
 * @param {Array<string>} tokensA
 * @param {Array<string>} tokensB
 * @returns {number} 0.0 to 1.0
 */
function calculateJaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  if (unionSize === 0) return 0;
  return intersectionCount / unionSize;
}

/**
 * 1. Analyze BM01 Outline (Local Fallback Heuristics)
 * @param {object} outlineContent
 * @returns {object}
 */
function analyzeBM01Outline(outlineContent = {}) {
  const topicTitle = (outlineContent.topicTitle || '').trim();
  const researchContext = (outlineContent.researchContext || '').trim();
  const objectives = (outlineContent.objectives || '').trim();
  const scope = (outlineContent.scope || '').trim();
  const methodology = (outlineContent.methodology || '').trim();
  const expectedDeliverables = (outlineContent.expectedDeliverables || '').trim();

  const dimensions = [];
  const actionableSuggestions = [];
  let score = 10.0;

  // Dimension 1: Tính logic Tên - Mục tiêu
  const titleTokens = tokenize(topicTitle);
  const objTokens = tokenize(objectives);
  const titleObjSimilarity = calculateJaccardSimilarity(titleTokens, objTokens);

  if (!topicTitle) {
    dimensions.push({
      name: 'Tính logic Tên - Mục tiêu',
      status: 'NEEDS_IMPROVEMENT',
      feedback: 'Chưa có tên đề tài hoặc tên đề tài bị để trống.',
    });
    score -= 2.0;
  } else if (!objectives || objTokens.length < 5) {
    dimensions.push({
      name: 'Tính logic Tên - Mục tiêu',
      status: 'NEEDS_IMPROVEMENT',
      feedback: 'Mục tiêu nghiên cứu quá ngắn hoặc chưa rõ ràng so với định hướng tên đề tài.',
    });
    score -= 1.5;
    actionableSuggestions.push('Làm rõ các mục tiêu định lượng và định tính cụ thể của đề tài.');
  } else {
    dimensions.push({
      name: 'Tính logic Tên - Mục tiêu',
      status: 'PASS',
      feedback: 'Mục tiêu nghiên cứu thể hiện tương thích và bao quát được định hướng đã nêu ở tên đề tài.',
    });
  }

  // Dimension 2: Tính khả thi Phương pháp
  const methodTokens = tokenize(methodology);
  if (!methodology || methodTokens.length < 5) {
    dimensions.push({
      name: 'Tính khả thi Phương pháp',
      status: 'NEEDS_IMPROVEMENT',
      feedback: 'Thiếu phần mô tả phương pháp thực hiện hoặc phương pháp chưa cụ thể.',
    });
    score -= 2.5;
    actionableSuggestions.push('Cần bổ sung chi tiết Phương pháp thực hiện (thuật toán, mô hình, kiến trúc hoặc công nghệ dự kiến sử dụng).');
  } else {
    dimensions.push({
      name: 'Tính khả thi Phương pháp',
      status: 'PASS',
      feedback: 'Phương pháp đề xuất khả thi và phù hợp với năng lực thực hiện trong thời gian đồ án tốt nghiệp.',
    });
  }

  // Dimension 3: Phạm vi & Dữ liệu
  const scopeTokens = tokenize(scope);
  if (!scope || scopeTokens.length < 4) {
    dimensions.push({
      name: 'Phạm vi & Dữ liệu',
      status: 'NEEDS_IMPROVEMENT',
      feedback: 'Phạm vi nghiên cứu chưa được xác định rõ ràng hoặc thiếu thông tin tập dữ liệu/môi trường kiểm thử.',
    });
    score -= 2.0;
    actionableSuggestions.push('Cần xác định rõ Phạm vi đề tài (tập dữ liệu thực nghiệm, môi trường triển khai hoặc giới hạn bài toán).');
  } else {
    dimensions.push({
      name: 'Phạm vi & Dữ liệu',
      status: 'PASS',
      feedback: 'Phạm vi đề tài được khoanh vùng rõ ràng, vừa sức với quy mô đồ án tốt nghiệp.',
    });
  }

  // Dimension 4: Sản phẩm dự kiến
  const deliverableTokens = tokenize(expectedDeliverables);
  if (!expectedDeliverables || deliverableTokens.length < 3) {
    dimensions.push({
      name: 'Sản phẩm dự kiến',
      status: 'NEEDS_IMPROVEMENT',
      feedback: 'Chưa nêu cụ thể các sản phẩm bàn giao cuối cùng của đồ án.',
    });
    score -= 1.5;
    actionableSuggestions.push('Cần liệt kê cụ thể Sản phẩm dự kiến (mã nguồn, mô hình đã huấn luyện, tài liệu kỹ thuật, báo cáo hoàn chỉnh).');
  } else {
    dimensions.push({
      name: 'Sản phẩm dự kiến',
      status: 'PASS',
      feedback: 'Sản phẩm bàn giao rõ ràng, có khả năng đo lường và nghiệm thu thực tế.',
    });
  }

  // Dimension 5: Tính hoàn thiện học thuật
  const totalLength = topicTitle.length + researchContext.length + objectives.length + scope.length + methodology.length + expectedDeliverables.length;
  if (!researchContext || researchContext.length < 20 || totalLength < 150) {
    dimensions.push({
      name: 'Tính hoàn thiện học thuật',
      status: 'WARNING',
      feedback: 'Đề cương còn khá sơ sài, cần làm sâu sắc thêm bối cảnh nghiên cứu và tính cấp thiết.',
    });
    score -= 1.0;
    actionableSuggestions.push('Bổ sung thêm bối cảnh nghiên cứu và tài liệu tham khảo để tăng tính thuyết phục học thuật.');
  } else {
    dimensions.push({
      name: 'Tính hoàn thiện học thuật',
      status: 'PASS',
      feedback: 'Bố cục đề cương đầy đủ, trình bày mạch lạc và đúng quy chuẩn học vụ BM01.',
    });
  }

  // Clamp score
  const overallScore = Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));

  let status = 'GOOD';
  if (overallScore < 5.0) {
    status = 'CRITICAL_GAPS';
  } else if (overallScore < 7.5) {
    status = 'NEEDS_IMPROVEMENT';
  }

  let summary = 'Đề cương có cấu trúc tốt, logic khoa học rõ ràng giữa mục tiêu, phương pháp và sản phẩm dự kiến.';
  if (status === 'NEEDS_IMPROVEMENT') {
    summary = 'Đề cương còn thiếu sót một số phần quan trọng hoặc nội dung còn sơ sài. Cần bổ sung trước khi nộp chính thức.';
  } else if (status === 'CRITICAL_GAPS') {
    summary = 'Đề cương thiếu hụt nhiều mục cơ bản, chưa đủ điều kiện đánh giá học vụ.';
  }

  if (actionableSuggestions.length === 0) {
    actionableSuggestions.push('Nên xác định rõ các chỉ số đánh giá thực nghiệm (Precision, Recall, F1-Score, hoặc Response Time).');
    actionableSuggestions.push('Đính kèm kế hoạch phân bổ thời gian thực hiện chi tiết tương ứng với các buổi hướng dẫn BM03.');
  }

  return {
    overallScore,
    status,
    summary,
    dimensions,
    actionableSuggestions,
    provider: 'local_fallback',
  };
}

/**
 * Extract word n-grams (bigrams) from tokens
 * @param {Array<string>} tokens
 * @returns {Array<string>}
 */
function extractBigrams(tokens = []) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Check if a word is likely a technical term (contains numbers, latin acronyms, etc.)
 * @param {string} word
 * @returns {boolean}
 */
function isTechnicalTerm(word = '') {
  return /[0-9]/.test(word) || /^[a-z]{2,10}$/i.test(word) && !VIETNAMESE_STOP_WORDS.has(word);
}

/**
 * 2. Check Topic Semantic Similarity (Local Fallback Heuristics)
 * @param {object|string} newTopic
 * @param {Array<object>} existingTopics
 * @returns {object}
 */
function checkTopicSimilarity(newTopic = {}, existingTopics = []) {
  const newTitle = typeof newTopic === 'string' ? newTopic : newTopic.title || '';
  const newSummary = typeof newTopic === 'object' ? newTopic.summary || '' : '';

  const newTitleTokens = tokenize(newTitle);
  const newSummaryTokens = tokenize(newSummary);
  const combinedNewTokens = [...newTitleTokens, ...newSummaryTokens];
  const newBigrams = extractBigrams(newTitleTokens);

  let maxSimilarityPercentage = 0;
  const matchedTopics = [];

  for (const existing of existingTopics) {
    const exTitle = existing.title || '';
    const exSummary = existing.summary || '';
    const exTitleTokens = tokenize(exTitle);
    const exSummaryTokens = tokenize(exSummary);
    const combinedExTokens = [...exTitleTokens, ...exSummaryTokens];
    const exBigrams = extractBigrams(exTitleTokens);

    if (newTitleTokens.length === 0 || exTitleTokens.length === 0) continue;

    // 1. Jaccard & Overlap coefficient on single tokens
    const jaccard = calculateJaccardSimilarity(newTitleTokens, exTitleTokens);
    const setA = new Set(newTitleTokens);
    const setB = new Set(exTitleTokens);
    let commonTokenCount = 0;
    const commonWords = [];
    const diffWords = [];

    for (const w of setA) {
      if (setB.has(w)) {
        commonTokenCount++;
        commonWords.push(w);
      } else {
        diffWords.push(w);
      }
    }

    const minTokens = Math.min(setA.size, setB.size);
    const overlapCoeff = minTokens > 0 ? commonTokenCount / minTokens : 0;

    // 2. Bigram match
    const bigramJaccard = calculateJaccardSimilarity(newBigrams, exBigrams);

    // 3. Technical term matches
    const commonTechTerms = commonWords.filter(isTechnicalTerm);
    const techBoost = commonTechTerms.length * 0.12;

    // 4. Substring overlap boost
    let substringBoost = 0;
    const cleanNew = newTitle.toLowerCase().trim();
    const cleanEx = exTitle.toLowerCase().trim();
    if (cleanNew && cleanEx) {
      if (cleanNew === cleanEx) {
        substringBoost = 0.5;
      } else if (cleanNew.includes(cleanEx) || cleanEx.includes(cleanNew)) {
        substringBoost = 0.3;
      }
    }

    // 5. Summary overlap
    const summaryJaccard = calculateJaccardSimilarity(combinedNewTokens, combinedExTokens);

    // Combined score
    let baseScore = (jaccard * 0.35) + (overlapCoeff * 0.35) + (bigramJaccard * 0.15) + (summaryJaccard * 0.15);
    let totalScore = baseScore + techBoost + substringBoost;
    totalScore = Math.min(1.0, Math.max(0.0, totalScore));

    const percentage = Math.round(totalScore * 100);
    if (percentage > maxSimilarityPercentage) {
      maxSimilarityPercentage = percentage;
    }

    if (percentage >= 25) {
      matchedTopics.push({
        topicId: existing.id || null,
        title: exTitle,
        mentorName: existing.mentorName || 'N/A',
        semester: existing.semester || 'Lịch sử',
        similarityPercentage: percentage,
        similarities: commonWords.length > 0
          ? `Tương đồng ở các từ khóa và nội dung chính: ${commonWords.slice(0, 5).join(', ')}.`
          : 'Có sự tương đồng về lĩnh vực nghiên cứu.',
        differences: diffWords.length > 0
          ? `Đề tài mới có định hướng và từ khóa khác biệt: ${diffWords.slice(0, 5).join(', ')}.`
          : 'Đề tài mới có cách tiếp cận tương tự.',
      });
    }
  }

  // Sort matched topics descending
  matchedTopics.sort((a, b) => b.similarityPercentage - a.similarityPercentage);

  let riskLevel = 'NOVEL';
  let verdict = 'Đề tài có tính mới cao, không phát hiện sự trùng lặp đáng kể với kho đề tài lịch sử.';

  if (maxSimilarityPercentage >= 70) {
    riskLevel = 'HIGH_DUPLICATE_RISK';
    verdict = `Đề tài có mức độ trùng lặp cao (${maxSimilarityPercentage}%) với đề tài đã thực hiện. Cần điều chỉnh phạm vi hoặc cách tiếp cận để tạo tính mới.`;
  } else if (maxSimilarityPercentage >= 40) {
    riskLevel = 'MODERATE_SIMILARITY';
    verdict = `Đề tài có sự tương đồng đáng kể (${maxSimilarityPercentage}%) với đề tài trước đây. Cần làm rõ điểm cải tiến hoặc công nghệ khác biệt.`;
  }

  // Generate 3 refined academic title suggestions based on newTitle
  const baseTitle = newTitle || 'Nghiên cứu ứng dụng công nghệ';
  const refinedTitleSuggestions = [
    `Nâng cao hiệu năng ${baseTitle} với kiến trúc phân tán và tối ưu hóa thời gian thực`,
    `Ứng dụng ${baseTitle} trong điều kiện môi trường thực tế và đánh giá hiệu năng so sánh`,
    `Xây dựng giải pháp toàn diện cho ${baseTitle} tích hợp bảo mật và giám sát tự động`,
  ];

  return {
    maxSimilarityPercentage,
    riskLevel,
    verdict,
    matchedTopics,
    refinedTitleSuggestions,
    provider: 'local_fallback',
  };
}

/**
 * 3. Cross-Check Archival Dossier (Local Fallback Heuristics)
 * @param {object} registrationData
 * @param {Array<object>} dossierFiles
 * @returns {object}
 */
function crossCheckArchivalDossier(registrationData = {}, dossierFiles = []) {
  const effectiveOfficialTitle = (
    registrationData.effectiveOfficialTitle ||
    registrationData.topicTitle ||
    ''
  ).trim();
  const studentCode = (registrationData.studentCode || '').trim();
  const studentName = (registrationData.studentName || '').trim();
  const mentorName = (registrationData.mentorName || '').trim();

  const checklist = [];
  const discrepancies = [];

  // Check 1: Tên đề tài trên bìa Báo cáo
  let titleMatch = true;
  let extractedTitle = '';

  for (const file of dossierFiles) {
    if (file.extractedTitle) {
      extractedTitle = file.extractedTitle.trim();
      if (extractedTitle.toLowerCase() !== effectiveOfficialTitle.toLowerCase()) {
        titleMatch = false;
        discrepancies.push(
          `Tên đề tài trên bìa tệp "${file.fileName || file.type}" ('${extractedTitle}') không khớp với tên đề tài chính thức được phê duyệt ('${effectiveOfficialTitle}').`
        );
        break;
      }
    }
  }

  checklist.push({
    field: 'Tên đề tài trên bìa Báo cáo',
    expected: effectiveOfficialTitle,
    extracted: extractedTitle || effectiveOfficialTitle,
    status: titleMatch ? 'EXACT_MATCH' : 'MISMATCH',
  });

  // Check 2: Mã số sinh viên (MSSV)
  let codeMatch = true;
  let extractedCode = '';
  for (const file of dossierFiles) {
    if (file.extractedStudentCode) {
      extractedCode = file.extractedStudentCode.trim();
      if (studentCode && extractedCode !== studentCode) {
        codeMatch = false;
        discrepancies.push(`Mã số sinh viên trích xuất (${extractedCode}) không khớp với hồ sơ (${studentCode}).`);
        break;
      }
    }
  }

  checklist.push({
    field: 'Mã số sinh viên (MSSV)',
    expected: studentCode,
    extracted: extractedCode || studentCode,
    status: codeMatch ? 'EXACT_MATCH' : 'MISMATCH',
  });

  // Check 3: Họ tên sinh viên
  let nameMatch = true;
  let extractedName = '';
  for (const file of dossierFiles) {
    if (file.extractedStudentName) {
      extractedName = file.extractedStudentName.trim();
      if (studentName && extractedName.toLowerCase() !== studentName.toLowerCase()) {
        nameMatch = false;
        discrepancies.push(`Họ tên sinh viên trích xuất (${extractedName}) không khớp với hồ sơ (${studentName}).`);
        break;
      }
    }
  }

  checklist.push({
    field: 'Họ tên sinh viên',
    expected: studentName,
    extracted: extractedName || studentName,
    status: nameMatch ? 'EXACT_MATCH' : 'MISMATCH',
  });

  // Check 4: Họ tên Giảng viên hướng dẫn
  let mentorMatch = true;
  let extractedMentor = '';
  for (const file of dossierFiles) {
    if (file.extractedMentorName) {
      extractedMentor = file.extractedMentorName.trim();
      if (mentorName && extractedMentor.toLowerCase() !== mentorName.toLowerCase()) {
        mentorMatch = false;
        discrepancies.push(`Họ tên GVHD trích xuất (${extractedMentor}) không khớp với hồ sơ (${mentorName}).`);
        break;
      }
    }
  }

  checklist.push({
    field: 'Họ tên Giảng viên hướng dẫn',
    expected: mentorName,
    extracted: extractedMentor || mentorName,
    status: mentorMatch ? 'EXACT_MATCH' : 'MISMATCH',
  });

  // Check 5: Tính đồng bộ giữa các tệp hồ sơ
  let consistent = true;
  if (dossierFiles.length > 1) {
    const titles = dossierFiles.map((f) => (f.extractedTitle || '').trim().toLowerCase()).filter(Boolean);
    if (new Set(titles).size > 1) {
      consistent = false;
      discrepancies.push('Phát hiện sự không đồng nhất về tên đề tài giữa các tệp nộp.');
    }
  }

  checklist.push({
    field: 'Tính đồng bộ giữa các tệp hồ sơ',
    status: consistent ? 'CONSISTENT' : 'INCONSISTENT',
    notes: consistent
      ? 'Các tệp đều phản ánh cùng tên đề tài và thông tin tác giả thống nhất.'
      : 'Phát hiện sự không đồng nhất giữa các tệp hồ sơ nộp.',
  });

  const overallStatus = discrepancies.length === 0 ? 'MATCHED' : 'DISCREPANCY_FOUND';
  const academicAffairsGuidance = overallStatus === 'MATCHED'
    ? 'Hồ sơ lưu chiểu hoàn toàn chuẩn xác về mặt định dạng bìa và tính pháp lý. Đủ điều kiện để Giáo vụ duyệt thủ tục.'
    : 'Phát hiện thông tin không khớp trên hồ sơ lưu chiểu. Yêu cầu sinh viên chỉnh sửa và nộp lại trước khi trình ký.';

  return {
    overallStatus,
    effectiveOfficialTitle,
    checklist,
    discrepancies,
    academicAffairsGuidance,
    provider: 'local_fallback',
  };
}

module.exports = {
  tokenize,
  calculateJaccardSimilarity,
  analyzeBM01Outline,
  checkTopicSimilarity,
  crossCheckArchivalDossier,
};
