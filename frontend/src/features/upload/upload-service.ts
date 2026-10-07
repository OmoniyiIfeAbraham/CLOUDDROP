import { ApiError } from "../files/api/api-error";
import { isApiFailure, isApiSuccess } from "../files/api/contracts";
import type { Category, FileRecord } from "../files/model/file.types";
import { API_BASE_URL, sessionToken } from "../../lib/runtime";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";

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

export const validateUploadFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) return "File exceeds the 2 GB upload limit.";
  if (!ALLOWED_MIME_TYPES.has(file.type)) return "This file type is not supported.";
  return null;
};

export const uploadFileHttp = (
  file: File,
  category: Category,
  onProgress?: (percent: number) => void,
): Promise<FileRecord> => new Promise((resolve, reject) => {
  const token = sessionToken.get();
  if (!token) {
    reject(new ApiError({ message: "Authentication is required.", code: "UNAUTHORIZED", status: 401 }));
    return;
  }

  const request = new XMLHttpRequest();
  const body = new FormData();
  body.append("file", file);
  body.append("category", category);
  request.open("POST", `${API_BASE_URL.replace(/\/$/, "")}/files/upload`);
  request.setRequestHeader("Authorization", `Bearer ${token}`);
  request.setRequestHeader("Accept", "application/json");
  request.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
  };
  request.onerror = () => reject(new ApiError({ message: "The network request failed.", code: "NETWORK_ERROR", retryable: true }));
  request.onabort = () => reject(new ApiError({ message: "Upload was cancelled.", code: "UPLOAD_CANCELLED" }));
  request.onload = () => {
    if (request.status === 401) {
      sessionToken.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      reject(new ApiError({ message: "Session expired.", code: "UNAUTHORIZED", status: 401 }));
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(request.responseText) as unknown;
    } catch {
      reject(new ApiError({ message: "The API returned an invalid response.", code: "INVALID_RESPONSE", status: request.status }));
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
    resolve(payload.data.file);
  };
  request.send(body);
});
