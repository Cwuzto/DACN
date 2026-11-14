import { test, expect } from '@playwright/test';

const mockAdminUser = {
  id: 'usr-admin-1',
  code: 'AD001',
  fullName: 'Quản trị viên Hệ thống',
  email: 'admin@tdmu.edu.vn',
  role: 'ADMIN',
  status: 'ACTIVE',
  permissions: [
    'VIEW_USERS',
    'USER_MANAGE',
    'PERMISSION_GROUP_MANAGE',
    'VIEW_PROJECT_PERIODS',
    'SEMESTER_MANAGE',
    'VIEW_ALL_TOPICS',
    'TOPIC_REVIEW',
    'VIEW_PROJECT_OVERSIGHT',
    'REPORT_VIEW',
    'PROJECT_OVERSIGHT_MANAGE',
    'VIEW_DEFENSE_LOCK_LEDGER',
    'VIEW_RESULT_LOCKS',
    'DEFENSE_SCORE_VIEW',
    'RESULT_LOCK',
    'VIEW_DEFENSE_RESULT_APPROVALS',
    'VIEW_DEFENSE_RESULTS_APPROVAL',
    'DEFENSE_RESULT_APPROVE',
    'VIEW_RESULT_PUBLICATIONS',
    'RESULT_PUBLICATION_PUBLISH',
    'VIEW_RUBRIC_CONFIG',
    'RUBRIC_MANAGE',
    'VIEW_COUNCIL_ASSIGNMENTS',
    'OUTLINE_COUNCIL_MANAGE',
    'DEFENSE_COUNCIL_MANAGE',
    'VIEW_DEFENSE_GRADING',
    'OUTLINE_REVIEW',
    'VIEW_PROJECT_ENROLLMENTS',
    'ENROLLMENT_MANAGE',
    'PROJECT_CATALOG_MANAGE',
    'PERMISSION_ASSIGN_ACADEMIC',
    'MENTOR_ASSIGN',
    'VIEW_ANNOUNCEMENTS',
    'PUBLIC_ANNOUNCEMENT_MANAGE',
    'VIEW_PORTAL_CONTENT',
    'PORTAL_CONTENT_MANAGE',
    'VIEW_PERMISSIONS',
    'VIEW_NOTIFICATIONS',
    'NOTIFICATION_MANAGE',
  ],
};

const setupAdminAuthAndRoutes = async (page) => {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    window.__pageLoads = (window.__pageLoads || 0) + 1;
  }, { token: 'mock-admin-token', user: mockAdminUser });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockAdminUser, token: 'mock-admin-token' }),
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
            totalStudents: 120,
            totalLecturers: 35,
            totalTopics: 80,
            completedTopics: 45,
            pendingRegistrations: 5,
            unassignedRegistrations: 2,
            upcomingDefenses: 8,
          },
        }),
      });
    }

    if (path.includes('/dashboard/scores')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { grade: 'A', count: 25 },
            { grade: 'B', count: 40 },
          ],
        }),
      });
    }

    if (path.includes('/dashboard/activities')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    if (path.includes('/dashboard/semester-overview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            topics: { total: 40 },
            registrations: { total: 100, pending: 5, completed: 80 },
          },
        }),
      });
    }

    if (path.includes('/permissions/permission-groups')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    if (path.includes('/permissions/permissions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }

    // Default fallback
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
};

test.describe('Navigation and Shell Persistence', () => {
  test('header and sidebar retain DOM identity during menu navigation without full document reload', async ({ page }) => {
    await setupAdminAuthAndRoutes(page);

    await page.route('**/api/users**', async (route) => {
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
    });

    await page.goto('/admin/dashboard');

    await expect(page.locator('h1:has-text("Trung Tâm Điều Hành & Quản Trị Học Vụ")')).toBeVisible();
    await expect(page.locator('aside.sidebar')).toBeVisible();
    await expect(page.locator('header.topbar')).toBeVisible();

    await page.evaluate(() => {
      window.__e2eNavMarker = 'shell-persisted';
      document.querySelector('aside.sidebar')?.setAttribute('data-shell-identity', 'sidebar-original');
      document.querySelector('header.topbar')?.setAttribute('data-shell-identity', 'topbar-original');
    });

    // Ordinary menu navigation switches routes client-side without full reload
    const userMenuButton = page.locator('aside.sidebar button.nav-item:has-text("Quản lý người dùng")');
    await expect(userMenuButton).toBeVisible();
    await userMenuButton.click();

    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.locator('text=Quản trị Người dùng & Phân quyền Kiêm nhiệm')).toBeVisible();

    const identityCheck = await page.evaluate(() => ({
      pageLoads: window.__pageLoads,
      marker: window.__e2eNavMarker,
      sidebarIdentity: document.querySelector('aside.sidebar')?.getAttribute('data-shell-identity'),
      topbarIdentity: document.querySelector('header.topbar')?.getAttribute('data-shell-identity'),
      navEntriesCount: performance.getEntriesByType('navigation').length,
      navType: performance.getEntriesByType('navigation')[0]?.type,
    }));

    expect(identityCheck.pageLoads).toBe(1);
    expect(identityCheck.marker).toBe('shell-persisted');
    expect(identityCheck.sidebarIdentity).toBe('sidebar-original');
    expect(identityCheck.topbarIdentity).toBe('topbar-original');
    expect(identityCheck.navEntriesCount).toBe(1);
    expect(identityCheck.navType).toBe('navigate');
  });

  test('slow API state renders standardized loading skeleton', async ({ page }) => {
    await setupAdminAuthAndRoutes(page);

    let resolveSlowUsers;
    const slowPromise = new Promise((resolve) => {
      resolveSlowUsers = resolve;
    });

    await page.route(/\/api\/users/, async (route) => {
      await slowPromise;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'usr-1',
              code: 'AD001',
              fullName: 'Nguyen Quan Tri',
              email: 'admin@tdmu.edu.vn',
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          ],
          pagination: { total: 1, page: 1, limit: 10 },
        }),
      });
    });

    await page.goto('/admin/users');

    const skeletons = page.locator('section[role="status"][aria-label="Đang tải nội dung"]');
    await expect(skeletons.first()).toBeVisible();

    resolveSlowUsers();

    await expect(skeletons).toHaveCount(0);
    await expect(page.locator('text=Nguyen Quan Tri')).toBeVisible();
  });

  test('failed API state renders standardized error and recovers with keyboard accessible retry', async ({ page }) => {
    await setupAdminAuthAndRoutes(page);

    let failUsers = true;
    await page.route(/\/api\/users/, async (route) => {
      const url = new URL(route.request().url());
      const limit = url.searchParams.get('limit');

      // Allow background role count queries to resolve so only the main users table fails
      if (limit === '1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { total: 5, page: 1, limit: 1 },
          }),
        });
      }

      if (failUsers) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Máy chủ cơ sở dữ liệu tạm thời bận',
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'usr-recovered',
              code: 'RC001',
              fullName: 'Nguyen Van Phuc Hoi',
              email: 'phuchoi@tdmu.edu.vn',
              role: 'LECTURER',
              status: 'ACTIVE',
            },
          ],
          pagination: { total: 1, page: 1, limit: 10 },
        }),
      });
    });

    await page.goto('/admin/users');

    const alertSection = page.locator('section[role="alert"]').first();
    await expect(alertSection).toBeVisible();
    await expect(page.locator('text=Máy chủ cơ sở dữ liệu tạm thời bận').first()).toBeVisible();

    await page.evaluate(() => {
      window.__e2eNavMarker = 'retry-persisted';
    });

    // Keyboard accessible retry: pressing Enter on retry button works
    failUsers = false;
    const retryButton = alertSection.locator('button:has-text("Thử lại")');
    await expect(retryButton).toBeVisible();
    await retryButton.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('section[role="alert"]')).toHaveCount(0);
    await expect(page.locator('text=Nguyen Van Phuc Hoi')).toBeVisible();

    const identityCheck = await page.evaluate(() => ({
      pageLoads: window.__pageLoads,
      marker: window.__e2eNavMarker,
    }));
    expect(identityCheck.pageLoads).toBe(1);
    expect(identityCheck.marker).toBe('retry-persisted');
  });

  test('route-error recovery by navigating away preserves persistent shell without full reload', async ({ page }) => {
    await setupAdminAuthAndRoutes(page);

    await page.route(/\/api\/users/, async (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Lỗi tải người dùng',
        }),
      });
    });

    await page.goto('/admin/users');

    const alertSection = page.locator('section[role="alert"]').first();
    await expect(alertSection).toBeVisible();

    await page.evaluate(() => {
      window.__e2eNavMarker = 'nav-away-persisted';
      document.querySelector('aside.sidebar')?.setAttribute('data-shell-identity', 'sidebar-nav-away');
    });

    // Navigate away to Dashboard via sidebar
    const dashboardMenuButton = page.locator('aside.sidebar button.nav-item:has-text("Tổng quan")');
    await dashboardMenuButton.click();

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('h1:has-text("Trung Tâm Điều Hành & Quản Trị Học Vụ")')).toBeVisible();
    await expect(page.locator('section[role="alert"]')).toHaveCount(0);

    const identityCheck = await page.evaluate(() => ({
      pageLoads: window.__pageLoads,
      marker: window.__e2eNavMarker,
      sidebarIdentity: document.querySelector('aside.sidebar')?.getAttribute('data-shell-identity'),
      pageLoadsCount: window.__pageLoads,
    }));

    expect(identityCheck.pageLoadsCount).toBe(1);
    expect(identityCheck.marker).toBe('nav-away-persisted');
    expect(identityCheck.sidebarIdentity).toBe('sidebar-nav-away');
  });
});
