import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

// Academic Pine Teal Theme — Standardized from Lecturer Workspace Prototype
const academicPineTheme = {
    token: {
        colorPrimary: '#0F766E', // Deep Pine Teal
        colorPrimaryHover: '#115E59',
        colorPrimaryActive: '#0D5D57',
        colorPrimaryBg: '#F0FDFA',
        colorSuccess: '#16A34A',
        colorWarning: '#D97706',
        colorError: '#DC2626',
        colorInfo: '#0F766E',
        colorBgLayout: '#F8FAFC',
        colorBgContainer: '#FFFFFF',
        colorBorder: '#E2E8F0',
        colorBorderSecondary: '#F1F5F9',
        colorText: '#0F172A',
        colorTextSecondary: '#334155', // Slate-700 (9.5:1 high contrast)
        colorTextTertiary: '#475569',  // Slate-600 (7.0:1 WCAG AAA for descriptions/subtexts)
        colorTextQuaternary: '#64748B', // Slate-500 (4.6:1 WCAG AA for disabled/faint elements)
        colorTextDescription: '#475569', // Slate-600 for card/item descriptions
        colorTextPlaceholder: '#64748B', // Slate-500 for legible placeholders
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 14,
        borderRadius: 8,
        borderRadiusLG: 10,
        borderRadiusSM: 6,
        controlHeight: 36,
    },
    components: {
        Layout: {
            headerBg: '#FFFFFF',
            headerHeight: 56,
            siderBg: '#FFFFFF',
            bodyBg: '#F8FAFC',
        },
        Card: {
            paddingLG: 20,
            borderRadiusLG: 10,
            boxShadowTertiary: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        },
        Table: {
            headerBg: '#FAFAFA',
            headerColor: '#0F172A',
            rowHoverBg: '#F8FAFC',
            borderColor: '#E2E8F0',
            cellPaddingBlock: 12,
            cellPaddingInline: 14,
        },
        Button: {
            fontWeight: 600,
            borderRadius: 6,
            controlHeight: 36,
        },
        Menu: {
            itemBorderRadius: 6,
            itemSelectedBg: '#F0FDFA',
            itemSelectedColor: '#0F766E',
            itemHoverBg: '#F1F5F9',
        },
        Tag: {
            borderRadiusSM: 4,
        },
        Modal: {
            borderRadiusLG: 12,
            headerBg: '#FFFFFF',
        },
        Drawer: {
            headerPadding: '16px 20px',
            bodyPadding: '20px',
        },
    },
};

// Layouts
import AppLayout from './components/layout/AppLayout';
import AdminLayout from './components/layout/AdminLayout';
import LecturerLayout from './components/layout/LecturerLayout';
import StudentLayout from './components/layout/StudentLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicOnlyRoute from './components/common/PublicOnlyRoute';
import RoleDashboardRedirect from './components/common/RoleDashboardRedirect';
import RouteFallbackHandler from './components/common/RouteFallbackHandler';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const HomePage = lazy(() => import('./pages/common/HomePage'));

// Admin pages
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const ProjectPeriodPage = lazy(() => import('./pages/admin/ProjectPeriodPage'));
const AdminTopicManagementPage = lazy(() => import('./pages/admin/TopicManagementPage'));
const CouncilAssignmentPage = lazy(() => import('./pages/admin/CouncilAssignmentPage'));
const ProjectOversightPage = lazy(() => import('./pages/admin/ProjectOversightPage'));
const GradingDefensePage = lazy(() => import('./pages/admin/GradingDefensePage'));
const NotificationCenterPage = lazy(() => import('./pages/admin/NotificationCenterPage'));
const ProjectEnrollmentPage = lazy(() => import('./pages/admin/ProjectEnrollmentPage'));
const PermissionGroupPage = lazy(() => import('./pages/admin/PermissionGroupPage'));
const AnnouncementManagementPage = lazy(() => import('./pages/admin/AnnouncementManagementPage'));
const RubricManagementPage = lazy(() => import('./pages/admin/RubricManagementPage'));
const PortalContentManagementPage = lazy(() => import('./pages/admin/PortalContentManagementPage'));

// Lecturer pages
const LecturerDashboardPage = lazy(() => import('./pages/lecturer/LecturerDashboardPage'));
const LecturerTopicManagementPage = lazy(() => import('./pages/lecturer/TopicManagementPage'));
const TopicApprovalPage = lazy(() => import('./pages/lecturer/TopicApprovalPage'));
const ProgressTrackingPage = lazy(() => import('./pages/lecturer/ProgressTrackingPage'));
const GradingPage = lazy(() => import('./pages/lecturer/GradingPage'));
const LecturerGradingSheetPage = lazy(() => import('./pages/lecturer/LecturerGradingSheetPage'));

// Student pages
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const TopicListPage = lazy(() => import('./pages/student/TopicListPage'));
const SubmissionPage = lazy(() => import('./pages/student/SubmissionPage'));
const GradeViewPage = lazy(() => import('./pages/student/GradeViewPage'));

// Common pages
const NotificationsPage = lazy(() => import('./pages/common/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/common/ProfilePage'));

function RouteLoading() {
    return (
        <div className="min-h-[40vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
    );
}

function App() {
    return (
        <ConfigProvider locale={viVN} theme={academicPineTheme}>
            <BrowserRouter>
                <Suspense fallback={<RouteLoading />}>
                    <Routes>
                        <Route element={<PublicOnlyRoute />}>
                            <Route path="/login" element={<Navigate to="/?login=true" replace />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        </Route>

                        {/* Authenticated Workspace Routes — Unified under AppLayout and Capability Guards */}
                        <Route element={<ProtectedRoute />}>
                            {/* Admin & Academic Governance Routes */}
                            <Route path="/admin" element={<AppLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<DashboardPage />} />
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_USERS', 'USER_MANAGE', 'PERMISSION_GROUP_MANAGE']} />}>
                                    <Route path="users" element={<UserManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_PROJECT_PERIODS', 'SEMESTER_MANAGE']} />}>
                                    <Route path="project-periods" element={<ProjectPeriodPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_ALL_TOPICS', 'TOPIC_REVIEW']} />}>
                                    <Route path="topics" element={<AdminTopicManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_PROJECT_OVERSIGHT', 'REPORT_VIEW', 'PROJECT_OVERSIGHT_MANAGE']} />}>
                                    <Route path="oversight" element={<ProjectOversightPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_DEFENSE_LOCK_LEDGER', 'DEFENSE_SCORE_VIEW', 'RESULT_LOCK']} />}>
                                    <Route path="grading" element={<GradingDefensePage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_RUBRIC_CONFIG', 'RUBRIC_MANAGE']} />}>
                                    <Route path="rubric-management" element={<RubricManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_COUNCIL_ASSIGNMENTS', 'OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE']} />}>
                                    <Route path="councils" element={<CouncilAssignmentPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_PROJECT_ENROLLMENTS', 'ENROLLMENT_MANAGE', 'PROJECT_CATALOG_MANAGE']} />}>
                                    <Route path="project-enrollments" element={<ProjectEnrollmentPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_ANNOUNCEMENTS', 'PUBLIC_ANNOUNCEMENT_MANAGE']} />}>
                                    <Route path="announcements" element={<AnnouncementManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_PORTAL_CONTENT', 'PORTAL_CONTENT_MANAGE']} />}>
                                    <Route path="portal" element={<PortalContentManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_PERMISSIONS', 'PERMISSION_GROUP_MANAGE']} />}>
                                    <Route path="permissions" element={<PermissionGroupPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_NOTIFICATIONS', 'NOTIFICATION_MANAGE']} />}>
                                    <Route path="notifications" element={<NotificationCenterPage />} />
                                </Route>
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* Lecturer Routes & Scoring Sheet */}
                            <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW', 'DEFENSE_SCORE_SUBMIT']} />}>
                                <Route path="/lecturer/grading/sheet/:registrationId" element={<LecturerGradingSheetPage />} />
                            </Route>
                            <Route path="/lecturer" element={<AppLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<LecturerDashboardPage />} />
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_CHECKPOINTS', 'VIEW_BM04_EVALUATIONS', 'BM03_REVIEW']} />}>
                                    <Route path="progress" element={<ProgressTrackingPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_MY_TOPICS', 'TOPIC_CREATE', 'TOPIC_UPDATE_OWN']} />}>
                                    <Route path="topics" element={<LecturerTopicManagementPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_MENTORED_STUDENTS', 'VIEW_OUTLINE_REVIEWS', 'MENTOR_REQUEST_REVIEW', 'OUTLINE_REVIEW']} />}>
                                    <Route path="approvals" element={<TopicApprovalPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_VIEW']} />}>
                                    <Route path="grading" element={<GradingPage />} />
                                </Route>
                                <Route
                                    element={(
                                        <ProtectedRoute
                                            requiredAnyPermissions={[
                                                'VIEW_BM02_REVIEWS',
                                                'VIEW_ASSIGNMENT_DECISIONS',
                                                'VIEW_ACADEMIC_DELEGATIONS',
                                                'PROJECT_ASSIGNMENT_PUBLISH',
                                            ]}
                                        />
                                    )}
                                >
                                    <Route path="institute" element={<ProjectPeriodPage />} />
                                </Route>
                                <Route path="notifications" element={<NotificationsPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* Student Routes */}
                            <Route path="/student" element={<AppLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<StudentDashboardPage />} />
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_MY_REGISTRATION', 'REGISTER_TOPIC']} />}>
                                    <Route path="topics" element={<TopicListPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_MY_SUBMISSIONS', 'SUBMIT_BM01', 'SUBMIT_BM02', 'SUBMIT_TASK']} />}>
                                    <Route path="submissions" element={<SubmissionPage />} />
                                </Route>
                                <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_MY_GRADES']} />}>
                                    <Route path="grades" element={<GradeViewPage />} />
                                </Route>
                                <Route path="notifications" element={<NotificationsPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>
                        </Route>

                        <Route path="/dashboard" element={<RoleDashboardRedirect />} />
                        <Route path="/" element={<HomePage />} />
                        <Route path="*" element={<RouteFallbackHandler />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </ConfigProvider>
    );
}

export default App;
