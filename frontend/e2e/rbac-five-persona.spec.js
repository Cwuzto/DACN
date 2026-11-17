/**
 * Five-Persona Playwright E2E Authorization Tests (Task 10)
 *
 * Verifies end-to-end browser behavior for 5 personas:
 * 1. STUDENT
 * 2. GVHD (Lecturer / Mentor)
 * 3. GIAO_VU (Academic Affairs Administrator)
 * 4. VIEN_TRUONG (Institute Director)
 * 5. QUAN_TRI_VIEN (Technical System Administrator)
 *
 * Checks:
 * - Sidebar navigation visibility conforming to persona permissions.
 * - Role label rendering in topbar.
 * - Route guarding: authorized paths load, unauthorized direct URL visits are blocked/redirected.
 */

import { test, expect } from '@playwright/test';

// ----------------------------------------------------
// Mock Personas
// ----------------------------------------------------
const mockStudent = {
  id: 'usr-student-1',
  code: 'SV001',
  fullName: 'Sinh Viên Chuẩn Mẫu',
  email: 'student@tdmu.edu.vn',
  role: 'STUDENT',
  status: 'ACTIVE',
  permissions: [
    'VIEW_MY_REGISTRATION',
    'REGISTER_TOPIC',
    'RENAME_TOPIC',
    'REGISTRATION_CANCEL',
    'VIEW_MY_SUBMISSIONS',
    'SUBMIT_BM01',
    'SUBMIT_BM02',
    'SUBMIT_TASK',
    'CHECKPOINT_SIGN',
    'SIGNATURE_APPEAL_SUBMIT',
    'VIEW_MY_ARCHIVE',
    'SUBMIT_PRE_DEFENSE_ARCHIVE',
    'SUBMIT_FINAL_ARCHIVE',
    'VIEW_MY_GRADES',
  ],
};

const mockGvhd = {
  id: 'usr-gvhd-1',
  code: 'GV001',
  fullName: 'TS. Giảng Viên Hướng Dẫn',
  email: 'gvhd@tdmu.edu.vn',
  role: 'LECTURER',
  status: 'ACTIVE',
  permissions: [
    'VIEW_MY_TOPICS',
    'TOPIC_CREATE',
    'TOPIC_UPDATE_OWN',
    'VIEW_MENTORED_STUDENTS',
    'VIEW_MENTOR_STUDENTS',
    'MENTOR_REQUEST_REVIEW',
    'BM02A_ADVISOR_SIGN',
    'VIEW_CHECKPOINTS',
    'CHECKPOINT_ISSUE',
    'BM03_REVIEW',
    'BM04_SUBMIT',
    'BM04_CREATE_AND_SIGN',
  ],
  hasDefenseCouncilAssignment: false,
  hasOutlineCouncilAssignment: false,
};

const mockGiaoVu = {
  id: 'usr-giaovu-1',
  code: 'GVU001',
  fullName: 'ThS. Giáo Vụ Học Vụ',
  email: 'giaovu@tdmu.edu.vn',
  role: 'ADMIN',
  status: 'ACTIVE',
  permissions: [
    'REPORT_VIEW',
    'VIEW_PROJECT_PERIODS',
    'SEMESTER_MANAGE',
    'VIEW_PROJECT_ENROLLMENTS',
    'ENROLLMENT_MANAGE',
    'MENTOR_ASSIGN',
    'MENTOR_ASSIGNMENT_ADJUST',
    'VIEW_ALL_TOPICS',
    'TOPIC_REVIEW',
    'VIEW_PROJECT_OVERSIGHT',
    'PROJECT_OVERSIGHT_MANAGE',
    'OUTLINE_COUNCIL_MANAGE',
    'DEFENSE_COUNCIL_MANAGE',
    'VIEW_COUNCIL_ASSIGNMENTS',
    'VIEW_DEFENSE_LOCK_LEDGER',
    'RESULT_LOCK',
    'DEFENSE_SCOREBOOK_RETURN',
    'VIEW_RUBRIC_CONFIG',
    'RUBRIC_MANAGE',
    'VIEW_PORTAL_CONTENT',
    'PORTAL_CONTENT_MANAGE',
    'VIEW_NOTIFICATIONS',
    'NOTIFICATION_MANAGE',
  ],
};

const mockVienTruong = {
  id: 'usr-vientruong-1',
  code: 'VT001',
  fullName: 'PGS.TS. Viện Trưởng',
  email: 'vientruong@tdmu.edu.vn',
  role: 'ADMIN',
  status: 'ACTIVE',
  permissionGroups: ['VIEN_TRUONG'],
  permissions: [
    'REPORT_VIEW',
    'VIEW_PROJECT_OVERSIGHT',
    'VIEW_DEFENSE_RESULT_APPROVALS',
    'DEFENSE_RESULT_APPROVE',
    'VIEW_RESULT_PUBLICATIONS',
    'RESULT_PUBLICATION_PUBLISH',
    'PROJECT_ASSIGNMENT_PUBLISH',
    'VIEW_ACADEMIC_DELEGATIONS',
    'ACADEMIC_DELEGATION_MANAGE',
    'VIEW_DEFENSE_LOCK_LEDGER',
  ],
};

const mockQuanTriVien = {
  id: 'usr-admin-1',
  code: 'QTV001',
  fullName: 'Kỹ Sư Quản Trị Viên',
  email: 'admin@tdmu.edu.vn',
  role: 'ADMIN',
  status: 'ACTIVE',
  permissions: [
    'VIEW_USERS',
    'USER_MANAGE',
    'USER_IMPORT',
    'VIEW_PERMISSIONS',
    'VIEW_PERMISSION_GROUPS',
    'PERMISSION_GROUP_MANAGE',
    'VIEW_ANNOUNCEMENTS',
    'PUBLIC_ANNOUNCEMENT_MANAGE',
    'VIEW_PORTAL_CONTENT',
    'PORTAL_CONTENT_MANAGE',
    'VIEW_NOTIFICATIONS',
    'NOTIFICATION_MANAGE',
    'REPORT_VIEW',
  ],
};

// ----------------------------------------------------
// Helper: Setup Mock Persona Session and Common APIs
// ----------------------------------------------------
async function setupPersonaSession(page, persona) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: `mock-token-${persona.role.toLowerCase()}`, user: persona });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: persona, token: `mock-token-${persona.role.toLowerCase()}` }),
      });
    }

    if (path.includes('/semesters')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              name: 'Học kỳ 1 2026–2027',
              academicYear: '2026-2027',
              status: 'ACTIVE',
              isCurrent: true,
            },
          ],
        }),
      });
    }

    if (path.includes('/notifications/my')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    if (path.includes('/dashboard/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalStudents: 100,
            totalLecturers: 25,
            totalTopics: 60,
            completedTopics: 30,
            pendingRegistrations: 4,
            unassignedRegistrations: 1,
            upcomingDefenses: 5,
          },
        }),
      });
    }

    if (path.includes('/dashboard/student')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hasRegistration: true,
            registration: {
              id: 1,
              topic: { title: 'Đề tài mẫu khóa luận tốt nghiệp' },
              status: 'APPROVED',
            },
            progressPercentage: 50,
          },
        }),
      });
    }

    if (path.includes('/dashboard/scores') || path.includes('/dashboard/activities') || path.includes('/dashboard/semester-overview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    if (path.includes('/users')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'usr-1',
              code: 'GV001',
              fullName: 'TS. Nguyễn Văn Thầy',
              email: 'thaynv@tdmu.edu.vn',
              role: 'LECTURER',
              status: 'ACTIVE',
            },
          ],
          pagination: { total: 1, page: 1, limit: 10 },
        }),
      });
    }

    if (path.includes('/registrations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    // Default 200 OK fallback
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

// ----------------------------------------------------
// Test Suites
// ----------------------------------------------------
test.describe('Five-Persona RBAC & UI Matrix Tests', () => {

  test('1. STUDENT Persona: accesses student workspace, sees student menu, blocked from admin routes', async ({ page }) => {
    await setupPersonaSession(page, mockStudent);

    await page.goto('/student/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();

    // Verify student menu items are visible
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Tìm & đăng ký đề tài")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Hồ sơ & nộp bài")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Kết quả & điểm đồ án")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Nộp hồ sơ lưu chiểu")')).toBeVisible();

    // Verify admin and lecturer items are NOT present
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Người dùng")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Đề tài phụ trách")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Đợt đồ án & học kỳ")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")')).toHaveCount(0);

    // Direct navigation to admin or institute routes must be blocked and redirected
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);
    await page.goto('/lecturer/institute');
    await expect(page).not.toHaveURL(/\/lecturer\/institute/);
  });

  test('2. GVHD Persona: accesses lecturer workspace, sees mentoring menus, BM02-A deep link works, blocked from admin/institute', async ({ page }) => {
    await setupPersonaSession(page, mockGvhd);

    await page.goto('/lecturer/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();

    // Role display in topbar
    await expect(page.locator('.topbar-left:has-text("Giảng viên")')).toBeVisible();

    // Verify lecturer menus
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Đề tài phụ trách")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Duyệt nguyện vọng")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Sinh viên đang hướng dẫn")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Theo dõi tiến độ")')).toBeVisible();

    // Verify unassigned council and institute menus are NOT present
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Phiếu chấm bảo vệ")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Thẩm định đề cương")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")')).toHaveCount(0);

    // Verify admin items are NOT present
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Người dùng")')).toHaveCount(0);

    // Legacy BM02-A deep link redirects to dedicated TitleAdjustmentPage for GVHD
    await page.goto('/lecturer/approvals?tab=bm02a');
    await expect(page).toHaveURL(/\/lecturer\/title-adjustments/);

    // Direct navigation to admin user management or institute hub must be blocked
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);
    await page.goto('/lecturer/institute');
    await expect(page).not.toHaveURL(/\/lecturer\/institute/);
  });

  test('3. GIAO_VU Persona: accesses academic coordination menus, cannot see user management or institute hub', async ({ page }) => {
    await setupPersonaSession(page, mockGiaoVu);

    await page.goto('/admin/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();

    // Role display in topbar
    await expect(page.locator('.topbar-left:has-text("Quản trị viên")')).toBeVisible();

    // Verify academic coordination menus
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Đợt đồ án & học kỳ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều phối sinh viên")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Danh mục đề tài")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Giám sát tiến độ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Báo cáo học vụ")')).toBeVisible();

    // System administration and institute hub menus must NOT be present
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Người dùng")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Phân quyền")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")')).toHaveCount(0);

    // Direct navigation to /admin/users must be blocked
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);
  });

  test('4. VIEN_TRUONG Persona: displays Viện trưởng role, sees Điều hành học vụ and independent report/oversight menus, blocked from technical admin', async ({ page }) => {
    await setupPersonaSession(page, mockVienTruong);

    await page.goto('/admin/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();

    // Role display in topbar must show "Viện trưởng"
    await expect(page.locator('.topbar-left:has-text("Viện trưởng")')).toBeVisible();

    // Verify executive / institute hub & independent oversight/report menus
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Giám sát tiến độ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Báo cáo học vụ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Sổ điểm bảo vệ")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Phê duyệt kết quả")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Công bố kết quả học kỳ")')).toBeVisible();

    // System admin user management must NOT be present
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Người dùng")')).toHaveCount(0);
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Phân quyền")')).toHaveCount(0);

    // Direct navigation to user management must be blocked
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);
  });

  test('5. QUAN_TRI_VIEN Persona: accesses system admin menus, can navigate to user management, blocked from student space', async ({ page }) => {
    await setupPersonaSession(page, mockQuanTriVien);

    await page.goto('/admin/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();

    // Role display in topbar
    await expect(page.locator('.topbar-left:has-text("Quản trị viên")')).toBeVisible();

    // Verify system admin menus
    const userMenuButton = page.locator('aside.sidebar button.nav-item:has-text("Người dùng")');
    await expect(userMenuButton).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Phân quyền")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Bản tin công khai")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Biểu mẫu & nội dung")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Thông báo tài khoản")')).toBeVisible();
    await expect(page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")')).toHaveCount(0);

    // Navigate to User Management
    await userMenuButton.click();
    await expect(page).toHaveURL(/\/admin\/users/);

    // Direct navigation to student dashboard must be blocked
    await page.goto('/student/dashboard');
    await expect(page).not.toHaveURL(/\/student\/dashboard/);
  });

});

