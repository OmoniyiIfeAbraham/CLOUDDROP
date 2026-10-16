import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthPage } from "../pages/AuthPage";
import { ForgotPasswordPage, ResetPasswordPage } from "../pages/PasswordRecoveryPage";
import { DashboardPage } from "../pages/DashboardPage";
import { FilesPage } from "../pages/FilesPage";
import { FileDetailsPage } from "../pages/FileDetailsPage";
import { UploadPage } from "../pages/UploadPage";
import { AccountPage } from "../pages/AccountPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { StatusView } from "../components/ui/StatusView";

const SessionRecovery = () => {
  const { retryRestore, logout } = useAuth();
  return <div className="session-recovery"><StatusView kind="error" title="Unable to restore your session" description="We could not reach your workspace. Check your connection and try again." onRetry={() => void retryRestore()} action={<button type="button" className="text-button" onClick={logout}>Sign out</button>} /></div>;
};

const Protected = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div className="app-loading" role="status"><span className="spinner" /> Restoring your workspace...</div>;
  }

  if (status === "restore-error") return <SessionRecovery />;

  if (status === "anonymous") {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }

  return <Outlet />;
};

const PublicOnly = () => {
  const { status } = useAuth();
  if (status === "loading") return <div className="app-loading" role="status"><span className="spinner" /> Restoring your workspace...</div>;
  if (status === "restore-error") return <SessionRecovery />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
};

export const App = () => (
  <Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    </Route>
    <Route element={<Protected />}>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="files/:fileId" element={<FileDetailsPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
