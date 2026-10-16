import { PREVIEWABLE_MIME_TYPES } from "../model/file.types";

export type FilePreviewKind = "image" | "video" | "audio" | "pdf" | "text";

export const getFilePreviewKind = (mimeType: string): FilePreviewKind | null => {
  const type = mimeType.toLowerCase();
  if (!PREVIEWABLE_MIME_TYPES.has(type)) return null;
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "text";
};

// The backend signs a view link only for these types, and a PDF also needs the
// browser's own viewer (headless and some mobile browsers have none).
export const canPreviewInBrowser = (mimeType: string): boolean => {
  const type = mimeType.toLowerCase();
  if (!getFilePreviewKind(type)) return false;
  return type !== "application/pdf" || navigator.pdfViewerEnabled === true;
};
