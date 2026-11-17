import { test, expect } from '@playwright/test';

const gvhdUser = {
    id: 77,
    code: 'GV077',
    fullName: 'TS. Giảng Viên Hướng Dẫn',
    email: 'gvhd@tdmu.edu.vn',
    role: 'LECTURER',
    status: 'ACTIVE',
    permissionVersion: 1,
    permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTOR_STUDENTS', 'REPORT_VIEW'],
};

const directorUser = {
    id: 88,
    code: 'VT088',
    fullName: 'PGS.TS Viện Trưởng',
    email: 'vientruong@tdmu.edu.vn',
    role: 'LECTURER',
    status: 'ACTIVE',
    permissionVersion: 1,
    permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTOR_STUDENTS', 'REPORT_VIEW', 'BM02_REVIEW', 'DEFENSE_COUNCIL_MANAGE'],
};

const setupLecturerRoutes = async (page, user, overviewBySemester) => {
    await page.addInitScript(({ token, currentUser }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
    }, { token: 'mock-lecturer-token', currentUser: user });

    await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname;

        if (path.endsWith('/auth/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: user }),
            });
        }

        if (path.endsWith('/semesters')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: [
                        { id: 10, name: 'HK1 2026-2027', status: 'ONGOING' },
                        { id: 9, name: 'HK2 2025-2026', status: 'COMPLETED' },
                    ],
                }),
            });
        }

        if (path.endsWith('/registrations/title-adjustments/pending')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: [] }),
            });
        }

        if (path.endsWith('/dashboard/lecturer')) {
            const semId = url.searchParams.get('semesterId') || '10';
            const payload = overviewBySemester[semId];
            if (payload instanceof Error) {
                return route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: false, message: payload.message }),
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: payload }),
            });
        }

        if (path.includes('/notifications/my')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: [], unreadCount: 0 }),
            });
        }

        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [] }),
        });
    });
};

test.describe('Lecturer Unified Overview E2E', () => {
    test('GVHD and Institute Director share unified layout across 375/768/1024/1440px and reduced motion', async ({ page }) => {
        const sem10Data = {
            activeSemester: { id: 10, name: 'HK1 2026-2027' },
            mentorSummary: {
                supervisedCount: 1,
                maxStudents: 10,
                pendingFeedbackCount: 1,
                actionableCount: 2,
                upcomingDeadlineCount: 1,
            },
            attentionItems: [
                {
                    id: 'inst-bm02-201',
                    source: 'INSTITUTE_DIRECTOR',
                    kind: 'BM02_REVIEW_PENDING',
                    title: 'Thẩm định BM02: Lê Thị C',
                    description: 'Đề tài KTPM',
                    priority: 'OVERDUE',
                    dueAt: '2026-11-16T10:00:00.000Z',
                    isActionable: true,
                    target: '/lecturer/institute',
                    allowedAction: 'REVIEW_BM02',
                },
                {
                    id: 'mentor-sub-1',
                    source: 'MENTOR',
                    kind: 'SUBMISSION_FEEDBACK_PENDING',
                    title: 'Phản hồi bài nộp: Chương 1',
                    description: 'Nguyễn Văn A',
                    priority: 'NORMAL',
                    isActionable: true,
                    target: '/lecturer/submissions',
                    allowedAction: 'PROVIDE_FEEDBACK',
                },
            ],
            students: [
                {
                    registrationId: 101,
                    studentId: 201,
                    studentName: 'Nguyễn Văn A',
                    studentCode: 'SV001',
                    topicTitle: 'Hệ thống AI',
                    status: 'IN_PROGRESS',
                    nextMilestone: 'Nộp chương 2',
                    nextMilestoneAt: '2026-11-20T10:00:00.000Z',
                    allowedActions: [],
                },
            ],
            generatedAt: '2026-11-17T10:00:00.000Z',
        };

        const sem9Data = {
            activeSemester: { id: 9, name: 'HK2 2025-2026' },
            mentorSummary: {
                supervisedCount: 0,
                maxStudents: 10,
                pendingFeedbackCount: 0,
                actionableCount: 0,
                upcomingDeadlineCount: 0,
            },
            attentionItems: [],
            students: [],
            generatedAt: '2026-11-17T10:01:00.000Z',
        };

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setupLecturerRoutes(page, directorUser, { 10: sem10Data, 9: sem9Data });

        for (const width of [1440, 1024, 768, 375]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('/lecturer/dashboard');

            await expect(page.getByRole('heading', { level: 1, name: 'Tổng quan giảng viên' })).toBeVisible();
            await expect(page.getByText('Thẩm định BM02: Lê Thị C')).toBeVisible();
            await expect(page.getByText('Phản hồi bài nộp: Chương 1')).toBeVisible();
            await expect(page.getByText('Nguyễn Văn A').first()).toBeVisible();

            const hasHorizontalOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth > document.documentElement.clientWidth
            );
            expect(hasHorizontalOverflow).toBe(false);
        }

        // Switch semester to HK2 2025-2026 -> previous semester student must disappear
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByLabel('Chọn đợt đồ án').click();
        await page.getByText('HK2 2025-2026').click();

        await expect(page.getByText('Không có việc cần xử lý')).toBeVisible();
        await expect(page.getByText('Chưa có sinh viên trong đợt')).toBeVisible();
        await expect(page.getByText('Nguyễn Văn A')).toHaveCount(0);
    });

    test('GVHD sees no institute items and API error shows retry state', async ({ page }) => {
        await setupLecturerRoutes(page, gvhdUser, {
            10: new Error('Lỗi tải dữ liệu tổng quan'),
        });

        await page.goto('/lecturer/dashboard');
        await expect(page.getByText('Lỗi tải dữ liệu tổng quan')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    });
});
