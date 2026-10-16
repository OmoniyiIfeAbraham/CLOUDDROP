
import type { FileRecord } from "../model/file.types";
import { canPreviewInBrowser, getFilePreviewKind } from "../lib/file-preview";
import { TextPreview } from "./TextPreview";

export const FilePreview = ({
  file,
  url,
  onError,
}: {
  file: FileRecord;
  url: string;
  onError: () => void;
}) => {
  const type = file.mimeType.toLowerCase();
  const kind = getFilePreviewKind(type);

  if (!canPreviewInBrowser(type)) {
    return <FilePreviewUnavailable />;
  }

  if (kind === "image") {
    return (
      <img
        className="file-preview__image"
        src={url}
        alt={file.originalName}
        referrerPolicy="no-referrer"
        onError={onError}
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        className="file-preview__video"
        src={url}
        controls
        playsInline
        preload="metadata"
        onError={onError}
        aria-label={`Preview of ${file.originalName}`}
      />
    );
  }

  if (kind === "audio") {
    return (
      <audio
        className="file-preview__audio"
        src={url}
        controls
        preload="metadata"
        onError={onError}
        aria-label={`Preview of ${file.originalName}`}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        className="file-preview__document"
        src={url}
        title={`Preview of ${file.originalName}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (kind === "text") {
    return <TextPreview key={url} url={url} filename={file.originalName} onError={onError} />;
  }

  return <FilePreviewUnavailable />;
};

export const FilePreviewUnavailable = () => (
  <p className="dialog__intro">
    A browser preview is not available for this file type. Download the file
    to open it on your device.
  </p>
);
