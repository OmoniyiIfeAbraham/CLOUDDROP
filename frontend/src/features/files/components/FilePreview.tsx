import type { FileRecord } from "../model/file.types";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const TEXT_TYPES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/xml",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/sql",
];

const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "json", "md", "markdown", "xml", "yaml", "yml",
  "html", "htm", "css", "js", "jsx", "ts", "tsx", "sql", "sh",
  "py", "java", "c", "cpp", "h", "go", "rs", "php", "rb",
  "env", "log", "toml", "ini", "conf", "config", "graphql",
]);

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
  const extension = file.originalName.split(".").pop()?.toLowerCase() ?? "";

  if (IMAGE_TYPES.includes(type)) {
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

  if (type.startsWith("video/")) {
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

  if (type.startsWith("audio/")) {
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

  if (type === "application/pdf") {
    return (
      <iframe
        className="file-preview__document"
        src={url}
        title={`Preview of ${file.originalName}`}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (TEXT_TYPES.includes(type) || TEXT_EXTENSIONS.has(extension)) {
    return (
      <iframe
        className="file-preview__document"
        src={url}
        title={`Preview of ${file.originalName}`}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        onError={onError}
      />
    );
  }

  return (
    <p className="dialog__intro">
      A browser preview is not available for this file type. Download the file
      to open it on your device.
    </p>
  );
};
