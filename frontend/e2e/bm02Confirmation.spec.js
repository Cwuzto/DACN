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

function makeRegistration(status = 'BM01_PASSED', bm02Sub = null) {
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
    currentBM02Submission: bm02Sub,
    topic: {
      id: 55,
      code: 'DT-055',
      title: 'Hệ thống quản lý khóa luận tốt nghiệp',
      major: 'Kỹ thuật phần mềm',
      mentor: { id: 701, fullName: 'TS. Trần Văn Giảng', academicTitle: 'TS' },
    },
  };
}

async function setupBm02Mocks(page, state) {
  await page.addInitScript(({ token, currentUser }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, { token: 'mock-token', currentUser: studentUser });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

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
    if (path.includes('/tasks/registration/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.tasks }) });
    }
    if (path.includes('/bm02/') && path.includes('/verification')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.verification }) });
    }
    if ((path.includes('/bm02/applications/') && (path.endsWith('/submit') || path.endsWith('/resubmit')) || path.includes('/registrations/bm02-submit') || (path.includes('/tasks/') && path.endsWith('/submit'))) && method === 'POST') {
      const postData = route.request().postDataJSON();
      state.submittedPayloads.push(postData);
      const nextVersion = state.tasks[0].submissions.length + 1;
      const newSub = {
        id: 200 + nextVersion,
        versionNumber: nextVersion,
        content: postData.content,
        createdAt: '2026-11-12T08:00:00.000Z',
      };
      state.tasks[0].submissions = [newSub, ...state.tasks[0].submissions];
      state.tasks[0].status = 'SUBMITTED';
      state.registration.status = 'BM02_SUBMITTED';
      state.registration.currentBM02Submission = {
        id: newSub.id,
        versionNo: nextVersion,
        title: postData.bm02ProposedTitle || state.registration.bm01ApprovedTitleSnapshot,
        objectives: 'Nội dung nhiệm vụ v' + nextVersion,
      };
      // Reset verification signatures on new version (v2 resets v1 signatures)
      state.verification = {
        versionNo: nextVersion,
        allValid: false,
        student: null,
        advisor: null,
        department: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: newSub }) });
    }
    if (path.includes('/archives/registration/') || path.includes('/dossier') || path.includes('/outlines/my') || path.includes('/bm03/') || path.includes('/bm04/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('BM02 Online Submission & Confirmation Print', () => {
  test('student submits BM02 online without file upload, sees "Chờ xác nhận" before signatures, "Đã xác thực nội bộ" when signed, and v2 resets v1 signatures', async ({ page }) => {
    const state = {
      registration: makeRegistration('BM01_PASSED'),
      tasks: [
        {
          id: 11,
          taskType: 'BM02',
          title: 'Nộp phiếu đăng ký đề tài BM02',
          status: 'OPEN',
          submissions: [],
        },
      ],
      verification: null,
      submittedPayloads: [],
    };

    await setupBm02Mocks(page, state);
    await page.goto('/student/submissions');

    // Open BM02 submit modal -> no file upload input
    await page.getByRole('button', { name: 'Nộp bài ngay' }).click();
    await expect(page.getByText(/Không cần tải lên bản scan có chữ ký tay/i)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await page.getByPlaceholder(/Liệt kê các nhiệm vụ nghiên cứu/i).fill('Phân tích, thiết kế và cài đặt hệ thống.');
    await page.getByPlaceholder(/Giai đoạn 1: Thiết kế/i).fill('Tuần 1-4 thiết kế, Tuần 5-12 lập trình.');
    await page.getByRole('button', { name: /Xác nhận và nộp BM02/i }).click();

    await expect.poll(() => state.submittedPayloads.length).toBe(1);
    expect(state.submittedPayloads[0].fileUrl).toBeNull();
    expect(state.submittedPayloads[0].assetId).toBeNull();

    // Open BM02 Print -> shows "Chờ xác nhận" when unsigned
    await page.getByRole('button', { name: 'In Nhiệm vụ BM02' }).click();
    const printRoot = page.locator('[data-academic-print-root]');
    await expect(printRoot).toBeVisible();
    await expect(printRoot).toContainText('Chờ xác nhận');
    await expect(printRoot).not.toContainText('Đã xác thực nội bộ');
    await page.getByRole('button', { name: 'Đóng' }).click();

    // Simulate student, advisor & department signed v1 -> print shows "Đã xác thực nội bộ"
    state.verification = {
      versionNo: 1,
      allValid: true,
      student: { valid: true, signerName: 'Nguyễn Minh Thư', signedAt: '2026-11-12T09:00:00.000Z', versionNo: 1 },
      advisor: { valid: true, signerName: 'TS. Trần Văn Giảng', signedAt: '2026-11-12T10:00:00.000Z', versionNo: 1 },
      department: { valid: true, signerName: 'TS. Lê Trưởng Bộ Môn', signedAt: '2026-11-12T11:00:00.000Z', versionNo: 1 },
    };
    state.registration.status = 'BM02_NEEDS_REVISION';
    state.tasks[0].status = 'REVISION';

    await page.reload();
    await page.getByRole('button', { name: 'In Nhiệm vụ BM02' }).click();
    await expect(printRoot).toContainText('Đã xác thực nội bộ');
    await page.getByRole('button', { name: 'Đóng' }).click();

    // Submit v2 -> resets verification back to "Chờ xác nhận"
    await page.getByRole('button', { name: 'Nộp lại bài' }).click();
    await page.getByPlaceholder(/Liệt kê các nhiệm vụ nghiên cứu/i).fill('Phân tích, thiết kế và cài đặt hệ thống (v2).');
    await page.getByPlaceholder(/Giai đoạn 1: Thiết kế/i).fill('Tuần 1-12 cập nhật.');
    await page.getByRole('button', { name: /Xác nhận và nộp BM02/i }).click();

    await expect.poll(() => state.submittedPayloads.length).toBe(2);
    await page.getByRole('button', { name: 'In Nhiệm vụ BM02' }).click();
    await expect(printRoot).toContainText('Chờ xác nhận');
    await expect(printRoot).not.toContainText('Đã xác thực nội bộ');
  });
});
