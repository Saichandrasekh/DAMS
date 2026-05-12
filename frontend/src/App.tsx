import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SchoolsPage } from '@/pages/superadmin/SchoolsPage';
import { AddSchoolPage } from '@/pages/superadmin/AddSchoolPage';
import { EditSchoolPage } from '@/pages/superadmin/EditSchoolPage';
import { CredentialsPage } from '@/pages/superadmin/CredentialsPage';
import { AuditLogsPage } from '@/pages/superadmin/AuditLogsPage';
import { StudentsPage } from '@/pages/admin/StudentsPage';
import { EditStudentPage } from '@/pages/admin/EditStudentPage';
import { StudentDetailPage } from '@/pages/admin/StudentDetailPage';
import { BatchesPage } from '@/pages/admin/BatchesPage';
import { BatchDetailPage } from '@/pages/admin/BatchDetailPage';
import { AttendanceOverviewPage } from '@/pages/admin/AttendanceOverviewPage';
import { TeachersPage } from '@/pages/admin/TeachersPage';
import { ClassesPage } from '@/pages/admin/ClassesPage';
import { SubjectsPage } from '@/pages/admin/SubjectsPage';
import { ExamsPage } from '@/pages/admin/ExamsPage';
import { HolidaysPage } from '@/pages/admin/HolidaysPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { StaffAttendancePage } from '@/pages/admin/StaffAttendancePage';
import { TimetablePage } from '@/pages/admin/TimetablePage';
import { MyClassesPage } from '@/pages/teacher/MyClassesPage';
import { MarkAttendancePage } from '@/pages/teacher/MarkAttendancePage';
import { MarksEntryPage } from '@/pages/teacher/MarksEntryPage';
import { AttendanceReportPage } from '@/pages/teacher/AttendanceReportPage';
import { TeacherTimetablePage } from '@/pages/teacher/TeacherTimetablePage';
import { StudentAttendancePage } from '@/pages/student/StudentAttendancePage';
import { StudentTimetablePage } from '@/pages/student/StudentTimetablePage';
import { StudentReportCardPage } from '@/pages/student/StudentReportCardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const ADMIN_ROLES = ['admin', 'principal'] as const;
const TEACHER_ROLES = ['teacher'] as const;
const STUDENT_ROLES = ['student'] as const;

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/superadmin/schools" element={<ProtectedRoute roles={['super_admin']}><SchoolsPage /></ProtectedRoute>} />
              <Route path="/superadmin/schools/new" element={<ProtectedRoute roles={['super_admin']}><AddSchoolPage /></ProtectedRoute>} />
              <Route path="/superadmin/schools/:id/edit" element={<ProtectedRoute roles={['super_admin']}><EditSchoolPage /></ProtectedRoute>} />
              <Route path="/superadmin/credentials" element={<ProtectedRoute roles={['super_admin']}><CredentialsPage /></ProtectedRoute>} />
              <Route path="/superadmin/audit-logs" element={<ProtectedRoute roles={['super_admin']}><AuditLogsPage /></ProtectedRoute>} />

              <Route path="/admin/students" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><StudentsPage /></ProtectedRoute>} />
              <Route path="/admin/students/:id" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><StudentDetailPage /></ProtectedRoute>} />
              <Route path="/admin/students/:id/edit" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><EditStudentPage /></ProtectedRoute>} />
              <Route path="/admin/batches" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><BatchesPage /></ProtectedRoute>} />
              <Route path="/admin/batches/:year" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><BatchDetailPage /></ProtectedRoute>} />
              <Route path="/admin/attendance-overview" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><AttendanceOverviewPage /></ProtectedRoute>} />
              <Route path="/admin/teachers" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><TeachersPage /></ProtectedRoute>} />
              <Route path="/admin/classes" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><ClassesPage /></ProtectedRoute>} />
              <Route path="/admin/subjects" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><SubjectsPage /></ProtectedRoute>} />
              <Route path="/admin/exams" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><ExamsPage /></ProtectedRoute>} />
              <Route path="/admin/holidays" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><HolidaysPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><SettingsPage /></ProtectedRoute>} />
              <Route path="/admin/staff-attendance" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><StaffAttendancePage /></ProtectedRoute>} />
              <Route path="/admin/timetable" element={<ProtectedRoute roles={[...ADMIN_ROLES]}><TimetablePage /></ProtectedRoute>} />

              <Route path="/teacher/my-classes" element={<ProtectedRoute roles={[...TEACHER_ROLES]}><MyClassesPage /></ProtectedRoute>} />
              <Route path="/teacher/mark-attendance" element={<ProtectedRoute roles={[...TEACHER_ROLES]}><MarkAttendancePage /></ProtectedRoute>} />
              <Route path="/teacher/marks-entry" element={<ProtectedRoute roles={[...TEACHER_ROLES]}><MarksEntryPage /></ProtectedRoute>} />
              <Route path="/teacher/attendance-report" element={<ProtectedRoute roles={[...TEACHER_ROLES]}><AttendanceReportPage /></ProtectedRoute>} />
              <Route path="/teacher/timetable" element={<ProtectedRoute roles={[...TEACHER_ROLES]}><TeacherTimetablePage /></ProtectedRoute>} />

              <Route path="/student/attendance" element={<ProtectedRoute roles={[...STUDENT_ROLES]}><StudentAttendancePage /></ProtectedRoute>} />
              <Route path="/student/timetable" element={<ProtectedRoute roles={[...STUDENT_ROLES]}><StudentTimetablePage /></ProtectedRoute>} />
              <Route path="/student/report-card" element={<ProtectedRoute roles={[...STUDENT_ROLES]}><StudentReportCardPage /></ProtectedRoute>} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
