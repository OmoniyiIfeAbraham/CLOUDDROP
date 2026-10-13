import type { FileRecord } from "../model/file.types";

export const FilePreview = ({ file, url, onError }: {
  file: FileRecord; url: string; onError: () => void;
}) => {
  const type = file.mimeType.toLowerCase();
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type)) {
    return <img className="file-preview__image" src={url} alt={file.originalName} referrerPolicy="no-referrer" onError={onError} />;
  }
  if (type.startsWith("video/")) return <video className="file-preview__video" src={url} controls playsInline preload="metadata" onError={onError} aria-label={`Preview of ${file.originalName}`} />;
  if (type.startsWith("audio/")) return <audio className="file-preview__audio" src={url} controls preload="metadata" onError={onError} aria-label={`Preview of ${file.originalName}`} />;
  if (["application/pdf", "text/plain", "text/csv"].includes(type)) {
    return <iframe className="file-preview__document" src={url} title={`Preview of ${file.originalName}`} sandbox="allow-same-origin" referrerPolicy="no-referrer" />;
  }
  return <p className="dialog__intro">A browser preview is not available for this file type. Download the file to open it on your device.</p>;
};
