import { Link } from "react-router-dom";
import { ArrowRight, Database, FileStack, Files, RefreshCw, UploadCloud } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FileTable } from "../features/files/components/FileTable";
import { useFilesRepository } from "../features/files/api/files-context";
import { useFileActions } from "../features/files/hooks/useFileActions";
import { FILE_CATEGORIES } from "../features/files/model/file.types";
import { LoadingRows, StatusView } from "../components/ui/StatusView";
import { useAuth } from "../features/auth/auth-context";
import { formatBytes } from "../lib/format";
import { userMessage } from "../lib/messages";

const RECENT_FILE_COUNT = 5;

export const DashboardPage = () => {
  const repository = useFilesRepository();
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["files", "stats"],
    queryFn: () => repository.getDashboardStats(),
  });
  const recent = useQuery({
    queryKey: ["files", "recent"],
    queryFn: () => repository.listFiles({ page: 1, limit: RECENT_FILE_COUNT }),
  });
  const actions = useFileActions();
  const counts = stats.data?.filesByCategory;
  const categoriesUsed = counts ? FILE_CATEGORIES.filter((category) => counts[category] > 0).length : 0;
  const recentFiles = recent.data?.files ?? [];
  const refresh = () => {
    void stats.refetch();
    void recent.refetch();
  };

  return (
    <div className="page-content">
      <div className="page-heading page-heading--hero">
        <div><span className="eyebrow">YOUR WORKSPACE</span><h1>Good to see you, {user?.firstName}.</h1><p>Everything in your cloud, at a glance.</p></div>
      </div>
      <section aria-labelledby="overview-heading">
        <div className="section-heading"><h2 id="overview-heading">Storage overview</h2><button className="icon-button" title="Refresh overview" aria-label="Refresh overview" type="button" onClick={refresh} disabled={stats.isFetching || recent.isFetching}><RefreshCw size={17} /></button></div>
        {stats.isError ? <StatusView kind="error" title="Overview unavailable" description={userMessage(stats.error)} onRetry={() => stats.refetch()} /> : (
          <div className="stats-grid" aria-busy={stats.isPending}>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--teal"><Files size={21} /></span><span className="stat-card__label">Total files</span><strong>{stats.isPending ? "..." : stats.data?.totalFiles ?? 0}</strong><span className="stat-card__foot">In your workspace</span></div>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--violet"><Database size={21} /></span><span className="stat-card__label">Storage used</span><strong>{stats.isPending ? "..." : formatBytes(stats.data?.totalStorageBytes ?? 0)}</strong><span className="stat-card__foot">Across all files</span></div>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--coral"><FileStack size={21} /></span><span className="stat-card__label">Categories used</span><strong>{stats.isPending ? "..." : categoriesUsed}</strong><span className="stat-card__foot">Of {FILE_CATEGORIES.length} available</span></div>
          </div>
        )}
      </section>
      <section className="recent-section" aria-labelledby="recent-heading">
        <div className="section-heading"><div><h2 id="recent-heading">Recent files</h2><p>Your latest uploads and documents</p></div><Link className="text-link" to="/files">View all files <ArrowRight size={16} /></Link></div>
        {recent.isPending ? <LoadingRows count={RECENT_FILE_COUNT} /> : recent.isError ? (
          <StatusView kind="error" title="Recent files unavailable" description={userMessage(recent.error)} onRetry={() => recent.refetch()} />
        ) : recentFiles.length === 0 ? (
          <StatusView kind="empty" title="No files yet" description="Upload your first file to start building your workspace." action={<Link className="button button--primary" to="/upload"><UploadCloud size={17} /> Upload a file</Link>} />
        ) : <FileTable files={recentFiles} compact onView={actions.view} onDownload={actions.download} onShare={actions.share} onDelete={actions.requestDelete} busyFileId={actions.busyFileId} />}
      </section>
      {actions.dialogs}
    </div>
  );
};
