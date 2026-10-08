import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileRecord,
  ShareResult,
} from "../model/file.types";

export interface FilesRepository {
  listFiles(): Promise<FileRecord[]>;
  searchFiles(search: string): Promise<FileRecord[]>;
  getFile(fileId: string): Promise<FileRecord>;
  getDownload(fileId: string): Promise<DownloadResult>;
  getTemporaryShare(fileId: string, ttlHours?: number): Promise<ShareResult>;
  deleteFile(fileId: string): Promise<void>;
  uploadFile(file: File, category: Category, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<FileRecord>;
  getCategories(): Promise<Category[]>;
  getDashboardStats(): Promise<DashboardStats>;
}
