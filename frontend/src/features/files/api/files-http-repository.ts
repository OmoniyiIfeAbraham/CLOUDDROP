import { ApiError } from "./api-error";
import type { ApiClient } from "./api-client";
import { DEFAULT_PAGE_SIZE } from "./files-repository";
import type { FilesRepository } from "./files-repository";
import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileListQuery,
  FilePage,
  FileRecord,
  FileDisposition,
  ShareResult,
} from "../model/file.types";
import { uploadFileHttp } from "../../upload/upload-service";
import { parseDashboardStats, parseDownloadResult, parseFilePage, parseFilePayload, parseShareResult } from "./file-contracts";

const filePath = (fileId: string): string =>
  "/files/" + encodeURIComponent(fileId);

const unavailable = (feature: string): ApiError =>
  new ApiError({
    message: feature + " is not available from the backend yet.",
    code: "FEATURE_UNAVAILABLE",
  });

export const createHttpFilesRepository = (
  client: ApiClient,
): FilesRepository => ({
  async listFiles(query: FileListQuery = {}): Promise<FilePage> {
    const data = await client.request<unknown>("/files", {
      query: {
        search: query.search?.trim() || undefined,
        category: query.category,
        page: query.page ?? 1,
        limit: query.limit ?? DEFAULT_PAGE_SIZE,
      },
    });

    return parseFilePage(data);
  },

  async getFile(fileId: string): Promise<FileRecord> {
    return parseFilePayload(await client.request<unknown>(filePath(fileId)));
  },

  async getDownload(fileId: string, disposition: FileDisposition = "attachment"): Promise<DownloadResult> {
    return parseDownloadResult(await client.request<unknown>(filePath(fileId) + "/download", { query: { disposition } }));
  },

  async getTemporaryShare(fileId: string, ttlHours?: number): Promise<ShareResult> {
    return parseShareResult(await client.request<unknown>(filePath(fileId) + "/share", {
      method: "POST",
      ...(ttlHours === undefined ? {} : { body: JSON.stringify({ ttlHours }) }),
    }));
  },

  async deleteFile(fileId: string): Promise<void> {
    await client.request<void>(filePath(fileId), {
      method: "DELETE",
      allowEmptyData: true,
    });
  },

  uploadFile(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<FileRecord> {
    return uploadFileHttp(file, onProgress, signal);
  },

  getCategories(): Promise<Category[]> {
    return Promise.reject(unavailable("Categories"));
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return parseDashboardStats(await client.request<unknown>("/dashboard/stats"));
  },
});
