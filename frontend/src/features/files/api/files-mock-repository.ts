import { ApiError } from "./api-error";
import {
  categoryFixtures,
  normalFileFixtures,
} from "./files.fixtures";
import { DEFAULT_PAGE_SIZE } from "./files-repository";
import type { FilesRepository } from "./files-repository";
import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileListQuery,
  FilePage,
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
  let sharesCreated = 0;

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
    async listFiles(query: FileListQuery = {}): Promise<FilePage> {
      const search = query.search?.trim().toLocaleLowerCase() ?? "";
      failWhenConfigured(search ? "search" : "list");
      const page = query.page ?? 1;
      const limit = query.limit ?? DEFAULT_PAGE_SIZE;
      const matching = files
        .filter((file) => !search || file.originalName.toLocaleLowerCase().includes(search))
        .filter((file) => !query.category || file.category === query.category)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return {
        files: matching.slice((page - 1) * limit, page * limit).map(cloneFile),
        page,
        limit,
        total: matching.length,
        totalPages: Math.ceil(matching.length / limit),
      };
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

    async getTemporaryShare(fileId: string, ttlHours = 24): Promise<ShareResult> {
      failWhenConfigured("share");
      const file = findFile(fileId);
      sharesCreated += 1;

      return {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
        },
        shareUrl: "https://example.invalid/share/" + encodeURIComponent(file.id),
        expiresIn: ttlHours * 3600,
      };
    },

    async deleteFile(fileId: string): Promise<void> {
      failWhenConfigured("delete");
      findFile(fileId);
      files = files.filter((file) => file.id !== fileId);
    },

    async uploadFile(file: File, category: Category, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<FileRecord> {
      const cancelled = () => new ApiError({ message: "Upload was cancelled.", code: "UPLOAD_CANCELLED" });
      if (signal?.aborted) throw cancelled();
      onProgress?.(25);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 300);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(cancelled());
        }, { once: true });
      });
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
        sharedFiles: sharesCreated,
        filesByCategory,
      };
    },
  };
};
