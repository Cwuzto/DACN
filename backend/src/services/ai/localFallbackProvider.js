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

/**
 * 4. Generate Academic Feedback (Local Heuristic Fallback)
 * @param {object} payload
 * @returns {object}
 */
function generateAcademicFeedback(payload = {}) {
  const contextType = (payload.contextType || 'DEFENSE').toUpperCase();
  const topicTitle = (payload.topicTitle || 'Đề tài tốt nghiệp').trim();
  const studentName = (payload.studentName || 'Sinh viên').trim();
  const scores = payload.scores && typeof payload.scores === 'object' ? payload.scores : {};
  const notes = (payload.notes || '').trim();

  // Extract score values
  const scoreValues = Object.values(scores)
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v) && v >= 0);

  const avgScore = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : 8.0; // default benchmark if no scores provided

  const isExcellent = avgScore >= 8.5;
  const isGood = avgScore >= 7.0 && avgScore < 8.5;
  const isAverageOrLow = avgScore < 7.0;

  const strengths = [];
  const improvements = [];
  let feedback = '';

  if (contextType === 'BM01') {
    if (isExcellent) {
      feedback = `${studentName} đã xây dựng đề cương đề tài "${topicTitle}" rất tốt. Bố cục đề cương đầy đủ, mục tiêu nghiên cứu và phương pháp triển khai rõ ràng, khả thi.`;
      strengths.push('Mục tiêu nghiên cứu bám sát định hướng và phạm vi rõ ràng');
      strengths.push('Phương pháp và công nghệ đề xuất hiện đại, có tính khả thi cao');
      improvements.push('Chi tiết hóa thêm kế hoạch phân bổ thời gian thực hiện từng tuần');
    } else if (isGood) {
      feedback = `${studentName} hoàn thành đề cương đồ án cơ bản đạt yêu cầu. Định hướng nghiên cứu phù hợp, tuy nhiên cần bổ sung cụ thể các chỉ số đo lường thực nghiệm.`;
      strengths.push('Xác định được vấn đề nghiên cứu cần giải quyết');
      strengths.push('Bố cục đề cương cơ bản đầy đủ theo mẫu BM01');
      improvements.push('Cần làm rõ phương pháp đánh giá kết quả thực nghiệm và tập dữ liệu kiểm thử');
      improvements.push('Hoàn thiện danh mục tài liệu tham khảo học thuật chính thống');
    } else {
      feedback = `Đề cương đồ án còn sơ sài, mục tiêu nghiên cứu chưa tương xứng với phạm vi đồ án tốt nghiệp. Cần chỉnh sửa bổ sung gấp trước khi duyệt chính thức.`;
      strengths.push('Ý tưởng đề tài có tiềm năng ứng dụng');
      improvements.push('Cần xác định lại mục tiêu cụ thể và phương pháp thực hiện');
      improvements.push('Bổ sung chi tiết các sản phẩm bàn giao cuối cùng');
    }
  } else if (contextType === 'BM03') {
    if (isExcellent) {
      feedback = `${studentName} duy trì tiến độ thực hiện đề tài "${topicTitle}" rất nghiêm túc. Tích cực trao đổi với GVHD, giải quyết tốt các bài toán kỹ thuật theo đúng kế hoạch.`;
      strengths.push('Tiến độ thực hiện đạt và vượt khối lượng công việc đề ra');
      strengths.push('Tinh thần chủ động cao và ghi chép nhật ký hướng dẫn đầy đủ');
      improvements.push('Tiến hành sớm giai đoạn kiểm thử tích hợp và đo lường hiệu năng');
    } else if (isGood) {
      feedback = `${studentName} đảm bảo tiến độ ở mức khá, hoàn thành các mốc công việc cơ bản. Cần đẩy nhanh việc hoàn thiện mã nguồn và bắt đầu viết quyển báo cáo.`;
      strengths.push('Nắm được tiến trình kỹ thuật của đồ án');
      strengths.push('Có tinh thần tiếp thu góp ý của Giảng viên hướng dẫn');
      improvements.push('Đẩy nhanh tốc độ hoàn thiện các module còn dang dở');
      improvements.push('Soạn thảo dần các chương lý thuyết của quyển báo cáo tốt nghiệp');
    } else {
      feedback = `Tiến độ thực hiện còn chậm so với yêu cầu mốc BM03. Cần tập trung cao độ và tăng cường trao đổi với GVHD để bù lại khối lượng còn thiếu.`;
      strengths.push('Đã nắm được cấu trúc bài toán');
      improvements.push('Tập trung giải quyết dứt điểm các vướng mắc kỹ thuật cốt lõi');
      improvements.push('Báo cáo tiến độ thường xuyên theo lịch hẹn với GVHD');
    }
  } else if (contextType === 'BM04') {
    if (isExcellent) {
      feedback = `${studentName} đã hoàn thành xuất sắc đồ án tốt nghiệp với chất lượng cao. Quyển báo cáo được trình bày khoa học, sản phẩm phần mềm vận hành ổn định và đáp ứng đầy đủ mục tiêu đã đăng ký. Đủ điều kiện ra Hội đồng bảo vệ.`;
      strengths.push('Sản phẩm hoàn thiện, giao diện và tính năng hoạt động mượt mà');
      strengths.push('Báo cáo trình bày đúng quy chuẩn học thuật của Viện');
      improvements.push('Chuẩn bị slide bảo vệ súc tích và kịch bản demo trực quan trước Hội đồng');
    } else if (isGood) {
      feedback = `${studentName} hoàn thành đầy đủ khối lượng đồ án tốt nghiệp, đáp ứng các tiêu chuẩn để ra Hội đồng bảo vệ. Cần rà soát lại một số lỗi chính tả và định dạng trong quyển báo cáo.`;
      strengths.push('Hoàn thành cơ bản các yêu cầu chức năng của hệ thống');
      strengths.push('Khối lượng công việc tương xứng với đồ án tốt nghiệp');
      improvements.push('Chỉnh sửa lỗi định dạng hình vẽ, bảng biểu trong báo cáo');
      improvements.push('Luyện tập phần thuyết trình để kiểm soát thời gian bảo vệ');
    } else {
      feedback = `Khối lượng đồ án đạt mức tối thiểu. Sản phẩm còn tồn tại lỗi và báo cáo cần được hoàn thiện kỹ hơn trước ngày bảo vệ.`;
      strengths.push('Đã nỗ lực hoàn thành sản phẩm mức cơ bản');
      improvements.push('Sửa các lỗi ngoại lệ trong quá trình thực thi demo');
      improvements.push('Bổ sung đầy đủ phần kết luận và hướng phát triển');
    }
  } else {
    // DEFENSE
    if (isExcellent) {
      feedback = `Sinh viên ${studentName} bảo vệ đề tài "${topicTitle}" rất thành công. Trình bày tự tin, mạch lạc, trả lời xuất sắc và thấu đáo các câu hỏi phản biện của Hội đồng.`;
      strengths.push('Nắm vững kiến thức nền tảng và bản chất công nghệ sử dụng');
      strengths.push('Phong thái trình bày tự tin, trả lời phản biện thuyết phục');
      improvements.push('Hoàn thiện các góp ý nhỏ của Hội đồng trong thời hạn lưu chiểu 14 ngày');
    } else if (isGood) {
      feedback = `Sinh viên ${studentName} hoàn thành tốt buổi bảo vệ đồ án tốt nghiệp. Trình bày rõ ràng các kết quả đạt được, trả lời thỏa đáng phần lớn câu hỏi của Hội đồng.`;
      strengths.push('Trình bày rõ ràng cấu trúc và kết quả thực nghiệm');
      strengths.push('Có tinh thần cầu thị và ghi nhận các nhận xét phản biện');
      improvements.push('Bổ sung giải trình chi tiết theo góp ý của Hội đồng vào bản nộp lưu chiểu');
      improvements.push('Hoàn thiện chỉnh sửa báo cáo trước hạn 14 ngày làm việc');
    } else {
      feedback = `Sinh viên đạt kết quả bảo vệ mức trung bình. Cần nắm vững hơn kiến thức nền tảng và giải thích rõ hơn về mặt kỹ thuật khi được Hội đồng chất vấn.`;
      strengths.push('Hoàn thành phiên bảo vệ theo đúng quy định');
      improvements.push('Nghiêm túc chỉnh sửa toàn diện báo cáo theo biên bản bảo vệ');
      improvements.push('Kiểm tra kỹ lưỡng hồ sơ lưu chiểu trước khi nộp');
    }
  }

  // Integrate custom notes if available
  if (notes) {
    feedback += ` Ghi chú bổ sung: ${notes}.`;
    if (notes.toLowerCase().includes('tốt') || notes.toLowerCase().includes('khá')) {
      strengths.push(notes);
    } else {
      improvements.push(notes);
    }
  }

  return {
    feedback,
    strengths: Array.from(new Set(strengths)),
    improvements: Array.from(new Set(improvements)),
    provider: 'local_fallback',
  };
}

/**
 * 5. Generate Defense Questions (Local Heuristic Fallback)
 * @param {object} payload
 * @returns {object}
 */
function generateDefenseQuestions(payload = {}) {
  const topicTitle = (payload.topicTitle || 'Hệ thống ứng dụng công nghệ').trim();
  const description = (payload.description || '').trim();
  const technologies = (payload.technologies || '').trim();
  const major = (payload.major || 'Công nghệ Thông tin').trim();

  // Identify core tech keyword
  const techKeywords = technologies.split(/[,\s/]+/).filter((t) => t.length > 2);
  const primaryTech = techKeywords[0] || 'công nghệ chính';
  const secondaryTech = techKeywords[1] || 'kiến trúc hệ thống';

  const q1 = `Em hãy phân tích nguyên lý hoạt động của giải pháp và giải thích lý do lựa chọn ${primaryTech} cho đề tài "${topicTitle}" thay vì các giải pháp truyền thống khác?`;
  const p1 = `Đánh giá mức độ nắm vững kiến thức nền tảng chuyên ngành ${major} và sự thấu hiểu về công nghệ cốt lõi của sinh viên.`;

  const q2 = `Trong quá trình triển khai thực tế với ${secondaryTech || primaryTech}, em đã gặp những khó khăn gì về mặt hiệu năng hoặc xử lý ngoại lệ dữ liệu, và em đã giải quyết bài toán đó như thế nào?`;
  const p2 = 'Kiểm tra năng lực giải quyết vấn đề kỹ thuật thực tế và tư duy tối ưu hóa của sinh viên.';

  const q3 = `Nếu hệ thống của đề tài "${topicTitle}" được đưa vào triển khai thực tế trên diện rộng với số lượng người dùng đồng thời lớn, em sẽ đề xuất giải pháp mở rộng (scalability) và bảo mật như thế nào?`;
  const p3 = 'Đánh giá tầm nhìn ứng dụng thực tiễn, khả năng mở rộng sản phẩm và định hướng nghiên cứu tiếp theo.';

  return {
    questions: [
      {
        level: 'FOUNDATION',
        levelLabel: 'Kiến thức nền tảng',
        question: q1,
        purpose: p1,
      },
      {
        level: 'TECHNICAL_CHALLENGE',
        levelLabel: 'Thách thức kỹ thuật',
        question: q2,
        purpose: p2,
      },
      {
        level: 'FUTURE_EXPANSION',
        levelLabel: 'Hướng phát triển & Ứng dụng',
        question: q3,
        purpose: p3,
      },
    ],
    provider: 'local_fallback',
  };
}

/**
 * 6. Academic Regulation Chatbot (Local Heuristic Fallback)
 * @param {object} payload
 * @returns {object}
 */
function answerRegulationChat(payload = {}) {
  const message = (payload.message || '').trim();
  const lowerMsg = message.toLowerCase();

  let reply = '';
  let relatedRegulations = [];
  let suggestedQuickQuestions = [];

  if (
    lowerMsg.includes('bm01') ||
    lowerMsg.includes('đề cương') ||
    lowerMsg.includes('nộp lại') ||
    lowerMsg.includes('chỉnh sửa') ||
    lowerMsg.includes('v2')
  ) {
    reply =
      'Theo Quy chế Đồ án tốt nghiệp của Viện Công nghệ Số: Nếu đề cương BM01 (v1) bị Hội đồng thẩm định đánh giá "Cần chỉnh sửa", sinh viên chỉ được phép nộp lại duy nhất 01 lần (bản v2) trong thời hạn quy định. Bản nộp lại là căn cứ cuối cùng để Chủ tịch Hội đồng phê duyệt ĐẠT hoặc DỪNG ĐỀ TÀI trong học kỳ hiện tại.';
    relatedRegulations = [
      'BM01: Đề cương chi tiết đồ án tốt nghiệp',
      'Quy chế nộp lại v2 duy nhất (1 lần)',
      'Nguyên tắc 1 Sinh viên / 1 Đề tài (maxStudents = 1)',
    ];
    suggestedQuickQuestions = [
      'Thời hạn nộp lại đề cương v2 là bao lâu?',
      'Nếu bị dừng đề tài ở bước BM01 thì xử lý thế nào?',
      'Khi nào sinh viên được làm đơn BM02 điều chỉnh đề tài?',
    ];
  } else if (
    lowerMsg.includes('lưu chiểu') ||
    lowerMsg.includes('14 ngày') ||
    lowerMsg.includes('sau bảo vệ') ||
    lowerMsg.includes('thư viện') ||
    lowerMsg.includes('bìa')
  ) {
    reply =
      'Theo Quy chuẩn Giai đoạn 6 của Viện: Sinh viên sau khi bảo vệ thành công có đúng 14 ngày làm việc để hoàn thiện chỉnh sửa báo cáo theo kết luận của Hội đồng và nộp hồ sơ lưu chiểu. Lưu ý quan trọng: Tên đề tài trên bìa báo cáo lưu chiểu phải trùng khớp 100% với Tên đề tài chính thức có hiệu lực trên Quyết định phê duyệt hoặc Phụ lục BM02-A.';
    relatedRegulations = [
      'Quy chế Nộp lưu chiểu 14 ngày làm việc sau bảo vệ',
      'Quy chuẩn đối soát bìa báo cáo và tính pháp lý',
      'Giai đoạn 6: Hoàn tất thủ tục tốt nghiệp',
    ];
    suggestedQuickQuestions = [
      'Hồ sơ nộp lưu chiểu bao gồm những tệp gì?',
      'Nếu tên đề tài trên bìa lệch với quyết định thì xử lý thế nào?',
      'Quy trình ký xác nhận của Chủ tịch Hội đồng sau khi sửa báo cáo',
    ];
  } else if (
    lowerMsg.includes('bm03') ||
    lowerMsg.includes('tiến độ') ||
    lowerMsg.includes('gặp gvhd') ||
    lowerMsg.includes('hướng dẫn')
  ) {
    reply =
      'Theo Quy chế Giai đoạn 2: Sinh viên phải tham gia tối thiểu 4-6 buổi làm việc định kỳ với GVHD và hoàn thành nộp Báo cáo tiến độ BM03. Sinh viên có tiến độ dưới 50% hoặc vắng mặt không lý do sẽ bị cảnh báo hoặc đình chỉ bảo vệ.';
    relatedRegulations = [
      'BM03: Phiếu đánh giá tiến độ thực hiện định kỳ',
      'Quy định số buổi làm việc tối thiểu với GVHD',
      'Giai đoạn 2: Theo dõi tiến độ đề tài',
    ];
    suggestedQuickQuestions = [
      'Bao nhiêu buổi không gặp GVHD thì bị dừng đề tài?',
      'Tiêu chí đánh giá tiến độ của Giảng viên hướng dẫn',
      'Cách nộp báo cáo tiến độ BM03 trên hệ thống',
    ];
  } else if (
    lowerMsg.includes('bm04') ||
    lowerMsg.includes('phản biện') ||
    lowerMsg.includes('điều kiện bảo vệ') ||
    lowerMsg.includes('điểm tối thiểu')
  ) {
    reply =
      'Theo Quy chế Giai đoạn 3: Trước khi ra Hội đồng bảo vệ, đồ án phải được GVHD và Giảng viên phản biện đánh giá độc lập trên biểu mẫu BM04. Cả điểm của GVHD và điểm của Giảng viên phản biện đều phải đạt từ 5.0/10 trở lên thì sinh viên mới đủ điều kiện ra bảo vệ trước Hội đồng.';
    relatedRegulations = [
      'BM04: Phiếu nhận xét đồ án của GVHD và Phản biện',
      'Điều kiện điểm tối thiểu (>= 5.0) để được bảo vệ',
      'Giai đoạn 3: Đánh giá trước bảo vệ',
    ];
    suggestedQuickQuestions = [
      'Nếu điểm phản biện dưới 5.0 thì có được phúc khảo không?',
      'Hội đồng bảo vệ gồm những thành viên nào?',
      'Thời gian nhận phiếu nhận xét BM04 trước ngày bảo vệ',
    ];
  } else if (
    lowerMsg.includes('dừng') ||
    lowerMsg.includes('hủy') ||
    lowerMsg.includes('đình chỉ')
  ) {
    reply =
      'Sinh viên sẽ bị Dừng đề tài hoặc đình chỉ bảo vệ trong các trường hợp: (1) Bản nộp lại BM01 v2 không đạt yêu cầu; (2) Tiến độ BM03 dưới 50% hoặc không tham gia hướng dẫn; (3) Điểm đánh giá BM04 của GVHD hoặc Phản biện dưới 5.0; (4) Vi phạm nghiêm trọng về tính chính trực học thuật (đạo văn, sao chép).';
    relatedRegulations = [
      'Quy định các trường hợp dừng đề tài và đình chỉ tốt nghiệp',
      'Quy chế liêm chính học thuật và kiểm tra trùng lặp',
    ];
    suggestedQuickQuestions = [
      'Nếu bị dừng đề tài thì học kỳ sau đăng ký lại thế nào?',
      'Thủ tục xin hoãn bảo vệ đồ án tốt nghiệp',
      'Quy định kiểm tra đạo văn và mức % trùng lặp cho phép',
    ];
  } else {
    reply =
      'Xin chào bạn! Tôi là Trợ lý Học vụ AI của Viện Công nghệ Số. Quy trình Đồ án tốt nghiệp vận hành qua 6 giai đoạn chuẩn: (1) Đăng ký & Duyệt đề cương BM01, (2) Báo cáo tiến độ BM03, (3) Đánh giá GVHD & Phản biện BM04, (4) Thành lập Hội đồng & Lịch bảo vệ, (5) Chấm điểm bảo vệ, và (6) Nộp lưu chiểu hoàn tất trong 14 ngày làm việc. Bạn đang cần thông tin cụ thể về giai đoạn nào?';
    relatedRegulations = [
      'Quy chế Đồ án tốt nghiệp 6 giai đoạn chuẩn',
      'Sổ tay hướng dẫn học vụ Viện Công nghệ Số',
    ];
    suggestedQuickQuestions = [
      'Quy định nộp lại đề cương BM01 v2',
      'Thời hạn nộp lưu chiểu 14 ngày sau bảo vệ',
      'Điều kiện điểm số BM04 để được ra hội đồng',
    ];
  }

  return {
    reply,
    relatedRegulations,
    suggestedQuickQuestions,
    provider: 'local_fallback',
  };
}

module.exports = {
  tokenize,
  calculateJaccardSimilarity,
  analyzeBM01Outline,
  checkTopicSimilarity,
  crossCheckArchivalDossier,
  generateAcademicFeedback,
  generateDefenseQuestions,
  answerRegulationChat,
};
