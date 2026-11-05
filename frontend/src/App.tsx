import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { KuboListPage } from '@/features/kubo';
import { PaymentListPage } from '@/features/payment';
import { EmployeeListPage } from '@/features/employee';
import { KuboTypeListPage } from '@/features/kubo-type';
import { GuestListPage, GuestDetailPage } from '@/features/guest';
import { ReservationListPage, ReservationDetailPage } from '@/features/reservation';
import { CheckInOutPage } from '@/features/check-in-out';
import { AuthProvider, LoginPage, ProtectedRoute, useAuth } from '@/features/auth';
import { AdminDashboardPage, StaffDashboardPage } from '@/features/dashboard';
import { AuditLogListPage } from '@/features/audit-logs';

/**
 * Dynamically redirects root '/' based on the user's authenticated role (BR-005).
 */
function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={role === 'Administrator' ? '/admin' : '/staff'} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Sign-In Portal (BR-003, BR-004) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Workspace with Role-Specific Navigation */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* Dynamic Role Landing */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Administrator Oversight Dashboard */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Staff Front Desk Operations Dashboard */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['Staff']}>
                  <StaffDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Common & Operational Features */}
            <Route path="/kubos" element={<KuboListPage />} />
            <Route path="/kubo-types" element={<KuboTypeListPage />} />
            <Route path="/reservations" element={<ReservationListPage />} />
            <Route path="/reservations/:reservationId" element={<ReservationDetailPage />} />
            <Route path="/check-in-out" element={<CheckInOutPage />} />
            <Route path="/guests" element={<GuestListPage />} />
            <Route path="/guests/:guestId" element={<GuestDetailPage />} />
            <Route path="/payments" element={<PaymentListPage />} />
            <Route
              path="/employees"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <EmployeeListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <AuditLogListPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
