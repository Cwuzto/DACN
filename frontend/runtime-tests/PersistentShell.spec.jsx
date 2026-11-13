import { act, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import App from '../src/App.jsx';
import useAuthStore from '../src/stores/authStore.js';

const pages = vi.hoisted(() => ({ topics: Promise.withResolvers(), forgot: Promise.withResolvers() }));
// Keep the real shell/router; isolate page code and server I/O from this navigation test.
vi.mock('../src/pages/student/StudentDashboardPage', () => ({ default: () => <p>Student dashboard</p> }));
vi.mock('../src/pages/student/TopicListPage', async () => { await pages.topics.promise; return { default: () => <p>Topics loaded</p> }; });
vi.mock('../src/pages/common/ProfilePage', () => ({ default: () => { throw new Error('broken profile'); } }));
vi.mock('../src/pages/auth/ForgotPasswordPage', async () => { await pages.forgot.promise; return { default: () => { throw new Error('broken public page'); } }; });
vi.mock('../src/services/semesterService', () => ({ semesterService: { getAll: async () => ({ success: true, data: [] }), getPublic: async () => ({ success: true, data: [] }) } }));
vi.mock('../src/services/notificationService', () => ({ default: { getMyNotifications: async () => ({ success: true, data: [] }) } }));
vi.mock('../src/components/common/AcademicChatWidget', () => ({ default: () => null }));

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.setState({ isAuthenticated: true, user: { id: 1, fullName: 'Student', role: 'STUDENT', permissions: ['VIEW_MY_REGISTRATION'] }, refreshSession: async () => null });
    window.history.replaceState({}, '', '/student/dashboard');
});
afterEach(() => vi.restoreAllMocks());

async function navigate(path) {
    await act(async () => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
}

test('sidebar/header retain DOM identity through lazy loading, route errors and recovery', async () => {
    const { container } = render(<App />);
    await screen.findByText('Student dashboard');
    const sidebar = container.querySelector('aside');
    const header = screen.getByRole('banner');
    await navigate('/student/topics');
    expect(await screen.findByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('aria-busy', 'true');
    expect(sidebar).toBeVisible();
    expect(header).toBeVisible();
    expect(container.querySelector('aside')).toBe(sidebar);
    expect(screen.getByRole('banner')).toBe(header);
    await act(async () => pages.topics.resolve());
    expect(await screen.findByText('Topics loaded')).toBeInTheDocument();
    await navigate('/student/profile');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBe(sidebar);
    expect(screen.getByRole('banner')).toBe(header);
    await navigate('/student/dashboard');
    expect(await screen.findByText('Student dashboard')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBe(sidebar);
    expect(screen.getByRole('banner')).toBe(header);
});

test('public routes keep a standalone fallback for lazy loading and render errors', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    window.history.replaceState({}, '', '/forgot-password');
    render(<App />);
    expect(await screen.findByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => pages.forgot.resolve());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
