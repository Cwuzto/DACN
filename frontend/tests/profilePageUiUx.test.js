import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readBuffer = (relativePath) => fs.readFileSync(path.join(root, relativePath));

const TARGET_FILES = [
    'src/pages/common/ProfilePage.jsx',
    'src/components/profile/ProfileIdentityCard.jsx',
    'src/components/profile/LecturerTopicList.jsx',
    'src/components/profile/StudentThesisProgressCard.jsx',
    'src/components/profile/LecturerAcademicInfoTab.jsx',
    'src/components/profile/PasswordSecurityTab.jsx',
    'src/components/profile/PasswordStrengthMeter.jsx',
];

test('Profile Redesign: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        assert.ok(fs.existsSync(fullPath), `Tệp ${filePath} phải tồn tại`);
        const buffer = readBuffer(filePath);
        const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.strictEqual(hasBom, false, `Tệp ${filePath} không được chứa BOM`);
    });
});

test('Profile Redesign: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const forbiddenSymbols = ['←', '→', '+', '🤖', '📋', '✓', '✏️', '👥', '🗑️', '🔓', '▾', '▴', '↗', '⚡', '🔐', '🛡️', '📊'];

    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        if (!fs.existsSync(fullPath)) return;
        const source = read(filePath);
        const buttonMatches = source.match(/<Button\b[^>]*>[\s\S]*?<\/Button>/g) || [];
        buttonMatches.forEach((btn) => {
            forbiddenSymbols.forEach((sym) => {
                assert.ok(
                    !btn.includes(sym),
                    `Nút bấm trong ${filePath} chứa ký tự thô/emoji cấm '${sym}': ${btn}`
                );
            });
        });
    });
});

test('Profile Redesign: Two-Column Split Layout & ProfileIdentityCard render cover banner, avatar, and institutional badges', () => {
    const pageSource = read('src/pages/common/ProfilePage.jsx');
    assert.match(pageSource, /ProfileIdentityCard/, 'ProfilePage phải tích hợp ProfileIdentityCard ở cột trái');
    assert.match(pageSource, /lg:grid-cols-12/, 'ProfilePage phải dùng lưới 2 cột bất đối xứng');

    const cardSource = read('src/components/profile/ProfileIdentityCard.jsx');
    assert.match(cardSource, /bg-gradient-to-r|cover/i, 'Phải có gradient bìa học thuật');
    assert.match(cardSource, /ring-|border-white|shadow/i, 'Avatar phải có hiệu ứng viền nổi');
    assert.match(cardSource, /Viện Công nghệ số/i, 'Phải có định danh Viện Công nghệ số');
    assert.match(cardSource, /Trường Đại học Thủ Dầu Một/i, 'Phải có định danh Trường Đại học Thủ Dầu Một');
    assert.match(cardSource, /Badge\s+status="success"|Đang hoạt động/i, 'Phải có chỉ báo trạng thái hoạt động');
});

test('Profile Redesign: Lecturer Experience integrates LecturerTopicList with Semester Filter, Sorting, and Capacity Bar', () => {
    const pageSource = read('src/pages/common/ProfilePage.jsx');
    assert.match(pageSource, /LecturerTopicList/, 'ProfilePage phải tích hợp LecturerTopicList cho Giảng viên');
    assert.match(pageSource, /teaching_info/, 'Phải có tab teaching_info');
    assert.match(pageSource, /supervised_topics/, 'Phải có tab supervised_topics');

    const topicListSource = read('src/components/profile/LecturerTopicList.jsx');
    // Filters and Sorting
    assert.match(topicListSource, /Đợt đồ án|Học kỳ|useSemesters/i, 'Phải có bộ lọc theo Đợt đồ án');
    assert.match(topicListSource, /attention|latest|studentNameAsc|topicTitleAsc/, 'Phải có các tùy chọn sắp xếp');
    assert.match(topicListSource, /SearchOutlined|Tìm tên đề tài/i, 'Phải có ô tìm kiếm tức thì');
    // Capacity metrics
    assert.match(topicListSource, /Tải lượng hướng dẫn|Chỉ tiêu/i, 'Phải có khối tóm tắt tải lượng');
    assert.match(topicListSource, /Progress/, 'Phải có thanh tiến trình công suất');
    // Topic status badge
    assert.match(topicListSource, /IN_PROGRESS_BM03|Đang làm đồ án/i, 'Phải hiển thị tiến độ BM03');
    assert.match(topicListSource, /STOP_REVIEW_PENDING|Cảnh báo/i, 'Phải hiển thị cảnh báo đề xuất dừng');
});

test('Profile Redesign: Student Experience integrates StudentThesisProgressCard with 5-Step Stepper & Mentor Contact', () => {
    const pageSource = read('src/pages/common/ProfilePage.jsx');
    assert.match(pageSource, /StudentThesisProgressCard/, 'ProfilePage phải tích hợp StudentThesisProgressCard cho Sinh viên');
    assert.match(pageSource, /student_thesis/, 'Phải có tab student_thesis');
    // Sinh viên không có tab quyền hạn quản trị thừa
    assert.ok(!pageSource.includes("isStudent && 'roles_permissions'"), 'Sinh viên không được hiển thị tab quyền hạn quản trị');

    const studentCardSource = read('src/components/profile/StudentThesisProgressCard.jsx');
    // 5-Step Stepper
    assert.match(studentCardSource, /Steps/, 'Phải dùng Ant Design Steps cho thanh tiến trình');
    assert.match(studentCardSource, /Đề cương BM01/, 'Bước 1: Đề cương BM01');
    assert.match(studentCardSource, /Giao đề tài BM02/, 'Bước 2: Giao đề tài BM02');
    assert.match(studentCardSource, /Tiến độ BM03|Nhật ký BM03/, 'Bước 3: Tiến độ BM03');
    assert.match(studentCardSource, /Đánh giá BM04/, 'Bước 4: Đánh giá BM04');
    assert.match(studentCardSource, /Bảo vệ & Lưu chiểu/, 'Bước 5: Bảo vệ & Lưu chiểu');
    // Mentor contact
    assert.match(studentCardSource, /Giảng viên hướng dẫn|GVHD/i, 'Phải có thẻ liên hệ GVHD');
    assert.match(studentCardSource, /mailto:|tel:/, 'Phải có liên kết email/SĐT liên hệ trực tiếp');
});

test('Profile Redesign: Standardized Institutional Entities and Academic Boundaries', () => {
    const cardSource = read('src/components/profile/ProfileIdentityCard.jsx');
    assert.match(cardSource, /Trường Đại học Thủ Dầu Một/, 'Phải hiển thị Trường Đại học Thủ Dầu Một');
    assert.match(cardSource, /Viện Công nghệ số/, 'Phải hiển thị Viện Công nghệ số');
    assert.match(cardSource, /Khóa/, 'Phải hiển thị mục Khóa sinh viên');
    assert.match(cardSource, /Lớp hành chính/, 'Phải hiển thị mục Lớp hành chính');
    assert.match(cardSource, /Bộ môn/, 'Phải hiển thị mục Bộ môn');

    const academicSource = read('src/components/profile/LecturerAcademicInfoTab.jsx');
    assert.match(academicSource, /Hướng nghiên cứu & Lĩnh vực chuyên sâu|researchInterests/i, 'Phải có mục hướng nghiên cứu chuyên môn');
    assert.match(academicSource, /Hội đồng Xét duyệt Đề cương|Hội đồng Chấm Bảo vệ/i, 'Phải có thông tin Hội đồng chuyên môn');
});

test('Profile Redesign: PasswordSecurityTab integrates PasswordStrengthMeter and session information', () => {
    const securitySource = read('src/components/profile/PasswordSecurityTab.jsx');
    assert.match(securitySource, /PasswordStrengthMeter/, 'PasswordSecurityTab phải tích hợp PasswordStrengthMeter');
    assert.match(securitySource, /Phiên làm việc|JWT|Thời hạn phiên|Ghi nhớ/i, 'Phải có thông tin phiên làm việc JWT');

    const meterSource = read('src/components/profile/PasswordStrengthMeter.jsx');
    assert.match(meterSource, /Yếu|Trung bình|Mạnh/i, 'PasswordStrengthMeter phải hiển thị 3 cấp độ độ mạnh');
    assert.match(meterSource, /Progress/, 'PasswordStrengthMeter phải dùng Progress bar');
});
