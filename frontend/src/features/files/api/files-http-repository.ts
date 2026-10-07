import { ApiError } from "./api-error";
import type { ApiClient } from "./api-client";
import type { FilesRepository } from "./files-repository";
import type {
  Category,
  DashboardStats,
  DownloadResult,
  FileRecord,
  ShareResult,
} from "../model/file.types";
import { uploadFileHttp } from "../../upload/upload-service";
import { parseDownloadResult, parseFilePayload, parseFilesPayload, parseShareResult } from "./file-contracts";

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
  async listFiles(): Promise<FileRecord[]> {
    return parseFilesPayload(await client.request<unknown>("/files"));
  },

  async searchFiles(search: string): Promise<FileRecord[]> {
    const normalizedSearch = search.trim();

    if (!normalizedSearch) {
      return parseFilesPayload(await client.request<unknown>("/files"));
    }

    const data = await client.request<unknown>("/files/search", {
      query: { search: normalizedSearch },
    });

    return parseFilesPayload(data);
  },

  async getFile(fileId: string): Promise<FileRecord> {
    return parseFilePayload(await client.request<unknown>(filePath(fileId)));
  },

  async getDownload(fileId: string): Promise<DownloadResult> {
    return parseDownloadResult(await client.request<unknown>(filePath(fileId) + "/download"));
  },

  async getTemporaryShare(fileId: string): Promise<ShareResult> {
    return parseShareResult(await client.request<unknown>(filePath(fileId) + "/share"));
  },

  async deleteFile(fileId: string): Promise<void> {
    await client.request<void>(filePath(fileId), {
      method: "DELETE",
      allowEmptyData: true,
    });
  },

  uploadFile(file: File, category: Category, onProgress?: (percent: number) => void): Promise<FileRecord> {
    return uploadFileHttp(file, category, onProgress);
  },

  getCategories(): Promise<Category[]> {
    return Promise.reject(unavailable("Categories"));
  },

  getDashboardStats(): Promise<DashboardStats> {
    return Promise.reject(unavailable("Dashboard statistics"));
  },
});
