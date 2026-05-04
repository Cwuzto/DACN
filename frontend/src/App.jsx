import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

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
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#003366',
                    fontFamily: "'Inter', 'Roboto', 'sans-serif'",
                    borderRadius: 6,
                },
                components: {
                    Typography: {
                        fontFamilyCode: "'Lexend', 'Inter', 'sans-serif'",
                    }
                }
            }}
        >
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
                                <Route path="councils" element={<CouncilAssignmentPage />} />
                                <Route path="project-enrollments" element={<ProjectEnrollmentPage />} />
                                <Route path="notifications" element={<NotificationCenterPage />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={['LECTURER']} />}>
                            <Route path="/lecturer" element={<LecturerLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<LecturerDashboardPage />} />
                                <Route path="topics" element={<LecturerTopicManagementPage />} />
                                <Route path="approvals" element={<TopicApprovalPage />} />
                                <Route path="progress" element={<ProgressTrackingPage />} />
                                <Route path="grading" element={<GradingPage />} />
                                <Route path="grading/sheet/:registrationId" element={<LecturerGradingSheetPage />} />
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
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<RouteFallbackHandler />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </ConfigProvider>
    );
}

export default App;
