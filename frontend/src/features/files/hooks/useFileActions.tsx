import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, ExternalLink, Link2, Trash2 } from "lucide-react";
import { FilePreview, FilePreviewUnavailable } from "../components/FilePreview";
import { Dialog } from "../../../components/ui/Dialog";
import { useToast } from "../../../components/ui/toast-context";
import { formatBytes, formatDateTime, formatDuration } from "../../../lib/format";
import { fileMessage } from "../../../lib/messages";
import { useFilesRepository } from "../api/files-context";
import type { FileRecord, ShareResult } from "../model/file.types";
import { canSaveDirectly, requireHttpsUrl, startFileDownload } from "../lib/file-links";
import { canPreviewInBrowser } from "../lib/file-preview";

const SHARE_DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 168, label: "7 days" },
] as const;
const DEFAULT_SHARE_HOURS = 24;

export const useFileActions = () => {
  const repository = useFilesRepository();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [fileAction, setFileAction] = useState<"download" | "view">("download");
  const [downloadTarget, setDownloadTarget] = useState<FileRecord | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadExpiresAt, setDownloadExpiresAt] = useState<number | null>(null);
  const downloadRequestId = useRef(0);
  const activeDownload = useRef(false);
  const [invokingControl, setInvokingControl] = useState<HTMLElement | null>(null);
  const activeDelete = useRef(false);
  const activeShare = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [shareTarget, setShareTarget] = useState<FileRecord | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareHours, setShareHours] = useState<number>(DEFAULT_SHARE_HOURS);
  const [copied, setCopied] = useState(false);
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const shareRequestId = useRef(0);

  useEffect(() => () => {
    downloadRequestId.current += 1;
    shareRequestId.current += 1;
  }, []);

  useEffect(() => {
    if (!downloadUrl || !downloadExpiresAt) return;
    const timer = window.setTimeout(() => {
      setDownloadUrl("");
      setDownloadError("This file link has expired. Try again for a new link.");
    }, Math.max(0, downloadExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [downloadUrl, downloadExpiresAt]);

  useEffect(() => {
    if (!shareResult || !shareExpiresAt) return;
    const timer = window.setTimeout(() => {
      setShareResult(null);
      setShareError("This link has expired. Create a new one.");
    }, Math.max(0, shareExpiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [shareResult, shareExpiresAt]);

  const openFile = async (file: FileRecord, action: "download" | "view", trigger?: HTMLElement) => {
    if (activeDownload.current || activeDelete.current) return;
    if (!downloadTarget) setInvokingControl(trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    activeDownload.current = true;
    const requestId = ++downloadRequestId.current;
    setFileAction(action);
    setDownloadTarget(file);
    setDownloadUrl("");
    setDownloadError("");
    setDownloadExpiresAt(null);
    if (action === "view" && !canPreviewInBrowser(file.mimeType)) {
      // Nothing to fetch: the dialog explains and offers Download instead.
      activeDownload.current = false;
      setDownloadLoading(false);
      return;
    }
    setDownloadLoading(true);
    setBusyFileId(file.id);
    try {
      const result = action === "view" ? await repository.getView(file.id) : await repository.getDownload(file.id);
      if (requestId !== downloadRequestId.current) return;
      const url = requireHttpsUrl("viewUrl" in result ? result.viewUrl : result.downloadUrl);
      if (action === "download" && !canSaveDirectly(url)) {
        setDownloadError("Direct download is not available for this file yet. You can use View to preview it.");
        return;
      }
      setDownloadUrl(url);
      setDownloadExpiresAt(Date.now() + result.expiresIn * 1000);
      if (action === "download") {
        startFileDownload(url, file.originalName);
        notify(`Download requested for ${file.originalName}. Check your browser’s downloads.`);
      }
    } catch (error) {
      if (requestId === downloadRequestId.current) setDownloadError(fileMessage(error, action === "view" ? "The preview could not be loaded. Please try again." : "The download link could not be created. Please try again."));
    } finally {
      if (requestId === downloadRequestId.current) {
        activeDownload.current = false;
        setDownloadLoading(false);
        setBusyFileId(null);
      }
    }
  };

  const download = (file: FileRecord, trigger?: HTMLElement) => openFile(file, "download", trigger);
  const view = (file: FileRecord, trigger?: HTMLElement) => openFile(file, "view", trigger);

  const closeDownload = () => {
    downloadRequestId.current += 1;
    activeDownload.current = false;
    setDownloadTarget(null);
    setDownloadUrl("");
    setDownloadLoading(false);
    setBusyFileId(null);
  };

  const share = (file: FileRecord, trigger?: HTMLElement) => {
    setInvokingControl(trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    shareRequestId.current += 1;
    activeShare.current = false;
    setShareTarget(file);
    setShareResult(null);
    setShareError("");
    setShareLoading(false);
    setShareHours(DEFAULT_SHARE_HOURS);
    setCopied(false);
    setShareExpiresAt(null);
  };

  const createShare = async () => {
    if (!shareTarget || activeShare.current) return;
    activeShare.current = true;
    const requestId = ++shareRequestId.current;
    setShareResult(null);
    setShareError("");
    setCopied(false);
    setShareExpiresAt(null);
    setShareLoading(true);
    try {
      const result = await repository.getTemporaryShare(shareTarget.id, shareHours);
      const shareUrl = requireHttpsUrl(result.shareUrl);
      if (requestId === shareRequestId.current) {
        const receivedAt = Date.now();
        const expiresAt = result.expiresAt ? Date.parse(result.expiresAt) : receivedAt + result.expiresIn * 1000;
        if (expiresAt <= receivedAt) {
          setShareError("This link has expired. Create a new one.");
          return;
        }
        setShareResult({ ...result, shareUrl, expiresIn: (expiresAt - receivedAt) / 1000 });
        setShareExpiresAt(expiresAt);
      }
    } catch (error) {
      if (requestId === shareRequestId.current) {
        setShareError(fileMessage(error, "The share link could not be created."));
      }
    } finally {
      if (requestId === shareRequestId.current) {
        activeShare.current = false;
        setShareLoading(false);
      }
    }
  };

  const requestDelete = (file: FileRecord, trigger?: HTMLElement) => {
    setInvokingControl(trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    setDeleteError("");
    setDeleteTarget(file);
  };

  const copyShare = async () => {
    if (!shareResult) return;
    if (shareExpiresAt && Date.now() >= shareExpiresAt) {
      setShareResult(null);
      setShareError("This link has expired. Create a new one.");
      return;
    }
    if (shareExpiresAt) setShareResult({ ...shareResult, expiresIn: (shareExpiresAt - Date.now()) / 1000 });
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      notify("Share link copied.");
    } catch {
      notify("Could not copy the link. Select and copy it manually.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || activeDelete.current) return;
    activeDelete.current = true;
    const file = deleteTarget;
    setDeleteError("");
    setBusyFileId(file.id);
    try {
      await repository.deleteFile(file.id);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      setDeleteTarget(null);
      notify(`${file.originalName} deleted.`);
      if (location.pathname === `/files/${encodeURIComponent(file.id)}`) navigate("/files");
    } catch (error) {
      const message = fileMessage(error, "The file could not be deleted.");
      setDeleteError(message);
    } finally {
      activeDelete.current = false;
      setBusyFileId(null);
    }
  };

  const dialogs = (
    <>
      <Dialog returnFocusTo={invokingControl} title={fileAction === "view" ? "View file" : "Download file"} open={!!downloadTarget} onClose={closeDownload}>
        <div className="dialog__body">
          <p className="dialog__intro"><strong>{downloadTarget?.originalName}</strong>{downloadTarget && <> <span aria-hidden="true">·</span> {formatBytes(downloadTarget.size)}</>}</p>
          {downloadLoading && <div className="inline-progress" role="status"><span className="spinner" aria-hidden="true" /> {fileAction === "view" ? "Preparing your preview..." : "Preparing your download..."}</div>}
          {downloadError && <div className="inline-alert" role="alert">{downloadError}</div>}
          {fileAction === "view" && downloadTarget && !canPreviewInBrowser(downloadTarget.mimeType) && <FilePreviewUnavailable />}
          {downloadUrl && downloadTarget && (fileAction === "view" ? (
            <div className="file-preview"><FilePreview file={downloadTarget} url={downloadUrl} onError={() => { setDownloadUrl(""); setDownloadError("The preview could not be loaded. Please try again."); }} /></div>
          ) : <p className="dialog__intro" role="status">Your download has been requested. Check your browser’s downloads. If it did not start, use Save file below.</p>)}
          <div className="dialog__actions">
            <button className="button button--secondary" type="button" onClick={closeDownload}>{downloadLoading ? "Cancel" : "Close"}</button>
            {downloadError && !downloadLoading && downloadTarget && <button className="button button--primary" type="button" onClick={() => void openFile(downloadTarget, fileAction)}>Try again</button>}
            {fileAction === "download" && downloadTarget && !downloadLoading && <button className="button button--secondary" type="button" onClick={() => void view(downloadTarget)}>View file</button>}
            {fileAction === "view" && downloadTarget && !downloadLoading && <button className="button button--primary" type="button" onClick={() => void download(downloadTarget)}><Download size={16} /> Download</button>}
            {downloadUrl && fileAction === "download" && <a className="button button--primary" href={downloadUrl} target="_self" rel="noopener noreferrer" referrerPolicy="no-referrer" download={downloadTarget?.originalName} onClick={(event) => {
              if (downloadExpiresAt && Date.now() >= downloadExpiresAt) {
                event.preventDefault(); setDownloadUrl(""); setDownloadError("This file link has expired. Try again for a new link.");
              }
            }}><Download size={16} /> Save file</a>}

          </div>
        </div>
      </Dialog>
      <Dialog returnFocusTo={invokingControl} title="Share file" open={!!shareTarget} onClose={() => { shareRequestId.current += 1; activeShare.current = false; setShareTarget(null); setShareResult(null); }} >
        <div className="dialog__body">
          <p className="dialog__intro">Create a temporary link for <strong>{shareTarget?.originalName}</strong>. Anyone with the link can download the file until it expires.</p>
          {!shareResult && (
            <fieldset className="choice-group" disabled={shareLoading}>
              <legend>Link expires after</legend>
              <div className="choice-group__options">
                {SHARE_DURATIONS.map(({ hours, label }) => (
                  <label key={hours} className="choice"><input type="radio" name="share-duration" value={hours} checked={shareHours === hours} onChange={() => setShareHours(hours)} /> {label}</label>
                ))}
              </div>
            </fieldset>
          )}
          {shareLoading && <div className="inline-progress" role="status"><span className="spinner" /> Creating secure link...</div>}
          {shareError && <div className="inline-alert" role="alert">{shareError}</div>}
          {!shareResult && !shareLoading && (
            <div className="dialog__actions">
              <button className="button button--primary" type="button" onClick={() => void createShare()}><Link2 size={16} /> {shareError ? "Create new link" : "Create link"}</button>
            </div>
          )}
          {shareResult && shareExpiresAt && (
            <>
              <label className="field"><span>Temporary link</span><input readOnly value={shareResult.shareUrl} onFocus={(event) => event.currentTarget.select()} /></label>
              <p className="dialog__hint"><Link2 size={16} /> Expires in {formatDuration(shareResult.expiresIn)}, on {formatDateTime(shareExpiresAt)}.</p>
              <div className="dialog__actions">
                <a className="button button--secondary" href={shareResult.shareUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open link</a>
                <button className="button button--primary" type="button" onClick={copyShare}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}</button>
              </div>
            </>
          )}
        </div>
      </Dialog>
      <Dialog returnFocusTo={invokingControl} title="Delete file?" open={!!deleteTarget} closeDisabled={!!busyFileId} onClose={() => { if (!busyFileId) setDeleteTarget(null); }}>
        <div className="dialog__body">
          <p className="dialog__intro">Delete <strong>{deleteTarget?.originalName}</strong>? This removes the stored file and cannot be undone.</p>
          {deleteError && <div className="inline-alert" role="alert">{deleteError}</div>}
          <div className="dialog__actions">
            <button className="button button--secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={!!busyFileId}>Cancel</button>
            <button className="button button--danger" type="button" onClick={confirmDelete} disabled={!!busyFileId}><Trash2 size={16} /> {busyFileId ? "Deleting..." : "Delete file"}</button>
          </div>
        </div>
      </Dialog>
    </>
  );

  return { download, view, share, requestDelete, busyFileId, dialogs };
};
