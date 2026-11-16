import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider, LoginPage, ProtectedRoute, useAuth } from '@/features/auth';
import { ThemeProvider } from '@/theme';

// Route pages load on demand (see AppShell's Suspense boundary).
const KuboListPage = lazy(() => import('@/features/kubo').then((m) => ({ default: m.KuboListPage })));
const PaymentListPage = lazy(() => import('@/features/payment/lazy').then((m) => ({ default: m.PaymentListPage })));
const EmployeeListPage = lazy(() => import('@/features/employee').then((m) => ({ default: m.EmployeeListPage })));
const KuboTypeListPage = lazy(() => import('@/features/kubo-type').then((m) => ({ default: m.KuboTypeListPage })));
const GuestListPage = lazy(() => import('@/features/guest').then((m) => ({ default: m.GuestListPage })));
const GuestDetailPage = lazy(() => import('@/features/guest').then((m) => ({ default: m.GuestDetailPage })));
const ReservationListPage = lazy(() => import('@/features/reservation/lazy').then((m) => ({ default: m.ReservationListPage })));
const ReservationDetailPage = lazy(() => import('@/features/reservation/lazy').then((m) => ({ default: m.ReservationDetailPage })));
const CheckInOutPage = lazy(() => import('@/features/check-in-out/lazy').then((m) => ({ default: m.CheckInOutPage })));
const AdminDashboardPage = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.AdminDashboardPage })));
const StaffDashboardPage = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.StaffDashboardPage })));
const AuditLogListPage = lazy(() => import('@/features/audit-logs').then((m) => ({ default: m.AuditLogListPage })));
const AdditionalChargeCatalogPage = lazy(() =>
  import('@/features/additional-charge-catalog').then((m) => ({ default: m.AdditionalChargeCatalogPage })),
);
const ChargeRequestListPage = lazy(() => import('@/features/charge-request').then((m) => ({ default: m.ChargeRequestListPage })));

/** Sends `/` and unknown paths to the role's home page. */
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
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public sign-in */}
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
            <Route
              path="/kubo-types"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <KuboTypeListPage />
                </ProtectedRoute>
              }
            />
            <Route path="/reservations" element={<ReservationListPage />} />
            <Route path="/reservations/:reservationId" element={<ReservationDetailPage />} />
            <Route
              path="/check-in-out"
              element={
                <ProtectedRoute allowedRoles={['Staff']}>
                  <CheckInOutPage />
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/additional-charge-catalog"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <AdditionalChargeCatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/charge-requests"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <ChargeRequestListPage />
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
    </ThemeProvider>
  );
}

export default App;
