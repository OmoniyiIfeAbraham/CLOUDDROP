import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { ApiError } from "../utils/api-error.js";
import { fileCategorySchema } from "../utils/file.validation.js";
import {
  validatePreviewableFileContent,
  validateUploadedFile,
} from "../utils/file-upload.validation.js";
import { buildObjectKey } from "../lib/storage-key.js";
import {
  createShareToken,
  resolveShareExpiry,
  isShareExpired,
  DEFAULT_SHARE_TTL_HOURS,
} from "../lib/share-policy.js";
import { uploadToS3 } from "../services/s3.service.js";
import { deleteFromS3 } from "../services/s3-delete.service.js";
import { generateDownloadUrl } from "../services/s3-download.service.js";
import { generateShareUrl } from "../services/s3-share.service.js";
import {
  createFile,
  getFileById,
  deleteFile as deleteFileRecord,
  listUserFiles,
} from "../services/file.service.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.delete("sslmode");

const poolConfig = {
  connectionString: databaseUrl.toString(),
  ...(process.env.NODE_ENV === "production"
    ? {
        ssl: {
          ca: readFileSync("/etc/ssl/certs/rds-eu-west-1-bundle.pem", "utf8"),
          rejectUnauthorized: true,
        },
      }
    : {}),
};

const adapter = new PrismaPg(poolConfig);

const prisma = new PrismaClient({ adapter });

const getUserId = (req: Request): string => {
  const userId =
    req.user?.id ?? (req as Request & { userId?: string }).userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  return userId;
};

const INLINE_PREVIEW_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/x-yaml",
  "application/yaml",
  "application/sql",
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
]);

export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);

    if (!req.file) {
      throw new ApiError(400, "File is required", "BAD_REQUEST");
    }

    validateUploadedFile(req.file.mimetype, req.file.size);

    const categoryResult = fileCategorySchema.safeParse(req.body);

    if (!categoryResult.success) {
      throw new ApiError(400, "Invalid file category", "BAD_REQUEST");
    }

    const { category } = categoryResult.data;

    await validatePreviewableFileContent(req.file.buffer, req.file.mimetype);

    const fileId = crypto.randomUUID();
    const s3Key = buildObjectKey(userId, fileId, req.file.originalname);

    const uploaded = await uploadToS3(
      req.file.buffer,
      s3Key,
      req.file.mimetype,
    );

    try {
      const savedFile = await createFile(
        userId,
        req.file.originalname,
        uploaded.key,
        req.file.mimetype,
        req.file.size,
        category,
      );

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: { file: savedFile },
      });
    } catch {
      // Roll back S3 object if metadata save fails
      await deleteFromS3(uploaded.key).catch(() => undefined);

      throw new ApiError(
        500,
        "File metadata could not be saved",
        "DATABASE_ERROR",
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "File size exceeds the 2 GB limit") {
        return next(
          new ApiError(400, error.message, "FILE_TOO_LARGE"),
        );
      }

      if (error.message === "File type is not supported") {
        return next(
          new ApiError(400, error.message, "UNSUPPORTED_FILE_TYPE"),
        );
      }
    }

    next(error);
  }
};

export const listFiles = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : undefined;

    const pageParam =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : 1;

    const limitParam =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : 10;

    if (!Number.isInteger(pageParam) || pageParam < 1) {
      throw new ApiError(
        400,
        "Page must be a positive integer",
        "BAD_REQUEST",
      );
    }

    if (
      !Number.isInteger(limitParam) ||
      limitParam < 1 ||
      limitParam > 100
    ) {
      throw new ApiError(
        400,
        "Limit must be an integer between 1 and 100",
        "BAD_REQUEST",
      );
    }

    let validatedCategory:
      | "Documents"
      | "Images"
      | "Videos"
      | "Audio"
      | "Archives"
      | "Other"
      | undefined;

    if (category) {
      const result = fileCategorySchema.safeParse({ category });

      if (!result.success) {
        throw new ApiError(
          400,
          "Invalid file category",
          "BAD_REQUEST",
        );
      }

      validatedCategory = result.data.category;
    }

    const result = await listUserFiles(userId, {
      search,
      category: validatedCategory,
      page: pageParam,
      limit: limitParam,
    });

    return res.status(200).json({
      success: true,
      message: "Files retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      message: "File retrieved successfully",
      data: { file },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    const expiresIn = 600;
    const disposition =
      req.query.disposition === "inline" ? "inline" : "attachment";

    if (
      disposition === "inline" &&
      !INLINE_PREVIEW_MIME_TYPES.has(file.mimeType)
    ) {
      throw new ApiError(
        415,
        "Preview is not supported for this file type",
        "PREVIEW_NOT_SUPPORTED",
      );
    }

    const downloadUrl =
      disposition === "inline"
        ? await generateDownloadUrl(
            file.s3Key,
            expiresIn,
            file.originalName,
            file.mimeType,
            "inline",
          )
        : await generateDownloadUrl(
            file.s3Key,
            expiresIn,
            file.originalName,
          );

    res.status(200).json({
      success: true,
      message: "File download URL generated successfully",
      data: {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        },
        downloadUrl,
        expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const viewFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    if (!INLINE_PREVIEW_MIME_TYPES.has(file.mimeType)) {
      throw new ApiError(
        415,
        "Preview is not supported for this file type",
        "PREVIEW_NOT_SUPPORTED",
      );
    }

    const expiresIn = 600;
    const viewUrl = await generateDownloadUrl(
      file.s3Key,
      expiresIn,
      file.originalName,
      file.mimeType,
      "inline",
    );

    res.status(200).json({
      success: true,
      message: "File view URL generated successfully",
      data: {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
        },
        viewUrl,
        expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const deleted = await deleteFileRecord(id, userId);

    if (!deleted) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const createShare = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);
    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    const ttlHours =
      req.body?.ttlHours === undefined
        ? DEFAULT_SHARE_TTL_HOURS
        : req.body.ttlHours;

    if (typeof ttlHours !== "number") {
      throw new ApiError(
        400,
        "Share TTL must be 1, 24, or 168 hours",
        "BAD_REQUEST",
      );
    }

    let expiresAt: Date;
    try {
      expiresAt = resolveShareExpiry(ttlHours);
    } catch (err) {
      throw new ApiError(
        400,
        err instanceof Error ? err.message : "Invalid share TTL",
        "BAD_REQUEST",
      );
    }

    const token = createShareToken();

    await prisma.share.create({
      data: { fileId: file.id, token, expiresAt },
    });

    const baseUrl = (
      process.env.PUBLIC_APP_URL ??
      "https://clouddrop-c8.duckdns.org"
    ).replace(/\/+$/, "");

    res.status(201).json({
      success: true,
      message: "Share link created successfully",
      data: {
        shareUrl: `${baseUrl}/s/${token}`,
        expiresAt: expiresAt.toISOString(),
        expiresIn: Math.floor(
          (expiresAt.getTime() - Date.now()) / 1000,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicShareDownload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.params.token as string;

    if (!/^[A-Za-z0-9_-]{16}$/.test(token)) {
      throw new ApiError(
        404,
        "This share link is invalid or no longer available",
        "SHARE_NOT_FOUND",
      );
    }

    const share = await prisma.share.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!share || isShareExpired(share.expiresAt)) {
      throw new ApiError(
        404,
        "This share link is invalid or no longer available",
        "SHARE_NOT_FOUND",
      );
    }

    const remainingSeconds = Math.floor(
      (share.expiresAt.getTime() - Date.now()) / 1000,
    );

    if (remainingSeconds <= 0) {
      throw new ApiError(
        404,
        "This share link is invalid or no longer available",
        "SHARE_NOT_FOUND",
      );
    }

    const downloadUrl = await generateShareUrl(
      share.file.s3Key,
      Math.min(300, remainingSeconds),
    );

    res.redirect(302, downloadUrl);
  } catch (error) {
    next(error);
  }
};
