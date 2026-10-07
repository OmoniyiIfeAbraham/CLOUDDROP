import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link2, Trash2 } from "lucide-react";
import { Dialog } from "../../../components/ui/Dialog";
import { useToast } from "../../../components/ui/toast-context";
import { userMessage } from "../../../lib/messages";
import { useFilesRepository } from "../api/files-context";
import type { FileRecord, ShareResult } from "../model/file.types";

const requireHttpsUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Invalid file link");
  return url.toString();
};

export const useFileActions = () => {
  const repository = useFilesRepository();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const [shareTarget, setShareTarget] = useState<FileRecord | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const shareRequestId = useRef(0);

  useEffect(() => {
    if (!shareResult || !shareExpiresAt) return;
    const timer = window.setTimeout(() => {
      setShareResult(null);
      setShareError("This link has expired. Create a new one.");
    }, Math.max(0, shareExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [shareResult, shareExpiresAt]);

  const download = async (file: FileRecord) => {
    setBusyFileId(file.id);
    try {
      const result = await repository.getDownload(file.id);
      const link = document.createElement("a");
      link.href = requireHttpsUrl(result.downloadUrl);
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      document.body.append(link);
      link.click();
      link.remove();
      notify(`Download started for ${file.originalName}.`);
    } catch (error) {
      notify(userMessage(error, "The download link could not be opened."), "error");
    } finally {
      setBusyFileId(null);
    }
  };

  const share = async (file: FileRecord) => {
    const requestId = ++shareRequestId.current;
    setShareTarget(file);
    setShareResult(null);
    setShareError("");
    setCopied(false);
    setShareExpiresAt(null);
    setShareLoading(true);
    try {
      const result = await repository.getTemporaryShare(file.id);
      requireHttpsUrl(result.shareUrl);
      if (requestId === shareRequestId.current) {
        setShareResult(result);
        setShareExpiresAt(Date.now() + result.expiresIn * 1000);
      }
    } catch (error) {
      if (requestId === shareRequestId.current) {
        setShareError(userMessage(error, "The share link could not be created."));
      }
    } finally {
      if (requestId === shareRequestId.current) setShareLoading(false);
    }
  };

  const copyShare = async () => {
    if (!shareResult) return;
    if (shareExpiresAt && Date.now() >= shareExpiresAt) {
      setShareResult(null);
      setShareError("This link has expired. Create a new one.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      notify("Share link copied.");
    } catch {
      notify("Could not copy the link. Select and copy it manually.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const file = deleteTarget;
    setBusyFileId(file.id);
    try {
      await repository.deleteFile(file.id);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      setDeleteTarget(null);
      notify(`${file.originalName} deleted.`);
      if (window.location.pathname === `/files/${encodeURIComponent(file.id)}`) navigate("/files");
    } catch (error) {
      notify(userMessage(error, "The file could not be deleted."), "error");
    } finally {
      setBusyFileId(null);
    }
  };

  const dialogs = (
    <>
      <Dialog title="Share file" open={!!shareTarget} onClose={() => { shareRequestId.current += 1; setShareTarget(null); setShareResult(null); }} >
        <div className="dialog__body">
          <p className="dialog__intro">Create a temporary link for <strong>{shareTarget?.originalName}</strong>.</p>
          {shareLoading && <div className="inline-progress" role="status"><span className="spinner" /> Creating secure link...</div>}
          {shareError && <div className="inline-alert" role="alert">{shareError}</div>}
          {shareResult && (
            <>
              <label className="field"><span>Temporary link</span><input readOnly value={shareResult.shareUrl} onFocus={(event) => event.currentTarget.select()} /></label>
              <p className="dialog__hint"><Link2 size={16} /> Expires in {Math.ceil(shareResult.expiresIn / 3600)} hours. Anyone with the link can download the file until then.</p>
              <div className="dialog__actions">
                <a className="button button--secondary" href={shareResult.shareUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open link</a>
                <button className="button button--primary" type="button" onClick={copyShare}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}</button>
              </div>
            </>
          )}
        </div>
      </Dialog>
      <Dialog title="Delete file?" open={!!deleteTarget} onClose={() => { if (!busyFileId) setDeleteTarget(null); }}>
        <div className="dialog__body">
          <p className="dialog__intro">Delete <strong>{deleteTarget?.originalName}</strong>? This removes the stored file and cannot be undone.</p>
          <div className="dialog__actions">
            <button className="button button--secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={!!busyFileId}>Cancel</button>
            <button className="button button--danger" type="button" onClick={confirmDelete} disabled={!!busyFileId}><Trash2 size={16} /> {busyFileId ? "Deleting..." : "Delete file"}</button>
          </div>
        </div>
      </Dialog>
    </>
  );

  return { download, share, requestDelete: setDeleteTarget, busyFileId, dialogs };
};
