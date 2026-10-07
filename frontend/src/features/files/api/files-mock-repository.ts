import { ApiError } from "./api-error";
import {
  categoryFixtures,
  normalFileFixtures,
} from "./files.fixtures";
import type { FilesRepository } from "./files-repository";
import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileRecord,
  ShareResult,
} from "../model/file.types";

export type MockFilesOperation =
  | "categories"
  | "delete"
  | "details"
  | "download"
  | "list"
  | "search"
  | "share"
  | "stats";

export interface MockFilesRepositoryOptions {
  files?: FileRecord[];
  categories?: Category[];
  dashboardStats?: DashboardStats;
  failures?: Partial<Record<MockFilesOperation, ApiError>>;
}

const cloneFile = (file: FileRecord): FileRecord => ({ ...file });

const notFound = (fileId: string): ApiError =>
  new ApiError({
    message: "File " + fileId + " was not found.",
    code: "NOT_FOUND",
    status: 404,
  });

export const createMockFilesRepository = (
  options: MockFilesRepositoryOptions = {},
): FilesRepository => {
  let files = (options.files ?? normalFileFixtures).map(cloneFile);
  const categories = [...(options.categories ?? categoryFixtures)];
  const failures = options.failures ?? {};

  const failWhenConfigured = (operation: MockFilesOperation): void => {
    const failure = failures[operation];

    if (failure) {
      throw failure;
    }
  };

  const findFile = (fileId: string): FileRecord => {
    const file = files.find((candidate) => candidate.id === fileId);

    if (!file) {
      throw notFound(fileId);
    }

    return file;
  };

  return {
    async listFiles(): Promise<FileRecord[]> {
      failWhenConfigured("list");
      return files.map(cloneFile);
    },

    async searchFiles(search: string): Promise<FileRecord[]> {
      failWhenConfigured("search");
      const normalizedSearch = search.trim().toLocaleLowerCase();

      if (!normalizedSearch) {
        return files.map(cloneFile);
      }

      return files
        .filter((file) =>
          file.originalName.toLocaleLowerCase().includes(normalizedSearch),
        )
        .map(cloneFile);
    },

    async getFile(fileId: string): Promise<FileRecord> {
      failWhenConfigured("details");
      return cloneFile(findFile(fileId));
    },

    async getDownload(fileId: string): Promise<DownloadResult> {
      failWhenConfigured("download");
      const file = findFile(fileId);

      return {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        },
        downloadUrl: "https://example.invalid/download/" + encodeURIComponent(file.id),
        expiresIn: 600,
      };
    },

    async getTemporaryShare(fileId: string): Promise<ShareResult> {
      failWhenConfigured("share");
      const file = findFile(fileId);

      return {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
        },
        shareUrl: "https://example.invalid/share/" + encodeURIComponent(file.id),
        expiresIn: 10_800,
      };
    },

    async deleteFile(fileId: string): Promise<void> {
      failWhenConfigured("delete");
      findFile(fileId);
      files = files.filter((file) => file.id !== fileId);
    },

    async uploadFile(file: File, category: Category, onProgress?: (percent: number) => void): Promise<FileRecord> {
      onProgress?.(25);
      await new Promise((resolve) => setTimeout(resolve, 300));
      onProgress?.(85);
      const now = new Date().toISOString();
      const record: FileRecord = {
        id: "mock-upload-" + crypto.randomUUID(),
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        category,
        createdAt: now,
        updatedAt: now,
      };
      files = [record, ...files];
      onProgress?.(100);
      return cloneFile(record);
    },

    async getCategories(): Promise<Category[]> {
      failWhenConfigured("categories");
      return [...categories];
    },

    async getDashboardStats(): Promise<DashboardStats> {
      failWhenConfigured("stats");

      if (options.dashboardStats) {
        return {
          ...options.dashboardStats,
          filesByCategory: { ...options.dashboardStats.filesByCategory },
        };
      }

      const filesByCategory: DashboardStats["filesByCategory"] = {
        Documents: 0,
        Images: 0,
        Videos: 0,
        Audio: 0,
        Archives: 0,
        Other: 0,
      };

      for (const file of files) {
        filesByCategory[file.category] += 1;
      }

      const totalStorageBytes = files.reduce(
        (total, file) => total + file.size,
        0,
      );

      return {
        totalFiles: files.length,
        totalStorageBytes,
        filesByCategory,
      };
    },
  };
};
