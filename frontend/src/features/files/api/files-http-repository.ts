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

interface FilesPayload {
  files: FileRecord[];
}

interface FilePayload {
  file: FileRecord;
}

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
    const data = await client.request<FilesPayload>("/files");
    return data.files;
  },

  async searchFiles(search: string): Promise<FileRecord[]> {
    const normalizedSearch = search.trim();

    if (!normalizedSearch) {
      const data = await client.request<FilesPayload>("/files");
      return data.files;
    }

    const data = await client.request<FilesPayload>("/files/search", {
      query: { search: normalizedSearch },
    });

    return data.files;
  },

  async getFile(fileId: string): Promise<FileRecord> {
    const data = await client.request<FilePayload>(filePath(fileId));
    return data.file;
  },

  getDownload(fileId: string): Promise<DownloadResult> {
    return client.request<DownloadResult>(filePath(fileId) + "/download");
  },

  getTemporaryShare(fileId: string): Promise<ShareResult> {
    return client.request<ShareResult>(filePath(fileId) + "/share");
  },

  async deleteFile(fileId: string): Promise<void> {
    await client.request<void>(filePath(fileId), {
      method: "DELETE",
      allowEmptyData: true,
    });
  },

  getCategories(): Promise<Category[]> {
    return Promise.reject(unavailable("Categories"));
  },

  getDashboardStats(): Promise<DashboardStats> {
    return Promise.reject(unavailable("Dashboard statistics"));
  },
});
