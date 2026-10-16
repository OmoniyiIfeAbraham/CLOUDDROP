import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthPage } from "../pages/AuthPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { StatusView } from "../components/ui/StatusView";

const DashboardPage = lazy(() => import("../pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const FilesPage = lazy(() => import("../pages/FilesPage").then(module => ({ default: module.FilesPage })));
const FileDetailsPage = lazy(() => import("../pages/FileDetailsPage").then(module => ({ default: module.FileDetailsPage })));
const UploadPage = lazy(() => import("../pages/UploadPage").then(module => ({ default: module.UploadPage })));
const AccountPage = lazy(() => import("../pages/AccountPage").then(module => ({ default: module.AccountPage })));
const ForgotPasswordPage = lazy(() => import("../pages/PasswordRecoveryPage").then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("../pages/PasswordRecoveryPage").then(module => ({ default: module.ResetPasswordPage })));

// Keep the workspace navigation mounted while the requested page loads.
const Page = ({ children, standalone = false }: { children: ReactNode; standalone?: boolean }) => {
  const loading = <div className="app-loading" role="status"><span className="spinner" aria-hidden="true" /><h1 className="app-loading__title">Loading your page...</h1></div>;
  return <Suspense fallback={standalone ? <main>{loading}</main> : loading}>{children}</Suspense>;
};

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
    <Route path="/forgot-password" element={<Page standalone><ForgotPasswordPage /></Page>} />
    <Route path="/reset-password" element={<Page standalone><ResetPasswordPage /></Page>} />
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    </Route>
    <Route element={<Protected />}>
      <Route element={<AppLayout />}>
        <Route index element={<Page><DashboardPage /></Page>} />
        <Route path="files" element={<Page><FilesPage /></Page>} />
        <Route path="files/:fileId" element={<Page><FileDetailsPage /></Page>} />
        <Route path="upload" element={<Page><UploadPage /></Page>} />
        <Route path="account" element={<Page><AccountPage /></Page>} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
