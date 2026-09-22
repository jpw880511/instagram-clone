import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppShell } from "./components/layout/AppShell";
import { AuthLayout } from "./components/layout/AuthLayout";
import { Spinner } from "./components/common/Spinner";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { ReelsPage } from "./pages/ReelsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { HashtagPage } from "./pages/HashtagPage";
import { FollowListPage } from "./pages/FollowListPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminApp } from "./admin/AdminApp";

function CenterSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <Spinner size={32} />
    </div>
  );
}

function ProtectedRoute() {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <CenterSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

function GuestRoute() {
  const { user, booting } = useAuth();
  if (booting) return <CenterSpinner />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />

      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route path="/*" element={<AppShell renderPages={(location) => <ShellPages location={location} />} />} />
    </Routes>
  );
}

// AppShell 안에 표시되는 화면들. 모바일에서 알림/메시지가 이전 화면 위에 덮이도록
// AppShell이 location을 바꿔가며(배경 화면 / 현재 화면) 두 번 렌더링할 수 있게 분리했다.
function ShellPages({ location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<HomePage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/explore/tags/:name" element={<HashtagPage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/direct" element={<MessagesPage />} />
        <Route path="/direct/:conversationId" element={<MessagesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/p/:postId" element={<PostDetailPage />} />
        <Route path="/accounts/edit" element={<EditProfilePage />} />
        <Route path="/:username/followers" element={<FollowListPage mode="followers" />} />
        <Route path="/:username/following" element={<FollowListPage mode="following" />} />
        <Route path="/:username" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
