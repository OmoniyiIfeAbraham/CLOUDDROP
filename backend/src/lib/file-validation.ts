import { ApiError } from "../utils/api-error.js";

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".sh",
  ".ps1",
]);

export type FileUploadInput = {
  originalName: string;
  mimeType: string;
  size: number;
};

const getExtension = (originalName: string): string => {
  const index = originalName.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return originalName.slice(index).toLowerCase();
};

export const getMaxFileSizeBytes = (): number => {
  const fromEnv = Number(process.env.MAX_FILE_SIZE_BYTES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_MAX_FILE_SIZE_BYTES;
};

export const validateFileUpload = (input: FileUploadInput): void => {
  const originalName = input.originalName.trim();
  if (!originalName) {
    throw new ApiError(400, "File name is required", "INVALID_FILE_NAME");
  }

  if (originalName.includes("..") || originalName.includes("/") || originalName.includes("\\")) {
    throw new ApiError(400, "File name is invalid", "INVALID_FILE_NAME");
  }

  if (!input.mimeType || !input.mimeType.includes("/")) {
    throw new ApiError(400, "File type is invalid", "INVALID_FILE_TYPE");
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new ApiError(400, "File is empty or invalid", "INVALID_FILE_SIZE");
  }

  const maxSize = getMaxFileSizeBytes();
  if (input.size > maxSize) {
    throw new ApiError(
      400,
      `File exceeds the maximum size of ${maxSize} bytes`,
      "FILE_TOO_LARGE"
    );
  }

  const extension = getExtension(originalName);
  if (BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new ApiError(400, "This file type is not allowed", "FILE_TYPE_NOT_ALLOWED");
  }
};
