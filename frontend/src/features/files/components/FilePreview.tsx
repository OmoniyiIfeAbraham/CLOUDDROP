import type { FileRecord } from "../model/file.types";
import { canPreviewInBrowser } from "../lib/file-preview";

export const FilePreview = ({ file, url, onError }: {
  file: FileRecord; url: string; onError: () => void;
}) => {
  const type = file.mimeType.toLowerCase();
  if (!canPreviewInBrowser(type)) return <FilePreviewUnavailable />;
  if (type === "application/pdf") {
    // No sandbox: Chrome refuses to run its PDF viewer in a sandboxed frame.
    // The signed link is on the storage origin, so the document cannot reach this page.
    return <iframe className="file-preview__document" src={url} title={`Preview of ${file.originalName}`} referrerPolicy="no-referrer" />;
  }
  return <img className="file-preview__image" src={url} alt={file.originalName} referrerPolicy="no-referrer" onError={onError} />;
};

export const FilePreviewUnavailable = () => (
  <p className="dialog__intro">A browser preview is not available for this file type. Download the file to open it on your device.</p>
);
