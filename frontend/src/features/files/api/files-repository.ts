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
  getTemporaryShare(fileId: string): Promise<ShareResult>;
  deleteFile(fileId: string): Promise<void>;
  getCategories(): Promise<Category[]>;
  getDashboardStats(): Promise<DashboardStats>;
}
