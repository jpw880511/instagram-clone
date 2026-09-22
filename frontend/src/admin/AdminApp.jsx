import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext";
import { AdminLayout } from "./AdminLayout";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminDashboardPage } from "./AdminDashboardPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminPostsPage } from "./AdminPostsPage";

function AdminProtectedRoute() {
  const { authed } = useAdminAuth();
  if (!authed) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

function AdminGuestRoute() {
  const { authed } = useAdminAuth();
  if (authed) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminGuestRoute />}>
        <Route path="login" element={<AdminLoginPage />} />
      </Route>

      <Route element={<AdminProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="posts" element={<AdminPostsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  );
}
