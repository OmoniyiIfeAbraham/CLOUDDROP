export const FILE_CATEGORIES = [
  "Documents",
  "Images",
  "Videos",
  "Audio",
  "Archives",
  "Other",
] as const;

export type Category = (typeof FILE_CATEGORIES)[number];

export interface FileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: Category;
  createdAt: string;
  updatedAt: string;
}

// Mirrors INLINE_PREVIEW_MIME_TYPES in backend/src/controllers/files.controller.ts:
// GET /files/:id/view answers 415 PREVIEW_NOT_SUPPORTED for any other type.
export const PREVIEWABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/x-yaml",
  "application/yaml",
  "application/sql",
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

export interface DownloadResult {
  file: Pick<FileRecord, "id" | "mimeType" | "originalName" | "size">;
  downloadUrl: string;
  expiresIn: number;
}

export interface ViewResult {
  file: Pick<FileRecord, "id" | "mimeType" | "originalName" | "size">;
  viewUrl: string;
  expiresIn: number;
}

export interface ShareResult {
  shareUrl: string;
  expiresIn: number;
  expiresAt: string;
}

export interface FileListQuery {
  search?: string | undefined;
  category?: Category | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface FilePage {
  files: FileRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  totalFiles: number;
  totalStorageBytes: number;
  sharedFiles: number;
  filesByCategory: Record<Category, number>;
}
