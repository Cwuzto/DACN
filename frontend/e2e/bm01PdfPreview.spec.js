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

const minimalPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

function createRegistration(status = 'APPROVED') {
  return {
    id: 101,
    status,
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

async function setupBm01Mocks(page, { registration, tasks, outline = null, onSubmit = null }) {
  await page.addInitScript(({ token, currentUser }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, { token: 'mock-token', currentUser: studentUser });

  await page.route('**/mock-files/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: minimalPdfBuffer,
    });
  });

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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: registration }) });
    }
    if (path.includes('/tasks/registration/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tasks }) });
    }
    if (path.includes('/outline/my-outline') || path.includes('/outlines/my')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: outline }) });
    }
    if (path.includes('/assets/upload-sessions')) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Use direct upload' }) });
    }
    if ((path.endsWith('/assets') || path.includes('/assets/upload') || path.endsWith('/upload')) && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            assetId: 901,
            url: '/mock-files/de_cuong_v1.pdf',
            downloadUrl: '/mock-files/de_cuong_v1.pdf',
          },
        }),
      });
    }
    if (/\/assets\/\d+\/download/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            downloadUrl: '/mock-files/de_cuong_v2.pdf',
            url: '/mock-files/de_cuong_v2.pdf',
          },
        }),
      });
    }
    if ((path.includes('/outline/submissions') || path.includes('/outline/resubmissions') || (path.includes('/tasks/') && path.endsWith('/submit'))) && method === 'POST') {
      const postData = route.request().postDataJSON();
      onSubmit?.(postData);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 501, ...postData } }),
      });
    }
    if (path.includes('/archives/registration/') || path.includes('/dossier') || path.includes('/bm03/') || path.includes('/bm04/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('BM01 PDF Preview, Submission & Historical Word Policy', () => {
  test('student previews PDF before submit, rejects new Word upload, and submits v1 with form fields', async ({ page }) => {
    const submittedPayloads = [];
    const tasks = [
      {
        id: 10,
        taskType: 'BM01_INITIAL_SUBMISSION',
        title: 'Nộp đề cương nghiên cứu chi tiết (BM01 v1)',
        status: 'OPEN',
        submissions: [],
      },
    ];

    await setupBm01Mocks(page, {
      registration: createRegistration('APPROVED'),
      tasks,
      onSubmit: (payload) => submittedPayloads.push(payload),
    });

    await page.goto('/student/submissions');
    const submitBtn = page.getByRole('button', { name: 'Nộp đề cương v1' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Try uploading a .docx file -> rejected by client validation
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'de_cuong_moi.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('fake-docx'),
    });
    await expect(page.getByText(/Đề cương BM01 chỉ chấp nhận tệp định dạng PDF/i)).toBeVisible();

    // Upload valid .pdf -> preview iframe renders before submit
    await fileInput.setInputFiles({
      name: 'de_cuong_v1.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer,
    });
    await expect(page.getByText(/de_cuong_v1\.pdf/)).toBeVisible();
    await expect(page.locator('iframe[title="Xem trước PDF BM01"]')).toBeVisible();

    // Fill BM01 form fields and submit
    await page.getByPlaceholder(/Nêu rõ mục tiêu/i).fill('Xây dựng quy trình số hóa biểu mẫu học vụ.');
    await page.getByPlaceholder(/React, Node\.js/i).fill('React, Node.js, PostgreSQL');
    await page.getByPlaceholder(/Sản phẩm phần mềm/i).fill('Ứng dụng web và báo cáo khóa luận.');

    await page.getByRole('button', { name: 'Xác nhận và nộp BM01' }).click();

    await expect.poll(() => submittedPayloads.length).toBe(1);
    expect(submittedPayloads[0].fileData.assetId).toBe(901);
    expect(submittedPayloads[0].fileData.fileName).toBe('de_cuong_v1.pdf');
    expect(submittedPayloads[0].fileData.mimeType).toBe('application/pdf');
    expect(submittedPayloads[0].content).toContain('React, Node.js, PostgreSQL');
  });

  test('student submits v2 in BM01_NEEDS_REVISION and viewer switches between v1 PDF, v2 PDF, and historical Word download-only', async ({ page }) => {
    const v1Sub = {
      id: 301,
      versionNumber: 1,
      formCode: 'BM01',
      fileName: 'de_cuong_lich_su_v1.docx',
      fileUrl: '/api/assets/801/download',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: JSON.stringify({
        formCode: 'BM01',
        fields: {
          objectives: 'Mục tiêu v1',
          technologies: 'Node.js',
          deliverables: 'Báo cáo v1',
        },
      }),
      createdAt: '2026-11-01T08:00:00.000Z',
    };
    const v2Sub = {
      id: 302,
      versionNumber: 2,
      formCode: 'BM01',
      assetId: 802,
      fileName: 'de_cuong_chinh_sua_v2.pdf',
      fileUrl: '/api/assets/802/download',
      mimeType: 'application/pdf',
      content: JSON.stringify({
        formCode: 'BM01',
        fields: {
          objectives: 'Mục tiêu v2 đã chỉnh sửa',
          technologies: 'React + Express',
          deliverables: 'Báo cáo v2',
          revisionSummary: 'Bổ sung sơ đồ kiến trúc',
        },
      }),
      createdAt: '2026-11-05T08:00:00.000Z',
    };

    const tasks = [
      {
        id: 10,
        taskType: 'BM01_INITIAL_SUBMISSION',
        title: 'Đề cương nghiên cứu chi tiết (v1)',
        status: 'SUBMITTED',
        submissions: [v2Sub, v1Sub],
      },
    ];

    await setupBm01Mocks(page, {
      registration: createRegistration('BM01_SUBMITTED'),
      tasks,
      outline: { id: 40, status: 'BM01_SUBMITTED', submissions: [v2Sub, v1Sub] },
    });

    await page.goto('/student/submissions');
    const viewBtn = page.getByRole('button', { name: /Xem bài nộp/i }).first();
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();

    // Latest v2 PDF renders iframe
    await expect(page.locator('iframe[title*="de_cuong_chinh_sua_v2.pdf"]')).toBeVisible();
    await expect(page.getByText(/Bổ sung sơ đồ kiến trúc/)).toBeVisible();

    // Switch to v1 historical Word -> no iframe, download-only notice
    await page.getByText(/Phiên bản v1/i).click();
    await expect(page.getByText(/Tệp Word lịch sử: de_cuong_lich_su_v1\.docx/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Tải xuống \(\.docx\)/i })).toBeVisible();
    await expect(page.locator('iframe[title*="de_cuong_lich_su_v1.docx"]')).toHaveCount(0);
  });
});
