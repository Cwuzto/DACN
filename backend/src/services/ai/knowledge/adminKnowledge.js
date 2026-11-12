/**
 * TÀI LIỆU TRI THỨC QUẢN TRỊ DÀNH CHO VIỆN, QUẢN TRỊ VIÊN VÀ GIÁO VỤ
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Phân quyền: Cấp cho ADMIN, Ban Chủ nhiệm Viện (VIEN_TRUONG), và Giảng viên có quyền Giáo vụ.
 *
 * Single Source of Truth: Nạp tự động từ tệp Markdown docs/admin_regulations.md
 */

const { loadKnowledgeTextByRole } = require('./knowledgeParser');

const adminKnowledge = loadKnowledgeTextByRole('ADMIN');

module.exports = { adminKnowledge };
