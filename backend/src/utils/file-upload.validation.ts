import { fileTypeFromBuffer } from "file-type";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const allowedMimeTypes = new Set([
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

const previewableMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const validateUploadedFile = (
  mimeType: string,
  size: number,
) => {
  if (size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds the 25 MB limit");
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("File type is not supported");
  }
};

export const validatePreviewableFileContent = async (
  buffer: Buffer,
  mimeType: string,
) => {
  if (!previewableMimeTypes.has(mimeType)) {
    return;
  }

  const detectedType = await fileTypeFromBuffer(buffer);

  if (!detectedType || detectedType.mime !== mimeType) {
    throw new Error("File type is not supported");
  }
};
