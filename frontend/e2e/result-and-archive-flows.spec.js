import { test, expect } from '@playwright/test';

test.describe('Defense Result and Student Archival Workflows', () => {
  test('defense result publication flow: deep linking to publication, previewing snapshot, submitting publication, history view', async ({ page }) => {
    const mockAdminUser = {
      id: 'usr-admin-pub',
      code: 'AD007',
      fullName: 'Quản trị viên Khảo thí',
      role: 'ADMIN',
      permissions: [
        'VIEW_DEFENSE_LOCK_LEDGER',
        'VIEW_RESULT_LOCKS',
        'DEFENSE_SCORE_VIEW',
        'RESULT_LOCK',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'VIEW_DEFENSE_RESULTS_APPROVAL',
        'DEFENSE_RESULT_APPROVE',
        'VIEW_RESULT_PUBLICATIONS',
        'RESULT_PUBLICATION_PUBLISH',
      ],
    };

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      window.__pageLoads = (window.__pageLoads || 0) + 1;
    }, { token: 'mock-admin-token', user: mockAdminUser });

    let capturedPublishPayload = null;
    let capturedIdempotencyKey = null;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();

      if (path.endsWith('/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockAdminUser, token: 'mock-admin-token' }),
        });
      }

      if (path.endsWith('/semesters') || path.endsWith('/semesters/public')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 1,
                name: 'Học kỳ 1 2026–2027',
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

      if (path.includes('/evaluations/admin-defense-center')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            meta: {
              targetSemester: { id: 1, name: 'Học kỳ 1 2026–2027' },
              metrics: { total: 1, gradedCount: 1, lockedCount: 1, approvedCount: 1 },
            },
          }),
        });
      }

      if (path.includes('/evaluations/semesters/1/result-publications/preview')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              eligible: [
                {
                  registrationId: 101,
                  finalScoreSnapshot: 8.75,
                  outcome: 'PASSED',
                  registration: {
                    id: 101,
                    student: {
                      code: 'SV101',
                      fullName: 'Nguyễn Văn An',
                    },
                    topic: {
                      title: 'Nghiên cứu thị giác máy tính và AI',
                    },
                  },
                },
              ],
            },
          }),
        });
      }

      if (path.includes('/evaluations/semesters/1/result-publications') && method === 'POST') {
        capturedPublishPayload = route.request().postDataJSON();
        capturedIdempotencyKey = route.request().headers()['idempotency-key'];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Đã ban hành snapshot công bố kết quả thành công!',
          }),
        });
      }

      if (path.includes('/evaluations/semesters/1/result-publications') && method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 99,
                type: 'INITIAL',
                publishedAt: '2026-11-10T09:00:00Z',
                items: [
                  {
                    id: 1,
                    studentCodeSnapshot: 'SV099',
                    studentNameSnapshot: 'Trần Thị Bình',
                    topicTitleSnapshot: 'Hệ thống IoT nông nghiệp thông minh',
                    finalScoreSnapshot: 9.2,
                    outcomeSnapshot: 'PASSED',
                  },
                ],
              },
            ],
          }),
        });
      }

      // Default fallback
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // 1. Deep linking to publication modal
    await page.goto('/admin/grading?tab=publish');

    const publicationModal = page.locator('.ant-modal').filter({
      hasText: 'Ban Hành Snapshot Công Bố Kết Quả Bảo Vệ',
    });
    await expect(publicationModal).toBeVisible();

    // 2. Previewing snapshot
    await expect(publicationModal.locator('text=SV101')).toBeVisible();
    await expect(publicationModal.locator('text=Nguyễn Văn An')).toBeVisible();
    await expect(publicationModal.locator('text=Nghiên cứu thị giác máy tính và AI')).toBeVisible();
    await expect(publicationModal.locator('text=8.75')).toBeVisible();
    await expect(publicationModal.locator('text=ĐẠT BẢO VỆ')).toBeVisible();

    // 3. Submitting publication
    const publishSubmitBtn = publicationModal.locator('button[type="submit"]:has-text("Ký & Ban Hành Công Bố")');
    await expect(publishSubmitBtn).toBeEnabled();
    await publishSubmitBtn.click();

    await expect(publicationModal).toBeHidden();
    expect(capturedPublishPayload).toBeDefined();
    expect(capturedPublishPayload.type).toBe('INITIAL');
    expect(capturedIdempotencyKey).toBeTruthy();

    // 4. History view
    const historyButton = page.locator('button.btn-secondary:has-text("Lịch sử công bố")');
    await expect(historyButton).toBeVisible();
    await historyButton.click();

    const historyModal = page.locator('.ant-modal').filter({
      hasText: 'Sổ Lưu Chiểu Snapshot & Lịch Sử Công Bố Kết Quả',
    });
    await expect(historyModal).toBeVisible();
    await expect(historyModal.locator('text=CÔNG BỐ CHÍNH THỨC ĐỢT 1').first()).toBeVisible();
    await expect(historyModal.locator('text=SV099')).toBeVisible();
    await expect(historyModal.locator('text=Trần Thị Bình')).toBeVisible();
    await expect(historyModal.locator('text=9.20')).toBeVisible();

    await historyModal.locator('button[aria-label="Close"]').click();
    await expect(historyModal).toBeHidden();
  });

  test('student archival dossier flow: deep link to dossier, view files, handle upload failure gracefully with inline retry, successful retry updates cache', async ({ page }) => {
    const mockStudentUser = {
      id: 'usr-student-dossier',
      code: 'SV2026',
      fullName: 'Lê Hoàng Nam',
      role: 'STUDENT',
      permissions: [
        'VIEW_MY_REGISTRATION',
        'REGISTER_TOPIC',
        'VIEW_MY_SUBMISSIONS',
        'SUBMIT_BM01',
        'SUBMIT_BM02',
        'SUBMIT_TASK',
        'VIEW_MY_GRADES',
        'VIEW_MY_ARCHIVE',
        'DEFENSE_PASSED',
        'COMPLETED',
      ],
    };

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      window.__pageLoads = (window.__pageLoads || 0) + 1;
    }, { token: 'mock-student-token', user: mockStudentUser });

    let uploadShouldFail = true;
    let dossierDocuments = [
      {
        id: 10,
        documentType: 'REPORT_WORD',
        fileName: 'bao-cao-tot-nghiep.docx',
        fileUrl: 'https://example.com/bao-cao.docx',
        versionNumber: 1,
        checksum: 'abc123def456',
        uploadedAt: '2026-11-12T10:00:00Z',
      },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();

      if (path.endsWith('/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockStudentUser, token: 'mock-student-token' }),
        });
      }

      if (path.endsWith('/semesters') || path.endsWith('/semesters/public')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 1,
                name: 'Học kỳ 1 2026–2027',
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

      if (path.includes('/registrations/my')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 201,
              status: 'DEFENSE_PASSED',
              topic: {
                id: 301,
                title: 'Hệ thống số hóa hồ sơ lưu chiểu đồ án',
                code: 'DT2026-01',
                lecturer: { fullName: 'TS. Đặng Minh Tuấn' },
              },
              student: {
                id: 'usr-student-dossier',
                code: 'SV2026',
                fullName: 'Lê Hoàng Nam',
              },
            },
          }),
        });
      }

      if (path.includes('/archives/registrations/201/dossier')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              registrationId: 201,
              isWindowClosed: false,
              windows: {},
              documents: dossierDocuments,
              currentFiles: {
                REPORT_WORD: dossierDocuments.find(d => d.documentType === 'REPORT_WORD') || null,
                REPORT_PDF: dossierDocuments.find(d => d.documentType === 'REPORT_PDF') || null,
                DEMO_VIDEO: dossierDocuments.find(d => d.documentType === 'DEMO_VIDEO') || null,
                SLIDE_PPTX: dossierDocuments.find(d => d.documentType === 'SLIDE_PPTX') || null,
              },
              bm03Record: {
                id: 1,
                finalPdfFileUrl: 'https://example.com/bm03.pdf',
                advisorSignedAt: '2026-11-10T10:00:00Z',
              },
              bm04Record: {
                id: 1,
                finalPdfFileUrl: 'https://example.com/bm04.pdf',
                signedAt: '2026-11-10T10:00:00Z',
              },
            },
          }),
        });
      }

      if (path.includes('/archives/registrations/201/files') && method === 'POST') {
        const payload = route.request().postDataJSON();
        const newDoc = {
          id: 30,
          documentType: payload.documentType,
          fileName: payload.fileName,
          fileUrl: payload.fileUrl,
          versionNumber: 1,
          checksum: 'slide-checksum-123',
          uploadedAt: new Date().toISOString(),
        };
        dossierDocuments.push(newDoc);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: newDoc,
          }),
        });
      }

      if (path.includes('/archives/registrations/201')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              archive: {
                id: 501,
                status: 'IN_PROGRESS',
              },
            },
          }),
        });
      }

      if (path.includes('/upload') && method === 'POST') {
        if (uploadShouldFail) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              message: 'Dịch vụ lưu trữ tệp tạm thời không phản hồi',
            }),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              url: 'https://example.com/slide-v1.pptx',
            },
            url: 'https://example.com/slide-v1.pptx',
          }),
        });
      }

      // Default fallback for any other task/meeting endpoints
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // 1. Deep link to dossier
    await page.goto('/student/submissions?tab=archive');

    const dossierModal = page.locator('.ant-modal').filter({
      hasText: 'Nộp & Cập Nhật Hồ Sơ Lưu Chiểu Đồ Án',
    });
    await expect(dossierModal).toBeVisible();

    // 2. View files
    const wordCard = dossierModal.locator('div.rounded-xl').filter({
      hasText: 'Báo cáo toàn văn (Word)',
    });
    await expect(wordCard).toBeVisible();
    await expect(wordCard.locator('text=bao-cao-tot-nghiep.docx')).toBeVisible();
    await expect(wordCard.locator('text=v1')).toBeVisible();

    const slideCard = dossierModal.locator('div.rounded-xl').filter({
      hasText: 'Slide Báo cáo (PPTX / PDF)',
    });
    await expect(slideCard).toBeVisible();
    await expect(slideCard.locator('text=Chưa nộp')).toBeVisible();

    // 3. Handle upload failure gracefully with inline error
    await slideCard.locator('input[type="file"]').setInputFiles({
      name: 'slide-thuyet-trinh.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: Buffer.from('dummy slide data'),
    });

    // Ant Design message popup displays error
    await expect(page.locator('.ant-message-error')).toBeVisible();
    await expect(page.locator('text=Dịch vụ lưu trữ tệp tạm thời không phản hồi')).toBeVisible();

    // Modal remains healthy and open
    await expect(dossierModal).toBeVisible();

    // 4. Successful retry updates cache
    uploadShouldFail = false;

    await slideCard.locator('input[type="file"]').setInputFiles({
      name: 'slide-thuyet-trinh.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: Buffer.from('dummy slide data'),
    });

    // Success message and UI cache update
    await expect(page.locator('.ant-message-success')).toBeVisible();
    await expect(slideCard.locator('text=slide-thuyet-trinh.pptx')).toBeVisible();
    await expect(slideCard.locator('text=v1')).toBeVisible();
    await expect(slideCard.locator('text=Chưa nộp')).toBeHidden();
  });
});
