import { z } from "zod";
import { ApiError } from "./api-error";
import { FILE_CATEGORIES } from "../model/file.types";
import type { DashboardStats, DownloadResult, FilePage, FileRecord, ShareResult, ViewResult } from "../model/file.types";

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
const filePageSchema = z.object({
  files: z.array(fileRecordSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const dashboardStatsSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  totalStorage: z.number().nonnegative(),
  sharedFiles: z.number().int().nonnegative(),
  filesByCategory: z.record(z.enum(FILE_CATEGORIES), z.number().int().nonnegative()),
});
const downloadResultSchema = z.object({
  file: fileRecordSchema.pick({ id: true, originalName: true, mimeType: true, size: true }),
  downloadUrl: z.string(),
  expiresIn: z.number().positive(),
});
const viewResultSchema = z.object({
  file: fileRecordSchema.pick({ id: true, originalName: true, mimeType: true, size: true }),
  viewUrl: z.string(),
  expiresIn: z.number().positive(),
});
const shareResultSchema = z.object({
  shareUrl: z.string().url(),
  expiresIn: z.number().positive(),
  expiresAt: z.iso.datetime(),
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

export const parseFilePage = (value: unknown): FilePage => {
  const result = filePageSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return { files: result.data.files, ...result.data.pagination };
};

export const parseDashboardStats = (value: unknown): DashboardStats => {
  const result = dashboardStatsSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  const { totalFiles, totalStorage, sharedFiles, filesByCategory } = result.data;
  return { totalFiles, totalStorageBytes: totalStorage, sharedFiles, filesByCategory };
};

export const parseDownloadResult = (value: unknown): DownloadResult => {
  const result = downloadResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};

export const parseViewResult = (value: unknown): ViewResult => {
  const result = viewResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};

export const parseShareResult = (value: unknown): ShareResult => {
  const result = shareResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
};
