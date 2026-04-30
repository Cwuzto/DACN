const fs = require('fs');

const pathCouncil = 'd:/DACN/backend/src/controllers/councilController.js';
let contentCouncil = fs.readFileSync(pathCouncil, 'utf8');

const replacementsCouncil = {
  "KhĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â´ng tĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¬m thÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚ÂºĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¥y hÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â€šÂ¬Ă‚ÂžÄ‚â€šĂ‚Â¢i Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¹Ă…â€œÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¦Ă¢â‚¬Å“ng.": "Không tìm thấy hội đồng.",
  "KhĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â´ng thÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ¢â‚¬Â Ä‚Â¢Ă¢â€šÂ¬Ă¢â€žÂ¢ xĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â³a hÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â€šÂ¬Ă‚ÂžÄ‚â€šĂ‚Â¢i Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¹Ă…â€œÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¦Ă¢â‚¬Å“ng Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¹Ă…â€œĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â£ cĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â³ sinh viĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Âªn Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¹Ă…â€œÄ‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚Â Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â°Ä‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â£c phĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¢n cĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â´ng.": "Không thể xóa hội đồng đã có sinh viên được phân công.",
  "Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â Ă„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â£ xĂ„â€šĂ¢â‚¬ÂžÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂšĂ„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â³a hÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â€šÂ¬Ă‚ÂžÄ‚â€šĂ‚Â¢i Ä‚â€žĂ¢â‚¬ÂšÄ‚Â¢Ă¢â€šÂ¬Ă‚ÂžĂ„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¹Ă…â€œÄ‚â€žĂ¢â‚¬ÂšÄ‚â€šĂ‚Â¡Ă„â€šĂ¢â‚¬ÂšÄ‚â€šĂ‚Â»Ă„â€šĂ‚Â¢Ä‚Â¢Ă¢â‚¬ÂšĂ‚Â¬Ä‚â€¦Ă¢â‚¬Å“ng.": "Đã xóa hội đồng."
};

for (const [bad, good] of Object.entries(replacementsCouncil)) {
  contentCouncil = contentCouncil.replace(bad, good);
}

fs.writeFileSync(pathCouncil, contentCouncil, 'utf8');

const pathEval = 'd:/DACN/backend/src/controllers/evaluationController.js';
let contentEval = fs.readFileSync(pathEval, 'utf8');

const replacementsEval = {
  "Ă„Â iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡ Ă„â€˜Ä‚Â£ Ă„â€˜Ă†Â°Ă¡Â»Â£c cĂ¡ÂºÂ­p nhĂ¡ÂºÂ­t": "Điểm bảo vệ đã được cập nhật",
  "Ă„Â iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡ Ă„â€˜Ă¡Â»Â  tÄ‚Â i \"${updated.registration.topic?.title || 'N/A'}\" Ă„â€˜Ä‚Â£ Ă„â€˜Ă†Â°Ă¡Â»Â£c cĂ¡ÂºÂ­p nhĂ¡ÂºÂ­t: ${validScore.finalScore}.": "Điểm bảo vệ đề tài \"${updated.registration.topic?.title || 'N/A'}\" đã được cập nhật: ${validScore.finalScore}.",
  "Ă„Â Ä‚Â£ lĂ†Â°u bĂ¡ÂºÂ£ng Ă„â€˜iĂ¡Â»Æ’m online.": "Đã lưu bảng điểm online.",
  "Vui lÄ‚Â²ng nhĂ¡ÂºÂ­p Ă„â€˜iĂ¡Â»Æ’m cho sinh viÄ‚Âªn ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - Ă„â€˜Ă¡Â»Â  tÄ‚Â i \"${reg.topic?.title || 'N/A'}\" tĂ¡ÂºÂ¡i hĂ¡Â»â„¢i Ă„â€˜Ă¡Â»â€œng ${reg.council.name}.": "Vui lòng nhập điểm cho sinh viên ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - đề tài \"${reg.topic?.title || 'N/A'}\" tại hội đồng ${reg.council.name}.",
  "Ă„Â Ä‚Â£ gĂ¡Â»Â­i nhĂ¡ÂºÂ¯c chĂ¡ÂºÂ¥m Ă„â€˜iĂ¡Â»Æ’m cho ${sent} hĂ¡Â»â€œ sĂ†Â¡.": "Đã gửi nhắc chấm điểm cho ${sent} hồ sơ.",
  "Ă„Â Ä‚Â£ khÄ‚Â³a Ă„â€˜iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡.": "Đã khóa điểm bảo vệ.",
  "Ă„Â Ä‚Â£ mĂ¡Â»Å¸ khÄ‚Â³a Ă„â€˜iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡.": "Đã mở khóa điểm bảo vệ.",
  "registrationId khÄ‚Â´ng hĂ¡Â»Â£p lĂ¡Â»â€¡.": "registrationId không hợp lệ.",
  "KhÄ‚Â´ng tÄ‚Â¬m thĂ¡ÂºÂ¥y Ă„â€˜Ă„Æ’ng kÄ‚Â½.": "Không tìm thấy đăng ký.",
  "HĂ¡Â»â€œ sĂ†Â¡ chĂ†Â°a cÄ‚Â³ Ă„â€˜iĂ¡Â»Æ’m hĂ¡Â»Â£p lĂ¡Â»â€¡ Ă„â€˜Ă¡Â»Æ’ xuĂ¡ÂºÂ¥t PDF.": "Hồ sơ chưa có điểm hợp lệ để xuất PDF.",
  "Ă„Â Ä‚Â£ xuĂ¡ÂºÂ¥t bĂ¡ÂºÂ£ng Ă„â€˜iĂ¡Â»Æ’m PDF thÄ‚Â nh cÄ‚Â´ng.": "Đã xuất bảng điểm PDF thành công.",
  "Vui lÄ‚Â²ng nhĂ¡ÂºÂ­p Ă„â€˜Ă¡ÂºÂ§y Ă„â€˜Ă¡Â»Â§ thÄ‚Â´ng tin.": "Vui lòng nhập đầy đủ thông tin.",
  "KhÄ‚Â´ng tÄ‚Â¬m thĂ¡ÂºÂ¥y Ă„â€˜Ă„Æ’ng kÄ‚Â½ Ă„â€˜Ă¡Â»Â  tÄ‚Â i.": "Không tìm thấy đăng ký đề tài.",
  "BĂ¡ÂºÂ£ng Ă„â€˜iĂ¡Â»Æ’m Ă„â€˜Ä‚Â£ khÄ‚Â³a, khÄ‚Â´ng thĂ¡Â»Æ’ cĂ¡ÂºÂ­p nhĂ¡ÂºÂ­t.": "Bảng điểm đã khóa, không thể cập nhật.",
  "Ă„Â iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡ Ă„â€˜Ă¡Â»â€œ Ä‚Â¡n": "Điểm bảo vệ đồ án",
  "Ă„Â iĂ¡Â»Æ’m bĂ¡ÂºÂ£o vĂ¡Â»â€¡ Ă„â€˜Ă¡Â»Â  tÄ‚Â i \"${registration.topic.title}\" Ă„â€˜Ä‚Â£ Ă„â€˜Ă†Â°Ă¡Â»Â£c cĂ¡ÂºÂ­p nhĂ¡ÂºÂ­t: ${parsedScore} Ă„â€˜iĂ¡Â»Æ’m.": "Điểm bảo vệ đề tài \"${registration.topic.title}\" đã được cập nhật: ${parsedScore} điểm."
};

for (const [bad, good] of Object.entries(replacementsEval)) {
  contentEval = contentEval.replace(bad, good);
}

fs.writeFileSync(pathEval, contentEval, 'utf8');
console.log('Fixed additional mojibakes in councilController.js and evaluationController.js');
