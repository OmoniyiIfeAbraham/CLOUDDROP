import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileUp, Plus, UploadCloud, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFilesRepository } from "../features/files/api/files-context";
import { isApiError } from "../features/files/api/api-error";
import { FILE_CATEGORIES } from "../features/files/model/file.types";
import type { Category } from "../features/files/model/file.types";
import { validateUploadFile } from "../features/upload/upload-service";
import { formatBytes } from "../lib/format";
import { userMessage } from "../lib/messages";
import { useToast } from "../components/ui/toast-context";

interface QueueItem {
  id: string;
  file: File;
  status: "ready" | "uploading" | "complete" | "error";
  progress: number;
  error?: string | undefined;
  retryable?: boolean;
}

export const UploadPage = () => {
  const repository = useFilesRepository();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const { notify } = useToast();

  const addFiles = (selected: FileList | File[]) => {
    const items = Array.from(selected).map((file): QueueItem => {
      const error = validateUploadFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        status: error ? "error" : "ready",
        progress: 0,
        ...(error ? { error, retryable: false } : {}),
      };
    });
    setQueue((current) => [...current, ...items]);
    if (items.some((item) => item.status === "ready")) setFormError("");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!uploading && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const updateItem = (id: string, change: Partial<QueueItem>) => {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
  };

  const uploadAll = async () => {
    if (!category) {
      setFormError("Choose a category before uploading.");
      return;
    }
    const pending = queue.filter((item) => item.status === "ready");
    if (!pending.length) return;
    setFormError("");
    setUploading(true);
    let completed = 0;
    for (const item of pending) {
      updateItem(item.id, { status: "uploading", progress: 0 });
      try {
        await repository.uploadFile(item.file, category, (progress) => updateItem(item.id, { progress }));
        updateItem(item.id, { status: "complete", progress: 100 });
        completed += 1;
      } catch (error) {
        updateItem(item.id, { status: "error", error: userMessage(error, "Upload failed. Please try again."), retryable: !isApiError(error) || error.retryable });
      }
    }
    if (completed) {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      notify(`${completed} ${completed === 1 ? "file" : "files"} uploaded.`);
    }
    setUploading(false);
  };

  const readyCount = queue.filter((item) => item.status === "ready").length;
  const completeCount = queue.filter((item) => item.status === "complete").length;

  return (
    <div className="page-content upload-page">
      <div className="page-heading"><div><span className="eyebrow">ADD TO CLOUDDROP</span><h1>Upload files</h1><p>Add files to your secure workspace and keep them organized.</p></div></div>
      <div className="upload-layout">
        <div className="upload-main">
          <div className={`drop-zone ${dragging ? "drop-zone--active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={onDrop}>
            <span className="drop-zone__icon"><FileUp size={29} /></span>
            <h2>Drop files here</h2>
            <p>or choose files from your device</p>
            <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()} disabled={uploading}><Plus size={17} /> Browse files</button>
            <input ref={inputRef} className="sr-only" type="file" multiple tabIndex={-1} aria-label="Choose files to upload" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
            <small>PDF, Office files, images, video, audio and archives up to 2 GB each</small>
          </div>
          {queue.length > 0 && (
            <section className="upload-queue" aria-labelledby="queue-heading">
              <div className="section-heading"><h2 id="queue-heading">Upload queue <span className="count-pill">{queue.length}</span></h2>{!uploading && <button className="text-button" type="button" onClick={() => setQueue((current) => current.filter((item) => item.status === "uploading"))}>Clear queue</button>}</div>
              <ul>
                {queue.map((item) => <li key={item.id} className="upload-item">
                  <span className="upload-item__icon">{item.status === "complete" ? <CheckCircle2 size={20} /> : <FileUp size={20} />}</span>
                  <div className="upload-item__body"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)} <span aria-hidden="true">·</span> {item.status === "ready" ? "Ready" : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "complete" ? "Uploaded" : item.error}</span>{item.status === "uploading" && <progress max="100" value={item.progress} aria-label={`Upload progress for ${item.file.name}`} />}</div>
                  {!uploading && item.status === "error" && item.retryable && <button type="button" className="text-button" onClick={() => updateItem(item.id, { status: "ready", progress: 0, error: undefined, retryable: false })}>Retry</button>}
                  {!uploading && <button type="button" className="icon-button" title="Remove from queue" aria-label={`Remove ${item.file.name} from queue`} onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))}><X size={17} /></button>}
                </li>)}
              </ul>
            </section>
          )}
        </div>
        <aside className="upload-settings" aria-label="Upload settings">
          <h2>Upload settings</h2>
          <p>Choose where these files belong.</p>
          <label className="field"><span>Category <span aria-hidden="true">*</span></span><select value={category} disabled={uploading} onChange={(event) => { setCategory(event.target.value as Category | ""); setFormError(""); }}><option value="">Select a category</option>{FILE_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <p className="upload-settings__hint">The selected category applies to all files in this queue.</p>
          {formError && <div className="inline-alert" role="alert">{formError}</div>}
          <button type="button" className="button button--primary upload-settings__submit" onClick={uploadAll} disabled={uploading || !readyCount}><UploadCloud size={18} /> {uploading ? "Uploading..." : `Upload ${readyCount} ${readyCount === 1 ? "file" : "files"}`}</button>
          {completeCount > 0 && <Link className="text-link" to="/files">View uploaded files</Link>}
        </aside>
      </div>
    </div>
  );
};
