/**
 * TÀI LIỆU TRI THỨC HỌC VỤ NỘI BỘ DÀNH CHO GIẢNG VIÊN & HỘI ĐỒNG
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Phân quyền: Chỉ cấp cho LECTURER, Ban Chủ nhiệm Viện, Giáo vụ và Hội đồng.
 *
 * Single Source of Truth: Nạp tự động từ tệp Markdown docs/lecturer_regulations.md
 */

const { loadKnowledgeTextByRole } = require('./knowledgeParser');

const lecturerKnowledge = loadKnowledgeTextByRole('LECTURER');

module.exports = { lecturerKnowledge };
