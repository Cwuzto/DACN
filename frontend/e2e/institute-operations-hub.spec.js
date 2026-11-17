import { test, expect } from '@playwright/test';

const mockSemesters = [
  {
    id: 1,
    code: 'HK1-2627',
    name: 'Học kỳ 1 2026–2027',
    academicYear: '2026-2027',
    status: 'ACTIVE',
    isCurrent: true,
  },
  {
    id: 2,
    code: 'HK2-2627',
    name: 'Học kỳ 2 2026–2027',
    academicYear: '2026-2027',
    status: 'UPCOMING',
    isCurrent: false,
  },
];

const mockStudent = {
  id: 'usr-student-1',
  code: 'SV001',
  fullName: 'Sinh Viên Chuẩn Mẫu',
  email: 'student@tdmu.edu.vn',
  role: 'STUDENT',
  status: 'ACTIVE',
  permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_SUBMISSIONS', 'VIEW_MY_GRADES'],
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
    'VIEW_MENTORED_STUDENTS',
    'VIEW_CHECKPOINTS',
    'VIEW_BM04_EVALUATIONS',
  ],
};

const mockVienTruong = {
  id: 'usr-vientruong-1',
  code: 'VT001',
  fullName: 'PGS.TS. Viện Trưởng',
  email: 'vientruong@tdmu.edu.vn',
  role: 'LECTURER',
  status: 'ACTIVE',
  permissionGroups: ['VIEN_TRUONG'],
  permissions: [
    'VIEW_BM02_REVIEWS',
    'BM02_REVIEW',
    'BM03_STOP_REVIEW',
    'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
    'VIEW_ASSIGNMENT_DECISIONS',
    'PROJECT_ASSIGNMENT_PUBLISH',
    'VIEW_DEFENSE_RESULT_APPROVALS',
    'DEFENSE_RESULT_APPROVE',
    'VIEW_RESULT_PUBLICATIONS',
    'RESULT_PUBLICATION_PUBLISH',
    'VIEW_ACADEMIC_DELEGATIONS',
    'PERMISSION_ASSIGN_ACADEMIC',
  ],
};

const mockDelegatedViewOnly = {
  id: 'usr-delegate-view-1',
  code: 'GV099',
  fullName: 'TS. Giảng Viên Ủy Quyền Xem',
  email: 'delegate@tdmu.edu.vn',
  role: 'LECTURER',
  status: 'ACTIVE',
  permissions: [
    'VIEW_BM02_REVIEWS',
    'VIEW_RESULT_PUBLICATIONS',
  ],
  activeDelegations: [
    {
      id: 901,
      capabilityCode: 'VIEW_BM02_REVIEWS',
      semesterId: 1,
      status: 'ACTIVE',
    },
    {
      id: 902,
      capabilityCode: 'VIEW_RESULT_PUBLICATIONS',
      semesterId: 1,
      status: 'ACTIVE',
    },
  ],
};

async function setupInstituteRoutes(page, persona, options = {}) {
  const { control = { failOperations: false } } = options;

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: `mock-token-${persona.id}`, user: persona });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: persona, token: `mock-token-${persona.id}` }),
      });
    }

    if (path.includes('/semesters')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockSemesters }),
      });
    }

    if (path.includes('/notifications/my')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    if (path.includes('/institute/operations')) {
      if (control.failOperations) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Không thể tải hàng đợi điều hành học vụ' }),
        });
      }

      const tab = url.searchParams.get('tab') || 'review';
      const semesterId = Number(url.searchParams.get('semesterId') || 1);

      if (semesterId === 2) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              tab,
              semester: mockSemesters[1],
              items: [
                {
                  id: `hk2-${tab}-1`,
                  kind: 'BM02_REVIEW',
                  resourceId: 201,
                  registrationId: 201,
                  title: 'Hồ sơ HK2: SV201 - Lê Thị Học Kỳ Hai',
                  subtitle: 'Đề tài Học kỳ 2',
                  status: 'PENDING_REVIEW',
                  dueAt: null,
                  allowedActions: [],
                },
              ],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
              counts: { review: 1, decisions: 0, publish: 0 },
              generatedAt: '2026-11-18T09:00:00.000Z',
            },
          }),
        });
      }

      const itemsByTab = {
        review: [
          {
            id: 'bm02-101',
            kind: 'BM02_REVIEW',
            resourceId: 101,
            registrationId: 101,
            title: 'BM02 chờ thẩm định: SV001 - Nguyễn Văn A',
            subtitle: 'Đề tài Hệ thống quản lý đồ án',
            status: 'PENDING_REVIEW',
            dueAt: null,
            allowedActions: persona.permissions.includes('BM02_REVIEW') ? ['APPROVE_BM02', 'REJECT_BM02'] : [],
          },
        ],
        decisions: [
          {
            id: 'decision-201',
            kind: 'DEFENSE_RESULT_APPROVAL',
            resourceId: 201,
            registrationId: 201,
            title: 'Phê duyệt kết quả bảo vệ: SV002 - Trần Thị B',
            subtitle: 'Đề tài AI chẩn đoán hình ảnh',
            status: 'AWAITING_FINAL_APPROVAL',
            dueAt: null,
            allowedActions: persona.permissions.includes('DEFENSE_RESULT_APPROVE') ? ['APPROVE_DEFENSE_RESULT'] : [],
          },
        ],
        publish: [
          {
            id: 'publish-301',
            kind: 'RESULT_PUBLICATION',
            resourceId: 301,
            registrationId: 301,
            title: 'Công bố kết quả bảo vệ: SV003 - Phạm Văn C',
            subtitle: 'Đề tài Blockchain',
            status: 'APPROVED_PENDING_PUBLICATION',
            dueAt: null,
            allowedActions: persona.permissions.includes('RESULT_PUBLICATION_PUBLISH') ? ['PUBLISH_RESULT'] : [],
          },
        ],
      };

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tab,
            semester: mockSemesters[0],
            items: itemsByTab[tab] || [],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            counts: { review: 1, decisions: 1, publish: 1 },
            generatedAt: '2026-11-18T08:00:00.000Z',
          },
        }),
      });
    }

    if (path.includes('/evaluations/result-publications/preview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            eligible: [
              {
                registrationId: 301,
                studentCode: 'SV003',
                studentName: 'Phạm Văn C',
                topicTitle: 'Đề tài Blockchain',
                // Unpublished BM05 score must not be returned or rendered for view-only
              },
            ],
          },
        }),
      });
    }

    if (path.includes('/evaluations/result-publications/history')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

test.describe('Institute Operations Hub E2E', () => {
  test('blocks direct access for STUDENT and regular GVHD', async ({ page }) => {
    await setupInstituteRoutes(page, mockStudent);
    await page.goto('/lecturer/institute');
    await expect(page).not.toHaveURL(/\/lecturer\/institute/);

    await setupInstituteRoutes(page, mockGvhd);
    await page.goto('/lecturer/institute');
    await expect(page).not.toHaveURL(/\/lecturer\/institute/);
  });

  test('VIEN_TRUONG navigates from sidebar, switches 3 tabs, uses legacy deep links, and switches semesters', async ({ page }) => {
    await setupInstituteRoutes(page, mockVienTruong);

    await page.goto('/lecturer/dashboard');
    const hubMenu = page.locator('aside.sidebar button.nav-item:has-text("Điều hành học vụ")');
    await expect(hubMenu).toBeVisible();
    await hubMenu.click();

    await expect(page).toHaveURL(/\/lecturer\/institute/);
    await expect(page.locator('text=BM02 chờ thẩm định: SV001 - Nguyễn Văn A')).toBeVisible();

    // Switch to Decisions tab
    await page.locator('[role="tab"]:has-text("Quyết định")').click();
    await expect(page).toHaveURL(/tab=decisions/);
    await expect(page.locator('text=Phê duyệt kết quả bảo vệ: SV002 - Trần Thị B')).toBeVisible();

    // Switch to Publish tab
    await page.locator('[role="tab"]:has-text("Công bố")').click();
    await expect(page).toHaveURL(/tab=publish/);
    await expect(page.locator('text=Công bố kết quả bảo vệ: SV003 - Phạm Văn C')).toBeVisible();

    // Legacy deep links: ?tab=bm02Queue -> review, ?tab=periods -> decisions
    await page.goto('/lecturer/institute?tab=bm02Queue');
    await expect(page.locator('text=BM02 chờ thẩm định: SV001 - Nguyễn Văn A')).toBeVisible();

    await page.goto('/lecturer/institute?tab=periods');
    await expect(page.locator('text=Phê duyệt kết quả bảo vệ: SV002 - Trần Thị B')).toBeVisible();

    // Switch semester clears HK1 items and loads HK2 items
    await page.locator('.ant-select').first().click();
    await page.locator('.ant-select-item-option:has-text("Học kỳ 2 2026–2027")').click();
    await expect(page.locator('text=Hồ sơ HK2: SV201 - Lê Thị Học Kỳ Hai')).toBeVisible();
  });

  test('renders standardized error state on API failure and recovers on retry', async ({ page }) => {
    const control = { failOperations: true };
    await setupInstituteRoutes(page, mockVienTruong, { control });

    await page.goto('/lecturer/institute');
    const alertSection = page.locator('section[role="alert"]').first();
    await expect(alertSection).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Không thể tải hàng đợi điều hành học vụ').first()).toBeVisible();

    control.failOperations = false;
    await alertSection.locator('button:has-text("Thử lại")').click();
    await expect(page.locator('section[role="alert"]')).toHaveCount(0);
    await expect(page.locator('text=BM02 chờ thẩm định: SV001 - Nguyễn Văn A')).toBeVisible();
  });

  test('delegated view-only actor sees only authorized tabs without mutation buttons or unpublished BM05 scores', async ({ page }) => {
    await setupInstituteRoutes(page, mockDelegatedViewOnly);

    await page.goto('/lecturer/institute?tab=publish');
    await expect(page.locator('[role="tab"]:has-text("Thẩm định")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Công bố")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Quyết định")')).toHaveCount(0);

    await expect(page.locator('text=Công bố kết quả bảo vệ: SV003 - Phạm Văn C')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Công bố kết quả', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Công bố DS đủ ĐK', exact: true })).toHaveCount(0);
    await expect(page.locator('text=8.9')).toHaveCount(0);
  });
});
