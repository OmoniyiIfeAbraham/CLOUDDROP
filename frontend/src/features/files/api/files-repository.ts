import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileListQuery,
  FilePage,
  FileRecord,
  ShareResult,
} from "../model/file.types";

export interface FilesRepository {
  listFiles(query?: FileListQuery): Promise<FilePage>;
  getFile(fileId: string): Promise<FileRecord>;
  getDownload(fileId: string): Promise<DownloadResult>;
  getTemporaryShare(fileId: string, ttlHours?: number): Promise<ShareResult>;
  deleteFile(fileId: string): Promise<void>;
  uploadFile(file: File, category: Category, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<FileRecord>;
  getCategories(): Promise<Category[]>;
  getDashboardStats(): Promise<DashboardStats>;
}

// Matches the backend's default page size for GET /files.
export const DEFAULT_PAGE_SIZE = 10;
