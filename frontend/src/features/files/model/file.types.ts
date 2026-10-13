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

export type FileDisposition = "attachment" | "inline";

export interface DownloadResult {
  file: Pick<FileRecord, "id" | "mimeType" | "originalName" | "size">;
  downloadUrl: string;
  expiresIn: number;
}

export interface ShareResult {
  file: Pick<FileRecord, "id" | "mimeType" | "originalName">;
  shareUrl: string;
  expiresIn: number;
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
