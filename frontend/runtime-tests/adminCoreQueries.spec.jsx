import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import DashboardPage from '../src/pages/admin/DashboardPage.jsx';
import dashboardService from '../src/services/dashboardService.js';
import { semesterService } from '../src/services/semesterService.js';
import AcademicReportsPage from '../src/pages/admin/AcademicReportsPage.jsx';
import { reportService } from '../src/services/reportService.js';
import userEvent from '@testing-library/user-event';
import UserManagementPage from '../src/pages/admin/UserManagementPage.jsx';
import userService from '../src/services/userService.js';
import permissionService from '../src/services/permissionService.js';
import PermissionGroupPage from '../src/pages/admin/PermissionGroupPage.jsx';

let client;
beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => native(element));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
    useAuthStore.setState({ user: { id: 7, permissions: ['USER_MANAGE'] }, isAuthenticated: true });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 12, name: 'Học kỳ thực tế', status: 'ONGOING' }] });
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue({ success: true, data: { totalStudents: 32 } });
    vi.spyOn(dashboardService, 'getScores').mockResolvedValue({ success: true, data: [{ label: 'Điểm thật', percent: 35, color: '#0f766e' }] });
    vi.spyOn(dashboardService, 'getActivities').mockResolvedValue({ success: true, data: [{ id: 1, action: 'CREATE', detail: 'Hoạt động đã lưu', user: 'Quản trị', time: new Date().toISOString() }] });
    vi.spyOn(dashboardService, 'getSemesterOverview').mockResolvedValue({ success: true, data: null });
});
afterEach(() => { client.clear(); Modal.destroyAll(); message.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(Page) {
    return render(<ConfigProvider theme={{ token: { motion: false } }}><AppQueryProvider client={client}><MemoryRouter><Page /></MemoryRouter></AppQueryProvider></ConfigProvider>);
}

test('dashboard panel failure preserves successful scores and activities and does not render a false empty result', async () => {
    dashboardService.getScores.mockRejectedValue({ status: 500, message: 'Phân bố điểm gián đoạn' });
    mount(DashboardPage);
    expect(await screen.findByText('Hoạt động đã lưu')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Phân bố điểm gián đoạn');
    expect(screen.queryByText('Chưa có dữ liệu phân bổ điểm cho đợt đồ án này.')).not.toBeInTheDocument();
});

test('returning to dashboard keeps cached content visible during refresh and after refresh failure', async () => {
    const first = mount(DashboardPage);
    await screen.findByText('Hoạt động đã lưu');
    first.unmount();
    let rejectRefresh;
    dashboardService.getActivities.mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    mount(DashboardPage);
    expect(screen.getByText('Hoạt động đã lưu')).toBeInTheDocument();
    await waitFor(() => expect(rejectRefresh).toBeTypeOf('function'));
    await act(async () => rejectRefresh({ status: 500, message: 'Hoạt động chưa thể cập nhật' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hoạt động chưa thể cập nhật');
    expect(screen.getByText('Hoạt động đã lưu')).toBeInTheDocument();
});

test('report workload succeeds independently of overview failure', async () => {
    vi.spyOn(reportService, 'getOverview').mockRejectedValue({ status: 500, message: 'Tổng quan báo cáo gián đoạn' });
    vi.spyOn(reportService, 'getLecturerWorkload').mockResolvedValue([{ lecturerId: 1, fullName: 'Giảng viên thực tế', assignedCount: 4 }]);
    mount(AcademicReportsPage);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tổng quan báo cáo gián đoạn');
    await userEvent.click(screen.getByRole('tab', { name: 'Tải GVHD & Độ lệch điểm' }));
    expect(await screen.findByText('Giảng viên thực tế')).toBeInTheDocument();
});

test('report overview succeeds independently of workload failure', async () => {
    vi.spyOn(reportService, 'getOverview').mockResolvedValue({ kpis: { totalStudents: 47 }, gradeDistribution: [{ grade: 'GOOD', label: 'Xếp loại thật', count: 47, percent: 100 }] });
    vi.spyOn(reportService, 'getLecturerWorkload').mockRejectedValue({ status: 500, message: 'Tải giảng viên gián đoạn' });
    mount(AcademicReportsPage);
    expect((await screen.findAllByText('Xếp loại thật')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Tải GVHD & Độ lệch điểm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tải giảng viên gián đoạn');
    const failed = client.getQueryCache().getAll().find(query => query.state.error?.message === 'Tải giảng viên gián đoạn');
    expect(failed.state.status).toBe('error');
    expect(failed.state.data).toBeUndefined();
});

const userRow = { id: 41, code: 'GV041', fullName: 'Người dùng thật', email: 'gv@example.test', role: 'LECTURER', isActive: true };
function mockUsers() {
    vi.spyOn(userService, 'getUsers').mockImplementation(async params => ({ success: true, data: params.limit === 1 ? [] : [userRow], pagination: { page: params.page, limit: params.limit, total: 1 } }));
    vi.spyOn(permissionService, 'listGroups').mockResolvedValue({ success: true, data: [] });
}

test('user request failure renders retry without showing a successful empty user table', async () => {
    mockUsers();
    userService.getUsers.mockImplementation(async params => {
        if (params.limit === 1) return { success: true, data: [], pagination: { total: 3 } };
        throw { status: 500, message: 'Danh sách người dùng gián đoạn' };
    });
    mount(UserManagementPage);
    expect(await screen.findByRole('alert')).toHaveTextContent('Danh sách người dùng gián đoạn');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    userService.getUsers.mockResolvedValue({ success: true, data: [userRow], pagination: { page: 1, limit: 10, total: 1 } });
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Người dùng thật')).toBeInTheDocument();
});

test('user lock mutation invalidates user list and counts while keeping unrelated cached data fresh', async () => {
    mockUsers();
    vi.spyOn(userService, 'toggleActive').mockResolvedValue({ success: true, message: 'Đã khóa tài khoản' });
    mount(UserManagementPage);
    await screen.findByText('Người dùng thật');
    client.setQueryData(['unrelated'], 'keep');
    await userEvent.click(screen.getByRole('button', { name: /Thao tác/ }));
    await userEvent.click(await screen.findByText('Khóa tài khoản'));
    await userEvent.click(await screen.findByRole('button', { name: 'Đồng ý' }));
    await waitFor(() => expect(userService.toggleActive).toHaveBeenCalledWith(41));
    await waitFor(() => expect(userService.getUsers.mock.calls.filter(([params]) => params.limit === 10).length).toBe(2));
    await waitFor(() => expect(userService.getUsers.mock.calls.filter(([params]) => params.limit === 1).length).toBe(6));
    expect(client.getQueryState(['unrelated']).isInvalidated).toBe(false);
    expect(client.getQueryCache().getAll().filter(query => query.queryKey.includes('users')).length).toBeGreaterThan(0);
});

const matrix = { roles: [{ id: 1, code: 'ADMIN', name: 'Quản trị' }], modules: [{ module_name: 'USER', permissions: [{ id: 10, code: 'USER_MANAGE', label: 'Quản lý tài khoản thật' }] }], role_permissions: { 1: [] } };
function mockPermissions() {
    vi.spyOn(permissionService, 'getPermissionMatrix').mockResolvedValue({ success: true, data: matrix });
    vi.spyOn(permissionService, 'listGroups').mockResolvedValue({ success: true, data: [{ id: 2, code: 'GVHD', name: 'Nhóm quyền thật', permissions: [] }] });
    vi.spyOn(permissionService, 'listPermissions').mockResolvedValue({ success: true, data: [] });
}

test('permissions lazy-load groups independently of a failed catalog request', async () => {
    mockPermissions();
    permissionService.listPermissions.mockRejectedValue({ status: 500, message: 'Danh mục quyền gián đoạn' });
    mount(PermissionGroupPage);
    await screen.findByText('Quản lý tài khoản thật');
    expect(permissionService.listGroups).not.toHaveBeenCalled();
    expect(permissionService.listPermissions).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: /Quản Lý Nhóm Quyền/ }));
    expect(await screen.findByText('Nhóm quyền thật')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Từ Điển Quyền/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Danh mục quyền gián đoạn');
});

test('background matrix refresh preserves unsaved permission selections and collapsed modules', async () => {
    mockPermissions();
    mount(PermissionGroupPage);
    await screen.findByText('Quản lý tài khoản thật');
    await userEvent.click(screen.getByRole('button', { name: 'ADMIN: 0/1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thu gọn tất cả' }));
    permissionService.getPermissionMatrix.mockResolvedValueOnce({ success: true, data: { ...matrix, roles: [{ ...matrix.roles[0], name: 'Tên cập nhật từ máy chủ' }] } });
    await userEvent.click(screen.getByRole('button', { name: /Làm mới/ }));
    await waitFor(() => expect(permissionService.getPermissionMatrix).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'ADMIN: 1/1' })).toBeInTheDocument();
    expect(screen.queryByText('Quản lý tài khoản thật')).not.toBeInTheDocument();
    expect(screen.getByText(/Bạn có thay đổi chưa lưu/)).toBeInTheDocument();
});

test('initial matrix failure cannot be saved as a valid empty matrix', async () => {
    mockPermissions();
    permissionService.getPermissionMatrix.mockRejectedValue({ status: 500, message: 'Ma trận chưa tải được' });
    mount(PermissionGroupPage);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ma trận chưa tải được');
    expect(screen.getByRole('button', { name: /Lưu Ma Trận/ })).toBeDisabled();
    expect(screen.queryByText('Tổng số vai trò')).not.toBeInTheDocument();
});

test('an empty successful semester list does not leave report refresh spinning or submit undefined filters', async () => {
    semesterService.getAll.mockResolvedValue({ success: true, data: [] });
    vi.spyOn(reportService, 'getOverview').mockResolvedValue({});
    vi.spyOn(reportService, 'getLecturerWorkload').mockResolvedValue([]);
    mount(AcademicReportsPage);
    await screen.findByText('Không có dữ liệu');
    expect(screen.getByRole('button', { name: /Làm mới/ })).toBeDisabled();
    expect(reportService.getOverview).not.toHaveBeenCalled();
    expect(reportService.getLecturerWorkload).not.toHaveBeenCalled();
});

test('returning to report and users renders cached content while requests refresh', async () => {
    vi.spyOn(reportService, 'getOverview').mockResolvedValue({ kpis: { totalStudents: 47 }, gradeDistribution: [{ grade: 'GOOD', label: 'Xếp loại đã lưu', count: 47, percent: 100 }] });
    vi.spyOn(reportService, 'getLecturerWorkload').mockResolvedValue([]);
    const report = mount(AcademicReportsPage);
    await screen.findAllByText('Xếp loại đã lưu');
    report.unmount();
    let finishReport;
    reportService.getOverview.mockImplementationOnce(() => new Promise(resolve => { finishReport = resolve; }));
    const returnReport = mount(AcademicReportsPage);
    expect(screen.getAllByText('Xếp loại đã lưu').length).toBeGreaterThan(0);
    await waitFor(() => expect(finishReport).toBeTypeOf('function'));
    await act(async () => finishReport({ kpis: {}, gradeDistribution: [] }));
    returnReport.unmount();

    mockUsers();
    const users = mount(UserManagementPage);
    await screen.findByText('Người dùng thật');
    users.unmount();
    let finishUsers;
    userService.getUsers.mockImplementationOnce(() => new Promise(resolve => { finishUsers = resolve; }));
    mount(UserManagementPage);
    expect(screen.getByText('Người dùng thật')).toBeInTheDocument();
    await waitFor(() => expect(finishUsers).toBeTypeOf('function'));
    await act(async () => finishUsers({ success: true, data: [userRow], pagination: { page: 1, limit: 10, total: 1 } }));
});

test.each([{ groups: [] }, { groups: [{ id: 2, code: 'GVHD', name: 'Nhóm hướng dẫn', permissions: [] }] }])('failed user permission details cannot become an empty editable permission draft with $groups.length available groups', async ({ groups }) => {
    mockUsers();
    permissionService.listGroups.mockResolvedValue({ success: true, data: groups });
    vi.spyOn(userService, 'getUserPermissions').mockRejectedValue({ status: 500, message: 'Quyền người dùng chưa tải được' });
    mount(UserManagementPage);
    await screen.findByText('Người dùng thật');
    await userEvent.click(screen.getByRole('button', { name: /Thao tác/ }));
    await userEvent.click(await screen.findByText('Phân quyền nhóm'));
    const title = await screen.findByText('Phân nhóm quyền:', { exact: false });
    const dialog = title.closest('[role="dialog"]');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Quyền người dùng chưa tải được');
    expect(within(dialog).getByRole('button', { name: 'Lưu nhóm quyền' })).toBeDisabled();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
});

test('matrix mutation invalidates owning matrix and group lists without fetching lazy catalog or unrelated resources', async () => {
    mockPermissions();
    vi.spyOn(permissionService, 'bulkUpdatePermissionMatrix').mockResolvedValue({ success: true });
    mount(PermissionGroupPage);
    await screen.findByText('Quản lý tài khoản thật');
    const scope = ['scope', 7, null];
    const groupsKey = [...scope, 'permissions', 'list', { resource: 'groups' }];
    const catalogKey = [...scope, 'permissions', 'list', { resource: 'catalog' }];
    client.setQueryData(groupsKey, []);
    client.setQueryData(catalogKey, []);
    client.setQueryData(['unrelated'], 'keep');
    await userEvent.click(screen.getByRole('button', { name: 'ADMIN: 0/1' }));
    await userEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi Ma Trận/ }));
    await waitFor(() => expect(permissionService.bulkUpdatePermissionMatrix).toHaveBeenCalledWith([{ role_id: 1, permission_ids: [10] }]));
    await waitFor(() => expect(permissionService.getPermissionMatrix).toHaveBeenCalledTimes(2));
    expect(client.getQueryState(groupsKey).isInvalidated).toBe(true);
    expect(client.getQueryState(catalogKey).isInvalidated).toBe(false);
    expect(client.getQueryState(['unrelated']).isInvalidated).toBe(false);
    expect(permissionService.listPermissions).not.toHaveBeenCalled();
});
