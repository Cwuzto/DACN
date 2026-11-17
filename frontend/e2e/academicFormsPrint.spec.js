import { test, expect } from '@playwright/test';

const studentUser = {
  id: 601,
  code: '2224802010999',
  fullName: 'Nguyễn Minh Thư',
  email: '2224802010999@student.tdmu.edu.vn',
  role: 'STUDENT',
  status: 'ACTIVE',
  permissionVersion: 1,
  permissions: ['VIEW_MY_SUBMISSIONS', 'SUBMIT_BM01', 'SUBMIT_BM02'],
};

const lecturerUser = {
  id: 701,
  code: 'GV701',
  fullName: 'TS. Trần Văn Giảng',
  email: 'giangtv@tdmu.edu.vn',
  role: 'LECTURER',
  status: 'ACTIVE',
  permissionVersion: 1,
  permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTOR_STUDENTS', 'REPORT_VIEW'],
};

const mockRegistration = {
  id: 101,
  status: 'BM02_PENDING',
  bm01ApprovedTitleSnapshot: 'Hệ thống quản lý khóa luận tốt nghiệp',
  student: {
    id: 601,
    code: '2224802010999',
    fullName: 'Nguyễn Minh Thư',
    email: '2224802010999@student.tdmu.edu.vn',
    studentProfile: {
      studentCode: '2224802010999',
      className: 'D22PM02',
      major: 'Kỹ thuật phần mềm',
      academicYear: '2023 - 2027',
    },
  },
  currentBM02Submission: {
    id: 201,
    versionNo: 1,
    title: 'Hệ thống quản lý khóa luận tốt nghiệp',
    objectives: 'Xây dựng quy trình số hóa biểu mẫu học vụ.',
  },
  topic: {
    id: 55,
    code: 'DT-055',
    title: 'Hệ thống quản lý khóa luận tốt nghiệp',
    major: 'Kỹ thuật phần mềm',
    mentor: {
      id: 701,
      fullName: 'TS. Trần Văn Giảng',
      academicTitle: 'TS',
    },
  },
};

const mockTasks = [
  {
    id: 11,
    taskType: 'BM02',
    title: 'Nộp phiếu đăng ký đề tài BM02',
    status: 'PENDING',
    submissions: [
      {
        id: 201,
        versionNumber: 1,
        content: JSON.stringify({
          title: 'Hệ thống quản lý khóa luận tốt nghiệp',
          objectives: 'Xây dựng quy trình số hóa biểu mẫu học vụ.',
        }),
        createdAt: '2026-11-10T08:00:00.000Z',
      },
    ],
  },
];

async function setupApiMocks(page, user) {
  await page.addInitScript(({ token, currentUser }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    window.__printModesSeen = [];
    const origPrint = window.print.bind(window);
    window.print = () => {
      window.__printModesSeen.push(document.body.getAttribute('data-print-mode'));
      try {
        origPrint();
      } catch {
        // Ignore headless print dialog errors if any
      }
      window.dispatchEvent(new Event('afterprint'));
    };
  }, { token: 'mock-token', currentUser: user });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: user }) });
    }
    if (path.endsWith('/semesters') || path.endsWith('/semesters/public')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ id: 1, name: 'HK1 2026-2027', status: 'ONGOING', isCurrent: true }] }),
      });
    }
    if (path.includes('/notifications/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], unreadCount: 0 }) });
    }
    if (path.endsWith('/registrations/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockRegistration }) });
    }
    if (path.includes('/tasks/registration/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTasks }) });
    }
    if (path.includes('/archives/registration/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }
    if (path.includes('/dossier')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }
    if (path.includes('/outlines/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }
    if (path.includes('/dashboard/lecturer')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            students: [
              {
                registrationId: 101,
                studentId: 601,
                studentName: 'Nguyễn Minh Thư',
                studentCode: '2224802010999',
                topicId: 55,
                topicTitle: 'Hệ thống quản lý khóa luận tốt nghiệp',
                status: 'BM02_PENDING',
              },
            ],
            metrics: { totalStudents: 1 },
          },
        }),
      });
    }
    if (path.includes('/registrations/title-adjustments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('Academic Forms Print Surface', () => {
  test('student BM02 print modal isolates print root, clears zoom transform and scroll clip in print media', async ({ page }) => {
    await setupApiMocks(page, studentUser);
    await page.goto('/student/submissions');

    const printBm02Btn = page.getByRole('button', { name: 'In Nhiệm vụ BM02' });
    await expect(printBm02Btn).toBeVisible();
    await printBm02Btn.click();

    const printRoot = page.locator('[data-academic-print-root]');
    await expect(printRoot).toBeVisible();
    await expect(printRoot).toContainText('Hệ thống quản lý khóa luận tốt nghiệp');
    await expect(printRoot).toContainText('Xây dựng quy trình số hóa biểu mẫu học vụ.');
    await expect(printRoot).not.toContainText('D22CNTT01');
    await expect(printRoot).toContainText('Chờ xác nhận');

    // Change zoom away from 100% (e.g. 80%)
    const zoomOutBtn = page.getByRole('button', { name: 'Thu nhỏ' });
    await zoomOutBtn.click();
    await zoomOutBtn.click();
    await expect(page.getByRole('button', { name: '80%' })).toBeVisible();

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    const printStyles = await page.evaluate(() => {
      const root = document.querySelector('[data-academic-print-root]');
      const modalBody = document.querySelector('.ant-modal-body');
      const modalWrap = document.querySelector('.ant-modal-wrap');
      const sidebar = document.querySelector('.sidebar');
      const rootStyle = root ? getComputedStyle(root) : null;
      const bodyStyle = modalBody ? getComputedStyle(modalBody) : null;
      const wrapStyle = modalWrap ? getComputedStyle(modalWrap) : null;
      const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
      return {
        printMode: document.body.getAttribute('data-print-mode'),
        rootVisibility: rootStyle?.visibility,
        rootTransform: rootStyle?.transform,
        rootOverflow: rootStyle?.overflow,
        modalBodyMaxHeight: bodyStyle?.maxHeight,
        modalBodyOverflowY: bodyStyle?.overflowY,
        modalWrapPosition: wrapStyle?.position,
        sidebarDisplay: sidebarStyle?.display,
        sidebarVisibility: sidebarStyle?.visibility,
      };
    });

    expect(printStyles.printMode).toBe('academic-form');
    expect(printStyles.rootVisibility).toBe('visible');
    expect(printStyles.rootTransform).toBe('none');
    expect(printStyles.rootOverflow).toBe('visible');
    expect(printStyles.modalBodyMaxHeight).toBe('none');
    expect(printStyles.modalBodyOverflowY).toBe('visible');
    expect(printStyles.modalWrapPosition).toBe('static');
    expect(
      printStyles.sidebarDisplay === 'none' || printStyles.sidebarVisibility === 'hidden'
    ).toBeTruthy();

    await page.emulateMedia({ media: 'screen' });

    // Click print button and verify print mode lifecycle
    await page.getByRole('button', { name: 'In văn bản' }).click();
    const modesSeen = await page.evaluate(() => window.__printModesSeen);
    expect(modesSeen).toContain('academic-form');
    await expect.poll(async () => page.evaluate(() => document.body.getAttribute('data-print-mode'))).toBeNull();

    // Close modal and ensure cleanup
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(printRoot).toBeHidden();
  });

  test('academic dossier drawer isolates print modal in print media', async ({ page }) => {
    await setupApiMocks(page, lecturerUser);
    await page.goto('/lecturer/students');

    const dossierBtn = page.getByRole('button', { name: /Hồ sơ/i }).first();
    await expect(dossierBtn).toBeVisible();
    await dossierBtn.click();

    await expect(page.getByRole('button', { name: /Tải \/ In PDF BM01/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: /BM05 \(Biên bản HĐ\)/ }).click();
    await expect(page.getByRole('button', { name: 'In biểu mẫu này' })).toBeDisabled();

    await page.getByRole('tab', { name: /BM02 \(Nhiệm vụ\)/ }).click();
    await page.getByRole('button', { name: 'In biểu mẫu này' }).click();

    const printRoot = page.locator('[data-academic-print-root]');
    await expect(printRoot).toBeVisible();
    await expect(printRoot).toContainText('Hệ thống quản lý khóa luận tốt nghiệp');
    await expect(printRoot).toContainText('Xây dựng quy trình số hóa biểu mẫu học vụ.');
    await expect(printRoot).not.toContainText('D22CNTT01');
    await expect(printRoot).toContainText('Chờ xác nhận');

    await page.emulateMedia({ media: 'print' });

    const styles = await page.evaluate(() => {
      const root = document.querySelector('[data-academic-print-root]');
      const drawer = document.querySelector('.ant-drawer');
      const sidebar = document.querySelector('.sidebar');
      return {
        printMode: document.body.getAttribute('data-print-mode'),
        rootVisibility: root ? getComputedStyle(root).visibility : null,
        drawerDisplay: drawer ? getComputedStyle(drawer).display : null,
        sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
        sidebarVisibility: sidebar ? getComputedStyle(sidebar).visibility : null,
      };
    });

    expect(styles.printMode).toBe('academic-form');
    expect(styles.rootVisibility).toBe('visible');
    expect(styles.drawerDisplay).toBe('none');
    expect(
      styles.sidebarDisplay === 'none' || styles.sidebarVisibility === 'hidden'
    ).toBeTruthy();
  });

  test('HomePage announcement print uses announcement print mode and isolates announcementDetailView', async ({ page }) => {
    await page.addInitScript(() => {
      window.__printModesSeen = [];
      window.print = () => {
        window.__printModesSeen.push(document.body.getAttribute('data-print-mode'));
        window.dispatchEvent(new Event('afterprint'));
      };
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith('/semesters/public')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
      }
      if (path.endsWith('/portal/public')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              configuration: null,
              links: [],
              templates: [],
              announcements: [
                {
                  id: 1,
                  title: 'Thông báo nộp đề cương KLTN',
                  category: 'ACADEMIC',
                  content: 'Sinh viên nộp đề cương đúng hạn.',
                  createdAt: '2026-11-01T00:00:00.000Z',
                },
              ],
            },
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('/');
    const firstAnnouncement = page.getByText('Thông báo nộp đề cương KLTN').first();
    await expect(firstAnnouncement).toBeVisible();
    await firstAnnouncement.click();

    const printAnnouncementBtn = page.getByRole('button', { name: 'In thông báo' });
    await expect(printAnnouncementBtn).toBeVisible();
    await printAnnouncementBtn.click();

    const modesSeen = await page.evaluate(() => window.__printModesSeen);
    expect(modesSeen).toContain('announcement');
    await expect.poll(async () => page.evaluate(() => document.body.getAttribute('data-print-mode'))).toBeNull();
  });
});
