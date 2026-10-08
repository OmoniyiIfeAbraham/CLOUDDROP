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

export const DashboardPage = () => {
  const repository = useFilesRepository();
  const { user } = useAuth();
  const { data: files, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["files", "all"],
    queryFn: () => repository.listFiles(),
  });
  const actions = useFileActions();
  const recent = [...(files ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const totalBytes = (files ?? []).reduce((sum, file) => sum + file.size, 0);
  const categoriesUsed = FILE_CATEGORIES.filter((category) => files?.some((file) => file.category === category)).length;

  return (
    <div className="page-content">
      <div className="page-heading page-heading--hero">
        <div><span className="eyebrow">YOUR WORKSPACE</span><h1>Good to see you, {user?.firstName}.</h1><p>Everything in your cloud, at a glance.</p></div>
      </div>
      <section aria-labelledby="overview-heading">
        <div className="section-heading"><h2 id="overview-heading">Storage overview</h2><button className="icon-button" title="Refresh overview" aria-label="Refresh overview" type="button" onClick={() => refetch()} disabled={isFetching}><RefreshCw size={17} /></button></div>
        {isError ? <StatusView kind="error" title="Overview unavailable" description={userMessage(error)} onRetry={() => refetch()} /> : (
          <div className="stats-grid" aria-busy={isPending}>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--teal"><Files size={21} /></span><span className="stat-card__label">Total files</span><strong>{isPending ? "..." : files?.length ?? 0}</strong><span className="stat-card__foot">In your workspace</span></div>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--violet"><Database size={21} /></span><span className="stat-card__label">Storage used</span><strong>{isPending ? "..." : formatBytes(totalBytes)}</strong><span className="stat-card__foot">Across all files</span></div>
            <div className="stat-card"><span className="stat-card__icon stat-card__icon--coral"><FileStack size={21} /></span><span className="stat-card__label">Categories used</span><strong>{isPending ? "..." : categoriesUsed}</strong><span className="stat-card__foot">Of {FILE_CATEGORIES.length} available</span></div>
          </div>
        )}
      </section>
      <section className="recent-section" aria-labelledby="recent-heading">
        <div className="section-heading"><div><h2 id="recent-heading">Recent files</h2><p>Your latest uploads and documents</p></div><Link className="text-link" to="/files">View all files <ArrowRight size={16} /></Link></div>
        {isPending ? <LoadingRows count={5} /> : isError ? null : recent.length === 0 ? (
          <StatusView kind="empty" title="No files yet" description="Upload your first file to start building your workspace." action={<Link className="button button--primary" to="/upload"><UploadCloud size={17} /> Upload a file</Link>} />
        ) : <FileTable files={recent} compact onDownload={actions.download} onShare={actions.share} onDelete={actions.requestDelete} busyFileId={actions.busyFileId} />}
      </section>
      {actions.dialogs}
    </div>
  );
};
