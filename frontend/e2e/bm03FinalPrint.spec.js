import { test, expect } from '@playwright/test';

const studentUser = {
  id: 601,
  code: '2224802010999',
  fullName: 'Nguyễn Minh Thư',
  email: '2224802010999@student.tdmu.edu.vn',
  role: 'STUDENT',
  status: 'ACTIVE',
  permissionVersion: 1,
  permissions: ['VIEW_MY_SUBMISSIONS'],
};

function makeRegistration(status = 'IN_PROGRESS_BM03') {
  return {
    id: 101,
    status,
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
      },
    },
    topic: {
      id: 55,
      code: 'DT-055',
      title: 'Hệ thống quản lý khóa luận tốt nghiệp',
      major: 'Kỹ thuật phần mềm',
      mentor: { id: 701, fullName: 'TS. Trần Văn Giảng', academicTitle: 'TS' },
    },
  };
}

function makeBm03Record({ finalized = false } = {}) {
  return {
    id: 501,
    registrationId: 101,
    effectiveTitleSnapshot: 'Hệ thống quản lý khóa luận tốt nghiệp',
    meetings: [
      {
        id: 11,
        versionNumber: 1,
        meetingDate: '2026-11-05T00:00:00.000Z',
        meetingMode: 'IN_PERSON',
        locationOrLink: 'Lab H2-502',
        discussionContent: 'Nội dung cũ v1 đã bị thay thế',
        nextTasks: 'Thiết kế CSDL',
        progressRating: 'ON_TRACK',
        supersededBy: { id: 12, versionNumber: 2 },
      },
      {
        id: 12,
        versionNumber: 2,
        supersedesEntryId: 11,
        meetingDate: '2026-11-05T00:00:00.000Z',
        meetingMode: 'IN_PERSON',
        locationOrLink: 'Lab H2-502',
        discussionContent: 'Chốt kiến trúc hệ thống và ERD chuẩn',
        nextTasks: 'Xây dựng API và giao diện',
        progressRating: 'ON_TRACK',
        isLocked: true,
        advisorSignedAt: '2026-11-05T10:00:00.000Z',
        supersededBy: null,
      },
    ],
    stageEvaluations: finalized
      ? [
          { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Tiến độ giữa kỳ đạt yêu cầu.' },
          { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Hoàn thành tốt đồ án, đủ điều kiện bảo vệ.' },
        ]
      : [{ id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Tiến độ giữa kỳ đạt yêu cầu.' }],
    stopReviews: [],
    advisorSignedAt: finalized ? '2026-11-15T10:00:00.000Z' : null,
    studentAckStatus: finalized ? 'ACKNOWLEDGED' : null,
    studentAckAt: finalized ? '2026-11-16T09:00:00.000Z' : null,
  };
}

async function setupBm03Mocks(page, state) {
  await page.addInitScript(({ token, currentUser }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, { token: 'mock-token', currentUser: studentUser });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: studentUser }) });
    }
    if (path.endsWith('/semesters') || path.endsWith('/semesters/public')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 1, name: 'HK1 2026-2027', status: 'ONGOING', isCurrent: true }] }) });
    }
    if (path.includes('/notifications/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], unreadCount: 0 }) });
    }
    if (path.endsWith('/registrations/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.registration }) });
    }
    if (path.includes('/bm03/101') || path.includes('/bm03/registration/101')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.bm03Record }) });
    }
    if (path.includes('/meeting-logs')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.bm03Record.meetings }) });
    }
    if (path.includes('/archives/registration/') || path.includes('/dossier') || path.includes('/outlines/my') || path.includes('/bm04/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('BM03 Final Print & Student Read-Only Timeline', () => {
  test('hides BM03 print button before finalization & student ack; prints complete unclipped A4 sheet once finalized', async ({ page }) => {
    const state = {
      registration: makeRegistration('IN_PROGRESS_BM03'),
      bm03Record: makeBm03Record({ finalized: false }),
    };

    await setupBm03Mocks(page, state);
    await page.goto('/student/submissions');

    // Read-only active timeline visible, superseded hidden, no print button
    await expect(page.getByText('Chốt kiến trúc hệ thống và ERD chuẩn')).toBeVisible();
    await expect(page.getByText('Nội dung cũ v1 đã bị thay thế')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'In Sổ tiến độ BM03' })).toHaveCount(0);

    // Finalize: GVHD signed + Student acknowledged
    state.registration = makeRegistration('BM03_PASSED');
    state.bm03Record = makeBm03Record({ finalized: true });
    await page.reload();

    const printBtn = page.getByRole('button', { name: 'In Sổ tiến độ BM03' });
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    const printRoot = page.locator('[data-academic-print-root]');
    await expect(printRoot).toBeVisible();
    await expect(printRoot).toContainText('Chốt kiến trúc hệ thống và ERD chuẩn');
    await expect(printRoot).not.toContainText('Nội dung cũ v1 đã bị thay thế');
    await expect(printRoot).toContainText('Hoàn thành tốt đồ án, đủ điều kiện bảo vệ.');
    await expect(printRoot).toContainText('Đã xác nhận nội bộ');

    // Verify A4 print media has no clipping or transform
    await page.emulateMedia({ media: 'print' });
    const printStyles = await page.evaluate(() => {
      const root = document.querySelector('[data-academic-print-root]');
      const modalBody = document.querySelector('.ant-modal-body');
      return {
        printMode: document.body.getAttribute('data-print-mode'),
        rootVisibility: root ? getComputedStyle(root).visibility : null,
        rootTransform: root ? getComputedStyle(root).transform : null,
        rootOverflow: root ? getComputedStyle(root).overflow : null,
        modalBodyOverflowY: modalBody ? getComputedStyle(modalBody).overflowY : null,
      };
    });

    expect(printStyles.printMode).toBe('academic-form');
    expect(printStyles.rootVisibility).toBe('visible');
    expect(printStyles.rootTransform).toBe('none');
    expect(printStyles.rootOverflow).toBe('visible');
    expect(printStyles.modalBodyOverflowY).toBe('visible');
  });
});
