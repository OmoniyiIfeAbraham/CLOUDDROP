import { PREVIEWABLE_MIME_TYPES } from "../model/file.types";

// The backend signs a view link only for these types, and a PDF also needs the
// browser's own viewer (headless and some mobile browsers have none).
export const canPreviewInBrowser = (mimeType: string): boolean => {
  const type = mimeType.toLowerCase();
  if (!PREVIEWABLE_MIME_TYPES.has(type)) return false;
  return type !== "application/pdf" || navigator.pdfViewerEnabled === true;
};
