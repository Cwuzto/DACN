import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';
import ProjectPeriodPage from '../src/pages/admin/ProjectPeriodPage.jsx';
import { semesterService } from '../src/services/semesterService.js';
import { topicService } from '../src/services/topicService.js';
import registrationService from '../src/services/registrationService.js';
let client;
const user = { id: 7, role: 'ADMIN', permissions: [] };
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  const native = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => native(element));
  client = createAppQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } });
  useAuthStore.setState({ user, isAuthenticated: true });
  vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 12, name: 'Semester', code: 'TEST', status: 'ONGOING' }] });
  vi.spyOn(topicService, 'getAll').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [] });
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount(children, url = '/') {
  return render(<ConfigProvider theme={{ token: { motion: false } }}><AppQueryProvider client={client}><MemoryRouter initialEntries={[url]}>{children}</MemoryRouter></AppQueryProvider></ConfigProvider>);
}
test('periods retain URL-selected BM02 tab and share semester cache across page mounts', async () => {
  const first = mount(<ProjectPeriodPage />, '/?tab=bm02');
  await waitFor(() => expect(screen.getByRole('tab', { name: /BM02/ })).toHaveAttribute('aria-selected', 'true'));
  await waitFor(() => expect(client.getQueryData(queryKeys.semesters.list(queryKeys.scope(user)))).toBeDefined());
  first.unmount();
  mount(<ProjectPeriodPage />, '/?tab=bm02');
  expect(semesterService.getAll).toHaveBeenCalledTimes(1);
});
test('period failure is a retryable error rather than a successful empty period list', async () => {
  semesterService.getAll.mockRejectedValue({ message: 'Period unavailable', status: 500 });
  mount(<ProjectPeriodPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Period unavailable');
  expect(client.getQueryState(queryKeys.semesters.list(queryKeys.scope(user))).status).toBe('error');
});

test('council modal and page observers deduplicate logs, disabled detail stays idle, mutation refreshes list/detail/log', async () => {
  const modules = import.meta.glob('../src/queries/*Queries.js');
  expect(modules['../src/queries/councilQueries.js']).toBeTypeOf('function');
  const hooks = await modules['../src/queries/councilQueries.js']();
  const { default: service } = await import('../src/services/councilService.js');
  vi.spyOn(service, 'getCouncilLogs').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(service, 'getCouncilById').mockResolvedValue({ success: true, data: { id: 3, name: 'Council' } });
  vi.spyOn(service, 'getCouncils').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(service, 'updateCouncil').mockResolvedValue({ success: true });
  let mutation;
  function Observer({ enabled }) {
    hooks.useCouncilLogs(queryKeys.scope(user), 3, enabled);
    hooks.useCouncilDetail(queryKeys.scope(user), enabled ? 3 : null);
    hooks.useCouncils(queryKeys.scope(user), { semesterId: 12 });
    mutation = hooks.useCouncilMutation(queryKeys.scope(user), 12);
    return null;
  }
  const view = mount(<><Observer enabled={false} /><Observer enabled={false} /></>);
  await waitFor(() => expect(service.getCouncils).toHaveBeenCalledTimes(1));
  expect(service.getCouncilById).not.toHaveBeenCalled();
  expect(service.getCouncilLogs).not.toHaveBeenCalled();
  view.rerender(<AppQueryProvider client={client}><Observer enabled /><Observer enabled /></AppQueryProvider>);
  await waitFor(() => expect(service.getCouncilLogs).toHaveBeenCalledTimes(1));
  await mutation.mutateAsync({ action: 'updateCouncil', args: [3, { name: 'Updated' }] });
  await waitFor(() => expect(service.getCouncilById).toHaveBeenCalledTimes(2));
  expect(service.getCouncilLogs).toHaveBeenCalledTimes(2);
  expect(service.getCouncils).toHaveBeenCalledTimes(2);
});

test('grading and period semester hooks share a canonical array without a shape conflict', async () => {
  const { useSemesters } = await import('../src/queries/semesterQueries.js');
  const { useGradingSemesters } = await import('../src/queries/gradingQueries.js');
  function Observer() {
    const standard = useSemesters(queryKeys.scope(user));
    const grading = useGradingSemesters(queryKeys.scope(user));
    return <div>{standard.data?.[0]?.id}:{grading.data?.data?.[0]?.id}</div>;
  }
  mount(<Observer />);
  expect(await screen.findByText('12:12')).toBeInTheDocument();
  expect(semesterService.getAll).toHaveBeenCalledTimes(1);
});

test('enrollment pagination keys separate pages while identical page and child reads deduplicate', async () => {
  const modules = import.meta.glob('../src/queries/*Queries.js');
  expect(modules['../src/queries/enrollmentQueries.js']).toBeTypeOf('function');
  const { useEnrollments } = await modules['../src/queries/enrollmentQueries.js']();
  const { default: service } = await import('../src/services/projectEnrollmentService.js');
  vi.spyOn(service, 'getEnrollments').mockImplementation(async filters => ({ success: true, data: [{ id: filters.page }] }));
  function Observer({ page }) {
    const result = useEnrollments(queryKeys.scope(user), { semesterId: 12, projectCatalogId: 5, status: 'ACTIVE', search: 'SV', page, limit: 10 });
    return <span>{result.data?.[0]?.id}</span>;
  }
  mount(<><Observer page={1} /><Observer page={1} /><Observer page={2} /></>);
  expect(await screen.findByText('2')).toBeInTheDocument();
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(service.getEnrollments).toHaveBeenCalledTimes(2);
});
import { Routes, Route } from 'react-router-dom';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouncilDetailPage from '../src/pages/admin/CouncilDetailPage.jsx';
import CouncilAssignmentPage from '../src/pages/admin/CouncilAssignmentPage.jsx';
import CouncilAuditLogModal from '../src/components/admin/CouncilAuditLogModal.jsx';
import ProjectEnrollmentPage from '../src/pages/admin/ProjectEnrollmentPage.jsx';
import CoordinationOverviewTab from '../src/components/coordination/CoordinationOverviewTab.jsx';
import councilService from '../src/services/councilService.js';
import userService from '../src/services/userService.js';
import enrollmentService from '../src/services/projectEnrollmentService.js';
import assignmentService from '../src/services/lecturerAssignmentService.js';

function mockCouncil() {
  vi.spyOn(userService, 'getUsers').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(councilService, 'getCouncilById').mockResolvedValue({ success: true, data: { id: 3, name: 'Actual council', semesterId: 12, councilType: 'DEFENSE_COUNCIL', members: [], registrations: [] } });
  vi.spyOn(councilService, 'getCouncilLogs').mockResolvedValue({ success: true, data: [] });
}
test('actual council detail page and audit modal make one log request including empty successful logs', async () => {
  mockCouncil();
  mount(<Routes><Route path='/councils/:id' element={<CouncilDetailPage />} /></Routes>, '/councils/3');
  await screen.findByText('Actual council');
  expect(councilService.getCouncilLogs).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /Lịch sử thao tác/ }));
  await waitFor(() => expect(councilService.getCouncilLogs).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
test('failed council edit leaves typed values and dialog open', async () => {
  mockCouncil();
  vi.spyOn(councilService, 'updateCouncil').mockResolvedValue({ success: false, message: 'Save rejected' });
  mount(<Routes><Route path='/councils/:id' element={<CouncilDetailPage />} /></Routes>, '/councils/3');
  await screen.findByText('Actual council');
  await userEvent.click(screen.getByRole('button', { name: /Sửa thông tin HĐ/ }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByLabelText('Tên hội đồng');
  await userEvent.clear(input);
  await userEvent.type(input, 'Unsaved council');
  await userEvent.click(within(dialog).getByRole('button', { name: /OK/ }));
  await waitFor(() => expect(councilService.updateCouncil).toHaveBeenCalled());
  expect(await screen.findByText('Save rejected')).toBeInTheDocument();
  expect(input).toHaveValue('Unsaved council');
  expect(dialog).toBeInTheDocument();
});
test('audit log transport failure never renders a successful empty log', async () => {
  vi.spyOn(councilService, 'getCouncilLogs').mockRejectedValue({ status: 500, message: 'Logs unavailable' });
  mount(<CouncilAuditLogModal open council={{ id: 3 }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Logs unavailable');
  expect(screen.queryByText('Chưa có lịch sử thao tác')).not.toBeInTheDocument();
});
test('enrollment page retains students URL tab and audit shares its unfiltered enrollment request', async () => {
  vi.spyOn(userService, 'getUsers').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(enrollmentService, 'getCatalogs').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(enrollmentService, 'getEnrollments').mockResolvedValue({ success: true, data: [] });
  mount(<ProjectEnrollmentPage />, '/?tab=students&semesterId=12');
  await waitFor(() => expect(screen.getByRole('tab', { name: /Sinh viên/ })).toHaveAttribute('aria-selected', 'true'));
  await screen.findByText('Danh sách (0 sinh viên)');
  expect(enrollmentService.getEnrollments).toHaveBeenCalledTimes(1);
});
test('overview error does not claim zero students', async () => {
  vi.spyOn(assignmentService, 'getOverview').mockRejectedValue({ status: 500, message: 'Overview unavailable' });
  mount(<CoordinationOverviewTab semesterId={12} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Overview unavailable');
  expect(screen.queryByText('Sinh viên đợt này')).not.toBeInTheDocument();
});
test('council list mounts its actual query filters and reuses semester cache', async () => {
  vi.spyOn(userService, 'getUsers').mockResolvedValue({ success: true, data: [] });
  vi.spyOn(councilService, 'getCouncils').mockResolvedValue({ success: true, data: [] });
  mount(<CouncilAssignmentPage forcedCouncilType='OUTLINE_REVIEW' />);
  await waitFor(() => expect(councilService.getCouncils).toHaveBeenCalledWith({ semesterId: 12, councilType: 'OUTLINE_REVIEW' }));
});

test('failed BM02 registrations show a retry instead of an empty queue', async () => {
  registrationService.getAllRegistrations.mockRejectedValue({ status: 500, message: 'BM02 unavailable' });
  mount(<ProjectPeriodPage />, '/?tab=bm02');
  expect(await screen.findByRole('alert')).toHaveTextContent('BM02 unavailable');
});

test('bulk council assignment invalidates affected cached detail but leaves other semesters fresh', async () => {
  const { useCouncilMutation } = await import('../src/queries/councilQueries.js');
  const scope = queryKeys.scope(user);
  const key = queryKeys.councils.detail(scope, '3');
  const other = queryKeys.councils.detail(scope, '4');
  client.setQueryData(key, { id: 3, semesterId: 12 });
  client.setQueryData(other, { id: 4, semesterId: 99 });
  vi.spyOn(councilService, 'autoAssignRegistrations').mockResolvedValue({ success: true });
  let mutation;
  function Observer() { mutation = useCouncilMutation(scope, 12); return null; }
  mount(<Observer />);
  await mutation.mutateAsync({ action: 'autoAssignRegistrations', args: [12] });
  expect(client.getQueryState(key).isInvalidated).toBe(true);
  expect(client.getQueryState(other).isInvalidated).toBe(false);
});

test('enrollment import invalidates the payload semester instead of the visible filter', async () => {
  const { useEnrollmentMutation, enrollmentKeys } = await import('../src/queries/enrollmentQueries.js');
  const scope = queryKeys.scope(user);
  const visible = enrollmentKeys.list(scope, { semesterId: 12 });
  const target = enrollmentKeys.list(scope, { semesterId: 99 });
  client.setQueryData(visible, []);
  client.setQueryData(target, []);
  vi.spyOn(enrollmentService, 'importEnrollmentsExcel').mockResolvedValue({ success: true });
  let mutation;
  function Observer() { mutation = useEnrollmentMutation(scope, 12); return null; }
  mount(<Observer />);
  await mutation.mutateAsync({ action: 'importEnrollmentsExcel', args: [{ semesterId: 99, rows: [] }] });
  expect(client.getQueryState(target).isInvalidated).toBe(true);
  expect(client.getQueryState(visible).isInvalidated).toBe(false);
});
