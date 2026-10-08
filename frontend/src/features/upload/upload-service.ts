import { ApiError } from "../files/api/api-error";
import { isApiFailure, isApiSuccess } from "../files/api/contracts";
import type { Category, FileRecord } from "../files/model/file.types";
import { API_BASE_URL, sessionToken } from "../../lib/runtime";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";
import { parseFileRecord } from "../files/api/file-contracts";

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
]);

// Mirrors backend/src/lib/category.ts so suggestions match the server's own rules.
const MIME_TO_CATEGORY: Record<string, Category> = {
  "application/pdf": "Documents",
  "application/msword": "Documents",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documents",
  "application/vnd.ms-excel": "Documents",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Documents",
  "application/vnd.ms-powerpoint": "Documents",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Documents",
  "text/plain": "Documents",
  "text/csv": "Documents",
  "text/markdown": "Documents",
  "application/rtf": "Documents",
  "application/zip": "Archives",
  "application/x-zip-compressed": "Archives",
  "application/x-7z-compressed": "Archives",
  "application/x-rar-compressed": "Archives",
  "application/vnd.rar": "Archives",
  "application/gzip": "Archives",
  "application/x-tar": "Archives",
  "application/x-gzip": "Archives",
};

const MIME_PREFIX_TO_CATEGORY: Array<[string, Category]> = [
  ["image/", "Images"],
  ["video/", "Videos"],
  ["audio/", "Audio"],
];

export const suggestCategory = (mimeType: string): Category => {
  const normalized = mimeType.toLowerCase().trim();
  const exact = MIME_TO_CATEGORY[normalized];
  if (exact) return exact;
  return MIME_PREFIX_TO_CATEGORY.find(([prefix]) => normalized.startsWith(prefix))?.[1] ?? "Other";
};

export const validateUploadFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) return "File exceeds the 2 GB upload limit.";
  if (!ALLOWED_MIME_TYPES.has(file.type)) return "This file type is not supported.";
  return null;
};

const cancelled = (): ApiError => new ApiError({ message: "Upload was cancelled.", code: "UPLOAD_CANCELLED" });

export const uploadFileHttp = (
  file: File,
  category: Category,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<FileRecord> => new Promise((resolve, reject) => {
  const token = sessionToken.get();
  if (!token) {
    reject(new ApiError({ message: "Authentication is required.", code: "UNAUTHORIZED", status: 401 }));
    return;
  }
  if (signal?.aborted) {
    reject(cancelled());
    return;
  }

  const request = new XMLHttpRequest();
  const body = new FormData();
  body.append("file", file);
  body.append("category", category);
  request.open("POST", `${API_BASE_URL.replace(/\/$/, "")}/files`);
  request.setRequestHeader("Authorization", `Bearer ${token}`);
  request.setRequestHeader("Accept", "application/json");
  request.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
  };
  signal?.addEventListener("abort", () => request.abort(), { once: true });
  request.onerror = () => reject(new ApiError({ message: "The network request failed.", code: "NETWORK_ERROR", retryable: true }));
  request.onabort = () => reject(cancelled());
  request.onload = () => {
    if (request.status === 401) {
      if (sessionToken.get() === token) {
        sessionToken.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      reject(new ApiError({ message: "Session expired.", code: "UNAUTHORIZED", status: 401 }));
      return;
    }
    if (request.status === 413) {
      reject(new ApiError({ message: "The server rejected the file size.", code: "PAYLOAD_TOO_LARGE", status: 413 }));
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(request.responseText) as unknown;
    } catch {
      // A proxy error page (502/503/504) is not JSON; report it like the API client does.
      reject(new ApiError({
        message: "The API returned an invalid response.",
        code: request.status >= 400 ? "HTTP_ERROR" : "INVALID_RESPONSE",
        status: request.status,
        retryable: request.status >= 500,
      }));
      return;
    }
    if (request.status < 200 || request.status >= 300) {
      const failure = isApiFailure(payload) ? payload : null;
      reject(new ApiError({
        message: failure?.message ?? "Upload failed.",
        code: failure?.error.code ?? "UPLOAD_FAILED",
        status: request.status,
        retryable: request.status >= 500,
      }));
      return;
    }
    if (!isApiSuccess<{ file: FileRecord }>(payload) || !payload.data?.file) {
      reject(new ApiError({ message: "The API returned an invalid response.", code: "INVALID_RESPONSE", status: request.status }));
      return;
    }
    try {
      resolve(parseFileRecord(payload.data.file));
    } catch (error) {
      reject(error);
    }
  };
  request.send(body);
});
