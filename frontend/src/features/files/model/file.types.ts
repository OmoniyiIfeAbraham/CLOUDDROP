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

export interface DashboardStats {
  totalFiles: number;
  totalStorageBytes: number;
  filesByCategory: Record<Category, number>;
}
