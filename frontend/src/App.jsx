import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

// Nordic Institute Theme — Scandinavian Precision & Academic Excellence
const nordicTheme = {
    token: {
        colorPrimary: '#0F766E', // Alpine Forest Teal
        colorPrimaryHover: '#115E59',
        colorPrimaryActive: '#0D5D57',
        colorPrimaryBg: '#F0FDFA',
        colorSuccess: '#059669',
        colorWarning: '#D97706',
        colorError: '#BE123C', // Nordic Brick Red
        colorInfo: '#0F766E',
        colorBgLayout: '#F4F6F8', // Crisp Fog Gray
        colorBgContainer: '#FFFFFF',
        colorBorder: '#E2E8F0',
        colorBorderSecondary: '#F1F5F9',
        colorText: '#1E293B',
        colorTextSecondary: '#475569',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 14,
        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        controlHeight: 36,
    },
    components: {
        Layout: {
            headerBg: '#FFFFFF',
            headerHeight: 56,
            siderBg: '#FFFFFF',
            bodyBg: '#F4F6F8',
        },
        Card: {
            paddingLG: 20,
            boxShadowTertiary: '0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        },
        Table: {
            headerBg: '#F8FAFC',
            headerColor: '#1E293B',
            rowHoverBg: '#F1F5F9',
            borderColor: '#E2E8F0',
        },
        Button: {
            fontWeight: 500,
        },
        Menu: {
            itemSelectedBg: '#F0FDFA',
            itemSelectedColor: '#0F766E',
        },
        Tag: {
            borderRadiusSM: 4,
        },
    },
};

// Layouts
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
        <ConfigProvider locale={viVN} theme={nordicTheme}>
            <BrowserRouter>
                <Suspense fallback={<RouteLoading />}>
                    <Routes>
                        <Route element={<PublicOnlyRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<DashboardPage />} />
                                <Route path="users" element={<UserManagementPage />} />
                                <Route path="project-periods" element={<ProjectPeriodPage />} />
                                <Route path="topics" element={<AdminTopicManagementPage />} />
                                <Route path="oversight" element={<ProjectOversightPage />} />
                                <Route path="grading" element={<GradingDefensePage />} />
                                <Route path="rubric-management" element={<RubricManagementPage />} />
                                <Route path="councils" element={<CouncilAssignmentPage />} />
                                <Route path="project-enrollments" element={<ProjectEnrollmentPage />} />
                                <Route path="announcements" element={<AnnouncementManagementPage />} />
                                <Route path="permissions" element={<PermissionGroupPage />} />
                                <Route path="notifications" element={<NotificationCenterPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={['LECTURER']} />}>
                            <Route path="/lecturer/grading/sheet/:registrationId" element={<LecturerGradingSheetPage />} />
                            <Route path="/lecturer" element={<LecturerLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<LecturerDashboardPage />} />
                                <Route path="topics" element={<LecturerTopicManagementPage />} />
                                <Route path="approvals" element={<TopicApprovalPage />} />
                                <Route path="progress" element={<ProgressTrackingPage />} />
                                <Route path="grading" element={<GradingPage />} />
                                <Route path="notifications" element={<NotificationsPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
                            <Route path="/student" element={<StudentLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<StudentDashboardPage />} />
                                <Route path="topics" element={<TopicListPage />} />
                                <Route path="submissions" element={<SubmissionPage />} />
                                <Route path="grades" element={<GradeViewPage />} />
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
