import { z } from "zod";
import { ApiError } from "./api-error";
import { FILE_CATEGORIES } from "../model/file.types";
import type { DownloadResult, FileRecord, ShareResult } from "../model/file.types";

const fileRecordSchema = z.object({
  id: z.string().min(1),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  category: z.enum(FILE_CATEGORIES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const filePayloadSchema = z.object({ file: fileRecordSchema });
const filesPayloadSchema = z.object({ files: z.array(fileRecordSchema) });
const downloadResultSchema = z.object({
  file: fileRecordSchema.pick({ id: true, originalName: true, mimeType: true, size: true }),
  downloadUrl: z.string(),
  expiresIn: z.number().positive(),
});
const shareResultSchema = z.object({
  file: fileRecordSchema.pick({ id: true, originalName: true, mimeType: true }),
  shareUrl: z.string(),
  expiresIn: z.number().positive(),
});

const invalidResponse = (): ApiError => new ApiError({
  message: "The API returned invalid file data.",
  code: "INVALID_RESPONSE",
});

export const parseFileRecord = (value: unknown): FileRecord => {
  const result = fileRecordSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};

export const parseFilePayload = (value: unknown): FileRecord => {
  const result = filePayloadSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.file;
};

export const parseFilesPayload = (value: unknown): FileRecord[] => {
  const result = filesPayloadSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.files;
};

export const parseDownloadResult = (value: unknown): DownloadResult => {
  const result = downloadResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};

export const parseShareResult = (value: unknown): ShareResult => {
  const result = shareResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};
