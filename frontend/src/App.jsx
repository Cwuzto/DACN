import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
import LecturerLayout from './components/layout/LecturerLayout';
import StudentLayout from './components/layout/StudentLayout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Admin Pages
import DashboardPage from './pages/admin/DashboardPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ProjectPeriodPage from './pages/admin/ProjectPeriodPage';
import AdminTopicManagementPage from './pages/admin/TopicManagementPage';
import CouncilAssignmentPage from './pages/admin/CouncilAssignmentPage';
import ProjectOversightPage from './pages/admin/ProjectOversightPage';
import GradingDefensePage from './pages/admin/GradingDefensePage';
import NotificationCenterPage from './pages/admin/NotificationCenterPage';

// Lecturer Pages
import LecturerDashboardPage from './pages/lecturer/LecturerDashboardPage';
import LecturerTopicManagementPage from './pages/lecturer/TopicManagementPage';
import TopicApprovalPage from './pages/lecturer/TopicApprovalPage';
import ProgressTrackingPage from './pages/lecturer/ProgressTrackingPage';
import GradingPage from './pages/lecturer/GradingPage';

// Student Pages
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import TopicListPage from './pages/student/TopicListPage';
import SubmissionPage from './pages/student/SubmissionPage';
import GradeViewPage from './pages/student/GradeViewPage';

// Common Pages
import NotificationsPage from './pages/common/NotificationsPage';
import ProfilePage from './pages/common/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang Login & Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* ===== Admin Routes ===== */}
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
            <Route path="notifications" element={<NotificationCenterPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* ===== Lecturer Routes ===== */}
        <Route element={<ProtectedRoute allowedRoles={['LECTURER']} />}>
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

        {/* ===== Student Routes ===== */}
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

        {/* Redirect mặc định dùng ProtectedRoute không role để tự động đưa về đúng Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
