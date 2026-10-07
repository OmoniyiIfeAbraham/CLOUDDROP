import { AlertCircle, FolderOpen, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

interface StatusViewProps {
  kind: "empty" | "error";
  title: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
}

export const StatusView = ({ kind, title, description, action, onRetry }: StatusViewProps) => (
  <div className="status-view" role={kind === "error" ? "alert" : "status"}>
    <span className={`status-view__icon status-view__icon--${kind}`}>
      {kind === "error" ? <AlertCircle size={25} /> : <FolderOpen size={25} />}
    </span>
    <h2>{title}</h2>
    <p>{description}</p>
    {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}><RotateCw size={16} /> Try again</button>}
    {action}
  </div>
);

export const LoadingRows = ({ count = 5 }: { count?: number }) => (
  <div className="loading-rows" role="status" aria-label="Loading files">
    {Array.from({ length: count }, (_, index) => (
      <div className="loading-row" key={index}>
        <span className="skeleton loading-row__icon" />
        <span className="skeleton loading-row__name" />
        <span className="skeleton loading-row__meta" />
      </div>
    ))}
  </div>
);
