import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Cloud, Files, House, LogOut, Menu, UploadCloud, X } from "lucide-react";
import { useAuth } from "../../features/auth/auth-context";
import { useUploadQueue } from "../../features/upload/upload-queue-context";
import { USE_MOCK_API } from "../../lib/runtime";
import { ErrorBoundary } from "../ui/ErrorBoundary";

const navItems = [
  { to: "/", label: "Overview", icon: House, end: true },
  { to: "/files", label: "My files", icon: Files, end: false },
  { to: "/upload", label: "Upload", icon: UploadCloud, end: false },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const { queue, uploading } = useUploadQueue();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const currentTitle = location.pathname.startsWith("/files")
    ? "My files"
    : location.pathname.startsWith("/upload")
      ? "Upload"
      : "Overview";
  const uploadsLeft = queue.filter((item) => item.status === "ready" || item.status === "uploading").length;
  const showUploadStatus = uploading && !location.pathname.startsWith("/upload");

  const closeNavigation = () => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => menuRef.current?.focus());
  };

  const navigateToContent = () => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  };

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        window.requestAnimationFrame(() => menuRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const closeOnWideScreen = () => {
      if (!mobile.matches) setMobileOpen(false);
    };
    mobile.addEventListener("change", closeOnWideScreen);
    return () => mobile.removeEventListener("change", closeOnWideScreen);
  }, []);

  const signOut = () => {
    logout();
    setMobileOpen(false);
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">Skip to main content</a>
      <aside id="primary-navigation" ref={sidebarRef} className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar__brand">
          <Link to="/" onClick={navigateToContent} className="brand">
            <span className="brand__mark"><Cloud size={22} strokeWidth={2.4} /></span>
            <span>CloudDrop</span>
          </Link>
          <button ref={closeRef} className="icon-button sidebar__close" type="button" onClick={closeNavigation} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <p className="sidebar__group">Workspace</p>
        <nav className="sidebar__nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={navigateToContent}
              className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__account">
            <div className="avatar" aria-hidden="true">{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</div>
            <div className="sidebar__account-text"><strong>{user?.firstName} {user?.lastName}</strong><span>{user?.email}</span></div>
          </div>
          <button className="sidebar__link sidebar__signout" type="button" onClick={signOut}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" type="button" onClick={closeNavigation} />}
      <div className="app-main" inert={mobileOpen}>
        <header className="topbar">
          <div className="topbar__left">
            <button ref={menuRef} className="icon-button topbar__menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={mobileOpen}><Menu size={21} /></button>
            <span className="topbar__crumb">Workspace</span>
            <span className="topbar__slash">/</span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar__right">
            {USE_MOCK_API && <span className="demo-badge">Demo data</span>}
            {showUploadStatus && <Link className="upload-status" to="/upload" aria-label={`Uploading ${uploadsLeft} ${uploadsLeft === 1 ? "file" : "files"}. View upload queue`}><span className="spinner" aria-hidden="true" /><span className="upload-status__text">Uploading {uploadsLeft} {uploadsLeft === 1 ? "file" : "files"}</span></Link>}
            <Link className="button button--primary button--small" to="/upload"><UploadCloud size={16} /> Upload files</Link>
          </div>
        </header>
        <main id="workspace-main" ref={mainRef} className="main-content" tabIndex={-1} aria-label={currentTitle}><ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary></main>
      </div>
    </div>
  );
};
