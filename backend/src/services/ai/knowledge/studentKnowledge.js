/**
 * TÀI LIỆU TRI THỨC HỌC VỤ CÔNG KHAI DÀNH CHO SINH VIÊN
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Quy tắc: 1 Sinh viên / 1 Đề tài (maxStudents = 1), 1 GVHD tối đa 10 Sinh viên.
 *
 * Single Source of Truth: Nạp tự động từ tệp Markdown docs/student_regulations.md
 */

const { loadKnowledgeTextByRole } = require('./knowledgeParser');

const studentKnowledge = loadKnowledgeTextByRole('STUDENT');

module.exports = { studentKnowledge };
