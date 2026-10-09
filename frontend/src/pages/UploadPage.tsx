import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, CircleStop, FileUp, Plus, UploadCloud, X } from "lucide-react";
import { FILE_CATEGORIES } from "../features/files/model/file.types";
import type { Category } from "../features/files/model/file.types";
import { useUploadQueue } from "../features/upload/upload-queue-context";
import type { QueueItem } from "../features/upload/upload-queue-context";
import { formatBytes } from "../lib/format";

const statusText = (item: QueueItem): string => {
  if (item.status === "ready") return "Ready";
  if (item.status === "uploading") return `Uploading ${item.progress}%`;
  if (item.status === "complete") return `Uploaded to ${item.category}`;
  return item.error ?? "Upload failed.";
};

const canChooseCategory = (item: QueueItem): boolean =>
  item.status === "ready" || item.status === "uploading" || (item.status === "error" && !!item.retryable);

export const UploadPage = () => {
  const { queue, uploading, addFiles, setCategory, retry, remove, clear, uploadAll, cancel } = useUploadQueue();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!uploading && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
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
            <small>PDF, Office files, images, video, audio and archives up to 25&nbsp;MB each</small>
          </div>
          {queue.length > 0 && (
            <section className="upload-queue" aria-labelledby="queue-heading">
              <div className="section-heading"><h2 id="queue-heading">Upload queue <span className="count-pill">{queue.length}</span></h2>{!uploading && <button className="text-button" type="button" onClick={clear}>Clear queue</button>}</div>
              <ul>
                {queue.map((item) => (
                  <li key={item.id} className={`upload-item ${item.status === "error" ? "upload-item--error" : ""}`}>
                    <span className="upload-item__icon">{item.status === "complete" ? <CheckCircle2 size={20} /> : item.status === "error" ? <CircleAlert size={20} /> : <FileUp size={20} />}</span>
                    <div className="upload-item__body">
                      <strong title={item.file.name}>{item.file.name}</strong>
                      <span>{formatBytes(item.file.size)} <span aria-hidden="true">·</span> <span className="upload-item__status">{statusText(item)}</span></span>
                      {item.status === "uploading" && <progress max="100" value={item.progress} aria-label={`Upload progress for ${item.file.name}`} />}
                    </div>
                    {canChooseCategory(item) && (
                      <select className="upload-item__category" aria-label={`Category for ${item.file.name}`} value={item.category} disabled={uploading} onChange={(event) => setCategory(item.id, event.target.value as Category)}>
                        {FILE_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    )}
                    {!uploading && item.status === "error" && item.retryable && <button type="button" className="text-button" onClick={() => retry(item.id)}>Retry</button>}
                    {!uploading && <button type="button" className="icon-button" title="Remove from queue" aria-label={`Remove ${item.file.name} from queue`} onClick={() => remove(item.id)}><X size={17} /></button>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="upload-settings" aria-label="Upload summary">
          <h2>Upload summary</h2>
          <p>Each file gets a category from its type. Change any of them in the queue before uploading.</p>
          <button type="button" className="button button--primary upload-settings__submit" onClick={() => void uploadAll()} disabled={uploading || !readyCount}><UploadCloud size={18} /> {uploading ? "Uploading..." : `Upload ${readyCount} ${readyCount === 1 ? "file" : "files"}`}</button>
          {uploading && <button type="button" className="button button--secondary upload-settings__cancel" onClick={cancel}><CircleStop size={17} /> Cancel upload</button>}
          {uploading && <p className="upload-settings__hint">Uploads continue if you open another page. Closing this tab stops them.</p>}
          {completeCount > 0 && <Link className="text-link" to="/files">View uploaded files</Link>}
        </aside>
      </div>
    </div>
  );
};
